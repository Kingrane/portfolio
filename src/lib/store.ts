/**
 * Одно место, где живёт «телеметрия» интерфейса.
 *
 * Зачем не React state: курсор двигается 120 раз в секунду, скролл — тоже.
 * Если гонять это через useState, React будет перерисовывать дерево на каждое
 * движение. Здесь — обычный мутабельный объект, который читают HUD и WebGL,
 * а React трогаем только когда нужно (HUD обновляется 10 раз в секунду).
 */

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
  /** Кадры в секунду, измеренные в общем цикле */
  fps: number;
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
  fps: 60,
};

/** Угол курсора относительно центра экрана в градусах: 0° — вправо, 90° — вверх. */
export function pointerTheta(): number {
  const { nx, ny } = pointerState;
  const deg = (Math.atan2(ny, nx) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
}

let installed = false;

/**
 * Вешает слушатели один раз на всё приложение.
 * Вызывается из <Instrumentation />, повторные вызовы игнорируются.
 */
export function installInstrumentation(): () => void {
  if (installed || typeof window === "undefined") return () => {};
  installed = true;

  const onPointerMove = (e: PointerEvent) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    pointerState.x = e.clientX;
    pointerState.y = e.clientY;
    pointerState.nx = (e.clientX / w) * 2 - 1;
    pointerState.ny = -((e.clientY / h) * 2 - 1);
    pointerState.inside = true;
  };
  const onPointerDown = () => (pointerState.down = true);
  const onPointerUp = () => (pointerState.down = false);
  const onLeave = () => (pointerState.inside = false);

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("pointerleave", onLeave, { passive: true });
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
  };
  window.addEventListener("touchmove", onTouchMove, { passive: true });

  let frames = 0;
  let last = performance.now();
  let raf = 0;

  const tick = (now: number) => {
    frames++;
    const dt = now - last;
    if (dt >= 500) {
      viewState.fps = Math.round((frames * 1000) / dt);
      frames = 0;
      last = now;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("touchmove", onTouchMove);
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

/** Ссылка на Lenis: нужна, чтобы пасхалка могла прокрутить страницу наверх. */
interface ScrollDriver {
  scrollTo: (target: number, options?: { duration?: number }) => void;
  stop: () => void;
  start: () => void;
}

let driver: ScrollDriver | null = null;

export function setScrollDriver(instance: ScrollDriver | null): void {
  driver = instance;
}

/** Плавно наверх — через Lenis, если он жив, иначе нативно. */
export function scrollToTop(): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo({ top: 0, behavior: "instant" });
    return;
  }
  if (driver) driver.scrollTo(0, { duration: 1.1 });
  else window.scrollTo({ top: 0, behavior: "smooth" });
}

export function pauseScroll(paused: boolean): void {
  if (paused) driver?.stop();
  else driver?.start();
}
