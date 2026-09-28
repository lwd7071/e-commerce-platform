"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import type { AuthUser, AuthContextType, UserRole } from "./types";
import { getSupabaseClient } from "./supabase-client";
import { setAuthTokenProvider } from "../api/client";
import { envConfig } from "../config/env";

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sync token with ApiClient singleton
  useEffect(() => {
    setAuthTokenProvider(() => accessToken);
  }, [accessToken]);

  // Decode role from Supabase JWT or metadata
  const extractUser = useCallback((session: { user: { id: string; email?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> } } | null): AuthUser | null => {
    if (!session || !session.user) return null;

    const sbUser = session.user;
    const role: UserRole =
      (sbUser.app_metadata?.role as UserRole) ||
      (sbUser.user_metadata?.role as UserRole) ||
      "BUYER";

    return {
      id: sbUser.id,
      email: sbUser.email || "",
      role,
      fullName: (sbUser.user_metadata?.full_name as string) || null,
      shopId: (sbUser.app_metadata?.shop_id as string) || null,
    };
  }, []);

  // Initialize auth session
  useEffect(() => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      // Mock mode fallback: check local storage for dev session
      Promise.resolve().then(() => {
        if (envConfig.useMock && typeof window !== "undefined") {
          const devUser = localStorage.getItem("dev_mock_user");
          if (devUser) {
            try {
              const parsed = JSON.parse(devUser);
              setUser(parsed);
              setAccessToken("mock_dev_jwt_token");
            } catch {
              // ignore
            }
          }
        }
        setIsLoading(false);
      });
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAccessToken(session.access_token);
        setUser(extractUser(session));
      }
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setAccessToken(session.access_token);
        setUser(extractUser(session));
      } else {
        setAccessToken(null);
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [extractUser]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        // Mock login
        const mockUser: AuthUser = {
          id: "mock_buyer_id",
          email,
          role: email.includes("seller") ? "SELLER" : email.includes("admin") ? "ADMIN" : "BUYER",
          fullName: "Dev Tester",
        };
        setUser(mockUser);
        setAccessToken("mock_dev_jwt_token");
        if (typeof window !== "undefined") {
          localStorage.setItem("dev_mock_user", JSON.stringify(mockUser));
        }
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw new Error(error.message);
      }
      if (data.session) {
        setAccessToken(data.session.access_token);
        setUser(extractUser(data.session));
      }
    } finally {
      setIsLoading(false);
    }
  }, [extractUser]);

  const register = useCallback(async (email: string, password: string, role: UserRole = "BUYER") => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        await login(email, password);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.session) {
        setAccessToken(data.session.access_token);
        setUser(extractUser(data.session));
      }
    } finally {
      setIsLoading(false);
    }
  }, [extractUser, login]);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
      setAccessToken(null);
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("dev_mock_user");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const hasRole = useCallback((requiredRole: UserRole) => {
    return user?.role === requiredRole;
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      hasRole,
    }),
    [user, accessToken, isLoading, login, register, logout, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
