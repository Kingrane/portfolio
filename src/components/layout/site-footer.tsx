import { SectionShell } from "@/components/ui/section-shell";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { ScrambleText } from "@/components/ui/scramble-text";
import { Reveal } from "@/components/ui/reveal";

/** Финальная секция: тихое небо, одна кнопка, честная выходная строка. */
export function SiteFooter() {
  return (
    <footer>
      <SectionShell
        id="colophon"
        index="04"
        label="colophon"
        meta="end of transmission"
      >
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="hud mb-5">open for experiments</p>
            <h2 className="max-w-2xl font-display text-[clamp(1.8rem,4.2vw,3.2rem)] font-light leading-[1.02] tracking-[-0.03em]">
              Есть идея, которую надо собрать за выходные? Я в деле.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-ink-dim">
              Пишите в GitHub — это самый быстрый способ меня найти. Отвечаю почти
              всегда, а код выкладываю туда же.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <MagneticButton href="https://github.com/Kingrane">
                <span className="h-1 w-1 rounded-full bg-moss" />
                github.com/kingrane
                <span className="text-iris-light">↗</span>
              </MagneticButton>

              <a
                href="#top"
                className="link-line font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint transition-colors duration-300 hover:text-ink"
              >
                наверх ↑
              </a>
            </div>
          </div>

          <Reveal delay={0.1} className="lg:text-right">
            <dl className="space-y-2 font-mono text-[10px] uppercase tracking-[0.12em]">
              {[
                ["stack", "next.js 16 · react 19 · three.js"],
                ["motion", "framer motion · lenis"],
                ["hosting", "github pages · static export"],
                ["type", "unbounded · inter · jetbrains mono"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-3 lg:justify-end">
                  <dt className="text-ink-faint">{k}</dt>
                  <span className="h-px flex-1 border-b border-dotted border-line-strong lg:max-w-[80px]" />
                  <dd className="text-ink-dim">{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </SectionShell>

      {/* Огромная подпись: обводка вместо заливки, чтобы не спорить с заголовком */}
      <div className="relative overflow-hidden border-t border-line">
        <div className="mx-auto flex w-full max-w-[var(--container-max)] items-end justify-between gap-6 px-[var(--gutter)] pb-6 pt-10">
          <p
            aria-hidden
            className="select-none font-display text-[clamp(2.2rem,10.5vw,9rem)] font-light uppercase leading-[0.8] tracking-[-0.05em] text-transparent"
            style={{ WebkitTextStroke: "1px rgba(255,255,255,0.16)" }}
          >
            Kingrane
          </p>
          <p className="hud shrink-0 pb-2 text-right leading-relaxed">
            © 2026
            <br />
            все права
            <br />
            навайбкожены
          </p>
        </div>

        <div className="mx-auto flex w-full max-w-[var(--container-max)] flex-wrap items-center justify-between gap-3 border-t border-line px-[var(--gutter)] pb-16 pt-4 sm:pb-4">
          <p className="hud">
            <ScrambleText text="iris.os v2.0 · build 2026.11" duration={700} />
          </p>
          <p className="hud flex items-center gap-2">
            <span className="h-1 w-1 animate-pulse rounded-full bg-moss" />
            signal stable
          </p>
        </div>
      </div>
    </footer>
  );
}
