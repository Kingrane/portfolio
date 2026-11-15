"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { makeAsciiArt } from "@/lib/ascii";
import type { Project } from "@/content/projects";
import { cn } from "@/lib/cn";

const ASCII_OPTS = { cols: 108, rows: 10, focus: 0.55 } as const;

/**
 * Карточка проекта в стиле Devault:
 * рамка 1px, моно-индекс, ASCII-превью, сгенерированное из названия,
 * и подсветка, которая следует за курсором.
 *
 * Всё превью — <pre> с символами, на сервере и клиенте оно одинаковое
 * (детерминированный PRNG), поэтому гидрация не расходится.
 */
export function ProjectCard({ project, index }: { project: Project; index: number }) {
  const ref = useRef<HTMLElement>(null);
  const [hovered, setHovered] = useState(false);
  const [variant, setVariant] = useState(0);
  const [spot, setSpot] = useState({ x: 0.5, y: 0.5 });

  // Пока курсор на карточке — «передаём кадр» раз в 170 мс
  useEffect(() => {
    if (!hovered) return;
    const id = window.setInterval(() => setVariant((v) => v + 1), 170);
    return () => window.clearInterval(id);
  }, [hovered]);

  const art = useMemo(() => makeAsciiArt(project.title, variant, ASCII_OPTS), [project.title, variant]);

  const onPointerMove = (e: React.PointerEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setSpot({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  return (
    <motion.article
      ref={ref}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, delay: (index % 4) * 0.05, ease: [0.16, 1, 0.3, 1] }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerMove={onPointerMove}
      data-cursor="view"
      className="group relative flex flex-col bg-void p-5 transition-colors duration-500 hover:bg-surface sm:p-6"
    >
      {/* Подсветка под курсором */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(340px circle at ${spot.x * 100}% ${spot.y * 100}%, rgba(124,92,255,0.10), transparent 65%)`,
        }}
      />

      <header className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="hud mb-2 flex items-center gap-2">
            <span className="text-iris/80">[{String(index + 1).padStart(2, "0")}]</span>
            <span className="h-px w-4 bg-line-strong" />
            <span>{project.group === "vibe" ? "vibe" : "handmade"}</span>
          </p>
          <h3 className="truncate font-display text-[clamp(1.15rem,2vw,1.55rem)] font-normal tracking-[-0.02em] text-ink transition-colors duration-500 group-hover:text-white">
            {/* Ссылка растянута на всю карточку — кликабельно всё, но семантика цела */}
            <a
              href={project.href}
              target="_blank"
              rel="noopener noreferrer"
              className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline focus-visible:after:outline-1 focus-visible:after:outline-iris-light"
            >
              {project.title}
            </a>
          </h3>
        </div>

        <span className="mt-1 shrink-0 font-mono text-[11px] text-ink-faint transition-all duration-500 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-iris-light">
          ↗
        </span>
      </header>

      {/* превью */}
      <div className="relative mt-5 h-[104px] overflow-hidden border border-line bg-surface/60">
        <pre
          aria-hidden
          className={cn(
            "ascii absolute inset-0 select-none whitespace-pre p-2 text-[7px] leading-[0.95] text-iris/40 transition-colors duration-500",
            "group-hover:text-iris/70",
            "[mask-image:linear-gradient(to_right,black_60%,transparent_100%)]",
          )}
        >
          {art}
        </pre>
        <span className="hud absolute bottom-1.5 right-2 text-[8px] text-ink-faint">
          {hovered ? "live" : "idle"}
        </span>
      </div>

      <p className="relative mt-4 text-[13px] leading-relaxed text-ink-dim">{project.description}</p>

      <div className="relative mt-auto flex flex-wrap gap-1.5 pt-5">
        {project.tech.slice(0, 5).map((t) => (
          <span
            key={t}
            className="border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint transition-colors duration-500 group-hover:border-line-strong group-hover:text-ink-dim"
          >
            {t}
          </span>
        ))}
      </div>

      <footer className="hud relative mt-4 flex items-center justify-between border-t border-line pt-3">
        <span className="transition-colors duration-500 group-hover:text-iris-light">view project</span>
        {project.repo ? (
          <a
            href={project.repo}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 transition-colors duration-300 hover:text-ink"
          >
            source
          </a>
        ) : (
          <span className="text-ink-faint/50">no source</span>
        )}
      </footer>
    </motion.article>
  );
}
