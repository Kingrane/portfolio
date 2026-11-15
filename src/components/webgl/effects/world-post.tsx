"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { HalfFloatType } from "three";
import { Effect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { pointerState } from "@/lib/store";
import { worldState } from "@/scene/timeline";
import { createReadingUniforms, syncReadingUniforms } from "../shaders/reading-zones";
import { outputFragment } from "../shaders/output";
import { AsciiEffectImpl } from "./ascii-effect";
import { createGlyphAtlas } from "./glyph-atlas";

/** Linear HalfFloat → signature ASCII → ACES → IGN → one sRGB output. */
export function WorldPost({ cell }: { cell: number }) {
  const { gl, scene, camera } = useThree();
  const pipeline = useRef<{
    composer: EffectComposer;
    ascii: AsciiEffectImpl;
    reading: ReturnType<typeof createReadingUniforms>;
    width: number;
    height: number;
    dpr: number;
  } | null>(null);

  useEffect(() => {
    // Creation and disposal share an effect lifecycle: StrictMode replay
    // creates fresh GPU resources instead of reusing a disposed useMemo.
    const atlas = createGlyphAtlas();
    const ascii = new AsciiEffectImpl({ texture: atlas.texture, cell });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    const output = new Effect("DisplayDither", outputFragment);
    const composer = new EffectComposer(gl, { frameBufferType: HalfFloatType, multisampling: 0 });
    composer.addPass(new RenderPass(scene, camera));
    // Separate passes make output order explicit and stable.
    composer.addPass(new EffectPass(camera, ascii));
    composer.addPass(new EffectPass(camera, tone, output));
    pipeline.current = { composer, ascii, reading: createReadingUniforms(), width: 0, height: 0, dpr: 0 };
    return () => {
      pipeline.current = null;
      composer.dispose();
      atlas.texture.dispose();
    };
  }, [gl, scene, camera, cell]);

  useFrame((state, delta) => {
    const current = pipeline.current;
    if (!current) return;
    const { size } = state;
    const dpr = gl.getPixelRatio();
    if (size.width !== current.width || size.height !== current.height || dpr !== current.dpr) {
      current.composer.setSize(size.width, size.height);
      current.ascii.setResolution(size.width, size.height);
      current.width = size.width;
      current.height = size.height;
      current.dpr = dpr;
    }
    current.ascii.setPointer(pointerState.inside ? pointerState.x / size.width : -2, pointerState.inside ? 1 - pointerState.y / size.height : -2);
    current.ascii.setStrength(worldState.ascii);
    syncReadingUniforms(current.reading);
    current.ascii.setReadingZones(current.reading.uReading.value, current.reading.uReadingCount.value);
    current.composer.render(delta);
  }, 1);
  return null;
}
