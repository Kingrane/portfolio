import { Uniform, Vector4 } from "three";
import { MAX_READING_ZONES, readingState } from "@/scene/reading-zones";

export const readingZonesGLSL = /* glsl */ `
  uniform vec4 uReading[8];
  uniform int uReadingCount;

  // Rounded, feathered attenuation, not eight visible rectangular overlays.
  float readingMask(vec2 uv) {
    float mask = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i >= uReadingCount) break;
      vec4 box = uReading[i];
      vec2 distanceToBox = max(max(box.xy - uv, uv - box.zw), vec2(0.0));
      mask = max(mask, 1.0 - smoothstep(0.0, 0.055, length(distanceToBox)));
    }
    return mask;
  }
`;

export function createReadingUniforms() {
  return {
    uReading: new Uniform(Array.from({ length: MAX_READING_ZONES }, () => new Vector4())),
    uReadingCount: new Uniform(0),
  };
}

export function syncReadingUniforms(uniforms: ReturnType<typeof createReadingUniforms>): void {
  uniforms.uReadingCount.value = readingState.count;
  for (let i = 0; i < readingState.count; i++) {
    uniforms.uReading.value[i].fromArray(readingState.rects, i * 4);
  }
}
