import { describe, expect, it } from 'vitest';
import { boundaryY, GENIE_CONFIG, stripTransform } from '../genieMath';

const geometry = {
  rowCenterX: 50,
  rowCenterY: 20,
  panelTop: 100,
  panelCenterX: 400,
  panelWidth: 600,
  stripHeight: 10,
};

describe('Genie strip geometry', () => {
  it('keeps the collapsed boundaries at the source row', () => {
    expect(boundaryY(0, 0, geometry)).toBe(20);
    expect(boundaryY(0, GENIE_CONFIG.strips, geometry)).toBe(20);
    const strip = stripTransform(0, 0, geometry);
    expect(strip.scaleX).toBeCloseTo(GENIE_CONFIG.minScaleX);
    expect(strip.scaleY).toBeCloseTo(0.001);
  });

  it('interpolates strip positions at half progress', () => {
    const strip = stripTransform(0.5, 24, geometry);
    expect(strip.scaleX).toBeGreaterThan(GENIE_CONFIG.minScaleX);
    expect(strip.scaleX).toBeLessThan(1);
    expect(strip.x).toBeGreaterThan(geometry.rowCenterX - geometry.panelWidth * GENIE_CONFIG.minScaleX / 2);
    expect(strip.y).toBeGreaterThan(geometry.rowCenterY - 24 * geometry.stripHeight * 0.001);
  });

  it('matches the final panel geometry at full progress', () => {
    expect(boundaryY(1, 0, geometry)).toBe(geometry.panelTop);
    expect(boundaryY(1, GENIE_CONFIG.strips, geometry)).toBe(geometry.panelTop + GENIE_CONFIG.strips * geometry.stripHeight);
    const strip = stripTransform(1, 24, geometry);
    expect(strip.scaleX).toBe(1);
    expect(strip.scaleY).toBe(1);
    expect(strip.x).toBe(geometry.panelCenterX - geometry.panelWidth / 2);
    expect(strip.y).toBe(geometry.panelTop);
  });
});
