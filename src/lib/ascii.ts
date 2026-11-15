/**
 * Процедурный ASCII-паттерн для превью проекта.
 *
 * Зачем: у проектов нет скриншотов, а пустые серые прямоугольники выглядят
 * дёшево. Здесь из названия проекта детерминированно (одинаково на сервере и
 * клиенте) рождается уникальный «кадр трансляции»: пятно из символов, похожее
 * на снимок с камеры станции.
 *
 * Алгоритм: seed → value-noise (3 октавы) + радиальное затухание → символ из
 * рампы плотности. Никаких canvas/DOM, поэтому работает и в SSR.
 */

/** Рампа плотности: от прозрачного к плотному. */
const RAMP = " .:-=+*xoOX#%@";

/** 32-битный хеш строки → начальное состояние PRNG. */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — крошечный быстрый PRNG с хорошим распределением. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Интерполяция со сглаживанием (smoothstep). */
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Простой 2D value-noise на сетке 8×8 из PRNG-значений. */
function makeNoise2D(seed: number): (x: number, y: number) => number {
  const rand = mulberry32(seed);
  const size = 8;
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();

  const at = (x: number, y: number) =>
    grid[((y % size) + size) % size * size + (((x % size) + size) % size)];

  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const tx = smooth(x - xi);
    const ty = smooth(y - yi);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
}

export interface AsciiOptions {
  cols?: number;
  rows?: number;
  /** 0 — плоско и шумно, 1 — плотный центр */
  focus?: number;
}

/**
 * Возвращает многострочную строку символов.
 * `variant` сдвигает seed — этим пользуемся для «передачи сигнала» на hover.
 */
export function makeAsciiArt(source: string, variant = 0, options: AsciiOptions = {}): string {
  const { cols = 46, rows = 12, focus = 0.65 } = options;
  const seed = hashString(`${source}::${variant}`);
  const noiseA = makeNoise2D(seed);
  const noiseB = makeNoise2D(seed ^ 0x9e3779b9);
  const noiseC = makeNoise2D(seed ^ 0x85ebca6b);

  const lines: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = "";
    for (let x = 0; x < cols; x++) {
      const u = x / (cols - 1);
      const v = y / (rows - 1);

      // Считаем в «пикселях сетки», иначе шум растягивается по горизонтали:
      // символов в строке в десять раз больше, чем строк.
      const px = u * cols;
      const py = v * rows;

      // Три октавы шума: крупные пятна + мелкая зернистость
      let n = noiseA(px / 13, py / 5) * 0.58;
      n += noiseB(px / 6.5, py / 2.6) * 0.28;
      n += noiseC(px / 3.2, py / 1.4) * 0.14;

      // Радиальное затухание к краям — эффект «объектив смотрит на объект»
      const dx = (u - 0.5) * 2;
      const dy = (v - 0.5) * 2;
      const r = Math.sqrt(dx * dx * 0.85 + dy * dy);
      const vignette = 1 - Math.min(1, r * 0.9);
      n *= (1 - focus) + focus * vignette;

      // Средняя плотность ниже 1, иначе кадр превращается в кашу
      n = Math.pow(Math.max(0, n), 1.35);

      const idx = Math.min(RAMP.length - 1, Math.floor(n * RAMP.length * 1.35));
      line += RAMP[idx];
    }
    lines.push(line);
  }
  return lines.join("\n");
}
