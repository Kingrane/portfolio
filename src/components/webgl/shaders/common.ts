/**
 * Математика для шейдеров: хеши, value-noise, fbm, поворот.
 * Держим отдельно, чтобы каждый шейдер не тащил свою копию.
 */

export const glslNoise = /* glsl */ `
  #define PI 3.14159265359
  #define TAU 6.28318530718

  // Детерминированный псевдослучайный «шум» из координат ячейки
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  vec2 hash22(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453123);
  }

  // Value-noise: сглаженная случайность по сетке
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // Фрактальный шум: сумма октав
  float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      value += amp * noise(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return value;
  }

  mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }
`;
