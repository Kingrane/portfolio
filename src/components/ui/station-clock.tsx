"use client";

import { useEffect, useState } from "react";

/**
 * Живые часы станции: UTC + локальное время браузера.
 * Мелочь, но именно такие детали создают ощущение «интерфейс работает».
 */
export function StationClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")} utc`,
      );
    };
    update();
    const id = window.setInterval(update, 15_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint lg:block">
      {time ?? "--:-- utc"}
    </span>
  );
}
