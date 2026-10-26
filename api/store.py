"""Local assessment audit store. SQLite transactions keep acknowledgements durable."""
import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


@contextmanager
def connect():
    path = Path(os.environ.get("GEOGUARD_DB_PATH", str(ROOT / "data/assessments.sqlite3")))
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    try:
        connection.execute("CREATE TABLE IF NOT EXISTS assessments (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, site_name TEXT NOT NULL, payload TEXT NOT NULL)")
        with connection:
            yield connection
    finally:
        connection.close()


def save(result: dict) -> dict:
    result = {**result, "id": uuid.uuid4().hex}
    with connect() as db:
        db.execute("INSERT INTO assessments VALUES (?, ?, ?, ?)",
                   (result["id"], result["created_at"], result["site_name"], json.dumps(result, allow_nan=False)))
    return result


def listing() -> list[dict]:
    with connect() as db:
        rows = db.execute("SELECT id, created_at, site_name, json_extract(payload, '$.summary') FROM assessments ORDER BY created_at DESC LIMIT 100").fetchall()
    return [{"id": r[0], "created_at": r[1], "site_name": r[2], "summary": json.loads(r[3])} for r in rows]


def read(assessment_id: str) -> dict | None:
    with connect() as db:
        row = db.execute("SELECT payload FROM assessments WHERE id = ?", (assessment_id,)).fetchone()
    return json.loads(row[0]) if row else None


def acknowledge(assessment_id: str, block_id: str) -> dict | None:
    from datetime import datetime, timezone
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute("SELECT payload FROM assessments WHERE id = ?", (assessment_id,)).fetchone()
        if not row:
            return None
        result = json.loads(row[0])
        alert = next((a for a in result["alerts"] if a["block_id"] == block_id), None)
        if alert is None:
            raise KeyError(block_id)
        alert["acknowledged"] = True
        alert.setdefault("acknowledged_at", datetime.now(timezone.utc).isoformat())
        db.execute("UPDATE assessments SET payload = ? WHERE id = ?", (json.dumps(result, allow_nan=False), assessment_id))
    return result
