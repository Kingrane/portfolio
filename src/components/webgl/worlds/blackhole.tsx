"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { blackholeFragment, blackholeVertex } from "../shaders/blackhole";
import { pointerState } from "@/lib/store";
import { worldState } from "@/scene/timeline";

/**
 * Мир 1: чёрная дыра.
 * Один квад, растянутый на весь экран, — вся визуальная работа в шейдере.
 * Курсор слегка смещает сцену, клик запускает ударную волну.
 */
export function Blackhole({ quality, narrow = false }: { quality: number; narrow?: boolean }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const smoothPointer = useRef(new THREE.Vector2(0, 0));
  const pulse = useRef(0);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uPulse: { value: 0 },
      uIntro: { value: 0 },
      uQuality: { value: 1 },
      uOpacity: { value: 1 },
      uDive: { value: 0 },
      // Композиция зависит от пропорций экрана: на широком кадре дыра стоит
      // справа от заголовка, на узком — уходит вверх и уменьшается, чтобы не
      // спорить с текстом, который на мобильном занимает весь центр.
      uZoom: { value: narrow ? 1.9 : 1 },
      uCenter: { value: new THREE.Vector2(narrow ? 0 : 0.34, narrow ? 0.44 : 0.03) },
    }),
    [narrow],
  );

  // Клик по странице = ударная волна
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      // Не мешаем кликам по ссылкам и кнопкам
      if (target?.closest("a, button, [role='button']")) return;
      pulse.current = 0.001;
    };
    window.addEventListener("pointerdown", onDown, { passive: true });
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  useFrame((state, delta) => {
    const m = mat.current;
    if (!m) return;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;

    smoothPointer.current.x += (pointerState.nx - smoothPointer.current.x) * 0.045;
    smoothPointer.current.y += (pointerState.ny - smoothPointer.current.y) * 0.045;

    m.uniforms.uTime.value = t;
    m.uniforms.uPointer.value.copy(smoothPointer.current);
    m.uniforms.uAspect.value = state.size.width / Math.max(1, state.size.height);
    m.uniforms.uQuality.value = quality;
    m.uniforms.uIntro.value = Math.min(1, m.uniforms.uIntro.value + dt * 2);
    m.uniforms.uOpacity.value = worldState.hole;
    m.uniforms.uDive.value = worldState.dive;
    m.uniforms.uCenter.value.set(narrow ? 0 : (state.size.width / state.size.height) * 0.19, narrow ? 0.32 : 0.06);

    if (pulse.current > 0) {
      pulse.current += dt * 0.7;
      if (pulse.current >= 1) pulse.current = 0;
    }
    m.uniforms.uPulse.value = pulse.current;
  });

  return (
    <mesh renderOrder={-100} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={blackholeVertex}
        fragmentShader={blackholeFragment}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}
