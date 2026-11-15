"use client";

import { useMemo, useState } from "react";
import { SectionShell } from "@/components/ui/section-shell";
import { Chip } from "@/components/ui/chip";
import { ProjectCard } from "@/components/projects/project-card";
import { Reveal, SplitText } from "@/components/ui/reveal";
import { vibeProjects } from "@/content/projects";

/**
 * Сетка проектов с фильтрами по технологиям.
 * Счётчики считаются из данных, а не вбиты руками — добавил проект, цифры
 * обновились сами.
 */
export function Projects() {
  const [filter, setFilter] = useState<string | null>(null);

  const facets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of vibeProjects) {
      for (const t of p.tech) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 7)
      .map(([name, count]) => ({ name, count }));
  }, []);

  const visible = filter
    ? vibeProjects.filter((p) => p.tech.some((t) => t === filter))
    : vibeProjects;

  return (
    <SectionShell
      id="projects"
      index="02"
      label={`projects · ${String(vibeProjects.length).padStart(2, "0")}`}
      meta="filter · hover · click"
    >
      <div className="mb-10 flex flex-col gap-6 lg:mb-14 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="max-w-xl font-display text-[clamp(2rem,4.6vw,3.6rem)] font-light leading-[0.98] tracking-[-0.03em]">
            <SplitText text="Что я навайбкодил" />
          </h2>
          <Reveal delay={0.1}>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-ink-dim">
              {vibeProjects.length} проектов, которые дошли до продакшена. Анонимный обмен
              текстом, университетский клиент, веб-DAW, дообученная модель и терминал,
              который рисует 3D символами.
            </p>
          </Reveal>
        </div>

        <div className="flex flex-wrap gap-1.5 lg:max-w-md lg:justify-end">
          <Chip
            label="all"
            count={vibeProjects.length}
            active={filter === null}
            onClick={() => setFilter(null)}
          />
          {facets.map((f) => (
            <Chip
              key={f.name}
              label={f.name}
              count={f.count}
              active={filter === f.name}
              onClick={() => setFilter(filter === f.name ? null : f.name)}
            />
          ))}
        </div>
      </div>

      {/* gap-px + фон линий = сетка из волосяных рамок без двойных бордеров */}
      <div className="grid gap-px border border-line bg-line sm:grid-cols-2">
        {visible.map((project, i) => (
          <ProjectCard key={project.title} project={project} index={i} />
        ))}
        {visible.length === 0 ? (
          <p className="hud bg-void p-10 text-center sm:col-span-2">
            пусто · попробуй другой фильтр
          </p>
        ) : null}
      </div>
    </SectionShell>
  );
}
