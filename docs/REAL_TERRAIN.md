# Real mine terrain

The active 3D viewer now uses actual elevation rasters and measured point clouds. It no longer builds a generic inclined plane from a slope-angle slider. All visible geometry comes from the selected dataset; no single-image depth estimates, procedural hills or arbitrary mesh templates are substituted.

## Prepared mine examples

### Bingham Canyon Utah

The prepared dataset is a 5 km square export from the [USGS 3DEP elevation service](https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer), centred at latitude 40.523, longitude −112.151. It is reprojected into WGS84 UTM zone 12N, EPSG:32612. The display has 591,361 elevation samples and 1,179,648 triangles, about 6.50 m sampling, and approximately 1,360 m of relief. These are measured values of the prepared subset, not claims about current mine dimensions.

Recent USGS 1 m products were investigated. The 2023 Salt Lake County tile has only about 9% valid coverage over the tested mine crop; the 2018 and 2013 tiles do not cover that crop. Consequently, this application uses the available multi-resolution elevation service instead. It does **not** describe the rendered mine as a complete current 1 m LiDAR survey. Export sampling and native data resolution are different concepts. Underlying elevation dates, vertical datum and resolution vary and must be verified before engineering use.

The photo layer is from the [USDA/USGS National Map orthoimagery service](https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer). It is exported into the exact projected pixel-centre footprint of the DEM. The service description lists CONUS NAIP imagery from 2017–2021; a site-specific acquisition date is unverified. Imagery and geometry can be from different epochs. Photo alignment does not establish a current survey or change elevation samples.

Attribution: elevation data courtesy of the U.S. Geological Survey; USDA, USGS The National Map: Orthoimagery. The prepared raster and metadata are retained locally for reproduction.

### Tongjiang limestone quarry China

The [Tongjiang Aerial Dataset](https://zenodo.org/records/15614501), DOI 10.5281/zenodo.15614501, is attributed to Huifu Chen, Yixuan Fang and Jiasui Zhang under CC BY 4.0. The authors describe a UAV survey acquired on 21 May 2025, processed with DJI Terra using onboard RTK without ground control points. Original RGB values are preserved.

The downloaded `panorama_1cloud.ply` has 3,066,639 vertices. A deterministic selection retains 900,000 original XYZ/RGB samples for browser rendering. No new surface points are created. The browser subset spans about 648 × 1,172 coordinate metres with approximately 263 m of local Z variation. The release does not publish a usable absolute CRS or vertical datum, so it is labelled local XYZ and cannot be geographically overlaid automatically. Local Z values are not represented as elevation above sea level.

Publisher MD5: `f448d60625e3740ba78fa56b6634648b`. Downloaded source SHA256: `fa345ca483276c69574f15180518f7f4049edce8196d53992eb18334d266197d`. The original file remains available for download, alongside display binaries and provenance metadata.

## Preparing the examples

```powershell
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe scripts\prepare_real_terrain.py
```

Preparation downloads the approximately 46 MB public Tongjiang PLY, verifies its publisher checksum, generates rendering binaries, and requests the Bingham DEM and orthoimage. Existing completed datasets are reused. Options `--source tongjiang` and `--source bingham` prepare one source. No account, payment or API key is required for these sources.

Files live in `data/terrain/<dataset-id>/` by default. `GEOGUARD_TERRAIN_PATH` changes the store location. Large survey files are ignored by Git and must be reproduced with the preparation script when copying the source repository to another computer.

## Viewer controls

- **Dataset:** switch between prepared examples, public terrain and imported surveys.
- **Orthoimagery / Survey RGB:** use the real photo layer or the original point colours when available. A surface without imagery uses elevation shading.
- **Elevation:** colour measured heights for visual inspection.
- **Slope angle:** colour DEM gradients at the displayed sampling. It is disabled for point clouds; no unsupported surface-normal estimate is invented.
- **Orbit, pan and zoom:** drag, right-drag and scroll. Top-down and front presets are available.
- **Inspect:** click measured geometry for source coordinates and Z. DEM slope readings refer to a nearby display vertex.
- **Measure:** click two visible points to obtain straight-line 3D distance, horizontal separation and inclination. A third click starts a new measurement.
- **Grid / wireframe / point size:** inspect the rendered structure. The grid is a scale aid, not an additional surveyed surface.

Vertical exaggeration is fixed at 1:1. XYZ is centred before conversion to Float32 so large eastings/northings do not cause browser precision loss. Render X is east/local X, render Y is height, and render Z is south/local −Y. Adding the recorded origin recovers source coordinates. Numerical decimal display is not an accuracy statement; resolution, survey method, datum and source accuracy limit all measurements. A chord distance is not a terrain-following travel distance.

## Importing your own mine

Choose a survey name and source units, then import a file up to 256 MB:

**GeoTIFF DEM:** a single elevation band with an embedded coordinate reference system, at least 3 × 3 pixels, and a mine-scale area smaller than 0.3 degrees per side. The raster is reprojected to a local UTM coordinate system and sampled to at most 769 × 769 points for rendering. Horizontal units come from the CRS; the selected m/ft setting controls vertical conversion. Supported local UTM latitude range is 80°S to 84°N. Missing elevations remain holes in the mesh; triangles touching NoData are omitted. A DEM is a 2.5D surface and cannot represent overhangs or multiple surfaces at one XY coordinate.

**PLY point cloud:** Z-up XYZ vertices with optional red/green/blue properties. Binary and ASCII PLY are supported. Files declaring more than 15 million vertices are rejected. Imported point clouds preserve measured points and are thinned deterministically when needed. The selected units apply to XYZ; feet are converted using 0.3048. A PLY with no published CRS remains a local-coordinate dataset, regardless of how realistic it looks.

Use LiDAR, UAV photogrammetry or a surveyed mesh export from a professional acquisition workflow. One ordinary photograph does not determine a metrically accurate 3D wall, its hidden surfaces or absolute scale. This application deliberately does not turn brightness into invented depth.

## Public terrain for other locations

Enter latitude, longitude, area width and a provider in **Public elevation**:

**USGS 3DEP:** United States coverage. The service may blend sources of different dates and resolutions. A smaller export grid spacing does not establish higher source accuracy.

**Mapzen Terrain Tiles on AWS:** global regional context using public Terrarium elevation tiles, decoded as `R × 256 + G + B / 256 − 32768`. Source agencies, resolution and dates vary. Samples are projected to a local UTM grid. A prepared test near Neyveli has about 37.5 m display sampling, which is suitable for regional context but cannot resolve individual cracks and may not resolve benches. Source data may predate excavation.

Attribution: Mapzen and the contributing agencies listed in the [Terrain Tiles attribution document](https://github.com/tilezen/joerd/blob/master/docs/attribution.md). [AWS registry and access information](https://registry.opendata.aws/terrain-tiles/). Public terrain failure raises an error; no synthetic replacement is generated. The derived elevation subset can be downloaded as GeoTIFF.

## Assessment registration

Terrain and image assessments remain separate until their spatial relationship is established. This version does not drape an unrelated rock photograph's warning grid onto Bingham Canyon or another public dataset. A valid integration needs an appropriate survey CRS, up-to-date geometry, georeferenced imagery or calibrated camera poses, and a verified mapping from image pixels to surface coordinates. Risk colours and slope-angle colours have different meanings and are not interchangeable.

## API

| Route | Purpose |
| --- | --- |
| `GET /api/terrain` | List completed datasets and metadata |
| `GET /api/terrain/{id}` | Full provenance, geometry counts and asset URLs |
| `GET /api/terrain/{id}/assets/{filename}` | Allowlisted binary rendering assets |
| `GET /api/terrain/{id}/source` | Download the original PLY or source elevation subset |
| `POST /api/terrain/import` | Multipart file, survey name and m/ft units |
| `POST /api/terrain/public` | Validated coordinate, width and provider request |

The service runs locally with no external accounts. It remains a research/engineering review tool rather than a certified mine monitoring system.
