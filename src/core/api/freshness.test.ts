/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FRESH_MS, shouldRevalidate } from './freshness.ts';

const NOW = 1_000_000;

describe('shouldRevalidate', () => {
  it('uses a 60 second freshness window', () => {
    assert.equal(FRESH_MS, 60_000);
  });

  it('does not revalidate at 59 999 ms', () => {
    assert.equal(
      shouldRevalidate({ fulfilledTimeStamp: NOW - 59_999, now: NOW, isFetching: false }),
      false,
    );
  });

  it('revalidates at exactly 60 000 ms and after', () => {
    assert.equal(
      shouldRevalidate({ fulfilledTimeStamp: NOW - 60_000, now: NOW, isFetching: false }),
      true,
    );
    assert.equal(
      shouldRevalidate({ fulfilledTimeStamp: NOW - 600_000, now: NOW, isFetching: false }),
      true,
    );
  });

  it('does not revalidate while a request is already in flight', () => {
    assert.equal(
      shouldRevalidate({ fulfilledTimeStamp: NOW - 120_000, now: NOW, isFetching: true }),
      false,
    );
  });

  it('does not revalidate without a previous successful response', () => {
    assert.equal(
      shouldRevalidate({ fulfilledTimeStamp: undefined, now: NOW, isFetching: false }),
      false,
    );
  });

  it('treats a timestamp in the future (clock change) as fresh', () => {
    assert.equal(
      shouldRevalidate({ fulfilledTimeStamp: NOW + 5_000, now: NOW, isFetching: false }),
      false,
    );
  });
});
