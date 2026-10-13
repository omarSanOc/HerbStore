import test from 'node:test';
import assert from 'node:assert/strict';
import { buildValidationSummary } from './validation-summary.ts';

test('builds one accessible summary label from count and localized errors', () => {
  assert.equal(buildValidationSummary('Review 2 errors.', ['Name is required.', 'Phone is invalid.']), 'Review 2 errors. Name is required. Phone is invalid.');
});
