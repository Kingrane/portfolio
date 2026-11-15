import { readingZonesGLSL } from "./reading-zones";

export const asciiFragment = /* glsl */ `
  uniform sampler2D uGlyphAtlas;
  uniform vec2 uResolution; // CSS pixels, independent of renderer DPR
  uniform float uCell;
  uniform float uStrength;
  uniform vec2 uPointer;
  ${readingZonesGLSL}

  // Bayer recursion with an actual normalized 8x8 threshold, not noise.
  float bayer2(vec2 p) {
    vec2 bit = mod(floor(p), 2.0);
    return mod(2.0 * bit.x + 3.0 * bit.y, 4.0);
  }
  float bayer8(vec2 p) {
    return (16.0 * bayer2(p) + 4.0 * bayer2(p / 2.0) + bayer2(p / 4.0) + 0.5) / 64.0;
  }
  float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 px = uv * uResolution;
    vec2 index = floor(px / uCell);
    vec2 local = fract(px / uCell);
    vec2 center = (index + 0.5) * uCell / uResolution;
    vec2 offset = uCell * 0.24 / uResolution;
    // Four samples stabilize small moving highlights. Dark cells stay empty.
    vec3 cell = (
      texture2D(inputBuffer, center + offset).rgb +
      texture2D(inputBuffer, center - offset).rgb +
      texture2D(inputBuffer, center + offset * vec2(1.0, -1.0)).rgb +
      texture2D(inputBuffer, center + offset * vec2(-1.0, 1.0)).rgb
    ) * 0.25;
    float light = luma(cell);
    float density = clamp(light / (0.6 + light), 0.0, 1.0);
    float glyphIndex = floor(clamp(density * 10.0 + bayer8(index) - 0.5, 0.0, 9.0));
    vec2 atlasCell = vec2(mod(glyphIndex, 8.0), floor(glyphIndex / 8.0));
    vec2 atlasUv = (atlasCell + vec2(local.x, 1.0 - local.y)) / vec2(8.0, 2.0);
    float glyph = texture2D(uGlyphAtlas, atlasUv).r;
    float edge = smoothstep(0.12, 0.58, length(uv - 0.5));
    float pointer = 1.0 - smoothstep(0.0, 0.2, length(uv - uPointer));
    float litOnly = smoothstep(0.005, 0.07, light);
    // Keep the brilliant core/ring clear; ASCII grows along the light's edges.
    float preserveCore = 1.0 - smoothstep(0.6, 1.8, luma(inputColor.rgb));
    float protection = readingMask(uv);
    float mask = uStrength * clamp(0.2 + edge * 0.8 + pointer * 0.7, 0.0, 1.0);
    mask *= litOnly * preserveCore * (1.0 - protection);
    vec3 color = mix(inputColor.rgb, cell * glyph * 2.1, mask);
    // Reading protection is shared by every world, never a CSS rectangle.
    color *= 1.0 - protection * 0.97;
    outputColor = vec4(color, inputColor.a);
  }
`;
