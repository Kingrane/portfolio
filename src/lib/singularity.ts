import { useSyncExternalStore } from "react";

/**
 * «Режим сингулярности» — пасхалка.
 *
 * Включается Konami-кодом или пятью быстрыми кликами по логотипу: пространство
 * стягивается к чёрной дыре и снова отпускает. Сцена читает значение напрямую
 * в кадре (без React-стейта), интерфейсу отдаём только флаг «активно», чтобы
 * показать плашку.
 */

/** Полная длительность эффекта, мс. */
export const SINGULARITY_DURATION = 2800;

let active = false;
let startedAt = 0;
let timeout = 0;

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((fn) => fn());
}

/** Запустить эффект. Повторный вызов во время действия игнорируется. */
export function triggerSingularity(): void {
  if (active) return;
  active = true;
  startedAt = performance.now();
  emit();
  window.clearTimeout(timeout);
  timeout = window.setTimeout(() => {
    active = false;
    startedAt = 0;
    emit();
  }, SINGULARITY_DURATION);
}

/**
 * Кривая эффекта 0..1: всасывание → короткая вспышка → возврат.
 * Вызывается из кадра, поэтому никаких аллокаций.
 */
export function singularityValue(now: number): number {
  if (!active || startedAt === 0) return 0;
  const t = (now - startedAt) / SINGULARITY_DURATION;
  if (t <= 0 || t >= 1) return 0;
  const ease = (x: number) => x * x * (3 - 2 * x);
  if (t < 0.32) return ease(t / 0.32);
  if (t < 0.46) return 1;
  return ease(1 - (t - 0.46) / 0.54);
}

export function useSingularity(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => active,
    () => false,
  );
}
