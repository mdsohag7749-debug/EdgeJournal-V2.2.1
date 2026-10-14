export const GENIE_CONFIG = Object.freeze({
  strips: 32,
  lag: 0.55,
  minScaleX: 0.1,
  overlap: 0.7,
  openMs: 650,
  closeMs: 520,
  slowFactor: 5,
  lowEndStrips: 24,
  reducedMs: 200,
  backdropMax: 0.5,
  preloadMs: 300,
  headerHeight: 52,
  lightboxMinScaleX: 0.06,
});

export const GENIE_DEBUG = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('genieDebug') === '1';

export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const smoothstep = (value) => value * value * (3 - 2 * value);
export const easeInOutCubic = (value) => (value < 0.5
  ? 4 * value * value * value
  : 1 - Math.pow(-2 * value + 2, 3) / 2);

export function boundaryY(progress, boundary, geometry, config = GENIE_CONFIG) {
  const q = clamp(progress * (1 + config.lag) - config.lag * (boundary / config.strips));
  return geometry.rowCenterY + (geometry.panelTop + boundary * geometry.stripHeight - geometry.rowCenterY) * smoothstep(q);
}

export function stripTransform(progress, index, geometry, config = GENIE_CONFIG) {
  const q0 = clamp(progress * (1 + config.lag) - config.lag * (index / config.strips));
  const q1 = clamp(progress * (1 + config.lag) - config.lag * ((index + 1) / config.strips));
  const eased = smoothstep((q0 + q1) / 2);
  const scaleX = config.minScaleX + (1 - config.minScaleX) * eased;
  const centerX = geometry.rowCenterX + (geometry.panelCenterX - geometry.rowCenterX) * eased;
  const y0 = boundaryY(progress, index, geometry, config);
  const y1 = boundaryY(progress, index + 1, geometry, config);
  const scaleY = Math.max(0.001, (y1 - y0) / geometry.stripHeight);
  return {
    scaleX,
    scaleY,
    x: centerX - geometry.panelWidth * scaleX / 2,
    y: y0 - index * geometry.stripHeight * scaleY,
  };
}
