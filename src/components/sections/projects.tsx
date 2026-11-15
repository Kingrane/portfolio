"use client";

import { useMemo, useState } from "react";
import { SectionShell } from "@/components/ui/section-shell";
import { Chip } from "@/components/ui/chip";
import { ProjectCard } from "@/components/projects/project-card";
import { Reveal } from "@/components/ui/reveal";
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
      for (const t of new Set(p.tech)) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));
  }, []);

  const visible = filter
    ? vibeProjects.filter((p) => p.tech.some((t) => t === filter))
    : vibeProjects;

  return (
    <SectionShell id="projects">
      <Reveal>
        <div className="mb-10 flex flex-col gap-6 lg:mb-14 lg:flex-row lg:items-end lg:justify-between">
          <div data-reading className="min-w-0">
            <h2 className="max-w-xl font-display text-[clamp(2rem,4.6vw,3.6rem)] font-light leading-[1.06] tracking-[-0.03em] text-ink">
              Что <span className="whitespace-nowrap">я навайбкодил</span>
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-ink-dim">
              Вот 10 проектиков, но это еще не все, дальше веселее!
            </p>
          </div>

          <div data-reading className="flex min-w-0 max-w-full flex-wrap gap-1.5 lg:max-w-md lg:justify-end">
            <Chip
              label="ALL"
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

        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((project, i) => (
            <ProjectCard key={project.title} project={project} index={i} />
          ))}
        </div>
      </Reveal>
    </SectionShell>
  );
}
