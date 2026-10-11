/**
 * Types of `GET /home`, taken from the real server (`mock-server/src/catalog/home-data.js`).
 *
 * These are what the app TRUSTS after validation (`parseHomePayload`), not what the wire
 * carries: the product is a projection with only the fields Home renders. The full product
 * contract arrives with the detail screen (Day 4).
 */

export type CurrencyCode = 'MXN' | 'USD';

export type ProductBadge = 'BEST_SELLER' | 'QUALITY_PICK' | 'NEW' | 'OWN_BRAND';

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

export type HomeProduct = Readonly<{
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
