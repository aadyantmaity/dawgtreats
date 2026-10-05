# Inputs

Every rule lives in `lib/validation.ts` and is shared by whatever takes the input: the admin CLI, the customer forms and the API routes behind them. The layer that touches the database always re-checks, so a bad value never gets in by another door.

## Conventions

**Everywhere**

- **Money is typed in dollars and stored as integer cents.** Parsed with string math, never through a float (`lib/money.ts`).
- **Errors are specific:** they name the thing and the fix ("Snickerdoodle can't go below 5: that many are already sold or held").
- **Times are typed in PT** and stored in UTC. Anything shown back names the zone.

**In the CLI** (`scripts/admin.ts`)

- **Flavors are named, not numbered:** `qty Caramel 12`. A partial name works when it matches one flavor; otherwise the error lists the candidates.
- **Times are forgiving:** `12:00`, `1:30pm` and `14:00` all work. A bare end time means the afternoon, so `slots:add sat 12:00 3:00` runs to 3pm.
- **A range adds each half hour** and skips the ones already there, naming each skip.
- **Destructive commands need proof of intent:** `reset` refuses without `--yes`, and `week:delete` only touches a draft week with no orders.

**In forms** (customer pages)

- **Block what can never be valid, as it's typed:** letters in a quantity, a third decimal in a price.
- **Show a field's error once it's left or the form is submitted,** then update live while typing.
- **A button that can't work is disabled and says why.**
- **Numbers use `type="text"` with `inputMode`,** so phones get the keypad and there are no spinner arrows.
- **Fixed choices use `Select`** and **counts use `Stepper`** (`components/ui/`).

## Rules

| Input | Where | Rule | Message |
| --- | --- | --- | --- |
| Flavor name | `flavor:add`, `flavor:edit` | Required after trimming, 60 characters or fewer | "Name is required" |
| Flavor description | `flavor:add`, `flavor:edit` | Optional, 200 characters or fewer; blank stores nothing | "Description must be 200 characters or fewer" |
| Flavor price | `flavor:add`, `flavor:edit` | $0.01 to $100.00, given in dollars | "Enter a price like 3.50", "Price must be more than $0", "Price must be $100.00 or less" |
| Quantity | `qty` | Whole number, 0 to 1000, never below what's sold or held | "Quantities must be 1000 or fewer", "Can't go below N: that many are already sold or held" |
| Slot day | `slots:add`, `slots:rm` | Saturday or Sunday | "Pickup is Saturday or Sunday only" |
| Slot time | `slots:add`, `slots:rm` | On the hour or half hour, not already taken, not in the past, week not closed | "Slots start on the hour or half hour", "That slot already exists", "That time has already passed", "This week is closed" |
| Opening a week | `week:open` | Needs at least one quantity and one slot; only one week open at a time; cutoff not passed. A closed week reopens while its cutoff is ahead | "Set at least one flavor quantity before opening", "Add at least one pickup slot before opening", "Another week is open. Close it first.", "This week is already open" |
| Creating a week | `week:new` | The server picks the weekend; one week per weekend | "The week of … already exists" |
| Your name | Checkout | Required after trimming, 60 characters or fewer | "Name is required" |
| Email | Checkout | Required, has to look like an address, 120 characters or fewer | "Email is required", "That email address does not look right" |
| Phone | Checkout | Required, exactly 10 digits however they are typed; formats to (425) 515-4457 as you type and stores digits only | "Phone number is required", "Enter a 10-digit phone number" |
| Phone | Account details | Same, but blank is allowed: a saved profile only needs one by checkout | "Enter a 10-digit phone number" |
| Rating | Feedback | Required, one to five stars; tapping the same star again clears it | "Pick a rating first" |
| Message | Feedback | Optional, 500 characters or fewer after trimming | "Keep it to 500 characters or fewer" |
| Name | Feedback | Optional, 60 characters or fewer; blank stores nothing | "Name must be 60 characters or fewer" |

## Not enforced yet

- Two flavors can share a name.
- The database does not check `price_cents > 0`; only the app does.

## Adding an input

1. Add its limit and Zod rule to `lib/validation.ts`, with the message.
2. Parse it with that schema where it enters: the CLI argument, the route body, or both.
3. In a form, filter keystrokes and show the live error using the same helpers.
4. Add a row to the table above.
