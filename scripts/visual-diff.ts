import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { ssim } from "ssim.js";

const baseline = resolve(process.env.VISUAL_BASELINE ?? "perf/baseline");
const candidate = resolve(process.env.VISUAL_CANDIDATE ?? "perf/candidate");
const output = resolve(process.env.VISUAL_DIFF_OUT ?? "perf/diff");
const classification = process.env.VISUAL_CLASS ?? "lossless";
const aManifest = JSON.parse(await readFile(join(baseline, "manifest.json"), "utf8"));
const bManifest = JSON.parse(await readFile(join(candidate, "manifest.json"), "utf8"));
if (aManifest.chrome !== bManifest.chrome || aManifest.freeze !== bManifest.freeze) throw new Error("Chrome/freeze mismatch: not a valid visual comparison.");
if (aManifest.cssRaster !== bManifest.cssRaster) throw new Error("CSS raster mode mismatch.");
if (aManifest.frames.length !== bManifest.frames.length) throw new Error("Frame count mismatch.");
if (aManifest.errors.length || bManifest.errors.length) throw new Error("Runtime errors invalidate comparison.");
await mkdir(output, { recursive: true });
const results = [];
for (const frame of aManifest.frames) {
  const matching = bManifest.frames.find((item: { name: string }) => item.name === frame.name);
  if (!matching || JSON.stringify(frame.geometry) !== JSON.stringify(matching.geometry)) throw new Error(`Layout/DPR mismatch: ${frame.name}`);
  const a = PNG.sync.read(await readFile(join(baseline, frame.name)));
  const b = PNG.sync.read(await readFile(join(candidate, frame.name)));
  if (a.width !== b.width || a.height !== b.height) throw new Error(`Image dimensions differ: ${frame.name}`);
  const diff = new PNG({ width: a.width, height: a.height });
  // Strict byte/color comparison, including AA. No threshold hiding a small change.
  const pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0, includeAA: true });
  const percent = pixels / (a.width * a.height) * 100;
  const score = pixels === 0 ? 1 : ssim(
    { width: a.width, height: a.height, data: new Uint8ClampedArray(a.data) },
    { width: b.width, height: b.height, data: new Uint8ClampedArray(b.data) },
    { downsample: "original" },
  ).mssim;
  await writeFile(join(output, frame.name), PNG.sync.write(diff));
  // Physical 400x400 pixels; displayed at 100%, never rescaled to conceal damage.
  const size = 400;
  let left = Math.max(0, Math.floor((a.width - size) / 2)), top = Math.max(0, Math.floor((a.height - size) / 2)), best = -1;
  for (let y = 0; y <= a.height - size; y += 200) for (let x = 0; x <= a.width - size; x += 200) {
    let changed = 0;
    for (let yy = y; yy < y + size; yy++) for (let xx = x; xx < x + size; xx++) {
      const i = (yy * a.width + xx) * 4;
      if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) changed++;
    }
    if (changed > best) { best = changed; left = x; top = y; }
  }
  const crop = new PNG({ width: 1200, height: 400 });
  [a, b, diff].forEach((image, index) => PNG.bitblt(image, crop, left, top, 400, 400, index * 400, 0));
  await writeFile(join(output, `crop-${frame.name}`), PNG.sync.write(crop));
  results.push({ name: frame.name, pixels, percent, ssim: score, crop: { left, top, width: 400, height: 400 },
    pass: classification === "lossless" ? percent <= 0.1 : score >= 0.985,
    approved: classification === "perceptual" ? false : null });
  console.log(`${frame.name}: ${percent.toFixed(5)}%, SSIM ${score.toFixed(6)}`);
}
const report = { classification, baseline, candidate, results, pass: results.every((item) => item.pass), requiresUserApproval: classification === "perceptual" };
await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
await writeFile(join(output, "report.md"), `# Visual diff — ${classification}\n\n` + "Кропы: до | после | разница, 400×400 физических пикселей, 100%.\n\n"
  + "| Кадр | Различие | SSIM | Прошёл |\n|---|---:|---:|---|\n"
  + results.map((item) => `| [${item.name}](${item.name}) | ${item.percent.toFixed(5)}% | ${item.ssim.toFixed(6)} | ${item.pass} |`).join("\n")
  + "\n\n" + results.map((item) => `### ${item.name}\n![до | после | разница](crop-${item.name})`).join("\n\n"));
if (!report.pass) process.exitCode = 1;
