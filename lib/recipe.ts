// One dough for every cookie, so the list lives here rather than on each flavor.
// Only the toppings folded in at the end differ, and those sit on the flavor row.
// Ordered by weight, the way an ingredient list is normally read.
const BASE_INGREDIENTS = [
  "all-purpose flour",
  "brown sugar",
  "butter",
  "sugar",
  "eggs",
  "vanilla extract",
  "salt",
  "baking soda",
] as const;

// Stored lowercase so they read as one sentence; only the first word is raised.
export function ingredientsFor(toppings: string | null): string {
  const all = toppings ? [...BASE_INGREDIENTS, toppings] : [...BASE_INGREDIENTS];
  const line = all.join(", ");
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}.`;
}
