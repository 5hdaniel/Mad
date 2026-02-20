import { useState, useEffect, RefObject } from "react";

/**
 * Scroll-spy hook that tracks which section is currently visible in a scroll container.
 * Uses IntersectionObserver with a passive scroll listener for bottom-detection.
 *
 * @param sectionIds - Ordered list of element IDs to observe
 * @param containerRef - Ref to the scrollable container
 * @param topOffset - Pixels clipped from the top (e.g. sticky tab bar height)
 * @param enabled - Set false while content is loading; the observer starts when true
 */
export function useScrollSpy(
  sectionIds: string[],
  containerRef: RefObject<HTMLElement | null>,
  topOffset: number = 44,
  enabled: boolean = true
): string {
  const [activeId, setActiveId] = useState(sectionIds[0] ?? "");

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container || sectionIds.length === 0) return;
    if (typeof IntersectionObserver === "undefined") return; // jsdom safety

    const visibleSet = new Set<string>();

    // Pick the topmost visible section by DOM order
    const pickActive = () => {
      for (const id of sectionIds) {
        if (visibleSet.has(id)) {
          setActiveId(id);
          return;
        }
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleSet.add(entry.target.id);
          } else {
            visibleSet.delete(entry.target.id);
          }
        }
        pickActive();
      },
      {
        root: container,
        rootMargin: `-${topOffset}px 0px -40% 0px`,
        threshold: 0,
      }
    );

    // Observe only elements that exist in DOM
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    // Passive scroll listener to force last section active when scrolled to bottom
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const atBottom = scrollHeight - scrollTop - clientHeight < 2;
      if (atBottom) {
        setActiveId(sectionIds[sectionIds.length - 1]);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", handleScroll);
    };
  }, [sectionIds, containerRef, topOffset, enabled]);

  return activeId;
}
