import type {
  CurrencyCode,
  HomeBanner,
  HomeCategory,
  HomeData,
  HomeProduct,
  HomeSection,
  HomeSectionId,
  ProductBadge,
} from './home.ts';

// Structural validation without dependencies. Zod belongs to the stack but is not installed yet;
// when it arrives (Day 3/4) this file is the single place to replace.
//
// Policy: the payload is the server's promise, and a malformed element means the promise is
// broken, so the WHOLE payload is invalid (the screen shows an error) instead of silently
// dropping elements. Forward compatibility is the one exception: sections and badges the app
// does not know are ignored, so a newer server does not break an older app.

type Json = Record<string, unknown>;

const SECTION_IDS: readonly HomeSectionId[] = ['best_sellers', 'new', 'offers'];
const BADGES: readonly ProductBadge[] = ['BEST_SELLER', 'QUALITY_PICK', 'NEW', 'OWN_BRAND'];
const CURRENCIES: readonly CurrencyCode[] = ['MXN', 'USD'];

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function hasUniqueIds(items: readonly { id: string }[]): boolean {
  return new Set(items.map(({ id }) => id)).size === items.length;
}

/** Maps every element or gives `undefined` as soon as one fails. */
function mapAll<T>(value: unknown, parseItem: (item: unknown) => T | undefined): T[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const parsed: T[] = [];
  for (const item of value) {
    const result = parseItem(item);
    if (result === undefined) {
      return undefined;
    }
    parsed.push(result);
  }

  return parsed;
}

function parseBanner(value: unknown): HomeBanner | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { id, title, subtitle, imageUrl, categoryId } = value;

  return isText(id) &&
    isText(title) &&
    typeof subtitle === 'string' &&
    typeof imageUrl === 'string' &&
    isText(categoryId)
    ? { id, title, subtitle, imageUrl, categoryId }
    : undefined;
}

function parseCategory(value: unknown): HomeCategory | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { id, name, productCount, imageUrl } = value;

  return isText(id) && isText(name) && isCount(productCount) && typeof imageUrl === 'string'
    ? { id, name, productCount, imageUrl }
    : undefined;
}

function parseProduct(value: unknown): HomeProduct | undefined {
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

function parseSection(value: unknown): HomeSection | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { id, title } = value;
  const items = mapAll(value.items, parseProduct);

  return SECTION_IDS.includes(id as HomeSectionId) && isText(title) && items !== undefined && hasUniqueIds(items)
    ? { id: id as HomeSectionId, title, items }
    : undefined;
}

function parseSections(value: unknown): HomeSection[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  // Unknown ids are skipped before validating, known ones must be well formed.
  const known = value.filter(
    (section) => !isRecord(section) || SECTION_IDS.includes(section.id as HomeSectionId),
  );

  return mapAll(known, parseSection);
}

/**
 * Validates the decoded JSON of `GET /home`. Returns `HomeData` (a projection of what the screen
 * renders) or `undefined` when the payload does not honour the contract. It never throws and
 * never keeps references to the input.
 */
export function parseHomePayload(payload: unknown): HomeData | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const banners = mapAll(payload.banners, parseBanner);
  const categories = mapAll(payload.categories, parseCategory);
  const sections = parseSections(payload.sections);

  if (
    banners === undefined ||
    categories === undefined ||
    sections === undefined ||
    !hasUniqueIds(banners) ||
    !hasUniqueIds(categories) ||
    !hasUniqueIds(sections)
  ) {
    return undefined;
  }

  return { banners, categories, sections };
}
