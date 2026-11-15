"use client";

import { useEffect, useRef } from "react";
import styles from "./hero.module.css";

type Glyph = { x: number; y: number; width: number; height: number; pixels: Uint8ClampedArray };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const PAD = 32;

export function HeroTitle() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const title = titleRef.current;
    const canvas = canvasRef.current;
    if (!title || !canvas) return;
    const context = canvas.getContext("2d");
    const scratch = document.createElement("canvas");
    const mask = scratch.getContext("2d", { willReadFrequently: true });
    if (!context || !mask) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    const particles = Array.from({ length: 32 }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, duration: 0 }));
    let glyphs: Glyph[] = [];
    let bounds = title.getBoundingClientRect();
    let width = 0, height = 0, radius = 46;
    let x = 0, y = 0, clientX = 0, clientY = 0;
    let frame = 0, last = 0, emitted = 0, strength = 0;
    let hovered = false, visible = false, disposed = false, fontsReady = false, dirty = true;
    const allowed = () => !disposed && visible && !document.hidden && fine.matches && !motion.matches && !connection?.saveData;

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = last = strength = 0;
      hovered = false;
      for (const particle of particles) particle.life = 0;
      context.clearRect(0, 0, width, height);
    };

    // Read glyph geometry and raster alpha only on settled layout/font changes.
    const rebuild = () => {
      dirty = true;
      if (!allowed() || !fontsReady || title.getAnimations({ subtree: true }).some((animation) => animation.playState === "running" || animation.pending)) return;
      stop();
      bounds = title.getBoundingClientRect();
      width = bounds.width + PAD * 2;
      height = bounds.height + PAD * 2;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      glyphs = Array.from(title.querySelectorAll<HTMLElement>("[data-title-letter]")).map((letter) => {
        const box = letter.getBoundingClientRect();
        const font = getComputedStyle(letter);
        const size = parseFloat(font.fontSize);
        const pad = Math.ceil(size * 0.12);
        radius = Math.max(22, Math.min(46, size * 0.34));
        scratch.width = Math.ceil(box.width) + pad * 2;
        scratch.height = Math.ceil(box.height) + pad * 2;
        mask.font = `${font.fontStyle} ${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;
        mask.textBaseline = "alphabetic";
        mask.fillStyle = "#fff";
        const text = letter.textContent || "";
        const metrics = mask.measureText(text);
        const ascent = metrics.fontBoundingBoxAscent || size * 0.8;
        const descent = metrics.fontBoundingBoxDescent || size * 0.2;
        mask.fillText(text, pad, pad + (box.height - ascent - descent) / 2 + ascent);
        return { x: box.left - bounds.left + PAD - pad, y: box.top - bounds.top + PAD - pad,
          width: scratch.width, height: scratch.height,
          pixels: mask.getImageData(0, 0, scratch.width, scratch.height).data };
      });
      dirty = false;
    };

    const alphaAt = (px: number, py: number) => {
      for (const glyph of glyphs) {
        const gx = Math.floor(px - glyph.x), gy = Math.floor(py - glyph.y);
        if (gx >= 0 && gy >= 0 && gx < glyph.width && gy < glyph.height && glyph.pixels[(gy * glyph.width + gx) * 4 + 3] > 180) return true;
      }
      return false;
    };

    const draw = (now: number) => {
      frame = 0;
      if (!allowed()) { stop(); return; }
      const elapsed = (now - (last || now - 16.7)) / 1000;
      const dt = Math.min(0.04, elapsed);
      last = now;
      strength = hovered ? Math.min(1, strength + elapsed * 8) : Math.max(0, strength - elapsed * 4.5);
      context.clearRect(0, 0, width, height);
      // Visible Bayer voids/tints stay local to glyph strokes, not the sky.
      for (const glyph of glyphs) {
        if (!strength || x + radius < glyph.x || x - radius > glyph.x + glyph.width || y + radius < glyph.y || y - radius > glyph.y + glyph.height) continue;
        const left = Math.max(0, Math.floor((x - radius - glyph.x) / 3) * 3);
        const top = Math.max(0, Math.floor((y - radius - glyph.y) / 3) * 3);
        const right = Math.min(glyph.width, x + radius - glyph.x);
        const bottom = Math.min(glyph.height, y + radius - glyph.y);
        for (let gy = top; gy < bottom; gy += 3) {
          for (let gx = left; gx < right; gx += 3) {
            if (glyph.pixels[(gy * glyph.width + gx) * 4 + 3] < 180) continue;
            const amount = Math.max(0, 1 - Math.hypot(glyph.x + gx - x, glyph.y + gy - y) / radius) * strength;
            const threshold = BAYER[((gy / 3) & 3) * 4 + ((gx / 3) & 3)];
            if (threshold / 16 > amount * 0.95) continue;
            context.globalAlpha = Math.min(1, amount * 1.6);
            context.fillStyle = threshold % 3 === 0 ? "#b7a3ff" : "#080610";
            context.fillRect(glyph.x + gx, glyph.y + gy, 2.6, 2.6);
          }
        }
      }
      let active = 0;
      context.fillStyle = "#b7a3ff";
      for (const particle of particles) {
        if (particle.life <= 0) continue;
        particle.life = Math.max(0, particle.life - elapsed);
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy -= 8 * dt;
        context.globalAlpha = (particle.life / particle.duration) * 0.9;
        context.fillRect(particle.x, particle.y, 2.3, 2.3);
        if (particle.life > 0) active++;
      }
      if (hovered && strength > 0.35 && active < 10 && now - emitted > 65) {
        emitted = now;
        for (let attempt = 0; attempt < 8; attempt++) {
          const angle = Math.random() * Math.PI * 2;
          const distance = Math.random() * radius;
          const px = x + Math.cos(angle) * distance, py = y + Math.sin(angle) * distance;
          if (!alphaAt(px, py)) continue;
          const particle = particles.find((item) => item.life <= 0)!;
          particle.x = px; particle.y = py;
          particle.vx = Math.cos(angle) * 14;
          particle.vy = Math.sin(angle) * 10 - 12;
          particle.life = particle.duration = 0.42 + Math.random() * 0.2;
          active++;
          break;
        }
      }
      context.globalAlpha = 1;
      if (hovered || strength > 0 || active > 0) frame = requestAnimationFrame(draw);
      else last = 0;
    };

    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !allowed() || !glyphs.length) return;
      clientX = event.clientX; clientY = event.clientY;
      x = clientX - bounds.left + PAD; y = clientY - bounds.top + PAD;
      hovered = true;
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const enter = (event: PointerEvent) => { bounds = title.getBoundingClientRect(); move(event); };
    const leave = () => { hovered = false; };
    const scroll = () => {
      if (!hovered || !allowed()) return;
      bounds = title.getBoundingClientRect();
      x = clientX - bounds.left + PAD; y = clientY - bounds.top + PAD;
      if (clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) leave();
    };
    const sync = () => {
      if (!allowed()) { stop(); return; }
      bounds = title.getBoundingClientRect();
      if (dirty) rebuild();
    };
    const resize = new ResizeObserver(rebuild);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    resize.observe(title);
    intersection.observe(title);
    title.addEventListener("pointerenter", enter);
    title.addEventListener("pointermove", move);
    title.addEventListener("pointerleave", leave);
    title.addEventListener("pointercancel", stop);
    title.addEventListener("animationend", rebuild);
    window.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("visibilitychange", sync);
    document.fonts.addEventListener("loadingdone", rebuild);
    motion.addEventListener("change", sync);
    fine.addEventListener("change", sync);
    connection?.addEventListener("change", sync);
    void document.fonts.ready.then(() => { if (!disposed) { fontsReady = true; rebuild(); } });

    return () => {
      disposed = true;
      stop();
      resize.disconnect();
      intersection.disconnect();
      title.removeEventListener("pointerenter", enter);
      title.removeEventListener("pointermove", move);
      title.removeEventListener("pointerleave", leave);
      title.removeEventListener("pointercancel", stop);
      title.removeEventListener("animationend", rebuild);
      window.removeEventListener("scroll", scroll);
      document.removeEventListener("visibilitychange", sync);
      document.fonts.removeEventListener("loadingdone", rebuild);
      motion.removeEventListener("change", sync);
      fine.removeEventListener("change", sync);
      connection?.removeEventListener("change", sync);
      glyphs = [];
      particles.length = 0;
      scratch.width = scratch.height = 0;
      canvas.width = canvas.height = 0;
    };
  }, []);

  return (
    <h1
      ref={titleRef}
      id="hero-title"
      data-reading="display"
      className={`${styles.title} font-display text-[clamp(2.9rem,9.4vw,8.4rem)] font-light leading-[0.92] tracking-[-0.045em] text-white`}
    >
      <span className="sr-only">KINGRANE</span>
      <span aria-hidden className="inline-flex">
        {Array.from("KINGRANE").map((letter, index) => (
          <span key={index} className="inline-block overflow-hidden pb-[0.08em] -mb-[0.08em]">
            <span data-title-letter className={styles.letter} style={{ animationDelay: `${index * 45}ms` }}>
              {letter}
            </span>
          </span>
        ))}
      </span>
      <canvas ref={canvasRef} aria-hidden className={styles.titleCanvas} />
    </h1>
  );
}
