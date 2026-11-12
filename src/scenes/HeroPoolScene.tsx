import { MutableRefObject, RefObject, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useFBO } from '@react-three/drei';
import {
  AddEquation,
  BufferGeometry,
  CustomBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  SrcAlphaFactor,
  CanvasTexture,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  HalfFloatType,
  IcosahedronGeometry,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Object3D,
  OrthographicCamera,
  Path,
  PerspectiveCamera,
  PlaneGeometry,
  Plane,
  Raycaster,
  SRGBColorSpace,
  Scene,
  Shape,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MAX_RIPPLES, waterShader } from '../shaders/water';
import { transitionShader } from '../shaders/transition';
import { createStudioEnv } from '../lib/env';
import { drawDomTexts, loadFonts } from '../lib/domText';
import type { PointerState } from '../lib/hooks';

/* ------------------------------------------------------------------ helpers */

function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}

function makeBoulder(): BufferGeometry {
  let g: BufferGeometry = new IcosahedronGeometry(0.75, 6);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4); // shared vertices -> smooth sculpted normals
  const pos = g.attributes.position;
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = vnoise(v.x * 1.7 + 4, v.y * 1.7 + 9, v.z * 1.7 + 2) - 0.5;
    const n2 = vnoise(v.x * 4.6 + 1, v.y * 4.6 + 7, v.z * 4.6 + 3) - 0.5;
    const n3 = vnoise(v.x * 11 + 8, v.y * 11 + 2, v.z * 11 + 5) - 0.5;
    v.multiplyScalar(1 + 0.55 * n + 0.2 * n2 + 0.05 * n3);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

interface WallOpts {
  w: number;
  h: number;
  depth: number;
  holeCx: number;
  holeW: number;
  holeH: number;
  arch: boolean;
}

/** Wall slab with an arched or rectangular opening whose sill sits at y = 0 (the water line). */
function makeWall({ w, h, depth, holeCx, holeW, holeH, arch }: WallOpts): ExtrudeGeometry {
  const s = new Shape();
  s.moveTo(-w / 2, -0.6);
  s.lineTo(w / 2, -0.6);
  s.lineTo(w / 2, h);
  s.lineTo(-w / 2, h);
  s.closePath();
  const hole = new Path();
  const r = holeW / 2;
  if (arch) {
    const spring = holeH - r;
    hole.moveTo(holeCx - r, 0);
    hole.lineTo(holeCx + r, 0);
    hole.lineTo(holeCx + r, spring);
    hole.absarc(holeCx, spring, r, 0, Math.PI, false);
    hole.lineTo(holeCx - r, 0);
  } else {
    hole.moveTo(holeCx - r, 0);
    hole.lineTo(holeCx + r, 0);
    hole.lineTo(holeCx + r, holeH);
    hole.lineTo(holeCx - r, holeH);
    hole.lineTo(holeCx - r, 0);
  }
  s.holes.push(hole);
  return new ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 64 });
}

/** Soft hill silhouette: an x-monotonic ridge triangulated as a strip down to a baseline. */
function hillGeometry(seed: number, amp: number, base: number): BufferGeometry {
  const N = 120;
  const bottom = -1.5;
  const out: number[] = [];
  let px = -16;
  let py = 0;
  for (let i = 0; i <= N; i++) {
    const x = -16 + (32 * i) / N;
    const y =
      base +
      amp * (0.55 * Math.sin(x * 0.33 + seed) + 0.3 * Math.sin(x * 0.81 + seed * 2.3) + 0.15 * Math.sin(x * 1.7 + seed * 4.1)) +
      amp * 0.6;
    if (i > 0) {
      out.push(px, bottom, 0, x, bottom, 0, px, py, 0);
      out.push(x, bottom, 0, x, y, 0, px, py, 0);
    }
    px = x;
    py = y;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(out, 3));
  return g;
}

const tmpDir = new Vector3();

/* ------------------------------------------------------------------ scene pieces */

function SkyAndCamera() {
  const { scene, camera, size } = useThree();
  useEffect(() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 512;
    const g = c.getContext('2d');
    if (!g) return;
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#DEC7D6');
    gr.addColorStop(0.55, '#EBD0C9');
    gr.addColorStop(1, '#EBD0C9');
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 512);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    scene.background = tex;
    return () => {
      tex.dispose();
      scene.background = null;
    };
  }, [scene]);

  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const z = 7.5 * Math.max(1, Math.pow(1.25 / aspect, 0.8));
    camera.position.set(0, 1.4, z);
    camera.lookAt(0, 1.1, 0);
    camera.layers.enable(1); // layer 1: WebGL headline + lens (kept out of the water reflection)
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

function Lights() {
  return (
    <>
      <hemisphereLight args={['#fff8f4', '#f1d9d4', 2.3]} />
      <directionalLight
        position={[6, 9, 5]}
        intensity={2.2}
        color="#FFF5EE"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />
    </>
  );
}

function Architecture() {
  const leftWall = useMemo(() => makeWall({ w: 4.0, h: 6.2, depth: 0.7, holeCx: 0, holeW: 2.2, holeH: 2.9, arch: true }), []);
  const rightWall = useMemo(() => makeWall({ w: 3.9, h: 6.2, depth: 0.8, holeCx: -1.15, holeW: 1.1, holeH: 2.4, arch: false }), []);
  const boulder = useMemo(() => makeBoulder(), []);
  const steps = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const top = 0.12 + (8 - i) * 0.21;
        return { top, z: -3.0 + i * 0.46 + 0.23 };
      }),
    [],
  );
  const hillA = useMemo(() => hillGeometry(1.3, 0.55, 0.15), []);
  const hillB = useMemo(() => hillGeometry(4.1, 0.45, -0.05), []);
  const hillC = useMemo(() => hillGeometry(7.7, 0.35, -0.25), []);

  return (
    <group>
      {/* misty distant hills seen through the arch */}
      <mesh geometry={hillA} position={[0, 0, -9.7]}><meshBasicMaterial color="#E7C9CF" side={DoubleSide} /></mesh>
      <mesh geometry={hillB} position={[0, 0, -9.4]}><meshBasicMaterial color="#DDBAC6" side={DoubleSide} /></mesh>
      <mesh geometry={hillC} position={[0, 0, -9.1]}><meshBasicMaterial color="#D2AEBF" side={DoubleSide} /></mesh>

      {/* left terracotta-pink wall with a semicircular arch (La Muralla Roja inspired) */}
      <mesh geometry={leftWall} position={[-3.2, 0, -2.2]} castShadow receiveShadow>
        <meshStandardMaterial color="#E5BFB8" roughness={0.95} metalness={0} />
      </mesh>

      {/* back wall + landing behind the staircase */}
      <mesh position={[0.2, 1.9, -3.9]} castShadow receiveShadow>
        <boxGeometry args={[3.0, 4.6, 0.7]} />
        <meshStandardMaterial color="#E3BBB4" roughness={0.95} />
      </mesh>

      {/* 9 crisp cream steps descending into the water */}
      {steps.map((s, i) => (
        <mesh key={i} position={[0.4, (s.top - 0.6) / 2, s.z]} castShadow receiveShadow>
          <boxGeometry args={[2.0, s.top + 0.6, 0.46]} />
          <meshStandardMaterial color="#F4EAE6" roughness={0.9} />
        </mesh>
      ))}

      {/* right wall with a rectangular portal, ledge and the white sphere */}
      <mesh geometry={rightWall} position={[3.55, 0, -2.8]} castShadow receiveShadow>
        <meshStandardMaterial color="#DFB4AC" roughness={0.95} />
      </mesh>
      <mesh position={[2.3, 1.5, -1.2]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.3, 1.6]} />
        <meshStandardMaterial color="#E9C9C0" roughness={0.9} />
      </mesh>
      <mesh position={[2.3, 2.2, -1.2]} castShadow receiveShadow>
        <sphereGeometry args={[0.55, 64, 64]} />
        <meshStandardMaterial color="#F7F2EF" roughness={0.85} />
      </mesh>

      {/* sculpted sandstone boulder, partially submerged */}
      <mesh geometry={boulder} position={[2.7, 0.05, 2.2]} scale={[1.25, 0.8, 1]} rotation={[0, 0.6, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#C9A79E" roughness={0.98} />
      </mesh>
    </group>
  );
}

function Water({ pointer }: { pointer: MutableRefObject<PointerState> }) {
  const camera = useThree((s) => s.camera);
  const reflector = useMemo(() => {
    const r = new Reflector(new PlaneGeometry(20, 20), {
      color: 0xffffff,
      textureWidth: 1024,
      textureHeight: 1024,
      clipBias: 0.003,
      shader: waterShader,
      multisample: 4,
    });
    r.rotation.x = -Math.PI / 2;
    return r;
  }, []);

  const st = useRef({
    ray: new Raycaster(),
    plane: new Plane(new Vector3(0, 1, 0), 0),
    hit: new Vector3(),
    last: new Vector3(1e6, 0, 1e6),
    lastT: 0,
    idx: 0,
    drop: 2,
    mouse: new Vector2(),
    ndc: new Vector2(),
  });

  useEffect(() => {
    return () => {
      reflector.geometry.dispose();
      (reflector.material as ShaderMaterial).dispose();
      reflector.getRenderTarget().dispose();
    };
  }, [reflector]);

  useFrame(({ clock }) => {
    const s = st.current;
    const t = clock.elapsedTime;
    const u = (reflector.material as ShaderMaterial).uniforms;
    u.uTime.value = t;
    const spawn = (x: number, z: number) => {
      const arr = u.uRipples.value as Vector3[];
      arr[s.idx % MAX_RIPPLES].set(x, z, t);
      s.idx++;
    };
    const P = pointer.current;
    if (P.inside) {
      s.ndc.set(P.x, P.y);
      s.ray.setFromCamera(s.ndc, camera);
      if (s.ray.ray.intersectPlane(s.plane, s.hit) && Math.abs(s.hit.x) < 9.5 && Math.abs(s.hit.z) < 9.5) {
        s.mouse.lerp(new Vector2(s.hit.x, s.hit.z), 0.25);
        u.uMouse.value.copy(s.mouse);
        if (s.hit.distanceTo(s.last) > 0.5 && t - s.lastT > 0.09) {
          spawn(s.hit.x, s.hit.z);
          s.last.copy(s.hit);
          s.lastT = t;
        }
      }
    }
    // a lazy drip every few seconds keeps the pool alive when idle
    if (t > s.drop) {
      spawn(-1.5 + Math.random() * 4, -1 + Math.random() * 5);
      s.drop = t + 3.2 + Math.random() * 2.5;
    }
  });

  return <primitive object={reflector} />;
}

function GlassLens({ pointer }: { pointer: MutableRefObject<PointerState> }) {
  const { gl, camera } = useThree();
  const main = useRef<Mesh>(null);
  const drop = useRef<Mesh>(null);
  const env = useMemo(() => createStudioEnv(gl), [gl]);
  const mat = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: '#ffffff',
        transmission: 0.96,
        ior: 1.35,
        thickness: 0.8,
        roughness: 0.05,
        metalness: 0,
        envMap: env,
        envMapIntensity: 1.1,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
      }),
    [env],
  );
  const s = useRef({
    cur: new Vector3(0, 1.1, 0),
    dropCur: new Vector3(0, 1.1, 0),
    tgt: new Vector3(),
    ray: new Vector3(),
    fwd: new Vector3(),
    init: false,
  });
  const D = 4.6;

  useEffect(() => {
    main.current?.layers.set(1);
    drop.current?.layers.set(1);
  }, []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const P = pointer.current;
    const idle = !P.moved || performance.now() - P.lastMove > 2500 || !P.inside;
    const nx = idle ? Math.sin(t * 0.45) * 0.28 : P.x;
    const ny = idle ? Math.sin(t * 0.62 + 1.1) * 0.1 + 0.03 : P.y;
    const k = s.current;
    k.ray.set(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
    camera.getWorldDirection(k.fwd);
    k.tgt.copy(camera.position).addScaledVector(k.ray, D / k.ray.dot(k.fwd));
    if (!k.init) {
      k.cur.copy(k.tgt);
      k.dropCur.copy(k.tgt);
      k.init = true;
    }
    const f = 1 - Math.pow(1 - 0.08, dt * 60); // lerp 0.08 @ 60fps
    k.cur.lerp(k.tgt, f);
    k.dropCur.lerp(k.cur, 1 - Math.pow(1 - 0.045, dt * 60));
    const speed = Math.min(1, k.cur.distanceTo(k.tgt) * 0.7);
    if (main.current) {
      main.current.position.copy(k.cur);
      main.current.quaternion.copy(camera.quaternion);
      const sc = 0.52 * (1 + speed * 0.12);
      main.current.scale.set(sc * (1 + speed * 0.1), sc * (1 - speed * 0.05), sc * 0.34);
    }
    if (drop.current) {
      drop.current.position.copy(k.dropCur).addScaledVector(k.fwd, 0.06);
      drop.current.quaternion.copy(camera.quaternion);
      const ds = 0.17 + speed * 0.1;
      drop.current.scale.set(ds, ds, ds * 0.42);
    }
  });

  return (
    <>
      <mesh ref={main} material={mat} frustumCulled={false}>
        <sphereGeometry args={[1, 96, 96]} />
      </mesh>
      <mesh ref={drop} material={mat} frustumCulled={false}>
        <sphereGeometry args={[1, 64, 64]} />
      </mesh>
    </>
  );
}

/** The headline lives in WebGL so the glass lens can really refract it. Drawn from the DOM layout. */
function HeadlineLayer({
  container,
  onReady,
}: {
  container: RefObject<HTMLElement>;
  onReady: () => void;
}) {
  const { size, gl, camera } = useThree();
  const mesh = useRef<Mesh>(null);
  const D = 6.2;
  const canvas = useMemo(() => document.createElement('canvas'), []);
  const tex = useMemo(() => {
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.minFilter = LinearFilter;
    t.generateMipmaps = false;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        map: tex,
        // stays in the *opaque* pass (so the glass lens refracts it) but blends smoothly
        transparent: false,
        blending: CustomBlending,
        blendEquation: AddEquation,
        blendSrc: SrcAlphaFactor,
        blendDst: OneMinusSrcAlphaFactor,
        blendSrcAlpha: OneFactor,
        blendDstAlpha: OneMinusSrcAlphaFactor,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    [tex],
  );
  const readyOnce = useRef(false);

  useEffect(() => {
    mesh.current?.layers.set(1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const draw = async () => {
      await loadFonts();
      const el = container.current;
      if (cancelled || !el) return;
      const dpr = Math.min(gl.getPixelRatio(), 2);
      canvas.width = Math.round(size.width * dpr);
      canvas.height = Math.round(size.height * dpr);
      drawDomTexts(el, canvas, dpr);
      tex.dispose(); // canvas size changed -> force texture re-allocation
      tex.needsUpdate = true;
      if (!readyOnce.current) {
        readyOnce.current = true;
        onReady();
      }
    };
    timer = window.setTimeout(draw, 60);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [size.width, size.height, gl, canvas, tex, container, onReady]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const cam = camera as PerspectiveCamera;
    const h = 2 * D * Math.tan((cam.fov * Math.PI) / 360);
    const w = h * cam.aspect;
    cam.getWorldDirection(tmpDir);
    m.position.copy(cam.position).addScaledVector(tmpDir, D);
    m.quaternion.copy(cam.quaternion);
    m.scale.set(w, h, 1);
  });

  return (
    <mesh ref={mesh} material={material} renderOrder={20} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

/** Renders the scene into an MSAA target, then draws it through the liquid-wipe shader. */
function TransitionPass({ transition }: { transition: MutableRefObject<number> }) {
  const { gl, scene, camera, size } = useThree();
  const fbo = useFBO({ samples: 4, type: HalfFloatType, depthBuffer: true });
  const post = useMemo(() => {
    const quadScene = new Scene();
    const quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mat = new ShaderMaterial({
      uniforms: {
        tScene: { value: fbo.texture },
        uTransition: { value: 0 },
        uBg: { value: new Color('#F3F3F1') },
        uRes: { value: new Vector2(1, 1) },
      },
      vertexShader: transitionShader.vertexShader,
      fragmentShader: transitionShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const quad = new Mesh(geo, mat);
    quad.frustumCulled = false;
    quadScene.add(quad as Object3D);
    return { quadScene, quadCam, mat };
  }, [fbo]);

  useEffect(() => {
    post.mat.uniforms.uRes.value.set(size.width, size.height);
  }, [size, post]);

  useFrame(() => {
    post.mat.uniforms.uTransition.value = transition.current;
    const prevAuto = gl.autoClear;
    gl.setRenderTarget(fbo);
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.autoClear = true;
    gl.render(post.quadScene, post.quadCam);
    gl.autoClear = prevAuto;
  }, 1);

  return null;
}

/* ------------------------------------------------------------------ export */

export interface HeroPoolSceneProps {
  transition: MutableRefObject<number>;
  pointer: MutableRefObject<PointerState>;
  textContainer: RefObject<HTMLElement>;
  onReady: () => void;
}

export default function HeroPoolScene({ transition, pointer, textContainer, onReady }: HeroPoolSceneProps) {
  return (
    <>
      <SkyAndCamera />
      <Lights />
      <Architecture />
      <Water pointer={pointer} />
      <GlassLens pointer={pointer} />
      <HeadlineLayer container={textContainer} onReady={onReady} />
      <TransitionPass transition={transition} />
    </>
  );
}
