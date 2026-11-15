import { Uniform, Vector2, Vector4 } from "three";
import { MAX_READING_ZONES, readingState } from "@/scene/reading-zones";

export const readingZonesGLSL = /* glsl */ `
  uniform vec4 uReading[8];
  uniform float uReadingStrength[8];
  uniform vec2 uReadingViewport;
  uniform int uReadingCount;

  // CSS-pixel capsules, including portrait/landscape aspect correction.
  float readingMask(vec2 uv) {
    float mask = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i >= uReadingCount) break;
      vec4 box = uReading[i];
      vec2 halfSize = (box.zw - box.xy) * uReadingViewport * 0.5;
      vec2 p = abs((uv - (box.xy + box.zw) * 0.5) * uReadingViewport);
      float radius = min(halfSize.x, halfSize.y);
      vec2 axis = max(halfSize - radius, vec2(0.0));
      float distanceToCapsule = length(max(p - axis, vec2(0.0))) - radius;
      mask = max(mask, (1.0 - smoothstep(0.0, 24.0, distanceToCapsule)) * uReadingStrength[i]);
    }
    return mask;
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
  return {
    uReading: new Uniform(Array.from({ length: MAX_READING_ZONES }, () => new Vector4())),
    uReadingStrength: new Uniform(new Float32Array(MAX_READING_ZONES)),
    uReadingViewport: new Uniform(new Vector2(1, 1)),
    uReadingCount: new Uniform(0),
  };
}

export function syncReadingUniforms(uniforms: ReturnType<typeof createReadingUniforms>): void {
  uniforms.uReadingCount.value = readingState.count;
  uniforms.uReadingViewport.value.set(readingState.width, readingState.height);
  for (let i = 0; i < readingState.count; i++) {
    uniforms.uReading.value[i].fromArray(readingState.rects, i * 4);
    uniforms.uReadingStrength.value[i] = readingState.strengths[i];
  }
}
