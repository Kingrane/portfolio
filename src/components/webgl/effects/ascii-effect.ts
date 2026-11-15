import * as THREE from "three";
import { Effect } from "postprocessing";
import type { RenderMode } from "@/lib/render-mode";

/**
 * ASCII / BRAILLE / DITHER — фирменный пост-эффект.
 *
 * Как работает: берём готовый кадр, режем на ячейки (по умолчанию 8 пикселей),
 * считаем яркость ячейки и подменяем её символом из атласа. Цвет берём из
 * исходного кадра, поэтому сцена остаётся окрашенной, а не белой.
 *
 * Режимы:
 *   ascii   — глиф из атласа по яркости
 *   braille — сетка точек 2×4, яркость точки берётся из шума и кадра
 *   dither  — круглая точка с радиусом от яркости и порогом Байера 8×8
 *
 * Текст на сайте — обычный HTML поверх канваса, поэтому читаемость не страдает
 * никогда: эффект живёт только в пределах сцены.
 */

const fragmentShader = /* glsl */ `
  uniform sampler2D uGlyphAtlas;
  uniform vec2 uResolution;
  uniform float uCell;
  uniform float uMode;       // 0 = ascii, 1 = braille, 2 = dither
  uniform float uStrength;   // 0..1 общая сила эффекта
  uniform vec2 uPointer;     // 0..1 экранные координаты, по умолчанию 0.5
  uniform float uTime;

  float bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x / 2.0 + a.y * a.y * 0.75);
  }
  float bayer4(vec2 a) {
    return bayer2(0.5 * a) * 0.25 + bayer2(a);
  }
  float bayer8(vec2 a) {
    return bayer4(0.5 * a) * 0.25 + bayer2(a);
  }

  float luma(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 px = uv * uResolution;
    vec2 cellIndex = floor(px / uCell);
    vec2 cellUv = fract(px / uCell);

    // Цвет и яркость самой ячейки (один сэмпл из центра — дёшево и достаточно)
    vec3 cellColor = texture2D(inputBuffer, (cellIndex + 0.5) * uCell / uResolution).rgb;
    float l = luma(cellColor);

    // Маска: эффект сильнее по краям и вокруг курсора, слабее в центре кадра,
    // чтобы не мешать чтению контента. Плюс яркостный гейт: в почти чёрных
    // областях эффекта нет вовсе — иначе фон превращается в серую «сетку».
    float edge = smoothstep(0.15, 0.62, distance(uv, vec2(0.5)) * 1.15);
    float near = smoothstep(0.28, 0.0, distance(uv, uPointer));
    float gate = smoothstep(0.012, 0.16, l);
    float mask = clamp(0.16 + edge * 0.55 + near * 0.8, 0.0, 1.0) * gate;

    vec3 result = cellColor;

    if (uMode < 0.5) {
      // --- ASCII -------------------------------------------------------
      // Яркость → индекс глифа. Атлас 8×2 (16 ячеек), рампа из 10 символов.
      float idx = floor(l * 9.999);
      float col = mod(idx, 8.0);
      float row = floor(idx / 8.0);
      vec2 glyphUv = (vec2(col, row) + vec2(cellUv.x, 1.0 - cellUv.y)) / vec2(8.0, 2.0);
      float glyph = texture2D(uGlyphAtlas, glyphUv).r;
      // Глиф умножаем на «свой» цвет кадра — сцена остаётся цветной
      result = cellColor * glyph * 1.5;
    } else if (uMode < 1.5) {
      // --- BRAILLE -----------------------------------------------------
      // Сетка 2×4 внутри ячейки; яркость точки = яркость кадра + лёгкий шум,
      // чтобы фактура не была механической.
      vec2 sub = floor(cellUv * vec2(2.0, 4.0));
      vec2 subUv = fract(cellUv * vec2(2.0, 4.0));
      vec2 sampleUv = (cellIndex + (sub + 0.5) / vec2(2.0, 4.0)) * uCell / uResolution;
      float sl = luma(texture2D(inputBuffer, sampleUv).rgb);
      float jitter = fract(sin(dot(cellIndex * 4.0 + sub, vec2(12.9898, 78.233))) * 43758.5453);
      float on = step(0.42, sl + jitter * 0.18);
      float dotShape = smoothstep(0.42, 0.16, length(subUv - 0.5));
      result = cellColor * (on * dotShape * 1.25);
    } else {
      // --- DITHER ------------------------------------------------------
      float threshold = bayer8(px / uCell);
      float shade = clamp(l * 0.9 + threshold * 0.28 - 0.14, 0.0, 1.0);
      float radius = sqrt(shade) * 0.52;
      float dots = smoothstep(radius, radius - 0.12, length(cellUv - 0.5));
      result = cellColor * dots * 1.3;
    }

    vec3 mixed = mix(inputColor.rgb, result, uStrength * mask);
    outputColor = vec4(mixed, 1.0);
  }
`;

export interface AsciiEffectOptions {
  /** Размер ячейки в пикселях */
  cell?: number;
  mode?: RenderMode;
  strength?: number;
}

const MODE_INDEX: Record<RenderMode, number> = {
  ascii: 0,
  braille: 1,
  dither: 2,
  clean: 0,
};

export class AsciiEffectImpl extends Effect {
  constructor({
    texture,
    cell = 8,
    mode = "ascii",
    strength = 0.85,
  }: AsciiEffectOptions & { texture: THREE.Texture }) {
    super("AsciiEffect", fragmentShader, {
      uniforms: new Map<string, THREE.Uniform>([
        ["uGlyphAtlas", new THREE.Uniform(texture)],
        ["uResolution", new THREE.Uniform(new THREE.Vector2(1, 1))],
        ["uCell", new THREE.Uniform(cell)],
        ["uMode", new THREE.Uniform(MODE_INDEX[mode])],
        ["uStrength", new THREE.Uniform(strength)],
        ["uPointer", new THREE.Uniform(new THREE.Vector2(0.5, 0.5))],
        ["uTime", new THREE.Uniform(0)],
      ]),
    });
  }

  setResolution(width: number, height: number): void {
    this.uniforms.get("uResolution")!.value.set(width, height);
  }

  setMode(mode: RenderMode): void {
    this.uniforms.get("uMode")!.value = MODE_INDEX[mode];
  }

  setStrength(value: number): void {
    this.uniforms.get("uStrength")!.value = value;
  }

  setCell(value: number): void {
    this.uniforms.get("uCell")!.value = value;
  }

  setPointer(x: number, y: number): void {
    this.uniforms.get("uPointer")!.value.set(x, y);
  }

  setTime(t: number): void {
    this.uniforms.get("uTime")!.value = t;
  }
}
