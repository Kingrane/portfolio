import { makeAsciiArt } from "@/lib/ascii";
import { projects, techFacets } from "@/content/projects";
import { ScrambleText } from "@/components/ui/scramble-text";
import { Telemetry } from "@/components/ui/telemetry";

/** Детерминированный «снимок» для правой колонки — как ирис из референса. */
const SPECTRUM = makeAsciiArt("kingrane-iris-spectrum", 7, { cols: 30, rows: 20, focus: 0.8 });

const ANNOTATIONS = [
  { key: "node", value: "#150" },
  { key: "conf", value: "0.98 / 1.00" },
  { key: "spectrum", value: "460–590 nm" },
];

export function Hero() {
  const total = projects.length;
  const techTotal = techFacets.length;

  return (
    <section
      id="top"
      className="relative min-h-[100svh] w-full overflow-hidden pb-14 pt-14"
      aria-labelledby="hero-title"
    >
      {/* Вертикальные линии контейнера — каркас «станции» */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 w-full max-w-[var(--container-max)] -translate-x-1/2 px-[var(--gutter)]"
      >
        <span className="absolute inset-y-0 left-[var(--gutter)] w-px bg-line" />
        <span className="absolute inset-y-0 right-[var(--gutter)] w-px bg-line" />
        <span className="absolute inset-x-[var(--gutter)] top-14 h-px bg-line" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-[var(--container-max)] flex-col px-[var(--gutter)] pb-16 lg:pb-24">
        {/* Служебная строка */}
        <div className="flex items-center justify-between gap-4 py-3">
          <p className="hud flex items-center gap-2">
            <span className="h-1 w-1 animate-pulse rounded-full bg-moss" />
            system nominal
          </p>
          <p className="hud hidden sm:block">sector 07 · iris array</p>
        </div>

        <div className="grid flex-1 grid-cols-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-14 xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-16">
          {/* Заголовок */}
          <div className="min-w-0">
            <p className="hud mb-5 flex flex-wrap items-center gap-3">
              <span className="text-ink-dim">portfolio</span>
              <span className="h-px w-8 bg-line-strong" />
              <span>full-stack vibe developer</span>
            </p>

            <h1
              id="hero-title"
              className="font-display text-[clamp(2.9rem,9.4vw,8.4rem)] font-light uppercase leading-[0.84] tracking-[-0.045em] text-ink"
            >
              <ScrambleText text="Kingrane" duration={900} />
            </h1>

            <p className="mt-7 max-w-lg text-[15px] leading-relaxed text-ink-dim sm:text-base">
              Балуюсь с вебом, 3D и AI. Собираю интерфейсы, которые хочется потрогать,
              и иногда заставляю терминал показывать трёхмерную графику.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href="#projects"
                className="group relative inline-flex h-11 items-center gap-3 overflow-hidden border border-line-strong px-5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink transition-colors duration-500 hover:border-iris/60"
              >
                <span className="absolute inset-0 -translate-x-full bg-iris-dim transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0" />
                <span className="relative z-10">смотреть проекты</span>
                <span className="relative z-10 text-iris-light transition-transform duration-500 group-hover:translate-x-1">
                  →
                </span>
              </a>

              <a
                href="https://github.com/Kingrane"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex h-11 items-center gap-2 px-1 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint transition-colors duration-300 hover:text-ink"
              >
                <span className="link-line">github</span>
                <span className="transition-transform duration-300 group-hover:-translate-y-0.5">
                  ↗
                </span>
              </a>
            </div>
          </div>

          {/* Правая колонка: ASCII-спектр + подписи с выносками */}
          <div className="relative hidden lg:block">
            <div className="mb-4 flex items-center justify-between">
              <span className="hud">spectrum · dither</span>
              <span className="hud text-iris-light">ok</span>
            </div>

            <pre
              aria-hidden
              className="ascii select-none text-[7.5px] leading-[0.94] text-iris/50 [mask-image:linear-gradient(to_bottom,black_10%,black_70%,transparent_100%)]"
            >
              {SPECTRUM}
            </pre>

            {/* Подписи живут над свечением диска — даём им подложку, иначе
                тонкий моно-текст теряется на ярком фоне */}
            <div className="mt-6 border border-line bg-void/55 p-3 backdrop-blur-[3px]">
              <ul className="space-y-2">
                {ANNOTATIONS.map((a) => (
                  <li key={a.key} className="flex items-baseline gap-2">
                    <span className="hud shrink-0">{a.key}</span>
                    <span className="h-px flex-1 border-b border-dotted border-line-strong" />
                    <span className="font-mono text-[10px] tracking-[0.1em] text-ink">
                      {a.value}
                    </span>
                  </li>
                ))}
              </ul>

              <Telemetry />
            </div>
          </div>
        </div>

        {/* Нижняя строка-счётчики */}
        <div className="relative grid grid-cols-2 border-t border-line sm:grid-cols-4">
          {[
            { label: "projects", value: String(total) },
            { label: "technologies", value: String(techTotal) },
            { label: "status", value: "open" },
            { label: "render", value: "webgl" },
          ].map((s, i) => (
            <div
              key={s.label}
              className={`flex items-baseline justify-between gap-2 py-4 pr-4 ${
                i > 0 ? "sm:border-l sm:border-line sm:pl-4" : ""
              }`}
            >
              <span className="hud">{s.label}</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink">
                {s.value}
              </span>
            </div>
          ))}
        </div>

        <p className="hud mt-4 flex items-center gap-2 lg:hidden">
          <span>scroll</span>
          <span className="h-px w-10 bg-line-strong" />
          <span className="animate-blink">↓</span>
        </p>
      </div>

    </section>
  );
}
