import path from "node:path";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// Nạp biến môi trường từ root .env hoặc backend/.env
dotenv.config({ path: [path.resolve(process.cwd(), "../.env"), path.resolve(process.cwd(), ".env")] });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DIRECT_URL") },
});
