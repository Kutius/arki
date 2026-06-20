/**
 * Breathing pulse animation for the drag overlay icon.
 *
 * Usage:
 *   const iconRef = useRef<SVGSVGElement>(null);
 *   useBreathingPulse(iconRef, { active: isDragOver });
 */
import type { RefObject } from "react";
import { gsap } from "gsap";
import { EASE, prefersReducedMotion, useGSAP } from "./gsap";

interface BreathingPulseOptions {
  /** Whether the pulse is active */
  active: boolean;
  /** Scale range (1.0 + amplitude) */
  amplitude?: number;
  /** Cycle duration (s) */
  cycleDuration?: number;
}

export function useBreathingPulse(
  elementRef: RefObject<Element | null>,
  options: BreathingPulseOptions,
): void {
  const { active, amplitude = 0.05, cycleDuration = 1.5 } = options;

  useGSAP(
    () => {
      if (!elementRef.current) return;

      if (!active || prefersReducedMotion()) {
        gsap.set(elementRef.current, { scale: 1 });
        return;
      }

      const tl = gsap.timeline({ repeat: -1, yoyo: true });
      tl.to(elementRef.current, {
        scale: 1 + amplitude,
        duration: cycleDuration / 2,
        ease: EASE.inOut,
      });

      return () => {
        tl.kill();
      };
    },
    {
      scope: elementRef,
      dependencies: [active],
      revertOnUpdate: true,
    },
  );
}
