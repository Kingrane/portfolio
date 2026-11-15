"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * Фильтр-чип со счётчиком: `REACT 8`.
 * Рамка 1px, моно-капс, при активации заливается ирисом.
 */
export function Chip({
  label,
  count,
  active = false,
  onClick,
  className,
}: {
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "group relative inline-flex min-h-11 items-center gap-2 border px-2.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-300",
        active
          ? "border-iris/70 bg-iris-dim text-ink"
          : "border-line text-ink-dim hover:border-line-strong hover:text-ink",
        className,
      )}
    >
      <span className="translate-y-px">{label}</span>
      {typeof count === "number" ? (
        <span
          className={cn(
            "translate-y-px tabular-nums",
            active ? "text-iris-light" : "text-ink-faint group-hover:text-ink-dim",
          )}
        >
          {count}
        </span>
      ) : null}
    </motion.button>
  );
}
