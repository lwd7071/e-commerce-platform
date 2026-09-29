import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Next.js root environment loading", () => {
  it("keeps shared root Supabase settings after Next loads the frontend env first", () => {
    const frontendDir = process.cwd();
    const childEnv = { ...process.env };
    delete childEnv.NEXT_PUBLIC_SUPABASE_URL;
    delete childEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete childEnv.NEXT_PUBLIC_API_URL;

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
              url: Boolean(config.env.NEXT_PUBLIC_SUPABASE_URL),
              key: Boolean(config.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
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
      url: true,
      key: true,
      apiUrl: "http://localhost:3001/api/v1",
    });
  });
});
