import {
  BufferGeometry,
  ClampToEdgeWrapping,
  Float32BufferAttribute,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import {
  advectionFrag,
  baseVertex,
  clearFrag,
  curlFrag,
  divergenceFrag,
  gradientSubtractFrag,
  pressureFrag,
  splatFrag,
  vorticityFrag,
} from '../shaders/fluid';

class DoubleFBO {
  read: WebGLRenderTarget;
  write: WebGLRenderTarget;
  constructor(w: number, h: number) {
    this.read = makeRT(w, h);
    this.write = makeRT(w, h);
  }
  swap() {
    const t = this.read;
    this.read = this.write;
    this.write = t;
  }
  dispose() {
    this.read.dispose();
    this.write.dispose();
  }
}

function makeRT(w: number, h: number): WebGLRenderTarget {
  return new WebGLRenderTarget(w, h, {
    type: HalfFloatType,
    format: RGBAFormat,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
  });
}

export interface FluidParams {
  vorticity: number;
  velocityDissipation: number;
  dyeDissipation: number;
  pressure: number;
  pressureIterations: number;
  splatRadius: number;
}

/**
 * Real-time 2D Navier–Stokes solver (velocity, divergence, curl, pressure, dye) on ping-pong FBOs.
 * The dye channel stores per-channel light *absorption* so ink composites like watercolour on paper.
 */
export class FluidSim {
  params: FluidParams = {
    vorticity: 22,
    velocityDissipation: 0.25,
    dyeDissipation: 0.32,
    pressure: 0.8,
    pressureIterations: 20,
    splatRadius: 0.26,
  };

  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: Mesh;
  private simRes: number;
  private dyeRes: number;
  private aspect = 1;

  private velocity!: DoubleFBO;
  private pressure!: DoubleFBO;
  private dye!: DoubleFBO;
  private divergence!: WebGLRenderTarget;
  private curl!: WebGLRenderTarget;
  private simTexel = new Vector2();
  private dyeTexel = new Vector2();

  private mats: Record<string, ShaderMaterial>;

  constructor(renderer: WebGLRenderer, simRes = 128, dyeRes = 512) {
    this.renderer = renderer;
    this.simRes = simRes;
    this.dyeRes = dyeRes;
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new Mesh(geo);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);

    const mk = (frag: string, uniforms: Record<string, { value: unknown }>) =>
      new ShaderMaterial({
        vertexShader: baseVertex,
        fragmentShader: frag,
        uniforms: { texelSize: { value: new Vector2() }, ...uniforms },
        depthTest: false,
        depthWrite: false,
      });

    this.mats = {
      advection: mk(advectionFrag, {
        uVelocity: { value: null }, uSource: { value: null }, dt: { value: 0.016 }, dissipation: { value: 0 },
      }),
      divergence: mk(divergenceFrag, { uVelocity: { value: null } }),
      curl: mk(curlFrag, { uVelocity: { value: null } }),
      vorticity: mk(vorticityFrag, {
        uVelocity: { value: null }, uCurl: { value: null }, curl: { value: 20 }, dt: { value: 0.016 },
      }),
      pressure: mk(pressureFrag, { uPressure: { value: null }, uDivergence: { value: null } }),
      gradient: mk(gradientSubtractFrag, { uPressure: { value: null }, uVelocity: { value: null } }),
      splat: mk(splatFrag, {
        uTarget: { value: null }, aspectRatio: { value: 1 }, color: { value: new Vector3() },
        point: { value: new Vector2() }, radius: { value: 0.01 },
      }),
      clear: mk(clearFrag, { uTexture: { value: null }, value: { value: 0.8 } }),
    };

    this.resize(1);
  }

  /** (Re)allocate the grids for a new canvas aspect ratio. Clears the ink. */
  resize(aspect: number) {
    if (this.velocity && Math.abs(aspect - this.aspect) < 0.02) return;
    this.aspect = aspect;
    const sim = this.res(this.simRes);
    const dye = this.res(this.dyeRes);
    [this.velocity, this.pressure, this.dye].forEach((f) => f?.dispose());
    this.divergence?.dispose();
    this.curl?.dispose();
    this.velocity = new DoubleFBO(sim.w, sim.h);
    this.pressure = new DoubleFBO(sim.w, sim.h);
    this.dye = new DoubleFBO(dye.w, dye.h);
    this.divergence = makeRT(sim.w, sim.h);
    this.curl = makeRT(sim.w, sim.h);
    this.simTexel.set(1 / sim.w, 1 / sim.h);
    this.dyeTexel.set(1 / dye.w, 1 / dye.h);
    const prev = this.renderer.getRenderTarget();
    [this.velocity.read, this.velocity.write, this.pressure.read, this.pressure.write, this.dye.read, this.dye.write].forEach((rt) => {
      this.renderer.setRenderTarget(rt);
      this.renderer.clear();
    });
    this.renderer.setRenderTarget(prev);
  }

  private res(base: number) {
    const a = this.aspect;
    return a > 1
      ? { w: Math.round(base * a), h: base }
      : { w: base, h: Math.round(base / a) };
  }

  get texture(): Texture {
    return this.dye.read.texture;
  }

  get dyeTexelSize(): Vector2 {
    return this.dyeTexel;
  }

  private blit(mat: ShaderMaterial, target: WebGLRenderTarget) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
  }

  /** x,y in 0..1 (y up). dx,dy = velocity impulse. ink = absorption colour added to the dye. */
  splat(x: number, y: number, dx: number, dy: number, ink: Vector3, radiusScale = 1) {
    const prev = this.renderer.getRenderTarget();
    const m = this.mats.splat;
    let radius = (this.params.splatRadius * radiusScale) / 100;
    if (this.aspect > 1) radius *= this.aspect;
    m.uniforms.aspectRatio.value = this.aspect;
    m.uniforms.point.value.set(x, y);
    m.uniforms.radius.value = radius;

    m.uniforms.texelSize.value.copy(this.simTexel);
    m.uniforms.uTarget.value = this.velocity.read.texture;
    m.uniforms.color.value.set(dx, dy, 0);
    this.blit(m, this.velocity.write);
    this.velocity.swap();

    m.uniforms.texelSize.value.copy(this.dyeTexel);
    m.uniforms.uTarget.value = this.dye.read.texture;
    m.uniforms.color.value.copy(ink);
    this.blit(m, this.dye.write);
    this.dye.swap();
    this.renderer.setRenderTarget(prev);
  }

  step(dtIn: number) {
    const dt = Math.min(dtIn, 1 / 30);
    const p = this.params;
    const prev = this.renderer.getRenderTarget();
    const texel = this.simTexel;
    const M = this.mats;

    M.curl.uniforms.texelSize.value.copy(texel);
    M.curl.uniforms.uVelocity.value = this.velocity.read.texture;
    this.blit(M.curl, this.curl);

    M.vorticity.uniforms.texelSize.value.copy(texel);
    M.vorticity.uniforms.uVelocity.value = this.velocity.read.texture;
    M.vorticity.uniforms.uCurl.value = this.curl.texture;
    M.vorticity.uniforms.curl.value = p.vorticity;
    M.vorticity.uniforms.dt.value = dt;
    this.blit(M.vorticity, this.velocity.write);
    this.velocity.swap();

    M.divergence.uniforms.texelSize.value.copy(texel);
    M.divergence.uniforms.uVelocity.value = this.velocity.read.texture;
    this.blit(M.divergence, this.divergence);

    M.clear.uniforms.texelSize.value.copy(texel);
    M.clear.uniforms.uTexture.value = this.pressure.read.texture;
    M.clear.uniforms.value.value = p.pressure;
    this.blit(M.clear, this.pressure.write);
    this.pressure.swap();

    M.pressure.uniforms.texelSize.value.copy(texel);
    M.pressure.uniforms.uDivergence.value = this.divergence.texture;
    for (let i = 0; i < p.pressureIterations; i++) {
      M.pressure.uniforms.uPressure.value = this.pressure.read.texture;
      this.blit(M.pressure, this.pressure.write);
      this.pressure.swap();
    }

    M.gradient.uniforms.texelSize.value.copy(texel);
    M.gradient.uniforms.uPressure.value = this.pressure.read.texture;
    M.gradient.uniforms.uVelocity.value = this.velocity.read.texture;
    this.blit(M.gradient, this.velocity.write);
    this.velocity.swap();

    M.advection.uniforms.texelSize.value.copy(texel);
    M.advection.uniforms.uVelocity.value = this.velocity.read.texture;
    M.advection.uniforms.uSource.value = this.velocity.read.texture;
    M.advection.uniforms.dt.value = dt;
    M.advection.uniforms.dissipation.value = p.velocityDissipation;
    this.blit(M.advection, this.velocity.write);
    this.velocity.swap();

    M.advection.uniforms.texelSize.value.copy(texel);
    M.advection.uniforms.uVelocity.value = this.velocity.read.texture;
    M.advection.uniforms.uSource.value = this.dye.read.texture;
    M.advection.uniforms.dissipation.value = p.dyeDissipation;
    this.blit(M.advection, this.dye.write);
    this.dye.swap();

    this.renderer.setRenderTarget(prev);
  }

  dispose() {
    [this.velocity, this.pressure, this.dye].forEach((f) => f.dispose());
    this.divergence.dispose();
    this.curl.dispose();
    Object.values(this.mats).forEach((m) => m.dispose());
    this.quad.geometry.dispose();
  }
}
