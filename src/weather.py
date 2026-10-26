"""Coordinate-based weather context. Forecasts are never labelled sensor readings."""
from datetime import datetime, timezone
import requests

URL = "https://api.open-meteo.com/v1/forecast"


def fetch_weather(latitude: float, longitude: float) -> dict:
    response = requests.get(URL, params={
        "latitude": latitude, "longitude": longitude,
        "hourly": "precipitation,temperature_2m,wind_speed_10m",
        "current": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
        "past_days": 3, "forecast_days": 3, "timezone": "UTC",
    }, timeout=(5, 25))
    response.raise_for_status()
    data = response.json()
    hourly = data["hourly"]
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    points = []
    for i, stamp in enumerate(hourly["time"]):
        rain = hourly["precipitation"][i]
        if rain is None:
            continue
        at = datetime.fromisoformat(stamp).replace(tzinfo=timezone.utc)
        points.append({"time": at.isoformat(), "rain_mm": float(rain),
                       "temperature_c": hourly["temperature_2m"][i],
                       "wind_kmh": hourly["wind_speed_10m"][i],
                       "offset_hours": (at - now).total_seconds() / 3600})
    past = [p for p in points if -72 < p["offset_hours"] <= 0]
    future = [p for p in points if 0 < p["offset_hours"] <= 48]
    if len(past) < 72 or len(future) < 48:
        raise ValueError("Weather provider returned an incomplete 72h history / 48h forecast")
    next24 = future[:24]
    return {
        "source": "Open-Meteo", "mode": "modelled_weather", "timezone": "UTC",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "latitude": latitude, "longitude": longitude,
        "model_latitude": data.get("latitude"), "model_longitude": data.get("longitude"),
        "past_24h_mm": round(sum(p["rain_mm"] for p in past[-24:]), 2),
        "past_72h_mm": round(sum(p["rain_mm"] for p in past), 2),
        "next_24h_mm": round(sum(p["rain_mm"] for p in next24), 2),
        "next_48h_mm": round(sum(p["rain_mm"] for p in future), 2),
        "peak_next_24h_mm_h": max(p["rain_mm"] for p in next24),
        "forecast": future, "history": past,
        "current": data.get("current"), "current_units": data.get("current_units"),
        "attribution": "Weather data by Open-Meteo (CC BY 4.0); gridded model output, not a mine rain gauge.",
        "url": "https://open-meteo.com/en/docs",
    }
