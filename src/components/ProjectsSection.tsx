import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { CATEGORIES, projects, type ProjectCategory } from '../data/projects';
import ProjectThumb from './ProjectThumb';
import { Flip, gsap, ScrollTrigger } from '../lib/smooth';

type Filter = 'All' | ProjectCategory;

export default function ProjectsSection() {
  const [filter, setFilter] = useState<Filter>('All');
  const grid = useRef<HTMLDivElement>(null);

  // staggered reveal as cards enter the viewport
  useEffect(() => {
    const el = grid.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      ScrollTrigger.batch('.project-card', {
        start: 'top 90%',
        once: true,
        onEnter: (els) =>
          gsap.fromTo(
            els,
            { y: 44, opacity: 0 },
            { y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: 0.09, clearProps: 'transform,opacity' },
          ),
      });
      gsap.set('.project-card', { opacity: 0 });
    }, el);
    return () => ctx.revert();
  }, []);

  const apply = (next: Filter) => {
    if (next === filter) return;
    const state = Flip.getState('.project-card');
    flushSync(() => setFilter(next));
    Flip.from(state, {
      duration: 0.75,
      ease: 'power3.inOut',
      absolute: true,
      stagger: 0.035,
      onEnter: (els) =>
        gsap.fromTo(els, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out', delay: 0.15 }),
      onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.96, duration: 0.4, ease: 'power2.in' }),
    });
    window.setTimeout(() => ScrollTrigger.refresh(), 900);
  };

  return (
    <section id="projects" className="relative pb-24 pt-28">
      <h2 className="text-center text-[48px] font-light leading-none tracking-[-0.03em] text-[#141414]">Selected Projects</h2>

      <div className="mb-14 mt-6 flex flex-wrap justify-center gap-2 px-6" role="tablist" aria-label="Project filters">
        {CATEGORIES.map((c) => {
          const active = c === filter;
          return (
            <button
              key={c}
              role="tab"
              aria-selected={active}
              onClick={() => apply(c)}
              className={`rounded-full border px-4 py-1 text-xs transition-colors duration-300 ${
                active ? 'border-[#141414] text-[#141414]' : 'border-transparent text-[#737373] hover:text-[#141414]'
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      <div ref={grid} className="mx-auto grid max-w-[1160px] grid-cols-1 gap-x-8 gap-y-12 px-6 md:grid-cols-2">
        {projects.map((p, i) => {
          const hidden = filter !== 'All' && p.category !== filter;
          return (
            <article key={p.id} data-flip-id={p.id} className={`project-card ${hidden ? 'is-hidden' : ''}`}>
              <ProjectThumb id={p.id} delay={120 + i * 160} />
              <div className="mt-3">
                <h3 className="text-[15px] font-semibold text-[#141414]">{p.title}</h3>
                <p className="text-[13px] text-[#787878]">{p.subtitle}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
