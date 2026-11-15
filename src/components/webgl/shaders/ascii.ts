import { readingZonesGLSL } from "./reading-zones";
import { bayerGLSL } from "./bayer";
import { gardenMaskGLSL } from "./garden-mask";
import { TRAIL_LIFETIME } from "@/scene/interaction";

export const asciiFragment = /* glsl */ `
  uniform sampler2D uGlyphAtlas;
  uniform vec2 uResolution; // CSS pixels, independent of renderer DPR
  uniform float uCell;
  uniform float uStrength;
  uniform float uDebugFull;
  uniform float uGain;
  uniform float uGlow;
  uniform vec4 uWorld; // hero, constellation, garden, dive activity
  uniform vec4 uHole; // CSS center x/y, shadow radius, outer disk radius
  uniform sampler2D uNodesMask;
  ${gardenMaskGLSL}
  uniform sampler2D uHoleMask;
  uniform sampler2D uCleanStars;
  uniform sampler2D uFieldStars;
  uniform sampler2D uAuraMask;
  uniform float uRain;
  uniform float uQuality;
  uniform vec4 uEmitters[8]; // CSS x/y, radius, strength; slot 0 = pointer
  uniform int uEmitterCount;
  uniform float uTime; // performance.now seconds, same epoch as event histories
  uniform vec4 uTrail[8]; // CSS x/y from top-left, birth, energy
  uniform float uTrailActive;
  ${readingZonesGLSL}

  ${bayerGLSL}
  float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  float cellHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec3 starColor(vec2 uv) {
    vec2 garden = texture2D(uGardenMask, uv).rg;
    // The corridor stars are behind the flower field. Keep their new sharp
    // layer from shining through opaque petals or the clean amber cores.
    float occlusion = clamp(max(garden.r, garden.g), 0.0, 1.0);
    return texture2D(uCleanStars, uv).rgb * uWorld.x
      + texture2D(uFieldStars, uv).rgb * (1.0 - uWorld.x) * (1.0 - occlusion);
  }
  vec3 sourceColor(vec2 uv, float preserveStars) {
    vec3 color = texture2D(inputBuffer, uv).rgb;
    if (preserveStars < 0.999) color += starColor(uv) * (1.0 - preserveStars);
    return max(vec3(0.0), color);
  }
  float atlasGlyph(float index, vec2 local) {
    if (any(lessThan(local, vec2(0.0))) || any(greaterThan(local, vec2(1.0)))) return 0.0;
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
    vec2 screenCell = vec2(center.x, 1.0 - center.y) * uResolution;
    float emitter = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i >= uEmitterCount) break;
      vec4 source = uEmitters[i];
      float radius = max(1.0, source.z);
      float distanceToSource = i == 7 ? abs(screenCell.y - source.y) : length(screenCell - source.xy);
      emitter = max(emitter, (1.0 - smoothstep(radius * 0.55, radius, distanceToSource)) * source.w);
    }
    emitter = max(emitter, texture2D(uAuraMask, uv).r);
    float preserveStars = (1.0 - max(emitter, uDebugFull)) * (1.0 - uWorld.w);
    vec3 stars = starColor(uv);
    // Four samples stabilize small moving highlights. Dark cells stay empty.
    vec3 cell;
    if (uQuality >= 0.35) {
      cell = (sourceColor(center + offset, preserveStars) +
        sourceColor(center - offset, preserveStars) +
        sourceColor(center + offset * vec2(1.0, -1.0), preserveStars) +
        sourceColor(center + offset * vec2(-1.0, 1.0), preserveStars)) * 0.25;
    } else {
      cell = sourceColor(center, preserveStars);
    }
    float light = luma(cell);
    // The old HDR curve sent low-lit petals to a space/dot almost everywhere.
    // A perceptual curve uses the whole ramp without raising the scene's light.
    float density = sqrt(clamp(light / (0.18 + light), 0.0, 1.0));
    float glyphIndex = floor(clamp(density * 11.0 + bayer8(index) - 0.5, 0.0, 10.0));
    float glyph = atlasGlyph(glyphIndex, local);
    vec2 glowStep = vec2(0.85 / uCell);
    float halo = glyph;
    if (uQuality >= 0.35) {
      halo = (atlasGlyph(glyphIndex, local + vec2(glowStep.x, 0.0))
        + atlasGlyph(glyphIndex, local - vec2(glowStep.x, 0.0))
        + atlasGlyph(glyphIndex, local + vec2(0.0, glowStep.y))
        + atlasGlyph(glyphIndex, local - vec2(0.0, glowStep.y))) * 0.25;
    }
    float litOnly = smoothstep(0.003, 0.028, light);
    float distanceToHole = length(screenCell - uHole.xy);
    float diskEdge = smoothstep(uHole.z * 1.18, uHole.z * 1.65, distanceToHole)
      * (1.0 - smoothstep(uHole.w * 0.85, uHole.w, distanceToHole));
    // Physical ring and brilliant core remain sharp; distant stars never fall
    // inside a full-screen ambient vignette. Node regions use actual projection.
    float preserveCore = 1.0 - smoothstep(0.6, 1.8, luma(inputColor.rgb));
    float heroMask = uWorld.x * diskEdge * preserveCore * litOnly * texture2D(uHoleMask, uv).a;
    float nodesMask = uWorld.y * texture2D(uNodesMask, uv).r;
    float gardenMask = uWorld.z * 0.65 * litOnly * gardenCoverage(uv);
    float ambient = max(max(heroMask, nodesMask * 0.6), gardenMask);
    ambient = max(ambient, uWorld.w * litOnly * 0.85);
    float protection = readingMask(uv);
    // Blue coverage follows each landed flower's actual geometry, including
    // its normally clean core. It remains subordinate to HTML reading zones.
    float landing = texture2D(uGardenMask, uv).b;
    float mask = max(max(clamp(ambient * uStrength, 0.0, 1.0), emitter), landing) * (1.0 - protection);
    // Full mode is a diagnostic, not a public render-mode switch.
    mask = mix(mask, 1.0, uDebugFull);
    float ink = glyph + max(0.0, halo - glyph) * uGlow;
    vec3 ascii = light > 0.002 ? cell * ink * uGain : vec3(0.0);
    vec3 color = mix(inputColor.rgb + stars * (1.0 - preserveStars), ascii, mask) + stars * preserveStars;

    // Independent light, not merely an ASCII mask over an existing bright scene.
    // Cell centers keep each glyph intact; screen px keep radii stable at any DPR.
    float trailLight = 0.0;
    if (uTrailActive > 0.5) for (int i = 0; i < 8; i++) {
      vec4 samplePoint = uTrail[i];
      float age = uTime - samplePoint.z;
      if (age < 0.0 || age > ${TRAIL_LIFETIME} || samplePoint.w <= 0.0) continue;
      float life = 1.0 - smoothstep(0.05, ${TRAIL_LIFETIME}, age);
      float radius = mix(32.4, 17.1, age / ${TRAIL_LIFETIME});
      float distanceToTrail = length(screenCell - samplePoint.xy);
      float footprint = 1.0 - smoothstep(radius * 0.15, radius, distanceToTrail);
      trailLight = max(trailLight, footprint * life * samplePoint.w);
    }
    float energy = trailLight * (1.0 - protection);
    if (energy > 0.002) {
      float seed = cellHash(index);
      float sparkIndex = 3.0 + floor(seed * 5.0);
      float spark = atlasGlyph(sparkIndex, local);
      // Amber light with a small, sparse iris accent; no full-screen glow layer.
      vec3 ink = mix(vec3(1.0, 0.34, 0.045), vec3(0.28, 0.15, 1.0), step(0.94, seed));
      float lattice = mix(0.65, 1.0, step(0.35, seed));
      color += ink * spark * energy * lattice * 1.8;
    }
    // The falling layer accompanies both stack and projects, starting directly
    // after the dive. Its glyphs never touch protected HTML text.
    if (uRain > 0.001) {
      float seed = cellHash(vec2(index.x, 17.0));
      float stream = fract((index.y + uTime * (3.0 + seed * 5.0)) / (18.0 + seed * 22.0));
      float tail = pow(stream, 9.0) * step(0.68, seed);
      float drop = atlasGlyph(2.0 + floor(cellHash(index + floor(uTime * 4.0)) * 9.0), local);
      color += mix(vec3(0.12, 0.055, 0.42), vec3(0.6, 0.36, 1.0), stream)
        * drop * tail * uRain * (1.0 - protection) * 0.8;
    }
    outputColor = vec4(color, inputColor.a);
  }
`;
