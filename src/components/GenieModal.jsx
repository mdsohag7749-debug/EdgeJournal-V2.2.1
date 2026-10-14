import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { GENIE_CONFIG, GENIE_DEBUG, clamp, easeInOutCubic, stripTransform } from './genieMath';
import { createGenieStripClones } from './genieDom';
import GenieLightbox from './GenieLightbox';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const GenieModal = forwardRef(function GenieModal({ renderContent, onExpandedChange }, ref) {
  const [active, setActive] = useState(null);
  const [phase, setPhase] = useState('closed');
  const onExpandedChangeRef = useRef(onExpandedChange);
  const backdropRef = useRef(null);
  const debugBadgeRef = useRef(null);
  const screenshotDebugDeltasRef = useRef([]);
  const screenshotDebugTextRef = useRef('');
  const panelRef = useRef(null);
  const layerRef = useRef(null);
  const lightboxRef = useRef(null);
  const nestedImageOpenRef = useRef(false);
  const activeRef = useRef(null);
  const phaseRef = useRef('closed');
  const pendingRef = useRef(null);
  const animRef = useRef(0);
  const restoreRef = useRef(null);
  const bodyStyleRef = useRef(null);
  const stripCountRef = useRef(typeof navigator !== 'undefined' && navigator.hardwareConcurrency <= 4 ? 24 : GENIE_CONFIG.strips);

  const screenshotAnimationStart = useCallback((kind) => {
    if (!GENIE_DEBUG || !debugBadgeRef.current) return;
    screenshotDebugDeltasRef.current = [];
    screenshotDebugTextRef.current = `Genie screenshot ${kind} · collecting frames`;
    debugBadgeRef.current.style.display = 'block';
    debugBadgeRef.current.textContent = screenshotDebugTextRef.current;
  }, []);

  const screenshotAnimationFrame = useCallback((delta) => {
    if (!GENIE_DEBUG || !debugBadgeRef.current) return;
    const samples = screenshotDebugDeltasRef.current;
    samples.push(delta);
    const sorted = [...samples].sort((a, b) => a - b);
    const average = samples.reduce((total, value) => total + value, 0) / samples.length;
    const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1] || 0;
    const dropped = samples.reduce((total, value) => total + Math.max(0, Math.ceil(value / 16.7) - 1), 0);
    screenshotDebugTextRef.current = `Genie screenshot · avg ${average.toFixed(1)} ms · p95 ${p95.toFixed(1)} ms · dropped ${dropped}`;
    debugBadgeRef.current.textContent = screenshotDebugTextRef.current;
  }, []);

  const screenshotAnimationEnd = useCallback((kind) => {
    if (!GENIE_DEBUG || !debugBadgeRef.current) return;
    screenshotDebugTextRef.current = `${screenshotDebugTextRef.current.replace('Genie screenshot', `Genie screenshot ${kind}`)} · complete`;
    debugBadgeRef.current.textContent = screenshotDebugTextRef.current;
  }, []);

  const lockBodyScroll = () => {
    const body = document.body;
    const scrollY = window.scrollY;
    bodyStyleRef.current = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      scrollY,
    };
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
  };

  const unlockBodyScroll = () => {
    const previous = bodyStyleRef.current;
    if (!previous) return;
    Object.assign(document.body.style, {
      overflow: previous.overflow,
      position: previous.position,
      top: previous.top,
      width: previous.width,
    });
    if (window.scrollY !== previous.scrollY) window.scrollTo(0, previous.scrollY);
    bodyStyleRef.current = null;
  };

  const setStatePhase = (next) => { phaseRef.current = next; setPhase(next); };

  const runAnimation = useCallback((request, opening, slow = false) => {
    cancelAnimationFrame(animRef.current);
    // Blurring the whole journal forces an expensive backdrop repaint during
    // every frame. Keep the same blur while open, but only after the genie lands.
    backdropRef.current?.classList.remove('genie-backdrop-blurred');
    const panel = panelRef.current;
    const layer = layerRef.current;
    const row = request?.row;
    if (!panel || !layer || !row) {
      if (opening) {
        activeRef.current = request;
        setActive(request);
        onExpandedChangeRef.current?.(request.trade.id);
        setStatePhase('open');
        backdropRef.current?.classList.add('genie-backdrop-blurred');
      } else {
        activeRef.current = null;
        setActive(null);
        onExpandedChangeRef.current?.(null);
        setStatePhase('closed');
        unlockBodyScroll();
      }
      return;
    }

    // Always measure the source row at the start, after any page scrolling.
    const rowRect = row.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const rowCenterX = rowRect.left + rowRect.width / 2;
    const viewportHeight = window.innerHeight;
    const rawRowCenterY = rowRect.top + rowRect.height / 2;
    const rowCenterY = rowRect.bottom < 0 ? 0 : rowRect.top > viewportHeight
      ? viewportHeight
      : clamp(rawRowCenterY, 0, viewportHeight);
    const finalX = panelRect.left;
    const finalY = panelRect.top;
    const width = panelRect.width;
    const height = panelRect.height;
    const stripCount = stripCountRef.current;
    const reduced = reducedMotion();
    const { clones, stripHeight } = reduced
      ? { clones: [], stripHeight: height / stripCount }
      : createGenieStripClones(panel, layer, {
        width, height, strips: stripCount, overlap: GENIE_CONFIG.overlap,
      });

    panel.style.visibility = reduced ? 'visible' : 'hidden';
    panel.style.opacity = reduced ? String(opening ? 0 : 1) : '';
    if (reduced) {
      const dx = opening ? rowCenterX - (finalX + width / 2) : 0;
      const dy = opening ? rowCenterY - (finalY + height / 2) : 0;
      panel.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${opening ? 0.96 : 1})`;
    }
    setStatePhase('animating');

    const start = performance.now();
    const duration = reduced
      ? 200
      : (opening ? GENIE_CONFIG.openMs : GENIE_CONFIG.closeMs) * (slow ? GENIE_CONFIG.slowFactor : 1);
    const frameTiming = { lastTimestamp: null, samples: 0, sampleTotal: 0 };
    const debugDeltas = GENIE_DEBUG ? [] : null;
    const lastTransforms = Array.from({ length: stripCount }, () => null);
    const from = opening ? 0 : 1;
    const to = opening ? 1 : 0;
    const frame = (now) => {
      if (GENIE_DEBUG && debugBadgeRef.current) {
        debugBadgeRef.current.style.display = 'block';
        if (frameTiming.lastTimestamp !== null) debugDeltas.push(now - frameTiming.lastTimestamp);
        const sortedDeltas = [...debugDeltas].sort((a, b) => a - b);
        const average = debugDeltas.length
          ? debugDeltas.reduce((total, delta) => total + delta, 0) / debugDeltas.length
          : 0;
        const p95 = sortedDeltas.length
          ? sortedDeltas[Math.ceil(sortedDeltas.length * 0.95) - 1]
          : 0;
        const dropped = debugDeltas.reduce((total, delta) => total + Math.max(0, Math.ceil(delta / 16.7) - 1), 0);
        debugBadgeRef.current.textContent = `Genie ${opening ? 'open' : 'close'} · avg ${average.toFixed(1)} ms · p95 ${p95.toFixed(1)} ms · dropped ${dropped}`;
      }
      if (frameTiming.lastTimestamp !== null && frameTiming.samples < 10) {
        frameTiming.samples += 1;
        frameTiming.sampleTotal += now - frameTiming.lastTimestamp;
        if (frameTiming.samples === 10 && frameTiming.sampleTotal / 10 > 20) stripCountRef.current = 24;
      }
      frameTiming.lastTimestamp = now;
      const raw = clamp((now - start) / duration);
      const p = from + (to - from) * easeInOutCubic(raw);
      if (backdropRef.current) backdropRef.current.style.opacity = String(p * 0.6);
      if (reduced) {
        panel.style.opacity = String(p);
        panel.style.transform = `translate(calc(-50% + ${(rowCenterX - (finalX + width / 2)) * (1 - p)}px), calc(-50% + ${(rowCenterY - (finalY + height / 2)) * (1 - p)}px)) scale(${0.96 + 0.04 * p})`;
      } else {
        clones.forEach((clone, k) => {
          const transform = stripTransform(p, k, {
            rowCenterX,
            rowCenterY,
            panelTop: finalY,
            panelCenterX: finalX + width / 2,
            panelWidth: width,
            stripHeight,
          }, { ...GENIE_CONFIG, strips: stripCount });
          clone.style.opacity = String(Math.min(1, p * 6));
          const previous = lastTransforms[k];
          const changedEnough = !previous
            || Math.abs(transform.x - previous.x) >= 0.05
            || Math.abs(transform.y - previous.y) >= 0.05
            || Math.abs((transform.scaleX - previous.scaleX) * width) >= 0.05
            || Math.abs((transform.scaleY - previous.scaleY) * stripHeight) >= 0.05;
          if (changedEnough) {
            clone.style.transform = `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scaleX}, ${transform.scaleY})`;
            lastTransforms[k] = transform;
          }
        });
      }
      if (raw < 1) { animRef.current = requestAnimationFrame(frame); return; }
      layer.replaceChildren();

      panel.style.visibility = opening ? 'visible' : 'hidden';
      panel.style.opacity = '';
      panel.style.transform = '';
      if (opening) {
        activeRef.current = request;
        setActive(request);
        onExpandedChangeRef.current?.(request.trade.id);
        setStatePhase('open');
        requestAnimationFrame(() => panelRef.current?.querySelector('[data-genie-close]')?.focus());
        const queued = pendingRef.current;
        pendingRef.current = null;
        if (queued) closeAndQueue(queued);
      } else {
        const previous = activeRef.current;
        activeRef.current = null;
        setActive(null);
        onExpandedChangeRef.current?.(null);
        setStatePhase('closed');
        unlockBodyScroll();
        const target = pendingRef.current;
        pendingRef.current = null;
        if (previous?.row?.isConnected) {
          previous.row.classList.add('genie-source-pulse');
          window.setTimeout(() => previous.row?.classList.remove('genie-source-pulse'), 350);
          previous.row.focus?.({ preventScroll: true });
        }
        restoreRef.current?.focus?.({ preventScroll: true });
        if (target) openRequest(target);
      }
    };
    animRef.current = requestAnimationFrame(frame);
  }, []);

  const closeAndQueue = useCallback((next = null) => {
    if (nestedImageOpenRef.current) lightboxRef.current?.closeImmediately();
    if (next) pendingRef.current = next;
    const current = activeRef.current;
    if (!current || phaseRef.current === 'animating') return;
    restoreRef.current = current.row;
    runAnimation(current, false);
  }, [runAnimation]);

  const openRequest = useCallback((request) => {
    if (!request) return;
    restoreRef.current = request.row;
    lockBodyScroll();
    activeRef.current = request;
    setActive(request);
    setStatePhase('animating');
    // Wait for the shared panel to render, then measure and animate it.
    requestAnimationFrame(() => runAnimation(request, true, request.slow));
  }, [runAnimation]);

  const handleBackdropClick = useCallback((event) => {
    const backdrop = event.currentTarget;
    backdrop.style.pointerEvents = 'none';
    const underneath = document.elementFromPoint(event.clientX, event.clientY);
    backdrop.style.pointerEvents = 'auto';
    const row = underneath?.closest?.('.trade-journal-row-header');
    if (row && !underneath.closest('.trade-journal-actions')) {
      row.click();
      return;
    }
    closeAndQueue();
  }, [closeAndQueue]);

  useImperativeHandle(ref, () => ({
    toggle(request) {
      const current = activeRef.current;
      const state = phaseRef.current;
      if (state === 'animating') return;
      if (state === 'open' && current?.trade?.id === request.trade.id) { closeAndQueue(); return; }
      if (state === 'open') { closeAndQueue(request); return; }
      openRequest(request);
    },
    close: () => closeAndQueue(),
  }), [closeAndQueue, openRequest]);

  useEffect(() => { onExpandedChangeRef.current = onExpandedChange; }, [onExpandedChange]);

  useEffect(() => () => {
    cancelAnimationFrame(animRef.current);
    unlockBodyScroll();
  }, []);

  useEffect(() => {
    if (phase !== 'open') return undefined;
    const keydown = (event) => {
      if (nestedImageOpenRef.current) return;
      if (event.key === 'Escape') { event.preventDefault(); closeAndQueue(); }
      if (event.key !== 'Tab') return;
      const nodes = [...(panelRef.current?.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])];
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [phase, closeAndQueue]);

  if (typeof document === 'undefined') return null;
  const request = active;
  return createPortal(
    <div className="genie-modal-root" aria-hidden={phase === 'closed' ? 'true' : undefined}>
      {phase !== 'closed' && <button type="button" ref={backdropRef} className="genie-backdrop" aria-label="Close trade details" style={{ opacity: 0 }} onClick={handleBackdropClick} />}
      <div ref={layerRef} className="genie-strip-layer" aria-hidden="true" />
      {GENIE_DEBUG && <div ref={debugBadgeRef} className="genie-debug-badge" role="status" aria-live="off" style={{ display: 'none' }} />}
      {request && <section
        ref={panelRef}
        className="trade-detail-dialog card genie-real-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="genie-trade-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
        style={{ visibility: phase === 'open' ? 'visible' : 'hidden' }}
      >
        <header className="trade-detail-header">
          <div><span className="trade-detail-eyebrow">TRADE DETAILS</span><h2 id="genie-trade-detail-title">{request.trade.instrument} <span>·</span> {formatDate(request.trade.date)}</h2></div>
          <button data-genie-close className="btn btn-ghost btn-icon" type="button" onClick={() => closeAndQueue()} aria-label="Close trade details"><X size={18} /></button>
        </header>
        {renderContent(request.trade, (imageRequest) => lightboxRef.current?.open(imageRequest))}
      </section>}
      <GenieLightbox
        ref={lightboxRef}
        onOpenChange={(opened) => { nestedImageOpenRef.current = opened; }}
        onAnimationStart={GENIE_DEBUG ? screenshotAnimationStart : undefined}
        onFrame={GENIE_DEBUG ? screenshotAnimationFrame : undefined}
        onAnimationEnd={GENIE_DEBUG ? screenshotAnimationEnd : undefined}
      />
    </div>, document.body,
  );
});

export default GenieModal;
