<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Portfolio — Kingrane

## Build
- Next.js 16.2.9 / React 19; TypeScript, Tailwind CSS 4, React Three Fiber / Three.js, Framer Motion, Lenis.
- `npm run dev` — локальная разработка
- `npm run build` — статическая сборка в `out/`
- `npm run lint` — линтер

## Git
- Продолжать работу в `main`, не возвращаться в `redesign` без просьбы пользователя.
- Коммиты делать, но НЕ пушить без явной команды.
- Пуш только когда скажут.
- `mainbackup` — резервная ветка старого `main` (`07a6a34`); не перезаписывать.
- Рабочая копия этой сессии: `C:\Users\REDMI\AppData\Local\Temp\opencode\portfolio-main-publish`.
- В исходной копии `D:\REDMI\vscodik\portfolio` есть пользовательские правки README/черновиков и `references/`; не переносить и не перезаписывать их автоматически.

## Структура
- `src/content/projects.ts` — актуальные данные проектов и согласованные описания; `src/data/projects.ts` относится к старой реализации.
- `src/app/page.tsx` — главная страница
- `src/app/globals.css` — глобальные стили, CSS-переменные, анимации
- `src/components/layout/` — шапка, мобильная навигация, футер.
- `src/components/sections/` — Hero, Stack, Projects, Handmade; `hero-title.tsx` — клиентский hover KINGRANE, `hero.module.css` — его стили.
- `src/components/projects/` — актуальные ProjectCard и 13 Canvas2D ASCII-обложек, бенто задаётся в `sections/projects.module.css`.
- `src/components/ui/` — курсор, Lenis, marquee, reveal и UI-примитивы.
- `src/components/webgl/` — SceneRoot, одна постоянная WebGL-сцена, миры, шейдеры, общий postprocessing и fallback-постеры.
- `src/scene/` — timeline, ASCII-источники и reading zones; `src/lib/store.ts` — изменяемое состояние сцены/курсора без React-render на каждый кадр.
- `public/scene/` — fallback-постеры; `public/.nojekyll` — для GitHub Pages.
- `reports/` — технический статус, сборки и доказательства проверок; `scripts/qa*.ts` — отдельные QA-прогоны, не запускать автоматически.
- Старые компоненты в корне `src/components/` не удалять в рамках соседних правок: они не описывают текущую страницу.

## Цветовая схема
- Void: `#050507`; поверхности: `#0a0a10`, `#0e0e16`, `#14141d`.
- Iris: `#6d5cff`, светлый `#b7a3ff`; Amber: `#ffb347`.
- Текст: `#ededf2` / `#9a9aa8`; шрифты: Unbounded / Inter / JetBrains Mono.
- Использовать текущие CSS-переменные; не возвращать старую gold-only схему.

## Деплой
- GitHub Pages через GitHub Actions (`.github/workflows/deploy.yml`)
- Static export: `output: 'export'` в next.config.ts
- Production basePath/assetPrefix: `/portfolio`; для файлов из `public/` использовать `asset()` из `src/lib/asset.ts`.
- `.nojekyll` в public/ для _next/ папки
- Сайт: https://kingrane.github.io/portfolio/

## Что сохранять
- Один persistent WebGL canvas; физический интегратор дыры, сад, дождь и fallback не переписывать ради локальных UI-правок.
- Бенто v3 и текущий порядок проектов (первые holoterm и Bobik-2B); менять порядок только по отдельной просьбе.
- Авторские тексты и согласованные описания; несогласованные варианты остаются в `COPY_TO_APPROVE.md`.
- Цветы за текстом пока оставить: пользователь отложил эту доработку.
- KINGRANE: обычный курсор-стрелка (`cursor: default`), локальный заметный Bayer-дизеринг по буквам и несколько фиолетовых частиц, плавное восстановление. Не скрывать весь заголовок.
- Hover использует кэшированные маски Canvas2D, ограниченный пул частиц и RAF только во время hover/затухания; отключён на touch/reduced-motion/Save-Data, останавливается за экраном и в скрытой вкладке.
- README.md намеренно минимальный: только «сайт-портфолио» и ссылка. Технические инструкции держать здесь и в `reports/`, не раздувать README.

## Текущий статус и ограничения
- Hero/сад опубликованы в `3f9f53f`; [CI 43733824212](https://github.com/Kingrane/portfolio/actions/runs/43733824212) — build/deploy success.
- `45f43df` добавил hover и оптимизацию обложек; затем увеличена заметность дизеринга, установлен `cursor: default`, обновлены эти инструкции и сокращён README. Новая production-сборка и встроенный TypeScript прошли; пользователь увидел работающий hover в браузере.
- 15.11.2026 пользователь явно разрешил коммит и push всех этих готовых изменений в `main` с обновлением Pages. Это разовое разрешение, не автоматическое разрешение будущих push. Статус публикации смотреть в [deploy workflow](https://github.com/Kingrane/portfolio/actions/workflows/deploy.yml); push сам по себе не доказывает успешный deploy.
- Обложки уже используют общий RAF, предрасчёт тора, dirty-cell atlas и паузу рисования при скролле. **Микрофриз у первых двух проектов остался; пользователь прямо отложил его исправление. Не профилировать и не менять производительность сейчас — ждать следующего запроса.**
- Production build разрешён. Предыдущее разрешение браузера — только первые две карточки и новый hover; теперь проверки микрофриза отложены. Полный QA, Lighthouse и мобильные CPU-прогоны не запускать без нового разрешения.
- Не выдавать короткие RAF-замеры за GPU/presented FPS и не заявлять полное устранение фризов. Старые проверки фазы A не подтверждают новые фазы.
- [Общий статус](reports/v3-status.md), [публикация hero/сада](reports/v3-refinement-publication.md), [локальный hover и точечные измерения](reports/v3-hover-covers.md). Снимки/замеры относятся к указанной в отчёте версии, не автоматически к следующим изменениям.
