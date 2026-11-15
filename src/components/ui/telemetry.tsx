"use client";

import { useEffect, useState } from "react";
import { pointerState, pointerTheta, viewState } from "@/lib/store";
import { useRenderMode } from "@/lib/render-mode";

/**
 * Телеметрия в правой колонке hero. Значения настоящие: курсор, угол, FPS,
 * прогресс скролла. Обновляется 8 раз в секунду — чаще глазу не нужно, а React
 * перерисовывается в 8 раз меньше.
 */
export function Telemetry() {
  const [, force] = useState(0);
  const mode = useRenderMode();

  useEffect(() => {
    const id = window.setInterval(() => force((t) => t + 1), 125);
    return () => window.clearInterval(id);
  }, []);

  const rows: Array<[string, string]> = [
    ["x / y", `${pointerState.nx.toFixed(2)} / ${pointerState.ny.toFixed(2)}`],
    ["θ", `${pointerTheta().toFixed(1)}°`],
    ["fps", String(viewState.fps)],
    ["scroll", `${String(Math.round(viewState.progress * 100)).padStart(3, "0")}%`],
    ["render", mode],
  ];

  return (
    <dl className="mt-4 space-y-1 border-t border-line pt-3 font-mono text-[10px] uppercase tabular-nums tracking-[0.1em]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline gap-2">
          <dt className="shrink-0 text-ink-faint">{k}</dt>
          <span className="h-px flex-1 border-b border-dotted border-line" />
          <dd className={k === "fps" && viewState.fps < 45 ? "text-amber" : "text-ink-dim"}>
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}
