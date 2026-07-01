"use client"

import { useEffect, useRef } from "react"

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  rotation: number
  rotSpeed: number
  hue: number
}

export function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const mouseRef = useRef({ x: -100, y: -100 })
  const frameRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t) mouseRef.current = { x: t.clientX, y: t.clientY }
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("touchmove", onTouchMove)

    const animate = () => {
      frameRef.current++
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (frameRef.current % 2 === 0) {
        const { x, y } = mouseRef.current
        for (let i = 0; i < 2; i++) {
          const angle = Math.random() * Math.PI * 2
          const speed = 0.15 + Math.random() * 0.35
          particlesRef.current.push({
            x: x + (Math.random() - 0.5) * 8,
            y: y + (Math.random() - 0.5) * 8,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.2,
            life: 0,
            maxLife: 50 + Math.random() * 40,
            size: 1.5 + Math.random() * 2,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.04,
            hue: 40 + Math.floor(Math.random() * 15),
          })
        }
      }

      const particles = particlesRef.current
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life++
        if (p.life > p.maxLife) {
          particles.splice(i, 1)
          continue
        }

        p.x += p.vx
        p.y += p.vy
        p.vy += 0.004
        p.rotation += p.rotSpeed

        const progress = p.life / p.maxLife
        const opacity = (1 - progress * progress) * 0.8
        const scale = 1 - progress * 0.5

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.scale(scale, scale)
        ctx.globalAlpha = opacity

        ctx.fillStyle = `hsl(${p.hue}, 85%, 60%)`

        const s = p.size
        ctx.beginPath()
        for (let j = 0; j < 4; j++) {
          const a = (j / 4) * Math.PI * 2 - Math.PI / 2
          const r = j % 2 === 0 ? s : s * 0.35
          const px = Math.cos(a) * r
          const py = Math.sin(a) * r
          if (j === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.fill()

        ctx.restore()
      }

      requestAnimationFrame(animate)
    }

    const frame = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", resize)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("touchmove", onTouchMove)
    }
  }, [])

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50 mix-blend-screen" />
}
