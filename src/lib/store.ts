/**
 * Общие координаты указателя и скролла для сцены.
 *
 * Зачем не React state: курсор двигается 120 раз в секунду, скролл — тоже.
 * Если гонять это через useState, React будет перерисовывать дерево на каждое
 * движение. Здесь — обычный мутабельный объект без перерисовок React.
 */

import { clearAsciiInteractions, installAsciiInteractions, recordAsciiPointer } from "@/scene/interaction";

export interface PointerState {
  /** Пиксели от левого верхнего угла окна */
  x: number;
  y: number;
  /** Нормализованные координаты -1..1 (WebGL: y снизу вверх) */
  nx: number;
  ny: number;
  down: boolean;
  /** true, если указатель в пределах окна */
  inside: boolean;
}

export interface ViewState {
  /** 0 — верх страницы, 1 — низ */
  progress: number;
  /** Скролл в пикселях */
  scrollY: number;
  /** Скорость скролла, px/кадр (для инерции сцены) */
  velocity: number;
}

export const pointerState: PointerState = {
  x: 0,
  y: 0,
  nx: 0,
  ny: 0,
  down: false,
  inside: false,
};

export const viewState: ViewState = {
  progress: 0,
  scrollY: 0,
  velocity: 0,
};

let installed = false;

/**
 * Вешает слушатели один раз на всё приложение.
 * Вызывается из <SmoothScroll />, повторные вызовы игнорируются.
 */
export function installInstrumentation(): () => void {
  if (installed || typeof window === "undefined") return () => {};
  installed = true;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cleanupInteractions = installAsciiInteractions();

  const onPointerMove = (e: PointerEvent) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    pointerState.x = e.clientX;
    pointerState.y = e.clientY;
    pointerState.nx = (e.clientX / w) * 2 - 1;
    pointerState.ny = -((e.clientY / h) * 2 - 1);
    pointerState.inside = true;
    if (!reduce.matches && !document.hidden) recordAsciiPointer(e.clientX, e.clientY, performance.now() * 0.001);
  };
  const onPointerDown = (e: PointerEvent) => {
    onPointerMove(e);
    pointerState.down = true;
  };
  const onPointerUp = () => (pointerState.down = false);
  const onLeave = () => {
    pointerState.inside = false;
    pointerState.down = false;
  };
  const onBlur = () => { onLeave(); clearAsciiInteractions(); };
  const onVisibility = () => { if (document.hidden) onBlur(); };
  const onPointerOut = (e: PointerEvent) => { if (!e.relatedTarget) onLeave(); };

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("pointerleave", onLeave, { passive: true });
  window.addEventListener("blur", onBlur);
  document.addEventListener("pointerout", onPointerOut, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      pointerState.x = t.clientX;
      pointerState.y = t.clientY;
      pointerState.nx = (t.clientX / w) * 2 - 1;
      pointerState.ny = -((t.clientY / h) * 2 - 1);
      pointerState.inside = true;
      if (!reduce.matches && !document.hidden) recordAsciiPointer(t.clientX, t.clientY, performance.now() * 0.001);
  };
  window.addEventListener("touchmove", onTouchMove, { passive: true });

  return () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("pointerout", onPointerOut);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("touchmove", onTouchMove);
    cleanupInteractions();
    onLeave();
    installed = false;
  };
}

/** Пересчитать прогресс скролла и скорость. Вызывается из скролл-провайдера. */
export function syncScroll(scrollY: number): void {
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  viewState.velocity = scrollY - viewState.scrollY;
  viewState.scrollY = scrollY;
  viewState.progress = Math.min(1, Math.max(0, scrollY / max));
}

/** Modal navigation pauses Lenis while its native dialog is open. */
interface ScrollDriver {
  stop: () => void;
  start: () => void;
}

let driver: ScrollDriver | null = null;

export function setScrollDriver(instance: ScrollDriver | null): void {
  driver = instance;
}

export function pauseScroll(paused: boolean): void {
  if (paused) driver?.stop();
  else driver?.start();
}
