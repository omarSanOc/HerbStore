import test from 'node:test';
import assert from 'node:assert/strict';

import { SCANNER_SEARCH_ROUTE } from './scanner-navigation.ts';

test('unavailable scanner state exits through the existing search route', () => {
  assert.equal(SCANNER_SEARCH_ROUTE, '/search');
});
