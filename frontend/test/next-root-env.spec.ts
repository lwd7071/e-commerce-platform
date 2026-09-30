import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Next.js root environment loading", () => {
  it("keeps shared root Supabase settings after Next loads the frontend env first", () => {
    const projectDir = process.cwd();
    const fixtureRoot = mkdtempSync(path.join(tmpdir(), "next-root-env-"));
    const frontendDir = path.join(fixtureRoot, "frontend");
    mkdirSync(frontendDir);
    writeFileSync(
      path.join(fixtureRoot, ".env"),
      [
        "NEXT_PUBLIC_SUPABASE_URL=https://root-config.test",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY=root-test-key",
        "NEXT_PUBLIC_API_URL=http://root-config.test/api",
      ].join("\n"),
    );
    writeFileSync(
      path.join(frontendDir, ".env"),
      [
        "NEXT_PUBLIC_SUPABASE_URL=https://frontend-config.test",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY=frontend-test-key",
      ].join("\n"),
    );
    writeFileSync(
      path.join(frontendDir, "next.config.ts"),
      readFileSync(path.join(projectDir, "next.config.ts")),
    );
    symlinkSync(path.join(projectDir, "node_modules"), path.join(frontendDir, "node_modules"), "junction");

    const childEnv = { ...process.env };
    delete childEnv.NEXT_PUBLIC_SUPABASE_URL;
    delete childEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete childEnv.NEXT_PUBLIC_API_URL;

    try {
      const result = spawnSync(
        process.execPath,
        [
          "-e",
          `
          (async () => {
            const loadConfig = require('next/dist/server/config').default;
            const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');
            const config = await loadConfig(PHASE_DEVELOPMENT_SERVER, process.cwd());
            console.log(JSON.stringify({
              url: config.env.NEXT_PUBLIC_SUPABASE_URL,
              key: config.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
              apiUrl: config.env.NEXT_PUBLIC_API_URL,
            }));
          })().catch((error) => { console.error(error.message); process.exit(1); });
        `,
        ],
        { cwd: frontendDir, env: childEnv, encoding: "utf8" },
      );

      expect(result.status, result.stderr).toBe(0);
      const config = JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1) ?? "{}");
      expect(config).toEqual({
        url: "https://root-config.test",
        key: "root-test-key",
        apiUrl: "http://root-config.test/api",
      });
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
