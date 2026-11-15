/**
 * Стек: языки и инструменты. Только данные.
 * `src` — ссылка на иконку (simpleicons CDN). Если иконки нет, `icon` можно
 * передать готовым React-узлом прямо из компонента.
 */

import type { ReactNode } from "react"

export interface StackItem {
  readonly name: string
  readonly src?: string
  readonly icon?: ReactNode
}

const F0F2F5 = "f0f2f5" // цвет иконок в URL (simpleicons отдаёт SVG в этом цвете)

export const languages: StackItem[] = [
  { name: "Python", src: `https://cdn.simpleicons.org/python/${F0F2F5}` },
  { name: "C#", src: `https://cdn.simpleicons.org/c/${F0F2F5}` },
  { name: "JavaScript", src: `https://cdn.simpleicons.org/javascript/${F0F2F5}` },
  { name: "HTML5", src: `https://cdn.simpleicons.org/html5/${F0F2F5}` },
  { name: "CSS3", src: `https://cdn.simpleicons.org/css/${F0F2F5}` },
  { name: "React", src: `https://cdn.simpleicons.org/react/${F0F2F5}` },
]

export const technologies: StackItem[] = [
  { name: "Claude", src: `https://cdn.simpleicons.org/claude/${F0F2F5}` },
  { name: "OpenCode", src: `https://cdn.simpleicons.org/opencode/${F0F2F5}` },
  { name: "Vercel", src: `https://cdn.simpleicons.org/vercel/${F0F2F5}` },
  { name: "Google AI", src: `https://cdn.simpleicons.org/google/${F0F2F5}` },
  { name: "Git", src: `https://cdn.simpleicons.org/git/${F0F2F5}` },
  { name: "Jetbrains IDES", src: `https://cdn.simpleicons.org/jetbrains/${F0F2F5}` },
  { name: "Linux :)", src: `https://cdn.simpleicons.org/linux/${F0F2F5}` },
  { name: "Blender", src: `https://cdn.simpleicons.org/blender/${F0F2F5}` },
]
