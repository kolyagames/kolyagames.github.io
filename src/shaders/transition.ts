import { Color, Vector2 } from 'three';

/** Full-screen post pass: liquid vertical sine wipe + chromatic split, crossfading into #F3F3F1. */
export const transitionShader = {
  uniforms: {
    tScene: { value: null as unknown },
    uTransition: { value: 0 },
    uBg: { value: new Color('#F3F3F1') },
    uRes: { value: new Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = position.xy * 0.5 + 0.5;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    #define PI 3.14159265359
    uniform sampler2D tScene;
    uniform float uTransition;
    uniform vec3 uBg;
    varying vec2 vUv;
    void main() {
      float t = uTransition;
      vec2 uv = vUv;
      float amp = sin(t * PI);
      uv.y += sin(uv.x * 10.0 + t * 6.0) * 0.12 * amp;
      float split = 0.008 * amp;
      vec3 col;
      col.r = texture2D(tScene, uv + vec2(split, 0.0)).r;
      col.g = texture2D(tScene, uv).g;
      col.b = texture2D(tScene, uv - vec2(split, 0.0)).b;
      float fade = smoothstep(0.42, 0.96, t);
      col = mix(col, uBg, fade);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};
