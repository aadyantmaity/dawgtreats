# Colour tokens

Colours are named by the job they do, never by how they look. Components use role tokens only; hex values live once, in the palette at the top of `app/globals.css`.

## How it works

- **Palette** (`--palette-*` in `:root`): the raw colours. Only role tokens reference them.
- **Role tokens** (`@theme`): each one points at a palette colour. Tailwind scopes them per property, so `--text-color-secondary` makes `text-secondary` and nothing else; there is no `bg-secondary`.
- **Tailwind's default colours are removed** (`--color-*: initial`). `bg-red-500` or `bg-white` doesn't compile to anything, so an off-system colour shows up as a missing style, not a quiet drift.
- **One token per role, not per element.** Titles and body text share `text-primary` while they're the same colour. Split a token only when two roles actually need different colours.

## Tokens

| Class | Its job | Palette |
| --- | --- | --- |
| **Text** | | |
| `text-primary` | Titles, body, values | ink `#1b1a17` |
| `text-secondary` | Subtext, labels, descriptions, nav | taupe `#6b665c` |
| `text-tertiary` | Placeholders, hints, empty states, de-emphasised items | pebble `#a8a298` |
| `text-on-action` | Text on a primary button | ivory `#fbfaf7` |
| `text-disabled` | Text of a disabled control | pebble `#a8a298` |
| `text-error` | Error messages | rust `#b4561f` |
| `text-urgent` | Low stock ("7 left"); same colour as errors for now | rust `#b4561f` |
| `text-success` | Success text, "Saved", Picked up badge | sage-700 `#2f6b3a` |
| `text-warning` | Warning text, Ready badge | honey-700 `#7a5a1e` |
| **Backgrounds** | | |
| `bg-page` | The page itself | ivory `#fbfaf7` |
| `bg-surface` | Cards, inputs, popups | white `#ffffff` |
| `bg-subtle` | Neutral badge | ivory `#fbfaf7` |
| `bg-hover` | Hovered rows, highlighted option | ivory `#fbfaf7` |
| `bg-placeholder` | Photo placeholder | sand `#efe8dc` |
| `bg-action` | Primary button (the primary colour) | ink `#1b1a17` |
| `bg-disabled` | Disabled control | oat `#f1ece3` |
| `bg-success` | Success badge | sage-100 `#e3efe2` |
| `bg-warning` | Warning badge | honey-100 `#f3e8d2` |
| **Borders** (also `divide-*`) | | |
| `border-default` | Hairlines, card and input edges | linen `#e8e3d8` |
| `border-focus` | Focused, open or selected field | ink `#1b1a17` |
| `border-error` | Invalid field | rust `#b4561f` |
| **Outlines** | | |
| `outline-focus` | Keyboard focus ring | ink `#1b1a17` |

Opacity modifiers work on any token (`hover:bg-action/90`, `text-primary/80`).

## Adding or changing a colour

1. **Changing how a role looks:** repoint the role token to another palette colour, or add a palette colour. No component changes.
2. **A new role:** add a token under the right property (`--text-color-*`, `--background-color-*`, `--border-color-*`, `--outline-color-*`), named for the job, then add a row above.
3. **Never** put a hex value, `rgb()`, an arbitrary value like `bg-[#fff]`, or a palette variable in a component.
