"use client"

import { useEffect, useState, useCallback } from "react"

const chars = "!<>-_\\/[]{}—=+*^?#________abcdefghijklmnopqrstuvwxyz"

export function ScrambleText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const [display, setDisplay] = useState(text)
  const [key, setKey] = useState(0)
  const [hovering, setHovering] = useState(false)

  const scramble = useCallback(() => {
    setKey((k) => k + 1)
  }, [])

  useEffect(() => {
    let frame: number
    let step = 0
    const totalFrames = 70

    const animate = () => {
      step++
      const raw = step / totalFrames
      const progress = raw < 0.5 ? 2 * raw * raw : 1 - (-2 * raw + 2) ** 2 / 2
      const revealed = Math.floor(progress * text.length)

      const result = text
        .split("")
        .map((char, i) => {
          if (i < revealed) return char
          if (char === " ") return " "
          if (progress > 0.95) return char
          return chars[Math.floor(Math.random() * chars.length)]
        })
        .join("")

      setDisplay(result)

      if (progress < 1) {
        frame = requestAnimationFrame(animate)
      }
    }

    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [text, key])

  return (
    <span
      className={className}
      onMouseEnter={scramble}
      style={{ cursor: "pointer" }}
    >
      {display}
    </span>
  )
}
