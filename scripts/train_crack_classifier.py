"""Download a verified public dataset and evaluate on a held-out stone site."""
import hashlib
import io
import json
import sys
import zipfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import cv2
import numpy as np
import requests
import xgboost as xgb
from sklearn.metrics import accuracy_score, balanced_accuracy_score, confusion_matrix, roc_auc_score
from src.crack_classifier import FEATURES, patch_features

URL = "https://zenodo.org/records/6516913/files/CRACK-CH.zip?download=1"
CHECKSUM = "027ebd7aa3a7a2eec661b615ff862caf"


def main():
    folder = ROOT / "data/external"
    folder.mkdir(parents=True, exist_ok=True)
    archive = folder / "crack-ch.zip"
    if not archive.exists():
        response = requests.get(URL, timeout=(10, 90))
        response.raise_for_status()
        archive.write_bytes(response.content)
    if hashlib.md5(archive.read_bytes()).hexdigest() != CHECKSUM:
        raise ValueError("Dataset checksum mismatch; refusing to train")
    rows = []
    with zipfile.ZipFile(archive) as dataset:
        for name in sorted(dataset.namelist()):
            if not name.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            image = cv2.imdecode(np.frombuffer(dataset.read(name), np.uint8), cv2.IMREAD_COLOR)
            if image is None:
                continue
            site = name.split("/")[1]
            target = 1 if "/positive/" in name.lower() else 0
            rows.append({"file": name, "site": site, "label": target, "features": patch_features(image)})
    if not rows:
        raise ValueError("No labelled images found")
    x = np.array([r["features"] for r in rows], np.float32)
    y = np.array([r["label"] for r in rows])
    # Never split neighbouring patches randomly: hold out a complete acquisition site.
    test = np.array([r["site"] == "Naillac" for r in rows])
    if not test.any() or test.all():
        raise ValueError("Expected Naillac held-out site not found")
    model = xgb.XGBClassifier(n_estimators=50, max_depth=2, learning_rate=0.08,
                              subsample=1, colsample_bytree=1, random_state=42, n_jobs=2,
                              eval_metric="logloss", tree_method="hist")
    model.fit(x[~test], y[~test])
    proba = model.predict_proba(x[test])[:, 1]
    predicted = (proba >= 0.5).astype(int)
    metrics = {"dataset": "CRACK-CH", "doi": "10.5281/zenodo.6516913", "license": "CC BY 4.0",
               "archive_md5": CHECKSUM, "archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
               "source_url": URL, "samples": len(rows), "sites": dict(Counter(r["site"] for r in rows)),
               "split": "Train Saint Nikolaos Fort; hold out all Naillac patches", "train_count": int((~test).sum()),
               "test_count": int(test.sum()), "accuracy": float(accuracy_score(y[test], predicted)),
               "balanced_accuracy": float(balanced_accuracy_score(y[test], predicted)),
               "roc_auc": float(roc_auc_score(y[test], proba)),
               "confusion_matrix_labels": ["no crack", "crack"], "confusion_matrix": confusion_matrix(y[test], predicted, labels=[0, 1]).tolist(),
               "features": FEATURES, "limitations": ["Very small two-site dataset", "Stone masonry, not mine rock",
               "No pixel masks, physical crack widths, event times or weather labels", "Patch-level transfer score excluded from risk warnings"],
               "test_predictions": [{"file": r["file"], "label": r["label"], "score": float(s)} for r, s in zip([r for r in rows if r["site"] == "Naillac"], proba)]}
    # Keep the evaluated model; do not refit on the test site.
    booster = model.get_booster()
    booster.feature_names = FEATURES
    booster.save_model(ROOT / "models/stone_crack_classifier.json")
    (ROOT / "models/crack_classifier_metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf8")
    (folder / "crack-ch-manifest.json").write_text(json.dumps({"url": URL, "md5": CHECKSUM,
                "license": "CC BY 4.0", "citation": "Agrafiotis, Doulamis and Georgopoulos, CRACK-CH, doi:10.5281/zenodo.6516913",
                "files": [{k: v for k, v in r.items() if k != "features"} for r in rows]}, indent=2), encoding="utf8")
    print(json.dumps({k: v for k, v in metrics.items() if k != "test_predictions"}, indent=2))


if __name__ == "__main__":
    main()
