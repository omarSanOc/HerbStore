/// <reference types="node" />
// RF-7 (spec 006, T4b). "Every visible or accessible text exists in Spanish and English" has to be
// checked on the CODE, not only on the resource files: the parity test proves es and en have the
// same keys, but it cannot see a key the code asks for and nobody wrote (it would render as the raw
// key, as `scanner.temporary-error` did), a sentence typed straight into a prop, or a key nobody
// uses any more. This audit reads every source file of the app and fails on any of them.
//
// A hole must fail the test: `source-audit.test.ts` feeds the scanner sources that MUST be flagged.
//
// Android: Lint `MissingTranslation`/`ExtraTranslation`/`HardcodedText`/`UnusedResources` together.
// iOS: the String Catalog "Stale" and "Needs review" states plus a build warning for a literal in `Text`.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { ADDRESS_FIELD_NAMES } from '../../../features/checkout/logic/field-errors.ts';
import { collectKeyUsage, findUntranslatedLiterals, type AuditedFile } from '../../../test/source-audit.ts';
import { en } from './en.ts';
import { es } from './es.ts';

const SRC = fileURLToPath(new URL('../../../', import.meta.url));

/** Leaf keys of a resource tree, without the `translation` namespace of i18next. */
function leafKeys(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix];
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    leafKeys(value, prefix === '' ? key : `${prefix}.${key}`),
  );
}

const spanishKeys = new Set(leafKeys(es.translation));
const englishKeys = new Set(leafKeys(en.translation));
const namespaces = new Set(Object.keys(es.translation));
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** `a.b.c` exists as a key, or as the base of `a.b.c_one` / `a.b.c_other`. */
function resolves(key: string, keys: ReadonlySet<string>): boolean {
  return keys.has(key) || keys.has(`${key}_one`) || keys.has(`${key}_other`);
}
const isPlural = (key: string, keys: ReadonlySet<string>) => keys.has(`${key}_one`) && keys.has(`${key}_other`);
const resolvesEverywhere = (key: string) => resolves(key, spanishKeys) && resolves(key, englishKeys);

/** Source files the app ships: no tests, no test helpers, no fixtures, no resource files. */
function appSources(directory = SRC): AuditedFile[] {
  const files: AuditedFile[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (['test', 'testing', 'resources'].includes(entry.name)) continue;
      files.push(...appSources(path));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      files.push({ path: relative(SRC, path), text: readFileSync(path, 'utf8') });
    }
  }
  return files;
}

/**
 * Keys the code builds at runtime. Each one is declared here with EVERY value it can take, so the
 * audit can check them in both languages and count them as used. A template whose head is not in
 * this list fails the audit: that is how `scanner.${state.kind}` hid `temporary-error`.
 */
const DYNAMIC_GROUPS: Readonly<Record<string, readonly string[]>> = {
  // `AddressForm` builds label, hint and placeholder from the field name.
  'checkout.fields.': ADDRESS_FIELD_NAMES,
  'checkout.hints.': ADDRESS_FIELD_NAMES,
  'checkout.placeholders.': ADDRESS_FIELD_NAMES,
  // `ProductCard`: the badges of the catalog contract.
  'productCard.badge.': ['offer', 'new', 'best_seller'],
};

/**
 * Keys that the code reads straight from the resource object instead of through `t()`: the local
 * order notification is composed outside React, where there is no i18n hook
 * (`notification-payload.ts` + its test compare it with the resources).
 */
const READ_FROM_RESOURCES: readonly string[] = ['notifications.'];

/** `t(key, { count })` where the number has no noun to agree with ("Taps: 3", "Filters (2)"). */
const COUNT_WITHOUT_NOUN: readonly string[] = ['foundations.hooks.tapCount', 'productList.advanced.buttonCount'];

/** Strings that look like a key but are something else: SF Symbol names of the tab bar. */
const NOT_KEYS: readonly string[] = ['cart.fill'];

const sources = appSources();
const usage = sources.map((file) => {
  const found = collectKeyUsage(file, namespaces);
  return { file, ...found, keys: found.keys.filter(({ key }) => !NOT_KEYS.includes(key)) };
});

describe('i18n audit of the sources', () => {
  it('reads the whole app (guard against an audit that scans nothing)', () => {
    assert.ok(sources.length > 100, `only ${sources.length} files read`);
    assert.ok(sources.some((file) => file.path.endsWith('ScannerScreen.tsx')));
    assert.ok(sources.every((file) => !/\.test\./.test(file.path)));
  });

  it('every resource key the code names exists in Spanish AND English', () => {
    const missing = usage.flatMap(({ file, keys }) =>
      keys.filter(({ key }) => !resolvesEverywhere(key)).map(({ key, line }) => `${file.path}:${line} ${key}`),
    );
    assert.deepEqual(missing, [], 'a key written in the code has no text in es and/or en');
  });

  it('no key is built at runtime unless it is declared with all its values', () => {
    const undeclared = usage.flatMap(({ file, templates }) =>
      templates
        .filter(({ head }) => !Object.keys(DYNAMIC_GROUPS).includes(head))
        .map(({ head, line }) => `${file.path}:${line} \`${head}\${...}\``),
    );
    assert.deepEqual(undeclared, [], 'declare the group in DYNAMIC_GROUPS, or use a typed map of literal keys');
  });

  it('every declared dynamic key exists in both languages', () => {
    const missing = Object.entries(DYNAMIC_GROUPS).flatMap(([prefix, values]) =>
      values.map((value) => `${prefix}${value}`).filter((key) => !resolvesEverywhere(key)),
    );
    assert.deepEqual(missing, []);
  });

  it('every declared dynamic group is still used by the code', () => {
    const used = new Set(usage.flatMap(({ templates }) => templates.map(({ head }) => head)));
    assert.deepEqual(Object.keys(DYNAMIC_GROUPS).filter((prefix) => !used.has(prefix)), []);
  });

  it('a call with { count } targets a key with plural forms in both languages ("1 errores")', () => {
    const bad = usage.flatMap(({ file, countedCalls }) =>
      countedCalls
        .filter(({ key }) => key === undefined || (!COUNT_WITHOUT_NOUN.includes(key) && !(isPlural(key, spanishKeys) && isPlural(key, englishKeys))))
        .map(({ key, line }) => `${file.path}:${line} ${key ?? '(key not literal)'}`),
    );
    assert.deepEqual(bad, []);
  });

  it('no resource key is left without use (retire it, or use it)', () => {
    const used = new Set<string>();
    for (const { keys } of usage) for (const { key } of keys) used.add(key);
    for (const [prefix, values] of Object.entries(DYNAMIC_GROUPS)) for (const value of values) used.add(`${prefix}${value}`);

    const unused = [...spanishKeys].filter(
      (key) =>
        !used.has(key) &&
        !used.has(key.replace(PLURAL_SUFFIX, '')) &&
        !READ_FROM_RESOURCES.some((prefix) => key.startsWith(prefix)),
    );
    assert.deepEqual(unused, []);
  });

  it('no visible or accessible text is written in the code instead of the resources', () => {
    const isKnownKey = (text: string) => /^[A-Za-z]+(\.[A-Za-z0-9_-]+)+$/.test(text) && resolvesEverywhere(text);
    const hardCoded = sources.flatMap((file) =>
      findUntranslatedLiterals(file, isKnownKey).map(({ path, line, detail }) => `${path}:${line} ${detail}`),
    );
    assert.deepEqual(hardCoded, []);
  });
});

describe('the resources hold no copy of the catalog (the API owns it)', () => {
  // Spec 007, T3: banner titles, section titles and category/subcategory names arrive localized
  // from the API. These groups used to translate them by id, which let a screen disagree with the
  // server; they were removed, and this guard keeps them from coming back in either language.
  const RETIRED_CATALOG_PREFIXES: readonly string[] = [
    'home.banners.items.',
    'home.sections.',
    'home.categories.',
    'subcategories.',
  ];

  it('has no key of the retired catalog copy in es or en', () => {
    for (const language of [
      { name: 'es', keys: spanishKeys },
      { name: 'en', keys: englishKeys },
    ]) {
      for (const prefix of RETIRED_CATALOG_PREFIXES) {
        const found = [...language.keys].filter((key) => key.startsWith(prefix));
        assert.deepEqual(
          found,
          [],
          `${language.name}: ${prefix}* is back in the resources; that copy belongs to the API`,
        );
      }
    }
  });
});
