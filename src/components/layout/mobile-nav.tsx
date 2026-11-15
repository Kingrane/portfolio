"use client";

import { useEffect, useRef, useState } from "react";
import { pauseScroll } from "@/lib/store";

const NAV = [
  { label: "Главная", href: "#top" },
  { label: "Стек", href: "#stack" },
  { label: "Проекты", href: "#projects" },
  { label: "Ручками", href: "#garden" },
];

/** Native modal: traps focus, makes the background inert and supports Escape. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = dialog.current;
    const restoreFocus = document.activeElement as HTMLElement | null;
    const media = window.matchMedia("(min-width: 768px)");
    const onResize = () => { if (media.matches) panel?.close(); };
    panel?.showModal();
    pauseScroll(true);
    document.body.dataset.locked = "true";
    media.addEventListener("change", onResize);

    return () => {
      panel?.close();
      media.removeEventListener("change", onResize);
      delete document.body.dataset.locked;
      pauseScroll(false);
      restoreFocus?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label="Открыть меню"
        className="flex h-11 w-11 items-center justify-center text-ink md:hidden"
      >
        <span aria-hidden className="block h-[9px] w-4 border-y border-current" />
      </button>

      <dialog
        ref={dialog}
        id="mobile-nav"
        aria-label="Разделы портфолио"
        onClose={() => setOpen(false)}
        className="fixed inset-0 m-0 h-[100svh] max-h-none w-full max-w-none border-0 bg-void p-0 text-ink backdrop:bg-void"
      >
        <div className="flex h-full flex-col px-[var(--gutter)] pb-[max(2rem,env(safe-area-inset-bottom))]" data-lenis-prevent>
          <div data-reading className="flex h-14 shrink-0 items-center justify-between border-b border-line">
            <span className="font-display text-[13px] uppercase tracking-[0.06em]">Kingrane</span>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Закрыть меню" className="h-11 w-11 border border-line text-xl">×</button>
          </div>
          <nav data-reading aria-label="Разделы" className="mt-6 border-t border-line">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} onClick={() => dialog.current?.close()} className="flex min-h-16 items-baseline justify-between gap-4 border-b border-line py-4">
                <span className="font-display text-[1.9rem] leading-none tracking-[-0.03em]">{item.label}</span>
              </a>
            ))}
          </nav>
          <a data-reading href="https://github.com/Kingrane" target="_blank" rel="noopener noreferrer" className="mt-auto flex min-h-12 items-center justify-between border border-line-strong px-4 font-mono text-[11px] tracking-[0.06em]">
            GitHub <span aria-hidden className="text-amber">↗</span>
          </a>
        </div>
      </dialog>
    </>
  );
}
