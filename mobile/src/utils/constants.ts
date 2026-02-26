/** Rating thresholds — maps total_score (0-10) to human label */
export const RATING_THRESHOLDS = [
  { max: 2, label: 'flat', key: 'flat' },
  { max: 4, label: 'poor', key: 'poor' },
  { max: 5.5, label: 'fair', key: 'fair' },
  { max: 7, label: 'good', key: 'good' },
  { max: 8.5, label: 'great', key: 'great' },
  { max: 10, label: 'epic', key: 'epic' },
] as const;

/** Nortada wind trend threshold — below this shows warning */
export const NORTADA_THRESHOLD = 0.3;

/** API auto-refresh interval (ms) */
export const REFETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes

/** API base URL — override with EXPO_PUBLIC_API_URL env var */
export const DEFAULT_API_URL = 'http://localhost:8000';

/** Compass directions for wind/swell display */
export const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE',
  'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW',
  'W', 'WNW', 'NW', 'NNW',
] as const;
