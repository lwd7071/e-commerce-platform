import type { NextConfig } from "next";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

// Nạp tự động các biến từ file .env ở thư mục root dự án
// Next has already loaded env files from the frontend directory before it
// evaluates this config. Force a reload because @next/env caches the first
// directory it sees; the shared .env lives one level above frontend.
const { combinedEnv } = loadEnvConfig(path.resolve(process.cwd(), ".."), undefined, undefined, true);

const nextConfig: NextConfig = {
  // In-line các biến NEXT_PUBLIC_* cho client bundle chạy trên browser
  env: {
    NEXT_PUBLIC_API_URL: combinedEnv.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1",
    NEXT_PUBLIC_SITE_URL: combinedEnv.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: combinedEnv.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: combinedEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    NEXT_PUBLIC_USE_MOCK: combinedEnv.NEXT_PUBLIC_USE_MOCK || process.env.NEXT_PUBLIC_USE_MOCK || "false",
    NEXT_PUBLIC_ENABLE_DEBUG_LOGS: combinedEnv.NEXT_PUBLIC_ENABLE_DEBUG_LOGS || process.env.NEXT_PUBLIC_ENABLE_DEBUG_LOGS || "false",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
