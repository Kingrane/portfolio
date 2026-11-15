"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export interface MarqueeItem {
  name: string;
  src?: string;
}

/**
 * Бегущая строка в стиле «тикер станции». Лента дублируется дважды и едет
 * ровно на 50% — стыка не видно. На ховере замирает, чтобы можно было прочитать.
 */
export function Marquee({
  items,
  reverse = false,
  className,
  itemClassName,
}: {
  items: MarqueeItem[];
  reverse?: boolean;
  className?: string;
  itemClassName?: string;
}) {
  const [paused, setPaused] = useState(false);
  const row = [...items, ...items];

  return (
    <div
      className={cn("group relative overflow-hidden", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      // Клавиатурный фокус внутри ленты тоже ставит её на паузу
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        className={cn(
          "flex w-max",
          reverse ? "animate-[marquee-reverse_44s_linear_infinite]" : "animate-[marquee_38s_linear_infinite]",
        )}
        style={{ animationPlayState: paused ? "paused" : "running" }}
      >
        {row.map((item, i) => (
          <div
            key={`${item.name}-${i}`}
            className={cn(
              "flex items-center gap-3 border-r border-line px-6 py-3 text-ink-faint transition-colors duration-300 hover:text-ink",
              itemClassName,
            )}
          >
            {item.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.src}
                alt=""
                width={18}
                height={18}
                loading="lazy"
                decoding="async"
                className="h-[18px] w-[18px] opacity-60 invert-0"
              />
            ) : (
              <span className="h-1 w-1 rotate-45 bg-iris/60" />
            )}
            <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em]">
              {item.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
