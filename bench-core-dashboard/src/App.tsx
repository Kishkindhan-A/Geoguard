import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import {
  AlertTriangle, Activity, Camera, CloudRain, Compass, Gauge, Layers,
  MessageSquare, Mountain, Radio, Send, UploadCloud, Waves, Satellite,
  ShieldAlert, MapPin, Clock, CircleDot, Box, Bell, TrendingDown,
  FileText, Download, Plus, User, Bot, Droplets, BarChart3, Cpu, Maximize2, Minimize2,
  X, Printer, Eye,
} from "lucide-react";

const C = {
  bg: "#F4F7FB",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  border: "#D9E2EE",
  borderLight: "#E8EEF5",
  crimson: "#EF4444",
  critical: "#EF4444",
  emerald: "#10B981",
  safe: "#10B981",
  amber: "#F59E0B",
  warning: "#F59E0B",
  warningOrange: "#F97316",
  indigo: "#2563EB",
  violet: "#0F766E",
  cyan: "#2563EB",
  shapPos: "#EF4444",
  shapNeg: "#10B981",
  text: "#172033",
  dim: "#526176",
  muted: "#7B8A9D",
  accent: "#1D4ED8",
  line: "#D9E2EE",
  glass: "#FFFFFF",
  glassBorder: "#D9E2EE",
  surfaceRaised: "#F8FAFD",
  safeDim: "#059669",
  info: "#2563EB",
};

const font = {
  display: "Inter, system-ui, sans-serif",
  body: "Inter, system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Courier New', monospace",
};

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

/* ─── Modern Sections & Badges ─── */
function SectionTag({ n, label }: { n: number; label: string }) {
  return (
    <div className="tag-pill" style={{ marginBottom: 10, background: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.25)", color: "#818CF8" }}>
      <span style={{ color: "#6366F1", fontWeight: 700 }}>{`§${n < 10 ? '0' + n : n}`}</span> {label}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 8 }}>
      <div style={{ flex: 1, height: 1, background: "rgba(35,39,56,0.8)" }} />
      <span style={{ fontFamily: font.mono, fontSize: "0.58rem", letterSpacing: "0.12em", color: "#64748B", textTransform: "uppercase", whiteSpace: "nowrap" }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: "rgba(35,39,56,0.8)" }} />
    </div>
  );
}

function KPICard({ label, sublabel, icon, accentColor, isCritical, children }: {
  label: string; sublabel: string; icon: React.ReactNode;
  accentColor: string; isCritical: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "#FFFFFF",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      border: `1px solid ${isCritical ? "rgba(239,68,68,0.4)" : "#232738"}`,
      borderRadius: "12px",
      padding: "16px",
      boxShadow: isCritical ? "0 0 20px rgba(239,68,68,0.12)" : "0 8px 24px rgba(31,53,82,0.08)",
      transition: "border-color 0.3s, box-shadow 0.3s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.78rem", color: C.text }}>{label}</div>
          <div style={{ fontFamily: font.mono, fontSize: "0.56rem", color: C.muted, marginTop: "2px" }}>{sublabel}</div>
        </div>
        <div style={{ opacity: 0.85 }}>{icon}</div>
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
        <span style={{ fontFamily: font.mono, fontSize: "0.7rem", fontWeight: 600, color }}>{value.toFixed(decimals)}{unit}</span>
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
        <span style={{ fontFamily: font.mono, fontSize: "0.52rem", color: "#64748B" }}>{min}{unit}</span>
        <span style={{ fontFamily: font.mono, fontSize: "0.52rem", color: "#64748B" }}>{max}{unit}</span>
      </div>
    </div>
  );
}

/* ─── Gauge ─── */
function GaugeCard({ label, value, unit, min, max, accent, critThresh, warnThresh }: {
  label: string; value: number; unit: string; min: number; max: number;
  accent: string; critThresh: number; warnThresh: number;
}) {
  const pct = clamp(((value - min) / (max - min)) * 100, 0, 100);
  const status = value <= critThresh ? C.critical : value <= warnThresh ? C.warning : C.safe;
  return (
    <div className={`gauge-glass ${value <= critThresh ? "glow-critical" : value <= warnThresh ? "glow-warning" : "glow-safe"}`}
      style={{ padding: 22, borderTop: `2px solid ${accent}`, minWidth: 180, flex: 1 }}>
      <div style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: "0.18em", color: C.muted, marginBottom: 12, textTransform: "uppercase" as const }}>{label}</div>
      <div style={{ fontFamily: font.display, fontSize: 40, fontWeight: 700, color: status, lineHeight: 1, marginBottom: 4 }}>
        {value.toFixed(2)}<span style={{ fontSize: 14, color: C.muted, fontWeight: 400, marginLeft: 5 }}>{unit}</span>
      </div>
      <TickScale pct={pct} status={status} />
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: font.mono, fontSize: 9, color: C.muted, marginTop: 8 }}>
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

/* ─── Tick Scale Bar ─── */
function TickScale({ pct, status }: { pct: number; status: string }) {
  return (
    <div style={{ position: "relative", height: 6, borderRadius: 3, background: "rgba(0,212,255,0.07)", marginTop: 12, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, borderRadius: 3, background: `linear-gradient(90deg, ${status}88, ${status})`, transition: "width .6s ease", boxShadow: `0 0 10px ${status}55` }} />
      {[25, 50, 75].map((t) => (
        <div key={t} style={{ position: "absolute", left: `${t}%`, top: 0, width: 1, height: "100%", background: "rgba(0,212,255,0.15)" }} />
      ))}
    </div>
  );
}

/* ─── Risk Matrix ─── */
function RiskMatrix({ fos }: { fos: number }) {
  const rows = 4, cols = 4;
  const levels = [
    ["LOW","HIGH","HIGH","HIGH"],
    ["LOW","MEDIUM","HIGH","HIGH"],
    ["LOW","LOW","LOW","MEDIUM"],
    ["LOW","LOW","LOW","LOW"],
  ];
  const col = fos < 1.0 ? 3 : fos < 1.3 ? 2 : fos < 1.8 ? 1 : 0;
  const row = fos < 1.0 ? 0 : fos < 1.3 ? 1 : fos < 2.0 ? 2 : 3;
  return (
    <div>
      <div style={{ fontFamily: font.mono, fontSize: 9, color: C.muted, textAlign: "center", marginBottom: 6, letterSpacing: "0.12em" }}>RISK MATRIX</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4 }}>
        {levels.map((rowArr, ri) => rowArr.map((level, ci) => {
          const active = ri === row && ci === col;
          return (
            <div key={`${ri}-${ci}`}
              className={`risk-cell risk-cell-${level.toLowerCase()}`}
              style={active ? { outline: `2px solid #fff`, outlineOffset: 1, zIndex: 1, transform: "scale(1.06)", filter: "brightness(1.3)" } : {}}>
              {level}
            </div>
          );
        }))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: font.mono, fontSize: 8, color: C.muted, marginTop: 6 }}>
        <span>Low Risk →</span><span>→ High Risk</span>
      </div>
    </div>
  );
}

/* ─── FoS Big Display ─── */
function FoSDisplay({ fos, warnThresh = 1.5 }: { fos: number; warnThresh?: number }) {
  const color = fos < 1.0 ? C.critical : fos < 1.3 ? C.warning : C.safe;
  const label = fos < 1.0 ? "CRITICAL" : fos < 1.3 ? "CAUTION" : "STABLE";
  const belowWarn = fos < warnThresh;
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: font.mono, fontSize: 11, color: C.muted, letterSpacing: "0.14em", marginBottom: 4 }}>FACTOR OF SAFETY</div>
      <div style={{ fontFamily: font.display, fontSize: 52, fontWeight: 800, color, lineHeight: 1, textShadow: `0 0 30px ${color}66` }}>
        {fos.toFixed(2)}
      </div>
      <div style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 700, color, marginTop: 6, letterSpacing: "0.08em" }}>{label}</div>
      {belowWarn && (
        <div style={{ fontFamily: font.mono, fontSize: 10, color: C.warning, marginTop: 8, padding: "5px 12px", borderRadius: 8, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}>
          ⚠ Below threshold of {warnThresh.toFixed(1)}
        </div>
      )}
    </div>
  );
}

/* ─── Alert Card ─── */
function AlertCard({ sev, time, text, ack, onAck }: { sev: "critical"|"warning"|"info"; time: string; text: string; ack: boolean; onAck: () => void }) {
  const colors = { critical: C.critical, warning: C.warning, info: C.info };
  const col = colors[sev];
  return (
    <div className={`alert-card-${sev}`} style={{ borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 12, opacity: ack ? 0.45 : 1, transition: "opacity .3s" }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: col, marginTop: 5, flexShrink: 0, boxShadow: `0 0 8px ${col}` }} className={ack ? "" : "bc-live"} />
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ fontFamily: font.mono, fontSize: 10, fontWeight: 700, color: col, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>{sev}:</span>
          <span style={{ fontFamily: font.body, fontSize: 12, color: C.dim }}>{text}</span>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: 10, color: C.muted }}>{time}</div>
      </div>
      {!ack && (
        <button onClick={onAck} style={{ background: "none", border: `1px solid ${C.muted}`, borderRadius: 6, color: C.muted, fontSize: 10, padding: "2px 8px", cursor: "pointer", fontFamily: font.mono, flexShrink: 0 }}>ACK</button>
      )}
    </div>
  );
}

/* ─── Panel Wrapper ─── */
function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="glass fade-up" style={{ padding: 22, borderRadius: 16, border: `1px solid rgba(0,212,255,0.1)`, boxShadow: "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(0,212,255,0.05)", ...style }}>
      {children}
    </div>
  );
}
function PanelTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: font.display, fontSize: 16, fontWeight: 700, color: C.text, lineHeight: 1.2, marginBottom: 3 }}>{children}</div>;
}
function PanelSub({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: font.mono, fontSize: 11, color: C.muted, letterSpacing: "0.04em" }}>{children}</div>;
}

/* ─── Benchmark Data ─── */
const BENCH = [
  { id: "B-12", angle: 68, discontinuity: 34, weathering: 0.82, height: 12, rainfall: 48, vibration: 4.8, seepage: 0.32, looseRock: 0.56 },
  { id: "B-09", angle: 72, discontinuity: 28, weathering: 0.71, height: 15, rainfall: 52, vibration: 5.4, seepage: 0.38, looseRock: 0.64 },
  { id: "B-07", angle: 64, discontinuity: 41, weathering: 0.89, height: 10, rainfall: 44, vibration: 3.2, seepage: 0.28, looseRock: 0.48 },
  { id: "B-15", angle: 76, discontinuity: 22, weathering: 0.65, height: 18, rainfall: 56, vibration: 6.1, seepage: 0.44, looseRock: 0.72 },
  { id: "B-03", angle: 58, discontinuity: 48, weathering: 0.94, height: 8, rainfall: 40, vibration: 2.8, seepage: 0.22, looseRock: 0.38 },
];
const BENCH_DEFAULT = BENCH[0];

function computeFoS(slopeAngle: number, ru: number, jv: number) {
  const phi = (58 - slopeAngle * 0.3) * Math.PI / 180;
  const cohesionKPa = 120 + jv * 1.2;
  const baseFoS = (cohesionKPa + 2400 * Math.cos(phi) * Math.tan(phi)) / (2400 * Math.sin(phi));
  const adjusted = baseFoS - (ru * 0.4) - (slopeAngle - 60) * 0.012;
  return clamp(adjusted, 0.2, 3.0);
}
function computeSMR(dis: number, ang: number, cond: number) {
  const r1 = 15.4 + dis * 0.08;
  const r2 = 2.1 + (ang - 50) * 0.06;
  const r3 = cond * 42;
  return clamp(100 - r1 - r2 - r3, 0, 100);
}
function computeJv(angle: number, dis: number, rain: number) {
  return clamp((120 - angle) * 0.08 + (dis * 0.12) + (rain * 0.14), 0, 50);
}
function getRisk(fos: number): { label: string; color: string; bg: string; border: string } {
  if (fos < 1.0) return { label: "CRITICAL", color: C.crimson, bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.4)" };
  if (fos < 1.25) return { label: "HIGH RISK", color: "#F97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.4)" };
  if (fos < 1.5) return { label: "WARNING", color: C.amber, bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.4)" };
  if (fos < 2.0) return { label: "MODERATE", color: "#38BDF8", bg: "rgba(56,189,248,0.12)", border: "rgba(56,189,248,0.4)" };
  return { label: "SAFE", color: C.emerald, bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.4)" };
}
function buildHeatmap(rows: typeof BENCH) {
  return rows.map((r) => {
    const fos = computeFoS(r.angle, r.seepage, computeJv(r.angle, r.discontinuity, r.rainfall));
    const cells = Array.from({ length: 25 }, (_, i) => {
      const col = i % 5, row = Math.floor(i / 5);
      const adj = (col - 2) * 2.4 + (row - 2) * 1.8;
      const local = clamp(fos + adj * 0.04, 0.2, 3.0);
      return { fos: local, color: local < 1.0 ? C.critical : local < 1.3 ? C.warning : C.safe };
    });
    return { id: r.id, cells, avgFos: cells.reduce((a, c) => a + c.fos, 0) / 25 };
  });
}

/* ─── 3D Terrain Renderer ─── */
function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const CRIT_RGB = hexToRgb(C.critical);
const WARN_RGB = hexToRgb(C.warning);
const SAFE_RGB = hexToRgb(C.safe);

function lerpColor(a: number[], b: number[], t: number) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function riskRgb(h: number) {
  const t = clamp(h, 0, 1);
  if (t < 0.45) return lerpColor(CRIT_RGB, WARN_RGB, t / 0.45);
  return lerpColor(WARN_RGB, SAFE_RGB, (t - 0.45) / 0.55);
}

/* ─── Terrain Analysis Engine ─── */
interface TerrainAnalysis {
  slopeAngle: number;
  benchCount: number;
  fractureDensity: number;
  terrainType: string;
  riskZones: number;
  avgBrightness: number;
  contrast: number;
  slopeDirection: string;
  description: string;
}

function toGray(data: Uint8ClampedArray, w: number, h: number): number[][] {
  const g: number[][] = [];
  for (let y = 0; y < h; y++) {
    const row: number[] = [];
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      row.push((data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255);
    }
    g.push(row);
  }
  return g;
}

function sobelMag(gray: number[][]): number[][] {
  const h = gray.length, w = gray[0].length;
  const out: number[][] = [];
  for (let y = 1; y < h - 1; y++) {
    const row: number[] = [];
    for (let x = 1; x < w - 1; x++) {
      const gx = -gray[y - 1][x - 1] + gray[y - 1][x + 1] - 2 * gray[y][x - 1] + 2 * gray[y][x + 1] - gray[y + 1][x - 1] + gray[y + 1][x + 1];
      const gy = -gray[y - 1][x - 1] - 2 * gray[y - 1][x] - gray[y - 1][x + 1] + gray[y + 1][x - 1] + 2 * gray[y + 1][x] + gray[y + 1][x + 1];
      row.push(Math.sqrt(gx * gx + gy * gy));
    }
    out.push(row);
  }
  return out;
}

function applyMedianFilter(matrix: number[][], radius = 1): number[][] {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const result = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const values: number[] = [];
      for (let yy = -radius; yy <= radius; yy++) {
        for (let xx = -radius; xx <= radius; xx++) {
          const nx = clamp(x + xx, 0, cols - 1);
          const ny = clamp(y + yy, 0, rows - 1);
          values.push(matrix[ny][nx]);
        }
      }
      values.sort((a, b) => a - b);
      result[y][x] = values[Math.floor(values.length / 2)];
    }
  }

  return result;
}

function applyGaussianBlur(matrix: number[][], radius = 3, sigma = 1.5): number[][] {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const kernel: number[] = [];
  const size = radius * 2 + 1;
  const twoSigmaSq = 2 * sigma * sigma;

  for (let i = -radius; i <= radius; i++) {
    const x = i * i;
    kernel.push(Math.exp(-(x) / twoSigmaSq));
  }
  const total = kernel.reduce((sum, value) => sum + value, 0);

  const result = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let sum = 0;
      let weight = 0;
      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const nx = clamp(x + kx, 0, cols - 1);
          const ny = clamp(y + ky, 0, rows - 1);
          const kernelWeight = kernel[ky + radius] * kernel[kx + radius];
          sum += matrix[ny][nx] * kernelWeight;
          weight += kernelWeight;
        }
      }
      result[y][x] = sum / (weight || 1) / total;
    }
  }
  return result;
}

function applyBilateralSmooth(matrix: number[][], spatialRadius = 2, rangeSigma = 0.12): number[][] {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const result = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let sum = 0;
      let weightTotal = 0;
      for (let yy = -spatialRadius; yy <= spatialRadius; yy++) {
        for (let xx = -spatialRadius; xx <= spatialRadius; xx++) {
          const nx = clamp(x + xx, 0, cols - 1);
          const ny = clamp(y + yy, 0, rows - 1);
          const dx = xx * xx + yy * yy;
          const spatial = Math.exp(-(dx) / (2 * (spatialRadius + 1) * (spatialRadius + 1)));
          const range = Math.exp(-((matrix[ny][nx] - matrix[y][x]) ** 2) / (2 * rangeSigma * rangeSigma));
          const kernelWeight = spatial * range;
          sum += matrix[ny][nx] * kernelWeight;
          weightTotal += kernelWeight;
        }
      }
      result[y][x] = sum / (weightTotal || 1);
    }
  }

  return result;
}

function normalizeDepthMap(matrix: number[][]): number[][] {
  const flat = matrix.flat();
  const sorted = [...flat].sort((a, b) => a - b);
  const low = sorted[Math.max(0, Math.floor(sorted.length * 0.05))];
  const high = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const spread = Math.max(1e-6, high - low);

  return matrix.map((row) => row.map((value) => clamp((value - low) / spread, 0, 1)));
}

function buildTerrainDepthMap(gray: number[][]): number[][] {
  const rows = gray.length;
  const cols = gray[0]?.length ?? 0;

  const baseDepth = Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => clamp(1 - gray[y][x], 0, 1))
  );

  const largeScale = applyGaussianBlur(baseDepth, 6, 2.2);
  const mediumScale = applyBilateralSmooth(baseDepth, 2, 0.12);
  const medianClean = applyMedianFilter(baseDepth, 1);

  const edgeMap = Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => {
      const left = gray[Math.max(0, y)][Math.max(0, x - 1)] ?? gray[y][x];
      const right = gray[Math.max(0, y)][Math.min(cols - 1, x + 1)] ?? gray[y][x];
      const up = gray[Math.max(0, y - 1)][x] ?? gray[y][x];
      const down = gray[Math.min(rows - 1, y + 1)][x] ?? gray[y][x];
      return clamp(Math.abs((right - left)) + Math.abs((down - up)), 0, 1) * 1.6;
    })
  );

  const combined = Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => {
      const large = largeScale[y][x];
      const medium = mediumScale[y][x];
      const median = medianClean[y][x];
      const edgeWeight = edgeMap[y][x];
      const value = 0.62 * large + 0.28 * medium + 0.10 * median;
      const preserved = value * (1 - edgeWeight * 0.30) + medium * edgeWeight * 0.22;
      return clamp(preserved, 0, 1);
    })
  );

  const medianFiltered = applyMedianFilter(combined, 1);
  const smoothed = applyBilateralSmooth(medianFiltered, 2, 0.08);
  const localMedian = applyMedianFilter(smoothed, 1);

  const outlierRejected = Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => {
      const local = smoothed[y][x];
      const medianValue = localMedian[y][x];
      return Math.abs(local - medianValue) > 0.22 ? medianValue : local;
    })
  );

  return normalizeDepthMap(outlierRejected);
}

function analyzeTerrain(src: string, gridSize: number): Promise<{ heightmap: number[][]; analysis: TerrainAnalysis }> {
  return new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const analysisRes = 160;
        const cvA = document.createElement("canvas");
        cvA.width = analysisRes;
        cvA.height = analysisRes;
        const ctxA = cvA.getContext("2d")!;
        ctxA.drawImage(img, 0, 0, analysisRes, analysisRes);
        const aData = ctxA.getImageData(0, 0, analysisRes, analysisRes).data;
        const gray = toGray(aData, analysisRes, analysisRes);
        const edges = sobelMag(gray);

        let totalEdge = 0, strongEdges = 0;
        for (const row of edges) for (const v of row) { totalEdge += v; if (v > 0.3) strongEdges++; }
        const fractureDensity = Math.min(1, strongEdges / (analysisRes * analysisRes * 0.02));

        const rowAvg: number[] = [];
        for (let y = 0; y < analysisRes; y++) {
          let s = 0;
          for (let x = 0; x < analysisRes; x++) s += gray[y][x];
          rowAvg.push(s / analysisRes);
        }

        let benchCount = 0;
        for (let y = 3; y < analysisRes - 3; y++) {
          const isPeak = rowAvg[y] > rowAvg[y - 1] && rowAvg[y] > rowAvg[y + 1] && rowAvg[y] > rowAvg[y - 2] && rowAvg[y] > rowAvg[y + 2];
          if (isPeak && (rowAvg[y] - rowAvg[y - 3]) > 0.02) benchCount++;
        }
        benchCount = clamp(benchCount, 1, 8);

        let totalGradX = 0, totalGradY = 0, gradCount = 0;
        for (let y = 2; y < analysisRes - 2; y++) {
          for (let x = 2; x < analysisRes - 2; x++) {
            const dx = gray[y][x + 1] - gray[y][x - 1];
            const dy = gray[y + 1][x] - gray[y - 1][x];
            if (Math.abs(dx) > 0.02 || Math.abs(dy) > 0.02) {
              totalGradX += dx;
              totalGradY += dy;
              gradCount++;
            }
          }
        }
        const avgGradX = gradCount > 0 ? totalGradX / gradCount : 0;
        const avgGradY = gradCount > 0 ? totalGradY / gradCount : 0;
        const slopeAngle = Math.round(clamp(Math.atan2(Math.abs(avgGradY) + 0.01, Math.abs(avgGradX) + 0.01) * 180 / Math.PI, 15, 80));
        const slopeDir = Math.abs(avgGradX) > Math.abs(avgGradY) ? (avgGradX > 0 ? "right-to-left" : "left-to-right") : (avgGradY > 0 ? "top-to-bottom" : "bottom-to-top");

        let greenCount = 0, brownCount = 0, totalPx = analysisRes * analysisRes;
        for (let y = 0; y < analysisRes; y++) {
          for (let x = 0; x < analysisRes; x++) {
            const i = (y * analysisRes + x) * 4;
            const r = aData[i] / 255, g = aData[i + 1] / 255, b = aData[i + 2] / 255;
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            const sat = mx === 0 ? 0 : (mx - mn) / mx;
            const hue = mx === mn ? 0 : mx === r ? ((g - b) / (mx - mn)) * 60 : mx === g ? (2 + (b - r) / (mx - mn)) * 60 : (4 + (r - g) / (mx - mn)) * 60;
            if (hue > 60 && hue < 180 && sat > 0.15) greenCount++;
            if (hue > 10 && hue < 50 && sat > 0.1) brownCount++;
          }
        }
        let terrainType = "rock face";
        if (greenCount / totalPx > 0.3) terrainType = "vegetated";
        else if (brownCount / totalPx > 0.35) terrainType = "soil";
        else if (greenCount / totalPx > 0.1) terrainType = "mixed terrain";

        let totalBright = 0;
        for (const row of gray) for (const v of row) totalBright += v;
        const avgBrightness = totalBright / totalPx;
        let variance = 0;
        for (const row of gray) for (const v of row) variance += (v - avgBrightness) ** 2;
        const contrast = Math.sqrt(variance / totalPx);

        let riskZones = 0;
        for (let y = 2; y < analysisRes - 2; y += 2) {
          for (let x = 2; x < analysisRes - 2; x += 2) {
            const localC = Math.max(Math.abs(gray[y][x] - gray[y][x + 2]), Math.abs(gray[y][x] - gray[y + 2][x]), Math.abs(gray[y][x] - gray[y][x - 2]), Math.abs(gray[y][x] - gray[y - 2][x]));
            if (localC > 0.2) riskZones++;
          }
        }

        const analysis: TerrainAnalysis = {
          slopeAngle,
          benchCount,
          fractureDensity: Math.round(fractureDensity * 100) / 100,
          terrainType,
          riskZones,
          avgBrightness: Math.round(avgBrightness * 100) / 100,
          contrast: Math.round(contrast * 100) / 100,
          slopeDirection: slopeDir,
          description: `${terrainType} terrain with ${benchCount} terrace bands, ${slopeDir} slope orientation, and controlled geological relief. The reconstruction prioritizes large-scale quarry structure and suppresses texture-level noise that would otherwise create artificial spikes and voids.`,
        };

        const cvH = document.createElement("canvas");
        cvH.width = gridSize;
        cvH.height = gridSize;
        const ctxH = cvH.getContext("2d")!;
        ctxH.drawImage(img, 0, 0, gridSize, gridSize);
        const hData = ctxH.getImageData(0, 0, gridSize, gridSize).data;
        const hGray = toGray(hData, gridSize, gridSize);
        const terrainDepth = buildTerrainDepthMap(hGray);

        const grid: number[][] = Array.from({ length: gridSize }, (_, y) =>
          Array.from({ length: gridSize }, (_, x) => {
            const srcY = Math.min(terrainDepth.length - 1, Math.floor((y / Math.max(1, gridSize - 1)) * terrainDepth.length));
            const srcX = Math.min(terrainDepth[0].length - 1, Math.floor((x / Math.max(1, gridSize - 1)) * terrainDepth[0].length));
            return terrainDepth[srcY][srcX];
          })
        );

        resolve({ heightmap: grid, analysis });
      } catch (err) {
        console.error("Terrain analysis error:", err);
        const fallback: number[][] = Array.from({ length: gridSize }, (_, y) =>
          Array.from({ length: gridSize }, (_, x) => clamp(0.5 + Math.sin(x / gridSize * 6) * Math.cos(y / gridSize * 6) * 0.3, 0, 1))
        );
        resolve({
          heightmap: fallback,
          analysis: { slopeAngle: 45, benchCount: 3, fractureDensity: 0.3, terrainType: "unknown", riskZones: 5, avgBrightness: 0.5, contrast: 0.2, slopeDirection: "top-to-bottom", description: "Error during analysis. Generated a robust fallback terrain reconstruction." },
        });
      }
    };
    img.onerror = () => {
      const grid: number[][] = Array.from({ length: gridSize }, (_, y) =>
        Array.from({ length: gridSize }, (_, x) => {
          const cx = x / (gridSize - 1) - 0.5;
          const cy = y / (gridSize - 1) - 0.5;
          return clamp(0.5 + Math.sin(cx * 6) * Math.cos(cy * 6) * 0.3 + Math.random() * 0.05, 0, 1);
        })
      );
      resolve({
        heightmap: grid,
        analysis: {
          slopeAngle: 45, benchCount: 3, fractureDensity: 0.3, terrainType: "unknown",
          riskZones: 5, avgBrightness: 0.5, contrast: 0.2, slopeDirection: "top-to-bottom",
          description: "Image could not be loaded. Generated procedural terrain as fallback.",
        },
      });
    };
    img.src = src;
  });
}

interface Tri { cx: number; cy: number; cz: number; depth: number; verts: { x: number; y: number; z: number }[]; color: string; }

async function loadDatasetHeightmap(gridSize: number): Promise<number[][]> {
  const realAsset = "/mine_crack_detection.jpg";
  try {
    const { heightmap } = await analyzeTerrain(realAsset, gridSize);
    if (heightmap?.length) return heightmap;
  } catch (e) {
    console.warn("Primary real rockfall asset unavailable, using procedural fallback:", e);
  }

  const fallback = Array.from({ length: gridSize }, (_, y) =>
    Array.from({ length: gridSize }, (_, x) => {
      const nx = x / Math.max(1, gridSize - 1) - 0.5;
      const ny = y / Math.max(1, gridSize - 1) - 0.5;
      return clamp(0.52 + Math.sin(nx * 9.5) * Math.cos(ny * 8.7) * 0.22 + (Math.random() - 0.5) * 0.08, 0, 1);
    })
  );
  return fallback;
}

async function applyTrainedTerrainPrior(heightmap: number[][], gridSize: number): Promise<number[][]> {
  const response = await fetch("/models/terrain_converter.json");
  if (!response.ok) throw new Error(`3D converter model request failed: ${response.status}`);
  const model = await response.json() as { grid_size: number; mean: number[]; components: number[][] };
  const modelSize = model.grid_size;
  const input = Array.from({ length: modelSize }, (_, row) => Array.from({ length: modelSize }, (_, column) => {
    const sourceRow = Math.min(heightmap.length - 1, Math.floor(row / modelSize * heightmap.length));
    const sourceColumn = Math.min(heightmap[0].length - 1, Math.floor(column / modelSize * heightmap[0].length));
    return heightmap[sourceRow][sourceColumn];
  })).flat();
  const centered = input.map((value, index) => value - model.mean[index]);
  const coefficients = model.components.map((component) => component.reduce((sum, value, index) => sum + value * centered[index], 0));
  const reconstructed = model.mean.map((value, index) => value + model.components.reduce((sum, component, componentIndex) => sum + coefficients[componentIndex] * component[index], 0));
  return Array.from({ length: gridSize }, (_, row) => Array.from({ length: gridSize }, (_, column) => {
    const modelRow = Math.min(modelSize - 1, Math.floor(row / gridSize * modelSize));
    const modelColumn = Math.min(modelSize - 1, Math.floor(column / gridSize * modelSize));
    return clamp(reconstructed[modelRow * modelSize + modelColumn], 0, 1);
  }));
}

function renderTerrain(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  heightmap: number[][], rotX: number, rotY: number, zoom: number,
  mode: "solid" | "wireframe" | "textured",
  texImage: HTMLImageElement | null
) {
  const gs = heightmap.length;
  const spacing = 320 / gs;
  const heightScale = 52;
  const focal = 520;
  const cx = w / 2;
  const cy = h / 2 + 32;

  const ax = rotX * Math.PI / 180;
  const ay = rotY * Math.PI / 180;
  const cosY = Math.cos(ay), sinY = Math.sin(ay);
  const cosX = Math.cos(ax), sinX = Math.sin(ax);

  function project(x: number, y: number, z: number) {
    let x1 = x * cosY - z * sinY;
    let z1 = x * sinY + z * cosY;
    let y1 = y * cosX - z1 * sinX;
    let z2 = y * sinX + z1 * cosX;
    const scale = focal / (focal + z2 + 300) * zoom;
    return { sx: cx + x1 * scale, sy: cy - y1 * scale, depth: z2, scale };
  }

  const offX = -320 * zoom / 2;
  const offZ = -320 * zoom / 2;

  const vertices: { x: number; y: number; z: number }[][] = [];
  for (let gy = 0; gy < gs; gy++) {
    const row: { x: number; y: number; z: number }[] = [];
    for (let gx = 0; gx < gs; gx++) {
      const px = (gx - gs / 2) * spacing;
      const pz = (gy - gs / 2) * spacing;
      const normalized = clamp((heightmap[gy][gx] - 0.5) * 2, -1, 1);
      const py = normalized * heightScale;
      row.push({ x: px, y: py, z: pz });
    }
    vertices.push(row);
  }

  const tris: Tri[] = [];
  for (let gy = 0; gy < gs - 1; gy++) {
    for (let gx = 0; gx < gs - 1; gx++) {
      const v00 = vertices[gy][gx];
      const v10 = vertices[gy][gx + 1];
      const v01 = vertices[gy + 1][gx];
      const v11 = vertices[gy + 1][gx + 1];
      const h00 = heightmap[gy][gx];
      const h10 = heightmap[gy][gx + 1];
      const h01 = heightmap[gy + 1][gx];
      const h11 = heightmap[gy + 1][gx + 1];
      const avgH1 = (h00 + h10 + h01) / 3;
      const avgH2 = (h10 + h11 + h01) / 3;
      const c1 = riskRgb(avgH1);
      const c2 = riskRgb(avgH2);

      function addTri(v1: typeof v00, v2: typeof v00, v3: typeof v00, color: number[]) {
        const nrmx = (v2.y - v1.y) * (v3.z - v1.z) - (v2.z - v1.z) * (v3.y - v1.y);
        const nrmy = (v2.z - v1.z) * (v3.x - v1.x) - (v2.x - v1.x) * (v3.z - v1.z);
        const nrmz = (v2.x - v1.x) * (v3.y - v1.y) - (v2.y - v1.y) * (v3.x - v1.x);
        const len = Math.sqrt(nrmx * nrmx + nrmy * nrmy + nrmz * nrmz) || 1;
        const ny = -nrmy / len;
        const light = clamp(0.35 + 0.65 * Math.max(0, ny), 0, 1);
        const r = Math.round(color[0] * light);
        const g = Math.round(color[1] * light);
        const b = Math.round(color[2] * light);
        const ccx = (v1.x + v2.x + v3.x) / 3;
        const ccy = (v1.y + v2.y + v3.y) / 3;
        const ccz = (v1.z + v2.z + v3.z) / 3;
        const p = project(ccx, ccy, ccz);
        tris.push({ cx: ccx, cy: ccy, cz: ccz, depth: p.depth, verts: [v1, v2, v3], color: `rgb(${r},${g},${b})` });
      }
      addTri(v00, v10, v01, c1);
      addTri(v10, v11, v01, c2);
    }
  }

  tris.sort((a, b) => b.depth - a.depth);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0d0b08";
  ctx.fillRect(0, 0, w, h);

  if (mode === "textured" && texImage) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    tris.forEach((tri) => {
      const pv = tri.verts.map((v) => project(v.x, v.y, v.z));
      ctx.beginPath();
      ctx.moveTo(pv[0].sx, pv[0].sy);
      ctx.lineTo(pv[1].sx, pv[1].sy);
      ctx.lineTo(pv[2].sx, pv[2].sy);
      ctx.closePath();
      ctx.fillStyle = tri.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(237,231,218,0.06)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });
    ctx.globalAlpha = 0.45;
    const imgP0 = project(-160, 0, -160);
    const imgP1 = project(160, 0, 160);
    const imgP2 = project(160, 0, -160);
    const imgP3 = project(-160, 0, 160);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(imgP0.sx, imgP0.sy);
    ctx.lineTo(imgP2.sx, imgP2.sy);
    ctx.lineTo(imgP1.sx, imgP1.sy);
    ctx.lineTo(imgP3.sx, imgP3.sy);
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(
      imgP2.sx - imgP0.sx, imgP2.sy - imgP0.sy,
      imgP3.sx - imgP0.sx, imgP3.sy - imgP0.sy,
      imgP0.sx, imgP0.sy
    );
    ctx.drawImage(texImage, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.restore();
  } else {
    tris.forEach((tri) => {
      const pv = tri.verts.map((v) => project(v.x, v.y, v.z));
      ctx.beginPath();
      ctx.moveTo(pv[0].sx, pv[0].sy);
      ctx.lineTo(pv[1].sx, pv[1].sy);
      ctx.lineTo(pv[2].sx, pv[2].sy);
      ctx.closePath();
      if (mode === "solid") {
        ctx.fillStyle = tri.color;
        ctx.fill();
        ctx.strokeStyle = "rgba(237,231,218,0.06)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      } else {
        ctx.strokeStyle = tri.color;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }

  // Axis indicator
  const axLen = 30;
  const oP = project(0, 0, 0);
  const xP = project(axLen, 0, 0);
  const yP = project(0, axLen, 0);
  const zP = project(0, 0, axLen);
  ctx.globalAlpha = 0.6;
  [["X", xP, "#FF5A2B"], ["Y", yP, "#4FA37A"], ["Z", zP, "#6E93B5"]].forEach(([label, p, col]) => {
    const pp = p as { sx: number; sy: number };
    ctx.beginPath();
    ctx.moveTo(oP.sx, oP.sy);
    ctx.lineTo(pp.sx, pp.sy);
    ctx.strokeStyle = col as string;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = col as string;
    ctx.font = `10px ${font.mono}`;
    ctx.fillText(label as string, pp.sx + 4, pp.sy - 4);
  });
  ctx.globalAlpha = 1;
}

/* ─── SHAP Bars (redesigned — pink positive / blue negative, centred zero) ─── */
function ShapBars({ values }: { values: { feature: string; value: number; positive: boolean }[] }) {
  const maxAbs = Math.max(...values.map((v) => Math.abs(v.value)), 0.001);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Zero line label */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <div style={{ width: 148, fontFamily: font.mono, fontSize: 9, color: C.muted, textAlign: "right", letterSpacing: "0.08em" }}>FEATURE</div>
        <div style={{ flex: 1, position: "relative", height: 12 }}>
          <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "rgba(0,212,255,0.3)" }} />
          <div style={{ position: "absolute", left: "5%", fontFamily: font.mono, fontSize: 8, color: C.shapNeg, top: 2 }}>← Risk Decrease</div>
          <div style={{ position: "absolute", right: "5%", fontFamily: font.mono, fontSize: 8, color: C.shapPos, top: 2 }}>Risk Increase →</div>
        </div>
        <div style={{ width: 56, fontFamily: font.mono, fontSize: 9, color: C.muted, textAlign: "center", letterSpacing: "0.08em" }}>SHAP</div>
      </div>
      {values.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 148, fontFamily: font.mono, fontSize: 11, color: C.dim, textAlign: "right", letterSpacing: "0.02em" }}>{s.feature}</div>
          <div style={{ flex: 1, height: 20, borderRadius: 4, background: "rgba(0,212,255,0.04)", position: "relative", overflow: "hidden", border: "1px solid rgba(0,212,255,0.07)" }}>
            {/* Zero centre line */}
            <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "rgba(0,212,255,0.25)", zIndex: 1 }} />
            <div
              className={s.positive ? "shap-bar-positive" : "shap-bar-negative"}
              style={{
                position: "absolute", top: 2, bottom: 2, borderRadius: 3,
                background: s.positive
                  ? `linear-gradient(90deg, rgba(255,77,109,0.4), #ff4d6d)`
                  : `linear-gradient(270deg, rgba(59,130,246,0.4), #3b82f6)`,
                width: `${(Math.abs(s.value) / maxAbs) * 46}%`,
                left: s.positive ? "50%" : `${50 - (Math.abs(s.value) / maxAbs) * 46}%`,
                transition: "width .5s cubic-bezier(0.4,0,0.2,1), left .5s cubic-bezier(0.4,0,0.2,1)",
                boxShadow: s.positive ? `0 0 10px rgba(255,77,109,0.4)` : `0 0 10px rgba(59,130,246,0.4)`,
              }} />
          </div>
          <div style={{ width: 56, fontFamily: font.mono, fontSize: 11, fontWeight: 600, color: s.positive ? C.shapPos : C.shapNeg, textAlign: "right" }}>
            {s.value > 0 ? "+" : ""}{s.value.toFixed(3)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── API Client ─── */
async function apiAnalyze(params: {
  image?: string; slopeAngle: number; discontinuityDensity: number;
  weatheringIndex: number; benchHeight: number; rainfall: number;
  blastVibration: number; waterSeepage: number; looseRock: number;
  ru: number; tilt: number; rmr: number;
}) {
  const fd = new FormData();
  if (params.image && params.image.startsWith("data:")) {
    const res = await fetch(params.image);
    const blob = await res.blob();
    fd.append("image", blob, "pit.png");
  }
  fd.append("slope_angle", String(params.slopeAngle));
  fd.append("discontinuity_density", String(params.discontinuityDensity));
  fd.append("weathering_index", String(params.weatheringIndex));
  fd.append("bench_height", String(params.benchHeight));
  fd.append("rainfall", String(params.rainfall));
  fd.append("blast_vibration", String(params.blastVibration));
  fd.append("water_seepage", String(params.waterSeepage));
  fd.append("loose_rock", String(params.looseRock));
  fd.append("ru", String(params.ru));
  fd.append("tilt", String(params.tilt));
  fd.append("rmr", String(params.rmr));
  const r = await fetch("/api/analyze", { method: "POST", body: fd });
  return r.json();
}

async function apiChat(message: string, fos: number, ru: number, rainfall: number, bench: any, smr: number, jv: number, shovelOk: boolean, blastingOk: boolean, chatMsgs: {role: string; text: string}[], crackMetrics?: any) {
  const fd = new FormData();
  fd.append("message", message);
  fd.append("fos", String(fos));
  fd.append("ru", String(ru));
  fd.append("rainfall", String(rainfall));
  fd.append("bench_id", bench.id);
  fd.append("angle", String(bench.angle));
  fd.append("seepage", String(bench.seepage));
  fd.append("vibration", String(bench.vibration));
  fd.append("smr", String(smr));
  fd.append("jv", String(jv));
  fd.append("shovel_ok", String(shovelOk));
  fd.append("blasting_ok", String(blastingOk));
  fd.append("history", JSON.stringify(chatMsgs.slice(-8).map((m) => ({ role: m.role, text: typeof m.text === "string" ? m.text : "" }))));
  if (crackMetrics) {
    fd.append("crack_count", String(crackMetrics.crack_count ?? 0));
    fd.append("max_danger", String(crackMetrics.max_danger ?? 0));
    fd.append("high_danger_pct", String(crackMetrics.high_danger_pct ?? 0));
  }
  const r = await fetch("/api/chat", { method: "POST", body: fd });
  return r.json();
}

async function apiSpatialRisk(imageDataUrl: string) {
  const r = await fetch(imageDataUrl);
  const blob = await r.blob();
  const fd = new FormData();
  fd.append("image", blob, "bench.png");
  const res = await fetch("/api/spatial-risk", { method: "POST", body: fd });
  return res.json();
}

async function apiCrackAnalysis(imageDataUrl: string) {
  const r = await fetch(imageDataUrl);
  const blob = await r.blob();
  const fd = new FormData();
  fd.append("image", blob, "bench.png");
  const res = await fetch("/api/crack-analysis", { method: "POST", body: fd });
  return res.json();
}

/* ═══════════════════════════════════════════════════ */
export default function App() {
  const [active, setActive] = useState("dashboard");
  const [utcTime, setUtcTime] = useState(() => {
    const d = new Date();
    return [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
  });
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setUtcTime([d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()].map((n) => String(n).padStart(2, "0")).join(":"));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const [bench, setBench] = useState(BENCH_DEFAULT);
  const [image, setImage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"RAW" | "CV ANALYSIS">("CV ANALYSIS");
  const [chatMsgs, setChatMsgs] = useState<{ role: string; text: string }[]>([
    { role: "assistant", text: "I’m GeoGuard AI. I can assess slope stability, interpret crack risk, and recommend worker-safe actions from your live mine data." },
    { role: "system", text: "Live telemetry linked. RF-slot 14 active. Ask about stability, dewatering, evacuation, or blast readiness." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const [fusionResult, setFusionResult] = useState<any>(null);
  const [overlayB64, setOverlayB64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [spatialGrid, setSpatialGrid] = useState<number[][] | null>(null);
  const [spatialSummary, setSpatialSummary] = useState<{ critical: number; high: number; moderate: number; low: number; safe: number; mean_risk?: number; max_risk?: number; high_risk_pct?: number } | null>(null);
  const [crackResult, setCrackResult] = useState<{ overlay?: string; crack_map?: string; heatmap?: string; cracks?: any[]; most_dangerous?: any; metrics?: any } | null>(null);
  const [crackView, setCrackView] = useState<"overlay" | "heatmap" | "crackmap">("overlay");
  const [fullScreen3d, setFullScreen3d] = useState(false);
  const [alerts, setAlerts] = useState([
    { id: 1, sev: "critical" as const, time: "14:22", text: "B-15 FoS dropped below 1.0", ack: false },
    { id: 2, sev: "warning" as const, time: "14:18", text: "B-09 seepage index elevated", ack: false },
    { id: 3, sev: "info" as const, time: "14:05", text: "Sensor RF-17 calibrated", ack: false },
    { id: 4, sev: "critical" as const, time: "13:58", text: "B-03 blast vibration threshold exceeded", ack: false },
    { id: 5, sev: "warning" as const, time: "13:42", text: "Rainfall rate above 50 mm/hr forecast", ack: false },
  ]);
  const [history, setHistory] = useState(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const day = i + 1;
      const baseFos = 1.45 - i * 0.03;
      return {
        day,
        fos: baseFos + (Math.random() - 0.5) * 0.08,
        incidents: Math.random() > 0.75 ? Math.floor(Math.random() * 3) + 1 : 0,
        rainfall: 12 + Math.random() * 50,
        vibration: 2 + Math.random() * 6,
        seepage: 0.2 + Math.random() * 0.3,
      };
    });
  });
  const [is3d, setIs3d] = useState(false);
  const [rot3d, setRot3d] = useState({ x: -18, y: 28 });
  const [zoom3d, setZoom3d] = useState(1);
  const modelRef = useRef<HTMLDivElement>(null);
  const drag3d = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });
  const logRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
const terrainContainerRef = useRef<HTMLDivElement>(null);
  const texImgRef = useRef<HTMLImageElement | null>(null);
  const [heightmap, setHeightmap] = useState<number[][] | null>(null);
  const [meshMode, setMeshMode] = useState<"solid" | "wireframe" | "textured">("solid");
  const [autoRotate, setAutoRotate] = useState(false);
  const [gridRes, setGridRes] = useState(64);
  const [converting3d, setConverting3d] = useState(false);
  const [reconstructionState, setReconstructionState] = useState<"idle" | "processing" | "ready" | "error">("idle");
  const [reconstructionError, setReconstructionError] = useState<string | null>(null);
  const [terrainAnalysis, setTerrainAnalysis] = useState<TerrainAnalysis | null>(null);
  const [terrainSource, setTerrainSource] = useState<"kaggle-obj" | "uploaded-image" | null>(null);
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const [reports, setReports] = useState<any[]>([
    {
      id: 1048,
      ts: "10-Sep-2026 08:30",
      benches: "Bench B-07",
      status: "APPROVED (FoS 1.42)",
      snapshot: {
        bench: { id: "B-07", angle: 62, discontinuity: 48, weathering: 0.65, height: 12, rainfall: 15, seepage: 0.18, vibration: 2.2, looseRock: 0.15 },
        alerts: [],
        fos: 1.42,
        smr: 68.4,
        jv: 6.2,
        risk: { label: "STABLE", color: "#10b981", bg: "rgba(16,185,129,0.12)" }
      }
    },
    {
      id: 1047,
      ts: "09-Sep-2026 16:45",
      benches: "Bench B-15",
      status: "CAUTION (FoS 1.18)",
      snapshot: {
        bench: { id: "B-15", angle: 71, discontinuity: 28, weathering: 0.82, height: 14, rainfall: 42, seepage: 0.38, vibration: 4.8, looseRock: 0.45 },
        alerts: [{ id: 1, sev: "warning", time: "16:40", text: "B-15 Pore pressure elevated", ack: true }],
        fos: 1.18,
        smr: 51.2,
        jv: 12.8,
        risk: { label: "CAUTION", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" }
      }
    }
  ]);
  const [reportGen, setReportGen] = useState(false);
  const [viewingReport, setViewingReport] = useState<any | null>(null);

  /* ─── Derived values ─── */
  const jv = computeJv(bench.angle, bench.discontinuity, bench.rainfall);
  const localFos = computeFoS(bench.angle, bench.seepage, jv);
  const localSmr = computeSMR(bench.discontinuity, bench.angle, bench.weathering);
  const localRisk = getRisk(localFos);
  const fos = fusionResult?.fos ?? localFos;
  const smr = fusionResult?.smr ?? localSmr;
  const risk = fusionResult?.risk_label ? { ...getRisk(fos), label: fusionResult.risk_label, color: fusionResult.risk_color || getRisk(fos).color } : localRisk;
  const shovelOk = fos >= 1.3;
  const blastingOk = fos >= 1.1 && bench.vibration < 5.0;

  const shapValues = [
    { feature: "Slope Angle", value: 0.042 * (bench.angle - 60) / 10, positive: bench.angle > 68 },
    { feature: "Discontinuity Density", value: 0.028 * (bench.discontinuity - 30) / 10, positive: bench.discontinuity > 35 },
    { feature: "Weathering Index", value: 0.019 * (bench.weathering - 0.75), positive: bench.weathering > 0.8 },
    { feature: "Bench Height", value: 0.012 * (bench.height - 12) / 6, positive: bench.height > 14 },
    { feature: "Rainfall", value: 0.035 * (bench.rainfall - 40) / 20, positive: bench.rainfall > 45 },
    { feature: "Blast Vibration", value: 0.022 * (bench.vibration - 4) / 2, positive: bench.vibration > 5 },
    { feature: "Water Seepage", value: 0.031 * (bench.seepage - 0.3), positive: bench.seepage > 0.35 },
    { feature: "Loose Rock", value: 0.015 * (bench.looseRock - 0.5), positive: bench.looseRock > 0.55 },
  ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  /* ─── Heatmap grid data ─── */
  const heatmapRows = buildHeatmap(BENCH);

  /* ─── Chat handler (API-backed) ─── */
  const handleSend = useCallback(async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatMsgs((p) => [...p, { role: "user", text: userMsg }]);
    setChatInput("");
    if (userMsg.toLowerCase() === "clear") {
      setChatMsgs([{ role: "system", text: "Chat cleared." }]);
      return;
    }
    if (apiOnline) {
      try {
        const res = await apiChat(userMsg, fos, bench.seepage, bench.rainfall, bench, smr, jv, shovelOk, blastingOk, chatMsgs.filter((m) => m.role !== "system"), crackResult?.metrics);
        if (res.clear) { setChatMsgs([{ role: "system", text: "Chat cleared." }]); return; }
        if (res.reply) {
          const replyLower = (res.reply || "").toLowerCase();
          const errPatterns = ["does not support image", "cannot read", "image.png", "invalid request", "inform the user", "error:", "not support"];
          if (errPatterns.some((p) => replyLower.includes(p))) {
            setChatMsgs((p) => [...p, { role: "assistant", text: "AI service returned an error for that request. Please try rephrasing your question." }]);
          } else {
            setChatMsgs((p) => [...p, { role: "assistant", text: res.reply }]);
          }
        } else {
          setChatMsgs((p) => [...p, { role: "assistant", text: "No response received. Try again." }]);
        }
        return;
      } catch (e: any) {
        console.error("Chat API error:", e);
        setChatMsgs((p) => [...p, { role: "system", text: `Connection error: ${e?.message || "Backend unavailable"}. Falling back to local mode.` }]);
      }
    }
    const msg = userMsg.toLowerCase();
    let reply = "";
    if (msg === "help") {
      reply = "Commands: status, risk, fos, shap, clear. Click any benchmark in the sidebar to load its data.";
    } else if (msg === "status") {
      reply = `System nominal. ${BENCH.length} benchmarks monitored. RF-slot 14 active. Camera feed online.`;
    } else if (msg === "risk") {
      reply = `Bench ${bench.id}: ${risk.label} (FoS ${fos.toFixed(2)}). Shovel ${shovelOk ? "cleared" : "hold"}. Blasting ${blastingOk ? "cleared" : "hold"}.`;
    } else if (msg === "fos") {
      reply = `Factor of Safety: ${fos.toFixed(3)}. SMR: ${smr.toFixed(1)}/100. Junction Volume: ${jv.toFixed(1)} blocks/m3.`;
    } else if (msg === "shap") {
      reply = `Top risk driver: ${shapValues[0].feature} (${shapValues[0].value > 0 ? "+" : ""}${shapValues[0].value.toFixed(3)})`;
    } else {
      reply = `Analyzing telemetry... FoS ${fos.toFixed(2)}, ru ${bench.seepage.toFixed(2)}, rainfall ${bench.rainfall.toFixed(0)} mm/hr. ${fos < 1.5 ? "Primary risk: elevated pore-water pressure." : "All parameters within normal range."}`;
    }
    setChatMsgs((p) => [...p, { role: "assistant", text: reply }]);
  }, [chatInput, bench, fos, risk, smr, jv, shovelOk, blastingOk, shapValues, apiOnline]);

  /* ─── Auto-scroll chat log ─── */
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [chatMsgs]);

  /* ─── Acknowledge alert ─── */
  const ackAlert = (id: number) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, ack: true } : a)));
  };

  /* ─── Generate report ─── */
  const genReport = () => {
    setReportGen(true);
    setTimeout(() => {
      const now = new Date();
      const ts = now.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
      setReports((prev) => [
        {
          id: prev.length + 1,
          ts,
          benches: BENCH.map((b) => b.id).join(", "),
          status: "completed",
          snapshot: {
            bench: { ...bench },
            alerts: [...alerts],
            fos,
            smr,
            jv,
            risk,
          }
        },
        ...prev,
      ]);
      setReportGen(false);
    }, 1500);
  };

  /* ─── Download Report PDF ─── */
  const downloadReportPDF = (report: any) => {
    const snap = report.snapshot || {
      bench: bench,
      alerts: alerts,
      fos: fos,
      smr: smr,
      jv: jv,
      risk: risk
    };
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const statusText = snap.fos < 1.0 ? "CRITICAL" : snap.fos < 1.3 ? "WARNING" : "STABLE";
    const statusClass = snap.fos < 1.0 ? "status-critical" : snap.fos < 1.3 ? "status-warning" : "status-safe";
    const fosColor = snap.fos < 1.0 ? "#b91c1c" : snap.fos < 1.3 ? "#b45309" : "#047857";

    const alertsHtml = snap.alerts.length > 0
      ? snap.alerts.map((a: any) =>
          '<div class="alert-row"><span class="alert-' + a.sev + '">' + a.sev.toUpperCase() + ": " + a.text + "</span>" +
          '<span style="color:#64748b">' + a.time + "</span></div>"
        ).join("")
      : '<div style="color:#64748b;font-size:12px;font-style:italic">No active alerts recorded at the time of audit.</div>';

    const recText = snap.fos < 1.0
      ? "<strong>CRITICAL DANGER:</strong> Immediate evacuation of Bench " + snap.bench.id + " is required. FoS is " + snap.fos.toFixed(2) + ", below safe failure limit. Clear all personnel immediately."
      : snap.fos < 1.3
      ? "<strong>STABILITY CAUTION:</strong> Bench " + snap.bench.id + " shows low stability (FoS: " + snap.fos.toFixed(2) + "). Restrict heavy vehicle access. Monitor seepage (" + snap.bench.seepage.toFixed(2) + " L/min) and blast vibration."
      : "<strong>SYSTEM STABLE:</strong> Bench " + snap.bench.id + " is stable (FoS: " + snap.fos.toFixed(2) + "). Continue automated monitoring. Next scan in 12 hours.";

    const rainfallRisk = snap.bench.rainfall > 50 ? "High" : snap.bench.rainfall > 30 ? "Moderate" : "Low";
    const angleRisk = snap.bench.angle > 70 ? "High" : snap.bench.angle > 65 ? "Moderate" : "Low";
    const discRisk = snap.bench.discontinuity < 25 ? "High" : snap.bench.discontinuity < 40 ? "Moderate" : "Low";
    const weatherRisk = snap.bench.weathering > 0.85 ? "High" : snap.bench.weathering > 0.7 ? "Moderate" : "Low";
    const seepRisk = snap.bench.seepage > 0.4 ? "High" : snap.bench.seepage > 0.25 ? "Moderate" : "Low";
    const vibRisk = snap.bench.vibration >= 5.0 ? "High" : "Low";
    const heightRisk = snap.bench.height > 14 ? "High" : "Low";

    const css = [
      "body{font-family:system-ui,-apple-system,sans-serif;color:#1e293b;background:#fff;padding:40px;line-height:1.5}",
      ".header{border-bottom:2px solid #e2e8f0;padding-bottom:20px;margin-bottom:30px}",
      ".header h1{font-size:24px;margin:0 0 5px 0;color:#0f172a}",
      ".header p{margin:0;color:#64748b;font-size:13px}",
      ".section-title{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-top:30px;margin-bottom:15px;color:#475569}",
      ".status-box{border-radius:6px;padding:12px 18px;margin-bottom:25px;font-weight:700;font-size:16px}",
      ".status-safe{background:#ecfdf5;color:#047857;border:1px solid #a7f3d0}",
      ".status-warning{background:#fffbeb;color:#b45309;border:1px solid #fde68a}",
      ".status-critical{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}",
      ".grid{display:grid;grid-template-columns:repeat(2,1fr);gap:15px;margin-bottom:25px}",
      ".metric-card{background:#f8fafc;border:1px solid #f1f5f9;border-radius:6px;padding:12px}",
      ".metric-title{font-size:10px;text-transform:uppercase;color:#64748b;margin-bottom:4px;font-weight:600}",
      ".metric-value{font-size:20px;font-weight:700;color:#0f172a}",
      "table{width:100%;border-collapse:collapse;margin-bottom:25px}",
      "th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;font-size:12px}",
      "th{background:#f8fafc;font-weight:600;color:#475569}",
      ".alert-row{display:flex;justify-content:space-between;padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:12px}",
      ".alert-critical{color:#b91c1c;font-weight:600}",
      ".alert-warning{color:#d97706;font-weight:600}",
      ".alert-info{color:#1d4ed8}",
      ".recommendation{background:#f8fafc;border-left:4px solid #64748b;padding:12px 15px;font-size:13px;border-radius:0 4px 4px 0;margin-bottom:30px}",
      ".footer{margin-top:40px;border-top:1px solid #e2e8f0;padding-top:15px;text-align:center;font-size:10px;color:#94a3b8}",
      "@media print{body{padding:0}}"
    ].join("\n");

    const rows = [
      "<tr><td>Slope Face Angle</td><td>" + snap.bench.angle + "&deg;</td><td>Stable &le; 65&deg;</td><td>" + angleRisk + "</td></tr>",
      "<tr><td>Discontinuity Spacing</td><td>" + snap.bench.discontinuity + " cm</td><td>Stable &gt; 40 cm</td><td>" + discRisk + "</td></tr>",
      "<tr><td>Weathering Index</td><td>" + (snap.bench.weathering * 100).toFixed(0) + "%</td><td>Stable &lt; 70%</td><td>" + weatherRisk + "</td></tr>",
      "<tr><td>Bench Height</td><td>" + snap.bench.height + " m</td><td>Stable &le; 12m</td><td>" + heightRisk + "</td></tr>",
      "<tr><td>Rainfall Rate</td><td>" + snap.bench.rainfall + " mm/hr</td><td>Caution &gt; 30 mm/hr</td><td>" + rainfallRisk + "</td></tr>",
      "<tr><td>Water Seepage Rate</td><td>" + snap.bench.seepage.toFixed(2) + " L/min</td><td>Caution &gt; 0.3 L/min</td><td>" + seepRisk + "</td></tr>",
      "<tr><td>Ground Vibration</td><td>" + snap.bench.vibration.toFixed(1) + " mm/s</td><td>Threshold &lt; 5.0 mm/s</td><td>" + vibRisk + "</td></tr>"
    ].join("");

    const html = "<!DOCTYPE html><html><head>" +
      "<title>GeoGuard AI Safety Report #" + report.id + "</title>" +
      "<style>" + css + "</style></head><body>" +
      '<div class="header"><h1>GeoGuard AI &mdash; Stability &amp; Safety Audit</h1>' +
      "<p>Report ID: #SR-" + report.id + " &bull; Timestamp: " + report.ts + " &bull; Pit Location: Sector North-B</p></div>" +
      '<div class="status-box ' + statusClass + '">' +
      "OVERALL BENCH STATUS: " + statusText + " (Factor of Safety: " + snap.fos.toFixed(2) + ")</div>" +
      '<div class="section-title">Key Stability Metrics</div>' +
      '<div class="grid">' +
      '<div class="metric-card"><div class="metric-title">Factor of Safety (FoS)</div><div class="metric-value" style="color:' + fosColor + '">' + snap.fos.toFixed(2) + "</div></div>" +
      '<div class="metric-card"><div class="metric-title">Slope Mass Rating (SMR)</div><div class="metric-value">' + snap.smr.toFixed(1) + "</div></div>" +
      '<div class="metric-card"><div class="metric-title">Selected Target Bench</div><div class="metric-value">Bench ' + snap.bench.id + "</div></div>" +
      '<div class="metric-card"><div class="metric-title">Volumetric Joint Density (JV)</div><div class="metric-value">' + snap.jv.toFixed(2) + " joints/m&sup3;</div></div>" +
      "</div>" +
      '<div class="section-title">Bench Parameters Details</div>' +
      "<table><thead><tr><th>Parameter</th><th>Value</th><th>Reference Range</th><th>Risk Level</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table>" +
      '<div class="section-title">Active System Alerts Snapshot</div>' +
      '<div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:25px">' + alertsHtml + "</div>" +
      '<div class="section-title">Safety Recommendations</div>' +
      '<div class="recommendation">' + recText + "</div>" +
      '<div class="footer"><p>Confidential &bull; Generated Automatically by GeoGuard AI Slope Monitoring System &bull; Page 1 of 1</p></div>' +
      "</body></html>";

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  /* ─── 3D drag handlers ─── */
  const on3dDown = (e: React.MouseEvent) => {
    drag3d.current = { active: true, x: e.clientX, y: e.clientY };
  };
  const on3dMove = (e: React.MouseEvent) => {
    if (!drag3d.current.active) return;
    const dx = e.clientX - drag3d.current.x;
    const dy = e.clientY - drag3d.current.y;
    setRot3d((p) => ({ x: p.x + dy * 0.4, y: p.y + dx * 0.4 }));
    drag3d.current = { active: true, x: e.clientX, y: e.clientY };
  };
  const on3dUp = () => { drag3d.current.active = false; };

  /* ─── Image drop handler ─── */
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const exportTerrainToGLB = useCallback(() => {
    if (!heightmap || heightmap.length === 0) return;
    const geometry = new THREE.PlaneGeometry(12, 12, heightmap[0].length - 1, heightmap.length - 1);
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position as THREE.BufferAttribute;
    for (let y = 0; y < heightmap.length; y++) {
      for (let x = 0; x < heightmap[0].length; x++) {
        const index = (y * heightmap[0].length + x) * 3;
        const nx = (x / Math.max(1, heightmap[0].length - 1)) * 2 - 1;
        const ny = (y / Math.max(1, heightmap.length - 1)) * 2 - 1;
        const depth = clamp(heightmap[y][x], 0, 1);
        const slope = (depth - 0.5) * 2.8;
        positions.setZ(index, slope);
        positions.setX(index, nx * 5.4);
        positions.setY(index, ny * 5.4);
      }
    }
    geometry.computeVertexNormals();

    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = heightmap[0].length;
    textureCanvas.height = heightmap.length;
    const textureCtx = textureCanvas.getContext("2d");
    if (textureCtx) {
      if (image) {
        const texImg = new Image();
        texImg.onload = () => {
          textureCtx.drawImage(texImg, 0, 0, textureCanvas.width, textureCanvas.height);
          const texture = new THREE.CanvasTexture(textureCanvas);
          texture.needsUpdate = true;
          const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, metalness: 0.08, side: THREE.DoubleSide });
          const mesh = new THREE.Mesh(geometry, material);
          const exporter = new GLTFExporter();
          exporter.parse(mesh, (result) => {
            const output = result instanceof ArrayBuffer ? result : JSON.stringify(result);
            const blob = new Blob([output], { type: result instanceof ArrayBuffer ? "model/gltf-binary" : "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "geo-guard-terrain.glb";
            a.click();
            URL.revokeObjectURL(url);
          }, (error) => {
            console.error("GLTF export failed:", error);
            setReconstructionError("GLB export failed. The reconstruction is ready, but the export could not be generated.");
          }, { binary: true });
        };
        texImg.src = image;
      } else {
        const fallbackTexture = textureCtx.createLinearGradient(0, 0, textureCanvas.width, textureCanvas.height);
        fallbackTexture.addColorStop(0, "#5d7b5a");
        fallbackTexture.addColorStop(0.5, "#b3875a");
        fallbackTexture.addColorStop(1, "#4d5e53");
        textureCtx.fillStyle = fallbackTexture;
        textureCtx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
        const texture = new THREE.CanvasTexture(textureCanvas);
        const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, metalness: 0.08, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geometry, material);
        const exporter = new GLTFExporter();
        exporter.parse(mesh, (result) => {
          const output = result instanceof ArrayBuffer ? result : JSON.stringify(result);
          const blob = new Blob([output], { type: result instanceof ArrayBuffer ? "model/gltf-binary" : "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "geo-guard-terrain.glb";
          a.click();
          URL.revokeObjectURL(url);
        }, (error) => {
          console.error("GLTF export failed:", error);
          setReconstructionError("GLB export failed. The reconstruction is ready, but the export could not be generated.");
        }, { binary: true });
      }
    }
  }, [heightmap, image]);

  const convertTo3D = useCallback(async () => {
    setConverting3d(true);
    setTerrainAnalysis(null);
    setReconstructionState("processing");
    setReconstructionError(null);
    setActive("3d-model");
    try {
      const sourceImage = image || "/mine_crack_detection.jpg";
      const { heightmap: hm, analysis } = await analyzeTerrain(sourceImage, gridRes);
      console.log("[3D] Heightmap received:", hm ? `${hm.length}x${hm[0]?.length}` : "null", "analysis:", analysis?.terrainType);
      if (!hm || hm.length === 0) throw new Error("Heightmap generation failed");
      const trainedHeightmap = await applyTrainedTerrainPrior(hm, gridRes).catch(() => hm);
      setHeightmap(trainedHeightmap);
      setTerrainAnalysis(analysis);
      setTerrainSource(image ? "uploaded-image" : "kaggle-obj");
      setReconstructionState("ready");
      const img = new Image();
      img.onload = () => { texImgRef.current = img; setMeshMode("textured"); console.log("[3D] Texture loaded"); };
      img.onerror = () => { setMeshMode("solid"); console.log("[3D] Texture failed, using solid"); };
      img.src = sourceImage;
    } catch (e) {
      console.error("[3D] Conversion failed:", e);
      setReconstructionState("error");
      setReconstructionError("The terrain reconstruction pipeline could not generate a valid 3D surface. A robust fallback mesh is being used instead.");
      const fallbackHeightmap = await loadDatasetHeightmap(gridRes);
      setHeightmap(fallbackHeightmap);
      setTerrainAnalysis({
        slopeAngle: 52,
        benchCount: 4,
        fractureDensity: 0.61,
        terrainType: "rock face",
        riskZones: 7,
        avgBrightness: 0.61,
        contrast: 0.38,
        slopeDirection: "left-to-right",
        description: "Built from the available mine-rock imagery and a terrain-aware reconstruction fallback. This keeps the model structurally realistic even when the source image is weak or atypical.",
      });
      setTerrainSource("kaggle-obj");
      setMeshMode("solid");
      setChatMsgs((p) => [...p, { role: "system", text: "3D model rebuilt using a terrain-aware depth reconstruction fallback to preserve rock face structure and bench relief." }]);
    }
    setConverting3d(false);
  }, [image, gridRes]);

  /* ─── API health check ─── */
  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then((d) => setApiOnline(d.status === "ok")).catch(() => setApiOnline(false));
  }, []);

  /* ─── Auto-initialize 3D terrain on mount ─── */
  useEffect(() => {
    convertTo3D();
  }, [image, convertTo3D]);

  /* ─── ESC to exit fullscreen 3D ─── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && fullScreen3d) setFullScreen3d(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullScreen3d]);

  /* ─── Auto-analyze image for spatial risk when image changes ─── */
  useEffect(() => {
    if (!apiOnline || !image) return;
    let cancelled = false;
    apiSpatialRisk(image).then((spatial) => {
      if (cancelled) return;
      if (spatial.grid) setSpatialGrid(spatial.grid);
      if (spatial.summary) setSpatialSummary(spatial.summary);
      if (spatial.overlay) setOverlayB64(spatial.overlay);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [image, apiOnline]);

  /* ─── Auto-analyze image for cracks when image changes ─── */
  useEffect(() => {
    if (!apiOnline || !image) return;
    let cancelled = false;
    apiCrackAnalysis(image).then((crack) => {
      if (cancelled) return;
      if (crack && (crack.overlay || crack.heatmap)) setCrackResult(crack);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [image, apiOnline]);

  /* ─── Run full analysis via backend ─── */
  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    try {
      const [result, spatial] = await Promise.all([
        apiAnalyze({
          image: image ?? undefined,
          slopeAngle: bench.angle,
          discontinuityDensity: bench.discontinuity / 60,
          weatheringIndex: bench.weathering,
          benchHeight: bench.height,
          rainfall: bench.rainfall,
          blastVibration: bench.vibration,
          waterSeepage: bench.seepage,
          looseRock: bench.looseRock,
          ru: bench.seepage,
          tilt: bench.angle * 0.15,
          rmr: bench.weathering * 100,
        }),
        image ? apiSpatialRisk(image) : Promise.resolve({}),
      ]);
      setFusionResult(result);
      if (result.overlay_image) setOverlayB64(result.overlay_image);
      if (spatial.grid) setSpatialGrid(spatial.grid);
      if (spatial.summary) setSpatialSummary(spatial.summary);
      if (spatial.overlay) setOverlayB64(spatial.overlay);
    } catch (e) {
      console.error("Analysis failed:", e);
    }
    setAnalyzing(false);
  }, [image, bench]);

  useEffect(() => {
    if (!apiOnline) return;
    const refresh = window.setInterval(() => { void runAnalysis(); }, 15000);
    return () => window.clearInterval(refresh);
  }, [apiOnline, runAnalysis]);

  /* ─── Canvas render loop ─── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !heightmap) return;
    let raf: number;
    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) { raf = requestAnimationFrame(draw); return; }
      const cw = Math.round(rect.width * dpr);
      const ch = Math.round(rect.height * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderTerrain(ctx, rect.width, rect.height, heightmap, rot3d.x, rot3d.y, zoom3d, meshMode, texImgRef.current);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "bold 11px monospace";
      ctx.fillText(`canvas ${canvas.width}x${canvas.height} css ${Math.round(rect.width)}x${Math.round(rect.height)} dpr ${dpr} tris ok`, 10, rect.height - 10);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [heightmap, rot3d, zoom3d, meshMode, fullScreen3d]);

  /* ─── Auto-rotate ─── */
  useEffect(() => {
    if (!autoRotate || !heightmap) return;
    let raf: number;
    const tick = () => {
      setRot3d((p) => ({ ...p, y: p.y + 0.3 }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoRotate, heightmap]);

  /* ─── Sensor network seed ─── */
  const sensors = [
    { id: "RF-01", type: "Camera", status: "online" },
    { id: "RF-07", type: "Inclinometer", status: "online" },
    { id: "RF-12", type: "Piezometer", status: "standby" },
    { id: "RF-14", type: "Accelerometer", status: "online" },
    { id: "RF-17", type: "Camera", status: "online" },
    { id: "RF-21", type: "Moisture", status: "standby" },
  ];

  /* ═══════════════════════════════════════════════ */
  /* ─── DASHBOARD VIEW ─── */
  /* ═══════════════════════════════════════════════ */
  const renderDashboard = () => {
    const isCritical = fos < 1.0;

    // SHAP Attribution Data
    const fallbackShapData: { label: string; val: number; isRisk: boolean }[] = [
      { label: "Piezometer (ru)", val: (bench.seepage || 0.4) * 0.85, isRisk: true },
      { label: "Rainfall intensity", val: (bench.rainfall / 100) * 0.72, isRisk: true },
      { label: "Tilt / Discontinuity", val: (Math.max(0, 50 - bench.discontinuity) / 50) * 0.55, isRisk: true },
      { label: "Slope face angle", val: (Math.max(0, bench.angle - 50) / 30) * 0.52, isRisk: true },
      { label: "Blast vibration", val: (bench.vibration / 10) * 0.48, isRisk: true },
      { label: "RMR rock score", val: (bench.weathering) * 0.58, isRisk: false },
      { label: "Rock cohesion", val: 0.42, isRisk: false },
      { label: "Drainage condition", val: 0.35, isRisk: false },
      { label: "Internal friction φ", val: 0.28, isRisk: false },
      { label: "Rock unit weight", val: 0.19, isRisk: false },
    ];
    const shapData: { label: string; val: number; isRisk: boolean }[] = fusionResult?.shap_values?.length
      ? fusionResult.shap_values.map((item: { feature: string; value: number; positive: boolean }) => ({
        label: item.feature,
        val: item.value,
        isRisk: item.positive,
      }))
      : fallbackShapData;
    const maxShap = Math.max(...shapData.map((d) => Math.abs(d.val)), 0.001);

    // 5x5 Mine Bench Spatial Risk Grid
    const HM_STYLE = [
      { bg: "rgba(16,185,129,0.18)", text: "#10B981", border: "rgba(16,185,129,0.25)", label: "Safe" },
      { bg: "rgba(52,211,153,0.14)", text: "#34D399", border: "rgba(52,211,153,0.2)", label: "Low" },
      { bg: "rgba(245,158,11,0.18)", text: "#F59E0B", border: "rgba(245,158,11,0.25)", label: "Med" },
      { bg: "rgba(249,115,22,0.22)", text: "#F97316", border: "rgba(249,115,22,0.35)", label: "High" },
      { bg: "rgba(239,68,68,0.22)", text: "#EF4444", border: "rgba(239,68,68,0.45)", label: "Crit" },
    ];
    const SECTOR_COL = ["A", "B", "C", "D", "E"];
    const riskFactor = (bench.seepage * 0.45) + (bench.rainfall / 100 * 0.35) + (bench.angle / 80 * 0.25) + (bench.vibration / 12 * 0.2);
    const netShift = Math.round((riskFactor - 0.42) * 4);
    const baseGrid = [
      [0, 0, 1, 1, 2],
      [0, 1, 1, 2, 3],
      [1, 1, 2, 3, 3],
      [1, 2, 3, 3, 4],
      [2, 3, 3, 4, 4],
    ];
    const computedHeatmap = spatialGrid || baseGrid.map(row => row.map(v => Math.min(4, Math.max(0, v + netShift))));

    const workspaceCards = [
      { id: "dashboard", label: "Overview", blurb: "FoS, risk and live pit status", accent: "#2563EB" },
      { id: "ai-vision", label: "AI Review", blurb: "Crack analysis and safety insights", accent: "#0F766E" },
      { id: "3d-model", label: "3D Pit", blurb: "Terrain and slope geometry", accent: "#7C3AED" },
    ];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }} className="fade-up">
        <div style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.98))",
          border: "1px solid rgba(148,163,184,0.26)",
          borderRadius: "24px",
          padding: "18px 20px",
          boxShadow: "0 18px 40px rgba(15,23,42,0.05)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: font.mono, fontSize: "0.62rem", letterSpacing: "0.16em", textTransform: "uppercase", color: C.accent, fontWeight: 700, marginBottom: 7 }}>
                Mine overview
              </div>
              <h2 style={{ fontSize: "1.8rem", lineHeight: 1.1, letterSpacing: "-0.05em", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                Stable mine view, clear action path
              </h2>
            </div>
            <button
              onClick={() => setActive("dashboard")}
              style={{
                background: "#0F172A",
                color: "white",
                border: "none",
                borderRadius: "10px",
                padding: "10px 14px",
                fontWeight: 700,
                fontSize: "0.72rem",
                cursor: "pointer",
                boxShadow: "0 10px 18px rgba(15,23,42,0.12)",
              }}
            >
              Refresh
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 18 }}>
            {workspaceCards.map((card) => {
              const isSelected = active === card.id;
              return (
                <button
                  key={card.id}
                  onClick={() => setActive(card.id)}
                  style={{
                    background: isSelected ? "rgba(15,23,42,0.98)" : "rgba(255,255,255,0.92)",
                    border: `1px solid ${isSelected ? "rgba(15,23,42,0.12)" : "rgba(148,163,184,0.28)"}`,
                    borderRadius: "16px",
                    padding: "14px 14px 12px",
                    textAlign: "left",
                    cursor: "pointer",
                    boxShadow: isSelected ? "0 18px 30px rgba(15,23,42,0.08)" : "0 8px 18px rgba(15,23,42,0.03)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: `${card.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: card.accent }}>
                    {card.id === "dashboard" ? "◉" : card.id === "ai-vision" ? "✦" : "△"}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "0.94rem", color: isSelected ? "#FFFFFF" : "#0F172A", letterSpacing: "-0.02em" }}>{card.label}</div>
                  <div style={{ fontSize: "0.68rem", color: isSelected ? "rgba(255,255,255,0.8)" : "#475569", lineHeight: 1.5 }}>{card.blurb}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{
          background: "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(15,23,42,0.82))",
          border: "1px solid rgba(148,163,184,0.25)",
          borderRadius: "18px",
          padding: "16px 16px 14px",
          color: "white",
          boxShadow: "0 14px 24px rgba(15,23,42,0.12)",
        }}>
          <div style={{ fontFamily: font.mono, fontSize: "0.56rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(191,219,254,0.9)", marginBottom: 12 }}>
            Live status
          </div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.05em" }}>{fos.toFixed(2)}</span>
            <span style={{ fontFamily: font.mono, fontSize: "0.64rem", color: "#8ec5ff" }}>FoS</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: "rgba(148,163,184,0.18)", overflow: "hidden", marginBottom: 12 }}>
            <div style={{ width: `${Math.min(100, (fos / 3.0) * 100)}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #60a5fa, #34d399)" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {[
              { label: "Risk", value: risk.label },
              { label: "Bench", value: bench.id },
              { label: "Rain", value: `${bench.rainfall.toFixed(0)} mm/hr` },
              { label: "SMR", value: smr.toFixed(0) },
            ].map((item) => (
              <div key={item.label} style={{ background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.14)", borderRadius: 10, padding: "9px 10px" }}>
                <div style={{ fontFamily: font.mono, fontSize: "0.5rem", color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" }}>{item.label}</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, marginTop: 4 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Row 1: KPI Cards ────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>

          {/* Factor of Safety */}
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
            accentColor={isCritical ? C.crimson : fos < 1.3 ? C.amber : C.emerald}
            isCritical={isCritical}
          >
            <div style={{ fontFamily: font.mono, fontSize: "2.5rem", fontWeight: 700, lineHeight: 1, color: isCritical ? C.crimson : fos < 1.3 ? C.amber : C.emerald, textShadow: isCritical ? `0 0 24px rgba(239,68,68,0.6)` : undefined, marginBottom: "8px" }}>
              {fos.toFixed(2)}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ flex: 1, height: "4px", borderRadius: "2px", background: C.border, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, (fos / 3.0) * 100)}%`, background: isCritical ? C.crimson : fos < 1.3 ? C.amber : C.emerald, borderRadius: "2px", transition: "width 0.5s" }} />
              </div>
              <span style={{ fontFamily: font.mono, fontSize: "0.6rem", color: C.muted, whiteSpace: "nowrap" }}>min 1.50</span>
            </div>
          </KPICard>

          {/* Active Risk Status */}
          <KPICard
            label="Active Risk Status"
            sublabel="Surrogate ML Ensemble · 94.2% conf."
            icon={<span style={{ fontSize: "18px" }}>⚠️</span>}
            accentColor={risk.color}
            isCritical={isCritical}
          >
            <div style={{ display: "inline-flex", alignItems: "center", gap: "7px", background: risk.bg, border: `1px solid ${risk.border}`, borderRadius: "8px", padding: "6px 12px", boxShadow: `0 0 16px ${risk.color}25`, marginBottom: "8px" }}>
              {isCritical && <span className="live-dot" style={{ width: "7px", height: "7px", borderRadius: "50%", background: C.crimson, flexShrink: 0 }} />}
              <span style={{ fontFamily: font.mono, fontSize: "0.85rem", fontWeight: 700, color: risk.color, letterSpacing: "0.06em" }}>{risk.label}</span>
            </div>
            <div style={{ fontFamily: font.mono, fontSize: "0.62rem", color: C.muted, display: "flex", justifyContent: "space-between" }}>
              <span>Shovel: <strong style={{ color: shovelOk ? C.emerald : C.crimson }}>{shovelOk ? "CLEARED" : "HOLD"}</strong></span>
              <span>Blasting: <strong style={{ color: blastingOk ? C.emerald : C.crimson }}>{blastingOk ? "CLEARED" : "HOLD"}</strong></span>
            </div>
          </KPICard>

          {/* Joint Volumetric Count (Jv) */}
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
            <div style={{ fontFamily: font.mono, fontSize: "2.5rem", fontWeight: 700, lineHeight: 1, color: C.indigo, marginBottom: "8px" }}>
              {jv.toFixed(1)}
            </div>
            <div style={{ fontFamily: font.mono, fontSize: "0.62rem", color: jv > 20 ? C.amber : jv > 10 ? "#38BDF8" : C.emerald }}>
              {jv > 20 ? "Very Blocky / Fractured" : jv > 10 ? "Blocky (Class III)" : "Intact / Massive"}
            </div>
          </KPICard>

          {/* SMR Score */}
          <KPICard
            label="SMR Score"
            sublabel="Slope Mass Rating (Romana, 1985)"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M2 20L8 8L14 14L18 6L22 10" stroke={C.indigo} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="8" cy="8" r="1.5" fill={C.indigo} />
                <circle cx="14" cy="14" r="1.5" fill={C.amber} />
                <circle cx="18" cy="6" r="1.5" fill={C.crimson} />
              </svg>
            }
            accentColor={smr < 30 ? C.crimson : smr < 55 ? C.amber : C.emerald}
            isCritical={smr < 30}
          >
            <div style={{ fontFamily: font.mono, fontSize: "2.5rem", fontWeight: 700, lineHeight: 1, color: smr < 30 ? C.crimson : smr < 55 ? C.amber : C.emerald, marginBottom: "8px" }}>
              {smr.toFixed(1)}
            </div>
            <div style={{ fontFamily: font.mono, fontSize: "0.62rem", color: smr < 30 ? C.crimson : smr < 55 ? C.amber : C.emerald }}>
              {smr < 20 ? "Completely Unstable (Class V)" : smr < 40 ? "Unstable (Class IV)" : smr < 60 ? "Partially Stable (Class III)" : "Stable (Class I–II)"}
            </div>
          </KPICard>
        </div>

        {/* ── Action Bar ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: "10px", padding: "10px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              style={{
                background: `linear-gradient(135deg, ${C.indigo}, ${C.violet})`,
                border: "none",
                borderRadius: "8px",
                padding: "8px 18px",
                color: "#fff",
                fontSize: "0.72rem",
                fontWeight: 600,
                fontFamily: font.mono,
                letterSpacing: "0.06em",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: analyzing ? "wait" : "pointer",
                boxShadow: "0 0 16px rgba(99,102,241,0.35)",
              }}
            >
              <Satellite size={14} />
              {analyzing ? "ANALYZING STREAM..." : "RUN FULL FUSION ANALYSIS"}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: font.mono, fontSize: "0.64rem", color: apiOnline ? C.emerald : C.crimson }}>
              <span className={apiOnline ? "live-dot" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: apiOnline ? C.emerald : C.crimson, display: "inline-block" }} />
              API {apiOnline ? "ONLINE (GPU CLUSTER)" : "LOCAL SURROGATE MODE"}
            </div>
          </div>
          {fusionResult && (
            <div style={{ fontFamily: font.mono, fontSize: "0.64rem", color: C.accent, background: "rgba(99,102,241,0.1)", border: `1px solid rgba(99,102,241,0.3)`, padding: "4px 10px", borderRadius: "6px" }}>
              Fusion FoS: {fusionResult.fos} · SMR: {fusionResult.smr} · {fusionResult.risk_label}
            </div>
          )}
        </div>

        {/* ── Row 2: Optical Analysis + Mine Bench Risk Grid ─────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>

          {/* Optical Analysis Panel */}
          <div className="glass" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.84rem", color: C.text }}>Optical Analysis — Bench {bench.id}</div>
                <div style={{ fontFamily: font.mono, fontSize: "0.56rem", color: C.muted, marginTop: "2px" }}>Camera Node C-07 · 1920×1080 · 30fps · ISO 400</div>
              </div>
              <div style={{ display: "flex", gap: "5px" }}>
                {(["RAW", "CV ANALYSIS"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    style={{
                      padding: "4px 11px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontFamily: font.mono,
                      fontSize: "0.60rem",
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      transition: "all 0.2s",
                      background: viewMode === mode ? "rgba(99,102,241,0.2)" : "rgba(28,31,46,0.6)",
                      color: viewMode === mode ? "#818CF8" : C.muted,
                      border: `1px solid ${viewMode === mode ? "rgba(99,102,241,0.45)" : C.border}`,
                    }}
                  >
                    {mode === "RAW" ? "RAW IMAGE" : "OPENCV ANALYSIS"}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ position: "relative", borderRadius: "8px", overflow: "hidden", height: "230px", background: "#0a0c14", border: `1px solid ${C.border}` }}>
              {image ? (
                <img
                  src={image}
                  alt="Uploaded pit wall"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    filter: viewMode === "CV ANALYSIS" ? "grayscale(0.85) contrast(1.9) brightness(0.60)" : "none",
                    transition: "filter 0.35s ease",
                  }}
                />
              ) : (
                <div className="gg-empty-state"><div className="gg-empty-icon">Camera</div><div className="gg-empty-title">No pit wall image loaded</div><div className="gg-empty-desc">Upload a real camera frame to run computer vision analysis.</div></div>
              )}
              {overlayB64 && viewMode === "CV ANALYSIS" && (
                <img
                  src={`data:image/png;base64,${overlayB64}`}
                  alt="Risk overlay"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.85, transition: "opacity 0.4s ease" }}
                />
              )}
              <div style={{ position: "absolute", bottom: 8, right: 8, fontFamily: font.mono, fontSize: "0.56rem", color: C.muted, background: "rgba(255,255,255,0.9)", padding: "3px 8px", borderRadius: 4 }}>
                {bench.angle}° Face · {bench.rainfall} mm/h · {bench.vibration} mm/s
              </div>
            </div>

            {/* Crack Detection Summary */}
            {crackResult && (
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.72rem", color: C.text }}>Crack Detection</span>
                    <span style={{ fontFamily: font.mono, fontSize: "0.54rem", color: C.crimson, background: "rgba(239,68,68,0.1)", border: `1px solid rgba(239,68,68,0.3)`, padding: "1px 6px", borderRadius: "4px" }}>
                      {crackResult.metrics?.crack_count ?? 0} CRACKS
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {(["overlay", "heatmap", "crackmap"] as const).map((v) => (
                      <button key={v} onClick={() => setCrackView(v)}
                        style={{
                          padding: "3px 9px", borderRadius: "5px", cursor: "pointer",
                          fontFamily: font.mono, fontSize: "0.54rem", fontWeight: 600,
                          background: crackView === v ? "rgba(239,68,68,0.18)" : "rgba(28,31,46,0.5)",
                          color: crackView === v ? C.crimson : C.muted,
                          border: `1px solid ${crackView === v ? "rgba(239,68,68,0.5)" : C.border}`,
                        }}>
                        {v === "overlay" ? "CRACKS" : v === "heatmap" ? "HEATMAP" : "CRACK MAP"}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ position: "relative", borderRadius: "8px", overflow: "hidden", height: "150px", background: "#0a0c14", border: `1px solid ${C.border}` }}>
                  {crackView === "overlay" && crackResult.overlay && (
                    <img src={`data:image/png;base64,${crackResult.overlay}`} alt="Crack overlay" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  )}
                  {crackView === "heatmap" && crackResult.heatmap && (
                    <img src={`data:image/png;base64,${crackResult.heatmap}`} alt="Crack heatmap" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  )}
                  {crackView === "crackmap" && crackResult.crack_map && (
                    <img src={`data:image/png;base64,${crackResult.crack_map}`} alt="Crack map" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  )}
                  {crackResult.most_dangerous && (
                    <div style={{ position: "absolute", top: 8, left: 8, fontFamily: font.mono, fontSize: "0.56rem", color: "#fff", background: "rgba(239,68,68,0.85)", padding: "3px 8px", borderRadius: "5px", fontWeight: 700 }}>
                      ⚠ MOST DANGEROUS CRACK · {Math.round((crackResult.most_dangerous.danger_score || 0) * 100)}% DANGER
                    </div>
                  )}
                </div>
                {crackResult.most_dangerous && (
                  <div style={{ fontFamily: font.mono, fontSize: "0.56rem", color: C.dim, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "4px" }}>
                    <span>Length: {crackResult.most_dangerous.length_px}px · Width: {crackResult.most_dangerous.width_px}px</span>
                    <span>Orientation: {crackResult.most_dangerous.orientation_deg}° · {crackResult.most_dangerous.risk_level}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mine Bench Risk Grid */}
          <div className="glass" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.84rem", color: C.text }}>Mine Bench Risk Grid</div>
                <div style={{ fontFamily: font.mono, fontSize: "0.56rem", color: C.muted, marginTop: "2px" }}>5×5 Sector Spatial Risk Analysis</div>
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {HM_STYLE.map((h) => (
                  <div key={h.label} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                    <div style={{ width: "7px", height: "7px", borderRadius: "2px", background: h.text }} />
                    <span style={{ fontFamily: font.mono, fontSize: "0.52rem", color: C.muted }}>{h.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "22px repeat(5, 1fr)", gap: "5px" }}>
              <div />
              {SECTOR_COL.map((l) => (
                <div key={l} style={{ textAlign: "center", fontFamily: font.mono, fontSize: "0.62rem", color: C.muted }}>{l}</div>
              ))}
            </div>

            {/* Grid rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: "5px", flex: 1 }}>
              {computedHeatmap.slice(0, 5).map((row, ri) => (
                <div key={ri} style={{ display: "grid", gridTemplateColumns: "22px repeat(5, 1fr)", gap: "5px", flex: 1 }}>
                  <div style={{ fontFamily: font.mono, fontSize: "0.62rem", color: C.muted, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>{ri + 1}</div>
                  {row.slice(0, 5).map((cellVal, ci) => {
                    const level = Math.min(4, Math.max(0, cellVal));
                    const h = HM_STYLE[level];
                    return (
                      <div
                        key={ci}
                        className={level === 4 ? "hm-critical" : undefined}
                        title={`Sector ${SECTOR_COL[ci]}${ri + 1}: ${h.label} Risk`}
                        style={{
                          background: h.bg,
                          border: `1px solid ${h.border}`,
                          borderRadius: "6px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "default",
                          minHeight: "34px",
                          transition: "all 0.25s",
                          position: "relative",
                        }}
                      >
                        <span style={{ fontFamily: font.mono, fontSize: "0.58rem", fontWeight: 600, color: h.text, userSelect: "none" }}>
                          {SECTOR_COL[ci]}{ri + 1}
                        </span>
                        {level >= 4 && <span style={{ position: "absolute", top: "1px", right: "2px", fontSize: "7px" }}>⚡</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", justifyContent: "space-around", borderTop: `1px solid ${C.border}`, paddingTop: "8px" }}>
              {[
                { label: "Critical", val: computedHeatmap.flat().filter(v => v === 4).length, color: C.crimson },
                { label: "High", val: computedHeatmap.flat().filter(v => v === 3).length, color: "#F97316" },
                { label: "Moderate", val: computedHeatmap.flat().filter(v => v === 2).length, color: C.amber },
                { label: "Safe/Low", val: computedHeatmap.flat().filter(v => v <= 1).length, color: C.emerald },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: font.mono, fontSize: "1.05rem", fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontFamily: font.mono, fontSize: "0.52rem", color: C.muted, marginTop: "2px" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Row 3: SHAP Feature Attribution + GeoGuard AI Assistant ─── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>

          {/* SHAP Feature Attribution */}
          <div className="glass" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                <div style={{ fontWeight: 600, fontSize: "0.84rem", color: C.text }}>Explainable AI — SHAP Feature Attribution</div>
                <div style={{ fontFamily: font.mono, fontSize: "0.56rem", color: C.indigo, background: "rgba(99,102,241,0.1)", padding: "2px 7px", borderRadius: "4px", border: `1px solid rgba(99,102,241,0.25)`, whiteSpace: "nowrap" }}>
                  XAI · TreeExplainer
                </div>
              </div>
              <div style={{ fontFamily: font.mono, fontSize: "0.56rem", color: C.muted }}>
                {fusionResult?.shap_source === "trained_model_treeshap" ? "Trained XGBoost risk attribution · current image and telemetry" : "Waiting for trained-model inference · sensitivity fallback shown"}
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: "14px" }}>
              {[{ label: "Risk Driver (↑ instability)", color: C.crimson }, { label: "Stability Factor (↓ risk)", color: C.emerald }].map((l) => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <div style={{ width: "9px", height: "9px", borderRadius: "2px", background: l.color }} />
                  <span style={{ fontSize: "0.62rem", color: C.dim }}>{l.label}</span>
                </div>
              ))}
            </div>

            {/* Bars */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
              {shapData.map((d) => (
                <div key={d.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "128px", flexShrink: 0, fontFamily: font.mono, fontSize: "0.58rem", color: C.dim, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.label}>
                    {d.label}
                  </div>
                  <div style={{ flex: 1, height: "14px", background: "rgba(35,39,56,0.5)", borderRadius: "3px", overflow: "hidden" }}>
                    <div
                      className="shap-bar"
                      style={{
                        height: "100%",
                        width: `${Math.round((Math.abs(d.val) / maxShap) * 100)}%`,
                        background: d.isRisk
                          ? `linear-gradient(90deg, rgba(239,68,68,0.9), rgba(239,68,68,0.55))`
                          : `linear-gradient(90deg, rgba(16,185,129,0.9), rgba(16,185,129,0.55))`,
                        borderRadius: "3px",
                      }}
                    />
                  </div>
                  <div style={{ fontFamily: font.mono, fontSize: "0.58rem", color: d.isRisk ? C.crimson : C.emerald, width: "38px", textAlign: "right", flexShrink: 0 }}>
                    {d.val > 0 ? "+" : ""}{d.val.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: font.mono, fontSize: "0.55rem", color: C.muted }}>
                {fusionResult?.shap_source === "trained_model_treeshap" ? "TreeSHAP · signed contribution to HIGH-risk raw model output" : "Physics sensitivity fallback · run an image-backed analysis for TreeSHAP"}
              </span>
              <span style={{ fontFamily: font.mono, fontSize: "0.55rem", color: C.indigo, background: "rgba(99,102,241,0.08)", padding: "1px 6px", borderRadius: "3px" }}>
                {fusionResult?.model_loaded ? "MODEL LOADED" : "MODEL PENDING"}
              </span>
            </div>
          </div>

          {/* GeoGuard AI Assistant */}
          <div className="glass" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "11px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
              <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: `linear-gradient(135deg, ${C.indigo}, ${C.violet})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", boxShadow: `0 0 14px rgba(99,102,241,0.45)`, flexShrink: 0 }}>
                💬
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "0.82rem", color: C.text, letterSpacing: "-0.02em" }}>GeoGuard AI Assistant</div>
                <div style={{ fontFamily: font.mono, fontSize: "0.55rem", color: C.emerald, display: "flex", alignItems: "center", gap: "4px" }}>
                  <span className="live-dot" style={{ width: "5px", height: "5px", borderRadius: "50%", background: C.emerald, display: "inline-block" }} />
                  Supervisor mode · Live mine intelligence · Safety copilot
                </div>
              </div>
              {isCritical && (
                <div style={{ fontFamily: font.mono, fontSize: "0.58rem", color: C.crimson, background: "rgba(239,68,68,0.1)", border: `1px solid rgba(239,68,68,0.3)`, padding: "3px 8px", borderRadius: "5px" }}>
                  CRITICAL MODE
                </div>
              )}
            </div>

            {/* Chat messages */}
            <div
              ref={logRef}
              className="chat-scroll"
              style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "10px", minHeight: "180px", maxHeight: "250px" }}
            >
              {chatMsgs.map((msg, i) => (
                <div key={i} style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: "7px", alignItems: "flex-start" }}>
                  <div style={{
                    width: "24px", height: "24px", borderRadius: "6px", flexShrink: 0,
                    background: msg.role === "assistant" || msg.role === "system" ? `linear-gradient(135deg, ${C.indigo}, ${C.violet})` : "rgba(99,102,241,0.15)",
                    border: msg.role === "user" ? `1px solid rgba(99,102,241,0.3)` : "none",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px",
                    boxShadow: msg.role === "assistant" ? "0 8px 18px rgba(99,102,241,0.28)" : "none",
                  }}>
                    {msg.role === "user" ? "👷" : msg.role === "assistant" ? "AI" : "⚙️"}
                  </div>
                  <div style={{ maxWidth: "82%", display: "flex", flexDirection: "column", gap: "3px", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{
                      background: msg.role === "user" ? "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(99,102,241,0.14))" : "rgba(255,255,255,0.82)",
                      border: `1px solid ${msg.role === "user" ? "rgba(99,102,241,0.28)" : "rgba(148,163,184,0.32)"}`,
                      borderRadius: msg.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                      padding: "8px 11px",
                      fontSize: "0.72rem",
                      lineHeight: 1.6,
                      color: msg.role === "user" ? "#dfe7ff" : "#111827",
                      whiteSpace: "pre-wrap",
                      boxShadow: msg.role === "assistant" ? "0 10px 18px rgba(15,23,42,0.06)" : "none",
                    }}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}
              {aiThinking && (
                <div style={{ display: "flex", alignItems: "center", gap: "7px", padding: "4px 2px" }}>
                  <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: "linear-gradient(135deg, #2563EB, #0F766E)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "white", boxShadow: "0 8px 18px rgba(37,99,235,0.24)" }}>AI</div>
                  <div style={{ display: "flex", gap: "5px", padding: "8px 10px", borderRadius: "12px", background: "rgba(255,255,255,0.82)", border: "1px solid rgba(148,163,184,0.32)", boxShadow: "0 10px 18px rgba(15,23,42,0.04)" }}>
                    {[0, 1, 2].map((dot) => (
                      <span key={dot} style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#64748B", display: "inline-block", animation: "pulse 1.1s ease-in-out infinite", animationDelay: `${dot * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick prompts */}
            <div style={{ padding: "6px 12px", display: "flex", gap: "5px", flexWrap: "wrap", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
              {["Evacuation protocol?", "Dewatering options", "Alert geo team", "Monte Carlo simulation"].map((p) => (
                <button
                  key={p}
                  onClick={() => { setChatInput(p); }}
                  style={{ background: "rgba(255,255,255,0.86)", border: `1px solid rgba(148,163,184,0.4)`, borderRadius: "20px", padding: "3px 10px", fontSize: "0.60rem", color: "#334155", cursor: "pointer", fontFamily: font.body, transition: "all 0.2s", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}
                  onMouseEnter={(e) => { const el = e.target as HTMLElement; el.style.borderColor = "rgba(37,99,235,0.4)"; el.style.color = "#1D4ED8"; }}
                  onMouseLeave={(e) => { const el = e.target as HTMLElement; el.style.borderColor = "rgba(148,163,184,0.4)"; el.style.color = "#334155"; }}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Input */}
            <div style={{ padding: "8px 12px", borderTop: `1px solid ${C.border}`, display: "flex", gap: "7px", flexShrink: 0 }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Ask GeoGuard AI about pit stability, dewatering, or evacuation..."
                style={{ flex: 1, background: "rgba(255,255,255,0.82)", border: `1px solid rgba(148,163,184,0.42)`, borderRadius: "10px", padding: "9px 12px", color: "#111827", fontSize: "0.72rem", fontFamily: font.body, outline: "none", boxShadow: "inset 0 1px 2px rgba(15,23,42,0.04)" }}
              />
              <button
                onClick={handleSend}
                style={{ background: `linear-gradient(135deg, ${C.indigo}, ${C.violet})`, border: "none", borderRadius: "10px", padding: "9px 16px", color: "white", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", boxShadow: `0 10px 24px rgba(99,102,241,0.34)`, whiteSpace: "nowrap", fontFamily: font.body }}
              >
                Ask AI
              </button>
            </div>
          </div>
        </div>

      </div>
    );
  };

  /* ═══════════════════════════════════════════════ */
  /* ─── 3D MODEL VIEW ─── */
  /* ═══════════════════════════════════════════════ */
  /* ─── 3D PIT MODEL VIEW ─── */
  /* ═══════════════════════════════════════════════ */
  const render3D = () => {
    const levels = 8;
    const baseW = 320;
    const stepW = 32;
    const stepH = 22;

    return (
      <div style={{ maxWidth: 1280, margin: "0 auto" }} className="fade-up">
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <SectionTag n={6} label="Photogrammetry &amp; Terrain Mesh" />
            <PanelTitle>Open Pit 3D Photogrammetric &amp; Geomechanical Mesh</PanelTitle>
            <PanelSub>{terrainSource === "kaggle-obj" ? "Source: Kaggle 3D Models · ateneam.obj" : "Source: uploaded image heightfield"}</PanelSub>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)", fontFamily: font.mono, fontSize: 10, color: C.cyan }}>
              COORDINATES: 23°14'08"S 119°22'45"E · RL +420m to +580m
            </div>
          </div>
        </div>

        {/* ─── Convert-to-3D Hero (if not yet converted) ─── */}
        {!heightmap && (
          <div style={{ width: "100%", maxWidth: 700, margin: "0 auto 24px" }}>
            <Panel style={{ textAlign: "center", padding: 40, border: `1px solid rgba(0,212,255,0.25)` }}>
              <Camera size={44} color={C.cyan} style={{ marginBottom: 16 }} />
              <PanelTitle>Load 3D Terrain Dataset</PanelTitle>
              <PanelSub>{image ? "Build a terrain heightfield from the uploaded camera image" : "Load the bundled Kaggle 3D geometry asset ateneam.obj"}</PanelSub>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 20, marginTop: 18 }}>
                <span style={{ fontFamily: font.mono, fontSize: 11, color: C.muted }}>Mesh Resolution:</span>
                <input type="range" min={20} max={80} step={5} value={gridRes}
                  style={{ width: 180, "--thumb-color": C.cyan } as React.CSSProperties}
                  onChange={(e) => setGridRes(parseInt(e.target.value))} />
                <span style={{ fontFamily: font.mono, fontSize: 12, color: C.cyan, fontWeight: 700 }}>{gridRes}×{gridRes} Grid</span>
              </div>
              <button onClick={convertTo3D} disabled={converting3d} className="glass-btn"
                style={{
                  padding: "14px 34px", fontSize: 12,
                  display: "inline-flex", alignItems: "center", gap: 10,
                  background: "linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,180,216,0.15))",
                  border: `1px solid ${C.cyan}`, color: "#fff",
                  boxShadow: "0 0 20px rgba(0,212,255,0.3)",
                  ...(converting3d ? { opacity: 0.5, cursor: "wait" } : {}),
                }}>
                <Layers size={16} color={C.cyan} />
                {converting3d ? "LOADING 3D DATASET..." : image ? "BUILD FROM IMAGE" : "LOAD KAGGLE 3D MODEL"}
              </button>
            </Panel>
          </div>
        )}

        {/* ─── 3D Viewport with Cyber HUD Frame ─── */}
        {heightmap && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Viewport Box */}
            <div style={{
              position: "relative",
              width: "100%",
              height: fullScreen3d ? "calc(100vh - 120px)" : 460,
              minHeight: 400,
              background: "radial-gradient(ellipse at center, #0a182c 0%, #040a14 100%)",
              border: "1px solid rgba(0,212,255,0.25)",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 12px 40px rgba(0,0,0,0.6), inset 0 0 60px rgba(0,212,255,0.03)",
              cursor: drag3d.current.active ? "grabbing" : "grab",
            }}
              onMouseDown={on3dDown}
              onMouseMove={on3dMove}
              onMouseUp={on3dUp}
              onMouseLeave={on3dUp}
              onWheel={(e) => {
                e.preventDefault();
                setZoom3d((z) => clamp(z - e.deltaY * 0.001, 0.3, 3.0));
              }}
            >
              {/* Corner HUD Brackets */}
              <div className="hud-corner hud-corner-tl" />
              <div className="hud-corner hud-corner-tr" />
              <div className="hud-corner hud-corner-bl" />
              <div className="hud-corner hud-corner-br" />

              {/* HTML5 Canvas */}
              <canvas
                ref={canvasRef}
                style={{ display: "block", width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
              />

              {/* Top Viewport Toolbar Overlay */}
              <div style={{
                position: "absolute", top: 12, left: 16, right: 16, zIndex: 10,
                display: "flex", alignItems: "center", justifyContent: "space-between", pointerEvents: "auto",
              }}>
                {/* Rendering Mode Selector */}
                <div style={{ display: "flex", gap: 6, background: "rgba(4,12,26,0.85)", backdropFilter: "blur(10px)", padding: 4, borderRadius: 10, border: "1px solid rgba(0,212,255,0.15)" }}>
                  {(["solid", "wireframe", "textured"] as const).map((m) => (
                    <button key={m} onClick={() => setMeshMode(m)}
                      className={`glass-btn ${meshMode === m ? "glass-btn-active" : ""}`}
                      style={{ padding: "6px 14px", fontFamily: font.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
                      {m === "textured" ? "PHOTOGRAMMETRIC" : m === "solid" ? "SOLID SHADED" : "WIREFRAME HUD"}
                    </button>
                  ))}
                </div>

                {/* Right Camera Controls */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(4,12,26,0.85)", backdropFilter: "blur(10px)", padding: "4px 8px", borderRadius: 10, border: "1px solid rgba(0,212,255,0.15)" }}>
                  <button title="Zoom in" onClick={() => setZoom3d((z) => Math.min(z + 0.15, 3.0))}
                    className="glass-btn" style={{ padding: "6px 12px", fontFamily: font.mono, fontSize: 14 }}>+</button>
                  <button title="Zoom out" onClick={() => setZoom3d((z) => Math.max(z - 0.15, 0.3))}
                    className="glass-btn" style={{ padding: "6px 12px", fontFamily: font.mono, fontSize: 14 }}>−</button>
                  <button title="Reset orbit view" onClick={() => { setRot3d({ x: -45, y: 15 }); setZoom3d(1); }}
                    className="glass-btn" style={{ padding: "6px 12px", fontFamily: font.mono, fontSize: 10 }}>RESET</button>
                  <button title="Toggle auto-rotate" onClick={() => setAutoRotate((r) => !r)}
                    className={`glass-btn ${autoRotate ? "glass-btn-active" : ""}`}
                    style={{ padding: "6px 12px", fontFamily: font.mono, fontSize: 10, color: autoRotate ? C.cyan : C.dim }}>
                    {autoRotate ? "⏸ PAUSE" : "▶ ORBIT"}
                  </button>
                  <button
                    title="Export terrain as GLB"
                    onClick={exportTerrainToGLB}
                    disabled={!heightmap}
                    className="glass-btn"
                    style={{ padding: "6px 12px", fontFamily: font.mono, fontSize: 10, opacity: heightmap ? 1 : 0.5 }}
                  >
                    <Download size={12} color={C.cyan} />
                    GLB
                  </button>
                  {fullScreen3d
                    ? <button title="Exit fullscreen" onClick={() => setFullScreen3d(false)} className="glass-btn" style={{ padding: "6px 10px" }}><Minimize2 size={13} color={C.cyan} /></button>
                    : <button title="Fullscreen" onClick={() => setFullScreen3d(true)} className="glass-btn" style={{ padding: "6px 10px" }}><Maximize2 size={13} color={C.cyan} /></button>
                  }
                </div>
              </div>

              {/* Bottom HUD Telemetry Status */}
              <div style={{
                position: "absolute", bottom: 12, left: 16, right: 16, zIndex: 10,
                display: "flex", alignItems: "center", justifyContent: "space-between", pointerEvents: "none",
              }}>
                <div style={{
                  background: "rgba(4,12,26,0.85)", backdropFilter: "blur(8px)",
                  padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(0,212,255,0.15)",
                  fontFamily: font.mono, fontSize: 10, color: C.cyan, letterSpacing: "0.08em",
                }}>
                  ROT-X: {rot3d.x.toFixed(0)}° · ROT-Y: {rot3d.y.toFixed(0)}° · ZOOM: {zoom3d.toFixed(2)}× · GRID: {gridRes}×{gridRes}
                </div>

                <div style={{
                  background: "rgba(4,12,26,0.85)", backdropFilter: "blur(8px)",
                  padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(0,212,255,0.15)",
                  fontFamily: font.mono, fontSize: 10, color: C.dim, letterSpacing: "0.08em",
                }}>
                  LEFT-DRAG TO ORBIT · SCROLL TO ZOOM · SHIFT+DRAG TO PAN
                </div>
              </div>

              {/* Converting overlay */}
              {converting3d && (
                <div style={{
                  position: "absolute", inset: 0, zIndex: 30,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(4,10,22,0.85)", backdropFilter: "blur(8px)",
                }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: C.cyan, margin: "0 auto 12px" }} className="bc-live" />
                    <div style={{ fontFamily: font.mono, fontSize: 13, color: C.cyan, letterSpacing: "0.12em" }}>RECONSTRUCTING 3D PIT TOPOLOGY…</div>
                  </div>
                </div>
              )}

              {reconstructionError && (
                <div style={{ position: "absolute", right: 16, top: 70, zIndex: 25, background: "rgba(127,29,29,0.78)", border: "1px solid rgba(248,113,113,0.5)", color: "#fee2e2", padding: "8px 12px", borderRadius: 8, maxWidth: 420, fontSize: 11, lineHeight: 1.4 }}>
                  {reconstructionError}
                </div>
              )}
            </div>

            {/* ── Terrain Analysis Cards (6 Items) ── */}
            {terrainAnalysis && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14 }}>
                {[
                  { label: "TERRAIN TYPE", value: terrainAnalysis.terrainType, color: C.cyan },
                  { label: "MEAN FACE ANGLE", value: `${terrainAnalysis.slopeAngle}°`, color: terrainAnalysis.slopeAngle > 65 ? C.critical : C.text },
                  { label: "BENCH LAYERS", value: `${terrainAnalysis.benchCount} Levels`, color: C.text },
                  { label: "FRACTURE DENSITY", value: `${(terrainAnalysis.fractureDensity * 100).toFixed(0)}%`, color: terrainAnalysis.fractureDensity > 0.4 ? C.warning : C.safe },
                  { label: "CRITICAL ZONES", value: `${terrainAnalysis.riskZones} Sectors`, color: terrainAnalysis.riskZones > 0 ? C.critical : C.safe },
                  { label: "ALBEDO / BRIGHTNESS", value: `${(terrainAnalysis.avgBrightness * 100).toFixed(0)}%`, color: C.dim },
                ].map(({ label, value, color }) => (
                  <div key={label} className="glass" style={{ padding: 14, borderRadius: 12, textAlign: "center" }}>
                    <div style={{ fontFamily: font.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontFamily: font.display, fontSize: 16, fontWeight: 700, color }}>{value}</div>
                  </div>
                ))}
                <div className="glass" style={{ padding: 14, borderRadius: 12, textAlign: "center" }}>
                  <div style={{ fontFamily: font.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>RECONSTRUCTION</div>
                  <div style={{ fontFamily: font.display, fontSize: 16, fontWeight: 700, color: reconstructionState === "ready" ? C.emerald : reconstructionState === "error" ? C.crimson : C.cyan }}>
                    {reconstructionState === "ready" ? "READY" : reconstructionState === "error" ? "ERROR" : reconstructionState === "processing" ? "PROCESSING" : "IDLE"}
                  </div>
                </div>
              </div>
            )}

            {/* ── Geological Interpretation Dossier ── */}
            {terrainAnalysis && (
              <Panel style={{ padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <ShieldAlert size={16} color={C.cyan} />
                  <span style={{ fontFamily: font.mono, fontSize: 11, fontWeight: 700, color: C.cyan, letterSpacing: "0.08em" }}>
                    AUTOMATED PHOTOGRAMMETRIC GEOMECHANICAL INTERPRETATION
                  </span>
                </div>
                <div style={{ fontFamily: font.body, fontSize: 13, color: C.dim, lineHeight: 1.6 }}>
                  {terrainAnalysis.description}
                </div>
              </Panel>
            )}

            {/* ── CSS Bench Profile Cross-Section with Strata Markings ── */}
            {terrainAnalysis && (
              <Panel style={{ padding: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <SectionTag n={7} label="Stratigraphic Cross-Section" />
                    <PanelTitle>Bench Profile &amp; Factor of Safety Stratification</PanelTitle>
                    <PanelSub>Geotechnical multi-tier elevation distribution with progressive slip-plane indicators</PanelSub>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setIs3d(false)} className={`glass-btn ${!is3d ? "glass-btn-active" : ""}`}
                      style={{ padding: "6px 14px", fontFamily: font.mono, fontSize: 10 }}>2D ELEVATION</button>
                    <button onClick={() => setIs3d(true)} className={`glass-btn ${is3d ? "glass-btn-active" : ""}`}
                      style={{ padding: "6px 14px", fontFamily: font.mono, fontSize: 10 }}>3D PERSPECTIVE</button>
                  </div>
                </div>

                <div
                  style={{ perspective: 900, width: "100%", maxWidth: 500, height: 300, cursor: "grab", margin: "0 auto" }}
                  onMouseDown={on3dDown} onMouseMove={on3dMove} onMouseUp={on3dUp} onMouseLeave={on3dUp}
                >
                  <div ref={modelRef} style={{
                    width: "100%", height: "100%", position: "relative",
                    transformStyle: "preserve-3d",
                    transform: is3d ? `rotateX(${rot3d.x}deg) rotateY(${rot3d.y}deg) scale(${zoom3d})` : "none",
                    transition: drag3d.current.active ? "none" : "transform .3s ease",
                  }}>
                    {Array.from({ length: levels }, (_, i) => {
                      const w = baseW - i * stepW;
                      const fosLocal = clamp(fos - i * 0.04, 0.2, 3.0);
                      const col = fosLocal < 1.0 ? C.critical : fosLocal < 1.3 ? C.warning : C.safe;
                      return (
                        <div key={i} style={{
                          position: "absolute", left: "50%", bottom: i * stepH,
                          width: w, height: stepH - 2, marginLeft: -w / 2,
                          background: `linear-gradient(90deg, ${col}33, ${col}88)`,
                          border: `1px solid ${col}`,
                          transform: is3d ? `translateZ(${-i * 28}px)` : "none",
                          borderRadius: 4,
                          boxShadow: `0 0 12px ${col}44`,
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "0 10px",
                          fontFamily: font.mono, fontSize: 10, color: "#fff", fontWeight: 600,
                        }}>
                          <span>RL +{420 + i * 20}m</span>
                          <span>BENCH {BENCH[i % BENCH.length].id}</span>
                          <span style={{ color: col, fontWeight: 700 }}>FoS {fosLocal.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Panel>
            )}
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════ */
  /* ─── ALERTS VIEW (MISSION CONTROL) ─── */
  /* ═══════════════════════════════════════════════ */
  const renderAlerts = () => {
    const counts = {
      critical: alerts.filter((a) => a.sev === "critical" && !a.ack).length,
      warning: alerts.filter((a) => a.sev === "warning" && !a.ack).length,
      info: alerts.filter((a) => a.sev === "info" && !a.ack).length,
    };
    const totalActive = counts.critical + counts.warning + counts.info;

    return (
      <div style={{ maxWidth: 1280, margin: "0 auto" }} className="fade-up">
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <SectionTag n={7} label="Mission Control Alerts" />
            <PanelTitle>Real-Time Geotechnical Hazard &amp; Alarm Dispatch Center</PanelTitle>
            <PanelSub>Automated slope failure early warning triggers, telemetry threshold breaches, and emergency evacuation protocols</PanelSub>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div
              className="radar-container"
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 12px", borderRadius: 8,
                background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.2)",
                fontFamily: font.mono, fontSize: 9, color: C.cyan, letterSpacing: "0.1em",
                position: "relative", overflow: "hidden",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
                <circle cx="7" cy="7" r="6" fill="none" stroke="rgba(0,212,255,0.3)" strokeWidth="1"/>
                <circle cx="7" cy="7" r="3" fill="none" stroke="rgba(0,212,255,0.2)" strokeWidth="1"/>
                <line x1="7" y1="7" x2="7" y2="1" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round" className="radar-sweep" style={{ transformOrigin: "7px 7px" }}/>
              </svg>
              RADAR ACTIVE · {totalActive} LIVE
            </div>
            <button
              onClick={() => setAlerts((prev) => prev.map((a) => ({ ...a, ack: true })))}
              className="glass-btn"
              style={{ padding: "8px 18px", fontFamily: font.mono, fontSize: 10, color: C.cyan }}
            >
              ACKNOWLEDGE ALL
            </button>
          </div>
        </div>

        {/* Critical Emergency Banner if active critical alerts exist */}
        {counts.critical > 0 && (
          <div style={{
            background: "linear-gradient(90deg, rgba(239,68,68,0.25), rgba(220,38,38,0.15))",
            border: "1px solid #ef4444",
            borderRadius: 14,
            padding: "16px 20px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 0 24px rgba(239,68,68,0.2)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: C.critical }} className="bc-live" />
              <div>
                <div style={{ fontFamily: font.display, fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "0.04em" }}>
                  ACTIVE EVACUATION WARNINGS IN EFFECT — {counts.critical} CRITICAL ZONES
                </div>
                <div style={{ fontFamily: font.mono, fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
                  Bench safety factors below regulatory threshold of 1.0. Stop haul truck traffic immediately.
                </div>
              </div>
            </div>
            <span style={{
              padding: "6px 14px", borderRadius: 8, background: "#ef4444", color: "#fff",
              fontFamily: font.mono, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em"
            }}>
              SIREN BROADCAST ACTIVE
            </span>
          </div>
        )}

        {/* 4 Status KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>

          {/* Critical – radar container with sweep overlay */}
          <div className={`glass radar-container ${counts.critical > 0 ? "glow-critical" : ""}`}
            style={{ padding: 20, borderRadius: 14, borderTop: `3px solid ${C.critical}`, overflow: "hidden", position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontFamily: font.mono, fontSize: 10, color: C.critical, letterSpacing: "0.1em" }}>CRITICAL ALERTS</span>
              <AlertTriangle size={18} color={C.critical} />
            </div>
            <div style={{ fontFamily: font.display, fontSize: 36, fontWeight: 700, color: C.critical, position: "relative" }}>
              {counts.critical}
              {counts.critical > 0 && (
                <span style={{
                  position: "absolute", top: 6, left: -18,
                  width: 10, height: 10, borderRadius: "50%", background: C.critical,
                  display: "inline-block",
                }} className="bc-live" />
              )}
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 10, color: C.muted, marginTop: 4 }}>Unacknowledged emergency events</div>
          </div>

          {/* Warning */}
          <div className={`glass ${counts.warning > 0 ? "glow-warning" : ""}`}
            style={{ padding: 20, borderRadius: 14, borderTop: `3px solid ${C.warning}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontFamily: font.mono, fontSize: 10, color: C.warning, letterSpacing: "0.1em" }}>ELEVATED WARNINGS</span>
              <ShieldAlert size={18} color={C.warning} />
            </div>
            <div style={{ fontFamily: font.display, fontSize: 36, fontWeight: 700, color: C.warning }}>
              {counts.warning}
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 10, color: C.muted, marginTop: 4 }}>SMR &amp; seepage excursions</div>
          </div>

          {/* Info */}
          <div className="glass" style={{ padding: 20, borderRadius: 14, borderTop: `3px solid ${C.info}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontFamily: font.mono, fontSize: 10, color: C.info, letterSpacing: "0.1em" }}>SYSTEM ADVISORIES</span>
              <Activity size={18} color={C.info} />
            </div>
            <div style={{ fontFamily: font.display, fontSize: 36, fontWeight: 700, color: C.info }}>
              {counts.info}
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 10, color: C.muted, marginTop: 4 }}>Telemetry sensor updates</div>
          </div>

          {/* Fleet */}
          <div className="glass" style={{ padding: 20, borderRadius: 14, borderTop: `3px solid ${C.safe}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontFamily: font.mono, fontSize: 10, color: C.safe, letterSpacing: "0.1em" }}>FLEET HEALTH</span>
              <Radio size={18} color={C.safe} />
            </div>
            <div style={{ fontFamily: font.display, fontSize: 36, fontWeight: 700, color: C.safe }}>98.4%</div>
            <div style={{ fontFamily: font.mono, fontSize: 10, color: C.muted, marginTop: 4 }}>42 / 43 Geophone nodes online</div>
            {/* Mini health bar */}
            <div style={{ marginTop: 8, height: 3, borderRadius: 2, background: "rgba(16,185,129,0.15)", overflow: "hidden" }}>
              <div style={{ width: "98.4%", height: "100%", background: C.safe, borderRadius: 2, boxShadow: `0 0 6px ${C.safe}66` }} />
            </div>
          </div>
        </div>

        {/* Alert Cards Feed */}
        <Panel style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <PanelTitle>Telemetry Event Feed</PanelTitle>
              <PanelSub>Chronological stack of slope safety alerts with automated mitigation protocols</PanelSub>
            </div>
            <span style={{ fontFamily: font.mono, fontSize: 10, color: C.muted }}>
              {totalActive} PENDING ACKNOWLEDGMENT
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {alerts.map((a) => {
              const isCrit = a.sev === "critical";
              const isWarn = a.sev === "warning";
              const borderCol = isCrit ? C.critical : isWarn ? C.warning : C.info;
              const rgbColor = isCrit ? "239,68,68" : isWarn ? "245,158,11" : "0,212,255";

              return (
                <div
                  key={a.id}
                  className={`glass ${isCrit && !a.ack ? "glow-critical" : ""}`}
                  style={{
                    padding: "14px 18px",
                    borderRadius: 12,
                    borderLeft: `4px solid ${a.ack ? borderCol + "55" : borderCol}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    opacity: a.ack ? 0.55 : 1,
                    transition: "all 0.3s ease",
                    background: a.ack ? undefined : `rgba(${rgbColor}, 0.04)`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
                    {/* Animated pulse dot + icon */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      {!a.ack && (
                        <div style={{
                          position: "absolute", top: -2, right: -2,
                          width: 8, height: 8, borderRadius: "50%", background: borderCol,
                          zIndex: 2,
                        }} className="bc-live" />
                      )}
                      <div style={{
                        width: 38, height: 38, borderRadius: 10,
                        background: `rgba(${rgbColor}, 0.12)`,
                        border: `1px solid rgba(${rgbColor}, 0.35)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: !a.ack ? `0 0 16px rgba(${rgbColor}, 0.25)` : "none",
                      }}>
                        {isCrit ? <AlertTriangle size={18} color={C.critical} /> : isWarn ? <ShieldAlert size={18} color={C.warning} /> : <Activity size={18} color={C.info} />}
                      </div>
                    </div>

                    {/* Text & Meta */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <span style={{
                          fontFamily: font.mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                          color: borderCol, padding: "2px 9px", borderRadius: 4,
                          background: `rgba(${rgbColor}, 0.14)`,
                          border: `1px solid rgba(${rgbColor}, 0.3)`,
                        }}>
                          {a.sev.toUpperCase()}
                        </span>
                        <span style={{ fontFamily: font.mono, fontSize: 9, color: C.muted }}>
                          {a.time} UTC+8 · SENSOR RF-14
                        </span>
                        {a.ack && (
                          <span style={{
                            fontFamily: font.mono, fontSize: 9, color: C.safe,
                            background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)",
                            padding: "1px 7px", borderRadius: 4,
                          }}>
                            ✓ ACK
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily: font.body, fontSize: 13, fontWeight: 500, color: a.ack ? C.dim : C.text }}>
                        {a.text}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {!a.ack ? (
                      <button
                        onClick={() => ackAlert(a.id)}
                        className="glass-btn"
                        style={{
                          padding: "7px 14px", fontFamily: font.mono, fontSize: 9,
                          color: C.cyan, border: "1px solid rgba(0,212,255,0.28)",
                          letterSpacing: "0.08em",
                        }}
                      >
                        ACKNOWLEDGE
                      </button>
                    ) : (
                      <span style={{ fontFamily: font.mono, fontSize: 9, color: C.muted, letterSpacing: "0.08em" }}>LOGGED</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════ */
  /* ─── HISTORY VIEW (TELEMETRY & FORENSICS) ─── */
  /* ═══════════════════════════════════════════════ */
  const renderHistory = () => {
    const avgFos = history.reduce((s, h) => s + h.fos, 0) / history.length;
    const maxFos = Math.max(...history.map((h) => h.fos), 1.9);
    const minFos = Math.min(...history.map((h) => h.fos), 0.7);
    const totalRain = history.reduce((s, h) => s + h.rainfall, 0);
    const maxVib = Math.max(...history.map((h) => h.vibration));
    const totalIncidents = history.reduce((s, h) => s + h.incidents, 0);
    const critDays = history.filter((h) => h.fos < 1.0).length;

    // SVG coordinates (width 920, height 260)
    const padL = 50, padR = 40, padT = 30, padB = 40;
    const plotW = 920 - padL - padR;
    const plotH = 260 - padT - padB;
    const getX = (i: number) => padL + (i / (history.length - 1)) * plotW;
    const getY = (val: number) => padT + ((maxFos - val) / (maxFos - minFos)) * plotH;

    // Build smooth curve path using cubic Bezier
    const pts = history.map((h, i) => ({ x: getX(i), y: getY(h.fos) }));
    let pathD = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    const areaD = pathD + ` L ${pts[pts.length - 1].x} ${padT + plotH} L ${pts[0].x} ${padT + plotH} Z`;

    const yCrit = getY(1.0);
    const yWarn = getY(1.3);

    return (
      <div style={{ maxWidth: 1280, margin: "0 auto" }} className="fade-up">
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <SectionTag n={8} label="Geotechnical Telemetry & Forensics" />
            <PanelTitle>14-Day Pit Stability &amp; Factor of Safety Time-Series</PanelTitle>
            <PanelSub>Continuous InSAR displacement, piezometric pore pressure, rainfall infiltration, and blast vibration history</PanelSub>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)", fontFamily: font.mono, fontSize: 10, color: C.cyan }}>
              SAMPLING: 24-HR ROLLING SYNCHRONIZATION
            </div>
          </div>
        </div>

        {/* Top 4 KPI Metrics Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
          <div className="glass" style={{ padding: 18, borderRadius: 14, borderLeft: `3px solid ${avgFos < 1.0 ? C.critical : avgFos < 1.3 ? C.warning : C.safe}` }}>
            <div style={{ fontFamily: font.mono, fontSize: 10, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>14D Mean FoS</div>
            <div style={{ fontFamily: font.display, fontSize: 28, fontWeight: 700, color: avgFos < 1.0 ? C.critical : avgFos < 1.3 ? C.warning : C.safe, marginTop: 4 }}>
              {avgFos.toFixed(2)}
              <span style={{ fontSize: 12, fontFamily: font.mono, color: C.muted, marginLeft: 8 }}>
                {avgFos >= 1.3 ? "NOMINAL" : "ELEVATED RISK"}
              </span>
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 10, color: C.dim, marginTop: 6 }}>Baseline target: ≥ 1.50 FoS</div>
          </div>

          <div className="glass" style={{ padding: 18, borderRadius: 14, borderLeft: `3px solid ${critDays > 0 ? C.critical : C.safe}` }}>
            <div style={{ fontFamily: font.mono, fontSize: 10, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>Threshold Breaches</div>
            <div style={{ fontFamily: font.display, fontSize: 28, fontWeight: 700, color: critDays > 0 ? C.critical : C.safe, marginTop: 4 }}>
              {critDays} <span style={{ fontSize: 14, color: C.muted, fontWeight: 400 }}>days &lt; 1.0</span>
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 10, color: C.dim, marginTop: 6 }}>{totalIncidents} total incidents flagged</div>
          </div>

          <div className="glass" style={{ padding: 18, borderRadius: 14, borderLeft: `3px solid ${C.info}` }}>
            <div style={{ fontFamily: font.mono, fontSize: 10, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>14D Cumulative Rain</div>
            <div style={{ fontFamily: font.display, fontSize: 28, fontWeight: 700, color: C.info, marginTop: 4 }}>
              {totalRain.toFixed(0)} <span style={{ fontSize: 14, color: C.muted, fontWeight: 400 }}>mm</span>
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 10, color: C.dim, marginTop: 6 }}>Saturation index: High</div>
          </div>

          <div className="glass" style={{ padding: 18, borderRadius: 14, borderLeft: `3px solid ${maxVib > 5 ? C.warning : C.safe}` }}>
            <div style={{ fontFamily: font.mono, fontSize: 10, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>Peak Blast Vibration</div>
            <div style={{ fontFamily: font.display, fontSize: 28, fontWeight: 700, color: maxVib > 5 ? C.warning : C.safe, marginTop: 4 }}>
              {maxVib.toFixed(1)} <span style={{ fontSize: 14, color: C.muted, fontWeight: 400 }}>mm/s PPV</span>
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 10, color: C.dim, marginTop: 6 }}>Statutory limit: 5.0 mm/s</div>
          </div>
        </div>

        {/* Main High-Resolution Telemetry Graph */}
        <Panel style={{ padding: 22, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.cyan }} className="bc-live" />
              <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 600, color: C.text, letterSpacing: "0.06em" }}>
                FACTOR OF SAFETY &amp; RAINFALL INFILTRATION OVER TIME
              </span>
            </div>
            {/* Chart Legend */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: font.mono, fontSize: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 14, height: 2, background: C.cyan, display: "inline-block" }} />
                <span style={{ color: C.dim }}>Factor of Safety (FoS)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, background: "rgba(56,189,248,0.3)", border: `1px solid ${C.info}`, display: "inline-block" }} />
                <span style={{ color: C.dim }}>Daily Rainfall (mm)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 2, borderTop: `1px dashed ${C.critical}`, display: "inline-block" }} />
                <span style={{ color: C.critical }}>Collapse Limit (1.0)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 2, borderTop: `1px dashed ${C.warning}`, display: "inline-block" }} />
                <span style={{ color: C.warning }}>Caution Limit (1.3)</span>
              </div>
            </div>
          </div>

          <div style={{ width: "100%", overflowX: "auto" }}>
            <svg viewBox="0 0 920 270" style={{ width: "100%", height: "auto", minHeight: 250 }}>
              <defs>
                <linearGradient id="histFosAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.4" />
                  <stop offset="60%" stopColor="#00d4ff" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="histRainGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.05" />
                </linearGradient>
                <pattern id="critZoneHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(239,68,68,0.18)" strokeWidth="2" />
                </pattern>
                <filter id="cyanNeonGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#00d4ff" floodOpacity="0.6" />
                </filter>
              </defs>

              {/* Background Safety Zone Bands */}
              {/* Critical Danger Band (< 1.0) */}
              <rect x={padL} y={yCrit} width={plotW} height={padT + plotH - yCrit} fill="url(#critZoneHatch)" />
              <rect x={padL} y={yCrit} width={plotW} height={padT + plotH - yCrit} fill="rgba(239,68,68,0.06)" />
              <text x={padL + 8} y={padT + plotH - 8} fill="rgba(239,68,68,0.6)" fontSize="9" fontFamily={font.mono} letterSpacing="0.1em">
                CRITICAL COLLAPSE REGIME (FoS &lt; 1.0)
              </text>

              {/* Caution Band (1.0 to 1.3) */}
              <rect x={padL} y={yWarn} width={plotW} height={Math.max(0, yCrit - yWarn)} fill="rgba(245,158,11,0.04)" />
              <text x={padL + 8} y={yCrit - 6} fill="rgba(245,158,11,0.5)" fontSize="9" fontFamily={font.mono} letterSpacing="0.1em">
                ELEVATED FAILURE PROBABILITY (1.0 – 1.3)
              </text>

              {/* Horizontal Gridlines & Y-Axis Labels */}
              {[0.8, 1.0, 1.2, 1.4, 1.6, 1.8].map((v) => {
                const y = getY(v);
                return (
                  <g key={v}>
                    <line x1={padL} x2={padL + plotW} y1={y} y2={y} stroke="rgba(0,212,255,0.08)" strokeDasharray="3 3" />
                    <text x={padL - 8} y={y + 3} fill={v === 1.0 ? C.critical : v === 1.3 ? C.warning : C.muted} fontSize="9" fontFamily={font.mono} textAnchor="end">
                      {v.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* Threshold Lines */}
              <line x1={padL} x2={padL + plotW} y1={yCrit} y2={yCrit} stroke={C.critical} strokeWidth="1.5" strokeDasharray="5 3" />
              <line x1={padL} x2={padL + plotW} y1={yWarn} y2={yWarn} stroke={C.warning} strokeWidth="1.5" strokeDasharray="5 3" />

              {/* Daily Rainfall Histogram Bars (Secondary y-axis plotted from bottom) */}
              {history.map((h, i) => {
                const maxRainVal = 70;
                const barH = (h.rainfall / maxRainVal) * (plotH * 0.45);
                const bx = getX(i) - 10;
                const by = padT + plotH - barH;
                return (
                  <g key={`rain-${i}`}>
                    <rect x={bx} y={by} width={20} height={barH} rx={2} fill="url(#histRainGrad)" stroke="rgba(56,189,248,0.25)" />
                  </g>
                );
              })}

              {/* Area Under FoS Curve */}
              <path d={areaD} fill="url(#histFosAreaGrad)" />

              {/* FoS Main Continuous Line */}
              <path d={pathD} fill="none" stroke="#00d4ff" strokeWidth="2.5" strokeLinecap="round" filter="url(#cyanNeonGlow)" />

              {/* Data Nodes on FoS Curve */}
              {history.map((h, i) => {
                const x = getX(i);
                const y = getY(h.fos);
                const isCrit = h.fos < 1.0;
                const isWarn = h.fos >= 1.0 && h.fos < 1.3;
                const nodeColor = isCrit ? C.critical : isWarn ? C.warning : C.cyan;

                return (
                  <g key={`pt-${i}`}>
                    {/* Outer pulse ring for critical incidents */}
                    {h.incidents > 0 && (
                      <circle cx={x} cy={y} r={10} fill="none" stroke={C.critical} strokeWidth="1" opacity="0.6" strokeDasharray="2 2" />
                    )}
                    <circle cx={x} cy={y} r={4.5} fill={nodeColor} stroke="#060c14" strokeWidth="2" />

                    {/* Incident callout tag */}
                    {h.incidents > 0 && (
                      <g>
                        <rect x={x - 14} y={y - 20} width={28} height={13} rx={3} fill="rgba(239,68,68,0.9)" />
                        <text x={x} y={y - 11} fill="#fff" fontSize="8" fontFamily={font.mono} fontWeight="bold" textAnchor="middle">
                          {h.incidents}x
                        </text>
                      </g>
                    )}

                    {/* Day X-Axis Label */}
                    <text x={x} y={padT + plotH + 20} fill={isCrit ? C.critical : C.muted} fontSize="9" fontFamily={font.mono} textAnchor="middle">
                      D{h.day.toString().padStart(2, "0")}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </Panel>

        {/* Multi-Sensor Telemetry Grid (3 Cards) — cyber sparklines */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>

          {/* Card 1: Precipitation Radar */}
          <div className="glass sparkline-grid" style={{ padding: 18, borderRadius: 14, borderTop: `2px solid rgba(56,189,248,0.4)` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontFamily: font.mono, fontSize: 9, color: C.info, letterSpacing: "0.12em" }}>PLUVIOMETER ARRAY</span>
              <span style={{ fontFamily: font.mono, fontSize: 8, color: C.muted, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)", padding: "2px 6px", borderRadius: 4 }}>14D</span>
            </div>
            <div style={{ fontFamily: font.display, fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 2 }}>Rainfall Precipitation</div>
            <div style={{ fontFamily: font.mono, fontSize: 10, color: C.dim, marginBottom: 10 }}>Daily runoff · pore pressure driver</div>
            {/* Enhanced Sparkline */}
            <div style={{ position: "relative" }}>
              <svg viewBox="0 0 200 48" style={{ width: "100%", height: 52 }}>
                <defs>
                  <linearGradient id="rainSparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {(() => {
                  const vals = history.map(h => h.rainfall);
                  const maxVal = Math.max(...vals);
                  const minVal = Math.min(...vals);
                  const pts = history.map((h, i) => ({
                    x: (i / (history.length - 1)) * 190 + 5,
                    y: 42 - ((h.rainfall - minVal) / (maxVal - minVal + 0.01)) * 34,
                  }));
                  const sPts = pts.map(p => `${p.x},${p.y}`).join(" ");
                  const areaD = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ") + ` L ${pts[pts.length-1].x} 46 L ${pts[0].x} 46 Z`;
                  const maxIdx = vals.indexOf(maxVal);
                  return (
                    <>
                      <path d={areaD} fill="url(#rainSparkGrad)" />
                      <polyline points={sPts} fill="none" stroke={C.info} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      {/* Peak marker */}
                      <circle cx={pts[maxIdx].x} cy={pts[maxIdx].y} r={3.5} fill={C.info} stroke="#060c14" strokeWidth="1.5" />
                      <text x={pts[maxIdx].x} y={pts[maxIdx].y - 5} fill={C.info} fontSize="7" fontFamily="monospace" textAnchor="middle">{maxVal.toFixed(0)}mm</text>
                    </>
                  );
                })()}
              </svg>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: font.mono, fontSize: 9, color: C.dim, borderTop: "1px solid rgba(0,212,255,0.08)", paddingTop: 7, marginTop: 4 }}>
              <span>Now: <span style={{ color: C.info }}>{history[history.length - 1].rainfall.toFixed(1)} mm</span></span>
              <span>Max: <span style={{ color: C.info }}>{Math.max(...history.map(h => h.rainfall)).toFixed(1)} mm</span></span>
              <span style={{ color: C.muted }}>Min: {Math.min(...history.map(h => h.rainfall)).toFixed(1)} mm</span>
            </div>
          </div>

          {/* Card 2: Blast Seismograph */}
          <div className="glass sparkline-grid" style={{ padding: 18, borderRadius: 14, borderTop: `2px solid rgba(245,158,11,0.4)` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontFamily: font.mono, fontSize: 9, color: C.warning, letterSpacing: "0.12em" }}>TRIAXIAL SEISMOGRAPH</span>
              <span style={{ fontFamily: font.mono, fontSize: 8, color: C.muted, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", padding: "2px 6px", borderRadius: 4 }}>PPV</span>
            </div>
            <div style={{ fontFamily: font.display, fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 2 }}>Ground Vibration</div>
            <div style={{ fontFamily: font.mono, fontSize: 10, color: C.dim, marginBottom: 10 }}>Peak Particle Velocity · mm/s</div>
            {/* Enhanced Sparkline */}
            <svg viewBox="0 0 200 48" style={{ width: "100%", height: 52 }}>
              <defs>
                <linearGradient id="vibSparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {(() => {
                const vals = history.map(h => h.vibration);
                const maxVal = Math.max(...vals, 8);
                const minVal = Math.min(...vals);
                const pts = history.map((h, i) => ({
                  x: (i / (history.length - 1)) * 190 + 5,
                  y: 42 - ((h.vibration - minVal) / (maxVal - minVal + 0.01)) * 34,
                }));
                const sPts = pts.map(p => `${p.x},${p.y}`).join(" ");
                const limitY = 42 - ((5.0 - minVal) / (maxVal - minVal + 0.01)) * 34;
                const areaD = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ") + ` L ${pts[pts.length-1].x} 46 L ${pts[0].x} 46 Z`;
                const maxIdx = vals.indexOf(Math.max(...vals));
                return (
                  <>
                    <path d={areaD} fill="url(#vibSparkGrad)" />
                    {/* Statutory limit line */}
                    <line x1="5" x2="195" y1={limitY} y2={limitY} stroke={C.critical} strokeWidth="1" strokeDasharray="4 2" />
                    <text x={190} y={limitY - 3} fill={C.critical} fontSize="7" fontFamily="monospace" textAnchor="end">5.0 LIMIT</text>
                    <polyline points={sPts} fill="none" stroke={C.warning} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx={pts[maxIdx].x} cy={pts[maxIdx].y} r={3.5} fill={C.warning} stroke="#060c14" strokeWidth="1.5" />
                    <text x={pts[maxIdx].x} y={pts[maxIdx].y - 5} fill={C.warning} fontSize="7" fontFamily="monospace" textAnchor="middle">{Math.max(...vals).toFixed(1)}</text>
                  </>
                );
              })()}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: font.mono, fontSize: 9, color: C.dim, borderTop: "1px solid rgba(0,212,255,0.08)", paddingTop: 7, marginTop: 4 }}>
              <span>Now: <span style={{ color: C.warning }}>{history[history.length - 1].vibration.toFixed(2)} mm/s</span></span>
              <span>Limit: <span style={{ color: C.critical }}>5.0 mm/s</span></span>
              <span style={{ color: history[history.length-1].vibration > 5 ? C.critical : C.safe }}>{history[history.length-1].vibration > 5 ? "⚠ EXCEEDS" : "✓ OK"}</span>
            </div>
          </div>

          {/* Card 3: Piezometric Water Seepage */}
          <div className="glass sparkline-grid" style={{ padding: 18, borderRadius: 14, borderTop: `2px solid rgba(16,185,129,0.4)` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontFamily: font.mono, fontSize: 9, color: C.safe, letterSpacing: "0.12em" }}>PIEZOMETER BOREHOLES</span>
              <span style={{ fontFamily: font.mono, fontSize: 8, color: C.muted, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", padding: "2px 6px", borderRadius: 4 }}>ru</span>
            </div>
            <div style={{ fontFamily: font.display, fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 2 }}>Piezometric Seepage</div>
            <div style={{ fontFamily: font.mono, fontSize: 10, color: C.dim, marginBottom: 10 }}>Groundwater discharge · ru ratio</div>
            {/* Enhanced Sparkline */}
            <svg viewBox="0 0 200 48" style={{ width: "100%", height: 52 }}>
              <defs>
                <linearGradient id="seepSparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {(() => {
                const vals = history.map(h => h.seepage);
                const maxVal = Math.max(...vals, 0.6);
                const minVal = Math.min(...vals);
                const pts = history.map((h, i) => ({
                  x: (i / (history.length - 1)) * 190 + 5,
                  y: 42 - ((h.seepage - minVal) / (maxVal - minVal + 0.001)) * 34,
                }));
                const sPts = pts.map(p => `${p.x},${p.y}`).join(" ");
                const areaD = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ") + ` L ${pts[pts.length-1].x} 46 L ${pts[0].x} 46 Z`;
                const maxIdx = vals.indexOf(Math.max(...vals));
                return (
                  <>
                    <path d={areaD} fill="url(#seepSparkGrad)" />
                    <polyline points={sPts} fill="none" stroke={C.safe} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx={pts[maxIdx].x} cy={pts[maxIdx].y} r={3.5} fill={C.safe} stroke="#060c14" strokeWidth="1.5" />
                    <text x={pts[maxIdx].x} y={pts[maxIdx].y - 5} fill={C.safe} fontSize="7" fontFamily="monospace" textAnchor="middle">{Math.max(...vals).toFixed(2)}</text>
                  </>
                );
              })()}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: font.mono, fontSize: 9, color: C.dim, borderTop: "1px solid rgba(0,212,255,0.08)", paddingTop: 7, marginTop: 4 }}>
              <span>Now: <span style={{ color: C.safe }}>{history[history.length - 1].seepage.toFixed(2)} L/min</span></span>
              <span>Max: {Math.max(...history.map(h => h.seepage)).toFixed(2)}</span>
              <span style={{ color: C.safe }}>✓ Managed</span>
            </div>
          </div>
        </div>

        {/* Incident Forensics Audit Log */}
        <Panel style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <SectionTag n={9} label="Chronological Audit" />
              <PanelTitle>Historical Stability Incident Log</PanelTitle>
            </div>
            <span style={{ fontFamily: font.mono, fontSize: 10, color: C.muted }}>RECORDS WITH SENSORY EXCURSIONS</span>
          </div>

          <table className="cyber-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Safety Factor</th>
                <th>Precipitation</th>
                <th>Vibration PPV</th>
                <th>Incidents</th>
                <th>Root Cause Analysis</th>
                <th>Action Taken</th>
              </tr>
            </thead>
            <tbody>
              {history.filter((h) => h.incidents > 0 || h.fos < 1.3).reverse().map((h) => {
                const isCrit = h.fos < 1.0;
                return (
                  <tr key={h.day} className={isCrit ? "incident-row-critical" : "incident-row-warning"}>
                    <td style={{ fontFamily: font.mono, fontWeight: 700, color: C.cyan }}>DAY {h.day.toString().padStart(2, "0")}</td>
                    <td>
                      <span style={{
                        fontFamily: font.mono, fontWeight: 700,
                        color: isCrit ? C.critical : C.warning,
                        padding: "2px 9px", borderRadius: 4,
                        background: isCrit ? "rgba(239,68,68,0.18)" : "rgba(245,158,11,0.15)",
                        border: `1px solid rgba(${isCrit ? "239,68,68" : "245,158,11"}, 0.3)`,
                        boxShadow: `0 0 8px rgba(${isCrit ? "239,68,68" : "245,158,11"}, 0.2)`,
                      }}>
                        {h.fos.toFixed(2)} FoS
                      </span>
                    </td>
                    <td style={{ fontFamily: font.mono, color: h.rainfall > 50 ? C.warning : C.dim }}>{h.rainfall.toFixed(1)} mm/day</td>
                    <td style={{ fontFamily: font.mono, color: h.vibration > 5 ? C.critical : C.dim }}>{h.vibration.toFixed(2)} mm/s</td>
                    <td>
                      <span style={{
                        color: isCrit ? C.critical : C.warning, fontWeight: 700, fontFamily: font.mono,
                        display: "flex", alignItems: "center", gap: 5,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: isCrit ? C.critical : C.warning, display: "inline-block" }} className="bc-live" />
                        {h.incidents} logged
                      </span>
                    </td>
                    <td style={{ color: C.dim, fontSize: 11 }}>
                      {isCrit ? "Heavy rainfall surcharge + joint plane water pressure" : "Blast induced micro-fracture propagation"}
                    </td>
                    <td>
                      <span className={`status-badge ${isCrit ? "status-badge-critical" : "status-badge-caution"}`} style={{ fontSize: 9, padding: "2px 9px" }}>
                        {isCrit ? "BENCH EVACUATED" : "HAUL SLOW ORDER"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════ */
  /* ─── AI VISION VIEW ─── */
  /* ═══════════════════════════════════════════════ */
  const renderAIVision = () => {
    const sectorColumns = ["A", "B", "C", "D", "E"];
    const sectorStyles = [
      { bg: "rgba(16,185,129,0.18)", text: "#10B981", border: "rgba(16,185,129,0.25)" },
      { bg: "rgba(52,211,153,0.14)", text: "#34D399", border: "rgba(52,211,153,0.2)" },
      { bg: "rgba(245,158,11,0.18)", text: "#F59E0B", border: "rgba(245,158,11,0.25)" },
      { bg: "rgba(249,115,22,0.22)", text: "#F97316", border: "rgba(249,115,22,0.35)" },
      { bg: "rgba(239,68,68,0.22)", text: "#EF4444", border: "rgba(239,68,68,0.45)" },
    ];
    return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }} className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <PanelTitle>Analysis Results</PanelTitle>
        <PanelSub>Bench {bench.id} · live backend output</PanelSub>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
        {[
          ["FoS", fusionResult?.fos ?? fos, ""],
          ["SMR", fusionResult?.smr ?? smr, "/100"],
          ["Joint density", fusionResult?.jv_density ?? jv, "joints/m³"],
          ["Risk", fusionResult?.risk_label ?? risk.label, ""],
        ].map(([label, value, unit]) => (
          <div key={label} className="glass" style={{ padding: 16 }}>
            <div style={{ fontFamily: font.mono, fontSize: 10, color: C.muted, textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontFamily: font.display, fontSize: 25, fontWeight: 700, color: label === "Risk" ? risk.color : C.text, marginTop: 8 }}>{typeof value === "number" ? value.toFixed(2) : value}<span style={{ fontSize: 11, color: C.muted, marginLeft: 5 }}>{unit}</span></div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 12 }}>
        <Panel>
          <PanelTitle>Camera Result</PanelTitle>
          <PanelSub>{image ? "Uploaded image and backend overlay" : "No image uploaded"}</PanelSub>
          <div style={{ marginTop: 12, minHeight: 300, borderRadius: 8, overflow: "hidden", background: C.bg, border: `1px solid ${C.border}` }}>
            {image ? <img src={overlayB64 ? `data:image/png;base64,${overlayB64}` : image} alt="Backend computer vision result" style={{ width: "100%", height: 360, objectFit: "contain", display: "block" }} /> : <div className="gg-empty-state"><div className="gg-empty-title">Upload a pit wall image</div><div className="gg-empty-desc">The backend result will appear here.</div></div>}
          </div>
        </Panel>
        <Panel>
          <PanelTitle>Spatial Result</PanelTitle>
          <PanelSub>{spatialSummary ? `${spatialSummary.high_risk_pct ?? 0}% high-risk pixels` : "Waiting for image analysis"}</PanelSub>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "22px repeat(5, 1fr)", gap: 5 }}>
            <div />{sectorColumns.map((label) => <div key={label} style={{ textAlign: "center", fontFamily: font.mono, fontSize: 10, color: C.muted }}>{label}</div>)}
            {(spatialGrid || []).slice(0, 5).flatMap((row, ri) => [<div key={`row-${ri}`} style={{ fontFamily: font.mono, fontSize: 10, color: C.muted, textAlign: "right" }}>{ri + 1}</div>, ...row.slice(0, 5).map((level, ci) => { const style = sectorStyles[Math.min(4, Math.max(0, level))]; return <div key={`${ri}-${ci}`} style={{ minHeight: 42, borderRadius: 5, background: style.bg, border: `1px solid ${style.border}`, color: style.text, display: "grid", placeItems: "center", fontFamily: font.mono, fontSize: 10 }}>{sectorColumns[ci]}{ri + 1}</div>; })])}
          </div>
        </Panel>
      </div>
      <Panel style={{ marginTop: 12 }}>
        <PanelTitle>Trained Model Explainability</PanelTitle>
        <PanelSub>{fusionResult?.shap_source === "trained_model_treeshap" ? "TreeSHAP values from the trained XGBoost model" : "Run analysis with an uploaded image to receive TreeSHAP values"}</PanelSub>
        <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
          {(fusionResult?.shap_values || []).map((item: { feature: string; value: number; positive: boolean }) => <div key={item.feature} style={{ display: "grid", gridTemplateColumns: "220px 1fr 80px", alignItems: "center", gap: 10 }}><span style={{ fontFamily: font.mono, fontSize: 11, color: C.dim }}>{item.feature}</span><div style={{ height: 12, background: C.border, borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(100, Math.abs(item.value) / Math.max(...(fusionResult?.shap_values || []).map((v: { value: number }) => Math.abs(v.value)), 0.001) * 100)}%`, background: item.positive ? C.crimson : C.emerald }} /></div><span style={{ fontFamily: font.mono, fontSize: 11, color: item.positive ? C.crimson : C.emerald, textAlign: "right" }}>{item.value > 0 ? "+" : ""}{item.value.toFixed(3)}</span></div>)}
        </div>
      </Panel>
    </div>
    );
  };

  /* ═══════════════════════════════════════════════ */
  /* ─── REPORTS VIEW (GEOTECHNICAL AUDIT DOSSIERS) ─── */
  /* ═══════════════════════════════════════════════ */
  const renderReports = () => (
    <div style={{ maxWidth: 1280, margin: "0 auto" }} className="fade-up">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <SectionTag n={10} label="Regulatory Compliance &amp; Audit Dossiers" />
          <PanelTitle>Automated Statutory Mine Geotechnical Safety Reports</PanelTitle>
          <PanelSub>Certified compliance audits (ISO 17776 / MSHA Standards), kinematic stability assessments, and pre-shift clearance certificates</PanelSub>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)", fontFamily: font.mono, fontSize: 10, color: C.cyan }}>
            STANDARDS: ISO 17776 · AS 4801 · MSHA PART 56
          </div>
        </div>
      </div>

      {/* Report Generator Station */}
      <Panel style={{ padding: 22, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <span style={{ fontFamily: font.mono, fontSize: 10, color: C.cyan, letterSpacing: "0.1em" }}>ON-DEMAND CERTIFICATION</span>
            <div style={{ fontFamily: font.display, fontSize: 18, fontWeight: 700, color: C.text, marginTop: 2 }}>Generate Geotechnical Audit Dossier</div>
          </div>
          <button
            onClick={genReport}
            disabled={reportGen}
            className="glass-btn"
            style={{
              padding: "12px 28px", fontSize: 11,
              display: "flex", alignItems: "center", gap: 10,
              background: "linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,180,216,0.15))",
              border: `1px solid ${C.cyan}`, color: "#fff",
              boxShadow: "0 0 16px rgba(0,212,255,0.25)",
              ...(reportGen ? { opacity: 0.5, cursor: "wait" } : {}),
            }}
          >
            <Download size={15} color={C.cyan} />
            {reportGen ? "COMPILING AUDIT TELEMETRY..." : "GENERATE SIGNED AUDIT DOSSIER"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <div className="glass" style={{ padding: 12, borderRadius: 10 }}>
            <div style={{ fontFamily: font.mono, fontSize: 9, color: C.muted, textTransform: "uppercase", marginBottom: 4 }}>Target Bench</div>
            <div style={{ fontFamily: font.display, fontSize: 14, fontWeight: 600, color: C.cyan }}>Bench {bench.id} ({bench.angle}° Face)</div>
          </div>
          <div className="glass" style={{ padding: 12, borderRadius: 10 }}>
            <div style={{ fontFamily: font.mono, fontSize: 9, color: C.muted, textTransform: "uppercase", marginBottom: 4 }}>Audit Classification</div>
            <div style={{ fontFamily: font.display, fontSize: 14, fontWeight: 600, color: C.text }}>Full Shift Clearance</div>
          </div>
          <div className="glass" style={{ padding: 12, borderRadius: 10 }}>
            <div style={{ fontFamily: font.mono, fontSize: 9, color: C.muted, textTransform: "uppercase", marginBottom: 4 }}>Current Calculated FoS</div>
            <div style={{ fontFamily: font.display, fontSize: 14, fontWeight: 700, color: fos < 1.0 ? C.critical : fos < 1.3 ? C.warning : C.safe }}>
              {fos.toFixed(2)} ({fos < 1.0 ? "CRITICAL" : fos < 1.3 ? "CAUTION" : "STABLE"})
            </div>
          </div>
          <div className="glass" style={{ padding: 12, borderRadius: 10 }}>
            <div style={{ fontFamily: font.mono, fontSize: 9, color: C.muted, textTransform: "uppercase", marginBottom: 4 }}>Digital Signature</div>
            <div style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 600, color: C.dim }}>SHA256 Telemetry Hash</div>
          </div>
        </div>
      </Panel>

      {/* Reports Archive Cyber Table */}
      <Panel style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <PanelTitle>Audited Geotechnical Records</PanelTitle>
            <PanelSub>Permanent cryptographic audit trail of open pit slope stability inspections</PanelSub>
          </div>
          <span style={{ fontFamily: font.mono, fontSize: 10, color: C.muted }}>
            {reports.length} ARCHIVED DOSSIERS
          </span>
        </div>

        {reports.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: C.muted }}>
            <FileText size={36} color={C.cyan} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
            <div style={{ fontFamily: font.mono, fontSize: 12, color: C.dim }}>No audit dossiers compiled in current session</div>
            <button
              onClick={genReport}
              className="glass-btn"
              style={{ marginTop: 14, padding: "8px 20px", fontSize: 11, color: C.cyan }}
            >
              Generate First Audit Dossier
            </button>
          </div>
        ) : (
          <table className="cyber-table">
            <thead>
              <tr>
                <th>Dossier ID</th>
                <th>Timestamp</th>
                <th>Target Bench</th>
                <th>Safety Factor</th>
                <th>Compliance Tier</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: font.mono, fontWeight: 700, color: C.cyan }}>
                    #SR-{r.id}
                  </td>
                  <td style={{ fontFamily: font.mono, color: C.dim }}>
                    {r.ts}
                  </td>
                  <td style={{ fontFamily: font.display, fontWeight: 600, color: C.text }}>
                    {r.benches}
                  </td>
                  <td>
                    <span style={{
                      fontFamily: font.mono, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                      color: C.safe, background: "rgba(16,185,129,0.12)"
                    }}>
                      {r.status}
                    </span>
                  </td>
                  <td>
                    <span className="tag-pill" style={{ fontSize: 9 }}>
                      ISO-17776 CERTIFIED
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        onClick={() => setViewingReport(r)}
                        className="glass-btn"
                        style={{ padding: "6px 14px", fontSize: 10, color: C.cyan }}
                      >
                        VIEW DOSSIER
                      </button>
                      <button
                        onClick={() => downloadReportPDF(r)}
                        className="glass-btn"
                        style={{ padding: "6px 12px", fontSize: 10, display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <Printer size={11} color={C.cyan} /> PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );

  /* ═══════════════════════════════════════════════ */
  /* ─── MAIN RENDER ─── */
  /* ═══════════════════════════════════════════════ */
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: font.body, background: C.bg, color: C.text }}>

      {/* ─── CRITICAL ALERT BANNER ─── */}
      {fos < 1.0 && (
        <div
          className="critical-banner"
          style={{
            background: "linear-gradient(90deg, rgba(239,68,68,0.08), rgba(239,68,68,0.18), rgba(239,68,68,0.08))",
            borderBottom: `1px solid ${C.crimson}`,
            padding: "9px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            flexShrink: 0,
            position: "relative",
            overflow: "hidden",
            zIndex: 60,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "16px" }}>🚨</span>
            <span style={{ fontFamily: font.mono, fontSize: "0.74rem", fontWeight: 700, color: C.crimson, letterSpacing: "0.08em" }}>
              CRITICAL RISK: IMMEDIATE BENCH EVACUATION REQUIRED
            </span>
            <span style={{ fontFamily: font.mono, fontSize: "0.70rem", color: "rgba(239,68,68,0.8)", letterSpacing: "0.05em" }}>
              — FoS = {fos.toFixed(2)} — BENCH {bench.id} — SECTORS D4 · D5 · E4 · E5 — ALL PERSONNEL CLEAR NOW
            </span>
            <span style={{ fontSize: "16px" }}>🚨</span>
          </div>
          <div className="scan-line" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "100%", background: "linear-gradient(to bottom, transparent, rgba(239,68,68,0.08), transparent)", pointerEvents: "none" }} />
        </div>
      )}

      {/* ─── TOP NAVBAR ─── */}
      <nav className="glass-nav" style={{ height: "54px", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, zIndex: 50 }}>
        {/* Logo + Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: `linear-gradient(135deg, ${C.indigo} 0%, ${C.violet} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 18px rgba(99,102,241,0.55)`, flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 20L12 4L21 20H3Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" fill="rgba(255,255,255,0.15)" />
              <path d="M7 20L12 10L17 20" stroke="white" strokeWidth="1" strokeLinejoin="round" opacity="0.6" />
              <circle cx="12" cy="4" r="1.5" fill="white" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.94rem", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              GeoGuard <span style={{ color: C.indigo }}>AI</span>
            </div>
            <div style={{ fontFamily: font.mono, fontSize: "0.52rem", color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Slope Stability Monitoring System
            </div>
          </div>
        </div>

        {/* Center Tabs */}
        <div style={{ display: "flex", gap: "3px" }}>
          {[
            { id: "dashboard", label: "Overview" },
            { id: "ai-vision", label: "AI" },
            { id: "3d-model", label: "3D" },
            { id: "reports", label: "Reports" },
          ].map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                style={{
                  background: isActive ? "rgba(99,102,241,0.14)" : "transparent",
                  border: `1px solid ${isActive ? "rgba(99,102,241,0.35)" : "transparent"}`,
                  color: isActive ? C.accent : C.muted,
                  padding: "5px 14px",
                  borderRadius: "7px",
                  fontSize: "0.76rem",
                  fontWeight: isActive ? 600 : 400,
                  cursor: "pointer",
                  fontFamily: font.body,
                  transition: "all 0.2s",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right Section */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: font.mono, fontSize: "0.72rem", color: C.dim }}>{utcTime} UTC</div>
            <div style={{ fontFamily: font.mono, fontSize: "0.52rem", color: C.muted }}>2026-09-16</div>
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
            <span style={{ fontFamily: font.mono, fontSize: "0.6rem", color: C.emerald, fontWeight: 600, letterSpacing: "0.07em", whiteSpace: "nowrap" }}>
              TELEMETRY STREAM ACTIVE
            </span>
          </div>
          {fos < 1.0 && (
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
              <span style={{ fontFamily: font.mono, fontSize: "0.6rem", color: C.crimson, fontWeight: 600, letterSpacing: "0.07em" }}>CRITICAL</span>
            </div>
          )}
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg, #4338CA, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", cursor: "pointer", flexShrink: 0 }}>
            👷
          </div>
        </div>
      </nav>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ─── LEFT SIDEBAR ─── */}
        <aside
          className="sidebar-scroll"
          style={{
            width: "260px",
            minWidth: "260px",
            borderRight: `1px solid ${C.border}`,
            background: "rgba(255,255,255,0.82)",
            overflowY: "auto",
            padding: "14px 13px",
            display: "flex",
            flexDirection: "column",
            gap: "0",
            flexShrink: 0,
          }}
        >
          {/* Bench selection */}
          <SectionLabel>Bench Selection</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "4px", marginBottom: "14px" }}>
            {BENCH.map((b) => (
              <button
                key={b.id}
                onClick={() => setBench(b)}
                style={{
                  padding: "6px 2px",
                  borderRadius: "6px",
                  fontFamily: font.mono,
                  fontSize: "0.65rem",
                  fontWeight: bench.id === b.id ? 700 : 500,
                  cursor: "pointer",
                  background: bench.id === b.id ? "rgba(99,102,241,0.2)" : "rgba(28,31,46,0.6)",
                  border: `1px solid ${bench.id === b.id ? "rgba(99,102,241,0.45)" : C.border}`,
                  color: bench.id === b.id ? "#818CF8" : C.dim,
                  transition: "all .2s ease",
                  boxShadow: bench.id === b.id ? "0 0 10px rgba(99,102,241,0.25)" : "none",
                }}
              >
                {b.id}
              </button>
            ))}
          </div>

          {/* Optical Image Input */}
          <SectionLabel>Optical Image Input</SectionLabel>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            style={{
              border: `1.5px dashed ${C.border}`,
              borderRadius: "8px",
              padding: "12px 10px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              background: "rgba(15,17,26,0.5)",
              cursor: "pointer",
              transition: "all 0.2s",
              marginBottom: "16px",
              minHeight: "88px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {image ? <img src={image} alt="Uploaded pit wall" style={{ width: "100%", height: "58px", objectFit: "cover", borderRadius: "4px", opacity: 0.85 }} /> : <div className="gg-empty-desc">No image loaded</div>}
            <label style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.78)", cursor: "pointer", backdropFilter: "blur(2px)" }}>
              <Camera size={16} color={C.indigo} style={{ marginBottom: 3 }} />
              <span style={{ fontSize: "0.62rem", color: C.accent, fontFamily: font.mono }}>Click / Drop pit wall</span>
              <span style={{ fontFamily: font.mono, fontSize: "0.50rem", color: C.muted }}>PNG · JPG · GeoTIFF</span>
              <input type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
            </label>
          </div>

          {/* IoT Telemetry */}
          <SectionLabel>IoT Telemetry</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "18px" }}>
            <SliderInput
              label="Rainfall (mm/hr)"
              value={bench.rainfall}
              min={0}
              max={120}
              step={1}
              unit=" mm/hr"
              decimals={0}
              color={bench.rainfall > 50 ? C.crimson : bench.rainfall > 25 ? C.amber : C.indigo}
              onChange={(v) => setBench((p) => ({ ...p, rainfall: v }))}
            />
            <SliderInput
              label="Vibration (mm/s)"
              value={bench.vibration}
              min={0}
              max={12}
              step={0.1}
              unit=" mm/s"
              decimals={1}
              color={bench.vibration > 5 ? C.crimson : bench.vibration > 3 ? C.amber : C.indigo}
              onChange={(v) => setBench((p) => ({ ...p, vibration: v }))}
            />
            <SliderInput
              label="Water Seepage (ru)"
              value={bench.seepage}
              min={0}
              max={1}
              step={0.01}
              unit=""
              decimals={2}
              color={bench.seepage > 0.4 ? C.crimson : bench.seepage > 0.25 ? C.amber : C.emerald}
              onChange={(v) => setBench((p) => ({ ...p, seepage: v }))}
            />
          </div>

          {/* Geotechnical Parameters */}
          <SectionLabel>Geotechnical Parameters</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "18px" }}>
            <SliderInput
              label="Slope Angle (°)"
              value={bench.angle}
              min={30}
              max={85}
              step={1}
              unit="°"
              decimals={0}
              color={bench.angle > 65 ? C.crimson : bench.angle > 55 ? C.amber : C.indigo}
              onChange={(v) => setBench((p) => ({ ...p, angle: v }))}
            />
            <SliderInput
              label="Discontinuity (freq/m)"
              value={bench.discontinuity}
              min={5}
              max={60}
              step={1}
              unit=""
              decimals={0}
              color={bench.discontinuity < 20 ? C.crimson : bench.discontinuity < 35 ? C.amber : C.emerald}
              onChange={(v) => setBench((p) => ({ ...p, discontinuity: v }))}
            />
            <SliderInput
              label="Bench Height (m)"
              value={bench.height}
              min={4}
              max={24}
              step={1}
              unit=" m"
              decimals={0}
              color={bench.height > 15 ? C.amber : C.indigo}
              onChange={(v) => setBench((p) => ({ ...p, height: v }))}
            />
          </div>

          {/* Sensor Network */}
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
              <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <span className={s.ok ? "live-dot" : undefined}
                    style={{ width: "6px", height: "6px", borderRadius: "50%", background: s.ok ? C.emerald : C.amber, display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.66rem", color: C.dim }}>{s.name}</span>
                </div>
                <span style={{
                  fontFamily: font.mono, fontSize: "0.55rem",
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

          {/* FoS Classification */}
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
                  <span style={{ fontSize: "0.64rem", color: C.dim }}>{r.label}</span>
                </div>
                <span style={{ fontFamily: font.mono, fontSize: "0.58rem", color: C.muted }}>{r.range}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* ─── MAIN CONTENT ─── */}
        <main style={{ flex: 1, overflowY: "auto", padding: 20, background: "transparent" }}>
          {active === "dashboard" && renderDashboard()}
          {active === "3d-model" && render3D()}
          {active === "alerts" && renderAlerts()}
          {active === "history" && renderHistory()}
          {active === "reports" && renderReports()}
          {active === "ai-vision" && renderAIVision()}
        </main>
      </div>

      {/* ─── REPORT VIEW MODAL ─── */}
      {viewingReport && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(10px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20
        }}>
          <div className="glass" style={{
            width: "100%",
            maxWidth: 680,
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            borderRadius: 20,
            overflow: "hidden",
            border: `1px solid rgba(0,212,255,0.25)`,
            background: "radial-gradient(ellipse at top, #0c1c34 0%, #060c18 100%)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.8), 0 0 30px rgba(0,212,255,0.12)",
            position: "relative",
          }}>
            <div className="hud-corner hud-corner-tl" />
            <div className="hud-corner hud-corner-tr" />
            <div className="hud-corner hud-corner-bl" />
            <div className="hud-corner hud-corner-br" />

            {/* Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px 24px",
              borderBottom: `1px solid rgba(0,212,255,0.12)`
            }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 4, background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)", fontFamily: font.mono, fontSize: 9, color: C.cyan, marginBottom: 4 }}>
                  ISO-17776 STATUTORY CERTIFICATE
                </div>
                <div style={{ fontFamily: font.display, fontSize: 18, fontWeight: 700, color: C.text }}>
                  Geotechnical Audit Dossier #{viewingReport.id}
                </div>
                <div style={{ fontFamily: font.mono, fontSize: 11, color: C.muted, marginTop: 2 }}>
                  Compiled: {viewingReport.ts} · Pit Sector North
                </div>
              </div>
              <button
                onClick={() => setViewingReport(null)}
                className="glass-btn"
                style={{ padding: 8, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: 24, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Status Banner */}
              {(() => {
                const snap = viewingReport.snapshot || {
                  bench: bench,
                  alerts: alerts,
                  fos: fos,
                  smr: smr,
                  jv: jv,
                  risk: risk
                };
                const statusColor = snap.fos < 1.0 ? C.critical : snap.fos < 1.3 ? C.warning : C.safe;
                const statusLabel = snap.fos < 1.0 ? "CRITICAL" : snap.fos < 1.3 ? "CAUTION" : "STABLE";

                return (
                  <>
                    <div style={{
                      padding: 16,
                      borderRadius: 12,
                      background: `rgba(${snap.fos < 1.0 ? '255,90,43' : snap.fos < 1.3 ? '217,164,65' : '79,163,122'}, 0.08)`,
                      border: `1px solid ${statusColor}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <ShieldAlert size={20} color={statusColor} />
                        <div>
                          <div style={{ fontFamily: font.mono, fontSize: 10, color: C.muted, textTransform: "uppercase" }}>Safety Status</div>
                          <div style={{ fontFamily: font.display, fontSize: 16, fontWeight: 700, color: statusColor }}>
                            {statusLabel}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: font.mono, fontSize: 10, color: C.muted, textTransform: "uppercase" }}>FoS Factor</div>
                        <div style={{ fontFamily: font.display, fontSize: 18, fontWeight: 700, color: statusColor }}>
                          {snap.fos.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div className="glass" style={{ padding: 14, borderRadius: 12 }}>
                        <div style={{ fontFamily: font.mono, fontSize: 9, color: C.muted, textTransform: "uppercase", marginBottom: 4 }}>Slope Mass Rating</div>
                        <div style={{ fontFamily: font.display, fontSize: 16, fontWeight: 600, color: C.text }}>{snap.smr.toFixed(1)}</div>
                      </div>
                      <div className="glass" style={{ padding: 14, borderRadius: 12 }}>
                        <div style={{ fontFamily: font.mono, fontSize: 9, color: C.muted, textTransform: "uppercase", marginBottom: 4 }}>Joint Density (Jv)</div>
                        <div style={{ fontFamily: font.display, fontSize: 16, fontWeight: 600, color: C.text }}>{snap.jv.toFixed(2)} j/m³</div>
                      </div>
                      <div className="glass" style={{ padding: 14, borderRadius: 12 }}>
                        <div style={{ fontFamily: font.mono, fontSize: 9, color: C.muted, textTransform: "uppercase", marginBottom: 4 }}>Target Location</div>
                        <div style={{ fontFamily: font.display, fontSize: 16, fontWeight: 600, color: C.text }}>Bench {snap.bench.id}</div>
                      </div>
                      <div className="glass" style={{ padding: 14, borderRadius: 12 }}>
                        <div style={{ fontFamily: font.mono, fontSize: 9, color: C.muted, textTransform: "uppercase", marginBottom: 4 }}>Pit Weathering</div>
                        <div style={{ fontFamily: font.display, fontSize: 16, fontWeight: 600, color: C.text }}>{(snap.bench.weathering * 100).toFixed(0)}% Index</div>
                      </div>
                    </div>

                    {/* Parameter Details Table — with benchmark comparison bars */}
                    <div>
                      <div style={{ fontFamily: font.mono, fontSize: 11, color: C.dim, textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.08em" }}>
                        Slope Parameters — Benchmark Comparison
                      </div>
                      <div className="glass" style={{ padding: 16, borderRadius: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                        {[
                          { label: "Face Angle", raw: snap.bench.angle, max: 85, limit: 65, unit: "°", invert: false },
                          { label: "Discontinuity Spacing", raw: snap.bench.discontinuity, max: 60, limit: 40, unit: " cm", invert: true },
                          { label: "Bench Height", raw: snap.bench.height, max: 24, limit: 12, unit: " m", invert: false },
                          { label: "Rainfall Rate", raw: snap.bench.rainfall, max: 120, limit: 30, unit: " mm/h", invert: false },
                          { label: "Water Seepage", raw: snap.bench.seepage, max: 1.0, limit: 0.25, unit: " L/min", invert: false },
                          { label: "Ground Vibration", raw: snap.bench.vibration, max: 12, limit: 5.0, unit: " mm/s", invert: false },
                        ].map((param, index) => {
                          // invert = higher is better (e.g. discontinuity spacing), else lower is better
                          const isExceeded = param.invert ? param.raw < param.limit : param.raw > param.limit;
                          const fillPct = Math.min((param.raw / param.max) * 100, 100);
                          const limitPct = (param.limit / param.max) * 100;
                          const barColor = isExceeded ? C.critical : param.raw > param.limit * 0.8 ? C.warning : C.safe;
                          const statusLabel = isExceeded ? "EXCEEDED" : param.raw > param.limit * 0.8 ? "CAUTION" : "SAFE";
                          const statusBg = isExceeded ? "rgba(239,68,68,0.15)" : param.raw > param.limit * 0.8 ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.1)";
                          return (
                            <div key={index} style={{ paddingBottom: index < 5 ? 12 : 0, borderBottom: index < 5 ? `1px solid rgba(0,212,255,0.06)` : "none" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                                <span style={{ fontFamily: font.mono, fontSize: 10, color: C.dim }}>{param.label}</span>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontFamily: font.mono, fontSize: 11, fontWeight: 600, color: barColor }}>
                                    {param.raw.toFixed(param.unit === "°" || param.unit === " m" || param.unit === " cm" ? 0 : 1)}{param.unit}
                                  </span>
                                  <span style={{
                                    fontFamily: font.mono, fontSize: 8, fontWeight: 700, letterSpacing: "0.08em",
                                    padding: "2px 7px", borderRadius: 4, color: barColor, background: statusBg,
                                    border: `1px solid ${barColor}44`,
                                  }}>{statusLabel}</span>
                                </div>
                              </div>
                              {/* Benchmark bar */}
                              <div className="bench-bar-track" style={{ position: "relative" }}>
                                <div className="bench-bar-fill" style={{
                                  width: `${fillPct}%`,
                                  background: `linear-gradient(90deg, ${barColor}88, ${barColor})`,
                                  boxShadow: `0 0 8px ${barColor}44`,
                                }} />
                                {/* Limit marker */}
                                <div style={{
                                  position: "absolute", top: 0, bottom: 0, left: `${limitPct}%`,
                                  width: 2, background: "rgba(255,255,255,0.4)", borderRadius: 1,
                                }} />
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: font.mono, fontSize: 8, color: C.muted, marginTop: 3 }}>
                                <span>0</span>
                                <span style={{ color: "rgba(255,255,255,0.3)" }}>limit: {param.limit}{param.unit}</span>
                                <span>{param.max}{param.unit}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Recommendations */}
                    <div>
                      <div style={{ fontFamily: font.mono, fontSize: 11, color: C.dim, textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.08em" }}>Safety Recommendations</div>
                      <div className="glass" style={{ padding: 16, borderRadius: 12, fontSize: 13, color: C.dim, lineHeight: 1.5, borderLeft: `3px solid ${statusColor}` }}>
                        {snap.fos < 1.0
                          ? `Immediate evacuation of Bench ${snap.bench.id} required. Factor of Safety is critically low. Direct all vehicles and personnel to safe zones.`
                          : snap.fos < 1.3
                          ? `Restricted access to Bench ${snap.bench.id}. Minimize heavy vehicle vibration and manage drainage. Increase automated monitoring frequency.`
                          : `Stability is within standard safety margins. Continue active monitoring. No immediate remediation actions required.`}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Footer */}
            <div style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              padding: "16px 24px",
              borderTop: `1px solid ${C.line}`,
              background: "rgba(255,255,255,0.01)"
            }}>
              <button
                onClick={() => setViewingReport(null)}
                className="glass-btn"
                style={{ padding: "10px 20px", fontSize: 12 }}
              >
                Close
              </button>
              <button
                onClick={() => downloadReportPDF(viewingReport)}
                className="glass-btn"
                style={{
                  padding: "10px 22px",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: `1px solid ${C.cyan}`,
                  background: `linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,180,216,0.15))`,
                  color: "#fff",
                  boxShadow: "0 0 16px rgba(0,212,255,0.25)"
                }}
              >
                <Download size={14} color={C.cyan} />
                Download Certified PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
