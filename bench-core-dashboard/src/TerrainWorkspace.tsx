import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Box,
  Check,
  ChevronDown,
  Globe2,
  Info,
  Layers3,
  MapPin,
  Mountain,
  MousePointer2,
  RotateCcw,
  Ruler,
  Upload,
} from "lucide-react";
import type { Assessment } from "./assessmentTypes";
import type {
  TerrainDataset,
  TerrainMeasurement,
  TerrainMode,
  TerrainTool,
  TerrainView,
} from "./terrainTypes";
import "./terrain.css";
const Viewer = lazy(() => import("./RealTerrainViewer"));

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetch(url, options);
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(
      typeof d.detail === "string" ? d.detail : `Request failed (${r.status})`,
    );
  }
  return r.json();
}
const number = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 1 });

export default function TerrainWorkspace({
  assessment,
  siteLatitude,
  siteLongitude,
  onSite,
}: {
  assessment: Assessment | null;
  siteLatitude: number;
  siteLongitude: number;
  onSite: (name: string, latitude: number, longitude: number) => void;
}) {
  const [datasets, setDatasets] = useState<TerrainDataset[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<TerrainMode>("survey");
  const [tool, setTool] = useState<TerrainTool>("orbit");
  const [wireframe, setWireframe] = useState(false);
  const [pointSize, setPointSize] = useState(2);
  const [view, setView] = useState<TerrainView>("oblique");
  const [resetKey, setResetKey] = useState(0);
  const [measurement, setMeasurement] = useState<TerrainMeasurement>({
    points: [],
  });
  const [latitude, setLatitude] = useState(siteLatitude);
  const [longitude, setLongitude] = useState(siteLongitude);
  const [width, setWidth] = useState(4000);
  const [provider, setProvider] = useState("global");
  const [surveyName, setSurveyName] = useState("My mine survey");
  const [units, setUnits] = useState("m");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    request<{ datasets: TerrainDataset[] }>("/api/terrain", {
      signal: controller.signal,
    })
      .then((data) => {
        setDatasets(data.datasets);
        setSelected(
          data.datasets.find(
            (d) =>
              d.bounds &&
              Math.abs((d.bounds.north + d.bounds.south) / 2 - siteLatitude) <
                0.1 &&
              Math.abs((d.bounds.east + d.bounds.west) / 2 - siteLongitude) <
                0.1,
          )?.id ??
            data.datasets.find((d) => d.id === "bingham-usgs")?.id ??
            data.datasets[0]?.id ??
            "",
        );
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);
  const terrain = datasets.find((d) => d.id === selected);
  function choose(id: string) {
    setSelected(id);
    setMode("survey");
    setMeasurement({ points: [] });
    setResetKey((v) => v + 1);
    setTool("orbit");
    setWireframe(false);
  }
  function add(data: TerrainDataset) {
    setDatasets((old) => [data, ...old.filter((d) => d.id !== data.id)]);
    choose(data.id);
  }
  async function importSurvey(file: File) {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("name", surveyName);
      body.append("units", units);
      add(
        await request<TerrainDataset>("/api/terrain/import", {
          method: "POST",
          body,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function publicTerrain(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      add(
        await request<TerrainDataset>("/api/terrain/public", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude,
            longitude,
            width_m: width,
            provider,
            name: `${provider === "usgs" ? "USGS" : "Global"} terrain · ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
          }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="terrain-workspace">
      <section className="panel terrain-main-panel">
        <div className="terrain-title">
          <div>
            <span className="terrain-live-mark">
              <Check size={11} />
            </span>
            <div>
              <h2>Real mine terrain</h2>
              <p>Survey geometry · measured XYZ · no generated relief</p>
            </div>
          </div>
          <span className="terrain-data-tag">REAL DATA</span>
        </div>
        <div className="terrain-dataset-select">
          <label>
            <span>Survey / elevation source</span>
            <select
              aria-label="Terrain dataset"
              value={selected}
              onChange={(e) => choose(e.target.value)}
              disabled={busy || loading}
            >
              {datasets.map((d) => (
                <option value={d.id} key={d.id}>
                  {d.name}
                </option>
              ))}
              {!datasets.length && <option>No prepared surveys</option>}
            </select>
          </label>
          <div className="terrain-kind">
            {terrain?.kind === "pointcloud" ? (
              <>
                <Box size={15} />
                UAV point cloud
              </>
            ) : (
              <>
                <Mountain size={15} />
                Elevation surface
              </>
            )}
          </div>
        </div>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        {terrain ? (
          <>
            {terrain.bounds && (
              <div className="terrain-site-action">
                <span>
                  Survey location:{" "}
                  {((terrain.bounds.north + terrain.bounds.south) / 2).toFixed(
                    4,
                  )}
                  °,{" "}
                  {((terrain.bounds.east + terrain.bounds.west) / 2).toFixed(4)}
                  °
                </span>
                <button
                  className="button secondary"
                  onClick={() =>
                    onSite(
                      terrain.name,
                      (terrain.bounds!.north + terrain.bounds!.south) / 2,
                      (terrain.bounds!.east + terrain.bounds!.west) / 2,
                    )
                  }
                >
                  Use this mine for weather & assessment
                </button>
              </div>
            )}
            <div className="terrain-toolbar">
              <div
                className="terrain-mode-switch"
                role="group"
                aria-label="Terrain display mode"
              >
                {(["survey", "elevation", "slope"] as const).map((m) => (
                  <button
                    key={m}
                    disabled={m === "slope" && !terrain.assets.slope}
                    className={mode === m ? "active" : ""}
                    onClick={() => setMode(m)}
                  >
                    {m === "survey"
                      ? terrain.assets.texture
                        ? "Orthoimagery"
                        : terrain.assets.colors
                          ? "Survey RGB"
                          : "Natural relief"
                      : m === "elevation"
                        ? "Elevation"
                        : "Slope angle"}
                  </button>
                ))}
              </div>
              <div
                className="terrain-tools"
                role="group"
                aria-label="Terrain tools"
              >
                {(
                  [
                    { id: "orbit", label: "Orbit", icon: MousePointer2 },
                    { id: "inspect", label: "Inspect", icon: MapPin },
                    { id: "measure", label: "Measure", icon: Ruler },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    aria-label={t.label + " terrain"}
                    title={t.label}
                    className={tool === t.id ? "active" : ""}
                    onClick={() => {
                      setTool(t.id);
                      setMeasurement({ points: [] });
                      setResetKey((v) => v + 1);
                    }}
                  >
                    <t.icon size={16} />
                    <span>{t.label}</span>
                  </button>
                ))}
                <button
                  title="Reset terrain view"
                  aria-label="Reset terrain view"
                  onClick={() => setResetKey((v) => v + 1)}
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>
            <Suspense
              fallback={<p className="loading">Loading survey viewer…</p>}
            >
              <Viewer
                terrain={terrain}
                mode={mode}
                tool={tool}
                wireframe={wireframe}
                pointSize={pointSize}
                view={view}
                resetKey={resetKey}
                onMeasure={setMeasurement}
              />
            </Suspense>
            <div className="terrain-underbar">
              <span>
                Drag for 360° orbit · right-drag to pan · scroll to zoom
              </span>
              <div>
                <label>
                  View
                  <select
                    aria-label="Terrain camera view"
                    value={view}
                    onChange={(e) => setView(e.target.value as typeof view)}
                  >
                    <option value="oblique">Oblique</option>
                    <option value="top">Top down</option>
                    <option value="front">Front</option>
                    <option value="back">Back</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                    <option value="bottom">Underneath</option>
                  </select>
                </label>
                {terrain.kind === "surface" ? (
                  <label>
                    <input
                      type="checkbox"
                      checked={wireframe}
                      onChange={(e) => setWireframe(e.target.checked)}
                    />
                    Wireframe
                  </label>
                ) : (
                  <label>
                    Point size
                    <input
                      aria-label="Point size"
                      type="range"
                      min={1}
                      max={5}
                      step={0.5}
                      value={pointSize}
                      onChange={(e) => setPointSize(Number(e.target.value))}
                    />
                  </label>
                )}
              </div>
            </div>
            <div className="terrain-stat-strip">
              <div>
                <span>
                  {terrain.kind === "surface"
                    ? "Mesh vertices"
                    : "Rendered source points"}
                </span>
                <strong>{number(terrain.point_count)}</strong>
              </div>
              <div>
                <span>Footprint</span>
                <strong>
                  {number(terrain.extent_m.width)} ×{" "}
                  {number(terrain.extent_m.depth)}
                  <small> m</small>
                </strong>
              </div>
              <div>
                <span>Measured relief</span>
                <strong>
                  {number(terrain.extent_m.relief)}
                  <small> m</small>
                </strong>
              </div>
              <div>
                <span>
                  {terrain.georeferenced ? "Elevation range" : "Local Z range"}
                </span>
                <strong>
                  {number(terrain.elevation_m.min)} –{" "}
                  {number(terrain.elevation_m.max)}
                  <small> m</small>
                </strong>
              </div>
            </div>
            {mode === "slope" && (
              <div className="terrain-gradient-legend">
                <span>Terrain gradient</span>
                <i />
                <span>0°</span>
                <span>65°+</span>
                <small>Geometry only · not failure probability</small>
              </div>
            )}
            {tool !== "orbit" && (
              <div className="terrain-measurement">
                <Ruler size={19} />
                <div>
                  <h3>
                    {tool === "measure"
                      ? "Measure between source points"
                      : "Inspect the measured surface"}
                  </h3>
                  {measurement.points.length ? (
                    <>
                      <div className="coordinate-readings">
                        {measurement.points.map((p, i) => (
                          <p key={i}>
                            P{i + 1} · {terrain.georeferenced ? "E" : "X"}{" "}
                            {p.x.toFixed(2)} ·{" "}
                            {terrain.georeferenced ? "N" : "Y"} {p.y.toFixed(2)}{" "}
                            · Z {p.z.toFixed(2)} m
                            {p.slope !== undefined &&
                              ` · local gradient ${p.slope.toFixed(1)}°`}
                          </p>
                        ))}
                      </div>
                      {measurement.distance !== undefined ? (
                        <p className="distance-reading">
                          3D distance{" "}
                          <strong>{measurement.distance.toFixed(2)} m</strong> ·
                          horizontal {measurement.horizontal?.toFixed(2)} m ·
                          inclination {measurement.inclination?.toFixed(1)}°
                        </p>
                      ) : (
                        tool === "measure" && (
                          <p>Select a second point on the visible geometry.</p>
                        )
                      )}
                    </>
                  ) : (
                    <p>
                      {tool === "measure"
                        ? "Select two points on the surface. Distances use the source coordinate scale."
                        : "Click a point to read its source coordinates and elevation."}
                    </p>
                  )}
                  <p className="terrain-precision-note">
                    Displayed decimals are numerical precision, not survey
                    accuracy. Measurements depend on source sampling and datum;
                    3D distance is a straight chord.
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="empty">
            <Mountain size={40} />
            <h3>
              {loading ? "Loading survey catalog…" : "Load a real mine survey"}
            </h3>
            <p>
              Import a GeoTIFF DEM or PLY point cloud, or fetch a public
              elevation surface using the controls below.
            </p>
          </div>
        )}
      </section>
      <aside className="terrain-side-panels">
        {terrain && (
          <section className="panel terrain-provenance">
            <div className="panel-heading">
              <div>
                <Info size={18} />
                <h2>Survey provenance</h2>
              </div>
            </div>
            <div className="terrain-source-body">
              <h3>{terrain.name}</h3>
              <p>{terrain.source}</p>
              <dl>
                <div>
                  <dt>Acquired</dt>
                  <dd>{terrain.acquisition_date ?? "Varies / not verified"}</dd>
                </div>
                <div>
                  <dt>Coordinate reference</dt>
                  <dd>{terrain.crs ?? "Local XYZ · CRS unverified"}</dd>
                </div>
                <div>
                  <dt>Display sampling</dt>
                  <dd>
                    {terrain.grid
                      ? `${terrain.grid.spacing_x_m.toFixed(2)} × ${terrain.grid.spacing_y_m.toFixed(2)} m`
                      : "Original measured points"}
                  </dd>
                </div>
                <div>
                  <dt>Source samples</dt>
                  <dd>
                    {number(terrain.source_point_count ?? terrain.point_count)}
                  </dd>
                </div>
              </dl>
              <p className="helper">{terrain.source_resolution_note}</p>
              <p className="helper">{terrain.vertical_datum}</p>
              {terrain.source_url && (
                <a
                  className="terrain-source-link"
                  href={terrain.source_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  View original data source ↗
                </a>
              )}
              <p className="helper">{terrain.license}</p>
              <a
                className="button secondary"
                href={`/api/terrain/${terrain.id}/source`}
                download
              >
                <ArrowDownToLine size={14} />
                {terrain.kind === "surface"
                  ? "Elevation source GeoTIFF"
                  : "Original survey PLY"}
              </a>
              <a
                className="terrain-metadata-link"
                href={`/api/terrain/${terrain.id}`}
                target="_blank"
                rel="noreferrer"
              >
                Full metadata & geometry endpoints ↗
              </a>
            </div>
          </section>
        )}
        <section className="panel terrain-import">
          <div className="panel-heading">
            <div>
              <Upload size={18} />
              <h2>Your mine survey</h2>
            </div>
          </div>
          <div className="terrain-source-body">
            <p>
              Load measured geometry from your own drone, LiDAR or surveying
              workflow.
            </p>
            <label className="field">
              <span>Survey name</span>
              <input
                maxLength={120}
                value={surveyName}
                onChange={(e) => setSurveyName(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Source elevation / XYZ units</span>
              <select value={units} onChange={(e) => setUnits(e.target.value)}>
                <option value="m">Metres</option>
                <option value="ft">Feet · convert to metres</option>
              </select>
            </label>
            <input
              ref={input}
              type="file"
              accept=".tif,.tiff,.ply"
              className="hidden-file"
              aria-label="Upload measured terrain survey"
              onChange={(e) => {
                if (e.target.files?.[0]) void importSurvey(e.target.files[0]);
              }}
            />
            <button
              className="button primary"
              disabled={busy || !surveyName.trim()}
              onClick={() => input.current?.click()}
            >
              <Upload size={15} />
              {busy ? "Preparing survey…" : "Import GeoTIFF / PLY"}
            </button>
            <p className="helper">
              Up to 256 MB. DEMs require an embedded CRS. PLY expects Z-up XYZ
              and optional RGB. Physical scale comes from the supplied units.
            </p>
          </div>
        </section>
        <section className="panel terrain-public">
          <div className="panel-heading">
            <div>
              <Globe2 size={18} />
              <h2>Public elevation</h2>
            </div>
          </div>
          <form className="terrain-source-body" onSubmit={publicTerrain}>
            <p>
              Fetch actual elevation data for a different site. Public terrain
              can be older and coarser than an operational mine survey.
            </p>
            <div className="field-pair">
              <label className="field">
                <span>Latitude</span>
                <input
                  type="number"
                  required
                  min={-75}
                  max={75}
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(Number(e.target.value))}
                />
              </label>
              <label className="field">
                <span>Longitude</span>
                <input
                  type="number"
                  required
                  min={-179.8}
                  max={179.8}
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(Number(e.target.value))}
                />
              </label>
            </div>
            <label className="field">
              <span>Area width (metres)</span>
              <input
                type="number"
                required
                min={200}
                max={8000}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span>Provider</span>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              >
                <option value="global">
                  Mapzen / source DEMs · global context
                </option>
                <option value="usgs">USGS 3DEP · United States</option>
              </select>
            </label>
            <button className="button secondary" disabled={busy} type="submit">
              <Globe2 size={15} />
              {busy ? "Retrieving terrain…" : "Load real elevation"}
            </button>
          </form>
        </section>
      </aside>
      {terrain && (
        <section className="panel terrain-notes">
          <div className="panel-heading">
            <div>
              <Layers3 size={18} />
              <h2>Interpret this surface</h2>
            </div>
          </div>
          <div>
            {terrain.limitations.map((note) => (
              <p key={note}>{note}</p>
            ))}
            {terrain.imagery && (
              <p>
                {terrain.imagery.attribution}. {terrain.imagery.epoch}.{" "}
                {terrain.imagery.note}.
              </p>
            )}
            <p>
              Photo-based crack assessment and this survey are separate
              datasets. Image-block warning colours are not projected onto
              unrelated terrain. A shared coordinate system and verified
              camera/surface registration are needed before associating a crack
              with a 3D location.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
