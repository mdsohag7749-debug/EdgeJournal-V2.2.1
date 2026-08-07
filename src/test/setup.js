// Shared test setup for Vitest (configured in vite.config.js).
//
// - Extends `expect` with jest-dom matchers (toBeInTheDocument, etc.).
// - Auto-cleans any React tree mounted by @testing-library/react so
//   tests never leak into one another.
// - Stubs browser APIs that jsdom lacks but which imported UI code
//   (framer-motion, etc.) touches at render time. These are no-ops for
//   pure-logic tests and only make component tests render deterministically.

import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

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