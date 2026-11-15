/** Recursive Bayer 8×8, shared by glyph-density and final display quantization. */
export const bayerGLSL = /* glsl */ `
  float bayer2(vec2 p) {
    vec2 bit = mod(floor(p), 2.0);
    return mod(2.0 * bit.x + 3.0 * bit.y, 4.0);
  }
  float bayer8(vec2 p) {
    return (16.0 * bayer2(p) + 4.0 * bayer2(p / 2.0) + bayer2(p / 4.0) + 0.5) / 64.0;
  }
`;
