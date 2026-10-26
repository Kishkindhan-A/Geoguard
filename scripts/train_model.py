"""Train and publish the GeoGuard geotechnical model and SHAP artifacts."""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.ml_engine import train_and_evaluate_model


if __name__ == "__main__":
    result = train_and_evaluate_model()
    print(f"Model: {result['model_path']}")
    print(f"Metrics: {result['metrics_path']}")
    print(f"SHAP summary: {result['shap_plot_path']}")
    print(f"Data source: {result['data_source']}")
    print(f"ROC-AUC: {result['auc']:.4f}")
    print(f"Accuracy: {result['accuracy']:.4f}")