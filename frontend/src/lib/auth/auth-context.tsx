"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { AuthUser, AuthContextType, UserRole } from "./types";
import { getSupabaseClient } from "./supabase-client";
import { setAuthTokenProvider } from "../api/client";
import { envConfig } from "../config/env";
import { apiClient } from "../api/client";
import { clearAppQueryCache } from "../query/query-client";

export const AuthContext = createContext<AuthContextType | null>(null);

const isUserLockedError = (error: unknown) => typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "USER_LOCKED";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const activeSessionUserId = useRef<string | null>(null);

  const syncSession = useCallback(async (session: { access_token: string; user: { id: string; email?: string; user_metadata?: Record<string, unknown> } }) => {
    if (activeSessionUserId.current && activeSessionUserId.current !== session.user.id) {
      clearAppQueryCache();
    }
    activeSessionUserId.current = session.user.id;
    setAccessToken(session.access_token);
    setAuthTokenProvider(() => session.access_token);
    let identity: {
      user_id: string;
      email: string;
      role: UserRole;
      shop_id: string | null;
      shop_status?: "PENDING" | "ACTIVE" | "SUSPENDED" | "LOCKED" | null;
    };
    try {
      identity = await apiClient.get("/auth/me");
    } catch (error) {
      if (isUserLockedError(error)) {
        const client = getSupabaseClient();
        if (client) await client.auth.signOut({ scope: "local" });
        activeSessionUserId.current = null;
        clearAppQueryCache();
        setAccessToken(null); setUser(null);
      }
      throw error;
    }
    const authUser: AuthUser = {
      id: identity.user_id,
      email: identity.email || session.user.email || "",
      role: identity.role,
      fullName: (session.user.user_metadata?.full_name as string) || null,
      shopId: identity.shop_id,
      shopStatus: identity.shop_status ?? null,
    };
    setUser(authUser);
    return authUser;
  }, []);

  // Sync token with ApiClient singleton
  useEffect(() => {
    setAuthTokenProvider(() => accessToken);
  }, [accessToken]);

  // Auth metadata is display-only; authorization role comes from the backend app_users record.
  const extractUser = useCallback((session: { user: { id: string; email?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> } } | null): AuthUser | null => {
    if (!session || !session.user) return null;

    const sbUser = session.user;
    const role: UserRole = "BUYER";

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

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        if (session) await syncSession(session);
      } catch {
        activeSessionUserId.current = null;
        clearAppQueryCache();
        setAccessToken(null); setUser(null);
      } finally {
        setIsLoading(false);
      }
    }).catch(() => {
      activeSessionUserId.current = null;
      clearAppQueryCache();
      setAccessToken(null); setUser(null); setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION is emitted before getSession() has necessarily finished.
      // Treating its transient null as signed-out races ProtectedPage redirects
      // against persisted-session restoration after a full page reload.
      if (event === "INITIAL_SESSION") return;
      if (session) {
        if (activeSessionUserId.current && activeSessionUserId.current !== session.user.id) {
          clearAppQueryCache();
          setUser(null);
          setIsLoading(true);
        }
        void syncSession(session)
          .catch(() => {
            activeSessionUserId.current = null;
            clearAppQueryCache();
            setAccessToken(null);
            setUser(null);
          })
          .finally(() => setIsLoading(false));
      } else {
        activeSessionUserId.current = null;
        clearAppQueryCache();
        setAccessToken(null);
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [extractUser, syncSession]);

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
        return mockUser;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw new Error(error.message);
      }
      if (!data.session) {
        throw new Error("Đăng nhập thành công nhưng không có phiên hợp lệ.");
      }
      setAccessToken(data.session.access_token);
      return await syncSession(data.session);
    } finally {
      setIsLoading(false);
    }
  }, [syncSession]);

  const register = useCallback(async (email: string, password: string, role: UserRole = "BUYER", fullName = "", shopName = "") => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        await login(email, password);
        return "mock";
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.session) {
        await syncSession(data.session);
      }
      if (typeof window !== "undefined") {
        sessionStorage.setItem("dino_signup_draft", JSON.stringify({ email, full_name: fullName.trim(), requested_role: role, shop_name: role === "SELLER" ? shopName.trim() : null }));
      }
      return "otp";
    } finally {
      setIsLoading(false);
    }
  }, [login, syncSession]);

  const loginWithGoogle = useCallback(async (returnTo = "/") => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Đăng nhập Google cần cấu hình Supabase Auth.");
    if (typeof window !== "undefined") sessionStorage.setItem("dino_auth_return_to", returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw new Error(error.message);
  }, []);

  const completeOnboarding = useCallback(async (fullName: string, role: UserRole, shopName?: string) => {
    const result = await apiClient.post<{ user_id: string; email: string; role: UserRole; profile_completed: boolean; shop: { shop_id: string; status?: "PENDING" | "ACTIVE" | "SUSPENDED" | "LOCKED" } | null }>("/auth/onboarding", {
      full_name: fullName.trim(), requested_role: role, shop_name: role === "SELLER" ? shopName?.trim() ?? null : null,
    });
    setUser(current => current ? { ...current, id: result.user_id, email: result.email, role: result.role, fullName: fullName.trim(), shopId: result.shop?.shop_id ?? null, shopStatus: result.shop?.status ?? (role === "SELLER" ? "PENDING" : null) } : current);
  }, []);

  const reloadUser = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await syncSession(session);
    }
  }, [syncSession]);

  const verifySignupOtp = useCallback(async (email: string, token: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Xác minh email cần cấu hình Supabase Auth.");
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error("Xác minh thành công nhưng chưa tạo được phiên đăng nhập.");
    await syncSession(data.session);
    let draft: { full_name?: string; requested_role?: UserRole; shop_name?: string | null } = {};
    try { draft = JSON.parse(sessionStorage.getItem("dino_signup_draft") || "{}"); } catch { /* continue to profile completion */ }
    if (!draft.full_name || !draft.requested_role || (draft.requested_role === "SELLER" && !draft.shop_name)) return;
    await completeOnboarding(draft.full_name, draft.requested_role, draft.shop_name ?? undefined);
  }, [completeOnboarding, syncSession]);

  const resendSignupOtp = useCallback(async (email: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Gửi lại mã cần cấu hình Supabase Auth.");
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) throw new Error(error.message);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Đặt lại mật khẩu cần cấu hình Supabase Auth.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?flow=recovery` });
    if (error) throw new Error(error.message);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Đặt lại mật khẩu cần cấu hình Supabase Auth.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
    await supabase.auth.signOut();
    activeSessionUserId.current = null;
    clearAppQueryCache();
    setAccessToken(null); setUser(null);
  }, []);

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
      activeSessionUserId.current = null;
      clearAppQueryCache();
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
      loginWithGoogle,
      verifySignupOtp,
      resendSignupOtp,
      requestPasswordReset,
      updatePassword,
      completeOnboarding,
      reloadUser,
      logout,
      hasRole,
    }),
    [user, accessToken, isLoading, login, register, loginWithGoogle, verifySignupOtp, resendSignupOtp, requestPasswordReset, updatePassword, completeOnboarding, reloadUser, logout, hasRole]
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
