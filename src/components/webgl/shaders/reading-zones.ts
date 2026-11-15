import { LinearFilter, Texture, Uniform, Vector2, Vector4 } from "three";
import { MAX_READING_ZONES, readingState } from "@/scene/reading-zones";

export const readingZonesGLSL = /* glsl */ `
  uniform vec4 uReading[8];
  uniform float uReadingStrength[8];
  uniform vec2 uReadingViewport;
  uniform int uReadingCount;
  uniform sampler2D uReadingMask;

  // One cached texture sample covers every line, not only the eight capsules
  // retained on the CPU for moving flower instances. No per-pixel loops.
  float readingMask(vec2 uv) {
    return texture2D(uReadingMask, uv).r;
  }
`;

/** Applied after ACES: only bright text backdrops are capped, not blackened. */
export const readingContrastFragment = /* glsl */ `
  ${readingZonesGLSL}
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    float protection = readingMask(uv);
    float light = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    // #9A9AA8 has relative luminance ~0.33: this ceiling gives >5:1.
    // Already-dark pixels are untouched; output's #050507 floor remains intact.
    float ceiling = mix(light, min(light, 0.024), protection);
    vec3 color = inputColor.rgb * (ceiling / max(light, 0.00001));
    outputColor = vec4(color, inputColor.a);
  }
`;

export function createReadingUniforms() {
  const mask = new Texture();
  mask.minFilter = mask.magFilter = LinearFilter;
  mask.generateMipmaps = false;
  return {
    uReadingMask: new Uniform(mask),
    uReading: new Uniform(Array.from({ length: MAX_READING_ZONES }, () => new Vector4())),
    uReadingStrength: new Uniform(new Float32Array(MAX_READING_ZONES)),
    uReadingViewport: new Uniform(new Vector2(1, 1)),
    uReadingCount: new Uniform(0),
  };
}

export function syncReadingUniforms(uniforms: ReturnType<typeof createReadingUniforms>): void {
  const texture = uniforms.uReadingMask.value;
  if (readingState.mask && (texture.image !== readingState.mask || texture.userData.maskVersion !== readingState.maskVersion)) {
    texture.image = readingState.mask;
    texture.userData.maskVersion = readingState.maskVersion;
    texture.needsUpdate = true;
  }
  uniforms.uReadingCount.value = readingState.count;
  uniforms.uReadingViewport.value.set(readingState.width, readingState.height);
  for (let i = 0; i < readingState.count; i++) {
    uniforms.uReading.value[i].fromArray(readingState.rects, i * 4);
    uniforms.uReadingStrength.value[i] = readingState.strengths[i];
  }
}
