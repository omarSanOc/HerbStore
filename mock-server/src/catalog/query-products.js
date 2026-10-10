import { normalizeText } from './normalize-text.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const SORTS = new Set([
  'featured',
  'price_asc',
  'price_desc',
  'rating',
  'best_selling',
]);

export class ProductQueryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProductQueryError';
    this.code = 'INVALID_QUERY';
  }
}

function requireSingleString(value, field) {
  if (typeof value !== 'string') {
    throw new ProductQueryError(`${field} must have exactly one value.`);
  }

  return value;
}

function parseOptionalText(value, field) {
  if (value === undefined) {
    return undefined;
  }

  const text = requireSingleString(value, field).trim();
  if (text.length === 0) {
    throw new ProductQueryError(`${field} must not be empty.`);
  }

  return normalizeText(text);
}

function parseCsv(value, field) {
  if (value === undefined) {
    return undefined;
  }

  const entries = requireSingleString(value, field)
    .split(',')
    .map((entry) => entry.trim());
  if (entries.length === 0 || entries.some((entry) => entry.length === 0)) {
    throw new ProductQueryError(`${field} must be a CSV without empty values.`);
  }

  return new Set(entries.map(normalizeText));
}

function parseInteger(value, field, { defaultValue, min, max }) {
  if (value === undefined) {
    return defaultValue;
  }

  const text = requireSingleString(value, field);
  if (!/^\d+$/.test(text)) {
    throw new ProductQueryError(`${field} must be an integer.`);
  }

  const number = Number(text);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new ProductQueryError(`${field} is outside its accepted range.`);
  }

  return number;
}

function parseRating(value) {
  if (value === undefined) {
    return undefined;
  }

  const text = requireSingleString(value, 'minRating');
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) {
    throw new ProductQueryError('minRating must be numeric.');
  }

  const rating = Number(text);
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
    throw new ProductQueryError('minRating must be between 0 and 5.');
  }

  return rating;
}

function parseBoolean(value, field) {
  if (value === undefined) {
    return undefined;
  }
  if (value !== 'true' && value !== 'false') {
    throw new ProductQueryError(`${field} must be true or false.`);
  }

  return value === 'true';
}

function parseSort(value) {
  if (value === undefined) {
    return 'featured';
  }

  const sort = requireSingleString(value, 'sort');
  if (!SORTS.has(sort)) {
    throw new ProductQueryError('sort is not supported.');
  }

  return sort;
}

export function parseProductQuery(rawQuery = {}) {
  return {
    page: parseInteger(rawQuery.page, 'page', {
      defaultValue: DEFAULT_PAGE,
      min: 1,
      max: Number.MAX_SAFE_INTEGER,
    }),
    limit: parseInteger(rawQuery.limit, 'limit', {
      defaultValue: DEFAULT_LIMIT,
      min: 1,
      max: MAX_LIMIT,
    }),
    category: parseOptionalText(rawQuery.category, 'category'),
    brands: parseCsv(rawQuery.brand, 'brand'),
    subcategories: parseCsv(rawQuery.subcategory, 'subcategory'),
    minRating: parseRating(rawQuery.minRating),
    inStock: parseBoolean(rawQuery.inStock, 'inStock'),
    ownBrand: parseBoolean(rawQuery.ownBrand, 'ownBrand'),
    subscribeAndSave: parseBoolean(
      rawQuery.subscribeAndSave,
      'subscribeAndSave',
    ),
    q: parseOptionalText(rawQuery.q, 'q'),
    sort: parseSort(rawQuery.sort),
    fail: parseBoolean(rawQuery.fail, 'fail') ?? false,
  };
}

function matchesQuery(product, query) {
  if (
    query.category !== undefined &&
    normalizeText(product.categoryId) !== query.category
  ) {
    return false;
  }
  if (
    query.brands !== undefined &&
    !query.brands.has(normalizeText(product.brand))
  ) {
    return false;
  }
  if (
    query.subcategories !== undefined &&
    !query.subcategories.has(normalizeText(product.subcategoryId))
  ) {
    return false;
  }
  if (query.minRating !== undefined && product.rating < query.minRating) {
    return false;
  }
  if (query.inStock !== undefined && product.inStock !== query.inStock) {
    return false;
  }
  if (query.ownBrand !== undefined && product.isOwnBrand !== query.ownBrand) {
    return false;
  }
  if (
    query.subscribeAndSave !== undefined &&
    product.subscribeAndSave !== query.subscribeAndSave
  ) {
    return false;
  }
  if (query.q !== undefined) {
    const searchableText = normalizeText(
      `${product.brand} ${product.name} ${product.description}`,
    );
    if (!searchableText.includes(query.q)) {
      return false;
    }
  }

  return true;
}

function sortProducts(products, sort) {
  const sorted = [...products];

  switch (sort) {
    case 'price_asc':
      return sorted.sort((left, right) => left.price - right.price);
    case 'price_desc':
      return sorted.sort((left, right) => right.price - left.price);
    case 'rating':
      return sorted.sort((left, right) => right.rating - left.rating);
    case 'best_selling':
      return sorted.sort(
        (left, right) => right.soldLast30Days - left.soldLast30Days,
      );
    case 'featured':
      return sorted;
    default:
      throw new ProductQueryError('sort is not supported.');
  }
}

export function selectProducts(products, query) {
  const filtered = products.filter((product) => matchesQuery(product, query));
  const sorted = sortProducts(filtered, query.sort);
  const total = sorted.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);
  const start = (query.page - 1) * query.limit;

  return {
    items: sorted.slice(start, start + query.limit),
    page: query.page,
    totalPages,
    total,
  };
}

export function queryProducts(products, rawQuery = {}) {
  return selectProducts(products, parseProductQuery(rawQuery));
}

export function isValidEan13(value) {
  if (!/^\d{13}$/.test(value)) {
    return false;
  }

  const digits = [...value].map(Number);
  const weightedSum = digits
    .slice(0, 12)
    .reduce(
      (sum, digit, index) => sum + digit * (index % 2 === 0 ? 1 : 3),
      0,
    );
  const expectedCheckDigit = (10 - (weightedSum % 10)) % 10;

  return digits[12] === expectedCheckDigit;
}
