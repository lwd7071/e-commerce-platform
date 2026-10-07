/**
 * Environment configuration validator for Frontend.
 * Follows F-101: Fail-fast with clear messages, no secret leaks.
 */

export interface AppEnvConfig {
  apiUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  siteUrl: string;
  useMock: boolean;
  debugLogs: boolean;
}

export function validateEnvConfig(): AppEnvConfig {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true" || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const debugLogs = process.env.NEXT_PUBLIC_ENABLE_DEBUG_LOGS === "true";

  // Check for critical security misconfigurations: never allow service role key on client
  const forbiddenKeys = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET",
  ];
  for (const forbidden of forbiddenKeys) {
    if (process.env[forbidden]) {
      throw new Error(
        `[SecurityError] CRITICAL: Service role key detected on frontend via ${forbidden}. This is forbidden to prevent token leakage.`
      );
    }
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

  // When mock mode is disabled, Supabase credentials are required
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  if (!useMock) {
    if (!supabaseUrl && typeof window !== "undefined") {
      console.warn(
        "[EnvWarning] NEXT_PUBLIC_SUPABASE_URL is missing. Real auth calls will fail."
      );
    }
    if (!supabaseAnonKey && typeof window !== "undefined") {
      console.warn(
        "[EnvWarning] NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Real auth calls will fail."
      );
    }
  }

  return {
    apiUrl,
    supabaseUrl,
    supabaseAnonKey,
    siteUrl,
    useMock,
    debugLogs,
  };
}

export const envConfig: AppEnvConfig = validateEnvConfig();
