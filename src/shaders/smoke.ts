import { Color, Vector2 } from 'three';

const noise = /* glsl */ `
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }
  float gnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(
      mix(dot(hash2(i), f), dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
      mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
      u.y);
  }
  float fbm(vec2 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 4; i++) {
      s += a * gnoise(p);
      p = p * 2.02 + vec2(17.3, 9.1);
      a *= 0.5;
    }
    return s;
  }
  vec2 curl(vec2 p) {
    float e = 0.02;
    float n1 = fbm(p + vec2(0.0, e));
    float n2 = fbm(p - vec2(0.0, e));
    float n3 = fbm(p + vec2(e, 0.0));
    float n4 = fbm(p - vec2(e, 0.0));
    return vec2(n1 - n2, -(n3 - n4)) / (2.0 * e);
  }
`;

/** Curl-noise iridescent smoke. Rendered as a full-screen quad with AdditiveBlending. */
export const smokeShader = {
  uniforms: {
    uTime: { value: 0 },
    uVel: { value: 0 },
    uAspect: { value: 1 },
    uMouse: { value: new Vector2(0, 0) },
    uOffset: { value: 0 },
    uStrength: { value: 1 },
    uFront: { value: 0 },
    uC0: { value: new Color('#22D3EE') },
    uC1: { value: new Color('#E879F9') },
    uC2: { value: new Color('#6366F1') },
    uC3: { value: new Color('#F59E0B') },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime, uVel, uAspect, uOffset, uStrength, uFront;
    uniform vec2 uMouse;
    uniform vec3 uC0, uC1, uC2, uC3;
    varying vec2 vUv;
    ${noise}
    vec3 pal(float k) {
      k = fract(k) * 4.0;
      vec3 c = mix(uC0, uC1, smoothstep(0.0, 1.0, k));
      c = mix(c, uC2, smoothstep(1.0, 2.0, k));
      c = mix(c, uC3, smoothstep(2.0, 3.0, k));
      c = mix(c, uC0, smoothstep(3.0, 4.0, k));
      return c;
    }
    void main() {
      vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
      float t = uTime * 0.06 + uOffset;
      float energy = 1.0 + uVel * 2.5;

      vec2 q = p * 1.5;
      vec2 m = uMouse * 0.5 * vec2(uAspect, 1.0);
      vec2 dm = p - m;
      float md = length(dm);
      q += vec2(-dm.y, dm.x) * exp(-md * md * 6.0) * 0.55 * (0.35 + uVel * 2.0);

      for (int i = 0; i < 3; i++) {
        q += curl(q * 0.8 + t * vec2(1.0, -0.7)) * 0.11 * energy;
      }
      float d = fbm(q * 1.2 + vec2(t * 2.0, -t)) * 0.5 + 0.5;
      float d2 = fbm(q * 2.3 - t * 3.0) * 0.5 + 0.5;
      float dens = smoothstep(0.36, 0.9, d * 0.72 + d2 * 0.34);
      float k = fract(d * 1.15 + d2 * 0.5 + t * 0.8 + dot(normalize(q + 0.001), vec2(0.5)) * 0.15);
      vec3 col = pal(k);

      float r = length(p * vec2(0.85, 1.45));
      float core = smoothstep(0.82, 0.0, r);
      core *= core;
      float ring = smoothstep(0.38, 0.6, r) * (1.0 - smoothstep(0.62, 0.9, r));
      float mask = mix(core * 0.95, ring * 0.85, uFront) + exp(-md * md * 5.0) * 0.35;

      vec3 outc = col * dens * dens * mask * uStrength * (0.55 + uVel * 0.9);
      gl_FragColor = vec4(outc, 1.0);
      #include <colorspace_fragment>
    }
  `,
};
