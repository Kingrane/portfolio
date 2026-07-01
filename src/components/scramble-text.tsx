"use client"

import { useEffect, useState } from "react"

const chars = "!<>-_\\/[]{}—=+*^?#________abcdefghijklmnopqrstuvwxyz"

export function ScrambleText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const [display, setDisplay] = useState("")

  useEffect(() => {
    let frame: number
    let step = 0
    const totalFrames = 20

    const scramble = () => {
      step++
      const progress = Math.min(step / totalFrames, 1)
      const revealed = Math.floor(progress * text.length)

      const result = text
        .split("")
        .map((char, i) => {
          if (i < revealed) return char
          if (i === revealed && progress < 1) {
            if (char === " ") return " "
            return chars[Math.floor(Math.random() * chars.length)]
          }
          if (i > revealed && progress < 1) {
            if (char === " ") return " "
            return chars[Math.floor(Math.random() * chars.length)]
          }
          return char
        })
        .join("")

      setDisplay(result)

      if (progress < 1) {
        frame = requestAnimationFrame(scramble)
      }
    }

    frame = requestAnimationFrame(scramble)
    return () => cancelAnimationFrame(frame)
  }, [text])

  return <span className={className}>{display || text}</span>
}
