"use client";

import { useEffect, useRef } from "react";
import type { Project } from "@/content/projects";
import styles from "./project-cover.module.css";

const RAMP = " ·.:-=+*#%@";
const PALETTE = ["#f2efff", "#ffc777", "#cabbff"];
const BAYER = [
  0, 48, 12, 60, 3, 51, 15, 63,
  32, 16, 44, 28, 35, 19, 47, 31,
  8, 56, 4, 52, 11, 59, 7, 55,
  40, 24, 36, 20, 43, 27, 39, 23,
  2, 50, 14, 62, 1, 49, 13, 61,
  34, 18, 46, 30, 33, 17, 45, 29,
  10, 58, 6, 54, 9, 57, 5, 53,
  42, 26, 38, 22, 41, 25, 37, 21,
];

// Immediate, project-specific posters also work without a 2D context or JS.
const POSTERS: Record<string, string> = {
  holoterm: "           .:-=++=-:.\n       .+%@##++++##@%+.\n     :%@#+:        :+#@%:\n    =@%+.    .::.    .+%@=\n   +@%:   :+%@@@@%+:   :%@+\n   %@#   +@@+.  .+@@+   #@%\n   %@#   +@@+.  .+@@+   #@%\n   +@%:   :+%@@@@%+:   :%@+\n    =@%+.    .::.    .+%@=\n     :%@#+:        :+#@%:\n       .+%@##++++##@%+.\n           .:-=++=-:.",
  "Bobik-2B": "  .--------------------.\n  | ### ==== --        |\n  | ====== #### ===    |\n  '---.----------------'\n       '\n          .-----------------.\n          | ++++ #### ====  |\n          | ===== +++++ _   |\n          '-------------.---'\n                        '",
  "WEB-FL": "  |#| . . . . . . . | . . .\n  | | . ####. . . . | . . .\n  |#| . . . . ### . | . . .\n  | | . . . . . . . | ####.\n  |#| ####. . . . . | . . .\n  | | . . . ### . . | . . .\n  |#| . . . . . . . | . . .\n  | | ### . . . . . | . . .\n  +-----------------------+\n   /\\__/\\_/\\____/\\_/\\__",
  qtxt: "      ##    ##   ###   ###\n     # #   #  # #   # #   #\n       #   #  #   :   #   #\n       #   #  # #   # #   #\n      ###   ##   ###   ###\n  .------------------------.\n  | ==== #### ==== ...  .  |\n  | #### ====== ...  .     |\n  | ==== ####  ..  .       |\n  '------------------------'",
  "super-brs": "  .------------------------.\n  |  *   *   *   *   *     |\n  +----+----+----+----+-----+\n  | ## |    | ## |    | ### |\n  +----+----+----+----+-----+\n  |    | ## |    | ## |     |\n  +----+----+----+----+-----+\n  | ## | ## |    |    | ### |\n  +----+----+----+----+-----+\n  |    |    | ## | ## |     |\n  '----+----+----+----+-----'",
  glazik: "    .--------------------.\n    | (*) (*) (*) (*) (*)|\n    '--------------------'\n\n       .+.        .----.\n     ++(@)++      | ## |\n       '+'        '----'\n        |      .----. .----.\n       /|      | .. | | ++ |\n               '----' '----'",
  "Halftone-Studio": "       .+##@@@@##+.\n      +###@@@@@@###+\n     +#::@@@#@@@::#+\n     #:  .## ##.  :#\n     +::+##   ##+::+\n      +:#  +++  #:+\n       +## === ##+\n        +#######+\n     .++###++###+++.\n   .+##::::::::::##+.\n  +##...::::::::...##+",
  polotno: "  .------------------.\n  |   *       /\\      |\n  |      /\\ /  \\     |\n  | /\\ /  \\    \\    |\n  '------------------'\n           .-------.\n    ~~~    | ~~~   |    /\n  ~~   ~~  |   ~~~ |   /\n         ~~'-------'  /\n                     v",
  "little-tennis": "            .\n         .     .\n    .---------------.\n   /       |         \\\n  /########|##########\\\n /         |           \\\n'-----------------------'\n      /          \\     .##.\n     /            \\    ####\n                        ||",
  nolimits: "   .       *         .\n        .       .\n             .+####+.\n        .---+########+---.\n      --   +##########+  --\n        '---+########+---'\n             '+####+'\n  *      .          .\n  /\\_    /\\__    /\\_\n /    \\__/    \\__/   \\__\n/                       \\",
  pogodka: "    \\ | /\n   -- (@) --   .---.\n    / | \\  .-'     '--.\n          (             )\n           '-----------'\n            /  /  /  /\n           /  /  /  /\n          /  /  /  /\n  ------------------------\n             *",
  Fizmatik: "      |             x + y\n      |         *   -----\n      |      *        2\n      |   *\n      | *             /|\n  ----+------------  / |\n    * |             /  |\n  *   |            /___|\n      |\n      |        x + y = 2",
  "cmd-ai": "  .------------------------.\n  | * * *                  |\n  +------------------------+\n  | > curl                 |\n  |                        |\n  |   ### ===== ####       |\n  |   ==== #### ======     |\n  |   #### ===== _         |\n  |                        |\n  '------------------------'",
};

const FONT: Record<string, readonly number[]> = {
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 2, 4, 8, 31],
  ":": [0, 4, 4, 0, 4, 4, 0],
  x: [0, 0, 17, 10, 4, 10, 17],
  y: [0, 0, 17, 17, 15, 1, 14],
  "+": [0, 4, 4, 31, 4, 4, 0],
  "=": [0, 0, 31, 0, 31, 0, 0],
  c: [0, 0, 14, 16, 16, 17, 14],
  u: [0, 0, 17, 17, 17, 19, 13],
  r: [0, 0, 22, 25, 16, 16, 16],
  l: [12, 4, 4, 4, 4, 4, 14],
  ">": [0, 16, 8, 4, 8, 16, 0],
  "_": [0, 0, 0, 0, 0, 0, 31],
};

const hash = (n: number) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

/** Reusable cell buffers: no image readback, pixel processing or per-frame arrays. */
class AsciiField {
  readonly light: Float32Array;
  readonly tone: Uint8Array;
  readonly depth: Float32Array;

  constructor(readonly cols: number, readonly rows: number) {
    this.light = new Float32Array(cols * rows);
    this.tone = new Uint8Array(cols * rows);
    this.depth = new Float32Array(cols * rows);
  }

  clear() {
    this.light.fill(0);
    this.depth.fill(-Infinity);
  }

  point(x: number, y: number, light: number, tone = 1, z?: number) {
    const col = Math.floor(x / 160 * this.cols);
    const row = Math.floor(y / 100 * this.rows);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    const index = row * this.cols + col;
    if (z !== undefined) {
      if (z <= this.depth[index]) return;
      this.depth[index] = z;
    } else if (light <= this.light[index]) return;
    this.light[index] = light;
    this.tone[index] = tone;
  }

  line(x1: number, y1: number, x2: number, y2: number, light: number, tone = 1) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1) * this.cols / 160, Math.abs(y2 - y1) * this.rows / 100) * 1.5));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.point(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, light, tone);
    }
  }

  rect(x: number, y: number, w: number, h: number, light: number, tone = 1) {
    const left = Math.max(0, Math.floor(x / 160 * this.cols));
    const right = Math.min(this.cols, Math.ceil((x + w) / 160 * this.cols));
    const top = Math.max(0, Math.floor(y / 100 * this.rows));
    const bottom = Math.min(this.rows, Math.ceil((y + h) / 100 * this.rows));
    for (let row = top; row < bottom; row++) {
      for (let col = left; col < right; col++) {
        const index = row * this.cols + col;
        if (light <= this.light[index]) continue;
        this.light[index] = light;
        this.tone[index] = tone;
      }
    }
  }

  box(x: number, y: number, w: number, h: number, light: number, tone = 1) {
    this.line(x, y, x + w, y, light, tone);
    this.line(x + w, y, x + w, y + h, light, tone);
    this.line(x + w, y + h, x, y + h, light, tone);
    this.line(x, y + h, x, y, light, tone);
  }

  ellipse(x: number, y: number, rx: number, ry: number, light: number, tone = 1, ring = 0) {
    const left = Math.max(0, Math.floor((x - rx) / 160 * this.cols));
    const right = Math.min(this.cols, Math.ceil((x + rx) / 160 * this.cols));
    const top = Math.max(0, Math.floor((y - ry) / 100 * this.rows));
    const bottom = Math.min(this.rows, Math.ceil((y + ry) / 100 * this.rows));
    let covered = false;
    for (let row = top; row < bottom; row++) {
      for (let col = left; col < right; col++) {
        const dx = ((col + 0.5) / this.cols * 160 - x) / rx;
        const dy = ((row + 0.5) / this.rows * 100 - y) / ry;
        const d = dx * dx + dy * dy;
        if (d > 1 || (ring > 0 && d < (1 - ring) ** 2)) continue;
        covered = true;
        const index = row * this.cols + col;
        const value = light * (ring ? 1 : 0.65 + 0.35 * Math.sqrt(1 - d));
        if (value <= this.light[index]) continue;
        this.light[index] = value;
        this.tone[index] = tone;
      }
    }
    // Small balls, rain markers and neural nodes must not disappear between cells.
    if (!covered) this.point(x, y, light, tone);
  }

  text(value: string, x: number, y: number, size: number, light: number, tone = 1) {
    let cursor = x;
    for (let i = 0; i < value.length; i++) {
      const glyph = FONT[value[i]];
      if (!glyph) {
        cursor += size * 6;
        continue;
      }
      const colon = value[i] === ":";
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (glyph[row] & (1 << (4 - col))) this.rect(cursor + (col - (colon ? 1 : 0)) * size, y + row * size, size * 0.9, size * 0.9, light, tone);
        }
      }
      cursor += size * (colon ? 3 : 6);
    }
  }

  paragraphs(x: number, y: number, w: number, rows: number, seed: number, light: number, tone = 1, reveal = 1) {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 7; col++) {
        const width = (0.045 + hash(seed + row * 7 + col) * 0.065) * w;
        const available = w * reveal - col * w / 7;
        if (available <= 0) continue;
        this.rect(x + col * w / 7, y + row * 6, Math.min(width, available), 1.4, light * (0.55 + hash(seed + col * 3 + row) * 0.45), tone);
      }
    }
  }
}

function drawTorus(f: AsciiField, t: number, px: number, py: number) {
  const ax = 0.9 + py * 0.35;
  const ay = t * 0.25 + px * 0.55;
  const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
  f.ellipse(80, 86, 38, 3, 0.13, 2);
  for (let u = 0; u < Math.PI * 2; u += 0.11) {
    const cu = Math.cos(u), su = Math.sin(u);
    for (let v = 0; v < Math.PI * 2; v += 0.17) {
      const cv = Math.cos(v), sv = Math.sin(v);
      const x = (29 + 11 * cv) * cu;
      const y = (29 + 11 * cv) * su;
      const z = 11 * sv;
      const ry = y * cx - z * sx, rz = y * sx + z * cx;
      const rx = x * cy + rz * sy, depth = -x * sy + rz * cy;
      const scale = 125 / (125 - depth);
      const ny = cv * su * cx - sv * sx;
      const nz = -cv * cu * sy + (cv * su * sx + sv * cx) * cy;
      const light = Math.max(0.13, 0.35 + nz * 0.5 - ny * 0.24);
      f.point(80 + rx * scale, 46 + ry * scale, light, light > 0.82 ? 0 : depth > 5 ? 1 : 2, depth);
    }
  }
}

function drawDialogue(f: AsciiField, t: number, px: number, py: number) {
  const shift = px * 3;
  // Dialogue, not fabricated model output: the bubbles contain abstract glyph rows.
  for (let layer = 0; layer < 3; layer++) {
    for (let node = 0; node < 4; node++) {
      const x = 99 + layer * 16, y = 16 + node * 12;
      if (layer < 2) {
        for (let next = 0; next < 4; next++) f.line(x, y, x + 16, 16 + next * 12, 0.1 + 0.05 * Math.sin(t + node + next), 2);
      }
      f.ellipse(x, y, 1.6, 1.6, 0.48, 2);
    }
  }
  f.box(12 + shift, 17, 91, 30, 0.62, 1);
  f.line(22 + shift, 47, 22 + shift, 53, 0.62);
  f.line(22 + shift, 53, 30 + shift, 47, 0.62);
  f.paragraphs(20 + shift, 26, 74, 3, 8, 0.76);
  f.box(49 - shift, 57 + py * 2, 96, 28, 0.69, 2);
  f.line(125 - shift, 85 + py * 2, 134 - shift, 91, 0.69, 2);
  f.line(134 - shift, 91, 134 - shift, 85 + py * 2, 0.69, 2);
  const reveal = Math.min(1, ((t + 4) % 6) / 4);
  f.paragraphs(58 - shift, 64 + py * 2, 77, 2, 23, 0.85, 2);
  f.paragraphs(58 - shift, 76 + py * 2, 77, 1, 37, 0.85, 2, reveal);
  f.rect(58 + reveal * 77 - shift, 78 + py * 2, 2.5, 2, 0.9, 0);
  f.ellipse(26, 72, 8, 8, 0.76);
  f.ellipse(26, 70, 3, 2, 0.92, 0);
}

function drawPiano(f: AsciiField, t: number, px: number, py: number) {
  f.box(10, 12, 140, 67, 0.43, 2);
  for (let row = 0; row < 9; row++) {
    const y = 13 + row * 7.3;
    f.rect(11, y, row % 3 ? 11 : 16, 5.5, row % 3 ? 0.57 : 0.87, 0);
    f.line(28, y, 149, y, 0.14, 2);
  }
  for (let col = 0; col < 9; col++) f.line(29 + col * 15, 13, 29 + col * 15, 78, col % 4 ? 0.14 : 0.32, 2);
  for (let note = 0; note < 14; note++) {
    const x = 30 + (note * 23 + t * 4) % 115;
    const y = 17 + Math.floor(hash(note + 19) * 8) * 7.3;
    f.rect(x, y, Math.min(149 - x, 6 + hash(note + 48) * 14), 3.7, 0.72 + hash(note) * 0.2, note % 4 ? 1 : 2);
  }
  const playhead = 34 + ((t * 12 + 38 + px * 25) % 112 + 112) % 112;
  f.line(playhead, 10, playhead, 80, 0.97, 0);
  let previous = 90;
  for (let x = 12; x < 150; x += 2) {
    const y = 90 + Math.sin(x * 0.25 + t * 2) * Math.sin(x * 0.085 + py) * 5;
    f.line(x - 2, previous, x, y, 0.67);
    previous = y;
  }
}

function drawEphemeral(f: AsciiField, t: number, px: number, py: number) {
  const size = Math.max(3.15, 160 / f.cols * 0.92);
  const documentTop = Math.max(45, 10 + size * 7);
  f.text("10:00", (160 - size * 26) / 2, 7, size, 0.93, 0);
  f.box(23, documentTop, 112, 88 - documentTop, 0.46, 2);
  const edge = 116 - (0.5 + 0.5 * Math.sin(t * 0.5)) * 24;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 22; col++) {
      const x = 31 + col * 4.4, y = documentTop + 8 + row * 6;
      const cursor = Math.hypot(x - (px + 1) * 80, y - (py + 1) * 50);
      if (x > edge + hash(row * 22 + col) * 19 || (Math.abs(px) + Math.abs(py) > 0.05 && cursor < 10)) {
        f.point(x + 4 + Math.sin(t + col) * 4, y - (t * 4 + col * 3) % 12, 0.18 + hash(col + row) * 0.3, 2);
      } else f.rect(x, y, 2.5, 1.8, 0.5 + hash(col + row * 41) * 0.42);
    }
  }
  f.line(29, 92, 118, 92, 0.25, 2);
  f.line(29, 92, edge, 92, 0.7);
}

function drawSchedule(f: AsciiField, t: number, px: number, py: number) {
  f.box(15, 12, 130, 77, 0.6, 2);
  f.line(15, 28, 145, 28, 0.61, 2);
  for (let col = 0; col < 5; col++) {
    const x = 17 + col * 25.3;
    f.ellipse(x + 11, 20, 2.2, 2.2, 0.73, 0);
    if (col) f.line(x, 28, x, 89, 0.3, 2);
    for (let row = 0; row < 4; row++) {
      if (row) f.line(15, 28 + row * 15, 145, 28 + row * 15, 0.3, 2);
      if (hash(col * 8 + row + 9) < 0.3) continue;
      const active = Math.abs(x + 12 - (px + 1) * 80) < 14 && Math.abs(35 + row * 15 - (py + 1) * 50) < 9;
      f.rect(x + 4, 33 + row * 15, 16, 7, active ? 0.96 : 0.43 + hash(row * 5 + col) * 0.32, (row + col) % 3 ? 1 : 2);
      f.line(x + 6, 43 + row * 15, x + 15, 43 + row * 15, 0.37, 0);
    }
  }
  f.point(145, 12 + (t * 7) % 77, 0.97, 0);
}

function drawPerception(f: AsciiField, t: number, px: number, py: number) {
  f.box(20, 14, 120, 30, 0.46, 2);
  const active = (Math.floor(t * 0.7) + 2 + Math.round(px)) % 5;
  for (let i = 0; i < 5; i++) f.ellipse(32 + i * 24, 29, 7, 7, i === active ? 0.98 : 0.28, i === active ? 1 : 2);
  f.line(44, 69, 44, 92, 0.54, 2);
  f.line(44, 83, 33, 77, 0.54, 2);
  for (let petal = 0; petal < 6; petal++) {
    const angle = petal * Math.PI / 3 + Math.sin(t * 0.3) * 0.09 + py * 0.2;
    f.ellipse(44 + Math.cos(angle) * 9, 68 + Math.sin(angle) * 9, 5.5, 5.5, 0.75, 2);
  }
  f.ellipse(44, 68, 4, 4, 0.98);
  f.box(78, 61, 20, 20, 0.78, 1);
  f.rect(82, 65, 12, 12, 0.72, 1);
  f.box(108, 61, 20, 20, 0.68, 2);
  f.rect(112, 65, 12, 12, 0.57, 2);
  f.line(83, 89, 95, 89, 0.45, 0);
  f.line(113, 89, 125, 89, 0.45, 0);
}

function drawHalftone(f: AsciiField, t: number, px: number, py: number) {
  const split = 80 + px * 28 + Math.sin(t * 0.25) * 4;
  for (let row = 2; row < f.rows - 3; row++) {
    for (let col = 2; col < f.cols - 2; col++) {
      const x = (col + 0.5) / f.cols * 160, y = (row + 0.5) / f.rows * 100;
      const head = ((x - 80) / 24) ** 2 + ((y - 39) / 29) ** 2;
      const shoulders = ((x - 80) / 44) ** 2 + ((y - 93) / 26) ** 2;
      if (head > 1 && shoulders > 1) continue;
      let light = head <= 1 ? 0.5 + (80 - x) / 85 : 0.35 + (93 - y) / 70;
      if (head <= 1) {
        if (y < 25 + Math.sin(x * 0.09) * 4 || x < 61 || x > 100) light *= 0.48;
        if ((Math.abs(x - 70) < 5 || Math.abs(x - 89) < 5) && Math.abs(y - 36 - py) < 2) light = 0.15;
        if (x > 79 && x < 83 && y > 39 && y < 49) light = 0.84;
        if (Math.abs(x - 80) < 8 && Math.abs(y - 55) < 1.7) light = 0.19;
      }
      if (x < split && (col + row) % 2) light *= 0.25;
      f.point(x, y, light, x < split ? 1 : 2);
    }
  }
  f.box(31, 7, 98, 82, 0.42, 2);
  f.line(split, 9, split, 87, 0.72, 0);
  for (let i = 0; i < 6; i++) f.ellipse(55 + i * 10, 95, 1.8, 1.8, 0.28 + i * 0.12, i % 2 ? 2 : 1);
}

function drawCanvas(f: AsciiField, t: number, px: number, py: number) {
  for (let x = 8; x < 158; x += 10) {
    for (let y = 7; y < 97; y += 10) f.point(x, y, 0.11, 2);
  }
  f.box(17, 17, 78, 52, 0.6, 2);
  f.ellipse(76, 28, 5, 5, 0.8);
  f.line(23, 61, 41, 37, 0.77, 0);
  f.line(41, 37, 56, 58, 0.77, 0);
  f.line(48, 60, 63, 43, 0.77, 0);
  f.line(63, 43, 85, 61, 0.77, 0);
  f.box(77, 53, 48, 32, 0.72);
  f.paragraphs(83, 61, 35, 3, 7, 0.65);
  let lastX = 16, lastY = 79;
  for (let i = 0; i <= 50; i++) {
    const x = 16 + i * 1.8, y = 79 + Math.sin(i * 0.26 + t * 0.12) * 6 + py * Math.sin(i * 0.1) * 3;
    f.line(lastX, lastY, x, y, 0.82, 2);
    lastX = x; lastY = y;
  }
  const dx = px * 4;
  f.line(114 + dx, 81, 141 + dx, 43, 0.92, 0);
  f.line(119 + dx, 85, 146 + dx, 47, 0.92, 0);
  f.line(141 + dx, 43, 146 + dx, 47, 0.88);
  f.line(114 + dx, 81, 112 + dx, 88, 0.88);
  f.line(112 + dx, 88, 119 + dx, 85, 0.88);
}

function drawTennis(f: AsciiField, t: number, px: number, py: number) {
  // A perspective table, visible net, paddles and a Magnus-like curved trail.
  for (let y = 31; y < 77; y += 2) {
    const edge = (y - 31) * 0.5;
    f.line(38 - edge, y, 123 + edge, y, 0.24, 2);
  }
  f.line(38, 31, 123, 31, 0.78, 0);
  f.line(38, 31, 15, 77, 0.78, 0);
  f.line(123, 31, 146, 77, 0.78, 0);
  f.line(15, 77, 146, 77, 0.78, 0);
  f.line(80, 31, 80, 77, 0.65, 0);
  f.line(30, 50, 131, 50, 0.89, 0);
  f.line(30, 43, 131, 43, 0.82, 0);
  for (let x = 31; x < 131; x += 5) f.line(x, 43, x, 50, 0.4, 0);
  f.line(31, 77, 25, 92, 0.57, 2);
  f.line(129, 77, 135, 92, 0.57, 2);
  f.ellipse(30 + px * 9, 84, 9, 6, 0.77);
  f.line(32 + px * 9, 89, 36 + px * 9, 97, 0.78);
  f.ellipse(133, 26 + py * 5, 8, 5, 0.76, 2);
  const phase = t * 1.35 + 0.65;
  for (let i = 8; i >= 0; i--) {
    const p = phase - i * 0.045;
    f.ellipse(80 + Math.sin(p) * 42, 39 - Math.abs(Math.cos(p)) * 21 + Math.sin(p) * 14, i ? 1 : 2.4, i ? 1 : 2.4, i ? 0.4 - i * 0.035 : 0.99, i ? 1 : 0);
  }
}

function drawSpace(f: AsciiField, t: number, px: number, py: number) {
  for (let i = 0; i < 78; i++) {
    const x = hash(i + 40) * 160 + px * (i % 3), y = hash(i + 160) * 75 + py * (i % 3);
    f.point(x, y, 0.18 + hash(i + 230) * 0.52 + Math.sin(t * 0.5 + i) * 0.08, i % 5 ? 0 : 1);
  }
  f.ellipse(105 + px * 2, 40 + py * 2, 29, 9, 0.4, 2, 0.22);
  f.ellipse(105 + px * 2, 38 + py * 2, 18, 18, 0.64, 2);
  f.line(80, 45, 131, 32, 0.7);
  for (let row = 0; row < 6; row++) {
    let previousY = 0;
    for (let x = 0; x <= 160; x += 3) {
      const y = 75 + row * 5 + Math.sin(x * 0.05 + t * 0.12 + row * 0.25) * (8 - row * 0.65) + Math.sin(x * 0.14) * 2;
      if (x) f.line(x - 3, previousY, x, y, 0.25 + row * 0.075, row % 3 ? 2 : 1);
      previousY = y;
    }
  }
}

function drawWeather(f: AsciiField, t: number, px: number, py: number) {
  f.ellipse(48, 31, 13, 13, 0.89);
  for (let ray = 0; ray < 8; ray++) {
    const a = ray * Math.PI / 4 + t * 0.03;
    f.line(48 + Math.cos(a) * 17, 31 + Math.sin(a) * 17, 48 + Math.cos(a) * 21, 31 + Math.sin(a) * 21, 0.58);
  }
  const shift = px * 4 + Math.sin(t * 0.2) * 2;
  f.ellipse(78 + shift, 42, 15, 12, 0.62, 0);
  f.ellipse(94 + shift, 34 + py, 18, 16, 0.82, 0);
  f.ellipse(112 + shift, 44, 16, 12, 0.68, 0);
  f.rect(73 + shift, 43, 43, 12, 0.72, 0);
  for (let drop = 0; drop < 18; drop++) {
    const x = 67 + hash(drop + 13) * 57 + shift;
    const y = 58 + (hash(drop + 46) * 25 + t * 13) % 26;
    f.line(x, y, x - 2 - px, y + 4, 0.51 + hash(drop) * 0.26, 2);
  }
  f.line(21, 93, 139, 93, 0.39, 2);
  for (let tick = 0; tick < 9; tick++) f.line(22 + tick * 14, 91, 22 + tick * 14, 95, 0.43, 2);
  f.ellipse(80 + px * 45, 93, 2.4, 2.4, 0.95);
}

function drawMath(f: AsciiField, t: number, px: number, py: number) {
  f.line(12, 65, 89, 65, 0.61, 2);
  f.line(46, 13, 46, 89, 0.61, 2);
  for (let tick = 0; tick < 7; tick++) {
    f.line(16 + tick * 11, 63, 16 + tick * 11, 67, 0.4, 2);
    f.line(44, 17 + tick * 11, 48, 17 + tick * 11, 0.4, 2);
  }
  let lastY = 0;
  for (let x = 18; x < 80; x += 1.5) {
    const y = 67 - ((x - 47 - px * 3) / 7) ** 2 * 3;
    if (x > 18) f.line(x - 1.5, lastY, x, y, 0.87);
    lastY = y;
  }
  const marker = 47 + Math.sin(t * 0.45) * 24;
  f.ellipse(marker, 67 - ((marker - 47 - px * 3) / 7) ** 2 * 3, 2, 2, 0.99, 0);
  f.text("x+y", 97, 16, 2.1, 0.8, 0);
  f.line(96, 35, 137, 35, 0.73, 2);
  f.text("2", 112, 40, 1.8, 0.8, 0);
  f.line(100, 83, 137, 83, 0.8);
  f.line(137, 83, 137, 55 + py * 4, 0.8);
  f.line(100, 83, 137, 55 + py * 4, 0.8);
  f.box(132, 78, 5, 5, 0.55, 2);
}

function drawTerminal(f: AsciiField, t: number, px: number, py: number) {
  f.box(15, 17, 130, 69, 0.61, 2);
  f.line(15, 30, 145, 30, 0.52, 2);
  for (let dot = 0; dot < 3; dot++) f.ellipse(25 + dot * 8, 24, 1.5, 1.5, 0.72, dot ? 2 : 1);
  f.text(">", 22, 37, 3.2, 0.9);
  f.text("curl", 42, 37, 3.2, 0.82, 0);
  f.paragraphs(24, 64, 93, 3, 31, 0.77, 2);
  f.rect(84 + Math.sin(t * 0.8) * 8, 80, 4, 2, 0.94, 0);
  f.ellipse(126 + px * 2, 55 + py * 2, 9, 9, 0.68, 1, 0.28);
  f.line(122, 55, 130, 55, 0.81);
  f.line(126, 51, 126, 59, 0.81);
  f.line(118, 55, 104, 55, 0.42);
}

type Scene = (field: AsciiField, time: number, pointerX: number, pointerY: number) => void;

const SCENES: Record<string, Scene> = {
  holoterm: drawTorus,
  "Bobik-2B": drawDialogue,
  "WEB-FL": drawPiano,
  qtxt: drawEphemeral,
  "super-brs": drawSchedule,
  glazik: drawPerception,
  "Halftone-Studio": drawHalftone,
  polotno: drawCanvas,
  "little-tennis": drawTennis,
  nolimits: drawSpace,
  pogodka: drawWeather,
  Fizmatik: drawMath,
  "cmd-ai": drawTerminal,
};

type DataConnection = EventTarget & { readonly saveData?: boolean };

export function ProjectCover({ project }: { project: Project }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = SCENES[project.title];
    if (!canvas || !scene) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    const cover = canvas.parentElement;
    const host = canvas.closest("article");
    const atlas = document.createElement("canvas");
    const atlasCtx = atlas.getContext("2d");
    if (!cover || !host || !atlasCtx) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: DataConnection }).connection;
    const fontFamily = getComputedStyle(canvas).fontFamily;
    let field: AsciiField;
    let tileWidth = 0, tileHeight = 0;
    let frame = 0, lastFrame = 0, time = 0;
    let pointerX = 0, pointerY = 0;
    let visible = false, disposed = false, ready = false;
    let bounds: DOMRect | null = null;

    const isStatic = () => motion.matches || Boolean(connection?.saveData);

    const draw = () => {
      if (disposed || !field) return;
      field.clear();
      const still = isStatic();
      scene(field, still ? 0 : time, still ? 0 : pointerX, still ? 0 : pointerY);
      ctx.fillStyle = "#050507";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let row = 0; row < field.rows; row++) {
        for (let col = 0; col < field.cols; col++) {
          const index = row * field.cols + col;
          const light = field.light[index];
          if (light < 0.065) continue;
          const dither = (BAYER[(row % 8) * 8 + col % 8] / 64 - 0.5) * 0.13;
          const glyph = Math.min(RAMP.length - 1, Math.max(1, Math.floor((light + dither) * (RAMP.length - 1))));
          ctx.drawImage(atlas, glyph * tileWidth, field.tone[index] * tileHeight, tileWidth, tileHeight, col * tileWidth, row * tileHeight, tileWidth, tileHeight);
        }
      }
      if (!ready) {
        cover.setAttribute("data-ready", "");
        ready = true;
      }
    };

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = 0;
    };

    const tick = (now: number) => {
      frame = 0;
      if (disposed || !visible || document.hidden || isStatic()) return;
      if (!lastFrame || now - lastFrame >= 1000 / 30 - 0.5) {
        if (lastFrame) time += Math.min((now - lastFrame) / 1000, 0.08);
        lastFrame = now;
        draw();
      }
      frame = requestAnimationFrame(tick);
    };

    const sync = () => {
      stop();
      if (disposed) return;
      if (isStatic()) {
        time = pointerX = pointerY = 0;
        draw();
      } else if (visible && !document.hidden) frame = requestAnimationFrame(tick);
    };

    const resize = () => {
      if (disposed) return;
      const width = cover.clientWidth;
      const height = cover.clientHeight;
      if (!width || !height) return;
      const mobile = window.innerWidth < 640;
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
      const cell = mobile ? 10.5 : 9.5;
      const cols = Math.max(16, Math.floor(width / cell));
      const rows = Math.max(10, Math.floor(height / cell));
      // Whole pixel tiles avoid a seam between atlas glyphs at fractional DPR.
      tileWidth = Math.max(1, Math.round(width * dpr / cols));
      tileHeight = Math.max(1, Math.round(height * dpr / rows));
      if (field?.cols === cols && field.rows === rows && canvas.width === tileWidth * cols && canvas.height === tileHeight * rows) return;
      stop();
      bounds = null;
      field = new AsciiField(cols, rows);
      canvas.width = tileWidth * cols;
      canvas.height = tileHeight * rows;
      atlas.width = tileWidth * RAMP.length;
      atlas.height = tileHeight * PALETTE.length;
      atlasCtx.font = `${Math.round(tileHeight * 0.94)}px ${fontFamily}`;
      atlasCtx.textAlign = "center";
      atlasCtx.textBaseline = "middle";
      for (let tone = 0; tone < PALETTE.length; tone++) {
        atlasCtx.fillStyle = PALETTE[tone];
        atlasCtx.shadowColor = PALETTE[tone];
        atlasCtx.shadowBlur = dpr * 0.85;
        for (let glyph = 1; glyph < RAMP.length; glyph++) {
          atlasCtx.fillText(RAMP[glyph], (glyph + 0.5) * tileWidth, (tone + 0.51) * tileHeight);
        }
      }
      // Never wait for hover, an observer callback, or the animation to draw a poster.
      draw();
      sync();
    };

    const move = (event: PointerEvent) => {
      if (isStatic() || !visible || document.hidden) return;
      bounds ??= cover.getBoundingClientRect();
      pointerX = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
      pointerY = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    };
    const resetPointer = () => {
      pointerX = pointerY = 0;
      bounds = null;
    };

    resize();
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio > 0;
      if (!visible) resetPointer();
      sync();
    }, { threshold: [0, 0.02], rootMargin: "0px" });
    intersection.observe(cover);
    const observer = new ResizeObserver(resize);
    observer.observe(cover);
    host.addEventListener("pointermove", move, { passive: true });
    host.addEventListener("pointerdown", move, { passive: true });
    host.addEventListener("pointerleave", resetPointer);
    host.addEventListener("pointercancel", resetPointer);
    host.addEventListener("pointerup", resetPointer);
    window.addEventListener("scroll", resetPointer, { passive: true, capture: true });
    window.addEventListener("resize", resize);
    window.addEventListener("blur", resetPointer);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    connection?.addEventListener("change", sync);

    return () => {
      disposed = true;
      stop();
      intersection.disconnect();
      observer.disconnect();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerdown", move);
      host.removeEventListener("pointerleave", resetPointer);
      host.removeEventListener("pointercancel", resetPointer);
      host.removeEventListener("pointerup", resetPointer);
      window.removeEventListener("scroll", resetPointer, true);
      window.removeEventListener("resize", resize);
      window.removeEventListener("blur", resetPointer);
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
      connection?.removeEventListener("change", sync);
      cover.removeAttribute("data-ready");
      atlas.width = atlas.height = 0;
    };
  }, [project.title]);

  return (
    <div className={styles.cover} aria-hidden="true">
      <pre className={styles.fallback}>{POSTERS[project.title] ?? project.title}</pre>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
