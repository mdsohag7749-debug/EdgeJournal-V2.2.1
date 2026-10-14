import { describe, it, expect } from 'vitest';
import {
  GENIE_CONFIG,
  computeStripTransforms,
  fitPanel,
  getOrigin,
  smoothstep,
} from '../genieStripMath';

const panel = { left: 100, top: 50, width: 800, height: 480 };
const origin = { cx: 300, cy: 700, width: 100, height: 70 };
const N = 48;

function parse(transform) {
  const match = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+), ([-\d.]+)\)/.exec(transform);
  return match.slice(1).map(Number);
}

describe('computeStripTransforms', () => {
  it('collapses every strip into the origin at p = 0', () => {
    const out = computeStripTransforms(0, N, origin, panel).map(parse);
    out.forEach(([tx, ty, sx, sy]) => {
      expect(Math.abs(ty - origin.cy)).toBeLessThan(1);
      expect(sy).toBeCloseTo(0.001, 3);
      expect(sx).toBeCloseTo(Math.max(GENIE_CONFIG.lightboxMinScaleX, origin.width / panel.width), 3);
      expect(tx + (panel.width * sx) / 2).toBeCloseTo(origin.cx, 1);
    });
  });

  it('lands exactly on the final panel at p = 1', () => {
    const out = computeStripTransforms(1, N, origin, panel).map(parse);
    out.forEach(([tx, ty, sx, sy]) => {
      expect(tx).toBeCloseTo(panel.left, 1);
      expect(ty).toBeCloseTo(panel.top, 1);
      expect(sx).toBeCloseTo(1, 3);
      expect(sy).toBeCloseTo(1, 3);
    });
  });

  it('keeps strips ordered at p = 0.5', () => {
    const out = computeStripTransforms(0.5, N, origin, panel).map(parse);
    const stripHeight = panel.height / N;
    for (let k = 1; k < N; k++) {
      const prevBottom = out[k - 1][1] + (k - 1) * stripHeight * out[k - 1][3] + stripHeight * out[k - 1][3];
      const top = out[k][1] + k * stripHeight * out[k][3];
      expect(top).toBeGreaterThanOrEqual(prevBottom - 1.2);
    }
  });
});

describe('fitPanel', () => {
  it('fits a landscape image while preserving its aspect ratio', () => {
    const result = fitPanel(1600, 1000, 1400, 900);
    expect(result.width).toBeLessThanOrEqual(960);
    expect(result.height).toBeLessThanOrEqual(900 * 0.85);
    expect(result.left).toBeCloseTo((1400 - result.width) / 2, 3);
    expect(result.imgWidth / result.imgHeight).toBeCloseTo(1.6, 3);
  });

  it('uses nearly the full mobile viewport', () => {
    const result = fitPanel(1600, 1000, 390, 800);
    expect(result.width).toBeLessThanOrEqual(390 - 16);
    expect(result.width).toBeGreaterThan(300);
  });

  it('does not upscale tiny images by more than 2x', () => {
    expect(fitPanel(200, 120, 1400, 900).imgWidth).toBeLessThanOrEqual(400);
  });
});

describe('getOrigin and smoothstep', () => {
  it('clamps an offscreen thumbnail to the visible bounds', () => {
    expect(getOrigin({ left: 50, top: 2000, width: 100, height: 70 }, { left: 0, top: 0, right: 1000, bottom: 800 }).cy).toBe(800);
  });

  it('maps smoothstep endpoints and midpoint', () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBe(0.5);
  });
});
