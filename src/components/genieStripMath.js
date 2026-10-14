import { GENIE_CONFIG, clamp, easeInOutCubic, smoothstep, stripTransform } from './genieMath';

export { GENIE_CONFIG, clamp, easeInOutCubic, smoothstep };

export function stripCountFor(cfg = GENIE_CONFIG) {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;
  return cores && cores <= 4 ? cfg.lowEndStrips : cfg.strips;
}

export function fitPanel(naturalW, naturalH, vw, vh, cfg = GENIE_CONFIG) {
  const mobile = vw < 640;
  const maxW = mobile ? vw - 16 : Math.min(960, vw - 32);
  const maxH = mobile ? vh - 16 : Math.min(vh * 0.85, vh - 32);
  const imageMaxH = Math.max(120, maxH - cfg.headerHeight);
  const nw = naturalW || 1600;
  const nh = naturalH || 1000;
  const ratio = nw / nh || 1.6;
  const imageWidth = Math.min(maxW, imageMaxH * ratio, nw * 2);
  const imageHeight = imageWidth / ratio;
  const width = Math.max(imageWidth, Math.min(320, maxW));
  const height = imageHeight + cfg.headerHeight;
  return { width, height, left: (vw - width) / 2, top: (vh - height) / 2, imgWidth: imageWidth, imgHeight: imageHeight };
}

export function getOrigin(rect, bounds) {
  return {
    cx: clamp(rect.left + rect.width / 2, bounds.left, bounds.right),
    cy: clamp(rect.top + rect.height / 2, bounds.top, bounds.bottom),
    width: rect.width,
    height: rect.height,
  };
}

export function computeStripTransforms(progress, count, origin, panel, cfg = GENIE_CONFIG) {
  const stripHeight = panel.height / count;
  const panelCenterX = panel.left + panel.width / 2;
  const minScaleX = clamp(Math.max(cfg.lightboxMinScaleX ?? 0.06, origin.width / panel.width), 0, 1);
  const stripConfig = { ...cfg, strips: count, minScaleX };
  return Array.from({ length: count }, (_, index) => {
    const transform = stripTransform(progress, index, {
      rowCenterX: origin.cx,
      rowCenterY: origin.cy,
      panelTop: panel.top,
      panelCenterX,
      panelWidth: panel.width,
      stripHeight,
    }, stripConfig);
    return `translate(${transform.x.toFixed(2)}px, ${transform.y.toFixed(2)}px) scale(${transform.scaleX.toFixed(4)}, ${transform.scaleY.toFixed(4)})`;
  });
}
