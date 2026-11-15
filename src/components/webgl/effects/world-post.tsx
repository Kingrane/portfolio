"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { HalfFloatType } from "three";
import { BlendFunction, Effect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { interactionState } from "@/scene/interaction";
import { worldState } from "@/scene/timeline";
import { createReadingUniforms, readingContrastFragment, syncReadingUniforms } from "../shaders/reading-zones";
import { outputFragment } from "../shaders/output";
import { AsciiEffectImpl } from "./ascii-effect";
import { createGlyphAtlas } from "./glyph-atlas";

/** Linear HalfFloat → ASCII → ACES → text luminance cap → IGN → one sRGB. */
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
    const reading = createReadingUniforms();
    const ascii = new AsciiEffectImpl({ texture: atlas.texture, cell, reading });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    const contrast = new Effect("ReadingContrast", readingContrastFragment, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map(Object.entries(reading)),
    });
    const output = new Effect("DisplayDither", outputFragment, { blendFunction: BlendFunction.SRC });
    const composer = new EffectComposer(gl, { frameBufferType: HalfFloatType, multisampling: 0 });
    composer.addPass(new RenderPass(scene, camera));
    // Separate passes make output order explicit and stable.
    composer.addPass(new EffectPass(camera, ascii));
    // These effects do not sample inputBuffer: insertion order survives merging.
    composer.addPass(new EffectPass(camera, tone, contrast, output));
    pipeline.current = { composer, ascii, reading, width: 0, height: 0, dpr: 0 };
    return () => {
      pipeline.current = null;
      composer.dispose();
      atlas.texture.dispose();
    };
  }, [gl, scene, camera, cell]);

  useFrame((state, delta) => {
    const current = pipeline.current;
    if (!current || document.hidden) return;
    const { size } = state;
    const dpr = gl.getPixelRatio();
    if (size.width !== current.width || size.height !== current.height || dpr !== current.dpr) {
      current.composer.setSize(size.width, size.height);
      current.ascii.setResolution(size.width, size.height);
      current.width = size.width;
      current.height = size.height;
      current.dpr = dpr;
    }
    current.ascii.setInteractions(interactionState, performance.now() * 0.001);
    current.ascii.setStrength(worldState.ascii);
    syncReadingUniforms(current.reading);
    current.composer.render(Math.min(delta, 0.06));
  }, 1);
  return null;
}
