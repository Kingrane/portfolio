export interface Project {
  title: string
  description: string
  tech: string[]
  href: string
  repo: string
  image?: string
}

export const projects: Project[] = [
  {
    title: "qtxt",
    description: "Анонимный обмен текстом по короткому коду. Без аккаунтов, без истории, без отслеживания. Текст живёт 10 минут.",
    tech: ["Next.js", "React", "TailwindCSS", "TypeScript", "Vercel KV"],
    href: "https://qqtxt.me",
    repo: "https://github.com/Kingrane/qtxt",
  },
  {
    title: "super-brs",
    description: "Красивый веб и Android-клиент для БРС ЮФУ. Полная синхронизация через официальное REST API университета.",
    tech: ["React", "React Native", "JavaScript", "Tailwind CSS"],
    href: "https://super-brs.vercel.app",
    repo: "https://github.com/Kingrane/super-brs",
  },
  {
    title: "glazik",
    description: "Мини-игры для тренировки восприятия, реакции и памяти. 3 режима: Цветочки, Светофор F1, Угадай цвет.",
    tech: ["Next.js", "React", "TypeScript", "CSS Custom Props"],
    href: "https://glazik.vercel.app",
    repo: "https://github.com/Kingrane/glazik",
  },
  {
    title: "Halftone-Studio",
    description: "Веб-редактор изображений с 6 визуальными стилями: Classic, RGB Dots, Dither, Blocks, ASCII Art, Duotone.",
    tech: ["Vanilla JS", "Canvas API", "Tailwind CSS", "gif.js"],
    href: "https://ht-studio.vercel.app",
    repo: "https://github.com/Kingrane/Halftone-Studio",
  },
  {
    title: "little-tennis",
    description: "Минималистичная 3D-игра в настольный теннис на Three.js с кастомным физическим движком и эффектом Магнуса.",
    tech: ["Three.js", "React", "Vite", "TypeScript", "Tailwind CSS"],
    href: "https://little-tennis.vercel.app",
    repo: "https://github.com/Kingrane/little-tennis",
  },
  {
    title: "nolimits",
    description: "Экспериментальная атмосферная страница с космическим эмбиентом. kracota.",
    tech: ["HTML", "CSS", "JavaScript"],
    href: "https://kracota.vercel.app",
    repo: "https://github.com/Kingrane/nolimits",
  },
  {
    title: "лендинг пицерии (не вайбкодинг!)",
    description: "Сверстал лендинг пицерии на HTML/CSS/JS. Адаптивная верстка, модальные окна.",
    tech: ["HTML", "CSS", "JavaScript"],
    href: "https://kingrane.github.io/test-html/",
    repo: "https://github.com/Kingrane/test-html",
  },
  {
    title: "pogodka",
    description: "Погодный контроллер со Swiss Design эстетикой. Динамические частицы, цветовые темы, Time Scrubbing.",
    tech: ["React", "Vite", "Framer Motion", "Canvas API", "OpenWeatherMap"],
    href: "https://pogod-ka.vercel.app",
    repo: "https://github.com/Kingrane/pogodka",
  },
  {
    title: "Fizmatik",
    description: "Сайт для решения задач по математике, физике и информатике с помощью ИИ. Пошаговые решения с формулами.",
    tech: ["Python", "Flask", "OpenRouter API", "JavaScript", "CSS"],
    href: "https://fizmatik.onrender.com",
    repo: "https://github.com/Kingrane/Fizmatik",
  },
  {
    title: "cmd-ai",
    description: "Нейросеть в терминале. Простая API-обёртка для вопросов через curl.",
    tech: ["Node.js", "Vercel Serverless"],
    href: "https://cmd-ai.vercel.app",
    repo: "https://github.com/Kingrane/cmd-ai",
  },
  {
    title: "WEB-FL",
    description: "Веб-DAW в стиле FL Studio. Синтезаторы, Piano Roll, Arrangement View, эффекты Reverb/Delay, экспорт в WAV.",
    tech: ["React", "TypeScript", "Vite", "Tone.js", "Tailwind CSS"],
    href: "https://web-fl.vercel.app",
    repo: "https://github.com/Kingrane/WEB-FL",
  },
]
