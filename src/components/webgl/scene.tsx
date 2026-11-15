"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { Blackhole } from "./worlds/blackhole";
import { NightSky } from "./worlds/night-sky";
import { Starfield } from "./worlds/starfield";
import { Constellations } from "./worlds/constellations";
import { Garden } from "./worlds/garden";
import { WorldPost } from "./effects/world-post";
import { SceneEvents } from "./effects/scene-events";
import { Butterflies } from "./worlds/butterflies";
import { pointerState, viewState } from "@/lib/store";
import { sampleTimeline, worldState } from "@/scene/timeline";
import { languages, technologies } from "@/content/stack";
import { useMediaQuery } from "@/lib/use-media-query";
import { diagnosticFrame, frozen, loadPerf } from "@/scene/diagnostics";

/**
 * ЕДИНСТВЕННЫЙ WebGL-контекст на весь сайт.
 *
 * Почему один: браузеры держат 8–16 контекстов, на мобильных меньше, а каждый
 * живой контекст ест память. Поэтому миры — не отдельные канвасы, а группы
 * объектов в одной сцене, расставленные вдоль оси Y. Камера едет по странице
 * и проезжает мимо них: чёрная дыра → созвездия → сад.
 */

function Rig() {
  const lookTarget = useRef(new THREE.Vector3());
  useFrame(diagnosticFrame("Rig", (state, delta) => {
    const dt = Math.min(delta, 0.06);
    const cam = state.camera;
    sampleTimeline(viewState.progress);
    const lerp = frozen ? 1 : 1 - Math.pow(0.001, dt);
    cam.position.y += (worldState.cameraY - cam.position.y) * lerp;
    cam.position.z += (worldState.cameraZ - cam.position.z) * lerp;
    cam.position.x += (pointerState.nx * 0.35 - cam.position.x) * lerp;
    lookTarget.current.set(0, cam.position.y, -10);
    cam.lookAt(lookTarget.current);
    cam.rotation.z = worldState.cameraTilt - pointerState.nx * 0.008;
    cam.updateMatrixWorld();
  }), -2);

  return null;
}

export default function Scene() {
  const [quality, setQuality] = useState(1);
  const [visible, setVisible] = useState(() => !document.hidden);
  const isNarrow = useMediaQuery("(max-width: 768px)");

  useEffect(() => {
    // Не жжём GPU, когда вкладка не видна
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const starCount = quality >= 0.5 ? (isNarrow ? 1800 : 4200) : isNarrow ? 700 : 1600;
  const flowerCount = quality >= 0.5 ? (isNarrow ? 22 : 90) : isNarrow ? 14 : 44;
  const cell = isNarrow ? 11 : 10;

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden data-world-canvas data-qa-quality={quality}>
      <Canvas
        frameloop={visible ? "always" : "never"}
        dpr={Math.max(1, Math.min(window.devicePixelRatio, (isNarrow ? 1.4 : 1.8) * (quality < 0.5 ? 0.7 : 1)))}
        camera={{ fov: 55, position: [0, 0, 0], near: 0.1, far: 140 }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        onCreated={(state) => {
          const { gl } = state;
          // The canvas owns renderer configuration; post passes own HDR mapping.
          gl.toneMapping = THREE.NoToneMapping;
          gl.domElement.setAttribute("data-qa-webgl", "");
          // Потеря контекста: не падаем, даём браузеру восстановить
          gl.domElement.addEventListener(
            "webglcontextlost",
            (e) => {
              e.preventDefault();
            },
            false,
          );
          gl.setClearColor(0x000000, 1);
          loadPerf(state);
        }}
      >
        <PerformanceMonitor
          bounds={(refresh) => isNarrow ? [30, 55] : [55, refresh > 90 ? 90 : 60]}
          // Просадка FPS — снижаем нагрузку ступенями, без резкого «прыжка»
          onDecline={() => { if (!frozen) setQuality((q) => Math.max(0.25, q - 0.25)); }}
          onIncline={() => { if (!frozen) setQuality((q) => Math.min(1, q + 0.1)); }}
          onFallback={() => { if (!frozen) setQuality(0.25); }}
          flipflops={3}
        >
          <Rig />
          <NightSky />
          <Starfield count={starCount} />
          <Blackhole quality={quality} narrow={isNarrow} />

          <Suspense fallback={null}>
            <Constellations count={languages.length + technologies.length} />
            <Garden count={flowerCount} />
            <Butterflies />
          </Suspense>
        </PerformanceMonitor>

        <WorldPost cell={cell} quality={quality} />
        <SceneEvents />
      </Canvas>
    </div>
  );
}
