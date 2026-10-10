/**
 * @typedef {'MXN' | 'USD'} CurrencyCode
 */

/**
 * @typedef {'BEST_SELLER' | 'QUALITY_PICK' | 'NEW' | 'OWN_BRAND'} ProductBadge
 */

/**
 * @typedef {object} ServingInfo
 * @property {string} size
 * @property {number} servingsPerContainer
 */

/**
 * Base catalog contract.
 *
 * @typedef {object} Product
 * @property {string} id
 * @property {string} brand
 * @property {string} name
 * @property {string} categoryId
 * @property {string} subcategoryId
 * @property {number} price
 * @property {number} [listPrice]
 * @property {CurrencyCode} currency
 * @property {number} rating
 * @property {number} reviewCount
 * @property {number} soldLast30Days
 * @property {ProductBadge[]} badges
 * @property {string} [couponText]
 * @property {boolean} inStock
 * @property {boolean} isOwnBrand
 * @property {boolean} subscribeAndSave
 * @property {string[]} images
 * @property {ServingInfo} servingInfo
 * @property {string} description
 * @property {string} ean13
 */

export const PRODUCT_REQUIRED_FIELDS = Object.freeze([
  'id',
  'brand',
  'name',
  'categoryId',
  'subcategoryId',
  'price',
  'currency',
  'rating',
  'reviewCount',
  'soldLast30Days',
  'badges',
  'inStock',
  'isOwnBrand',
  'subscribeAndSave',
  'images',
  'servingInfo',
  'description',
  'ean13',
]);
