"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { blackholeFragment, blackholeVertex } from "../shaders/blackhole";
import { pointerState } from "@/lib/store";
import { worldState } from "@/scene/timeline";
import { asciiSources } from "@/scene/ascii-sources";
import { diagnosticFrame, frozen, sceneTime } from "@/scene/diagnostics";

/**
 * Мир 1: чёрная дыра.
 * Ray integration runs at its own lower resolution, not at the canvas DPR.
 * MRT keeps linear HDR disk/coverage separate from the clean lensed stars.
 */
export function Blackhole({ quality, narrow = false }: { quality: number; narrow?: boolean }) {
  const display = useRef<THREE.ShaderMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const smoothPointer = useRef(new THREE.Vector2(0, 0));
  const pulse = useRef(0);
  const pipeline = useRef<{
    target: THREE.WebGLRenderTarget;
    scene: THREE.Scene;
    camera: THREE.Camera;
    material: THREE.ShaderMaterial;
  } | null>(null);

  useEffect(() => {
    const screen = display.current;
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
      count: 2,
    });
    target.textures[0].colorSpace = target.textures[1].colorSpace = THREE.NoColorSpace;
    const material = new THREE.ShaderMaterial({
      vertexShader: blackholeVertex,
      fragmentShader: `layout(location = 0) out highp vec4 holeColor;
        layout(location = 1) out highp vec4 cleanStars;
        #define gl_FragColor holeColor
        ${blackholeFragment}`,
      glslVersion: THREE.GLSL3,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uPointer: { value: new THREE.Vector2(0, 0) },
        uPulse: { value: 0 },
        uIntro: { value: 0 },
        uQuality: { value: 1 },
        uSteps: { value: 96 },
        uOpacity: { value: 1 },
        uDive: { value: 0 },
        uZoom: { value: 1 },
        uCenter: { value: new THREE.Vector2() },
      },
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(geometry, material);
    quad.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.name = "Blackhole integration";
    scene.add(quad);
    pipeline.current = { target, scene, camera: new THREE.Camera(), material };
    return () => {
      pipeline.current = null;
      if (asciiSources.hole === target.texture) asciiSources.hole = null;
      if (asciiSources.cleanStars === target.textures[1]) asciiSources.cleanStars = null;
      if (screen) screen.uniforms.uTexture.value = null;
      if (screen) screen.uniforms.uStars.value = null;
      geometry.dispose();
      material.dispose();
      target.dispose();
    };
  }, []);

  // Клик по странице = ударная волна
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (frozen) return;
      const target = e.target as HTMLElement | null;
      // Не мешаем кликам по ссылкам и кнопкам
      if (target?.closest("a, button, [role='button']")) return;
      pulse.current = 0.001;
    };
    window.addEventListener("pointerdown", onDown, { passive: true });
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  useFrame(diagnosticFrame("Blackhole", (state, delta) => {
    const current = pipeline.current;
    if (!current || !display.current || !mesh.current) return;
    // After the dive the expensive integration is completely skipped.
    const active = worldState.hole > 0.001;
    mesh.current.visible = active;
    if (!active) return;
    const m = current.material;
    const dt = Math.min(delta, 0.05);
    const t = sceneTime(state.clock.elapsedTime);

    const ease = frozen ? 1 : 1 - Math.exp(-3 * dt);
    smoothPointer.current.x += ((pointerState.inside ? pointerState.nx : 0) - smoothPointer.current.x) * ease;
    smoothPointer.current.y += ((pointerState.inside ? pointerState.ny : 0) - smoothPointer.current.y) * ease;

    // Degrade the hole's resolution first; preserve geometry/lighting and the
    // HTML. Only lower quality levels shorten ray paths and simplify the scene.
    const scale = 0.75 * Math.max(0.45, Math.min(1, quality));
    const width = Math.max(1, Math.round(state.size.width * scale));
    const height = Math.max(1, Math.round(state.size.height * scale));
    if (current.target.width !== width || current.target.height !== height) current.target.setSize(width, height);

    m.uniforms.uTime.value = t;
    m.uniforms.uPointer.value.copy(smoothPointer.current);
    m.uniforms.uAspect.value = state.size.width / Math.max(1, state.size.height);
    m.uniforms.uQuality.value = quality;
    m.uniforms.uSteps.value = narrow ? (quality >= 0.5 ? 40 : 32) : (quality >= 0.5 ? 96 : quality >= 0.35 ? 80 : 64);
    m.uniforms.uResolution.value.set(width, height);
    m.uniforms.uIntro.value = frozen ? Math.min(1, t * 2) : Math.min(1, m.uniforms.uIntro.value + dt * 2);
    m.uniforms.uOpacity.value = worldState.hole;
    m.uniforms.uDive.value = worldState.dive;
    // The integrated critical impact parameter projects to ~0.244 image units.
    // r_screen / width = 0.244 / (zoom * aspect): desktop shadow is 12vw.
    // WorldPost's mask must use the same zoom, center and eased dive centering.
    m.uniforms.uZoom.value = narrow ? 2.1 : (0.244 / 0.12) / m.uniforms.uAspect.value;
    m.uniforms.uCenter.value.set(narrow ? 0 : m.uniforms.uAspect.value * 0.18, narrow ? 0.28 : 0.04);
    // Publish the SAME image-plane transform to the ASCII/output masks. The
    // critical impact parameter expands continuously while the camera dives.
    const dive = worldState.dive;
    const approach = Math.min(1, Math.max(0, dive / 0.8));
    const centered = 1 - approach * approach * (3 - 2 * approach);
    const radius = 18 - 16.96 * dive * dive;
    const criticalImpact2 = 6.75 / (1 + 6.75 / (radius * radius * radius));
    const screenLimit = Math.hypot(state.size.width, state.size.height) * 2;
    const shadow = radius > 1.5 ? Math.min(screenLimit,
      state.size.height / Math.max(0.15, m.uniforms.uZoom.value) / 0.6
        * Math.sqrt(criticalImpact2 / Math.max(0.000001, radius * radius - criticalImpact2))) : screenLimit;
    const bounds = asciiSources.holeBounds;
    bounds[0] = state.size.width * 0.5 + state.size.height * (m.uniforms.uCenter.value.x * centered + smoothPointer.current.x * 0.007);
    bounds[1] = state.size.height * (0.5 - m.uniforms.uCenter.value.y * centered - smoothPointer.current.y * 0.007);
    bounds[2] = shadow;
    bounds[3] = shadow * 3.7;

    if (pulse.current > 0) {
      pulse.current += dt * 0.7;
      if (pulse.current >= 1) pulse.current = 0;
    }
    m.uniforms.uPulse.value = pulse.current;

    const previous = state.gl.getRenderTarget();
    state.gl.setRenderTarget(current.target);
    state.gl.render(current.scene, current.camera);
    state.gl.setRenderTarget(previous);
    display.current.uniforms.uTexture.value = current.target.texture;
    display.current.uniforms.uStars.value = current.target.textures[1];
    display.current.uniforms.uOpacity.value = worldState.hole;
    asciiSources.hole = current.target.texture;
    asciiSources.cleanStars = current.target.textures[1];
  }), -1);

  return (
    <mesh ref={mesh} renderOrder={-100} frustumCulled={false} visible={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={display}
        uniforms={{ uTexture: { value: null }, uStars: { value: null }, uOpacity: { value: 1 } }}
        vertexShader={blackholeVertex}
        fragmentShader={/* glsl */ `
          varying vec2 vUv;
          uniform sampler2D uTexture;
          uniform sampler2D uStars;
          uniform float uOpacity;
          void main() { gl_FragColor = vec4(max(vec3(0.0), texture2D(uTexture, vUv).rgb - texture2D(uStars, vUv).rgb), uOpacity); }
        `}
        depthWrite={false}
        depthTest={false}
        transparent
      />
    </mesh>
  );
}
