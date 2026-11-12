import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import InkPlaygroundScene, { type InkMode } from '../scenes/InkPlaygroundScene';
import { useElementPointer, useInView } from '../lib/hooks';
import { loadFonts } from '../lib/domText';
import { scrollToTarget } from '../lib/smooth';

const CAPABILITIES = ['SHADERS & GLSL', 'CLIENT MODDING', '3D & LUAU SYSTEMS', 'AI AUTOMATION'];

export default function InkSection() {
  const section = useRef<HTMLElement>(null);
  const big = useRef<HTMLHeadingElement>(null);
  const modeRef = useRef<InkMode>('wake');
  const [mode, setMode] = useState<InkMode>('wake');
  const [ready, setReady] = useState(false);
  const [pill, setPill] = useState(false);
  const [tick, setTick] = useState(0);
  const pointer = useElementPointer(section);
  const inView = useInView(section, '30% 0px');
  const onReady = useCallback(() => setReady(true), []);

  const choose = (m: InkMode) => {
    modeRef.current = m;
    setMode(m);
  };

  // pill is "fixed", but only shown while the playground is on screen
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setPill(e.intersectionRatio > 0.4), { threshold: [0, 0.2, 0.4, 0.6, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // fit "for building" to ~95% of the viewport width (never below the spec's 4.5rem floor)
  useEffect(() => {
    const el = big.current;
    if (!el) return;
    let cancelled = false;
    const fit = async () => {
      await loadFonts();
      if (cancelled || !el.parentElement) return;
      const c = document.createElement('canvas').getContext('2d');
      if (!c) return;
      c.font = '700 100px "Inter Variable", Inter, sans-serif';
      (c as unknown as { letterSpacing: string }).letterSpacing = '-4px';
      const w100 = c.measureText('for building').width;
      const avail = el.parentElement.clientWidth;
      const px = Math.max(72, (avail / w100) * 100 * 0.995);
      el.style.fontSize = `${px}px`;
      setTick((n) => n + 1);
    };
    fit();
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(fit, 120);
    };
    let timer = 0;
    window.addEventListener('resize', onResize);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <section ref={section} id="playground" className={`relative min-h-[100svh] overflow-hidden ${ready ? 'gl-live' : ''}`}>
      <div className="absolute inset-0 z-0">
        <Canvas
          flat
          dpr={[1, 1.5]}
          frameloop={inView ? 'always' : 'never'}
          camera={{ fov: 35, near: 0.1, far: 60, position: [0, 0, 10] }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <InkPlaygroundScene section={section} modeRef={modeRef} pointer={pointer} layoutTick={tick} onReady={onReady} />
        </Canvas>
      </div>

      <div className="pointer-events-none relative z-10 flex min-h-[100svh] flex-col px-[2.5vw] pb-28 pt-7">
        <nav className="pointer-events-auto flex gap-8 text-[10px] uppercase tracking-[0.2em] text-[#141414]">
          <a
            href="#projects"
            onClick={(e) => {
              e.preventDefault();
              scrollToTarget('#projects');
            }}
          >
            Work
          </a>
          <a
            href="#playground"
            onClick={(e) => {
              e.preventDefault();
              scrollToTarget('#top');
            }}
          >
            About
          </a>
        </nav>

        <div className="flex flex-1 flex-col justify-center">
          <h2
            ref={big}
            data-gl-text
            data-gl-color="#111111"
            className="whitespace-nowrap text-center font-bold leading-[0.9] tracking-[-0.04em] text-[#111111]"
            style={{ fontSize: 'clamp(4.5rem, 13vw, 12rem)' }}
          >
            for building
          </h2>

          <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-[#666666]">
            <span data-gl-text data-gl-color="#666666">PORTFOLIO V1 // KOLYAGAMES</span>
            <span data-gl-text data-gl-color="#666666">GITHUB.COM/KOLYAGAMES</span>
          </div>

          <ul className="mt-10 font-bold uppercase leading-[1.05] tracking-[-0.04em] text-[#111111]" style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5rem)' }}>
            {CAPABILITIES.map((c) => (
              <li key={c} data-gl-text data-gl-color="#111111">
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div
        className={`fixed bottom-6 left-1/2 z-40 -translate-x-1/2 transition-all duration-500 ${
          pill ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
        }`}
      >
        <div className="flex rounded-full border border-black/10 bg-white/90 p-1 shadow-lg backdrop-blur-md" role="group" aria-label="Mode">
          {(['wake', 'dream'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => choose(m)}
              className={`rounded-full px-5 py-2 text-[11px] font-medium uppercase tracking-[0.18em] transition-colors duration-300 ${
                mode === m ? 'bg-[#111111] text-white' : 'text-[#111111]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
