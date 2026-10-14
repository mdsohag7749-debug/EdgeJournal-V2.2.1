export function createGenieStripClones(panel, layer, { width, height, strips, overlap, imageFallbackSrc }) {
  const template = panel.cloneNode(true);
  const heavySelector = 'img, video, canvas, .recharts-wrapper, [data-chart]';
  const sourceHeavy = panel.querySelectorAll(heavySelector);
  const clonedHeavy = template.querySelectorAll(heavySelector);
  clonedHeavy.forEach((node, index) => {
    const source = sourceHeavy[index];
    const rect = source?.getBoundingClientRect();
    const sourceStyle = source ? getComputedStyle(source) : null;
    const placeholder = document.createElement('div');
    placeholder.className = 'genie-media-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.style.width = `${rect?.width || source?.width || 0}px`;
    placeholder.style.height = `${rect?.height || source?.height || 0}px`;
    placeholder.style.display = sourceStyle?.display || 'block';
    placeholder.style.flex = sourceStyle?.flex || 'none';
    placeholder.style.objectFit = sourceStyle?.objectFit || '';
    placeholder.style.background = sourceStyle?.backgroundColor || 'rgba(8, 28, 38, .7)';
    if (node.matches('img.genie-lightbox-image') && imageFallbackSrc) {
      placeholder.style.backgroundImage = `url(${JSON.stringify(imageFallbackSrc)})`;
      placeholder.style.backgroundColor = '#061923';
      placeholder.style.backgroundPosition = 'center';
      placeholder.style.backgroundRepeat = 'no-repeat';
      placeholder.style.backgroundSize = 'contain';
    }
    node.replaceWith(placeholder);
  });

  template.removeAttribute('id');
  template.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
  template.querySelectorAll('button, a, input, select, textarea, [tabindex]').forEach((node) => node.setAttribute('tabindex', '-1'));
  template.setAttribute('inert', '');
  template.setAttribute('aria-hidden', 'true');
  template.classList.add('genie-strip-clone');
  Object.assign(template.style, {
    position: 'fixed', left: '0', top: '0', width: `${width}px`, height: `${height}px`,
    margin: '0', transformOrigin: '0 0', pointerEvents: 'none', visibility: 'visible',
    opacity: '0', transition: 'none', willChange: 'transform',
  });

  const stripHeight = height / strips;
  const fragment = document.createDocumentFragment();
  const clones = Array.from({ length: strips }, (_, index) => {
    const clone = template.cloneNode(true);
    const top = index * stripHeight;
    const bottomInset = Math.max(0, height - top - stripHeight - overlap);
    clone.style.clipPath = `inset(${top}px 0 ${bottomInset}px 0)`;
    clone.style.contain = 'layout paint style';
    clone.style.backfaceVisibility = 'hidden';
    fragment.appendChild(clone);
    return clone;
  });
  layer.replaceChildren(fragment);
  return { clones, stripHeight };
}
