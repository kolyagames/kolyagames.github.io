# kolyagames — Interactive Portfolio

React 18 · TypeScript · Tailwind · Three.js (R3F + drei) · GSAP ScrollTrigger/Flip · Lenis. Zero external assets (fonts are bundled via npm, all art is procedural).

    npm install
    npm run dev        # http://localhost:5173
    npm run build      # tsc --noEmit && vite build

## Layout
- `src/scenes/HeroPoolScene.tsx` — Screen 1: pastel pool, Reflector water + GLSL, glass lens, WebGL headline, liquid-wipe post pass
- `src/scenes/ObsidianGalleryScene.tsx` — Screen 3: 3D card stage, curl-noise smoke, iridescent glass shards
- `src/scenes/InkPlaygroundScene.tsx` — Screen 4: Navier–Stokes cobalt ink, refractive diamonds, WAKE/DREAM
- `src/shaders/*.ts` — water, transition, smoke, gallery card, thumbnail, fluid, ink composite
- `src/lib/FluidSim.ts` — FBO ping-pong fluid solver
- `src/lib/coverArt.ts` — procedural Canvas2D cover art for the 5 projects
- `src/data/projects.ts` — project data
