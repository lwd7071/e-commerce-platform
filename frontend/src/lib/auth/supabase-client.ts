import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { envConfig } from "../config/env";

let supabaseInstance: SupabaseClient | null = null;

/**
 * Returns a singleton instance of the Supabase browser client.
 * Safe fallback for mock development mode when credentials are not yet configured.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const { supabaseUrl, supabaseAnonKey } = envConfig;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "ecommerce_sb_session",
    },
  });

  return supabaseInstance;
}
