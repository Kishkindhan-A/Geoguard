import { useState, useEffect, useRef, useCallback } from "react";

// ── Design tokens ───────────────────────────────────────────────────────────
const C = {
  bg: "#090A0F",
  surface: "#0D0F17",
  card: "rgba(18,20,29,0.88)",
  border: "#232738",
  borderLight: "rgba(35,39,56,0.6)",
  crimson: "#EF4444",
  emerald: "#10B981",
  amber: "#F59E0B",
  indigo: "#6366F1",
  violet: "#8B5CF6",
  text: "#E2E8F0",
  dim: "#94A3B8",
  muted: "#64748B",
  accent: "#818CF8",
};

const FONT = "Inter, system-ui, sans-serif";
const MONO = "'JetBrains Mono', 'Courier New', monospace";

const glass: React.CSSProperties = {
  background: C.card,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: `1px solid ${C.border}`,
  borderRadius: "12px",
};

// ── Geotechnical utilities ──────────────────────────────────────────────────
function computeFoS(ru: number, rain: number, tilt: number, rmr: number, slope: number): number {
  const base = 1.0 + ((rmr - 20) / 80) * 1.6;
  const stress =
    ru * 0.55 +
    (rain / 100) * 0.42 +
    (Math.max(0, tilt - 5) / 25) * 0.32 +
    (Math.max(0, slope - 25) / 60) * 0.22;
  return Math.max(0.31, parseFloat((base - stress).toFixed(2)));
}

function computeSMR(rmr: number, slope: number, tilt: number): number {
  const F1 = Math.max(0.15, 1 - 0.0065 * slope * slope / 10);
  const F2 = Math.max(0.15, 1 - tilt / 50);
  const F3 = slope > 45 ? -25 : slope > 35 ? -12 : -6;
  return Math.max(0, Math.min(100, Math.round(rmr + F1 * F2 * F3 + 15)));
}

function computeJv(rmr: number, tilt: number): number {
  return Math.max(1, Math.round((100 - rmr) / 7.5 + tilt / 2.8));
}

type RiskInfo = { label: string; color: string; bg: string; border: string };
function getRisk(fos: number): RiskInfo {
  if (fos < 1.0) return { label: "CRITICAL", color: C.crimson, bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.4)" };
  if (fos < 1.25) return { label: "HIGH RISK", color: "#F97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.4)" };
  if (fos < 1.5) return { label: "WARNING", color: C.amber, bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.4)" };
  if (fos < 2.0) return { label: "MODERATE", color: "#38BDF8", bg: "rgba(56,189,248,0.12)", border: "rgba(56,189,248,0.4)" };
  return { label: "SAFE", color: C.emerald, bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.4)" };
}

const HM_STYLE = [
  { bg: "rgba(16,185,129,0.18)", text: "#10B981", border: "rgba(16,185,129,0.25)", label: "Safe" },
  { bg: "rgba(52,211,153,0.14)", text: "#34D399", border: "rgba(52,211,153,0.2)", label: "Low" },
  { bg: "rgba(245,158,11,0.18)", text: "#F59E0B", border: "rgba(245,158,11,0.25)", label: "Med" },
  { bg: "rgba(249,115,22,0.22)", text: "#F97316", border: "rgba(249,115,22,0.35)", label: "High" },
  { bg: "rgba(239,68,68,0.22)", text: "#EF4444", border: "rgba(239,68,68,0.45)", label: "Crit" },
];
const SECTOR_COL = ["A", "B", "C", "D", "E"];

function buildHeatmap(ru: number, rain: number, tilt: number, rmr: number, slope: number): number[][] {
  const risk = ru * 0.38 + (rain / 100) * 0.28 + (tilt / 30) * 0.2 + (slope / 80) * 0.14;
  const safe = (rmr / 100) * 2.2;
  const net = (risk - safe + 1.1) * 1.8;
  const base = [
    [0, 0, 1, 1, 2],
    [0, 1, 1, 2, 3],
    [1, 1, 2, 3, 3],
    [1, 2, 3, 3, 4],
    [2, 3, 3, 4, 4],
  ];
  return base.map((row) => row.map((v) => Math.min(4, Math.max(0, Math.round(v + net - 2)))));
}

// ── Chat data ───────────────────────────────────────────────────────────────
type Message = { role: "ai" | "user"; content: string; time: string };

const INIT_MSGS: Message[] = [
  { role: "ai", content: "GeoGuard AI system online. Critical alert detected — Factor of Safety is below threshold (FoS < 1.00). Recommend immediate evacuation of high-risk sectors.", time: "14:22:05" },
  { role: "user", content: "What are the primary risk drivers right now?", time: "14:23:18" },
  { role: "ai", content: "Top SHAP contributors: (1) Elevated piezometric pressure ru=0.65, accounting for 38% of instability. (2) Active rainfall at 35 mm/hr increasing pore-water pressure. (3) Tilt angle exceeding safe threshold at 18°. Recommend halting all bench operations and activating dewatering protocol immediately.", time: "14:23:21" },
];

const QUICK = ["Evacuation protocol?", "Dewatering options", "Alert geo team", "Monte Carlo simulation"];

function getAIReply(msg: string): string {
  const l = msg.toLowerCase();
  if (l.includes("evacuat")) return "⚠️ EVACUATION PROTOCOL: All personnel must clear Sectors D4, D5, E4, E5 immediately. Establish a 200 m exclusion zone. Contact site supervisor (ext. 4401) and geotechnical engineer. Emergency services on standby — call 000.";
  if (l.includes("dewat")) return "Dewatering recommendation: Install 3× Cat WP150 submersible pumps at piezometer nodes P-07, P-12, P-19. Target reduction of piezometric head to ru < 0.35 within 48 hours. Monitor with hourly telemetry readings.";
  if (l.includes("alert") || l.includes("team")) return "Alert dispatched. Emergency SMS sent to Dr. K. Nair (Geotechnical Lead) and Site Manager J. Chen. 3 engineers notified. ETA on-site: 22 minutes. Incident report ID: GG-2026-0820-047.";
  if (l.includes("monte") || l.includes("simulat") || l.includes("fos")) return "Monte Carlo FoS simulation (n = 10,000 runs) complete:\n• Mean FoS: 0.87 | σ = 0.11\n• P(failure): 71.4%\n• 95th percentile: 0.64\nConclusion: SLOPE FAILURE IS PROBABLE. Immediate remediation required.";
  return "Analyzing current telemetry... All SHAP drivers have been updated. The dominant instability factor remains elevated pore-water pressure. Recommend reviewing the SHAP attribution panel for a full breakdown of contributing variables.";
}

function nowUTC(): string {
  const d = new Date();
  return [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

// ── Main component ──────────────────────────────────────────────────────────
export default function App() {
  // Sensor state — start critical
  const [ru, setRu] = useState(0.65);
  const [rain, setRain] = useState(35);
  const [tilt, setTilt] = useState(18);
  const [rmr, setRmr] = useState(40);
  const [slope, setSlope] = useState(55);

  // UI state
  const [activeTab, setActiveTab] = useState<"raw" | "opencv">("raw");
  const [msgs, setMsgs] = useState<Message[]>(INIT_MSGS);
  const [chatInput, setChatInput] = useState("");
  const [utcTime, setUtcTime] = useState(nowUTC());
  const [uploadedImg, setUploadedImg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // UTC clock
  useEffect(() => {
    const id = setInterval(() => setUtcTime(nowUTC()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [msgs]);

  // Derived metrics
  const fos = computeFoS(ru, rain, tilt, rmr, slope);
  const isCritical = fos < 1.0;
  const risk = getRisk(fos);
  const smr = computeSMR(rmr, slope, tilt);
  const jv = computeJv(rmr, tilt);
  const heatmap = buildHeatmap(ru, rain, tilt, rmr, slope);

  // SHAP data (dynamic)
  const shapData = [
    { label: "Piezometer (ru)", val: ru * 0.62, isRisk: true },
    { label: "Rainfall intensity", val: (rain / 100) * 0.48, isRisk: true },
    { label: "Tilt angle (°)", val: (Math.max(0, tilt - 5) / 25) * 0.38, isRisk: true },
    { label: "Slope angle (°)", val: (Math.max(0, slope - 30) / 55) * 0.32, isRisk: true },
    { label: "Joint set orientation", val: 0.19, isRisk: true },
    { label: "RMR score", val: (rmr / 100) * 0.58, isRisk: false },
    { label: "Rock mass cohesion", val: 0.34, isRisk: false },
    { label: "Drainage condition", val: 0.26, isRisk: false },
    { label: "Internal friction φ", val: 0.22, isRisk: false },
    { label: "Rock unit weight", val: 0.16, isRisk: false },
  ];
  const maxShap = Math.max(...shapData.map((d) => d.val));

  const sendMessage = useCallback((text?: string) => {
    const content = (text ?? chatInput).trim();
    if (!content) return;
    const t = nowUTC();
    setMsgs((prev) => [
      ...prev,
      { role: "user", content, time: t },
      { role: "ai", content: getAIReply(content), time: t },
    ]);
    setChatInput("");
  }, [chatInput]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) setUploadedImg(URL.createObjectURL(file));
  }

  const pitImg = uploadedImg
    || "https://images.unsplash.com/photo-1626710354066-737ccf2ceba5?w=800&h=500&fit=crop&auto=format";

  return (
    <div style={{ background: C.bg, minHeight: "100vh", width: "100%", fontFamily: FONT, color: C.text, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Critical alert banner ─────────────────────────────────────────── */}
      {isCritical && (
        <div
          className="critical-banner"
          style={{
            background: "linear-gradient(90deg, rgba(239,68,68,0.08), rgba(239,68,68,0.15), rgba(239,68,68,0.08))",
            borderBottom: `1px solid ${C.crimson}`,
            padding: "9px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            flexShrink: 0,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "16px" }}>🚨</span>
            <span style={{ fontFamily: MONO, fontSize: "0.72rem", fontWeight: 700, color: C.crimson, letterSpacing: "0.08em" }}>
              CRITICAL RISK: IMMEDIATE BENCH EVACUATION REQUIRED
            </span>
            <span style={{ fontFamily: MONO, fontSize: "0.68rem", color: "rgba(239,68,68,0.7)", letterSpacing: "0.05em" }}>
              — FoS = {fos.toFixed(2)} — SECTORS D4 · D5 · E4 · E5 — ALL PERSONNEL CLEAR NOW
            </span>
            <span style={{ fontSize: "16px" }}>🚨</span>
          </div>
          {/* Scan line effect */}
          <div
            className="scan-line"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "100%",
              background: "linear-gradient(to bottom, transparent, rgba(239,68,68,0.06), transparent)",
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {/* ── Top navbar ────────────────────────────────────────────────────── */}
      <nav style={{ ...glass, borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none", padding: "0 20px", height: "54px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, zIndex: 50 }}>
        {/* Logo + title */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: `linear-gradient(135deg, ${C.indigo} 0%, ${C.violet} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 18px rgba(99,102,241,0.55)`, flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 20L12 4L21 20H3Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" fill="rgba(255,255,255,0.15)" />
              <path d="M7 20L12 10L17 20" stroke="white" strokeWidth="1" strokeLinejoin="round" opacity="0.6" />
              <circle cx="12" cy="4" r="1.5" fill="white" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.92rem", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              GeoGuard <span style={{ color: C.indigo }}>AI</span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: "0.52rem", color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Slope Stability Monitoring System
            </div>
          </div>
        </div>

        {/* Center nav */}
        <div style={{ display: "flex", gap: "2px" }}>
          {["Dashboard", "3D Model", "Alerts", "History", "Reports"].map((item, i) => (
            <button key={item} style={{
              background: i === 0 ? "rgba(99,102,241,0.12)" : "transparent",
              border: `1px solid ${i === 0 ? "rgba(99,102,241,0.3)" : "transparent"}`,
              color: i === 0 ? C.accent : C.muted,
              padding: "5px 14px",
              borderRadius: "7px",
              fontSize: "0.76rem",
              fontWeight: i === 0 ? 600 : 400,
              cursor: "pointer",
              fontFamily: FONT,
              transition: "all 0.2s",
            }}>
              {item}
            </button>
          ))}
        </div>

        {/* Right: clock + status + avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: MONO, fontSize: "0.72rem", color: C.dim }}>{utcTime} UTC</div>
            <div style={{ fontFamily: MONO, fontSize: "0.52rem", color: C.muted }}>2026-08-20</div>
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.3)",
            borderRadius: "20px",
            padding: "5px 12px",
            boxShadow: "0 0 14px rgba(16,185,129,0.15)",
          }}>
            <span className="live-dot" style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.emerald, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontFamily: MONO, fontSize: "0.6rem", color: C.emerald, fontWeight: 600, letterSpacing: "0.07em", whiteSpace: "nowrap" }}>
              TELEMETRY STREAM ACTIVE
            </span>
          </div>
          {isCritical && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.4)",
              borderRadius: "20px",
              padding: "5px 10px",
            }}>
              <span className="live-dot" style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.crimson, display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontFamily: MONO, fontSize: "0.6rem", color: C.crimson, fontWeight: 600, letterSpacing: "0.07em" }}>CRITICAL</span>
            </div>
          )}
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg, #4338CA, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", cursor: "pointer", flexShrink: 0 }}>
            👷
          </div>
        </div>
      </nav>

      {/* ── Body: sidebar + main ─────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Left Sidebar ────────────────────────────────────────────────── */}
        <aside
          className="sidebar-scroll"
          style={{
            width: "260px",
            minWidth: "260px",
            borderRight: `1px solid ${C.border}`,
            background: "rgba(9,10,15,0.7)",
            overflowY: "auto",
            padding: "14px 13px",
            display: "flex",
            flexDirection: "column",
            gap: "0",
            flexShrink: 0,
          }}
        >
          {/* Image uploader */}
          <SectionLabel>Optical Image Input</SectionLabel>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `1.5px dashed ${dragOver ? C.indigo : C.border}`,
              borderRadius: "8px",
              padding: "14px 10px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              background: dragOver ? "rgba(99,102,241,0.06)" : "rgba(15,17,26,0.5)",
              cursor: "pointer",
              transition: "all 0.2s",
              marginBottom: "18px",
              minHeight: "88px",
            }}
          >
            {uploadedImg ? (
              <>
                <img src={uploadedImg} alt="Uploaded" style={{ width: "100%", height: "56px", objectFit: "cover", borderRadius: "4px" }} />
                <span style={{ fontSize: "0.62rem", color: C.emerald, fontFamily: MONO }}>✓ Image loaded</span>
              </>
            ) : (
              <>
                <div style={{ fontSize: "22px", opacity: 0.7 }}>📷</div>
                <div style={{ fontSize: "0.68rem", color: C.dim, textAlign: "center", lineHeight: 1.4 }}>
                  Drop pit wall image or click to upload
                </div>
                <div style={{ fontFamily: MONO, fontSize: "0.55rem", color: C.muted }}>PNG · JPG · TIF · GeoTIFF</div>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setUploadedImg(URL.createObjectURL(f)); }} />
          </div>

          {/* IoT Telemetry */}
          <SectionLabel>IoT Telemetry</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
            <SliderInput label="Piezometer (ru)" value={ru} min={0} max={1} step={0.01}
              onChange={setRu} unit="" decimals={2}
              color={ru > 0.55 ? C.crimson : ru > 0.35 ? C.amber : C.emerald} />
            <SliderInput label="Rainfall (mm/hr)" value={rain} min={0} max={100} step={1}
              onChange={setRain} unit=" mm/hr" decimals={0}
              color={rain > 40 ? C.crimson : rain > 20 ? C.amber : C.indigo} />
            <SliderInput label="Tilt Angle (°)" value={tilt} min={0} max={30} step={0.5}
              onChange={setTilt} unit="°" decimals={1}
              color={tilt > 15 ? C.crimson : tilt > 8 ? C.amber : C.indigo} />
          </div>

          {/* Geotechnical parameters */}
          <SectionLabel>Geotechnical Parameters</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
            <SliderInput label="Basic RMR" value={rmr} min={0} max={100} step={1}
              onChange={setRmr} unit="" decimals={0}
              color={rmr < 30 ? C.crimson : rmr < 50 ? C.amber : C.emerald} />
            <SliderInput label="Slope Angle (°)" value={slope} min={20} max={80} step={1}
              onChange={setSlope} unit="°" decimals={0}
              color={slope > 55 ? C.crimson : slope > 40 ? C.amber : C.indigo} />
          </div>

          {/* Sensor network status */}
          <SectionLabel>Sensor Network</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "16px" }}>
            {[
              { id: "P-07", name: "Piezometer P-07", ok: true },
              { id: "P-12", name: "Piezometer P-12", ok: true },
              { id: "P-19", name: "Piezometer P-19", ok: true },
              { id: "T-03", name: "Tiltmeter T-03", ok: false },
              { id: "RG-01", name: "Rain Gauge RG-01", ok: true },
              { id: "G-02", name: "GNSS Station G-02", ok: true },
              { id: "AC-04", name: "Accelerometer AC-04", ok: false },
            ].map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <span className={s.ok ? "live-dot" : undefined}
                    style={{ width: "6px", height: "6px", borderRadius: "50%", background: s.ok ? C.emerald : C.amber, display: "inline-block", flexShrink: 0, opacity: s.ok ? 1 : 0.7 }} />
                  <span style={{ fontSize: "0.68rem", color: C.dim }}>{s.name}</span>
                </div>
                <span style={{
                  fontFamily: MONO, fontSize: "0.56rem",
                  color: s.ok ? C.emerald : C.amber,
                  background: s.ok ? "rgba(16,185,129,0.08)" : "rgba(245,158,11,0.08)",
                  border: `1px solid ${s.ok ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)"}`,
                  padding: "1px 6px", borderRadius: "4px",
                }}>
                  {s.ok ? "ONLINE" : "FAULT"}
                </span>
              </div>
            ))}
          </div>

          {/* Mini legend */}
          <SectionLabel>FoS Classification</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {[
              { range: "≥ 2.00", label: "Safe", color: C.emerald },
              { range: "1.50–2.00", label: "Moderate", color: "#38BDF8" },
              { range: "1.25–1.50", label: "Warning", color: C.amber },
              { range: "1.00–1.25", label: "High Risk", color: "#F97316" },
              { range: "< 1.00", label: "Critical", color: C.crimson },
            ].map((r) => (
              <div key={r.range} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: r.color, flexShrink: 0 }} />
                  <span style={{ fontSize: "0.65rem", color: C.dim }}>{r.label}</span>
                </div>
                <span style={{ fontFamily: MONO, fontSize: "0.58rem", color: C.muted }}>{r.range}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <main style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>

          {/* ── Row 1: KPI cards ──────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>

            {/* FoS */}
            <KPICard
              label="Factor of Safety"
              sublabel="FoS — Limit Equilibrium"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke={C.indigo} strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M2 17L12 22L22 17" stroke={C.indigo} strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M2 12L12 17L22 12" stroke={C.indigo} strokeWidth="1.5" strokeLinejoin="round" opacity="0.5" />
                </svg>
              }
              accentColor={isCritical ? C.crimson : fos < 1.5 ? C.amber : C.emerald}
              isCritical={isCritical}
            >
              <div style={{ fontFamily: MONO, fontSize: "2.6rem", fontWeight: 700, lineHeight: 1, color: isCritical ? C.crimson : fos < 1.5 ? C.amber : C.emerald, textShadow: isCritical ? `0 0 24px rgba(239,68,68,0.6)` : undefined, marginBottom: "6px" }}>
                {fos.toFixed(2)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ flex: 1, height: "3px", borderRadius: "2px", background: C.border, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (fos / 3.0) * 100)}%`, background: isCritical ? C.crimson : fos < 1.5 ? C.amber : C.emerald, borderRadius: "2px", transition: "width 0.5s" }} />
                </div>
                <span style={{ fontFamily: MONO, fontSize: "0.58rem", color: C.muted, whiteSpace: "nowrap" }}>min 1.5</span>
              </div>
            </KPICard>

            {/* Risk Status */}
            <KPICard
              label="Active Risk Status"
              sublabel="AI Classification · 94.2% conf."
              icon={<span style={{ fontSize: "18px" }}>⚠️</span>}
              accentColor={risk.color}
              isCritical={isCritical}
            >
              <div style={{ display: "inline-flex", alignItems: "center", gap: "7px", background: risk.bg, border: `1px solid ${risk.border}`, borderRadius: "8px", padding: "6px 12px", boxShadow: `0 0 16px ${risk.color}20`, marginBottom: "8px" }}>
                {isCritical && <span className="live-dot" style={{ width: "7px", height: "7px", borderRadius: "50%", background: C.crimson, flexShrink: 0 }} />}
                <span style={{ fontFamily: MONO, fontSize: "0.85rem", fontWeight: 700, color: risk.color, letterSpacing: "0.06em" }}>{risk.label}</span>
              </div>
              <div style={{ fontFamily: MONO, fontSize: "0.58rem", color: C.muted }}>
                Updated: {utcTime} UTC
              </div>
            </KPICard>

            {/* Jv */}
            <KPICard
              label="Joint Volumetric Count"
              sublabel="Jv — joints / m³"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="7" height="7" rx="1" stroke={C.indigo} strokeWidth="1.5" opacity="0.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1" stroke={C.indigo} strokeWidth="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1" stroke={C.indigo} strokeWidth="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1" stroke={C.indigo} strokeWidth="1.5" opacity="0.5" />
                </svg>
              }
              accentColor={C.indigo}
              isCritical={false}
            >
              <div style={{ fontFamily: MONO, fontSize: "2.6rem", fontWeight: 700, lineHeight: 1, color: C.indigo, marginBottom: "6px" }}>
                {jv}
              </div>
              <div style={{ fontFamily: MONO, fontSize: "0.62rem", color: jv > 20 ? C.amber : jv > 10 ? "#38BDF8" : C.emerald }}>
                {jv > 20 ? "Very Blocky" : jv > 10 ? "Blocky" : "Intact/Massive"}
              </div>
            </KPICard>

            {/* SMR */}
            <KPICard
              label="SMR Score"
              sublabel="Slope Mass Rating"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M2 20L8 8L14 14L18 6L22 10" stroke={C.indigo} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="8" cy="8" r="1.5" fill={C.indigo} />
                  <circle cx="14" cy="14" r="1.5" fill={C.amber} />
                  <circle cx="18" cy="6" r="1.5" fill={C.crimson} />
                </svg>
              }
              accentColor={smr < 40 ? C.crimson : smr < 60 ? C.amber : C.emerald}
              isCritical={smr < 40}
            >
              <div style={{ fontFamily: MONO, fontSize: "2.6rem", fontWeight: 700, lineHeight: 1, color: smr < 40 ? C.crimson : smr < 60 ? C.amber : C.emerald, marginBottom: "6px" }}>
                {smr}
              </div>
              <div style={{ fontFamily: MONO, fontSize: "0.62rem", color: smr < 40 ? C.crimson : smr < 60 ? C.amber : C.emerald }}>
                {smr < 20 ? "Completely Unstable" : smr < 40 ? "Unstable (Class V)" : smr < 60 ? "Partially Stable (IV)" : smr < 80 ? "Normal (Class III)" : "Stable (Class I–II)"}
              </div>
            </KPICard>
          </div>

          {/* ── Row 2: Optical analysis + Heatmap ─────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>

            {/* Optical analysis panel */}
            <div style={{ ...glass, padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>Optical Analysis — Pit Wall B-3</div>
                  <div style={{ fontFamily: MONO, fontSize: "0.56rem", color: C.muted, marginTop: "2px" }}>Camera Node C-07 · 1920×1080 · 30fps</div>
                </div>
                <div style={{ display: "flex", gap: "4px" }}>
                  {(["raw", "opencv"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      style={{
                        padding: "4px 11px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontFamily: MONO,
                        fontSize: "0.6rem",
                        fontWeight: 600,
                        letterSpacing: "0.05em",
                        transition: "all 0.2s",
                        background: activeTab === tab
                          ? tab === "opencv" ? "rgba(99,102,241,0.2)" : "rgba(35,39,56,0.8)"
                          : "transparent",
                        color: activeTab === tab
                          ? tab === "opencv" ? C.indigo : C.text
                          : C.muted,
                        border: `1px solid ${activeTab === tab ? (tab === "opencv" ? "rgba(99,102,241,0.45)" : C.border) : "transparent"}`,
                      }}
                    >
                      {tab === "raw" ? "RAW IMAGE" : "OPENCV ANALYSIS"}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ position: "relative", borderRadius: "8px", overflow: "hidden", height: "220px", background: "#0a0c14" }}>
                <img
                  src={pitImg}
                  alt="Pit wall"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    filter: activeTab === "opencv" ? "grayscale(0.85) contrast(1.9) brightness(0.55)" : "none",
                    transition: "filter 0.35s ease",
                  }}
                />
                {activeTab === "opencv" && (
                  <svg
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
                    viewBox="0 0 800 220" preserveAspectRatio="xMidYMid slice"
                  >
                    {/* Bench terrace lines */}
                    <polyline points="0,45 160,52 310,48 480,55 640,50 800,47" fill="none" stroke="#10B981" strokeWidth="1.4" opacity="0.85" strokeDasharray="none" />
                    <polyline points="0,90 140,98 300,95 460,105 620,100 800,96" fill="none" stroke="#10B981" strokeWidth="1.4" opacity="0.75" />
                    <polyline points="0,138 120,148 290,152 450,145 610,155 800,150" fill="none" stroke="#F59E0B" strokeWidth="2" opacity="0.9" />
                    <polyline points="0,182 110,192 270,196 440,185 600,195 800,190" fill="none" stroke="#EF4444" strokeWidth="2.2" opacity="0.95" />
                    {/* Fracture lines */}
                    <line x1="340" y1="50" x2="375" y2="220" stroke="#EF4444" strokeWidth="1.4" strokeDasharray="5 3" opacity="0.9" />
                    <line x1="490" y1="40" x2="518" y2="195" stroke="#F59E0B" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.8" />
                    <line x1="240" y1="90" x2="258" y2="210" stroke="#EF4444" strokeWidth="1" strokeDasharray="3 4" opacity="0.7" />
                    {/* Risk zone markers */}
                    <circle cx="355" cy="160" r="22" fill="none" stroke="#EF4444" strokeWidth="1.8" opacity="0.9" />
                    <circle cx="355" cy="160" r="10" fill="rgba(239,68,68,0.15)" stroke="#EF4444" strokeWidth="1" opacity="0.9" />
                    <circle cx="505" cy="130" r="16" fill="none" stroke="#F59E0B" strokeWidth="1.5" opacity="0.8" />
                    <text x="8" y="16" fill="#10B981" fontSize="10" fontFamily="monospace" opacity="0.95">OpenCV 4.9 · Canny Edge Detection · Hough Line Transform</text>
                    <text x="8" y="30" fill="#6366F1" fontSize="9" fontFamily="monospace" opacity="0.9">Crack density: HIGH · Structural defect: DETECTED · Confidence: 91.4%</text>
                    {/* Corner data overlays */}
                    <rect x="590" y="6" width="200" height="44" rx="3" fill="rgba(9,10,15,0.8)" />
                    <text x="598" y="20" fill="#EF4444" fontSize="9" fontFamily="monospace">Fractures detected: 7</text>
                    <text x="598" y="32" fill="#F59E0B" fontSize="9" fontFamily="monospace">Joint sets: 14 mapped</text>
                    <text x="598" y="44" fill="#10B981" fontSize="9" fontFamily="monospace">Stable zones: 3</text>
                  </svg>
                )}
                {activeTab === "raw" && (
                  <>
                    <div style={{ position: "absolute", top: "8px", right: "8px", display: "flex", gap: "5px" }}>
                      <span style={{ fontFamily: MONO, fontSize: "0.58rem", color: C.emerald, background: "rgba(9,10,15,0.8)", padding: "2px 8px", borderRadius: "4px", border: `1px solid ${C.emerald}40` }}>● LIVE</span>
                    </div>
                    <div style={{ position: "absolute", bottom: "6px", left: "8px", display: "flex", gap: "5px" }}>
                      <span style={{ fontFamily: MONO, fontSize: "0.56rem", color: C.dim, background: "rgba(9,10,15,0.75)", padding: "2px 7px", borderRadius: "4px" }}>CAM-07 · SECTOR B3 · f/2.8 · ISO 400</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Heatmap */}
            <div style={{ ...glass, padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>Mine Bench Risk Grid</div>
                  <div style={{ fontFamily: MONO, fontSize: "0.56rem", color: C.muted, marginTop: "2px" }}>5×5 Sector Spatial Risk Analysis</div>
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {HM_STYLE.map((h) => (
                    <div key={h.label} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                      <div style={{ width: "7px", height: "7px", borderRadius: "2px", background: h.text }} />
                      <span style={{ fontFamily: MONO, fontSize: "0.52rem", color: C.muted }}>{h.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column headers */}
              <div style={{ display: "grid", gridTemplateColumns: "22px repeat(5, 1fr)", gap: "5px" }}>
                <div />
                {SECTOR_COL.map((l) => (
                  <div key={l} style={{ textAlign: "center", fontFamily: MONO, fontSize: "0.62rem", color: C.muted }}>{l}</div>
                ))}
              </div>

              {/* Grid rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: "5px", flex: 1 }}>
                {heatmap.map((row, ri) => (
                  <div key={ri} style={{ display: "grid", gridTemplateColumns: "22px repeat(5, 1fr)", gap: "5px", flex: 1 }}>
                    <div style={{ fontFamily: MONO, fontSize: "0.62rem", color: C.muted, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>{ri + 1}</div>
                    {row.map((cell, ci) => {
                      const h = HM_STYLE[cell];
                      return (
                        <div
                          key={ci}
                          className={cell === 4 ? "hm-critical" : undefined}
                          title={`Sector ${SECTOR_COL[ci]}${ri + 1}: ${h.label} Risk`}
                          style={{
                            background: h.bg,
                            border: `1px solid ${h.border}`,
                            borderRadius: "6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "default",
                            minHeight: "36px",
                            transition: "all 0.35s",
                            position: "relative",
                          }}
                        >
                          <span style={{ fontFamily: MONO, fontSize: "0.58rem", fontWeight: 600, color: h.text, userSelect: "none" }}>
                            {SECTOR_COL[ci]}{ri + 1}
                          </span>
                          {cell >= 4 && <span style={{ position: "absolute", top: "1px", right: "2px", fontSize: "7px" }}>⚡</span>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Stats row */}
              <div style={{ display: "flex", justifyContent: "space-around", borderTop: `1px solid ${C.border}`, paddingTop: "8px" }}>
                {[
                  { label: "Critical", val: heatmap.flat().filter(v => v === 4).length, color: C.crimson },
                  { label: "High", val: heatmap.flat().filter(v => v === 3).length, color: "#F97316" },
                  { label: "Moderate", val: heatmap.flat().filter(v => v === 2).length, color: C.amber },
                  { label: "Safe/Low", val: heatmap.flat().filter(v => v <= 1).length, color: C.emerald },
                ].map((s) => (
                  <div key={s.label} style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: MONO, fontSize: "1.1rem", fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</div>
                    <div style={{ fontFamily: MONO, fontSize: "0.52rem", color: C.muted, marginTop: "2px" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Row 3: SHAP + Chat ─────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>

            {/* SHAP panel */}
            <div style={{ ...glass, padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>Explainable AI — SHAP Feature Attribution</div>
                  <div style={{ fontFamily: MONO, fontSize: "0.56rem", color: C.indigo, background: "rgba(99,102,241,0.1)", padding: "2px 7px", borderRadius: "4px", border: `1px solid rgba(99,102,241,0.25)`, whiteSpace: "nowrap" }}>
                    XAI · TreeExplainer
                  </div>
                </div>
                <div style={{ fontFamily: MONO, fontSize: "0.56rem", color: C.muted }}>
                  Feature importance for current FoS prediction · RF model · Accuracy 94.2%
                </div>
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: "14px" }}>
                {[{ label: "Risk Driver (↑ instability)", color: C.crimson }, { label: "Stability Factor (↓ risk)", color: C.emerald }].map((l) => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: l.color }} />
                    <span style={{ fontSize: "0.62rem", color: C.dim }}>{l.label}</span>
                  </div>
                ))}
              </div>

              {/* Bars */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                {shapData.map((d) => (
                  <div key={d.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "128px", flexShrink: 0, fontFamily: MONO, fontSize: "0.59rem", color: C.dim, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.label}>
                      {d.label}
                    </div>
                    <div style={{ flex: 1, height: "15px", background: "rgba(35,39,56,0.5)", borderRadius: "3px", overflow: "hidden" }}>
                      <div
                        className="shap-bar"
                        style={{
                          height: "100%",
                          width: `${Math.round((d.val / maxShap) * 100)}%`,
                          background: d.isRisk
                            ? `linear-gradient(90deg, rgba(239,68,68,0.9), rgba(239,68,68,0.55))`
                            : `linear-gradient(90deg, rgba(16,185,129,0.9), rgba(16,185,129,0.55))`,
                          borderRadius: "3px",
                        }}
                      />
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: "0.59rem", color: d.isRisk ? C.crimson : C.emerald, width: "38px", textAlign: "right", flexShrink: 0 }}>
                      +{d.val.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: MONO, fontSize: "0.55rem", color: C.muted }}>
                  Random Forest · n=500 trees · Last trained 2026-08-19
                </span>
                <span style={{ fontFamily: MONO, fontSize: "0.55rem", color: C.indigo, background: "rgba(99,102,241,0.08)", padding: "1px 6px", borderRadius: "3px" }}>
                  AUC: 0.976
                </span>
              </div>
            </div>

            {/* Chat */}
            <div style={{ ...glass, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Chat header */}
              <div style={{ padding: "11px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `linear-gradient(135deg, ${C.indigo}, ${C.violet})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", boxShadow: `0 0 14px rgba(99,102,241,0.45)`, flexShrink: 0 }}>
                  💬
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>GeoGuard AI Assistant</div>
                  <div style={{ fontFamily: MONO, fontSize: "0.55rem", color: C.emerald, display: "flex", alignItems: "center", gap: "4px" }}>
                    <span className="live-dot" style={{ width: "5px", height: "5px", borderRadius: "50%", background: C.emerald, display: "inline-block" }} />
                    Online · Geo-LLM Fine-tuned · RAG: Geotechnical DB
                  </div>
                </div>
                {isCritical && (
                  <div style={{ fontFamily: MONO, fontSize: "0.58rem", color: C.crimson, background: "rgba(239,68,68,0.1)", border: `1px solid rgba(239,68,68,0.3)`, padding: "3px 8px", borderRadius: "5px" }}>
                    CRITICAL MODE
                  </div>
                )}
              </div>

              {/* Messages */}
              <div
                ref={chatRef}
                className="chat-scroll"
                style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "10px", minHeight: 0 }}
              >
                {msgs.map((msg, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: "7px", alignItems: "flex-start" }}>
                    <div style={{
                      width: "24px", height: "24px", borderRadius: "6px", flexShrink: 0,
                      background: msg.role === "ai" ? `linear-gradient(135deg, ${C.indigo}, ${C.violet})` : "rgba(99,102,241,0.15)",
                      border: msg.role === "user" ? `1px solid rgba(99,102,241,0.3)` : "none",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px",
                    }}>
                      {msg.role === "ai" ? "🤖" : "👷"}
                    </div>
                    <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", gap: "3px", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                      <div style={{
                        background: msg.role === "ai" ? "rgba(28,31,46,0.7)" : "rgba(99,102,241,0.15)",
                        border: `1px solid ${msg.role === "ai" ? C.border : "rgba(99,102,241,0.25)"}`,
                        borderRadius: msg.role === "ai" ? "3px 10px 10px 10px" : "10px 3px 10px 10px",
                        padding: "7px 11px",
                        fontSize: "0.72rem",
                        lineHeight: 1.65,
                        color: msg.role === "ai" ? C.text : "#C4C8FF",
                        whiteSpace: "pre-wrap",
                      }}>
                        {msg.content}
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: "0.52rem", color: C.muted }}>{msg.time} UTC</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick prompts */}
              <div style={{ padding: "7px 12px", display: "flex", gap: "5px", flexWrap: "wrap", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
                {QUICK.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    style={{ background: "rgba(28,31,46,0.6)", border: `1px solid ${C.border}`, borderRadius: "20px", padding: "3px 10px", fontSize: "0.62rem", color: C.dim, cursor: "pointer", fontFamily: FONT, transition: "all 0.2s" }}
                    onMouseEnter={(e) => { const el = e.target as HTMLElement; el.style.borderColor = "rgba(99,102,241,0.4)"; el.style.color = C.accent; }}
                    onMouseLeave={(e) => { const el = e.target as HTMLElement; el.style.borderColor = C.border; el.style.color = C.dim; }}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div style={{ padding: "9px 12px", borderTop: `1px solid ${C.border}`, display: "flex", gap: "7px", flexShrink: 0 }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Ask about slope stability, protocols, risk factors..."
                  style={{ flex: 1, background: "rgba(28,31,46,0.6)", border: `1px solid ${C.border}`, borderRadius: "8px", padding: "7px 11px", color: C.text, fontSize: "0.73rem", fontFamily: FONT, outline: "none" }}
                  onFocus={(e) => (e.target.style.borderColor = "rgba(99,102,241,0.45)")}
                  onBlur={(e) => (e.target.style.borderColor = C.border)}
                />
                <button
                  onClick={() => sendMessage()}
                  style={{ background: `linear-gradient(135deg, ${C.indigo}, ${C.violet})`, border: "none", borderRadius: "8px", padding: "7px 14px", color: "white", fontSize: "0.73rem", fontWeight: 600, cursor: "pointer", boxShadow: `0 0 14px rgba(99,102,241,0.4)`, whiteSpace: "nowrap", fontFamily: FONT }}
                >
                  Send ↑
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "10px" }}>
      <div style={{ flex: 1, height: "1px", background: "rgba(35,39,56,0.8)" }} />
      <span style={{ fontFamily: MONO, fontSize: "0.54rem", letterSpacing: "0.12em", color: "#64748B", textTransform: "uppercase", whiteSpace: "nowrap" }}>
        {children}
      </span>
      <div style={{ flex: 1, height: "1px", background: "rgba(35,39,56,0.8)" }} />
    </div>
  );
}

function KPICard({ label, sublabel, icon, accentColor, isCritical, children }: {
  label: string; sublabel: string; icon: React.ReactNode;
  accentColor: string; isCritical: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "rgba(18,20,29,0.88)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      border: `1px solid ${isCritical ? "rgba(239,68,68,0.3)" : "#232738"}`,
      borderRadius: "12px",
      padding: "14px",
      boxShadow: isCritical ? "0 0 20px rgba(239,68,68,0.1)" : undefined,
      transition: "border-color 0.3s, box-shadow 0.3s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.76rem", color: "#E2E8F0" }}>{label}</div>
          <div style={{ fontFamily: MONO, fontSize: "0.54rem", color: "#64748B", marginTop: "2px" }}>{sublabel}</div>
        </div>
        <div style={{ opacity: 0.8 }}>{icon}</div>
      </div>
      {children}
    </div>
  );
}

function SliderInput({ label, value, min, max, step, onChange, unit, decimals, color }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; unit: string; decimals: number; color: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
        <span style={{ fontSize: "0.7rem", color: "#94A3B8" }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: "0.7rem", fontWeight: 600, color }}>{value.toFixed(decimals)}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="geo-slider"
        style={{
          "--thumb-color": color,
          background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #232738 ${pct}%, #232738 100%)`,
        } as React.CSSProperties}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
        <span style={{ fontFamily: MONO, fontSize: "0.52rem", color: "#64748B" }}>{min}{unit}</span>
        <span style={{ fontFamily: MONO, fontSize: "0.52rem", color: "#64748B" }}>{max}{unit}</span>
      </div>
    </div>
  );
}
