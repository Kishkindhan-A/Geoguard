# GeoGuard validation record

Validation date: 24 October 2026. Scope: local research implementation. Tests establish software behavior, not operational mine prediction skill.

## Automated tests

Command: `.venv\Scripts\python.exe -m unittest discover -s tests -v`

41 tests pass. They cover:

- FoS resisting/driving convention and pressure response.
- Published planar SMR orientation and excavation behavior.
- Screening-band boundaries and actual TreeSHAP probability reconciliation.
- Correct synthetic provenance for the bundled CSV.
- No manufactured candidates on a uniform image, candidate detection on a drawn line, spatially varying coverage and aspect-ratio preservation.
- Additive block-score reconciliation, adverse-FoS/SMR warning floors and missing research-model fallback.
- Monotonic rainfall exposure and exclusion of the synthetic classifier from warning calculations.
- Jv from supplied joint spacing.
- SQLite save/list/reload, CSV exports, valid GeoJSON coordinate order and prohibition of unregistered GeoJSON.
- Durable warning acknowledgements without reduction of hazard score.
- Invalid, oversized, non-finite, out-of-range and inconsistent inputs.
- Weather-service failure without invented weather.
- Saved-fact question responses, invalid block IDs and missing assessment IDs.

Tests create temporary databases; they do not populate operational history. The test stack emits upstream SHAP/Matplotlib and Starlette/httpx deprecation notices, which do not affect these results.

## Model benchmark

CRACK-CH archive MD5: `027ebd7aa3a7a2eec661b615ff862caf`.

Training: 24 Saint Nikolaos Fort patches. Evaluation: all 36 Naillac patches. The evaluated model was retained without training on the held-out site. Labels are image-level crack/no-crack annotations, not pixel masks.

| Metric | Value |
| --- | --- |
| Accuracy | 0.472222 |
| Balanced accuracy | 0.490260 |
| ROC-AUC | 0.587662 |
| True no-crack / false crack | 8 / 6 |
| Missed crack / true crack | 13 / 9 |

This small baseline fails to demonstrate reliable transfer to mine walls. Its output is excluded from warning generation. The existing geotechnical model's 1.0 random-split accuracy is explicitly associated with synthetic data, not field validation.

## Live data checks

- Open-Meteo successfully returned 72 history and 48 forecast hourly precipitation values for the study coordinate, with source and retrieval metadata. The snapshot is saved with the assessment rather than silently refreshed.
- NASA's official COOLR polygon endpoint returned 100 event features. The downloaded sample is checksum-recorded and retains original feature properties. It does not enter model training or warning inference.
- The publisher's CRACK-CH record and archive checksum were verified before training.

## Browser workflow

The local built application was opened in a browser. An attributed research sample was selected, live weather requested and the resulting assessment saved. Block selection changed the evidence breakdown; a failure-time question returned the documented limitation plus the saved forecast exposure window. Weather totals and the hourly forecast rendered. Warning acknowledgement persisted. The browser console reported no errors in these verified flows.

The primary interface supports a narrow in-app viewport and wider desktop layouts. The geographic view uses a location marker until surveyed bounds are supplied. Geographic export behavior is covered by API tests. The 3D view now renders real survey and elevation datasets; see the terrain upgrade checks below.

## Build and dependency checks

The TypeScript and Vite production build passes. The Three.js viewer is loaded only when its tab is used; its roughly 551 kB minified optional chunk produces a bundle-size advisory. Python sources compile. npm audit reports zero known vulnerabilities after compatible dependency updates and removal of unused Tailwind tooling.

## Real terrain upgrade checks

The suite now includes 15 terrain checks in addition to the 26 assessment checks. Tests verify reversible local render coordinates, metric distance preservation, original PLY RGB and XYZ retention, feet-to-metres conversion, embedded GeoTIFF CRS, analytic DEM gradients, NoData holes without connecting triangles, terrain catalogs and binary/source exports, malformed/unsupported uploads, bounded coordinates and providers, path identifiers, error handling without synthetic geometry, exact Terrarium decoding and rejection of Terrarium NoData sentinels.

Live source preparation verified the Tongjiang publisher MD5 and produced 900,000 original render samples from 3,066,639 source points. The USGS Bingham export produced 591,361 vertices and 1,179,648 triangles with valid elevation coverage. Aligned USGS/USDA orthoimagery was acquired separately and its temporal limits are recorded. A live global elevation request near Neyveli returned real regional elevations, approximately 37.5 m display sampling, and a reproducible GeoTIFF subset.

Browser checks loaded the textured Bingham mesh and coloured Tongjiang cloud, read source coordinates and elevation from a clicked surface point, and calculated a two-point 3D distance. The tested measurement showed 2,086.85 m straight-line distance and 2,072.74 m horizontal separation; these verify the interaction path and numerical calculation, not independent survey accuracy. The browser console showed no errors or warnings in these flows. Source dates and coordinate limitations were visibly labelled.

The old illustrative plane component remains as unused source history and is no longer the active 3D view. See [real terrain documentation](REAL_TERRAIN.md) for the exact acquisition and import contracts.

## Limits of verification

No annotated mine-wall segmentation evaluation, field sensor trial, time-separated failure-event evaluation, probability calibration or engineering certification was supplied or performed. Weather/API service availability and base-map tiles depend on external providers. Production authentication, multi-user authorization and automatic notification delivery are outside the local prototype. These results must not be represented as a measured rockfall forecasting accuracy.


# v3 release verification · 25 October 2026

The current release passes **58 automated tests**. TypeScript and the Vite production build pass. Full frontend npm audit reports **0 known vulnerabilities**. The installation doctor verifies all expected Python modules, model files, the build and every prepared terrain asset; its SQLite backup operation was exercised successfully.

New tests cover HTML report escaping, rejection of arbitrary remote image URLs, embedding saved PNG evidence, missing-report handling, restrictive report response headers, local-only readiness checks, absent AI credentials, actual AI status transitions and exhausted-credit errors. Existing assessment physics, image processing, SHAP additivity, persistence, weather validation and survey geometry tests still pass.

Browser verification used the installed app at 127.0.0.1:8051. A clearly labelled masonry/assumed-geology validation assessment produced 25 image blocks, index 58.4 maximum and illustrative FoS 1.35. The report showed the same saved values and embedded heatmap. Search located the saved record after service restart. Block A01 acknowledgement was saved without changing its warning score. Local SHAP answers and a live Open-Meteo retrieval for Bingham Canyon were checked. The 3D viewer loaded real Bingham geometry, the seven camera presets and zoom controls; the underneath preset was visually inspected. No ground grid was reintroduced.

Responsive review covers the normal narrow browser panel and a 1440 × 1000 desktop breakpoint; desktop document width did not exceed viewport client width. Mobile navigation includes visible labels. The viewport override was temporary. A historical Vite websocket/import error was caused by restarting the local development service during verification; a workspace recovery boundary now provides a reload screen. The Three.js deprecated soft-shadow setting was replaced with the supported PCF setting.

The optional OpenAI key is configured but the prior live request returned credit_balance_exhausted. No additional paid AI request was made in this release verification. AI response parsing and failure modes are mock-tested; a successful paid provider response is not claimed. Field predictive accuracy, current survey accuracy and autonomous mine safety clearance are outside this software verification.

The earlier evidence below records prior releases and is retained for provenance.

