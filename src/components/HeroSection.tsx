import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import HeroPoolScene from '../scenes/HeroPoolScene';
import { useElementPointer, useInView } from '../lib/hooks';
import { gsap, ScrollTrigger, scrollToTarget } from '../lib/smooth';

export default function HeroSection() {
  const wrap = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const cta = useRef<HTMLButtonElement>(null);
  const badge = useRef<HTMLDivElement>(null);
  const transition = useRef(0);
  const pointer = useElementPointer(stage);
  const inView = useInView(stage, '20% 0px');
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  // scroll-driven liquid wave wipe + DOM fade
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const state = { t: 0 };
      gsap.to(state, {
        t: 1,
        ease: 'none',
        onUpdate: () => {
          transition.current = state.t;
        },
        scrollTrigger: {
          trigger: el,
          start: () => `top+=${window.innerHeight * 0.1} top`,
          end: 'bottom bottom',
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });
      gsap.to([overlay.current, badge.current], {
        opacity: 0,
        y: -36,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          end: () => `+=${window.innerHeight * 0.5}`,
          scrub: true,
          invalidateOnRefresh: true,
        },
      });
    }, el);
    return () => ctx.revert();
  }, []);

  // magnetic CTA
  useEffect(() => {
    const b = cta.current;
    if (!b) return;
    const qx = gsap.quickTo(b, 'x', { duration: 0.5, ease: 'power3.out' });
    const qy = gsap.quickTo(b, 'y', { duration: 0.5, ease: 'power3.out' });
    const move = (e: PointerEvent) => {
      const r = b.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      if (d < 120) {
        qx(dx * 0.35);
        qy(dy * 0.35);
      } else {
        qx(0);
        qy(0);
      }
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 400);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <section ref={wrap} id="top" className="relative h-[230vh]">
      <div ref={stage} className={`sticky top-0 h-screen w-full overflow-hidden bg-[#EBD0C9] ${ready ? 'gl-live' : ''}`}>
        <Canvas
          shadows
          flat
          dpr={[1, 1.75]}
          frameloop={inView ? 'always' : 'never'}
          camera={{ fov: 35, near: 0.1, far: 60, position: [0, 1.4, 7.5] }}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <HeroPoolScene transition={transition} pointer={pointer} textContainer={stage} onReady={onReady} />
        </Canvas>

        <div
          ref={overlay}
          className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center"
        >
          <p data-gl-text data-gl-color="#44403C" className="mb-4 text-[10px] uppercase tracking-[0.25em] text-[#44403C]">
            Creative Developer, Modder &amp; System Architect
          </p>
          <h1
            className="font-sans leading-[0.95] tracking-[-0.03em] text-[#18181B]"
            style={{ fontSize: 'clamp(3.5rem, 7.5vw, 6.8rem)' }}
          >
            <span data-gl-text data-gl-color="#18181B" className="block font-light">
              Creating the
            </span>
            <span data-gl-text data-gl-color="#18181B" className="block font-serif font-normal italic tracking-[-0.02em]">
              unexpected
            </span>
          </h1>
          <button
            ref={cta}
            type="button"
            onClick={() => scrollToTarget('#projects')}
            className="pointer-events-auto mt-8 text-xs font-medium text-[#18181B]"
          >
            Explore work ›
          </button>
        </div>

        <div ref={badge} className="pointer-events-none absolute bottom-7 left-1/2 z-10 -translate-x-1/2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1c1917]/70 shadow-md backdrop-blur-md">
            <svg className="scroll-arrow" width="10" height="12" viewBox="0 0 10 12" fill="none" stroke="#f5f5f4" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 1v9M1.5 6.8 5 10.3l3.5-3.5" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
