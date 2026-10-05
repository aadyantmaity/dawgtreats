// A web animation cannot read a custom property, so the spring and duration from
// app/globals.css are duplicated here.
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const DURATION_MS = 260;

// Only the bump this module started may be cancelled. `getAnimations()` would also return
// the element's CSS transitions, and cancelling one of those changes how it looks.
const running = new WeakMap<HTMLElement, Animation>();

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// `peak` has no default on purpose: a larger element needs a smaller overshoot, so
// each caller picks one that will not shove its neighbours.
export function bump(element: HTMLElement | null, peak: number) {
  if (!element) return;
  // The stylesheet's reduced-motion rule never reaches a web animation.
  if (prefersReducedMotion()) return;

  // One bump at a time: a second would start from something already grown.
  running.get(element)?.cancel();

  running.set(
    element,
    element.animate(
      [
        { transform: "scale(1)" },
        { transform: `scale(${peak})`, offset: 0.4 },
        { transform: "scale(1)" },
      ],
      { duration: DURATION_MS, easing: SPRING },
    ),
  );
}
