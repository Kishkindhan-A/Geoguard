"""Versioned, deterministic screening assessment for image blocks.

Scores are engineering screening indices, not calibrated event probabilities.
Images must be orthorectified and bounded by a survey before map placement is valid.
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import math
from datetime import datetime, timezone, timedelta
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parent.parent
VERSION = "2.0.0"
COLORS = {"NORMAL": "#16a085", "WARNING": "#e8a23b", "CRITICAL": "#e25555"}


def decode_image(content: bytes) -> np.ndarray:
    if not content or len(content) > 12 * 1024 * 1024:
        raise ValueError("Upload a JPEG or PNG image smaller than 12 MB")
    try:
        with Image.open(io.BytesIO(content)) as picture:
            if picture.format not in {"JPEG", "PNG"}:
                raise ValueError("Only JPEG and PNG images are supported")
            if picture.width * picture.height > 24_000_000 or min(picture.size) < 64:
                raise ValueError("Image must be at least 64 px per side and at most 24 megapixels")
            from PIL import ImageOps
            picture = ImageOps.exif_transpose(picture).convert("RGB")
            picture.thumbnail((1200, 1200))
            return cv2.cvtColor(np.array(picture), cv2.COLOR_RGB2BGR)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValueError("Cannot decode this image") from exc


def encode_image(bgr: np.ndarray) -> str:
    ok, output = cv2.imencode(".png", bgr)
    if not ok:
        raise ValueError("Image encoding failed")
    return base64.b64encode(output).decode("ascii")


def smr_rating(p: dict) -> dict:
    """Romana 1985 tabular planar-failure SMR; no fabricated RMR from weathering."""
    delta = abs(p["joint_direction"] - p["slope_direction"]) % 360
    delta = min(delta, 360 - delta)
    f1 = 0.15 if delta > 30 else 0.4 if delta > 20 else 0.7 if delta > 10 else 0.85 if delta > 5 else 1.0
    dip = p["joint_dip"]
    f2 = 0.15 if dip < 20 else 0.4 if dip < 30 else 0.7 if dip < 35 else 0.85 if dip <= 45 else 1.0
    diff = dip - p["slope_angle"]
    f3 = 0 if diff > 10 else -6 if diff > 0 else -25 if diff == 0 else -50 if diff >= -10 else -60
    f4 = {"mechanical": 0, "normal_blasting": 0, "presplitting": 10, "smooth_blasting": 8, "natural": 15}[p["excavation"]]
    score = float(np.clip(p["rmr"] + f1 * f2 * f3 + f4, 0, 100))
    return {"score": round(score, 2), "f1": f1, "f2": f2, "f3": f3, "f4": f4,
            "formula": "SMR = RMRbasic + F1 × F2 × F3 + F4", "mode": "planar screening"}


def factor_of_safety(p: dict) -> dict:
    """Illustrative infinite-slope Mohr-Coulomb balance, not a rock-wedge solution.

    ru is defined as pore pressure / total normal stress in this calculation.
    H is vertical layer thickness; it is distinct from bench height.
    """
    beta = math.radians(p["slope_angle"])
    normal = p["unit_weight"] * p["layer_thickness"] * math.cos(beta) ** 2
    driving = p["unit_weight"] * p["layer_thickness"] * math.sin(beta) * math.cos(beta)
    resisting = p["cohesion"] + normal * (1 - p["pore_pressure_ratio"]) * math.tan(math.radians(p["friction_angle"]))
    return {"value": round(resisting / driving, 4), "resisting_kpa": round(resisting, 3),
            "driving_kpa": round(driving, 3), "formula": "FoS = resisting shear / driving shear",
            "method": "Infinite-slope screening; excludes wedge, toppling and dynamic loading"}


@lru_cache(maxsize=1)
def model_bundle():
    import xgboost as xgb
    import shap
    model = xgb.Booster()
    model.load_model(ROOT / "models/xgboost_geotechnical_gpu.json")
    return model, shap.TreeExplainer(model)


def model_assessment(features: list[float]) -> dict:
    from src.data_fusion import FEATURE_NAMES
    try:
        import xgboost as xgb
        model, explainer = model_bundle()
        array = np.array([features], dtype=np.float32)
        prob = float(model.predict(xgb.DMatrix(array, feature_names=FEATURE_NAMES))[0])
        values = np.array(explainer.shap_values(array)).reshape(-1)
        base = float(np.array(explainer.expected_value).reshape(-1)[0])
        return {"available": True, "score": round(prob * 100, 2), "training_source": "synthetic",
                "calibrated": False, "output": "HIGH class score; not event probability",
                "shap_units": "log odds of HIGH class", "shap_base_value": base,
                "shap": [{"feature": name, "input": round(float(v), 4), "value": round(float(s), 6)}
                         for name, v, s in zip(FEATURE_NAMES, features, values)],
                "raw_margin": base + float(values.sum())}
    except Exception as exc:
        return {"available": False, "shap": [], "error": type(exc).__name__,
                "training_source": "synthetic", "calibrated": False}


def label(score: float) -> str:
    return "CRITICAL" if score >= 70 else "WARNING" if score >= 40 else "NORMAL"


def screening_color(score: float) -> str:
    """Vary intensity within each alert band so block ranking stays visible."""
    if score < 40:
        start, end, t = (43, 153, 123), (160, 202, 127), score / 40
    elif score < 70:
        start, end, t = (238, 202, 117), (232, 145, 53), (score - 40) / 30
    else:
        start, end, t = (231, 108, 99), (171, 42, 53), (score - 70) / 30
    rgb = [round(a + (b-a) * t) for a, b in zip(start, end)]
    return "#" + "".join(f"{v:02x}" for v in rgb)


def assess(content: bytes, p: dict, weather: dict) -> dict:
    image = decode_image(content)
    h, w = image.shape[:2]
    grey = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(2.0, (8, 8)).apply(grey)
    blackhat = cv2.morphologyEx(clahe, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    _, mask = cv2.threshold(blackhat, max(12, float(np.percentile(blackhat, 88))), 255, cv2.THRESH_BINARY)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    count, components, stats, _ = cv2.connectedComponentsWithStats(mask)
    retained = np.zeros_like(mask)
    candidates = []
    for i in range(1, count):
        x, y, cw, ch, area = (int(v) for v in stats[i])
        length = math.hypot(cw, ch)
        aspect = max(cw, ch) / max(1, min(cw, ch))
        if area >= 12 and length >= max(12, min(h, w) * 0.025) and (aspect >= 1.8 or length >= min(h, w) * 0.15):
            retained[components == i] = 255
            candidates.append({"id": len(candidates) + 1, "bbox": [x, y, cw, ch],
                               "extent_px": round(length, 1), "area_px": area,
                               "note": "Candidate surface line; requires visual confirmation"})
    blur = float(cv2.Laplacian(grey, cv2.CV_64F).var())
    quality = []
    if blur < 50:
        quality.append("Image has low texture or blur; crack screening may miss features")
    if float(np.mean(grey < 25)) > 0.3 or float(np.mean(grey > 240)) > 0.3:
        quality.append("Large underexposed or overexposed area; interpretation is limited")
    smr = smr_rating(p)
    fos = factor_of_safety(p)
    jv = sum(1 / s for s in p["joint_spacings"])
    # Weights and scales are explicit prototype policy, not learned failure thresholds.
    rain_index = float(np.clip(max(weather["past_24h_mm"], weather["next_24h_mm"]) / 75, 0, 1))
    wet_index = float(np.clip(weather["past_72h_mm"] / 150, 0, 1))
    weather_index = 0.65 * rain_index + 0.35 * wet_index
    crack_overlay = image.copy()
    crack_overlay[retained > 0] = (60, 60, 245)
    blocks, grid = [], []
    n = p["grid_size"]
    heat = np.zeros((h, w, 3), np.uint8)
    for row in range(n):
        grid_row = []
        for col in range(n):
            x1, x2 = col * w // n, (col + 1) * w // n
            y1, y2 = row * h // n, (row + 1) * h // n
            coverage = float(np.mean(retained[y1:y2, x1:x2] > 0))
            image_index = min(1.0, coverage / 0.12)
            parts = [{"factor": "Visible line coverage", "points": 35 * image_index, "weight": 0.35},
                     {"factor": "SMR condition", "points": 25 * (1 - smr["score"] / 100), "weight": 0.25},
                     {"factor": "Rainfall exposure", "points": 20 * weather_index, "weight": 0.20},
                     {"factor": "Measured seepage ratio", "points": 10 * p["pore_pressure_ratio"], "weight": 0.10},
                     {"factor": "Blast vibration", "points": 10 * min(1, p["blast_vibration"] / 10), "weight": 0.10}]
            raw = sum(item["points"] for item in parts)
            fos_floor = 70 if fos["value"] < 1 else 40 if fos["value"] < 1.3 else 0
            smr_floor = 70 if smr["score"] < 20 else 40 if smr["score"] < 40 else 0
            floor = max(fos_floor, smr_floor)
            score = round(max(raw, floor), 2)
            if floor > raw:
                gate_name = "FoS" if fos_floor >= smr_floor else "SMR"
                parts.append({"factor": f"{gate_name} screening alert floor", "points": floor - raw, "weight": None})
            status = label(score)
            block_id = f"{chr(65 + row)}{col + 1:02d}"
            overlapping = [c["id"] for c in candidates if c["bbox"][0] < x2 and c["bbox"][0] + c["bbox"][2] > x1 and c["bbox"][1] < y2 and c["bbox"][1] + c["bbox"][3] > y1]
            block = {"id": block_id, "row": row, "col": col, "score": score,
                     "status": status, "color": screening_color(score), "line_coverage": round(coverage, 5),
                     "candidate_ids": overlapping, "contributions": [{**item, "points": round(item["points"], 4)} for item in parts],
                     "pixel_bounds": [x1, y1, x2, y2]}
            if p.get("bounds"):
                b = p["bounds"]
                west = b["west"] + (b["east"] - b["west"]) * col / n
                east = b["west"] + (b["east"] - b["west"]) * (col + 1) / n
                north = b["north"] - (b["north"] - b["south"]) * row / n
                south = b["north"] - (b["north"] - b["south"]) * (row + 1) / n
                block["bounds"] = {"west": west, "east": east, "north": north, "south": south}
            blocks.append(block)
            grid_row.append(score)
            color = block["color"].lstrip("#")
            heat[y1:y2, x1:x2] = tuple(int(color[i:i+2], 16) for i in (4, 2, 0))
        grid.append(grid_row)
    overlay = cv2.addWeighted(image, 0.6, heat, 0.4, 0)
    for b in blocks:
        x1, y1, x2, y2 = b["pixel_bounds"]
        cv2.rectangle(overlay, (x1, y1), (x2-1, y2-1), (240, 240, 240), 1)
        cv2.putText(overlay, b["id"], (x1+4, y1+17), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 2)
        cv2.putText(overlay, b["id"], (x1+4, y1+17), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
    global_coverage = float(np.mean(retained > 0))
    ml = model_assessment([p["slope_angle"], min(1, jv / 80), p["weathering_index"],
                           p["bench_height"], weather["past_24h_mm"], p["blast_vibration"],
                           p["pore_pressure_ratio"], min(1, global_coverage / 0.12)])
    # Paper formula is exposed for comparison; synthetic classifier excluded from warnings.
    hybrid = round(0.7 * ml["score"] + 0.3 * (100 - smr["score"]), 2) if ml["available"] else None
    alerts = [{"block_id": b["id"], "status": b["status"], "score": b["score"],
               "message": "Escalate for immediate geotechnical review and apply site exclusion procedures" if b["status"] == "CRITICAL" else "Inspect this block and review access under the site trigger action response plan",
               "acknowledged": False} for b in blocks if b["status"] != "NORMAL"]
    peak_window = None
    forecast = weather.get("forecast", [])
    if forecast:
        windows = [(sum(p["rain_mm"] for p in forecast[i:i+6]), (datetime.fromisoformat(forecast[i]["time"]) - timedelta(hours=1)).isoformat(), forecast[i+5]["time"])
                   for i in range(len(forecast)-5)]
        amount, start, end = max(windows)
        peak_window = {"start": start, "end": end, "rain_mm": round(amount, 2),
                       "meaning": "Wettest forecast six-hour window; not predicted failure time"}
    from src.crack_classifier import predict_patch
    transfer = predict_patch(image)
    return {"version": VERSION, "created_at": datetime.now(timezone.utc).isoformat(),
            "site_name": p["site_name"], "parameters": p, "weather": weather,
            "image": {"width": w, "height": h, "sha256": hashlib.sha256(content).hexdigest(),
                      "quality_warnings": quality, "laplacian_variance": round(blur, 2)},
            "cracks": {"count": len(candidates), "candidates": candidates, "line_coverage": global_coverage,
                       "method": "OpenCV black-hat and connected components; candidate detection", "transfer_classifier": transfer},
            "smr": smr, "fos": fos, "jv": {"value": round(jv, 3), "units": "m⁻¹", "source": "Sum of reciprocal measured joint-set spacings"},
            "model": ml, "paper_hybrid_score": hybrid,
            "paper_hybrid_note": "0.7 × synthetic model score + 0.3 × (100 − SMR); research comparison only, excluded from operational index",
            "blocks": blocks, "grid": grid, "alerts": alerts,
            "summary": {"score": max(b["score"] for b in blocks), "status": label(max(b["score"] for b in blocks)),
                        "normal": sum(b["status"] == "NORMAL" for b in blocks),
                        "warning": sum(b["status"] == "WARNING" for b in blocks),
                        "critical": sum(b["status"] == "CRITICAL" for b in blocks)},
            "peak_weather_window": peak_window, "georeferenced": bool(p.get("bounds")),
            "overlays": {"heatmap": encode_image(overlay), "cracks": encode_image(crack_overlay), "mask": encode_image(retained)},
            "limitations": ["Screening indices are not calibrated probabilities or predictions of failure time.",
                            "NORMAL means below prototype thresholds, not clearance for work.",
                            "All blocks share supplied geology and weather; only image evidence varies spatially.",
                            "Dark lines can be shadows or texture. A photograph does not measure joint depth, displacement or physical crack width.",
                            "Geographic placement requires a north-up orthorectified image with surveyed bounds.",
                            "FoS is an illustrative infinite-slope calculation; site-specific wedge/toppling analysis is required."]}
