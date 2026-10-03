# Design tokens

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
| `text-rating` | A filled star in a review | honey-700 `#7a5a1e` |
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

# Spacing, sizes and radii

Same idea as colours: a fixed set, defined once in `app/globals.css`. Tailwind's open-ended scale is removed (`--spacing: initial`), so a value off the scale does not compile.

## The scale

4px steps, with two half steps for fine work: `0`, `0.5`, `1`, `1.5`, `2`, `3`, `4`, `5`, `6`, `8`, `10`, `12`, `16`, `20`, `24`.

That is 2px, 4px, 6px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px, 80px, 96px. `p-7`, `px-3.5` and `gap-9` are deliberately absent: round to a neighbour rather than adding a step.

Use them anywhere Tailwind takes a length: `p-4`, `gap-2`, `mt-6`, `size-4`, `top-0`.

## Named sizes

For values that repeat with a meaning, so they can change in one place.

| Token | Value | Used by |
| --- | --- | --- |
| `h-control`, `size-control` | 44px | Inputs, selects, steppers, medium buttons |
| `h-control-sm` | 36px | Small buttons |
| `max-h-menu` | 256px | Dropdown list before it scrolls |
| `aspect-photo` | 4:3 | Flavor photos |

## Radii

| Token | Value | Used by |
| --- | --- | --- |
| `rounded-control-sm` | 8px | Small buttons, chips |
| `rounded-control` | 12px | Inputs, selects, steppers, medium buttons, popups |
| `rounded-card` | 16px | Cards |
| `rounded-pill` | 9999px | Badges |

Tailwind's own `rounded-lg`, `rounded-xl` and friends are removed.

## Page width

Every page is `mx-auto w-full flex-1 px-6 py-12` and left-aligned. Only the maximum width
changes, and only by what the page holds:

| Width | For | Pages |
| --- | --- | --- |
| `max-w-md` | one short form and nothing else | feedback, order lookup, 404 |
| `max-w-2xl` | a page with content to read | cart, checkout, an order, account, pickup |
| `max-w-4xl` | the card grid | the menu |

A page must not change width with its own state. The account page used to be `md` signed out
and `2xl` signed in, so it jumped when you signed in.

The 404 is the one page that centres its text, because it has nowhere to send the eye next.

## Adding to the scale

1. Round to an existing step first; that is almost always right.
2. If a value repeats with a meaning (a second control height, say), add a **named** token, not a number.
3. Only widen the numeric scale when a real gap shows up, and add the row here.
