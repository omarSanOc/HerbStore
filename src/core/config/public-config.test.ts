/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolvePublicConfig } from './public-config.ts';

describe('resolvePublicConfig', () => {
  it('preserves the missing, invalid and ready states for the required API origin', () => {
    assert.deepEqual(resolvePublicConfig({ apiOrigin: undefined }), { status: 'missing' });
    assert.deepEqual(resolvePublicConfig({ apiOrigin: 'https://api.example.test/products' }), {
      status: 'invalid',
    });
    assert.deepEqual(resolvePublicConfig({ apiOrigin: 'https://api.example.test/' }), {
      status: 'ready',
      apiOrigin: 'https://api.example.test',
    });
  });
});
