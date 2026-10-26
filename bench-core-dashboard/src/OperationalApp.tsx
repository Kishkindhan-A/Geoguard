import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  CloudRain,
  FileText,
  FlaskConical,
  Layers3,
  MapPin,
  Mountain,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import type {
  Assessment,
  Parameters,
  Research,
  Saved,
} from "./assessmentTypes";
import Overview from "./Overview";
import AIConnection from "./AIConnection";
import LiveWeather from "./LiveWeather";
const AssessmentMap = lazy(() => import("./AssessmentMap"));
const TerrainWorkspace = lazy(() => import("./TerrainWorkspace"));

const defaults: Parameters = {
  site_name: "Bingham Canyon",
  latitude: 40.523,
  longitude: -112.151,
  weather_mode: "live",
  past_24h_mm: 0,
  past_72h_mm: 0,
  next_24h_mm: 0,
  slope_angle: 55,
  slope_direction: 180,
  joint_dip: 45,
  joint_direction: 180,
  rmr: 65,
  joint_spacings: [0.5, 0.8, 1.2],
  excavation: "mechanical",
  bench_height: 15,
  layer_thickness: 3,
  friction_angle: 35,
  cohesion: 35,
  unit_weight: 26,
  pore_pressure_ratio: 0.2,
  blast_vibration: 2,
  weathering_index: 0.5,
  grid_size: 5,
  bounds: null,
  orthorectified: false,
};
const human = (name: string) => name.replace(/_/g, " ");
const date = (stamp: string) =>
  new Date(stamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : `Request failed (${response.status})`,
    );
  }
  return response.json();
}
function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = "any",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number | "any";
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        required
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) =>
          onChange(e.target.value === "" ? NaN : Number(e.target.value))
        }
      />
    </label>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className={`status ${value.toLowerCase()}`}>
      <i />
      {value}
    </span>
  );
}
function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Layers3 size={35} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export default function OperationalApp() {
  const [page, setPage] = useState("Overview");
  const [params, setParams] = useState<Parameters>(defaults);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<Assessment | null>(null);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [research, setResearch] = useState<Research | null>(null);
  const [selected, setSelected] = useState("A01");
  const [view, setView] = useState<"heatmap" | "cracks" | "mask">("heatmap");
  const [busy, setBusy] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>(
    [],
  );
  const [asking, setAsking] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState("all");
  const filteredSaved = saved.filter(
    (r) =>
      (r.site_name + " " + r.id)
        .toLowerCase()
        .includes(historySearch.toLowerCase()) &&
      (historyStatus === "all" || r.summary.status === historyStatus),
  );
  const upload = useRef<HTMLInputElement>(null);
  const resultEpoch = useRef(0);
  const isMounted = useRef(true);
  function change<K extends keyof Parameters>(key: K, value: Parameters[K]) {
    setParams((old) => ({ ...old, [key]: value }));
  }
  useEffect(() => {
    isMounted.current = true;
    const controller = new AbortController();
    Promise.all([
      api<{ status: string }>("/api/health", { signal: controller.signal }),
      api<{ assessments: Saved[] }>("/api/assessments", {
        signal: controller.signal,
      }),
      api<Research>("/api/research", { signal: controller.signal }),
    ])
      .then(([health, records, sources]) => {
        setOnline(health.status === "ok");
        setSaved(records.assessments);
        setResearch(sources);
      })
      .catch((err) => {
        if (err.name !== "AbortError")
          setError(
            "Cannot connect to the assessment service. Start the backend, then reload.",
          );
      });
    return () => {
      isMounted.current = false;
      controller.abort();
    };
  }, []);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const block =
    result?.blocks.find((b) => b.id === selected) ?? result?.blocks[0];
  const dirty =
    !!result &&
    (JSON.stringify(params) !== JSON.stringify(result.parameters) || !!file);
  function installResult(data: Assessment) {
    resultEpoch.current += 1;
    setResult(data);
    setSelected(data.blocks[0].id);
    setMessages([]);
    setParams(data.parameters);
    setFile(null);
  }
  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (busy || loadingId !== null) return;
    if (!file) {
      setError(
        "Choose a slope photograph first. Saved assessments retain their processed images; upload an image to run a new assessment.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("image", file);
      body.append("parameters", JSON.stringify(params));
      const data = await api<Assessment>("/api/assessments", {
        method: "POST",
        body,
      });
      installResult(data);
      setPage("Assessment");
      setSaved((old) =>
        [
          {
            id: data.id,
            created_at: data.created_at,
            site_name: data.site_name,
            summary: data.summary,
          },
          ...old,
        ].slice(0, 100),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function load(id: string) {
    setLoadingId(id);
    setError("");
    try {
      installResult(await api<Assessment>(`/api/assessments/${id}`));
      setPage("Assessment");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingId(null);
    }
  }
  async function sample() {
    setError("");
    try {
      const response = await fetch("/samples/stone-crack.jpg");
      if (!response.ok) throw new Error("Research sample unavailable");
      setFile(
        new File([await response.blob()], "CRACK-CH-stone-sample.jpg", {
          type: "image/jpeg",
        }),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function acknowledge(id: string) {
    if (!result) return;
    const epoch = resultEpoch.current;
    try {
      const data = await api<Assessment>(
        `/api/assessments/${result.id}/alerts/${id}/acknowledge`,
        { method: "POST" },
      );
      if (epoch === resultEpoch.current)
        setResult((old) =>
          old?.id === data.id
            ? {
                ...old,
                alerts: old.alerts.map((a) =>
                  a.block_id === id
                    ? data.alerts.find((b) => b.block_id === id)!
                    : a,
                ),
              }
            : old,
        );
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function ask(text = question) {
    if (!result || !text.trim() || asking) return;
    const epoch = resultEpoch.current;
    setQuestion("");
    setAsking(true);
    setMessages((old) => [...old, { role: "user", text }]);
    try {
      const answer = await api<{ reply: string }>(
        `/api/assessments/${result.id}/question`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            block_id: selected,
            use_ai: useAI,
          }),
        },
      );
      if (isMounted.current && epoch === resultEpoch.current)
        setMessages((old) => [
          ...old,
          { role: "assistant", text: answer.reply },
        ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAsking(false);
    }
  }
  const nav = [
    { name: "Overview", icon: Activity },
    { name: "Assessment", icon: Layers3 },
    { name: "3D view", icon: Mountain },
    { name: "Weather", icon: CloudRain },
    { name: "Alerts", icon: Bell },
    { name: "History", icon: Activity },
    { name: "Research", icon: FlaskConical },
  ];
  const title =
    page === "Overview"
      ? "Mine intelligence workspace"
      : page === "Assessment"
        ? "Slope assessment"
        : page === "3D view"
          ? "Slope geometry in context"
          : page === "Weather"
            ? "Weather exposure"
            : page === "Alerts"
              ? "Block warning register"
              : page === "History"
                ? "Assessment history"
                : "Evidence & research";
  return (
    <div className="workspace">
      <a className="skip-link" href="#workspace-main">
        Skip to workspace
      </a>
      <aside className="side-nav">
        <a
          className="brand"
          aria-label="GeoGuard assessment workspace"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Assessment");
          }}
        >
          <div className="brand-symbol">
            <Mountain size={26} />
          </div>
          <div>
            GeoGuard<span>GEOTECHNICAL INTELLIGENCE</span>
          </div>
        </a>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map((item) => (
            <button
              key={item.name}
              title={item.name}
              aria-label={item.name}
              aria-current={page === item.name ? "page" : undefined}
              className={page === item.name ? "active" : ""}
              onClick={() => setPage(item.name)}
            >
              <item.icon size={19} />
              {item.name}
              {item.name === "Alerts" && result && (
                <em>{result.alerts.filter((a) => !a.acknowledged).length}</em>
              )}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="research-mark">
            <ShieldCheck size={20} />
            <div>
              Research workspace<small>Hybrid assessment · v3.0</small>
            </div>
          </div>
          <p>
            Image evidence. Weather context.
            <br />
            Explainable decisions.
          </p>
          <span className={`connection ${online ? "connected" : ""}`}>
            <i />
            {online ? "Assessment service connected" : "Connecting to service"}
          </span>
        </div>
      </aside>
      <main id="workspace-main">
        <header className="topbar">
          <div>
            <span>Workspace</span>
            <ChevronDown size={13} />
            <strong>Open-pit risk assessment</strong>
          </div>
          <div>
            <span className="prototype">RESEARCH PROTOTYPE</span>
            <span className="avatar">GG</span>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">HYBRID GEOTECHNICAL EARLY WARNING</div>
              <h1>{title}</h1>
              <p>
                {page === "Assessment"
                  ? "Bring slope imagery, geology and weather into one interpretable assessment."
                  : "Trace every result to its inputs, method and source."}
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => {
                setPage("Assessment");
                window.setTimeout(() => upload.current?.click(), 0);
              }}
            >
              <Plus size={16} />
              New assessment
            </button>
          </div>
          <section className="site-context" aria-label="Active assessment site">
            <div>
              <MapPin size={19} />
              <label>
                Active site
                <select
                  aria-label="Active mine site"
                  disabled={busy || loadingId !== null}
                  value={
                    Math.abs(params.latitude - 40.523) < 0.001 &&
                    Math.abs(params.longitude + 112.151) < 0.001
                      ? "bingham"
                      : Math.abs(params.latitude - 11.51) < 0.001 &&
                          Math.abs(params.longitude - 79.48) < 0.001
                        ? "neyveli"
                        : "custom"
                  }
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setPage("Assessment");
                      return;
                    }
                    const b = e.target.value === "bingham";
                    setParams((old) => ({
                      ...old,
                      site_name: b ? "Bingham Canyon" : "Neyveli mine region",
                      latitude: b ? 40.523 : 11.51,
                      longitude: b ? -112.151 : 79.48,
                      bounds: null,
                      orthorectified: false,
                    }));
                  }}
                >
                  <option value="bingham">Bingham Canyon · USA</option>
                  <option value="neyveli">Neyveli region · India</option>
                  <option value="custom">
                    Custom site · edit assessment inputs
                  </option>
                </select>
              </label>
            </div>
            <span className="site-coordinate">
              {params.latitude.toFixed(4)}°, {params.longitude.toFixed(4)}°
            </span>
            <span className="site-hint">
              Weather & assessment location · survey registration is separate
            </span>
          </section>
          {page === "Overview" && (
            <Overview
              saved={saved}
              online={online}
              navigate={setPage}
              open={(id) => void load(id)}
            />
          )}
          {(page === "Assessment" || page === "Research") && (
            <AIConnection enabled={useAI} onChange={setUseAI} />
          )}
          {error && (
            <div role="alert" className="error-box">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {result && (
            <div className="snapshot-bar">
              <span>
                <i />
                Saved snapshot · {result.site_name} · {date(result.created_at)}
              </span>
              <div>
                {dirty && (
                  <strong>Inputs changed · run a new assessment</strong>
                )}
                <a
                  href={`/api/assessments/${result.id}/report`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Printable report
                </a>
                <a
                  href={`/api/assessments/${result.id}/export?format=json`}
                  download
                >
                  <ArrowDownToLine size={14} />
                  JSON
                </a>
                <a
                  href={`/api/assessments/${result.id}/export?format=csv`}
                  download
                >
                  Block CSV
                </a>
                {result.georeferenced && (
                  <a
                    href={`/api/assessments/${result.id}/export?format=geojson`}
                    download
                  >
                    GeoJSON
                  </a>
                )}
              </div>
            </div>
          )}
          {page === "Assessment" && (
            <>
              <section className="metrics">
                <article>
                  <div className="metric-label">
                    Maximum block index
                    <ShieldCheck size={17} />
                  </div>
                  <div className="metric-value">
                    {result ? result.summary.score.toFixed(1) : "—"}
                    <small>/ 100</small>
                  </div>
                  <div>
                    {result ? (
                      <Status value={result.summary.status} />
                    ) : (
                      <span className="muted">Awaiting first assessment</span>
                    )}
                  </div>
                </article>
                <article>
                  <div className="metric-label">
                    Candidate surface lines
                    <Layers3 size={17} />
                  </div>
                  <div className="metric-value">
                    {result?.cracks.count ?? "—"}
                  </div>
                  <span className="muted">
                    Visible features · needs confirmation
                  </span>
                </article>
                <article>
                  <div className="metric-label">
                    Illustrative factor of safety
                    <Activity size={17} />
                  </div>
                  <div className="metric-value">
                    {result?.fos.value.toFixed(2) ?? "—"}
                  </div>
                  <span className="muted">
                    Infinite-slope screening calculation
                  </span>
                </article>
                <article>
                  <div className="metric-label">
                    Next 24h precipitation
                    <CloudRain size={17} />
                  </div>
                  <div className="metric-value">
                    {result?.weather.next_24h_mm.toFixed(1) ?? "—"}
                    <small>mm</small>
                  </div>
                  <span className="muted">
                    {result?.weather.source ?? "Choose live or manual weather"}
                  </span>
                </article>
              </section>
              <div className="assessment-layout">
                <section className="panel setup-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-number">01</span>
                      <h2>Assessment inputs</h2>
                    </div>
                    <span className="muted">Scenario inputs</span>
                  </div>
                  <form onSubmit={run}>
                    <fieldset className="input-fieldset" disabled={busy}>
                      <div
                        className={`upload-zone ${file ? "has-file" : ""}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (e.dataTransfer.files[0])
                            setFile(e.dataTransfer.files[0]);
                        }}
                      >
                        {preview ? (
                          <img src={preview} alt="Selected slope photograph" />
                        ) : (
                          <Upload size={25} />
                        )}
                        <button
                          type="button"
                          onClick={() => upload.current?.click()}
                        >
                          {file ? file.name : "Upload a slope photograph"}
                        </button>
                        <small>JPEG or PNG · up to 12 MB · drag & drop</small>
                      </div>
                      <input
                        ref={upload}
                        aria-label="Slope photograph"
                        className="hidden-file"
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={(e) => {
                          if (e.target.files?.[0]) setFile(e.target.files[0]);
                        }}
                      />
                      <button
                        type="button"
                        className="sample-link"
                        onClick={sample}
                      >
                        Try a real stone-crack research sample{" "}
                        <ArrowRight size={13} />
                      </button>
                      {file?.name.startsWith("CRACK-CH") && (
                        <p className="helper">
                          CRACK-CH stone masonry sample, CC BY 4.0.
                          Demonstration image; it is not a mine survey.
                        </p>
                      )}
                      <label className="field">
                        <span>Site name</span>
                        <input
                          required
                          maxLength={100}
                          value={params.site_name}
                          onChange={(e) => change("site_name", e.target.value)}
                        />
                      </label>
                      <div className="field-pair">
                        <NumberField
                          label="Latitude"
                          value={params.latitude}
                          min={-85}
                          max={85}
                          onChange={(v) => change("latitude", v)}
                        />
                        <NumberField
                          label="Longitude"
                          value={params.longitude}
                          min={-180}
                          max={180}
                          onChange={(v) => change("longitude", v)}
                        />
                      </div>
                      <label className="field">
                        <span>Weather source</span>
                        <select
                          value={params.weather_mode}
                          onChange={(e) =>
                            change(
                              "weather_mode",
                              e.target.value as "live" | "manual",
                            )
                          }
                        >
                          <option value="live">
                            Open-Meteo · live model retrieval
                          </option>
                          <option value="manual">Manual rainfall totals</option>
                        </select>
                      </label>
                      {params.weather_mode === "manual" && (
                        <div className="field-pair">
                          <NumberField
                            label="Past 24h rain (mm)"
                            value={params.past_24h_mm}
                            min={0}
                            max={2000}
                            onChange={(v) => change("past_24h_mm", v)}
                          />
                          <NumberField
                            label="Past 72h rain (mm)"
                            value={params.past_72h_mm}
                            min={0}
                            max={5000}
                            onChange={(v) => change("past_72h_mm", v)}
                          />
                          <NumberField
                            label="Next 24h rain (mm)"
                            value={params.next_24h_mm}
                            min={0}
                            max={2000}
                            onChange={(v) => change("next_24h_mm", v)}
                          />
                        </div>
                      )}
                      <details open>
                        <summary>Geology & stability parameters</summary>
                        <p className="helper">
                          Defaults are hypothetical. Replace them with measured
                          site values.
                        </p>
                        <div className="field-pair">
                          <NumberField
                            label="Slope dip (°)"
                            value={params.slope_angle}
                            min={1}
                            max={89}
                            onChange={(v) => change("slope_angle", v)}
                          />
                          <NumberField
                            label="RMR basic (0–100)"
                            value={params.rmr}
                            min={0}
                            max={100}
                            onChange={(v) => change("rmr", v)}
                          />
                          <NumberField
                            label="Joint dip (°)"
                            value={params.joint_dip}
                            min={0}
                            max={90}
                            onChange={(v) => change("joint_dip", v)}
                          />
                          <NumberField
                            label="Slope direction (°)"
                            value={params.slope_direction}
                            min={0}
                            max={360}
                            onChange={(v) => change("slope_direction", v)}
                          />
                          <NumberField
                            label="Joint direction (°)"
                            value={params.joint_direction}
                            min={0}
                            max={360}
                            onChange={(v) => change("joint_direction", v)}
                          />
                          <NumberField
                            label="Pore pressure ratio (0–1)"
                            value={params.pore_pressure_ratio}
                            min={0}
                            max={1}
                            onChange={(v) => change("pore_pressure_ratio", v)}
                          />
                          {params.joint_spacings.map((s, i) => (
                            <NumberField
                              key={i}
                              label={`Joint set ${i + 1} spacing (m)`}
                              value={s}
                              min={0.001}
                              max={100}
                              onChange={(v) =>
                                change(
                                  "joint_spacings",
                                  params.joint_spacings.map((old, j) =>
                                    j === i ? v : old,
                                  ),
                                )
                              }
                            />
                          ))}
                          <NumberField
                            label="Grid rows / columns"
                            value={params.grid_size}
                            min={2}
                            max={10}
                            step={1}
                            onChange={(v) => change("grid_size", v)}
                          />
                        </div>
                        <label className="field">
                          <span>Excavation method</span>
                          <select
                            value={params.excavation}
                            onChange={(e) =>
                              change("excavation", e.target.value)
                            }
                          >
                            <option value="mechanical">
                              Mechanical excavation
                            </option>
                            <option value="normal_blasting">
                              Normal blasting
                            </option>
                            <option value="presplitting">Presplitting</option>
                            <option value="smooth_blasting">
                              Smooth blasting
                            </option>
                            <option value="natural">Natural slope</option>
                          </select>
                        </label>
                      </details>
                      <details>
                        <summary>Shear strength & model inputs</summary>
                        <div className="field-pair">
                          <NumberField
                            label="Friction angle (°)"
                            value={params.friction_angle}
                            min={1}
                            max={89}
                            onChange={(v) => change("friction_angle", v)}
                          />
                          <NumberField
                            label="Cohesion (kPa)"
                            value={params.cohesion}
                            min={0}
                            max={10000}
                            onChange={(v) => change("cohesion", v)}
                          />
                          <NumberField
                            label="Unit weight (kN/m³)"
                            value={params.unit_weight}
                            min={1}
                            max={50}
                            onChange={(v) => change("unit_weight", v)}
                          />
                          <NumberField
                            label="Vertical layer thickness (m)"
                            value={params.layer_thickness}
                            min={0.01}
                            max={100}
                            onChange={(v) => change("layer_thickness", v)}
                          />
                          <NumberField
                            label="Bench height (m)"
                            value={params.bench_height}
                            min={0.1}
                            max={200}
                            onChange={(v) => change("bench_height", v)}
                          />
                          <NumberField
                            label="Blast vibration (mm/s)"
                            value={params.blast_vibration}
                            min={0}
                            max={1000}
                            onChange={(v) => change("blast_vibration", v)}
                          />
                          <NumberField
                            label="Weathering index (0–1)"
                            value={params.weathering_index}
                            min={0}
                            max={1}
                            onChange={(v) => change("weathering_index", v)}
                          />
                        </div>
                        <p className="helper">
                          FoS uses layer thickness, not bench height. Pore
                          pressure ratio here means pore pressure / total normal
                          stress.
                        </p>
                      </details>
                      <details>
                        <summary>Surveyed map registration</summary>
                        <p className="helper">
                          For north-up orthorectified images only. An ordinary
                          wall photograph belongs in the image grid.
                        </p>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={params.orthorectified}
                            onChange={(e) =>
                              setParams((old) => ({
                                ...old,
                                orthorectified: e.target.checked,
                                bounds: e.target.checked
                                  ? {
                                      north: old.latitude + 0.002,
                                      south: old.latitude - 0.002,
                                      east: old.longitude + 0.002,
                                      west: old.longitude - 0.002,
                                    }
                                  : null,
                              }))
                            }
                          />
                          I have surveyed bounds for an orthorectified image
                        </label>
                        {params.bounds && (
                          <div className="field-pair">
                            {(["north", "south", "east", "west"] as const).map(
                              (key) => (
                                <NumberField
                                  key={key}
                                  label={human(key)}
                                  value={params.bounds![key]}
                                  onChange={(v) =>
                                    change("bounds", {
                                      ...params.bounds!,
                                      [key]: v,
                                    })
                                  }
                                />
                              ),
                            )}
                          </div>
                        )}
                        <p className="helper">
                          Suggested corners must be replaced with survey
                          coordinates before use.
                        </p>
                      </details>
                      <button
                        className="button primary run-button"
                        disabled={busy || !online}
                        type="submit"
                      >
                        {busy ? (
                          <>
                            <span className="spinner" />
                            Analysing image & context…
                          </>
                        ) : (
                          <>
                            <Search size={17} />
                            Run assessment
                            <ArrowRight size={16} />
                          </>
                        )}
                      </button>
                    </fieldset>
                  </form>
                </section>
                <div className="evidence-column">
                  <section className="panel image-panel">
                    <div className="panel-heading">
                      <div>
                        <span className="section-number">02</span>
                        <h2>Spatial evidence</h2>
                      </div>
                      <span className="muted">
                        {result
                          ? `${result.parameters.grid_size} × ${result.parameters.grid_size} image blocks`
                          : "No image analysed"}
                      </span>
                    </div>
                    <div className="view-controls">
                      {(["heatmap", "cracks", "mask"] as const).map((mode) => (
                        <button
                          key={mode}
                          className={view === mode ? "selected" : ""}
                          onClick={() => setView(mode)}
                        >
                          {mode === "heatmap"
                            ? "Risk heatmap"
                            : mode === "cracks"
                              ? "Candidate lines"
                              : "Detection mask"}
                        </button>
                      ))}
                    </div>
                    {result ? (
                      <div
                        className="image-view"
                        style={{
                          aspectRatio: `${result.image.width} / ${result.image.height}`,
                        }}
                      >
                        <img
                          src={`data:image/png;base64,${result.overlays[view]}`}
                          alt={
                            view === "heatmap"
                              ? "Block screening heatmap over the uploaded image"
                              : "Detected candidate lines on the uploaded image"
                          }
                        />
                        <div
                          className="image-hit-grid"
                          style={{
                            gridTemplateColumns: `repeat(${result.parameters.grid_size}, 1fr)`,
                          }}
                        >
                          {result.blocks.map((b) => (
                            <button
                              key={b.id}
                              className={
                                selected === b.id ? "focused-block" : ""
                              }
                              aria-label={`Select block ${b.id}, ${b.status}, index ${b.score}`}
                              onClick={() => setSelected(b.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <Empty title="Your slope, brought into focus">
                        Upload a photograph and run an assessment to reveal
                        image blocks, candidate cracks and their contributing
                        factors.
                      </Empty>
                    )}
                    <div className="legend">
                      <span>
                        <i className="normal-dot" />
                        Normal 0–39
                      </span>
                      <span>
                        <i className="warning-dot" />
                        Warning 40–69
                      </span>
                      <span>
                        <i className="critical-dot" />
                        Critical 70–100
                      </span>
                      <small>Screening index, not probability</small>
                    </div>
                    {result?.image.quality_warnings.map((w) => (
                      <p className="quality-note" key={w}>
                        {w}
                      </p>
                    ))}
                  </section>
                  {result && block && (
                    <section className="panel block-panel">
                      <div className="panel-heading">
                        <div>
                          <span className="section-number">03</span>
                          <h2>Why this block?</h2>
                        </div>
                        <label className="block-select">
                          <span>Block</span>
                          <select
                            aria-label="Selected block"
                            value={selected}
                            onChange={(e) => setSelected(e.target.value)}
                          >
                            {result.blocks.map((b) => (
                              <option key={b.id}>{b.id}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="block-summary">
                        <div>
                          <span className="large-block">{block.id}</span>
                          <Status value={block.status} />
                        </div>
                        <strong>
                          {block.score.toFixed(1)}
                          <small> / 100</small>
                        </strong>
                      </div>
                      <p className="helper">
                        Exact contributions to this block’s screening index.
                        Select any block in the image or map.
                      </p>
                      <div className="contributions">
                        {[...block.contributions]
                          .sort((a, b) => b.points - a.points)
                          .map((c) => (
                            <div key={c.factor}>
                              <span>{c.factor}</span>
                              <div>
                                <i
                                  style={{
                                    width: `${Math.max(0.5, (c.points / 70) * 100)}%`,
                                    background: c.factor.includes("FoS")
                                      ? "#e25555"
                                      : "#178f89",
                                  }}
                                />
                              </div>
                              <strong>{c.points.toFixed(1)}</strong>
                            </div>
                          ))}
                      </div>
                      <div className="block-facts">
                        <span>
                          {block.candidate_ids.length} overlapping candidate
                          regions
                        </span>
                        <span>
                          {(block.line_coverage * 100).toFixed(2)}% line
                          coverage
                        </span>
                      </div>
                    </section>
                  )}
                  {result && (
                    <section className="panel map-panel">
                      <div className="panel-heading">
                        <div>
                          <MapPin size={18} />
                          <h2>Geographic context</h2>
                        </div>
                        <span className="muted">
                          {result.georeferenced
                            ? "Operator-supplied surveyed bounds"
                            : "Weather query location only"}
                        </span>
                      </div>
                      <Suspense
                        fallback={<p className="loading">Loading map…</p>}
                      >
                        <AssessmentMap result={result} onSelect={setSelected} />
                      </Suspense>
                      <p className="map-note">
                        {result.georeferenced
                          ? "Grid placement assumes the supplied image is north-up and orthorectified. Bounds are recorded in exports."
                          : "This marker locates the weather query. Image blocks remain unregistered until surveyed bounds are supplied."}
                      </p>
                    </section>
                  )}
                </div>
                <div className="insight-column">
                  <section className="panel insight-panel">
                    <div className="panel-heading">
                      <div>
                        <Activity size={18} />
                        <h2>Geotechnical context</h2>
                      </div>
                    </div>
                    {result ? (
                      <>
                        <div className="smr-gauge">
                          <span>SMR</span>
                          <strong>
                            {result.smr.score.toFixed(1)}
                            <small>/100</small>
                          </strong>
                          <div>
                            <i style={{ width: `${result.smr.score}%` }} />
                          </div>
                        </div>
                        <p className="formula">RMR + F1 × F2 × F3 + F4</p>
                        <dl className="facts">
                          <div>
                            <dt>Orientation factors</dt>
                            <dd>
                              {result.smr.f1} × {result.smr.f2} ×{" "}
                              {result.smr.f3}
                            </dd>
                          </div>
                          <div>
                            <dt>Excavation adjustment</dt>
                            <dd>
                              {result.smr.f4 > 0 ? "+" : ""}
                              {result.smr.f4}
                            </dd>
                          </div>
                          <div>
                            <dt>Joint volumetric count</dt>
                            <dd>{result.jv.value.toFixed(2)} m⁻¹</dd>
                          </div>
                          <div>
                            <dt>Resisting shear</dt>
                            <dd>{result.fos.resisting_kpa} kPa</dd>
                          </div>
                          <div>
                            <dt>Driving shear</dt>
                            <dd>{result.fos.driving_kpa} kPa</dd>
                          </div>
                        </dl>
                        <p className="helper">
                          Jv comes from measured spacing. FoS = resisting /
                          driving shear. SMR uses planar-failure orientation
                          tables.
                        </p>
                      </>
                    ) : (
                      <p className="panel-placeholder">
                        Measured joint spacing and orientation connect the image
                        to geotechnical context.
                      </p>
                    )}
                  </section>
                  <section className="panel model-panel">
                    <div className="panel-heading">
                      <div>
                        <FlaskConical size={18} />
                        <h2>Model explanation</h2>
                      </div>
                    </div>
                    {result?.model.available ? (
                      <>
                        <span className="research-tag">
                          SYNTHETIC TRAINING · COMPARISON ONLY
                        </span>
                        <div className="model-score">
                          {result.model.score?.toFixed(1)}
                          <small>/100 HIGH-class score</small>
                        </div>
                        <p className="helper">
                          TreeSHAP attributions in log odds. Positive values
                          raise the model’s HIGH-class output; they are not
                          percentages.
                        </p>
                        <div className="shap-list">
                          {[...result.model.shap]
                            .sort(
                              (a, b) => Math.abs(b.value) - Math.abs(a.value),
                            )
                            .map((s) => (
                              <div key={s.feature}>
                                <span>{human(s.feature)}</span>
                                <strong
                                  className={
                                    s.value > 0 ? "positive" : "negative"
                                  }
                                >
                                  {s.value > 0 ? "+" : ""}
                                  {s.value.toFixed(3)}
                                </strong>
                              </div>
                            ))}
                        </div>
                        <p className="formula">
                          Base {result.model.shap_base_value?.toFixed(3)} + SHAP
                          = margin {result.model.raw_margin?.toFixed(3)}
                        </p>
                        <div className="paper-comparison">
                          <span>Paper’s 70/30 hybrid score</span>
                          <strong>
                            {result.paper_hybrid_score?.toFixed(1)}
                          </strong>
                        </div>
                        <p className="helper">
                          This model is excluded from block warnings. Its
                          synthetic labels cannot establish real-world failure
                          probabilities.
                        </p>
                      </>
                    ) : (
                      <p className="panel-placeholder">
                        Run an assessment to inspect actual TreeSHAP feature
                        contributions from the prototype classifier.
                      </p>
                    )}
                  </section>
                  <section className="scope-note">
                    <ShieldCheck size={19} />
                    <div>
                      <h3>Decision support, with context</h3>
                      <p>
                        Normal does not mean safe. This prototype cannot predict
                        a failure time or clear a bench for work.
                      </p>
                    </div>
                  </section>
                </div>
              </div>
              {result && (
                <section className="panel guide-panel">
                  <div className="panel-heading">
                    <div>
                      <FileText size={18} />
                      <h2>Ask about this assessment</h2>
                    </div>
                    <span className="muted">
                      Saved facts · block {selected}
                    </span>
                  </div>
                  <div className="prompt-chips">
                    {[
                      "Why is this block at risk?",
                      "How does rainfall affect it?",
                      "When could a rockfall happen?",
                      "Explain the SHAP values",
                    ].map((q) => (
                      <button
                        disabled={asking}
                        key={q}
                        onClick={() => void ask(q)}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  <div className="messages" aria-live="polite">
                    {messages.length === 0 && (
                      <p className="helper">
                        {useAI
                          ? "AI-written answers use saved numerical evidence; calculations and warning levels stay unchanged."
                          : "The local guide answers from saved measurements and calculation outputs using response templates."}
                      </p>
                    )}
                    {messages.map((m, i) => (
                      <div className={`message ${m.role}`} key={i}>
                        <strong>
                          {m.role === "user" ? "You" : "Assessment guide"}
                        </strong>
                        <p>{m.text}</p>
                      </div>
                    ))}
                    {asking && <p>Reading assessment…</p>}
                  </div>
                  <form
                    className="question-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void ask();
                    }}
                  >
                    <input
                      aria-label="Question about assessment"
                      placeholder={`Ask about block ${selected}, rainfall, cracks or the model…`}
                      value={question}
                      maxLength={2000}
                      onChange={(e) => setQuestion(e.target.value)}
                    />
                    <button
                      className="button primary"
                      disabled={asking || !question.trim()}
                      aria-label="Send question"
                    >
                      <Send size={17} />
                    </button>
                  </form>
                </section>
              )}
            </>
          )}
          {page === "Weather" && (
            <LiveWeather
              key={`${params.latitude},${params.longitude}`}
              latitude={params.latitude}
              longitude={params.longitude}
            />
          )}
          {page === "Weather" &&
            (result ? (
              <section className="panel weather-page">
                <div className="panel-heading">
                  <div>
                    <CloudRain size={20} />
                    <h2>{result.weather.source} · saved weather context</h2>
                  </div>
                  <span className="muted">UTC timestamps</span>
                </div>
                <div className="weather-totals">
                  {[
                    ["Past 24 hours", result.weather.past_24h_mm],
                    ["Past 72 hours", result.weather.past_72h_mm],
                    ["Next 24 hours", result.weather.next_24h_mm],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>
                        {Number(value).toFixed(1)}
                        <small> mm</small>
                      </strong>
                    </div>
                  ))}
                </div>
                <h3>48-hour precipitation forecast</h3>
                {result.weather.forecast.length ? (
                  <>
                    <div
                      className="rain-chart"
                      role="img"
                      aria-label="Hourly forecast precipitation"
                    >
                      <div className="rain-bars">
                        {result.weather.forecast.map((p) => (
                          <div
                            key={p.time}
                            title={`${date(p.time)} · ${p.rain_mm} mm`}
                          >
                            <i
                              style={{
                                height: `${Math.max(2, (p.rain_mm / Math.max(1, ...result.weather.forecast.map((x) => x.rain_mm))) * 100)}%`,
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="chart-axis">
                        <span>{date(result.weather.forecast[0].time)}</span>
                        <span>
                          {date(
                            result.weather.forecast[
                              result.weather.forecast.length - 1
                            ].time,
                          )}
                        </span>
                      </div>
                    </div>
                    {result.peak_weather_window && (
                      <div className="weather-window">
                        <CloudRain size={22} />
                        <div>
                          <h3>Wettest forecast six-hour window</h3>
                          <p>
                            {date(result.peak_weather_window.start)} –{" "}
                            {date(result.peak_weather_window.end)} ·{" "}
                            {result.peak_weather_window.rain_mm} mm
                          </p>
                          <small>
                            This is a weather exposure window, not a prediction
                            of failure time. Chart labels use your device’s
                            local timezone.
                          </small>
                        </div>
                      </div>
                    )}
                    <details>
                      <summary>Hourly forecast values · UTC</summary>
                      <table>
                        <thead>
                          <tr>
                            <th>Timestamp</th>
                            <th>Precipitation (mm)</th>
                            <th>Temperature (°C)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.weather.forecast.map((p) => (
                            <tr key={p.time}>
                              <td>{p.time}</td>
                              <td>{p.rain_mm}</td>
                              <td>{p.temperature_c ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  </>
                ) : (
                  <p className="helper">
                    Manual totals supplied. No hourly forecast was requested or
                    generated.
                  </p>
                )}
                <p className="helper">{result.weather.attribution}</p>
                {result.weather.retrieved_at && (
                  <p className="helper">
                    Retrieved {date(result.weather.retrieved_at)}. Re-run with a
                    new image to refresh the assessment.
                  </p>
                )}
              </section>
            ) : (
              <p className="helper">
                Run an assessment to save weather alongside your image and
                geology inputs.
              </p>
            ))}
          {page === "Alerts" &&
            (result ? (
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <Bell size={20} />
                    <h2>{result.alerts.length} block warnings</h2>
                  </div>
                  <span className="muted">
                    Assessment {result.id.slice(0, 8)}
                  </span>
                </div>
                <p className="helper padded">
                  Acknowledgement records review only. It does not change the
                  risk score or resolve the warning.
                </p>
                {result.alerts.length ? (
                  <div className="alert-list">
                    {result.alerts.map((a) => (
                      <article key={a.block_id}>
                        <div>
                          <Status value={a.status} />
                          <button
                            className="block-link"
                            onClick={() => {
                              setSelected(a.block_id);
                              setPage("Assessment");
                            }}
                          >
                            Block {a.block_id} <ArrowRight size={13} />
                          </button>
                          <p>{a.message}</p>
                          <small>
                            Index {a.score.toFixed(1)}/100 ·{" "}
                            {date(result.created_at)}
                          </small>
                        </div>
                        <button
                          className="button secondary"
                          disabled={a.acknowledged}
                          onClick={() => void acknowledge(a.block_id)}
                        >
                          {a.acknowledged ? (
                            <>
                              <Check size={15} />
                              Acknowledged
                            </>
                          ) : (
                            "Acknowledge"
                          )}
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <Empty title="No blocks exceed screening thresholds">
                    Continue the site inspection process. A low screening index
                    does not establish that a bench is safe.
                  </Empty>
                )}
              </section>
            ) : (
              <Empty title="No assessment warnings yet">
                Warnings are generated from saved assessment results.
              </Empty>
            ))}
          {page === "History" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <Activity size={20} />
                  <h2>Saved assessments</h2>
                </div>
                <span className="muted">
                  Local SQLite audit store · latest 100
                </span>
              </div>
              <div className="history-tools">
                <input
                  aria-label="Search assessment history"
                  placeholder="Search site or assessment ID…"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
                <select
                  aria-label="Filter history by status"
                  value={historyStatus}
                  onChange={(e) => setHistoryStatus(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="NORMAL">Normal</option>
                  <option value="WARNING">Warning</option>
                  <option value="CRITICAL">Critical</option>
                </select>
                <small>{filteredSaved.length} records</small>
              </div>
              {filteredSaved.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Site / assessment</th>
                        <th>Created</th>
                        <th>Maximum index</th>
                        <th>Status</th>
                        <th>Blocks at warning / critical</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSaved.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.site_name}</strong>
                            <small>{r.id.slice(0, 12)}</small>
                          </td>
                          <td>{date(r.created_at)}</td>
                          <td>{r.summary.score.toFixed(1)} / 100</td>
                          <td>
                            <Status value={r.summary.status} />
                          </td>
                          <td>
                            {r.summary.warning} / {r.summary.critical}
                          </td>
                          <td>
                            <button
                              className="button secondary"
                              disabled={loadingId !== null || busy}
                              onClick={() => void load(r.id)}
                            >
                              {loadingId === r.id ? "Loading…" : "Open"}
                              <ArrowRight size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title={
                    saved.length
                      ? "No matching assessments"
                      : "Start your assessment history"
                  }
                >
                  Completed assessments appear here. Adjust the filters or run a
                  new assessment.
                </Empty>
              )}
            </section>
          )}
          {page === "Research" && (
            <div className="research-page">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <FlaskConical size={20} />
                    <h2>Dataset provenance</h2>
                  </div>
                  <span className="research-tag">VERIFIED SOURCES</span>
                </div>
                <div className="dataset-list">
                  {research?.datasets.map((d) => (
                    <article key={d.name}>
                      <div>
                        <a href={d.url} target="_blank" rel="noreferrer">
                          {d.name} ↗
                        </a>
                        <span>{d.status}</span>
                      </div>
                      <p>{d.purpose}</p>
                      <small>{d.license}</small>
                      <p className="helper">{d.limitation}</p>
                    </article>
                  ))}
                </div>
              </section>
              <section className="panel benchmark">
                <div className="panel-heading">
                  <div>
                    <Activity size={19} />
                    <h2>Measured crack benchmark</h2>
                  </div>
                </div>
                {research?.crack_benchmark ? (
                  <>
                    <p>{research.crack_benchmark.split}</p>
                    <div className="benchmark-values">
                      <div>
                        <strong>
                          {research.crack_benchmark.train_count} /{" "}
                          {research.crack_benchmark.test_count}
                        </strong>
                        <span>Train / test images</span>
                      </div>
                      <div>
                        <strong>
                          {(
                            research.crack_benchmark.balanced_accuracy * 100
                          ).toFixed(1)}
                          %
                        </strong>
                        <span>Held-out balanced accuracy</span>
                      </div>
                      <div>
                        <strong>
                          {research.crack_benchmark.roc_auc.toFixed(3)}
                        </strong>
                        <span>Held-out ROC-AUC</span>
                      </div>
                    </div>
                    <p className="helper">
                      This small transfer baseline is not sufficiently validated
                      for warning generation. Its output is excluded from the
                      block index.
                    </p>
                    {research.crack_benchmark.limitations.map((l) => (
                      <p className="research-limitation" key={l}>
                        {l}
                      </p>
                    ))}
                  </>
                ) : (
                  <p className="helper">
                    Run scripts/train_crack_classifier.py to produce benchmark
                    artifacts.
                  </p>
                )}
              </section>
              <section className="panel methodology">
                <div className="panel-heading">
                  <div>
                    <FileText size={19} />
                    <h2>From paper to implementation</h2>
                  </div>
                </div>
                <p>
                  The supplied HyGEWS conference paper informs the image →
                  feature → XGBoost + SMR → explanation → block warning
                  workflow. The primary dashboard uses React and FastAPI; the
                  older Streamlit prototype remains in the repository.
                </p>
                <p>
                  The paper’s 70/30 fusion is retained as a research comparison.
                  The warning index has explicit image, SMR, rainfall, seepage
                  and vibration contributions, with a conservative FoS screening
                  floor. TreeSHAP explains the classifier only.
                </p>
                <p>
                  FoS uses resisting force / driving force. Photograph pixels do
                  not establish joint spacing, physical crack width or 3D
                  displacement. Historical demonstrations from the paper are not
                  treated as measured records.
                </p>
                <p>
                  For validation: collect timestamped mine imagery, surveyed
                  block polygons, joint measurements, rain-gauge and movement
                  time series, and engineer-reviewed event/non-event windows.
                  Separate training and evaluation by mine and time before
                  calibrating probabilities or adopting warning thresholds.
                </p>
              </section>
            </div>
          )}
          {page === "3D view" && (
            <Suspense
              fallback={
                <p className="loading">Loading real terrain workspace…</p>
              }
            >
              <TerrainWorkspace
                key={`${params.latitude},${params.longitude}`}
                assessment={result}
                siteLatitude={params.latitude}
                siteLongitude={params.longitude}
                onSite={(name, latitude, longitude) =>
                  setParams((old) => ({
                    ...old,
                    site_name: name,
                    latitude,
                    longitude,
                    bounds: null,
                    orthorectified: false,
                  }))
                }
              />
            </Suspense>
          )}
          <footer>
            <span>GeoGuard · HyGEWS research implementation</span>
            <span>
              Traceable inputs. Explicit uncertainty. Site review required.
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
