/** One continuous world, sampled without allocations or React renders. */
export interface WorldState {
  hole: number;
  dive: number;
  stars: number;
  streak: number;
  rain: number;
  growth: number;
  flowers: number;
  fireflies: number;
  ascii: number;
  cameraY: number;
  cameraZ: number;
  cameraTilt: number;
  backgroundR: number;
  backgroundG: number;
  backgroundB: number;
}

interface Keyframe { at: number; state: WorldState }

export function smoothstep(a: number, b: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - a) / Math.max(0.00001, b - a)));
  return t * t * (3 - 2 * t);
}

const base: WorldState = {
  hole: 1, dive: 0, stars: 0.24, streak: 0, rain: 0, growth: 0,
  flowers: 0, fireflies: 0, ascii: 0.35,
  cameraY: 0, cameraZ: 0, cameraTilt: 0,
  // Linear RGB: #050507, not an sRGB value accidentally tone-mapped twice.
  backgroundR: 0.001518, backgroundG: 0.001518, backgroundB: 0.002125,
};

function frame(at: number, values: Partial<WorldState>): Keyframe {
  return { at, state: { ...base, ...values } };
}

/** Scroll keys are calibrated to actual section positions after layout/fonts. */
export const timeline: Keyframe[] = [
  frame(0, {}),
  frame(0.08, { dive: 0.2, stars: 0.16, cameraY: -5, cameraTilt: 0.015 }),
  frame(0.16, { hole: 0, dive: 1, stars: 0.02, ascii: 0.7, cameraY: -13, cameraZ: -1 }),
  frame(0.23, { hole: 0, dive: 1, stars: 1, ascii: 0.4, cameraY: -22, cameraZ: -1 }),
  frame(0.32, { hole: 0, dive: 1, stars: 0.45, streak: 1, rain: 0.65, ascii: 0.7, cameraY: -28 }),
  frame(0.44, { hole: 0, dive: 1, stars: 0.12, rain: 1, ascii: 0.25, cameraY: -33 }),
  frame(0.68, { hole: 0, dive: 1, stars: 0.08, rain: 0.7, growth: 0.15, flowers: 0.2, ascii: 0.55, cameraY: -42 }),
  frame(0.82, { hole: 0, dive: 1, stars: 0.1, growth: 1, flowers: 1, fireflies: 0.7, ascii: 0.82, cameraY: -50 }),
  frame(0.94, { hole: 0, dive: 1, stars: 0.4, growth: 1, flowers: 0.4, fireflies: 1, ascii: 0.6, cameraY: -56 }),
  frame(1, { hole: 0, dive: 1, stars: 0.7, growth: 1, flowers: 0.08, fireflies: 1, ascii: 0.4, cameraY: -58 }),
];

const fields = Object.keys(base) as Array<keyof WorldState>;
export const worldState: WorldState = { ...base };

export function sampleTimeline(progress: number, output: WorldState = worldState): WorldState {
  const p = Math.max(0, Math.min(1, progress));
  let index = 0;
  while (index < timeline.length - 2 && p > timeline[index + 1].at) index++;
  const a = timeline[index];
  const b = timeline[index + 1];
  const t = smoothstep(a.at, b.at, p);
  for (let i = 0; i < fields.length; i++) {
    const key = fields[i];
    output[key] = a.state[key] + (b.state[key] - a.state[key]) * t;
  }
  return output;
}

/** Keep the same narrative on a short desktop and a long mobile project list. */
export function calibrateTimeline(): void {
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const sectionProgress = (id: string, viewportOffset: number) => {
    const element = document.getElementById(id);
    const top = element ? element.getBoundingClientRect().top + window.scrollY : 0;
    return Math.max(0, Math.min(1, (top - window.innerHeight * viewportOffset) / max));
  };
  const stack = sectionProgress("stack", 0.2);
  const projects = sectionProgress("projects", 0.2);
  const garden = sectionProgress("garden", 0.2);
  // The footer begins its fade when it ENTERS the viewport, not when its
  // short block reaches 20% (which can clamp its key to exactly 1).
  const footer = Math.min(
    garden + (1 - garden) * 0.9,
    Math.max(sectionProgress("colophon", 1), garden + (1 - garden) * 0.35),
  );
  if (!(stack > 0 && projects > stack && garden > projects && footer > garden)) return;
  const keys = [
    0, stack * 0.35, stack * 0.72, stack,
    stack + (projects - stack) * 0.65, projects,
    garden - (garden - projects) * 0.1, garden,
    footer, 1,
  ];
  for (let i = 0; i < timeline.length; i++) timeline[i].at = keys[i];
}
