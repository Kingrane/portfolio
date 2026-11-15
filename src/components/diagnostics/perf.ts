import Stats from "stats-gl";
import type { RenderCallback, RootState } from "@react-three/fiber";
import type { Mesh, ShaderMaterial } from "three";
import { timeline, worldState } from "@/scene/timeline";
import { viewState } from "@/lib/store";

type Sample = { at: number; section: string; label: string; ms: number };
type Frame = { at: number; section: string; interval: number | null; cpu: number; calls: number; triangles: number; quality: number; dpr: number };
type Pending = { query: WebGLQuery; at: number; section: string; label: string; epoch: number };
type TimerExtension = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };
type Labeled = RenderCallback & { perfLabel?: string; perfWrapped?: boolean };

declare global {
  interface Window { __portfolioPerf?: PerfAPI }
}

/** Diagnostics are deliberately separate from the normal application chunk. */
export function installPerf(root: RootState): void {
  const host = window as Window & { __portfolioPerf?: ReturnType<typeof createProfiler> };
  host.__portfolioPerf?.dispose();
  host.__portfolioPerf = createProfiler(root);
}

function createProfiler(root: RootState) {
  const renderer = root.gl;
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExtension | null;
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const hardware = {
    renderer: debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
    vendor: debug ? String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR)),
    timerQuery: !!ext, gpuMemoryBytes: null,
  };
  const stats = new Stats({ trackGPU: false, trackHz: false, graphsPerSecond: 10, logsPerSecond: 2 });
  // Native GL, not the Three renderer: stats-gl must not wrap render or nest queries.
  void stats.init(gl);
  const panel = document.createElement("aside");
  panel.dataset.perfPanel = "";
  panel.style.cssText = "position:fixed;left:8px;top:8px;z-index:9999;pointer-events:none;background:#050507;color:#ededf2;padding:6px;font:11px monospace;white-space:pre";
  const text = document.createElement("pre");
  text.style.margin = "4px 0 0";
  panel.append(stats.dom, text);
  document.body.append(panel);
  const data = { frames: [] as Frame[], cpu: [] as Sample[], gpu: [] as Sample[], visibility: [] as { at: number; hidden: boolean; frames: number }[] };
  const pending: Pending[] = [];
  const restoreCallbacks = new Map<{ current: RenderCallback }, RenderCallback>();
  const originalRender = renderer.render;
  const originalReset = renderer.info.autoReset;
  renderer.info.autoReset = false;
  let recording = false, disposed = false, frame = 0, epoch = 0;
  let frameStart = 0, previous: number | null = null, frameSection = "hero";
  let fullQuery: Pending | null = null;
  let lastUI = 0, lastGPU: number | null = null, invalidQueries = 0;
  let overflow = false;

  function section(): string {
    if (worldState.hole > 0.001) return "hero";
    if (viewState.progress < timeline[5].at) return "stack";
    if (viewState.progress < timeline[7].at) return "projects";
    if (viewState.progress < timeline[8].at) return "garden";
    return "footer";
  }
  function append<T>(array: T[], value: T): void {
    if (!recording) return;
    if (array.length < 500000) array.push(value);
    else overflow = true;
  }
  function beginQuery(label: string): Pending | null {
    if (!ext || gl.isContextLost() || pending.length >= 128 || (!recording && panel.hidden)) return null;
    // A third-party query is never interrupted or nested.
    if (gl.getQuery(ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) return null;
    const query = gl.createQuery();
    if (!query) return null;
    gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    return { query, at: frameStart, section: frameSection, label, epoch };
  }
  function endQuery(item: Pending | null): void {
    if (!item || !ext) return;
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    pending.push(item);
  }
  function pollQueries(): void {
    if (!ext || gl.isContextLost()) return;
    const disjoint = !!gl.getParameter(ext.GPU_DISJOINT_EXT);
    for (let i = pending.length - 1; i >= 0; i--) {
      const item = pending[i];
      if (!disjoint && !gl.getQueryParameter(item.query, gl.QUERY_RESULT_AVAILABLE)) continue;
      if (disjoint) invalidQueries++;
      else {
        const ms = Number(gl.getQueryParameter(item.query, gl.QUERY_RESULT)) / 1e6;
        if (item.label === "full-frame") lastGPU = ms;
        if (item.epoch === epoch) append(data.gpu, { at: item.at, section: item.section, label: item.label, ms });
      }
      gl.deleteQuery(item.query);
      pending.splice(i, 1);
    }
  }
  function passLabel(scene: Parameters<typeof originalRender>[0], camera: Parameters<typeof originalRender>[1]): string {
    if (scene.name === "World scene") return camera.layers.mask === 2 ? "Stars layer" : "World scene";
    if (scene.name) return scene.name;
    const material = (scene.children[0] as Mesh | undefined)?.material as ShaderMaterial | undefined;
    if (material?.name === "ASCII pass" || material?.name === "Tone/contrast/dither output") return material.name;
    const shader = material?.fragmentShader ?? "";
    if (shader.includes("uGlyphAtlas")) return "ASCII pass";
    if (shader.includes("uDither")) return "Tone/contrast/dither output";
    return "Other/copy pass";
  }
  renderer.render = function (scene, camera) {
    const label = passLabel(scene, camera);
    const query = frame % 20 === 0 ? beginQuery(label) : null;
    const start = performance.now();
    try { return originalRender.call(this, scene, camera); }
    finally {
      append(data.cpu, { at: frameStart, section: frameSection, label: `render:${label}`, ms: performance.now() - start });
      endQuery(query);
    }
  };

  const start: RenderCallback = () => {
    frameStart = performance.now();
    frameSection = section();
    frame++;
    renderer.info.reset();
    pollQueries();
    // React may replace refs after a quality change; wrap the new callback once.
    for (const subscriber of root.get().internal.subscribers) {
      const callback = subscriber.ref.current as Labeled;
      if (!callback.perfLabel || callback.perfWrapped) continue;
      const wrapped: Labeled = (state, delta, xr) => {
        const start = performance.now();
        try { callback(state, delta, xr); }
        finally { append(data.cpu, { at: frameStart, section: frameSection, label: callback.perfLabel!, ms: performance.now() - start }); }
      };
      wrapped.perfWrapped = true;
      restoreCallbacks.set(subscriber.ref, callback);
      subscriber.ref.current = wrapped;
    }
    if (!panel.hidden) stats.begin();
    // Full-frame and per-pass GPU samples use different frames, never nested.
    fullQuery = frame % 20 === 10 ? beginQuery("full-frame") : null;
  };
  const end: RenderCallback = () => {
    endQuery(fullQuery);
    fullQuery = null;
    const now = performance.now();
    const quality = Number(renderer.domElement.closest("[data-world-canvas]")?.getAttribute("data-qa-quality") ?? 1);
    append(data.frames, { at: frameStart, section: frameSection, interval: previous === null ? null : frameStart - previous,
      cpu: now - frameStart, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, quality, dpr: renderer.getPixelRatio() });
    previous = frameStart;
    if (!panel.hidden) {
      stats.end(); stats.update();
      if (now - lastUI > 1000) {
        text.textContent = `${frameSection} · q ${quality.toFixed(2)} · DPR ${renderer.getPixelRatio().toFixed(2)}\n`
          + `${renderer.info.render.calls} calls · ${renderer.info.render.triangles} triangles\n`
          + `${renderer.info.memory.textures} textures · ${renderer.info.memory.geometries} geometries · ${renderer.info.programs?.length ?? 0} programs\n`
          + `GPU ${lastGPU === null ? (ext ? "waiting" : "unavailable") : lastGPU.toFixed(2) + " ms"}`;
        lastUI = now;
      }
    }
  };
  const store = root.get().internal.subscribers[0]?.store;
  if (!store) throw new Error("?perf requires mounted R3F subscribers");
  const unsubscribeStart = root.internal.subscribe({ current: start }, -1000, store);
  const unsubscribeEnd = root.internal.subscribe({ current: end }, 1000, store);
  const onVisibility = () => {
    data.visibility.push({ at: performance.now(), hidden: document.hidden, frames: frame });
    previous = null;
  };
  document.addEventListener("visibilitychange", onVisibility);

  function snapshot() {
    return { at: performance.now(), frames: frame, hidden: document.hidden, frameloop: root.get().frameloop,
      hardware, info: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
        textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, programs: renderer.info.programs?.length ?? 0 },
      quality: Number(renderer.domElement.closest("[data-world-canvas]")?.getAttribute("data-qa-quality") ?? 1),
      dpr: renderer.getPixelRatio(), canvas: [renderer.domElement.width, renderer.domElement.height],
      overflow, invalidQueries };
  }
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    recording = false;
    unsubscribeStart(); unsubscribeEnd();
    for (const [ref, callback] of restoreCallbacks) {
      if ((ref.current as Labeled).perfWrapped) ref.current = callback;
    }
    renderer.render = originalRender;
    renderer.info.autoReset = originalReset;
    for (const item of pending) gl.deleteQuery(item.query);
    pending.length = 0;
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", dispose);
    stats.dispose(); panel.remove();
  }
  window.addEventListener("pagehide", dispose);
  return {
    snapshot, dispose,
    panel: (visible: boolean) => { panel.hidden = !visible; },
    reset: () => { epoch++; data.frames.length = data.cpu.length = data.gpu.length = data.visibility.length = 0; previous = null; overflow = false; invalidQueries = 0; recording = true; },
    stop: () => { pollQueries(); recording = false; return { ...snapshot(), data: structuredClone(data) }; },
  };
}

export type PerfAPI = ReturnType<typeof createProfiler>;
