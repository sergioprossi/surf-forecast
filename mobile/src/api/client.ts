/** Axios client with JWT auth interceptors */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { tokenStorage } from '../auth/tokenStorage';
import { DEFAULT_API_URL } from '../utils/constants';

// Token refresh mutex to prevent concurrent refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else if (token) {
      p.resolve(token);
    }
  });
  failedQueue = [];
};

export const apiClient = axios.create({
  baseURL: DEFAULT_API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — inject access token
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401 with token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Only retry on 401, if we haven't already retried, and we have a refresh token
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue the request while refresh is in progress
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const resp = await axios.post(`${DEFAULT_API_URL}/api/v1/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const { access_token, refresh_token: newRefresh } = resp.data;
      tokenStorage.setAccessToken(access_token);
      await tokenStorage.setRefreshToken(newRefresh);

      originalRequest.headers.Authorization = `Bearer ${access_token}`;
      processQueue(null, access_token);
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      // Clear tokens on refresh failure
      tokenStorage.clearAccessToken();
      await tokenStorage.clearRefreshToken();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
