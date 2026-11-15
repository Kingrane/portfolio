"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/cn";

/** Reversible scroll motion. Text stays opaque while in the reading area. */
export function Reveal({
  children, y = 20, className,
}: {
  children: React.ReactNode;
  y?: number;
  className?: string;
  delay?: number;
  once?: boolean;
}) {
  const target = useRef<HTMLDivElement>(null);
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { scrollYProgress } = useScroll({ target, offset: ["start end", "end start"] });
  const translate = useTransform(scrollYProgress, [0, 0.18, 0.82, 1], [y, 0, 0, -y]);
  return (
    <motion.div ref={target} style={reduce ? undefined : { y: translate }} className={className}>
      {children}
    </motion.div>
  );
}

/** One readable heading, not dozens of independently hidden words. */
export function SplitText({ text, className }: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
  once?: boolean;
}) {
  const target = useRef<HTMLSpanElement>(null);
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { scrollYProgress } = useScroll({ target, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [16, 0, 0, -12]);
  return <motion.span ref={target} className={cn("inline-block", className)} style={reduce ? undefined : { y }}>{text}</motion.span>;
}
