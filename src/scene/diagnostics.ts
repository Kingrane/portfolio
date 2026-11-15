import type { RenderCallback, RootState } from "@react-three/fiber";

const query = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
const value = query?.get("freeze");
export const freezeTime = value != null && value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0
  ? Number(value) : null;
export const frozen = freezeTime !== null;
export const sceneTime = (elapsed: number): number => freezeTime ?? elapsed;
export const eventTime = (): number => freezeTime ?? performance.now() * 0.001;

/** Metadata only: the normal render callback is not wrapped or measured. */
export function diagnosticFrame(label: string, callback: RenderCallback): RenderCallback {
  return Object.assign(callback, { perfLabel: label });
}

/** No diagnostic library, observers or timer queries are loaded without ?perf. */
export function loadPerf(state: RootState): void {
  if (!query?.has("perf")) return;
  void import("@/components/diagnostics/perf").then(({ installPerf }) => installPerf(state));
}
