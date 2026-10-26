"""Assessment workflow API; CPU and network work execute in FastAPI's threadpool."""
import csv
import io
import json
import requests
from typing import Literal
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator
from src.assessment import ROOT, assess, decode_image
from src.weather import fetch_weather
from api import store

router = APIRouter(prefix="/api")


class Bounds(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    north: float = Field(ge=-85, le=85)
    south: float = Field(ge=-85, le=85)
    east: float = Field(ge=-180, le=180)
    west: float = Field(ge=-180, le=180)

    @model_validator(mode="after")
    def order(self):
        if self.north <= self.south or self.east <= self.west:
            raise ValueError("Bounds require north > south and east > west; antimeridian footprints are unsupported")
        if self.north - self.south > 0.2 or self.east - self.west > 0.2:
            raise ValueError("Survey footprint must be smaller than 0.2 degrees per side")
        return self


class Parameters(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    site_name: str = Field(min_length=1, max_length=100)
    latitude: float = Field(ge=-85, le=85)
    longitude: float = Field(ge=-180, le=180)
    weather_mode: Literal["live", "manual"] = "live"
    past_24h_mm: float = Field(default=0, ge=0, le=2000)
    past_72h_mm: float = Field(default=0, ge=0, le=5000)
    next_24h_mm: float = Field(default=0, ge=0, le=2000)
    slope_angle: float = Field(default=55, ge=1, le=89)
    slope_direction: float = Field(default=180, ge=0, le=360)
    joint_dip: float = Field(default=45, ge=0, le=90)
    joint_direction: float = Field(default=180, ge=0, le=360)
    rmr: float = Field(default=65, ge=0, le=100)
    joint_spacings: list[float] = Field(default=[0.5, 0.8, 1.2], min_length=1, max_length=10)
    excavation: Literal["mechanical", "normal_blasting", "presplitting", "smooth_blasting", "natural"] = "mechanical"
    bench_height: float = Field(default=15, gt=0, le=200)
    layer_thickness: float = Field(default=3, gt=0, le=100)
    friction_angle: float = Field(default=35, gt=0, lt=90)
    cohesion: float = Field(default=35, ge=0, le=10000)
    unit_weight: float = Field(default=26, gt=0, le=50)
    pore_pressure_ratio: float = Field(default=0.2, ge=0, le=1)
    blast_vibration: float = Field(default=2, ge=0, le=1000)
    weathering_index: float = Field(default=0.5, ge=0, le=1)
    grid_size: int = Field(default=5, ge=2, le=10)
    bounds: Bounds | None = None
    orthorectified: bool = False

    @model_validator(mode="after")
    def validate_context(self):
        import math
        if any(not math.isfinite(s) or s <= 0 or s > 100 for s in self.joint_spacings):
            raise ValueError("Joint spacing must be finite and in (0, 100] metres")
        if self.bounds and not self.orthorectified:
            raise ValueError("Confirm a surveyed north-up orthorectified image before assigning geographic bounds")
        if self.weather_mode == "manual" and self.past_72h_mm < self.past_24h_mm:
            raise ValueError("72-hour rainfall cannot be smaller than 24-hour rainfall")
        if not self.site_name.strip():
            raise ValueError("Site name must contain text")
        return self


@router.post("/assessments")
def create_assessment(image: UploadFile = File(...), parameters: str = Form(...)):
    try:
        params = Parameters.model_validate_json(parameters)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    content = image.file.read(12 * 1024 * 1024 + 1)
    try:
        decode_image(content)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    p = params.model_dump()
    if params.weather_mode == "live":
        try:
            weather = fetch_weather(params.latitude, params.longitude)
        except Exception as exc:
            raise HTTPException(502, "Weather service unavailable or incomplete. Retry or select manual rainfall; no weather data has been invented.") from exc
    else:
        weather = {"source": "Operator supplied", "mode": "manual", "timezone": "UTC",
                   "past_24h_mm": params.past_24h_mm, "past_72h_mm": params.past_72h_mm,
                   "next_24h_mm": params.next_24h_mm, "forecast": [], "history": [],
                   "attribution": "Manual totals; no hourly forecast is available"}
    return store.save(assess(content, p, weather))


@router.get("/assessments")
def list_assessments():
    return {"assessments": store.listing()}


@router.get("/assessments/{assessment_id}")
def get_assessment(assessment_id: str):
    result = store.read(assessment_id)
    if result is None:
        raise HTTPException(404, "Assessment not found")
    return result


@router.get("/assessments/{assessment_id}/report")
def assessment_report(assessment_id: str):
    from src.reporting import render_report
    from fastapi.responses import HTMLResponse
    return HTMLResponse(render_report(get_assessment(assessment_id)), headers={
        "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'self'",
        "X-Content-Type-Options": "nosniff",
    })


@router.post("/assessments/{assessment_id}/alerts/{block_id}/acknowledge")
def acknowledge(assessment_id: str, block_id: str):
    try:
        result = store.acknowledge(assessment_id, block_id)
    except KeyError:
        raise HTTPException(404, "Alert not found")
    if result is None:
        raise HTTPException(404, "Assessment not found")
    return result


@router.get("/assessments/{assessment_id}/export")
def export(assessment_id: str, format: Literal["json", "csv", "geojson"] = "json"):
    result = get_assessment(assessment_id)
    if format == "json":
        return JSONResponse(result, headers={"Content-Disposition": f'attachment; filename="assessment-{assessment_id}.json"'})
    if format == "csv":
        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerow(["block_id", "row", "col", "screening_index", "status", "candidate_count", "line_coverage"])
        for b in result["blocks"]:
            writer.writerow([b["id"], b["row"], b["col"], b["score"], b["status"], len(b["candidate_ids"]), b["line_coverage"]])
        return Response(out.getvalue(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="blocks-{assessment_id}.csv"'})
    if not result["georeferenced"]:
        raise HTTPException(409, "GeoJSON requires surveyed image bounds")
    features = []
    for block in result["blocks"]:
        b = block["bounds"]
        ring = [[b["west"], b["south"]], [b["east"], b["south"]], [b["east"], b["north"]], [b["west"], b["north"]], [b["west"], b["south"]]]
        features.append({"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [ring]},
                         "properties": {"block_id": block["id"], "score": block["score"], "status": block["status"], "basis": "operator supplied orthorectified bounds"}})
    return JSONResponse({"type": "FeatureCollection", "features": features}, headers={"Content-Disposition": f'attachment; filename="blocks-{assessment_id}.geojson"'})


class Question(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    block_id: str | None = None
    use_ai: bool = False


@router.post("/assessments/{assessment_id}/question")
def question(assessment_id: str, body: Question):
    r = get_assessment(assessment_id)
    b = next((b for b in r["blocks"] if b["id"] == body.block_id), None)
    if body.block_id and b is None:
        raise HTTPException(404, "Block not found")
    text = body.message.lower()
    focus = b or max(r["blocks"], key=lambda item: item["score"])
    lead = f"Block {focus['id']} has a screening index of {focus['score']:.1f}/100 ({focus['status']}). "
    if any(word in text for word in ["when", "time", "predict", "happen"]):
        answer = "This assessment cannot determine when a rockfall will happen. "
        win = r.get("peak_weather_window")
        answer += (f"The wettest modelled six-hour weather window runs from {win['start']} to {win['end']} UTC, with {win['rain_mm']} mm precipitation. That is a weather exposure window, not a failure forecast. " if win else "Manual rainfall totals do not provide an hourly forecast. ")
        answer += "Time-to-failure analysis needs measured displacement or crack-opening time series and site validation."
    elif any(word in text for word in ["weather", "rain", "wet"]):
        w = r["weather"]
        answer = f"Weather source: {w['source']}. Past 24 hours: {w['past_24h_mm']} mm; past 72 hours: {w['past_72h_mm']} mm; next 24 hours: {w['next_24h_mm']} mm. Rainfall exposure contributes to every block; it does not independently measure groundwater pressure."
    elif any(word in text for word in ["shap", "model", "explainable", "ai"]):
        model = r["model"]
        top = sorted(model.get("shap", []), key=lambda item: abs(item["value"]), reverse=True)[:3]
        answer = "TreeSHAP explains the synthetic XGBoost classifier in log-odds units. " + ("Largest attributions: " + ", ".join(f"{v['feature']} ({v['value']:+.3f})" for v in top) + ". " if top else "Model explanations are unavailable. ") + "These attributions do not explain the operational screening index; its exact weighted contributions are shown separately for each block."
    elif any(word in text for word in ["safe", "evac", "action", "work", "blast"]):
        answer = lead + ("Escalate for immediate geotechnical review and follow the site's exclusion and emergency response plan. " if focus["status"] == "CRITICAL" else "Inspect candidate lines and consult the site trigger action response plan. ") + "This software cannot clear personnel, equipment or blasting for work. Acknowledging a warning records review; it does not resolve the hazard."
    elif any(word in text for word in ["crack", "line", "fracture"]):
        answer = lead + f"{len(focus['candidate_ids'])} candidate line regions overlap this block; line coverage is {focus['line_coverage']*100:.2f}%. Shadows and rock texture may produce false detections. Physical widths and depth cannot be inferred without calibrated measurements."
    else:
        drivers = sorted(focus["contributions"], key=lambda item: item["points"], reverse=True)[:3]
        answer = lead + "Largest contributions: " + ", ".join(f"{d['factor']} {d['points']:.1f} points" for d in drivers) + f". SMR is {r['smr']['score']}/100; illustrative FoS is {r['fos']['value']:.2f}. These are screening results for the saved inputs."
    source = "saved assessment facts and deterministic response templates"
    if body.use_ai:
        from src.ai_explainer import configuration, explain
        if not configuration()['configured']:
            raise HTTPException(503, "AI explanation not connected. Set OPENAI_API_KEY and OPENAI_MODEL in the server .env.local, then restart.")
        try:
            answer = explain(body.message, r, focus, answer)
            source = "OpenAI generated explanation of saved evidence; numerical explanations computed locally"
        except requests.HTTPError as exc:
            try:
                code = exc.response.json().get("error", {}).get("code")
            except (ValueError, AttributeError):
                code = None
            if code in {"credit_balance_exhausted", "insufficient_quota"}:
                raise HTTPException(402, "OpenAI API credits are exhausted. Add credits in your OpenAI API billing dashboard; local explanations remain available.") from exc
            raise HTTPException(502, "OpenAI rejected the request. Check model access, key permissions and API billing.") from exc
        except Exception as exc:
            raise HTTPException(502, "AI provider request failed. Check the server key, model access and API billing, or use local explanations.") from exc
    return {"reply": answer, "source": source, "assessment_id": assessment_id,
            "block_id": focus["id"], "created_at": r["created_at"]}


@router.get("/research")
def research():
    path = ROOT / "docs/dataset_catalog.json"
    catalog = json.loads(path.read_text(encoding="utf8")) if path.exists() else {"datasets": []}
    metrics_path = ROOT / "models/crack_classifier_metrics.json"
    metrics = json.loads(metrics_path.read_text(encoding="utf8")) if metrics_path.exists() else None
    if metrics:
        metrics.pop("test_predictions", None)
    return {**catalog, "crack_benchmark": metrics, "policy_version": "2.0.0"}
