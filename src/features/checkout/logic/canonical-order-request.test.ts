import assert from 'node:assert/strict';
import test from 'node:test';
import type { OrderRequest, ShippingAddress } from '../contracts/order.ts';
import { addressSchema } from './address-schema.ts';
import { canonicalizeOrderRequest, serializeCanonicalOrder } from './canonical-order-request.ts';
import { buildCheckoutRequest } from './checkout-request.ts';
import { createFingerprint } from './fingerprint.ts';

const address = { fullName: ' Ana ', phone: '1234567890', postalCode: '01234', state: ' CDMX ', city: ' MX ', street: ' Main ', exteriorNumber: ' 1 ' };

const orderTo = (shippingAddress: ShippingAddress): OrderRequest => ({ currency: 'MXN', shippingAddress, items: [{ productId: 'a', quantity: 1 }] });

/** The same address, sorted and trimmed, with no interior number: the wire shape that must not change. */
const WITHOUT_INTERIOR = '{"currency":"MXN","items":[{"productId":"a","quantity":1}],"shippingAddress":{"city":"MX","exteriorNumber":"1","fullName":"Ana","phone":"1234567890","postalCode":"01234","state":"CDMX","street":"Main"}}';
/** The same address with ' 2A ' as interior number: it already worked before the fix and must stay byte-identical. */
const WITH_INTERIOR = '{"currency":"MXN","items":[{"productId":"a","quantity":1}],"shippingAddress":{"city":"MX","exteriorNumber":"1","fullName":"Ana","interiorNumber":"2A","phone":"1234567890","postalCode":"01234","state":"CDMX","street":"Main"}}';

test('canonicalizes trimmed fields, sorted items and recursively sorted keys', () => {
  const request = canonicalizeOrderRequest({ currency: ' MXN ' as 'MXN', shippingAddress: address, items: [{ productId: ' b ', quantity: 2 }, { productId: 'a', quantity: 1 }] });
  assert.deepEqual(request.items.map((item) => item.productId), ['a', 'b']);
  assert.equal(serializeCanonicalOrder(request), '{"currency":"MXN","items":[{"productId":"a","quantity":1},{"productId":"b","quantity":2}],"shippingAddress":{"city":"MX","exteriorNumber":"1","fullName":"Ana","phone":"1234567890","postalCode":"01234","state":"CDMX","street":"Main"}}');
});

test('rejects duplicate products', () => assert.throws(() => canonicalizeOrderRequest({ currency: 'MXN', shippingAddress: address, items: [{ productId: 'a', quantity: 1 }, { productId: 'a', quantity: 2 }] }), /duplicate/i));

// H-T8-1: the optional interior number reaches the canonicalizer as `undefined` (the form schema
// turns an empty field into `undefined`), and trimming it threw before the order left the app.
test('an interior number with the key present and value undefined is omitted, not trimmed', () => {
  const request = canonicalizeOrderRequest(orderTo({ ...address, interiorNumber: undefined }));
  assert.equal('interiorNumber' in request.shippingAddress, false);
  assert.equal(serializeCanonicalOrder(orderTo({ ...address, interiorNumber: undefined })), WITHOUT_INTERIOR);
});

test('an absent interior number canonicalizes without it', () => {
  const request = canonicalizeOrderRequest(orderTo(address));
  assert.equal('interiorNumber' in request.shippingAddress, false);
  assert.equal(serializeCanonicalOrder(orderTo(address)), WITHOUT_INTERIOR);
});

test('an empty or blank interior number is omitted', () => {
  for (const interiorNumber of ['', '   ', '\t\n ']) {
    const request = canonicalizeOrderRequest(orderTo({ ...address, interiorNumber }));
    assert.equal('interiorNumber' in request.shippingAddress, false, JSON.stringify(interiorNumber));
  }
});

test('a filled interior number is trimmed and kept', () => {
  const request = canonicalizeOrderRequest(orderTo({ ...address, interiorNumber: ' 2A ' }));
  assert.equal(request.shippingAddress.interiorNumber, '2A');
  assert.equal(serializeCanonicalOrder(orderTo({ ...address, interiorNumber: ' 2A ' })), WITH_INTERIOR);
});

test('the other address fields are still trimmed when the interior number is undefined', () => {
  const { shippingAddress } = canonicalizeOrderRequest(orderTo({ ...address, interiorNumber: undefined }));
  assert.deepEqual(shippingAddress, { fullName: 'Ana', phone: '1234567890', postalCode: '01234', state: 'CDMX', city: 'MX', street: 'Main', exteriorNumber: '1' });
});

test('an undefined field is ignored instead of throwing; the server answers for a missing required one', () => {
  const broken = { ...address, street: undefined } as unknown as ShippingAddress;
  assert.doesNotThrow(() => canonicalizeOrderRequest(orderTo(broken)));
  assert.equal('street' in canonicalizeOrderRequest(orderTo(broken)).shippingAddress, false);
});

test('absent, undefined, empty and blank interior numbers serialize to the very same string', () => {
  const variants: ShippingAddress[] = [
    address,
    { ...address, interiorNumber: undefined },
    { ...address, interiorNumber: '' },
    { ...address, interiorNumber: '  ' },
  ];
  const serialized = variants.map((variant) => serializeCanonicalOrder(orderTo(variant)));
  assert.deepEqual(new Set(serialized), new Set([WITHOUT_INTERIOR]));
});

test('the canonical string, and so the fingerprint of one attempt, is stable when canonicalized twice', async () => {
  const once = canonicalizeOrderRequest(orderTo({ ...address, interiorNumber: undefined }));
  assert.equal(serializeCanonicalOrder(canonicalizeOrderRequest(once)), serializeCanonicalOrder(once));
  // The thunk hashes the already canonical request; `createFingerprint` canonicalizes it again.
  const identity = async (value: string) => value;
  assert.equal(await createFingerprint(once, identity), WITHOUT_INTERIOR);
});

test('the value the form schema produces for an empty interior number reaches the wire body', () => {
  for (const interiorNumber of [undefined, '', '   ']) {
    const values = addressSchema.parse({ ...address, interiorNumber });
    const request = buildCheckoutRequest([{ productId: 'a', quantity: 1 }], 'MXN', values);
    assert.equal(serializeCanonicalOrder(request), WITHOUT_INTERIOR);
    // `JSON.stringify` of the canonical body (what `POST /orders` sends) carries no interior key.
    assert.equal('interiorNumber' in JSON.parse(JSON.stringify(canonicalizeOrderRequest(request))).shippingAddress, false);
  }
});

test('the value the form schema produces for a filled interior number is unchanged', () => {
  const values = addressSchema.parse({ ...address, interiorNumber: ' 2A ' });
  assert.equal(serializeCanonicalOrder(buildCheckoutRequest([{ productId: 'a', quantity: 1 }], 'MXN', values)), WITH_INTERIOR);
});
