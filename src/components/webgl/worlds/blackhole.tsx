"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { blackholeFragment, blackholeVertex } from "../shaders/blackhole";
import { pointerState } from "@/lib/store";
import { worldState } from "@/scene/timeline";

/**
 * Мир 1: чёрная дыра.
 * Ray integration runs at its own lower resolution, not at the canvas DPR.
 * One linear HDR texture is composited into the shared scene before WorldPost.
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
    });
    target.texture.colorSpace = THREE.NoColorSpace;
    const material = new THREE.ShaderMaterial({
      vertexShader: blackholeVertex,
      fragmentShader: blackholeFragment,
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
    scene.add(quad);
    pipeline.current = { target, scene, camera: new THREE.Camera(), material };
    return () => {
      pipeline.current = null;
      if (screen) screen.uniforms.uTexture.value = null;
      geometry.dispose();
      material.dispose();
      target.dispose();
    };
  }, []);

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
    const current = pipeline.current;
    if (!current || !display.current || !mesh.current) return;
    // After the dive the expensive integration is completely skipped.
    const active = worldState.hole > 0.001;
    mesh.current.visible = active;
    if (!active) return;
    const m = current.material;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;

    const ease = 1 - Math.exp(-3 * dt);
    smoothPointer.current.x += ((pointerState.inside ? pointerState.nx : 0) - smoothPointer.current.x) * ease;
    smoothPointer.current.y += ((pointerState.inside ? pointerState.ny : 0) - smoothPointer.current.y) * ease;

    // Degrade the hole's resolution first; preserve geometry/lighting and the
    // HTML. Only lower quality levels shorten ray paths and simplify the scene.
    const scale = (narrow ? 0.75 : 0.65) * (quality >= 0.75 ? quality : 0.65);
    const width = Math.max(1, Math.round(state.size.width * scale));
    const height = Math.max(1, Math.round(state.size.height * scale));
    if (current.target.width !== width || current.target.height !== height) current.target.setSize(width, height);

    m.uniforms.uTime.value = t;
    m.uniforms.uPointer.value.copy(smoothPointer.current);
    m.uniforms.uAspect.value = state.size.width / Math.max(1, state.size.height);
    m.uniforms.uQuality.value = quality;
    m.uniforms.uSteps.value = narrow ? (quality >= 0.75 ? 40 : 32) : (quality >= 0.75 ? 96 : quality >= 0.5 ? 80 : 64);
    m.uniforms.uResolution.value.set(width, height);
    m.uniforms.uIntro.value = Math.min(1, m.uniforms.uIntro.value + dt * 2);
    m.uniforms.uOpacity.value = worldState.hole;
    m.uniforms.uDive.value = worldState.dive;
    m.uniforms.uZoom.value = narrow ? 2.1 : 1.74 / m.uniforms.uAspect.value;
    m.uniforms.uCenter.value.set(narrow ? 0 : (state.size.width / state.size.height) * 0.19, narrow ? 0.28 : 0.04);

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
  }, -1);

  return (
    <mesh ref={mesh} renderOrder={-100} frustumCulled={false} visible={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={display}
        uniforms={{ uTexture: { value: null } }}
        vertexShader={blackholeVertex}
        fragmentShader={/* glsl */ `
          varying vec2 vUv;
          uniform sampler2D uTexture;
          void main() { gl_FragColor = texture2D(uTexture, vUv); }
        `}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}
