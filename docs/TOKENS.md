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
| `text-primary` | Titles, body, values | ink `#15130f` |
| `text-secondary` | Subtext, labels, descriptions, nav | taupe `#5d564a` |
| `text-tertiary` | Placeholders, hints, empty states, de-emphasised items | pebble `#6e675c` |
| `text-on-action` | Text on a primary button | ivory `#f3f1ec` |
| `text-disabled` | Text of a disabled control | pebble `#6e675c` |
| `text-error` | Error messages | rust `#9c4a21` |
| `text-urgent` | Low stock ("7 left"); same colour as errors for now | rust `#9c4a21` |
| `text-success` | Success text, "Saved", Picked up badge | sage-700 `#2f6b3a` |
| `text-warning` | Warning text, Ready badge | honey-700 `#7a5a1e` |
| `text-rating` | A filled star in a review | honey-700 `#7a5a1e` |
| **Backgrounds** | | |
| `bg-page` | The page itself | ivory `#f3f1ec` |
| `bg-surface` | Cards, inputs, popups | white `#fcfbf8` |
| `bg-subtle` | Neutral badge | ivory `#f3f1ec` |
| `bg-hover` | Hovered rows, highlighted option | ivory `#f3f1ec` |
| `bg-placeholder` | Photo placeholder | sand `#e6e0d2` |
| `bg-action` | Primary button (the primary colour) | ink `#15130f` |
| `bg-disabled` | Disabled control | oat `#e9e3d6` |
| `bg-success` | Success badge | sage-100 `#e3efe2` |
| `bg-warning` | Warning badge | honey-100 `#f3e8d2` |
| **Borders** (also `divide-*`) | | |
| `border-default` | Hairlines, card and input edges | linen `#ded8cb` |
| `border-focus` | Focused, open or selected field | ink `#15130f` |
| `border-error` | Invalid field | rust `#9c4a21` |
| **Outlines** | | |
| `outline-focus` | Keyboard focus ring | ink `#15130f` |

Pebble sits darker than its plain palette-scaled value (`#948c7d`) so that `text-tertiary`
clears 4.5:1 on `bg-page`; see the contrast note below.

Opacity modifiers work on any token (`hover:bg-action/90`, `text-primary/80`).

## Contrast

Every text token must reach 4.5:1 against the background it sits on (3:1 at 24px and up).
Primary, secondary and error text clear this with room to spare on both `bg-page` and
`bg-surface`; tertiary is the tight one, which is why pebble sits darker than a plain scaled-down
reading of the palette table would give.

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
| `rounded-control` | 9999px | Inputs, selects, steppers, medium buttons, popups |
| `rounded-card` | 18px | Cards |
| `rounded-pill` | 9999px | Badges |

`rounded-control` and `rounded-pill` share the same 9999px value but stay separate tokens: a
control's shape and a badge's shape can diverge again without a rename. Popups ride along with
the other controls since they share the one token.

`rounded-control` is the pill. It fits buttons and single-line controls, where the whole shape
reads as one row. A multi-line or stacked surface, such as a textarea or a dropdown's option
list, takes `rounded-card` instead; a 9999px radius on a tall box looks like a broken corner, not
a pill.

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

# Motion

The site's motion personality is **Spring**: a 260ms overshoot that feels hand-drawn rather than
mechanical. Same idea as the other scales, defined once in `app/globals.css`.

| Token | Value | Used by |
| --- | --- | --- |
| `ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Every transition and animation |
| `--duration-motion` | 260ms | The animations below, and the duration every `transition` gets |

Tailwind has no duration namespace, so a class named after a duration token compiles to
nothing. `--duration-motion` is wired to `--default-transition-duration` instead: write
`transition` and it lasts 260ms. A press wants to feel quicker, so those use `duration-100`.

## Animations

| Class | Its job |
| --- | --- |
| `animate-bump` | A quantity or count that just changed, such as the cart count: scales up past rest and settles back |
| `animate-rise` | A panel or menu opening, such as the select dropdown: rises from below as it fades in |
| `animate-leave` | A list row leaving: fades out to the right and collapses its own height, so the rows below close the gap. The token holds its end state, so the row stays gone until the code removes it. Give the row `overflow-hidden` or the collapse shrinks in place instead of closing the space |

## Loading

| Class | Its job |
| --- | --- |
| `shimmer` | A placeholder block sweeping while its real content loads. Give it the size and radius of the thing it stands in for |
| `spinner` | A wait with no known shape, such as a button that has gone off to Stripe. Takes its colour from the text around it, so it reads on a dark button and on the page |

A skeleton must match what replaces it, or it trades a blank screen for a jumping
one. Route skeletons live in a `loading.tsx` beside the page they cover and reuse the
same width, padding and spacing classes as that page.

## Reduced motion

A global `prefers-reduced-motion: reduce` rule cuts every animation and transition to near-zero
duration. Animations still run and land on their end state instead of being removed, so nothing
on the site depends on motion to become visible or usable.

That rule would leave a loader frozen part-way, which tells the reader nothing. So `shimmer`
goes flat and `spinner` hides itself, and every place that uses them also says in words that
it is working.

# Fonts

| Token | Font | Used by |
| --- | --- | --- |
| `font-sans` | DM Sans | Body text (the default) |
| `font-display` | Shantell Sans, weights 500 and 700 | `h1`, `h2`, `h3`, and anywhere a heading sits in markup that isn't one of those tags |
