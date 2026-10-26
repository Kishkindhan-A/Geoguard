import { useEffect, useState } from "react";
import type { Assessment } from "./assessmentTypes";

type Report = Assessment["weather"] & {
  latitude: number;
  longitude: number;
  current?: {
    time: string;
    temperature_2m: number | null;
    relative_humidity_2m: number | null;
    precipitation: number | null;
    wind_speed_10m: number | null;
  };
};
export default function LiveWeather({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const [lat, setLat] = useState(latitude);
  const [lon, setLon] = useState(longitude);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState({
    lat: latitude,
    lon: longitude,
    version: 0,
  });
  useEffect(() => {
    const abort = new AbortController();
    setBusy(true);
    setError("");
    setReport(null);
    fetch(`/api/weather?latitude=${request.lat}&longitude=${request.lon}`, {
      signal: abort.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.detail || "Weather retrieval failed");
        return body as Report;
      })
      .then(setReport)
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setBusy(false);
      });
    return () => abort.abort();
  }, [request]);
  return (
    <section className="panel weather-page live-weather">
      <div className="panel-heading">
        <h2>Live weather report · Open-Meteo</h2>
        <span className="muted">Direct API retrieval</span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setRequest({ lat, lon, version: request.version + 1 });
        }}
        style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}
      >
        <label>
          Latitude
          <input
            aria-label="Weather latitude"
            type="number"
            min={-85}
            max={85}
            step="any"
            required
            value={lat}
            onChange={(e) => setLat(Number(e.target.value))}
          />
        </label>
        <label>
          Longitude
          <input
            aria-label="Weather longitude"
            type="number"
            min={-180}
            max={180}
            step="any"
            required
            value={lon}
            onChange={(e) => setLon(Number(e.target.value))}
          />
        </label>
        <button className="primary-button" disabled={busy}>
          {busy ? "Fetching weather…" : "Refresh live weather"}
        </button>
        <button
          type="button"
          onClick={() => {
            setLat(latitude);
            setLon(longitude);
            setRequest({
              lat: latitude,
              lon: longitude,
              version: request.version + 1,
            });
          }}
        >
          Use active site
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {report && (
        <>
          <p className="helper">
            Location {report.latitude}, {report.longitude} · Retrieved{" "}
            {report.retrieved_at &&
              new Date(report.retrieved_at).toLocaleString()}
          </p>
          <div className="weather-totals">
            {[
              ["Current temperature", report.current?.temperature_2m, "°C"],
              ["Relative humidity", report.current?.relative_humidity_2m, "%"],
              ["Wind speed", report.current?.wind_speed_10m, "km/h"],
              ["Past 24h precipitation", report.past_24h_mm, "mm"],
              ["Past 72h precipitation", report.past_72h_mm, "mm"],
              ["Next 24h precipitation", report.next_24h_mm, "mm"],
            ].map(([label, value, unit]) => (
              <div key={String(label)}>
                <span>{label}</span>
                <strong>
                  {value == null ? "—" : Number(value).toFixed(1)}
                  <small> {unit}</small>
                </strong>
              </div>
            ))}
          </div>
          {report.current?.time && (
            <p className="helper">
              Current conditions valid at {report.current.time} UTC. Model
              estimates, not an on-site sensor.
            </p>
          )}
          <h3>Precipitation forecast · next 48 hours</h3>
          <div
            className="rain-chart"
            role="img"
            aria-label="48-hour hourly precipitation forecast"
          >
            <div className="rain-bars">
              {report.forecast.map((p) => (
                <div
                  key={p.time}
                  title={`${new Date(p.time).toLocaleString()} · ${p.rain_mm} mm`}
                >
                  <i
                    style={{
                      height: `${Math.max(1, (p.rain_mm / Math.max(1, ...report.forecast.map((x) => x.rain_mm))) * 100)}%`,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="chart-axis">
              <span>{new Date(report.forecast[0].time).toLocaleString()}</span>
              <span>
                {new Date(
                  report.forecast[report.forecast.length - 1].time,
                ).toLocaleString()}
              </span>
            </div>
          </div>
          <h3>Hourly values · UTC</h3>
          <div style={{ maxHeight: 360, overflow: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Precipitation (mm)</th>
                  <th>Temperature (°C)</th>
                </tr>
              </thead>
              <tbody>
                {report.forecast.map((p) => (
                  <tr key={p.time}>
                    <td>{p.time}</td>
                    <td>{p.rain_mm}</td>
                    <td>{p.temperature_c ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="helper">
            {report.attribution}{" "}
            <a
              href="https://open-meteo.com/en/docs"
              target="_blank"
              rel="noreferrer"
            >
              Provider documentation
            </a>
          </p>
          <p className="helper">
            Refreshing this report does not change a saved assessment. Run a new
            assessment to update its rainfall inputs and block warnings.
          </p>
        </>
      )}
    </section>
  );
}
