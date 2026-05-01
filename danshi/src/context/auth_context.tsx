import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import type { User } from '@/src/models/User';
import { AuthStorage } from '@/src/lib/auth/auth_storage';
import { authService } from '@/src/services/auth_service';
import { decodeJwtPayload } from '../lib/auth/jwt';

export type AuthContextValue = {
  userToken: string | null;
  user: User | null; // full info（from /auth/me）
  preview: Pick<User, 'name' | 'avatar_url'> | null; // from JWT payload 
  isLoading: boolean;
  sessionExpired: boolean; // 会话过期标记
  signIn: (token: string) => Promise<void>; 
  signOut: () => Promise<void>;
  refreshUser: (tokenOverride?: string) => Promise<void>; // refresh /me
  clearSessionExpired: () => void; // 清除过期标记
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const computePreview = (token: string | null): Pick<User, 'name' | 'avatar_url'> | null => {
  if (!token) return null;
  const payload = decodeJwtPayload<Record<string, any>>(token);
  if (!payload || typeof payload !== 'object') return null;
  const name = (payload.nickname ?? payload.name ?? null) as string | null;
  const avatarUrl = (payload.avatarUrl ?? payload.avatar ?? null) as string | null;
  if (!name && !avatarUrl) return null;
  return { name: name ?? '', avatar_url: avatarUrl ?? null };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [preview, setPreview] = useState<Pick<User, 'name' | 'avatar_url'> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const restore = async () => {
    try {
      const token = await AuthStorage.getToken();
      setUserToken(token ?? null);
      setPreview(computePreview(token ?? null));
      if (token) {
        // get full user info silently
        try {
          const me = await authService.me();
          setUser(me);
          setSessionExpired(false);
        } catch {
          // Token 可能已过期，清除本地状态并标记会话过期
          await AuthStorage.clearToken();
          await AuthStorage.clearRefreshToken();
          setUserToken(null);
          setPreview(null);
          setUser(null);
          // 只有当之前有 token 时才标记为会话过期（区分首次登录和会话过期）
          setSessionExpired(true);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    restore();
  }, []);

  const refreshUser = useCallback(async (tokenOverride?: string) => {
    const token = tokenOverride ?? userToken ?? (await AuthStorage.getToken());
    if (!token) return;
    try {
      const me = await authService.me();
      setUser(me);
      setSessionExpired(false);
    } catch {
      // Token 过期，清除状态并标记
      await AuthStorage.clearToken();
      await AuthStorage.clearRefreshToken();
      setUserToken(null);
      setPreview(null);
      setUser(null);
      setSessionExpired(true);
    }
  }, [userToken]);

  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false);
  }, []);

  const signIn = useCallback(async (token: string) => {
    setIsLoading(true);
    try {
      setSessionExpired(false);
      await AuthStorage.setToken(token);
      setUserToken(token);
      setPreview(computePreview(token));
      setUser(null);
      await refreshUser(token);
    } finally {
      setIsLoading(false);
    }
  }, [refreshUser]);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      // Call API to logout (best-effort), then clear local state
      await authService.logout();
    } finally {
      setSessionExpired(false);
      setUserToken(null);
      setUser(null);
      setPreview(null);
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    userToken,
    user,
    preview,
    isLoading,
    sessionExpired,
    signIn,
    signOut,
    refreshUser,
    clearSessionExpired,
  }), [userToken, user, preview, isLoading, sessionExpired, signIn, signOut, refreshUser, clearSessionExpired]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
