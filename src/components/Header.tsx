import { useEffect, useRef } from 'react';
import { ScrollTrigger, scrollToTarget } from '../lib/smooth';

export default function Header() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const stage = document.querySelector('#gallery-stage');
    const play = document.querySelector('#playground');
    if (!stage || !play) return;
    const hide = ScrollTrigger.create({
      trigger: play,
      start: 'top 8%',
      end: 'bottom top',
      onToggle: (self) => {
        if (ref.current) ref.current.dataset.hidden = self.isActive ? 'true' : 'false';
      },
    });
    const st = ScrollTrigger.create({
      trigger: stage,
      start: 'top 6%',
      end: 'bottom 6%',
      onToggle: (self) => {
        if (ref.current) ref.current.dataset.theme = self.isActive ? 'dark' : 'light';
      },
    });
    return () => {
      st.kill();
      hide.kill();
    };
  }, []);

  return (
    <header
      ref={ref}
      data-theme="light"
      className="site-header fixed inset-x-0 top-0 z-50 flex items-start justify-between px-6 pt-6 text-[11px] sm:px-9 sm:pt-7"
    >
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          scrollToTarget(0);
        }}
        className="uppercase tracking-[0.2em]"
      >
        kolyagames
      </a>
      <a
        href="#projects"
        onClick={(e) => {
          e.preventDefault();
          scrollToTarget('#projects');
        }}
      >
        Index
      </a>
    </header>
  );
}
