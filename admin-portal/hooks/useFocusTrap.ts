import { useEffect, type RefObject } from 'react';

/**
 * Selector for elements the browser will include in the default Tab order.
 * Matches the common focus-trap convention — buttons/links/form controls that
 * are not disabled, plus anything with an explicit non-negative tabindex.
 */
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Returns the focusable descendants of `container` in DOM (tab) order.
 * Exported so unit tests can exercise the pure selection logic without
 * rendering the React tree.
 */
export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * Pure Tab/Shift+Tab handler used by `useFocusTrap`. Exported so the trap
 * logic can be unit-tested in isolation without rendering React.
 *
 * Call this from a `keydown` listener; it mutates focus and calls
 * `preventDefault` when it wraps. No-ops for non-Tab keys.
 */
export function handleFocusTrapKeyDown(
  e: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>,
  container: HTMLElement,
  activeElement: Element | null
): void {
  if (e.key !== 'Tab') return;
  const focusables = getFocusableElements(container);
  if (focusables.length === 0) {
    // Nothing focusable inside — prevent Tab from escaping the modal.
    e.preventDefault();
    return;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = activeElement as HTMLElement | null;
  const insideContainer = active ? container.contains(active) : false;

  if (e.shiftKey) {
    if (active === first || !insideContainer) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (active === last || !insideContainer) {
      e.preventDefault();
      first.focus();
    }
  }
}

/**
 * Traps keyboard focus inside the element referenced by `containerRef` while
 * `enabled` is true. On enable it focuses the first focusable descendant
 * (or an element marked `data-autofocus` if present) and remembers whatever
 * was focused before so it can restore focus on disable.
 *
 * Tab at the last focusable element wraps to the first; Shift+Tab at the
 * first wraps to the last. Other keys (Escape, click-outside handling, etc.)
 * are intentionally left to the caller so existing modal behavior is
 * preserved.
 *
 * Typical usage:
 * ```tsx
 * const modalRef = useRef<HTMLDivElement>(null);
 * useFocusTrap(modalRef, open);
 * return <div ref={modalRef}>...</div>;
 * ```
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused =
      typeof document !== 'undefined'
        ? (document.activeElement as HTMLElement | null)
        : null;

    // Focus an initial target on open. If the container has an element
    // marked `data-autofocus` (typically a search input), prefer that so
    // existing UX is preserved — otherwise focus the first focusable child.
    const focusables = getFocusableElements(container);
    const preferred = container.querySelector<HTMLElement>('[data-autofocus]');
    const initial = preferred ?? focusables[0] ?? null;
    if (initial) {
      initial.focus();
    }

    function handleKeyDown(e: KeyboardEvent) {
      // `container` is captured by the effect closure; it's non-null here.
      handleFocusTrapKeyDown(e, container!, document.activeElement);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to whatever opened the modal (if it's still in the DOM).
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [containerRef, enabled]);
}
