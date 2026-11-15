"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { asciiSources, BUTTERFLY_TRAIL_SAMPLES, setAsciiEmitter } from "@/scene/ascii-sources";
import { asciiEvents } from "@/scene/ascii-events";
import { gardenState } from "@/scene/garden-state";
import { worldState, smoothstep } from "@/scene/timeline";

const COUNT = 4;
const vertex = /* glsl */ `
  attribute float aSide;
  attribute float aButterfly;
  uniform vec3 uCenters[4];
  uniform float uAngles[4];
  uniform float uTime;
  varying vec2 vUv;
  varying float vSide;
  void main() {
    int id = int(aButterfly);
    vec3 p = position;
    float flap = sin(uTime * 18.0 + aButterfly * 1.7) * 0.85;
    p.x *= cos(flap);
    p.z += abs(position.x) * sin(flap);
    float angle = uAngles[id];
    p.xy = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * p.xy;
    gl_Position = projectionMatrix * viewMatrix * vec4(uCenters[id] + p, 1.0);
    vUv = uv;
    vSide = aSide;
  }
`;
const fragment = /* glsl */ `
  uniform float uFade;
  uniform vec3 uAmber;
  varying vec2 vUv;
  varying float vSide;
  void main() {
    float edge = smoothstep(0.73, 0.98, vUv.x);
    float vein = 1.0 - smoothstep(0.025, 0.065, abs(sin(vUv.y * 18.0 + vUv.x * 4.0)));
    float spots = step(0.86, sin(vUv.y * 47.0)) * step(0.76, vUv.x);
    vec3 color = mix(uAmber * (0.65 + vUv.y * 0.4), vec3(0.018, 0.012, 0.008), max(edge, vein * 0.88));
    color = mix(color, vec3(0.88, 0.76, 0.49), spots * 0.9);
    if (abs(vSide) < 0.5) color = vec3(0.025, 0.017, 0.008);
    gl_FragColor = vec4(color, uFade);
  }
`;

interface Resources {
  mesh: THREE.Mesh;
  geometry: THREE.InstancedBufferGeometry;
  material: THREE.ShaderMaterial;
  centers: THREE.Vector3[];
  angles: Float32Array;
  cycles: Int32Array;
  heads: Int32Array;
  lastTrail: Float64Array;
}

export function Butterflies() {
  const group = useRef<THREE.Group>(null);
  const resources = useRef<Resources | null>(null);
  const projected = useRef(new THREE.Vector3());
  const wasVisible = useRef(false);
  useEffect(() => {
    if (!group.current) return;
    const positions: number[] = [];
    const uvs: number[] = [];
    const sides: number[] = [];
    const indices: number[] = [];
    // Rounded monarch wings, one body and four instances: one draw call.
    const outline = [[0.04, -0.2], [0.25, -0.3], [0.38, -0.19], [0.47, 0.05], [0.42, 0.3], [0.23, 0.39], [0.035, 0.14]];
    for (const side of [-1, 1]) {
      const base = positions.length / 3;
      positions.push(side * 0.14, 0.04, 0);
      uvs.push(0.3, 0.5);
      sides.push(side);
      for (const [x, y] of outline) {
        positions.push(side * x, y, 0);
        uvs.push(x / 0.47, (y + 0.3) / 0.69);
        sides.push(side);
      }
      for (let i = 0; i < outline.length; i++) indices.push(base, base + 1 + i, base + 1 + (i + 1) % outline.length);
    }
    const body = positions.length / 3;
    positions.push(-0.025, -0.24, 0.02, 0.025, -0.24, 0.02, -0.025, 0.26, 0.02, 0.025, 0.26, 0.02);
    uvs.push(0, 0, 1, 0, 0, 1, 1, 1);
    sides.push(0, 0, 0, 0);
    indices.push(body, body + 1, body + 2, body + 2, body + 1, body + 3);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute("aSide", new THREE.Float32BufferAttribute(sides, 1));
    geometry.setAttribute("aButterfly", new THREE.InstancedBufferAttribute(new Float32Array([0, 1, 2, 3]), 1));
    geometry.setIndex(indices);
    geometry.instanceCount = COUNT;
    const centers = Array.from({ length: COUNT }, () => new THREE.Vector3());
    const angles = new Float32Array(COUNT);
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex, fragmentShader: fragment,
      uniforms: { uCenters: { value: centers }, uAngles: { value: angles }, uTime: { value: 0 },
        uFade: { value: 0 }, uAmber: { value: new THREE.Color("#ffb347") } },
      side: THREE.DoubleSide, transparent: true, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;
    group.current.add(mesh);
    resources.current = { mesh, geometry, material, centers, angles,
      cycles: new Int32Array(COUNT).fill(-1), heads: new Int32Array(2), lastTrail: new Float64Array(2).fill(-1000) };
    const container = group.current;
    return () => {
      resources.current = null;
      container.remove(mesh);
      geometry.dispose();
      material.dispose();
      asciiSources.butterflyTrail.fill(0);
      setAsciiEmitter(1, 0, 0, 0, 0);
      setAsciiEmitter(2, 0, 0, 0, 0);
    };
  }, []);

  useFrame((state) => {
    const r = resources.current;
    if (!r || document.hidden) return;
    const visible = worldState.flowers > 0.02 && worldState.growth > 0.1;
    r.mesh.visible = visible;
    if (!visible) {
      if (wasVisible.current) {
        asciiSources.butterflyTrail.fill(0);
        setAsciiEmitter(1, 0, 0, 0, 0);
        setAsciiEmitter(2, 0, 0, 0, 0);
      }
      wasVisible.current = false;
      return;
    }
    wasVisible.current = true;
    const now = performance.now() * 0.001;
    const time = state.clock.elapsedTime;
    r.material.uniforms.uTime.value = time;
    r.material.uniforms.uFade.value = Math.min(1, worldState.flowers * 1.4);
    for (let i = 0; i < COUNT; i++) {
      const elapsed = time + i * 3.6;
      const cycle = Math.floor(elapsed / 15);
      const phase = elapsed % 15;
      const flower = (i + cycle) % 4;
      const n = flower * 3;
      const center = r.centers[i];
      const oldX = center.x;
      const oldY = center.y;
      const orbit = phase / 15 * Math.PI * 2;
      const landing = phase >= 11 ? 1 - smoothstep(13, 15, phase) : smoothstep(8, 11, phase);
      const x = Math.cos(orbit + i) * (1.5 + i * 0.12);
      const y = 0.7 + Math.sin(orbit * 2 + i) * 0.65;
      const z = Math.sin(orbit + i * 0.7) * 0.7;
      // Curl of a trigonometric vector potential, not a random teleport path.
      const curlX = -Math.sin(x * 0.7 + time * 1.1) * Math.sin(y) - 0.7 * Math.cos(z * 0.7 + time * 0.9) * Math.cos(x);
      const curlY = -Math.sin(y * 0.8 + time) * Math.sin(z) - 0.7 * Math.cos(x * 0.7 + time * 1.1) * Math.cos(y);
      const curlZ = -Math.sin(z * 0.7 + time * 0.9) * Math.sin(x) - 0.8 * Math.cos(y * 0.8 + time) * Math.cos(z);
      const flight = (1 - landing) * (state.size.width < 768 ? 0.35 : 0.75);
      const previous = ((flower + 3) % 4) * 3;
      const travel = smoothstep(0, 4, phase);
      const ax = THREE.MathUtils.lerp(gardenState.anchors[previous], gardenState.anchors[n], travel);
      const ay = THREE.MathUtils.lerp(gardenState.anchors[previous + 1], gardenState.anchors[n + 1], travel);
      const az = THREE.MathUtils.lerp(gardenState.anchors[previous + 2], gardenState.anchors[n + 2], travel);
      center.set(ax + (x + curlX * 0.22) * flight,
        ay + 0.16 + (y + curlY * 0.22) * flight,
        az + 0.2 + (z + curlZ * 0.22) * flight);
      if (flight > 0.1 && Math.abs(center.x - oldX) + Math.abs(center.y - oldY) > 0.0001) {
        r.angles[i] = Math.atan2(center.y - oldY, center.x - oldX) - Math.PI * 0.5;
      }
      if (phase >= 11 && phase < 13 && r.cycles[i] !== cycle) {
        asciiEvents.flowerBorn[flower] = now;
        r.cycles[i] = cycle;
      }
      if (i >= 2) continue;
      projected.current.copy(center).project(state.camera);
      const sx = (projected.current.x + 1) * state.size.width * 0.5;
      const sy = (1 - projected.current.y) * state.size.height * 0.5;
      const radius = state.size.width * 0.125;
      const onScreen = projected.current.z < 1 && sx > -radius && sx < state.size.width + radius && sy > -radius && sy < state.size.height + radius;
      setAsciiEmitter(i + 1, sx, sy, radius, onScreen ? worldState.flowers : 0);
      if (onScreen && now - r.lastTrail[i] >= 0.075) {
        const slot = (i * BUTTERFLY_TRAIL_SAMPLES + r.heads[i]) * 4;
        const trail = asciiSources.butterflyTrail;
        trail[slot] = sx;
        trail[slot + 1] = sy;
        trail[slot + 2] = now;
        trail[slot + 3] = radius;
        r.heads[i] = (r.heads[i] + 1) % BUTTERFLY_TRAIL_SAMPLES;
        r.lastTrail[i] = now;
      }
    }
  });
  return <group ref={group} dispose={null} />;
}
