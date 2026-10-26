"""Local survey store, validated uploads, and explicit public elevation retrieval."""
import json
import shutil
import tempfile
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field
from src.terrain import fetch_global, fetch_usgs, import_dem, import_ply, list_terrain, read_metadata, safe_folder

router=APIRouter(prefix="/api/terrain",tags=["Real terrain"])


@router.get("")
def catalog():
    return {"datasets":list_terrain()}


@router.get("/{terrain_id}")
def metadata(terrain_id:str):
    try:return read_metadata(terrain_id)
    except (ValueError,FileNotFoundError) as exc:raise HTTPException(404,str(exc)) from exc


@router.get("/{terrain_id}/assets/{filename}")
def asset(terrain_id:str,filename:str):
    allowed={"positions.bin","colors.bin","indices.bin","slope.bin","texture.jpg","source.tif","source.ply"}
    if filename not in allowed:raise HTTPException(404,"Unknown terrain asset")
    try:
        folder=safe_folder(terrain_id)
        read_metadata(terrain_id)
    except (ValueError,FileNotFoundError):raise HTTPException(404,"Terrain dataset not found")
    path=folder/filename
    if not path.exists():raise HTTPException(404,"Terrain asset unavailable")
    return FileResponse(path,media_type="image/jpeg" if filename=="texture.jpg" else "application/octet-stream",filename=filename,
                        headers={"Cache-Control":"private, max-age=3600"})


@router.get("/{terrain_id}/source")
def source_file(terrain_id:str):
    try:
        folder=safe_folder(terrain_id)
        read_metadata(terrain_id)
    except (ValueError,FileNotFoundError):raise HTTPException(404,"Terrain dataset not found")
    for name in ("source.tif","source.ply"):
        path=folder/name
        if path.exists():return FileResponse(path,media_type="application/octet-stream",filename=f"{terrain_id}-{name}")
    raise HTTPException(404,"Source file not available for this dataset")


class PublicRequest(BaseModel):
    model_config=ConfigDict(extra="forbid",allow_inf_nan=False)
    latitude:float=Field(ge=-75,le=75)
    longitude:float=Field(ge=-179.8,le=179.8)
    width_m:float=Field(default=4000,ge=200,le=8000)
    name:str=Field(default="Public elevation context",min_length=1,max_length=120)
    provider:Literal["usgs","global"]="global"


@router.post("/public")
def public(request:PublicRequest):
    if request.provider=="usgs" and not (-170<request.longitude<-60 and 18<request.latitude<72):
        raise HTTPException(422,"USGS 3DEP coverage is for the United States. Choose global context or import a survey.")
    try:
        fn=fetch_usgs if request.provider=="usgs" else fetch_global
        return fn(request.latitude,request.longitude,request.width_m,request.name)
    except Exception as exc:
        raise HTTPException(502,"Public elevation retrieval failed or returned insufficient coverage. Import a survey GeoTIFF/PLY or retry.") from exc


@router.post("/import")
def survey(file:UploadFile=File(...),name:str=Form("Imported mine survey"),units:Literal["m","ft"]=Form("m")):
    suffix=Path(file.filename or "").suffix.lower()
    if suffix not in {".tif",".tiff",".ply"}:raise HTTPException(422,"Supported survey formats: single-band GeoTIFF DEM and XYZ/RGB PLY")
    if not name.strip() or len(name)>120:raise HTTPException(422,"A survey name of 1–120 characters is required")
    with tempfile.TemporaryDirectory(prefix="geoguard-survey-") as temp:
        path=Path(temp)/("survey"+suffix)
        count=0
        with path.open("wb") as output:
            while chunk:=file.file.read(1024*1024):
                count+=len(chunk)
                if count>256*1024*1024:raise HTTPException(413,"Survey uploads must be smaller than 256 MB")
                output.write(chunk)
        try:
            result=import_ply(path,name,units) if suffix==".ply" else import_dem(path,name,units)
        except Exception as exc:
            raise HTTPException(422,f"Cannot import this survey: {str(exc)[:300]}") from exc
        # Retain the uploaded source for reproducibility and export.
        shutil.copyfile(path,safe_folder(result["id"])/("source.ply" if suffix==".ply" else "source.tif"))
    return result
