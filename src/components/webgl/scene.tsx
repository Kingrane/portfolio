"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { EffectComposer } from "@react-three/postprocessing";
import { Blackhole } from "./worlds/blackhole";
import { Starfield } from "./worlds/starfield";
import { Constellations } from "./worlds/constellations";
import { Garden } from "./worlds/garden";
import { AsciiEffectImpl } from "./effects/ascii-effect";
import { createGlyphAtlas } from "./effects/glyph-atlas";
import { pointerState, viewState } from "@/lib/store";
import { useRenderMode, type RenderMode } from "@/lib/render-mode";
import { languages, technologies } from "@/content/stack";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * ЕДИНСТВЕННЫЙ WebGL-контекст на весь сайт.
 *
 * Почему один: браузеры держат 8–16 контекстов, на мобильных меньше, а каждый
 * живой контекст ест память. Поэтому миры — не отдельные канвасы, а группы
 * объектов в одной сцене, расставленные вдоль оси Y. Камера едет по странице
 * и проезжает мимо них: чёрная дыра → созвездия → сад.
 */

/** Высота, которую камера проезжает за всю страницу (мировые единицы). */
const TRAVEL = 58;

function Rig() {
  const target = useRef(0);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.06);
    const cam = state.camera;

    // Прогресс скролла → целевая высота камеры (с инерцией)
    target.current = -viewState.progress * TRAVEL;
    const lerp = 1 - Math.pow(0.001, dt);
    cam.position.y += (target.current - cam.position.y) * lerp;

    // Параллакс от курсора
    cam.position.x += (pointerState.nx * 0.7 - cam.position.x) * 0.04;
    cam.lookAt(0, cam.position.y, -10);
    cam.rotation.z = -pointerState.nx * 0.02;
  });

  return null;
}

/** Пост-обработка: ASCII / BRAILLE / DITHER. */
function AsciiPass({ cell = 10, strength, mode }: { cell?: number; strength: number; mode: RenderMode }) {
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const atlas = useMemo(() => createGlyphAtlas(), []);
  const effect = useMemo(() => {
    return new AsciiEffectImpl({ texture: atlas.texture, cell });
  }, [atlas, cell]);

  useEffect(() => {
    return () => {
      effect.dispose();
    };
  }, [effect]);
  useEffect(() => () => atlas.texture.dispose(), [atlas]);

  useEffect(() => {
    effect.setResolution(size.width * dpr, size.height * dpr);
  }, [effect, size.width, size.height, dpr]);

  useEffect(() => {
    effect.setMode(mode);
  }, [effect, mode]);

  useFrame((state) => {
    effect.setPointer(
      pointerState.x / Math.max(1, size.width),
      1 - pointerState.y / Math.max(1, size.height),
    );
    effect.setTime(state.clock.elapsedTime);
    // В «саду» эффект тише: там важнее мягкое свечение, чем глифы
    const fade = viewState.progress > 0.55 ? 0.45 : 1;
    effect.setStrength(strength * fade);
  });

  return <primitive object={effect} dispose={null} />;
}

export default function Scene() {
  const [quality, setQuality] = useState(1);
  const [visible, setVisible] = useState(() => !document.hidden);
  const isNarrow = useMediaQuery("(max-width: 768px)");
  const mode = useRenderMode();

  useEffect(() => {
    // Не жжём GPU, когда вкладка не видна
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const starCount = quality > 0.7 ? (isNarrow ? 700 : 1400) : quality > 0.4 ? 600 : 320;
  const flowerCount = quality > 0.7 ? (isNarrow ? 80 : 150) : 60;
  const asciiOn = quality > 0.35 && mode !== "clean";
  const cell = isNarrow ? 13 : 10;

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <Canvas
        frameloop={visible ? "always" : "never"}
        dpr={Math.max(1, Math.min(window.devicePixelRatio, (isNarrow ? 1.4 : 1.8) * quality))}
        camera={{ fov: 55, position: [0, 0, 0], near: 0.1, far: 140 }}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        onCreated={({ gl }) => {
          // Потеря контекста: не падаем, даём браузеру восстановить
          gl.domElement.addEventListener(
            "webglcontextlost",
            (e) => {
              e.preventDefault();
            },
            false,
          );
          gl.setClearColor(new THREE.Color("#07070a"), 0);
        }}
      >
        <PerformanceMonitor
          // Просадка FPS — снижаем нагрузку ступенями, без резкого «прыжка»
          onDecline={() => setQuality((q) => Math.max(0.25, q - 0.25))}
          onIncline={() => setQuality((q) => Math.min(1, q + 0.1))}
          flipflops={3}
        >
          <Rig />
          <Starfield count={starCount} />
          <Blackhole quality={quality} narrow={isNarrow} />

          <Suspense fallback={null}>
            <Constellations count={languages.length + technologies.length} />
            <Garden count={flowerCount} />
          </Suspense>
        </PerformanceMonitor>

        {asciiOn ? (
          <EffectComposer multisampling={0} enableNormalPass={false}>
            <AsciiPass cell={cell} strength={0.8} mode={mode} />
          </EffectComposer>
        ) : null}
      </Canvas>
    </div>
  );
}
