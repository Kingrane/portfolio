"use client";

import { cn } from "@/lib/cn";

export interface MarqueeItem {
  name: string;
  src?: string;
}

/** The repeated row is visual only; reduced motion shows one wrapping list. */
export function Marquee({
  id,
  items,
  reverse = false,
  paused = false,
  className,
  itemClassName,
}: {
  id?: string;
  items: MarqueeItem[];
  reverse?: boolean;
  paused?: boolean;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div id={id} data-reading data-marquee className={cn("group relative overflow-hidden", className)}>
      <div
        data-marquee-track
        className={cn(
          "flex w-max group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:w-full motion-reduce:animate-none",
          reverse ? "animate-[marquee-reverse_44s_linear_infinite]" : "animate-[marquee_38s_linear_infinite]",
        )}
        style={paused ? { animationPlayState: "paused" } : undefined}
      >
        {[false, true].map((duplicate) => (
          <ul
            key={String(duplicate)}
            aria-hidden={duplicate || undefined}
            className={cn(
              "flex shrink-0 items-center motion-reduce:w-full motion-reduce:flex-wrap",
              duplicate && "motion-reduce:hidden",
            )}
          >
            {items.map((item) => (
              <li
                key={item.name}
                className={cn(
                  "flex items-center gap-4 px-6 py-5 text-ink-dim transition-colors duration-300 hover:text-amber motion-reduce:px-3 motion-reduce:py-3 motion-reduce:transition-none sm:px-8 sm:py-6",
                  itemClassName,
                )}
              >
                {item.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.src}
                    alt=""
                    width={28}
                    height={28}
                    loading="lazy"
                    decoding="async"
                    className="h-7 w-7 shrink-0"
                  />
                ) : null}
                <span className="whitespace-nowrap font-display text-[clamp(1.15rem,2.2vw,1.8rem)] font-light tracking-[-0.02em]">
                  {item.name}
                </span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
