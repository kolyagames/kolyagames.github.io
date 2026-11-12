import { Color, Vector2, Vector3 } from 'three';

export const MAX_RIPPLES = 8;

/**
 * Custom shader for three's `Reflector`. The Reflector supplies `tDiffuse`, `textureMatrix` and `color`;
 * everything else (time, mouse, ripple rings) is ours.
 */
export const waterShader = {
  name: 'PastelPoolWater',
  uniforms: {
    color: { value: null as unknown },
    tDiffuse: { value: null as unknown },
    textureMatrix: { value: null as unknown },
    uTime: { value: 0 },
    uMouse: { value: new Vector2(0, 0) },
    uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new Vector3(0, 0, -100)) },
    uSunDir: { value: new Vector3(6, 9, 5).normalize() },
    uBody: { value: new Color('#c9d3e2') },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform vec3 uRipples[${MAX_RIPPLES}];
    uniform vec3 uSunDir;
    uniform vec3 uBody;
    varying vec4 vUv;
    varying vec3 vWorld;

    void main() {
      vec2 p = vWorld.xz;
      vec2 proj = vUv.xy / vUv.w;

      // fine horizontal micro-ripples: sin(uv.y * 120.0 + uTime * 1.5) * 0.002  (plane uv.y = world z / 20 + .5)
      float planeV = p.y / 20.0 + 0.5;
      float micro = sin(planeV * 120.0 + uTime * 1.5) * 0.002;
      vec2 off = vec2(0.0, micro);
      off.x += sin(p.y * 2.3 + p.x * 1.7 + uTime * 0.5) * 0.0012;

      // expanding circular ripple rings spawned around uMouse
      vec2 slope = vec2(0.0);
      for (int i = 0; i < ${MAX_RIPPLES}; i++) {
        vec3 r = uRipples[i];
        float age = uTime - r.z;
        if (age > 0.0 && age < 5.5) {
          vec2 d = p - r.xy;
          float dist = length(d);
          float front = age * 1.25;
          float w = dist - front;
          float env = exp(-w * w * 9.0) * exp(-age * 0.7) * smoothstep(0.0, 0.18, age);
          slope += (d / (dist + 1e-4)) * cos(w * 17.0) * env;
        }
      }
      // soft halo right under the cursor
      vec2 dm = p - uMouse;
      slope += normalize(dm + 1e-4) * sin(length(dm) * 14.0 - uTime * 3.0) * exp(-dot(dm, dm) * 1.6) * 0.12;

      vec2 uvR = proj + off + vec2(slope.x, -slope.y) * 0.011;
      vec3 refl = texture2D(tDiffuse, uvR).rgb * color;

      vec3 N = normalize(vec3(
        -slope.x * 0.2 + sin(p.x * 7.0 + uTime * 0.7) * 0.004,
        1.0,
        -slope.y * 0.2 + cos(planeV * 120.0 + uTime * 1.5) * 0.012
      ));
      vec3 V = normalize(cameraPosition - vWorld);
      float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
      float reflectivity = mix(0.62, 1.0, fres);

      vec3 col = mix(uBody * 0.95, refl, reflectivity);

      // subtle sun glints riding the ripples
      vec3 H = normalize(normalize(uSunDir) + V);
      float spec = pow(max(dot(N, H), 0.0), 900.0);
      float sparkle = 0.55 + 0.45 * sin(proj.x * 520.0 + uTime * 2.0) * sin(proj.y * 410.0 - uTime * 1.6);
      col += vec3(1.0, 0.94, 0.86) * spec * 2.4 * sparkle;

      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};
