import { calibrateTimeline, smoothstep } from "./timeline";
import { viewState } from "@/lib/store";

export const MAX_READING_ZONES = 8;
export const readingState = {
  count: 0,
  /** Normalized screen rectangles, origin bottom-left, same space as shaders. */
  rects: new Float32Array(MAX_READING_ZONES * 4),
};

/** CPU counterpart for moving flower instances away from reading zones. */
export function readingInfluence(x: number, y: number): number {
  let influence = 0;
  for (let i = 0; i < readingState.count; i++) {
    const n = i * 4;
    const r = readingState.rects;
    const dx = Math.max(r[n] - x, 0, x - r[n + 2]);
    const dy = Math.max(r[n + 1] - y, 0, y - r[n + 3]);
    influence = Math.max(influence, 1 - smoothstep(0, 0.055, Math.hypot(dx, dy)));
  }
  return influence;
}

/** Batched visible DOM reads; at most 8 merged uniforms, never React state. */
export function installReadingZones(): () => void {
  let elements: Array<{ element: HTMLElement; top: number; bottom: number; fixed: boolean }> = [];
  let boxes = new Float32Array(0);
  let raf = 0;
  let layoutDirty = true;
  let active = true;

  const update = () => {
    raf = 0;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const scroll = window.scrollY;
    if (layoutDirty) {
      elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reading]"))
        // If a whole card is a zone, don't count its nested heading a second time.
        .filter((element) => !element.parentElement?.closest("[data-reading]"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return { element, top: rect.top + scroll, bottom: rect.bottom + scroll, fixed: element.hasAttribute("data-reading-fixed") };
        });
      boxes = new Float32Array(elements.length * 4);
      calibrateTimeline();
      // Layout/filters change the denominator even without a scroll event.
      // Do not turn that recalibration into fictitious scroll velocity.
      const max = Math.max(1, document.documentElement.scrollHeight - height);
      viewState.scrollY = scroll;
      viewState.progress = Math.max(0, Math.min(1, scroll / max));
      viewState.velocity = 0;
      layoutDirty = false;
    }
    let count = 0;
    for (let i = 0; i < elements.length; i++) {
      const item = elements[i];
      if (!item.fixed && (item.bottom < scroll - 24 || item.top > scroll + height + 24)) continue;
      const rect = item.element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > height) continue;
      const offset = count * 4;
      const pad = 12;
      boxes[offset] = rect.left - pad;
      boxes[offset + 1] = rect.top - pad;
      boxes[offset + 2] = rect.right + pad;
      boxes[offset + 3] = rect.bottom + pad;
      count++;
    }

    // No visible ninth block is discarded. Merge the pair adding the least
    // protected area, only on dense viewports; reuse the preallocated buffer.
    while (count > MAX_READING_ZONES) {
      let a = 0, b = 1, cost = Infinity;
      for (let i = 0; i < count - 1; i++) for (let j = i + 1; j < count; j++) {
        const x = i * 4, y = j * 4;
        const area = (Math.max(boxes[x + 2], boxes[y + 2]) - Math.min(boxes[x], boxes[y]))
          * (Math.max(boxes[x + 3], boxes[y + 3]) - Math.min(boxes[x + 1], boxes[y + 1]));
        const added = area - (boxes[x + 2] - boxes[x]) * (boxes[x + 3] - boxes[x + 1])
          - (boxes[y + 2] - boxes[y]) * (boxes[y + 3] - boxes[y + 1]);
        if (added < cost) { cost = added; a = i; b = j; }
      }
      const x = a * 4, y = b * 4;
      boxes[x] = Math.min(boxes[x], boxes[y]);
      boxes[x + 1] = Math.min(boxes[x + 1], boxes[y + 1]);
      boxes[x + 2] = Math.max(boxes[x + 2], boxes[y + 2]);
      boxes[x + 3] = Math.max(boxes[x + 3], boxes[y + 3]);
      count--;
      for (let k = 0; k < 4; k++) boxes[y + k] = boxes[count * 4 + k];
    }
    for (let i = 0; i < count; i++) {
      const offset = i * 4;
      readingState.rects[offset] = boxes[offset] / width;
      readingState.rects[offset + 1] = 1 - boxes[offset + 3] / height;
      readingState.rects[offset + 2] = boxes[offset + 2] / width;
      readingState.rects[offset + 3] = 1 - boxes[offset + 1] / height;
    }
    readingState.count = count;
  };

  const schedule = () => { if (active && !raf) raf = requestAnimationFrame(update); };
  const onLayout = () => { layoutDirty = true; schedule(); };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", onLayout, { passive: true });
  const resize = new ResizeObserver(onLayout);
  resize.observe(document.body);
  const mutations = new MutationObserver(onLayout);
  mutations.observe(document.querySelector("main") ?? document.body, { childList: true, subtree: true });
  document.fonts.ready.then(() => { if (active) onLayout(); });
  schedule();

  return () => {
    active = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", onLayout);
    resize.disconnect();
    mutations.disconnect();
    readingState.count = 0;
  };
}
