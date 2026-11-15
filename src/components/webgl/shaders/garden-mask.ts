/** RG coverage: foliage red, depth-writing cores green. A conservative 1.5 CSS
 * pixel guard keeps bilinear target interpolation out of clean core contours. */
export const gardenMaskGLSL = /* glsl */ `
  uniform sampler2D uGardenMask;
  uniform vec2 uGardenTexel;
  float gardenCoverage(vec2 uv) {
    vec2 center = texture2D(uGardenMask, uv).rg;
    vec2 guard = uGardenTexel * 0.75;
    float core = max(center.g, max(
      max(texture2D(uGardenMask, uv + vec2(guard.x, 0.0)).g,
          texture2D(uGardenMask, uv - vec2(guard.x, 0.0)).g),
      max(texture2D(uGardenMask, uv + vec2(0.0, guard.y)).g,
          texture2D(uGardenMask, uv - vec2(0.0, guard.y)).g)));
    return center.r * (1.0 - step(0.001, core));
  }
`;
