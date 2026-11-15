import * as THREE from "three";

/**
 * Атлас глифов: один раз рисуем символы в canvas 2D и отдаём как текстуру.
 * В шейдере это позволяет за один сэмпл получить форму символа — вместо
 * дорогого signed-distance рендера текста.
 *
 * Раскладка: 8 колонок, строки по мере надобности. Каждая ячейка квадратная.
 */

/** Рампа плотности для ASCII-режима — от пустого к плотному. */
export const ASCII_RAMP = " .:-=+*#%@";

const CELL = 32;
const COLS = 8;

export function createGlyphAtlas(chars: string = ASCII_RAMP): {
  texture: THREE.Texture;
  cols: number;
  rows: number;
} {
  const rows = Math.ceil(chars.length / COLS);
  const canvas = document.createElement("canvas");
  canvas.width = COLS * CELL;
  canvas.height = rows * CELL;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Крайне маловероятно; пустая текстура лучше падения
    const empty = new THREE.Texture();
    return { texture: empty, cols: COLS, rows };
  }

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${CELL * 0.92}px ui-monospace, "JetBrains Mono", monospace`;

  chars.split("").forEach((ch, i) => {
    if (ch === " ") return;
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    ctx.fillText(ch, col * CELL + CELL / 2, row * CELL + CELL / 2 + CELL * 0.04);
  });

  const texture = new THREE.CanvasTexture(canvas);
  // Canvas rows stay top-to-bottom; the shader flips Y inside each glyph.
  texture.flipY = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return { texture, cols: COLS, rows };
}
