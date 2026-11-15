/**
 * GitHub Pages отдаёт сайт из подпапки /portfolio, поэтому любой файл из public
 * нужно запрашивать с префиксом. В dev префикса нет.
 * Используй ТОЛЬКО через эту функцию — иначе на проде будут битые картинки.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${clean}`;
}
