import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { Texture } from 'three';
import ObsidianGalleryScene, { type GalleryProgress } from '../scenes/ObsidianGalleryScene';
import { projects } from '../data/projects';
import { makeGalleryTexture } from '../lib/galleryTexture';
import { loadFonts } from '../lib/domText';
import { useElementPointer, useInView } from '../lib/hooks';
import { getLenis, ScrollTrigger } from '../lib/smooth';

const SCROLL_PER_CARD_VH = 75;

export default function GallerySection() {
  const runway = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const progress = useRef<GalleryProgress>({ p: 0, v: 0 });
  const pointer = useElementPointer(stage);
  const inView = useInView(stage, '60% 0px');
  const [textures, setTextures] = useState<Texture[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    let made: Texture[] = [];
    const t = window.setTimeout(() => {
      loadFonts().then(() => {
        if (!alive) return;
        made = projects.map((p, i) => makeGalleryTexture(p, i, projects.length));
        setTextures(made);
      });
    }, 500);
    return () => {
      alive = false;
      window.clearTimeout(t);
      made.forEach((m) => m.dispose());
    };
  }, []);

  useEffect(() => {
    const el = runway.current;
    if (!el) return;
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        progress.current.p = self.progress;
        progress.current.v = self.getVelocity();
      },
    });
    return () => st.kill();
  }, []);

  // drag the stage horizontally -> drives the same scroll progress
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let down = false;
    let lastX = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return; // touch keeps native vertical scroll
      down = true;
      lastX = e.clientX;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      const dy = -dx * ((SCROLL_PER_CARD_VH / 100) * window.innerHeight) / (window.innerWidth * 0.42);
      const lenis = getLenis();
      if (lenis) lenis.scrollTo(lenis.scroll + dy, { immediate: true });
      else window.scrollBy(0, dy);
    };
    const onUp = (e: PointerEvent) => {
      down = false;
      el.style.cursor = 'grab';
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const n = projects.length;
  return (
    <section id="gallery" aria-label="Featured projects">
      <div ref={runway} style={{ height: `calc(100vh + ${(n - 1) * SCROLL_PER_CARD_VH}vh)` }} className="relative">
        <div id="gallery-stage" ref={stage} className="sticky top-0 h-screen w-full cursor-grab select-none overflow-hidden bg-[#050505]">
          <Canvas
            flat
            dpr={[1, 1.5]}
            frameloop={inView ? 'always' : 'never'}
            camera={{ fov: 32, near: 0.1, far: 60, position: [0, 0, 9] }}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
            style={{ position: 'absolute', inset: 0 }}
          >
            <ObsidianGalleryScene textures={textures} progress={progress} pointer={pointer} onIndex={setIndex} />
          </Canvas>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between px-6 pb-7 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60 sm:px-9">
            <span>
              {String(index + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}
            </span>
            <span className="hidden sm:block">{projects[index]?.title}</span>
            <span>Scroll or drag</span>
          </div>
        </div>
      </div>
    </section>
  );
}
