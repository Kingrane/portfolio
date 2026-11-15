"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { installInstrumentation, setScrollDriver, syncScroll } from "@/lib/store";
import { installReadingZones } from "@/scene/reading-zones";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * Плавный скролл + общая шкала сцены и reading zones.
 *
 * Lenis двигает страницу с инерцией и сообщает реальную позицию — от неё
 * зависит камера в WebGL. При prefers-reduced-motion не включаем:
 * нативная прокрутка быстрее и предсказуемее.
 */
export function SmoothScroll() {
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  useEffect(() => {
    const cleanupInstrumentation = installInstrumentation();
    const cleanupReading = installReadingZones();

    // Нативный слушатель нужен всегда: Lenis не сообщает о прыжках по якорям
    // и программном scrollTo, а камера должна знать реальную позицию.
    const onNativeScroll = () => syncScroll(window.scrollY);
    window.addEventListener("scroll", onNativeScroll, { passive: true });

    if (reduce) {
      onNativeScroll();
      return () => {
        window.removeEventListener("scroll", onNativeScroll);
        cleanupInstrumentation();
        cleanupReading();
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
      cleanupReading();
    };
  }, [reduce]);

  return null;
}
