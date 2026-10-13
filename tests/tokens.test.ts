import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { DURATION_MS, SPRING } from '@/lib/motion'
import { EMAIL_BACKDROP, PALETTE, rgba } from '@/lib/palette'

// HTML email, the favicon, the link preview and a web animation cannot read a custom
// property, so each one holds a copy. These fail the day app/globals.css moves alone.
const CSS = readFileSync(path.join(import.meta.dirname, '..', 'app', 'globals.css'), 'utf8')

// `--palette-sage-100` is `sage100` in TypeScript.
function key(cssName: string): string {
  return cssName.replace(/-(.)/g, (_, character: string) => character.toUpperCase())
}

function declaredPalette(): Record<string, string> {
  const found: Record<string, string> = {}
  for (const match of CSS.matchAll(/--palette-([a-z0-9-]+)\s*:\s*(#[0-9a-f]{6})\s*;/gi)) {
    found[key(match[1])] = match[2].toLowerCase()
  }
  return found
}

// Throws rather than returns nothing: a renamed token has to fail loudly, not quietly pass.
function declaration(name: string): string {
  const found = new RegExp(`--${name}:\\s*([^;]+);`).exec(CSS)
  if (!found) throw new Error(`app/globals.css declares no --${name}`)
  return found[1].trim().replace(/\s+/g, ' ')
}

describe('the palette TypeScript renders from', () => {
  it('holds the same value as app/globals.css for every token', () => {
    expect(declaredPalette()).toEqual(PALETTE)
  })

  it('names every token in app/globals.css, and invents none', () => {
    const declared = Object.keys(declaredPalette()).sort()
    // A regex that matched nothing would make the comparison above pass on two empties.
    expect(declared.length).toBeGreaterThan(10)
    expect(Object.keys(PALETTE).sort()).toEqual(declared)
  })

  // The email ground claims to be a colour the site does not have. The day the site does
  // have it, these are two names for one value and the email should read the token instead.
  it('keeps the email ground out of the site palette', () => {
    expect(Object.values(declaredPalette())).not.toContain(EMAIL_BACKDROP)
  })
})

describe('the motion TypeScript animates with', () => {
  it('lasts as long as app/globals.css says', () => {
    expect(declaration('duration-motion')).toBe(`${DURATION_MS}ms`)
  })

  it('springs the same way as app/globals.css', () => {
    expect(declaration('ease-spring')).toBe(SPRING.replace(/\s+/g, ' '))
  })
})

describe('a palette colour made see-through', () => {
  it('keeps the channels of the hex it was given', () => {
    expect(rgba(PALETTE.ink, 0.56)).toBe('rgba(40, 28, 18, 0.56)')
    expect(rgba('#ffffff', 1)).toBe('rgba(255, 255, 255, 1)')
    expect(rgba('#000000', 0)).toBe('rgba(0, 0, 0, 0)')
  })
})
