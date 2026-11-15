"use client";

import { useState } from "react";
import { SectionShell } from "@/components/ui/section-shell";
import { Reveal, SplitText } from "@/components/ui/reveal";
import { handmadeProjects } from "@/content/projects";

/**
 * «Сад»: проекты, написанные руками, без вайбкода.
 * Здесь намеренно другая геометрия — не карточки, а грядки-строки: секция
 * должна читаться иначе, чем основная сетка.
 */
export function Handmade() {
  return (
    <SectionShell
      id="garden"
      index="03"
      label={`garden · ${String(handmadeProjects.length).padStart(2, "0")}`}
      meta="grown without ai"
    >
      <div className="mb-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-end">
        <div>
          <h2 className="max-w-xl font-display text-[clamp(2rem,4.6vw,3.6rem)] font-light leading-[0.98] tracking-[-0.03em]">
            <SplitText text="А тут я" />{" "}
            <span className="text-amber">
              <SplitText text="не" delay={0.06} />
            </span>{" "}
            <SplitText text="вайбкодил" delay={0.1} />
          </h2>
        </div>
        <Reveal delay={0.12}>
          <p className="text-sm leading-relaxed text-ink-dim">
            Четыре проекта, где каждая строка набрана руками — до того, как это стало
            нормой. Верстка, состояния, корзина на Redux, погода по API. Тут растёт то,
            что не сгенерировалось само.
          </p>
        </Reveal>
      </div>

      <ul className="border-t border-line">
        {handmadeProjects.map((project, i) => (
          <GardenRow key={project.title} index={i} project={project} />
        ))}
      </ul>
    </SectionShell>
  );
}

function GardenRow({
  project,
  index,
}: {
  project: (typeof handmadeProjects)[number];
  index: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <li
      className="group relative border-b border-line"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      data-cursor="view"
    >
      <a
        href={project.href}
        target="_blank"
        rel="noopener noreferrer"
        className="relative grid grid-cols-[auto_1fr_auto] items-baseline gap-x-4 gap-y-2 py-6 outline-none sm:grid-cols-[64px_1fr_auto] sm:gap-x-8"
      >
        {/* янтарная полоса, «прорастающая» на ховере */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-px origin-top scale-y-0 bg-amber transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-y-100"
        />
        <span className="hud relative z-10 text-ink-faint transition-colors duration-300 group-hover:text-amber">
          [{String(index + 1).padStart(2, "0")}]
        </span>

        <div className="min-w-0">
          <h3 className="font-display text-[clamp(1.1rem,2.4vw,1.6rem)] font-normal tracking-[-0.02em] text-ink transition-colors duration-300 group-hover:text-amber">
            {project.title}
          </h3>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-dim">
            {project.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {project.tech.map((t) => (
              <span
                key={t}
                className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint"
              >
                {t}
                <span className="ml-1.5 text-line-strong last:hidden">·</span>
              </span>
            ))}
          </div>
        </div>

        <span
          aria-hidden
          className="font-mono text-[13px] text-amber/70 transition-all duration-500 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-amber"
        >
          ↗
        </span>
      </a>

      {/* «тычинки»: на ховере прорастает цифровая пыль */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-40 overflow-hidden lg:block"
      >
        <span
          className="block h-full font-mono text-[9px] leading-[9px] tracking-[0.3em] text-amber/25 transition-all duration-700"
          style={{ opacity: hovered ? 1 : 0, transform: `translateY(${hovered ? 0 : 6}px)` }}
        >
          {Array.from({ length: 8 })
            .map(() => "· ".repeat(12))
            .join("\n")}
        </span>
      </span>
    </li>
  );
}
