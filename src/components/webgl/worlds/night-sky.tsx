"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { ShaderMaterial } from "three";
import { diagnosticFrame, sceneTime } from "@/scene/diagnostics";

/** Low indigo night light, with the reading side left dark, not a CSS fog. */
export function NightSky() {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uAspect: { value: 1 } }), []);
  useFrame(diagnosticFrame("NightSky", (state) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value = sceneTime(state.clock.elapsedTime);
    material.current.uniforms.uAspect.value = state.size.width / Math.max(1, state.size.height);
  }));
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
            vec2 a = vec2(uAspect * 0.2 + sin(t) * 0.06, 0.1 + cos(t * 0.73) * 0.035);
            vec2 b = vec2(uAspect * 0.12 + cos(t * 0.61) * 0.08, -0.4 + sin(t * 0.84) * 0.025);
            float violet = exp(-dot(p - a, p - a) * 2.7);
            float indigo = exp(-dot(p - b, p - b) * 3.8);
            // Linear HDR: only a trace of right-hand / lower-rim night light.
            // No drifting plum cloud or orange glow behind the heading/header.
            vec3 color = vec3(0.0026, 0.0012, 0.0085) * violet
              + vec3(0.0007, 0.0008, 0.0034) * indigo;
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
}
