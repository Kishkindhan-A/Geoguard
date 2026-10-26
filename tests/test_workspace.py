import os
import tempfile
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from api.server import app
from src.reporting import render_report


def record():
    return {'id':'example','site_name':'<script>alert(1)</script>', 'created_at':'2026-10-25T10:00:00Z',
      'summary':{'score':45,'status':'WARNING'},'parameters':{'site_name':'<script>alert(1)</script>','slope_angle':55},
      'blocks':[{'id':'A01','score':45,'status':'WARNING','candidate_ids':[],'contributions':[{'factor':'Rain <exposure>','points':10}]}],
      'fos':{'value':1.2,'method':'resisting/driving'},'smr':{'score':50}, 'weather':{'source':'Manual','past_24h_mm':1,'past_72h_mm':3,'next_24h_mm':2},'georeferenced':False,'model':{'shap':[]},'alerts':[],'limitations':['Site review required']}

class WorkspaceTests(unittest.TestCase):
    def test_report_escapes_operator_content(self):
        html=render_report(record())
        self.assertNotIn('<script>',html)
        self.assertIn('&lt;script&gt;',html)
        self.assertIn('Rain &lt;exposure&gt;',html)
        self.assertIn('45.0',html)
        self.assertIn('gates may raise',html)
    def test_report_rejects_arbitrary_image_urls(self):
        r=record();r['overlays']={'heatmap':'https://attacker.invalid/track'}
        self.assertNotIn('<img',render_report(r))
    def test_report_route_returns_printable_snapshot(self):
        with patch('api.assessment_routes.get_assessment',return_value=record()):
            response=TestClient(app).get('/api/assessments/example/report')
            self.assertEqual(response.status_code,200)
            self.assertIn('text/html',response.headers['content-type'])
            self.assertIn("default-src 'none'",response.headers['content-security-policy'])
            self.assertIn('research',response.text.lower())
    def test_missing_report_is_404(self):
        with patch('api.store.read',return_value=None):
            self.assertEqual(TestClient(app).get('/api/assessments/missing/report').status_code,404)
    def test_readiness_uses_local_assets_without_external_calls(self):
        with tempfile.TemporaryDirectory() as temp,patch.dict(os.environ,{'GEOGUARD_DB_PATH':temp+'/audit.sqlite3','GEOGUARD_TERRAIN_PATH':temp+'/terrain'}),patch('requests.get') as remote:
            data=TestClient(app).get('/api/readiness').json()
            self.assertTrue(data['database'])
            self.assertEqual(data['terrain_count'],0)
            remote.assert_not_called()
    def test_ai_test_without_key_never_calls_provider(self):
        with patch.dict(os.environ,{'OPENAI_API_KEY':'','OPENAI_MODEL':''}),patch('requests.post') as remote:
            self.assertEqual(TestClient(app).post('/api/ai/test').status_code,503)
            remote.assert_not_called()

    def test_report_embeds_saved_png_base64(self):
        import base64
        r=record();r['overlays']={'heatmap':base64.b64encode(b'\x89PNG\r\n\x1a\nexample').decode()}
        self.assertIn('src="data:image/png;base64,',render_report(r))
