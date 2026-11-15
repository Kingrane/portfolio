import { MagneticButton } from "@/components/ui/magnetic-button";
import { Reveal } from "@/components/ui/reveal";

export function SiteFooter() {
  return (
    <footer id="colophon" className="relative py-16 sm:py-24">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter)]">
        <Reveal>
          <div data-reading className="flex flex-wrap items-center justify-between gap-6">
            <MagneticButton href="https://github.com/Kingrane">
              GitHub <span aria-hidden className="text-amber">↗</span>
            </MagneticButton>
            <a
              href="#top"
              className="inline-flex min-h-11 items-center gap-2 font-mono text-[11px] tracking-[0.06em] text-ink-dim transition-colors duration-300 hover:text-amber motion-reduce:transition-none"
            >
              Наверх <span aria-hidden>↑</span>
            </a>
          </div>

          <p
            aria-hidden
            className="mt-14 select-none font-display text-[clamp(2.2rem,10.5vw,9rem)] font-light leading-[0.92] tracking-[-0.05em] text-ink-dim"
          >
            KINGRANE
          </p>

          <div data-reading className="mt-8 flex flex-wrap justify-between gap-3 font-mono text-[11px] leading-relaxed tracking-[0.04em] text-ink-dim">
            <p>© 2026 Kingrane</p>
            <p>Все права навайбкожены</p>
          </div>
        </Reveal>
      </div>
    </footer>
  );
}
