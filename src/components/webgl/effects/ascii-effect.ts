import { Uniform, Vector2, Vector4, type Texture } from "three";
import { BlendFunction, Effect } from "postprocessing";
import { asciiFragment } from "../shaders/ascii";
import { createReadingUniforms } from "../shaders/reading-zones";
import { TRAIL_SAMPLES, type interactionState } from "@/scene/interaction";

/** Owns no renderer/atlas: their lifecycle belongs to WorldPost. */
export class AsciiEffectImpl extends Effect {
  constructor({ texture, cell = 10, reading = createReadingUniforms() }: {
    texture: Texture;
    cell?: number;
    reading?: ReturnType<typeof createReadingUniforms>;
  }) {
    super("SignatureAscii", asciiFragment, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, Uniform>([
        ["uGlyphAtlas", new Uniform(texture)],
        ["uResolution", new Uniform(new Vector2(1, 1))],
        ["uCell", new Uniform(cell)],
        ["uStrength", new Uniform(0.35)],
        ["uTime", new Uniform(0)],
        ["uTrail", new Uniform(Array.from({ length: TRAIL_SAMPLES }, () => new Vector4(0, 0, -1000, 0)))],
        ["uTrailActive", new Uniform(0)],
        ["uReading", reading.uReading],
        ["uReadingStrength", reading.uReadingStrength],
        ["uReadingViewport", reading.uReadingViewport],
        ["uReadingCount", reading.uReadingCount],
        ["uReadingMask", reading.uReadingMask],
      ]),
    });
  }

  setResolution(width: number, height: number): void { this.uniforms.get("uResolution")!.value.set(width, height); }
  setStrength(value: number): void { this.uniforms.get("uStrength")!.value = value; }
  /** Fixed buffers copied in-place; no per-frame arrays or vectors are created. */
  setInteractions(history: typeof interactionState, time: number): void {
    const trail = this.uniforms.get("uTrail")!.value as Vector4[];
    let active = false;
    for (let i = 0; i < TRAIL_SAMPLES; i++) {
      trail[i].fromArray(history.trail, i * 4);
      if (time - trail[i].z < 0.62 && trail[i].w > 0) active = true;
    }
    this.uniforms.get("uTrailActive")!.value = active ? 1 : 0;
    this.uniforms.get("uTime")!.value = time;
  }

  setReadingZones(rects: Vector4[], count: number, strengths?: Float32Array): void {
    const target = this.uniforms.get("uReading")!.value as Vector4[];
    const weights = this.uniforms.get("uReadingStrength")!.value as Float32Array;
    const bounded = Math.max(0, Math.min(target.length, rects.length, count));
    for (let i = 0; i < bounded; i++) { target[i].copy(rects[i]); weights[i] = strengths?.[i] ?? 1; }
    this.uniforms.get("uReadingCount")!.value = bounded;
  }
}
