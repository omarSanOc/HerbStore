import { formatInteger, formatRating } from '../../../core/format/format-number.ts';
import {
  formatMoney,
  fromMxnCents,
  toDisplayCents,
  toMxnCents,
} from '../../preferences/logic/currency.ts';
import type { CurrencyCode, ProductDetail } from '../contracts/catalog-product.ts';

export type ProductAvailability =
  | { kind: 'in_stock'; stock: number; stockText: string }
  | { kind: 'out_of_stock' };

export type ProductDetailModel = Readonly<{
  brand: string;
  name: string;
  /** Unit price in the preferred currency. */
  price: string;
  /** Previous price in the preferred currency, only for a real offer; drawn struck through. */
  listPrice?: string;
  /** Absent when there are no reviews yet (a 0.0 rating would be misleading). */
  rating?: Readonly<{ value: string; count: number; countText: string }>;
  availability: ProductAvailability;
  serving: Readonly<{ size: string; servingsPerContainer: number; countText: string }>;
  description: string;
  images: readonly string[];
  /** The chosen quantity times the unit price, converted and formatted as ONE amount. */
  total: string;
}>;

type TotalInput = Pick<ProductDetail, 'price' | 'currency'>;

/**
 * `quantity` units of the product as ONE amount in the preferred currency (spec 004, RF-5, RF-6).
 * The WHOLE line is converted from the canonical MXN value, exactly like the cart subtotal, and
 * not `quantity` x the rounded unit price: 5 units of 149.90 MXN are USD 41.64, while 5 x the
 * shown unit USD 8.33 would say 41.65. The detail and the cart therefore agree.
 *
 * MXN is the identity of `fromMxnCents` and a USD line is a whole multiple of 18 canonical cents,
 * so a product viewed in its own currency comes back exactly (no rounding).
 */
export function formatProductTotal(
  product: TotalInput,
  quantity: number,
  language: string,
  currency: CurrencyCode,
): string {
  const lineMxnCents = toMxnCents(product.price, product.currency) * Math.max(0, quantity);

  return formatMoney(fromMxnCents(lineMxnCents, currency), currency, language);
}

/**
 * Everything the detail screen shows, already formatted for the interface language (spec 004,
 * RF-4, RF-5, RF-6). Prices come in the currency of the product and are shown in the PREFERRED one
 * through the canonical MXN value (1 USD = 18 MXN); the same currency is never converted.
 *
 * `total` is `formatProductTotal`: the whole line converted at once, as the cart does.
 *
 * Availability follows the NUMBER (`stock`), not the `inStock` flag: the parser guarantees they
 * agree, and the number is what the quantity limit uses. `quantity` is the one the screen shows
 * (already inside `[1, stock]`, or 0 when sold out).
 */
export function buildProductDetailModel(
  product: ProductDetail,
  language: string,
  currency: CurrencyCode,
  quantity: number,
): ProductDetailModel {
  const show = (amount: number) =>
    formatMoney(toDisplayCents(amount, product.currency, currency), currency, language);
  // Same rule as the card: a list price that is not higher than the price is not an offer.
  const isOffer = product.listPrice !== undefined && product.listPrice > product.price;

  return {
    brand: product.brand,
    name: product.name,
    price: show(product.price),
    ...(isOffer && product.listPrice !== undefined ? { listPrice: show(product.listPrice) } : {}),
    ...(product.reviewCount > 0
      ? {
          rating: {
            value: formatRating(product.rating, language),
            count: product.reviewCount,
            countText: formatInteger(product.reviewCount, language),
          },
        }
      : {}),
    availability:
      product.stock > 0
        ? { kind: 'in_stock', stock: product.stock, stockText: formatInteger(product.stock, language) }
        : { kind: 'out_of_stock' },
    serving: {
      size: product.servingInfo.size,
      servingsPerContainer: product.servingInfo.servingsPerContainer,
      countText: formatInteger(product.servingInfo.servingsPerContainer, language),
    },
    description: product.description,
    images: product.images,
    total: formatProductTotal(product, quantity, language, currency),
  };
}
