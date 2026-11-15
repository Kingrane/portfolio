"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { initializeSceneTuning, resetSceneTuning, sceneTuning } from "@/scene/tuning";
import styles from "./scene-tuner.module.css";

type TuningKey = Exclude<keyof typeof sceneTuning, "enabled" | "full">;

const controls: { key: TuningKey; label: string; min: number; max: number; step: number }[] = [
  { key: "ambient", label: "Микс ASCII", min: 0, max: 1.5, step: 0.05 },
  { key: "gain", label: "Яркость глифов", min: 1.3, max: 1.6, step: 0.05 },
  { key: "glow", label: "Свечение", min: 0, max: 0.25, step: 0.01 },
  { key: "cellDesktop", label: "Ячейка desktop", min: 9, max: 10, step: 0.5 },
  { key: "cellMobile", label: "Ячейка mobile", min: 10, max: 11, step: 0.5 },
  { key: "dither", label: "Dither", min: 0, max: 1, step: 0.05 },
];

// Only the query gate is subscribed; there are no global events or frame updates.
const subscribers = new Set<() => void>();
function subscribe(callback: () => void) {
  subscribers.add(callback);
  return () => { subscribers.delete(callback); };
}
const getEnabled = () => sceneTuning.enabled;
const getServerEnabled = () => false;

function updateTuning(key: TuningKey, value: number) {
  sceneTuning[key] = value;
}

export function SceneTuner() {
  const enabled = useSyncExternalStore(subscribe, getEnabled, getServerEnabled);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(() => ({ ...sceneTuning }));
  const id = useId();

  useEffect(() => {
    initializeSceneTuning();
    subscribers.forEach((notify) => notify());
  }, []);

  useEffect(() => {
    // Reading-zone instrumentation also measures fixed elements on resize.
    if (enabled) window.dispatchEvent(new Event("resize"));
  }, [enabled, open]);

  function update(key: TuningKey, value: number) {
    updateTuning(key, value);
    setValues({ ...sceneTuning });
  }

  function reset() {
    resetSceneTuning();
    setValues({ ...sceneTuning });
  }

  if (!enabled) return null;

  return (
    <aside className={styles.panel} data-tune-panel data-reading-fixed data-reading aria-label="Настройка ASCII">
      <div id={`${id}-controls`} className={styles.controls} hidden={!open}>
        <p className={styles.heading}>DEBUG · ASCII</p>
        {controls.map(({ key, label, min, max, step }) => (
          <div key={key} className={styles.control}>
            <div className={styles.labelRow}>
              <label htmlFor={`${id}-${key}`}>{label}</label>
              <output htmlFor={`${id}-${key}`}>{values[key].toFixed(step === 0.5 ? 1 : 2)}</output>
            </div>
            <input
              id={`${id}-${key}`}
              className={styles.slider}
              type="range"
              min={min}
              max={max}
              step={step}
              value={values[key]}
              onChange={(event) => update(key, event.currentTarget.valueAsNumber)}
            />
          </div>
        ))}
        <button type="button" className={styles.button} onClick={reset}>Сброс</button>
      </div>
      <button
        type="button"
        className={styles.button}
        aria-expanded={open}
        aria-controls={`${id}-controls`}
        onClick={() => setOpen((previous) => !previous)}
      >
        {open ? "Закрыть" : "Настройка ASCII"}
      </button>
    </aside>
  );
}
