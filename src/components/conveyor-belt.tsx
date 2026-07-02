"use client"

import { motion } from "framer-motion"

type Item = { name: string; src?: string; icon?: React.ReactNode }

const languages: Item[] = [
  {
    name: "Python",
    src: "https://cdn.simpleicons.org/python/f0f2f5",
  },
  {
    name: "C#",
    src: "https://cdn.simpleicons.org/c/f0f2f5",
  },
  {
    name: "JavaScript",
    src: "https://cdn.simpleicons.org/javascript/f0f2f5",
  },
  {
    name: "HTML5",
    src: "https://cdn.simpleicons.org/html5/f0f2f5",
  },
  {
    name: "CSS3",
    src: "https://cdn.simpleicons.org/css/f0f2f5",
  },
  {
    name: "React",
    src: "https://cdn.simpleicons.org/react/f0f2f5",
  },
]

const technologies: Item[] = [
  {
    name: "Claude",
    src: "https://cdn.simpleicons.org/claude/f0f2f5",
  },
  {
    name: "OpenCode",
    src: "https://cdn.simpleicons.org/opencode/f0f2f5",
  },
  {
    name: "Vercel",
    src: "https://cdn.simpleicons.org/vercel/f0f2f5",
  },
  {
    name: "Google AI",
    src: "https://cdn.simpleicons.org/google/f0f2f5",
  },
  {
    name: "Git",
    src: "https://cdn.simpleicons.org/git/f0f2f5",
  },
  {
    name: "Jetbrains IDES",
    src: "https://cdn.simpleicons.org/jetbrains/f0f2f5",
  },
  {
    name: "Linux :)",
    src: "https://cdn.simpleicons.org/linux/f0f2f5",
  },
  {
    name: "Blender",
    src: "https://cdn.simpleicons.org/blender/f0f2f5",
  },
]

function Row({ items, reverse }: { items: Item[]; reverse?: boolean }) {
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
