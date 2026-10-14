import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { GENIE_CONFIG, clamp, easeInOutCubic } from './genieStripMath';
import { computeStripTransforms, fitPanel, getOrigin, stripCountFor } from './genieStripMath';
import { createGenieStripClones } from './genieDom';
import './GenieLightbox.css';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function preloadImage(src, timeoutMs = GENIE_CONFIG.preloadMs) {
  const image = new Image();
  let finishReady;
  const ready = new Promise((resolve) => { finishReady = resolve; });
  image.onload = async () => {
    try { await image.decode?.(); } catch { /* The loaded image can still be displayed. */ }
    finishReady(true);
  };
  image.onerror = () => finishReady(false);
  image.src = src;
  if (image.complete && image.naturalWidth) image.onload();
  const timed = Promise.race([
    ready.then((loaded) => ({ loaded, image })),
    new Promise((resolve) => window.setTimeout(() => resolve({ loaded: false, image }), timeoutMs)),
  ]);
  return { image, ready, timed };
}

const GenieLightbox = forwardRef(function GenieLightbox({ onOpenChange, onAnimationStart, onFrame, onAnimationEnd }, ref) {
  const [request, setRequest] = useState(null);
  const [phase, setPhase] = useState('closed');
  const [index, setIndex] = useState(0);
  const [size, setSize] = useState(null);
  const [imageVisible, setImageVisible] = useState(true);
  const overlayRef = useRef(null);
  const backdropRef = useRef(null);
  const layerRef = useRef(null);
  const panelRef = useRef(null);
  const phaseRef = useRef('closed');
  const requestRef = useRef(null);
  const animRef = useRef(0);
  const stripCountRef = useRef(stripCountFor());
  const contentLockRef = useRef(null);
  const generationRef = useRef(0);
  const switchTimerRef = useRef(0);
  const pendingEscapeRef = useRef(null);

  const changePhase = (next) => { phaseRef.current = next; setPhase(next); };

  const setContentLock = (locked) => {
    const content = document.querySelector('.trade-detail-content');
    if (locked && content && !contentLockRef.current) {
      contentLockRef.current = { element: content, overflowY: content.style.overflowY, scrollTop: content.scrollTop };
      content.style.overflowY = 'hidden';
    } else if (!locked && contentLockRef.current) {
      const saved = contentLockRef.current;
      if (saved.element.isConnected) {
        saved.element.style.overflowY = saved.overflowY;
        saved.element.scrollTop = saved.scrollTop;
      }
      contentLockRef.current = null;
    }
  };

  const measureOrigin = (origin) => {
    const rect = origin.getBoundingClientRect();
    const content = origin.closest('.trade-detail-content');
    const bounds = content?.getBoundingClientRect();
    const left = Math.max(0, bounds?.left ?? 0);
    const right = Math.min(window.innerWidth, bounds?.right ?? window.innerWidth);
    const top = Math.max(0, bounds?.top ?? 0);
    const bottom = Math.min(window.innerHeight, bounds?.bottom ?? window.innerHeight);
    return { rect, ...getOrigin(rect, { left, top, right: Math.max(left, right), bottom: Math.max(top, bottom) }) };
  };

  const runAnimation = useCallback((opening, slow = false, preloaded = false) => {
    cancelAnimationFrame(animRef.current);
    const current = requestRef.current;
    const panel = panelRef.current;
    const layer = layerRef.current;
    const backdrop = backdropRef.current;
    if (!current || !panel || !layer || !backdrop) return;

    const source = current.origin;
    if (!source?.isConnected) {
      if (!opening) {
        layer.replaceChildren();
        setRequest(null);
        requestRef.current = null;
        changePhase('closed');
        setContentLock(false);
        onOpenChange?.(false);
      }
      return;
    }
    const origin = measureOrigin(source);
    const panelRect = panel.getBoundingClientRect();
    const width = panelRect.width;
    const height = panelRect.height;
    const stripCount = stripCountRef.current;
    const reduced = reducedMotion();
    const panelCenterX = panelRect.left + width / 2;
    const imageSource = current.images[index]?.url;
    const imageFallbackSrc = current.images[index]?.thumbnailUrl || current.images[index]?.thumbSrc || current.thumbnailSrc || imageSource;
    layer.replaceChildren();
    const { clones } = reduced
      ? { clones: [] }
      : createGenieStripClones(panel, layer, {
        width, height, strips: stripCount, overlap: GENIE_CONFIG.overlap, imageFallbackSrc,
      });
    panel.style.visibility = reduced ? 'visible' : 'hidden';
    changePhase('animating');
    const start = performance.now();
    const duration = reduced ? GENIE_CONFIG.reducedMs : (opening ? GENIE_CONFIG.openMs : GENIE_CONFIG.closeMs) * (slow ? GENIE_CONFIG.slowFactor : 1);
    const deltas = [];
    let lastTimestamp = null;
    const lastTransforms = Array.from({ length: stripCount }, () => '');
    const from = opening ? 0 : 1;
    const to = opening ? 1 : 0;
    const initialScaleX = Math.max(0.06, origin.width / width);
    onAnimationStart?.(opening ? 'open' : 'close');

    const frame = (now) => {
      if (lastTimestamp !== null) {
        const delta = now - lastTimestamp;
        if (deltas.length < 10) {
          deltas.push(delta);
          if (deltas.length === 10 && deltas.reduce((sum, value) => sum + value, 0) / 10 > 20) stripCountRef.current = GENIE_CONFIG.lowEndStrips;
        }
        onFrame?.(delta);
      }
      lastTimestamp = now;
      const raw = clamp((now - start) / duration);
      const progress = from + (to - from) * easeInOutCubic(raw);
      backdrop.style.opacity = String(progress * GENIE_CONFIG.backdropMax);
      if (reduced) {
        panel.style.opacity = String(progress);
        panel.style.transform = `translate(calc(-50% + ${(origin.cx - panelCenterX) * (1 - progress)}px), calc(-50% + ${(origin.cy - (panelRect.top + height / 2)) * (1 - progress)}px)) scale(${0.96 + 0.04 * progress})`;
      } else {
        const transforms = computeStripTransforms(progress, stripCount, origin, panelRect, { ...GENIE_CONFIG, strips: stripCount, lightboxMinScaleX: initialScaleX });
        clones.forEach((clone, stripIndex) => {
          const transform = transforms[stripIndex];
          clone.style.opacity = String(Math.min(1, progress * 6));
          const previous = lastTransforms[stripIndex];
          if (transform !== previous) {
            clone.style.transform = transform;
            lastTransforms[stripIndex] = transform;
          }
        });
      }
      if (raw < 1) { animRef.current = requestAnimationFrame(frame); return; }

      layer.replaceChildren();
      panel.style.visibility = opening ? 'visible' : 'hidden';
      panel.style.opacity = '';
      panel.style.transform = '';
      if (opening) {
        changePhase('open');
        panel.querySelector('[data-genie-lightbox-close]')?.focus();
      } else {
        const originElement = current.origin;
        if (originElement?.isConnected) {
          originElement.classList.add('genie-thumb-pulse');
          window.setTimeout(() => originElement.classList.remove('genie-thumb-pulse'), 400);
          originElement.focus?.({ preventScroll: true });
        }
        setRequest(null);
        requestRef.current = null;
        changePhase('closed');
        setContentLock(false);
        onOpenChange?.(false);
      }
      onAnimationEnd?.(opening ? 'open' : 'close');
    };
    animRef.current = requestAnimationFrame(frame);
  }, [onAnimationStart, onAnimationEnd, onFrame, onOpenChange]);

  const close = useCallback((slow = false) => {
    if (phaseRef.current !== 'open') return;
    runAnimation(false, slow, true);
  }, [runAnimation]);

  const closeImmediately = useCallback(() => {
    if (phaseRef.current === 'closed') return;
    generationRef.current += 1;
    if (pendingEscapeRef.current) {
      window.removeEventListener('keydown', pendingEscapeRef.current, true);
      pendingEscapeRef.current = null;
    }
    cancelAnimationFrame(animRef.current);
    window.clearTimeout(switchTimerRef.current);
    layerRef.current?.replaceChildren();
    if (overlayRef.current) overlayRef.current.style.display = 'none';
    if (panelRef.current) {
      panelRef.current.style.visibility = 'hidden';
      panelRef.current.style.opacity = '';
      panelRef.current.style.transform = '';
    }
    requestRef.current = null;
    setRequest(null);
    changePhase('closed');
    setContentLock(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  const open = useCallback(async (payload) => {
    if (!payload?.images?.length || !payload.origin || phaseRef.current !== 'closed') return;
    const token = ++generationRef.current;
    const selectedIndex = clamp(payload.index || 0, 0, payload.images.length - 1);
    const image = payload.images[selectedIndex];
    const fullSrc = image.url;
    const thumbnailSrc = image.thumbnailUrl || image.thumbSrc || payload.thumbnailSrc || fullSrc;
    const preloader = preloadImage(fullSrc);
    const onPendingEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.removeEventListener('keydown', onPendingEscape, true);
      pendingEscapeRef.current = null;
      closeImmediately();
    };
    pendingEscapeRef.current = onPendingEscape;
    window.addEventListener('keydown', onPendingEscape, true);
    requestRef.current = { ...payload, index: selectedIndex, thumbnailSrc, preloader };
    changePhase('animating');
    setContentLock(true);
    onOpenChange?.(true);
    const result = await preloader.timed;
    if (pendingEscapeRef.current === onPendingEscape) {
      window.removeEventListener('keydown', onPendingEscape, true);
      pendingEscapeRef.current = null;
    }
    if (generationRef.current !== token || phaseRef.current === 'closed') return;
    const naturalWidth = result.image.naturalWidth || payload.origin.naturalWidth || 1600;
    const naturalHeight = result.image.naturalHeight || payload.origin.naturalHeight || 900;
    const nextRequest = { ...requestRef.current, loaded: result.loaded, dimensions: { width: naturalWidth, height: naturalHeight } };
    requestRef.current = nextRequest;
    setRequest(nextRequest);
    setIndex(selectedIndex);
    setSize(fitPanel(naturalWidth, naturalHeight, window.innerWidth, window.innerHeight));
    setImageVisible(true);
    if (!result.loaded) {
      preloader.ready.then((loaded) => {
        if (!loaded || generationRef.current !== token) return;
        const updated = { ...requestRef.current, loaded: true };
        requestRef.current = updated;
        setRequest(updated);
      });
    }
    requestAnimationFrame(() => runAnimation(true, payload.slow, result.loaded));
  }, [closeImmediately, onOpenChange, runAnimation]);

  const switchImage = useCallback((direction) => {
    if (phaseRef.current !== 'open') return;
    const current = requestRef.current;
    if (!current || current.images.length < 2) return;
    const next = (index + direction + current.images.length) % current.images.length;
    const nextImage = current.images[next];
    const preloader = preloadImage(nextImage.url);
    setImageVisible(false);
    window.clearTimeout(switchTimerRef.current);
    switchTimerRef.current = window.setTimeout(async () => {
      const loaded = await preloader.timed;
      if (phaseRef.current !== 'open') return;
      setIndex(next);
      setSize(fitPanel(loaded.image.naturalWidth || current.dimensions.width, loaded.image.naturalHeight || current.dimensions.height, window.innerWidth, window.innerHeight));
      setImageVisible(true);
      requestRef.current = { ...requestRef.current, index: next };
    }, 75);
  }, [index]);

  useImperativeHandle(ref, () => ({ open, closeImmediately, isOpen: () => phaseRef.current !== 'closed' }), [open, closeImmediately]);

  useEffect(() => {
    if (phase !== 'open' && phase !== 'animating') return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (phaseRef.current === 'open') close();
        else closeImmediately();
      }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); switchImage(-1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); switchImage(1); }
      else if (event.key === 'Tab') {
        const panel = panelRef.current;
        const focusable = panel?.querySelectorAll('button:not([disabled])') || [];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const focused = document.activeElement;
        if (!panel.contains(focused)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && focused === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && focused === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [phase, close, closeImmediately, switchImage]);

  useEffect(() => () => {
    cancelAnimationFrame(animRef.current);
    window.clearTimeout(switchTimerRef.current);
    if (pendingEscapeRef.current) window.removeEventListener('keydown', pendingEscapeRef.current, true);
    setContentLock(false);
  }, []);

  if (typeof document === 'undefined' || !request) return null;
  const selected = request.images[index];
  const src = request.loaded ? selected.url : (selected.thumbnailUrl || selected.thumbSrc || request.thumbnailSrc);
  const title = selected.caption || selected.fileName || `Screenshot ${index + 1} of ${request.images.length}`;
  return createPortal(
    <div ref={overlayRef} className="genie-lightbox-root" style={{ display: 'block' }}>
      <button ref={backdropRef} type="button" className="genie-lightbox-backdrop" aria-label="Close screenshot" style={{ opacity: 0 }} onClick={() => close()} />
      <div ref={layerRef} className="genie-lightbox-strip-layer" aria-hidden="true" />
      <section
        ref={panelRef}
        className="genie-lightbox-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="genie-lightbox-title"
        style={{ width: size?.width || 'min(960px, calc(100vw - 32px))', height: size?.height || 'min(75vh, 720px)', visibility: phase === 'open' ? 'visible' : 'hidden' }}
      >
        <header className="genie-lightbox-header">
          <div>
            <strong id="genie-lightbox-title">Screenshot {index + 1} of {request.images.length}</strong>
            {title && title !== `Screenshot ${index + 1} of ${request.images.length}` && <span>{title}</span>}
          </div>
          <div className="genie-lightbox-controls">
            {request.images.length > 1 && <>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Previous screenshot" onClick={() => switchImage(-1)}><ChevronLeft size={18} /></button>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Next screenshot" onClick={() => switchImage(1)}><ChevronRight size={18} /></button>
            </>}
            <button data-genie-lightbox-close type="button" className="btn btn-ghost btn-icon" aria-label="Close screenshot" onClick={(event) => close(event.shiftKey)}><X size={18} /></button>
          </div>
        </header>
        <div className="genie-lightbox-image-wrap">
          <img className="genie-lightbox-image" src={src} alt={title} style={{ opacity: imageVisible ? 1 : 0 }} onClick={() => close()} onLoad={(event) => {
            if (!request.loaded && event.currentTarget.getAttribute('src') === selected.url) {
              const dimensions = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight };
              requestRef.current = { ...requestRef.current, loaded: true, dimensions };
              setRequest(requestRef.current);
            }
          }} />
        </div>
      </section>
    </div>,
    document.body,
  );
});

export default GenieLightbox;
