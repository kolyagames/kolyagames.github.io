import { useEffect, useRef } from 'react';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import ProjectsSection from './components/ProjectsSection';
import GallerySection from './components/GallerySection';
import InkSection from './components/InkSection';
import { gsap, initSmoothScroll, ScrollTrigger } from './lib/smooth';

export default function App() {
  const bg = useRef<HTMLDivElement>(null);
  const spacerIn = useRef<HTMLDivElement>(null);
  const spacerOut = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanup = initSmoothScroll();
    const ctx = gsap.context(() => {
      // Screen 2 -> 3: page background morphs #F3F3F1 -> obsidian #050505
      gsap.fromTo(
        bg.current,
        { backgroundColor: '#F3F3F1' },
        {
          backgroundColor: '#050505',
          ease: 'power2.in',
          immediateRender: false,
          scrollTrigger: { trigger: spacerIn.current, start: 'top 65%', end: 'bottom 45%', scrub: 0.5 },
        },
      );
      // Screen 3 -> 4: back to paper
      gsap.fromTo(
        bg.current,
        { backgroundColor: '#050505' },
        {
          backgroundColor: '#F3F3F1',
          ease: 'power2.inOut',
          immediateRender: false,
          scrollTrigger: { trigger: spacerOut.current, start: 'top 95%', end: 'bottom 60%', scrub: 0.5 },
        },
      );
    });
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener('load', refresh);
    document.fonts?.ready.then(refresh);
    return () => {
      window.removeEventListener('load', refresh);
      ctx.revert();
      cleanup();
    };
  }, []);

  return (
    <>
      <div ref={bg} className="pointer-events-none fixed inset-0 z-0 bg-[#F3F3F1]" aria-hidden />
      <Header />
      <main className="relative z-10">
        <HeroSection />
        <ProjectsSection />
        <div ref={spacerIn} className="h-[55vh]" aria-hidden />
        <GallerySection />
        <div ref={spacerOut} className="h-[55vh]" aria-hidden />
        <InkSection />
      </main>
    </>
  );
}
