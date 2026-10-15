/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveApiOrigin } from './resolve-api-origin.ts';

describe('resolveApiOrigin', () => {
  it('reports a missing required origin without a fallback', () => {
    for (const value of [undefined, '', '   ']) {
      assert.deepEqual(resolveApiOrigin(value), { status: 'missing' });
    }
  });

  it('rejects values that are not a bare HTTP(S) origin', () => {
    for (const value of [
      'ftp://api.example.test',
      'api.example.test',
      'http://',
      'http://host with space:3001',
      'http://api.example.test/path',
      'http://api.example.test?query=1',
      'http://api.example.test#fragment',
      'http://user:password@api.example.test',
      'http://api.example.test:99999',
    ]) {
      assert.deepEqual(resolveApiOrigin(value), { status: 'invalid' }, value);
    }
  });

  it('normalizes a valid HTTP(S) origin', () => {
    assert.deepEqual(resolveApiOrigin('  http://192.168.1.20:3001/  '), {
      status: 'ready',
      origin: 'http://192.168.1.20:3001',
    });
    assert.deepEqual(resolveApiOrigin('https://api.example.test'), {
      status: 'ready',
      origin: 'https://api.example.test',
    });
  });
});
