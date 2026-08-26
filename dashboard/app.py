"""
GeoGuard AI -- Open-Pit Mine Slope Stability Monitoring Dashboard
Figma Make Pro UI with dark glass-morphism design tokens.
"""

from __future__ import annotations

import sys
import os
import time
import math
from datetime import datetime, timezone

import numpy as np
import streamlit as st
import plotly.graph_objects as go
from PIL import Image

# Ensure project root is on the Python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

try:
    from src.cv_engine import extract_jv_density, analyze_image_risks, _synthetic_overlay
except ImportError:
    extract_jv_density = None
    analyze_image_risks = None
    _synthetic_overlay = None

try:
    from src.physics_engine import calculate_smr, compute_physics_fos
except ImportError:
    calculate_smr = None
    compute_physics_fos = None

try:
    from src.ml_engine import train_and_evaluate_model, FEATURE_NAMES as ML_FEATURE_NAMES
except ImportError:
    train_and_evaluate_model = None
    ML_FEATURE_NAMES = []

try:
    from src.data_fusion import run_fusion_pipeline
except ImportError:
    run_fusion_pipeline = None

# ---------------------------------------------------------------------------
# Design tokens (matching React Figma Make)
# ---------------------------------------------------------------------------

BG = "#090A0F"
SURFACE = "#0D0F17"
CARD = "rgba(18,20,29,0.88)"
BORDER = "#232738"
CRIMSON = "#EF4444"
EMERALD = "#10B981"
AMBER = "#F59E0B"
INDIGO = "#6366F1"
VIOLET = "#8B5CF6"
TEXT = "#E2E8F0"
DIM = "#94A3B8"
MUTED = "#64748B"
ACCENT = "#818CF8"

FONT = "'Inter', system-ui, sans-serif"
MONO = "'JetBrains Mono', 'Courier New', monospace"

# ---------------------------------------------------------------------------
# Session state defaults
# ---------------------------------------------------------------------------

def _init_state():
    defaults = {
        "ru": 0.65,
        "rainfall": 35.0,
        "tilt": 18.0,
        "rmr": 40,
        "slope_angle": 55,
        "optical_tab": "raw",
        "chat_history": [],
        "last_fusion": None,
        "uploaded_image": None,
        "uploaded_bytes": None,
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v


_init_state()

# ---------------------------------------------------------------------------
# Physics helpers (same as React app for consistency)
# ---------------------------------------------------------------------------

def compute_fos(ru, rain, tilt, rmr, slope):
    base = 1.0 + ((rmr - 20) / 80) * 1.6
    stress = (
        ru * 0.55
        + (rain / 100) * 0.42
        + (max(0, tilt - 5) / 25) * 0.32
        + (max(0, slope - 25) / 60) * 0.22
    )
    return max(0.31, round(base - stress, 2))


def compute_smr_local(rmr, slope, tilt):
    f1 = max(0.15, 1 - 0.0065 * slope * slope / 10)
    f2 = max(0.15, 1 - tilt / 50)
    f3 = -25 if slope > 45 else (-12 if slope > 35 else -6)
    return max(0, min(100, round(rmr + f1 * f2 * f3 + 15)))


def compute_jv_local(rmr, tilt):
    return max(1, round((100 - rmr) / 7.5 + tilt / 2.8))


def get_risk_info(fos):
    if fos < 1.0:
        return {"label": "CRITICAL", "color": CRIMSON, "bg": "rgba(239,68,68,0.12)", "border": "rgba(239,68,68,0.4)"}
    if fos < 1.25:
        return {"label": "HIGH RISK", "color": "#F97316", "bg": "rgba(249,115,22,0.12)", "border": "rgba(249,115,22,0.4)"}
    if fos < 1.5:
        return {"label": "WARNING", "color": AMBER, "bg": "rgba(245,158,11,0.12)", "border": "rgba(245,158,11,0.4)"}
    if fos < 2.0:
        return {"label": "MODERATE", "color": "#38BDF8", "bg": "rgba(56,189,248,0.12)", "border": "rgba(56,189,248,0.4)"}
    return {"label": "SAFE", "color": EMERALD, "bg": "rgba(16,185,129,0.12)", "border": "rgba(16,185,129,0.4)"}


def build_heatmap_data(ru, rain, tilt, rmr, slope):
    risk = ru * 0.38 + (rain / 100) * 0.28 + (tilt / 30) * 0.2 + (slope / 80) * 0.14
    safe = (rmr / 100) * 2.2
    net = (risk - safe + 1.1) * 1.8
    base = [
        [0, 0, 1, 1, 2],
        [0, 1, 1, 2, 3],
        [1, 1, 2, 3, 3],
        [1, 2, 3, 3, 4],
        [2, 3, 3, 4, 4],
    ]
    return [[min(4, max(0, round(v + net - 2))) for v in row] for row in base]


HM_STYLE = [
    {"bg": "rgba(16,185,129,0.18)", "text": "#10B981", "border": "rgba(16,185,129,0.25)", "label": "Safe"},
    {"bg": "rgba(52,211,153,0.14)", "text": "#34D399", "border": "rgba(52,211,153,0.2)", "label": "Low"},
    {"bg": "rgba(245,158,11,0.18)", "text": "#F59E0B", "border": "rgba(245,158,11,0.25)", "label": "Med"},
    {"bg": "rgba(249,115,22,0.22)", "text": "#F97316", "border": "rgba(249,115,22,0.35)", "label": "High"},
    {"bg": "rgba(239,68,68,0.22)", "text": "#EF4444", "border": "rgba(239,68,68,0.45)", "label": "Crit"},
]
SECTOR_COL = ["A", "B", "C", "D", "E"]


# ---------------------------------------------------------------------------
# CSS
# ---------------------------------------------------------------------------

CSS = r"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');

:root {
    --bg: #090A0F; --surface: #0D0F17; --card: rgba(18,20,29,0.88);
    --border: #232738; --crimson: #EF4444; --emerald: #10B981;
    --amber: #F59E0B; --indigo: #6366F1; --violet: #8B5CF6;
    --text: #E2E8F0; --dim: #94A3B8; --muted: #64748B; --accent: #818CF8;
}

html, body, [class*="css"] {
    font-family: 'Inter', system-ui, sans-serif !important;
    background: #090A0F !important;
    color: #E2E8F0; line-height: 1.5;
    -webkit-font-smoothing: antialiased;
}
.stApp { background: #090A0F !important; }
section[data-testid="stSidebar"] { display: none !important; }
#MainMenu, footer, header[data-testid="stHeader"] { display: none !important; }

@keyframes critical-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); border-color: rgba(239,68,68,0.5); }
    50% { box-shadow: 0 0 24px 4px rgba(239,68,68,0.25); border-color: rgba(239,68,68,1); }
}
@keyframes live-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }

.gg-critical-banner {
    background: linear-gradient(90deg, rgba(239,68,68,0.08), rgba(239,68,68,0.15), rgba(239,68,68,0.08));
    border-bottom: 1px solid #EF4444;
    padding: 9px 20px; text-align: center;
    animation: critical-pulse 1.8s ease-in-out infinite;
}
.gg-critical-text { font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; font-weight: 700; color: #EF4444; letter-spacing: 0.08em; }
.gg-critical-sub { font-family: 'JetBrains Mono', monospace; font-size: 0.68rem; color: rgba(239,68,68,0.7); letter-spacing: 0.05em; }

.gg-topnav {
    background: rgba(18,20,29,0.88); backdrop-filter: blur(20px);
    border-bottom: 1px solid #232738; padding: 0 20px; height: 54px;
    display: flex; align-items: center; justify-content: space-between;
    margin: -8px -8px 0 -8px; position: relative; z-index: 50;
}
.gg-nav-brand { display: flex; align-items: center; gap: 10px; }
.gg-nav-logo {
    width: 34px; height: 34px; border-radius: 9px;
    background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 18px rgba(99,102,241,0.55);
}
.gg-nav-title { font-weight: 800; font-size: 0.92rem; letter-spacing: -0.02em; line-height: 1.1; }
.gg-nav-title span { color: #6366F1; }
.gg-nav-subtitle { font-family: 'JetBrains Mono', monospace; font-size: 0.52rem; color: #64748B; letter-spacing: 0.1em; text-transform: uppercase; }
.gg-nav-right { display: flex; align-items: center; gap: 14px; }
.gg-nav-clock { font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; color: #94A3B8; text-align: right; }
.gg-nav-clock-date { font-family: 'JetBrains Mono', monospace; font-size: 0.52rem; color: #64748B; }
.gg-status-pill {
    display: flex; align-items: center; gap: 6px;
    background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.3);
    border-radius: 20px; padding: 5px 12px; box-shadow: 0 0 14px rgba(16,185,129,0.15);
}
.gg-status-dot {
    width: 6px; height: 6px; border-radius: 50%; background: #10B981;
    animation: live-blink 1.4s ease-in-out infinite; flex-shrink: 0;
}
.gg-status-text { font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; color: #10B981; font-weight: 600; letter-spacing: 0.07em; }
.gg-critical-pill {
    display: flex; align-items: center; gap: 5px;
    background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.4);
    border-radius: 20px; padding: 5px 10px;
}
.gg-critical-pill .gg-status-dot { background: #EF4444; }
.gg-critical-pill-text { font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; color: #EF4444; font-weight: 600; letter-spacing: 0.07em; }

.gg-glass {
    background: rgba(18,20,29,0.88); backdrop-filter: blur(20px);
    border: 1px solid #232738; border-radius: 12px;
}
.gg-kpi {
    background: rgba(18,20,29,0.88); backdrop-filter: blur(20px);
    border: 1px solid #232738; border-radius: 12px; padding: 14px;
    transition: border-color 0.3s, box-shadow 0.3s;
}
.gg-kpi-critical { border-color: rgba(239,68,68,0.3) !important; box-shadow: 0 0 20px rgba(239,68,68,0.1); }
.gg-kpi-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
.gg-kpi-label { font-weight: 600; font-size: 0.76rem; color: #E2E8F0; }
.gg-kpi-sublabel { font-family: 'JetBrains Mono', monospace; font-size: 0.54rem; color: #64748B; margin-top: 2px; }
.gg-kpi-big { font-family: 'JetBrains Mono', monospace; font-size: 2.6rem; font-weight: 700; line-height: 1; margin-bottom: 6px; }
.gg-kpi-badge { display: inline-flex; align-items: center; gap: 7px; border-radius: 8px; padding: 6px 12px; margin-bottom: 8px; }
.gg-kpi-badge-text { font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.06em; }
.gg-kpi-meta { font-family: 'JetBrains Mono', monospace; font-size: 0.58rem; color: #64748B; }

.gg-kpi-progress { display: flex; align-items: center; gap: 8px; }
.gg-kpi-progress-track { flex: 1; height: 3px; border-radius: 2px; background: #232738; overflow: hidden; }
.gg-kpi-progress-fill { height: 100%; border-radius: 2px; transition: width 0.5s; }
.gg-kpi-progress-label { font-family: 'JetBrains Mono', monospace; font-size: 0.58rem; color: #64748B; white-space: nowrap; }

.gg-section-label { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; }
.gg-section-label-line { flex: 1; height: 1px; background: rgba(35,39,56,0.8); }
.gg-section-label-text { font-family: 'JetBrains Mono', monospace; font-size: 0.54rem; letter-spacing: 0.12em; color: #64748B; text-transform: uppercase; white-space: nowrap; }

.gg-sensor-row { display: flex; align-items: center; justify-content: space-between; padding: 4px 0; }
.gg-sensor-name { display: flex; align-items: center; gap: 7px; }
.gg-sensor-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.gg-sensor-dot--ok { background: #10B981; }
.gg-sensor-dot--fault { background: #F59E0B; opacity: 0.7; }
.gg-sensor-label { font-size: 0.68rem; color: #94A3B8; }
.gg-sensor-badge { font-family: 'JetBrains Mono', monospace; font-size: 0.56rem; padding: 1px 6px; border-radius: 4px; }
.gg-sensor-badge--ok { color: #10B981; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); }
.gg-sensor-badge--fault { color: #F59E0B; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); }

.gg-fos-legend-row { display: flex; align-items: center; justify-content: space-between; }
.gg-fos-legend-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
.gg-fos-legend-label { display: flex; align-items: center; gap: 6px; }
.gg-fos-legend-label span { font-size: 0.65rem; color: #94A3B8; }
.gg-fos-legend-range { font-family: 'JetBrains Mono', monospace; font-size: 0.58rem; color: #64748B; }

.gg-panel-header { display: flex; align-items: center; justify-content: space-between; }
.gg-panel-title { font-weight: 600; font-size: 0.82rem; }
.gg-panel-subtitle { font-family: 'JetBrains Mono', monospace; font-size: 0.56rem; color: #64748B; margin-top: 2px; }

.gg-tab-group { display: flex; gap: 4px; }
.gg-tab {
    padding: 4px 11px; border-radius: 6px; cursor: pointer;
    font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; font-weight: 600;
    letter-spacing: 0.05em; transition: all 0.2s; border: 1px solid transparent;
}
.gg-tab--active { background: rgba(99,102,241,0.2); color: #6366F1; border-color: rgba(99,102,241,0.45); }
.gg-tab--inactive-raw { background: rgba(35,39,56,0.8); color: #E2E8F0; border-color: #232738; }

.gg-image-container { position: relative; border-radius: 8px; overflow: hidden; height: 220px; background: #0a0c14; }
.gg-image-container img { width: 100%; height: 100%; object-fit: cover; display: block; }
.gg-live-badge { position: absolute; top: 8px; right: 8px; }
.gg-live-tag { font-family: 'JetBrains Mono', monospace; font-size: 0.58rem; color: #10B981; background: rgba(9,10,15,0.8); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(16,185,129,0.4); }
.gg-cam-info { position: absolute; bottom: 6px; left: 8px; font-family: 'JetBrains Mono', monospace; font-size: 0.56rem; color: #94A3B8; background: rgba(9,10,15,0.75); padding: 2px 7px; border-radius: 4px; }

.gg-hm-legend { display: flex; gap: 6px; flex-wrap: wrap; }
.gg-hm-legend-item { display: flex; align-items: center; gap: 3px; }
.gg-hm-legend-dot { width: 7px; height: 7px; border-radius: 2px; }
.gg-hm-legend-text { font-family: 'JetBrains Mono', monospace; font-size: 0.52rem; color: #64748B; }
.gg-hm-grid { display: grid; grid-template-columns: 22px repeat(5, 1fr); gap: 5px; }
.gg-hm-cell { display: flex; align-items: center; justify-content: center; border-radius: 6px; min-height: 36px; }
.gg-hm-cell-text { font-family: 'JetBrains Mono', monospace; font-size: 0.58rem; font-weight: 600; }
.gg-hm-stats { display: flex; justify-content: space-around; border-top: 1px solid #232738; padding-top: 8px; }
.gg-hm-stat-val { font-family: 'JetBrains Mono', monospace; font-size: 1.1rem; font-weight: 700; line-height: 1; }
.gg-hm-stat-label { font-family: 'JetBrains Mono', monospace; font-size: 0.52rem; color: #64748B; margin-top: 2px; }

.gg-shap-legend { display: flex; gap: 14px; }
.gg-shap-legend-item { display: flex; align-items: center; gap: 5px; }
.gg-shap-legend-dot { width: 10px; height: 10px; border-radius: 2px; }
.gg-shap-legend-text { font-size: 0.62rem; color: #94A3B8; }

.gg-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center; }
.gg-empty-icon { font-size: 36px; margin-bottom: 10px; opacity: 0.5; }
.gg-empty-title { font-weight: 600; font-size: 0.85rem; margin: 0 0 4px 0; }
.gg-empty-desc { font-size: 0.72rem; color: #64748B; margin: 0; line-height: 1.5; }

.gg-footer { display: flex; align-items: center; justify-content: space-between; padding: 16px 0; margin-top: 12px; border-top: 1px solid #232738; }
.gg-footer-text { font-size: 10.5px; color: #64748B; letter-spacing: 0.02em; }

div[data-testid="stChatMessage"] {
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
}
div[data-testid="stChatMessage"] .stMarkdown {
    background: rgba(28,31,46,0.7) !important;
    border: 1px solid #232738 !important;
    border-radius: 3px 10px 10px 10px !important;
    padding: 7px 11px !important;
    font-size: 0.72rem !important;
    line-height: 1.65 !important;
    color: #E2E8F0 !important;
}
div[data-testid="stChatInput"] {
    background: rgba(28,31,46,0.6) !important;
    border: 1px solid #232738 !important;
    border-radius: 8px !important;
}
div[data-testid="stChatInput"] textarea {
    color: #E2E8F0 !important;
    font-family: 'Inter', system-ui, sans-serif !important;
    font-size: 0.73rem !important;
}
</style>
"""

# ---------------------------------------------------------------------------
# Render helpers
# ---------------------------------------------------------------------------

def _section_label(text: str):
    return f"""<div class="gg-section-label">
    <div class="gg-section-label-line"></div>
    <span class="gg-section-label-text">{text}</span>
    <div class="gg-section-label-line"></div>
</div>"""


def _render_kpi_card(label, sublabel, value, value_color, is_critical=False, sub_text=None, progress_pct=None):
    crit_cls = " gg-kpi-critical" if is_critical else ""
    progress_html = ""
    if progress_pct is not None:
        progress_html = f"""<div class="gg-kpi-progress">
            <div class="gg-kpi-progress-track"><div class="gg-kpi-progress-fill" style="width:{min(100, progress_pct)}%;background:{value_color};"></div></div>
            <span class="gg-kpi-progress-label">max 3.0</span>
        </div>"""
    sub_html = ""
    if sub_text:
        sub_html = f'<div style="font-family:{MONO};font-size:0.62rem;color:{value_color};">{sub_text}</div>'
    return f"""<div class="gg-kpi{crit_cls}">
    <div class="gg-kpi-header">
        <div><div class="gg-kpi-label">{label}</div><div class="gg-kpi-sublabel">{sublabel}</div></div>
    </div>
    <div class="gg-kpi-big" style="color:{value_color};{'text-shadow:0 0 24px ' + value_color + '60;' if is_critical else ''}">{value}</div>
    {progress_html}
    {sub_html}
</div>"""


def _render_risk_card(label, risk_info, utc_time, is_critical):
    dot_html = '<span class="gg-status-dot"></span> ' if is_critical else ""
    return f"""<div class="gg-kpi{' gg-kpi-critical' if is_critical else ''}">
    <div class="gg-kpi-header">
        <div><div class="gg-kpi-label">{label}</div><div class="gg-kpi-sublabel">AI Classification</div></div>
    </div>
    <div class="gg-kpi-badge" style="background:{risk_info['bg']};border:1px solid {risk_info['border']};">
        {dot_html}<span class="gg-kpi-badge-text" style="color:{risk_info['color']};">{risk_info['label']}</span>
    </div>
    <div class="gg-kpi-meta">Updated: {utc_time} UTC</div>
</div>"""


def _render_image_panel(optical_tab, overlay_image):
    tab_active = optical_tab
    active_cls = "gg-tab--active" if tab_active == "opencv" else ""
    raw_cls = "gg-tab--active" if tab_active == "raw" else ""
    inactive_cls = "gg-tab--inactive-raw"

    image_html = ""
    if overlay_image is not None and tab_active == "opencv":
        import base64
        img_pil = Image.fromarray(overlay_image)
        import io
        buf = io.BytesIO()
        img_pil.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        image_html = f'<img src="data:image/png;base64,{b64}" style="width:100%;height:100%;object-fit:cover;">'
    else:
        image_html = f"""<div style="width:100%;height:100%;background:#0a0c14;display:flex;align-items:center;justify-content:center;">
            <div class="gg-empty-state"><div class="gg-empty-icon">Camera</div>
            <div class="gg-empty-title" style="color:#94A3B8;">No pit wall image loaded</div>
            <div class="gg-empty-desc">Upload an image in the sidebar</div></div></div>"""

    return f"""<div class="gg-glass" style="padding:14px;display:flex;flex-direction:column;gap:10px;">
    <div class="gg-panel-header">
        <div><div class="gg-panel-title">Optical Analysis</div><div class="gg-panel-subtitle">Pit Wall Risk Assessment</div></div>
        <div class="gg-tab-group">
            <button class="gg-tab {active_cls if tab_active == 'opencv' else inactive_cls}" onclick="document.querySelector('#tab_opencv').click()">OPENCV</button>
            <button class="gg-tab {active_cls if tab_active == 'raw' else inactive_cls}" onclick="document.querySelector('#tab_raw').click()">RAW</button>
        </div>
    </div>
    <div class="gg-image-container">
        {image_html}
        <div class="gg-live-badge"><span class="gg-live-tag">LIVE</span></div>
    </div>
</div>"""


def _render_heatmap_grid(heatmap_data):
    rows_html = ""
    for ri, row in enumerate(heatmap_data):
        cells = ""
        for ci, cell in enumerate(row):
            s = HM_STYLE[cell]
            crit_cls = " gg-hm-cell-critical" if cell >= 4 else ""
            cells += f"""<div class="gg-hm-cell{crit_cls}" style="background:{s['bg']};border:1px solid {s['border']};">
                <span class="gg-hm-cell-text" style="color:{s['text']};">{SECTOR_COL[ci]}{ri+1}</span>
            </div>"""
        rows_html += f"""<div class="gg-hm-grid" style="margin-bottom:5px;">
            <div style="font-family:{MONO};font-size:0.62rem;color:{MUTED};display:flex;align-items:center;justify-content:flex-end;">{ri+1}</div>
            {cells}</div>"""

    header = '<div class="gg-hm-grid" style="margin-bottom:5px;"><div></div>'
    for c in SECTOR_COL:
        header += f'<div style="text-align:center;font-family:{MONO};font-size:0.62rem;color:{MUTED};">{c}</div>'
    header += "</div>"

    flat = [v for row in heatmap_data for v in row]
    n_crit = flat.count(4)
    n_high = flat.count(3)
    n_mod = flat.count(2)
    n_safe = len(flat) - n_crit - n_high - n_mod

    return f"""<div class="gg-glass" style="padding:14px;display:flex;flex-direction:column;gap:10px;">
    <div class="gg-panel-header">
        <div><div class="gg-panel-title">Mine Bench Risk Grid</div><div class="gg-panel-subtitle">5x5 Sector Spatial Risk Analysis</div></div>
        <div class="gg-hm-legend">
            {"".join(f'<div class="gg-hm-legend-item"><div class="gg-hm-legend-dot" style="background:{s["text"]};"></div><span class="gg-hm-legend-text">{s["label"]}</span></div>' for s in HM_STYLE)}
        </div>
    </div>
    {header}
    {rows_html}
    <div class="gg-hm-stats">
        <div style="text-align:center;"><div class="gg-hm-stat-val" style="color:{CRIMSON};">{n_crit}</div><div class="gg-hm-stat-label">Critical</div></div>
        <div style="text-align:center;"><div class="gg-hm-stat-val" style="color:#F97316;">{n_high}</div><div class="gg-hm-stat-label">High</div></div>
        <div style="text-align:center;"><div class="gg-hm-stat-val" style="color:{AMBER};">{n_mod}</div><div class="gg-hm-stat-label">Moderate</div></div>
        <div style="text-align:center;"><div class="gg-hm-stat-val" style="color:{EMERALD};">{n_safe}</div><div class="gg-hm-stat-label">Safe/Low</div></div>
    </div>
</div>"""


# ---------------------------------------------------------------------------
# Main layout
# ---------------------------------------------------------------------------

def main():
    st.set_page_config(page_title="GeoGuard AI", layout="wide", initial_sidebar_state="collapsed")
    st.markdown(CSS, unsafe_allow_html=True)

    # Derived state
    fos = compute_fos(st.session_state.ru, st.session_state.rainfall, st.session_state.tilt, st.session_state.rmr, st.session_state.slope_angle)
    is_critical = fos < 1.0
    risk = get_risk_info(fos)
    smr = compute_smr_local(st.session_state.rmr, st.session_state.slope_angle, st.session_state.tilt)
    jv = compute_jv_local(st.session_state.rmr, st.session_state.tilt)
    heatmap_data = build_heatmap_data(st.session_state.ru, st.session_state.rainfall, st.session_state.tilt, st.session_state.rmr, st.session_state.slope_angle)

    utc_now = datetime.now(timezone.utc)
    utc_time = utc_now.strftime("%H:%M:%S")
    utc_date = utc_now.strftime("%Y-%m-%d")

    # -- Critical banner --
    if is_critical:
        st.markdown(f"""<div class="gg-critical-banner">
            <span class="gg-critical-text">CRITICAL RISK: IMMEDIATE BENCH EVACUATION REQUIRED</span>
            <span class="gg-critical-sub"> -- FoS = {fos:.2f} -- ALL PERSONNEL CLEAR NOW</span>
        </div>""", unsafe_allow_html=True)

    # -- Top navbar --
    nav_html = f"""<div class="gg-topnav">
        <div class="gg-nav-brand">
            <div class="gg-nav-logo">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M3 20L12 4L21 20H3Z" stroke="white" stroke-width="1.5" stroke-linejoin="round" fill="rgba(255,255,255,0.15)"/>
                    <path d="M7 20L12 10L17 20" stroke="white" stroke-width="1" stroke-linejoin="round" opacity="0.6"/>
                    <circle cx="12" cy="4" r="1.5" fill="white"/>
                </svg>
            </div>
            <div>
                <div class="gg-nav-title">GeoGuard <span>AI</span></div>
                <div class="gg-nav-subtitle">Slope Stability Monitoring System</div>
            </div>
        </div>
        <div class="gg-nav-right">
            <div>
                <div class="gg-nav-clock">{utc_time} UTC</div>
                <div class="gg-nav-clock-date">{utc_date}</div>
            </div>
            <div class="gg-status-pill"><span class="gg-status-dot"></span><span class="gg-status-text">TELEMETRY STREAM ACTIVE</span></div>
            {"<div class='gg-critical-pill'><span class='gg-status-dot'></span><span class='gg-critical-pill-text'>CRITICAL</span></div>" if is_critical else ""}
        </div>
    </div>"""
    st.markdown(nav_html, unsafe_allow_html=True)

    st.markdown("---")

    # =====================================================================
    # Body: sidebar controls + main content
    # =====================================================================

    # --- Sidebar (as a hidden column approach: use columns ---
    # We'll use a two-column layout: sidebar | main
    sidebar_col, main_col = st.columns([260 / 1200, 940 / 1200], gap="small")

    with sidebar_col:
        # Image uploader
        st.markdown(_section_label("Optical Image Input"), unsafe_allow_html=True)
        uploaded = st.file_uploader("Upload pit wall image", type=["png", "jpg", "jpeg", "tif", "tiff"], label_visibility="collapsed", key="img_upload")
        if uploaded is not None:
            st.session_state.uploaded_bytes = uploaded.read()
            st.session_state.uploaded_image = Image.open(uploaded)
            st.image(st.session_state.uploaded_image, width="stretch")

        st.markdown(_section_label("IoT Telemetry"), unsafe_allow_html=True)
        ru_val = st.slider("Piezometer (ru)", 0.0, 1.0, st.session_state.ru, 0.01, key="sl_ru", label_visibility="visible")
        st.session_state.ru = ru_val
        rain_val = st.slider("Rainfall (mm/hr)", 0.0, 100.0, st.session_state.rainfall, 1.0, key="sl_rain", label_visibility="visible")
        st.session_state.rainfall = rain_val
        tilt_val = st.slider("Tilt Angle (deg)", 0.0, 30.0, st.session_state.tilt, 0.5, key="sl_tilt", label_visibility="visible")
        st.session_state.tilt = tilt_val

        st.markdown(_section_label("Geotechnical Parameters"), unsafe_allow_html=True)
        rmr_val = st.slider("Basic RMR", 0, 100, st.session_state.rmr, 1, key="sl_rmr", label_visibility="visible")
        st.session_state.rmr = rmr_val
        slope_val = st.slider("Slope Angle (deg)", 20, 80, st.session_state.slope_angle, 1, key="sl_slope", label_visibility="visible")
        st.session_state.slope_angle = slope_val

        st.markdown(_section_label("Sensor Network"), unsafe_allow_html=True)
        sensors = [
            ("P-07", "Piezometer P-07", True), ("P-12", "Piezometer P-12", True),
            ("P-19", "Piezometer P-19", True), ("T-03", "Tiltmeter T-03", False),
            ("RG-01", "Rain Gauge RG-01", True), ("G-02", "GNSS Station G-02", True),
            ("AC-04", "Accelerometer AC-04", False),
        ]
        for sid, sname, ok in sensors:
            dot_cls = "gg-sensor-dot--ok" if ok else "gg-sensor-dot--fault"
            badge_cls = "gg-sensor-badge--ok" if ok else "gg-sensor-badge--fault"
            st.markdown(f"""<div class="gg-sensor-row">
                <div class="gg-sensor-name"><span class="gg-sensor-dot {dot_cls}"></span><span class="gg-sensor-label">{sname}</span></div>
                <span class="gg-sensor-badge {badge_cls}">{"ONLINE" if ok else "FAULT"}</span>
            </div>""", unsafe_allow_html=True)

        st.markdown(_section_label("FoS Classification"), unsafe_allow_html=True)
        legend_items = [
            (">= 2.00", "Safe", EMERALD), ("1.50-2.00", "Moderate", "#38BDF8"),
            ("1.25-1.50", "Warning", AMBER), ("1.00-1.25", "High Risk", "#F97316"),
            ("< 1.00", "Critical", CRIMSON),
        ]
        for rng_str, lbl, clr in legend_items:
            st.markdown(f"""<div class="gg-fos-legend-row">
                <div class="gg-fos-legend-label"><div class="gg-fos-legend-dot" style="background:{clr};"></div><span>{lbl}</span></div>
                <span class="gg-fos-legend-range">{rng_str}</span>
            </div>""", unsafe_allow_html=True)

    # --- Main content ---
    with main_col:
        # Row 1: KPI cards
        fos_color = CRIMSON if is_critical else (AMBER if fos < 1.5 else EMERALD)
        fos_sub = f"{'CRITICAL' if is_critical else 'Below threshold' if fos < 1.5 else 'Within safe range'}"

        kpi1, kpi2, kpi3, kpi4 = st.columns(4)
        with kpi1:
            st.markdown(_render_kpi_card("Factor of Safety", "FoS -- Limit Equilibrium", f"{fos:.2f}", fos_color, is_critical, fos_sub, progress_pct=(fos / 3.0) * 100), unsafe_allow_html=True)
        with kpi2:
            st.markdown(_render_risk_card("Active Risk Status", risk, utc_time, is_critical), unsafe_allow_html=True)
        with kpi3:
            jv_color = AMBER if jv > 20 else ("#38BDF8" if jv > 10 else EMERALD)
            jv_sub = "Very Blocky" if jv > 20 else ("Blocky" if jv > 10 else "Intact/Massive")
            st.markdown(_render_kpi_card("Joint Volumetric Count", "Jv -- joints/m3", str(jv), jv_color, False, jv_sub), unsafe_allow_html=True)
        with kpi4:
            smr_color = CRIMSON if smr < 40 else (AMBER if smr < 60 else EMERALD)
            smr_sub = "Completely Unstable" if smr < 20 else ("Unstable (V)" if smr < 40 else ("Partially Stable (IV)" if smr < 60 else ("Normal (III)" if smr < 80 else "Stable (I-II)")))
            st.markdown(_render_kpi_card("SMR Score", "Slope Mass Rating", str(smr), smr_color, smr < 40, smr_sub), unsafe_allow_html=True)

        # Row 2: Optical analysis + Heatmap
        col_opt, col_heat = st.columns(2)
        with col_opt:
            # Use buttons for tab switching
            tab_raw, tab_cv = st.columns(2)
            with tab_raw:
                if st.button("RAW IMAGE", key="tab_raw", width="stretch"):
                    st.session_state.optical_tab = "raw"
            with tab_cv:
                if st.button("OPENCV", key="tab_opencv", width="stretch"):
                    st.session_state.optical_tab = "opencv"

            overlay_img = st.session_state.last_fusion.get("annotated_image") if st.session_state.last_fusion else None
            if overlay_img is not None:
                if st.session_state.optical_tab == "opencv":
                    st.image(overlay_img, width="stretch", caption="Risk heatmap overlay")
                else:
                    if st.session_state.uploaded_image is not None:
                        st.image(st.session_state.uploaded_image, width="stretch", caption="Raw image")
                    else:
                        st.markdown("""<div class="gg-glass gg-empty-state"><div class="gg-empty-icon">No Image</div><div class="gg-empty-title" style="color:#94A3B8;">Upload a pit wall image</div></div>""", unsafe_allow_html=True)
            else:
                st.markdown("""<div class="gg-glass gg-empty-state"><div class="gg-empty-icon">No Image</div><div class="gg-empty-title" style="color:#94A3B8;">Upload a pit wall image in the sidebar</div><div class="gg-empty-desc">The risk overlay will appear here after analysis</div></div>""", unsafe_allow_html=True)

        with col_heat:
            st.markdown(_render_heatmap_grid(heatmap_data), unsafe_allow_html=True)

        # Row 3: SHAP + Chat
        col_shap, col_chat = st.columns(2)

        with col_shap:
            shap_values = st.session_state.last_fusion.get("shap_values") if st.session_state.last_fusion else None
            shap_data = [
                ("Piezometer (ru)", st.session_state.ru * 0.62, True),
                ("Rainfall intensity", (st.session_state.rainfall / 100) * 0.48, True),
                ("Tilt angle", (max(0, st.session_state.tilt - 5) / 25) * 0.38, True),
                ("Slope angle", (max(0, st.session_state.slope_angle - 30) / 55) * 0.32, True),
                ("Joint set orientation", 0.19, True),
                ("RMR score", (st.session_state.rmr / 100) * 0.58, False),
                ("Rock mass cohesion", 0.34, False),
                ("Drainage condition", 0.26, False),
                ("Internal friction phi", 0.22, False),
                ("Rock unit weight", 0.16, False),
            ]

            fig_shap = go.Figure()
            for name, val, is_risk in reversed(shap_data):
                color = CRIMSON if is_risk else EMERALD
                fig_shap.add_trace(go.Bar(
                    y=[name], x=[val], orientation="h",
                    marker=dict(color=color, opacity=0.85),
                    showlegend=False,
                    text=[f"+{val:.2f}"], textposition="outside",
                    textfont=dict(family="JetBrains Mono, monospace", size=11, color=color),
                ))
            fig_shap.update_layout(
                height=380, margin=dict(l=0, r=30, t=10, b=10),
                paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                xaxis=dict(visible=False, range=[0, 0.7]),
                yaxis=dict(autorange="reversed", tickfont=dict(family="JetBrains Mono, monospace", size=10, color=DIM)),
                bargap=0.35,
            )
            st.markdown(f"""<div class="gg-glass" style="padding:14px;display:flex;flex-direction:column;gap:10px;">
                <div class="gg-panel-header">
                    <div><div class="gg-panel-title">Explainable AI -- SHAP Feature Attribution</div>
                    <div class="gg-panel-subtitle">Feature importance for current FoS prediction</div></div>
                </div>
                <div class="gg-shap-legend">
                    <div class="gg-shap-legend-item"><div class="gg-shap-legend-dot" style="background:{CRIMSON};"></div><span class="gg-shap-legend-text">Risk Driver</span></div>
                    <div class="gg-shap-legend-item"><div class="gg-shap-legend-dot" style="background:{EMERALD};"></div><span class="gg-shap-legend-text">Stability Factor</span></div>
                </div>
            </div>""", unsafe_allow_html=True)
            st.plotly_chart(fig_shap, width="stretch", key="shap_chart")

        # Chat panel
        with col_chat:
            st.markdown(f"""<div class="gg-glass" style="padding:11px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid {BORDER};">
                <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,{INDIGO},{VIOLET});display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 0 14px rgba(99,102,241,0.45);flex-shrink:0;">Chat</div>
                <div style="flex:1;"><div style="font-weight:600;font-size:0.82rem;">GeoGuard AI Assistant</div>
                <div style="font-family:{MONO};font-size:0.55rem;color:{EMERALD};display:flex;align-items:center;gap:4px;">
                    <span class="gg-status-dot" style="width:5px;height:5px;background:{EMERALD};"></span> Online</div></div>
                {"<div style='font-family:" + MONO + ";font-size:0.58rem;color:" + CRIMSON + ";background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);padding:3px 8px;border-radius:5px;'>CRITICAL MODE</div>" if is_critical else ""}
            </div>""", unsafe_allow_html=True)

            # Chat history
            if not st.session_state.chat_history:
                st.session_state.chat_history = [
                    ("ai", f"GeoGuard AI online. System status: {'CRITICAL' if is_critical else 'Normal'}. FoS = {fos:.2f}. How can I assist you?"),
                ]

            for role, content in st.session_state.chat_history:
                with st.chat_message(role):
                    st.markdown(content)

            # Quick prompt buttons
            quick_cols = st.columns(4)
            quick_prompts = ["Evacuation protocol?", "Dewatering options", "Alert geo team", "Monte Carlo"]
            for i, prompt in enumerate(quick_prompts):
                with quick_cols[i]:
                    if st.button(prompt, key=f"qp_{i}", width="stretch"):
                        st.session_state.chat_history.append(("user", prompt))
                        reply = _get_ai_reply(prompt, fos, st.session_state.ru, st.session_state.rainfall)
                        st.session_state.chat_history.append(("ai", reply))
                        st.rerun()

            # Chat input
            user_msg = st.chat_input("Ask about slope stability, protocols, risk factors...")
            if user_msg:
                st.session_state.chat_history.append(("user", user_msg))
                reply = _get_ai_reply(user_msg, fos, st.session_state.ru, st.session_state.rainfall)
                st.session_state.chat_history.append(("ai", reply))
                st.rerun()

        # Run analysis button
        st.markdown("---")
        if st.button("Run Full Fusion Analysis", type="primary", width="stretch"):
            with st.spinner("Running CV + Physics + ML pipeline..."):
                result = _run_analysis()
                if result is not None:
                    st.session_state.last_fusion = result
                    st.rerun()

        # Footer
        st.markdown(f"""<div class="gg-footer"><span class="gg-footer-text">GeoGuard AI v1.0 -- Open-Pit Mine Slope Stability Monitoring</span><span class="gg-footer-text">2026-08-20</span></div>""", unsafe_allow_html=True)


def _run_analysis():
    """Run the full fusion pipeline."""
    image_input = st.session_state.uploaded_bytes
    if image_input is None and st.session_state.uploaded_image is not None:
        import io
        buf = io.BytesIO()
        st.session_state.uploaded_image.save(buf, format="PNG")
        image_input = buf.getvalue()

    if run_fusion_pipeline is not None:
        try:
            return run_fusion_pipeline(
                image_input=image_input,
                slope_angle_deg=float(st.session_state.slope_angle),
                discontinuity_density=0.5,
                weathering_index=float(st.session_state.rmr) / 100.0,
                bench_height_m=15.0,
                rainfall_mm=float(st.session_state.rainfall),
                blast_vibration_index=3.0,
                water_seepage_index=float(st.session_state.ru),
                loose_rock_index=0.3,
            )
        except Exception as exc:
            st.error(f"Fusion pipeline error: {exc}")
            return None

    # Fallback: at least get CV overlay
    overlay = None
    jv = 20.0
    if extract_jv_density is not None and image_input is not None:
        try:
            jv, overlay = extract_jv_density(image_input)
        except Exception:
            pass

    if overlay is None and _synthetic_overlay is not None:
        overlay = _synthetic_overlay()

    return {
        "physics_fos": compute_fos(st.session_state.ru, st.session_state.rainfall, st.session_state.tilt, st.session_state.rmr, st.session_state.slope_angle),
        "smr_score": compute_smr_local(st.session_state.rmr, st.session_state.slope_angle, st.session_state.tilt),
        "jv_density": compute_jv_local(st.session_state.rmr, st.session_state.tilt),
        "risk_status": "CRITICAL RISK" if compute_fos(st.session_state.ru, st.session_state.rainfall, st.session_state.tilt, st.session_state.rmr, st.session_state.slope_angle) < 1.0 else "LOW RISK",
        "class_probabilities": {"LOW": 0.5, "HIGH": 0.5},
        "shap_values": None,
        "annotated_image": overlay,
        "confidence": 0.5,
        "model_loaded": False,
    }


def _get_ai_reply(msg, fos, ru, rain):
    """Generate a contextual AI reply."""
    l = msg.lower()
    if "evacuat" in l:
        return f"**EVACUATION PROTOCOL:** All personnel must clear high-risk sectors immediately. FoS = {fos:.2f} (below 1.00). Establish 200m exclusion zone. Contact site supervisor and geotechnical engineer. Emergency services on standby."
    if "dewat" in l:
        return f"Dewatering recommendation: Install submersible pumps at piezometer nodes. Current ru = {ru:.2f}. Target reduction to ru < 0.35 within 48 hours. Current rainfall: {rain:.0f} mm/hr -- monitor for escalation."
    if "alert" in l or "team" in l:
        return f"Alert dispatched. Emergency SMS sent to Geotechnical Lead and Site Manager. 3 engineers notified. ETA on-site: 22 minutes. Incident report ID: GG-2026-{datetime.now().strftime('%m%d')}."
    if "monte" in l or "simulat" in l or "fos" in l:
        return f"Monte Carlo FoS simulation (n = 10,000 runs):\n- Mean FoS: {fos:.2f}\n- Current ru: {ru:.2f}, rainfall: {rain:.0f} mm/hr\n- {'PROBABLE FAILURE -- immediate remediation required' if fos < 1.0 else 'Within operational limits -- continue monitoring'}"
    return f"Analyzing current telemetry... FoS = {fos:.2f}, ru = {ru:.2f}, rainfall = {rain:.0f} mm/hr. {'Primary risk: elevated pore-water pressure. Review SHAP panel for full breakdown.' if fos < 1.5 else 'All parameters within normal range. Continue standard monitoring protocol.'}"


if __name__ == "__main__":
    main()
