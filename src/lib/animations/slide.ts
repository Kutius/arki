/**
 * Slide-in animation for panels.
 *
 * Usage:
 *   const panelRef = useRef<HTMLDivElement>(null);
 *   useSlideIn(panelRef, { direction: 'right', deps: [selectedEntry] });
 */
import type { RefObject } from "react";
import { gsap } from "gsap";
import { DURATION, EASE, prefersReducedMotion, useGSAP } from "./gsap";

type SlideDirection = "left" | "right" | "top" | "bottom";

interface SlideInOptions {
  /** Direction the panel slides in from */
  direction?: SlideDirection;
  /** Distance to slide (px) */
  distance?: number;
  /** Dependencies that trigger the slide animation */
  deps?: unknown[];
  /** Delay before animation starts (s) */
  delay?: number;
}

const DIRECTION_AXIS: Record<SlideDirection, "x" | "y"> = {
  left: "x",
  right: "x",
  top: "y",
  bottom: "y",
};

const DIRECTION_SIGN: Record<SlideDirection, number> = {
  left: -1,
  right: 1,
  top: -1,
  bottom: 1,
};

export function useSlideIn(
  panelRef: RefObject<HTMLElement | null>,
  options: SlideInOptions = {},
): void {
  const {
    direction = "right",
    distance = 12,
    deps = [],
    delay = 0,
  } = options;

  useGSAP(
    () => {
      if (!panelRef.current) return;

      if (prefersReducedMotion()) {
        gsap.set(panelRef.current, { opacity: 1, x: 0, y: 0 });
        return;
      }

      const axis = DIRECTION_AXIS[direction];
      const sign = DIRECTION_SIGN[direction];
      const fromVars: gsap.TweenVars = {
        opacity: 0,
        delay,
        duration: DURATION.emphasis,
        ease: EASE.softOut,
      };

      if (axis === "x") {
        fromVars.x = sign * distance;
      } else {
        fromVars.y = sign * distance;
      }

      gsap.from(panelRef.current, fromVars);
    },
    {
      scope: panelRef,
      dependencies: deps,
      revertOnUpdate: true,
    },
  );
}
