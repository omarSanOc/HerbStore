const MXN_PER_USD = 18;
const FREE_SHIPPING_THRESHOLD_MXN = 800;
const SHIPPING_MXN = 99;

export function roundHalfUp(value) {
  return Math.floor(value * 100 + 0.5 + 1e-9) / 100;
}

function priceInMxn(product) {
  return product.currency === 'USD' ? product.price * MXN_PER_USD : product.price;
}

function convertMxn(value, currency) {
  return currency === 'USD' ? value / MXN_PER_USD : value;
}

export function calculateOrderTotals(request, products) {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const sortedItems = [...request.items].sort((left, right) =>
    left.productId.localeCompare(right.productId, 'en'),
  );
  const canonicalSubtotalMXN = sortedItems.reduce((sum, item) => {
    const product = productsById.get(item.productId);
    return sum + priceInMxn(product) * item.quantity;
  }, 0);
  const items = sortedItems.map((item) => {
    const product = productsById.get(item.productId);
    const unitPrice = roundHalfUp(convertMxn(priceInMxn(product), request.currency));
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice,
      lineTotal: roundHalfUp(unitPrice * item.quantity),
    };
  });
  const subtotal = roundHalfUp(
    items.reduce((sum, item) => sum + item.lineTotal, 0),
  );
  const shipping =
    canonicalSubtotalMXN >= FREE_SHIPPING_THRESHOLD_MXN
      ? 0
      : roundHalfUp(convertMxn(SHIPPING_MXN, request.currency));

  return {
    items,
    canonicalSubtotalMXN,
    subtotal,
    shipping,
    total: roundHalfUp(subtotal + shipping),
  };
}

export function createOrderSummary({ request, products, id, createdAt }) {
  const { items, subtotal, shipping, total } = calculateOrderTotals(
    request,
    products,
  );

  return {
    id,
    items,
    currency: request.currency,
    subtotal,
    shipping,
    total,
    status: 'confirmed',
    createdAt,
  };
}
