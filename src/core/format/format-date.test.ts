/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatDateTime } from './format-date.ts';

// A fixed instant and an explicit zone: the test must not depend on the machine's time zone.
const INSTANT = '2026-10-15T10:30:00.000Z';

describe('formatDateTime', () => {
  it('writes the date and time in the interface language, in the zone it is given', () => {
    const spanish = formatDateTime(INSTANT, 'es', { timeZone: 'UTC' });
    const english = formatDateTime(INSTANT, 'en', { timeZone: 'UTC' });

    assert.match(spanish ?? '', /15/);
    assert.match(spanish ?? '', /oct/i);
    assert.match(spanish ?? '', /2026/);
    assert.match(english ?? '', /Oct/);
    assert.match(english ?? '', /15/);
    assert.match(english ?? '', /2026/);
    assert.notEqual(spanish, english);
  });

  it('follows the zone: the same instant is another calendar day in Auckland', () => {
    assert.match(formatDateTime('2026-10-15T20:30:00.000Z', 'en', { timeZone: 'UTC' }) ?? '', /15/);
    assert.match(formatDateTime('2026-10-15T20:30:00.000Z', 'en', { timeZone: 'Pacific/Auckland' }) ?? '', /16/);
  });

  it('uses the device zone when none is given', () => {
    assert.equal(typeof formatDateTime(INSTANT, 'es'), 'string');
  });

  it('returns undefined for text that is not a date, instead of "Invalid Date" or a throw', () => {
    for (const bad of ['', 'not a date', '2026-13-45', undefined, null, 12, {}]) {
      assert.equal(formatDateTime(bad as never, 'es'), undefined, String(bad));
    }
  });

  it('accepts the same language tags as the number formatter (regional variants and unknown ones)', () => {
    assert.equal(formatDateTime(INSTANT, 'en-GB', { timeZone: 'UTC' }), formatDateTime(INSTANT, 'en', { timeZone: 'UTC' }));
    assert.equal(formatDateTime(INSTANT, 'fr', { timeZone: 'UTC' }), formatDateTime(INSTANT, 'es', { timeZone: 'UTC' }));
  });
});
