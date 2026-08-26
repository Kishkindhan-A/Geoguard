"""
GeoGuard AI — GPU-Accelerated XGBoost Classifier & SHAP Explainability Engine

Trains a binary XGBoost model to predict slope-failure risk (LOW / HIGH)
and produces SHAP-based feature attributions.

Data sources (searched in order):
  1. data/geotechnical_sensors.csv
  2. data/raw/rockfall_dataset.csv
  3. Synthetic fallback (500 samples)
"""

from __future__ import annotations

import os
import pathlib
import warnings
from typing import Dict, Tuple, Optional

import numpy as np

warnings.filterwarnings("ignore", category=UserWarning)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REAL_DATA_PATHS = [
    "data/geotechnical_sensors.csv",
    "data/raw/rockfall_dataset.csv",
]

# Mapping: CSV column name -> internal feature name
CSV_COLUMN_MAP = {
    "slope_angle_deg": "slope_angle_deg",
    "discontinuity_density": "discontinuity_density",
    "weathering_index": "weathering_index",
    "bench_height_m": "bench_height_m",
    "rainfall_mm": "rainfall_mm",
    "blast_vibration_index": "blast_vibration_index",
    "water_seepage_index": "water_seepage_index",
    "loose_rock_index": "loose_rock_index",
}

FEATURE_NAMES = list(CSV_COLUMN_MAP.keys())

CLASS_NAMES = ["LOW", "HIGH"]
TARGET_COLUMN = "label"

MODEL_OUTPUT_DIR = "models"
MODEL_FILENAME = "xgboost_geotechnical_gpu.json"
SHAP_PLOT_FILENAME = "shap_summary.png"


# ---------------------------------------------------------------------------
# Synthetic fallback data generator
# ---------------------------------------------------------------------------

def _generate_synthetic_data(n_samples: int = 500) -> Tuple[np.ndarray, np.ndarray]:
    """Create a realistic synthetic geotechnical dataset for model training.

    Features (8):
        0 - Slope angle (degrees)
        1 - Discontinuity density (0-1)
        2 - Weathering index (0-1)
        3 - Bench height (m)
        4 - Rainfall (mm)
        5 - Blast vibration index (0-10)
        6 - Water seepage index (0-1)
        7 - Loose rock index (0-1)

    Labels:
        0 - LOW risk,  1 - HIGH risk
    """
    rng = np.random.default_rng(42)

    slope_angle = rng.uniform(20, 55, n_samples)
    disc_density = rng.uniform(0.05, 0.97, n_samples)
    weathering = rng.uniform(0.05, 0.98, n_samples)
    bench_height = rng.uniform(5, 30, n_samples)
    rainfall = rng.uniform(0, 200, n_samples)
    blast_vib = rng.uniform(0.1, 10, n_samples)
    water_seepage = rng.uniform(0.05, 0.97, n_samples)
    loose_rock = rng.uniform(0.06, 0.98, n_samples)

    X = np.column_stack([
        slope_angle, disc_density, weathering, bench_height,
        rainfall, blast_vib, water_seepage, loose_rock,
    ])

    risk_score = (
        (slope_angle / 55.0) * 0.25
        + disc_density * 0.20
        + weathering * 0.15
        + (bench_height / 30.0) * 0.10
        + (rainfall / 200.0) * 0.10
        + (blast_vib / 10.0) * 0.05
        + water_seepage * 0.10
        + loose_rock * 0.05
    )

    labels = np.zeros(n_samples, dtype=int)
    labels[risk_score > 0.52] = 1

    return X.astype(np.float32), labels


# ---------------------------------------------------------------------------
# Real CSV ingestion
# ---------------------------------------------------------------------------

def _load_real_data(csv_path: str) -> Tuple[np.ndarray, np.ndarray]:
    """Load and validate a real geotechnical sensor CSV.

    Returns
    -------
    X : ndarray, shape (n, 8), float32
    y : ndarray, shape (n,), int32

    Raises
    ------
    FileNotFoundError  If *csv_path* does not exist.
    ValueError          If required columns are missing or data is malformed.
    """
    import pandas as pd

    path = pathlib.Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(csv_path)

    df = pd.read_csv(path) if path.suffix.lower() == ".csv" else pd.read_parquet(path)

    if TARGET_COLUMN not in df.columns:
        available = ", ".join(df.columns.tolist())
        raise ValueError(
            f"Target column '{TARGET_COLUMN}' not found. Available: {available}"
        )

    missing_cols = [c for c in CSV_COLUMN_MAP if c not in df.columns]
    if missing_cols:
        available = ", ".join(df.columns.tolist())
        raise ValueError(
            f"Missing feature columns: {missing_cols}. Available: {available}"
        )

    keep_cols = list(CSV_COLUMN_MAP.keys()) + [TARGET_COLUMN]
    df = df[keep_cols]

    before = len(df)
    df = df.dropna()
    dropped = before - len(df)
    if dropped > 0:
        print(f"[ml_engine] Dropped {dropped} rows with NaN values")

    if len(df) < 20:
        raise ValueError(
            f"Insufficient data after cleaning: {len(df)} rows (need >= 20)"
        )

    X = df[list(CSV_COLUMN_MAP.keys())].values.astype(np.float32)
    y = df[TARGET_COLUMN].values.astype(int)

    unique_labels = np.unique(y)
    if not set(unique_labels).issubset({0, 1}):
        raise ValueError(
            f"Unexpected labels {unique_labels}. Expected 0 (Low), 1 (High)"
        )

    print(f"[ml_engine] Loaded {len(X)} samples from {csv_path}")
    print(f"[ml_engine] Label distribution: "
          f"LOW={int(np.sum(y == 0))}, HIGH={int(np.sum(y == 1))}")

    return X, y


def _load_data() -> Tuple[np.ndarray, np.ndarray, str]:
    """Try real CSVs first (in order); fall back to synthetic data.

    Returns
    -------
    X, y, data_source
        data_source is one of "real" or "synthetic".
    """
    for csv_path in REAL_DATA_PATHS:
        if os.path.isfile(csv_path):
            try:
                X, y = _load_real_data(csv_path)
                return X, y, "real"
            except Exception as exc:
                print(f"[ml_engine] Real data load failed ({csv_path}): {exc}")

    print("[ml_engine] No real data found -- using synthetic dataset (500 samples)")
    X, y = _generate_synthetic_data(500)
    return X, y, "synthetic"


# ---------------------------------------------------------------------------
# Model training
# ---------------------------------------------------------------------------

def _get_device() -> str:
    """Detect GPU availability and return the appropriate device string."""
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
    except ImportError:
        pass

    try:
        import xgboost as xgb
        # Quick probe: XGBClassifier with device="cuda" will error if no GPU
        probe = xgb.XGBClassifier(
            n_estimators=1, max_depth=1, tree_method="hist", device="cuda",
        )
        probe.fit(np.array([[0.0]]), np.array([0]), verbose=False)
        return "cuda"
    except Exception:
        return "cpu"


def train_and_evaluate_model(
    model_output_dir: str = MODEL_OUTPUT_DIR,
) -> Dict[str, object]:
    """Train an XGBoost classifier and produce SHAP explainability artefacts.

    Returns
    -------
    dict
        Keys: model, auc, accuracy, shap_values, feature_names,
        model_path, shap_plot_path, data_source, mean_abs_shap,
        test_X, test_y, explainer.
    """
    import xgboost as xgb
    from sklearn.metrics import roc_auc_score, accuracy_score
    from sklearn.model_selection import train_test_split
    import shap
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    X, y, data_source = _load_data()
    n_features = X.shape[1]
    feature_names = FEATURE_NAMES[:n_features] if n_features <= len(FEATURE_NAMES) else [f"f{i}" for i in range(n_features)]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y,
    )

    print(f"[ml_engine] Training set: {X_train.shape[0]} samples | "
          f"Test set: {X_test.shape[0]} samples | Source: {data_source}")

    device = _get_device()
    print(f"[ml_engine] Using device: {device}")

    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        objective="binary:logistic",
        tree_method="hist",
        device=device,
        eval_metric="logloss",
        random_state=42,
    )

    model.fit(
        X_train,
        y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    y_proba = model.predict_proba(X_test)
    y_pred = model.predict(X_test)

    try:
        auc = roc_auc_score(y_test, y_proba[:, 1])
        print(f"[ml_engine] ROC-AUC: {auc:.4f}")
    except ValueError:
        auc = 0.0
        print("[ml_engine] ROC-AUC could not be computed")

    accuracy = accuracy_score(y_test, y_pred)
    print(f"[ml_engine] Test accuracy: {accuracy:.4f}")

    print("[ml_engine] Computing SHAP values on test set...")
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_test)

    os.makedirs(model_output_dir, exist_ok=True)
    shap_plot_path = os.path.join(model_output_dir, SHAP_PLOT_FILENAME)

    plt.figure(figsize=(10, 6))
    if isinstance(shap_values, np.ndarray) and shap_values.ndim == 2:
        shap_arr = shap_values
    else:
        shap_arr = shap_values if isinstance(shap_values, np.ndarray) else np.array(shap_values)

    shap.summary_plot(
        shap_arr,
        features=X_test,
        feature_names=feature_names,
        show=False,
        plot_type="bar",
    )
    plt.tight_layout()
    plt.savefig(shap_plot_path, dpi=150, bbox_inches="tight")
    plt.close("all")
    print(f"[ml_engine] SHAP summary plot saved -> {shap_plot_path}")

    model_path = os.path.join(model_output_dir, MODEL_FILENAME)
    model.save_model(model_path)
    print(f"[ml_engine] Model saved -> {model_path}")

    if isinstance(shap_values, list):
        mean_abs_shap = np.mean([np.abs(sv).mean(axis=0) for sv in shap_values], axis=0)
    elif hasattr(shap_values, "ndim") and shap_values.ndim == 3:
        mean_abs_shap = np.abs(shap_values).mean(axis=(0, 2))
    else:
        mean_abs_shap = np.abs(shap_values).mean(axis=0)

    print("[ml_engine] Global feature importance (mean |SHAP|):")
    sorted_importance = sorted(zip(feature_names, mean_abs_shap.tolist()), key=lambda x: -x[1])
    for fname, imp in sorted_importance:
        print(f"    {fname:30s}  {imp:.6f}")

    return {
        "model": model,
        "auc": auc,
        "accuracy": accuracy,
        "shap_values": shap_values,
        "feature_names": feature_names,
        "model_path": model_path,
        "shap_plot_path": shap_plot_path,
        "data_source": data_source,
        "mean_abs_shap": mean_abs_shap,
        "test_X": X_test,
        "test_y": y_test,
        "explainer": explainer,
    }


if __name__ == "__main__":
    results = train_and_evaluate_model()
    print()
    print("=" * 72)
    print("Training complete.")
    print(f"  Data source : {results['data_source']}")
    print(f"  Model path  : {results['model_path']}")
    print(f"  SHAP plot   : {results['shap_plot_path']}")
    print(f"  ROC-AUC     : {results['auc']:.4f}")
    print(f"  Accuracy    : {results['accuracy']:.4f}")
    print("=" * 72)
