import { CanvasTexture, SRGBColorSpace } from 'three';
import { getCover } from './coverArt';
import type { Project } from '../data/projects';

const W = 1600;
const H = 1000;

/** Cover art + moody grade + bold white uppercase title baked into one card texture. */
export function makeGalleryTexture(p: Project, index: number, total: number): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(getCover(p.id), 0, 0, W, H);

  // high-contrast grade
  ctx.globalCompositeOperation = 'multiply';
  const mood = ctx.createLinearGradient(0, 0, 0, H);
  mood.addColorStop(0, 'rgba(70,70,80,1)');
  mood.addColorStop(0.55, 'rgba(150,150,160,1)');
  mood.addColorStop(1, 'rgba(40,40,48,1)');
  ctx.fillStyle = mood;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  const shade = ctx.createLinearGradient(0, H * 0.35, 0, H);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  // headline
  const family = '"Inter Variable", Inter, system-ui, sans-serif';
  const anyCtx = ctx as unknown as { letterSpacing: string };
  const lines = p.galleryLines;
  ctx.font = `800 240px ${family}`;
  if ('letterSpacing' in ctx) anyCtx.letterSpacing = `${-0.04 * 240}px`;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const fs = Math.min(250, (240 * (W * 0.84)) / widest);
  ctx.font = `800 ${fs}px ${family}`;
  if ('letterSpacing' in ctx) anyCtx.letterSpacing = `${-0.04 * fs}px`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'alphabetic';
  const lh = fs * 0.9;
  const baseY = H - 86;
  lines.forEach((line, i) => ctx.fillText(line, 72, baseY - (lines.length - 1 - i) * lh));

  // meta
  ctx.font = `500 26px ui-monospace, SFMono-Regular, Menlo, monospace`;
  if ('letterSpacing' in ctx) anyCtx.letterSpacing = '4px';
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.fillText(`0${index + 1} / 0${total}`, 72, 92);
  ctx.textAlign = 'right';
  ctx.fillText(p.category.toUpperCase(), W - 72, 92);

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
