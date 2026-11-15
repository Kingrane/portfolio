"use client";

import { useEffect, useRef } from "react";
import { SectionShell } from "@/components/ui/section-shell";
import { Reveal } from "@/components/ui/reveal";
import { handmadeProjects } from "@/content/projects";
import { gardenState } from "@/scene/garden-state";
import styles from "./handmade.module.css";

export function Handmade() {
  useEffect(() => () => { gardenState.active = -1; }, []);

  return (
    <SectionShell id="garden" bleed className={styles.section}>
      <Reveal className={styles.copy}>
        <div className="mb-10 w-fit max-w-full">
          <h2 data-reading className="max-w-xl font-display text-[clamp(2rem,4.6vw,3.6rem)] font-light leading-[1.06] tracking-[-0.03em] text-ink">
            А тут <span className="whitespace-nowrap">я не вайбкодил</span>
          </h2>
          <p data-reading className="mt-5 text-sm leading-relaxed text-ink-dim">Ручками сам делал.</p>
        </div>

        <ul className="border-t border-line">
          {handmadeProjects.map((project, index) => (
            <GardenRow key={project.title} index={index} project={project} />
          ))}
        </ul>
      </Reveal>
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
  const hovered = useRef(false);
  const focused = useRef(false);

  return (
    <li className={`group relative border-b border-line ${styles.row}`}>
      <a
        href={project.href}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.link}
        onPointerEnter={(event) => {
          if (event.pointerType === "touch") return;
          hovered.current = true;
          gardenState.active = index;
        }}
        onPointerLeave={() => {
          hovered.current = false;
          if (!focused.current && gardenState.active === index) gardenState.active = -1;
        }}
        onPointerCancel={() => {
          hovered.current = false;
          if (!focused.current && gardenState.active === index) gardenState.active = -1;
        }}
        onFocus={() => {
          focused.current = true;
          gardenState.active = index;
        }}
        onBlur={() => {
          focused.current = false;
          if (!hovered.current && gardenState.active === index) gardenState.active = -1;
        }}
      >
        <span aria-hidden className="font-mono text-[11px] tracking-[0.04em] text-ink-dim">
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="min-w-0">
          <h3 data-reading className="break-words font-display text-[clamp(1.1rem,2.4vw,1.6rem)] font-normal tracking-[-0.02em] text-ink transition-colors duration-300 group-hover:text-amber group-focus-within:text-amber motion-reduce:transition-none">
            {project.title}
          </h3>
          <p data-reading className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-dim">
            {project.description}
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-2">
            {project.tech.map((tech) => (
              <li data-reading key={tech} className="max-w-full break-words font-mono text-[11px] leading-relaxed tracking-[0.04em] text-ink-dim">
                {tech}
              </li>
            ))}
          </ul>
        </div>

        <span aria-hidden className="font-mono text-[13px] text-amber">↗</span>
      </a>
    </li>
  );
}
