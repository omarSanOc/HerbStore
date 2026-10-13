/**
 * Shared catalog contract: the product as the app TRUSTS it after validation
 * (`parseCatalogProduct`), not as the wire carries it.
 *
 * The server sends more per product (`isOwnBrand`, `subscribeAndSave`, `ean13`); the list and Home
 * only need this projection. The detail screen extends it (`ProductDetail`) instead of re-parsing
 * from scratch.
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

/** How a product is taken: `size` is server text ("2 capsules"), the count is whole and >= 1. */
export type ServingInfo = Readonly<{
  size: string;
  servingsPerContainer: number;
}>;

/**
 * What `GET /products/:id` (and `/products/barcode/:code`) answer: the catalog product plus what
 * only the detail needs. `stock` is the LIVE number of units that can be ordered now and `inStock`
 * is `stock > 0` (the parser rejects a payload where they disagree). Lists and Home do not carry
 * `stock`: their `inStock` is the static catalog value (plan 004, known limitation).
 */
export type ProductDetail = CatalogProduct &
  Readonly<{
    description: string;
    servingInfo: ServingInfo;
    stock: number;
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
