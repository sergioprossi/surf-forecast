/** Pure helpers for the Alerts screen: form validation, formatting, error extraction. */
import { isAxiosError } from 'axios';
import { z } from 'zod/v4';

import type { AlertChannel, AlertConfig, AlertConfigCreate, AlertConfigUpdate } from '../api/types';

export const MIN_SCORE_STEP = 0.5;

export interface AlertFormValues {
  channel: AlertChannel;
  destination: string;
  spotIds: string[];
  minScore: number;
  quietStartHour: number;
  quietEndHour: number;
}

export const DEFAULT_FORM: AlertFormValues = {
  channel: 'telegram',
  destination: '',
  spotIds: [],
  minScore: 6,
  quietStartHour: 22,
  quietEndHour: 6,
};

const hour = z.number().int().min(0).max(23);

/** Client-side validation — mirrors the backend's Pydantic rules (server still re-validates). */
export const AlertFormSchema = z
  .object({
    channel: z.enum(['telegram', 'email']),
    destination: z.string().trim(),
    spotIds: z.array(z.string()).min(1, 'Pick at least one spot'),
    minScore: z.number().min(0).max(10),
    quietStartHour: hour,
    quietEndHour: hour,
  })
  .superRefine((v, ctx) => {
    if (v.channel === 'telegram' && !/^-?\d{1,20}$/.test(v.destination)) {
      ctx.addIssue({
        code: 'custom',
        path: ['destination'],
        message: 'Enter your numeric Telegram chat ID',
      });
    }
    if (v.channel === 'email' && !z.email().safeParse(v.destination).success) {
      ctx.addIssue({ code: 'custom', path: ['destination'], message: 'Enter a valid email' });
    }
  });

export type FormErrors = Partial<Record<keyof AlertFormValues, string>>;

export function validateAlertForm(values: AlertFormValues): FormErrors {
  const result = AlertFormSchema.safeParse(values);
  if (result.success) return {};
  const errors: FormErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof AlertFormValues;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

export function toCreatePayload(v: AlertFormValues): AlertConfigCreate {
  const destination = v.destination.trim();
  return {
    channel: v.channel,
    chat_id: v.channel === 'telegram' ? destination : null,
    email: v.channel === 'email' ? destination : null,
    spot_ids: v.spotIds,
    min_score: v.minScore,
    quiet_start_hour: v.quietStartHour,
    quiet_end_hour: v.quietEndHour,
  };
}

/** Channel/destination are immutable server-side, so edits only send these fields. */
export function toUpdatePayload(v: AlertFormValues): AlertConfigUpdate {
  return {
    spot_ids: v.spotIds,
    min_score: v.minScore,
    quiet_start_hour: v.quietStartHour,
    quiet_end_hour: v.quietEndHour,
  };
}

export function alertToForm(a: AlertConfig): AlertFormValues {
  return {
    channel: a.channel,
    destination: (a.channel === 'telegram' ? a.chat_id : a.email) ?? '',
    spotIds: a.spot_ids,
    minScore: a.min_score,
    quietStartHour: a.quiet_start_hour,
    quietEndHour: a.quiet_end_hour,
  };
}

export function stepScore(score: number, delta: number): number {
  const next = Math.round((score + delta) / MIN_SCORE_STEP) * MIN_SCORE_STEP;
  return Math.min(10, Math.max(0, next));
}

/** Step an hour with wrap-around (23 + 1 → 0). */
export function stepHour(h: number, delta: number): number {
  return (((h + delta) % 24) + 24) % 24;
}

export function formatHourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

export function formatQuietHours(start: number, end: number): string {
  if (start === end) return 'No quiet hours';
  return `${formatHourLabel(start)}–${formatHourLabel(end)}`;
}

/** Mask a destination for display on the list card (owner sees it in full when editing). */
export function maskDestination(a: AlertConfig): string {
  if (a.channel === 'email' && a.email) {
    const [user, domain] = a.email.split('@');
    return `${user.slice(0, 2)}${'•'.repeat(Math.max(1, user.length - 2))}@${domain}`;
  }
  if (a.chat_id) return `Chat •••${a.chat_id.slice(-4)}`;
  return '--';
}

export function spotNames(ids: string[], names: Record<string, string>): string {
  return ids.map((id) => names[id] ?? id).join(' · ');
}

/** Pull a human-readable message from an API error (FastAPI `detail`). */
export function extractApiError(err: unknown, fallback = 'Something went wrong'): string {
  if (isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]?.msg) {
      return String(detail[0].msg).replace(/^Value error, /, '');
    }
    if (!err.response) return 'Network error. Check your connection.';
  }
  return fallback;
}
