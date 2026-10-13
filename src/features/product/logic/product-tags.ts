import type { ProductPage } from '../contracts/catalog-product.ts';

/*
 * Cache tags of the product endpoints (RF-7). Plain data, no RTK values, so they are tested on
 * their own and T13 reuses the very same shapes to invalidate them after an order.
 *
 * - `ProductList` / `LIST`: ONE tag for every list (category, search, filters). Invalidating it
 *   refetches all the lists that are mounted and marks the rest stale.
 * - `Product` / `<id>`: one tag per product. A list provides the tag of each product it loaded,
 *   and the detail endpoint provides its own, so an order for product X refreshes X wherever it
 *   is cached (as a list item or as a detail).
 */

export type ProductListTag = { readonly type: 'ProductList'; readonly id: 'LIST' };
export type ProductTag = { readonly type: 'Product'; readonly id: string };

export const PRODUCT_LIST_TAG: ProductListTag = { type: 'ProductList', id: 'LIST' };

export function productTag(id: string): ProductTag {
  return { type: 'Product', id };
}

/** Tags that a (possibly partial, possibly empty) set of loaded pages provides. */
export function productListTags(
  pages: readonly ProductPage[] | undefined,
): (ProductListTag | ProductTag)[] {
  const ids = new Set<string>();
  for (const { items } of pages ?? []) {
    for (const { id } of items) {
      ids.add(id);
    }
  }

  return [PRODUCT_LIST_TAG, ...[...ids].map(productTag)];
}
