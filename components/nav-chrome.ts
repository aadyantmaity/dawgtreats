// The shared shape of the navigation. It sits in its own module with no "use client" on
// it because app/layout.tsx is a server component: every export of a client module reaches
// the server graph as a reference to an entry point, not as its value, so a constant read
// from one there is undefined and the page 500s.

// One row, one shape. The cart rides in the tab row and in the drawer's list of names, so
// each takes the row's own geometry rather than a copy of it that drifts.
export const NAV_TAB =
  "relative flex min-h-control shrink-0 items-center justify-center gap-1.5 rounded-pill px-3 py-1.5 text-sm whitespace-nowrap transition-colors ease-spring sm:min-h-0";

export const NAV_DRAWER_ROW =
  "flex h-control items-center gap-3 rounded-pill px-4 text-base transition-colors ease-spring";
