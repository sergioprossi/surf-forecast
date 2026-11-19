import type { SpotSnapshot } from '../src/api/types';
import { buildMetricRows, buildTimeOptions, rankSnapshots, uniqueMaxIndex } from '../src/utils/compare';

const comps = (over: Partial<Record<string, number>> = {}) => ({
  swell_quality: 0.5, swell_direction: 0.5, period: 0.5, spectral_purity: 0.5, wind: 0.5,
  wind_trend: 0.5, tide: 0.5, tide_bathy_interaction: 0.5, consistency: 0.5, ...over,
});
const conds = (over: Record<string, number | null> = {}) => ({
  wave_height: 1.2, wave_period: 10, wave_direction: 290, swell_height: 1.4, swell_period: 12,
  swell_direction: 285, wind_speed: 10, wind_direction: 90, tide_height: 2.1, ...over,
});
function snap(id: string, name: string, score: number, extra: Partial<SpotSnapshot> = {}): SpotSnapshot {
  return {
    spot: { id, name, lat: 0, lon: 0, facing: 270, description: '' },
    time: '2026-11-18T09:00:00Z', total_score: score, rating: 'good', summary: '', ...extra,
  };
}

describe('buildTimeOptions', () => {
  test('starts with Now and a null value', () => {
    const opts = buildTimeOptions(new Date(2026, 10, 18, 10, 25));
    expect(opts[0]).toEqual({ value: null, label: 'Now', sublabel: '10:00' });
  });

  test('aligns to the next step boundary in local time', () => {
    const opts = buildTimeOptions(new Date(2026, 10, 18, 10, 25), 3, 12);
    expect(opts.slice(1).map((o) => o.label)).toEqual(['12:00', '15:00', '18:00', '21:00']);
  });

  test('skips the current hour even when already on a boundary', () => {
    const opts = buildTimeOptions(new Date(2026, 10, 18, 12, 0), 3, 6);
    expect(opts[1].label).toBe('15:00');
  });

  test('values are UTC ISO strings on the hour', () => {
    const opts = buildTimeOptions(new Date(2026, 10, 18, 10, 25));
    for (const o of opts.slice(1)) {
      expect(o.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z$/);
    }
  });

  test('labels Today, Tomorrow, then weekday', () => {
    const opts = buildTimeOptions(new Date(2026, 10, 18, 22, 0), 3, 48);
    const subs = new Set(opts.slice(1).map((o) => o.sublabel));
    expect(subs.has('Tomorrow')).toBe(true);
    expect(subs.has('Fri')).toBe(true); // Nov 20, 2026 is a Friday
  });

  test('covers the full span', () => {
    const opts = buildTimeOptions(new Date(2026, 10, 18, 10, 25), 3, 48);
    expect(opts.length).toBe(1 + 16);
  });
});

describe('rankSnapshots', () => {
  test('sorts best score first without mutating input', () => {
    const input = [snap('a', 'Leça', 4), snap('b', 'Espinho', 7.5), snap('c', 'Matosinhos', 6)];
    const ranked = rankSnapshots(input);
    expect(ranked.map((s) => s.spot.id)).toEqual(['b', 'c', 'a']);
    expect(input[0].spot.id).toBe('a');
  });

  test('breaks ties by name', () => {
    const ranked = rankSnapshots([snap('m', 'Matosinhos', 5), snap('e', 'Espinho', 5)]);
    expect(ranked.map((s) => s.spot.id)).toEqual(['e', 'm']);
  });

  test('handles empty input', () => {
    expect(rankSnapshots([])).toEqual([]);
  });
});

describe('uniqueMaxIndex', () => {
  test('returns index of single max', () => expect(uniqueMaxIndex([0.2, 0.9, 0.5])).toBe(1));
  test('returns null on tie', () => expect(uniqueMaxIndex([0.9, 0.9, 0.5])).toBeNull());
  test('ignores nulls', () => expect(uniqueMaxIndex([null, 0.4, 0.6])).toBe(2));
  test('returns null with fewer than two values', () => {
    expect(uniqueMaxIndex([0.4, null])).toBeNull();
    expect(uniqueMaxIndex([])).toBeNull();
  });
});

describe('buildMetricRows', () => {
  test('formats values and picks best by component score, not raw value', () => {
    const rows = buildMetricRows([
      snap('a', 'A', 6, { conditions: conds({ swell_height: 2.5 }), components: comps({ swell_quality: 0.3 }) }),
      snap('b', 'B', 7, { conditions: conds({ swell_height: 1.5 }), components: comps({ swell_quality: 0.8 }) }),
    ]);
    const swell = rows.find((r) => r.key === 'swell')!;
    expect(swell.values).toEqual(['2.5m', '1.5m']);
    expect(swell.bestIndex).toBe(1);
  });

  test('formats wind with compass direction and tide', () => {
    const rows = buildMetricRows([snap('a', 'A', 6, { conditions: conds(), components: comps() })]);
    expect(rows.find((r) => r.key === 'wind')!.values[0]).toBe('10 km/h E');
    expect(rows.find((r) => r.key === 'tide')!.values[0]).toBe('2.1m');
  });

  test('falls back to wave fields when swell is missing', () => {
    const rows = buildMetricRows([
      snap('a', 'A', 6, { conditions: conds({ swell_height: null, swell_period: null }), components: comps() }),
    ]);
    expect(rows.find((r) => r.key === 'swell')!.values[0]).toBe('1.2m');
    expect(rows.find((r) => r.key === 'period')!.values[0]).toBe('10s');
  });

  test('shows dashes when conditions are absent', () => {
    const rows = buildMetricRows([snap('a', 'A', 6), snap('b', 'B', 5)]);
    for (const r of rows) {
      expect(r.values).toEqual(['--', '--']);
      expect(r.bestIndex).toBeNull();
    }
  });

  test('wind shows dashes when speed is null', () => {
    const rows = buildMetricRows([snap('a', 'A', 6, { conditions: conds({ wind_speed: null }) })]);
    expect(rows.find((r) => r.key === 'wind')!.values[0]).toBe('--');
  });
});
