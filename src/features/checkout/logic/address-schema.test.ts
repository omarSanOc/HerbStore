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

// T2 (RF-3): one row per rule, so a failing run names the field and the input.
type Rejection = readonly [label: string, patch: Record<string, unknown>, field: string, message: string];

const rejections: readonly Rejection[] = [
  ['full name of 2 letters', { fullName: 'Al' }, 'fullName', 'checkout.validation.fullName.min'],
  ['full name of only spaces', { fullName: '     ' }, 'fullName', 'checkout.validation.fullName.min'],
  ['full name empty', { fullName: '' }, 'fullName', 'checkout.validation.fullName.min'],
  ['phone of 9 digits', { phone: '551234567' }, 'phone', 'checkout.validation.phone.format'],
  ['phone of 11 digits', { phone: '55123456789' }, 'phone', 'checkout.validation.phone.format'],
  ['phone with spaces inside', { phone: '55 1234 5678' }, 'phone', 'checkout.validation.phone.format'],
  ['phone with dashes', { phone: '55-1234-5678' }, 'phone', 'checkout.validation.phone.format'],
  ['phone with a country prefix', { phone: '+525512345678' }, 'phone', 'checkout.validation.phone.format'],
  ['phone with letters', { phone: '55123456AB' }, 'phone', 'checkout.validation.phone.format'],
  ['phone with Arabic-Indic digits', { phone: '٥٥١٢٣٤٥٦٧٨' }, 'phone', 'checkout.validation.phone.format'],
  ['phone empty', { phone: '' }, 'phone', 'checkout.validation.phone.format'],
  ['postal code of 4 digits', { postalCode: '1234' }, 'postalCode', 'checkout.validation.postalCode.format'],
  ['postal code of 6 digits', { postalCode: '123456' }, 'postalCode', 'checkout.validation.postalCode.format'],
  ['postal code with a letter', { postalCode: '0123A' }, 'postalCode', 'checkout.validation.postalCode.format'],
  ['state of 1 letter', { state: 'J' }, 'state', 'checkout.validation.state.min'],
  ['city of 1 letter', { city: 'G' }, 'city', 'checkout.validation.city.min'],
  ['street of 2 letters', { street: 'Av' }, 'street', 'checkout.validation.street.min'],
  ['exterior number of only spaces', { exteriorNumber: '   ' }, 'exteriorNumber', 'checkout.validation.exteriorNumber.required'],
  ['exterior number empty', { exteriorNumber: '' }, 'exteriorNumber', 'checkout.validation.exteriorNumber.required'],
];

test('rejects each invalid input on its own field with its i18n key', () => {
  for (const [label, patch, field, message] of rejections) {
    const result = addressSchema.safeParse({ ...valid, ...patch });
    assert.equal(result.success, false, label);
    if (result.success) continue;
    assert.equal(result.error.issues.length, 1, `${label}: only one rule breaks`);
    assert.deepEqual(result.error.issues[0]?.path, [field], label);
    assert.equal(result.error.issues[0]?.message, message, label);
  }
});

test('a required field that is missing or not text is rejected', () => {
  for (const field of ['fullName', 'phone', 'postalCode', 'state', 'city', 'street', 'exteriorNumber']) {
    const missing: Record<string, unknown> = { ...valid };
    delete missing[field];
    assert.equal(addressSchema.safeParse(missing).success, false, `${field} missing`);
    assert.equal(addressSchema.safeParse({ ...valid, [field]: 12345 }).success, false, `${field} as a number`);
    assert.equal(addressSchema.safeParse({ ...valid, [field]: null }).success, false, `${field} as null`);
  }
});

test('the interior number is optional: absent, empty and spaces all end as undefined; text is trimmed', () => {
  const withoutKey: Record<string, unknown> = { ...valid };
  delete withoutKey.interiorNumber;
  assert.equal(addressSchema.parse(withoutKey).interiorNumber, undefined);
  assert.equal(addressSchema.parse({ ...valid, interiorNumber: '' }).interiorNumber, undefined);
  assert.equal(addressSchema.parse({ ...valid, interiorNumber: '   ' }).interiorNumber, undefined);
  assert.equal(addressSchema.parse({ ...valid, interiorNumber: ' 4B ' }).interiorNumber, '4B');
});

test('accepts accents, apostrophes and symbols in free text; trims phone and postal code', () => {
  const parsed = addressSchema.parse({
    ...valid,
    fullName: "Zoë O'Brien-Núñez",
    street: 'Calle 5 de Mayo #12',
    phone: ' 5512345678 ',
    postalCode: ' 01234 ',
  });
  assert.equal(parsed.fullName, "Zoë O'Brien-Núñez");
  assert.equal(parsed.street, 'Calle 5 de Mayo #12');
  assert.equal(parsed.phone, '5512345678');
  assert.equal(parsed.postalCode, '01234');
});

test('reports every broken field at once, so the form can show them all', () => {
  const result = addressSchema.safeParse({ ...valid, fullName: '', phone: '1', postalCode: '1', state: '', city: '', street: '', exteriorNumber: '' });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(
      result.error.issues.map((issue) => issue.path[0]).sort(),
      ['city', 'exteriorNumber', 'fullName', 'phone', 'postalCode', 'state', 'street'],
    );
  }
});

test('does not mutate its input', () => {
  const input = Object.freeze({ ...valid });
  addressSchema.parse(input);
  assert.equal(input.fullName, ' Ana Pérez ');
});
