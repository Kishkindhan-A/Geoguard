import { useEffect, useState } from "react";
import {
  ArrowRight,
  Mountain,
  Layers3,
  CloudRain,
  ShieldCheck,
} from "lucide-react";
import type { Saved } from "./assessmentTypes";
type Readiness = {
  database: boolean;
  geotechnical_model: boolean;
  crack_model: boolean;
  terrain_count: number;
  ai_configured: boolean;
};
export default function Overview({
  saved,
  online,
  navigate,
  open,
}: {
  saved: Saved[];
  online: boolean;
  navigate: (page: string) => void;
  open: (id: string) => void;
}) {
  const [ready, setReady] = useState<Readiness | null>(null);
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/readiness", { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setReady)
      .catch(() => {});
    return () => c.abort();
  }, []);
  const recent = saved.slice(0, 5);
  return (
    <>
      <section className="overview-hero">
        <div>
          <div className="eyebrow">ONE WORKSPACE. TRACEABLE EVIDENCE.</div>
          <h2>A clearer view of your mine.</h2>
          <p>
            Inspect real survey geometry, combine slope imagery with weather and
            geology, and review the evidence behind each block warning.
          </p>
          <div className="overview-actions">
            <button
              className="button primary"
              onClick={() => navigate("3D view")}
            >
              <Mountain size={16} />
              Explore the mine
              <ArrowRight size={15} />
            </button>
            <button
              className="button secondary"
              onClick={() => navigate("Assessment")}
            >
              <Layers3 size={16} />
              New assessment
            </button>
          </div>
        </div>
        <div className="survey-preview">
          <img
            src="/api/terrain/bingham-usgs/assets/texture.jpg"
            alt="Historical public orthoimagery of Bingham Canyon"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <small>
            Bingham Canyon · public orthoimagery · historical context, not a
            current survey
          </small>
        </div>
      </section>
      <section className="metrics">
        <article>
          <div className="metric-label">
            Saved assessments
            <Layers3 size={16} />
          </div>
          <div className="metric-value">{saved.length}</div>
          <span className="muted">Latest 100 in the local audit store</span>
        </article>
        <article>
          <div className="metric-label">
            Survey datasets
            <Mountain size={16} />
          </div>
          <div className="metric-value">{ready?.terrain_count ?? "—"}</div>
          <span className="muted">Actual elevation / measured XYZ</span>
        </article>
        <article>
          <div className="metric-label">
            Weather coverage
            <CloudRain size={16} />
          </div>
          <div className="metric-value">
            48<small>hours</small>
          </div>
          <span className="muted">Forecast retrieved for your coordinates</span>
        </article>
        <article>
          <div className="metric-label">
            Explanation method
            <ShieldCheck size={16} />
          </div>
          <div className="metric-value" style={{ fontSize: 24 }}>
            TreeSHAP
          </div>
          <span className="muted">
            Local attributions + exact block drivers
          </span>
        </article>
      </section>
      <div className="overview-columns">
        <section className="panel">
          <div className="panel-heading">
            <h2>From observation to review</h2>
            <span className="muted">Your workflow</span>
          </div>
          <ol className="overview-list">
            {[
              [
                "01",
                "Inspect the terrain",
                "Orbit a real mine, import a survey, inspect coordinates and measure distances.",
                "3D view",
              ],
              [
                "02",
                "Assess a slope image",
                "Upload a photo and enter measured geology. Review each image block and its drivers.",
                "Assessment",
              ],
              [
                "03",
                "Check weather exposure",
                "Retrieve rainfall, temperature and wind for the same site.",
                "Weather",
              ],
              [
                "04",
                "Review and record",
                "Inspect saved warnings, acknowledge review and export a printable report.",
                "History",
              ],
            ].map(([n, title, description, page]) => (
              <li key={n}>
                <span className="step-number">{n}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <button
                  className="button secondary"
                  onClick={() => navigate(page)}
                  aria-label={`Open ${page}`}
                >
                  <ArrowRight size={16} />
                </button>
              </li>
            ))}
          </ol>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Workspace readiness</h2>
            <span className="muted">Local checks</span>
          </div>
          {[
            ["Assessment service", online, "Connected", "Offline"],
            [
              "Assessment storage",
              !!ready?.database,
              "Available",
              "Not verified",
            ],
            [
              "Geotechnical model",
              !!ready?.geotechnical_model,
              "Synthetic benchmark",
              "Unavailable",
            ],
            [
              "Crack classifier",
              !!ready?.crack_model,
              "Research baseline",
              "Unavailable",
            ],
            [
              "Real survey data",
              !!ready?.terrain_count,
              `${ready?.terrain_count ?? 0} datasets`,
              "Import a survey",
            ],
            [
              "AI writing service",
              !!ready?.ai_configured,
              "Key configured; credits required",
              "Optional; not configured",
            ],
          ].map(([label, ok, yes, no]) => (
            <div className="readiness-row" key={String(label)}>
              <span>
                <i className={`readiness-dot ${ok ? "" : "unavailable"}`} />
                {label}
              </span>
              <strong>{ok ? yes : no}</strong>
            </div>
          ))}
          <p className="overview-note">
            Ready for local research and assessment review. Field use requires
            surveyed registration, calibrated thresholds and a site monitoring
            plan. A screening index is not a failure probability.
          </p>
        </section>
      </div>
      <section className="panel recent-assessments">
        <div className="panel-heading">
          <h2>Recent assessments</h2>
          <button
            className="button secondary"
            onClick={() => navigate("History")}
          >
            View history
            <ArrowRight size={14} />
          </button>
        </div>
        {recent.length ? (
          <ul className="overview-list">
            {recent.map((r) => (
              <li key={r.id}>
                <span className="step-number">
                  <Layers3 size={16} />
                </span>
                <div>
                  <h3>{r.site_name}</h3>
                  <p>
                    {new Date(r.created_at).toLocaleString()} · Maximum index{" "}
                    {r.summary.score.toFixed(1)} / 100
                  </p>
                </div>
                <button className="button secondary" onClick={() => open(r.id)}>
                  Open
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="overview-note">
            No saved results yet. Start with the attributed sample to learn the
            workflow, then assess your site photograph.
          </p>
        )}
      </section>
    </>
  );
}
