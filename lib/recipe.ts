// One dough for every cookie, so the list lives here rather than on each flavor.
// Only the toppings folded in at the end differ, and those sit on the flavor row.
// Ordered by weight, the way an ingredient list is normally read.
export const BASE_INGREDIENTS = [
  "300 g all-purpose flour",
  "237 g brown sugar",
  "200 g butter",
  "150 g sugar",
  "2 eggs",
  "2 tsp vanilla extract",
  "2 tsp salt",
  "1 tsp baking soda",
] as const;

export function ingredientsFor(toppings: string | null): string[] {
  return toppings ? [...BASE_INGREDIENTS, toppings] : [...BASE_INGREDIENTS];
}
