/**
 * Re-draws every `[data-gl-text]` element of `container` into a 2D canvas, using the DOM's own layout
 * (rects, fonts, tracking, colour from `data-gl-color`). This lets WebGL refract / warp the real typography
 * while the DOM copy stays for layout, selection and accessibility.
 */
export function drawDomTexts(container: HTMLElement, canvas: HTMLCanvasElement, dpr: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const root = container.getBoundingClientRect();
  const els = container.querySelectorAll<HTMLElement>('[data-gl-text]');
  els.forEach((el) => {
    const cs = getComputedStyle(el);
    const raw = el.textContent ?? '';
    const text = cs.textTransform === 'uppercase' ? raw.toUpperCase() : raw;
    if (!text.trim()) return;

    const range = document.createRange();
    range.selectNodeContents(el);
    const tr = range.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    if (tr.width === 0) return;

    const fontSize = parseFloat(cs.fontSize);
    const lineHeight = cs.lineHeight === 'normal' ? fontSize * 1.2 : parseFloat(cs.lineHeight);
    const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${fontSize}px ${cs.fontFamily}`;
    ctx.fillStyle = el.dataset.glColor ?? '#111';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    const anyCtx = ctx as unknown as { letterSpacing: string };
    if ('letterSpacing' in ctx) anyCtx.letterSpacing = `${ls}px`;

    const m = ctx.measureText(text);
    const fa = m.fontBoundingBoxAscent ?? fontSize * 0.95;
    const fd = m.fontBoundingBoxDescent ?? fontSize * 0.25;
    const baseline = er.top - root.top + (lineHeight - (fa + fd)) / 2 + fa;
    // CSS letter-spacing adds trailing space after the last glyph; the range rect includes it.
    const x = tr.left - root.left;
    ctx.fillText(text, x, baseline);
    ctx.restore();
  });
}

/** Resolve once the faces we draw into canvases are ready. */
export async function loadFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('300 64px "Inter Variable"'),
      document.fonts.load('700 64px "Inter Variable"'),
      document.fonts.load('italic 400 64px "Playfair Display Variable"'),
    ]);
    await document.fonts.ready;
  } catch {
    /* fall back to system fonts */
  }
}
