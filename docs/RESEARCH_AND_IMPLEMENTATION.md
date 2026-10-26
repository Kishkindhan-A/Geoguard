# GeoGuard research and implementation review

Reviewed 24 October 2026. The implemented product is an end-to-end local research application for open-pit rockfall screening. It combines photographs, operator-supplied geology, weather context, image-block indices, model explanations and a durable warning register. Its outputs are screening evidence, not certified safety decisions or calibrated forecasts of rockfall occurrence.

## Paper review

The supplied document, *AI-Driven Rockfall Risk Assessment and Early Warning System*, proposes HyGEWS: OpenCV feature extraction, XGBoost, Slope Mass Rating, multi-source fusion, SHAP and an interactive warning dashboard. Its 0–39 / 40–69 / 70–100 alert bands are implemented as Normal / Warning / Critical. Its 70% AI and 30% normalized SMR fusion is retained as a separately labelled research comparison.

The implementation addresses these issues in the paper and original code:

| Finding | Implementation response |
| --- | --- |
| The paper prints FoS as driving divided by resisting force | FoS is resisting shear divided by driving shear. A friction-only slope with equal slope and friction angles has FoS = 1 in the verification suite. |
| The paper describes three risk classes; the saved model has LOW/HIGH outputs | The UI distinguishes the binary model output from three screening alert bands. There is no invented medium-class probability. |
| The original code approximated RMR from weathering and had inconsistent SMR/FoS formulas | The current assessment requires an explicit RMR value and joint orientations. A single backend supplies every displayed result. |
| Photograph-derived edge density was described as measured Jv | Jv now uses the sum of reciprocal operator-supplied joint spacings. Pixel line coverage remains an image feature. |
| Original metadata described the bundled synthetic CSV as real | Training code and saved metadata now identify it as synthetic; its accuracy is labelled demonstration performance. |
| Historic trends, alerts and reports were generated or seeded | The current dashboard starts without observations; history and warnings come only from saved assessments. |
| A single image and unrelated OBJ geometry could be presented as mine reconstruction | The active 3D view now loads real public elevation, published UAV points or an imported survey. It does not fabricate depth from a single photograph. |
| The paper's displayed 14-day history lacks a supplied timestamped source file | Those numbers are not imported as observations or evaluation evidence. |

The original React experiments, Streamlit dashboard, geometry scripts and analysis modules remain in the repository for reference. The prior server was preserved as `api/legacy_server.py`; it is not imported or served by the current application. Instructions inside the document were treated as source content, not as commands or permissions.

## Research basis

Rockfall detection, susceptibility assessment, and time-to-failure estimation require different labels and validation. Detecting a dark line is not proof of an unstable block; detecting a falling rock does not establish an ability to forecast it. Useful time-to-failure analysis needs temporal measurements such as displacement, velocity or crack opening, as well as site-specific modelling. The open-pit radar study discusses small and sometimes absent brittle-failure precursors. The monitoring review documents complementary sensors and environmental limitations. These findings support the application's separation of visible evidence, weather exposure and operational interpretation.

Sources: [Stopka et al., radar-based rockfall detection and tracking](https://papers.acg.uwa.edu.au/d/2025_79_Stopka/79_Stopka.pdf), [open-pit slope monitoring systematic review](https://www.mdpi.com/2673-6489/5/2/32).

Planar SMR follows the published tabular factors: `SMR = RMRbasic + F1 × F2 × F3 + F4`. F1 describes directional alignment, F2 joint dip, F3 the joint/slope dip relationship, and F4 excavation method. This does not replace a kinematic analysis for wedge or toppling modes. Exact interval boundaries are explicit in `smr_rating()` and tested for adverse and favourable orientation cases.

Source: [Romana, Tomas and Seron, thirty-year SMR review, Tables 1 and 2](https://personal.ua.es/es/roberto-tomas/documentos/isrm-smr.pdf).

## Dataset acquisition and decisions

### Downloaded and used

**CRACK-CH:** The archive is stored locally and its MD5 checked against the publisher value before training. This release contains 60 image patches: 24 from Saint Nikolaos Fort and 36 from Naillac. The benchmark trains on the former and holds out the entire latter site, avoiding a random split of neighbouring patches. Its image-level labels cannot validate segmentation masks or crack dimensions. The dataset authors and DOI are retained in the manifest and UI.

Source: [CRACK-CH publisher record](https://zenodo.org/records/6516913).

**Weather:** Each live assessment requests a 72-hour modelled history and 48-hour forecast from Open-Meteo at the supplied coordinate. Rain totals, hourly values, provider grid coordinates and retrieval time are stored. A failed or incomplete provider response produces an actionable error; the operator can explicitly select manual totals. No default weather is silently substituted. Free API access is for non-commercial use; a commercial deployment must configure an appropriate service arrangement.

Sources: [Open-Meteo API documentation](https://open-meteo.com/en/docs), [service terms](https://open-meteo.com/en/terms).

**NASA contextual inventory:** A reproducible script downloaded the first 100 event polygons from the official COOLR service. This is a limited sample, not a complete or representative inventory. The original properties and inventory-specific citations remain in the GeoJSON. It is available for GIS research but does not feed the current warning calculation. Regional mapped events cannot supply matched mine-level non-events.

Source: [NASA COOLR event polygon service](https://gis.earthdata.nasa.gov/portal/rest/services/Landslides/COOLR_Events_Polygons/FeatureServer).

**Existing synthetic geotechnical CSV:** Its 200 balanced rows remain usable to reproduce the original XGBoost/SHAP demonstration. It contains no validated mine event horizon. Random-split accuracy of 1.0 is not evidence of field generalization; the classifier is excluded from block warning generation.

### Reviewed for later experiments

The source catalog also records ReachBot rock-crack segmentation, MRDataset rockfall object detection and SDNET2018 concrete cracks. They are not claimed as downloaded, integrated or used for training. ReachBot is the closest task match for annotated rock-face lines; its author release and reuse terms require review. MRDataset carries third-party image-right restrictions and a download requiring a separate provider. Concrete imagery has a substantial domain gap from mine rock.

Sources: [ReachBot authors' repository](https://github.com/JosselinSomervilleRoberts/ReachBot-Predictor), [MRDataset authors' repository](https://github.com/muranhb/MRDataset), [SDNET2018 publisher record](https://digitalcommons.usu.edu/all_datasets/48/).

## Current methods

### Image evidence

Uploads are decoded as JPEG/PNG with limits of 12 MB and 24 megapixels, a minimum dimension of 64 px, EXIF orientation correction and aspect-preserving resizing to a maximum of 1200 px. CLAHE, morphological black-hat filtering, thresholding and connected components identify candidate dark line regions. Size and elongation filters remove some noise. The output includes candidate boxes, a binary mask, image quality warnings and per-block line coverage.

The detector is a transparent OpenCV baseline, not a trained mine-crack segmentation network. Texture, seams, lighting and shadows can create false positives. No physical crack width, depth or opening rate is inferred. No image-quality score is presented as model confidence. A uniform dark/blank frame cannot be interpreted as confirmation that a wall is crack-free.

### Geotechnical screening

The FoS calculation is an illustrative infinite-slope Mohr-Coulomb balance:

```
sigma_n = gamma × H × cos(beta)^2
tau_drive = gamma × H × sin(beta) × cos(beta)
tau_resist = cohesion + sigma_n × (1 - pressure_ratio) × tan(phi)
FoS = tau_resist / tau_drive
```

H is vertical layer thickness, distinct from bench height. The input pressure ratio is defined here as pore pressure / total normal stress. This simplified scenario is not a rock-wedge or toppling calculation; actual joint geometry, persistence, support, seismic effects and dynamic loads require appropriate engineering analysis. The software does not derive cohesion or friction angle from a photograph.

### Block index and warning policy

Each image is divided into 2–10 rows and columns. Only the image contribution varies by block; geology and weather are shared within one assessment. At present the user should create separate assessments for differing geotechnical domains rather than imply different measurements across a single image.

The prototype index is the sum of explicit contributions:

```
line = min(1, candidate_line_coverage / 0.12)
rain = min(1, max(past_24h_mm, next_24h_mm) / 75)
antecedent = min(1, past_72h_mm / 150)
weather = 0.65 × rain + 0.35 × antecedent

index = 35 × line
      + 25 × (1 - SMR / 100)
      + 20 × weather
      + 10 × pressure_ratio
      + 10 × min(1, blast_vibration_mm_s / 10)
```

An index floor of 70 applies when illustrative FoS < 1 or SMR < 20; a floor of 40 applies when FoS < 1.3 or SMR < 40. Any added floor contribution is shown in the block explanation. The weights, rainfall scales, line-coverage scale and warning floors are configurable code policy, not empirically calibrated universal mine thresholds. The same inputs always produce the same screening result.

### Explainable modelling

Actual TreeSHAP values are calculated for the existing XGBoost model. They are signed log-odds contributions; sigmoid(base + contributions) reconciles with the model class score. They do not explain the independent block index or demonstrate causation. The block explanation shows the exact additive policy contributions instead. The paper comparison is `0.7 × model HIGH-class score + 0.3 × (100 - SMR)` and is excluded from warnings.

A separate image-feature XGBoost baseline was trained on CRACK-CH. The saved evaluated model was not refitted on its test site. On 36 held-out Naillac patches it obtained accuracy **0.4722**, balanced accuracy **0.4903** and ROC-AUC **0.5877**. This poor transfer result is visible in the app. Its whole-image score is an auxiliary research output, excluded from warning generation. The model is not a pixel-level crack detector.

### Spatial mapping and 3D

Ordinary photos support an image grid only. Geographic block polygons are produced only when the operator confirms a north-up orthorectified image and supplies ordered survey bounds. The software rejects invalid/inverted or excessive footprints. Leaflet overlays the processed image and block rectangles on OpenStreetMap; GeoJSON uses WGS84 longitude/latitude. The bounds are assumptions supplied by the operator, not automatically verified survey accuracy. Perspective camera views cannot be registered by merely entering their centre coordinate.

The current 3D viewer uses an actual USGS Bingham Canyon elevation surface and original Tongjiang UAV XYZ/RGB samples. It also accepts operator GeoTIFF/PLY surveys and public elevation requests. Source scale, sampling, epoch and datum limitations are displayed, and source-coordinate inspection and distance tools use the actual geometry. The earlier schematic is no longer the active viewer. See [real terrain implementation](REAL_TERRAIN.md) for acquisition checks, import contracts and measurement limits.

### Persistence and assessment guide

SQLite stores the version, input parameters, weather snapshot, image hash, processed overlays, block contributions, explanations and warnings. Parameter edits do not overwrite a saved assessment; the screen shows that a new run is needed. Acknowledgements persist with a timestamp and do not change hazard status. JSON, CSV and, when valid survey bounds exist, GeoJSON exports support external review.

The assessment guide answers questions using saved facts and deterministic response templates. It can explain a selected block, rainfall, SHAP, candidate lines, operational interpretation and inability to predict failure time. It is not represented as a general conversational LLM or a live sensor feed. No external language-model account or paid API key is required.

## Validation and remaining field work

The automated suite checks physical invariants, SMR orientation effects, threshold edges, SHAP additivity, synthetic-data provenance, image candidates, per-block variation, contribution sums, rain monotonicity, measured Jv, input rejection, weather outages, persistence, acknowledgement behavior and map/export bounds. Tests use temporary databases. A real browser assessment with the attributed image and live weather additionally verified the UI-to-API-to-database-to-output path. Details are recorded in `docs/VALIDATION.md`.

Before a mine trial, obtain engineer-reviewed images, candidate-line masks, physical joint measurements, surveyed block domains, sensor calibration information, timestamped rain and movement streams, and event/non-event windows with an explicit forecast horizon. Split by mine and time; avoid adjacent-image or overlapping-window leakage. Evaluate precision-recall, recall at false-alarm budgets, calibration and warning lead time, not accuracy alone. Record exposure and reporting bias, missed events and uncertain labels.

A deployed early-warning installation additionally needs a validated trigger action response plan, sensor/camera integration, freshness and outage handling, named-user authentication, access control, backups and an agreed notification process. Those site-specific integrations and certified predictions cannot be produced from the supplied synthetic CSV and one paper. This delivery is a runnable research implementation with explicit evidence limits.
