import { createHash } from 'node:crypto';

const ROOT_FIELDS = new Set(['items', 'shippingAddress', 'currency']);
const ITEM_FIELDS = new Set(['productId', 'quantity']);
const ADDRESS_FIELDS = new Set([
  'fullName',
  'phone',
  'postalCode',
  'state',
  'city',
  'street',
  'exteriorNumber',
  'interiorNumber',
]);
const REQUIRED_ADDRESS_FIELDS = [
  'fullName',
  'phone',
  'postalCode',
  'state',
  'city',
  'street',
  'exteriorNumber',
];
const MINIMUM_LENGTHS = {
  fullName: 3,
  state: 2,
  city: 2,
  street: 3,
};

export class OrderValidationError extends Error {
  constructor(fields) {
    super('Order request validation failed');
    this.name = 'OrderValidationError';
    this.code = 'VALIDATION_ERROR';
    this.fields = fields;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function addExtraFields(value, allowed, prefix, fields) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      fields[prefix ? `${prefix}.${key}` : key] = 'ADDITIONAL_PROPERTY';
    }
  }
}

function validateAddress(rawAddress, fields) {
  if (rawAddress === undefined) {
    fields.shippingAddress = 'REQUIRED';
    return undefined;
  }
  if (!isPlainObject(rawAddress)) {
    fields.shippingAddress = 'INVALID_TYPE';
    return undefined;
  }

  addExtraFields(rawAddress, ADDRESS_FIELDS, 'shippingAddress', fields);
  const normalized = {};

  for (const field of REQUIRED_ADDRESS_FIELDS) {
    const path = `shippingAddress.${field}`;
    const value = rawAddress[field];
    if (value === undefined) {
      fields[path] = 'REQUIRED';
      continue;
    }
    if (typeof value !== 'string') {
      fields[path] = 'INVALID_TYPE';
      continue;
    }

    const text = value.trim();
    normalized[field] = text;
    if (text.length === 0) {
      fields[path] = 'REQUIRED';
    } else if (MINIMUM_LENGTHS[field] && text.length < MINIMUM_LENGTHS[field]) {
      fields[path] = 'TOO_SHORT';
    } else if (field === 'phone' && !/^\d{10}$/.test(text)) {
      fields[path] = 'INVALID_FORMAT';
    } else if (field === 'postalCode' && !/^\d{5}$/.test(text)) {
      fields[path] = 'INVALID_FORMAT';
    }
  }

  if (rawAddress.interiorNumber !== undefined) {
    if (typeof rawAddress.interiorNumber !== 'string') {
      fields['shippingAddress.interiorNumber'] = 'INVALID_TYPE';
    } else {
      const interiorNumber = rawAddress.interiorNumber.trim();
      if (interiorNumber.length > 0) {
        normalized.interiorNumber = interiorNumber;
      }
    }
  }

  return normalized;
}

function validateItems(rawItems, productIds, fields) {
  if (rawItems === undefined) {
    fields.items = 'REQUIRED';
    return undefined;
  }
  if (!Array.isArray(rawItems)) {
    fields.items = 'INVALID_TYPE';
    return undefined;
  }
  if (rawItems.length === 0) {
    fields.items = 'OUT_OF_RANGE';
    return undefined;
  }

  const normalized = [];
  const seenProductIds = new Set();
  rawItems.forEach((rawItem, index) => {
    const prefix = `items[${index}]`;
    if (!isPlainObject(rawItem)) {
      fields[prefix] = 'INVALID_TYPE';
      return;
    }

    addExtraFields(rawItem, ITEM_FIELDS, prefix, fields);
    let productId;
    if (rawItem.productId === undefined) {
      fields[`${prefix}.productId`] = 'REQUIRED';
    } else if (typeof rawItem.productId !== 'string') {
      fields[`${prefix}.productId`] = 'INVALID_TYPE';
    } else {
      productId = rawItem.productId.trim();
      if (productId.length === 0) {
        fields[`${prefix}.productId`] = 'REQUIRED';
      } else if (seenProductIds.has(productId)) {
        fields[`${prefix}.productId`] = 'DUPLICATE';
      } else if (!productIds.has(productId)) {
        fields[`${prefix}.productId`] = 'UNKNOWN_PRODUCT';
      }
      seenProductIds.add(productId);
    }

    let quantity;
    if (rawItem.quantity === undefined) {
      fields[`${prefix}.quantity`] = 'REQUIRED';
    } else if (!Number.isInteger(rawItem.quantity)) {
      fields[`${prefix}.quantity`] = 'INVALID_TYPE';
    } else {
      quantity = rawItem.quantity;
      if (quantity < 1 || quantity > 99) {
        fields[`${prefix}.quantity`] = 'OUT_OF_RANGE';
      }
    }

    if (productId !== undefined && quantity !== undefined) {
      normalized.push({ productId, quantity });
    }
  });

  return normalized;
}

export function validateOrderKey(rawKey) {
  if (typeof rawKey !== 'string' || rawKey.trim().length === 0) {
    throw new OrderValidationError({ 'Idempotency-Key': 'REQUIRED' });
  }

  return rawKey.trim();
}

export function validateOrderRequest(rawRequest, products) {
  const fields = {};
  if (!isPlainObject(rawRequest)) {
    throw new OrderValidationError({ root: 'INVALID_TYPE' });
  }

  addExtraFields(rawRequest, ROOT_FIELDS, '', fields);
  const productIds = new Set(products.map(({ id }) => id));
  const items = validateItems(rawRequest.items, productIds, fields);
  const shippingAddress = validateAddress(rawRequest.shippingAddress, fields);

  let currency;
  if (rawRequest.currency === undefined) {
    fields.currency = 'REQUIRED';
  } else if (typeof rawRequest.currency !== 'string') {
    fields.currency = 'INVALID_TYPE';
  } else {
    currency = rawRequest.currency.trim();
    if (currency !== 'MXN' && currency !== 'USD') {
      fields.currency = 'INVALID_VALUE';
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new OrderValidationError(fields);
  }

  return { items, shippingAddress, currency };
}

function sortRecursively(value) {
  if (Array.isArray(value)) {
    return value.map(sortRecursively);
  }
  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortRecursively(value[key])]),
  );
}

export function serializeCanonicalOrder(request) {
  const canonical = {
    ...request,
    items: [...request.items].sort((left, right) =>
      left.productId.localeCompare(right.productId, 'en'),
    ),
  };

  return JSON.stringify(sortRecursively(canonical));
}

export function createOrderFingerprint(request) {
  return createHash('sha256')
    .update(serializeCanonicalOrder(request), 'utf8')
    .digest('hex');
}
