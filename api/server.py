"""GeoGuard assessment service. Run locally; mount the built UI for single-port use."""
import os
import requests
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from api.assessment_routes import router
from api.terrain_routes import router as terrain_router

ROOT = Path(__file__).resolve().parent.parent
app = FastAPI(title="GeoGuard HyGEWS", version="3.0.0", description="Image-block rockfall screening with explicit data provenance and uncertainty")
origins = [s.strip() for s in os.environ.get("GEOGUARD_ALLOWED_ORIGINS", "http://localhost:8051,http://127.0.0.1:8051").split(",") if s.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
app.include_router(router)
app.include_router(terrain_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "3.0.0", "mode": "local_research",
            "cv": True, "model": (ROOT / "models/xgboost_geotechnical_gpu.json").exists(),
            "crack_classifier": (ROOT / "models/stone_crack_classifier.json").exists(),
            "weather": "Open-Meteo / explicit manual inputs", "store": "SQLite"}


@app.get("/api/weather")
def live_weather(latitude: float = Query(ge=-85, le=85), longitude: float = Query(ge=-180, le=180)):
    from src.weather import fetch_weather
    try:
        return fetch_weather(latitude, longitude)
    except (ValueError, KeyError, TypeError, requests.RequestException) as exc:
        raise HTTPException(502, "Live weather provider unavailable or incomplete. Retry shortly.") from exc


@app.get("/api/ai/status")
def ai_status():
    from src.ai_explainer import configuration
    return configuration()


@app.post("/api/ai/test")
def test_ai_connection():
    from src.ai_explainer import configuration, explain
    if not configuration()["configured"]:
        raise HTTPException(503, "API key and model are not configured")
    try:
        explain("Explain this hypothetical screening result in one sentence.",
                {"model": {"available": False}, "smr": {"score": 60}, "fos": {"value": 1.5}},
                {"score": 25, "status": "NORMAL", "contributions": [], "line_coverage": 0},
                "Hypothetical test only. Screening index 25/100; this does not certify safety.")
    except requests.RequestException:
        pass
    except ValueError:
        return {**configuration(), "connection_status": "incomplete_response"}
    return configuration()


@app.get("/api/readiness")
def readiness():
    from api import store
    from src.terrain import list_terrain
    from src.ai_explainer import configuration
    try:
        with store.connect() as db:
            database = db.execute("SELECT 1").fetchone()[0] == 1
    except Exception:
        database = False
    return {"database": database,
            "geotechnical_model": (ROOT / "models/xgboost_geotechnical_gpu.json").exists(),
            "crack_model": (ROOT / "models/stone_crack_classifier.json").exists(),
            "terrain_count": len(list_terrain()),
            "ai_configured": configuration()["configured"],
            "scope": "local research; site validation required"}


# Legacy endpoints contained inconsistent physics and demonstration telemetry.
# Their source is preserved in legacy_server.py; they are not served by this app.
build = ROOT / "bench-core-dashboard/dist"
if build.exists():
    app.mount("/", StaticFiles(directory=build, html=True), name="dashboard")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.server:app", host="127.0.0.1", port=8000)
