/** Zod schemas for runtime validation of API responses */
import { z } from 'zod/v4';

export const SpotInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  facing: z.number(),
  description: z.string(),
});

export const SpotListResponseSchema = z.object({
  spots: z.array(SpotInfoSchema),
});

export const ComponentScoresSchema = z.object({
  swell_quality: z.number(),
  swell_direction: z.number(),
  period: z.number(),
  spectral_purity: z.number(),
  wind: z.number(),
  wind_trend: z.number(),
  tide: z.number(),
  tide_bathy_interaction: z.number(),
  consistency: z.number(),
});

export const RawConditionsSchema = z.object({
  wave_height: z.number().nullable(),
  wave_period: z.number().nullable(),
  wave_direction: z.number().nullable(),
  swell_height: z.number().nullable(),
  swell_period: z.number().nullable(),
  swell_direction: z.number().nullable(),
  wind_speed: z.number().nullable(),
  wind_direction: z.number().nullable(),
  tide_height: z.number().nullable(),
});

export const ForecastSlotSchema = z.object({
  time: z.string(),
  total_score: z.number(),
  rating: z.string(),
  components: ComponentScoresSchema,
  conditions: RawConditionsSchema,
  summary: z.string(),
});

export const SpotForecastResponseSchema = z.object({
  spot: SpotInfoSchema,
  forecast: z.array(ForecastSlotSchema),
});

export const SpotSnapshotSchema = z.object({
  spot: SpotInfoSchema,
  time: z.string(),
  total_score: z.number(),
  rating: z.string(),
  summary: z.string(),
});

export const CurrentConditionsSchema = z.object({
  spots: z.array(SpotSnapshotSchema),
  updated_at: z.string(),
});

export const BestWindowSchema = z.object({
  spot: SpotInfoSchema,
  start: z.string(),
  end: z.string(),
  peak_score: z.number(),
  avg_score: z.number(),
  rating: z.string(),
  summary: z.string(),
});

export const BestWindowsResponseSchema = z.object({
  windows: z.array(BestWindowSchema),
});

export const TokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string(),
});
