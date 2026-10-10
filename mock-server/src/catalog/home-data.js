const HOME_ITEM_LIMIT = 10;

function displayName(identifier) {
  return identifier
    .split('-')
    .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

export function createCategoryTree(products) {
  const categories = new Map();

  for (const product of products) {
    let category = categories.get(product.categoryId);
    if (!category) {
      category = {
        id: product.categoryId,
        name: displayName(product.categoryId),
        productCount: 0,
        subcategories: new Map(),
      };
      categories.set(product.categoryId, category);
    }

    category.productCount += 1;
    const subcategory = category.subcategories.get(product.subcategoryId) ?? {
      id: product.subcategoryId,
      name: displayName(product.subcategoryId),
      productCount: 0,
    };
    subcategory.productCount += 1;
    category.subcategories.set(product.subcategoryId, subcategory);
  }

  return [...categories.values()].map(({ subcategories, ...category }) => ({
    ...category,
    subcategories: [...subcategories.values()],
  }));
}

export function createBrandData(products) {
  const counts = new Map();
  for (const product of products) {
    counts.set(product.brand, (counts.get(product.brand) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, productCount]) => ({ name, productCount }))
    .sort((left, right) => left.name.localeCompare(right.name, 'en'));
}

export function createHomeData(products) {
  const categoryTree = createCategoryTree(products);

  return {
    banners: [
      {
        id: 'daily-wellness',
        title: 'Daily wellness essentials',
        subtitle: 'Explore fictional products for everyday routines.',
        imageUrl: '/images/banners/daily-wellness.png',
        categoryId: 'vitamins',
      },
      {
        id: 'plant-powered',
        title: 'Plant-powered collection',
        subtitle: 'Discover botanical and plant protein formulas.',
        imageUrl: '/images/banners/plant-powered.png',
        categoryId: 'botanicals',
      },
    ],
    categories: categoryTree.map(({ subcategories: _subcategories, ...category }) => ({
      ...category,
      imageUrl: `/images/categories/${category.id}.png`,
    })),
    sections: [
      {
        id: 'best_sellers',
        title: 'Best sellers',
        items: [...products]
          .sort(
            (left, right) => right.soldLast30Days - left.soldLast30Days,
          )
          .slice(0, HOME_ITEM_LIMIT),
      },
      {
        id: 'new',
        title: 'New',
        items: products
          .filter(({ badges }) => badges.includes('NEW'))
          .slice(0, HOME_ITEM_LIMIT),
      },
      {
        id: 'offers',
        title: 'Offers',
        items: products
          .filter(
            ({ couponText, listPrice }) =>
              couponText !== undefined || listPrice !== undefined,
          )
          .slice(0, HOME_ITEM_LIMIT),
      },
    ],
  };
}
