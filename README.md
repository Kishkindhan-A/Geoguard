# GeoGuard v3

Restored blue/slate workspace, real terrain, live weather and traceable local assessment workflow. Start with [the user guide](docs/USER_GUIDE.md) and [the release/research audit](docs/RELEASE_AUDIT_2026-10-25.md).

GeoGuard is a runnable HyGEWS research application for rockfall screening in open-pit mines. Upload a slope photograph, enter measured geology, choose live or manual weather, and inspect block-level heatmaps, warnings and explanations. The supplied conference paper informed the workflow; the implementation corrects its reversed Factor of Safety ratio and distinguishes model demonstrations from validated field predictions.

## What is implemented

- JPEG/PNG ingestion, orientation correction, image quality checks and candidate surface-line detection with OpenCV.
- Configurable 2×2 to 10×10 image grids, selectable blocks, heatmaps and exact additive risk-index explanations.
- Live coordinate-based modelled weather history and forecasts through Open-Meteo, with an explicit manual input mode.
- Planar SMR orientation tables, Jv from measured joint spacings and an illustrative infinite-slope FoS calculation.
- Actual TreeSHAP explanations for the existing synthetic XGBoost classifier, with the paper's 70/30 fusion shown separately.
- A downloaded, checksum-verified stone-crack dataset, reproducible site-held-out benchmark and published limitations.
- Survey-bounded geographic overlays and GeoJSON export for north-up orthorectified images.
- Real 3D mine geometry: Bingham Canyon elevation with aligned orthoimagery and the original Tongjiang UAV point cloud.
- GeoTIFF/PLY survey imports, global public elevation retrieval, coordinate inspection and true-scale 3D measurement.
- Persistent SQLite assessments and timestamped warning acknowledgements; JSON and block CSV exports.
- Local saved-fact answers and optional server-side OpenAI explanations, with connection status and credit-error handling.
- Workspace readiness, searchable history, printable reports and consistent SQLite backups.
- A research/source catalog, reproducible NASA context download, field-data contract and automated workflow tests.

The current main interface is React/TypeScript; FastAPI provides the analysis service. Original UI, Streamlit and geometry experiments are retained for reference and are not the active assessment workflow.

## Start locally on Windows

Requires Python 3.13 and Node.js 18+ with npm. From the project directory:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
npm install --prefix bench-core-dashboard
# Download and prepare the attributed real mine examples (first setup only).
.venv\Scripts\python.exe scripts\prepare_real_terrain.py
npm start
```

If `.venv` and the packages already exist, run `npm start` or double-click `run.bat`.

- Dashboard: [http://127.0.0.1:8051](http://127.0.0.1:8051)
- API documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

The launcher starts both services on loopback and reads `.env.local`, or `.env` if the local file is absent. Stop with Ctrl+C. Map tiles and live weather need network access. For offline analysis, select manual weather; image analysis and local model explanations run locally, while geographic base tiles may be unavailable.

To serve the built dashboard through FastAPI on a single port:

```powershell
npm run build
.venv\Scripts\python.exe -m uvicorn api.server:app --host 127.0.0.1 --port 8000
```

Then open [http://127.0.0.1:8000](http://127.0.0.1:8000). Build before starting this server. This is a local research application with no user authentication; multi-user hosting requires authentication, authorization and a deployment review.

## First assessment

Open **3D view** at any time to inspect the real mine datasets; an image assessment is not required. See [real terrain documentation](docs/REAL_TERRAIN.md) for sources, survey import, global terrain, coordinate handling and measurement limits.

1. Upload a mine-wall image, or select the attributed stone-crack sample for a demonstration. The sample is masonry, not a mine survey.
2. Set a site name and coordinates. Replace hypothetical geology defaults with field measurements.
3. Select live modelled weather or enter the past 24h, past 72h and next 24h rainfall totals. The 72h total must include the 24h total.
4. Set slope and joint dip/direction, RMR, joint spacing, excavation and shear-strength inputs. FoS layer thickness is distinct from bench height.
5. Run the assessment. Select image blocks to inspect their evidence and exact score contributions.
6. Review Weather, Alerts, 3D view, History and Research. Export the saved snapshot for review. Acknowledgement records review without clearing the hazard.

For map-block registration, expand Surveyed map registration and supply valid bounds for a north-up orthorectified image. Ordinary perspective photos support image-block inspection only. Suggested bounds must be replaced with survey values; entering a centre coordinate does not georeference a photograph.

## Interpretation

The block score is a **screening index**, not an event probability. Bands are Normal <40, Warning 40–69.99 and Critical ≥70. Explicit prototype weights combine image line coverage, SMR, rainfall, pressure ratio and blast vibration. FoS/SMR screening gates can raise the minimum alert level. These parameters need mine-specific validation.

The synthetic XGBoost classifier and the paper's weighted fusion appear only as research comparisons and are excluded from block warnings. TreeSHAP explains that classifier in log odds; the separate block contributions explain the warning index. The real stone-crack transfer baseline also stays out of warning generation because its held-out balanced accuracy is only about 49%.

Normal does not establish safety or clear work. The application cannot determine when a rockfall will occur from a photograph and weather forecast. The wettest six-hour forecast window is labelled as weather exposure, not failure time. Site-specific geotechnical review and validated monitoring remain necessary.

## Data and reproducibility

```powershell
# Download/verify CRACK-CH and reproduce the evaluated image-feature baseline.
.venv\Scripts\python.exe scripts\train_crack_classifier.py

# Download a 100-feature NASA COOLR context sample with provenance.
.venv\Scripts\python.exe scripts\download_context_data.py

# Reproduce the original synthetic geotechnical model and SHAP artifact.
.venv\Scripts\python.exe scripts\train_model.py
```

CRACK-CH attribution: Agrafiotis, Doulamis and Georgopoulos, *CRACK-CH: A Crack detection and classification dataset on complex stone masonry surfaces*, [doi:10.5281/zenodo.6516913](https://zenodo.org/records/6516913), CC BY 4.0. The included sample is `Saint Nikolaos Fort/Positive/stnik_pos_6.jpg` from this archive. Checksums, split, per-image predictions and measured metrics are saved in the manifests and model artifacts.

Weather data attribution: [Open-Meteo](https://open-meteo.com/), CC BY 4.0. Its free API is for non-commercial use; see the [service terms](https://open-meteo.com/en/terms) for commercial deployment requirements.

NASA inventory polygons are contextual research data and are not used to train mine-failure probabilities. Preserve each feature's original citation and contributor information. Other researched datasets and their acquisition status are listed in [the source catalog](docs/dataset_catalog.json).

## Validation

```powershell
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.venv\Scripts\python.exe -m unittest discover -s tests -v
.venv\Scripts\python.exe -m compileall -q api src scripts tests
npm run build
npm audit --prefix bench-core-dashboard
```

The suite uses temporary SQLite databases and verifies behavior rather than reproducing implementation details. See [validation evidence](docs/VALIDATION.md) for the tested scope and [research review](docs/RESEARCH_AND_IMPLEMENTATION.md) for methodology, paper corrections and evaluation limits.

## Project structure

```text
api/server.py                     Active FastAPI service and built UI mount
api/assessment_routes.py          Validated assessment, export and guide routes
api/store.py                      SQLite persistence and warning acknowledgements
api/legacy_server.py              Preserved old server; not served
src/assessment.py                 Current unified screening engine
src/weather.py                    Weather retrieval and temporal aggregation
src/crack_classifier.py           Stone-image transfer baseline
bench-core-dashboard/src/         Current interface plus preserved old UI source
scripts/                         Training, data acquisition and development launcher
tests/                           Behavioral and API tests
models/                          Models, provenance and measured benchmark metrics
data/external/                   Downloaded archives, context data and manifests
docs/                            Research, field-data schema and validation records
```

Assessment records live in `data/assessments.sqlite3`; they are excluded from Git. Override `GEOGUARD_DB_PATH` to change the store location. Original images are not retained, but hashes and processed overlays are saved; upload the image again for a new run. Configuration uses environment variables, with `.env.example` as a starting point. Never commit credentials.

The main Python requirements are pinned to the verified environment. Optional packages for archived experiments are in `requirements-legacy.txt`. This repository already contained tracked build/dependency artifacts and other local changes; `.gitignore` prevents new generated files but does not untrack existing files.

The project source licence still needs an explicit author decision before public redistribution. Third-party data retains its own terms and attribution.

Live weather: open Weather to retrieve Open-Meteo current model conditions and 48-hour precipitation directly, without an image. Enter coordinates or choose Bingham Canyon, then Refresh live weather. Retrieval time and model valid time are displayed. Saved assessments keep their original weather snapshot. Open-Meteo open-access endpoint is for non-commercial use; commercial deployments require appropriate provider licensing.


Optional AI explanations: copy the OPENAI_API_KEY and OPENAI_MODEL settings from .env.example into the local .env.local (never a VITE_ variable). Use a Responses-compatible model accessible to your API account. Restart npm start. The Assessment and Research pages show configuration status; enable “Use OpenAI” before asking a saved assessment a question. A configured key is not a verified connection until an explanation succeeds. API usage is billed by your provider. Questions and allowlisted numerical evidence go to OpenAI with store=false; raw photos, mine coordinates, site names and survey files are excluded by the evidence builder. Do not include private details in your question. TreeSHAP remains local, and generated text does not modify warnings. Without a key, local fact-based answers remain available. Provider errors are explicit, with no silent generated fallback.
