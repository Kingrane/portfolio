"use client";

import { useEffect } from "react";
import { scrollToTop } from "@/lib/store";
import { triggerSingularity } from "@/lib/singularity";

/**
 * Слушатели пасхалки: Konami-код (со стрелками БА) и пять быстрых кликов
 * по логотипу. Оба пути ведут в одно место и не мешают обычной навигации.
 */
const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

const LOGO_CLICKS_NEEDED = 5;
const LOGO_CLICK_WINDOW = 2200;

export function EasterEgg() {
  useEffect(() => {
    let progress = 0;

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === KONAMI[progress]) {
        progress += 1;
        if (progress === KONAMI.length) {
          progress = 0;
          fire();
        }
      } else {
        // Сброс, но с шансом, что это начало новой последовательности
        progress = key === KONAMI[0] ? 1 : 0;
      }
    };

    let clicks = 0;
    let timer = 0;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-singularity-trigger]")) return;
      clicks += 1;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        clicks = 0;
      }, LOGO_CLICK_WINDOW);
      if (clicks >= LOGO_CLICKS_NEEDED) {
        clicks = 0;
        fire();
      }
    };

    // Эффект живёт в hero, поэтому сначала поднимаемся наверх
    const fire = () => {
      scrollToTop();
      triggerSingularity();
    };

    window.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
