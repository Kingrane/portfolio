/** CSS pixels, top-left origin. Slot 0 belongs to the pointer; no hover rings. */
export const MAX_ASCII_EMITTERS = 8;
export const asciiSources = {
  emitters: new Float32Array(MAX_ASCII_EMITTERS * 4),
  /** Projected constellation nodes; sampled through one small mask texture. */
  nodes: new Float32Array(32 * 3),
  nodeCount: 0,
  garden: null as Scene | null,
  hole: null as Texture | null,
  cleanStars: null as Texture | null,
};

export function setAsciiEmitter(slot: number, x: number, y: number, radius: number, strength: number): void {
  if (slot < 0 || slot >= MAX_ASCII_EMITTERS) return;
  const n = slot * 4;
  asciiSources.emitters[n] = x;
  asciiSources.emitters[n + 1] = y;
  asciiSources.emitters[n + 2] = Math.max(0, radius);
  asciiSources.emitters[n + 3] = Math.max(0, Math.min(1, strength));
}

export function clearAsciiEmitters(): void { asciiSources.emitters.fill(0); }
import type { Scene, Texture } from "three";
