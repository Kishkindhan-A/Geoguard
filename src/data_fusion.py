"""
GeoGuard AI — Data Fusion Integration Layer

Orchestrates computer vision, geotechnical physics, and machine-learning
inference into a single unified risk-assessment pipeline.
"""

from __future__ import annotations

import os
import pathlib
from functools import lru_cache
from typing import Any, Dict, Optional

import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None  # type: ignore[assignment]

try:
    import xgboost as xgb
except ImportError:
    xgb = None  # type: ignore[assignment]

from . import physics_engine

try:
    from . import cv_engine
    _HAS_CV = True
except ImportError:
    _HAS_CV = False


# Feature names matching the trained model
FEATURE_NAMES = [
    "slope_angle_deg",
    "discontinuity_density",
    "weathering_index",
    "bench_height_m",
    "rainfall_mm",
    "blast_vibration_index",
    "water_seepage_index",
    "loose_rock_index",
]
PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_MODEL_PATH = PROJECT_ROOT / "models" / "xgboost_geotechnical_gpu.json"


# ---------------------------------------------------------------------------
# CV engine integration
# ---------------------------------------------------------------------------

def _extract_jv_from_image(
    image_input: Any,
) -> tuple[float, Optional[np.ndarray]]:
    """Analyse a pit-wall image and produce a risk heatmap overlay.

    Returns
    -------
    jv_density : float
        Estimated discontinuity density from edge analysis.
    overlay : np.ndarray or None
        RGB image with risk heatmap overlay (red=high, green=low).
    """
    if _HAS_CV and hasattr(cv_engine, "extract_jv_density"):
        jv_density, overlay = cv_engine.extract_jv_density(image_input)
        return float(jv_density), overlay

    if cv2 is None:
        return 20.0, None

    # Load image
    if isinstance(image_input, str):
        img = cv2.imread(image_input)
        if img is None:
            return 20.0, None
    elif isinstance(image_input, np.ndarray):
        img = image_input.copy()
    elif isinstance(image_input, (bytes, bytearray)):
        arr = np.frombuffer(image_input, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return 20.0, None
    else:
        return 20.0, None

    h, w = img.shape[:2]
    grey = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img

    # Edge / fracture density
    edges = cv2.Canny(grey, 30, 100)
    edge_pixel_ratio = np.count_nonzero(edges) / edges.size
    jv_density = float(np.clip(edge_pixel_ratio * 600.0, 1.0, 80.0))

    kernel_edge = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    edge_zone = cv2.dilate(edges, kernel_edge, iterations=2)
    edge_risk = edge_zone.astype(np.float32) / 255.0

    # Texture variation
    laplacian = cv2.Laplacian(grey, cv2.CV_32F)
    texture_var = cv2.GaussianBlur(np.abs(laplacian), (15, 15), 0)
    texture_norm = cv2.normalize(texture_var, None, 0, 1, cv2.NORM_MINMAX)

    # Dark / wet zones
    if len(img.shape) == 3:
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        dark_mask = ((hsv[:, :, 2] < 80) & (hsv[:, :, 1] < 60)).astype(np.float32)
        water_risk = cv2.GaussianBlur(dark_mask, (21, 21), 0)
    else:
        water_risk = (grey < 80).astype(np.float32)

    # Bright / exposed rock
    if len(img.shape) == 3:
        bright_mask = ((hsv[:, :, 2] > 160) & (hsv[:, :, 1] < 50)).astype(np.float32)
        loose_risk = cv2.GaussianBlur(bright_mask, (15, 15), 0)
    else:
        loose_risk = (grey > 160).astype(np.float32)

    risk_map = (
        0.35 * edge_risk
        + 0.25 * texture_norm
        + 0.20 * water_risk
        + 0.20 * loose_risk
    )
    risk_map = np.clip(risk_map, 0, 1)
    risk_map = cv2.GaussianBlur(risk_map, (11, 11), 0)

    gradient = np.linspace(0.0, 0.15, h).reshape(-1, 1)
    gradient = np.tile(gradient, (1, w))
    risk_map = np.clip(risk_map + gradient, 0, 1)

    risk_uint8 = (risk_map * 255).astype(np.uint8)
    heatmap_color = cv2.applyColorMap(risk_uint8, cv2.COLORMAP_JET)

    alpha = 0.45
    overlay = cv2.addWeighted(img, 1 - alpha, heatmap_color, alpha, 0)

    _, thresh_high = cv2.threshold(risk_uint8, 170, 255, cv2.THRESH_BINARY)
    _, thresh_low = cv2.threshold(risk_uint8, 80, 255, cv2.THRESH_BINARY_INV)

    contours_high, _ = cv2.findContours(thresh_high, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours_low, _ = cv2.findContours(thresh_low, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    cv2.drawContours(overlay, contours_high, -1, (0, 0, 255), 1)
    cv2.drawContours(overlay, contours_low, -1, (0, 200, 0), 1)

    return jv_density, cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB)


# ---------------------------------------------------------------------------
# ML model loading
# ---------------------------------------------------------------------------

def _load_ml_model(model_path: str):
    """Load a persisted XGBoost Booster from *model_path*.

    Returns the Booster or None on failure.
    """
    if xgb is None:
        return None
    if not pathlib.Path(model_path).exists():
        return None
    try:
        booster = xgb.Booster()
        booster.load_model(model_path)
        return booster
    except Exception as exc:
        print(f"[data_fusion] ML model load failed: {exc}")
        return None


def _predict_probabilities(booster, feature_vector: np.ndarray) -> np.ndarray:
    """Run inference and return per-class probabilities [P(LOW), P(HIGH)]."""
    dmatrix = xgb.DMatrix(
        feature_vector.reshape(1, -1),
        feature_names=FEATURE_NAMES,
    )
    raw = booster.predict(dmatrix)
    prob_high = float(raw.flatten()[0])
    prob_low = 1.0 - prob_high
    return np.array([prob_low, prob_high], dtype=np.float64)


@lru_cache(maxsize=4)
def _get_shap_explainer(model_path: str):
    """Build one TreeSHAP explainer per loaded model path."""
    import shap

    booster = _load_ml_model(model_path)
    return shap.TreeExplainer(booster) if booster is not None else None


def _predict_shap_values(model_path: str, feature_vector: np.ndarray) -> tuple[list[dict], float | None]:
    """Return signed TreeSHAP attributions for the HIGH-risk model output."""
    explainer = _get_shap_explainer(model_path)
    if explainer is None:
        return [], None

    values = np.asarray(explainer.shap_values(
        feature_vector.reshape(1, -1),
    ), dtype=np.float64)
    if values.ndim == 3:
        values = values[0, :, -1]
    else:
        values = values[0]
    expected = np.asarray(explainer.expected_value, dtype=np.float64).reshape(-1)
    base_value = float(expected[-1] if expected.size else 0.0)
    attributions = [
        {
            "feature": name,
            "value": round(float(value), 6),
            "positive": bool(value > 0),
        }
        for name, value in zip(FEATURE_NAMES, values)
    ]
    attributions.sort(key=lambda item: abs(item["value"]), reverse=True)
    return attributions, base_value


# ---------------------------------------------------------------------------
# Risk rating
# ---------------------------------------------------------------------------

def _unified_risk_rating(
    physics_fos: float,
    class_probs: np.ndarray,
) -> tuple[str, float]:
    """Combine physics FoS and ML class probabilities into a risk status.

    Returns
    -------
    (risk_status, combined_confidence)
    """
    prob_high = float(class_probs[1])

    # Physics remains the safety gate. The classifier can raise a stable
    # result to a review state, but cannot label a high-FoS slope as critical.
    if physics_fos < 1.0:
        return "CRITICAL RISK", 1.0
    if physics_fos < 1.25:
        return "HIGH RISK", round(max(prob_high, 1.0 - physics_fos), 4)
    if physics_fos < 1.5:
        return "WARNING", round(max(prob_high, 1.0 - physics_fos), 4)
    if prob_high >= 0.9:
        return "MODEL REVIEW", round(prob_high, 4)
    if prob_high >= 0.55:
        return "MODERATE RISK", round(prob_high, 4)
    return "LOW RISK", round(1.0 - prob_high, 4)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_fusion_pipeline(
    image_input: Any,
    slope_angle_deg: float,
    discontinuity_density: float,
    weathering_index: float,
    bench_height_m: float,
    rainfall_mm: float,
    blast_vibration_index: float,
    water_seepage_index: float,
    loose_rock_index: float,
    model_path: str | os.PathLike[str] = DEFAULT_MODEL_PATH,
) -> Dict[str, Any]:
    """Execute the full GeoGuard data-fusion pipeline.

    Returns
    -------
    dict
        ``physics_fos``, ``smr_score``, ``jv_density``, ``risk_status``,
        ``class_probabilities``, ``shap_values``, ``annotated_image``,
        ``confidence``, ``model_loaded``.
    """
    # 1. Computer-vision feature extraction
    jv_density, overlay_image = _extract_jv_from_image(image_input)

    # 2. Geotechnical physics
    rmr_basic = weathering_index * 100.0
    ru = water_seepage_index
    jv_for_physics = max(1.0, discontinuity_density * 80.0)

    smr_score = physics_engine.calculate_smr(rmr_basic, slope_angle_deg, ru)
    physics_fos = physics_engine.compute_physics_fos(smr_score, ru, jv_for_physics)

    # 3. ML inference
    feature_vector = np.array(
        [
            slope_angle_deg,
            discontinuity_density,
            weathering_index,
            bench_height_m,
            rainfall_mm,
            blast_vibration_index,
            water_seepage_index,
            loose_rock_index,
        ],
        dtype=np.float32,
    )

    class_probs = np.array([0.5, 0.5])
    model_loaded = False
    shap_values_out = []
    shap_base_value = None

    booster = _load_ml_model(str(model_path))
    if booster is not None:
        try:
            class_probs = _predict_probabilities(booster, feature_vector)
            shap_values_out, shap_base_value = _predict_shap_values(str(model_path), feature_vector)
            model_loaded = True
        except Exception as exc:
            print(f"[data_fusion] ML inference fallback: {exc}")

    # 4. Unified risk assessment
    risk_status, confidence = _unified_risk_rating(physics_fos, class_probs)

    return {
        "physics_fos": round(physics_fos, 4),
        "smr_score": round(smr_score, 2),
        "jv_density": round(jv_density, 2),
        "risk_status": risk_status,
        "class_probabilities": {
            "LOW": round(float(class_probs[0]), 4),
            "HIGH": round(float(class_probs[1]), 4),
        },
        "shap_values": shap_values_out,
        "shap_base_value": shap_base_value,
        "shap_output": "xgboost_raw_margin",
        "annotated_image": overlay_image,
        "confidence": confidence,
        "model_loaded": model_loaded,
    }
