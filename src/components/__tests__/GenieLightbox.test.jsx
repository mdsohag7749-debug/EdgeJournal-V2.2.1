import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import GenieLightbox from '../GenieLightbox';

let rafQueue;
let clock;

function finishAnimation() {
  act(() => {
    let frames = 0;
    while (rafQueue.length && frames < 20) {
      clock += 1000;
      rafQueue.splice(0).forEach((callback) => callback(clock));
      frames += 1;
    }
  });
}

function Harness() {
  const ref = createRef();
  return <>
    <div className="trade-detail-content"><button className="genie-grid-thumb" data-origin>thumb</button></div>
    <GenieLightbox ref={ref} />
    <button data-testid="open" onClick={() => ref.current.open({
      images: [{ url: '/one.png', fileName: 'one' }, { url: '/two.png', fileName: 'two' }],
      index: 0,
      origin: document.querySelector('[data-origin]'),
    })}>Open lightbox</button>
  </>;
}

beforeEach(() => {
  rafQueue = [];
  clock = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { rafQueue.push(callback); return rafQueue.length; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect() {
    if (this.classList?.contains('genie-lightbox-panel')) return { left: 100, top: 100, right: 700, bottom: 500, width: 600, height: 400 };
    return { left: 20, top: 40, right: 120, bottom: 100, width: 100, height: 60 };
  });
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() });
  vi.stubGlobal('Image', class MockImage {
    complete = true;
    naturalWidth = 800;
    naturalHeight = 600;
    set src(value) { this._src = value; queueMicrotask(() => this.onload?.()); }
    get src() { return this._src; }
    async decode() {}
  });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Genie screenshot lightbox', () => {
  it('opens from the thumbnail, navigates screenshots, and closes back to it with Escape', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('open'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    finishAnimation();
    expect(screen.getByRole('dialog')).toHaveTextContent('Screenshot 1 of 2');

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 90)); });
    expect(screen.getByRole('dialog')).toHaveTextContent('Screenshot 2 of 2');
    fireEvent.keyDown(document, { key: 'Escape' });
    finishAnimation();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('[data-origin]')).toHaveFocus();
  });

  it('closes only the lightbox when Escape arrives during image preload', async () => {
    let finishLoad;
    vi.stubGlobal('Image', class SlowImage {
      complete = false;
      naturalWidth = 800;
      naturalHeight = 600;
      set src(value) { this._src = value; finishLoad = () => { this.complete = true; this.onload?.(); }; }
      get src() { return this._src; }
      async decode() {}
    });
    render(<Harness />);
    fireEvent.click(screen.getByTestId('open'));
    expect(document.querySelector('.trade-detail-content').style.overflowY).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.querySelector('.trade-detail-content').style.overflowY).toBe('');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    finishLoad?.();
    await act(async () => { await Promise.resolve(); });
  });
});
