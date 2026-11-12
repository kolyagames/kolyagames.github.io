import { Color, Vector2 } from 'three';

/** Paper + cobalt ink (absorption model) + typography (with optional DREAM liquid wave). */
export const inkCompositeShader = {
  uniforms: {
    tDye: { value: null as unknown },
    tText: { value: null as unknown },
    uBg: { value: new Color('#F3F3F1') },
    uTime: { value: 0 },
    uDream: { value: 0 },
    uTexel: { value: new Vector2(1 / 512, 1 / 512) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.9999, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDye;
    uniform sampler2D tText;
    uniform vec3 uBg;
    uniform float uTime, uDream;
    uniform vec2 uTexel;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      // ink density gradient gently pushes the letters so the dye flows *through* the type
      float dl = dot(texture2D(tDye, uv - vec2(uTexel.x * 6.0, 0.0)).rgb, vec3(0.33));
      float dr = dot(texture2D(tDye, uv + vec2(uTexel.x * 6.0, 0.0)).rgb, vec3(0.33));
      float db = dot(texture2D(tDye, uv - vec2(0.0, uTexel.y * 6.0)).rgb, vec3(0.33));
      float dt = dot(texture2D(tDye, uv + vec2(0.0, uTexel.y * 6.0)).rgb, vec3(0.33));
      vec2 push = vec2(dr - dl, dt - db) * 0.0013;

      vec2 tuv = uv + push;
      // DREAM: sinusoidal liquid wave on the editorial text
      tuv.y += sin(uv.x * 13.0 + uTime * 1.7) * 0.0055 * uDream + sin(uv.x * 41.0 - uTime * 2.3) * 0.0012 * uDream;
      tuv.x += sin(uv.y * 19.0 + uTime * 1.3) * 0.0042 * uDream;

      vec3 dye = texture2D(tDye, uv).rgb;
      vec3 col = uBg * exp(-dye * 0.95);

      // faint paper tooth (paper only, so the type stays clean)
      float n = fract(sin(dot(uv * 1024.0, vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * 0.008;

      vec4 txt = texture2D(tText, tuv);
      col = mix(col, txt.rgb, txt.a);

      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }
  `,
};
