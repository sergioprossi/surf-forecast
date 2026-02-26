/** API endpoint functions */
import { apiClient } from './client';
import {
  BestWindowsResponseSchema,
  CurrentConditionsSchema,
  SpotForecastResponseSchema,
  SpotListResponseSchema,
  TokenResponseSchema,
} from './schemas';
import type {
  BestWindowsResponse,
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
