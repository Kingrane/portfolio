"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { worldState } from "@/scene/timeline";
import { hashString, mulberry32 } from "@/lib/ascii";

const STAR_COUNT = 1400;

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aSeed;

  uniform float uTime;
  uniform float uPixelRatio;

  varying float vTwinkle;

  void main() {
    vec3 p = position;
    // Очень медленный дрейф: звёзды «дышат», но не летают
    p.x += sin(uTime * 0.07 + aSeed * 6.28) * 0.22;
    p.y += cos(uTime * 0.05 + aSeed * 4.71) * 0.18;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = clamp(aSize * uPixelRatio * (24.0 / max(1.0, -mv.z)), 1.0, 3.0);
    gl_Position = projectionMatrix * mv;

    // Separate frequency AND phase, with a luminous floor: the field never
    // pulses down in unison even when nearby random seeds are correlated.
    float phase = fract(aSeed * 73.73) * 6.2831853;
    float frequency = 0.28 + fract(aSeed * 127.91) * 0.9;
    vTwinkle = 0.65 + 0.35 * (0.5 + 0.5 * sin(uTime * frequency + phase));
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vTwinkle;

  void main() {
    // Круглая точка с мягким краем вместо квадрата
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = 1.0 - smoothstep(0.05, 0.5, d);
    a *= a;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a * vTwinkle * uOpacity);
  }
`;

/**
 * Звёздное поле — общий фон для всех миров. Живёт в 3D, поэтому при движении
 * камеры вниз по странице даёт настоящий параллакс.
 */
export function Starfield({ count = STAR_COUNT }: { count?: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const dpr = useThree((s) => s.viewport.dpr);

  const geometry = useMemo(() => {
    // Детерминированный PRNG вместо Math.random: поле звёзд одинаковое при
    // каждом заходе, и рендер остаётся «чистым» для React Compiler.
    const rand = mulberry32(hashString(`starfield:${count}`));
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const seeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Распределяем по «коридору» камеры: сверху вниз по всей длине страницы
      positions[i * 3] = (rand() - 0.5) * 74;
      positions[i * 3 + 1] = 14 - rand() * 96;
      positions[i * 3 + 2] = -6 - rand() * 42;

      sizes[i] = 0.55 + rand() * 0.9;
      seeds[i] = rand();
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    return g;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(2, dpr) },
      uColor: { value: new THREE.Color("#ededf2") },
      uOpacity: { value: 0.24 },
    }),
    [dpr],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value = state.clock.elapsedTime;
    mat.current.uniforms.uOpacity.value = worldState.stars;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
