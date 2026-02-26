/** Auth context — provides login, logout, register, and auth state */
import React, { createContext, useCallback, useEffect, useState } from 'react';

import * as endpoints from '../api/endpoints';
import { tokenStorage } from './tokenStorage';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Try silent refresh on mount
  useEffect(() => {
    (async () => {
      try {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (refreshToken) {
          const tokens = await endpoints.refreshTokens(refreshToken);
          tokenStorage.setAccessToken(tokens.access_token);
          await tokenStorage.setRefreshToken(tokens.refresh_token);
          setIsAuthenticated(true);
        }
      } catch {
        // Silent refresh failed — user stays unauthenticated
        await tokenStorage.clearAll();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await endpoints.login(email, password);
    tokenStorage.setAccessToken(tokens.access_token);
    await tokenStorage.setRefreshToken(tokens.refresh_token);
    setIsAuthenticated(true);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const tokens = await endpoints.register(email, password);
    tokenStorage.setAccessToken(tokens.access_token);
    await tokenStorage.setRefreshToken(tokens.refresh_token);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    await tokenStorage.clearAll();
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
