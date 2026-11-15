"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { worldState } from "@/scene/timeline";
import { hashString, mulberry32 } from "@/lib/ascii";
import { pointerState } from "@/lib/store";

const STAR_COUNT = 4200;

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aSeed;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec2 uPointer;

  varying float vTwinkle;
  varying vec3 vTint;

  void main() {
    vec3 p = position;
    // Очень медленный дрейф: звёзды «дышат», но не летают
    p.x += sin(uTime * 0.07 + aSeed * 6.28) * 0.22;
    p.y += cos(uTime * 0.05 + aSeed * 4.71) * 0.18;
    // A shared world-space camera offset, not per-star mouse noise. Perspective
    // gives nearby points a larger displacement than the distant population.
    p.xy += uPointer * vec2(0.38, 0.24);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = clamp(aSize * uPixelRatio * (24.0 / max(1.0, -mv.z)),
      0.8 * uPixelRatio, 2.8 * uPixelRatio);
    gl_Position = projectionMatrix * mv;

    // Separate frequency AND phase, with a luminous floor: the field never
    // pulses down in unison even when nearby random seeds are correlated.
    float phase = fract(aSeed * 73.73) * 6.2831853;
    float frequency = 0.28 + fract(aSeed * 127.91) * 0.9;
    vTwinkle = 0.65 + 0.35 * (0.5 + 0.5 * sin(uTime * frequency + phase));
    float spectrum = fract(aSeed * 211.37);
    vTint = mix(vec3(0.57, 0.74, 1.0), vec3(1.0, 0.97, 0.94),
      smoothstep(0.06, 0.72, spectrum));
    vTint = mix(vTint, vec3(1.0, 0.71, 0.46), smoothstep(0.79, 0.99, spectrum));
    vTint *= mix(0.5, 1.65, pow(fract(aSeed * 191.39), 3.0));
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vTwinkle;
  varying vec3 vTint;

  void main() {
    // Круглая точка с мягким краем вместо квадрата
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = 1.0 - smoothstep(0.05, 0.5, d);
    a *= a;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor * vTint, a * vTwinkle * uOpacity);
  }
`;

/**
 * Звёздное поле — общий фон для всех миров. Живёт в 3D, поэтому при движении
 * камеры вниз по странице даёт настоящий параллакс.
 */
export function Starfield({ count = STAR_COUNT }: { count?: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const points = useRef<THREE.Points>(null);
  const dpr = useThree((s) => s.viewport.dpr);

  const geometry = useMemo(() => {
    // Детерминированный PRNG вместо Math.random: поле звёзд одинаковое при
    // каждом заходе, и рендер остаётся «чистым» для React Compiler.
    // Quality removes a suffix instead of teleporting the surviving stars.
    const rand = mulberry32(hashString("starfield:v3"));
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const seeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Распределяем по «коридору» камеры: сверху вниз по всей длине страницы
      positions[i * 3] = (rand() - 0.5) * 74;
      positions[i * 3 + 1] = 14 - rand() * 96;
      positions[i * 3 + 2] = -6 - rand() * 42;

      // Most stars are pinpoints; only a small luminosity tail grows larger.
      sizes[i] = 0.6 + Math.pow(rand(), 3) * 1.7;
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
      uPointer: { value: new THREE.Vector2() },
      uColor: { value: new THREE.Color("#ededf2") },
      uOpacity: { value: 0.55 },
    }),
    [dpr],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  // Rendered into WorldPost's sharp star layer, never through glyph-density
  // sampling. Keep geometry/material and the same camera/point-size uniforms.
  useEffect(() => { points.current?.layers.set(1); }, []);

  useFrame((state, delta) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value = state.clock.elapsedTime;
    mat.current.uniforms.uOpacity.value = worldState.stars;
    const pointer = mat.current.uniforms.uPointer.value as THREE.Vector2;
    const ease = 1 - Math.exp(-2.6 * Math.min(delta, 0.05));
    pointer.x += ((pointerState.inside ? pointerState.nx : 0) - pointer.x) * ease;
    pointer.y += ((pointerState.inside ? pointerState.ny : 0) - pointer.y) * ease;
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
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
