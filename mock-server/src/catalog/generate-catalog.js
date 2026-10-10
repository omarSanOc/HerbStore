import { Faker, en } from '@faker-js/faker';

export const CATALOG_SEED = 20261009;
export const CATALOG_SIZE = 300;

const OWN_BRAND = 'HerbStore Essentials';

const BRANDS = Object.freeze([
  OWN_BRAND,
  'AsterVale Nutrition',
  'BloomArc Wellness',
  'CedarKind Labs',
  'Juniper Axis',
  'MossPeak Formulas',
  'Solstice Grove',
  'Verdant Forge',
]);

const CATEGORIES = Object.freeze([
  {
    id: 'vitamins',
    subcategories: [
      { id: 'multivitamins', ingredients: ['Daily Balance', 'Complete Daily', 'Vital Blend'] },
      { id: 'vitamin-c', ingredients: ['Citrus C', 'Acerola C', 'Buffered C'] },
      { id: 'vitamin-d', ingredients: ['Sunlight D', 'Plant D', 'Daily D'] },
    ],
  },
  {
    id: 'minerals',
    subcategories: [
      { id: 'magnesium', ingredients: ['Magnesium Glycinate', 'Magnesium Blend', 'Evening Magnesium'] },
      { id: 'zinc', ingredients: ['Zinc Balance', 'Zinc Complex', 'Daily Zinc'] },
      { id: 'calcium', ingredients: ['Calcium Citrate', 'Calcium Balance', 'Mineral Calcium'] },
    ],
  },
  {
    id: 'protein',
    subcategories: [
      { id: 'plant-protein', ingredients: ['Pea Protein', 'Garden Protein', 'Plant Protein'] },
      { id: 'whey-protein', ingredients: ['Whey Blend', 'Whey Isolate', 'Everyday Whey'] },
      { id: 'amino-blends', ingredients: ['Amino Blend', 'Recovery Aminos', 'Essential Aminos'] },
    ],
  },
  {
    id: 'botanicals',
    subcategories: [
      { id: 'herbal-blends', ingredients: ['Herbal Balance', 'Meadow Blend', 'Garden Herbs'] },
      { id: 'mushroom-blends', ingredients: ['Forest Mushroom Blend', 'Mushroom Complex', 'Woodland Blend'] },
      { id: 'root-extracts', ingredients: ['Root Blend', 'Botanical Roots', 'Grounded Root Formula'] },
    ],
  },
  {
    id: 'wellness',
    subcategories: [
      { id: 'probiotics', ingredients: ['Daily Cultures', 'Flora Balance', 'Culture Blend'] },
      { id: 'omegas', ingredients: ['Algae Omega', 'Plant Omega', 'Essential Oils'] },
      { id: 'sleep-support', ingredients: ['Night Blend', 'Evening Calm', 'Rest Formula'] },
    ],
  },
]);

const FORMATS = Object.freeze([
  { label: 'Capsules', servingSize: '2 capsules' },
  { label: 'Powder', servingSize: '1 scoop (20 g)' },
  { label: 'Tablets', servingSize: '1 tablet' },
  { label: 'Softgels', servingSize: '2 softgels' },
]);

function createFaker(seed) {
  const seededFaker = new Faker({ locale: [en] });
  seededFaker.seed(seed);

  return seededFaker;
}

function createIdentity(seed, index) {
  const seedToken = String(Math.abs(seed) % 1_000_000).padStart(6, '0');
  const position = String(index + 1).padStart(3, '0');
  const eanBody = `200${seedToken}${position}`;
  const weightedSum = [...eanBody].reduce(
    (sum, digit, digitIndex) =>
      sum + Number(digit) * (digitIndex % 2 === 0 ? 1 : 3),
    0,
  );
  const checkDigit = (10 - (weightedSum % 10)) % 10;

  return {
    id: `product-${seedToken}-${position}`,
    ean13: `${eanBody}${checkDigit}`,
  };
}

function createBadges({ index, isOwnBrand, rating, soldLast30Days }) {
  const badges = [];

  if (soldLast30Days >= 700) {
    badges.push('BEST_SELLER');
  }
  if (rating >= 4.7) {
    badges.push('QUALITY_PICK');
  }
  if (index % 11 === 0) {
    badges.push('NEW');
  }
  if (isOwnBrand) {
    badges.push('OWN_BRAND');
  }

  return badges;
}

/**
 * Builds a fresh deterministic catalog. Its Faker instance is local so calls
 * cannot consume or inherit random state from another request.
 *
 * @param {number} [seed]
 * @returns {import('./product-contract.js').Product[]}
 */
export function generateCatalog(seed = CATALOG_SEED) {
  if (!Number.isSafeInteger(seed)) {
    throw new TypeError('Catalog seed must be a safe integer');
  }

  const faker = createFaker(seed);

  return Array.from({ length: CATALOG_SIZE }, (_, index) => {
    const category = CATEGORIES[index % CATEGORIES.length];
    const subcategory =
      category.subcategories[
        Math.floor(index / CATEGORIES.length) % category.subcategories.length
      ];
    const brand = faker.helpers.arrayElement(BRANDS);
    const format = faker.helpers.arrayElement(FORMATS);
    const ingredient = faker.helpers.arrayElement(subcategory.ingredients);
    const currency = index % 5 === 0 ? 'USD' : 'MXN';
    const price =
      currency === 'USD'
        ? faker.number.int({ min: 8, max: 42 }) + 0.99
        : faker.number.int({ min: 149, max: 899 }) + 0.9;
    const rating = faker.number.int({ min: 25, max: 50 }) / 10;
    const reviewCount = faker.number.int({ min: 0, max: 2400 });
    const soldLast30Days = faker.number.int({ min: 0, max: 1200 });
    const isOwnBrand = brand === OWN_BRAND;
    const listPrice = index % 4 === 0 ? Number((price * 1.2).toFixed(2)) : undefined;
    const couponText = index % 7 === 0 ? 'Save 10% at checkout' : undefined;

    return {
      ...createIdentity(seed, index),
      brand,
      name: `${ingredient} ${format.label}`,
      categoryId: category.id,
      subcategoryId: subcategory.id,
      price,
      ...(listPrice === undefined ? {} : { listPrice }),
      currency,
      rating,
      reviewCount,
      soldLast30Days,
      badges: createBadges({ index, isOwnBrand, rating, soldLast30Days }),
      ...(couponText === undefined ? {} : { couponText }),
      inStock: index % 13 !== 0,
      isOwnBrand,
      subscribeAndSave: index % 3 !== 0,
      images: [
        `/images/products/product-${String(index + 1).padStart(3, '0')}-front.png`,
        `/images/products/product-${String(index + 1).padStart(3, '0')}-detail.png`,
      ],
      servingInfo: {
        size: format.servingSize,
        servingsPerContainer: faker.number.int({ min: 20, max: 90 }),
      },
      description: `${ingredient} in a ${format.label.toLowerCase()} format for a simple daily wellness routine.`,
    };
  });
}
