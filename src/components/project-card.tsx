"use client"

import { useRef, useState, useCallback } from "react"
import { motion } from "framer-motion"
import type { Project } from "@/data/projects"

export function ProjectCard({ project, index }: { project: Project; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 })

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setGlare({ x, y, opacity: 1 })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setGlare((prev) => ({ ...prev, opacity: 0 }))
  }, [])

  return (
    <motion.a
      href={project.href}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      className="group block"
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative overflow-hidden rounded-[16px] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-[0_8px_32px_rgba(94,234,212,0.04),0_0_60px_rgba(94,234,212,0.015)]"
      >
        <div className="absolute inset-0 rounded-[16px] bg-[rgba(255,255,255,0.02)] backdrop-blur-[32px] saturate-[1.1] border border-white/[0.04]" />

        <div
          className="absolute inset-0 rounded-[16px] transition-opacity duration-300"
          style={{
            opacity: glare.opacity,
            background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.07) 0%, rgba(94,234,212,0.03) 30%, transparent 70%)`,
          }}
        />

        <div
          className="absolute inset-0 rounded-[16px] pointer-events-none"
          style={{
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(255,255,255,0.02)`,
          }}
        />

        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold text-heading transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:text-accent">
              {project.title}
            </h3>
            <span className="mt-0.5 shrink-0 rounded-full bg-white/[0.03] p-1.5 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:bg-accent-dim group-hover:scale-105">
              <svg className="h-3.5 w-3.5 text-muted transition-colors duration-500 group-hover:text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </span>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-muted">
            {project.description}
          </p>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {project.tech.map((t) => (
              <span
                key={t}
                className="rounded-md bg-white/[0.02] px-2 py-0.5 text-[11px] font-medium text-muted tracking-wider transition-colors duration-500 group-hover:text-accent-muted"
              >
                {t}
              </span>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-muted/70 transition-colors duration-500 group-hover:text-accent-muted">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
            Source
          </div>
        </div>
      </div>
    </motion.a>
  )
}
