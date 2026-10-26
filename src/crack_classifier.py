"""Small reproducible stone-patch transfer baseline; not a mine-failure model."""
from functools import lru_cache
from pathlib import Path
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
FEATURES = ["dark_line_mean", "dark_line_p90", "dark_line_fraction", "edge_fraction",
            "gradient_mean", "grey_std", "dark_fraction", "line_long_extent", "line_count", "contrast"]


def patch_features(image: np.ndarray) -> list[float]:
    image = cv2.resize(image, (224, 224), interpolation=cv2.INTER_AREA)
    grey = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    black = cv2.morphologyEx(grey, cv2.MORPH_BLACKHAT, np.ones((13, 13), np.uint8))
    edges = cv2.Canny(grey, 50, 120)
    grad = np.abs(cv2.Laplacian(grey, cv2.CV_32F))
    mask = np.uint8(black > 20) * 255
    cnt, _, stats, _ = cv2.connectedComponentsWithStats(mask)
    extents = [max(int(s[2]), int(s[3])) / 224 for s in stats[1:] if s[4] > 10]
    return [float(black.mean()) / 255, float(np.percentile(black, 90)) / 255,
            float((black > 20).mean()), float((edges > 0).mean()), float(grad.mean()) / 255,
            float(grey.std()) / 128, float((grey < 60).mean()), max(extents, default=0),
            min(cnt - 1, 500) / 500, float(np.percentile(grey, 90) - np.percentile(grey, 10)) / 255]


@lru_cache(maxsize=1)
def load_model():
    import xgboost as xgb
    model = xgb.Booster()
    model.load_model(ROOT / "models/stone_crack_classifier.json")
    return model


def predict_patch(image: np.ndarray) -> dict:
    try:
        import xgboost as xgb
        score = float(load_model().predict(xgb.DMatrix(np.array([patch_features(image)], np.float32), feature_names=FEATURES))[0])
        return {"available": True, "crack_class_score": round(score, 4),
                "training_dataset": "CRACK-CH", "domain": "Stone masonry patches, not mine walls",
                "used_for_alerts": False, "note": "Whole-image transfer demonstration; not calibrated or a segmentation model"}
    except Exception as exc:
        return {"available": False, "reason": type(exc).__name__, "used_for_alerts": False}
