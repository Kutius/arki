/**
 * View-level entrance animation.
 *
 * For coordinated multi-element reveals (WelcomeView hero, etc.).
 * Elements animate in sequence with configurable delays.
 *
 * Usage:
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   useViewEntrance(containerRef, { deps: [] });
 *   // Children need data-entrance="hero" | "actions" | "content" attributes
 */
import type { RefObject } from "react";
import { gsap } from "gsap";
import { DURATION, EASE, STAGGER, prefersReducedMotion, useGSAP } from "./gsap";

interface ViewEntranceOptions {
  /** Dependencies that trigger the entrance */
  deps?: unknown[];
}

/**
 * Animate elements with data-entrance attributes in sequence.
 * - data-entrance="hero"   -> first, fade + translateY
 * - data-entrance="actions" -> second, 200ms delay
 * - data-entrance="content" -> third, staggered children with data-stagger
 */
export function useViewEntrance(
  containerRef: RefObject<HTMLElement | null>,
  options: ViewEntranceOptions = {},
): void {
  const { deps = [] } = options;

  useGSAP(
    () => {
      if (!containerRef.current) return;

      if (prefersReducedMotion()) {
        const all = containerRef.current.querySelectorAll(
          "[data-entrance], [data-stagger]",
        );
        gsap.set(all, { opacity: 1, y: 0 });
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: EASE.out } });

      // Hero section
      const hero = containerRef.current.querySelector(
        '[data-entrance="hero"]',
      );
      if (hero) {
        tl.from(hero, {
          opacity: 0,
          y: 8,
          duration: DURATION.view,
        });
      }

      // Actions section
      const actions = containerRef.current.querySelector(
        '[data-entrance="actions"]',
      );
      if (actions) {
        tl.from(
          actions,
          {
            opacity: 0,
            y: 6,
            duration: DURATION.emphasis,
          },
          "-=0.25",
        );
      }

      // Content section (staggered children)
      const content = containerRef.current.querySelector(
        '[data-entrance="content"]',
      );
      if (content) {
        const staggerItems = content.querySelectorAll("[data-stagger]");
        if (staggerItems.length > 0) {
          tl.from(
            staggerItems,
            {
              opacity: 0,
              y: 4,
              duration: DURATION.standard,
              stagger: STAGGER.list,
            },
            "-=0.15",
          );
        }
      }
    },
    {
      scope: containerRef,
      dependencies: deps,
      revertOnUpdate: true,
    },
  );
}
