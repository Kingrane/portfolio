import { makeAsciiArt } from "@/lib/ascii";
import type { Project } from "@/content/projects";

const ASCII_OPTS = { cols: 108, rows: 10, focus: 0.55 } as const;

/** Phase A retains the existing static preview; project scenes come later. */
export function ProjectCard({ project, index }: { project: Project; index: number }) {
  const art = makeAsciiArt(project.title, 0, ASCII_OPTS);

  return (
    <article
      className="group relative flex min-w-0 flex-col p-5 sm:p-6"
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
