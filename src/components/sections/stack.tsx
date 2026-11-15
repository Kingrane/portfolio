"use client";

import { useState } from "react";
import { SectionShell } from "@/components/ui/section-shell";
import { Marquee } from "@/components/ui/marquee";
import { Reveal } from "@/components/ui/reveal";
import { languages, technologies } from "@/content/stack";

export function Stack() {
  const [paused, setPaused] = useState(false);

  return (
    <SectionShell id="stack">
      <Reveal>
        <div data-reading className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <h2 className="max-w-xl font-display text-[clamp(1.9rem,4.4vw,3.4rem)] font-light leading-[1.06] tracking-[-0.03em] text-ink">
            Чем я это всё делаю
          </h2>
          <button
            type="button"
            aria-pressed={paused}
            aria-controls="stack-languages stack-tools"
            onClick={() => setPaused((value) => !value)}
            className="inline-flex min-h-11 items-center border border-line-strong px-4 font-mono text-[11px] tracking-[0.06em] text-ink-dim transition-colors duration-300 hover:border-amber/50 hover:text-amber motion-reduce:hidden"
          >
            {paused ? "Продолжить" : "Пауза"}
          </button>
        </div>

        <Marquee id="stack-languages" items={languages} paused={paused} />
        <Marquee id="stack-tools" items={technologies} paused={paused} reverse className="mt-3" />
      </Reveal>
    </SectionShell>
  );
}
