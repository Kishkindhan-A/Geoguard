# GeoGuard v3 — local release and research audit

Reviewed 25 October 2026. This audit extends the supplied conference paper review in RESEARCH_AND_IMPLEMENTATION.md. Sources were selected for authority and relevance; this is not a claim to have examined every website.

## What this release is ready for

The installed application supports a complete local research workflow: choose a site, inspect real terrain, upload a slope image, supply geology, retrieve modelled weather or enter measured rainfall, compute block screening indices, inspect explanations, save results, review warnings, and export evidence. It is not a validated autonomous mine early-warning system. That distinction follows the data actually available, rather than the appearance of the dashboard.

The original blue/white/slate identity is restored with responsive navigation, larger mobile controls, a workspace overview, consistent source labels and semantic red/amber/green status bands. All numbers in the overview come from stored assessments or installed assets. There is no fabricated monitoring history.

## Evidence review and resulting decisions

| Topic | Primary source | Finding used in the project |
|---|---|---|
| Mine ground control | [NIOSH, Mining and Ground Falls](https://www.cdc.gov/niosh/mining/topics/ground-falls.html) | Large mine slopes can fail with little warning and geology-specific engineering matters. The application does not issue safety clearance or claim failure-time prediction. |
| Monitoring practice | [NIOSH Mine Slope and Subsidence Monitoring partnership](https://www.cdc.gov/niosh/mining/partnerships/mssm.html) | Early instability detection is a monitoring and validation problem. Current point-in-time imagery and weather cannot replace displacement monitoring. |
| Current weather and recent history | [Open-Meteo forecast documentation](https://open-meteo.com/en/docs?past_days=1) | Current conditions are model output; past_days accesses recent model/archived forecast data. They are not rain-gauge observations. History and forecast windows, UTC validity and retrieval times are retained. |
| Terrain | [USGS 3DEP standards](https://www.usgs.gov/3d-elevation-program-standards-and-specifications) | DEM, lidar, survey date and source specifications must be distinguished. Export spacing is not proof of source accuracy. Bingham is historical terrain; no centimetre crack geometry is claimed. |
| Explainability | [SHAP TreeExplainer reference](https://shap.readthedocs.io/en/latest/generated/shap.TreeExplainer.html) | Raw XGBoost binary output is log-odds; base plus attributions must match the raw margin. These attributions are separated from exact deterministic block contributions. |
| 3D crack research | [Azhari et al., PointCrack3D](https://arxiv.org/abs/2111.11615) | Coloured lidar and point density can support crack-instance detection in unstructured rock. Its reported performance belongs to the paper; no such accuracy is assigned to this app or its coarser public terrain. Research candidate only. |
| Dynamic rockfall detection | [Huang et al., Scientific Reports, 2026](https://www.nature.com/articles/s41598-026-49008-x) | The study uses temporal motion, detection and tracking with PTZ cameras and real/simulated events. This is a different task from predicting failure from a single still image. Not implemented or benchmarked here. |
| Mine-specific crack data | [ScienceDB open-pit coal mine slope crack dataset](https://www.scidb.cn/en/detail?dataSetId=977527978dbe44bf9dc81bd07446b008) | A relevant catalog entry was discovered. Full metadata, files and licence could not be independently established in this review, so it is not downloaded, relabelled as training data or used for accuracy claims. |
| Natural-stone imagery | [CRACK-CH](https://zenodo.org/records/6516913) | Existing CC BY source remains downloaded and checksum verified. The held-out transfer benchmark is weak and remains excluded from block warning generation. |
| Real quarry point cloud | [Tongjiang UAV dataset](https://zenodo.org/records/15614501) | Existing acquired XYZ/RGB is rendered directly; local coordinate/datum limitations remain visible. |

Publisher access to the 2024 regression-based mine rockfall paper (ScienceDirect S1365160924000923) returned 403. Its search abstract mentions simulated trajectories and highwall photogrammetry; we did not treat inaccessible full text as verified evidence or obtain its dataset. The WorkSafe chapter could not be fetched in this review and is not used to establish a numerical rule. No new model was trained from search snippets, fabricated negatives or unlicensed downloads.

## Completed workflow changes

- Bingham Canyon is the default active site. The shared site toolbar drives assessment coordinates and the initial weather query. Choosing another site clears old image registration bounds; it does not georeference a photograph.
- A georeferenced 3D survey can explicitly supply its location to weather and assessment inputs. XYZ-only imports cannot invent latitude/longitude.
- Real terrain retains full rotation, transparent illustrative sides, no ground grid, true vertical scale, cursor zoom, larger zoom range, dedicated zoom buttons, fullscreen and seven camera presets.
- The Weather tab provides direct retrieval without a photo, recent precipitation totals, a 48-hour chart/table, current model conditions and source/validity times. Saved assessment weather remains immutable.
- History can be searched by site/record and filtered by status. Saved evidence exports to JSON, CSV, registered GeoJSON or a self-contained printable report.
- Reports escape operator text, allow only saved PNG evidence, include input parameters, screening gates, warning review timestamps, weather provenance, SHAP units and limitations. Printing does not make another AI or weather call.
- AI configuration shows key presence separately from verified requests and provider errors. A user-initiated small connection test is available; opening a page does not spend credits. Local explanations work without paid AI access.
- The installed OpenAI key remains in ignored .env.local. It was previously rejected with credit_balance_exhausted. Payment/credits must be supplied by the account owner; this release does not bypass quota.
- Installation checks and consistent SQLite backups are available through scripts/doctor.py.

## Conditions still needed for field deployment

A current georeferenced survey, camera/surface registration and calibrated scale are necessary to place image findings onto terrain. Mine-specific labelled image masks and non-events must be collected with site/time-held-out evaluation before a crack model can support warnings. Measured deformation, crack opening, rainfall, pore pressure and blast histories need timestamps, calibration, data-quality handling and event labels. Local threshold/TARP approval, monitored false-alarm and missed-event rates, responsible response procedures and controlled multi-user access are separate deployment requirements.

The present infinite-slope calculation does not perform wedge/toppling/rockfall-runout analysis. All image blocks share operator geology and weather; the spatial variation is in image evidence. Research weights and gates are not calibrated event probabilities. Neither an LLM explanation nor a prettier heatmap supplies missing physical measurements.

## Verification evidence

See VALIDATION.md for the final test count and browser evidence. Verification covers the local software and its data flow, not field predictive accuracy.
