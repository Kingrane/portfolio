"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * Ленивая загрузка сцены.
 *
 * ssr: false обязателен — three.js трогает window при инициализации.
 * Загрузка стартует не сразу, а после первой отрисовки текста: LCP не должен
 * ждать ни байты бандла, ни видеокарту.
 */
const Scene = dynamic(() => import("./scene"), { ssr: false });

type Support = "unknown" | "yes" | "no";

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return false;
    // Освобождаем контекст, он нам нужен только для проверки
    const lose = (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context");
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function SceneRoot() {
  const [support, setSupport] = useState<Support>("unknown");
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (reduce || connection?.saveData || !detectWebGL()) {
      return;
    }

    // Даём браузеру сначала отрисовать HTML (LCP), потом грузим 3D
    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const w = window as IdleWindow;

    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(() => setSupport("yes"), { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setSupport("yes"), 700);
    return () => window.clearTimeout(id);
  }, [reduce]);

  return (
    <>
      {/* Статичный постер: он же fallback без WebGL. Стоит ноль байт. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(70% 50% at 62% 18%, rgba(124,92,255,0.16), transparent 60%)," +
            "radial-gradient(50% 40% at 20% 60%, rgba(255,180,84,0.06), transparent 70%)," +
            "#07070a",
        }}
      />
      {support === "yes" && !reduce ? <Scene /> : null}
    </>
  );
}
