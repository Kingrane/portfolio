"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { installInstrumentation, setScrollDriver, syncScroll } from "@/lib/store";

/**
 * Плавный скролл + единая телеметрия.
 *
 * Lenis двигает страницу с инерцией и сообщает реальную позицию — от неё
 * зависит и HUD, и камера в WebGL. При prefers-reduced-motion не включаем:
 * нативная прокрутка быстрее и предсказуемее.
 */
export function SmoothScroll() {
  useEffect(() => {
    const cleanupInstrumentation = installInstrumentation();

    // Нативный слушатель нужен всегда: Lenis не сообщает о прыжках по якорям
    // и программном scrollTo, а камера и HUD должны знать реальную позицию.
    const onNativeScroll = () => syncScroll(window.scrollY);
    window.addEventListener("scroll", onNativeScroll, { passive: true });

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      onNativeScroll();
      return () => {
        window.removeEventListener("scroll", onNativeScroll);
        cleanupInstrumentation();
      };
    }

    const lenis = new Lenis({
      lerp: 0.09,
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
      smoothWheel: true,
      // На тач-устройствах оставляем инерцию браузера: она лучше по FPS
      syncTouch: false,
    });

    lenis.on("scroll", ({ scroll }: { scroll: number }) => syncScroll(scroll));
    setScrollDriver(lenis);

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    syncScroll(window.scrollY);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onNativeScroll);
      setScrollDriver(null);
      lenis.destroy();
      cleanupInstrumentation();
    };
  }, []);

  return null;
}
