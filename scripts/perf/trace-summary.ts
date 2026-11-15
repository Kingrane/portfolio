/** Analyze Chrome JSON traces, not Playwright screenshots or fabricated frame rates. */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { output, save } from "./common.ts";

type CallFrame = { functionName: string; url: string; lineNumber: number };
type CPUNode = { id: number; callFrame: CallFrame };
type AllocationNode = { callFrame: CallFrame; selfSize: number; children?: AllocationNode[] };
type Event = { name: string; ph: string; ts: number; dur?: number; pid: number; tid: number; id?: string;
  args?: { data?: { cpuProfile?: { nodes?: CPUNode[]; samples?: number[] }; timeDeltas?: number[] } } };
const distribution = (values: number[]) => {
  const sorted = values.slice().sort((a, b) => a - b);
  return { count: sorted.length, totalMs: sorted.reduce((a, b) => a + b, 0), maxMs: sorted.at(-1) ?? 0,
    p95Ms: sorted.length ? sorted[Math.floor((sorted.length - 1) * 0.95)] : null };
};
for (const file of (await readdir(output)).filter((name) => /^(desktop-headless|desktop-120hz|mobile)\.trace\.json$/.test(name))) {
  const parsed = JSON.parse(await readFile(join(output, file), "utf8"));
  const events = parsed.traceEvents as Event[];
  const marker = events.find((event) => event.name === "perf:autoscroll:start");
  if (!marker) throw new Error(`Missing scenario marker in ${file}`);
  const main = events.filter((event) => event.pid === marker.pid && event.tid === marker.tid);
  const complete = main.filter((event) => event.ph === "X" && typeof event.dur === "number");
  // Normalize begin/end events where Chrome uses separate records.
  const stack: Event[] = [];
  for (const event of main) {
    if (event.ph === "B") stack.push(event);
    if (event.ph === "E") {
      const start = stack.pop();
      if (start) complete.push({ ...start, ph: "X", dur: event.ts - start.ts });
    }
  }
  const windows = ["autoscroll", "hero-pointer", "garden-pointer"].map((name) => {
    const start = events.find((event) => event.name === `perf:${name}:start`)!.ts;
    const end = events.find((event) => event.name === `perf:${name}:end`)!.ts;
    const local = complete.filter((event) => event.ts >= start && event.ts < end);
    const tasks = local.filter((event) => /^(RunTask|ThreadControllerImpl::RunTask)$/.test(event.name));
    const long = tasks.filter((event) => event.dur! > 50000);
    const frames = local.filter((event) => event.name === "FireAnimationFrame");
    const inFrame = (event: Event) => frames.some((frame) => event.ts >= frame.ts && event.ts < frame.ts + frame.dur!);
    const group = (names: string[]) => Object.fromEntries(names.map((label) => {
      const matches = local.filter((event) => event.name === label);
      return [label, { ...distribution(matches.map((event) => event.dur! / 1000)), inAnimationCallback: distribution(matches.filter(inFrame).map((event) => event.dur! / 1000)) }];
    }));
    return { name, durationSeconds: (end - start) / 1e6, tasks: distribution(tasks.map((event) => event.dur! / 1000)),
      longTasks: distribution(long.map((event) => event.dur! / 1000)), longTaskEvents: long.map((event) => ({ atMs: (event.ts - start) / 1000, ms: event.dur! / 1000 })),
      rendering: group(["Layout", "UpdateLayoutTree", "RecalculateStyles", "Paint", "CompositeLayers", "FireAnimationFrame"]),
      gc: group(["MajorGC", "MinorGC", "V8.GC_SCAVENGER", "V8.GC_MARK_COMPACTOR"]),
      expensiveEvents: Object.entries(Object.groupBy(local, (event) => event.name)).map(([name, matches]) => ({ name, ...distribution(matches!.map((event) => event.dur! / 1000)) })).sort((a, b) => b.totalMs - a.totalMs).slice(0, 20) };
  });
  // Sampled CPU self time from V8 ProfileChunk records (inclusive event times cannot be summed).
  const profiles = new Map<string, { nodes: Map<number, CPUNode>; samples: number[]; deltas: number[] }>();
  for (const event of events.filter((event) => event.pid === marker.pid && event.name === "ProfileChunk")) {
    const id = `${event.pid}:${event.tid}:${event.id}`;
    const item = profiles.get(id) ?? { nodes: new Map<number, CPUNode>(), samples: [] as number[], deltas: [] as number[] };
    const data = event.args?.data;
    for (const node of data?.cpuProfile?.nodes ?? []) item.nodes.set(node.id, node);
    item.samples.push(...(data?.cpuProfile?.samples ?? [])); item.deltas.push(...(data?.timeDeltas ?? []));
    profiles.set(id, item);
  }
  const functions = new Map<string, { function: string; url: string; line: number; selfMs: number; samples: number }>();
  for (const item of profiles.values()) item.samples.forEach((nodeID, index) => {
    const node = item.nodes.get(nodeID); if (!node) return;
    const frame = node.callFrame; const key = `${frame.url}:${frame.lineNumber}:${frame.functionName}`;
    const value = functions.get(key) ?? { function: frame.functionName || "(anonymous)", url: frame.url, line: frame.lineNumber, selfMs: 0, samples: 0 };
    value.selfMs += (item.deltas[index] ?? 0) / 1000; value.samples++; functions.set(key, value);
  });
  const allocationsPath = file.replace(".trace.json", "-allocations.json");
  const allocations = JSON.parse(await readFile(join(output, allocationsPath), "utf8"));
  const allocated: { function: string; url: string; bytes: number }[] = [];
  const visit = (node: AllocationNode) => { if (node.selfSize) allocated.push({ function: node.callFrame.functionName || "(anonymous)", url: node.callFrame.url, bytes: node.selfSize }); for (const child of node.children ?? []) visit(child); };
  visit(allocations.profile.head);
  const report = { file, mainThread: { pid: marker.pid, tid: marker.tid }, scenarios: windows,
    sampledCPU: [...functions.values()].sort((a, b) => b.selfMs - a.selfMs).slice(0, 40),
    sampledAllocations: allocated.sort((a, b) => b.bytes - a.bytes).slice(0, 30),
    note: "Trace overhead: do not use its cadence as primary baseline. Nested event totals are inclusive, not additive. Allocation sampling observes survivors, not every transient allocation; ?perf arrays are included. CPU samples use emitted/minified function names." };
  await save(join(output, file.replace(".trace.json", "-trace-summary.json")), report);
  console.log(JSON.stringify({ file, scenarios: windows.map((s) => ({ name: s.name, longTasks: s.longTasks, layout: s.rendering.Layout, style: s.rendering.UpdateLayoutTree, gc: s.gc.MinorGC })) }, null, 2));
}
