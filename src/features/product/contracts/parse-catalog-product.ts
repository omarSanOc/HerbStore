import {
  hasUniqueIds,
  isAmount,
  isCount,
  isRecord,
  isText,
  mapAll,
} from '../../../core/validation/json-guards.ts';
import type {
  BrandOption,
  CatalogProduct,
  CategoryNode,
  CurrencyCode,
  ProductBadge,
  ProductDetail,
  ProductPage,
  ServingInfo,
  SubcategoryNode,
} from './catalog-product.ts';

// Same policy as Home: the payload is the server's promise, so one malformed element invalidates
// the WHOLE payload instead of silently dropping it. Unknown badges are the one forward-compatible
// exception (a newer server must not break an older app).

const BADGES: readonly ProductBadge[] = ['BEST_SELLER', 'QUALITY_PICK', 'NEW', 'OWN_BRAND'];
const CURRENCIES: readonly CurrencyCode[] = ['MXN', 'USD'];

/**
 * Validates one product of the wire and projects it onto `CatalogProduct`. Returns `undefined`
 * when it does not honour the contract; never throws and never keeps references to the input.
 */
export function parseCatalogProduct(value: unknown): CatalogProduct | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const {
    id,
    brand,
    name,
    categoryId,
    subcategoryId,
    price,
    listPrice,
    currency,
    rating,
    reviewCount,
    soldLast30Days,
    badges,
    couponText,
    inStock,
    images,
  } = value;

  if (
    !isText(id) ||
    !isText(brand) ||
    !isText(name) ||
    !isText(categoryId) ||
    !isText(subcategoryId) ||
    !isAmount(price) ||
    !CURRENCIES.includes(currency as CurrencyCode) ||
    typeof rating !== 'number' ||
    !(rating >= 0 && rating <= 5) ||
    !isCount(reviewCount) ||
    !isCount(soldLast30Days) ||
    !Array.isArray(badges) ||
    typeof inStock !== 'boolean' ||
    !Array.isArray(images) ||
    !images.every((image) => typeof image === 'string')
  ) {
    return undefined;
  }
  // Optional fields: absent is fine, present must be well formed.
  if (listPrice !== undefined && !isAmount(listPrice)) {
    return undefined;
  }
  if (couponText !== undefined && typeof couponText !== 'string') {
    return undefined;
  }

  return {
    id,
    brand,
    name,
    categoryId,
    subcategoryId,
    price,
    ...(listPrice === undefined ? {} : { listPrice }),
    currency: currency as CurrencyCode,
    rating,
    reviewCount,
    soldLast30Days,
    badges: badges.filter((badge): badge is ProductBadge => BADGES.includes(badge as ProductBadge)),
    ...(couponText === undefined ? {} : { couponText }),
    inStock,
    images: [...(images as string[])],
  };
}

function parseServingInfo(value: unknown): ServingInfo | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { size, servingsPerContainer } = value;

  return isText(size) && isCount(servingsPerContainer) && servingsPerContainer >= 1
    ? { size, servingsPerContainer }
    : undefined;
}

/**
 * Validates `GET /products/:id` and `/products/barcode/:code`: a catalog product (all its rules
 * apply) plus a non-empty `description`, the `servingInfo` and the live `stock`.
 *
 * `stock` is a safe whole number >= 0 and must agree with `inStock` (`inStock === stock > 0`): the
 * server derives one from the other, so a payload where they differ is not the contract and the
 * whole detail is rejected instead of guessing which one is right. The parser projects, so wire
 * fields the app does not trust (`ean13`, `isOwnBrand`...) are dropped and nothing aliases the input.
 */
export function parseProductDetail(value: unknown): ProductDetail | undefined {
  const product = parseCatalogProduct(value);
  if (product === undefined || !isRecord(value)) {
    return undefined;
  }
  const { description, stock } = value;
  const servingInfo = parseServingInfo(value.servingInfo);

  if (
    !isText(description) ||
    servingInfo === undefined ||
    !isCount(stock) ||
    !Number.isSafeInteger(stock) ||
    product.inStock !== stock > 0
  ) {
    return undefined;
  }

  return { ...product, description, servingInfo, stock };
}

/**
 * Validates `GET /products`. Invalid when an element is malformed, an id repeats inside the
 * page, or `page` (>= 1), `totalPages` (>= 0) or `total` (>= 0) are not integers in range.
 *
 * A page beyond the last one is valid: the server answers it with `items: []`.
 */
export function parseProductPage(payload: unknown): ProductPage | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }
  const { page, totalPages, total } = payload;
  const items = mapAll(payload.items, parseCatalogProduct);

  if (
    items === undefined ||
    !hasUniqueIds(items) ||
    !isCount(page) ||
    page < 1 ||
    !isCount(totalPages) ||
    !isCount(total)
  ) {
    return undefined;
  }

  return { items, page, totalPages, total };
}

function parseBrandOption(value: unknown): BrandOption | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { name, productCount } = value;

  return isText(name) && isCount(productCount) ? { name, productCount } : undefined;
}

/** Validates `GET /brands`: `[{ name, productCount }]` with unique names. */
export function parseBrandOptions(payload: unknown): BrandOption[] | undefined {
  const brands = mapAll(payload, parseBrandOption);

  return brands !== undefined && new Set(brands.map(({ name }) => name)).size === brands.length
    ? brands
    : undefined;
}

function parseSubcategory(value: unknown): SubcategoryNode | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { id, name, productCount } = value;

  return isText(id) && isText(name) && isCount(productCount) ? { id, name, productCount } : undefined;
}

function parseCategoryNode(value: unknown): CategoryNode | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { id, name, productCount } = value;
  const subcategories = mapAll(value.subcategories, parseSubcategory);

  return isText(id) &&
    isText(name) &&
    isCount(productCount) &&
    subcategories !== undefined &&
    hasUniqueIds(subcategories)
    ? { id, name, productCount, subcategories }
    : undefined;
}

/**
 * Validates `GET /categories`. Category ids are unique, and so are subcategory ids ACROSS the
 * whole tree, because `subcategory=` is a flat filter (a repeated id would be ambiguous there).
 */
export function parseCategoryTree(payload: unknown): CategoryNode[] | undefined {
  const tree = mapAll(payload, parseCategoryNode);
  if (tree === undefined || !hasUniqueIds(tree)) {
    return undefined;
  }

  return hasUniqueIds(tree.flatMap(({ subcategories }) => subcategories)) ? tree : undefined;
}
