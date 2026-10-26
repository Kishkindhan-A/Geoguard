# Field data contract

Collect synchronized, engineer-reviewed observations before training operational models. Store all timestamps as ISO 8601 UTC and preserve raw readings and calibration metadata.

| Dataset | Required fields | Notes |
| --- | --- | --- |
| Sites | site_id, mine_name, country, coordinate_reference_system | Separate stable identifiers from display names. |
| Blocks | site_id, block_id, geometry, survey_date, survey_method | Use surveyed polygons; register wall-camera views with calibrated control points. |
| Images | image_id, site_id, captured_at, camera_id, sha256, image_path, exposure, registration_version | Retain sequences and site grouping to avoid train/test leakage. |
| Crack annotations | image_id, annotation_version, mask_path, annotator, review_status | Separate cracks from bedding, seams, shadows, vegetation and non-rock regions. Include clear negatives. |
| Geology | block_id, measured_at, rmr_basic, joint_set_id, dip_deg, dip_direction_deg, spacing_m, persistence_m, cohesion_kpa, friction_angle_deg, unit_weight_kn_m3 | Store measurement method and uncertainty. Do not infer physical dimensions from uncalibrated pixels. |
| Sensors | block_id, timestamp, sensor_id, parameter, value, units, quality_flag, calibration_id | Parameters may include rain, pore pressure, displacement, crack opening and blast PPV. |
| Events | site_id, block_id, onset_start, onset_end, observed_volume_m3, source, reviewer, confidence | Preserve uncertain intervals and delayed reports; absence of a report is not a verified negative. |
| Forecast labels | site_id, block_id, issue_time, horizon_hours, event_within_horizon, observation_complete | Construct negatives only from monitored exposure periods. |

Use data available at forecast issue time. Retrospective rainfall analyses must not be substituted for forecasts that were actually available then. Freeze site/time-separated evaluation sets before model selection. Keep related frames, patches and event windows in the same split. Record event prevalence and missed-monitoring periods.

The current API accepts one image plus a documented parameter snapshot. It does not claim direct live sensor integration. Cameras or ingestion services can submit repeated snapshots through `/api/assessments`; the local UI is a snapshot review tool rather than a sensor broker.
