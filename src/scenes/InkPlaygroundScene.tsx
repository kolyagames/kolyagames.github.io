import { MutableRefObject, RefObject, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  LinearFilter,
  Mesh,
  MeshPhysicalMaterial,
  OctahedronGeometry,
  SRGBColorSpace,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import { FluidSim } from '../lib/FluidSim';
import { inkCompositeShader } from '../shaders/inkComposite';
import { createStudioEnv } from '../lib/env';
import { drawDomTexts, loadFonts } from '../lib/domText';
import { clamp, type PointerState } from '../lib/hooks';

export type InkMode = 'wake' | 'dream';

const COBALT_A = new Color('#1E1B8E');
const COBALT_B = new Color('#312ECB');

/** Absorption colour for a cobalt/ultramarine ink drop (bg * exp(-A) -> cobalt). */
function inkAbsorption(mix: number, amount: number, out: Vector3): Vector3 {
  const c = COBALT_A.clone().lerp(COBALT_B, mix);
  out.set(
    -Math.log(Math.max(c.r, 0.004)) * amount,
    -Math.log(Math.max(c.g, 0.004)) * amount,
    -Math.log(Math.max(c.b, 0.004)) * amount,
  );
  return out;
}

/** Faceted brilliant: lathe profile with 8 segments + flat shading. */
function makeDiamond(): BufferGeometry {
  const pts = [
    [0.0, -0.95], [0.34, -0.5], [0.88, 0.1], [0.92, 0.17], [0.7, 0.33], [0.46, 0.5], [0.0, 0.5],
  ];
  // LatheGeometry import avoided to keep bundle tidy: build manually
  const seg = 8;
  const pos: number[] = [];
  const ring = (r: number, y: number, a: number) => [Math.cos(a) * r, y, Math.sin(a) * r];
  for (let s = 0; s < seg; s++) {
    const a0 = (s / seg) * Math.PI * 2;
    const a1 = ((s + 1) / seg) * Math.PI * 2;
    for (let i = 0; i < pts.length - 1; i++) {
      const [r0, y0] = pts[i];
      const [r1, y1] = pts[i + 1];
      const A = ring(r0, y0, a0), B = ring(r0, y0, a1), C = ring(r1, y1, a0), D = ring(r1, y1, a1);
      if (r0 === 0) pos.push(...A, ...D, ...C);
      else if (r1 === 0) pos.push(...A, ...B, ...C);
      else pos.push(...A, ...D, ...C, ...A, ...B, ...D);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function Diamonds({ modeDream, pointer }: { modeDream: MutableRefObject<number>; pointer: MutableRefObject<PointerState> }) {
  const { gl, viewport } = useThree();
  const env = useMemo(() => createStudioEnv(gl), [gl]);
  const refs = useRef<(Mesh | null)[]>([]);
  const mat = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: '#ffffff',
        transmission: 0.98,
        ior: 2.1,
        thickness: 1.5,
        roughness: 0.0,
        metalness: 0,
        flatShading: true,
        envMap: env,
        envMapIntensity: 1.3,
        specularIntensity: 1,
        dispersion: 0.6,
        side: DoubleSide,
      }),
    [env],
  );
  const geoms = useMemo(() => {
    const d = makeDiamond();
    const o = new OctahedronGeometry(0.85, 0);
    o.scale(0.8, 1.25, 0.8);
    return [d, d, o, d, o];
  }, []);
  // x,y as fractions of the viewport, z depth, size, spin
  const specs = useMemo(
    () => [
      { fx: -0.34, fy: 0.27, z: 0.7, s: 0.98, spin: 0.35, ph: 0.2 },
      { fx: 0.31, fy: 0.3, z: 1.4, s: 0.7, spin: -0.5, ph: 1.7 },
      { fx: 0.04, fy: -0.04, z: -0.4, s: 1.12, spin: 0.28, ph: 3.1 },
      { fx: -0.2, fy: -0.3, z: 1.0, s: 0.62, spin: 0.55, ph: 4.4 },
      { fx: 0.4, fy: -0.22, z: 0.2, s: 0.86, spin: -0.32, ph: 5.2 },
    ],
    [],
  );

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const dream = modeDream.current;
    mat.dispersion = 0.6 + 7.5 * dream; // boosted chromatic dispersion in DREAM
    const P = pointer.current;
    const base = viewport.height * 0.115;
    specs.forEach((sp, i) => {
      const m = refs.current[i];
      if (!m) return;
      m.position.set(
        sp.fx * viewport.width + Math.sin(t * 0.3 + sp.ph) * 0.12 + P.x * 0.18 * (sp.z + 1),
        sp.fy * viewport.height + Math.cos(t * 0.37 + sp.ph) * 0.14 + P.y * 0.12 * (sp.z + 1),
        sp.z,
      );
      m.rotation.y += dt * sp.spin * (1 + dream * 1.6);
      m.rotation.x = Math.sin(t * 0.4 + sp.ph) * 0.32 + 0.18;
      m.rotation.z = Math.cos(t * 0.31 + sp.ph) * 0.18;
      m.scale.setScalar(base * sp.s * (1 + dream * 0.06 * Math.sin(t * 1.4 + sp.ph)));
    });
  });

  return (
    <>
      {specs.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          geometry={geoms[i]}
          material={mat}
          frustumCulled={false}
        />
      ))}
    </>
  );
}

function InkField({
  section,
  modeRef,
  modeDream,
  pointer,
  layoutTick,
  onReady,
}: {
  section: RefObject<HTMLElement>;
  modeRef: MutableRefObject<InkMode>;
  modeDream: MutableRefObject<number>;
  pointer: MutableRefObject<PointerState>;
  layoutTick: number;
  onReady: () => void;
}) {
  const { gl, size } = useThree();
  const fluid = useMemo(() => new FluidSim(gl, 128, 512), [gl]);
  useEffect(() => () => fluid.dispose(), [fluid]);

  const textCanvas = useMemo(() => document.createElement('canvas'), []);
  const textTex = useMemo(() => {
    const t = new CanvasTexture(textCanvas);
    t.colorSpace = SRGBColorSpace;
    t.minFilter = LinearFilter;
    t.generateMipmaps = false;
    return t;
  }, [textCanvas]);

  const mat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          tDye: { value: null },
          tText: { value: textTex },
          uBg: { value: new Color('#F3F3F1') },
          uTime: { value: 0 },
          uDream: { value: 0 },
          uTexel: { value: new Vector2(1 / 512, 1 / 512) },
        },
        vertexShader: inkCompositeShader.vertexShader,
        fragmentShader: inkCompositeShader.fragmentShader,
        depthWrite: false,
      }),
    [textTex],
  );

  const readyOnce = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(async () => {
      await loadFonts();
      const el = section.current;
      if (cancelled || !el) return;
      const dpr = Math.min(gl.getPixelRatio(), 2);
      textCanvas.width = Math.min(4096, Math.round(size.width * dpr));
      textCanvas.height = Math.min(4096, Math.round(size.height * dpr));
      drawDomTexts(el, textCanvas, textCanvas.width / size.width);
      textTex.dispose(); // canvas size may have changed -> re-allocate
      textTex.needsUpdate = true;
      if (!readyOnce.current) {
        readyOnce.current = true;
        onReady();
      }
    }, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [size.width, size.height, layoutTick, gl, section, textCanvas, textTex, onReady]);

  useEffect(() => {
    fluid.resize(size.width / Math.max(1, size.height));
  }, [fluid, size.width, size.height]);

  const st = useRef({
    prevU: -1,
    prevV: -1,
    strokeMix: 0.5,
    strokeT: 0,
    ambientT: 0,
    tmp: new Vector3(),
    seeded: false,
  });

  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30);
    const t = clock.elapsedTime;
    const s = st.current;
    const dreamTarget = modeRef.current === 'dream' ? 1 : 0;
    modeDream.current += (dreamTarget - modeDream.current) * (1 - Math.pow(1 - 0.05, dt * 60));
    const dream = modeDream.current;

    const p = fluid.params;
    p.vorticity = 22 + 38 * dream; // DREAM: stronger vorticity confinement -> more swirl
    p.velocityDissipation = 0.28 - 0.14 * dream;
    p.dyeDissipation = 0.34 - 0.05 * dream;
    p.splatRadius = 0.26 + 0.1 * dream;

    const aspect = size.width / Math.max(1, size.height);
    const FORCE = 6000;

    if (!s.seeded) {
      s.seeded = true;
      for (let i = 0; i < 3; i++) {
        fluid.splat(0.25 + i * 0.25, 0.55, (i - 1) * 90, 40, inkAbsorption(0.2 + i * 0.3, 0.55, s.tmp), 1.6);
      }
    }

    // cursor -> ink bloom
    const P = pointer.current;
    if (P.inside && P.moved) {
      if (s.prevU >= 0) {
        let dx = P.u - s.prevU;
        let dy = -(P.v - s.prevV);
        const speed = Math.hypot(dx, dy);
        if (speed > 0.0002) {
          if (t - s.strokeT > 1.4) {
            s.strokeMix = Math.random();
            s.strokeT = t;
          }
          if (aspect < 1) dx *= aspect;
          if (aspect > 1) dy /= aspect;
          const amount = 0.16 + clamp(speed * 12, 0, 0.34);
          fluid.splat(P.u, 1 - P.v, dx * FORCE, dy * FORCE, inkAbsorption(s.strokeMix, amount, s.tmp));
        }
      }
      s.prevU = P.u;
      s.prevV = P.v;
    } else {
      s.prevU = -1;
    }

    // DREAM: ambient autonomous blooms
    if (dream > 0.2 && t > s.ambientT) {
      s.ambientT = t + 0.55 + Math.random() * 0.4;
      const a = t * 0.7 + Math.random() * 6.28;
      const x = 0.5 + Math.cos(a * 0.9) * 0.38 + (Math.random() - 0.5) * 0.1;
      const y = 0.5 + Math.sin(a * 1.3) * 0.32 + (Math.random() - 0.5) * 0.1;
      const ang = a + Math.PI / 2;
      fluid.splat(x, y, Math.cos(ang) * 1400, Math.sin(ang) * 1400, inkAbsorption(Math.random(), 0.24, s.tmp), 1.3);
    }

    fluid.step(dt);
    mat.uniforms.tDye.value = fluid.texture;
    mat.uniforms.uTime.value = t;
    mat.uniforms.uDream.value = dream;
    mat.uniforms.uTexel.value.copy(fluid.dyeTexelSize);
  });

  return (
    <mesh material={mat} renderOrder={-1} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

function Env() {
  const { scene, gl } = useThree();
  useEffect(() => {
    scene.environment = createStudioEnv(gl);
    return () => {
      scene.environment = null;
    };
  }, [scene, gl]);
  return null;
}

export interface InkPlaygroundProps {
  section: RefObject<HTMLElement>;
  modeRef: MutableRefObject<InkMode>;
  pointer: MutableRefObject<PointerState>;
  layoutTick: number;
  onReady: () => void;
}

export default function InkPlaygroundScene({ section, modeRef, pointer, layoutTick, onReady }: InkPlaygroundProps) {
  const modeDream = useRef(0);
  return (
    <>
      <Env />
      <InkField section={section} modeRef={modeRef} modeDream={modeDream} pointer={pointer} layoutTick={layoutTick} onReady={onReady} />
      <Diamonds modeDream={modeDream} pointer={pointer} />
    </>
  );
}
