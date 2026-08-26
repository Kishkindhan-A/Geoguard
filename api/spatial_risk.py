"""Optimized spatial risk heatmap engine for the GeoGuard AI backend."""

from __future__ import annotations

import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None  # type: ignore


def _risk_colormap_lut():
    """Build a 256-entry BGR lookup table: blue -> teal -> green -> yellow -> orange -> red."""
    lut = np.zeros((256, 1, 3), dtype=np.uint8)
    stops = [
        (0,   20,  80, 180),
        (64,  50, 200, 220),
        (128, 70, 210,  90),
        (192, 50, 180,  30),
        (255, 20,  30,  20),
    ]
    for i in range(256):
        for j in range(len(stops) - 1):
            if i <= stops[j + 1][0]:
                t = (i - stops[j][0]) / max(1, stops[j + 1][0] - stops[j][0])
                b = int(stops[j][1] + (stops[j + 1][1] - stops[j][1]) * t)
                g = int(stops[j][2] + (stops[j + 1][2] - stops[j][2]) * t)
                r = int(stops[j][3] + (stops[j + 1][3] - stops[j][3]) * t)
                lut[i] = [b, g, r]
                break
    return lut


COLORMAP_LUT = _risk_colormap_lut()

_RISK_LABELS = ["SAFE", "LOW", "MODERATE", "HIGH", "CRITICAL"]
_RISK_SHORT  = ["S", "L", "M", "H", "C"]
_RISK_BGR    = [(0,200,0), (0,200,100), (0,200,255), (0,120,255), (0,0,255)]


def compute_spatial_risk(image_bytes: bytes) -> dict:
    """Run full spatial risk analysis on image bytes. Returns grid + overlay + details."""
    _noop = {"grid": [[2]*5 for _ in range(5)], "overlay": None, "sector_details": [], "summary": {}}

    if cv2 is None:
        return _noop

    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return _noop

    h, w = img.shape[:2]
    grey = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # --- 1. Edge / fracture risk (dual-scale Canny) ---
    edges_fine   = cv2.Canny(grey, 30, 80)
    edges_coarse = cv2.Canny(grey, 60, 150)
    edges = cv2.bitwise_or(edges_fine, edges_coarse)
    k3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    k7 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    edge_risk = (
        0.5 * cv2.dilate(edges, k3, iterations=1).astype(np.float32) / 255.0
        + 0.5 * cv2.dilate(edges, k7, iterations=2).astype(np.float32) / 255.0
    )

    # --- 2. Texture variance (Laplacian) ---
    lap = cv2.Laplacian(grey, cv2.CV_32F)
    texture_norm = cv2.normalize(
        cv2.GaussianBlur(np.abs(lap), (11, 11), 0), None, 0, 1, cv2.NORM_MINMAX
    )

    # --- 3. Gradient magnitude (slope proxy) ---
    gx = cv2.Sobel(grey, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(grey, cv2.CV_32F, 0, 1, ksize=3)
    grad_norm = cv2.normalize(np.sqrt(gx**2 + gy**2), None, 0, 1, cv2.NORM_MINMAX)
    grad_smooth = cv2.GaussianBlur(grad_norm, (9, 9), 0)

    # --- 4. Water / seepage risk ---
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    water_risk = cv2.GaussianBlur(
        ((hsv[:, :, 2] < 80) & (hsv[:, :, 1] < 60)).astype(np.float32), (21, 21), 0
    )

    # --- 5. Loose rock / fresh face risk ---
    loose_risk = cv2.GaussianBlur(
        ((hsv[:, :, 2] > 160) & (hsv[:, :, 1] < 50)).astype(np.float32), (15, 15), 0
    )

    # --- 6. Weathering / oxidation staining ---
    hue = hsv[:, :, 0].astype(np.float32) / 180.0
    weathering = cv2.GaussianBlur(
        ((hue > 0.05) & (hue < 0.15)).astype(np.float32), (19, 19), 0
    )

    # --- Weighted risk fusion ---
    risk_map = (
        0.28 * edge_risk + 0.20 * texture_norm + 0.18 * grad_smooth
        + 0.16 * water_risk + 0.10 * loose_risk + 0.08 * weathering
    )
    risk_map = np.clip(risk_map, 0, 1)

    # Vertical gradient: top = distant bench = slightly higher risk
    grad_v = np.linspace(0.0, 0.12, h).reshape(-1, 1)
    risk_map = np.clip(risk_map + np.tile(grad_v, (1, w)), 0, 1)

    # Morphological cleanup + smooth
    kc = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    risk_map = cv2.morphologyEx(risk_map, cv2.MORPH_CLOSE, kc)
    risk_map = cv2.GaussianBlur(risk_map, (7, 7), 1.5)

    # --- Custom colormap overlay ---
    risk_uint8 = (risk_map * 255).astype(np.uint8)
    # Build BGR heatmap via per-pixel LUT
    heatmap_bgr = COLORMAP_LUT[risk_uint8, 0]

    # Variable alpha: high-risk zones get more opaque overlay
    alpha_mask = 0.30 + 0.45 * risk_map
    alpha_3ch = np.stack([alpha_mask] * 3, axis=-1)
    overlay = (img.astype(np.float32) * (1 - alpha_3ch) + heatmap_bgr.astype(np.float32) * alpha_3ch).astype(np.uint8)

    # --- Grid sector analysis ---
    rows, cols = 5, 5
    cell_h, cell_w = h // rows, w // cols
    grid = []
    sector_details = []

    for row in range(rows):
        grid_row = []
        for col in range(cols):
            y1, y2 = row * cell_h, (row + 1) * cell_h if row < rows - 1 else h
            x1, x2 = col * cell_w, (col + 1) * cell_w if col < cols - 1 else w

            cell_risk = risk_map[y1:y2, x1:x2]
            mean_risk = float(np.mean(cell_risk))
            max_risk = float(np.max(cell_risk))
            std_risk = float(np.std(cell_risk))
            confidence = round(max(0.0, min(1.0, 1.0 - std_risk * 2.5)), 3)

            if mean_risk < 0.20:      level = 0
            elif mean_risk < 0.35:    level = 1
            elif mean_risk < 0.50:    level = 2
            elif mean_risk < 0.70:    level = 3
            else:                     level = 4

            cell_edges  = round(float(np.mean(edges[y1:y2, x1:x2] > 0)), 3)
            cell_tex    = round(float(np.mean(texture_norm[y1:y2, x1:x2])), 3)
            cell_water  = round(float(np.mean(water_risk[y1:y2, x1:x2])), 3)
            cell_loose  = round(float(np.mean(loose_risk[y1:y2, x1:x2])), 3)
            cell_grad   = round(float(np.mean(grad_smooth[y1:y2, x1:x2])), 3)

            sector_details.append({
                "row": row, "col": col,
                "risk_level": level,
                "label": _RISK_LABELS[level],
                "mean_risk": round(mean_risk, 3),
                "max_risk": round(max_risk, 3),
                "confidence": confidence,
                "dominant_factor": max(
                    [("edges", cell_edges), ("texture", cell_tex),
                     ("water", cell_water), ("loose_rock", cell_loose),
                     ("gradient", cell_grad)],
                    key=lambda x: x[1],
                )[0],
                "edge_density": cell_edges,
                "texture": cell_tex,
                "water": cell_water,
                "loose_rock": cell_loose,
            })
            grid_row.append(level)
        grid.append(grid_row)

    # --- Draw overlay decorations ---

    # Grid lines with anti-aliased semi-transparent white
    grid_color = (200, 200, 200)
    for i in range(1, rows):
        cv2.line(overlay, (i * cell_w, 0), (i * cell_w, h), grid_color, 1, cv2.LINE_AA)
    for i in range(1, cols):
        cv2.line(overlay, (0, i * cell_h), (w, i * cell_h), grid_color, 1, cv2.LINE_AA)

    # Sector labels: letter + mean risk %
    font = cv2.FONT_HERSHEY_SIMPLEX
    for det in sector_details:
        cx = det["col"] * cell_w + cell_w // 2
        cy = det["row"] * cell_h + cell_h // 2
        label = _RISK_SHORT[det["risk_level"]]
        pct = f"{det['mean_risk']*100:.0f}%"
        color = _RISK_BGR[det["risk_level"]]

        # Shadow
        cv2.putText(overlay, label, (cx - 8, cy - 2), font, 0.55, (0, 0, 0), 3, cv2.LINE_AA)
        cv2.putText(overlay, label, (cx - 8, cy - 2), font, 0.55, color, 1, cv2.LINE_AA)
        # Percentage below
        cv2.putText(overlay, pct, (cx - 12, cy + 16), font, 0.35, (0, 0, 0), 2, cv2.LINE_AA)
        cv2.putText(overlay, pct, (cx - 12, cy + 16), font, 0.35, (220, 220, 220), 1, cv2.LINE_AA)

    # Smooth high-risk contours (filled, semi-transparent)
    _, thresh_high = cv2.threshold(risk_uint8, 170, 255, cv2.THRESH_BINARY)
    thresh_high = cv2.morphologyEx(thresh_high, cv2.MORPH_CLOSE, k7)
    contours_high, _ = cv2.findContours(thresh_high, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contour_overlay = overlay.copy()
    cv2.drawContours(contour_overlay, contours_high, -1, (0, 0, 255), 2, cv2.LINE_AA)
    cv2.addWeighted(contour_overlay, 0.85, overlay, 0.15, 0, overlay)

    # Smooth low-risk contours (green)
    _, thresh_low = cv2.threshold(risk_uint8, 80, 255, cv2.THRESH_BINARY_INV)
    contours_low, _ = cv2.findContours(thresh_low, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(overlay, contours_low, -1, (0, 200, 0), 1, cv2.LINE_AA)

    # --- Encode ---
    _, buf = cv2.imencode(".png", overlay)
    import base64
    overlay_b64 = base64.b64encode(buf).decode("utf-8")

    # --- Summary ---
    flat = [v for row in grid for v in row]
    summary = {
        "critical": flat.count(4),
        "high": flat.count(3),
        "moderate": flat.count(2),
        "low": flat.count(1),
        "safe": flat.count(0),
        "mean_risk": round(float(np.mean(risk_map)), 3),
        "max_risk": round(float(np.max(risk_map)), 3),
        "high_risk_pct": round(float((risk_map > 0.7).sum() / risk_map.size * 100), 1),
    }

    return {"grid": grid, "overlay": overlay_b64, "sector_details": sector_details, "summary": summary}
