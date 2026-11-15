"use client";

import { useEffect, useRef, useState } from "react";
import { pointerState } from "@/lib/store";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * Кастомный курсор: точка (мгновенно) + кольцо (с инерцией).
 * Включается только на устройствах с точным указателем (мышь/трекпад),
 * на тач-экранах не рендерится вообще.
 */
export function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const enabled = useMediaQuery("(pointer: fine)");
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [variant, setVariant] = useState<"idle" | "link" | "view">("idle");

  useEffect(() => {
    if (!enabled || reduce) return;

    // Прячем системный курсор только когда наш действительно работает
    document.documentElement.dataset.cursor = "custom";

    const ring = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let raf = 0;

    const loop = () => {
      ring.x += (pointerState.x - ring.x) * (reduce ? 1 : 0.16);
      ring.y += (pointerState.y - ring.y) * (reduce ? 1 : 0.16);
      if (dotRef.current) {
        dotRef.current.style.opacity = pointerState.inside ? "1" : "0";
        dotRef.current.style.transform = `translate3d(${pointerState.x}px, ${pointerState.y}px, 0) translate(-50%, -50%)`;
      }
      if (ringRef.current) {
        ringRef.current.style.opacity = pointerState.inside ? "1" : "0";
        ringRef.current.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onOver = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("a, button, [role='button'], [data-cursor='link']")) setVariant("link");
      else if (target.closest("[data-cursor='view']")) setVariant("view");
      else setVariant("idle");
    };
    window.addEventListener("pointerover", onOver, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerover", onOver);
      delete document.documentElement.dataset.cursor;
    };
  }, [enabled, reduce]);

  if (!enabled || reduce) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[var(--z-cursor)]">
      <div
        ref={dotRef}
        className="absolute left-0 top-0 h-[5px] w-[5px] rounded-full bg-amber transition-[width,height,background-color] duration-300"
        style={{
          opacity: pointerState.inside ? 1 : 0,
        }}
      />
      <div
        ref={ringRef}
        className="absolute left-0 top-0 rounded-full border border-iris/50 transition-[width,height,border-color,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          width: variant === "idle" ? 26 : variant === "link" ? 46 : 64,
          height: variant === "idle" ? 26 : variant === "link" ? 46 : 64,
          borderColor: variant === "idle" ? "rgba(109,92,255,0.45)" : "rgba(255,179,71,0.85)",
          opacity: pointerState.inside ? 1 : 0,
        }}
      />
    </div>
  );
}
