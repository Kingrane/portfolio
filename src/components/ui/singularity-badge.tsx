"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useSingularity } from "@/lib/singularity";

/**
 * Плашка пасхалки. Появляется только на время эффекта — это не элемент
 * навигации, поэтому из дерева доступности она убрана.
 */
export function SingularityBadge() {
  const active = useSingularity();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[4.25rem] z-[var(--z-hud)] flex justify-center px-4">
      <AnimatePresence>
        {active ? (
          <motion.p
            aria-hidden
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-2 border border-amber/40 bg-void/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-amber backdrop-blur-md"
          >
            <span className="h-1 w-1 animate-pulse bg-amber" />
            singularity · event horizon engaged
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
