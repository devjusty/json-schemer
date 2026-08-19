import { useEffect, useLayoutEffect, useRef, useState } from "react";

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const getSlope = (t: number) => (3 * ay * t + 2 * by) * t + cy;

  const tForX = (x: number): number => {
    let t = x;
    for (let i = 0; i < 10; i++) {
      const sx = sampleX(t);
      const slope = getSlope(t);
      if (slope === 0) return t;
      const next = t - (sx - x) / slope;
      if (Math.abs(next - t) < 1e-5) return next;
      t = Math.max(0, Math.min(1, next));
    }
    return t;
  };

  return (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return sampleY(tForX(t));
  };
}

// var(--ease-out) === cubic-bezier(0.23, 1, 0.32, 1) — AUDIT.md strong ease-out
const easeOut = cubicBezier(0.23, 1, 0.32, 1);

const DURATION = 250; // ms; within UI sub-300ms budget

export function NumberTicker({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(display);
  const hasRaf = typeof window !== "undefined" && typeof window.requestAnimationFrame === "function";
  const reduced =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

  useLayoutEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    if (!hasRaf) {
      setDisplay(value);
      return;
    }
    const from = displayRef.current;
    if (from === value) return;

    let start: number | null = null;
    let frameId = 0;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min((ts - start) / DURATION, 1);
      const next = Math.round(easeOut(t) * (value - from) + from);
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        frameId = 0;
      }
    };

    // react-doctor-disable-next-line react-doctor/effect-raf-loop-needs-cancel
    frameId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [value, reduced, hasRaf]);

  return <>{display}</>;
}
