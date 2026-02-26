/**
 * Token storage — access token in memory, refresh token in Keychain/Keystore.
 * NEVER store tokens in AsyncStorage per CLAUDE.md security guidelines.
 */
import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'surf_forecast_refresh_token';

// Access token lives in memory only (cleared on app restart)
let accessToken: string | null = null;

export const tokenStorage = {
  getAccessToken(): string | null {
    return accessToken;
  },

  setAccessToken(token: string): void {
    accessToken = token;
  },

  clearAccessToken(): void {
    accessToken = null;
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  },

  async clearRefreshToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      // Ignore if key doesn't exist
    }
  },

  async clearAll(): Promise<void> {
    accessToken = null;
    await tokenStorage.clearRefreshToken();
  },
};
