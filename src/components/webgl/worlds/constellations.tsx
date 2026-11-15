"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { pointerState } from "@/lib/store";

const nodeVertex = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  uniform float uPixelRatio;
  varying vec3 vColor;

  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio * (52.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

const nodeFragment = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = smoothstep(0.16, 0.0, d);
    float halo = smoothstep(0.5, 0.1, d) * 0.35;
    float a = core + halo;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

interface Graph {
  base: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  edges: Array<[number, number]>;
}

/**
 * Мир 2: созвездие технологий.
 *
 * Каждая технология — узел на сфере (распределение Фибоначчи, чтобы не
 * слипались). Узлы соединены с двумя соседями. Курсор притягивает ближайшие
 * узлы: линии реально тянутся за мышью, а не просто светятся.
 */
export function Constellations({ count }: { count: number }) {
  const group = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const dpr = useThree((s) => s.viewport.dpr);

  const graph = useMemo<Graph>(() => {
    const base = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      // Равномерное распределение точек по сфере
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      const r = 7.2 * (0.8 + 0.2 * Math.sin(i * 1.7));
      base[i * 3] = Math.cos(theta) * radius * r;
      base[i * 3 + 1] = y * r * 0.62;
      base[i * 3 + 2] = Math.sin(theta) * radius * r;

      // Каждый третий узел — янтарный, остальные ирисовые
      const amber = i % 4 === 0;
      colors[i * 3] = amber ? 1.0 : 0.62;
      colors[i * 3 + 1] = amber ? 0.72 : 0.52;
      colors[i * 3 + 2] = amber ? 0.34 : 1.0;

      sizes[i] = amber ? 5.5 : 4.0;
    }

    // Рёбра: сосед по кругу + «дальний» сосед, чтобы сетка не была плоской
    const edges: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
      edges.push([i, (i + 1) % count]);
      if (i % 2 === 0) edges.push([i, (i + 3) % count]);
    }

    return { base, colors, sizes, edges };
  }, [count]);

  const lineGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(graph.edges.length * 6), 3),
    );
    g.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(graph.edges.length * 6), 3),
    );
    return g;
  }, [graph.edges.length]);

  const nodeGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(graph.base.slice(), 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(graph.colors, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(graph.sizes, 1));
    return g;
  }, [graph]);

  const uniforms = useMemo(() => ({ uPixelRatio: { value: Math.min(2, dpr) } }), [dpr]);
  useEffect(() => () => {
    nodeGeometry.dispose();
    lineGeometry.dispose();
  }, [nodeGeometry, lineGeometry]);

  // Позиция курсора в мире — чтобы узлы тянулись к нему
  const pointerWorld = useRef(new THREE.Vector3(0, 0, -10));
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const cam = state.camera;

    // Точка на плоскости z = -10 в мировых координатах с учётом камеры
    pointerWorld.current.set(
      cam.position.x + pointerState.nx * 9,
      cam.position.y + pointerState.ny * 6,
      -10,
    );

    if (!pointsRef.current || !linesRef.current || !group.current) return;
    const posAttr = pointsRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const displaced = arr;

    for (let i = 0; i < count; i++) {
      const x = graph.base[i * 3];
      const y = graph.base[i * 3 + 1];
      const z = graph.base[i * 3 + 2];

      // Собственное дыхание узла
      const breathe = Math.sin(t * 0.7 + i) * 0.12;
      let nx = x + breathe;
      let ny = y + Math.cos(t * 0.5 + i * 0.7) * 0.1;
      const nz = z + breathe * 0.6;

      // Притяжение к курсору: сильнее у близких узлов
      const dx = pointerWorld.current.x - nx;
      const dy = pointerWorld.current.y - ny;
      const dz = pointerWorld.current.z - nz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const pull = Math.min(1.6, 2.6 / (dist + 2.0)) * 0.55;

      nx += dx * pull * 0.35;
      ny += dy * pull * 0.35;

      arr[i * 3] = nx;
      arr[i * 3 + 1] = ny;
      arr[i * 3 + 2] = nz;

    }
    posAttr.needsUpdate = true;

    // Пересобираем линии по новым позициям узлов
    const linePos = linesRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    const lineCol = linesRef.current.geometry.getAttribute("color") as THREE.BufferAttribute;
    const lp = linePos.array as Float32Array;
    const lc = lineCol.array as Float32Array;

    graph.edges.forEach(([a, b], i) => {
      lp[i * 6] = displaced[a * 3];
      lp[i * 6 + 1] = displaced[a * 3 + 1];
      lp[i * 6 + 2] = displaced[a * 3 + 2];
      lp[i * 6 + 3] = displaced[b * 3];
      lp[i * 6 + 4] = displaced[b * 3 + 1];
      lp[i * 6 + 5] = displaced[b * 3 + 2];

      // Линия ярче у курсора
      const mid = [
        (displaced[a * 3] + displaced[b * 3]) / 2,
        (displaced[a * 3 + 1] + displaced[b * 3 + 1]) / 2,
        (displaced[a * 3 + 2] + displaced[b * 3 + 2]) / 2,
      ];
      const d = Math.hypot(
        mid[0] - pointerWorld.current.x,
        mid[1] - pointerWorld.current.y,
        mid[2] - pointerWorld.current.z,
      );
      const glow = Math.min(1, 1.6 / (d + 1.2));
      lc[i * 6] = 0.30 + glow * 0.5;
      lc[i * 6 + 1] = 0.26 + glow * 0.34;
      lc[i * 6 + 2] = 0.62 + glow * 0.38;
      lc[i * 6 + 3] = 0.30 + glow * 0.5;
      lc[i * 6 + 4] = 0.26 + glow * 0.34;
      lc[i * 6 + 5] = 0.62 + glow * 0.38;
    });

    linePos.needsUpdate = true;
    lineCol.needsUpdate = true;

    if (group.current) {
      group.current.rotation.y = t * 0.045 + pointerState.nx * 0.18;
      group.current.rotation.x = pointerState.ny * -0.1;
    }
  });

  return (
    <group ref={group} position={[0, -30, -10]}>
      <lineSegments ref={linesRef} geometry={lineGeometry} frustumCulled={false}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.42}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      <points ref={pointsRef} geometry={nodeGeometry} frustumCulled={false}>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={nodeVertex}
          fragmentShader={nodeFragment}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
