"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { pointerState, viewState } from "@/lib/store";
import { hashString, mulberry32 } from "@/lib/ascii";

/** Светлячки: точки с дрейфом в вершинном шейдере, без JS в кадре. */
const fireflyVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uFade;
  varying float vGlow;

  void main() {
    vec3 p = position;
    float s = aSeed * 6.28;
    // Медленный «полёт» по трём осям с разными периодами — читается как хаос,
    // но остаётся детерминированным
    p.x += sin(uTime * 0.35 + s) * 1.4 + sin(uTime * 0.11 + s * 2.0) * 0.8;
    p.y += sin(uTime * 0.28 + s * 1.7) * 0.7;
    p.z += cos(uTime * 0.31 + s * 1.3) * 1.0;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (1.6 + sin(uTime * 2.0 + s * 3.0) * 0.9) * uPixelRatio * (46.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;

    vGlow = (0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.6 + s * 5.0))) * uFade;
  }
`;

const fireflyFragment = /* glsl */ `
  varying float vGlow;
  uniform vec3 uColor;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d);
    a = pow(a, 1.6) * vGlow;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

interface Flower {
  x: number;
  z: number;
  /** Высота над «землёй» */
  height: number;
  /** Рельеф: луг не идеально плоский */
  ground: number;
  phase: number;
  scale: number;
  amber: boolean;
}

const PETAL_COUNT = 5;

/** Насколько ниже камеры стоит «луг». Чем больше — тем ниже цветы на экране. */
const GROUND_OFFSET = 3.4;

/** Появление: прогресс скролла, на котором сад проступает. */
const FADE_IN: [number, number] = [0.66, 0.79];

/**
 * Мир 3: сад.
 *
 * Цветы — instanced-меши (один draw call на тип), качаются на «ветру» от
 * времени. Огоньки летают в шейдере.
 *
 * Группа не стоит в мире намертво: она держится на фиксированном отступе ниже
 * камеры и проявляется только в своей зоне страницы. Это даёт эффект
 * «переднего плана кадра» — трава по нижней кромке, как в видоискателе, — и
 * при этом она никогда не наползает на текст посередине экрана.
 */
export function Garden({ count = 150 }: { count?: number }) {
  const stems = useRef<THREE.InstancedMesh>(null);
  const petals = useRef<THREE.InstancedMesh>(null);
  const cores = useRef<THREE.InstancedMesh>(null);
  const stemsMat = useRef<THREE.MeshBasicMaterial>(null);
  const petalsMat = useRef<THREE.MeshBasicMaterial>(null);
  const coresMat = useRef<THREE.MeshBasicMaterial>(null);
  const fireflies = useRef<THREE.ShaderMaterial>(null);
  const group = useRef<THREE.Group>(null);
  const fade = useRef(0);
  const dpr = useThree((s) => s.viewport.dpr);

  const flowers = useMemo<Flower[]>(() => {
    const rand = mulberry32(hashString(`garden:${count}`));
    const list: Flower[] = [];
    for (let i = 0; i < count; i++) {
      // Луг — это плоскость на фиксированной глубине ниже камеры. Цветы ближе
      // 7 единиц просто уходят за нижнюю кромку кадра, поэтому полосу начинаем
      // оттуда и уводим к «горизонту».
      const x = (rand() - 0.5) * 46;
      list.push({
        x,
        z: -7 - rand() * 26,
        height: 0.45 + rand() * 1.15,
        // Лёгкий рельеф: два синуса по X дают пологие холмы вместо линейки
        ground: Math.sin(x * 0.16) * 0.3 + Math.cos(x * 0.061) * 0.42,
        phase: rand() * Math.PI * 2,
        scale: 0.5 + rand() * 0.6,
        amber: rand() > 0.72,
      });
    }
    return list;
  }, [count]);

  // Цветы: фиолетовые и янтарные венчики
  useEffect(() => {
    if (!petals.current || !cores.current) return;
    const violet = new THREE.Color("#7c5cff");
    const amber = new THREE.Color("#ffb454");
    flowers.forEach((f, i) => {
      petals.current?.setColorAt(i, f.amber ? amber.clone().lerp(violet, 0.25) : violet);
      cores.current?.setColorAt(i, amber);
    });
    if (petals.current.instanceColor) petals.current.instanceColor.needsUpdate = true;
    if (cores.current.instanceColor) cores.current.instanceColor.needsUpdate = true;
  }, [flowers]);

  const fireflyGeo = useMemo(() => {
    const rand = mulberry32(hashString("fireflies"));
    const n = 220;
    const positions = new Float32Array(n * 3);
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      positions[i * 3] = (rand() - 0.5) * 40;
      positions[i * 3 + 1] = rand() * 3.2;
      positions[i * 3 + 2] = -7 - rand() * 20;
      seeds[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(2, dpr) },
      uColor: { value: new THREE.Color("#ffca7a") },
      uFade: { value: 0 },
    }),
    [dpr],
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => () => fireflyGeo.dispose(), [fireflyGeo]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const p = viewState.progress;

    // Проявление сада: до своей зоны он прозрачный, дальше — постоянный
    const raw = Math.min(1, Math.max(0, (p - FADE_IN[0]) / (FADE_IN[1] - FADE_IN[0])));
    const target = raw * raw * (3 - 2 * raw);
    fade.current += (target - fade.current) * Math.min(1, delta * 3);

    if (group.current) {
      // Держим луг на постоянном отступе ниже камеры — он всегда у нижней кромки
      const want = state.camera.position.y - GROUND_OFFSET;
      group.current.position.y += (want - group.current.position.y) * Math.min(1, delta * 5);
      group.current.rotation.y = pointerState.nx * 0.05;
    }

    // Материалы гасим, а не прячем группу: так появление плавное
    const f = fade.current;
    if (stemsMat.current) stemsMat.current.opacity = 0.72 * f;
    if (petalsMat.current) petalsMat.current.opacity = 0.6 * f;
    if (coresMat.current) coresMat.current.opacity = 0.75 * f;
    if (fireflies.current) {
      fireflies.current.uniforms.uTime.value = t;
      fireflies.current.uniforms.uFade.value = f;
    }

    // Пока сад прозрачный — не тратим кадры на матрицы
    if (f < 0.02) return;

    for (let i = 0; i < flowers.length; i++) {
      const flower = flowers[i];
      // Ветер: две синусоиды с разными фазами + порыв от курсора
      const gust =
        Math.sin(t * 0.9 + flower.phase) * 0.16 + Math.sin(t * 0.31 + flower.phase * 2.0) * 0.09;
      const wind = gust + pointerState.nx * 0.08;
      const h = flower.height;
      const leanX = Math.sin(wind) * h;
      const leanY = Math.cos(wind) * h;

      if (stems.current) {
        dummy.position.set(flower.x + leanX * 0.5, flower.ground + leanY * 0.5, flower.z);
        dummy.rotation.set(0, 0, -wind);
        dummy.scale.set(flower.scale, h, flower.scale);
        dummy.updateMatrix();
        stems.current.setMatrixAt(i, dummy.matrix);
      }

      const headScale = flower.scale * 1.05;
      if (petals.current) {
        dummy.position.set(flower.x + leanX, flower.ground + leanY, flower.z);
        // Венчик развёрнут к камере, наклоняется от ветра, а phase даёт
        // каждому цветку свой поворот — иначе поле выглядит штампованным
        dummy.rotation.set(-Math.PI / 2 + 0.35, wind * 0.5, wind * 0.35 + flower.phase);
        dummy.scale.setScalar(headScale);
        dummy.updateMatrix();
        petals.current.setMatrixAt(i, dummy.matrix);
      }

      if (cores.current) {
        dummy.position.set(flower.x + leanX, flower.ground + leanY + 0.01, flower.z);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.setScalar(headScale * 0.34);
        dummy.updateMatrix();
        cores.current.setMatrixAt(i, dummy.matrix);
      }
    }

    if (stems.current) stems.current.instanceMatrix.needsUpdate = true;
    if (petals.current) petals.current.instanceMatrix.needsUpdate = true;
    if (cores.current) cores.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={group} position={[0, -58, 0]}>
      {/* Стебли */}
      <instancedMesh ref={stems} args={[undefined, undefined, count]} frustumCulled={false}>
        <cylinderGeometry args={[0.010, 0.020, 1, 4, 1, true]} />
        <meshBasicMaterial
          ref={stemsMat}
          color="#2a5140"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </instancedMesh>

      {/* Венчики: плоские пятиугольники, читаются как стилизованные цветы */}
      <instancedMesh ref={petals} args={[undefined, undefined, count]} frustumCulled={false}>
        <circleGeometry args={[0.11, PETAL_COUNT]} />
        <meshBasicMaterial
          ref={petalsMat}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </instancedMesh>

      {/* Сердцевина */}
      <instancedMesh ref={cores} args={[undefined, undefined, count]} frustumCulled={false}>
        <circleGeometry args={[0.035, 6]} />
        <meshBasicMaterial
          ref={coresMat}
          color="#ffd9a0"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </instancedMesh>

      {/* Светлячки */}
      <points geometry={fireflyGeo} frustumCulled={false}>
        <shaderMaterial
          ref={fireflies}
          uniforms={uniforms}
          vertexShader={fireflyVertex}
          fragmentShader={fireflyFragment}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
