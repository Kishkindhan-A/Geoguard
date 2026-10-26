export interface TerrainDataset {
  id: string;
  name: string;
  kind: "surface" | "pointcloud";
  source: string;
  source_url?: string;
  license?: string;
  created_at: string;
  acquisition_date?: string | null;
  georeferenced: boolean;
  crs?: string | null;
  point_count: number;
  source_point_count?: number;
  triangle_count: number;
  units: string;
  origin: { easting: number; northing: number; elevation: number };
  extent_m: { width: number; depth: number; relief: number };
  elevation_m: { min: number; max: number };
  grid?: {
    rows: number;
    cols: number;
    spacing_x_m: number;
    spacing_y_m: number;
    valid_fraction: number;
  };
  bounds?: { west: number; south: number; east: number; north: number };
  assets: {
    positions: string;
    colors?: string;
    indices?: string;
    slope?: string;
    texture?: string;
  };
  source_resolution_note?: string;
  vertical_datum?: string;
  limitations: string[];
  imagery?: {
    source: string;
    attribution: string;
    epoch: string;
    note: string;
  };
  slope_degrees?: { median: number; p95: number; meaning: string };
}
export type TerrainMode = "survey" | "elevation" | "slope";
export type TerrainTool = "orbit" | "inspect" | "measure";
export interface SurveyPoint {
  x: number;
  y: number;
  z: number;
  slope?: number;
}
export interface TerrainMeasurement {
  points: SurveyPoint[];
  distance?: number;
  horizontal?: number;
  inclination?: number;
}

export type TerrainView =
  "oblique" | "top" | "front" | "back" | "left" | "right" | "bottom";
