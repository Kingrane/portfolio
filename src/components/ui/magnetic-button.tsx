"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

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
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const reduce = useReducedMotion();

  const onMove = (e: React.PointerEvent) => {
    if (reduce) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 12;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 8;
    setOffset({ x, y });
  };

  return (
    <motion.a
      ref={ref}
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onPointerMove={onMove}
      onPointerLeave={() => setOffset({ x: 0, y: 0 })}
      animate={{ x: offset.x, y: offset.y }}
      transition={{ type: "spring", stiffness: 260, damping: 22, mass: 0.4 }}
      className={cn(
        "group relative inline-flex h-12 items-center gap-3 overflow-hidden border border-line-strong px-6",
        "font-mono text-[11px] uppercase tracking-[0.16em] text-ink",
        "transition-colors duration-500 hover:border-iris/60 hover:text-white",
        className,
      )}
    >
      {/* Заливка снизу при ховере */}
      <span
        aria-hidden
        className="absolute inset-0 -translate-y-full bg-iris-dim transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0"
      />
      <span className="relative z-10 flex items-center gap-3">{children}</span>
    </motion.a>
  );
}
