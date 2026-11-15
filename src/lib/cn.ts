/** Склейка классов без зависимостей (clsx весит больше, чем делает). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ")
}
