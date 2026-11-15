"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { pointerState } from "@/lib/store";
import { smoothstep, worldState } from "@/scene/timeline";
import { readingInfluence } from "@/scene/reading-zones";
import { asciiSources } from "@/scene/ascii-sources";
import { asciiEvents } from "@/scene/ascii-events";
import { gardenState } from "@/scene/garden-state";
import { hashString, mulberry32 } from "@/lib/ascii";
import { diagnosticFrame, eventTime, frozen, sceneTime } from "@/scene/diagnostics";
import {
  flowerVertex, flowerFragment, foliageVertex, foliageFragment,
  flowerCoreVertex, flowerCoreFragment,
  gardenVisibilityFragment,
} from "../shaders/flowers";

const fireflyVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uFade;
  uniform float uAspect;
  varying float vGlow;
  varying vec4 vGardenClip;
  void main() {
    float s = aSeed * 6.2831853;
    float t = uTime * (0.22 + 0.09 * aSeed);
    vec3 p = position;
    p.x = p.x * uAspect + sin(t + s) * (0.28 + 0.34 * aSeed) + sin(t * 1.73 + s * 2.1) * 0.17;
    p.y += sin(t * 0.79 + s * 1.7) * 0.26 + cos(t * 1.37 + s * 2.3) * 0.1;
    p.z += cos(t * 0.87 + s * 1.3) * 0.42 + sin(t * 1.51 + s) * 0.12;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = min(42.0 * uPixelRatio, max(13.0 * uPixelRatio,
      (19.0 + 13.0 * aSeed) * uPixelRatio * 8.0 / max(2.0, -mv.z)));
    gl_Position = projectionMatrix * mv;
    vGardenClip = gl_Position;
    vGlow = clamp(0.62 + 0.25 * sin(t * 2.27 + s * 5.0)
      + 0.18 * sin(t * 3.91 + s * 1.3), 0.16, 1.0) * uFade;
  }
`;

const fireflyFragment = /* glsl */ `
  ${gardenVisibilityFragment}
  varying float vGlow;
  uniform vec3 uColor;
  void main() {
    float radius = length(gl_PointCoord - 0.5);
    float core = exp(-radius * radius * 650.0);
    float aura = exp(-radius * 9.0) * (1.0 - smoothstep(0.32, 0.5, radius)) * 0.22;
    float a = (core + aura) * vGlow * gardenVisibility();
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor * (1.0 + core * 0.9), a);
  }
`;

export const GARDEN_GROUND_OFFSET = 3.8;
const HALF_FOV = Math.tan(55 * Math.PI / 360);
const FEATURED_X = [0.46, 0.76, 0.38, 0.8];
const FEATURED_HEIGHT = [1.12, 0.88, 0.69, 1.31];
const MOBILE_FEATURED_X = [-0.69, -0.22, 0.23, 0.68];
const MOBILE_FEATURED_HEIGHT = [0.39, 0.33, 0.43, 0.36];
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
  projectIndex: number;
  color: THREE.Color;
}

interface GardenResources {
  coverage: THREE.Group;
  field: THREE.Group;
  flies: THREE.Points;
  flowers: Flower[];
  protections: Float32Array;
  speciesProtections: Float32Array[];
  protectionAttributes: THREE.InstancedBufferAttribute[];
  materials: THREE.ShaderMaterial[];
  geometries: THREE.BufferGeometry[];
  fireflyMaterial: THREE.ShaderMaterial;
  flyPositions: Float32Array;
  flySeeds: Float32Array;
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
  const projects = new Float32Array(flowers.length);
  for (let i = 0; i < flowers.length; i++) {
    const f = flowers[i];
    anchors.set([f.x, f.ground, f.z, f.height], i * 4);
    heads.set([f.radius, f.phase, f.tiltX, f.tiltY], i * 4);
    projects[i] = f.projectIndex;
  }
  geometry.setAttribute("aFlower", new THREE.InstancedBufferAttribute(anchors, 4, false, repeats));
  geometry.setAttribute("aHead", new THREE.InstancedBufferAttribute(heads, 4, false, repeats));
  geometry.setAttribute("aProjectIndex", new THREE.InstancedBufferAttribute(projects, 1, false, repeats));
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
export function Garden({ count = 90 }: { count?: number }) {
  const narrow = useThree((state) => state.size.width <= 768);
  const group = useRef<THREE.Group>(null);
  const resources = useRef<GardenResources | null>(null);
  const fade = useRef(0);
  const flyFade = useRef(0);
  const projected = useRef(new THREE.Vector3());

  useEffect(() => {
    const container = group.current;
    if (!container) return;
    const flowerCount = Math.max(4, Math.round(count));
    // Quality changes remove background plants without relocating the guides.
    const rand = mulberry32(hashString(`garden:night:${narrow}`));
    const flowers: Flower[] = [];
    const bySpecies: Flower[][] = [[], [], []];
    for (let i = 0; i < flowerCount; i++) {
      const featured = i < 4;
      const layer = rand();
      const depth = featured ? 8.6 + i * 0.68
        : layer < 0.24 ? 7.6 + rand() * 2.8 : layer < 0.74 ? 11.2 + rand() * 5.0 : 17.5 + rand() * 7.0;
      const halfHeight = depth * HALF_FOV;
      const species = i % SPECIES.length;
      const spec = SPECIES[species];
      // Keep the four guides on the right; three low plants per five spread
      // across the whole width, with stable positions at either quality level.
      const rightField = featured || (!narrow && (i - 4) % 5 >= 3);
      const normalizedX = featured ? (narrow ? MOBILE_FEATURED_X[i] : FEATURED_X[i])
        : narrow ? (rand() - 0.5) * 2.02 : rightField ? 0.43 + rand() * 0.64
          : -1.03 + ((Math.floor((i - 4) / 5) * 0.61803398875 + (i - 4) % 5 / 3 + rand() * 0.08) % 1) * 2.06;
      const heightRatio = featured ? (narrow ? MOBILE_FEATURED_HEIGHT[i] : FEATURED_HEIGHT[i])
        : narrow ? 0.14 + rand() * 0.22 : rightField ? 0.34 + Math.pow(rand(), 0.75) * 0.93 : 0.20 + rand() * 0.13;
      const flower: Flower = {
        x: normalizedX * halfHeight,
        z: -depth,
        // Projected ground is just below the viewport at EVERY depth, not a
        // flat world-space plane that floats behind the far text rows.
        ground: GARDEN_GROUND_OFFSET - halfHeight * (1.08 + rand() * 0.035),
        height: heightRatio * halfHeight,
        radius: narrow ? (featured ? 0.3 : 0.2) + rand() * 0.085
          : featured ? 0.7 + rand() * 0.07 : !rightField ? 0.32 + rand() * 0.13
            : depth < 11 ? 0.64 + rand() * 0.15 : depth < 17 ? 0.43 + rand() * 0.12 : 0.28 + rand() * 0.08,
        phase: rand() * Math.PI * 2,
        // XY-facing cups: no -PI/2 edge-on rotation.
        tiltX: 0.12 + rand() * 0.43,
        tiltY: (rand() - 0.5) * 0.65,
        species,
        speciesIndex: bySpecies[species].length,
        projectIndex: featured ? i : -1,
        color: new THREE.Color(spec.colors[Math.floor(rand() * spec.colors.length)]),
      };
      flowers.push(flower);
      bySpecies[species].push(flower);
    }

    const root = new THREE.Group();
    const field = new THREE.Group();
    const coverage = new THREE.Group();
    coverage.matrixAutoUpdate = false;
    const coverageScene = new THREE.Scene();
    coverageScene.name = "Garden coverage";
    coverageScene.add(coverage);
    asciiSources.garden = coverageScene;
    root.add(field);
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.ShaderMaterial[] = [];
    const protectionAttributes: THREE.InstancedBufferAttribute[] = [];
    const protections = new Float32Array(flowerCount);
    const speciesProtections = bySpecies.map((list) => new Float32Array(list.length));
    const common = {
      uTime: { value: 0 }, uGrowth: { value: 0 }, uFade: { value: 0 },
      uPointer: { value: 0 }, uAspect: { value: 1 },
      uNarrow: { value: narrow ? 1 : 0 },
      uHighlight: { value: new Float32Array(4) },
      uLanding: { value: new Float32Array(4) },
      uFireflyLights: { value: Array.from({ length: 6 }, () => new THREE.Vector3()) },
      uFireflyGlow: { value: new Float32Array(6) },
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
      // Exact silhouette: same instancing, growth, wind and reading repulsion.
      // Red foliage / green clean cores / blue whole-flower landing coverage
      // share geometry, uniforms and depth.
      const clean = material.fragmentShader === flowerCoreFragment;
      const maskMaterial = new THREE.ShaderMaterial({
        vertexShader: material.vertexShader,
        fragmentShader: `${gardenVisibilityFragment} uniform float uFade; varying float vLanding; void main() {
          float visibility = gardenVisibility();
          if (uFade * visibility < 0.004) discard;
          gl_FragColor = vec4(vec3(${clean ? "0.0, 1.0" : "1.0, 0.0"}, vLanding) * visibility, 1.0);
        }`,
        uniforms: material.uniforms, side: THREE.DoubleSide, toneMapped: false,
        depthWrite: true, depthTest: true,
      });
      materials.push(maskMaterial);
      const maskMesh = new THREE.Mesh(geometry, maskMaterial);
      maskMesh.frustumCulled = false;
      coverage.add(maskMesh);
    };

    const petalBase = makePetalGeometry();
    const stemBase = new THREE.CylinderGeometry(0.016, 0.026, 1, 5, 5, true);
    stemBase.translate(0, 0.5, 0);
    const coreBase = new THREE.SphereGeometry(1, 8, 5);
    geometries.push(petalBase, stemBase, coreBase);
    const stems = instanceGeometry(stemBase, flowers, 1, protections, protectionAttributes);
    stems.setAttribute("aPetal", new THREE.InstancedBufferAttribute(new Float32Array(flowerCount * 4), 4));
    addMesh(stems, makeMaterial(foliageVertex, foliageFragment, {
      uLeaves: { value: 0 }, uDark: { value: new THREE.Color("#18372d") }, uLight: { value: new THREE.Color("#648b79") },
    }));

    const leaves = instanceGeometry(petalBase, flowers, 2, protections, protectionAttributes);
    const leafShapes = new Float32Array(flowerCount * 2 * 4);
    for (let i = 0; i < flowerCount; i++) {
      for (let leaf = 0; leaf < 2; leaf++) {
        leafShapes.set([(leaf ? -1 : 1) * (0.8 + rand() * 0.45),
          (narrow ? 0.26 : 0.45) + rand() * (narrow ? 0.18 : 0.35),
          (narrow ? 0.07 : 0.10) + rand() * 0.055, 0.28 + leaf * 0.28], (i * 2 + leaf) * 4);
      }
    }
    leaves.setAttribute("aPetal", new THREE.InstancedBufferAttribute(leafShapes, 4));
    addMesh(leaves, makeMaterial(foliageVertex, foliageFragment, {
      uLeaves: { value: 1 }, uDark: { value: new THREE.Color("#19372e") }, uLight: { value: new THREE.Color("#729a88") },
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

    const fireflyCount = narrow ? 60 : 84;
    const flyPositions = new Float32Array(fireflyCount * 3);
    const flySeeds = new Float32Array(fireflyCount);
    for (let i = 0; i < fireflyCount; i++) {
      const host = flowers[i % flowers.length];
      flyPositions.set([host.x + (rand() - 0.5) * 0.75,
        host.ground + host.height * (i < 6 ? 1 : 0.35 + rand() * 0.85) + (rand() - 0.5) * 0.4,
        host.z + (rand() - 0.5) * 0.65], i * 3);
      flySeeds[i] = rand();
    }
    const flyGeometry = new THREE.BufferGeometry();
    flyGeometry.setAttribute("position", new THREE.BufferAttribute(flyPositions, 3));
    flyGeometry.setAttribute("aSeed", new THREE.BufferAttribute(flySeeds, 1));
    geometries.push(flyGeometry);
    const fireflyMaterial = new THREE.ShaderMaterial({
      vertexShader: fireflyVertex, fragmentShader: fireflyFragment,
      uniforms: { uTime: common.uTime, uFade: { value: 0 }, uAspect: common.uAspect,
        uNarrow: common.uNarrow, uPixelRatio: { value: 1 }, uColor: { value: new THREE.Color("#ffb74f") } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const flies = new THREE.Points(flyGeometry, fireflyMaterial);
    flies.frustumCulled = false;
    root.add(flies);
    container.add(root);
    resources.current = { field, coverage, flies, flowers, protections, speciesProtections,
      protectionAttributes, geometries, materials, fireflyMaterial, flyPositions, flySeeds };

    return () => {
      resources.current = null;
      if (asciiSources.garden === coverageScene) asciiSources.garden = null;
      gardenState.anchors.fill(0);
      gardenState.screenAnchors.fill(-1);
      container.remove(root);
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      fireflyMaterial.dispose();
    };
  }, [count, narrow]);

  useFrame(diagnosticFrame("Garden", (state, delta) => {
    const r = resources.current;
    const container = group.current;
    if (!r || !container) return;
    const damping = frozen ? 1 : Math.min(1, delta * 5);
    fade.current += (worldState.flowers - fade.current) * damping;
    flyFade.current += (worldState.fireflies - flyFade.current) * damping;
    r.field.visible = fade.current > 0.004 && worldState.growth > 0.004;
    r.coverage.visible = r.field.visible;
    r.flies.visible = flyFade.current > 0.004;
    container.visible = r.field.visible || r.flies.visible;
    // Bounded narrative travel, not a screen pin or a second inertia loop.
    // Perspective makes nearer flowers drift more than distant ones; the
    // continuous offset remains inside the protected low strip on the left.
    const travel = (narrow ? 0.28 : 0.72) * Math.tanh((-worldState.cameraY - 50) * 0.18);
    container.position.y = state.camera.position.y - GARDEN_GROUND_OFFSET + travel;
    container.position.z = state.camera.position.z;
    container.rotation.y = pointerState.nx * 0.012;
    container.updateMatrixWorld();
    r.coverage.matrix.copy(container.matrixWorld);
    r.coverage.matrixWorldNeedsUpdate = true;

    const time = sceneTime(state.clock.elapsedTime);
    const aspect = state.size.width / Math.max(1, state.size.height);
    // Mask materials retain the SAME uniform objects as their visible meshes.
    const uniforms = r.materials[0].uniforms;
    uniforms.uTime.value = time;
    uniforms.uGrowth.value = worldState.growth;
    uniforms.uFade.value = fade.current;
    uniforms.uPointer.value = pointerState.nx;
    uniforms.uAspect.value = aspect;
    const highlight = uniforms.uHighlight.value as Float32Array;
    const landing = uniforms.uLanding.value as Float32Array;
    const now = eventTime();
    const highlightDamping = frozen ? 1 : 1 - Math.exp(-delta * 8);
    for (let i = 0; i < 4; i++) {
      highlight[i] += ((gardenState.active === i ? 1 : 0) - highlight[i]) * highlightDamping;
      const age = now - asciiEvents.flowerBorn[i];
      landing[i] = age >= 0 ? 1 - smoothstep(2, 2.8, age) : 0;
    }
    if (r.flies.visible) {
      r.fireflyMaterial.uniforms.uFade.value = flyFade.current;
      r.fireflyMaterial.uniforms.uPixelRatio.value = Math.min(2, state.viewport.dpr);
    }

    // Six actual fireflies light the petals. Motion and intensity match the
    // point vertex shader exactly; vectors/typed arrays are allocated once.
    const lights = uniforms.uFireflyLights.value as THREE.Vector3[];
    const glow = uniforms.uFireflyGlow.value as Float32Array;
    for (let i = 0; i < lights.length; i++) {
      const seed = r.flySeeds[i];
      const s = seed * 6.2831853;
      const t = time * (0.22 + 0.09 * seed);
      const offset = i * 3;
      lights[i].set(
        r.flyPositions[offset] * aspect + Math.sin(t + s) * (0.28 + 0.34 * seed) + Math.sin(t * 1.73 + s * 2.1) * 0.17,
        r.flyPositions[offset + 1] + Math.sin(t * 0.79 + s * 1.7) * 0.26 + Math.cos(t * 1.37 + s * 2.3) * 0.1,
        r.flyPositions[offset + 2] + Math.cos(t * 0.87 + s * 1.3) * 0.42 + Math.sin(t * 1.51 + s) * 0.12,
      ).applyMatrix4(container.matrixWorld).applyMatrix4(state.camera.matrixWorldInverse);
      glow[i] = Math.max(0.16, Math.min(1,
        0.62 + 0.25 * Math.sin(t * 2.27 + s * 5) + 0.18 * Math.sin(t * 3.91 + s * 1.3))) * flyFade.current;
    }

    // One projection and two scalar writes per flower, never per-petal matrices.
    // Even dormant worlds publish the four anchors after camera transforms;
    // butterflies run at priority 0 and never read a stale previous frame.
    const visibleCount = r.field.visible ? r.flowers.length : Math.min(4, r.flowers.length);
    for (let i = 0; i < visibleCount; i++) {
      const flower = r.flowers[i];
      // Match plantGrowth(): background flowers unfurl with a small stagger;
      // featured cores retain their original growth/guide timing.
      const growth = flower.projectIndex >= 0 ? worldState.growth
        : smoothstep(0.04 + 0.14 * (0.5 + 0.5 * Math.sin(flower.phase)), 1, worldState.growth);
      const h = flower.height * growth;
      const wind = Math.sin(time * 0.72 + flower.phase) * 0.06
        + Math.sin(time * 0.27 + flower.phase * 1.7) * 0.03 + pointerState.nx * 0.02;
      projected.current.set(flower.x * aspect + wind * h, flower.ground + h,
        flower.z + Math.sin(time * 0.43 + flower.phase) * h * 0.035);
      projected.current.applyMatrix4(container.matrixWorld).project(state.camera);
      const protection = r.field.visible
        ? readingInfluence(projected.current.x * 0.5 + 0.5, projected.current.y * 0.5 + 0.5) : 0;
      r.protections[i] = protection;
      r.speciesProtections[flower.species][flower.speciesIndex] = protection;
      if (i < 4) {
        // turnHead(vec3(0, 0, .085)) is the core's real exposed center, not
        // a guessed point on the stalk. Include growth, tilt and repulsion.
        const tilt = flower.tiltX + wind * 0.45;
        const coreZ = 0.085 * flower.radius * growth * (1 - protection * 0.22);
        const tiltedZ = Math.cos(tilt) * coreZ;
        projected.current.set(
          flower.x * aspect + wind * h - Math.sin(flower.tiltY) * tiltedZ,
          flower.ground + h - Math.sin(tilt) * coreZ,
          flower.z + Math.sin(time * 0.43 + flower.phase) * h * 0.035 + Math.cos(flower.tiltY) * tiltedZ,
        ).applyMatrix4(container.matrixWorld);
        const worldOffset = i * 3;
        gardenState.anchors[worldOffset] = projected.current.x;
        gardenState.anchors[worldOffset + 1] = projected.current.y;
        gardenState.anchors[worldOffset + 2] = projected.current.z;
        projected.current.project(state.camera);
        const screenOffset = i * 2;
        gardenState.screenAnchors[screenOffset] = (projected.current.x * 0.5 + 0.5) * state.size.width;
        gardenState.screenAnchors[screenOffset + 1] = (0.5 - projected.current.y * 0.5) * state.size.height;
      }
    }
    if (r.field.visible) uploadProtections(r.protectionAttributes);
  }), -1);

  return <group ref={group} position={[0, -58, 0]} dispose={null} />;
}
