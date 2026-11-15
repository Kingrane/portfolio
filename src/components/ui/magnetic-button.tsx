"use client";

import { useEffect, useRef } from "react";
import { motion, useSpring } from "framer-motion";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * Кнопка, которая слегка «притягивается» к курсору (magnetic hover).
 * Смещение ограничено 6px, чтобы это читалось как физика, а не как баг.
 */
export function MagneticButton({
  href,
  children,
  className,
  external = true,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  external?: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const bounds = useRef<DOMRect | null>(null);
  const x = useSpring(0, { stiffness: 260, damping: 22, mass: 0.4 });
  const y = useSpring(0, { stiffness: 260, damping: 22, mass: 0.4 });
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    if (reduce) {
      x.jump(0);
      y.jump(0);
    }
  }, [reduce, x, y]);

  const onMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== "mouse") return;
    const rect = bounds.current;
    if (!rect) return;
    x.set(Math.max(-6, Math.min(6, ((e.clientX - rect.left) / rect.width - 0.5) * 12)));
    y.set(Math.max(-4, Math.min(4, ((e.clientY - rect.top) / rect.height - 0.5) * 8)));
  };

  return (
    <motion.a
      ref={ref}
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onPointerEnter={() => { bounds.current = ref.current?.getBoundingClientRect() ?? null; }}
      onPointerMove={onMove}
      onPointerLeave={() => { bounds.current = null; x.set(0); y.set(0); }}
      style={{ x: reduce ? 0 : x, y: reduce ? 0 : y }}
      className={cn(
        "group relative inline-flex min-h-12 items-center gap-3 overflow-hidden border border-amber/50 bg-amber-dim px-6",
        "font-mono text-[11px] uppercase tracking-[0.06em] text-ink",
        "transition-colors duration-300 hover:border-amber hover:text-amber motion-reduce:transition-none",
        className,
      )}
    >
      <span className="relative z-10 flex items-center gap-3">{children}</span>
    </motion.a>
  );
}
