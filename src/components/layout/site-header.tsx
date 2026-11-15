import Link from "next/link";
import { MobileNav } from "@/components/layout/mobile-nav";

const NAV = [
  { label: "Главная", href: "#top" },
  { label: "Стек", href: "#stack" },
  { label: "Проекты", href: "#projects" },
  { label: "Ручками", href: "#garden" },
];

/** Only the logo, four section links and GitHub. */
export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-[var(--z-header)] border-b border-line bg-void/70 backdrop-blur-xl">
      <div data-reading data-reading-fixed className="mx-auto flex h-14 w-full max-w-[var(--container-max)] items-center justify-between gap-3 px-[var(--gutter)]">
        <Link
          href="#top"
          className="header-control inline-flex min-h-11 items-center"
          aria-label="Kingrane — на главную"
        >
          <span className="font-display text-[13px] uppercase tracking-[0.06em] text-ink">
            kingrane
          </span>
        </Link>

        <nav aria-label="Основная навигация" className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="header-control inline-flex min-h-11 items-center font-mono text-[11px] tracking-[0.06em] text-ink-dim transition-colors duration-300 hover:text-amber motion-reduce:transition-none"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="https://github.com/Kingrane"
            target="_blank"
            rel="noopener noreferrer"
            className="header-control inline-flex min-h-11 items-center gap-2 px-2 font-mono text-[11px] tracking-[0.06em] text-ink-dim transition-colors duration-300 hover:text-amber motion-reduce:transition-none"
          >
            GitHub
            <span aria-hidden className="text-amber">
              ↗
            </span>
          </a>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
