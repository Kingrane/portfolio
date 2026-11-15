"use client";

import { useEffect, useMemo, useRef } from "react";
import { makeAsciiArt } from "@/lib/ascii";
import type { Project } from "@/content/projects";
import styles from "./project-card.module.css";

const ASCII_OPTS = { cols: 108, rows: 10, focus: 0.55 } as const;

/** Phase A retains the existing static preview; project scenes come later. */
export function ProjectCard({ project, index }: { project: Project; index: number }) {
  const art = useMemo(() => makeAsciiArt(project.title, 0, ASCII_OPTS), [project.title]);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const enabled = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) and (min-width: 640px)");
    let bounds: DOMRect | null = null;
    let frame = 0, rotateX = 0, rotateY = 0;
    const render = () => {
      frame = 0;
      card.style.setProperty("--card-rx", `${rotateX}deg`);
      card.style.setProperty("--card-ry", `${rotateY}deg`);
    };
    const reset = () => {
      if (!bounds && !frame && !rotateX && !rotateY) return;
      cancelAnimationFrame(frame);
      frame = 0;
      bounds = null;
      rotateX = rotateY = 0;
      render();
      card.removeAttribute("data-tilting");
    };
    const enter = (event: PointerEvent) => {
      if (!enabled.matches || document.hidden || event.pointerType !== "mouse") return;
      bounds = card.getBoundingClientRect();
      card.setAttribute("data-tilting", "");
    };
    const move = (event: PointerEvent) => {
      // Scrolling can reset the cached box while the pointer remains inside.
      // Re-enter once on the next move, rather than requiring a leave/re-enter.
      if (!bounds) enter(event);
      if (!bounds || event.pointerType !== "mouse") return;
      rotateX = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1)) * 3;
      rotateY = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1)) * -3;
      if (!frame) frame = requestAnimationFrame(render);
    };
    card.addEventListener("pointerenter", enter);
    card.addEventListener("pointermove", move, { passive: true });
    card.addEventListener("pointerleave", reset);
    card.addEventListener("pointercancel", reset);
    card.addEventListener("blur", reset, true);
    window.addEventListener("scroll", reset, { passive: true, capture: true });
    window.addEventListener("resize", reset);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    enabled.addEventListener("change", reset);
    return () => {
      reset();
      card.removeEventListener("pointerenter", enter);
      card.removeEventListener("pointermove", move);
      card.removeEventListener("pointerleave", reset);
      card.removeEventListener("pointercancel", reset);
      card.removeEventListener("blur", reset, true);
      window.removeEventListener("scroll", reset, true);
      window.removeEventListener("resize", reset);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
      enabled.removeEventListener("change", reset);
    };
  }, []);

  return (
    <article
      ref={cardRef}
      className={`${styles.card} group relative flex min-w-0 flex-col p-5 sm:p-6`}
    >
      <header className="flex items-start justify-between gap-4">
        <h3 data-reading className="min-w-0 break-words font-display text-[clamp(1.15rem,2vw,1.55rem)] font-normal tracking-[-0.02em] text-ink transition-colors duration-300 group-hover:text-amber group-focus-within:text-amber motion-reduce:transition-none">
          <a
            href={project.href}
            target="_blank"
            rel="noopener noreferrer"
            className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline focus-visible:after:outline-1 focus-visible:after:outline-amber"
          >
            {project.title}
          </a>
        </h3>
        <span aria-hidden className="shrink-0 font-mono text-[11px] tracking-[0.04em] text-ink-dim">
          {String(index + 1).padStart(2, "0")} <span className="ml-2 text-amber">↗</span>
        </span>
      </header>

      <div aria-hidden className="relative mt-5 h-[104px] overflow-hidden">
        <pre className="ascii absolute inset-0 select-none whitespace-pre p-2 text-[7px] leading-[0.95] text-amber/65 [mask-image:linear-gradient(to_right,black_60%,transparent_100%)]">
          {art}
        </pre>
      </div>

      {project.description ? (
        <p data-reading className="mt-4 text-[13px] leading-relaxed text-ink-dim">{project.description}</p>
      ) : null}

      <ul className="mt-auto flex flex-wrap gap-x-3 gap-y-2 pt-5">
        {project.tech.map((tech) => (
          <li data-reading key={tech} className="max-w-full break-words font-mono text-[11px] leading-relaxed tracking-[0.04em] text-ink-dim">
            {tech}
          </li>
        ))}
      </ul>

      {project.repo ? (
        <footer className="mt-4 pt-3">
          <a
            data-reading
            href={project.repo}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 inline-flex min-h-11 items-center gap-2 font-mono text-[11px] tracking-[0.06em] text-ink-dim transition-colors duration-300 hover:text-iris-light motion-reduce:transition-none"
          >
            Source <span aria-hidden>↗</span>
          </a>
        </footer>
      ) : null}
    </article>
  );
}
