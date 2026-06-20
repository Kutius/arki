/**
 * Staggered reveal animation for list items.
 *
 * Usage:
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   useStaggerReveal(containerRef, { itemSelector: '[data-stagger]', deps: [entries] });
 */
import type { RefObject } from "react";
import { gsap } from "gsap";
import { DURATION, EASE, STAGGER, prefersReducedMotion, useGSAP } from "./gsap";

interface StaggerRevealOptions {
  /** CSS selector for animatable children within the container */
  itemSelector: string;
  /** Dependencies that trigger a new stagger (e.g. [entries, currentPath]) */
  deps?: unknown[];
  /** Max number of items to stagger. Beyond this, instant reveal. */
  maxItems?: number;
  /** Y offset for the slide-up effect (px) */
  offsetY?: number;
  /** Delay before the stagger begins (s) */
  delay?: number;
}

export function useStaggerReveal(
  containerRef: RefObject<HTMLElement | null>,
  options: StaggerRevealOptions,
): void {
  const {
    itemSelector,
    deps = [],
    maxItems = 30,
    offsetY = 4,
    delay = 0,
  } = options;

  useGSAP(
    () => {
      if (!containerRef.current) return;

      const items = containerRef.current.querySelectorAll(itemSelector);
      if (items.length === 0) return;

      if (prefersReducedMotion() || items.length > maxItems) {
        gsap.set(items, { opacity: 1, y: 0 });
        return;
      }

      gsap.from(items, {
        opacity: 0,
        y: offsetY,
        duration: DURATION.standard,
        ease: EASE.softOut,
        stagger: STAGGER.list,
        delay,
      });
    },
    {
      scope: containerRef,
      dependencies: deps,
      revertOnUpdate: true,
    },
  );
}
