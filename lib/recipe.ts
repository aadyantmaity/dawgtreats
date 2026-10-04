// The dough is the same for every cookie, so these hold whatever is folded in.
// Honey sits last so anything a flavor adds reads in the usual order.
const BASE_ALLERGENS = ["wheat", "eggs", "milk"] as const;
const HONEY = "honey";

function split(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

// "a, b, and c" — the comma before "and" stays.
function sentence(parts: string[]): string {
  if (parts.length < 3) return parts.join(" and ");
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export function allergenLine(extra: string | null): string {
  const known = new Set<string>([...BASE_ALLERGENS, HONEY]);
  const added = split(extra).filter((item) => !known.has(item));
  return `Contains ${sentence([...BASE_ALLERGENS, ...added, HONEY])}.`;
}

// Only what a packet actually warns about, never a guess from the brand.
export function mayContainLine(items: string | null): string | null {
  const parts = split(items);
  return parts.length ? `May contain ${sentence(parts)}.` : null;
}
