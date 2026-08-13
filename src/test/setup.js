// Shared test setup for Vitest (configured in vite.config.js).
//
// - Extends `expect` with jest-dom matchers (toBeInTheDocument, etc.).
// - Auto-cleans any React tree mounted by @testing-library/react so
//   tests never leak into one another.
// - Stubs browser APIs that jsdom lacks but which imported UI code
//   (framer-motion, etc.) touches at render time. These are no-ops for
//   pure-logic tests and only make component tests render deterministically.

import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Tests must never depend on a developer's live .env. The production AI
// default is closed (disabled); pin those flags so the suite stays hermetic
// even when the local .env enables the real bridge.
vi.stubEnv('VITE_AI_ENABLED', 'false');
vi.stubEnv('VITE_AI_PROVIDER', 'none');

afterEach(() => {
  cleanup();
});

// jsdom does not run an animation loop; give motion a no-op scheduling
// API so initial renders finish synchronously and deterministically.
if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
}
if (!globalThis.cancelAnimationFrame) {
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}

// framer-motion's useReducedMotion reads prefers-reduced-motion.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// ResizeObserver is required by some chart/measurement utilities.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// IntersectionObserver is used by the Analytics scroll-spy (Sprint 9.6).
// jsdom has no IO, so provide a deterministic, manually-driven mock: every
// instance is recorded so tests can fire callbacks with crafted entries
// (which is exactly how the observer is driven in real browsers — threshold
// crossings report entry.isIntersecting + boundingClientRect).
if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class IntersectionObserver {
    static instances = [];
    constructor(callback, options) {
      this.callback = callback;
      this.options = options || {};
      this.observed = [];
      IntersectionObserver.instances.push(this);
    }
    observe(el) {
      this.observed.push(el);
    }
    unobserve(el) {
      this.observed = this.observed.filter((e) => e !== el);
    }
    disconnect() {
      this.observed = [];
    }
  };
}

// jsdom doesn't implement scrollIntoView; stub it so Analytics folder clicks
// can assert smooth-scroll is requested without crashing the DOM.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}