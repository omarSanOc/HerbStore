import assert from 'node:assert/strict';
import test from 'node:test';
import { createFingerprint } from './fingerprint.ts';

test('injects the hash implementation', async () => assert.equal(await createFingerprint('canonical', async (value) => `hash:${value}`), 'hash:canonical'));
