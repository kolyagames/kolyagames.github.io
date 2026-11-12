import { useEffect, useRef } from 'react';
import { getCover } from '../lib/coverArt';
import { thumbFragment, thumbVertex } from '../shaders/cardThumb';
import type { CoverId } from '../data/projects';

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) throw new Error('shader');
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader compile failed');
  return s;
}

/** 16:10 thumbnail: procedural cover art on a tiny WebGL2 canvas with a hover ripple/zoom/RGB-split shader. */
export default function ProjectThumb({ id, delay = 0 }: { id: CoverId; delay?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'absolute inset-0 h-full w-full';
    wrap.appendChild(canvas);

    let raf = 0;
    let disposed = false;
    let hover = 0;
    let target = 0;
    const mouse = { x: 0.5, y: 0.5 };
    let cleanupGL: (() => void) | null = null;

    const init = () => {
      if (disposed) return;
      const cover = getCover(id);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });

      const size = () => {
        const w = Math.max(2, Math.round(wrap.clientWidth * dpr));
        const h = Math.max(2, Math.round(wrap.clientHeight * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        return [w, h] as const;
      };

      if (!gl) {
        // graceful fallback: static 2D cover
        const [w, h] = size();
        canvas.getContext('2d')?.drawImage(cover, 0, 0, w, h);
        return;
      }

      const prog = gl.createProgram();
      if (!prog) return;
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, thumbVertex));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, thumbFragment));
      gl.linkProgram(prog);
      gl.useProgram(prog);

      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cover);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const U = (n: string) => gl.getUniformLocation(prog, n);
      const uTime = U('uTime'), uHover = U('uHover'), uAspect = U('uAspect'), uMouse = U('uMouse'), uTex = U('uTex');

      const render = () => {
        const [w, h] = size();
        gl.viewport(0, 0, w, h);
        gl.useProgram(prog);
        gl.uniform1i(uTex, 0);
        gl.uniform1f(uTime, performance.now() / 1000);
        gl.uniform1f(uHover, hover);
        gl.uniform1f(uAspect, w / h);
        gl.uniform2f(uMouse, mouse.x, mouse.y);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };

      const loop = () => {
        raf = 0;
        hover += (target - hover) * 0.12;
        if (Math.abs(target - hover) < 0.003) hover = target;
        render();
        if (hover > 0 || target > 0) raf = requestAnimationFrame(loop);
      };
      const kick = () => {
        if (!raf) raf = requestAnimationFrame(loop);
      };

      const onEnter = () => {
        target = 1;
        kick();
      };
      const onLeave = () => {
        target = 0;
        kick();
      };
      const onMove = (e: PointerEvent) => {
        const r = wrap.getBoundingClientRect();
        mouse.x = (e.clientX - r.left) / r.width;
        mouse.y = 1 - (e.clientY - r.top) / r.height;
      };
      wrap.addEventListener('pointerenter', onEnter);
      wrap.addEventListener('pointerleave', onLeave);
      wrap.addEventListener('pointermove', onMove);
      const ro = new ResizeObserver(() => render());
      ro.observe(wrap);
      render();

      cleanupGL = () => {
        wrap.removeEventListener('pointerenter', onEnter);
        wrap.removeEventListener('pointerleave', onLeave);
        wrap.removeEventListener('pointermove', onMove);
        ro.disconnect();
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      };
    };

    const timer = window.setTimeout(init, delay);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
      cleanupGL?.();
      canvas.remove();
    };
  }, [id, delay]);

  return <div ref={wrapRef} className="relative aspect-[16/10] w-full overflow-hidden rounded-[4px] bg-[#e6e6e3]" />;
}
