"""Real geometry invariants, NoData handling, units and terrain API boundaries."""
import io
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import rasterio
from rasterio.io import MemoryFile
from rasterio.transform import from_origin
from fastapi.testclient import TestClient
from src.terrain import grid_to_geometry, import_dem, import_ply, read_metadata, safe_folder, write_geometry
from api.server import app
from pyproj import CRS


def geotiff(nodata=False, crs="EPSG:32612"):
    a=np.array([[110,111,112,113],[108,109,110,111],[106,107,108,109],[104,105,106,107]],np.float32)
    if nodata:a[1,1]=-9999
    with MemoryFile() as mem:
        with mem.open(driver="GTiff",height=4,width=4,count=1,dtype="float32",crs=crs,
            transform=from_origin(400000,4486000,2,2),nodata=-9999) as ds:ds.write(a,1)
        return mem.read()


PLY=b"""ply
format ascii 1.0
element vertex 4
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
end_header
100 200 10 255 0 0
110 200 20 0 255 0
100 210 30 0 0 255
110 210 40 255 255 255
"""


class TerrainTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.previous=os.environ.get("GEOGUARD_TERRAIN_PATH")
        os.environ["GEOGUARD_TERRAIN_PATH"]=str(Path(self.tmp.name)/"terrain")
        self.client=TestClient(app)

    def tearDown(self):
        self.client.close()
        if self.previous is None:os.environ.pop("GEOGUARD_TERRAIN_PATH",None)
        else:os.environ["GEOGUARD_TERRAIN_PATH"]=self.previous
        self.tmp.cleanup()

    def test_origin_transform_is_reversible_and_metric(self):
        xyz=np.array([[400000,4486000,1200],[400030,4486040,1250],[400050,4486050,1210]],np.float64)
        meta=write_geometry("metric",xyz,None,None,{"name":"Survey"})
        p=np.fromfile(safe_folder("metric")/"positions.bin",dtype="<f4").reshape(-1,3)
        restored=np.column_stack((p[:,0]+meta["origin"]["easting"],-p[:,2]+meta["origin"]["northing"],p[:,1]+meta["origin"]["elevation"]))
        np.testing.assert_allclose(restored,xyz,rtol=0,atol=.01)
        self.assertAlmostEqual(np.linalg.norm(p[0]-p[1]),np.linalg.norm(xyz[0]-xyz[1]),places=4)

    def test_surface_faces_never_bridge_nodata(self):
        a=np.arange(16,dtype=np.float32).reshape(4,4);a[1,1]=np.nan
        result=grid_to_geometry(a,from_origin(400000,4486000,2,2),CRS.from_epsg(32612),"holes",{"name":"NoData survey"})
        self.assertEqual(result["point_count"],15)
        self.assertLess(result["triangle_count"],18)
        p=np.fromfile(safe_folder("holes")/"positions.bin",dtype="<f4")
        self.assertTrue(np.isfinite(p).all())
        indices=np.fromfile(safe_folder("holes")/"indices.bin",dtype="<u4")
        self.assertLess(indices.max(),15)

    def test_analytic_surface_gradient(self):
        # 2 m elevation change per 2 m grid row -> 45 degree slope.
        a=np.repeat(np.arange(4,dtype=np.float32)[:,None]*2,4,axis=1)
        r=grid_to_geometry(a,from_origin(400000,4486000,2,2),CRS.from_epsg(32612),"gradient",{"name":"Measured plane"})
        self.assertAlmostEqual(r["slope_degrees"]["median"],45,places=3)

    def test_ply_preserves_original_rgb_and_local_coordinates(self):
        p=Path(self.tmp.name)/"survey.ply";p.write_bytes(PLY)
        r=import_ply(p,"Mine cloud",terrain_id="cloud")
        self.assertFalse(r["georeferenced"])
        self.assertEqual(r["source_point_count"],4)
        self.assertEqual(r["triangle_count"],0)
        colors=np.fromfile(safe_folder("cloud")/"colors.bin",dtype=np.uint8).reshape(-1,3)
        np.testing.assert_array_equal(colors[0],[255,0,0])
        self.assertEqual(r["extent_m"]["relief"],30)

    def test_feet_are_converted_to_metres(self):
        p=Path(self.tmp.name)/"survey.ply";p.write_bytes(PLY)
        r=import_ply(p,"Feet cloud",units="ft",terrain_id="feet")
        self.assertAlmostEqual(r["extent_m"]["relief"],30*.3048)

    def test_geotiff_import_has_crs_and_source_resolution(self):
        p=Path(self.tmp.name)/"survey.tif";p.write_bytes(geotiff())
        r=import_dem(p,"Mine DEM",terrain_id="dem")
        self.assertTrue(r["georeferenced"])
        self.assertEqual(r["point_count"],16)
        self.assertEqual(r["source_pixel_size"],[2,2])
        self.assertIn("slope",r["assets"])

    def test_reject_dem_without_crs(self):
        r=self.client.post("/api/terrain/import",files={"file":("bad.tif",geotiff(crs=None),"image/tiff")})
        self.assertEqual(r.status_code,422)
        self.assertIn("reference system",r.json()["detail"])

    def test_api_import_catalog_assets_and_source(self):
        r=self.client.post("/api/terrain/import",data={"name":"Real test survey","units":"m"},files={"file":("mine.ply",PLY,"application/octet-stream")})
        self.assertEqual(r.status_code,200,r.text)
        data=r.json()
        self.assertEqual(len(self.client.get("/api/terrain").json()["datasets"]),1)
        self.assertEqual(self.client.get(data["assets"]["positions"]).status_code,200)
        self.assertEqual(self.client.get(f"/api/terrain/{data['id']}/assets/source.ply").content,PLY)
        self.assertEqual(self.client.get(f"/api/terrain/{data['id']}/assets/metadata.json").status_code,404)

    def test_reject_arbitrary_image_and_invalid_units(self):
        self.assertEqual(self.client.post("/api/terrain/import",files={"file":("photo.png",b"image")}).status_code,422)
        self.assertEqual(self.client.post("/api/terrain/import",data={"units":"unknown"},files={"file":("mine.ply",PLY)}).status_code,422)

    def test_reject_malformed_ply(self):
        r=self.client.post("/api/terrain/import",files={"file":("bad.ply",b"not a point cloud")})
        self.assertEqual(r.status_code,422)

    def test_no_synthetic_fallback_on_provider_failure(self):
        with patch("api.terrain_routes.fetch_global",side_effect=TimeoutError):
            response=self.client.post("/api/terrain/public",json={"latitude":11.5,"longitude":79.5})
        self.assertEqual(response.status_code,502)
        self.assertEqual(len(self.client.get("/api/terrain").json()["datasets"]),0)

    def test_provider_coordinates_are_validated(self):
        for values in [{"latitude":90,"longitude":10},{"latitude":11,"longitude":79,"provider":"usgs"},{"latitude":11,"longitude":79,"width_m":999999}]:
            self.assertEqual(self.client.post("/api/terrain/public",json=values).status_code,422)

    def test_safe_asset_identifier(self):
        with self.assertRaises(ValueError):safe_folder("../../private")

    def test_global_terrarium_decoding_and_source_export(self):
        from PIL import Image
        from unittest.mock import Mock
        from src.terrain import fetch_global
        rgb=np.zeros((256,256,3),np.uint8)
        rgb[:,:,0]=128;rgb[:,:,1]=100
        buffer=io.BytesIO();Image.fromarray(rgb).save(buffer,format="PNG")
        response=Mock();response.content=buffer.getvalue()
        with patch("src.terrain.requests.get",return_value=response):
            r=fetch_global(11.51,79.48,400,"Test elevation fixture")
        self.assertAlmostEqual(r["elevation_m"]["min"],100,places=2)
        self.assertAlmostEqual(r["elevation_m"]["max"],100,places=2)
        download=self.client.get(f"/api/terrain/{r['id']}/source")
        self.assertEqual(download.status_code,200)
        with MemoryFile(download.content) as mem:
            with mem.open() as ds:
                self.assertEqual(ds.crs.to_epsg(),32644)
                self.assertAlmostEqual(float(ds.read(1).mean()),100,places=2)

    def test_global_nodata_does_not_become_a_deep_false_surface(self):
        from PIL import Image
        from unittest.mock import Mock
        from src.terrain import fetch_global
        buffer=io.BytesIO();Image.fromarray(np.zeros((256,256,3),np.uint8)).save(buffer,format="PNG")
        response=Mock();response.content=buffer.getvalue()
        with patch("src.terrain.requests.get",return_value=response):
            with self.assertRaisesRegex(ValueError,"valid elevation"):
                fetch_global(11.51,79.48,400,"NoData fixture")


if __name__=="__main__":unittest.main()
