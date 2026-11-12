import { RefObject, useEffect, useRef, useState } from 'react';

/** True while `ref` is within `margin` of the viewport. Used to pause offscreen WebGL canvases. */
export function useInView(ref: RefObject<Element>, margin = '100% 0px'): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  return inView;
}

export interface PointerState {
  /** NDC relative to the element, -1..1, y up */
  x: number;
  y: number;
  /** 0..1 relative to the element, y down */
  u: number;
  v: number;
  /** NDC velocity per frame-ish, decays */
  vx: number;
  vy: number;
  inside: boolean;
  lastMove: number;
  moved: boolean;
}

/** Tracks the pointer relative to an element via window listeners so overlays never block it. */
export function useElementPointer(ref: RefObject<HTMLElement>) {
  const state = useRef<PointerState>({
    x: 0, y: 0, u: 0.5, v: 0.5, vx: 0, vy: 0, inside: false, lastMove: -1e9, moved: false,
  });
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width;
      const v = (e.clientY - r.top) / r.height;
      const s = state.current;
      s.inside = u >= 0 && u <= 1 && v >= 0 && v <= 1;
      const nx = u * 2 - 1;
      const ny = -(v * 2 - 1);
      s.vx = nx - s.x;
      s.vy = ny - s.y;
      s.x = nx; s.y = ny; s.u = u; s.v = v;
      s.lastMove = performance.now();
      s.moved = true;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [ref]);
  return state;
}

/** Magnetic hover pull for a DOM element (GSAP quickTo). */
export function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v));
}
