import { calibrateTimeline, smoothstep } from "./timeline";
import { viewState } from "@/lib/store";
import styles from "@/components/sections/hero.module.css";

export const MAX_READING_ZONES = 8;
export const readingState = {
  count: 0,
  /** Normalized bounds, bottom-left origin; never whole section/card bounds. */
  rects: new Float32Array(MAX_READING_ZONES * 4),
  strengths: new Float32Array(MAX_READING_ZONES),
  width: 1,
  height: 1,
  /** Low-resolution 2D coverage for all visible lines; not a second WebGL scene. */
  mask: null as HTMLCanvasElement | null,
  maskVersion: 0,
};

/** Same CSS-pixel capsule SDF as the GPU, used by the garden instances. */
export function readingInfluence(x: number, y: number): number {
  let influence = 0;
  const r = readingState.rects;
  for (let i = 0; i < readingState.count; i++) {
    const n = i * 4;
    const hx = (r[n + 2] - r[n]) * readingState.width * 0.5;
    const hy = (r[n + 3] - r[n + 1]) * readingState.height * 0.5;
    const dx = Math.abs((x - (r[n] + r[n + 2]) * 0.5) * readingState.width);
    const dy = Math.abs((y - (r[n + 1] + r[n + 3]) * 0.5) * readingState.height);
    const radius = Math.min(hx, hy);
    const distance = Math.hypot(Math.max(dx - Math.max(hx - radius, 0), 0), Math.max(dy - Math.max(hy - radius, 0), 0)) - radius;
    influence = Math.max(influence, (1 - smoothstep(0, 24, distance)) * readingState.strengths[i]);
  }
  return influence;
}

interface ReadingSource {
  element: HTMLElement;
  top: number;
  bottom: number;
  fixed: boolean;
  strength: number;
  /** Local text-line bounds, measured only when layout changes. */
  lines: Float32Array;
  moving: boolean;
}

const SEMANTIC_TEXT = "h1,h2,h3,h4,p,a[href],button,li";

/** Layout-only allocations; transforms/scroll only translate cached lines. */
function measureSources(protectText: (element: HTMLElement) => void): ReadingSource[] {
  const selected = new Set<HTMLElement>();
  for (const mark of document.querySelectorAll<HTMLElement>("[data-reading]")) {
    if (mark.matches(SEMANTIC_TEXT)) selected.add(mark);
    else for (const child of mark.querySelectorAll<HTMLElement>(SEMANTIC_TEXT)) selected.add(child);
  }
  const sources: ReadingSource[] = [];
  for (const element of selected) {
    // A row/list is not text. Prefer its heading, paragraph and individual tags.
    if (element.matches("li") && element.querySelector(SEMANTIC_TEXT)) continue;
    const ancestor = element.parentElement?.closest<HTMLElement>("h1,h2,h3,h4,p,a[href],button");
    if (ancestor && selected.has(ancestor)) continue;
    const marquee = Boolean(element.closest("[data-marquee]"));
    if (element.closest(".sr-only") || (!marquee && element.closest('[aria-hidden="true"]'))) continue;
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    protectText(element);
    const lines: number[] = [];
    const display = element.dataset.reading === "display";
    // KINGRANE uses glyph-local shadows, never a broad spatial reading mask.
    if (display) continue;
    {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let text: Node | null;
      while ((text = walker.nextNode())) {
        if (!text.textContent?.trim() || text.parentElement?.closest(".sr-only")) continue;
        if (!marquee && text.parentElement?.closest('[aria-hidden="true"]')) continue;
        range.selectNodeContents(text);
        for (const rect of range.getClientRects()) {
          if (!rect.width || !rect.height) continue;
          const left = rect.left - box.left;
          const top = rect.top - box.top;
          const right = rect.right - box.left;
          const bottom = rect.bottom - box.top;
          let merged = false;
          for (let i = 0; i < lines.length; i += 4) {
            // Inline spans on the same line are one capsule, not duplicate masks.
            if (Math.abs(top - lines[i + 1]) < 4 && Math.abs(bottom - lines[i + 3]) < 4) {
              lines[i] = Math.min(lines[i], left);
              lines[i + 2] = Math.max(lines[i + 2], right);
              merged = true;
              break;
            }
          }
          if (!merged) lines.push(left, top, right, bottom);
        }
      }
    }
    if (lines.length) sources.push({
      element,
      top: box.top + window.scrollY,
      bottom: box.bottom + window.scrollY,
      fixed: Boolean(element.closest("[data-reading-fixed]")),
      strength: 1,
      lines: new Float32Array(lines),
      moving: marquee,
    });
  }
  return sources;
}

/** At most eight tight capsules. Never merge distant text into a black sheet. */
export function installReadingZones(): () => void {
  const mask = document.createElement("canvas");
  const paint = mask.getContext("2d", { alpha: false })!;
  readingState.mask = mask;
  let sources: ReadingSource[] = [];
  const priorities = new Float32Array(MAX_READING_ZONES);
  const boxes = new Float32Array(MAX_READING_ZONES * 4);
  const strengths = new Float32Array(MAX_READING_ZONES);
  const protectedElements = new Set<HTMLElement>();
  const protectText = (element: HTMLElement) => {
    if (!element.classList.contains(styles.reading)) {
      element.classList.add(styles.reading);
      protectedElements.add(element);
    }
  };
  let raf = 0;
  let movingTimer = 0;
  let layoutDirty = true;
  let active = true;

  const update = () => {
    raf = 0;
    if (document.hidden) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const scroll = window.scrollY;
    const scale = Math.min(width < 768 ? 256 : 512, width) / width;
    const maskWidth = Math.round(width * scale);
    const maskHeight = Math.round(height * scale);
    if (mask.width !== maskWidth || mask.height !== maskHeight) {
      mask.width = maskWidth;
      mask.height = maskHeight;
    }
    paint.setTransform(scale, 0, 0, scale, 0, 0);
    paint.shadowBlur = 0;
    paint.fillStyle = "#000";
    paint.fillRect(0, 0, width, height);
    paint.fillStyle = "#fff";
    paint.shadowColor = "#fff";
    paint.shadowBlur = 18 * scale;
    if (layoutDirty) {
      for (const element of protectedElements) {
        if (!element.isConnected) { element.classList.remove(styles.reading); protectedElements.delete(element); }
      }
      sources = measureSources(protectText);
      calibrateTimeline();
      const max = Math.max(1, document.documentElement.scrollHeight - height);
      viewState.scrollY = scroll;
      viewState.progress = Math.max(0, Math.min(1, scroll / max));
      viewState.velocity = 0;
      layoutDirty = false;
    }
    let count = 0;
    let moving = false;
    priorities.fill(-1);
    for (let i = 0; i < sources.length; i++) {
      const item = sources[i];
      if (!item.fixed && (item.bottom < scroll - 32 || item.top > scroll + height + 32)) continue;
      const rect = item.element.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > height) continue;
      if (item.moving) moving = true;
      const lines = item.lines;
      for (let line = 0; line < lines.length; line += 4) {
        const left = Math.max(-32, rect.left + lines[line] - 8);
        const top = rect.top + lines[line + 1] - 8;
        const right = Math.min(width + 32, rect.left + lines[line + 2] + 8);
        const bottom = rect.top + lines[line + 3] + 8;
        if (right <= 0 || left >= width || right <= left || bottom <= 0 || top >= height) continue;
        // Every line is protected, even when the eight repulsion capsules are
        // full. Extra horizontal padding covers the capsule's rounded ends.
        const radius = (bottom - top) * 0.5;
        paint.beginPath();
        paint.roundRect(left - radius, top, right - left + radius * 2, bottom - top, radius);
        paint.fill();
        const priority = item.strength * (1 - Math.min(0.7, Math.abs((top + bottom) * 0.5 / height - 0.45)));
        let slot = count;
        if (count === MAX_READING_ZONES) {
          slot = 0;
          for (let j = 1; j < count; j++) if (priorities[j] < priorities[slot]) slot = j;
          if (priority <= priorities[slot]) continue;
        } else count++;
        const offset = slot * 4;
        priorities[slot] = priority;
        strengths[slot] = item.strength;
        boxes[offset] = left;
        boxes[offset + 1] = top;
        boxes[offset + 2] = right;
        boxes[offset + 3] = bottom;
      }
    }
    readingState.width = width;
    readingState.height = height;
    for (let i = 0; i < count; i++) {
      const offset = i * 4;
      readingState.rects[offset] = boxes[offset] / width;
      readingState.rects[offset + 1] = 1 - boxes[offset + 3] / height;
      readingState.rects[offset + 2] = boxes[offset + 2] / width;
      readingState.rects[offset + 3] = 1 - boxes[offset + 1] / height;
      readingState.strengths[i] = strengths[i];
    }
    readingState.count = count;
    readingState.maskVersion++;
    window.clearTimeout(movingTimer);
    // Marquee text moves without scrolling. Refresh at 12.5 Hz only while it
    // is on screen; padded line masks cover movement between samples.
    if (moving) movingTimer = window.setTimeout(schedule, 80);
  };

  const schedule = () => { if (active && !document.hidden && !raf) raf = requestAnimationFrame(update); };
  const onLayout = () => { layoutDirty = true; schedule(); };
  const onVisibility = () => {
    if (document.hidden) { cancelAnimationFrame(raf); window.clearTimeout(movingTimer); raf = 0; }
    else onLayout();
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", onLayout, { passive: true });
  // Marquees stop on hover/focus: refresh their moving text bounds once then.
  document.addEventListener("pointerover", schedule, { passive: true });
  document.addEventListener("focusin", schedule);
  document.addEventListener("visibilitychange", onVisibility);
  const resize = new ResizeObserver(onLayout);
  resize.observe(document.body);
  const mutations = new MutationObserver(onLayout);
  mutations.observe(document.querySelector("main") ?? document.body, { childList: true, subtree: true });
  document.fonts.ready.then(() => { if (active) onLayout(); });
  schedule();

  return () => {
    active = false;
    cancelAnimationFrame(raf);
    window.clearTimeout(movingTimer);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", onLayout);
    document.removeEventListener("pointerover", schedule);
    document.removeEventListener("focusin", schedule);
    document.removeEventListener("visibilitychange", onVisibility);
    resize.disconnect();
    mutations.disconnect();
    for (const element of protectedElements) element.classList.remove(styles.reading);
    protectedElements.clear();
    readingState.count = 0;
    if (readingState.mask === mask) readingState.mask = null;
  };
}
