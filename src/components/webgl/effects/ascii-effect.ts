import { Uniform, Vector2, type Texture, type Vector4 } from "three";
import { Effect } from "postprocessing";
import { asciiFragment } from "../shaders/ascii";
import { createReadingUniforms } from "../shaders/reading-zones";

/** Owns no renderer/atlas: their lifecycle belongs to WorldPost. */
export class AsciiEffectImpl extends Effect {
  constructor({ texture, cell = 10 }: { texture: Texture; cell?: number }) {
    const reading = createReadingUniforms();
    super("SignatureAscii", asciiFragment, {
      uniforms: new Map<string, Uniform>([
        ["uGlyphAtlas", new Uniform(texture)],
        ["uResolution", new Uniform(new Vector2(1, 1))],
        ["uCell", new Uniform(cell)],
        ["uStrength", new Uniform(0.35)],
        ["uPointer", new Uniform(new Vector2(-2, -2))],
        ["uReading", reading.uReading],
        ["uReadingCount", reading.uReadingCount],
      ]),
    });
  }

  setResolution(width: number, height: number): void { this.uniforms.get("uResolution")!.value.set(width, height); }
  setStrength(value: number): void { this.uniforms.get("uStrength")!.value = value; }
  setPointer(x: number, y: number): void { this.uniforms.get("uPointer")!.value.set(x, y); }
  setReadingZones(rects: Vector4[], count: number): void {
    const target = this.uniforms.get("uReading")!.value as Vector4[];
    for (let i = 0; i < count; i++) target[i].copy(rects[i]);
    this.uniforms.get("uReadingCount")!.value = count;
  }
}
