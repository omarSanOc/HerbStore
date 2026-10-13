import { PRODUCT_LIST_TAG, productTag } from '../../product/logic/product-tags.ts';
import type { ProductListTag, ProductTag } from '../../product/logic/product-tags.ts';
import type { OrderItem, OrderResult } from '../contracts/order.ts';

/** Same name as the `tagTypes` entry of `baseApi` and the `providesTags` of `getHome`. */
export const HOME_TAG = 'Home';

export type OrderInvalidatedTag = typeof HOME_TAG | ProductListTag | ProductTag;

/**
 * Cache tags to invalidate after an order attempt (RF-7).
 *
 * - `confirmed` (HTTP 200): the stock changed, so Home (it shows availability), every product list
 *   (`ProductList/LIST`: ONE tag shared by category, search and filters) and the detail of each
 *   ordered product. Duplicated product ids produce one tag.
 * - `pending` (HTTP 202): the order is not confirmed yet, so nothing changed: no tags.
 * - Failure (`undefined`, RTK passes no result): nothing was confirmed: no tags.
 *
 * The tags are plain data on purpose: this function is tested without RTK, and `invalidatesTags`
 * in `orders-api.ts` only calls it.
 */
export function tagsForOrderResult(
  result: OrderResult | undefined,
  items: readonly OrderItem[],
): OrderInvalidatedTag[] {
  if (result?.status !== 'confirmed') {
    return [];
  }

  const productIds = [...new Set(items.map(({ productId }) => productId))];
  return [HOME_TAG, PRODUCT_LIST_TAG, ...productIds.map(productTag)];
}
