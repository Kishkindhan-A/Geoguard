import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from 'three';
import {
  AlertTriangle, Activity, Camera, CloudRain, Compass, Gauge, Layers,
  MessageSquare, Mountain, Radio, Send, UploadCloud, Waves, Satellite,
  ShieldAlert, MapPin, Clock, CircleDot, Box, Bell, TrendingDown,
  FileText, Download, Plus, User, Bot, Droplets, BarChart3, Cpu, Maximize2, Minimize2,
  X, Printer,
} from "lucide-react";

const C = {
  bg: "#080a10",
  surface: "rgba(255,255,255,0.04)",
  surfaceRaised: "rgba(255,255,255,0.07)",
  line: "rgba(255,255,255,0.08)",
  critical: "#FF5A2B",
  warning: "#D9A441",
  warningOrange: "#E87830",
  safe: "#4FA37A",
  safeDim: "#6B9A60",
  info: "#6E93B5",
  text: "#EDE7DA",
  dim: "#A89C88",
  muted: "#6E6353",
  accent: "#FF5A2B",
  glass: "rgba(255,255,255,0.04)",
  glassBorder: "rgba(255,255,255,0.08)",
};
const font = {
  display: "'Space Grotesk', system-ui, sans-serif",
  body: "'IBM Plex Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', monospace",
};

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

/* ─── Sections ─── */
function SectionTag({ n, label }: { n: number; label: string }) {
  return (
    <div className="tag-pill" style={{ marginBottom: 10 }}>
      <span style={{ color: C.info }}>{`§0${n}`}</span> {label}
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
      style={{ padding: 20, borderTop: `3px solid ${accent}`, minWidth: 180, flex: 1 }}>
      <div style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: "0.2em", color: C.muted, marginBottom: 10 }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily: font.display, fontSize: 38, fontWeight: 700, color: status, lineHeight: 1 }}>
        {value.toFixed(1)}<span style={{ fontSize: 15, color: C.dim, fontWeight: 400, marginLeft: 4 }}>{unit}</span>
      </div>
      <TickScale pct={pct} status={status} />
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: font.mono, fontSize: 10, color: C.muted, marginTop: 6 }}>
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

/* ─── Tick Scale Bar ─── */
function TickScale({ pct, status }: { pct: number; status: string }) {
  return (
    <div style={{ position: "relative", height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", marginTop: 10, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, borderRadius: 4, background: status, transition: "width .6s ease", boxShadow: `0 0 12px ${status}44` }} />
      {[0, 25, 50, 75].map((t) => (
        <div key={t} style={{ position: "absolute", left: `${t}%`, top: 0, width: 1, height: "100%", background: "rgba(255,255,255,0.1)" }} />
      ))}
    </div>
  );
}

/* ─── Panel Wrapper ─── */
function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="glass" style={{ padding: 24, ...style }}>
      {children}
    </div>
  );
}
function PanelTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: font.display, fontSize: 17, fontWeight: 600, color: C.text, letterSpacing: "0.03em" }}>{children}</div>;
}
function PanelSub({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: font.mono, fontSize: 11, color: C.muted, letterSpacing: "0.14em", textTransform: "uppercase" as const, marginTop: 4 }}>{children}</div>;
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
function getRisk(fos: number) {
  if (fos < 1.0) return { label: "CRITICAL", color: C.critical, bg: "rgba(255,90,43,0.12)" };
  if (fos < 1.3) return { label: "CAUTION", color: C.warning, bg: "rgba(217,164,65,0.10)" };
  return { label: "STABLE", color: C.safe, bg: "rgba(79,163,122,0.08)" };
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

function analyzeTerrain(src: string, gridSize: number): Promise<{ heightmap: number[][]; analysis: TerrainAnalysis }> {
  return new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
      const analysisRes = 128;
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
      const avgEdge = totalEdge / (edges.length * edges[0].length);
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

      const descLines: string[] = [];
      descLines.push(`Image classified as ${terrainType} with ${benchCount} horizontal bench level${benchCount > 1 ? "s" : ""} detected.`);
      descLines.push(`Slope orientation: ${slopeDir} at ~${slopeAngle} deg. Fracture density: ${(fractureDensity * 100).toFixed(0)}%.`);
      descLines.push(`${riskZones} high-contrast risk zones identified. Brightness ${(avgBrightness * 100).toFixed(0)}%, contrast ${(contrast * 100).toFixed(0)}%.`);
      descLines.push(`Heightmap generated from edge-enhanced luminance with bench-level flattening and fracture accentuation.`);

      const analysis: TerrainAnalysis = {
        slopeAngle, benchCount, fractureDensity: Math.round(fractureDensity * 100) / 100,
        terrainType, riskZones, avgBrightness: Math.round(avgBrightness * 100) / 100,
        contrast: Math.round(contrast * 100) / 100, slopeDirection: slopeDir,
        description: descLines.join(" "),
      };

      const cvH = document.createElement("canvas");
      cvH.width = gridSize;
      cvH.height = gridSize;
      const ctxH = cvH.getContext("2d")!;
      ctxH.drawImage(img, 0, 0, gridSize, gridSize);
      const hData = ctxH.getImageData(0, 0, gridSize, gridSize).data;
      const hGray = toGray(hData, gridSize, gridSize);
      const hEdges = sobelMag(hGray);

      const grid: number[][] = [];
      for (let y = 0; y < gridSize; y++) {
        const row: number[] = [];
        for (let x = 0; x < gridSize; x++) {
          let h = hGray[y][x];

          const ey = y > 0 && y < gridSize - 1 ? hEdges[Math.min(y - 1, hEdges.length - 1)][Math.min(x - 1, hEdges[0].length - 1)] || 0 : 0;
          const edgeStr = clamp(ey / 0.4, 0, 1);
          h = h * (1 - edgeStr * 0.3) + (1 - h) * edgeStr * 0.15;

          const rowProfile = rowAvg.length > 0 ? rowAvg[Math.floor(y / gridSize * analysisRes)] || 0.5 : 0.5;
          const nextRow = rowAvg.length > 0 ? rowAvg[Math.min(Math.floor((y + 1) / gridSize * analysisRes), analysisRes - 1)] || 0.5 : 0.5;
          const rowDelta = Math.abs(rowProfile - nextRow);
          if (rowDelta < 0.015 && benchCount > 0) {
            h = h * 0.85 + rowProfile * 0.15;
          }

          const edgeFactor = (x > 0 && x < gridSize - 1 && y > 0 && y < gridSize - 1)
            ? (hEdges[Math.min(y, hEdges.length - 1)] || [])[Math.min(x, (hEdges[0] || []).length - 1)] || 0 : 0;
          if (edgeFactor > 0.35) {
            h = h * 0.7 + (h > 0.5 ? 0.85 : 0.15) * 0.3;
          }

          row.push(clamp(h, 0, 1));
        }
        grid.push(row);
      }

      for (let pass = 0; pass < 2; pass++) {
        for (let y = 1; y < gridSize - 1; y++) {
          for (let x = 1; x < gridSize - 1; x++) {
            const isBenchRow = Math.abs((rowAvg[Math.floor(y / gridSize * analysisRes)] || 0.5) - (rowAvg[Math.floor((y + 1) / gridSize * analysisRes)] || 0.5)) < 0.015;
            if (!isBenchRow) {
              const avg = (grid[y - 1][x] + grid[y + 1][x] + grid[y][x - 1] + grid[y][x + 1]) / 4;
              grid[y][x] = grid[y][x] * 0.8 + avg * 0.2;
            }
          }
        }
      }

      resolve({ heightmap: grid, analysis });
      } catch (err) {
        console.error("Terrain analysis error:", err);
        const fallback: number[][] = Array.from({ length: gridSize }, (_, y) =>
          Array.from({ length: gridSize }, (_, x) => clamp(0.5 + Math.sin(x / gridSize * 6) * Math.cos(y / gridSize * 6) * 0.3, 0, 1))
        );
        resolve({
          heightmap: fallback,
          analysis: { slopeAngle: 45, benchCount: 3, fractureDensity: 0.3, terrainType: "unknown", riskZones: 5, avgBrightness: 0.5, contrast: 0.2, slopeDirection: "top-to-bottom", description: "Error during analysis. Generated procedural fallback." },
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

function renderTerrain(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  heightmap: number[][], rotX: number, rotY: number, zoom: number,
  mode: "solid" | "wireframe" | "textured",
  texImage: HTMLImageElement | null
) {
  const gs = heightmap.length;
  const spacing = 320 / gs;
  const heightScale = 120;
  const focal = 500;
  const cx = w / 2;
  const cy = h / 2 + 40;

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
      const py = heightmap[gy][gx] * heightScale;
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

/* ─── SHAP Bars ─── */
function ShapBars({ values }: { values: { feature: string; value: number; positive: boolean }[] }) {
  const maxAbs = Math.max(...values.map((v) => Math.abs(v.value)), 0.001);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {values.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 150, fontFamily: font.mono, fontSize: 11, color: C.dim, textAlign: "right" }}>{s.feature}</div>
          <div style={{ flex: 1, height: 18, borderRadius: 6, background: "rgba(255,255,255,0.04)", position: "relative", overflow: "hidden", border: `1px solid rgba(255,255,255,0.04)` }}>
            <div style={{
              position: "absolute", top: 0, height: "100%", borderRadius: 6,
              background: s.positive ? `linear-gradient(90deg, ${C.critical}88, ${C.critical})` : `linear-gradient(270deg, ${C.safe}88, ${C.safe})`,
              width: `${(Math.abs(s.value) / maxAbs) * 50}%`,
              left: s.positive ? "50%" : `${50 - (Math.abs(s.value) / maxAbs) * 50}%`,
              transition: "width .4s ease, left .4s ease",
              boxShadow: s.positive ? `0 0 8px ${C.critical}33` : `0 0 8px ${C.safe}33`,
            }} />
          </div>
          <div style={{ width: 50, fontFamily: font.mono, fontSize: 11, color: s.positive ? C.critical : C.safe, textAlign: "left" }}>
            {s.value > 0 ? "+" : ""}{s.value.toFixed(3)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Default Image (generated mine bench) ─── */
function generateDefaultImage(): string {
  const c = document.createElement("canvas");
  c.width = 800; c.height = 400;
  const ctx = c.getContext("2d")!;
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, 120);
  sky.addColorStop(0, "#3a506b"); sky.addColorStop(1, "#5c7a99");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 800, 120);
  // Mine bench layers (terraced walls)
  const layers = [
    { y: 120, h: 50, colors: ["#8B7355", "#7A6548", "#6B5838"] },
    { y: 170, h: 45, colors: ["#9B8565", "#8A7558", "#7B6848"] },
    { y: 215, h: 50, colors: ["#A08B6B", "#8F7A5B", "#7E6A4B"] },
    { y: 265, h: 45, colors: ["#B09B7B", "#9F8A6B", "#8E7A5B"] },
    { y: 310, h: 50, colors: ["#C0AB8B", "#AF9A7B", "#9E8A6B"] },
  ];
  layers.forEach((l, li) => {
    const g = ctx.createLinearGradient(0, l.y, 0, l.y + l.h);
    g.addColorStop(0, l.colors[0]); g.addColorStop(0.5, l.colors[1]); g.addColorStop(1, l.colors[2]);
    ctx.fillStyle = g; ctx.fillRect(0, l.y, 800, l.h);
    // Bench edge line
    ctx.strokeStyle = "rgba(60,45,30,0.6)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, l.y);
    for (let x = 0; x < 800; x += 3) ctx.lineTo(x, l.y + Math.sin(x * 0.02 + li) * 3);
    ctx.stroke();
    // Fracture lines
    for (let i = 0; i < 8; i++) {
      const sx = Math.random() * 800, sy = l.y + Math.random() * l.h;
      ctx.strokeStyle = `rgba(50,35,20,${0.2 + Math.random() * 0.3})`;
      ctx.lineWidth = 0.5 + Math.random();
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (Math.random() - 0.5) * 40, sy + Math.random() * 20);
      ctx.stroke();
    }
  });
  // Water seepage stains
  for (let i = 0; i < 6; i++) {
    const x = 100 + Math.random() * 600, y = 180 + Math.random() * 150;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, 15 + Math.random() * 20);
    rg.addColorStop(0, "rgba(40,50,60,0.25)"); rg.addColorStop(1, "rgba(40,50,60,0)");
    ctx.fillStyle = rg; ctx.fillRect(x - 30, y - 30, 60, 60);
  }
  // Toe / pit floor
  ctx.fillStyle = "#5A4A38"; ctx.fillRect(0, 360, 800, 40);
  return c.toDataURL("image/png");
}
const DEFAULT_IMAGE = generateDefaultImage();

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

async function apiChat(message: string, fos: number, ru: number, rainfall: number, bench: any, smr: number, jv: number, shovelOk: boolean, blastingOk: boolean, chatMsgs: {role: string; text: string}[]) {
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

/* ═══════════════════════════════════════════════════ */
export default function App() {
  const [active, setActive] = useState("dashboard");
  const [bench, setBench] = useState(BENCH_DEFAULT);
  const [image, setImage] = useState<string>(DEFAULT_IMAGE);
  const [showHeat, setShowHeat] = useState(true);
  const [showFractures, setShowFractures] = useState(true);
  const [viewMode, setViewMode] = useState<"RAW" | "CV ANALYSIS">("CV ANALYSIS");
  const [chatMsgs, setChatMsgs] = useState<{ role: string; text: string }[]>([
    { role: "system", text: "Live telemetry linked. RF-slot 14 active. Type `help` for commands." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [fusionResult, setFusionResult] = useState<any>(null);
  const [overlayB64, setOverlayB64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [spatialGrid, setSpatialGrid] = useState<number[][] | null>(null);
  const [spatialSummary, setSpatialSummary] = useState<{ critical: number; high: number; moderate: number; low: number; safe: number; mean_risk?: number; max_risk?: number; high_risk_pct?: number } | null>(null);
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
  const [gridRes, setGridRes] = useState(40);
  const [converting3d, setConverting3d] = useState(false);
  const [terrainAnalysis, setTerrainAnalysis] = useState<TerrainAnalysis | null>(null);
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const [reports, setReports] = useState<any[]>([]);
  const [reportGen, setReportGen] = useState(false);
  const [viewingReport, setViewingReport] = useState<any | null>(null);

  /* ─── Derived values ─── */
  const jv = computeJv(bench.angle, bench.discontinuity, bench.rainfall);
  const fos = computeFoS(bench.angle, bench.seepage, jv);
  const smr = computeSMR(bench.discontinuity, bench.angle, bench.weathering);
  const risk = getRisk(fos);
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
        const res = await apiChat(userMsg, fos, bench.seepage, bench.rainfall, bench, smr, jv, shovelOk, blastingOk, chatMsgs.filter((m) => m.role !== "system"));
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

  /* ─── Convert image to 3D terrain (analysis-driven) ─── */
  const convertTo3D = useCallback(async () => {
    setConverting3d(true);
    setTerrainAnalysis(null);
    setActive("3d-model");
    try {
      console.log("[3D] Starting conversion, image length:", image.length, "gridRes:", gridRes);
      const { heightmap: hm, analysis } = await analyzeTerrain(image, gridRes);
      console.log("[3D] Heightmap received:", hm ? `${hm.length}x${hm[0]?.length}` : "null", "analysis:", analysis?.terrainType);
      if (!hm || hm.length === 0) throw new Error("Heightmap generation failed");
      setHeightmap(hm);
      setTerrainAnalysis(analysis);
      console.log("[3D] Heightmap state set, sample values:", hm[0]?.slice(0, 5));
      const img = new Image();
      if (!image.startsWith("data:")) img.crossOrigin = "anonymous";
      img.onload = () => { texImgRef.current = img; setMeshMode("textured"); console.log("[3D] Texture loaded"); };
      img.onerror = () => { setMeshMode("solid"); console.log("[3D] Texture failed, using solid"); };
      img.src = image;
    } catch (e) {
      console.error("[3D] Conversion failed:", e);
      setChatMsgs((p) => [...p, { role: "system", text: `3D conversion failed: ${e}` }]);
    }
    setConverting3d(false);
  }, [image, gridRes]);

  /* ─── API health check ─── */
  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then((d) => setApiOnline(d.status === "ok")).catch(() => setApiOnline(false));
  }, []);

  /* ─── ESC to exit fullscreen 3D ─── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && fullScreen3d) setFullScreen3d(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullScreen3d]);

  /* ─── Auto-analyze image for spatial risk when image changes ─── */
  useEffect(() => {
    if (!apiOnline || image === DEFAULT_IMAGE) return;
    let cancelled = false;
    apiSpatialRisk(image).then((spatial) => {
      if (cancelled) return;
      if (spatial.grid) setSpatialGrid(spatial.grid);
      if (spatial.summary) setSpatialSummary(spatial.summary);
      if (spatial.overlay) setOverlayB64(spatial.overlay);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [image, apiOnline]);

  /* ─── Run full analysis via backend ─── */
  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    try {
      const [result, spatial] = await Promise.all([
        apiAnalyze({
          image,
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
        apiSpatialRisk(image),
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
  const renderDashboard = () => (
    <>
      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18, marginBottom: 22 }}>
        <GaugeCard label="Factor of Safety" value={fos} unit="" min={0} max={3} accent={risk.color} critThresh={1.0} warnThresh={1.3} />
        <GaugeCard label="SMR Rating" value={smr} unit="/100" min={0} max={100} accent={smr < 30 ? C.critical : smr < 55 ? C.warning : C.safe} critThresh={30} warnThresh={55} />
        <GaugeCard label="Junction Vol." value={jv} unit="blk/m3" min={0} max={50} accent={jv > 25 ? C.warning : C.info} critThresh={35} warnThresh={25} />
        <div className={`gauge-glass ${risk.label === "CRITICAL" ? "glow-critical" : risk.label === "CAUTION" ? "glow-warning" : "glow-safe"}`}
          style={{ padding: 20, borderTop: `3px solid ${risk.color}`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <ShieldAlert size={34} color={risk.color} style={{ marginBottom: 10 }} />
          <div style={{ fontFamily: font.display, fontSize: 26, fontWeight: 700, color: risk.color }}>{risk.label}</div>
          <div style={{ fontFamily: font.mono, fontSize: 11, color: C.muted, marginTop: 6 }}>
            Shovel: <span style={{ color: shovelOk ? C.safe : C.critical }}>{shovelOk ? "CLEARED" : "HOLD"}</span>
            {" / "}Blasting: <span style={{ color: blastingOk ? C.safe : C.critical }}>{blastingOk ? "CLEARED" : "HOLD"}</span>
          </div>
        </div>
      </div>

      {/* Run Analysis + API status */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
        <button onClick={runAnalysis} disabled={analyzing} className="glass-btn"
          style={{
            padding: "12px 28px", fontFamily: font.mono, fontSize: 12,
            display: "flex", alignItems: "center", gap: 10,
            ...(analyzing ? { opacity: 0.5, cursor: "wait" } : {}),
          }}>
          <Satellite size={16} />
          {analyzing ? "ANALYZING..." : "RUN FULL FUSION ANALYSIS"}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: font.mono, fontSize: 11, color: apiOnline ? C.safe : C.critical }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: apiOnline ? C.safe : C.critical }} className={apiOnline ? "bc-live" : ""} />
          API {apiOnline ? "ONLINE" : "OFFLINE"}
        </div>
        {fusionResult && (
          <span style={{ fontFamily: font.mono, fontSize: 11, color: C.dim }}>
            FoS {fusionResult.fos} | SMR {fusionResult.smr} | {fusionResult.risk_label}
          </span>
        )}
      </div>

      {/* Two-column: Optical Survey + Heatmap */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 22 }}>
        {/* Optical Survey */}
        <Panel>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <SectionTag n={2} label="Optical Survey" />
              <PanelTitle>Bench Face Analysis</PanelTitle>
              <PanelSub>RGB composite {viewMode === "CV ANALYSIS" ? "+ hazard overlay" : "raw feed"}</PanelSub>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["RAW", "CV ANALYSIS"] as const).map((m) => (
                <button key={m} onClick={() => setViewMode(m)} className={`glass-btn ${viewMode === m ? "glass-btn-active" : ""}`}
                  style={{ padding: "8px 16px", fontFamily: font.mono, fontSize: 10, letterSpacing: "0.12em" }}>{m}</button>
              ))}
            </div>
          </div>
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "rgba(255,255,255,0.02)", height: 260, border: `1px solid rgba(255,255,255,0.06)` }}
            onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
            <img src={image} alt="Bench" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {overlayB64 && viewMode === "CV ANALYSIS" && (
              <img src={`data:image/png;base64,${overlayB64}`} alt="Risk overlay"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.85, transition: "opacity 0.4s ease" }} />
            )}
            {overlayB64 && viewMode === "CV ANALYSIS" && (
              <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(8,10,16,0.8)", backdropFilter: "blur(8px)", border: `1px solid ${C.critical}`, borderRadius: 10, padding: "6px 14px", fontFamily: font.mono, fontSize: 10, color: C.critical, letterSpacing: "0.1em", boxShadow: `0 0 16px ${C.critical}33` }}>
                RISK HEATMAP ACTIVE
              </div>
            )}
            {/* Color legend bar */}
            {overlayB64 && viewMode === "CV ANALYSIS" && (
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "6px 12px 8px", background: "linear-gradient(0deg, rgba(8,10,16,0.92) 0%, rgba(8,10,16,0.6) 60%, transparent 100%)", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: "linear-gradient(to right, rgb(20,80,180), rgb(50,200,220), rgb(70,210,90), rgb(50,180,30), rgb(255,160,30), rgb(255,30,20))" }} />
                {["0%", "25%", "50%", "75%", "100%"].map((l, i) => (
                  <span key={i} style={{ fontFamily: font.mono, fontSize: 8, color: C.muted, minWidth: 22, textAlign: "center" }}>{l}</span>
                ))}
              </div>
            )}
            {viewMode === "CV ANALYSIS" && showFractures && (
              <svg viewBox="0 0 400 200" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                <line x1="80" y1="40" x2="180" y2="120" stroke={C.critical} strokeWidth={2} opacity={0.8} strokeDasharray="4 2" />
                <line x1="200" y1="30" x2="300" y2="140" stroke={C.warning} strokeWidth={1.5} opacity={0.7} strokeDasharray="3 3" />
                <line x1="120" y1="90" x2="260" y2="60" stroke={C.critical} strokeWidth={2} opacity={0.75} />
                <circle cx="140" cy="80" r={18} fill="none" stroke={C.critical} strokeWidth={1.5} opacity={0.6} />
                <circle cx="240" cy="90" r={14} fill="none" stroke={C.warning} strokeWidth={1} opacity={0.5} />
              </svg>
            )}
            {viewMode === "CV ANALYSIS" && showHeat && (
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 50, background: "linear-gradient(0deg, rgba(255,90,43,0.45) 0%, rgba(217,164,65,0.2) 50%, transparent 100%)" }} />
            )}
            <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 6 }}>
              <label className="glass-btn" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontFamily: font.mono, fontSize: 10, color: C.dim, cursor: "pointer" }}>
                <input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} style={{ accentColor: C.info }} /> Heatmap
              </label>
              <label className="glass-btn" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontFamily: font.mono, fontSize: 10, color: C.dim, cursor: "pointer" }}>
                <input type="checkbox" checked={showFractures} onChange={(e) => setShowFractures(e.target.checked)} style={{ accentColor: C.info }} /> Fractures
              </label>
            </div>
            <div style={{ position: "absolute", bottom: 10, right: 10, fontFamily: font.mono, fontSize: 10, color: C.dim, background: "rgba(8,10,16,0.75)", backdropFilter: "blur(6px)", padding: "4px 10px", borderRadius: 8 }}>
              {bench.angle}deg / {bench.rainfall}mm
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <label className="glass" style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 0", cursor: "pointer", color: C.muted,
            }}>
              <UploadCloud size={20} />
              <span style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: "0.12em" }}>DROP IMAGE</span>
              <input type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
            </label>
          </div>
        </Panel>

        {/* Heatmap Grid */}
        <Panel>
          <SectionTag n={3} label="Bench Hazard Grid" />
          <PanelTitle>Spatial Risk Contour</PanelTitle>
          <PanelSub>{spatialGrid ? "Image-derived risk heatmap (CV analysis)" : "5x5 sub-sector FOS distribution (estimated)"}</PanelSub>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginTop: 16 }}>
            {spatialGrid
              ? spatialGrid.flat().map((level, i) => {
                  const color = level === 4 ? C.critical : level === 3 ? C.warningOrange : level === 2 ? C.warning : level === 1 ? C.safeDim : C.safe;
                  const label = ["S", "L", "M", "H", "C"][level];
                  return (
                    <div key={i} style={{
                      aspectRatio: "1", borderRadius: 12,
                      background: color, opacity: 0.5 + level * 0.12,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: font.mono, fontSize: 13, fontWeight: 700, color: level >= 3 ? "#fff" : C.bg,
                      boxShadow: level >= 3 ? `0 0 12px ${color}44` : "none",
                      ...(level >= 3 ? { backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(13,11,8,0.25) 3px, rgba(13,11,8,0.25) 6px)" } : {}),
                    }}>
                      {level >= 3 && <AlertTriangle size={12} style={{ position: "absolute" }} />}
                      <span style={{ position: "relative", zIndex: 1 }}>{label}</span>
                    </div>
                  );
                })
              : heatmapRows.map((row) =>
                  row.cells.map((cell, ci) => (
                    <div key={`${row.id}-${ci}`} style={{
                      aspectRatio: "1", borderRadius: 12,
                      background: cell.fos < 1.0 ? C.critical : cell.fos < 1.3 ? C.warning : C.safe,
                      opacity: clamp(0.4 + (1 - cell.fos / 3) * 0.7, 0.2, 1),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: font.mono, fontSize: 11, color: C.bg,
                      ...(cell.fos < 1.0 ? { backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(13,11,8,0.25) 3px, rgba(13,11,8,0.25) 6px)" } : {}),
                    }}>
                      {cell.fos < 1.0 && <AlertTriangle size={12} />}
                    </div>
                  ))
                )
            }
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 14, fontFamily: font.mono, fontSize: 10, color: C.muted }}>
            <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: C.safe, marginRight: 5, verticalAlign: "middle" }} />Safe</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: C.safeDim, marginRight: 5, verticalAlign: "middle" }} />Low</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: C.warning, marginRight: 5, verticalAlign: "middle" }} />Moderate</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: C.warningOrange, marginRight: 5, verticalAlign: "middle" }} />High</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: C.critical, marginRight: 5, verticalAlign: "middle" }} />Critical</span>
          </div>
          {spatialSummary && (
            <div style={{ marginTop: 10, fontFamily: font.mono, fontSize: 10, color: C.dim, textAlign: "center" }}>
              <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 6 }}>
                <span>{spatialSummary.critical} <span style={{ color: C.critical }}>critical</span></span>
                <span>{spatialSummary.high} <span style={{ color: C.warningOrange }}>high</span></span>
                <span>{spatialSummary.moderate} <span style={{ color: C.warning }}>moderate</span></span>
                <span>{spatialSummary.low} <span style={{ color: C.safeDim }}>low</span></span>
                <span>{spatialSummary.safe} <span style={{ color: C.safe }}>safe</span></span>
              </div>
              {spatialSummary.mean_risk != null && (
                <div style={{ display: "flex", gap: 16, justifyContent: "center", color: C.muted }}>
                  <span>Mean risk: {(spatialSummary.mean_risk * 100).toFixed(1)}%</span>
                  <span>Peak risk: <span style={{ color: (spatialSummary.max_risk ?? 0) * 100 > 70 ? C.critical : C.warning }}>{((spatialSummary.max_risk ?? 0) * 100).toFixed(1)}%</span></span>
                  {spatialSummary.high_risk_pct != null && spatialSummary.high_risk_pct > 0 && (
                    <span style={{ color: C.critical }}>{spatialSummary.high_risk_pct}% critical area</span>
                  )}
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>

      {/* SHAP row */}
      <Panel style={{ marginBottom: 22 }}>
        <SectionTag n={4} label="XAI Attribution" />
        <PanelTitle>SHAP Feature Impact</PanelTitle>
        <PanelSub>Directional risk contribution per input</PanelSub>
        <div style={{ marginTop: 14 }}>
          <ShapBars values={shapValues.slice(0, 6)} />
        </div>
      </Panel>

      {/* Full-width AI Chat */}
      <Panel style={{ display: "flex", flexDirection: "column", minHeight: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <SectionTag n={5} label="Operator Interface" />
            <PanelTitle>GeoGuard AI Assistant</PanelTitle>
            <PanelSub>Real-time AI analysis powered by LLM</PanelSub>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: font.mono, fontSize: 10, color: apiOnline ? C.safe : C.muted }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: apiOnline ? C.safe : C.muted }} className={apiOnline ? "bc-live" : ""} />
            {apiOnline ? "AI Online" : "Local Mode"}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {[
            { cmd: "Analyze current risk", icon: <ShieldAlert size={12} /> },
            { cmd: "What is the FoS and what does it mean?", icon: <Activity size={12} /> },
            { cmd: "Recommend dewatering strategy", icon: <Droplets size={12} /> },
            { cmd: "Run Monte Carlo simulation", icon: <BarChart3 size={12} /> },
            { cmd: "Evacuation protocol if FoS drops", icon: <AlertTriangle size={12} /> },
            { cmd: "Explain the SHAP feature importance", icon: <Cpu size={12} /> },
          ].map((q) => (
            <button key={q.cmd} onClick={() => { setChatInput(q.cmd); }} className="glass-btn"
              style={{ padding: "8px 14px", fontFamily: font.mono, fontSize: 10, display: "flex", alignItems: "center", gap: 6 }}>
              {q.icon} {q.cmd}
            </button>
          ))}
        </div>

        {/* Chat messages */}
        <div ref={logRef} style={{ flex: 1, overflowY: "auto", minHeight: 200, maxHeight: 320, display: "flex", flexDirection: "column", gap: 12, padding: "8px 0" }}>
          {chatMsgs.map((m, i) => (
            <div key={i} style={{
              display: "flex", flexDirection: m.role === "user" ? "row-reverse" : "row", gap: 10, alignItems: "flex-start",
            }}>
              {/* Avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: 12, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: m.role === "user" ? "rgba(110,147,181,0.15)" : m.role === "system" ? "rgba(79,163,122,0.12)" : "rgba(255,90,43,0.12)",
                border: `1px solid ${m.role === "user" ? "rgba(110,147,181,0.25)" : m.role === "system" ? "rgba(79,163,122,0.2)" : "rgba(255,90,43,0.2)"}`,
              }}>
                {m.role === "user" ? <User size={14} color={C.info} /> : m.role === "system" ? <Bot size={14} color={C.safe} /> : <Bot size={14} color={C.critical} />}
              </div>
              {/* Message bubble */}
              <div className="glass" style={{
                padding: "14px 18px", borderRadius: 16,
                maxWidth: "80%",
                background: m.role === "user" ? "rgba(110,147,181,0.08)" : m.role === "system" ? "rgba(79,163,122,0.06)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${m.role === "user" ? "rgba(110,147,181,0.18)" : "rgba(255,255,255,0.06)"}`,
                fontFamily: font.body, fontSize: 14, color: C.text, lineHeight: 1.7,
                whiteSpace: "pre-wrap",
              }}>
                {m.text}
              </div>
            </div>
          ))}
          {chatMsgs.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: C.muted }}>
              <Bot size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <div style={{ fontFamily: font.mono, fontSize: 12 }}>Ask me anything about mine safety</div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <input
            value={chatInput} onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about slope stability, FoS, dewatering, risk assessment..."
            className="glass-input"
            style={{ flex: 1, padding: "14px 18px", fontFamily: font.body, fontSize: 14 }}
          />
          <button onClick={handleSend} className="glass-btn"
            style={{
              padding: "14px 22px", borderRadius: 14,
              background: "linear-gradient(135deg, #FF5A2B, #FF3D15)", color: "#fff", border: "none",
              boxShadow: "0 4px 16px rgba(255,90,43,0.3)",
            }}>
            <Send size={18} />
          </button>
        </div>
      </Panel>
    </>
  );

  /* ═══════════════════════════════════════════════ */
  /* ─── 3D MODEL VIEW ─── */
  /* ═══════════════════════════════════════════════ */
  const render3D = () => {
    const levels = 8;
    const baseW = 320;
    const stepW = 32;
    const stepH = 22;

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>
        <SectionTag n={6} label="Three-Dimensional Model" />

        {/* ─── Convert-to-3D hero ─── */}
        {!heightmap && (
          <div style={{ width: "100%", maxWidth: 600, margin: "0 auto 24px" }}>
            <Panel style={{ textAlign: "center", padding: 40 }}>
              <Camera size={44} color={C.info} style={{ marginBottom: 16 }} />
              <PanelTitle>2D Image to 3D Terrain</PanelTitle>
              <PanelSub>Drop an image in the sidebar, then convert it to an interactive 360-degree terrain mesh</PanelSub>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 16, marginTop: 16 }}>
                <span style={{ fontFamily: font.mono, fontSize: 11, color: C.muted }}>Grid resolution</span>
                <input type="range" min={20} max={80} step={5} value={gridRes}
                  style={{ width: 160, "--thumb-color": C.info } as React.CSSProperties}
                  onChange={(e) => setGridRes(parseInt(e.target.value))} />
                <span style={{ fontFamily: font.mono, fontSize: 12, color: C.text }}>{gridRes}x{gridRes}</span>
              </div>
              <button onClick={convertTo3D} disabled={converting3d} className="glass-btn"
                style={{
                  padding: "14px 32px", fontSize: 12,
                  display: "inline-flex", alignItems: "center", gap: 10,
                  ...(converting3d ? { opacity: 0.5, cursor: "wait" } : {}),
                }}>
                <Layers size={16} />
                {converting3d ? "Converting..." : "Convert Image to 3D"}
              </button>
            </Panel>
          </div>
        )}

        {/* ─── Terrain canvas (when heightmap exists) ─── */}
        {heightmap && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* ── Viewport toolbar ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {(["solid", "wireframe", "textured"] as const).map((m) => (
                <button key={m} onClick={() => setMeshMode(m)}
                  className={`glass-btn ${meshMode === m ? "glass-btn-active" : ""}`}
                  style={{ padding: "7px 16px", fontFamily: font.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
                  {m}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <button title="Zoom in" onClick={() => setZoom3d((z) => Math.min(z + 0.15, 3.0))}
                className="glass-btn" style={{ padding: "7px 16px", fontFamily: font.mono, fontSize: 15, lineHeight: 1 }}>+</button>
              <button title="Zoom out" onClick={() => setZoom3d((z) => Math.max(z - 0.15, 0.3))}
                className="glass-btn" style={{ padding: "7px 16px", fontFamily: font.mono, fontSize: 15, lineHeight: 1 }}>−</button>
              <button title="Reset view" onClick={() => { setRot3d({ x: -45, y: 15 }); setZoom3d(1); }}
                className="glass-btn" style={{ padding: "7px 14px", fontFamily: font.mono, fontSize: 10 }}>Reset View</button>
              <button title="Re-convert with current image" onClick={convertTo3D} disabled={converting3d}
                className="glass-btn" style={{ padding: "7px 14px", fontFamily: font.mono, fontSize: 10, ...(converting3d ? { opacity: 0.5 } : {}) }}>
                Re-convert
              </button>
              <button title="Toggle auto-rotate" onClick={() => setAutoRotate((r) => !r)}
                className={`glass-btn ${autoRotate ? "glass-btn-active" : ""}`}
                style={{ padding: "7px 14px", fontFamily: font.mono, fontSize: 10 }}>
                {autoRotate ? "⏸ Rotate" : "▶ Rotate"}
              </button>
              {fullScreen3d
                ? <button title="Exit fullscreen" onClick={() => setFullScreen3d(false)} className="glass-btn" style={{ padding: "7px 12px" }}><Minimize2 size={14} /></button>
                : <button title="Fullscreen" onClick={() => setFullScreen3d(true)} className="glass-btn" style={{ padding: "7px 12px" }}><Maximize2 size={14} /></button>
              }
            </div>

            {/* ── 3D Canvas Viewport — explicit height so it NEVER collapses ── */}
            <div style={{
              position: "relative",
              width: "100%",
              height: fullScreen3d ? "calc(100vh - 140px)" : 380,
              minHeight: 350,
              background: "#0A0806",
              border: "1px solid #2E2820",
              borderRadius: 12,
              overflow: "hidden",
              flexShrink: 0,
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
              {/* Canvas fills container absolutely — CSS height drives its size */}
              <canvas
                ref={canvasRef}
                style={{ display: "block", width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
              />
              {/* Mode badge */}
              <div style={{
                position: "absolute", top: 10, left: 10, zIndex: 2,
                background: "rgba(8,10,16,0.82)", backdropFilter: "blur(8px)",
                border: `1px solid ${meshMode === "textured" ? C.info : meshMode === "wireframe" ? C.warning : C.safe}`,
                borderRadius: 8, padding: "4px 12px",
                fontFamily: font.mono, fontSize: 10, letterSpacing: "0.1em",
                color: meshMode === "textured" ? C.info : meshMode === "wireframe" ? C.warning : C.safe,
              }}>
                {meshMode.toUpperCase()} MODE
              </div>
              {/* Grid / usage hint */}
              <div style={{
                position: "absolute", top: 10, right: 10, zIndex: 2,
                background: "rgba(8,10,16,0.7)", backdropFilter: "blur(6px)",
                borderRadius: 8, padding: "4px 10px",
                fontFamily: font.mono, fontSize: 9, color: C.dim,
              }}>
                {gridRes}×{gridRes} · drag to orbit · scroll to zoom
              </div>
              {/* Rotation indicator */}
              <div style={{
                position: "absolute", bottom: 10, left: 10, zIndex: 2,
                fontFamily: font.mono, fontSize: 9, color: C.muted,
                background: "rgba(8,10,16,0.6)", padding: "3px 8px", borderRadius: 6,
              }}>
                rotX {rot3d.x.toFixed(0)}° · rotY {rot3d.y.toFixed(0)}° · zoom {zoom3d.toFixed(2)}×
              </div>
              {/* Converting spinner overlay */}
              {converting3d && (
                <div style={{
                  position: "absolute", inset: 0, zIndex: 5,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(8,10,16,0.8)", backdropFilter: "blur(6px)",
                }}>
                  <div style={{ fontFamily: font.mono, fontSize: 13, color: C.info }}>⌛ Analysing image & building terrain…</div>
                </div>
              )}
            </div>

            {/* ── Terrain Analysis Info ── */}
            {terrainAnalysis && (
              <Panel>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 10 }}>
                  {[
                    { label: "Terrain Type", value: terrainAnalysis.terrainType },
                    { label: "Slope Angle", value: `${terrainAnalysis.slopeAngle}°` },
                    { label: "Bench Levels", value: String(terrainAnalysis.benchCount) },
                    { label: "Fracture Density", value: `${(terrainAnalysis.fractureDensity * 100).toFixed(0)}%` },
                    { label: "Risk Zones", value: String(terrainAnalysis.riskZones) },
                    { label: "Brightness", value: `${(terrainAnalysis.avgBrightness * 100).toFixed(0)}%` },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontFamily: font.mono, fontSize: 10, color: C.muted, marginBottom: 3 }}>{label.toUpperCase()}</div>
                      <div style={{ fontFamily: font.display, fontSize: 15, fontWeight: 600, color: C.text }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: font.body, fontSize: 12, color: C.dim, lineHeight: 1.6 }}>{terrainAnalysis.description}</div>
              </Panel>
            )}
          </div>
        )}

        {/* ─── CSS Bench Profile (shown when terrain exists) ─── */}
        {terrainAnalysis && (
          <div style={{ width: "100%", marginTop: 24 }}>
            <PanelTitle>Bench Profile Cross-Section</PanelTitle>
            <PanelSub>CSS-based bench layers with FoS colouring</PanelSub>
            <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
              <button onClick={() => setIs3d(false)} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${is3d ? C.line : C.info}`, background: is3d ? "transparent" : "rgba(110,147,181,0.15)", color: is3d ? C.muted : C.info, fontFamily: font.mono, fontSize: 9, cursor: "pointer" }}>2D</button>
              <button onClick={() => setIs3d(true)} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${is3d ? C.info : C.line}`, background: is3d ? "rgba(110,147,181,0.15)" : "transparent", color: is3d ? C.info : C.muted, fontFamily: font.mono, fontSize: 9, cursor: "pointer" }}>3D</button>
            </div>
            <div
              style={{ perspective: 900, width: 400, height: 280, cursor: "grab", margin: "0 auto" }}
              onMouseDown={on3dDown} onMouseMove={on3dMove} onMouseUp={on3dUp} onMouseLeave={on3dUp}
            >
              <div ref={modelRef} style={{
                width: "100%", height: "100%", position: "relative",
                transformStyle: "preserve-3d",
                transform: `rotateX(${rot3d.x}deg) rotateY(${rot3d.y}deg) scale(${zoom3d})`,
                transition: drag3d.current.active ? "none" : "transform .3s ease",
              }}>
                {Array.from({ length: levels }, (_, i) => {
                  const w = baseW - i * stepW;
                  const fosLocal = computeFoS(bench.angle + i * 2, bench.seepage + i * 0.02, jv);
                  const col = fosLocal < 1.0 ? C.critical : fosLocal < 1.3 ? C.warning : C.safe;
                  return (
                    <div key={i} style={{
                      position: "absolute", left: "50%", bottom: i * stepH,
                      width: w, height: stepH - 2, marginLeft: -w / 2,
                      background: col, opacity: 0.55 + i * 0.04,
                      transform: `translateZ(${-i * 28}px)`,
                      border: "1px solid rgba(237,231,218,0.08)",
                      borderRadius: 3,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: font.mono, fontSize: 9, color: C.bg, fontWeight: 600,
                    }}>
                      {BENCH[i % BENCH.length].id} | FoS {fosLocal.toFixed(2)}
                    </div>
                  );
                })}
                <div style={{
                  position: "absolute", left: "50%", bottom: -4,
                  width: baseW + 40, height: 60, marginLeft: -(baseW + 40) / 2,
                  background: `linear-gradient(0deg, ${C.line} 0%, transparent 100%)`,
                  transform: "translateZ(-200px) rotateX(90deg)",
                  opacity: 0.3,
                }} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════ */
  /* ─── ALERTS VIEW ─── */
  /* ═══════════════════════════════════════════════ */
  const renderAlerts = () => {
    const counts = { critical: alerts.filter((a) => a.sev === "critical" && !a.ack).length, warning: alerts.filter((a) => a.sev === "warning" && !a.ack).length, info: alerts.filter((a) => a.sev === "info" && !a.ack).length };
    return (
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <SectionTag n={7} label="Alert Center" />
        <PanelTitle>Incident & Warning Log</PanelTitle>
        <PanelSub>Unacknowledged event counters</PanelSub>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, margin: "20px 0" }}>
          {[{ label: "CRITICAL", count: counts.critical, color: C.critical, icon: <AlertTriangle size={26} /> },
            { label: "WARNING", count: counts.warning, color: C.warning, icon: <ShieldAlert size={26} /> },
            { label: "INFO", count: counts.info, color: C.info, icon: <Activity size={26} /> }].map((s) => (
            <div key={s.label} className={`gauge-glass ${s.count > 0 ? `glow-${s.label === "WARNING" ? "warning" : s.label === "CRITICAL" ? "critical" : "info"}` : ""}`}
              style={{ padding: 20, borderTop: `3px solid ${s.color}`, textAlign: "center" }}>
              <div style={{ color: s.color, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontFamily: font.display, fontSize: 38, fontWeight: 700, color: s.color }}>{s.count}</div>
              <div style={{ fontFamily: font.mono, fontSize: 11, color: C.muted, marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <Panel>
          {alerts.map((a) => (
            <div key={a.id} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "14px 0",
              borderBottom: `1px solid rgba(255,255,255,0.06)`, opacity: a.ack ? 0.35 : 1,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: a.sev === "critical" ? C.critical : a.sev === "warning" ? C.warning : C.info, flexShrink: 0, boxShadow: `0 0 8px ${a.sev === "critical" ? C.critical : a.sev === "warning" ? C.warning : C.info}44` }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: font.body, fontSize: 14, color: C.text }}>{a.text}</div>
                <div style={{ fontFamily: font.mono, fontSize: 11, color: C.muted, marginTop: 3 }}>{a.time}</div>
              </div>
              {!a.ack && (
                <button onClick={() => ackAlert(a.id)} className="glass-btn"
                  style={{ padding: "6px 14px", fontFamily: font.mono, fontSize: 10 }}>ACK</button>
              )}
              {a.ack && <span style={{ fontFamily: font.mono, fontSize: 10, color: C.muted }}>resolved</span>}
            </div>
          ))}
        </Panel>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════ */
  /* ─── HISTORY VIEW ─── */
  /* ═══════════════════════════════════════════════ */
  const renderHistory = () => {
    const maxFos = Math.max(...history.map((h) => h.fos));
    const minFos = Math.min(...history.map((h) => h.fos));
    const yScale = (v: number) => 30 + ((maxFos - v) / (maxFos - minFos + 0.01)) * 70;
    const pathD = history.map((h, i) => `${i === 0 ? "M" : "L"} ${(i / (history.length - 1)) * 360 + 20} ${yScale(h.fos)}`).join(" ");
    const areaD = pathD + ` L ${((history.length - 1) / (history.length - 1)) * 360 + 20} 110 L 20 110 Z`;
    return (
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <SectionTag n={8} label="Historical Analysis" />
        <PanelTitle>14-Day Trend</PanelTitle>
        <PanelSub>FoS progression, incident overlay, and sparklines</PanelSub>
        <Panel style={{ marginTop: 16 }}>
          <svg viewBox="0 0 400 140" style={{ width: "100%", height: 180 }}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.info} stopOpacity={0.3} />
                <stop offset="100%" stopColor={C.info} stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d={areaD} fill="url(#areaGrad)" />
            <path d={pathD} fill="none" stroke={C.info} strokeWidth={2} strokeLinejoin="round" />
            {history.map((h, i) => (
              <g key={i}>
                <circle cx={(i / (history.length - 1)) * 360 + 20} cy={yScale(h.fos)} r={3}
                  fill={h.fos < 1.0 ? C.critical : h.fos < 1.3 ? C.warning : C.safe} stroke={C.bg} strokeWidth={1.5} />
                {h.incidents > 0 && (
                  <text x={(i / (history.length - 1)) * 360 + 20} y={125} textAnchor="middle" fill={C.critical} fontSize={8} fontFamily={font.mono}>
                    {h.incidents}x
                  </text>
                )}
                <text x={(i / (history.length - 1)) * 360 + 20} y={135} textAnchor="middle" fill={C.muted} fontSize={7} fontFamily={font.mono}>
                  D{h.day}
                </text>
              </g>
            ))}
            <line x1={20} x2={380} y1={yScale(1.0)} y2={yScale(1.0)} stroke={C.critical} strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
            <text x={385} y={yScale(1.0) + 3} fill={C.critical} fontSize={7} fontFamily={font.mono}>1.0</text>
            <line x1={20} x2={380} y1={yScale(1.3)} y2={yScale(1.3)} stroke={C.warning} strokeWidth={1} strokeDasharray="4 3" opacity={0.4} />
            <text x={385} y={yScale(1.3) + 3} fill={C.warning} fontSize={7} fontFamily={font.mono}>1.3</text>
          </svg>
        </Panel>
        {/* Sparklines */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 16 }}>
          {[
            { label: "Rainfall", values: history.map((h) => h.rainfall), color: C.info },
            { label: "Vibration", values: history.map((h) => h.vibration), color: C.warning },
            { label: "Seepage", values: history.map((h) => h.seepage), color: C.safe },
          ].map((s) => {
            const sMax = Math.max(...s.values);
            const sMin = Math.min(...s.values);
            const sPath = s.values.map((v, i) => `${i === 0 ? "M" : "L"} ${(i / (s.values.length - 1)) * 100}% ${10 + ((sMax - v) / (sMax - sMin + 0.01)) * 30}px`).join(" ");
            return (
              <Panel key={s.label}>
                <div style={{ fontFamily: font.mono, fontSize: 10, color: C.muted, marginBottom: 8 }}>{s.label.toUpperCase()}</div>
                <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: "100%", height: 44 }}>
                  <path d={sPath} fill="none" stroke={s.color} strokeWidth={1.5} />
                </svg>
                <div style={{ fontFamily: font.mono, fontSize: 12, color: s.color, marginTop: 6 }}>
                  {s.values[s.values.length - 1].toFixed(1)} <span style={{ color: C.muted }}>latest</span>
                </div>
              </Panel>
            );
          })}
        </div>
        {/* Timeline */}
        <Panel style={{ marginTop: 16 }}>
          <SectionTag n={9} label="Incident Timeline" />
          <div style={{ position: "relative", paddingLeft: 20, borderLeft: `2px solid rgba(255,255,255,0.06)` }}>
            {history.filter((h) => h.incidents > 0).reverse().map((h) => (
              <div key={h.day} style={{ padding: "12px 0 12px 16px", position: "relative" }}>
                <div style={{ position: "absolute", left: -7, top: 14, width: 10, height: 10, borderRadius: "50%", background: h.fos < 1.0 ? C.critical : C.warning, boxShadow: `0 0 8px ${h.fos < 1.0 ? C.critical : C.warning}44` }} />
                <div style={{ fontFamily: font.mono, fontSize: 11, color: C.muted }}>Day {h.day}</div>
                <div style={{ fontFamily: font.body, fontSize: 14, color: C.text }}>{h.incidents} incident{h.incidents > 1 ? "s" : ""} logged</div>
                <div style={{ fontFamily: font.mono, fontSize: 11, color: C.dim }}>FoS {h.fos.toFixed(2)} / Rain {h.rainfall.toFixed(0)}mm</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════ */
  /* ─── REPORTS VIEW ─── */
  /* ═══════════════════════════════════════════════ */
  const renderReports = () => (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <SectionTag n={10} label="Report Archive" />
      <PanelTitle>Generated Reports</PanelTitle>
      <PanelSub>PDF export log</PanelSub>
      <div style={{ margin: "20px 0" }}>
        <button onClick={genReport} disabled={reportGen} className="glass-btn"
          style={{
            padding: "14px 28px", fontSize: 12,
            display: "flex", alignItems: "center", gap: 10,
            ...(reportGen ? { opacity: 0.5, cursor: "wait" } : {}),
          }}>
          <Download size={16} />
          {reportGen ? "Generating..." : "Generate PDF Report"}
        </button>
      </div>
      <Panel>
        {reports.length === 0 && (
          <div style={{ textAlign: "center", padding: 32, color: C.muted, fontFamily: font.mono, fontSize: 12 }}>No reports generated yet</div>
        )}
        {reports.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
            <FileText size={20} color={C.info} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: font.body, fontSize: 14, color: C.text }}>Report #{r.id}</div>
              <div style={{ fontFamily: font.mono, fontSize: 11, color: C.muted }}>{r.ts} / {r.benches}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: font.mono, fontSize: 11, color: C.safe, marginRight: 4 }}>{r.status}</span>
              <button onClick={() => setViewingReport(r)} className="glass-btn" style={{ padding: "6px 14px", fontSize: 11 }}>
                View
              </button>
              <button onClick={() => downloadReportPDF(r)} className="glass-btn" style={{ padding: "6px 12px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                <Printer size={12} color={C.info} />
                PDF
              </button>
            </div>
          </div>
        ))}
      </Panel>
    </div>
  );

  /* ═══════════════════════════════════════════════ */
  /* ─── MAIN RENDER ─── */
  /* ═══════════════════════════════════════════════ */
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: font.body, background: C.bg, color: C.text }}>

      {/* ─── CRITICAL BANNER ─── */}
      {fos < 1.0 && (
        <div style={{ position: "relative", background: "linear-gradient(90deg, #FF3D15, #FF5A2B, #FF3D15)", color: "#fff", textAlign: "center", padding: "10px 0", fontFamily: font.display, fontSize: 14, fontWeight: 600, letterSpacing: "0.1em", overflow: "hidden" }}>
          <div className="bc-sweep" style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)", width: "100%", height: "100%" }} />
          <AlertTriangle size={16} style={{ verticalAlign: "middle", marginRight: 8 }} />
          EVACUATE BENCH {bench.id} - CRITICAL FOS
        </div>
      )}

      {/* ─── TOP NAV ─── */}
      <nav className="glass-nav" style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 28px", flexShrink: 0 }}>
        <Mountain size={22} color={C.critical} style={{ marginRight: 6 }} />
        {["dashboard", "3d-model", "alerts", "history", "reports"].map((tab) => (
          <button key={tab} onClick={() => setActive(tab)} className={`glass-btn ${active === tab ? "glass-btn-active" : ""}`}
            style={{
              padding: "8px 18px", fontFamily: font.mono, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" as const,
            }}>{tab.replace("-", " ")}</button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: font.mono, fontSize: 11, color: C.dim }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: apiOnline ? C.safe : C.critical }} className={apiOnline ? "bc-live" : ""} />
            <span style={{ color: apiOnline ? C.safe : C.critical }}>API {apiOnline ? "ONLINE" : "OFFLINE"}</span>
          </div>
          <Radio size={12} className="bc-live" color={C.safe} /> <span className="bc-live">LIVE</span>
          <span style={{ color: C.muted }}>RF-Slot 14</span>
        </div>
      </nav>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ─── LEFT SIDEBAR ─── */}
        <aside className="glass-sidebar" style={{ width: 300, padding: 20, overflowY: "auto", flexShrink: 0 }}>

          <SectionTag n={1} label="Pit Camera" />
          <div className="glass" style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "rgba(255,255,255,0.02)", height: 170, marginBottom: 20, border: `1px dashed rgba(255,255,255,0.12)` }}
            onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
            <img src={image} alt="Pit" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <label style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(8,10,16,0.45)", cursor: "pointer", color: C.muted, backdropFilter: "blur(4px)" }}>
              <Camera size={24} style={{ marginBottom: 8 }} />
              <span style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: "0.12em" }}>DROP OR CLICK</span>
              <input type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
            </label>
          </div>

          <SectionTag n={2} label="IoT Telemetry" />
          <div style={{ marginBottom: 20 }}>
            {[
              { label: "Rainfall", value: bench.rainfall, min: 0, max: 120, unit: "mm/hr", key: "rainfall" as const },
              { label: "Vibration", value: bench.vibration, min: 0, max: 12, unit: "mm/s", key: "vibration" as const },
            ].map((s) => (
              <div key={s.key} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: font.mono, fontSize: 11, color: C.dim, marginBottom: 5 }}>
                  <span>{s.label}</span><span style={{ color: C.text }}>{s.value.toFixed(1)} {s.unit}</span>
                </div>
                <input type="range" min={s.min} max={s.max} step={0.1} value={s.value}
                  style={{ "--thumb-color": s.value > (s.key === "rainfall" ? 50 : 5) ? C.warning : C.info } as React.CSSProperties}
                  onChange={(e) => setBench((p) => ({ ...p, [s.key]: parseFloat(e.target.value) }))} />
              </div>
            ))}
          </div>

          <SectionTag n={3} label="Geotechnical" />
          <div style={{ marginBottom: 20 }}>
            {[
              { label: "Slope Angle", value: bench.angle, min: 40, max: 85, unit: "deg", key: "angle" as const },
              { label: "Discontinuity", value: bench.discontinuity, min: 5, max: 60, unit: "freq/m", key: "discontinuity" as const },
              { label: "Bench Height", value: bench.height, min: 4, max: 24, unit: "m", key: "height" as const },
            ].map((s) => (
              <div key={s.key} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: font.mono, fontSize: 11, color: C.dim, marginBottom: 5 }}>
                  <span>{s.label}</span><span style={{ color: C.text }}>{s.value.toFixed(1)} {s.unit}</span>
                </div>
                <input type="range" min={s.min} max={s.max} step={0.1} value={s.value}
                  style={{ "--thumb-color": C.info } as React.CSSProperties}
                  onChange={(e) => setBench((p) => ({ ...p, [s.key]: parseFloat(e.target.value) }))} />
              </div>
            ))}
          </div>

          <SectionTag n={4} label="Sensor Network" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
            {sensors.map((s) => (
              <div key={s.id} className="glass" style={{ padding: "10px 12px", borderRadius: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <CircleDot size={10} color={s.status === "online" ? C.safe : C.muted} />
                  <span style={{ fontFamily: font.mono, fontSize: 11, color: C.text }}>{s.id}</span>
                </div>
                <div style={{ fontFamily: font.mono, fontSize: 9, color: C.muted }}>{s.type}</div>
              </div>
            ))}
          </div>

          <SectionTag n={5} label="FoS Thresholds" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[{ label: "Critical", val: "< 1.0", color: C.critical }, { label: "Caution", val: "1.0 - 1.3", color: C.warning }, { label: "Stable", val: "> 1.3", color: C.safe }].map((l) => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: font.mono, fontSize: 11 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color, boxShadow: `0 0 8px ${l.color}44` }} />
                <span style={{ color: C.dim }}>{l.label}</span>
                <span style={{ color: C.muted, marginLeft: "auto" }}>{l.val}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* ─── MAIN CONTENT ─── */}
        <main style={{ flex: 1, overflowY: "auto", padding: 28, background: "transparent" }}>
          {active === "dashboard" && renderDashboard()}
          {active === "3d-model" && render3D()}
          {active === "alerts" && renderAlerts()}
          {active === "history" && renderHistory()}
          {active === "reports" && renderReports()}
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
            maxWidth: 600,
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            borderRadius: 20,
            overflow: "hidden",
            border: `1px solid ${C.glassBorder}`,
            background: "#0c0f17",
            boxShadow: "0 24px 64px rgba(0,0,0,0.8)"
          }}>
            {/* Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px 24px",
              borderBottom: `1px solid ${C.line}`
            }}>
              <div>
                <div style={{ fontFamily: font.display, fontSize: 18, fontWeight: 700, color: C.text }}>
                  Report Audit Log #{viewingReport.id}
                </div>
                <div style={{ fontFamily: font.mono, fontSize: 11, color: C.muted, marginTop: 4 }}>
                  Generated: {viewingReport.ts}
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

                    {/* Parameter Details Table */}
                    <div>
                      <div style={{ fontFamily: font.mono, fontSize: 11, color: C.dim, textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.08em" }}>Slope Parameters</div>
                      <div className="glass" style={{ padding: 16, borderRadius: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                          { label: "Face Angle", val: `${snap.bench.angle}°`, ref: "Stable ≤ 65°" },
                          { label: "Discontinuity Spacing", val: `${snap.bench.discontinuity} cm`, ref: "Stable > 40 cm" },
                          { label: "Bench Height", val: `${snap.bench.height} m`, ref: "Stable ≤ 12 m" },
                          { label: "Rainfall Rate", val: `${snap.bench.rainfall} mm/h`, ref: "Stable < 30" },
                          { label: "Water Seepage", val: `${snap.bench.seepage.toFixed(2)} L/min`, ref: "Stable < 0.25" },
                          { label: "Vibration Level", val: `${snap.bench.vibration.toFixed(1)} mm/s`, ref: "Safe < 5.0" }
                        ].map((param, index) => (
                          <div key={index} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, paddingBottom: index < 5 ? 8 : 0, borderBottom: index < 5 ? `1px solid ${C.line}` : "none" }}>
                            <span style={{ color: C.dim }}>{param.label}</span>
                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              <span style={{ color: C.muted, fontSize: 11, fontFamily: font.mono }}>{param.ref}</span>
                              <span style={{ fontFamily: font.mono, color: C.text, fontWeight: 500 }}>{param.val}</span>
                            </div>
                          </div>
                        ))}
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
                  borderTop: `1px solid ${C.accent}`,
                  background: `rgba(255, 90, 43, 0.1)`
                }}
              >
                <Download size={14} color={C.accent} />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
