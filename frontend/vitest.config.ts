import { defineConfig } from "vitest/config";
import path from "path";
import { loadEnvConfig } from "@next/env";

// Nạp tự động file .env từ thư mục root dự án
loadEnvConfig(path.resolve(process.cwd(), ".."));

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
