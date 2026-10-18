/// <reference types="node" />
// RF-15 (spec 006, T6b). "No necessary information is truncated" has a cheap code-level guard: the only
// way to make a `Text` cut its content with an ellipsis (or shrink it to fit) is `numberOfLines`,
// `ellipsizeMode` or `adjustsFontSizeToFit`. Every use must be on a short, fixed, non-informational
// text and be listed HERE with its reason; a new one fails this test until someone decides it.
// Truncation that a prop does not cause (a word split in the middle) is guarded by `fontScaleLimits`.
//
// Android: Lint has no equivalent; Compose's `maxLines`/`overflow = Ellipsis`. iOS: `lineLimit`.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const SRC = fileURLToPath(new URL('../', import.meta.url));
const TRUNCATING = /\b(numberOfLines|ellipsizeMode|adjustsFontSizeToFit)\b\s*[=:]/;

/** Source files (not tests) that may truncate, and why. */
const ALLOWED: Readonly<Record<string, string>> = {
  'features/navigation/components/TabBarLabel.tsx':
    'one-word tab labels, capped at `fontScaleLimits.tabLabel`; the accessible name carries the full text',
  'features/search/components/SearchField.tsx':
    'the drawn placeholder is a hint of an empty single-line field; the field has its own accessible label',
};

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'test' ? [] : sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('text truncation audit (RF-15)', () => {
  it('only the listed files cut a text with an ellipsis', () => {
    const found = sources(SRC)
      .filter((path) => readFileSync(path, 'utf8').split('\n').some((line) => !line.trimStart().startsWith('*') && TRUNCATING.test(line)))
      .map((path) => relative(SRC, path).split('\\').join('/'))
      .sort();

    assert.deepEqual(found, Object.keys(ALLOWED).sort());
  });

  it('flags a truncating prop (the audit is not blind)', () => {
    assert.ok(TRUNCATING.test('<Text numberOfLines={2}>x</Text>'));
    assert.ok(TRUNCATING.test('<Text ellipsizeMode="tail">x</Text>'));
    assert.ok(!TRUNCATING.test('// numberOfLines is not used'));
  });
});
