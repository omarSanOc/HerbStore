/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatCurrency,
  formatInteger,
  formatRating,
  resolveFormatLocale,
} from './format-number.ts';

// ICU may separate symbol and amount with a no-break space: compare with a plain one.
const plain = (text: string) => text.replace(/ | /g, ' ');

describe('resolveFormatLocale', () => {
  it('maps the interface language to a regional locale', () => {
    assert.equal(resolveFormatLocale('en'), 'en-US');
    assert.equal(resolveFormatLocale('es'), 'es-MX');
  });

  it('accepts regional tags and falls back to Spanish for anything else', () => {
    assert.equal(resolveFormatLocale('en-GB'), 'en-US');
    assert.equal(resolveFormatLocale('EN'), 'en-US');
    assert.equal(resolveFormatLocale('es-ES'), 'es-MX');
    assert.equal(resolveFormatLocale('fr'), 'es-MX');
    assert.equal(resolveFormatLocale(''), 'es-MX');
  });
});

describe('formatCurrency', () => {
  it('formats each currency with its own code in English', () => {
    assert.equal(plain(formatCurrency(11.99, 'USD', 'en')), '$11.99');
    assert.equal(plain(formatCurrency(277.9, 'MXN', 'en')), 'MX$277.90');
  });

  it('formats each currency with its own code in Spanish', () => {
    assert.equal(plain(formatCurrency(277.9, 'MXN', 'es')), '$277.90');
    assert.equal(plain(formatCurrency(11.99, 'USD', 'es')), 'USD 11.99');
  });

  it('always shows two decimals and groups thousands', () => {
    assert.equal(plain(formatCurrency(1234.5, 'MXN', 'es')), '$1,234.50');
    assert.equal(plain(formatCurrency(10, 'USD', 'en')), '$10.00');
    assert.equal(plain(formatCurrency(0, 'USD', 'en')), '$0.00');
  });

  it('does not accumulate binary floating point error', () => {
    // 0.1 + 0.2 is 0.30000000000000004: the formatter rounds to cents, it never does the math.
    assert.equal(plain(formatCurrency(0.1 + 0.2, 'USD', 'en')), '$0.30');
    assert.equal(plain(formatCurrency(1.005 * 100, 'MXN', 'es')), '$100.50');
  });

  it('gives the same result when the formatter is reused', () => {
    assert.equal(formatCurrency(5, 'USD', 'en'), formatCurrency(5, 'USD', 'en'));
  });
});

describe('formatRating', () => {
  it('always shows one decimal', () => {
    assert.equal(formatRating(4.9, 'en'), '4.9');
    assert.equal(formatRating(3, 'es'), '3.0');
    assert.equal(formatRating(0, 'es'), '0.0');
  });

  it('rounds to one decimal', () => {
    assert.equal(formatRating(4.25, 'en'), '4.3');
  });
});

describe('formatInteger', () => {
  it('groups thousands', () => {
    assert.equal(formatInteger(815, 'en'), '815');
    assert.equal(formatInteger(2400, 'es'), '2,400');
  });
});
