"use client";

import { useSyncExternalStore } from "react";

/**
 * Режим пост-обработки сцены. Выбор хранится в localStorage и общий для
 * переключателя в интерфейсе и для WebGL-канваса.
 *
 * - clean   — просто 3D
 * - ascii   — символы из атласа глифов (фирменная фишка)
 * - braille — брайлевские точки, «тактильная» фактура
 * - dither  — Байер 8×8, ретро-печать
 */
export type RenderMode = "clean" | "ascii" | "braille" | "dither";

export const RENDER_MODES: ReadonlyArray<{ id: RenderMode; label: string }> = [
  { id: "ascii", label: "ASCII" },
  { id: "braille", label: "BRAILLE" },
  { id: "dither", label: "DITHER" },
  { id: "clean", label: "CLEAN" },
];

const STORAGE_KEY = "kingrane:render-mode";

let current: RenderMode = "ascii";
const subscribers = new Set<() => void>();

export function getRenderMode(): RenderMode {
  return current;
}

export function setRenderMode(mode: RenderMode): void {
  if (mode === current) return;
  current = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* приватный режим — просто не запоминаем */
  }
  subscribers.forEach((fn) => fn());
}

/** Вызывается один раз на клиенте: подхватить прошлый выбор. */
export function hydrateRenderMode(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as RenderMode | null;
    if (saved && RENDER_MODES.some((m) => m.id === saved)) {
      current = saved;
      subscribers.forEach((fn) => fn());
    }
  } catch {
    /* ignore */
  }
}

function subscribe(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

export function useRenderMode(): RenderMode {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => "ascii" as RenderMode,
  );
}
