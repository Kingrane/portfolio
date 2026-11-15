"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { pointerState } from "@/lib/store";
import { worldState } from "@/scene/timeline";
import { readingInfluence } from "@/scene/reading-zones";
import { hashString, mulberry32 } from "@/lib/ascii";
import {
  flowerVertex, flowerFragment, foliageVertex, foliageFragment,
  flowerCoreVertex, flowerCoreFragment,
} from "../shaders/flowers";

const fireflyVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uFade;
  varying float vGlow;
  void main() {
    float s = aSeed * 6.28;
    vec3 p = position;
    p.x += sin(uTime * 0.35 + s) * 1.1;
    p.y += sin(uTime * 0.28 + s * 1.7) * 0.6;
    p.z += cos(uTime * 0.31 + s * 1.3) * 0.8;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = min(7.0 * uPixelRatio,
      (1.4 + sin(uTime * 2.0 + s * 3.0) * 0.6) * uPixelRatio * 26.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
    vGlow = (0.3 + 0.7 * (0.5 + 0.5 * sin(uTime * 1.6 + s * 5.0))) * uFade;
  }
`;

const fireflyFragment = /* glsl */ `
  varying float vGlow;
  uniform vec3 uColor;
  void main() {
    float a = pow(1.0 - smoothstep(0.0, 0.5, length(gl_PointCoord - 0.5)), 1.6) * vGlow;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

const GROUND_OFFSET = 3.8;
const HALF_FOV = Math.tan(55 * Math.PI / 360);
const SPECIES = [
  { petals: 5, colors: ["#9b78ef", "#b99aff", "#7961db"], throat: "#493078", tip: "#dbc7ff", width: 0.47, cup: 0.27 },
  { petals: 7, colors: ["#e66aa8", "#f598c0", "#c8468c"], throat: "#91365f", tip: "#ffd5e9", width: 0.34, cup: 0.13 },
  { petals: 8, colors: ["#f5eee1", "#fffbf2", "#dce6ed"], throat: "#bba87c", tip: "#fff8e8", width: 0.22, cup: 0.09 },
] as const;

interface Flower {
  x: number;
  z: number;
  ground: number;
  height: number;
  radius: number;
  phase: number;
  tiltX: number;
  tiltY: number;
  species: number;
  speciesIndex: number;
  color: THREE.Color;
}

interface GardenResources {
  field: THREE.Group;
  flies: THREE.Points;
  flowers: Flower[];
  protections: Float32Array;
  speciesProtections: Float32Array[];
  protectionAttributes: THREE.InstancedBufferAttribute[];
  materials: THREE.ShaderMaterial[];
  geometries: THREE.BufferGeometry[];
  fireflyMaterial: THREE.ShaderMaterial;
}

/** Thirty vertices: rounded outline and a real, subdivided cup, not a disk. */
function makePetalGeometry() {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= 5; row++) {
    const t = row / 5;
    for (let column = 0; column <= 4; column++) {
      const x = column / 2 - 1;
      positions.push(x, t, t * t * 0.12 + x * x * Math.sin(t * Math.PI) * 0.07);
      uvs.push(column / 4, t);
      if (row < 5 && column < 4) {
        const a = row * 5 + column;
        indices.push(a, a + 1, a + 5, a + 1, a + 6, a + 5);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function instanceGeometry(base: THREE.BufferGeometry, flowers: Flower[], repeats: number,
  protections: Float32Array, protectionAttributes: THREE.InstancedBufferAttribute[]) {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  for (const name of Object.keys(base.attributes)) geometry.setAttribute(name, base.attributes[name]);
  const anchors = new Float32Array(flowers.length * 4);
  const heads = new Float32Array(flowers.length * 4);
  for (let i = 0; i < flowers.length; i++) {
    const f = flowers[i];
    anchors.set([f.x, f.ground, f.z, f.height], i * 4);
    heads.set([f.radius, f.phase, f.tiltX, f.tiltY], i * 4);
  }
  geometry.setAttribute("aFlower", new THREE.InstancedBufferAttribute(anchors, 4, false, repeats));
  geometry.setAttribute("aHead", new THREE.InstancedBufferAttribute(heads, 4, false, repeats));
  const protection = new THREE.InstancedBufferAttribute(protections, 1, false, repeats);
  protection.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aProtection", protection);
  protectionAttributes.push(protection);
  geometry.instanceCount = flowers.length * repeats;
  return geometry;
}

function uploadProtections(attributes: THREE.InstancedBufferAttribute[]) {
  for (const attribute of attributes) attribute.needsUpdate = true;
}

/** All GPU resources are created anew in the effect, including Strict Mode remounts. */
export function Garden({ count = 360 }: { count?: number }) {
  const group = useRef<THREE.Group>(null);
  const resources = useRef<GardenResources | null>(null);
  const fade = useRef(0);
  const flyFade = useRef(0);
  const projected = useRef(new THREE.Vector3());

  useEffect(() => {
    const container = group.current;
    if (!container) return;
    const rand = mulberry32(hashString(`garden:curved:${count}`));
    const flowers: Flower[] = [];
    const bySpecies: Flower[][] = [[], [], []];
    for (let i = 0; i < count; i++) {
      const hero = i < Math.min(12, count);
      const layer = rand();
      const depth = hero ? 7.8 + rand() * 2.2
        : layer < 0.35 ? 7.6 + rand() * 3.2 : layer < 0.8 ? 10.8 + rand() * 5.2 : 16 + rand() * 8;
      const species = i % SPECIES.length;
      const spec = SPECIES[species];
      const normalizedX = hero ? -0.94 + (i / Math.max(1, Math.min(12, count) - 1)) * 1.88 : (rand() - 0.5) * 2.08;
      const flower: Flower = {
        x: normalizedX * depth * HALF_FOV,
        z: -depth,
        ground: -Math.max(0, depth - 8) * 0.16 + Math.sin(normalizedX * 4.0) * 0.18,
        height: hero ? 1.05 + (i % 4) * 0.82 + rand() * 0.25 : 0.95 + rand() * 3.0,
        radius: hero ? 0.61 + rand() * 0.04 : depth < 11 ? 0.46 + rand() * 0.19 : 0.3 + rand() * 0.24,
        phase: rand() * Math.PI * 2,
        // XY-facing cups: no -PI/2 edge-on rotation.
        tiltX: 0.12 + rand() * 0.43,
        tiltY: (rand() - 0.5) * 0.65,
        species,
        speciesIndex: bySpecies[species].length,
        color: new THREE.Color(spec.colors[Math.floor(rand() * spec.colors.length)]),
      };
      flowers.push(flower);
      bySpecies[species].push(flower);
    }

    const root = new THREE.Group();
    const field = new THREE.Group();
    root.add(field);
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.ShaderMaterial[] = [];
    const protectionAttributes: THREE.InstancedBufferAttribute[] = [];
    const protections = new Float32Array(count);
    const speciesProtections = bySpecies.map((list) => new Float32Array(list.length));
    const common = {
      uTime: { value: 0 }, uGrowth: { value: 0 }, uFade: { value: 0 },
      uPointer: { value: 0 }, uAspect: { value: 1 },
    };
    const makeMaterial = (vertexShader: string, fragmentShader: string,
      extra: Record<string, THREE.IUniform> = {}) => {
      const material = new THREE.ShaderMaterial({
        vertexShader, fragmentShader, uniforms: { ...common, ...extra },
        transparent: true, side: THREE.DoubleSide, forceSinglePass: true,
        depthWrite: true, toneMapped: false,
      });
      materials.push(material);
      return material;
    };
    const addMesh = (geometry: THREE.BufferGeometry, material: THREE.ShaderMaterial) => {
      geometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      field.add(mesh);
    };

    const petalBase = makePetalGeometry();
    const stemBase = new THREE.CylinderGeometry(0.016, 0.026, 1, 5, 5, true);
    stemBase.translate(0, 0.5, 0);
    const coreBase = new THREE.SphereGeometry(1, 8, 5);
    geometries.push(petalBase, stemBase, coreBase);
    const stems = instanceGeometry(stemBase, flowers, 1, protections, protectionAttributes);
    stems.setAttribute("aPetal", new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4));
    addMesh(stems, makeMaterial(foliageVertex, foliageFragment, {
      uLeaves: { value: 0 }, uDark: { value: new THREE.Color("#234535") }, uLight: { value: new THREE.Color("#779568") },
    }));

    const leaves = instanceGeometry(petalBase, flowers, 2, protections, protectionAttributes);
    const leafShapes = new Float32Array(count * 2 * 4);
    for (let i = 0; i < count; i++) {
      for (let leaf = 0; leaf < 2; leaf++) {
        leafShapes.set([(leaf ? -1 : 1) * (0.8 + rand() * 0.45),
          0.45 + rand() * 0.35, 0.10 + rand() * 0.065, 0.28 + leaf * 0.28], (i * 2 + leaf) * 4);
      }
    }
    leaves.setAttribute("aPetal", new THREE.InstancedBufferAttribute(leafShapes, 4));
    addMesh(leaves, makeMaterial(foliageVertex, foliageFragment, {
      uLeaves: { value: 1 }, uDark: { value: new THREE.Color("#244c3a") }, uLight: { value: new THREE.Color("#98b77c") },
    }));

    for (let species = 0; species < SPECIES.length; species++) {
      const spec = SPECIES[species];
      const list = bySpecies[species];
      const geometry = instanceGeometry(petalBase, list, spec.petals, speciesProtections[species], protectionAttributes);
      const shapes = new Float32Array(list.length * spec.petals * 4);
      const colors = new Float32Array(list.length * 3);
      for (let i = 0; i < list.length; i++) {
        list[i].color.toArray(colors, i * 3);
        for (let petal = 0; petal < spec.petals; petal++) {
          // Unequal falls, scalloped cosmos and narrow white ray petals.
          const fall = species === 0 && petal % 2 === 0;
          shapes.set([petal / spec.petals * Math.PI * 2 + (rand() - 0.5) * 0.09,
            (fall ? 0.97 : 0.87) + rand() * 0.08, spec.width * (0.9 + rand() * 0.2),
            spec.cup * (fall ? -0.55 : 1) + rand() * 0.04], (i * spec.petals + petal) * 4);
        }
      }
      geometry.setAttribute("aPetal", new THREE.InstancedBufferAttribute(shapes, 4));
      geometry.setAttribute("aColor", new THREE.InstancedBufferAttribute(colors, 3, false, spec.petals));
      addMesh(geometry, makeMaterial(flowerVertex, flowerFragment, {
        uSpecies: { value: species }, uThroat: { value: new THREE.Color(spec.throat) }, uTip: { value: new THREE.Color(spec.tip) },
        uBeard: { value: new THREE.Color("#f2c569") },
      }));
    }

    addMesh(instanceGeometry(coreBase, flowers, 1, protections, protectionAttributes),
      makeMaterial(flowerCoreVertex, flowerCoreFragment, {
        uDark: { value: new THREE.Color("#855023") }, uLight: { value: new THREE.Color("#ffd16b") },
      }));

    const fireflyCount = Math.min(180, Math.max(60, Math.round(count * 0.5)));
    const flyPositions = new Float32Array(fireflyCount * 3);
    const flySeeds = new Float32Array(fireflyCount);
    for (let i = 0; i < fireflyCount; i++) {
      flyPositions.set([(rand() - 0.5) * 17, 0.8 + rand() * 4.4, -7 - rand() * 12], i * 3);
      flySeeds[i] = rand();
    }
    const flyGeometry = new THREE.BufferGeometry();
    flyGeometry.setAttribute("position", new THREE.BufferAttribute(flyPositions, 3));
    flyGeometry.setAttribute("aSeed", new THREE.BufferAttribute(flySeeds, 1));
    geometries.push(flyGeometry);
    const fireflyMaterial = new THREE.ShaderMaterial({
      vertexShader: fireflyVertex, fragmentShader: fireflyFragment,
      uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uPixelRatio: { value: 1 }, uColor: { value: new THREE.Color("#ffcc80") } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const flies = new THREE.Points(flyGeometry, fireflyMaterial);
    flies.frustumCulled = false;
    root.add(flies);
    container.add(root);
    resources.current = { field, flies, flowers, protections, speciesProtections,
      protectionAttributes, geometries, materials, fireflyMaterial };

    return () => {
      resources.current = null;
      container.remove(root);
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      fireflyMaterial.dispose();
    };
  }, [count]);

  useFrame((state, delta) => {
    const r = resources.current;
    const container = group.current;
    if (!r || !container) return;
    const damping = Math.min(1, delta * 5);
    fade.current += (worldState.flowers - fade.current) * damping;
    flyFade.current += (worldState.fireflies - flyFade.current) * damping;
    r.field.visible = fade.current > 0.004 && worldState.growth > 0.004;
    r.flies.visible = flyFade.current > 0.004;
    container.visible = r.field.visible || r.flies.visible;
    // Camera already has inertia. A second damping here makes the whole field
    // float upward across headings for seconds after a scroll jump.
    container.position.y = state.camera.position.y - GROUND_OFFSET;
    container.position.z = state.camera.position.z;
    container.rotation.y = pointerState.nx * 0.025;
    if (!container.visible) return;
    container.updateMatrixWorld();

    const time = state.clock.elapsedTime;
    if (r.flies.visible) {
      r.fireflyMaterial.uniforms.uTime.value = time;
      r.fireflyMaterial.uniforms.uFade.value = flyFade.current;
      r.fireflyMaterial.uniforms.uPixelRatio.value = Math.min(2, state.viewport.dpr);
    }
    if (!r.field.visible) return;
    const aspect = state.size.width / Math.max(1, state.size.height);
    // Shared uniform objects: update once, not per petal/material.
    const uniforms = r.materials[0].uniforms;
    uniforms.uTime.value = time;
    uniforms.uGrowth.value = worldState.growth;
    uniforms.uFade.value = fade.current;
    uniforms.uPointer.value = pointerState.nx;
    uniforms.uAspect.value = aspect;

    // One projection and two scalar writes per flower, never per-petal matrices.
    for (let i = 0; i < r.flowers.length; i++) {
      const flower = r.flowers[i];
      const h = flower.height * worldState.growth;
      const wind = Math.sin(time * 0.72 + flower.phase) * 0.12
        + Math.sin(time * 0.27 + flower.phase * 1.7) * 0.065 + pointerState.nx * 0.045;
      projected.current.set(flower.x * aspect + wind * h, flower.ground + h,
        flower.z + Math.sin(time * 0.43 + flower.phase) * h * 0.035);
      projected.current.applyMatrix4(container.matrixWorld).project(state.camera);
      const protection = readingInfluence(projected.current.x * 0.5 + 0.5, projected.current.y * 0.5 + 0.5);
      r.protections[i] = protection;
      r.speciesProtections[flower.species][flower.speciesIndex] = protection;
    }
    uploadProtections(r.protectionAttributes);
  });

  return <group ref={group} position={[0, -58, 0]} dispose={null} />;
}
