/**
 * Types of `GET /home` of the persistent HerbStore API (observable contract: spec 007, RF-8).
 *
 * These are what the app TRUSTS after validation (`parseHomePayload`), not what the wire
 * carries: the product is a projection with only the fields Home renders. The full product
 * contract arrives with the detail screen (Day 4).
 */

import type { CatalogProduct } from '../../product/contracts/catalog-product.ts';

export type { CurrencyCode, ProductBadge } from '../../product/contracts/catalog-product.ts';

export type HomeSectionId = 'best_sellers' | 'new' | 'offers';

export type HomeBanner = Readonly<{
  id: string;
  title: string;
  subtitle: string;
  /** Server path such as `/images/banners/<id>.png`; resolve it with `resolveAssetUrl`. */
  imageUrl: string;
  categoryId: string;
}>;

export type HomeCategory = Readonly<{
  id: string;
  name: string;
  productCount: number;
  /** Server path such as `/images/categories/<id>.png`. */
  imageUrl: string;
}>;

/** Home shows the same product the catalog list does: one shared contract (Day 3). */
export type HomeProduct = CatalogProduct;

export type HomeSection = Readonly<{
  id: HomeSectionId;
  title: string;
  items: readonly HomeProduct[];
}>;

export type HomeData = Readonly<{
  banners: readonly HomeBanner[];
  categories: readonly HomeCategory[];
  sections: readonly HomeSection[];
}>;
