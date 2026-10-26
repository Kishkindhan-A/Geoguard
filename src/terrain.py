"""Real survey geometry ingestion and public DEM acquisition.

No photograph brightness, procedural relief, or inferred AI depth is used.
All render coordinates are in metres, centred locally to preserve float precision.
"""
from __future__ import annotations
import hashlib
import io
import json
import math
import os
import re
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import requests
from PIL import Image
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from rasterio.warp import calculate_default_transform, reproject, transform_bounds
from pyproj import CRS, Transformer

ROOT = Path(__file__).resolve().parent.parent
USGS = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer"


def terrain_root() -> Path:
    folder = Path(os.environ.get("GEOGUARD_TERRAIN_PATH", str(ROOT / "data/terrain")))
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def safe_folder(terrain_id: str) -> Path:
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", terrain_id):
        raise ValueError("Invalid terrain identifier")
    return terrain_root() / terrain_id


def read_metadata(terrain_id: str) -> dict:
    path = safe_folder(terrain_id) / "metadata.json"
    if not path.exists():
        raise FileNotFoundError("Terrain dataset not found")
    return json.loads(path.read_text(encoding="utf8"))


def list_terrain() -> list[dict]:
    return [json.loads(p.read_text(encoding="utf8")) for p in sorted(terrain_root().glob("*/metadata.json"))]


def utm_crs(longitude: float, latitude: float) -> CRS:
    zone = max(1, min(60, int((longitude + 180) / 6) + 1))
    return CRS.from_epsg((32600 if latitude >= 0 else 32700) + zone)


def write_geometry(terrain_id: str, xyz: np.ndarray, colors: np.ndarray | None,
                   indices: np.ndarray | None, extra: dict) -> dict:
    xyz = np.asarray(xyz, dtype=np.float64)
    if xyz.ndim != 2 or xyz.shape[1] != 3 or len(xyz) < 3 or not np.isfinite(xyz).all():
        raise ValueError("Survey geometry must contain at least three finite XYZ points")
    mins, maxs = xyz.min(axis=0), xyz.max(axis=0)
    if np.max(np.abs(xyz)) > 1e9 or np.max(maxs-mins) > 1_000_000:
        raise ValueError("Geometry coordinates exceed the supported mine-scale metre range")
    origin = np.array([(mins[0] + maxs[0]) / 2, (mins[1] + maxs[1]) / 2, mins[2]])
    # Survey is Z-up; Three.js is Y-up. Positive north maps to negative render Z.
    render = np.column_stack((xyz[:, 0]-origin[0], xyz[:, 2]-origin[2], -(xyz[:, 1]-origin[1]))).astype("<f4")
    folder = safe_folder(terrain_id)
    folder.mkdir(parents=True, exist_ok=True)
    render.tofile(folder / "positions.bin")
    assets = {"positions": f"/api/terrain/{terrain_id}/assets/positions.bin"}
    if colors is not None:
        np.asarray(colors, dtype=np.uint8).tofile(folder / "colors.bin")
        assets["colors"] = f"/api/terrain/{terrain_id}/assets/colors.bin"
    if indices is not None:
        np.asarray(indices, dtype="<u4").tofile(folder / "indices.bin")
        assets["indices"] = f"/api/terrain/{terrain_id}/assets/indices.bin"
    metadata = {"id": terrain_id, "created_at": datetime.now(timezone.utc).isoformat(),
                "kind": "surface" if indices is not None else "pointcloud", "point_count": len(xyz),
                "triangle_count": int(len(indices) // 3) if indices is not None else 0,
                "origin": {"easting": float(origin[0]), "northing": float(origin[1]), "elevation": float(origin[2])},
                "extent_m": {"width": float(maxs[0]-mins[0]), "depth": float(maxs[1]-mins[1]), "relief": float(maxs[2]-mins[2])},
                "elevation_m": {"min": float(mins[2]), "max": float(maxs[2])},
                "units": "metres", "axes": "Render X=east, Y=elevation, Z=south; add origin to recover survey coordinates",
                "assets": assets, **extra}
    (folder / "metadata.tmp").write_text(json.dumps(metadata, indent=2, allow_nan=False), encoding="utf8")
    (folder / "metadata.tmp").replace(folder / "metadata.json")
    return metadata


def grid_to_geometry(elevation: np.ndarray, transform, crs: CRS, terrain_id: str, extra: dict) -> dict:
    h, w = elevation.shape
    rows, cols = np.indices((h, w))
    xs, ys = rasterio.transform.xy(transform, rows, cols, offset="center")
    xyz = np.column_stack((np.asarray(xs).reshape(-1), np.asarray(ys).reshape(-1), elevation.reshape(-1)))
    valid = np.isfinite(xyz).all(axis=1)
    if valid.mean() < 0.2:
        raise ValueError("Less than 20% of the requested surface has valid elevation data")
    # Preserve NoData holes: triangles touching a missing elevation are omitted.
    ids = np.arange(h*w).reshape(h,w)
    a, b, c, d = ids[:-1,:-1].ravel(), ids[1:,:-1].ravel(), ids[1:,1:].ravel(), ids[:-1,1:].ravel()
    triangles = np.concatenate((np.column_stack((a,b,d)), np.column_stack((b,c,d))))
    triangles = triangles[valid[triangles].all(axis=1)]
    if not len(triangles):
        raise ValueError("No connected valid surface triangles are available")
    remap = np.full(len(xyz), -1, dtype=np.int32)
    remap[valid] = np.arange(valid.sum())
    indices = remap[triangles].astype(np.uint32).ravel()
    bounds = rasterio.transform.array_bounds(h,w,transform)
    geo = transform_bounds(crs, "EPSG:4326", *bounds)
    sx, sy = abs(transform.a), abs(transform.e)
    # Gradients are computed only for valid adjacent samples. Holes stay NaN.
    dzdy, dzdx = np.gradient(elevation, sy, sx)
    slope = np.degrees(np.arctan(np.hypot(dzdx,dzdy))).reshape(-1)[valid].astype("<f4")
    folder = safe_folder(terrain_id)
    folder.mkdir(parents=True, exist_ok=True)
    slope.tofile(folder / "slope.bin")
    result = write_geometry(terrain_id, xyz[valid], None, indices, {
        "crs": crs.to_string(), "georeferenced": True,
        "bounds": {"west":geo[0],"south":geo[1],"east":geo[2],"north":geo[3]},
        "grid": {"rows":h,"cols":w,"spacing_x_m":sx,"spacing_y_m":sy,"valid_fraction":float(valid.mean())},
        "slope_degrees": {"median":float(np.nanmedian(slope)),"p95":float(np.nanpercentile(slope,95)),
                          "meaning":"Terrain gradient at display sampling, not a geotechnical stability score"},
        **extra})
    result["assets"]["slope"] = f"/api/terrain/{terrain_id}/assets/slope.bin"
    (folder / "metadata.json").write_text(json.dumps(result,indent=2,allow_nan=False),encoding="utf8")
    return result


def fetch_usgs_texture(terrain_id: str) -> dict:
    """Public CONUS orthoimagery, reprojected to the exact DEM render footprint."""
    result=read_metadata(terrain_id)
    if not result.get("georeferenced"):
        raise ValueError("Orthoimagery requires a georeferenced elevation surface")
    crs=CRS.from_user_input(result["crs"])
    e,n=result["origin"]["easting"],result["origin"]["northing"]
    w,d=result["extent_m"]["width"],result["extent_m"]["depth"]
    # Geometry's extent is the outer pixel-centre footprint, matching UV coordinates.
    bounds=[e-w/2,n-d/2,e+w/2,n+d/2]
    url="https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/export"
    r=requests.get(url,params={"bbox":",".join(str(v) for v in bounds),"bboxSR":crs.to_epsg(),
        "imageSR":crs.to_epsg(),"size":"2048,2048","format":"jpg","f":"image"},timeout=(10,60))
    r.raise_for_status()
    with Image.open(io.BytesIO(r.content)) as picture:
        picture.verify()
    (safe_folder(terrain_id)/"texture.jpg").write_bytes(r.content)
    result["assets"]["texture"]=f"/api/terrain/{terrain_id}/assets/texture.jpg"
    result["imagery"]={"source":"USDA / USGS The National Map orthoimagery","url":url,
        "attribution":"USDA, USGS The National Map: Orthoimagery",
        "epoch":"Service description lists CONUS NAIP 2017–2021; exact site acquisition date unverified",
        "note":"Imagery and elevation may be different survey epochs; texture does not change measured geometry"}
    (safe_folder(terrain_id)/"metadata.json").write_text(json.dumps(result,indent=2),encoding="utf8")
    return result


def import_dem(path: Path, name: str, z_units="m", terrain_id: str | None = None, extra: dict | None = None) -> dict:
    terrain_id = terrain_id or "survey-" + uuid.uuid4().hex
    with rasterio.open(path, drivers=["GTiff"]) as dataset:
        if dataset.driver != "GTiff" or dataset.crs is None or dataset.count != 1:
            raise ValueError("Upload a single-band GeoTIFF DEM with an embedded coordinate reference system")
        if dataset.width < 3 or dataset.height < 3 or dataset.width * dataset.height > 500_000_000:
            raise ValueError("DEM dimensions must be at least 3×3 and below 500 million pixels")
        geo = transform_bounds(dataset.crs, "EPSG:4326", *dataset.bounds)
        if not np.isfinite(geo).all() or geo[1] < -80 or geo[3] > 84:
            raise ValueError("The survey must lie within the supported local UTM latitude range (80°S to 84°N)")
        if geo[2]-geo[0] > 0.3 or geo[3]-geo[1] > 0.3:
            raise ValueError("Crop the DEM to a mine-scale area smaller than 0.3 degrees per side")
        target_crs = utm_crs((geo[0]+geo[2])/2, (geo[1]+geo[3])/2)
        bounds = transform_bounds(dataset.crs,target_crs,*dataset.bounds)
        width, height = bounds[2]-bounds[0], bounds[3]-bounds[1]
        cols = min(769, max(3,dataset.width))
        rows = max(3, min(769, round(cols*height/width)))
        cols = max(3,min(769,round(rows*width/height)))
        transform = from_bounds(*bounds,cols,rows)
        output = np.full((rows,cols),np.nan,np.float32)
        reproject(source=rasterio.band(dataset,1),destination=output,
                  src_transform=dataset.transform,src_crs=dataset.crs,src_nodata=dataset.nodata,
                  dst_transform=transform,dst_crs=target_crs,dst_nodata=np.nan,resampling=Resampling.bilinear)
        if z_units == "ft": output *= 0.3048
        elif z_units != "m": raise ValueError("Vertical units must be m or ft")
        if not np.isfinite(output).any() or np.nanmax(np.abs(output)) > 20000:
            raise ValueError("DEM elevations are invalid or outside supported metre ranges")
        source_resolution = list(dataset.res)
        source_crs = dataset.crs.to_string()
    return grid_to_geometry(output,transform,target_crs,terrain_id,{
        "name":name,"source":"Operator supplied GeoTIFF survey", "source_crs":source_crs,
        "source_pixel_size":source_resolution,"source_vertical_units":z_units,
        "vertical_datum":"Operator must verify vertical datum and survey accuracy",
        "source_sha256":hashlib.sha256(path.read_bytes()).hexdigest(),
        "limitations":["Display mesh is resampled from the uploaded raster", "DEM is 2.5D and cannot represent overhangs", "Survey date, datum and accuracy require source verification"],
        **(extra or {})})


def import_ply(path: Path, name: str, units="m", terrain_id: str | None = None, extra: dict | None = None) -> dict:
    from plyfile import PlyData
    if path.stat().st_size > 256*1024*1024:
        raise ValueError("PLY files must be smaller than 256 MB")
    with path.open("rb") as fh:
        header = fh.read(16384)
    if not header.startswith(b"ply") or b"end_header" not in header:
        raise ValueError("Invalid PLY header")
    vertex_count = re.search(rb"element vertex (\d+)", header)
    if not vertex_count or int(vertex_count[1]) > 15_000_000:
        raise ValueError("PLY must declare at most 15 million vertices")
    cloud = PlyData.read(str(path), mmap=False)
    vertices = cloud["vertex"]
    if not {"x","y","z"}.issubset(vertices.data.dtype.names or []):
        raise ValueError("PLY requires x, y and z vertex properties")
    xyz = np.column_stack([vertices[k] for k in ("x","y","z")]).astype(np.float64)
    if units == "ft": xyz *= 0.3048
    elif units != "m": raise ValueError("Point units must be m or ft")
    valid = np.isfinite(xyz).all(axis=1)
    names = set(vertices.data.dtype.names or [])
    colors = np.column_stack([vertices[c] for c in ("red","green","blue")]).astype(np.uint8) if {"red","green","blue"}.issubset(names) else None
    xyz = xyz[valid]
    if colors is not None: colors = colors[valid]
    original_count = len(xyz)
    # Keep original measured points. Never synthesize geometry between points.
    if len(xyz) > 900_000:
        keep = np.linspace(0,len(xyz)-1,900_000,dtype=np.int64)
        xyz = xyz[keep]
        if colors is not None: colors = colors[keep]
    return write_geometry(terrain_id or "survey-"+uuid.uuid4().hex,xyz,colors,None,{
        "name":name,"source":"Operator supplied PLY point cloud","georeferenced":False,"crs":None,
        "source_point_count":original_count,"source_vertical_units":units,
        "source_sha256":hashlib.sha256(path.read_bytes()).hexdigest(),
        "vertical_datum":"Local survey coordinates; absolute datum not supplied",
        "limitations":["Original XYZ and RGB samples; display deterministically thinned to 900,000 points", "No automatic CRS or camera registration is inferred", "Coordinate unit convention must be checked against the source survey"],
        **(extra or {})})


def fetch_usgs(latitude: float, longitude: float, width_m: float = 5000, name="USGS terrain", terrain_id=None) -> dict:
    target = utm_crs(longitude,latitude)
    center = Transformer.from_crs("EPSG:4326",target,always_xy=True).transform(longitude,latitude)
    bounds = [center[0]-width_m/2,center[1]-width_m/2,center[0]+width_m/2,center[1]+width_m/2]
    response = requests.get(USGS+"/exportImage",params={"bbox":",".join(str(v) for v in bounds),
        "bboxSR":target.to_epsg(),"imageSR":target.to_epsg(),"size":"769,769","format":"tiff",
        "pixelType":"F32","interpolation":"RSP_BilinearInterpolation","f":"image"},timeout=(10,60))
    response.raise_for_status()
    terrain_id = terrain_id or "usgs-"+uuid.uuid4().hex
    folder = safe_folder(terrain_id)
    folder.mkdir(parents=True,exist_ok=True)
    source_path = folder / "source.tif"
    source_path.write_bytes(response.content)
    try:
        result = import_dem(source_path,name,terrain_id=terrain_id,extra={
            "source":"USGS 3DEP bare-earth elevation service","source_url":USGS,
            "license":"Public domain; elevation data courtesy of the U.S. Geological Survey",
            "acquisition_date":None,"source_resolution_note":"Multi-resolution mosaic; exported sampling does not establish native survey resolution",
            "vertical_datum":"Source varies; verify catalog metadata before engineering measurement",
            "limitations":["Historical terrain mosaic, not a current mine survey", "Underlying resolution and acquisition date vary", "NoData holes are preserved; no AI or procedural relief is inserted", "Mine benches may be smoothed at source resolution"]})
    except Exception:
        raise ValueError("USGS returned an invalid DEM or insufficient coverage for this area")
    # Keep catalog provenance near the centre without claiming a single survey epoch.
    try:
        geometry = json.dumps({"x":longitude,"y":latitude,"spatialReference":{"wkid":4326}})
        info = requests.get(USGS+"/identify",params={"geometry":geometry,"geometryType":"esriGeometryPoint",
            "returnCatalogItems":"true","returnGeometry":"false","f":"json"},timeout=(5,15)).json()
        features = info.get("catalogItems",{}).get("features",[])
        result["source_catalog"] = [f.get("attributes",{}) for f in features][:20]
        (folder / "metadata.json").write_text(json.dumps(result,indent=2),encoding="utf8")
    except requests.RequestException:
        pass
    return result


def fetch_global(latitude: float, longitude: float, width_m=4000, name="Global elevation context") -> dict:
    """Public Mapzen Terrarium tiles, sampled at native zoom-12 tile spacing."""
    zoom = 12
    n = 2**zoom
    lat = math.radians(latitude)
    tx = (longitude+180)/360*n
    ty = (1-math.asinh(math.tan(lat))/math.pi)/2*n
    scale = 156543.03392804097*math.cos(lat)/(2**zoom)
    half = width_m/(2*scale*256)
    x0,x1 = math.floor(tx-half),math.floor(tx+half)
    y0,y1 = math.floor(ty-half),math.floor(ty+half)
    tiles = [(x,y) for y in range(y0,y1+1) for x in range(x0,x1+1)]
    if len(tiles)>16: raise ValueError("Requested global terrain area is too large at this latitude")
    def fetch(tile):
        x,y=tile
        url=f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{zoom}/{x%n}/{y}.png"
        r=requests.get(url,timeout=(5,25)); r.raise_for_status()
        rgb=np.asarray(Image.open(io.BytesIO(r.content)).convert("RGB"),dtype=np.float32)
        elevation=rgb[:,:,0]*256+rgb[:,:,1]+rgb[:,:,2]/256-32768
        elevation[(elevation < -12000) | (elevation > 10000)] = np.nan
        return x,y,elevation
    tile_data=[]
    with ThreadPoolExecutor(max_workers=4) as pool:
        tile_data=list(pool.map(fetch,tiles))
    mosaic=np.full(((y1-y0+1)*256,(x1-x0+1)*256),np.nan,np.float32)
    for x,y,data in tile_data: mosaic[(y-y0)*256:(y-y0+1)*256,(x-x0)*256:(x-x0+1)*256]=data
    world=20037508.342789244
    tile_span=2*world/n
    src_transform=from_bounds(-world+x0*tile_span,world-(y1+1)*tile_span,-world+(x1+1)*tile_span,world-y0*tile_span,mosaic.shape[1],mosaic.shape[0])
    target=utm_crs(longitude,latitude)
    cx,cy=Transformer.from_crs(4326,target,always_xy=True).transform(longitude,latitude)
    side=max(33,min(513,round(width_m/scale)))
    dst_transform=from_bounds(cx-width_m/2,cy-width_m/2,cx+width_m/2,cy+width_m/2,side,side)
    output=np.full((side,side),np.nan,np.float32)
    reproject(mosaic,output,src_transform=src_transform,src_crs="EPSG:3857",dst_transform=dst_transform,dst_crs=target,dst_nodata=np.nan,resampling=Resampling.bilinear)
    terrain_id="global-"+uuid.uuid4().hex
    result=grid_to_geometry(output,dst_transform,target,terrain_id,{
        "name":name,"source":"Mapzen Terrain Tiles on AWS","source_url":"https://registry.opendata.aws/terrain-tiles/",
        "license":"Mapzen / source agencies; see https://github.com/tilezen/joerd/blob/master/docs/attribution.md",
        "acquisition_date":None,"source_resolution_note":f"Tile sampling about {scale:.1f} m at this latitude; source resolution and epoch vary",
        "vertical_datum":"Mixed source DEMs; do not assume a common engineering datum",
        "limitations":["Regional context only; individual mine benches and cracks may not be resolved", "Historical source DEMs may predate excavation", "No acquisition date or survey accuracy is inferred"]})
    with rasterio.open(safe_folder(terrain_id)/"source.tif","w",driver="GTiff",height=side,width=side,
            count=1,dtype="float32",crs=target,transform=dst_transform,nodata=np.nan) as ds:
        ds.write(output,1)
    return result
