import { HeroTitle } from "./hero-title";

export function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] w-full items-center pb-20 pt-28"
      aria-labelledby="hero-title"
    >
      <div className="relative mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter)]">
        <div className="w-fit max-w-full">
          <p data-reading className="mb-6 max-w-lg font-mono text-[11px] uppercase leading-relaxed tracking-[0.06em] text-ink-dim">
            PORTFOLIO — FULL-STACK VIBE DEVELOPER
          </p>

          <HeroTitle />

          <p data-reading className="mt-7 max-w-lg text-[15px] leading-relaxed text-ink-dim sm:text-base">
            Full-stack vibe developer. Балуюсь с вебом, 3D, AI.
          </p>

          <a
            data-reading
            href="https://github.com/Kingrane"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-9 inline-flex min-h-11 items-center gap-3 border border-amber/50 bg-amber-dim px-5 font-mono text-[11px] uppercase tracking-[0.06em] text-ink transition-colors duration-300 hover:border-amber hover:text-amber motion-reduce:transition-none"
          >
            GitHub <span aria-hidden className="text-amber">↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}
