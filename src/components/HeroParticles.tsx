"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  a: number;
};

export default function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    const c = canvasRef.current;
    if (!c) return;

    const ctx = c.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let pts: Particle[] = [];
    let raf = 0;
    let running = true;

    function size() {
      if (!c) return;
      const r = c.parentElement!.getBoundingClientRect();
      w = c.width = r.width;
      h = c.height = r.height;
    }

    function init() {
      size();
      const n = Math.min(46, Math.floor(w / 28));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.6 + 0.4,
        vy: -(Math.random() * 0.22 + 0.06),
        vx: (Math.random() - 0.5) * 0.1,
        a: Math.random() * 0.5 + 0.15,
      }));
    }

    function tick() {
      if (!running || !ctx) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.y += p.vy;
        p.x += p.vx;
        if (p.y < -4) {
          p.y = h + 4;
          p.x = Math.random() * w;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(90,200,255,${p.a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    }

    init();
    tick();
    const onResize = () => init();
    addEventListener("resize", onResize, { passive: true });

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="particles"
      className="hero-particles"
      aria-hidden="true"
    />
  );
}
