/**
 * GSAP motion system for Arki.
 *
 * Design principles:
 * - Apple HIG easing: power3.out for entrances, power2.out for standard, power2.inOut for symmetric
 * - Duration hierarchy: micro 120ms, standard 200ms, emphasis 280ms, view 400ms
 * - Stagger: 20ms per item, max 30 items animated
 * - All animations respect prefers-reduced-motion
 */
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

// --- Easing presets (Apple-style cubic-bezier equivalents) ---
export const EASE = {
  /** Standard deceleration. Use for most entrances. */
  out: "power3.out",
  /** Gentle deceleration. Use for panels, dialogs. */
  softOut: "power2.out",
  /** Symmetric. Use for expand/collapse, toggles. */
  inOut: "power2.inOut",
  /** Entrance. Use for exits that need a quick start. */
  in: "power2.in",
  /** Linear with slight ease. Use for continuous loops. */
  linear: "none",
} as const;

// --- Duration presets (ms) ---
export const DURATION = {
  /** Hover, opacity, small state changes */
  micro: 0.12,
  /** Panel slides, expand/collapse, standard transitions */
  standard: 0.2,
  /** View transitions, dialog open/close */
  emphasis: 0.28,
  /** Full view change (archive open, welcome -> list) */
  view: 0.4,
} as const;

// --- Stagger presets ---
export const STAGGER = {
  /** File list rows, history items */
  list: 0.02,
  /** Welcome view elements */
  sequence: 0.06,
} as const;

// --- Reduced motion check ---
const motionQuery =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

export function prefersReducedMotion(): boolean {
  return motionQuery?.matches ?? false;
}

/**
 * Instantly set elements to their final state when reduced motion is preferred.
 * Call this at the start of any animation function.
 */
export function skipIfReducedMotion(elements: gsap.TweenTarget[]): void {
  if (prefersReducedMotion()) {
    gsap.set(elements, { opacity: 1, y: 0, x: 0, scale: 1 });
  }
}

export { useGSAP };
