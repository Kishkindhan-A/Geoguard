"""Train a self-supervised 3D shape-prior converter from Kaggle geometry assets.

The source dataset has meshes/point clouds but no paired camera images. This
therefore learns a PCA heightfield prior from OBJ and TRI geometry, which is
used to reconstruct and smooth incoming image heightfields in the browser.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from sklearn.decomposition import PCA

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = Path.home() / ".cache" / "kagglehub" / "datasets" / "sc0v1n0" / "3d-models" / "versions" / "2" / "3d_samples"
OUTPUT_PATH = PROJECT_ROOT / "bench-core-dashboard" / "public" / "models" / "terrain_converter.json"
GRID_SIZE = 32


def read_vertices(path: Path) -> np.ndarray:
    if path.suffix == ".obj":
        rows = [line.split()[1:] for line in path.read_text(errors="ignore").splitlines() if line.startswith("v ")]
        return np.asarray(rows, dtype=np.float32)
    lines = path.read_text(errors="ignore").splitlines()
    vertices = []
    for index, line in enumerate(lines):
        values = line.split()
        if len(values) >= 6:
            try:
                point = [float(value) for value in values[:3]]
                normal = [float(value) for value in values[3:6]]
            except ValueError:
                continue
            if all(np.isfinite(point)) and all(np.isfinite(normal)):
                vertices.append(point)
    return np.asarray(vertices, dtype=np.float32)


def to_heightfield(vertices: np.ndarray) -> np.ndarray | None:
    if len(vertices) < 3:
        return None
    mins, maxs = vertices.min(axis=0), vertices.max(axis=0)
    spans = np.maximum(maxs - mins, 1e-6)
    grid = np.zeros((GRID_SIZE, GRID_SIZE), dtype=np.float64)
    counts = np.zeros_like(grid)
    columns = np.clip(((vertices[:, 0] - mins[0]) / spans[0] * GRID_SIZE).astype(int), 0, GRID_SIZE - 1)
    rows = np.clip(((vertices[:, 1] - mins[1]) / spans[1] * GRID_SIZE).astype(int), 0, GRID_SIZE - 1)
    heights = (vertices[:, 2] - mins[2]) / spans[2]
    for row, column, height in zip(rows, columns, heights):
        grid[row, column] += height
        counts[row, column] += 1
    grid[counts == 0] = 0.5
    grid[counts > 0] /= counts[counts > 0]
    return grid


def main() -> None:
    samples, names = [], []
    for path in sorted(DATASET_DIR.glob("*.obj")) + sorted(DATASET_DIR.glob("*.tri")):
        field = to_heightfield(read_vertices(path))
        if field is not None:
            samples.append(field.reshape(-1))
            names.append(path.name)
    if len(samples) < 3:
        raise RuntimeError(f"Expected at least 3 usable OBJ/TRI assets in {DATASET_DIR}")

    matrix = np.asarray(samples)
    pca = PCA(n_components=min(8, len(samples), matrix.shape[1]), random_state=42)
    pca.fit(matrix)
    payload = {
        "model": "terrain_heightfield_pca",
        "training": "self_supervised_geometry_reconstruction",
        "dataset": "sc0v1n0/3d-models",
        "samples": names,
        "grid_size": GRID_SIZE,
        "components": pca.components_.round(8).tolist(),
        "mean": pca.mean_.round(8).tolist(),
        "explained_variance_ratio": pca.explained_variance_ratio_.round(8).tolist(),
        "explained_variance_total": float(pca.explained_variance_ratio_.sum()),
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload), encoding="utf-8")
    print(f"Trained {payload['model']} from {len(names)} assets")
    print(f"Explained variance: {payload['explained_variance_total']:.4f}")
    print(f"Output: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
