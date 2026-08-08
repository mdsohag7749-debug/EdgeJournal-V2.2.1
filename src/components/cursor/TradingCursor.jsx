import { useEffect, useRef, useState } from 'react';
import './TradingCursor.css';

// Custom EdgeJournal trading cursor + candle-particle signature.
//
// A thin ring with a small center dot follows the real pointer with a tiny
// amount of easing (rAF + refs, no React state on mousemove). While the
// pointer moves, a small number of miniature candlesticks spawn on a
// full-screen canvas behind the cursor and fade out — bullish candles use
// the EdgeJournal green accent (#2fd66e), bearish candles the red accent
// (#ff4d5e). No other colors are used.
//
// Modes:
//   full        fine-pointer hover-capable devices -> ring + dot + canvas
//   simplified  hover-capable but NOT a fine pointer (tablet+trackpad)
//               -> ring + dot, no particle canvas
//   off         touch-only / reduced-motion -> renders nothing, so the
//               native cursor stays untouched and no effect is injected.
//
// Reduced-motion users get a completely empty render, so the site's
// branding/wordmark remain static and the default cursor does the work.

const MAX_PARTICLES = 30;
const SPAWN_INTERVAL_MS = 90;
const MIN_MOVE_DIST_SQ = 340;
const RING_EASE = 0.16;
const DOT_EASE = 0.55;
const WIN = '#2fd66e';
const LOSS = '#ff4d5e';

// Elements we treat as interactive for hover feedback.
const INTERACTIVE = 'a[href],button,[role="button"],input,select,textarea,summary,[tabindex]:not([tabindex="-1"])';

function resolveMode() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'off';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'off';
  const fine = window.matchMedia('(pointer: fine)').matches;
  const hover = window.matchMedia('(hover: hover)').matches;
  const anyHover = window.matchMedia('(any-hover: hover)').matches;
  if (fine && hover) return 'full';
  if (hover || anyHover) return 'simplified';
  return 'off';
}

export default function TradingCursor() {
  const [mode, setMode] = useState(resolveMode);
  const canvasRef = useRef(null);
  const ringRef = useRef(null);
  const dotRef = useRef(null);

  // Keep track of capability changes (pointer type / reduced motion).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const queries = ['(prefers-reduced-motion: reduce)', '(pointer: fine)', '(hover: hover)', '(any-hover: hover)'];
    const mqs = queries.map((q) => window.matchMedia(q));
    const onChange = () => setMode(resolveMode());
    const listen = (mq) => {
      try {
        mq.addEventListener?.('change', onChange);
      } catch {
        /* older browsers */
      }
    };
    const cleanup = (mq) => {
      try {
        mq.removeEventListener?.('change', onChange);
      } catch {
        /* older browsers */
      }
    };
    mqs.forEach(listen);
    return () => mqs.forEach(cleanup);
  }, []);

  // Engine: single rAF loop driving ring, dot and candle canvas. All state
  // lives in refs / closure vars — mousemove never triggers a re-render.
  useEffect(() => {
    if (mode === 'off') return undefined;

    const canvas = canvasRef.current;
    const ring = ringRef.current;
    const dot = dotRef.current;
    const ctx = canvas?.getContext?.('2d') ?? null;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    let pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let ringX = pointer.x;
    let ringY = pointer.y;
    let dotX = pointer.x;
    let dotY = pointer.y;
    let visible = false;
    let over = 'none'; // none | hover | button | link | input
    let buttonCenter = null;
    let pressGlow = 0;
    let scale = 1;
    let targetScale = 1;

    // Particle pool with fixed capacity.
    const pool = Array.from({ length: MAX_PARTICLES }, () => ({ active: false }));
    const lastSpawn = { t: -Infinity, x: -Infinity, y: -Infinity };

    const setNativeHidden = (hidden) => {
      document.documentElement.classList.toggle('cursor-hidden', hidden);
    };

    const spawnAt = (x, y) => {
      const now = performance.now();
      if (now - lastSpawn.t < SPAWN_INTERVAL_MS) return;
      const dx = x - lastSpawn.x;
      const dy = y - lastSpawn.y;
      if (dx * dx + dy * dy < MIN_MOVE_DIST_SQ) return;
      lastSpawn.t = now;
      lastSpawn.x = x;
      lastSpawn.y = y;

      const count = Math.random() < 0.5 ? 2 : 1;
      for (let s = 0; s < count; s += 1) {
        const p = pool.find((q) => !q.active);
        if (!p) break;
        const bullish = Math.random() < 0.5;
        const bodyH = 4 + Math.random() * 10;
        p.active = true;
        p.baseX = x + (Math.random() - 0.5) * 16;
        p.baseY = y + (Math.random() - 0.5) * 12;
        p.bodyH = bodyH;
        p.bodyW = 3.5;
        p.wick = bodyH * 0.9 + 2;
        p.vx = (Math.random() - 0.5) * 0.02;
        p.vy = (bullish ? 1 : -1) * (0.006 + Math.random() * 0.014);
        p.born = now;
        p.ttl = 500 + Math.random() * 480;
        p.color = bullish ? WIN : LOSS;
      }
    };

    const draw = () => {
      const now = performance.now();
      ctx.clearRect(0, 0, canvas.width / DPR, canvas.height / DPR);
      for (let i = 0; i < pool.length; i += 1) {
        const p = pool[i];
        if (!p.active) continue;
        const age = now - p.born;
        if (age > p.ttl) {
          p.active = false;
          continue;
        }
        const life = 1 - age / p.ttl;
        const px = p.baseX + p.vx * age;
        const py = p.baseY + p.vy * age;
        ctx.globalAlpha = life * (life > 0.8 ? 1 : 0.85);
        ctx.strokeStyle = p.color;
        ctx.fillStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py - p.wick);
        ctx.lineTo(px, py + p.wick);
        ctx.stroke();
        ctx.fillRect(px - p.bodyW / 2, py - p.bodyH / 2, p.bodyW, p.bodyH);
      }
      ctx.globalAlpha = 1;
    };

    const onPointerMove = (e) => {
      pointer = { x: e.clientX, y: e.clientY };
      if (!visible) {
        // Snap into place on the first frame so the cursor never visibly
        // travels from the page center to the pointer.
        ringX = pointer.x;
        ringY = pointer.y;
        dotX = pointer.x;
        dotY = pointer.y;
        visible = true;
      }
      if (mode === 'full' && ctx) spawnAt(pointer.x, pointer.y);
    };

    const onPointerOver = (e) => {
      const el = e.target?.closest?.(INTERACTIVE);
      buttonCenter = null;
      if (!el) {
        over = 'none';
        return;
      }
      if (el.matches('button,[role="button"]')) {
        over = 'button';
        const r = el.getBoundingClientRect();
        buttonCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      } else if (el.matches('input,select,textarea')) {
        over = 'input';
      } else if (el.matches('a[href]')) {
        over = 'link';
      } else {
        over = 'hover';
      }
    };

    const onPointerOut = (e) => {
      if (!e.relatedTarget || !e.relatedTarget?.closest?.(INTERACTIVE)) {
        over = 'none';
        buttonCenter = null;
      }
    };

    const onMouseLeave = () => {
      visible = false;
      setNativeHidden(false);
    };

    const onPointerDown = () => {
      pressGlow = 1;
    };

    // ----- rAF loop -----
    const loop = () => {
      rafId = requestAnimationFrame(loop);

      ringX += (pointer.x - ringX) * RING_EASE;
      ringY += (pointer.y - ringY) * RING_EASE;
      dotX += (pointer.x - dotX) * DOT_EASE;
      dotY += (pointer.y - dotY) * DOT_EASE;

      // Magnetic pull — tiny fraction only, native cursor position is never
      // overwritten, so clicks still hit exactly the button the user aimed at.
      if (over === 'button' && buttonCenter) {
        ringX += (buttonCenter.x - ringX) * 0.05;
        ringY += (buttonCenter.y - ringY) * 0.05;
        dotX += (buttonCenter.x - dotX) * 0.03;
        dotY += (buttonCenter.y - dotY) * 0.03;
      }

      let targetOpacity = 0.75;
      let dotOpacity = 0.95;
      switch (over) {
        case 'button':
          targetScale = 1.14;
          break;
        case 'hover':
          targetScale = 1.06;
          targetOpacity = 0.9;
          break;
        case 'link':
          targetScale = 0.92;
          break;
        case 'input':
          targetScale = 1;
          targetOpacity = 0.45;
          break;
        default:
          targetScale = 1;
      }
      scale += (targetScale - scale) * 0.12;
      pressGlow *= 0.92;

      const shownScale = scale * (1 + pressGlow * 0.6);
      const showRingOpacity = visible ? targetOpacity : 0;

      let ringColor = 'rgba(255,255,255,0.7)';
      let ringShadow = '0 0 0 1px rgba(255,255,255,0.05) inset, 0 0 14px rgba(193,18,31,0.22)';
      if (over === 'button') {
        ringColor = 'rgba(255,255,255,0.9)';
        ringShadow = '0 0 0 1px rgba(255,255,255,0.06) inset, 0 0 18px rgba(193,18,31,0.45)';
      } else if (over === 'link') {
        ringColor = 'rgba(255,77,94,0.9)';
        ringShadow = '0 0 0 1px rgba(255,255,255,0.05) inset, 0 0 14px rgba(255,77,94,0.4)';
      } else if (over === 'input') {
        ringColor = 'rgba(255,255,255,0.35)';
      }

      ring.style.opacity = String(showRingOpacity);
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%) scale(${shownScale})`;
      ring.style.boxShadow = ringShadow;
      ring.style.borderColor = ringColor;
      dot.style.opacity = String(visible ? dotOpacity : 0);
      dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%, -50%)`;

      if (ctx && mode === 'full') draw();
      setNativeHidden(visible);
    };

    const resizeCanvas = () => {
      if (!canvas) return;
      canvas.width = Math.floor(window.innerWidth * DPR);
      canvas.height = Math.floor(window.innerHeight * DPR);
      ctx?.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resizeCanvas();

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerover', onPointerOver);
    document.addEventListener('pointerout', onPointerOut);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('blur', onMouseLeave);
    window.addEventListener('resize', resizeCanvas);

    let rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerover', onPointerOver);
      document.removeEventListener('pointerout', onPointerOut);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('blur', onMouseLeave);
      window.removeEventListener('resize', resizeCanvas);
      setNativeHidden(false);
      pool.forEach((p) => {
        p.active = false;
      });
      ctx?.clearRect(0, 0, canvas?.width ?? 0, canvas?.height ?? 0);
      ctx?.setTransform(1, 0, 0, 1, 0, 0);
    };
  }, [mode]);

  if (mode === 'off') return null;

  return (
    <span className="cursor-overlay" aria-hidden="true">
      {mode === 'full' && <canvas ref={canvasRef} className="cursor-canvas" />}
      <span ref={ringRef} className="cursor-ring" />
      <span ref={dotRef} className="cursor-dot" />
    </span>
  );
}