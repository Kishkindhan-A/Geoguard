# Geotechnical Sensor Data
#
# Place your CSV file as: data/geotechnical_sensors.csv
#
# Required columns:
#   rainfall_mm      – Rainfall intensity (mm/hr)
#   piezometer_ru    – Pore-pressure ratio (0–1)
#   tilt_degrees     – Tiltmeter reading (degrees)
#   rmr_basic        – Basic Rock Mass Rating (0–100)
#   slope_angle      – Slope face angle (degrees)
#   jv_density       – Joint Volumetric density (joints/m³)
#   failure_risk     – Target label: 0 = Low, 1 = Medium, 2 = High
#
# Example row:
#   45.2,0.38,3.1,62,42,18,1

Important:
This is a SYNTHETIC dataset created for prototyping, model development,
UI/demo work, and testing. It is not a substitute for real mine survey,
LiDAR, photogrammetry, geotechnical measurements, or certified safety data.

3D terrain asset:
The 3D viewer includes the KaggleHub dataset sc0v1n0/3d-models, asset
3d_samples/ateneam.obj, bundled at bench-core-dashboard/public/models/ateneam.obj.
It is used as a real geometry source for the interactive 3D heightfield. The
dataset has no mine-risk labels, so it is not used to train a 3D risk model.

3D converter model:
Run `python scripts/train_3d_converter.py` to train the self-supervised
heightfield prior and regenerate `bench-core-dashboard/public/models/terrain_converter.json`.
The converter learns geometry reconstruction from the OBJ/TRI samples; it is
not an image-to-geospatial-mesh model because the Kaggle data has no paired
camera images or survey coordinates.
