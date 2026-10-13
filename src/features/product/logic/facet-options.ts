// Options of the advanced-filters sheet that are derived from server data (pure logic).

import type { CategoryNode } from '../contracts/catalog-product.ts';
import { normalizeSearchText } from './product-query.ts';

/** One subcategory the user can pick: `id` is the value sent as `subcategory`. */
export type SubcategoryOption = Readonly<{ id: string; name: string }>;

/**
 * The subcategories the sheet offers.
 *
 * - On a category screen: only those of THAT category (a vitamin filter never lists "zinc").
 *   The category is compared by its normalized form because the server does the same.
 * - Without a category (the search, T12): all of them, category after category, each id once.
 * - A category the server does not know gives an empty list; options are never invented.
 */
export function selectSubcategoryOptions(
  categories: readonly CategoryNode[],
  categoryId: string | undefined,
): SubcategoryOption[] {
  const wanted = categoryId === undefined ? undefined : normalizeSearchText(categoryId);
  const options = new Map<string, SubcategoryOption>();

  for (const category of categories) {
    if (wanted !== undefined && normalizeSearchText(category.id) !== wanted) {
      continue;
    }
    for (const subcategory of category.subcategories) {
      if (!options.has(subcategory.id)) {
        options.set(subcategory.id, { id: subcategory.id, name: subcategory.name });
      }
    }
  }

  return [...options.values()];
}
