/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseOrderOutcome } from './order-outcome.ts';

describe('parseOrderOutcome', () => {
  it('maps data, contract errors and transport errors without exposing bodies', () => {
    assert.equal(parseOrderOutcome({ data: { status: 'pending', retryAfterSeconds: 1 } }), 'pending');
    assert.equal(parseOrderOutcome({ error: { kind: 'http', status: 409, body: { kind: 'keyReused' } } }), 'keyReused');
    assert.equal(parseOrderOutcome({ error: { kind: 'timeout' } }), 'uncertain');
  });
});
