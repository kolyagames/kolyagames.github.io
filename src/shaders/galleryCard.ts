export const galleryCardShader = {
  uniforms: {
    uMap: { value: null as unknown },
    uActive: { value: 0 },
    uBend: { value: 0 },
    uSplit: { value: 0 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    uniform float uBend;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec3 pos = position;
      float x = uv.x - 0.5;
      pos.z += (0.12 - x * x * 1.4) * 0.35 + x * uBend * 0.9;
      pos.y += sin(uv.x * 3.14159) * uBend * 0.12;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D uMap;
    uniform float uActive, uSplit;
    varying vec2 vUv;
    void main() {
      float s = uSplit * 0.012;
      vec3 c;
      c.r = texture2D(uMap, vUv + vec2(s, 0.0)).r;
      c.g = texture2D(uMap, vUv).g;
      c.b = texture2D(uMap, vUv - vec2(s, 0.0)).b;
      c *= mix(0.32, 1.0, uActive);
      // hairline edge light
      vec2 e = min(vUv, 1.0 - vUv);
      float edge = 1.0 - smoothstep(0.0, 0.004, min(e.x, e.y * 1.6));
      c += edge * 0.18 * uActive;
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }
  `,
};
