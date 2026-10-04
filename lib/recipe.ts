// Every cookie uses one dough, so these hold for all of them. A flavor can add
// its own on top, which is what the allergens column on the flavor row is for.
const BASE_ALLERGENS = ["wheat", "eggs", "milk", "honey"] as const;

// "a, b, and c" — the last comma stays.
function sentence(parts: readonly string[]): string {
  if (parts.length < 3) return parts.join(" and ");
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export function allergensFor(extra: string | null): string {
  const extras = (extra ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const all = [...BASE_ALLERGENS, ...extras.filter((e) => !BASE_ALLERGENS.includes(e as never))];
  return `Contains ${sentence(all)}.`;
}
