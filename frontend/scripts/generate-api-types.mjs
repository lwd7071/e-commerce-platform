import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendRoot = path.resolve(frontendRoot, "../backend");
const outputPath = path.join(frontendRoot, "src/lib/api/generated/openapi.ts");
const tsxCli = path.join(backendRoot, "node_modules/tsx/dist/cli.mjs");
const spec = JSON.parse(execFileSync(process.execPath, [
  tsxCli,
  "--eval",
  "import { generateOpenApiSpec } from './src/platform/openapi/openapi-spec.ts'; process.stdout.write(JSON.stringify(generateOpenApiSpec()));",
], { cwd: backendRoot, encoding: "utf8" }));
const generated = `// Generated from backend/src/platform/openapi/openapi-spec.ts. Do not edit.\n${astToString(await openapiTS(spec))}`;

if (process.argv.includes("--check")) {
  let current = "";
  try { current = readFileSync(outputPath, "utf8"); } catch { /* missing file is drift */ }
  if (current !== generated) {
    console.error("Generated API types differ from the backend OpenAPI contract. Run npm run api:types.");
    process.exitCode = 1;
  } else {
    console.log("Generated API types match the backend OpenAPI contract.");
  }
} else {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, generated);
  console.log(`Generated ${path.relative(frontendRoot, outputPath)}`);
}
