"use client"

import { motion } from "framer-motion"
import { languages, technologies, type StackItem } from "@/content/stack"

function Row({ items, reverse }: { items: StackItem[]; reverse?: boolean }) {
  return (
    <div className="relative flex overflow-hidden">
      <motion.div
        className="flex shrink-0 gap-16 pr-16"
        animate={{ x: reverse ? ["-30%", "0%"] : ["0%", "-50%"] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        {[...items, ...items].map((item, i) => (
          <div
            key={`${item.name}-${i}`}
            className="flex items-center gap-3 text-muted transition-colors duration-300 hover:text-heading"
          >
            {item.src ? (
              <img
                src={item.src}
                alt={item.name}
                className="h-8 w-8"
                loading="lazy"
              />
            ) : item.icon ? (
              item.icon
            ) : null}
            <span className="whitespace-nowrap text-sm font-medium tracking-wide">
              {item.name}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

export function ConveyorBelt() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-6 py-24 sm:px-8">
      <div className="mb-6 flex flex-col gap-8">
        <Row items={languages} />
        <Row items={technologies} reverse />
      </div>
    </section>
  )
}
