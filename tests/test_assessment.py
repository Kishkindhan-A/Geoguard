"""Behavioral tests for assessment physics, provenance, API boundaries and persistence."""
import io
import json
import math
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np
from fastapi.testclient import TestClient
from api.server import app
from api.assessment_routes import Parameters
from src.assessment import assess, factor_of_safety, label, model_assessment, smr_rating
from src.ml_engine import _load_data


def image_bytes(cracked=False, width=200, height=150):
    img = np.full((height, width, 3), 170, dtype=np.uint8)
    if cracked:
        cv2.line(img, (15, 10), (70, height-10), (15, 15, 15), 4)
    return cv2.imencode(".png", img)[1].tobytes()


def params(**kwargs):
    values = dict(site_name="Test mine", latitude=11.51, longitude=79.48, weather_mode="manual")
    values.update(kwargs)
    return Parameters(**values).model_dump()


def weather(rain=0):
    return {"source": "Operator supplied", "mode": "manual", "past_24h_mm": rain,
            "past_72h_mm": rain * 2, "next_24h_mm": rain, "forecast": [], "history": []}


class AssessmentPhysics(unittest.TestCase):
    def test_fos_is_resisting_over_driving(self):
        p = params(cohesion=0, pore_pressure_ratio=0, slope_angle=35, friction_angle=35)
        self.assertAlmostEqual(factor_of_safety(p)["value"], 1, places=4)

    def test_water_lowers_fos(self):
        self.assertGreater(factor_of_safety(params(pore_pressure_ratio=0))["value"],
                           factor_of_safety(params(pore_pressure_ratio=0.9))["value"])

    def test_smr_adverse_orientation(self):
        adverse = smr_rating(params(joint_dip=55, slope_angle=70, joint_direction=180, slope_direction=180, rmr=70))
        favourable = smr_rating(params(joint_dip=55, slope_angle=70, joint_direction=270, slope_direction=180, rmr=70))
        self.assertEqual(adverse["score"], 10)
        self.assertEqual(favourable["score"], 61)

    def test_smr_excavation_adjustment(self):
        base = smr_rating(params())["score"]
        self.assertAlmostEqual(smr_rating(params(excavation="presplitting"))["score"], base + 10)

    def test_threshold_boundaries(self):
        self.assertEqual([label(v) for v in [0, 39.99, 40, 69.99, 70, 100]],
                         ["NORMAL", "NORMAL", "WARNING", "WARNING", "CRITICAL", "CRITICAL"])

    def test_real_treeshap_additivity(self):
        r = model_assessment([55, .5, .5, 15, 30, 3, .3, .4])
        self.assertTrue(r["available"])
        prob = 1 / (1 + math.exp(-r["raw_margin"]))
        self.assertAlmostEqual(prob * 100, r["score"], delta=.02)
        self.assertEqual(len(r["shap"]), 8)
        self.assertFalse(r["calibrated"])

    def test_bundled_csv_is_synthetic(self):
        _, _, source = _load_data()
        self.assertEqual(source, "synthetic")


class Workflow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.previous = os.environ.get("GEOGUARD_DB_PATH")
        os.environ["GEOGUARD_DB_PATH"] = str(Path(cls.tmp.name) / "assessments.sqlite3")
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        if cls.previous is None:
            os.environ.pop("GEOGUARD_DB_PATH", None)
        else:
            os.environ["GEOGUARD_DB_PATH"] = cls.previous
        cls.tmp.cleanup()

    def create(self, p=None, image=None):
        return self.client.post("/api/assessments", data={"parameters": json.dumps(p or params())},
                                files={"image": ("mine.png", image if image is not None else image_bytes(), "image/png")})

    def test_persistence_and_csv_export(self):
        response = self.create()
        self.assertEqual(response.status_code, 200, response.text[:600])
        r = response.json()
        self.assertEqual(self.client.get(f"/api/assessments/{r['id']}").json(), r)
        self.assertTrue(any(row["id"] == r["id"] for row in self.client.get("/api/assessments").json()["assessments"]))
        export = self.client.get(f"/api/assessments/{r['id']}/export?format=csv")
        self.assertEqual(export.status_code, 200)
        self.assertEqual(len(export.text.strip().splitlines()), 26)

    def test_reject_geojson_without_survey(self):
        r = self.create().json()
        self.assertEqual(self.client.get(f"/api/assessments/{r['id']}/export?format=geojson").status_code, 409)

    def test_georeferenced_grid_covers_bounds(self):
        p = params(orthorectified=True, bounds={"north":11.52,"south":11.50,"east":79.49,"west":79.47})
        r = self.create(p).json()
        self.assertEqual(r["blocks"][0]["bounds"]["north"], 11.52)
        self.assertEqual(r["blocks"][-1]["bounds"]["south"], 11.50)
        export = self.client.get(f"/api/assessments/{r['id']}/export?format=geojson").json()
        self.assertEqual(len(export["features"]), 25)
        self.assertEqual(export["features"][0]["geometry"]["coordinates"][0][0], [79.47, r["blocks"][0]["bounds"]["south"]])

    def test_no_fake_cracks_on_uniform_image(self):
        r = self.create().json()
        self.assertEqual(r["cracks"]["count"], 0)
        self.assertEqual(r["image"]["width"], 200)
        self.assertEqual(r["image"]["height"], 150)
        self.assertTrue(r["image"]["quality_warnings"])

    def test_candidate_detection_changes_spatial_evidence(self):
        r = self.create(image=image_bytes(cracked=True)).json()
        self.assertGreater(r["cracks"]["count"], 0)
        coverages = [b["line_coverage"] for b in r["blocks"]]
        self.assertGreater(max(coverages), min(coverages))

    def test_contributions_reconcile(self):
        r = self.create(params(cohesion=0, pore_pressure_ratio=.8), image=image_bytes(True)).json()
        for b in r["blocks"]:
            self.assertAlmostEqual(sum(c["points"] for c in b["contributions"]), b["score"], delta=.02)
            self.assertEqual(b["status"], "CRITICAL")

    def test_rainfall_monotonic_and_synthetic_model_excluded(self):
        p = params(cohesion=200)
        dry = assess(image_bytes(True), p, weather(0))
        wet = assess(image_bytes(True), p, weather(100))
        self.assertTrue(all(b["score"] >= a["score"] for a,b in zip(dry["blocks"],wet["blocks"])))
        self.assertGreater(wet["summary"]["score"], dry["summary"]["score"])
        for b in wet["blocks"]:
            self.assertFalse(any("XGBoost" in c["factor"] for c in b["contributions"]))

    def test_joint_count_uses_measured_spacing(self):
        r = self.create(params(joint_spacings=[.5, 1, 2])).json()
        self.assertEqual(r["jv"]["value"], 3.5)

    def test_adverse_smr_raises_warning_even_with_high_fos(self):
        r = self.create(params(cohesion=200, rmr=65)).json()
        self.assertGreater(r["fos"]["value"], 1.3)
        self.assertLess(r["smr"]["score"], 40)
        self.assertTrue(all(b["score"] >= 40 for b in r["blocks"]))

    def test_missing_research_model_does_not_block_screening(self):
        with patch("src.assessment.model_bundle", side_effect=FileNotFoundError):
            r = self.create().json()
        self.assertFalse(r["model"]["available"])
        self.assertIsNone(r["paper_hybrid_score"])
        self.assertEqual(len(r["blocks"]), 25)

    def test_acknowledgement_is_durable_and_does_not_lower_risk(self):
        r = self.create(params(cohesion=0, pore_pressure_ratio=.9)).json()
        block = r["alerts"][0]["block_id"]
        response = self.client.post(f"/api/assessments/{r['id']}/alerts/{block}/acknowledge")
        self.assertEqual(response.status_code, 200)
        updated = self.client.get(f"/api/assessments/{r['id']}").json()
        self.assertTrue(updated["alerts"][0]["acknowledged"])
        self.assertEqual(updated["summary"], r["summary"])

    def test_invalid_image_returns_422(self):
        self.assertEqual(self.create(image=b"not an image").status_code, 422)

    def test_oversize_image_returns_422(self):
        self.assertEqual(self.create(image=b"x"*(12*1024*1024+1)).status_code, 422)

    def test_rejects_missing_and_nonfinite_parameters(self):
        for field, value in [("slope_angle", "NaN"), ("latitude", 91), ("cohesion", -10), ("grid_size", 25), ("joint_spacings", [0]), ("past_72h_mm", -1)]:
            p = params(); p[field] = value
            with self.subTest(field=field): self.assertEqual(self.create(p).status_code, 422)

    def test_manual_weather_consistency(self):
        p = params(); p.update(past_24h_mm=50, past_72h_mm=20)
        self.assertEqual(self.create(p).status_code, 422)

    def test_survey_confirmation_required(self):
        p = params(); p["bounds"] = {"north":11.52,"south":11.50,"east":79.49,"west":79.47}
        self.assertEqual(self.create(p).status_code, 422)

    def test_weather_outage_never_invents_data(self):
        with patch("api.assessment_routes.fetch_weather", side_effect=TimeoutError):
            r = self.create(params(weather_mode="live"))
        self.assertEqual(r.status_code, 502)
        self.assertIn("no weather data has been invented", r.json()["detail"])

    def test_question_uses_saved_facts_and_rejects_invalid_block(self):
        r = self.create().json()
        answer = self.client.post(f"/api/assessments/{r['id']}/question", json={"message":"When will it happen?","block_id":"A01"}).json()
        self.assertIn("cannot determine when", answer["reply"])
        self.assertEqual(answer["assessment_id"], r["id"])
        self.assertEqual(self.client.post(f"/api/assessments/{r['id']}/question", json={"message":"explain","block_id":"ZZZ"}).status_code, 404)

    def test_missing_assessment_returns_404(self):
        self.assertEqual(self.client.get("/api/assessments/missing").status_code, 404)


if __name__ == "__main__":
    unittest.main()
