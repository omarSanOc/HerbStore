import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createOrderFingerprint,
  OrderValidationError,
  validateOrderRequest,
} from '../src/orders/order-contract.js';
import { calculateOrderTotals, roundHalfUp } from '../src/orders/order-totals.js';
import { OrderStore } from '../src/orders/order-store.js';

const HOUR_MS = 60 * 60 * 1000;
const START_MS = Date.parse('2026-10-10T12:00:00.000Z');
const UUIDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
];

const products = [
  { id: 'mx-low', price: 399.9, currency: 'MXN', inStock: true, stock: 2 },
  { id: 'mx-threshold', price: 400, currency: 'MXN', inStock: true, stock: 2 },
  { id: 'mx-half', price: 1.005, currency: 'MXN', inStock: true, stock: 99 },
  { id: 'usd-item', price: 10.01, currency: 'USD', inStock: true, stock: 3 },
  { id: 'unavailable', price: 20, currency: 'MXN', inStock: false, stock: 0 },
];

function validRequest(overrides = {}) {
  return {
    items: [{ productId: 'mx-low', quantity: 1 }],
    shippingAddress: {
      fullName: 'Ada Rivera',
      phone: '5512345678',
      postalCode: '03100',
      state: 'CDMX',
      city: 'Benito Juárez',
      street: 'Fictional Avenue',
      exteriorNumber: '42',
    },
    currency: 'MXN',
    ...overrides,
  };
}

function createHarness({ processingMs = 5_000 } = {}) {
  let now = START_MS;
  let nextId = 0;
  const store = new OrderStore({
    products,
    clock: () => now,
    idFactory: () => UUIDS[nextId++],
    processingMs,
  });

  return {
    store,
    advance(ms) {
      now += ms;
    },
    setNow(value) {
      now = value;
    },
  };
}

describe('strict order contract and semantic fingerprint', () => {
  it('trims text, omits an empty interior number, and canonicalizes key/item order', () => {
    const first = validateOrderRequest(
      validRequest({
        items: [
          { quantity: 1, productId: ' usd-item ' },
          { productId: 'mx-low', quantity: 2 },
        ],
        shippingAddress: {
          street: ' Fictional Avenue ',
          exteriorNumber: ' 42 ',
          city: ' Benito Juárez ',
          state: ' CDMX ',
          postalCode: ' 03100 ',
          phone: ' 5512345678 ',
          fullName: ' Ada Rivera ',
          interiorNumber: '   ',
        },
      }),
      products,
    );
    const second = validateOrderRequest(
      {
        currency: 'MXN',
        shippingAddress: {
          fullName: 'Ada Rivera',
          phone: '5512345678',
          postalCode: '03100',
          state: 'CDMX',
          city: 'Benito Juárez',
          street: 'Fictional Avenue',
          exteriorNumber: '42',
        },
        items: [
          { productId: 'mx-low', quantity: 2 },
          { productId: 'usd-item', quantity: 1 },
        ],
      },
      products,
    );

    assert.equal('interiorNumber' in first.shippingAddress, false);
    assert.equal(createOrderFingerprint(first), createOrderFingerprint(second));

    for (const changed of [
      validRequest({ shippingAddress: { ...validRequest().shippingAddress, fullName: 'ada Rivera' } }),
      validRequest({ shippingAddress: { ...validRequest().shippingAddress, city: 'Benito Juarez' } }),
      validRequest({ items: [{ productId: 'mx-low', quantity: 2 }] }),
      validRequest({ currency: 'USD' }),
    ]) {
      assert.notEqual(
        createOrderFingerprint(validateOrderRequest(changed, products)),
        createOrderFingerprint(validateOrderRequest(validRequest(), products)),
      );
    }
  });

  it('reports all strict validation paths with stable codes and never echoes values', () => {
    const invalid = {
      items: [
        { productId: 'missing-product', quantity: 0, extra: 'sensitive-value' },
        { productId: 'missing-product', quantity: 1 },
      ],
      shippingAddress: {
        fullName: ' A ',
        phone: '55-123',
        postalCode: 'abcde',
        state: ' ',
        city: 7,
        street: 'xy',
        exteriorNumber: ' ',
        secret: 'sensitive-value',
      },
      currency: 'EUR',
      privateNote: 'sensitive-value',
    };

    assert.throws(
      () => validateOrderRequest(invalid, products),
      (error) => {
        assert.ok(error instanceof OrderValidationError);
        assert.deepEqual(error.fields, {
          'privateNote': 'ADDITIONAL_PROPERTY',
          'items[0].extra': 'ADDITIONAL_PROPERTY',
          'items[0].productId': 'UNKNOWN_PRODUCT',
          'items[0].quantity': 'OUT_OF_RANGE',
          'items[1].productId': 'DUPLICATE',
          'shippingAddress.secret': 'ADDITIONAL_PROPERTY',
          'shippingAddress.fullName': 'TOO_SHORT',
          'shippingAddress.phone': 'INVALID_FORMAT',
          'shippingAddress.postalCode': 'INVALID_FORMAT',
          'shippingAddress.state': 'REQUIRED',
          'shippingAddress.city': 'INVALID_TYPE',
          'shippingAddress.street': 'TOO_SHORT',
          'shippingAddress.exteriorNumber': 'REQUIRED',
          'currency': 'INVALID_VALUE',
        });
        assert.equal(JSON.stringify(error).includes('sensitive-value'), false);
        return true;
      },
    );
  });

  it('rejects missing structures, empty items, non-integer quantities, and extras', () => {
    const cases = [
      [undefined, { root: 'INVALID_TYPE' }],
      [{}, { items: 'REQUIRED', shippingAddress: 'REQUIRED', currency: 'REQUIRED' }],
      [validRequest({ items: [] }), { items: 'OUT_OF_RANGE' }],
      [validRequest({ items: [{ productId: 'mx-low', quantity: 1.5 }] }), { 'items[0].quantity': 'INVALID_TYPE' }],
      [validRequest({ items: [{ productId: 'mx-low', quantity: 100 }] }), { 'items[0].quantity': 'OUT_OF_RANGE' }],
      [validRequest({ shippingAddress: [] }), { shippingAddress: 'INVALID_TYPE' }],
    ];

    for (const [request, expectedFields] of cases) {
      assert.throws(
        () => validateOrderRequest(request, products),
        (error) => error instanceof OrderValidationError && assert.deepEqual(error.fields, expectedFields) === undefined,
      );
    }
  });
});

describe('authoritative order totals', () => {
  it('uses canonical MXN for the threshold and the approved rounding sequence', () => {
    const below = calculateOrderTotals(
      validateOrderRequest(validRequest(), products),
      products,
    );
    const exact = calculateOrderTotals(
      validateOrderRequest(validRequest({ items: [{ productId: 'mx-threshold', quantity: 2 }] }), products),
      products,
    );

    assert.equal(below.canonicalSubtotalMXN, 399.9);
    assert.deepEqual(
      { subtotal: below.subtotal, shipping: below.shipping, total: below.total },
      { subtotal: 399.9, shipping: 99, total: 498.9 },
    );
    assert.equal(exact.canonicalSubtotalMXN, 800);
    assert.equal(exact.shipping, 0);

    const free = calculateOrderTotals(
      validateOrderRequest(validRequest({ items: [{ productId: 'usd-item', quantity: 5 }] }), products),
      products,
    );
    assert.ok(Math.abs(free.canonicalSubtotalMXN - 900.9) < 1e-9);
    assert.equal(free.shipping, 0);
  });

  it('converts both currencies and rounds unit, line, subtotal, shipping, and total half-up', () => {
    assert.equal(roundHalfUp(1.005), 1.01);
    assert.equal(roundHalfUp(1.0049), 1);

    const usd = calculateOrderTotals(
      validateOrderRequest(
        validRequest({
          items: [
            { productId: 'mx-half', quantity: 3 },
            { productId: 'mx-low', quantity: 1 },
          ],
          currency: 'USD',
        }),
        products,
      ),
      products,
    );

    assert.deepEqual(usd.items, [
      { productId: 'mx-half', quantity: 3, unitPrice: 0.06, lineTotal: 0.18 },
      { productId: 'mx-low', quantity: 1, unitPrice: 22.22, lineTotal: 22.22 },
    ]);
    assert.deepEqual(
      { subtotal: usd.subtotal, shipping: usd.shipping, total: usd.total },
      { subtotal: 22.4, shipping: 5.5, total: 27.9 },
    );
  });
});

describe('order idempotency, reservations, and retention', () => {
  it('returns one pending attempt for semantic retries and the same confirmed order', () => {
    const { store, advance } = createHarness();
    const first = store.submit('stable-key', validRequest());
    const retry = store.submit('stable-key', validRequest({
      shippingAddress: {
        ...validRequest().shippingAddress,
        fullName: ' Ada Rivera ',
      },
    }));

    assert.equal(first.kind, 'pending');
    assert.equal(first.retryAfterSeconds, 5);
    assert.deepEqual(retry, first);
    assert.match(first.key, /^stable-key$/);

    advance(5_000);
    const confirmed = store.submit('stable-key', validRequest());
    assert.equal(confirmed.kind, 'confirmed');
    assert.equal(confirmed.order.id, UUIDS[0]);
    assert.equal(confirmed.order.createdAt, '2026-10-10T12:00:00.000Z');
    assert.equal(confirmed.order.status, 'confirmed');
    assert.deepEqual(store.getStatus('stable-key'), confirmed);
    assert.equal(
      store.submit('stable-key', validRequest({ currency: 'USD' })).status,
      'confirmed',
    );
  });

  it('keeps an active attempt unchanged when the key is reused with another body', () => {
    const { store } = createHarness();
    const pending = store.submit('stable-key', validRequest());
    const conflict = store.submit(
      'stable-key',
      validRequest({ items: [{ productId: 'mx-low', quantity: 2 }] }),
    );

    assert.equal(conflict.kind, 'idempotency_conflict');
    assert.equal(conflict.status, 'pending');
    assert.equal(conflict.statusPath, '/orders/status/stable-key');
    assert.deepEqual(store.getStatus('stable-key'), pending);
  });

  it('reserves stock atomically, prevents overselling, and commits once', () => {
    const { store, advance } = createHarness();
    const first = store.submit(
      'first-key',
      validRequest({ items: [{ productId: 'mx-low', quantity: 2 }] }),
    );
    const rejected = store.submit('second-key', validRequest());

    assert.equal(first.kind, 'pending');
    assert.equal(rejected.kind, 'out_of_stock');
    assert.equal(store.getStatus('second-key').kind, 'not_created');
    assert.equal(store.inspect().inventory['mx-low'].available, 0);
    assert.equal(store.inspect().inventory['mx-low'].reserved, 2);

    advance(5_000);
    assert.equal(store.getStatus('first-key').kind, 'confirmed');
    assert.deepEqual(store.inspect().inventory['mx-low'], { available: 0, reserved: 0 });
  });

  it('expires pending before confirmation at exactly 24h and releases stock', () => {
    const { store, setNow } = createHarness({ processingMs: 25 * HOUR_MS });
    store.submit(
      'slow-key',
      validRequest({ items: [{ productId: 'mx-low', quantity: 2 }] }),
    );

    setNow(START_MS + 24 * HOUR_MS - 1);
    assert.equal(store.getStatus('slow-key').kind, 'pending');
    setNow(START_MS + 24 * HOUR_MS);
    assert.equal(store.getStatus('slow-key').kind, 'expired');
    assert.deepEqual(store.inspect().inventory['mx-low'], { available: 2, reserved: 0 });

    const tombstone = store.inspect().attempts['slow-key'];
    assert.deepEqual(Object.keys(tombstone).sort(), ['createdAtMs', 'expiresAtMs', 'key', 'status']);
    assert.equal(JSON.stringify(tombstone).includes('fingerprint'), false);
    assert.equal(JSON.stringify(tombstone).includes('order'), false);
  });

  it('confirms in chronological order when no one polls before 24h', () => {
    const { store, setNow } = createHarness({ processingMs: 1_000 });
    store.submit(
      'unpolled-key',
      validRequest({ items: [{ productId: 'mx-low', quantity: 2 }] }),
    );

    setNow(START_MS + 24 * HOUR_MS);
    assert.equal(store.getStatus('unpolled-key').kind, 'expired');
    assert.deepEqual(store.inspect().inventory['mx-low'], { available: 0, reserved: 0 });
  });

  it('settles an unpolled pending before forgetting the key at 48h', () => {
    const { store, setNow } = createHarness({ processingMs: 1_000 });
    store.submit(
      'forgotten-key',
      validRequest({ items: [{ productId: 'mx-low', quantity: 2 }] }),
    );

    setNow(START_MS + 48 * HOUR_MS);
    assert.equal(store.getStatus('forgotten-key').kind, 'not_created');
    assert.deepEqual(store.inspect().inventory['mx-low'], { available: 0, reserved: 0 });

    const slow = createHarness({ processingMs: 30 * HOUR_MS });
    slow.store.submit(
      'slow-forgotten',
      validRequest({ items: [{ productId: 'mx-low', quantity: 2 }] }),
    );
    slow.setNow(START_MS + 48 * HOUR_MS);
    assert.equal(slow.store.getStatus('slow-forgotten').kind, 'not_created');
    assert.deepEqual(slow.store.inspect().inventory['mx-low'], { available: 2, reserved: 0 });
  });

  it('expires instead of confirming when the interval ends exactly at 24h', () => {
    const { store, setNow } = createHarness({ processingMs: 24 * HOUR_MS });
    store.submit(
      'boundary-key',
      validRequest({ items: [{ productId: 'mx-low', quantity: 2 }] }),
    );

    setNow(START_MS + 24 * HOUR_MS);
    assert.equal(store.getStatus('boundary-key').kind, 'expired');
    assert.deepEqual(store.inspect().inventory['mx-low'], { available: 2, reserved: 0 });
  });

  it('releases an expired pending reservation for other keys without polling it', () => {
    const { store, setNow } = createHarness({ processingMs: 30 * HOUR_MS });
    const first = store.submit(
      'a',
      validRequest({ items: [{ productId: 'mx-low', quantity: 2 }] }),
    );
    assert.equal(first.kind, 'pending');
    assert.equal(store.submit('early', validRequest()).kind, 'out_of_stock');

    setNow(START_MS + 25 * HOUR_MS);
    const second = store.submit(
      'b',
      validRequest({ items: [{ productId: 'mx-low', quantity: 2 }] }),
    );
    assert.equal(second.kind, 'pending');
    assert.equal(store.getStatus('a').kind, 'expired');
    assert.deepEqual(store.inspect().inventory['mx-low'], { available: 0, reserved: 2 });
  });

  it('keeps active data before 24h, tombstones until 48h, then forgets the key', () => {
    const { store, setNow } = createHarness();
    store.submit('retained-key', validRequest());

    setNow(START_MS + 24 * HOUR_MS - 1);
    assert.equal(store.getStatus('retained-key').kind, 'confirmed');
    setNow(START_MS + 24 * HOUR_MS);
    assert.equal(store.getStatus('retained-key').kind, 'expired');
    assert.equal(store.submit('retained-key', { invalid: true }).kind, 'expired');
    setNow(START_MS + 48 * HOUR_MS - 1);
    assert.equal(store.getStatus('retained-key').kind, 'expired');
    setNow(START_MS + 48 * HOUR_MS);
    assert.equal(store.getStatus('retained-key').kind, 'not_created');
    assert.equal(store.submit('retained-key', validRequest()).kind, 'pending');
  });

  it('reports the live available stock, which tracks pending, confirmed and expired orders', () => {
    const { store, advance, setNow } = createHarness({ processingMs: 30 * HOUR_MS });

    assert.equal(store.availableStock('mx-low'), 2);
    assert.equal(store.availableStock('mx-half'), 99);
    assert.equal(store.availableStock('unavailable'), 0);
    assert.equal(store.availableStock('does-not-exist'), undefined);

    store.submit('live-stock', validRequest({ items: [{ productId: 'mx-low', quantity: 1 }] }));
    assert.equal(store.availableStock('mx-low'), 1);
    const tooMany = store.submit(
      'too-many',
      validRequest({ items: [{ productId: 'mx-low', quantity: 2 }] }),
    );
    assert.equal(tooMany.kind, 'out_of_stock');
    assert.equal(store.availableStock('mx-low'), 1);

    advance(HOUR_MS);
    assert.equal(store.availableStock('mx-low'), 1);

    // A pending that is still unconfirmed at 24 h expires and gives its unit back.
    setNow(START_MS + 24 * HOUR_MS);
    assert.equal(store.availableStock('mx-low'), 2);
  });

  it('keeps confirmed units consumed after the order expires', () => {
    const { store, setNow } = createHarness({ processingMs: 1_000 });

    store.submit('consumed', validRequest({ items: [{ productId: 'mx-low', quantity: 2 }] }));
    assert.equal(store.availableStock('mx-low'), 0);
    setNow(START_MS + 25 * HOUR_MS);
    assert.equal(store.availableStock('mx-low'), 0);
  });

  it('stores only permitted non-personal active data', () => {
    const { store } = createHarness();
    store.submit('privacy-key', validRequest());
    const snapshot = store.inspect();
    const serialized = JSON.stringify(snapshot);

    assert.equal(serialized.includes('Ada Rivera'), false);
    assert.equal(serialized.includes('5512345678'), false);
    assert.equal(serialized.includes('03100'), false);
    assert.equal(serialized.includes('Fictional Avenue'), false);
    assert.equal(serialized.includes('shippingAddress'), false);
    assert.deepEqual(Object.keys(snapshot.attempts['privacy-key']).sort(), [
      'confirmAtMs',
      'createdAtMs',
      'fingerprint',
      'key',
      'order',
      'reservation',
      'status',
    ]);
  });
});
