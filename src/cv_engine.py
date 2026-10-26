"""
GeoGuard AI -- Computer Vision Risk Heatmap Engine

Analyses pit-wall photographs to generate pixel-wise risk heatmaps.
Identifies high-risk zones (red) and low-risk zones (green) based on:
  - Edge/fracture density (Canny + morphology)
  - Color variance (texture roughness proxy)
  - Gradient magnitude (slope steepness proxy)
  - Brightness variation (moisture/seepage proxy)
"""

from __future__ import annotations

from typing import Optional, Tuple

import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None  # type: ignore[assignment]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _safe_normalize(arr: np.ndarray, low: float = 0.0, high: float = 1.0) -> np.ndarray:
    """Min-max normalize to [low, high] with zero-range safety."""
    mn, mx = float(arr.min()), float(arr.max())
    if mx - mn < 1e-8:
        return np.full_like(arr, (low + high) / 2.0, dtype=np.float64)
    return (arr.astype(np.float64) - mn) / (mx - mn) * (high - low) + low


def _load_image(image_input) -> Optional[np.ndarray]:
    """Safely load an image from a file path, numpy array, bytes, or None.

    Returns a BGR numpy array or None on failure.
    """
    if image_input is None:
        return None

    if isinstance(image_input, np.ndarray):
        return image_input.copy() if image_input.ndim >= 2 else None

    if isinstance(image_input, (bytes, bytearray)):
        arr = np.frombuffer(image_input, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR) if cv2 is not None else None
        return img

    if isinstance(image_input, str):
        if cv2 is None:
            return None
        img = cv2.imread(image_input)
        return img

    return None


def _edge_risk_map(img_gray: np.ndarray, block_size: int = 16) -> np.ndarray:
    """Compute local edge density as a risk indicator."""
    if cv2 is None:
        return np.zeros(img_gray.shape[:2], dtype=np.float64)

    edges = cv2.Canny(img_gray, 50, 150)
    h, w = edges.shape
    risk = np.zeros((h, w), dtype=np.float64)

    for y in range(0, h, block_size):
        for x in range(0, w, block_size):
            block = edges[y : y + block_size, x : x + block_size]
            density = np.count_nonzero(block) / max(block.size, 1)
            risk[y : y + block_size, x : x + block_size] = density

    return _safe_normalize(risk)


def _texture_risk_map(img_gray: np.ndarray, block_size: int = 16) -> np.ndarray:
    """Compute local texture variance as a risk indicator."""
    h, w = img_gray.shape[:2]
    risk = np.zeros((h, w), dtype=np.float64)

    for y in range(0, h, block_size):
        for x in range(0, w, block_size):
            block = img_gray[y : y + block_size, x : x + block_size].astype(np.float64)
            risk[y : y + block_size, x : x + block_size] = block.std()

    return _safe_normalize(risk)


def _gradient_risk_map(img_gray: np.ndarray) -> np.ndarray:
    """Compute gradient magnitude as a proxy for slope steepness."""
    if cv2 is None:
        return np.zeros(img_gray.shape[:2], dtype=np.float64)

    gx = cv2.Sobel(img_gray, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(img_gray, cv2.CV_64F, 0, 1, ksize=3)
    magnitude = np.sqrt(gx ** 2 + gy ** 2)
    return _safe_normalize(magnitude)


def _brightness_risk_map(img_gray: np.ndarray, block_size: int = 16) -> np.ndarray:
    """Compute local brightness variation as a moisture/seepage proxy."""
    h, w = img_gray.shape[:2]
    risk = np.zeros((h, w), dtype=np.float64)

    for y in range(0, h, block_size):
        for x in range(0, w, block_size):
            block = img_gray[y : y + block_size, x : x + block_size].astype(np.float64)
            mean_val = block.mean()
            deviation = abs(mean_val - 128.0) / 128.0
            risk[y : y + block_size, x : x + block_size] = deviation

    return _safe_normalize(risk)


def _color_risk_map(img_rgb: np.ndarray, block_size: int = 16) -> np.ndarray:
    """Compute local colour variance in RGB space as a weathering proxy."""
    h, w = img_rgb.shape[:2]
    risk = np.zeros((h, w), dtype=np.float64)

    for y in range(0, h, block_size):
        for x in range(0, w, block_size):
            block = img_rgb[y : y + block_size, x : x + block_size].astype(np.float64)
            risk[y : y + block_size, x : x + block_size] = block.std()

    return _safe_normalize(risk)


def _colormap_risk(risk_map: np.ndarray) -> np.ndarray:
    """Convert a [0,1] risk map to a BGR colour image."""
    h, w = risk_map.shape
    bgr = np.zeros((h, w, 3), dtype=np.uint8)
    bgr[:, :, 1] = (np.clip(1.0 - risk_map, 0, 1) * 255).astype(np.uint8)
    bgr[:, :, 2] = (np.clip(risk_map, 0, 1) * 255).astype(np.uint8)
    mid_mask = np.abs(risk_map - 0.5) < 0.25
    bgr[:, :, 0] = (mid_mask * 40).astype(np.uint8)
    return bgr


def _synthetic_overlay(height: int = 256, width: int = 256) -> np.ndarray:
    """Generate a synthetic RGB rock-edge risk overlay when no image is available."""
    rng = np.random.default_rng(42)
    risk = rng.uniform(0.1, 0.9, (height, width)).astype(np.float64)

    # Add horizontal bench-like bands
    for y in range(0, height, height // 5):
        risk[y : y + 4, :] = np.clip(risk[y : y + 4, :] + 0.3, 0, 1)

    # Add vertical fracture lines
    for _ in range(8):
        x = rng.integers(20, width - 20)
        risk[:, x - 1 : x + 2] = np.clip(risk[:, x - 1 : x + 2] + 0.4, 0, 1)

    risk_smooth = cv2.GaussianBlur(risk, (5, 5), 1.5) if cv2 is not None else risk
    heatmap_bgr = _colormap_risk(risk_smooth)

    # Blend with a dark grey base
    base = np.full((height, width, 3), 60, dtype=np.uint8)
    overlay_bgr = cv2.addWeighted(base, 0.55, heatmap_bgr, 0.45, 0) if cv2 is not None else heatmap_bgr

    return cv2.cvtColor(overlay_bgr, cv2.COLOR_BGR2RGB) if cv2 is not None else overlay_bgr


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_risk_heatmap(
    image_input,
    output_size: Tuple[int, int] = (256, 256),
    block_size: int = 16,
    blend_alpha: float = 0.45,
) -> Tuple[Optional[np.ndarray], Optional[np.ndarray], dict]:
    """Generate a risk heatmap from a pit-wall photograph.

    Parameters
    ----------
    image_input : str, np.ndarray, bytes, or None
        File path, BGR/RGB numpy array, raw bytes, or None.
    output_size : tuple (width, height)
        Output resolution for the heatmap.
    block_size : int
        Block size for local feature extraction.
    blend_alpha : float
        Blending weight for the overlay.

    Returns
    -------
    heatmap_rgb : ndarray or None
        Pure risk heatmap (HxWx3) RGB.
    overlay_rgb : ndarray or None
        Original image blended with the heatmap, RGB.
    metrics : dict
        Risk metrics extracted from the image.
    """
    if cv2 is None:
        return None, None, {}

    img = _load_image(image_input)
    if img is None:
        return None, None, {}

    img_resized = cv2.resize(img, output_size, interpolation=cv2.INTER_AREA)

    if len(img_resized.shape) == 3:
        gray = cv2.cvtColor(img_resized, cv2.COLOR_BGR2GRAY)
        img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
    else:
        gray = img_resized
        img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_GRAY2RGB)

    edge_risk = _edge_risk_map(gray, block_size)
    texture_risk = _texture_risk_map(gray, block_size)
    gradient_risk = _gradient_risk_map(gray)
    brightness_risk = _brightness_risk_map(gray, block_size)
    color_risk = _color_risk_map(img_rgb, block_size)

    combined = (
        0.30 * edge_risk
        + 0.25 * texture_risk
        + 0.20 * gradient_risk
        + 0.15 * brightness_risk
        + 0.10 * color_risk
    )

    combined_smooth = cv2.GaussianBlur(combined, (5, 5), 1.5)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    combined_clean = cv2.morphologyEx(combined_smooth, cv2.MORPH_CLOSE, kernel)

    heatmap_bgr = _colormap_risk(combined_clean)
    overlay_bgr = cv2.addWeighted(img_resized, 1.0 - blend_alpha, heatmap_bgr, blend_alpha, 0)

    heatmap_rgb = cv2.cvtColor(heatmap_bgr, cv2.COLOR_BGR2RGB)
    overlay_rgb = cv2.cvtColor(overlay_bgr, cv2.COLOR_BGR2RGB)

    metrics = {
        "mean_risk": float(combined_clean.mean()),
        "max_risk": float(combined_clean.max()),
        "high_risk_pct": float((combined_clean > 0.7).sum() / combined_clean.size * 100),
        "low_risk_pct": float((combined_clean < 0.3).sum() / combined_clean.size * 100),
        "edge_density": float(edge_risk.mean()),
        "texture_roughness": float(texture_risk.mean()),
        "gradient_intensity": float(gradient_risk.mean()),
        "risk_map": combined_clean,
    }

    return heatmap_rgb, overlay_rgb, metrics


def extract_jv_density(image_input) -> tuple:
    """Extract Joint Volumetric density and contour overlay from an image.

    Safely accepts file paths, uploaded file bytes, numpy arrays, or None.

    Returns
    -------
    jv_density : float
        Estimated Jv in range 1.0 -- 80.0.
    overlay_image : np.ndarray or None
        RGB image with risk heatmap overlay.
    """
    if cv2 is None:
        overlay = _synthetic_overlay()
        return 20.0, overlay

    heatmap_rgb, overlay_rgb, metrics = generate_risk_heatmap(image_input)

    if overlay_rgb is None:
        overlay = _synthetic_overlay()
        return 20.0, overlay

    edge_d = metrics.get("edge_density", 0.5)
    texture_r = metrics.get("texture_roughness", 0.5)
    mean_risk = metrics.get("mean_risk", 0.5)

    jv_density = float(np.clip(
        (edge_d * 0.4 + texture_r * 0.3 + mean_risk * 0.3) * 80.0,
        1.0, 80.0,
    ))

    risk_map = metrics.get("risk_map")
    if risk_map is not None:
        risk_uint8 = (risk_map * 255).astype(np.uint8)
        _, thresh = cv2.threshold(risk_uint8, 180, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        overlay_bgr = cv2.cvtColor(overlay_rgb, cv2.COLOR_RGB2BGR)
        cv2.drawContours(overlay_bgr, contours, -1, (0, 255, 255), 1)
        overlay_rgb = cv2.cvtColor(overlay_bgr, cv2.COLOR_BGR2RGB)

    return jv_density, overlay_rgb


def analyze_image_risks(image_input) -> dict:
    """Full risk analysis of a pit-wall image."""
    heatmap_rgb, overlay_rgb, metrics = generate_risk_heatmap(image_input)

    return {
        "heatmap": heatmap_rgb,
        "overlay": overlay_rgb,
        "metrics": metrics,
        "risk_level": (
            "HIGH" if metrics.get("mean_risk", 0) > 0.6
            else "MEDIUM" if metrics.get("mean_risk", 0) > 0.35
            else "LOW"
        ),
    }


# ---------------------------------------------------------------------------
# Crack detection engine
# ---------------------------------------------------------------------------

def _crack_colormap_lut():
    """Build a 256-entry BGR LUT: green -> yellow -> orange -> dark red.

    This is the crack-aware heatmap the user requested: low risk starts at
    green and escalates through yellow/orange to dark red at maximum danger.
    """
    lut = np.zeros((256, 1, 3), dtype=np.uint8)
    stops = [
        (0,   30, 200,  60),    # green
        (96,  60, 200,  40),    # yellow-green
        (160, 40, 180,  20),    # orange
        (224, 30,  60,  10),    # red
        (255, 10,  10,   5),    # dark red
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


CRACK_COLORMAP_LUT = _crack_colormap_lut()


def detect_cracks(
    image_input,
    min_crack_length: int = 25,
    output_size: Tuple[int, int] = (512, 512),
) -> dict:
    """Detect cracks in a pit-wall image, rank them by danger, and mark the
    most dangerous crack in red.

    Returns
    -------
    dict with keys:
        overlay_rgb : ndarray
            Image with all cracks outlined and the most dangerous crack
            highlighted in bright red with a marker.
        crack_map : ndarray
            Grayscale crack probability map (0-255).
        heatmap_rgb : ndarray
            Green -> dark-red crack-aware heatmap.
        cracks : list[dict]
            Each crack: {id, length_px, width_px, danger_score, risk_level,
                         bbox, centroid, orientation_deg}
        most_dangerous : dict or None
            The single most dangerous crack.
        metrics : dict
            {crack_count, max_danger, mean_danger, high_danger_pct}
    """
    empty = {
        "overlay_rgb": None, "crack_map": None, "heatmap_rgb": None,
        "cracks": [], "most_dangerous": None,
        "metrics": {"crack_count": 0, "max_danger": 0.0, "mean_danger": 0.0, "high_danger_pct": 0.0},
    }
    if cv2 is None:
        return empty

    img = _load_image(image_input)
    if img is None:
        return empty

    img = cv2.resize(img, output_size, interpolation=cv2.INTER_AREA)
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img

    # --- Crack enhancement: dark thin lines stand out against rock ---
    # Morphological black-hat highlights dark cracks on a lighter background.
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel)

    # Adaptive threshold to isolate crack lines
    thresh = cv2.adaptiveThreshold(
        blackhat, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 21, -6,
    )

    # Clean up noise
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))

    # Crack probability map (smooth)
    crack_map = cv2.GaussianBlur(blackhat, (5, 5), 0)
    crack_map = cv2.normalize(crack_map, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)  # type: ignore[arg-type]

    # --- Find crack contours ---
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    cracks = []
    for idx, cnt in enumerate(contours):
        length = cv2.arcLength(cnt, True)
        if length < min_crack_length:
            continue
        area = cv2.contourArea(cnt)
        if area < 4:
            continue
        x, y, w, h = cv2.boundingRect(cnt)
        # Width estimate: area / length
        width = area / max(length, 1)
        # Orientation from min-area rectangle
        rect = cv2.minAreaRect(cnt)
        angle = abs(rect[2]) if rect[2] is not None else 0.0

        # Danger scoring: longer + wider + more vertical = more dangerous
        # (vertical cracks propagate and open under gravity)
        length_norm = min(1.0, length / (output_size[0] * 0.5))
        width_norm = min(1.0, width / 20.0)
        verticality = min(1.0, abs(90.0 - angle) / 90.0)
        # Cracks near the top of the slope are more dangerous (overhang)
        top_factor = 1.0 - (y / max(output_size[1], 1))

        danger = (
            0.45 * length_norm
            + 0.25 * width_norm
            + 0.20 * verticality
            + 0.10 * top_factor
        )
        danger = float(np.clip(danger, 0.0, 1.0))

        if danger < 0.15:
            continue

        if danger >= 0.7:
            risk_level = "CRITICAL"
        elif danger >= 0.5:
            risk_level = "HIGH"
        elif danger >= 0.3:
            risk_level = "MODERATE"
        else:
            risk_level = "LOW"

        cracks.append({
            "id": idx,
            "length_px": round(float(length), 1),
            "width_px": round(float(width), 2),
            "danger_score": round(danger, 3),
            "risk_level": risk_level,
            "bbox": [int(x), int(y), int(w), int(h)],
            "centroid": [int(x + w / 2), int(y + h / 2)],
            "orientation_deg": round(float(angle), 1),
        })

    # Sort by danger descending
    cracks.sort(key=lambda c: c["danger_score"], reverse=True)
    for i, c in enumerate(cracks):
        c["rank"] = i + 1

    most_dangerous = cracks[0] if cracks else None

    # --- Build overlay ---
    overlay = img.copy()
    for c in cracks:
        x, y, w, h = c["bbox"]
        color = (0, 0, 255) if c["risk_level"] == "CRITICAL" else \
                (0, 165, 255) if c["risk_level"] == "HIGH" else \
                (0, 215, 255) if c["risk_level"] == "MODERATE" else \
                (0, 200, 0)
        cv2.rectangle(overlay, (x, y), (x + w, y + h), color, 1, cv2.LINE_AA)

    # Highlight the most dangerous crack in bright red with a marker
    if most_dangerous is not None:
        x, y, w, h = most_dangerous["bbox"]
        cx, cy = most_dangerous["centroid"]
        cv2.rectangle(overlay, (x - 3, y - 3), (x + w + 3, y + h + 3), (0, 0, 255), 3, cv2.LINE_AA)
        # Crosshair marker on centroid
        cv2.drawMarker(overlay, (cx, cy), (0, 0, 255), cv2.MARKER_CROSS, 24, 2, cv2.LINE_AA)
        # Danger label
        label = f"DANGER {most_dangerous['danger_score']*100:.0f}%"
        cv2.putText(overlay, label, (x, max(18, y - 8)), cv2.FONT_HERSHEY_SIMPLEX,
                    0.6, (0, 0, 255), 2, cv2.LINE_AA)

    # --- Build green -> dark-red crack-aware heatmap ---
    heatmap_bgr = CRACK_COLORMAP_LUT[crack_map, 0]
    heatmap_rgb = cv2.cvtColor(heatmap_bgr, cv2.COLOR_BGR2RGB)

    overlay_rgb = cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB)

    metrics = {
        "crack_count": len(cracks),
        "max_danger": round(max((c["danger_score"] for c in cracks), default=0.0), 3),
        "mean_danger": round(float(np.mean([c["danger_score"] for c in cracks])) if cracks else 0.0, 3),
        "high_danger_pct": round(float(sum(1 for c in cracks if c["danger_score"] >= 0.5)) / max(len(cracks), 1) * 100, 1),
    }

    return {
        "overlay_rgb": overlay_rgb,
        "crack_map": crack_map,
        "heatmap_rgb": heatmap_rgb,
        "cracks": cracks,
        "most_dangerous": most_dangerous,
        "metrics": metrics,
    }
