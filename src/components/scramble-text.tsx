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
  const [display, setDisplay] = useState<string[]>(text.split(""))
  const [key, setKey] = useState(0)
  const [hovering, setHovering] = useState(false)

  const scramble = useCallback(() => {
    setKey((k) => k + 1)
  }, [])

  useEffect(() => {
    let frame: number
    const duration = 70
    const staggerPerChar = 6
    const totalDuration = duration + text.length * staggerPerChar
    let step = 0

    const animate = () => {
      step++

      const result = text.split("").map((char, i) => {
        const charStart = i * staggerPerChar
        const charEnd = charStart + duration
        if (step < charStart || step > charEnd) {
          return char
        }
        if (step >= charEnd - 5) {
          return char
        }
        if (char === " ") return " "
        return chars[Math.floor(Math.random() * chars.length)]
      })

      setDisplay(result)

      if (step < totalDuration) {
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
      {display.join("")}
    </span>
  )
}
