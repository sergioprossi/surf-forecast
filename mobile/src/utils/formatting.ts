import { colors } from '../theme/colors';
import { COMPASS_POINTS, NORTADA_THRESHOLD, RATING_THRESHOLDS } from './constants';

/** Map a score (0-10) to a rating label */
export function scoreToRating(score: number): string {
  for (const t of RATING_THRESHOLDS) {
    if (score < t.max) return t.label;
  }
  return 'epic';
}

/** Map a score (0-10) to a color hex string */
export function scoreToColor(score: number): string {
  if (score >= 8.5) return colors.scoreEpic;
  if (score >= 7) return colors.scoreGreat;
  if (score >= 5.5) return colors.scoreGood;
  if (score >= 4) return colors.scoreFair;
  if (score >= 2) return colors.scorePoor;
  return colors.scoreFlat;
}

/** Convert degrees (0-360) to 16-point compass direction */
export function degreeToCompass(deg: number | null | undefined): string {
  if (deg == null) return '--';
  const normalized = ((deg % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return COMPASS_POINTS[index];
}

/** Format wave height with unit */
export function formatWaveHeight(meters: number | null | undefined): string {
  if (meters == null) return '--';
  return `${meters.toFixed(1)}m`;
}

/** Format wind speed with unit */
export function formatWindSpeed(kmh: number | null | undefined): string {
  if (kmh == null) return '--';
  return `${Math.round(kmh)} km/h`;
}

/** Format period with unit */
export function formatPeriod(seconds: number | null | undefined): string {
  if (seconds == null) return '--';
  return `${Math.round(seconds)}s`;
}

/** Check if nortada warning should be shown */
export function isNortadaWarning(windTrend: number | null | undefined): boolean {
  if (windTrend == null) return false;
  return windTrend < NORTADA_THRESHOLD;
}

/** Format score to 1 decimal */
export function formatScore(score: number): string {
  return score.toFixed(1);
}

/** Format hour from ISO string (e.g. "14:00") */
export function formatHour(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}
