import { MutableRefObject, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  ShaderMaterial,
  Texture,
  Vector2,
} from 'three';
import { galleryCardShader } from '../shaders/galleryCard';
import { smokeShader } from '../shaders/smoke';
import { createStudioEnv } from '../lib/env';
import { mulberry32 } from '../lib/rng';
import { clamp, type PointerState } from '../lib/hooks';

export interface GalleryProgress {
  p: number;
  v: number;
}

const CARD_W = 5.0;
const CARD_H = 3.125;
const SPACING = 6.5;
const SHARD_COUNT = 15;

function Smoke({ progress, pointer }: { progress: MutableRefObject<GalleryProgress>; pointer: MutableRefObject<PointerState> }) {
  const size = useThree((s) => s.size);
  const mk = (front: boolean) =>
    new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uVel: { value: 0 },
        uAspect: { value: 1 },
        uMouse: { value: new Vector2() },
        uOffset: { value: front ? 7.3 : 0 },
        uStrength: { value: front ? 0.35 : 1.1 },
        uFront: { value: front ? 1 : 0 },
        uC0: { value: new Color('#22D3EE') },
        uC1: { value: new Color('#E879F9') },
        uC2: { value: new Color('#6366F1') },
        uC3: { value: new Color('#F59E0B') },
      },
      vertexShader: smokeShader.vertexShader,
      fragmentShader: smokeShader.fragmentShader,
      blending: AdditiveBlending,
      // The back layer stays in the opaque pass (additive over obsidian) so the glass shards can refract it.
      transparent: front,
      depthTest: false,
      depthWrite: false,
    });
  const back = useMemo(() => mk(false), []); // eslint-disable-line react-hooks/exhaustive-deps
  const front = useMemo(() => mk(true), []); // eslint-disable-line react-hooks/exhaustive-deps
  const vel = useRef(0);
  const mouse = useRef(new Vector2());

  useFrame(({ clock }, dt) => {
    const target = clamp(Math.abs(progress.current.v) / 2600, 0, 1);
    vel.current += (target - vel.current) * (1 - Math.pow(1 - 0.06, dt * 60));
    const P = pointer.current;
    const mv = clamp(Math.hypot(P.vx, P.vy) * 12, 0, 1);
    P.vx *= 0.9;
    P.vy *= 0.9;
    mouse.current.lerp(new Vector2(P.x, P.y), 0.06);
    const v = clamp(vel.current + mv * 0.5, 0, 1.2);
    for (const m of [back, front]) {
      m.uniforms.uTime.value = clock.elapsedTime;
      m.uniforms.uVel.value = v;
      m.uniforms.uAspect.value = size.width / size.height;
      m.uniforms.uMouse.value.copy(mouse.current);
    }
  });

  return (
    <>
      <mesh material={back} renderOrder={-10} frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      <mesh material={front} renderOrder={10} frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
      </mesh>
    </>
  );
}

function Cards({
  textures,
  progress,
  onIndex,
}: {
  textures: Texture[];
  progress: MutableRefObject<GalleryProgress>;
  onIndex: (i: number) => void;
}) {
  const track = useRef<Group>(null);
  const cardRefs = useRef<(Mesh | null)[]>([]);
  const offset = useRef(0);
  const lastIndex = useRef(-1);
  const mats = useMemo(
    () =>
      textures.map(
        (t) =>
          new ShaderMaterial({
            uniforms: {
              uMap: { value: t },
              uActive: { value: 0 },
              uBend: { value: 0 },
              uSplit: { value: 0 },
              uTime: { value: 0 },
            },
            vertexShader: galleryCardShader.vertexShader,
            fragmentShader: galleryCardShader.fragmentShader,
          }),
      ),
    [textures],
  );
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    const nx = 40, ny = 24;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i <= nx; i++) {
        pos.push((i / nx - 0.5) * CARD_W, (j / ny - 0.5) * CARD_H, 0);
        uv.push(i / nx, j / ny);
      }
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }, []);

  const n = textures.length;
  useFrame(({ clock }, dt) => {
    const target = progress.current.p * (n - 1);
    const prev = offset.current;
    offset.current += (target - prev) * (1 - Math.pow(1 - 0.075, dt * 60));
    const o = offset.current;
    const vel = (o - prev) / Math.max(dt, 1 / 120) / 60; // card-units per frame @60fps
    const bend = clamp(vel * 16, -1, 1);
    if (track.current) track.current.position.x = -o * SPACING;
    for (let i = 0; i < n; i++) {
      const m = cardRefs.current[i];
      if (!m) continue;
      const d = Math.abs(i - o);
      const active = 1 - Math.min(1, d);
      const a = active * active * (3 - 2 * active);
      const s = 0.86 + 0.14 * a;
      m.scale.setScalar(s);
      m.position.set(i * SPACING, 0, -Math.min(d, 2) * 0.55);
      const u = mats[i].uniforms;
      u.uActive.value = a;
      u.uBend.value = bend;
      u.uSplit.value = Math.abs(bend) * 1.2;
      u.uTime.value = clock.elapsedTime;
    }
    const idx = Math.round(o);
    if (idx !== lastIndex.current) {
      lastIndex.current = idx;
      onIndex(idx);
    }
  });

  return (
    // slight Y tilt for the whole stage; the inner track slides horizontally
    <group rotation={[0, -0.18, 0]}>
      <group ref={track}>
        {mats.map((m, i) => (
          <mesh
            key={i}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            geometry={geo}
            material={m}
            frustumCulled={false}
          />
        ))}
      </group>
    </group>
  );
}

function makeShard(rng: () => number): BufferGeometry {
  const tris: number[][][] = [];
  const P = (x: number, y: number, z: number) => [x, y, z];
  const jitter = (a: number) => (rng() - 0.5) * a;
  const R = 0.14 + rng() * 0.2;
  const a0 = rng() * Math.PI * 2;
  const base = [0, 1, 2].map((k) => {
    const a = a0 + (k * Math.PI * 2) / 3 + jitter(0.9);
    const r = R * (0.55 + rng() * 0.9);
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  if (rng() < 0.5) {
    // irregular tetrahedron
    const h = 0.4 + rng() * 0.8;
    const A = P(base[0][0], base[0][1], 0), B = P(base[1][0], base[1][1], 0), C = P(base[2][0], base[2][1], 0);
    const T = P(jitter(R), jitter(R), h);
    tris.push([A, C, B], [A, B, T], [B, C, T], [C, A, T]);
  } else {
    // skewed triangular prism
    const d = 0.35 + rng() * 0.7;
    const sk = [jitter(R * 1.6), jitter(R * 1.6)];
    const lo = base.map((b) => P(b[0], b[1], -d / 2));
    const hi = base.map((b, k) => P(b[0] * (0.5 + rng() * 0.7) + sk[0], b[1] * (0.5 + rng() * 0.7) + sk[1], d / 2 + jitter(0.1) + k * 0.0));
    tris.push([lo[0], lo[2], lo[1]], [hi[0], hi[1], hi[2]]);
    for (let k = 0; k < 3; k++) {
      const k2 = (k + 1) % 3;
      tris.push([lo[k], lo[k2], hi[k2]], [lo[k], hi[k2], hi[k]]);
    }
  }
  const pos: number[] = [];
  for (const t of tris) for (const v of t) pos.push(v[0], v[1], v[2]);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function GlassShards({ progress, pointer }: { progress: MutableRefObject<GalleryProgress>; pointer: MutableRefObject<PointerState> }) {
  const refs = useRef<(Mesh | null)[]>([]);
  const data = useMemo(() => {
    const rng = mulberry32(2026);
    return Array.from({ length: SHARD_COUNT }, (_, i) => {
      const front = i % 2 === 0;
      return {
        geo: makeShard(rng),
        x: (rng() - 0.5) * 17,
        y: (rng() - 0.5) * 6.4,
        z: front ? 1.2 + (rng() - 0.5) * 0.4 : -1.0 + (rng() - 0.5) * 0.4,
        s: (front ? 1.3 : 1.7) * (0.7 + rng() * 1.1),
        rx: (rng() - 0.5) * 0.5,
        ry: (rng() - 0.5) * 0.5,
        rz: (rng() - 0.5) * 0.3,
        ph: rng() * 10,
        px: front ? 1.0 : 0.35,
      };
    });
  }, []);
  const gl = useThree((s) => s.gl);
  const env = useMemo(() => createStudioEnv(gl), [gl]);
  const mat = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: '#ffffff',
        transmission: 0.95,
        ior: 1.52,
        thickness: 0.7,
        iridescence: 1,
        iridescenceIOR: 1.35,
        iridescenceThicknessRange: [120, 720],
        roughness: 0.05,
        metalness: 0,
        envMap: env,
        envMapIntensity: 1.0,
        flatShading: true,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
      }),
    [env],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const o = progress.current.p * 4;
    const P = pointer.current;
    data.forEach((d, i) => {
      const m = refs.current[i];
      if (!m) return;
      // wrap horizontally so shards stream past as the stage advances
      let x = d.x - o * 2.2 * d.px - P.x * 0.35 * d.px;
      x = ((((x + 9) % 18) + 18) % 18) - 9;
      m.position.set(x, d.y + Math.sin(t * 0.4 + d.ph) * 0.18 - P.y * 0.2 * d.px, d.z);
      m.rotation.set(t * d.rx + d.ph, t * d.ry + d.ph * 0.7, t * d.rz);
      m.scale.setScalar(d.s);
    });
  });

  return (
    <>
      {data.map((d, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          geometry={d.geo}
          material={mat}
          frustumCulled={false}
        />
      ))}
    </>
  );
}

function Backdrop() {
  const { scene, gl } = useThree();
  useEffect(() => {
    scene.background = new Color('#050505');
    const env = createStudioEnv(gl);
    scene.environment = env;
    return () => {
      scene.background = null;
      scene.environment = null;
    };
  }, [scene, gl]);
  return null;
}

export interface ObsidianGalleryProps {
  textures: Texture[];
  progress: MutableRefObject<GalleryProgress>;
  pointer: MutableRefObject<PointerState>;
  onIndex: (i: number) => void;
}

export default function ObsidianGalleryScene({ textures, progress, pointer, onIndex }: ObsidianGalleryProps) {
  return (
    <>
      <Backdrop />
      <Smoke progress={progress} pointer={pointer} />
      <GlassShards progress={progress} pointer={pointer} />
      {textures.length > 0 && <Cards textures={textures} progress={progress} onIndex={onIndex} />}
    </>
  );
}
