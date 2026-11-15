import { SectionShell } from "@/components/ui/section-shell";
import { Reveal } from "@/components/ui/reveal";
import { handmadeProjects } from "@/content/projects";

export function Handmade() {
  return (
    <SectionShell id="garden">
      <Reveal>
        <div data-reading className="mb-10 w-fit max-w-full">
          <h2 className="max-w-xl font-display text-[clamp(2rem,4.6vw,3.6rem)] font-light leading-[1.06] tracking-[-0.03em] text-ink">
            А тут <span className="whitespace-nowrap">я не вайбкодил</span>
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-ink-dim">Ручками сам делал.</p>
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
  return (
    <li data-reading className="group relative border-b border-line bg-void/80">
      <a
        href={project.href}
        target="_blank"
        rel="noopener noreferrer"
        className="relative grid grid-cols-[auto_1fr_auto] items-baseline gap-x-4 gap-y-2 px-4 py-6 sm:grid-cols-[48px_1fr_auto] sm:gap-x-6 sm:px-6"
      >
        <span aria-hidden className="font-mono text-[11px] tracking-[0.04em] text-ink-dim">
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="min-w-0">
          <h3 className="break-words font-display text-[clamp(1.1rem,2.4vw,1.6rem)] font-normal tracking-[-0.02em] text-ink transition-colors duration-300 group-hover:text-amber motion-reduce:transition-none">
            {project.title}
          </h3>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-dim">
            {project.description}
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-2">
            {project.tech.map((tech) => (
              <li key={tech} className="max-w-full break-words font-mono text-[11px] leading-relaxed tracking-[0.04em] text-ink-dim">
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
