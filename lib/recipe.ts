// One dough for every cookie, so the list lives here rather than on each flavor.
// Only the toppings folded in at the end differ, and those sit on the flavor row.
// Ordered by weight, the way an ingredient list is normally read.
export const BASE_INGREDIENTS = [
  "All-purpose flour",
  "Brown sugar",
  "Butter",
  "Sugar",
  "Eggs",
  "Vanilla extract",
  "Salt",
  "Baking soda",
] as const;

export function ingredientsFor(toppings: string | null): string[] {
  return toppings ? [...BASE_INGREDIENTS, toppings] : [...BASE_INGREDIENTS];
}
