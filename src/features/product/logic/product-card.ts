import { formatInteger, formatRating } from '../../../core/format/format-number.ts';
import { formatMoney, toDisplayCents } from '../../preferences/logic/currency.ts';
import type { CatalogProduct, CurrencyCode } from '../contracts/catalog-product.ts';

/** The single badge a card shows. Decided by priority, so a product never shows two. */
export type ProductCardBadge = 'offer' | 'new' | 'best_seller';

type BadgeInput = Pick<CatalogProduct, 'price' | 'listPrice' | 'badges'>;

/**
 * Priority: offer (a list price higher than the price), then new, then best seller.
 * `couponText` is server text in English and is deliberately not used.
 *
 * A list price that is not higher than the price is not a discount: showing it struck through
 * next to an equal or lower price would be misleading, so it does not count as an offer.
 */
export function getProductBadge({ price, listPrice, badges }: BadgeInput): ProductCardBadge | undefined {
  if (listPrice !== undefined && listPrice > price) {
    return 'offer';
  }
  if (badges.includes('NEW')) {
    return 'new';
  }
  if (badges.includes('BEST_SELLER')) {
    return 'best_seller';
  }
  return undefined;
}

export type ProductCardModel = Readonly<{
  name: string;
  /** Final price, converted to the preferred currency. */
  price: string;
  /** Previous price in the preferred currency, only for a real offer; drawn struck through. */
  listPrice?: string;
  badge?: ProductCardBadge;
  /** False draws "Out of stock" as text and adds it to the spoken label (never only a color). */
  inStock: boolean;
  /** Absent when the product has no reviews yet (a 0.0 rating would be misleading). */
  rating?: Readonly<{ value: string; count: number; countText: string }>;
}>;

type CardInput = Pick<
  CatalogProduct,
  'name' | 'price' | 'listPrice' | 'currency' | 'rating' | 'reviewCount' | 'badges' | 'inStock'
>;

/**
 * Everything a product card shows, already formatted for the interface language. Prices come in
 * the currency of the product and are shown in the PREFERRED one (spec 004, RF-5): converted
 * through the canonical MXN value at 1 USD = 18 MXN, never rounded when the currency is the same.
 * The offer badge is still decided from the prices of origin, which share one currency.
 */
export function buildProductCardModel(
  product: CardInput,
  language: string,
  currency: CurrencyCode,
): ProductCardModel {
  const badge = getProductBadge(product);
  const show = (amount: number) =>
    formatMoney(toDisplayCents(amount, product.currency, currency), currency, language);

  return {
    name: product.name,
    price: show(product.price),
    ...(badge === 'offer' && product.listPrice !== undefined
      ? { listPrice: show(product.listPrice) }
      : {}),
    ...(badge === undefined ? {} : { badge }),
    inStock: product.inStock,
    ...(product.reviewCount > 0
      ? {
          rating: {
            value: formatRating(product.rating, language),
            count: product.reviewCount,
            countText: formatInteger(product.reviewCount, language),
          },
        }
      : {}),
  };
}
