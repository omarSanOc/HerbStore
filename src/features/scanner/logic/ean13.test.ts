import test from 'node:test';
import assert from 'node:assert/strict';

import { isValidEan13 } from './ean13.ts';

test('EAN-13 accepts exactly 13 digits with the exact checksum', () => {
  assert.equal(isValidEan13('4006381333931'), true);
  assert.equal(isValidEan13('4006381333932'), false);
  assert.equal(isValidEan13('400638133393'), false);
  assert.equal(isValidEan13('40063813339310'), false);
  assert.equal(isValidEan13('40063813339A1'), false);
  assert.equal(isValidEan13(' 4006381333931'), false);
});
