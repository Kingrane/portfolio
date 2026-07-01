<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Portfolio — Kingrane

## Build
- `npm run dev` — локальная разработка
- `npm run build` — статическая сборка в `out/`
- `npm run lint` — линтер

## Git
- Коммиты делать, но НЕ пушить без явной команды.
- Пуш только когда скажут.

## Структура
- `src/data/projects.ts` — данные проектов (title, description, tech, href, repo)
- `src/components/` — все компоненты (project-card, background, video-bg, cursor-trail, etc.)
- `src/app/page.tsx` — главная страница
- `src/app/globals.css` — глобальные стили, CSS-переменные, анимации
- `public/` — статика (видео, .nojekyll)

## Цветовая схема
- Accent: `#fbbf24` (золотой)
- Void: `#040506`
- Текст: `#f0f2f5` / `#c5c9d0` / `#6b7280`

## Деплой
- GitHub Pages через GitHub Actions (`.github/workflows/deploy.yml`)
- Static export: `output: 'export'` в next.config.ts
- `.nojekyll` в public/ для _next/ папки

## Компоненты (что делают)
- `CursorTrail` — золотые искорки за курсором (canvas particles)
- `ScrambleText` — анимация текста буква за буквой
- `ScrollProgress` — линия прогресса сверху
- `VideoBg` — фоновое видео с затемнением
- `Background` — film grain текстура
- `ScrollReveal` — появление элементов при скролле (framer-motion)
- `ProjectCard` — карточка проекта с liquid glass и spotlight border
