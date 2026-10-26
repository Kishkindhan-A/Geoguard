import unittest
from unittest.mock import patch
import requests
from fastapi.testclient import TestClient
from api.server import app

class LiveWeatherTests(unittest.TestCase):
    def test_report_is_retrieved_for_requested_location(self):
        with patch('src.weather.fetch_weather', return_value={'source':'Open-Meteo','forecast':[]}) as provider:
            response=TestClient(app).get('/api/weather?latitude=40.523&longitude=-112.151')
            self.assertEqual(response.status_code,200)
            provider.assert_called_once_with(40.523,-112.151)
    def test_outage_returns_error_without_report(self):
        with patch('src.weather.fetch_weather', side_effect=requests.Timeout):
            response=TestClient(app).get('/api/weather?latitude=40&longitude=-112')
            self.assertEqual(response.status_code,502)
            self.assertNotIn('forecast',response.json())
    def test_invalid_coordinates_are_rejected(self):
        with patch('src.weather.fetch_weather') as provider:
            self.assertEqual(TestClient(app).get('/api/weather?latitude=99&longitude=0').status_code,422)
            provider.assert_not_called()
