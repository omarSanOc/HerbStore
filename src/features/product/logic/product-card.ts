import { formatCurrency, formatInteger, formatRating } from '../../../core/format/format-number.ts';
import type { CatalogProduct } from '../contracts/catalog-product.ts';

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
  /** Final price in the product's own currency. */
  price: string;
  /** Previous price, only for a real offer; the card draws it struck through. */
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

/** Everything a product card shows, already formatted for the interface language. */
export function buildProductCardModel(product: CardInput, language: string): ProductCardModel {
  const badge = getProductBadge(product);

  return {
    name: product.name,
    price: formatCurrency(product.price, product.currency, language),
    ...(badge === 'offer' && product.listPrice !== undefined
      ? { listPrice: formatCurrency(product.listPrice, product.currency, language) }
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
