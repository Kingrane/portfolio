"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { asset } from "@/lib/asset";
import styles from "./scene-poster.module.css";

/** Static render captures; native scroll dissolves the hero into a night sky. */
export function ScenePoster() {
  const hero = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const t = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.8)));
      if (hero.current) hero.current.style.opacity = String(1 - t * t * (3 - 2 * t));
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    update();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div
      aria-hidden
      data-scene-poster
      className="pointer-events-none fixed inset-0 z-0 bg-void"
      style={{
        "--poster-hero-mobile": `url("${asset("/scene/hero-mobile.webp")}")`,
        "--poster-hero-desktop": `url("${asset("/scene/hero-desktop.webp")}")`,
        "--poster-night-mobile": `url("${asset("/scene/night-mobile.webp")}")`,
        "--poster-night-desktop": `url("${asset("/scene/night-desktop.webp")}")`,
      } as CSSProperties}
    >
      <div className={`${styles.layer} ${styles.night} absolute inset-0`} />
      <div ref={hero} className={`${styles.layer} ${styles.hero} absolute inset-0`} />
    </div>
  );
}
