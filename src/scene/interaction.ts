import styles from "@/components/sections/hero.module.css";

/** One fixed history for the existing scene; no canvas, RAF or React state. */
export const TRAIL_SAMPLES = 8;
export const interactionState = {
  /** CSS x/y from top-left, monotonic birth time in seconds, energy. */
  trail: new Float32Array(TRAIL_SAMPLES * 4),
};

let trailHead = 0;
let lastX = 0;
let lastY = 0;
let lastTime = -1;
let hasPosition = false;

export function clearAsciiInteractions(): void {
  interactionState.trail.fill(0);
  for (let i = 0; i < TRAIL_SAMPLES; i++) interactionState.trail[i * 4 + 2] = -1000;
  trailHead = 0;
  lastTime = -1;
  hasPosition = false;
}

/** Called by pointer instrumentation. Sampling is bounded, independent of FPS. */
export function recordAsciiPointer(x: number, y: number, time: number): void {
  const distance = hasPosition ? Math.hypot(x - lastX, y - lastY) : 12;
  const elapsed = lastTime >= 0 ? time - lastTime : 0.03;
  if (hasPosition && (elapsed < 0.028 || distance < 5)) return;
  const offset = trailHead * 4;
  const trail = interactionState.trail;
  trail[offset] = x;
  trail[offset + 1] = y;
  trail[offset + 2] = time;
  trail[offset + 3] = Math.min(1, 0.55 + distance / Math.max(1, elapsed * 1600));
  trailHead = (trailHead + 1) % TRAIL_SAMPLES;
  lastX = x;
  lastY = y;
  lastTime = time;
  hasPosition = true;
}

const TARGETS = 'a[href],button:not(:disabled),[role="button"],[data-interactive],[data-marquee-track] li';

/** Delegated feedback covers new filter buttons/cards without extra handlers. */
export function installAsciiInteractions(): () => void {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let hovered: HTMLElement | null = null;
  let focused: HTMLElement | null = null;
  clearAsciiInteractions();
  const targetOf = (node: EventTarget | null) => node instanceof Element ? node.closest<HTMLElement>(TARGETS) : null;
  const setHovered = (target: HTMLElement | null) => {
    if (hovered === target) return;
    hovered?.removeAttribute("data-ascii-hover");
    hovered?.classList.remove(styles.hovered);
    hovered = target;
    if (hovered) { hovered.setAttribute("data-ascii-hover", ""); hovered.classList.add(styles.hovered); }
  };
  const onOver = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    setHovered(targetOf(event.target));
  };
  const onOut = (event: PointerEvent) => setHovered(targetOf(event.relatedTarget));
  const onFocus = (event: FocusEvent) => {
    focused?.removeAttribute("data-ascii-focus");
    focused?.classList.remove(styles.focused);
    focused = targetOf(event.target);
    if (focused) { focused.setAttribute("data-ascii-focus", ""); focused.classList.add(styles.focused); }
  };
  const onBlur = (event: FocusEvent) => {
    if (targetOf(event.relatedTarget) === focused) return;
    focused?.removeAttribute("data-ascii-focus");
    focused?.classList.remove(styles.focused);
    focused = null;
  };
  const reset = () => {
    setHovered(null);
    focused?.removeAttribute("data-ascii-focus");
    focused?.classList.remove(styles.focused);
    focused = null;
    clearAsciiInteractions();
  };
  const onVisibility = () => { if (document.hidden) reset(); };
  document.addEventListener("pointerover", onOver, { passive: true });
  document.addEventListener("pointerout", onOut, { passive: true });
  document.addEventListener("focusin", onFocus);
  document.addEventListener("focusout", onBlur);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("blur", reset);
  window.addEventListener("resize", reset, { passive: true });
  reduce.addEventListener("change", reset);

  return () => {
    document.removeEventListener("pointerover", onOver);
    document.removeEventListener("pointerout", onOut);
    document.removeEventListener("focusin", onFocus);
    document.removeEventListener("focusout", onBlur);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("blur", reset);
    window.removeEventListener("resize", reset);
    reduce.removeEventListener("change", reset);
    reset();
  };
}
