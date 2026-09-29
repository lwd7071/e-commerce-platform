import { defineConfig, env } from "prisma/config";

// Load the shared root .env before Prisma reads DIRECT_URL.
import "./src/platform/config/load-root-env.ts";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DIRECT_URL") },
});
