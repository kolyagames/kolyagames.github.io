import { mulberry32 } from './rng';
import type { CoverId } from '../data/projects';

export const COVER_W = 1280;
export const COVER_H = 800;

type Ctx = CanvasRenderingContext2D;
type Rng = () => number;

const cache = new Map<CoverId, HTMLCanvasElement>();

function makeCanvas(): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = COVER_W;
  c.height = COVER_H;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

function grain(ctx: Ctx, amount: number, rng: Rng) {
  const img = ctx.getImageData(0, 0, COVER_W, COVER_H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function vignette(ctx: Ctx, strength: number) {
  const g = ctx.createRadialGradient(COVER_W / 2, COVER_H / 2, COVER_H * 0.35, COVER_W / 2, COVER_H / 2, COVER_W * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, COVER_W, COVER_H);
}

/* ------------------------------------------------------------------ 1. KIMSTAR */

function crystal(ctx: Ctx, cx: number, cy: number, s: number, rot: number, hue: number, rng: Rng) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  // glow
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 2.4);
  glow.addColorStop(0, `hsla(${hue},90%,60%,0.45)`);
  glow.addColorStop(1, `hsla(${hue},90%,50%,0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(-s * 3, -s * 3, s * 6, s * 6);
  ctx.globalCompositeOperation = 'source-over';

  const T: [number, number] = [0, -s * 1.5];
  const Bt: [number, number] = [s * 0.05, s * 1.5];
  const L: [number, number] = [-s * 0.8, -s * 0.05];
  const R: [number, number] = [s * 0.82, s * 0.08];
  const F: [number, number] = [s * 0.04, s * 0.42];
  const B: [number, number] = [-s * 0.08, -s * 0.36];
  const facets: [[number, number], [number, number], [number, number]][] = [
    [T, L, B], [T, B, R], [Bt, L, B], [Bt, B, R],
    [T, L, F], [T, F, R], [Bt, L, F], [Bt, F, R],
  ];
  facets.forEach((f, i) => {
    const light = 18 + rng() * 52 + (i >= 4 ? 8 : 0);
    ctx.beginPath();
    ctx.moveTo(f[0][0], f[0][1]);
    ctx.lineTo(f[1][0], f[1][1]);
    ctx.lineTo(f[2][0], f[2][1]);
    ctx.closePath();
    const g = ctx.createLinearGradient(f[0][0], f[0][1], f[2][0], f[2][1]);
    g.addColorStop(0, `hsla(${hue + rng() * 30},85%,${light + 14}%,0.92)`);
    g.addColorStop(1, `hsla(${hue - 10 + rng() * 20},80%,${light - 6}%,0.88)`);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1, s * 0.012);
    ctx.stroke();
  });
  // specular streak
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = s * 0.025;
  ctx.beginPath();
  ctx.moveTo(-s * 0.35, -s * 0.9);
  ctx.lineTo(-s * 0.1, -s * 0.2);
  ctx.stroke();
  ctx.restore();
}

function drawKimstar(ctx: Ctx, rng: Rng) {
  const w = COVER_W, h = COVER_H;
  const bg = ctx.createRadialGradient(w * 0.62, h * 0.42, 0, w * 0.5, h * 0.5, w * 0.85);
  bg.addColorStop(0, '#2d1b78');
  bg.addColorStop(0.4, '#140c3f');
  bg.addColorStop(1, '#04030f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // distant stars
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(200,190,255,${0.15 + rng() * 0.5})`;
    const r = rng() * 1.6 + 0.3;
    ctx.beginPath();
    ctx.arc(rng() * w, rng() * h, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // glowing trail ribbons
  ctx.globalCompositeOperation = 'lighter';
  const palette = ['#7c3aed', '#22d3ee', '#a78bfa', '#6366f1', '#e879f9', '#38bdf8'];
  for (let k = 0; k < 7; k++) {
    const y0 = h * (0.15 + rng() * 0.75);
    const amp = 90 + rng() * 170;
    const col = palette[k % palette.length];
    for (let layer = 0; layer < 6; layer++) {
      ctx.beginPath();
      const off = layer * 5;
      ctx.moveTo(-40, y0 + off);
      ctx.bezierCurveTo(w * 0.28, y0 - amp + off, w * 0.55, y0 + amp + off, w + 40, y0 - amp * 0.4 + off);
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.4, col + '99');
      g.addColorStop(0.75, col + 'dd');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 14 - layer * 2.2;
      ctx.shadowColor = col;
      ctx.shadowBlur = 28;
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = 'source-over';

  // crystals
  const specs: [number, number, number, number, number][] = [
    [0.66, 0.42, 120, -0.18, 262],
    [0.3, 0.62, 74, 0.35, 190],
    [0.84, 0.74, 58, -0.5, 300],
    [0.46, 0.24, 46, 0.22, 235],
    [0.14, 0.26, 40, -0.28, 275],
    [0.58, 0.78, 34, 0.6, 210],
  ];
  for (const [fx, fy, s, rot, hue] of specs) crystal(ctx, fx * w, fy * h, s, rot, hue, rng);

  // HUD brackets (client reference)
  ctx.strokeStyle = 'rgba(167,139,250,0.55)';
  ctx.lineWidth = 2;
  const m = 56, L = 44;
  const corners: [number, number, number, number][] = [
    [m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * L);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * L, y);
    ctx.stroke();
  }
  vignette(ctx, 0.55);
  grain(ctx, 14, rng);
}

/* ------------------------------------------------------------------ 2. BETTER VESKTOP */

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function uiBlock(
  ctx: Ctx, cx: number, cy: number, w: number, h: number, rot: number,
  top: string, bottom: string, depth: string, kind: 'chat' | 'sidebar' | 'pill' | 'card',
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.transform(1, -0.1, 0, 1, 0, 0);
  // floor shadow
  ctx.save();
  ctx.transform(1, 0, 0.0, 0.3, 0, h * 0.95);
  ctx.filter = 'blur(18px)';
  ctx.fillStyle = 'rgba(70,90,130,0.28)';
  roundRect(ctx, -w / 2 + 10, -h / 2 + 24, w - 20, h, 28);
  ctx.fill();
  ctx.restore();
  // extruded side
  ctx.fillStyle = depth;
  roundRect(ctx, -w / 2 + 14, -h / 2 + 16, w, h, 26);
  ctx.fill();
  // face
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  roundRect(ctx, -w / 2, -h / 2, w, h, 26);
  ctx.fill();
  // top highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  roundRect(ctx, -w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 25);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  if (kind === 'chat') {
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(-w / 2 + 46, -h / 2 + 52 + i * 62, 17, 0, Math.PI * 2);
      ctx.fill();
      roundRect(ctx, -w / 2 + 78, -h / 2 + 38 + i * 62, (w - 130) * (0.45 + ((i * 37) % 50) / 100), 12, 6);
      ctx.fill();
      roundRect(ctx, -w / 2 + 78, -h / 2 + 60 + i * 62, (w - 130) * (0.25 + ((i * 53) % 40) / 100), 10, 5);
      ctx.fill();
    }
  } else if (kind === 'sidebar') {
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(0, -h / 2 + 44 + i * 58, 20, 0, Math.PI * 2);
      ctx.fillStyle = i === 1 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)';
      ctx.fill();
    }
  } else if (kind === 'pill') {
    roundRect(ctx, -w / 2 + 24, -h / 2 + h * 0.3, w - 48, h * 0.4, h * 0.2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w / 2 - 54, 0, h * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    roundRect(ctx, -w / 2 + 28, -h / 2 + 28, w * 0.42, 14, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 3; i++) {
      roundRect(ctx, -w / 2 + 28, -h / 2 + 62 + i * 26, w - 56 - i * 40, 10, 5);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawVesktop(ctx: Ctx, rng: Rng) {
  const w = COVER_W, h = COVER_H;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#f2f6fb');
  bg.addColorStop(0.62, '#e5edf6');
  bg.addColorStop(1, '#f6e9e5');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // studio sweep light
  const sw = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, w * 0.6);
  sw.addColorStop(0, 'rgba(255,255,255,0.9)');
  sw.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sw;
  ctx.fillRect(0, 0, w, h);

  uiBlock(ctx, w * 0.36, h * 0.5, 440, 300, -0.06, '#b6d4f8', '#86b0ee', '#6b93d4', 'chat');
  uiBlock(ctx, w * 0.67, h * 0.4, 150, 330, 0.07, '#ffb9a7', '#f48f7c', '#d6705e', 'sidebar');
  uiBlock(ctx, w * 0.63, h * 0.74, 360, 120, -0.03, '#ffffff', '#e8eff8', '#c4d2e6', 'pill');
  uiBlock(ctx, w * 0.17, h * 0.27, 230, 150, 0.05, '#ffcdbf', '#fba897', '#dc8573', 'card');
  uiBlock(ctx, w * 0.86, h * 0.76, 150, 150, -0.08, '#9fc6f6', '#74a2e6', '#5a86c8', 'card');

  // floating dots
  for (let i = 0; i < 14; i++) {
    const r = 6 + rng() * 14;
    ctx.beginPath();
    ctx.arc(rng() * w, rng() * h, r, 0, Math.PI * 2);
    ctx.fillStyle = rng() > 0.5 ? 'rgba(244,143,124,0.55)' : 'rgba(134,176,238,0.55)';
    ctx.fill();
  }
  grain(ctx, 6, rng);
}

/* ------------------------------------------------------------------ 3. BODYCAM */

function drawBodycam(ctx: Ctx, rng: Rng) {
  const w = COVER_W, h = COVER_H;
  const vpx = w * 0.52, vpy = h * 0.47;
  const halfW = w * 0.95, halfH = h * 0.95;
  const sOf = (z: number) => 1 / (1 + 4.2 * z);
  const P = (x: number, y: number, z: number): [number, number] => {
    const s = sOf(z);
    return [vpx + x * halfW * s, vpy + y * halfH * s];
  };
  const quad = (pts: [number, number][], fill: string | CanvasGradient) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  ctx.fillStyle = '#031412';
  ctx.fillRect(0, 0, w, h);
  const zb = 1;
  // floor / ceiling / walls / back
  let g = ctx.createLinearGradient(0, h, 0, vpy);
  g.addColorStop(0, '#0c3b35'); g.addColorStop(1, '#0a2824');
  quad([P(-1, 1, 0), P(1, 1, 0), P(1, 1, zb), P(-1, 1, zb)], g);
  g = ctx.createLinearGradient(0, 0, 0, vpy);
  g.addColorStop(0, '#04201d'); g.addColorStop(1, '#0a2f2a');
  quad([P(-1, -1, 0), P(1, -1, 0), P(1, -1, zb), P(-1, -1, zb)], g);
  g = ctx.createLinearGradient(0, 0, vpx, 0);
  g.addColorStop(0, '#0b3a34'); g.addColorStop(1, '#0d4a42');
  quad([P(-1, -1, 0), P(-1, 1, 0), P(-1, 1, zb), P(-1, -1, zb)], g);
  g = ctx.createLinearGradient(w, 0, vpx, 0);
  g.addColorStop(0, '#07292a'); g.addColorStop(1, '#0a3a38');
  quad([P(1, -1, 0), P(1, 1, 0), P(1, 1, zb), P(1, -1, zb)], g);
  const back = ctx.createLinearGradient(0, P(-1, -1, zb)[1], 0, P(-1, 1, zb)[1]);
  back.addColorStop(0, '#7bd9c3'); back.addColorStop(1, '#2a8f7c');
  quad([P(-1, -1, zb), P(1, -1, zb), P(1, 1, zb), P(-1, 1, zb)], back);

  // ceiling beams & pillars
  for (let i = 0; i < 9; i++) {
    const z = 0.04 + i * 0.105;
    const dz = 0.035;
    quad([P(-1, -1, z), P(1, -1, z), P(1, -1, z + dz), P(-1, -1, z + dz)], 'rgba(2,14,13,0.85)');
    quad([P(-1, -1, z), P(-0.9, -0.88, z), P(-0.9, 0.9, z), P(-1, 1, z)], 'rgba(3,22,20,0.9)');
    quad([P(1, -1, z), P(0.9, -0.88, z), P(0.9, 0.9, z), P(1, 1, z)], 'rgba(3,22,20,0.9)');
  }

  // window openings on the left wall emitting light
  ctx.globalCompositeOperation = 'lighter';
  const wins: [number, number][] = [[0.2, 0.34], [0.46, 0.58]];
  for (const [z0, z1] of wins) {
    const win = [P(-1, -0.55, z0), P(-1, -0.55, z1), P(-1, 0.15, z1), P(-1, 0.15, z0)] as [number, number][];
    quad(win, 'rgba(210,255,240,0.95)');
    // volumetric shaft across the room onto the floor
    const sh = [P(-1, -0.55, z0), P(-1, 0.15, z0), P(0.55, 1, z1 + 0.18), P(0.2, 1, z0 + 0.06), P(-1, -0.55, z1)] as [number, number][];
    const a = win[0], b = P(0.4, 1, z1 + 0.1);
    const sg = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    sg.addColorStop(0, 'rgba(180,255,230,0.42)');
    sg.addColorStop(1, 'rgba(120,230,200,0.02)');
    quad(sh, sg);
    const sh2 = [P(-1, -0.55, z1), P(-1, 0.15, z1), P(0.9, 1, z1 + 0.3), P(0.55, 1, z1 + 0.18)] as [number, number][];
    quad(sh2, sg);
  }
  // haze at the end of the corridor
  const haze = ctx.createRadialGradient(vpx, vpy, 0, vpx, vpy, h * 0.55);
  haze.addColorStop(0, 'rgba(190,255,235,0.55)');
  haze.addColorStop(1, 'rgba(190,255,235,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';

  // silhouette operator crouching in the corridor (tiny, for scale)
  ctx.fillStyle = 'rgba(2,10,10,0.9)';
  const sx = vpx + 70, sy = P(0, 1, 0.78)[1];
  ctx.beginPath();
  ctx.ellipse(sx, sy - 34, 11, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  roundRect(ctx, sx - 16, sy - 22, 32, 38, 6);
  ctx.fill();

  // bodycam overlay: REC + timestamp rendered as shapes (no font dependency)
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(70, 66, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(220,255,245,0.75)';
  for (let i = 0; i < 7; i++) roundRect(ctx, 96 + i * 16, 58, 10, 16, 2), ctx.fill();
  ctx.strokeStyle = 'rgba(220,255,245,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, w - 72, h - 72);
  // crosshair
  ctx.beginPath();
  ctx.moveTo(vpx - 22, vpy); ctx.lineTo(vpx - 7, vpy);
  ctx.moveTo(vpx + 7, vpy); ctx.lineTo(vpx + 22, vpy);
  ctx.moveTo(vpx, vpy - 22); ctx.lineTo(vpx, vpy - 7);
  ctx.moveTo(vpx, vpy + 7); ctx.lineTo(vpx, vpy + 22);
  ctx.stroke();

  vignette(ctx, 0.7);
  grain(ctx, 22, rng);
}

/* ------------------------------------------------------------------ 4. STOREFRONT */

function isoCube(
  ctx: Ctx, cx: number, cy: number, s: number,
  top: string, left: string, right: string, alpha: number,
) {
  const dx = s * 0.866, dy = s * 0.5;
  const faces: [string, [number, number][]][] = [
    [top, [[cx, cy - s], [cx + dx, cy - dy], [cx, cy], [cx - dx, cy - dy]]],
    [left, [[cx - dx, cy - dy], [cx, cy], [cx, cy + s], [cx - dx, cy + dy]]],
    [right, [[cx + dx, cy - dy], [cx + dx, cy + dy], [cx, cy + s], [cx, cy]]],
  ];
  ctx.globalAlpha = alpha;
  for (const [col, pts] of faces) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // inner core for glass depth
  const k = 0.45;
  ctx.globalAlpha = alpha * 0.55;
  const ix = cx, iy = cy - s * 0.04;
  const idx = dx * k, idy = dy * k, isz = s * k;
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(ix, iy - isz); ctx.lineTo(ix + idx, iy - idy); ctx.lineTo(ix, iy); ctx.lineTo(ix - idx, iy - idy);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  // edge specular
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - dx, cy - dy);
  ctx.lineTo(cx, cy - s);
  ctx.lineTo(cx + dx, cy - dy);
  ctx.stroke();
}

function softShadow(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, a: number) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, `rgba(0,0,0,${a})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  ctx.translate(-cx, -cy);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStorefront(ctx: Ctx, rng: Rng) {
  const w = COVER_W, h = COVER_H;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0a0809');
  bg.addColorStop(0.55, '#1a1011');
  bg.addColorStop(1, '#2a1812');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // warm studio glow
  const gl = ctx.createRadialGradient(w * 0.5, h * 0.62, 0, w * 0.5, h * 0.62, w * 0.55);
  gl.addColorStop(0, 'rgba(245,158,11,0.38)');
  gl.addColorStop(0.5, 'rgba(190,18,60,0.14)');
  gl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(0, 0, w, h);
  // floor line
  ctx.fillStyle = 'rgba(255,200,150,0.05)';
  ctx.fillRect(0, h * 0.7, w, h * 0.3);

  const cubes: [number, number, number, string, string, string, number][] = [
    // x, y, size, top, left, right, alpha
    [0.5, 0.72, 150, '#fbbf24', '#d97706', '#b45309', 0.78],
    [0.3, 0.64, 110, '#fb7185', '#be123c', '#881337', 0.8],
    [0.7, 0.62, 118, '#3f3f46', '#18181b', '#09090b', 0.92],
    [0.5, 0.45, 106, '#f59e0b', '#b91c1c', '#7f1d1d', 0.72],
    [0.18, 0.78, 70, '#27272a', '#101012', '#050506', 0.95],
    [0.84, 0.78, 78, '#fda4af', '#e11d48', '#9f1239', 0.7],
  ];
  for (const [fx, fy, s] of cubes) softShadow(ctx, fx * w + 40, fy * h + s * 0.95, s * 1.7, s * 0.55, 0.55);
  for (const [fx, fy, s, t, l, r, a] of cubes) isoCube(ctx, fx * w, fy * h, s, t, l, r, a);

  // floating particles
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(255,${150 + rng() * 80},${60 + rng() * 60},${rng() * 0.5})`;
    ctx.beginPath();
    ctx.arc(rng() * w, rng() * h * 0.8, rng() * 2.2 + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  vignette(ctx, 0.6);
  grain(ctx, 12, rng);
}

/* ------------------------------------------------------------------ 5. DEV SUITE */

function drawDevsuite(ctx: Ctx, rng: Rng) {
  const w = COVER_W, h = COVER_H;
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#e4e4e4');
  bg.addColorStop(1, '#a9a9a9');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // perspective wireframe floor grid
  const horizon = h * 0.42;
  ctx.strokeStyle = 'rgba(20,20,20,0.35)';
  ctx.lineWidth = 1.2;
  for (let i = -24; i <= 24; i++) {
    ctx.beginPath();
    ctx.moveTo(w / 2 + i * 22, horizon);
    ctx.lineTo(w / 2 + i * 150, h + 20);
    ctx.stroke();
  }
  for (let j = 0; j < 18; j++) {
    const t = Math.pow(j / 17, 2.1);
    const y = horizon + t * (h - horizon + 20);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // horizon fade
  const fade = ctx.createLinearGradient(0, horizon - 10, 0, horizon + 140);
  fade.addColorStop(0, 'rgba(214,214,214,1)');
  fade.addColorStop(1, 'rgba(214,214,214,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, horizon - 10, w, 150);

  // chrome torus (painter's algorithm over a parametric mesh)
  const U = 72, V = 28, R = 210, r = 92;
  const ax = 0.95, ay = -0.35;
  const cax = Math.cos(ax), sax = Math.sin(ax), cay = Math.cos(ay), say = Math.sin(ay);
  const cx = w * 0.5, cy = h * 0.5;
  const rot = (x: number, y: number, z: number): [number, number, number] => {
    const y1 = y * cax - z * sax;
    const z1 = y * sax + z * cax;
    const x2 = x * cay + z1 * say;
    const z2 = -x * say + z1 * cay;
    return [x2, y1, z2];
  };
  const pt = (u: number, v: number) => {
    const a = (u / U) * Math.PI * 2, b = (v / V) * Math.PI * 2;
    const x = (R + r * Math.cos(b)) * Math.cos(a);
    const y = (R + r * Math.cos(b)) * Math.sin(a);
    const z = r * Math.sin(b);
    return rot(x, y, z);
  };
  const nrm = (u: number, v: number) => {
    const a = (u / U) * Math.PI * 2, b = (v / V) * Math.PI * 2;
    return rot(Math.cos(b) * Math.cos(a), Math.cos(b) * Math.sin(a), Math.sin(b));
  };
  // ground shadow
  softShadow(ctx, cx + 30, cy + 250, 330, 70, 0.4);
  const quads: { d: number; p: [number, number, number][]; n: [number, number, number] }[] = [];
  for (let u = 0; u < U; u++) {
    for (let v = 0; v < V; v++) {
      const p = [pt(u, v), pt(u + 1, v), pt(u + 1, v + 1), pt(u, v + 1)];
      const n = nrm(u + 0.5, v + 0.5);
      const d = (p[0][2] + p[1][2] + p[2][2] + p[3][2]) / 4;
      quads.push({ d, p, n });
    }
  }
  quads.sort((a, b) => a.d - b.d);
  for (const q of quads) {
    if (q.n[2] < -0.05) continue; // back-face
    const [nx, ny, nz] = q.n;
    // fake studio env: horizon band + soft boxes
    const refl = ny * 0.9 + nx * 0.25;
    let l = 0.5 + 0.5 * Math.sin(refl * 7.5 + 1.2);
    l = Math.pow(l, 1.6);
    const box = Math.max(0, 1 - Math.abs(ny + 0.55) * 7) * 0.5 + Math.max(0, nx * 0.6 + nz * 0.3) * 0.25;
    const lum = Math.min(255, Math.max(8, 30 + l * 175 + box * 90));
    ctx.beginPath();
    ctx.moveTo(cx + q.p[0][0], cy + q.p[0][1]);
    for (let i = 1; i < 4; i++) ctx.lineTo(cx + q.p[i][0], cy + q.p[i][1]);
    ctx.closePath();
    ctx.fillStyle = `rgb(${lum},${lum},${lum + 4})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${lum},${lum},${lum},0.9)`;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  // precision wireframe overlay ring
  ctx.strokeStyle = 'rgba(10,10,10,0.55)';
  ctx.lineWidth = 1;
  for (let u = 0; u < U; u += 6) {
    ctx.beginPath();
    for (let v = 0; v <= V; v++) {
      const p = pt(u, v);
      const x = cx + p[0] * 1.012, y = cy + p[1] * 1.012;
      if (v === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // corner crosshair marks
  ctx.strokeStyle = 'rgba(10,10,10,0.7)';
  ctx.lineWidth = 1.5;
  for (const [x, y] of [[60, 60], [w - 60, 60], [60, h - 60], [w - 60, h - 60]] as [number, number][]) {
    ctx.beginPath();
    ctx.moveTo(x - 14, y); ctx.lineTo(x + 14, y);
    ctx.moveTo(x, y - 14); ctx.lineTo(x, y + 14);
    ctx.stroke();
  }
  vignette(ctx, 0.25);
  grain(ctx, 10, rng);
}

/* ------------------------------------------------------------------ public API */

const painters: Record<CoverId, (ctx: Ctx, rng: Rng) => void> = {
  kimstar: drawKimstar,
  vesktop: drawVesktop,
  bodycam: drawBodycam,
  storefront: drawStorefront,
  devsuite: drawDevsuite,
};

const seeds: Record<CoverId, number> = { kimstar: 11, vesktop: 23, bodycam: 37, storefront: 53, devsuite: 71 };

/** Lazily renders & caches the procedural cover art for a project (1280×800 canvas). */
export function getCover(id: CoverId): HTMLCanvasElement {
  const hit = cache.get(id);
  if (hit) return hit;
  const [canvas, ctx] = makeCanvas();
  painters[id](ctx, mulberry32(seeds[id]));
  cache.set(id, canvas);
  return canvas;
}
