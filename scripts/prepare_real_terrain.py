"""Download verified public survey examples and prepare metre-scale render assets."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT))
import requests
from src.terrain import fetch_usgs, fetch_usgs_texture, import_ply, read_metadata, safe_folder


def tongjiang():
    terrain_id="tongjiang-2025"
    try: return read_metadata(terrain_id)
    except FileNotFoundError: pass
    folder=safe_folder(terrain_id); folder.mkdir(parents=True,exist_ok=True)
    target=folder/"source.ply"
    expected="f448d60625e3740ba78fa56b6634648b"
    url="https://zenodo.org/records/15614501/files/panorama_1cloud.ply?download=1"
    if not target.exists() or hashlib.md5(target.read_bytes()).hexdigest()!=expected:
        with requests.get(url,stream=True,timeout=(10,60)) as response:
            response.raise_for_status()
            total=0
            with target.with_suffix(".part").open("wb") as output:
                for chunk in response.iter_content(1024*1024):
                    output.write(chunk); total+=len(chunk)
                    if total%(10*1024*1024)<1024*1024: print(f"Tongjiang source downloaded: {total/1024/1024:.0f} MB",flush=True)
            target.with_suffix(".part").replace(target)
    if hashlib.md5(target.read_bytes()).hexdigest()!=expected:
        raise ValueError("Published Tongjiang archive checksum mismatch")
    print("Verified Tongjiang source. Preparing original XYZ/RGB samples…",flush=True)
    return import_ply(target,"Tongjiang limestone quarry · UAV survey 2025",terrain_id=terrain_id,extra={
        "source":"Tongjiang Aerial Dataset · Chen, Fang and Zhang",
        "source_url":"https://zenodo.org/records/15614501","doi":"10.5281/zenodo.15614501",
        "license":"CC BY 4.0","acquisition_date":"2025-05-21","source_md5":expected,
        "source_resolution_note":"Original UAV photogrammetry points; 900,000 measured samples retained for rendering",
        "vertical_datum":"Release uses local XYZ coordinates; absolute CRS and vertical datum are not published",
        "survey_method":"DJI UAV imagery processed with DJI Terra; author describes onboard RTK, no ground control points",
        "limitations":["Historical 21 May 2025 survey, not live monitoring", "No ground control points; independent absolute accuracy not provided", "Local XYZ metre convention; absolute CRS and datum unverified", "Point colours are original RGB, not generated textures"]})


def bingham():
    try:result=read_metadata("bingham-usgs")
    except FileNotFoundError:
        print("Fetching real USGS elevation grid for Bingham Canyon…",flush=True)
        result=fetch_usgs(40.523,-112.151,5000,"Bingham Canyon · USGS elevation",terrain_id="bingham-usgs")
    if not result["assets"].get("texture"):
        try:result=fetch_usgs_texture("bingham-usgs")
        except Exception as exc:print(f"Orthoimagery unavailable: {type(exc).__name__}; retaining real elevation geometry",flush=True)
    return result


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--source",choices=["all","tongjiang","bingham"],default="all")
    args=parser.parse_args()
    for name,fn in [("tongjiang",tongjiang),("bingham",bingham)]:
        if args.source in ("all",name):
            result=fn()
            print(json.dumps({k:result[k] for k in ["id","name","point_count","triangle_count","extent_m","elevation_m"]},indent=2),flush=True)
