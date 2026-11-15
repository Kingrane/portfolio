"use client";

import { useEffect } from "react";
import { RENDER_MODES, hydrateRenderMode, setRenderMode, useRenderMode } from "@/lib/render-mode";
import { cn } from "@/lib/cn";

const SHORTCUTS: Record<string, string> = {
  ascii: "1",
  braille: "2",
  dither: "3",
  clean: "4",
};

/**
 * Переключатель режима отрисовки. Выбор запоминается в localStorage,
 * доступен с клавиатуры цифрами 1–4.
 */
export function RenderModeSwitch() {
  const active = useRenderMode();

  useEffect(() => {
    hydrateRenderMode();

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.ctrlKey || e.altKey || e.metaKey || target?.isContentEditable) return;
      if (!target?.closest('[aria-label="Режим отрисовки сцены"]')) return;
      const found = RENDER_MODES.find((m) => SHORTCUTS[m.id] === e.key);
      if (found) setRenderMode(found.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[var(--gutter)] z-[var(--z-hud)] flex items-center gap-2 bg-void/85">
      <span className="hud mr-1 hidden text-ink-faint lg:block">render</span>
      <div role="group" aria-label="Режим отрисовки сцены" className="flex border border-line">
        {RENDER_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setRenderMode(m.id)}
            aria-pressed={active === m.id}
            className={cn(
              "min-h-11 px-2.5 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors duration-300",
              active === m.id
                ? "bg-iris-dim text-ink"
                : "text-ink-faint hover:bg-white/[0.03] hover:text-ink-dim",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
