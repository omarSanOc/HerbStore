import assert from 'node:assert/strict';
import test from 'node:test';

import { addressSchema } from './address-schema.ts';

const valid = {
  fullName: ' Ana Pérez ',
  phone: '5512345678',
  postalCode: '01234',
  state: ' Jalisco ',
  city: ' Guadalajara ',
  street: ' Avenida Central ',
  exteriorNumber: ' 10 ',
  interiorNumber: ' 2A ',
};

test('normalizes address and removes an empty interior number', () => {
  const result = addressSchema.parse({ ...valid, interiorNumber: '  ' });
  assert.deepEqual(result, { ...valid, fullName: 'Ana Pérez', state: 'Jalisco', city: 'Guadalajara', street: 'Avenida Central', exteriorNumber: '10', interiorNumber: undefined });
});

test('accepts exact minimum lengths and rejects values beyond phone/postal limits', () => {
  assert.equal(addressSchema.safeParse({ ...valid, fullName: 'abc', state: 'ab', city: 'cd', street: 'abc', phone: '1234567890', postalCode: '12345' }).success, true);
  assert.equal(addressSchema.safeParse({ ...valid, phone: '123456789', postalCode: '1234' }).success, false);
  assert.equal(addressSchema.safeParse({ ...valid, phone: '12345678901', postalCode: '123456' }).success, false);
});

test('uses i18n keys instead of user-facing messages', () => {
  const result = addressSchema.safeParse({ ...valid, fullName: ' a ' });
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.error.issues[0]?.message, 'checkout.validation.fullName.min');
});
