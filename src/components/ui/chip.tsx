"use client";

import { cn } from "@/lib/cn";

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
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group inline-flex min-h-11 max-w-full items-center gap-2 border px-3 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors duration-300 motion-reduce:transition-none",
        active
          ? "border-amber/60 bg-amber-dim text-ink"
          : "border-line-strong text-ink-dim hover:border-amber/40 hover:text-ink",
        className,
      )}
    >
      <span className="min-w-0 break-words">{label}</span>
      {typeof count === "number" ? (
        <span className={cn("shrink-0 tabular-nums", active ? "text-amber" : "text-ink-dim")}>
          {count}
        </span>
      ) : null}
    </button>
  );
}
