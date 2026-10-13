/**
 * Shared catalog contract: the product as the app TRUSTS it after validation
 * (`parseCatalogProduct`), not as the wire carries it.
 *
 * The server sends more per product (`isOwnBrand`, `subscribeAndSave`, `servingInfo`,
 * `description`, `ean13`); the list and Home only need this projection. The detail screen
 * (Day 4) will extend it instead of re-parsing from scratch.
 */

export type CurrencyCode = 'MXN' | 'USD';

export type ProductBadge = 'BEST_SELLER' | 'QUALITY_PICK' | 'NEW' | 'OWN_BRAND';

export type CatalogProduct = Readonly<{
  id: string;
  brand: string;
  name: string;
  categoryId: string;
  subcategoryId: string;
  price: number;
  /** Present only when the product is discounted. */
  listPrice?: number;
  currency: CurrencyCode;
  rating: number;
  reviewCount: number;
  soldLast30Days: number;
  badges: readonly ProductBadge[];
  couponText?: string;
  inStock: boolean;
  /** Server paths such as `/images/products/product-001-front.png`. */
  images: readonly string[];
}>;

/** One page of `GET /products`: `{ items, page, totalPages, total }`. */
export type ProductPage = Readonly<{
  items: readonly CatalogProduct[];
  /** 1-based, as requested. */
  page: number;
  /** 0 when nothing matches. */
  totalPages: number;
  /** Matches across all pages, after filtering and before paginating. */
  total: number;
}>;

/** One entry of `GET /brands`. `name` is both the label and the value sent as `brand`. */
export type BrandOption = Readonly<{
  name: string;
  productCount: number;
}>;

export type SubcategoryNode = Readonly<{
  id: string;
  name: string;
  productCount: number;
}>;

/** One entry of `GET /categories`. */
export type CategoryNode = Readonly<{
  id: string;
  name: string;
  productCount: number;
  subcategories: readonly SubcategoryNode[];
}>;
