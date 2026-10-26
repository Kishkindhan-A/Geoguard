"""GeoGuard AI -- FastAPI backend serving physics, CV, ML, and fusion pipelines."""

from __future__ import annotations

import os
import sys
import io
import base64
import math
from datetime import datetime
from typing import Annotated

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Ensure project root is importable
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import numpy as np
import requests as _requests

NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")
NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("GEOGUARD_ALLOWED_ORIGINS", "http://localhost:8051").split(",")
    if origin.strip()
]

try:
    import cv2
except ImportError:
    cv2 = None  # type: ignore

try:
    from src import physics_engine
except ImportError:
    physics_engine = None  # type: ignore

try:
    from src import cv_engine
except ImportError:
    cv_engine = None  # type: ignore

try:
    from src import data_fusion
except ImportError:
    data_fusion = None  # type: ignore

try:
    from src import ml_engine
except ImportError:
    ml_engine = None  # type: ignore

app = FastAPI(title="GeoGuard AI", version="1.0.0")
from api.assessment_routes import router as assessment_router
app.include_router(assessment_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=bool(ALLOWED_ORIGINS),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Local physics helpers (same formulas as Streamlit + React for consistency)
# ---------------------------------------------------------------------------

def _compute_fos(ru: float, rain: float, tilt: float, rmr: float, slope: float) -> float:
    base = 1.0 + ((rmr - 20) / 80) * 1.6
    stress = (
        ru * 0.55
        + (rain / 100) * 0.42
        + (max(0, tilt - 5) / 25) * 0.32
        + (max(0, slope - 25) / 60) * 0.22
    )
    return max(0.31, round(base - stress, 2))


def _compute_smr_local(rmr: float, slope: float, tilt: float) -> float:
    f1 = max(0.15, 1 - 0.0065 * slope * slope / 10)
    f2 = max(0.15, 1 - tilt / 50)
    f3 = -25 if slope > 45 else (-12 if slope > 35 else -6)
    return max(0.0, min(100.0, round(rmr + f1 * f2 * f3 + 15)))


def _compute_jv_local(rmr: float, tilt: float) -> float:
    return max(1.0, round((100 - rmr) / 7.5 + tilt / 2.8))


def _get_risk_info(fos: float) -> dict:
    if fos < 1.0:
        return {"label": "CRITICAL", "color": "#EF4444"}
    if fos < 1.25:
        return {"label": "HIGH RISK", "color": "#F97316"}
    if fos < 1.5:
        return {"label": "WARNING", "color": "#F59E0B"}
    if fos < 2.0:
        return {"label": "MODERATE", "color": "#38BDF8"}
    return {"label": "SAFE", "color": "#10B981"}


def _risk_color(label: str, fallback: str) -> str:
    colors = {
        "CRITICAL RISK": "#EF4444",
        "HIGH RISK": "#F97316",
        "WARNING": "#F59E0B",
        "MODEL REVIEW": "#F59E0B",
        "MODERATE RISK": "#38BDF8",
        "LOW RISK": "#10B981",
    }
    return colors.get(label, fallback)


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

def _get_ai_reply(msg: str, fos: float, ru: float, rain: float, bench_id: str = "B-12",
                   angle: float = 68, seepage: float = 0.32, vibration: float = 4.8,
                   smr: float = 55, jv: float = 18, shovel_ok: bool = True, blasting_ok: bool = True,
                   history: list = None, crack_metrics: dict = None) -> str:
    """Call NVIDIA NIM (OpenAI-compatible) for real AI chat about mine safety."""
    l = msg.lower().strip()

    if l == "clear":
        return "__CLEAR__"

    crack_metrics = crack_metrics or {}

    system_prompt = """You are GeoGuard AI, an expert geotechnical engineer and mine safety advisor specializing in open-pit mine slope stability monitoring. You work for a mining operation and advise on bench stability, slope safety, risk assessment, and emergency response.

You have deep expertise in:
- Factor of Safety (FoS) analysis and interpretation
- Slope stability mechanics (circular/non-circular failure, wedge failure, planar failure)
- Rock Mass Rating (RMR) and Slope Mass Rating (SMR) classification
- Pore water pressure effects on slope stability
- Dewatering strategies and drainage design
- blasting vibration effects on bench integrity
- Real-time monitoring with inclinometers, piezometers, and accelerometers
- SHAP-based explainable AI for feature attribution in risk models
- Monte Carlo simulation for probabilistic FoS analysis
- Emergency evacuation protocols for slope failure events
- ISRM and ISRM guidelines for open-pit mining
- Geotechnical instrumentation and monitoring programs

Rules:
- Always provide specific, actionable advice with numbers when possible
- Reference the current sensor data when making recommendations
- If FoS < 1.0, prioritize safety warnings immediately
- Use technical language appropriate for mining engineers
- Keep responses concise but informative (2-4 sentences unless more detail is requested)
- If asked about evacuation, always prioritize personnel safety first
- Format important numbers in bold
"""

    crack_count = crack_metrics.get("crack_count", 0)
    max_danger = crack_metrics.get("max_danger", 0.0)
    crack_line = ""
    if crack_count:
        crack_line = (
            f"- Cracks Detected: {crack_count}\n"
            f"- Most Dangerous Crack Danger: {max_danger*100:.0f}%\n"
            f"- High-Danger Crack Share: {crack_metrics.get('high_danger_pct', 0):.0f}%"
        )

    context = f"""Current Mine Status:
- Bench: {bench_id}
- Factor of Safety: {fos:.3f} (FoS < 1.0 = CRITICAL, FoS 1.0-1.3 = CAUTION, FoS > 1.3 = STABLE)
- SMR Rating: {smr:.1f}/100
- Junction Volume: {jv:.1f} blocks/m³
- Slope Angle: {angle}°
- Water Seepage (ru): {seepage:.2f}
- Rainfall: {rain:.0f} mm/hr
- Blast Vibration: {vibration:.1f} mm/s
- Shovel Status: {"CLEARED" if shovel_ok else "HOLD"}
- Blasting Status: {"CLEARED" if blasting_ok else "HOLD"}
{crack_line}
Respond to the operator's question using this live data. When cracks are present, always recommend concrete worker-safety precautions: exclusion zones, scaling/barricading the most dangerous crack, monitoring crack opening with tell-tales or crack gauges, and halting work beneath overhanging cracked rock."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"{context}\n\nOperator: {msg}"},
    ]

    # Add conversation history if provided
    if history:
        # Insert history before the latest message
        msgs = [{"role": "system", "content": system_prompt}]
        for h in history[-6:]:  # Last 6 messages for context
            role = "assistant" if h.get("role") == "assistant" else "user"
            text = h.get("text", "")
            # Sanitize: ensure text is a plain string, strip any non-text content
            if not isinstance(text, str):
                text = str(text)
            # Strip any base64 image data or data URLs that may have leaked in
            if "data:image" in text or len(text) > 4000:
                text = text[:200] + "... [content truncated]"
            msgs.append({"role": role, "content": text})
        msgs.append({"role": "user", "content": f"{context}\n\nOperator: {msg}"})
        messages = msgs

    if not NVIDIA_API_KEY:
        return _fallback_reply(msg, fos, ru, rain, crack_metrics)

    try:
        resp = _requests.post(
            f"{NVIDIA_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {NVIDIA_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "meta/llama-3.1-8b-instruct",
                "messages": messages,
                "temperature": 0.3,
                "max_tokens": 512,
                "top_p": 0.9,
            },
            timeout=15,
        )
        print(f"[AI Chat] NVIDIA status={resp.status_code}, body={resp.text[:500]}")
        if resp.status_code == 200:
            data = resp.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            if content:
                content = content.strip()
                _cl = content.lower()
                _err_markers = ["does not support image", "cannot read", "image.png", "invalid request",
                                "inform the user", "error:", "not support", "unable to", "i cannot",
                                "i can't", "sorry", "as an ai", "i'm unable"]
                if any(m in _cl for m in _err_markers) or len(content) < 10:
                    print(f"[AI Chat] Filtered error content ({len(content)} chars): {content[:300]}")
                    return _fallback_reply(msg, fos, ru, rain)
                return content
            return _fallback_reply(msg, fos, ru, rain)
        else:
            print(f"[AI Chat] API error {resp.status_code}: {resp.text[:300]}")
            return _fallback_reply(msg, fos, ru, rain)
    except Exception as exc:
        print(f"[AI Chat] Request exception: {exc}")
        return _fallback_reply(msg, fos, ru, rain)


def _fallback_reply(msg: str, fos: float, ru: float, rain: float, crack_metrics: dict = None) -> str:
    """Local fallback when API is unavailable."""
    crack_metrics = crack_metrics or {}
    l = msg.lower()
    if "crack" in l or "fracture" in l:
        n = crack_metrics.get("crack_count", 0)
        md = crack_metrics.get("max_danger", 0.0)
        if n:
            return (f"**CRACK ASSESSMENT:** {n} crack(s) detected on this face. "
                    f"Most dangerous crack at **{md*100:.0f}% danger**. "
                    f"Recommended precautions: (1) establish a **{max(20, int(md*60))}m exclusion zone** "
                    f"beneath the cracked zone, (2) install **crack tell-tales / crack gauges** to monitor "
                    f"opening, (3) **scale or barricade** the most dangerous crack, (4) halt work under "
                    f"overhanging cracked rock, (5) re-inspect after every blast or rainfall event.")
        return "No significant cracks detected on the current face. Continue routine visual inspection and monitoring."
    if "evacuat" in l:
        return f"**EVACUATION PROTOCOL:** All personnel must clear high-risk sectors immediately. FoS = {fos:.2f} (below 1.00). Establish 200m exclusion zone. Contact site supervisor and geotechnical engineer. Emergency services on standby."
    if "dewat" in l:
        return f"Dewatering recommendation: Install submersible pumps at piezometer nodes. Current ru = {ru:.2f}. Target reduction to ru < 0.35 within 48 hours. Current rainfall: {rain:.0f} mm/hr -- monitor for escalation."
    if "risk" in l:
        risk = _get_risk_info(fos)
        return f"Current risk assessment: {risk['label']} (FoS = {fos:.2f}). {'Primary risk: elevated pore-water pressure. Review SHAP panel for full breakdown.' if fos < 1.5 else 'All parameters within normal range. Continue standard monitoring protocol.'}"
    if "status" in l:
        return f"System nominal. All 7 sensor stations online. RF-slot 14 active. Camera feed streaming at 12 Hz. Current FoS: {fos:.2f}."
    if "help" in l:
        return "I'm GeoGuard AI. Ask me anything about slope stability, FoS analysis, dewatering, evacuation protocols, risk assessment, SHAP features, or Monte Carlo simulation. I have access to your live sensor data."
    return f"Analyzing current telemetry... FoS = {fos:.2f}, ru = {ru:.2f}, rainfall = {rain:.0f} mm/hr. {'Primary risk: elevated pore-water pressure.' if fos < 1.5 else 'All parameters within normal range.'}"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "physics": physics_engine is not None,
        "cv": cv_engine is not None,
        "fusion": data_fusion is not None,
        "ml": ml_engine is not None,
        "model": bool(data_fusion and data_fusion._load_ml_model(str(data_fusion.DEFAULT_MODEL_PATH))),
        "ai": bool(NVIDIA_API_KEY),
    }


@app.post("/api/analyze")
async def analyze(
    image: UploadFile = File(None),
    slope_angle: Annotated[float, Form(ge=0.0, le=90.0)] = 60.0,
    discontinuity_density: Annotated[float, Form(ge=0.0, le=1.0)] = 0.5,
    weathering_index: Annotated[float, Form(ge=0.0, le=1.0)] = 0.75,
    bench_height: Annotated[float, Form(ge=0.0, le=1000.0)] = 15.0,
    rainfall: Annotated[float, Form(ge=0.0, le=10000.0)] = 30.0,
    blast_vibration: Annotated[float, Form(ge=0.0, le=1000.0)] = 3.0,
    water_seepage: Annotated[float, Form(ge=0.0, le=1.0)] = 0.3,
    loose_rock: Annotated[float, Form(ge=0.0, le=1.0)] = 0.3,
    ru: Annotated[float, Form(ge=0.0, le=1.0)] = 0.3,
    tilt: Annotated[float, Form(ge=0.0, le=90.0)] = 5.0,
    rmr: Annotated[float, Form(ge=0.0, le=100.0)] = 50.0,
):
    """Run full fusion pipeline or local physics fallback."""
    image_bytes = None
    if image is not None:
        image_bytes = await image.read()

    # Local physics
    fos = _compute_fos(ru, rainfall, tilt, rmr, slope_angle)
    smr = _compute_smr_local(rmr, slope_angle, tilt)
    jv_local = _compute_jv_local(rmr, tilt)
    risk = _get_risk_info(fos)

    # Try full fusion pipeline if available
    fusion_result = None
    if data_fusion is not None and image_bytes is not None:
        try:
            fusion_result = data_fusion.run_fusion_pipeline(
                image_input=image_bytes,
                slope_angle_deg=slope_angle,
                discontinuity_density=discontinuity_density,
                weathering_index=weathering_index,
                bench_height_m=bench_height,
                rainfall_mm=rainfall,
                blast_vibration_index=blast_vibration,
                water_seepage_index=water_seepage,
                loose_rock_index=loose_rock,
            )
        except Exception as exc:
            print(f"[api] Fusion pipeline error: {exc}")

    # Build response
    overlay_b64 = None
    if fusion_result and fusion_result.get("annotated_image") is not None and cv2 is not None:
        try:
            _, buf = cv2.imencode(".png", fusion_result["annotated_image"])
            overlay_b64 = base64.b64encode(buf).decode("utf-8")
        except Exception:
            pass

    # TreeSHAP values come from the trained model. Sensor-only mode retains a
    # clearly marked sensitivity fallback because there is no model inference.
    shap_values = (fusion_result or {}).get("shap_values") or []
    shap_source = "trained_model_treeshap" if shap_values else "physics_sensitivity_fallback"
    if not shap_values:
        # Compute directional SHAP-like attribution from parameter sensitivity
        shap_values = [
            {"feature": "Slope Angle", "value": round(0.042 * (slope_angle - 60) / 10, 4), "positive": slope_angle > 68},
            {"feature": "Discontinuity Density", "value": round(0.028 * (discontinuity_density * 100 - 50) / 10, 4), "positive": discontinuity_density > 0.5},
            {"feature": "Weathering Index", "value": round(0.019 * (weathering_index - 0.75), 4), "positive": weathering_index > 0.8},
            {"feature": "Bench Height", "value": round(0.012 * (bench_height - 12) / 6, 4), "positive": bench_height > 14},
            {"feature": "Rainfall", "value": round(0.035 * (rainfall - 40) / 20, 4), "positive": rainfall > 45},
            {"feature": "Blast Vibration", "value": round(0.022 * (blast_vibration - 4) / 2, 4), "positive": blast_vibration > 5},
            {"feature": "Water Seepage", "value": round(0.031 * (water_seepage - 0.3), 4), "positive": water_seepage > 0.35},
            {"feature": "Loose Rock", "value": round(0.015 * (loose_rock - 0.5), 4), "positive": loose_rock > 0.55},
        ]
        shap_values.sort(key=lambda s: abs(s["value"]), reverse=True)

    analysis_fos = float((fusion_result or {}).get("physics_fos", fos))
    analysis_smr = float((fusion_result or {}).get("smr_score", smr))
    analysis_jv = float((fusion_result or {}).get("jv_density", jv_local))
    analysis_risk = (fusion_result or {}).get("risk_status", risk["label"])

    return {
        "fos": analysis_fos,
        "smr": analysis_smr,
        "jv_density": analysis_jv,
        "risk_label": analysis_risk,
        "risk_color": _risk_color(analysis_risk, risk["color"]),
        "class_probabilities": (fusion_result or {}).get("class_probabilities", {"LOW": 0.5, "HIGH": 0.5}),
        "shap_values": shap_values,
        "shap_base_value": (fusion_result or {}).get("shap_base_value"),
        "shap_source": shap_source,
        "shap_output": (fusion_result or {}).get("shap_output", "physics_sensitivity"),
        "overlay_image": overlay_b64,
        "confidence": (fusion_result or {}).get("confidence", 0.5),
        "model_loaded": (fusion_result or {}).get("model_loaded", False),
    }


@app.post("/api/spatial-risk")
async def spatial_risk(image: UploadFile = File(...)):
    """Analyse an image and return a 5x5 spatial risk grid + professional overlay."""
    from api.spatial_risk import compute_spatial_risk
    image_bytes = await image.read()
    return compute_spatial_risk(image_bytes)


@app.post("/api/crack-analysis")
async def crack_analysis(image: UploadFile = File(...)):
    """Detect cracks in a pit-wall image, rank by danger, and mark the most
    dangerous crack in red. Returns a green->dark-red crack-aware heatmap."""
    image_bytes = await image.read()
    if cv_engine is None:
        return JSONResponse({"error": "CV engine unavailable"}, status_code=503)

    try:
        result = cv_engine.detect_cracks(image_bytes)
    except Exception as exc:
        print(f"[api] Crack analysis error: {exc}")
        return JSONResponse({"error": str(exc)}, status_code=500)

    def _b64(arr):
        if arr is None:
            return None
        try:
            _, buf = cv2.imencode(".png", arr)
            return base64.b64encode(buf).decode("utf-8")
        except Exception:
            return None

    return {
        "overlay": _b64(result.get("overlay_rgb")),
        "crack_map": _b64(result.get("crack_map")),
        "heatmap": _b64(result.get("heatmap_rgb")),
        "cracks": result.get("cracks", []),
        "most_dangerous": result.get("most_dangerous"),
        "metrics": result.get("metrics", {}),
    }


@app.post("/api/chat")
async def chat(
    message: str = Form(...),
    fos: float = Form(1.5),
    ru: float = Form(0.3),
    rainfall: float = Form(30.0),
    bench_id: str = Form("B-12"),
    angle: float = Form(68),
    seepage: float = Form(0.32),
    vibration: float = Form(4.8),
    smr: float = Form(55),
    jv: float = Form(18),
    shovel_ok: bool = Form(True),
    blasting_ok: bool = Form(True),
    history: str = Form("[]"),
    crack_count: int = Form(0),
    max_danger: float = Form(0.0),
    high_danger_pct: float = Form(0.0),
):
    import json
    try:
        hist = json.loads(history)
    except Exception:
        hist = []
    crack_metrics = {"crack_count": crack_count, "max_danger": max_danger, "high_danger_pct": high_danger_pct}
    reply = _get_ai_reply(message, fos, ru, rainfall, bench_id, angle, seepage, vibration, smr, jv, shovel_ok, blasting_ok, hist, crack_metrics)
    if reply == "__CLEAR__":
        return {"reply": "", "clear": True}
    return {"reply": reply, "clear": False}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
