import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import GenieModal from '../GenieModal';

let rafQueue;
let clock;

function finishAnimation() {
  act(() => {
    let frames = 0;
    while (rafQueue.length && frames < 20) {
      clock += 1000;
      const callbacks = rafQueue.splice(0);
      callbacks.forEach((callback) => callback(clock));
      frames += 1;
    }
  });
}

function rowRequest(id) {
  return {
    trade: { id, instrument: id.toUpperCase(), date: '2026-10-15' },
    row: document.querySelector(`[data-row="${id}"]`),
  };
}

function Harness() {
  const ref = createRef();
  return <>
    {['one', 'two', 'three'].map((id) => <button key={id} data-row={id} onClick={() => ref.current.toggle(rowRequest(id))}>{id}</button>)}
    <GenieModal ref={ref} renderContent={(trade, openImage) => <div>{trade.id} details<button data-testid="open-screenshot" onClick={(event) => openImage({
      images: [{ url: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', thumbnailUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=' }],
      index: 0,
      origin: event.currentTarget,
    })}>Open screenshot</button></div>} />
    <button data-testid="open-one" onClick={() => ref.current.toggle(rowRequest('one'))}>Open one</button>
    <button data-testid="open-two" onClick={() => ref.current.toggle(rowRequest('two'))}>Open two</button>
    <button data-testid="open-three" onClick={() => ref.current.toggle(rowRequest('three'))}>Open three</button>
  </>;
}

beforeEach(() => {
  rafQueue = [];
  clock = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { rafQueue.push(callback); return rafQueue.length; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect() {
    if (this.classList?.contains('genie-real-panel')) return { left: 100, top: 100, right: 700, bottom: 500, width: 600, height: 400 };
    return { left: 20, top: 40, right: 220, bottom: 80, width: 200, height: 40 };
  });
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() });
  vi.stubGlobal('Image', class MockImage {
    complete = true;
    naturalWidth = 800;
    naturalHeight = 600;
    set src(value) { this._src = value; }
    get src() { return this._src; }
    async decode() {}
  });
});

afterEach(() => vi.restoreAllMocks());

describe('Genie modal state machine', () => {
  it('opens and closes the selected trade', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('open-one'));
    finishAnimation();
    expect(screen.getByRole('dialog')).toHaveTextContent('ONE');
    fireEvent.keyDown(document, { key: 'Escape' });
    finishAnimation();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ignores clicks while animating and opens one queued trade after closing', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('open-one'));
    fireEvent.click(screen.getByTestId('open-three'));
    finishAnimation();
    expect(screen.getByRole('dialog')).toHaveTextContent('ONE');

    fireEvent.click(screen.getByTestId('open-two'));
    fireEvent.click(screen.getByTestId('open-three'));
    finishAnimation();
    finishAnimation();
    expect(screen.getByRole('dialog')).toHaveTextContent('TWO');
  });

  it('handles Escape in the screenshot layer without closing trade details', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('open-one'));
    finishAnimation();
    fireEvent.click(screen.getByTestId('open-screenshot'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    finishAnimation();
    expect(screen.getAllByRole('dialog')).toHaveLength(2);

    fireEvent.keyDown(document, { key: 'Escape' });
    finishAnimation();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog')).toHaveTextContent(/one details/i);
  });
});
