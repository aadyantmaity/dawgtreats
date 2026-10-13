// The shared shape of the navigation. It sits in its own module with no "use client" on
// it because app/layout.tsx is a server component: every export of a client module reaches
// the server graph as a reference to an entry point, not as its value, so a constant read
// from one there is undefined and the page 500s.

// Where the tab row gives way to the drawer. The row never wraps and never scrolls, so the
// cutover is the window width it stops fitting in. Measured on the running site at 100%
// zoom with the display font loaded: a visitor's row is 478px and clips below a 669px
// window, and the owner's two extra tabs make it 667px, which clips below 858px. So a
// visitor's row can appear at `md` (768px) and the owner's has to wait for `lg` (1024px).
// Both class strings are spelled out because Tailwind never sees a variant that is only
// assembled at runtime.
export const NAV_CUTOVER = {
  narrow: { row: "hidden min-w-0 md:block", drawer: "md:hidden" },
  wide: { row: "hidden min-w-0 lg:block", drawer: "lg:hidden" },
} as const;

// One row, one shape. The cart rides in the tab row and in the drawer's list of names, so
// each takes the row's own geometry rather than a copy of it that drifts.
export const NAV_TAB =
  "relative flex shrink-0 items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm whitespace-nowrap transition-colors ease-spring";

export const NAV_DRAWER_ROW =
  "flex h-control items-center gap-3 rounded-pill px-4 text-base transition-colors ease-spring";
