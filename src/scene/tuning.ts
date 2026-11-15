const defaults = {
  ambient: 1,
  gain: 1.5,
  glow: 0.12,
  cellDesktop: 10,
  cellMobile: 11,
  dither: 0.65,
};

/** Shared with the existing post pass; slider events mutate this object in place. */
export const sceneTuning = {
  enabled: false,
  full: false,
  ...defaults,
};

/** Read browser flags only, leaving live tuning values untouched. */
export function initializeSceneTuning(): void {
  if (typeof window === "undefined") return;
  const query = new URLSearchParams(window.location.search);
  sceneTuning.enabled = query.has("tune");
  sceneTuning.full = query.get("ascii") === "full";
}

export function resetSceneTuning(): void {
  Object.assign(sceneTuning, defaults);
}
