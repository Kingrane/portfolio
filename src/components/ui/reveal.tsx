"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Мягкое появление блока при скролле. Уважает prefers-reduced-motion. */
export function Reveal({
  children,
  delay = 0,
  y = 20,
  className,
  once = true,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Заголовок, который «поднимается» из-под маски слово за словом.
 * Маска сделана как overflow:hidden на обёртке слова — текст не дёргается,
 * потому что каждая строка остаётся в потоке.
 */
export function SplitText({
  text,
  className,
  delay = 0,
  stagger = 0.055,
  once = true,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
  once?: boolean;
}) {
  const reduce = useReducedMotion();
  const words = text.split(" ");

  if (reduce) return <span className={className}>{text}</span>;

  return (
    <span className={cn("inline-block", className)} aria-label={text}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          aria-hidden
          className="inline-block overflow-hidden pb-[0.14em] -mb-[0.14em] align-bottom"
        >
          <motion.span
            className="inline-block will-change-transform"
            initial={{ y: "110%" }}
            whileInView={{ y: "0%" }}
            viewport={{ once, margin: "-40px" }}
            transition={{ duration: 0.9, delay: delay + i * stagger, ease: EASE }}
          >
            {word}
            {i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
