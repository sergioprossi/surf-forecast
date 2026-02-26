/** TypeScript types mirroring backend Pydantic schemas */

export interface SpotInfo {
  id: string;
  name: string;
  lat: number;
  lon: number;
  facing: number;
  description: string;
}

export interface SpotListResponse {
  spots: SpotInfo[];
}

export interface ComponentScores {
  swell_quality: number;
  swell_direction: number;
  period: number;
  spectral_purity: number;
  wind: number;
  wind_trend: number;
  tide: number;
  tide_bathy_interaction: number;
  consistency: number;
}

export interface RawConditions {
  wave_height: number | null;
  wave_period: number | null;
  wave_direction: number | null;
  swell_height: number | null;
  swell_period: number | null;
  swell_direction: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
  tide_height: number | null;
}

export interface ForecastSlot {
  time: string;
  total_score: number;
  rating: string;
  components: ComponentScores;
  conditions: RawConditions;
  summary: string;
}

export interface SpotForecastResponse {
  spot: SpotInfo;
  forecast: ForecastSlot[];
}

export interface SpotSnapshot {
  spot: SpotInfo;
  time: string;
  total_score: number;
  rating: string;
  summary: string;
}

export interface CompareResponse {
  time: string;
  spots: SpotSnapshot[];
}

export interface BestWindow {
  spot: SpotInfo;
  start: string;
  end: string;
  peak_score: number;
  avg_score: number;
  rating: string;
  summary: string;
}

export interface BestWindowsResponse {
  windows: BestWindow[];
}

export interface CurrentConditions {
  spots: SpotSnapshot[];
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface SessionFeedbackCreate {
  spot_id: string;
  session_time: string;
  actual_rating: number;
  notes?: string;
}

export interface SessionFeedbackResponse {
  id: number;
  spot_id: string;
  session_time: string;
  predicted_score: number | null;
  actual_rating: number;
  notes: string | null;
}
