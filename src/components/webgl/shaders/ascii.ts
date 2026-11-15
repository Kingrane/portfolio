import { readingZonesGLSL } from "./reading-zones";

export const asciiFragment = /* glsl */ `
  uniform sampler2D uGlyphAtlas;
  uniform vec2 uResolution; // CSS pixels, independent of renderer DPR
  uniform float uCell;
  uniform float uStrength;
  uniform float uTime; // performance.now seconds, same epoch as event histories
  uniform vec4 uTrail[8]; // CSS x/y from top-left, birth, energy
  uniform vec4 uReactions[4]; // CSS center x/y, ellipse half-size
  uniform vec4 uReactionTimes;
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
  float cellHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float atlasGlyph(float index, vec2 local) {
    vec2 atlasCell = vec2(mod(index, 8.0), floor(index / 8.0));
    vec2 atlasUv = (atlasCell + vec2(local.x, 1.0 - local.y)) / vec2(8.0, 2.0);
    return texture2D(uGlyphAtlas, atlasUv).r;
  }

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
    float glyph = atlasGlyph(glyphIndex, local);
    float edge = smoothstep(0.12, 0.58, length(uv - 0.5));
    float litOnly = smoothstep(0.005, 0.07, light);
    // Keep the brilliant core/ring clear; ASCII grows along the light's edges.
    float preserveCore = 1.0 - smoothstep(0.6, 1.8, luma(inputColor.rgb));
    float protection = readingMask(uv);
    float mask = uStrength * clamp(0.2 + edge * 0.8, 0.0, 1.0);
    mask *= litOnly * preserveCore * (1.0 - protection);
    vec3 color = mix(inputColor.rgb, cell * glyph * 2.1, mask);

    // Independent light, not merely an ASCII mask over an existing bright scene.
    // Cell centers keep each glyph intact; screen px keep radii stable at any DPR.
    vec2 screenCell = vec2(center.x, 1.0 - center.y) * uResolution;
    float trailLight = 0.0;
    float reactionLight = 0.0;
    for (int i = 0; i < 8; i++) {
      vec4 samplePoint = uTrail[i];
      float age = uTime - samplePoint.z;
      if (age < 0.0 || age > 0.62 || samplePoint.w <= 0.0) continue;
      float life = 1.0 - smoothstep(0.04, 0.62, age);
      float radius = mix(36.0, 19.0, age / 0.62);
      float distanceToTrail = length(screenCell - samplePoint.xy);
      float footprint = 1.0 - smoothstep(radius * 0.15, radius, distanceToTrail);
      trailLight = max(trailLight, footprint * life * samplePoint.w);
    }
    for (int i = 0; i < 4; i++) {
      float age = uTime - uReactionTimes[i];
      if (age < 0.0 || age > 0.82) continue;
      vec4 reaction = uReactions[i];
      vec2 extent = max(reaction.zw + age * vec2(24.0, 32.0), vec2(12.0));
      float ellipse = length((screenCell - reaction.xy) / extent);
      // An expanding hollow lattice: the label stays clear in the bubble's core.
      float ring = 1.0 - smoothstep(0.08, 0.32, abs(ellipse - 1.12));
      float life = smoothstep(0.0, 0.05, age) * (1.0 - smoothstep(0.12, 0.82, age));
      reactionLight = max(reactionLight, ring * life);
    }
    float energy = max(trailLight, reactionLight * 0.9) * (1.0 - protection);
    if (energy > 0.002) {
      float seed = cellHash(index);
      float sparkIndex = 3.0 + floor(seed * 5.0);
      float spark = atlasGlyph(sparkIndex, local);
      // Amber light with a small, sparse iris accent; no full-screen glow layer.
      vec3 ink = mix(vec3(1.0, 0.34, 0.045), vec3(0.28, 0.15, 1.0), step(0.94, seed));
      float lattice = mix(0.65, 1.0, step(0.35, seed));
      color += ink * spark * energy * lattice * 1.8;
    }
    outputColor = vec4(color, inputColor.a);
  }
`;
