/** Raw WebGL2 shader for project thumbnails: ripple-wave distortion + zoom + RGB edge split on hover. */
export const thumbVertex = /* glsl */ `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export const thumbFragment = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform float uTime, uHover, uAspect;
uniform vec2 uMouse;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 uv = vUv;
  vec2 dm = (uv - uMouse) * vec2(uAspect, 1.0);
  float d = length(dm);
  vec2 dir = normalize(dm + 1e-4);
  float wave = sin(d * 38.0 - uTime * 5.5) * exp(-d * 3.4) * uHover;
  uv += dir * vec2(1.0 / uAspect, 1.0) * wave * 0.012;
  // 1.04x zoom around the centre
  uv = (uv - 0.5) / (1.0 + 0.04 * uHover) + 0.5;
  // RGB edge split grows toward the edges
  vec2 c = vUv - 0.5;
  float edge = smoothstep(0.1, 0.75, length(c));
  vec2 split = normalize(c + 1e-4) * 0.006 * uHover * (0.25 + edge);
  float r = texture(uTex, uv + split).r;
  float g = texture(uTex, uv).g;
  float b = texture(uTex, uv - split).b;
  outColor = vec4(r, g, b, 1.0);
}`;
