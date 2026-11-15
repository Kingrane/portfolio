"use client";

import { useEffect, useRef, useState } from "react";
import { pauseScroll } from "@/lib/store";
import { projects } from "@/content/projects";

const NAV = [
  { label: "index", href: "#top", index: "00", note: "начало" },
  { label: "stack", href: "#stack", index: "01", note: "чем работаю" },
  { label: "projects", href: "#projects", index: "02", note: `${projects.length} проектов` },
  { label: "garden", href: "#garden", index: "03", note: "написано руками" },
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
        className="flex h-11 w-11 items-center justify-center border border-line text-ink md:hidden"
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
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-line">
            <span className="font-display text-[13px] uppercase tracking-[0.22em]">Kingrane</span>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Закрыть меню" className="h-11 w-11 border border-line text-xl">×</button>
          </div>
          <nav aria-label="Разделы" className="mt-6 border-t border-line">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} onClick={() => dialog.current?.close()} className="flex min-h-16 items-baseline justify-between gap-4 border-b border-line py-4">
                <span className="flex items-baseline gap-3">
                  <span className="font-mono text-[10px] text-iris-light">{item.index}</span>
                  <span className="font-display text-[1.9rem] uppercase leading-none tracking-[-0.03em]">{item.label}</span>
                </span>
                <span className="hud">{item.note}</span>
              </a>
            ))}
          </nav>
          <a href="https://github.com/Kingrane" target="_blank" rel="noopener noreferrer" className="mt-auto flex min-h-12 items-center justify-between border border-line px-4 font-mono text-[11px] uppercase tracking-[0.16em]">
            github.com/kingrane <span className="text-iris-light">↗</span>
          </a>
          <p className="hud mt-3">signal stable · iris.os v2.0</p>
        </div>
      </dialog>
    </>
  );
}
