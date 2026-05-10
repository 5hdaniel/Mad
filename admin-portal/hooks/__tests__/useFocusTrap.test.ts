// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getFocusableElements,
  handleFocusTrapKeyDown,
} from '../useFocusTrap';

function mountContainer(html: string): HTMLDivElement {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('getFocusableElements', () => {
  it('returns buttons, links, inputs, selects, textareas, and positive tabindex', () => {
    const container = mountContainer(`
      <button id="b1">A</button>
      <a id="a1" href="#">Link</a>
      <input id="i1" type="text" />
      <select id="s1"><option>o</option></select>
      <textarea id="t1"></textarea>
      <div id="d1" tabindex="0">div</div>
    `);
    const ids = getFocusableElements(container).map((el) => el.id);
    expect(ids).toEqual(['b1', 'a1', 'i1', 's1', 't1', 'd1']);
  });

  it('skips disabled form controls', () => {
    const container = mountContainer(`
      <button id="b1">A</button>
      <button id="b2" disabled>B</button>
      <input id="i1" disabled />
      <select id="s1" disabled></select>
      <textarea id="t1" disabled></textarea>
      <button id="b3">C</button>
    `);
    const ids = getFocusableElements(container).map((el) => el.id);
    expect(ids).toEqual(['b1', 'b3']);
  });

  it('skips tabindex="-1" elements', () => {
    const container = mountContainer(`
      <button id="b1">A</button>
      <div id="d1" tabindex="-1">unreachable</div>
      <button id="b2">B</button>
    `);
    const ids = getFocusableElements(container).map((el) => el.id);
    expect(ids).toEqual(['b1', 'b2']);
  });

  it('returns [] when container is null', () => {
    expect(getFocusableElements(null)).toEqual([]);
  });
});

describe('handleFocusTrapKeyDown', () => {
  function buildEvent(key: string, shiftKey = false) {
    return {
      key,
      shiftKey,
      preventDefault: vi.fn(),
    };
  }

  it('no-ops for non-Tab keys', () => {
    const container = mountContainer(`<button id="b1">A</button>`);
    const e = buildEvent('Enter');
    handleFocusTrapKeyDown(e, container, document.activeElement);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('Tab on last element wraps to first and preventDefaults', () => {
    const container = mountContainer(`
      <button id="b1">A</button>
      <button id="b2">B</button>
      <button id="b3">C</button>
    `);
    const last = container.querySelector<HTMLButtonElement>('#b3')!;
    const first = container.querySelector<HTMLButtonElement>('#b1')!;
    last.focus();
    expect(document.activeElement).toBe(last);

    const e = buildEvent('Tab', false);
    handleFocusTrapKeyDown(e, container, document.activeElement);

    expect(e.preventDefault).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(first);
  });

  it('Shift+Tab on first element wraps to last and preventDefaults', () => {
    const container = mountContainer(`
      <button id="b1">A</button>
      <button id="b2">B</button>
      <button id="b3">C</button>
    `);
    const first = container.querySelector<HTMLButtonElement>('#b1')!;
    const last = container.querySelector<HTMLButtonElement>('#b3')!;
    first.focus();

    const e = buildEvent('Tab', true);
    handleFocusTrapKeyDown(e, container, document.activeElement);

    expect(e.preventDefault).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(last);
  });

  it('Tab in the middle does not preventDefault (native Tab proceeds)', () => {
    const container = mountContainer(`
      <button id="b1">A</button>
      <button id="b2">B</button>
      <button id="b3">C</button>
    `);
    const middle = container.querySelector<HTMLButtonElement>('#b2')!;
    middle.focus();

    const e = buildEvent('Tab', false);
    handleFocusTrapKeyDown(e, container, document.activeElement);

    expect(e.preventDefault).not.toHaveBeenCalled();
    // Focus unchanged — browser handles the normal advance.
    expect(document.activeElement).toBe(middle);
  });

  it('Tab with focus outside container redirects into first focusable', () => {
    const container = mountContainer(`
      <button id="b1">A</button>
      <button id="b2">B</button>
    `);
    // Focus an element OUTSIDE the container.
    const outside = document.createElement('button');
    outside.id = 'outside';
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    const e = buildEvent('Tab', false);
    handleFocusTrapKeyDown(e, container, document.activeElement);

    expect(e.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(
      container.querySelector<HTMLButtonElement>('#b1')
    );
  });

  it('Tab with no focusable descendants preventDefaults and does not throw', () => {
    const container = mountContainer(`<span>nothing</span>`);
    const e = buildEvent('Tab', false);
    expect(() =>
      handleFocusTrapKeyDown(e, container, document.activeElement)
    ).not.toThrow();
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('full Tab cycle stays inside the container (forward)', () => {
    const container = mountContainer(`
      <button id="b1">A</button>
      <button id="b2">B</button>
      <button id="b3">C</button>
    `);
    const ids = ['b1', 'b2', 'b3'];
    // Start on first
    container.querySelector<HTMLButtonElement>('#b1')!.focus();

    // Simulate three Tab presses. The handler only wraps at the boundary;
    // otherwise the browser would advance, which we emulate manually.
    const visited: string[] = [document.activeElement!.id];
    for (let i = 0; i < 3; i++) {
      const e = buildEvent('Tab', false);
      handleFocusTrapKeyDown(e, container, document.activeElement);
      if (e.preventDefault.mock.calls.length === 0) {
        // Browser advance emulation: move focus to the next focusable.
        const currentIdx = ids.indexOf((document.activeElement as HTMLElement).id);
        const next = container.querySelector<HTMLButtonElement>(
          `#${ids[currentIdx + 1]}`
        )!;
        next.focus();
      }
      visited.push((document.activeElement as HTMLElement).id);
    }

    // After 3 tabs starting at b1 we should see b2, b3, then wrap to b1.
    expect(visited).toEqual(['b1', 'b2', 'b3', 'b1']);
  });
});
