/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { en } from './en.ts';
import { es } from './es.ts';

/** Flattens nested resources into `a.b.c` paths with their text. */
function flatten(node: unknown, prefix = ''): Map<string, string> {
  const entries = new Map<string, string>();
  if (typeof node === 'string') {
    entries.set(prefix, node);
    return entries;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    for (const [path, text] of flatten(value, prefix === '' ? key : `${prefix}.${key}`)) {
      entries.set(path, text);
    }
  }
  return entries;
}

const placeholders = (text: string) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

describe('i18n resources', () => {
  const english = flatten(en);
  const spanish = flatten(es);

  it('has exactly the same keys in Spanish and English', () => {
    const onlyEnglish = [...english.keys()].filter((key) => !spanish.has(key));
    const onlySpanish = [...spanish.keys()].filter((key) => !english.has(key));
    assert.deepEqual(onlyEnglish, [], 'keys missing in es');
    assert.deepEqual(onlySpanish, [], 'keys missing in en');
  });

  it('has no empty text', () => {
    for (const [key, text] of [...english, ...spanish]) {
      assert.notEqual(text.trim(), '', key);
    }
  });

  it('uses the same interpolation variables in both languages', () => {
    for (const [key, text] of english) {
      assert.deepEqual(placeholders(spanish.get(key) ?? ''), placeholders(text), key);
    }
  });
});
