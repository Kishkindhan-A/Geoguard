"""Fetch a small, attributed NASA event-inventory snapshot, not training labels."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://gis.earthdata.nasa.gov/portal/rest/services/Landslides/COOLR_Events_Polygons/FeatureServer/0"


def main():
    response = requests.get(BASE + "/query", params={"where": "1=1", "outFields": "*", "returnGeometry": "true",
                "outSR": "4326", "geometryPrecision": 5, "resultRecordCount": 100, "f": "geojson"}, timeout=(10, 60))
    response.raise_for_status()
    data = response.json()
    if data.get("type") != "FeatureCollection" or not data.get("features"):
        raise ValueError("NASA returned no valid event features")
    folder = ROOT / "data/external"
    folder.mkdir(parents=True, exist_ok=True)
    output = folder / "nasa-coolr-sample.geojson"
    output.write_text(json.dumps(data), encoding="utf8")
    manifest = {"source": BASE, "retrieved_at": datetime.now(timezone.utc).isoformat(),
                "features": len(data["features"]), "scope": "First 100 features, not a complete inventory or statistically representative sample",
                "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
                "attribution": "NASA Goddard Space Flight Center; retain each feature's citation and contributor fields",
                "usage": "Contextual GIS research only; no mine failure or negative labels inferred"}
    (folder / "nasa-coolr-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
