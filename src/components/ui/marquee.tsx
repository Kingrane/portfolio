"use client";

import { cn } from "@/lib/cn";
import type { PointerEvent } from "react";
import styles from "./marquee.module.css";

function tilt(event: PointerEvent<HTMLLIElement>) {
  if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // Measure on ENTER as well as MOVE: first hover needs no priming event.
  const box = event.currentTarget.getBoundingClientRect();
  const x = Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1));
  const y = Math.max(-1, Math.min(1, (event.clientY - box.top) / box.height * 2 - 1));
  event.currentTarget.style.setProperty("--stack-rx", `${-y * 3}deg`);
  event.currentTarget.style.setProperty("--stack-ry", `${x * 3}deg`);
  event.currentTarget.style.setProperty("--stack-lift", "-2px");
}

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
                onPointerEnter={tilt}
                onPointerMove={tilt}
                onPointerLeave={(event) => {
                  event.currentTarget.style.setProperty("--stack-rx", "0deg");
                  event.currentTarget.style.setProperty("--stack-ry", "0deg");
                  event.currentTarget.style.setProperty("--stack-lift", "0px");
                }}
                className={cn(
                  styles.item,
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
