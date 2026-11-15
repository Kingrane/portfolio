/** Observe two existing exports without ?perf and inspect raw/gzip JS sizes. */
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { launch, output, save, url } from "./common.ts";

const base = process.env.PERF_BASE_EXPORT ?? "C:\\Users\\REDMI\\AppData\\Local\\Temp\\opencode\\portfolio-perf-base-27da66a";
const oldURL = "http://127.0.0.1:4178/portfolio/";
const server = createServer(async (request, response) => {
  try {
    const name = new URL(request.url!, oldURL).pathname.replace(/^\/portfolio\/?/, "");
    if (name.includes("..")) throw new Error("Path traversal");
    const file = name && !name.endsWith("/") ? name : name + "index.html";
    response.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".html") ? "text/html" : "application/octet-stream");
    response.setHeader("Cache-Control", "no-store"); response.end(await readFile(join(base, file)));
  } catch { response.statusCode = 404; response.end("Not found"); }
});
await new Promise<void>((resolve) => server.listen(4178, "127.0.0.1", resolve));
async function inventory(root: string) {
  const chunks: { name: string; raw: number; gzip: number; diagnostic: boolean }[] = [];
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.name.endsWith(".js")) {
        const bytes = await readFile(file);
        chunks.push({ name: file.replace(root, ""), raw: bytes.length, gzip: gzipSync(bytes).length,
          diagnostic: bytes.includes(Buffer.from("gpuMemoryBytes")) && bytes.includes(Buffer.from("full-frame")) });
      }
    }
  }
  await walk(join(root, "_next"));
  const html = await readFile(join(root, "index.html"), "utf8");
  const initial = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((match) => match[1]);
  const initialChunks = chunks.filter((chunk) => initial.some((name) => name.endsWith(chunk.name.replaceAll("\\", "/"))));
  return { chunks, totalRaw: chunks.reduce((n, c) => n + c.raw, 0), totalGzip: chunks.reduce((n, c) => n + c.gzip, 0),
    htmlScripts: initial, htmlScriptRaw: initialChunks.reduce((n, c) => n + c.raw, 0), htmlScriptGzip: initialChunks.reduce((n, c) => n + c.gzip, 0),
    ssrHeading: /KINGRANE/.test(html) };
}
const browser = await launch(true);
try {
  const results = [];
  for (const item of [{ label: "published-27da66a", root: resolve(base), url: oldURL }, { label: "phase0", root: resolve("out"), url }]) {
    const files = await inventory(item.root);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage(); const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(item.url, { waitUntil: "load" }); await page.waitForTimeout(6000);
    const network = await page.evaluate(() => ({ fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
      scripts: (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter((entry) => entry.initiatorType === "script").map((entry) => ({ name: entry.name, start: entry.startTime, end: entry.responseEnd, raw: entry.encodedBodySize })),
      diagnosticAPI: !!window.__portfolioPerf, heading: document.querySelector("h1")?.textContent, webgl: !!document.querySelector("canvas[data-qa-webgl]") }));
    const downloaded = network.scripts.map((script) => ({ ...script, chunk: files.chunks.find((chunk) => script.name.endsWith(chunk.name.replaceAll("\\", "/"))) }));
    results.push({ ...item, files, network, downloadedRaw: downloaded.reduce((n, c) => n + (c.chunk?.raw ?? c.raw), 0),
      downloadedGzip: downloaded.reduce((n, c) => n + (c.chunk?.gzip ?? 0), 0),
      requestedBeforeFCPRaw: downloaded.filter((s) => s.start <= network.fcp!).reduce((n, c) => n + (c.chunk?.raw ?? c.raw), 0),
      completedBeforeFCPRaw: downloaded.filter((s) => s.end <= network.fcp!).reduce((n, c) => n + (c.chunk?.raw ?? c.raw), 0),
      diagnosticDownloaded: downloaded.some((s) => s.chunk?.diagnostic), errors });
    await context.close();
  }
  await save(join(output, "bundle-loading.json"), { results, note: "FCP is a first-paint proxy, not an element-level KINGRANE paint timestamp. SSR text verified in HTML. All sizes exclude maps; local server uncompressed, gzip is estimated offline. Total export JS includes lazy/unused routes, not first-render payload." });
  console.log(JSON.stringify(results.map(({ label, files, network, downloadedRaw, downloadedGzip, requestedBeforeFCPRaw, completedBeforeFCPRaw, diagnosticDownloaded }) => ({ label, exportRaw: files.totalRaw, exportGzip: files.totalGzip, htmlRaw: files.htmlScriptRaw, htmlGzip: files.htmlScriptGzip, FCP: network.fcp, downloadedRaw, downloadedGzip, requestedBeforeFCPRaw, completedBeforeFCPRaw, diagnosticDownloaded })), null, 2));
} finally { await browser.close(); await new Promise<void>((resolve) => server.close(() => resolve())); }
