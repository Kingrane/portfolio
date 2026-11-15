/**
 * Единственный источник правды по проектам.
 * Здесь только данные — никакой разметки и стилей.
 * Чтобы добавить проект, допиши объект в массив `projects`.
 */

/** Группа проекта: вайбкод или сделанный руками. Используется фильтрами. */
export type ProjectGroup = "vibe" | "handmade"

export interface Project {
  readonly title: string
  readonly description: string
  readonly tech: readonly string[]
  /** Ссылка на живой результат (или на страницу пакета/модели, если демо нет) */
  readonly href: string
  /** Исходники. Может отсутствовать, если проекта нет на GitHub. */
  readonly repo?: string
  readonly group: ProjectGroup
  /**
   * Превью-скриншот. Если не задан, карточка рисует
   * процедурный ASCII-паттерн из названия проекта.
   */
  readonly image?: string
}

export const projects: Project[] = [
  {
    title: "Bobik-2B",
    description: "", // Draft retained in COPY_TO_APPROVE.md until approved.
    tech: ["Python", "Qwen3.5-2B", "Unsloth", "LoRA", "GGUF"],
    href: "https://huggingface.co/Kingrane/Bobik-2B",
    group: "vibe",
  },
  {
    title: "holoterm",
    description: "", // Draft retained in COPY_TO_APPROVE.md until approved.
    tech: ["Node.js", "JavaScript", "ANSI TrueColor", "Canvas API"],
    href: "https://www.npmjs.com/package/holoterm",
    repo: "https://github.com/Kingrane/holoterm",
    group: "vibe",
  },
  {
    title: "qtxt",
    description: "Анонимный обмен текстом по короткому коду. Без аккаунтов, без истории, без отслеживания. Текст живёт 10 минут.",
    tech: ["Next.js", "React", "TailwindCSS", "TypeScript", "Vercel KV"],
    href: "https://qqtxt.me",
    repo: "https://github.com/Kingrane/qtxt",
    group: "vibe",
  },
  {
    title: "super-brs",
    description: "Красивый веб и Android-клиент для БРС ЮФУ. Полная синхронизация через официальное REST API университета.",
    tech: ["React", "React Native", "JavaScript", "Tailwind CSS"],
    href: "https://super-brs.vercel.app",
    repo: "https://github.com/Kingrane/super-brs",
    group: "vibe",
  },
  {
    title: "glazik",
    description: "Мини-игры для тренировки восприятия, реакции и памяти. 3 режима: Цветочки, Светофор F1, Угадай цвет.",
    tech: ["Next.js", "React", "TypeScript", "CSS Custom Props"],
    href: "https://glazik.vercel.app",
    repo: "https://github.com/Kingrane/glazik",
    group: "vibe",
  },
  {
    title: "Halftone-Studio",
    description: "Веб-редактор изображений с 6 визуальными стилями: Classic, RGB Dots, Dither, Blocks, ASCII Art, Duotone.",
    tech: ["Vanilla JS", "Canvas API", "Tailwind CSS", "gif.js"],
    href: "https://ht-studio.vercel.app",
    repo: "https://github.com/Kingrane/Halftone-Studio",
    group: "vibe",
  },
  {
    title: "polotno",
    description: "Минималистичный веб-редактор заметок и эскизов с бесконечным холстом. (Рисовалка) С возможностью экспорта и шерингом холста",
    tech: ["React", "Tailwind CSS", "Next.js", "TypeScript, Zustand, MongoDB, Freehand, roughjs"],
    href: "https://polotno.vercel.app",
    repo: "https://github.com/Kingrane/polotno",
    group: "vibe",
  },
  {
    title: "little-tennis",
    description: "Минималистичная 3D-игра в настольный теннис на Three.js с кастомным физическим движком и эффектом Магнуса.",
    tech: ["Three.js", "React", "Vite", "TypeScript", "Tailwind CSS"],
    href: "https://little-tennis.vercel.app",
    repo: "https://github.com/Kingrane/little-tennis",
    group: "vibe",
  },
  {
    title: "nolimits",
    description: "Экспериментальная атмосферная страница с космическим эмбиентом. kracota.",
    tech: ["HTML", "CSS", "JavaScript"],
    href: "https://kracota.vercel.app",
    repo: "https://github.com/Kingrane/nolimits",
    group: "vibe",
  },
  {
    title: "pogodka",
    description: "Погодный контроллер со Swiss Design эстетикой. Динамические частицы, цветовые темы, Time Scrubbing.",
    tech: ["React", "Vite", "Framer Motion", "Canvas API", "OpenWeatherMap"],
    href: "https://pogod-ka.vercel.app",
    repo: "https://github.com/Kingrane/pogodka",
    group: "vibe",
  },
  {
    title: "Fizmatik",
    description: "Сайт для решения задач по математике, физике и информатике с помощью ИИ. Пошаговые решения с формулами.",
    tech: ["Python", "Flask", "OpenRouter API", "JavaScript", "CSS"],
    href: "https://fizmatik.onrender.com",
    repo: "https://github.com/Kingrane/Fizmatik",
    group: "vibe",
  },
  {
    title: "cmd-ai",
    description: "Нейросеть в терминале. Простая API-обёртка для вопросов через curl.",
    tech: ["Node.js", "Vercel Serverless"],
    href: "https://cmd-ai.vercel.app",
    repo: "https://github.com/Kingrane/cmd-ai",
    group: "vibe",
  },
  {
    title: "WEB-FL",
    description: "Веб-DAW в стиле FL Studio. Синтезаторы, Piano Roll, Arrangement View, эффекты Reverb/Delay, экспорт в WAV.",
    tech: ["React", "TypeScript", "Vite", "Tone.js", "Tailwind CSS"],
    href: "https://web-fl.vercel.app",
    repo: "https://github.com/Kingrane/WEB-FL",
    group: "vibe",
  },
  {
    title: "react-posts",
    description: "Красивенький сайтик на React с постами.",
    tech: ["React", "Vite", "JavaScript"],
    href: "https://drop-97a2d8f1-474.borisovroma55.workers.dev/",
    repo: "https://github.com/Kingrane/react-posts-novibecode",
    group: "handmade",
  },
  {
    title: "лендинг пицерии",
    description: "Сверстал лендинг пицерии на HTML/CSS/JS. Адаптивная верстка, модальные окна.",
    tech: ["HTML", "CSS", "JavaScript"],
    href: "https://kingrane.github.io/test-html/",
    repo: "https://github.com/Kingrane/test-html",
    group: "handmade",
  },
  {
    title: "novibecode-weather",
    description: "Погодка на React, написанная руками. Текущая погода по городам.",
    tech: ["React", "Vite", "JavaScript", "Tailwind CSS", "OpenMeteo API"],
    href: "https://kingrane.github.io/novibecode-weather/",
    repo: "https://github.com/Kingrane/novibecode-weather",
    group: "handmade",
  },
  {
    title: "novibecode-pizza",
    description: "Лендинг пицерии на React, написанный руками, уже не просто html, так и с работающей корзиной еще!",
    tech: ["React", "Vite", "JavaScript", "Tailwind CSS", "Redux Toolkit", "React Router", "Local Storage"],
    href: "https://kingrane.github.io/novibecode-pizza-react/",
    repo: "https://github.com/Kingrane/novibecode-pizza-react",
    group: "handmade",
  },
]

/** Проекты, собранные вайбкодом. */
export const vibeProjects: Project[] = projects.filter((p) => p.group === "vibe")

/** Проекты, сделанные руками. */
export const handmadeProjects: Project[] = projects.filter((p) => p.group === "handmade")

/** Все уникальные технологии в порядке первого появления — для чипов-фильтров. */
export const allTech: string[] = Array.from(new Set(projects.flatMap((p) => p.tech)))

export interface TechFacet {
  readonly name: string
  readonly count: number
}

/**
 * Счётчики для фильтров: сколько проектов используют каждую технологию.
 * Сортировка по популярности, затем по алфавиту — так первыми встают React/Next.
 */
export const techFacets: TechFacet[] = allTech
  .map((name) => ({ name, count: projects.filter((p) => p.tech.includes(name)).length }))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
