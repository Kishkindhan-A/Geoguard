export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}
export type Status = "NORMAL" | "WARNING" | "CRITICAL";
export interface Block {
  id: string;
  row: number;
  col: number;
  score: number;
  status: Status;
  color: string;
  line_coverage: number;
  candidate_ids: number[];
  pixel_bounds: number[];
  bounds?: Bounds;
  contributions: { factor: string; points: number; weight: number | null }[];
}
export interface Parameters {
  site_name: string;
  latitude: number;
  longitude: number;
  weather_mode: "live" | "manual";
  past_24h_mm: number;
  past_72h_mm: number;
  next_24h_mm: number;
  slope_angle: number;
  slope_direction: number;
  joint_dip: number;
  joint_direction: number;
  rmr: number;
  joint_spacings: number[];
  excavation: string;
  bench_height: number;
  layer_thickness: number;
  friction_angle: number;
  cohesion: number;
  unit_weight: number;
  pore_pressure_ratio: number;
  blast_vibration: number;
  weathering_index: number;
  grid_size: number;
  bounds: Bounds | null;
  orthorectified: boolean;
}
export interface Summary {
  score: number;
  status: Status;
  normal: number;
  warning: number;
  critical: number;
}
export interface Saved {
  id: string;
  site_name: string;
  created_at: string;
  summary: Summary;
}
export interface Assessment extends Saved {
  parameters: Parameters;
  blocks: Block[];
  grid: number[][];
  georeferenced: boolean;
  alerts: {
    block_id: string;
    status: Status;
    score: number;
    message: string;
    acknowledged: boolean;
    acknowledged_at?: string;
  }[];
  overlays: { heatmap: string; cracks: string; mask: string };
  image: { width: number; height: number; quality_warnings: string[] };
  cracks: {
    count: number;
    line_coverage: number;
    transfer_classifier: {
      available: boolean;
      crack_class_score?: number;
      note?: string;
    };
  };
  fos: {
    value: number;
    method: string;
    resisting_kpa: number;
    driving_kpa: number;
  };
  smr: { score: number; f1: number; f2: number; f3: number; f4: number };
  jv: { value: number; source: string; units: string };
  weather: {
    source: string;
    mode: string;
    retrieved_at?: string;
    past_24h_mm: number;
    past_72h_mm: number;
    next_24h_mm: number;
    attribution: string;
    forecast: { time: string; rain_mm: number; temperature_c: number | null }[];
  };
  peak_weather_window: {
    start: string;
    end: string;
    rain_mm: number;
    meaning: string;
  } | null;
  model: {
    available: boolean;
    score?: number;
    shap_base_value?: number;
    training_source: string;
    shap: { feature: string; input: number; value: number }[];
    shap_units?: string;
    raw_margin?: number;
  };
  paper_hybrid_score: number | null;
  paper_hybrid_note: string;
  limitations: string[];
}
export interface Research {
  datasets: {
    name: string;
    url: string;
    purpose: string;
    status: string;
    license: string;
    limitation: string;
  }[];
  crack_benchmark: {
    samples: number;
    train_count: number;
    test_count: number;
    accuracy: number;
    balanced_accuracy: number;
    roc_auc: number;
    split: string;
    limitations: string[];
  } | null;
}
