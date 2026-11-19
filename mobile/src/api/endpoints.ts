/** API endpoint functions */
import { apiClient } from './client';
import {
  AlertConfigSchema,
  AlertListResponseSchema,
  BestWindowsResponseSchema,
  CompareResponseSchema,
  CurrentConditionsSchema,
  SpotForecastResponseSchema,
  SpotListResponseSchema,
  TokenResponseSchema,
} from './schemas';
import type {
  AlertConfig,
  AlertConfigCreate,
  AlertConfigUpdate,
  BestWindowsResponse,
  CompareResponse,
  CurrentConditions,
  SessionFeedbackCreate,
  SessionFeedbackResponse,
  SpotForecastResponse,
  SpotListResponse,
  TokenResponse,
} from './types';

export async function getSpots(): Promise<SpotListResponse> {
  const { data } = await apiClient.get('/api/v1/spots');
  return SpotListResponseSchema.parse(data);
}

export async function getForecast(spotId: string): Promise<SpotForecastResponse> {
  const { data } = await apiClient.get(`/api/v1/forecast/${spotId}`);
  return SpotForecastResponseSchema.parse(data);
}

export async function getCurrentConditions(): Promise<CurrentConditions> {
  const { data } = await apiClient.get('/api/v1/conditions/now');
  return CurrentConditionsSchema.parse(data);
}

export async function getBestWindows(minScore?: number): Promise<BestWindowsResponse> {
  const params = minScore != null ? { min_score: minScore } : {};
  const { data } = await apiClient.get('/api/v1/best-windows', { params });
  return BestWindowsResponseSchema.parse(data);
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const { data } = await apiClient.post('/api/v1/auth/login', { email, password });
  return TokenResponseSchema.parse(data);
}

export async function register(email: string, password: string): Promise<TokenResponse> {
  const { data } = await apiClient.post('/api/v1/auth/register', { email, password });
  return TokenResponseSchema.parse(data);
}

export async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const { data } = await apiClient.post('/api/v1/auth/refresh', {
    refresh_token: refreshToken,
  });
  return TokenResponseSchema.parse(data);
}

export async function submitFeedback(
  feedback: SessionFeedbackCreate,
): Promise<SessionFeedbackResponse> {
  const { data } = await apiClient.post('/api/v1/feedback/session', feedback);
  return data;
}

export async function compareSpots(spotIds: string[], time?: string): Promise<CompareResponse> {
  const params: Record<string, string> = { spots: spotIds.join(',') };
  if (time) params.time = time;
  const { data } = await apiClient.get('/api/v1/forecast/compare', { params });
  return CompareResponseSchema.parse(data);
}

/** Fetch all of the user's alerts, following the cursor across pages. */
export async function listAlerts(): Promise<AlertConfig[]> {
  const all: AlertConfig[] = [];
  let cursor: number | null = null;
  // Backend caps users at 20 alerts and pages at 100, so this is normally one request.
  // The page bound guards against a misbehaving server returning a looping cursor.
  for (let page = 0; page < 10; page++) {
    const params: Record<string, number> = { limit: 100 };
    if (cursor != null) params.cursor = cursor;
    const { data } = await apiClient.get('/api/v1/alerts', { params });
    const parsed = AlertListResponseSchema.parse(data);
    all.push(...parsed.items);
    if (parsed.next_cursor == null) break;
    cursor = parsed.next_cursor;
  }
  return all;
}

export async function createAlert(body: AlertConfigCreate): Promise<AlertConfig> {
  const { data } = await apiClient.post('/api/v1/alerts', body);
  return AlertConfigSchema.parse(data);
}

export async function updateAlert(id: number, body: AlertConfigUpdate): Promise<AlertConfig> {
  const { data } = await apiClient.patch(`/api/v1/alerts/${id}`, body);
  return AlertConfigSchema.parse(data);
}

export async function deleteAlert(id: number): Promise<void> {
  await apiClient.delete(`/api/v1/alerts/${id}`);
}
