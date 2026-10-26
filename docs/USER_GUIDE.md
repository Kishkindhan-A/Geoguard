# GeoGuard — daily use

1. Double-click run.bat or run npm start. Open http://127.0.0.1:8051/.
2. Start at Overview. Choose Bingham Canyon, Neyveli, or a custom site. The coordinates initialise weather and assessment inputs; they do not register a photograph to the terrain.
3. Open 3D view to select real elevation/UAV data, or import a GeoTIFF/PLY survey. Drag to rotate, right-drag to pan, scroll or use +/− to zoom. All sides and underneath are available. The base walls are illustrative and transparent.
4. Open Weather for direct forecast retrieval. Change coordinates and refresh if needed. The model grid location/epoch and source matter; this is not an on-site weather station.
5. Open Assessment, upload a JPEG/PNG, and replace hypothetical geology defaults with measured values. For an offline workflow select Manual rainfall totals. Run assessment.
6. Select a block to inspect candidate lines, contributions and screening gates. Use Alerts to record review. Acknowledgement does not clear the hazard.
7. Open History to retrieve stored results; search by name or filter status. Open a result, then use Printable report to print/save PDF, or export JSON/CSV. GeoJSON is available only with valid surveyed image bounds.
8. Local TreeSHAP and saved-fact answers work without an API key. Optional OpenAI explanations require .env.local credentials, a supported model, available API credits and the explicit Use OpenAI checkbox. The Test AI button makes a small billed request. Site imagery and survey assets are not sent.

## Installation check and backups

From the project folder:

```powershell
.venv\Scripts\python.exe scripts\doctor.py
.venv\Scripts\python.exe scripts\doctor.py --backup
```

The second command creates a consistent timestamped SQLite snapshot in backups/. Keep backups and survey originals on trusted storage. To restore: stop the app, preserve the current database, and copy a selected backup to data/assessments.sqlite3 (or the configured GEOGUARD_DB_PATH). Do not replace a running database. No automatic deletion or overwriting is performed by the backup utility.

## Common issues

| Symptom | Action |
|---|---|
| Service offline | Start npm start from the project folder; check that ports 8000 and 8051 are free. |
| Weather unavailable | Retry the provider or use explicitly measured/manual rainfall. The app does not invent forecasts. |
| AI credits exhausted | Use local explanations or add credits in the OpenAI API account. A ChatGPT subscription is not proof of API credit availability. |
| Wrong weather site | Check the shared active-site coordinates and Weather query coordinates; choose Use active site. |
| No geographic block overlay | Supply actual north-up orthorectified image bounds. A perspective photo cannot be located by its centre alone. |
| Low-detail mine terrain | Import a current high-resolution mine survey. Public historical DEMs are regional context and may smooth benches. |
| Source files missing | Run scripts/doctor.py and the documented acquisition script or import the survey again. |

Scope: complete local research and review workflow. Field warning deployment requires site validation and a monitoring/response plan; see RELEASE_AUDIT_2026-10-25.md.
