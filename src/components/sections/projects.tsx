"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { SectionShell } from "@/components/ui/section-shell";
import { Chip } from "@/components/ui/chip";
import { ProjectCard } from "@/components/projects/project-card";
import { Reveal } from "@/components/ui/reveal";
import { vibeProjects } from "@/content/projects";
import styles from "./projects.module.css";

const featured = ["holoterm", "Bobik-2B", "WEB-FL", "qtxt"];

// Presentation order can change; the visible index always belongs to the data.
const projectEntries = vibeProjects
  .map((project, index) => ({ project, index }))
  .sort((a, b) => {
    const aRank = featured.indexOf(a.project.title);
    const bRank = featured.indexOf(b.project.title);
    return (aRank < 0 ? featured.length : aRank) - (bRank < 0 ? featured.length : bRank) || a.index - b.index;
  });

/**
 * Сетка проектов с фильтрами по технологиям.
 * Счётчики считаются из данных, а не вбиты руками — добавил проект, цифры
 * обновились сами.
 */
export function Projects() {
  const [filter, setFilter] = useState<string | null>(null);
  const reduce = useReducedMotion();

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
    ? projectEntries.filter(({ project }) => project.tech.includes(filter))
    : projectEntries;

  return (
    <SectionShell id="projects">
      <Reveal>
        <div className="mb-10 flex flex-col gap-6 lg:mb-14 lg:flex-row lg:items-end lg:justify-between">
          <div data-reading className="min-w-0">
            <h2 className="max-w-xl font-display text-[clamp(2rem,4.6vw,3.6rem)] font-light leading-[1.06] tracking-[-0.03em] text-ink">
              Что <span className="whitespace-nowrap">я навайбкодил</span>
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-ink-dim">
              Вот 13 проектиков…
            </p>
          </div>

          <div data-reading className="flex min-w-0 max-w-full flex-wrap gap-1.5 lg:max-w-md lg:justify-end">
            <Chip
              label="ALL"
              count={vibeProjects.length}
              active={filter === null}
              onClick={() => setFilter(null)}
              className={styles.chip}
            />
            {facets.map((f) => (
              <Chip
                key={f.name}
                label={f.name}
                count={f.count}
                active={filter === f.name}
                onClick={() => setFilter(filter === f.name ? null : f.name)}
                className={styles.chip}
              />
            ))}
          </div>
        </div>

        <LayoutGroup id="project-bento">
          <motion.div
            layout={!reduce}
            className={styles.grid}
            transition={{ layout: { duration: reduce ? 0 : 0.48, ease: [0.22, 1, 0.36, 1] } }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map(({ project, index }) => {
                const isFeatured = featured.includes(project.title);
                const wide = project.title === "holoterm" || project.title === "WEB-FL";
                return (
                  <motion.div
                    key={project.title}
                    layout={!reduce}
                    layoutDependency={filter}
                    className={`${styles.item} ${isFeatured ? (wide ? styles.wide : styles.featured) : styles.small}`}
                    initial={reduce ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      layout: { duration: reduce ? 0 : 0.48, ease: [0.22, 1, 0.36, 1] },
                      opacity: { duration: reduce ? 0 : 0.18 },
                      y: { duration: reduce ? 0 : 0.32 },
                    }}
                  >
                    <ProjectCard project={project} index={index} featured={isFeatured} />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      </Reveal>
    </SectionShell>
  );
}
