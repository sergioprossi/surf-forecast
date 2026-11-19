/** Pure helpers for the Compare screen (kept out of the component for testing). */
import type { ComponentScores, RawConditions, SpotSnapshot } from '../api/types';
import { degreeToCompass, formatPeriod, formatWaveHeight, formatWindSpeed } from './formatting';

export interface TimeOption {
  /** UTC ISO timestamp on the hour, or null for "now" (server picks current hour) */
  value: string | null;
  label: string;
  sublabel: string;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Build selectable compare times: "Now", then every `stepHours` for `spanHours`.
 * Hours are aligned to the step in local time (e.g. 09:00, 12:00, 15:00) so the
 * chips read naturally. Values are UTC ISO strings for the API.
 */
export function buildTimeOptions(now: Date, stepHours = 3, spanHours = 48): TimeOption[] {
  const options: TimeOption[] = [{ value: null, label: 'Now', sublabel: formatClock(now) }];

  const first = new Date(now);
  first.setMinutes(0, 0, 0);
  // Next local hour strictly after now that is a multiple of the step
  do {
    first.setTime(first.getTime() + HOUR_MS);
  } while (first.getHours() % stepHours !== 0);

  const end = now.getTime() + spanHours * HOUR_MS;
  for (let t = first.getTime(); t <= end; t += stepHours * HOUR_MS) {
    const d = new Date(t);
    options.push({ value: d.toISOString(), label: formatClock(d), sublabel: dayLabel(d, now) });
  }
  return options;
}

function formatClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:00`;
}

function dayLabel(d: Date, now: Date): string {
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(d) - startOfDay(now)) / (24 * HOUR_MS));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', { weekday: 'short' });
}

/** Sort snapshots best-first; ties broken by spot name for a stable order. */
export function rankSnapshots(snapshots: SpotSnapshot[]): SpotSnapshot[] {
  return [...snapshots].sort(
    (a, b) => b.total_score - a.total_score || a.spot.name.localeCompare(b.spot.name),
  );
}

export interface MetricRow {
  key: string;
  label: string;
  /** Formatted value per spot, in the same order as the snapshots passed in */
  values: string[];
  /** Index of the spot whose component score is best for this metric, or null */
  bestIndex: number | null;
}

interface MetricDef {
  key: string;
  label: string;
  component: keyof ComponentScores;
  format: (c: RawConditions) => string;
}

const METRICS: MetricDef[] = [
  {
    key: 'swell',
    label: 'Swell',
    component: 'swell_quality',
    format: (c) => formatWaveHeight(c.swell_height ?? c.wave_height),
  },
  {
    key: 'period',
    label: 'Period',
    component: 'period',
    format: (c) => formatPeriod(c.swell_period ?? c.wave_period),
  },
  {
    key: 'direction',
    label: 'Swell dir',
    component: 'swell_direction',
    format: (c) => degreeToCompass(c.swell_direction ?? c.wave_direction),
  },
  {
    key: 'wind',
    label: 'Wind',
    component: 'wind',
    format: (c) =>
      c.wind_speed == null
        ? '--'
        : `${formatWindSpeed(c.wind_speed)} ${degreeToCompass(c.wind_direction)}`,
  },
  {
    key: 'tide',
    label: 'Tide',
    component: 'tide',
    format: (c) => (c.tide_height == null ? '--' : `${c.tide_height.toFixed(1)}m`),
  },
];

/**
 * Side-by-side metric rows. "Best" is judged by the scoring engine's component
 * score (0-1) rather than the raw number — bigger waves or more wind aren't
 * automatically better. No highlight when there's a tie for best or < 2 spots.
 */
export function buildMetricRows(snapshots: SpotSnapshot[]): MetricRow[] {
  return METRICS.map((m) => {
    const values = snapshots.map((s) => (s.conditions ? m.format(s.conditions) : '--'));
    const scores = snapshots.map((s) => s.components?.[m.component] ?? null);
    return { key: m.key, label: m.label, values, bestIndex: uniqueMaxIndex(scores) };
  });
}

export function uniqueMaxIndex(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v != null);
  if (present.length < 2) return null;
  const max = Math.max(...present);
  const hits = values.filter((v) => v === max).length;
  return hits === 1 ? values.indexOf(max) : null;
}
