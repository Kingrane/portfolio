/** Serve an existing static export; no builds, installs or special browser flags. */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const root = resolve(process.env.PERF_SERVE_ROOT ?? "out");
const port = Number(process.env.PERF_PORT ?? 4177);
const mime: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon" };
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const relative = pathname.replace(/^\/portfolio(?=\/|$)/, "").replace(/^\/+/, "");
    let file = resolve(root, relative);
    if (file !== root && !file.startsWith(root + sep)) throw new Error("Outside export");
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    const content = await readFile(file);
    response.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    response.end(content);
  } catch { response.writeHead(404); response.end("Not found"); }
}).listen(port, "127.0.0.1", () => console.log(`Static export ${root}: http://127.0.0.1:${port}/portfolio/`));
