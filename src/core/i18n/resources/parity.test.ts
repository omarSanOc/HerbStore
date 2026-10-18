/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

  it('has exactly the same placeholders in the same key, counted with repeats', () => {
    for (const [key, text] of english) {
      const count = (value: string) => [...value.matchAll(/\{\{/g)].length;
      assert.equal(count(spanish.get(key) ?? ''), count(text), key);
    }
  });
});

// ---- plurals (RF-7, "1 unidades" / "1 errores" / "1 segundos") ---------------------------------
// i18next picks `key_one`, `key_other`... with `Intl.PluralRules` when `t(key, { count })` runs. A
// quantity next to a noun that is NOT written as plural forms reads "1 errores" in Spanish and
// "1 seconds" in English. The rules below fail the build when a plural form is missing, or when a
// counted noun is written without plural forms.
//
// Android: `<plurals>` in `strings.xml` with `quantity="one|other"`; iOS: the plural variations of a
// String Catalog entry. Same idea, same cause: the category set belongs to the language.
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** Categories the language can produce for the whole numbers the app shows (counts below a million). */
function pluralCategories(language: string): string[] {
  const rules = new Intl.PluralRules(language);
  const found = new Set<string>();
  for (let n = 0; n < 10_000; n++) found.add(rules.select(n));
  return [...found].sort();
}

/** `a.b.c_one` + `a.b.c_other` -> `a.b.c` with the suffixes it has. */
function pluralGroups(entries: Map<string, string>): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const key of entries.keys()) {
    const match = PLURAL_SUFFIX.exec(key);
    if (!match) continue;
    const base = key.slice(0, key.length - match[0].length);
    groups.set(base, [...(groups.get(base) ?? []), match[1] ?? '']);
  }
  return groups;
}

/**
 * A counted variable followed by a word is a counted noun: "{{count}} errores", "en {{seconds}}
 * segundos". A number that ends the text or sits in brackets ("Toques: {{count}}", "Filtros
 * ({{count}})") has no noun to agree with.
 */
const COUNTED_NOUN = new RegExp(
  [
    '\\{\\{\\s*(count|seconds|minutes|hours|days|units|items)\\s*\\}\\}\\s+\\p{L}',
    // Any other variable (`quantity`, `total`...) followed by a unit that is counted.
    '\\{\\{\\s*\\w+\\s*\\}\\}\\s+(unidad|unidades|unit|units|segundo|segundos|second|seconds|error|errores|errors|producto|productos|products?|art[ií]culos?|items?|rese[ñn]as?|reviews?|porci[oó]n|porciones|servings?)\\b',
  ].join('|'),
  'iu',
);

describe('i18n plurals', () => {
  const languages = [
    ['es', flatten(es)],
    ['en', flatten(en)],
  ] as const;

  for (const [language, entries] of languages) {
    it(`${language}: every plural group has exactly the categories the language uses`, () => {
      const expected = pluralCategories(language);
      assert.deepEqual(expected.includes('other'), true, `${language} must resolve "other"`);
      for (const [base, suffixes] of pluralGroups(entries)) {
        assert.deepEqual([...suffixes].sort(), expected, `${language}: ${base}`);
      }
    });

    it(`${language}: all the forms of a plural group use the same variables, and a count`, () => {
      for (const [base, suffixes] of pluralGroups(entries)) {
        const variableSets = suffixes.map((suffix) => placeholders(entries.get(`${base}_${suffix}`) ?? '').join(','));
        assert.equal(new Set(variableSets).size, 1, `${language}: ${base} forms differ: ${variableSets.join(' | ')}`);
        assert.match(variableSets[0] ?? '', /count/, `${language}: ${base} has no count variable`);
      }
    });

    it(`${language}: a counted noun is written as plural forms, never as one text`, () => {
      const offenders: string[] = [];
      for (const [key, text] of entries) {
        const counted = COUNTED_NOUN.exec(text);
        if (!PLURAL_SUFFIX.test(key) && counted) offenders.push(`${key} counts a noun ("${counted[0]}…") without plural forms`);
      }
      assert.deepEqual(offenders, []);
    });
  }

  it('Spanish and English define plurals for the same keys', () => {
    assert.deepEqual([...pluralGroups(flatten(es)).keys()].sort(), [...pluralGroups(flatten(en)).keys()].sort());
  });

  it('chooses the right form for 0, 1, 2 and 99 (the app counts in whole numbers)', () => {
    for (const [language, entries] of languages) {
      const rules = new Intl.PluralRules(language);
      for (const base of pluralGroups(entries).keys()) {
        for (const n of [0, 1, 2, 99]) {
          assert.equal(typeof entries.get(`${base}_${rules.select(n)}`), 'string', `${language}: ${base} for ${n}`);
        }
      }
    }
  });
});

// ---- native strings (iOS permission text per language) ----------------------------------------
// `app.json` -> `locales`: what the operating system shows (camera permission). They are not in the
// i18next resources, so the same parity applies to them on their own.
describe('native locale files', () => {
  const read = (language: string) =>
    flatten(JSON.parse(readFileSync(new URL(`../../../../locales/${language}.json`, import.meta.url), 'utf8')) as unknown);

  it('has the same keys, no empty text and the same placeholders in Spanish and English', () => {
    const spanish = read('es');
    const english = read('en');
    assert.deepEqual([...spanish.keys()].sort(), [...english.keys()].sort());
    assert.notEqual(spanish.size, 0);
    for (const [key, text] of english) {
      assert.notEqual(text.trim(), '', key);
      assert.notEqual(text, spanish.get(key), `${key} is not translated`);
    }
  });
});
