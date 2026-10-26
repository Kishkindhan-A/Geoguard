import os
import unittest
from unittest.mock import patch, Mock
import requests
from src.ai_explainer import configuration, explain
from fastapi.testclient import TestClient
from api.server import app

class AIExplainerTests(unittest.TestCase):
    def setUp(self):
        self.health_patch = patch("src.ai_explainer._health", {})
        self.health_patch.start()
        self.addCleanup(self.health_patch.stop)

    def test_missing_key_never_calls_provider(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY':'', 'OPENAI_MODEL':''}), patch('src.ai_explainer.requests.post') as post:
            self.assertFalse(configuration()['configured'])
            with self.assertRaises(ValueError): explain('Why?',{}, {},'facts')
            post.assert_not_called()
    def test_status_never_discloses_key(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY':'secret-test-value','OPENAI_MODEL':'test-model'}):
            data=TestClient(app).get('/api/ai/status').json()
            self.assertTrue(data['configured'])
            self.assertFalse(data['verified'])
            self.assertNotIn('secret-test-value',str(data))
    def test_minimal_evidence_and_text_extraction(self):
        response=Mock()
        response.json.return_value={'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':'Evidence explanation'}]}]}
        with patch.dict(os.environ, {'OPENAI_API_KEY':'secret-test-value','OPENAI_MODEL':'test-model'}), patch('src.ai_explainer.requests.post',return_value=response) as post:
            result=explain('Why?',{'site_name':'PRIVATE MINE','latitude':12.345,'image':'PRIVATE PHOTO','model':{'shap':[]}}, {'score':75,'status':'CRITICAL','contributions':[]},'Screening only')
            self.assertEqual(result,'Evidence explanation')
            payload=post.call_args.kwargs['json']
            self.assertFalse(payload['store'])
            self.assertNotIn('PRIVATE',payload['input'])
            self.assertNotIn('12.345',payload['input'])
            self.assertEqual(post.call_args.args[0],'https://api.openai.com/v1/responses')
    def test_incomplete_response_rejected(self):
        response=Mock(); response.json.return_value={'status':'incomplete','output':[]}
        with patch.dict(os.environ, {'OPENAI_API_KEY':'test','OPENAI_MODEL':'test-model'}), patch('src.ai_explainer.requests.post',return_value=response):
            with self.assertRaises(ValueError): explain('Why?',{},{},'facts')

    def test_api_explains_exhausted_credit_error(self):
        r = requests.Response(); r.status_code=429
        r._content=b'{"error":{"code":"credit_balance_exhausted"}}'
        saved={'blocks':[{'id':'B1','score':45,'status':'WARNING','contributions':[]}], 'smr':{'score':55}, 'fos':{'value':1.4}}
        with patch('api.assessment_routes.get_assessment',return_value=saved), patch('src.ai_explainer.configuration',return_value={'configured':True}), patch('src.ai_explainer.explain',side_effect=requests.HTTPError(response=r)):
            response=TestClient(app).post('/api/assessments/example/question',json={'message':'Why?','use_ai':True})
            self.assertEqual(response.status_code,402)
            self.assertIn('credits are exhausted',response.json()['detail'])

    def test_credit_failure_is_visible_in_status(self):
        response=Mock(); response.ok=False
        response.json.return_value={'error':{'code':'credit_balance_exhausted'}}
        response.raise_for_status.side_effect=requests.HTTPError()
        with patch.dict(os.environ, {'OPENAI_API_KEY':'test','OPENAI_MODEL':'test-model'}), patch('src.ai_explainer.requests.post',return_value=response):
            with self.assertRaises(requests.HTTPError): explain('Why?',{},{},'facts')
            self.assertEqual(configuration()['connection_status'],'credits_required')
            self.assertFalse(configuration()['verified'])
    def test_success_is_visible_in_status(self):
        response=Mock();response.ok=True
        response.json.return_value={'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':'Example explanation'}]}]}
        with patch.dict(os.environ, {'OPENAI_API_KEY':'test','OPENAI_MODEL':'test-model'}), patch('src.ai_explainer.requests.post',return_value=response):
            explain('Why?',{},{},'facts')
            self.assertTrue(configuration()['verified'])
            self.assertIsNotNone(configuration()['checked_at'])
