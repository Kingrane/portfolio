"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Короткий ASCII-прелоадер. Ровно одна задача: дать шрифтам и первому кадру
 * устояться, не задерживая контент. Поэтому потолок — 900 мс, и он не блокирует
 * ни скролл, ни чтение (оверлей прозрачен на последних 30%).
 *
 * Повторно в той же сессии не показывается.
 */
export function Preloader() {
  const [visible, setVisible] = useState(false);
  const [count, setCount] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    try {
      if (sessionStorage.getItem("kingrane:booted") === "1") return;
      sessionStorage.setItem("kingrane:booted", "1");
    } catch {
      /* приватный режим — просто покажем */
    }

    document.body.dataset.locked = "true";

    const total = 700;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      setVisible(true);
      const t = Math.min(1, (now - start) / total);
      // Счётчик идёт рывками, как настоящий POST-тест
      setCount(Math.floor(t * 100));
      if (t < 1) raf = requestAnimationFrame(tick);
      else {
        setVisible(false);
        delete document.body.dataset.locked;
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      delete document.body.dataset.locked;
    };
  }, [reduce]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[var(--z-preloader)] flex flex-col justify-end bg-void p-[var(--gutter)]"
        >
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="hud mb-3">iris.os · boot sequence</p>
              <p className="font-mono text-[11px] leading-relaxed text-ink-faint">
                loading shaders
                <span className="animate-blink text-iris-light">_</span>
              </p>
            </div>
            <p className="font-display text-[14vw] leading-[0.8] tabular-nums text-ink sm:text-[8vw]">
              {String(count).padStart(3, "0")}
            </p>
          </div>
          <div className="mt-6 h-px w-full bg-line">
            <div
              className="h-full bg-iris transition-[width] duration-150 ease-linear"
              style={{ width: `${count}%` }}
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
