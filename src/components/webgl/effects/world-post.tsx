"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, Color, DataTexture, HalfFloatType, LinearFilter, Uniform, WebGLRenderTarget } from "three";
import { BlendFunction, Effect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { interactionState } from "@/scene/interaction";
import { worldState } from "@/scene/timeline";
import { asciiSources } from "@/scene/ascii-sources";
import { initializeSceneTuning, sceneTuning } from "@/scene/tuning";
import { createReadingUniforms, readingContrastFragment, syncReadingUniforms } from "../shaders/reading-zones";
import { outputFragment } from "../shaders/output";
import { AsciiEffectImpl } from "./ascii-effect";
import { createGlyphAtlas } from "./glyph-atlas";

const QA_FIELDS = ["cell", "gain", "ambient", "dither", "emitters"] as const;
function expose(canvas: HTMLCanvasElement, previous: Float64Array, index: number, value: number): void {
  if (previous[index] === value) return;
  previous[index] = value;
  canvas.setAttribute(`data-qa-ascii-${QA_FIELDS[index]}`, String(value));
}

/** Linear HalfFloat → ASCII → ACES → text luminance cap → Bayer/IGN → sRGB. */
export function WorldPost({ cell }: { cell: number }) {
  const { gl, scene, camera } = useThree();
  const pipeline = useRef<{
    composer: EffectComposer;
    ascii: AsciiEffectImpl;
    reading: ReturnType<typeof createReadingUniforms>;
    width: number;
    height: number;
    dpr: number;
    dither: Uniform<number>;
    nodes: CanvasTexture;
    paint: CanvasRenderingContext2D;
    stamp: HTMLCanvasElement;
    lastNodes: number;
    nodeCount: number;
    exposed: Float64Array;
    garden: WebGLRenderTarget;
    empty: DataTexture;
    clearColor: Color;
    stars: WebGLRenderTarget;
  } | null>(null);

  useEffect(() => {
    // Creation and disposal share an effect lifecycle: StrictMode replay
    // creates fresh GPU resources instead of reusing a disposed useMemo.
    const atlas = createGlyphAtlas();
    const reading = createReadingUniforms();
    initializeSceneTuning();
    const full = sceneTuning.full;
    const ascii = new AsciiEffectImpl({ texture: atlas.texture, cell, full, reading });
    gl.domElement.setAttribute("data-qa-ascii-full", String(full));
    gl.domElement.setAttribute("data-qa-ascii-cell", String(cell));
    const nodeCanvas = document.createElement("canvas");
    nodeCanvas.width = nodeCanvas.height = 1;
    const paint = nodeCanvas.getContext("2d", { alpha: false })!;
    const nodes = new CanvasTexture(nodeCanvas);
    nodes.minFilter = nodes.magFilter = LinearFilter;
    nodes.generateMipmaps = false;
    ascii.uniforms.get("uNodesMask")!.value = nodes;
    const empty = new DataTexture(new Uint8Array(4), 1, 1);
    empty.needsUpdate = true;
    const garden = new WebGLRenderTarget(1, 1, {
      minFilter: LinearFilter, magFilter: LinearFilter,
      depthBuffer: true, stencilBuffer: false, generateMipmaps: false,
    });
    ascii.uniforms.get("uGardenMask")!.value = empty;
    ascii.uniforms.get("uHoleMask")!.value = empty;
    ascii.uniforms.get("uCleanStars")!.value = empty;
    const stars = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter,
      depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
    });
    ascii.uniforms.get("uFieldStars")!.value = stars.texture;
    // One reusable radial stamp; no gradient/canvas allocation in the frame.
    const stamp = document.createElement("canvas");
    stamp.width = stamp.height = 64;
    const brush = stamp.getContext("2d")!;
    const gradient = brush.createRadialGradient(32, 32, 8, 32, 32, 32);
    gradient.addColorStop(0, "white");
    gradient.addColorStop(1, "transparent");
    brush.fillStyle = gradient;
    brush.fillRect(0, 0, 64, 64);
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    const contrast = new Effect("ReadingContrast", readingContrastFragment, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map(Object.entries(reading)),
    });
    const dither = new Uniform(sceneTuning.dither);
    const output = new Effect("DisplayDither", outputFragment, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map([
        ...Object.entries(reading),
        ["uDither", dither],
        ["uDebugFull", ascii.uniforms.get("uDebugFull")!],
        ["uWorld", ascii.uniforms.get("uWorld")!],
        ["uHole", ascii.uniforms.get("uHole")!],
        ["uResolution", ascii.uniforms.get("uResolution")!],
        ["uGardenMask", ascii.uniforms.get("uGardenMask")!],
        ["uGardenTexel", ascii.uniforms.get("uGardenTexel")!],
        ["uHoleMask", ascii.uniforms.get("uHoleMask")!],
        ["uCleanStars", ascii.uniforms.get("uCleanStars")!],
        ["uFieldStars", ascii.uniforms.get("uFieldStars")!],
      ]),
    });
    const composer = new EffectComposer(gl, { frameBufferType: HalfFloatType, multisampling: 0 });
    composer.addPass(new RenderPass(scene, camera));
    // Separate passes make output order explicit and stable.
    composer.addPass(new EffectPass(camera, ascii));
    // These effects do not sample inputBuffer: insertion order survives merging.
    composer.addPass(new EffectPass(camera, tone, contrast, output));
    pipeline.current = {
      composer, ascii, reading, width: 0, height: 0, dpr: 0, dither, nodes,
      paint, stamp, lastNodes: -1, nodeCount: 0, exposed: new Float64Array(5).fill(NaN),
      garden, empty, clearColor: new Color(), stars,
    };
    return () => {
      pipeline.current = null;
      composer.dispose();
      atlas.texture.dispose();
      reading.uReadingMask.value.dispose();
      nodes.dispose();
      garden.dispose();
      empty.dispose();
      stars.dispose();
    };
  }, [gl, scene, camera, cell]);

  useFrame((state, delta) => {
    const current = pipeline.current;
    if (!current || document.hidden) return;
    const { size } = state;
    const dpr = gl.getPixelRatio();
    const narrow = size.width <= 768;
    if (size.width !== current.width || size.height !== current.height || dpr !== current.dpr) {
      current.composer.setSize(size.width, size.height);
      current.ascii.setResolution(size.width, size.height);
      current.width = size.width;
      current.height = size.height;
      current.dpr = dpr;
      const scale = Math.min(narrow ? 128 : 256, size.width) / size.width;
      current.paint.canvas.width = Math.round(size.width * scale);
      current.paint.canvas.height = Math.round(size.height * scale);
      current.lastNodes = -1;
      current.garden.setSize(Math.max(1, Math.round(size.width * 0.5)), Math.max(1, Math.round(size.height * 0.5)));
      current.ascii.uniforms.get("uGardenTexel")!.value.set(1 / current.garden.width, 1 / current.garden.height);
      current.stars.setSize(Math.max(1, Math.round(size.width * dpr)), Math.max(1, Math.round(size.height * dpr)));
    }
    const now = performance.now() * 0.001;
    current.ascii.setInteractions(interactionState, now);
    current.ascii.setTuning(narrow);
    const dive = worldState.dive;
    const approach = Math.min(1, Math.max(0, dive / 0.8));
    const centered = 1 - approach * approach * (3 - 2 * approach);
    const zoom = narrow ? 2.1 : 1.74 * size.height / size.width;
    const shadow = size.height * 0.244 / zoom;
    current.ascii.uniforms.get("uHole")!.value.set(
      size.width * 0.5 + (narrow ? 0 : size.width * 0.19) * centered,
      size.height * 0.5 - (narrow ? size.height * 0.28 : size.height * 0.04) * centered,
      shadow, shadow * 3.7,
    );
    current.ascii.uniforms.get("uWorld")!.value.set(
      worldState.hole, worldState.stars * (1 - worldState.hole) * (1 - worldState.rain),
      worldState.flowers, Math.sin(Math.PI * dive) * worldState.hole,
    );
    current.dither.value = sceneTuning.dither;
    // The node mask follows projected geometry at 20 Hz. Dormant worlds neither
    // paint nor upload a texture; interpolation is provided by soft stamp edges.
    const count = asciiSources.nodeCount;
    if (now - current.lastNodes > 0.05 && (count > 0 || current.nodeCount > 0 || current.lastNodes < 0)) {
      const paint = current.paint;
      const scale = paint.canvas.width / size.width;
      paint.setTransform(scale, 0, 0, scale, 0, 0);
      paint.fillStyle = "black";
      paint.fillRect(0, 0, size.width, size.height);
      for (let i = 0; i < count; i++) {
        const n = i * 3;
        const radius = asciiSources.nodes[n + 2];
        paint.drawImage(current.stamp, asciiSources.nodes[n] - radius, asciiSources.nodes[n + 1] - radius, radius * 2, radius * 2);
      }
      current.nodes.needsUpdate = true;
      current.lastNodes = now;
      current.nodeCount = count;
    }
    const canvas = gl.domElement;
    expose(canvas, current.exposed, 0, current.ascii.uniforms.get("uCell")!.value);
    expose(canvas, current.exposed, 1, sceneTuning.gain);
    expose(canvas, current.exposed, 2, sceneTuning.ambient);
    expose(canvas, current.exposed, 3, sceneTuning.dither);
    expose(canvas, current.exposed, 4, current.ascii.uniforms.get("uEmitterCount")!.value);
    syncReadingUniforms(current.reading);
    current.ascii.uniforms.get("uHoleMask")!.value = asciiSources.hole ?? current.empty;
    current.ascii.uniforms.get("uCleanStars")!.value = asciiSources.cleanStars ?? current.empty;
    // A screen-resolution star layer avoids subtracting two differently
    // filtered buffers. Layer 1 contains only the existing Starfield points.
    const previous = gl.getRenderTarget();
    const clearAlpha = gl.getClearAlpha();
    const autoClear = gl.autoClear;
    const layers = camera.layers.mask;
    gl.getClearColor(current.clearColor);
    try {
      camera.layers.set(1);
      gl.autoClear = false;
      gl.setRenderTarget(current.stars);
      gl.setClearColor(0, 0);
      gl.clear(true, false, false);
      if (worldState.stars > 0.001) gl.render(scene, camera);
    } finally {
      camera.layers.mask = layers;
      gl.setRenderTarget(previous);
      gl.setClearColor(current.clearColor, clearAlpha);
      gl.autoClear = autoClear;
    }
    const gardenScene = asciiSources.garden;
    if (worldState.flowers > 0.004 && gardenScene?.children[0]?.visible) {
      const previous = gl.getRenderTarget();
      const clearAlpha = gl.getClearAlpha();
      const autoClear = gl.autoClear;
      gl.getClearColor(current.clearColor);
      try {
        gl.autoClear = false;
        gl.setRenderTarget(current.garden);
        gl.setClearColor(0, 0);
        gl.clear(true, true, false);
        gl.render(gardenScene, camera);
      } finally {
        gl.setRenderTarget(previous);
        gl.setClearColor(current.clearColor, clearAlpha);
        gl.autoClear = autoClear;
      }
      current.ascii.uniforms.get("uGardenMask")!.value = current.garden.texture;
    } else {
      current.ascii.uniforms.get("uGardenMask")!.value = current.empty;
    }
    current.composer.render(Math.min(delta, 0.06));
  }, 1);
  return null;
}
