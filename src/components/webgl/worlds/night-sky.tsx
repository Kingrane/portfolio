"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { ShaderMaterial } from "three";

/** Broad, very slow violet light within the existing scene, not a CSS fog. */
export function NightSky() {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uAspect: { value: 1 } }), []);
  useFrame((state) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value = state.clock.elapsedTime;
    material.current.uniforms.uAspect.value = state.size.width / Math.max(1, state.size.height);
  });
  return (
    <mesh renderOrder={-110} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
        vertexShader={/* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = vec4(position.xy, 0.999, 1.0); }
        `}
        fragmentShader={/* glsl */ `
          varying vec2 vUv;
          uniform float uTime;
          uniform float uAspect;
          void main() {
            vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
            float t = uTime * 0.035;
            vec2 a = vec2(sin(t) * 0.42, cos(t * 0.73) * 0.28);
            vec2 b = vec2(cos(t * 0.61) * 0.64, sin(t * 0.84) * 0.35);
            float violet = exp(-dot(p - a, p - a) * 1.7);
            float plum = exp(-dot(p - b, p - b) * 2.4);
            // Linear HDR. Black stays black; color comes from two broad lights.
            vec3 color = vec3(0.0045, 0.0016, 0.016) * violet
              + vec3(0.005, 0.0012, 0.007) * plum;
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
}
