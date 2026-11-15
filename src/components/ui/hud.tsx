"use client";

import { useEffect, useState } from "react";
import { pointerState, pointerTheta, viewState } from "@/lib/store";
import { useRenderMode } from "@/lib/render-mode";

/**
 * HUD: живая телеметрия. Значения настоящие — курсор, угол, FPS, прогресс
 * скролла. Обновляется 8 раз в секунду: чаще глазу не нужно, а React
 * перерисовывается в 8 раз меньше.
 */
export function Hud() {
  const [tick, setTick] = useState(0);
  const mode = useRenderMode();

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 125);
    return () => window.clearInterval(id);
  }, []);

  const x = pointerState.nx.toFixed(2);
  const y = pointerState.ny.toFixed(2);
  const theta = pointerTheta().toFixed(1);
  const fps = viewState.fps;
  const progress = Math.round(viewState.progress * 100);
  void tick;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed bottom-5 left-[var(--gutter)] z-[var(--z-hud)] hidden select-none lg:block"
    >
      <div className="hud flex items-center gap-3 text-ink-faint">
        <span className="h-px w-6 bg-line-strong" />
        <span>telemetry</span>
      </div>

      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[10px] tabular-nums tracking-[0.1em] text-ink-dim">
        <dt className="text-ink-faint">X</dt>
        <dd>
          {x}
          <span className="ml-3 text-ink-faint">Y</span>
          <span className="ml-2">{y}</span>
        </dd>
        <dt className="text-ink-faint">θ</dt>
        <dd>{theta}°</dd>
        <dt className="text-ink-faint">FPS</dt>
        <dd className={fps > 45 ? "text-moss" : "text-amber"}>{fps}</dd>
        <dt className="text-ink-faint">SCROLL</dt>
        <dd>
          {String(progress).padStart(3, "0")}%
          {/* Мини-шкала прогресса */}
          <span className="ml-2 inline-flex h-[3px] w-16 translate-y-[-2px] bg-line align-middle">
            <span className="h-full bg-iris" style={{ width: `${progress}%` }} />
          </span>
        </dd>
        <dt className="text-ink-faint">RENDER</dt>
        <dd className="text-iris-light">{mode}</dd>
      </dl>
    </div>
  );
}
