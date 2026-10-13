// Three renderers cannot read a CSS custom property: HTML email, the favicon and the
// link preview. This is their one copy of app/globals.css; tests/palette.test.ts ties them.
export const PALETTE = {
  ivory: '#f3f1ec',
  white: '#fcfbf8',
  ink: '#281c12',
  linen: '#ded8cb',
  taupe: '#5d564a',
  pebble: '#6e675c',
  sand: '#e6e0d2',
  oat: '#e9e3d6',
  rust: '#9c4a21',
  sage100: '#e3efe2',
  sage700: '#2f6b3a',
  honey100: '#f3e8d2',
  honey700: '#7a5a1e',
} as const

// The ground an email's card sits on, darker than the site's own page so the card still
// reads as a card. The site never needs it, so no palette token above holds it.
export const EMAIL_BACKDROP = '#e7e4dd'

// For a renderer that needs one of these see-through. Typing the channels by hand is
// what started the drift this module exists to stop.
export function rgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
}
