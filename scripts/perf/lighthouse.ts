/** Independent mobile load audit: no ?perf, no freeze; three serial cold-cache loads. */
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { chrome, output, save, url } from "./common.ts";

await mkdir(output, { recursive: true });
const results: { run: number; performance: number; LCP: number; FCP: number; CLS: number; TBT: number; [key: string]: unknown }[] = [];
for (let i = 1; i <= 3; i++) {
  const path = join(output, `lighthouse-mobile-${i}`);
  const args = ["node_modules/lighthouse/cli/index.js", url, "--only-categories=performance", "--chrome-flags=--headless",
    "--screenEmulation.mobile=true", "--screenEmulation.width=390", "--screenEmulation.height=844", "--screenEmulation.deviceScaleFactor=2.75",
    "--throttling-method=devtools", "--throttling.cpuSlowdownMultiplier=4", "--output=json", "--output=html", `--output-path=${path}`, "--save-assets", "--quiet", "--no-enable-error-reporting"];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: "inherit", env: { ...process.env, CHROME_PATH: chrome } });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Lighthouse exit ${code}`)));
  });
  const report = JSON.parse(await readFile(path + ".report.json", "utf8"));
  const result = { run: i, performance: report.categories.performance.score * 100, LCP: report.audits["largest-contentful-paint"].numericValue,
    FCP: report.audits["first-contentful-paint"].numericValue, CLS: report.audits["cumulative-layout-shift"].numericValue,
    TBT: report.audits["total-blocking-time"].numericValue, speedIndex: report.audits["speed-index"].numericValue,
    warnings: report.runWarnings, runtimeError: report.runtimeError, settings: report.configSettings, environment: report.environment };
  results.push(result); console.log(JSON.stringify(result));
}
await save(join(output, "lighthouse-summary.json"), { url, results, median: Object.fromEntries(["performance", "LCP", "FCP", "CLS", "TBT"].map((field) => [field, results.map((r) => r[field as keyof typeof r] as number).sort((a, b) => a - b)[1]])) });
