import Link from "next/link";
import { StationClock } from "@/components/ui/station-clock";
import { MobileNav } from "@/components/layout/mobile-nav";

const NAV = [
  { label: "index", href: "#top", index: "00" },
  { label: "stack", href: "#stack", index: "01" },
  { label: "projects", href: "#projects", index: "02" },
  { label: "garden", href: "#garden", index: "03" },
];

/**
 * Шапка станции. Тонкая, липкая, полупрозрачная: контент под ней продолжает
 * жить, поэтому сцена видна насквозь.
 */
export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-[var(--z-header)] border-b border-line bg-void/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-[var(--container-max)] items-center justify-between gap-6 px-[var(--gutter)]">
        <Link
          href="#top"
          data-singularity-trigger
          className="group flex items-center gap-2.5"
          aria-label="Kingrane — на главную"
        >
          <span className="relative flex h-[14px] w-[14px] items-center justify-center">
            <span className="absolute inset-0 rotate-45 border border-iris/60 transition-transform duration-700 group-hover:rotate-[135deg]" />
            <span className="h-1 w-1 bg-amber" />
          </span>
          <span className="font-display text-[13px] uppercase tracking-[0.22em] text-ink">
            kingrane
          </span>
        </Link>

        <nav aria-label="Основная навигация" className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="group flex items-baseline gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint transition-colors duration-300 hover:text-ink"
            >
              <span className="text-[8px] text-iris/70">{item.index}</span>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <StationClock />
          <a
            href="https://github.com/Kingrane"
            target="_blank"
            rel="noopener noreferrer"
            className="group hidden h-8 items-center gap-2 border border-line px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim transition-colors duration-300 hover:border-iris/50 hover:text-ink sm:flex"
          >
            <span className="h-1 w-1 rounded-full bg-moss" />
            github
            <span className="text-ink-faint transition-transform duration-300 group-hover:translate-x-0.5">
              ↗
            </span>
          </a>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
