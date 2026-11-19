import { AxiosError, AxiosHeaders } from 'axios';

import type { AlertConfig } from '../src/api/types';
import {
  DEFAULT_FORM,
  alertToForm,
  extractApiError,
  formatQuietHours,
  maskDestination,
  spotNames,
  stepHour,
  stepScore,
  toCreatePayload,
  toUpdatePayload,
  validateAlertForm,
} from '../src/utils/alerts';

const alert = (over: Partial<AlertConfig> = {}): AlertConfig => ({
  id: 1, channel: 'telegram', chat_id: '123456789', email: null, spot_ids: ['leca'],
  min_score: 6, enabled: true, quiet_start_hour: 22, quiet_end_hour: 6, ...over,
});

function axiosErr(status: number | null, data?: unknown): AxiosError {
  const err = new AxiosError('fail');
  if (status != null) {
    err.response = { status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } };
  }
  return err;
}

describe('validateAlertForm', () => {
  const valid = { ...DEFAULT_FORM, destination: '123456789', spotIds: ['leca'] };

  test('accepts a valid telegram form', () => expect(validateAlertForm(valid)).toEqual({}));

  test('accepts negative (group) chat IDs', () => {
    expect(validateAlertForm({ ...valid, destination: '-100123' })).toEqual({});
  });

  test('rejects a non-numeric chat ID', () => {
    expect(validateAlertForm({ ...valid, destination: '@surfer' }).destination).toMatch(/chat ID/);
  });

  test('rejects an empty destination', () => {
    expect(validateAlertForm({ ...valid, destination: '  ' }).destination).toBeDefined();
  });

  test('validates email for email channel', () => {
    expect(validateAlertForm({ ...valid, channel: 'email', destination: 'nope' }).destination).toMatch(/email/);
    expect(validateAlertForm({ ...valid, channel: 'email', destination: 'me@test.com' })).toEqual({});
  });

  test('requires at least one spot', () => {
    expect(validateAlertForm({ ...valid, spotIds: [] }).spotIds).toBe('Pick at least one spot');
  });

  test('rejects out-of-range score and hours', () => {
    expect(validateAlertForm({ ...valid, minScore: 11 }).minScore).toBeDefined();
    expect(validateAlertForm({ ...valid, quietStartHour: 24 }).quietStartHour).toBeDefined();
  });
});

describe('payload mapping', () => {
  const form = { ...DEFAULT_FORM, destination: ' 42 ', spotIds: ['leca', 'espinho'], minScore: 7.5 };

  test('telegram create payload trims and sets chat_id only', () => {
    expect(toCreatePayload(form)).toEqual({
      channel: 'telegram', chat_id: '42', email: null, spot_ids: ['leca', 'espinho'],
      min_score: 7.5, quiet_start_hour: 22, quiet_end_hour: 6,
    });
  });

  test('email create payload sets email only', () => {
    const p = toCreatePayload({ ...form, channel: 'email', destination: 'me@test.com' });
    expect(p.email).toBe('me@test.com');
    expect(p.chat_id).toBeNull();
  });

  test('update payload omits channel and destination', () => {
    const p = toUpdatePayload(form);
    expect(p).toEqual({ spot_ids: ['leca', 'espinho'], min_score: 7.5, quiet_start_hour: 22, quiet_end_hour: 6 });
  });

  test('alertToForm round-trips telegram and email', () => {
    expect(alertToForm(alert()).destination).toBe('123456789');
    expect(alertToForm(alert({ channel: 'email', chat_id: null, email: 'a@b.co' })).destination).toBe('a@b.co');
  });
});

describe('steppers', () => {
  test('stepScore moves in 0.5 steps and clamps to 0..10', () => {
    expect(stepScore(6, 0.5)).toBe(6.5);
    expect(stepScore(9.8, 0.5)).toBe(10);
    expect(stepScore(0.2, -0.5)).toBe(0);
    expect(stepScore(6.3, 0.5)).toBe(7); // snaps to grid
  });

  test('stepHour wraps around midnight', () => {
    expect(stepHour(23, 1)).toBe(0);
    expect(stepHour(0, -1)).toBe(23);
    expect(stepHour(10, 1)).toBe(11);
  });
});

describe('formatting', () => {
  test('formatQuietHours', () => {
    expect(formatQuietHours(22, 6)).toBe('22:00–06:00');
    expect(formatQuietHours(5, 5)).toBe('No quiet hours');
  });

  test('maskDestination hides most of the email and chat ID', () => {
    expect(maskDestination(alert({ channel: 'email', chat_id: null, email: 'surfer@test.com' }))).toBe('su••••@test.com');
    expect(maskDestination(alert())).toBe('Chat •••6789');
    expect(maskDestination(alert({ chat_id: null }))).toBe('--');
  });

  test('spotNames uses names and falls back to id', () => {
    expect(spotNames(['leca', 'unknown'], { leca: 'Leça da Palmeira' })).toBe('Leça da Palmeira · unknown');
  });
});

describe('extractApiError', () => {
  test('uses string detail', () => {
    expect(extractApiError(axiosErr(409, { detail: 'Alert limit reached (20)' }))).toBe('Alert limit reached (20)');
  });

  test('uses first validation message and strips pydantic prefix', () => {
    const err = axiosErr(422, { detail: [{ msg: 'Value error, Unknown spot(s): nazare' }] });
    expect(extractApiError(err)).toBe('Unknown spot(s): nazare');
  });

  test('reports network errors', () => {
    expect(extractApiError(axiosErr(null))).toMatch(/Network error/);
  });

  test('falls back for unknown errors', () => {
    expect(extractApiError(new Error('x'), 'Oops')).toBe('Oops');
    expect(extractApiError(axiosErr(500, 'html'), 'Oops')).toBe('Oops');
  });
});
