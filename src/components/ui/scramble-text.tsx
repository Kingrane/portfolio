"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

const GLYPHS = "01<>-_\\/[]{}—=+*^?#$%&@!░▒▓█◆○●";

/**
 * Текст, который «собирается» из мусорных символов.
 * На сервере рендерится сразу финальный текст (никаких прыжков и расхождения
 * гидрации), анимация стартует уже на клиенте.
 */
export function ScrambleText({
  text,
  className,
  duration = 620,
  onHover = true,
}: {
  text: string;
  className?: string;
  /** Полная длительность сборки в мс */
  duration?: number;
  /** Пересобирать при наведении */
  onHover?: boolean;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(text);
  const raf = useRef<number | null>(null);

  const run = () => {
    if (reduce) return;
    if (raf.current) cancelAnimationFrame(raf.current);
    const start = performance.now();
    const chars = text.split("");

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Символ фиксируется, когда прогресс доходит до его позиции справа налево
      const out = chars.map((ch, i) => {
        if (ch === " ") return " ";
        const threshold = 1 - i / (chars.length * 1.6);
        if (t >= threshold) return ch;
        return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      });
      setDisplay(out.join(""));
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else setDisplay(text);
    };

    raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    // Небольшая задержка, чтобы шрифт успел примениться до анимации
    const id = window.setTimeout(run, 90);
    return () => {
      window.clearTimeout(id);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <span
      className={cn("inline-block whitespace-pre", className)}
      onMouseEnter={onHover ? run : undefined}
      // Для скринридеров — настоящий текст, а не мерцающие символы
      aria-label={text}
    >
      <span aria-hidden>{display}</span>
    </span>
  );
}
