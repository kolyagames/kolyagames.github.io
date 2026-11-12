import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(ScrollTrigger, Flip);

let lenis: Lenis | null = null;

export function initSmoothScroll(): () => void {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  const tick = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return () => {
    gsap.ticker.remove(tick);
    lenis?.destroy();
    lenis = null;
  };
}

export function getLenis(): Lenis | null {
  return lenis;
}

export function scrollToTarget(target: string | number | HTMLElement, offset = 0) {
  if (lenis) lenis.scrollTo(target as never, { offset, duration: 1.6, easing: (t: number) => 1 - Math.pow(1 - t, 4) });
  else if (typeof target === 'string') document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
}

export { gsap, ScrollTrigger, Flip };
