"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { asciiEvents } from "@/scene/ascii-events";
import { setAsciiEmitter } from "@/scene/ascii-sources";
import { worldState } from "@/scene/timeline";
import { gardenState } from "@/scene/garden-state";

/** Slot 7 is the horizontal scan; slots 3–6 are temporary flower landings. */
export function SceneEvents() {
  const nextScan = useRef(0);
  useEffect(() => {
    nextScan.current = performance.now() * 0.001 + 9;
    asciiEvents.scanBorn = -1000;
    asciiEvents.flowerBorn.fill(-1000);
    const scan = (event: PointerEvent) => {
      if (worldState.hole < 0.4 || document.hidden) return;
      if ((event.target as Element | null)?.closest("a,button,input,select,textarea,[role='button'],[data-tune-panel]")) return;
      const now = performance.now() * 0.001;
      if (now - asciiEvents.scanBorn < 9) return;
      asciiEvents.scanBorn = now;
      nextScan.current = now + 9;
    };
    window.addEventListener("pointerdown", scan, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", scan);
      setAsciiEmitter(7, 0, 0, 0, 0);
      for (let i = 3; i < 7; i++) setAsciiEmitter(i, 0, 0, 0, 0);
    };
  }, []);
  useFrame((state) => {
    if (document.hidden) return;
    const now = performance.now() * 0.001;
    if (worldState.hole > 0.4 && now >= nextScan.current) {
      asciiEvents.scanBorn = now;
      nextScan.current = now + 9;
    }
    const age = now - asciiEvents.scanBorn;
    const active = worldState.hole > 0.1 && age >= 0 && age < 1.2;
    setAsciiEmitter(7, state.size.width * 0.5, state.size.height * (-0.1 + age), state.size.height * 0.075,
      active ? Math.min(1, age * 8, (1.2 - age) * 8) : 0);
    for (let i = 0; i < 4; i++) {
      const age = now - asciiEvents.flowerBorn[i];
      const strength = age >= 0 && age < 2.8 ? Math.min(1, (2.8 - age) / 0.8) * worldState.flowers : 0;
      setAsciiEmitter(3 + i, gardenState.screenAnchors[i * 2], gardenState.screenAnchors[i * 2 + 1], state.size.width <= 768 ? 42 : 68, strength);
    }
  });
  return null;
}
