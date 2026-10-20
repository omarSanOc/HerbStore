/// <reference types="node" />
// Spec 007 (RF-5, RF-17, RF-49): the persistent API replaced the local backend, and doubles and
// fixtures exist ONLY for tests. Product sources must not import `mock-server`, `src/test` or any
// `*testing*` module, and no runtime activator (an env value that swaps data while the app runs) may
// survive in product code. The dev-only fixture modules (`home-fixture-env`, `home-fixtures`) and the
// `__DEV__` audit that guarded them were deleted in T8: there is nothing left to reach through a
// `require` under `__DEV__`, so that audit retired with them and the activator scan below now covers
// EVERY product source with no allowlist.
//
// Android/Kotlin: the same rule as a konsist/Gradle check that fails when `main/` imports `test/` or
// `androidTest/`. iOS/Swift: a build-phase script that fails when `Sources/` imports `Mocking/` or
// reads a `*FIXTURE*` variable from the environment.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import ts from 'typescript';

const SRC = fileURLToPath(new URL('../', import.meta.url));

/** App sources only: no `test`/`testing` trees and no `*.test.tsx?` files are scanned as product. */
function appSources(directory = SRC): { path: string; text: string }[] {
  const files: { path: string; text: string }[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (['test', 'testing'].includes(entry.name)) continue;
      files.push(...appSources(path));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      files.push({ path: relative(SRC, path), text: readFileSync(path, 'utf8') });
    }
  }
  return files;
}

/** An env value that swaps data at run time: a fixture switch or the backend's delay knob. */
const RUNTIME_ACTIVATOR = /EXPO_PUBLIC_\w*FIXTURE\w*|ORDER_POST_DELAY_MS/;

/** A specifier that leaves product code for the backend or for test-only trees. */
function isNonProductiveSpecifier(specifier: string): boolean {
  return specifier
    .split('/')
    .some((segment) => segment === 'mock-server' || segment === 'test' || segment.includes('testing'));
}

/** Every backend/test import and runtime activator found in `text`. Exported shape feeds the cases. */
function findNonProductiveReferences(path: string, text: string): string[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: string[] = [];
  const lineOf = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const flag = (node: ts.Node, specifier: string, kind: string) => {
    if (isNonProductiveSpecifier(specifier)) found.push(`${path}:${lineOf(node)} (${kind} '${specifier}')`);
  };

  const visit = (node: ts.Node) => {
    // `import type` is erased, but product code depending on test types is still a coupling.
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      flag(node, node.moduleSpecifier.text, 'import');
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteralLike(node.arguments[0]!)
    ) {
      flag(node, node.arguments[0].text, 'dynamic import');
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0]!)
    ) {
      flag(node, node.arguments[0].text, 'require');
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  // No allowlist (T8): every product source is scanned for a runtime activator.
  text.split('\n').forEach((line, index) => {
    const activator = RUNTIME_ACTIVATOR.exec(line);
    if (activator !== null) found.push(`${path}:${index + 1} (runtime activator '${activator[0]}')`);
  });
  return found;
}

describe('findNonProductiveReferences (the audit must see what it is meant to forbid)', () => {
  it('flags an import of the backend', () => {
    assert.deepEqual(
      findNonProductiveReferences('a.ts', "import { generateCatalog } from '../mock-server/src/catalog/generate-catalog.js';"),
      ["a.ts:1 (import '../mock-server/src/catalog/generate-catalog.js')"],
    );
  });

  it('flags imports of src/test and of any *testing* module, even type-only', () => {
    assert.equal(findNonProductiveReferences('a.ts', "import { wireProduct } from '../../test/fixtures.ts';").length, 1);
    assert.equal(findNonProductiveReferences('a.ts', "import type { HomeData } from '../testing/home-test-data.ts';").length, 1);
  });

  it('flags a dynamic import and a require of test sources', () => {
    assert.deepEqual(findNonProductiveReferences('a.ts', "const data = await import('../../test/fixtures.ts');"), [
      "a.ts:1 (dynamic import '../../test/fixtures.ts')",
    ]);
    assert.deepEqual(findNonProductiveReferences('a.ts', "const data = require('../testing/home-test-data.ts');"), [
      "a.ts:1 (require '../testing/home-test-data.ts')",
    ]);
  });

  it('flags a runtime fixture activator or the backend delay knob in ANY product source', () => {
    assert.deepEqual(findNonProductiveReferences('a.ts', 'const raw = process.env.EXPO_PUBLIC_HOME_FIXTURE;'), [
      "a.ts:1 (runtime activator 'EXPO_PUBLIC_HOME_FIXTURE')",
    ]);
    assert.deepEqual(findNonProductiveReferences('a.ts', 'const ms = Number(process.env.ORDER_POST_DELAY_MS);'), [
      "a.ts:1 (runtime activator 'ORDER_POST_DELAY_MS')",
    ]);
  });

  it('accepts ordinary product imports and a clean source', () => {
    const clean =
      "import { parseHomePayload } from '../contracts/parse-home.ts';\n" +
      "import type { SupportedLanguage } from '@/core/i18n/languages';";
    assert.deepEqual(findNonProductiveReferences('a.ts', clean), []);
  });
});

describe('product sources are free of the backend, test code and runtime activators (RF-5, RF-49)', () => {
  const offenders = appSources().flatMap(({ path, text }) => findNonProductiveReferences(path, text));

  it('imports no backend, test or testing module and keeps no runtime activator', () => {
    assert.deepEqual(offenders, []);
  });

  it('the scan covers the real product sources (it would be vacuous otherwise)', () => {
    assert.equal(appSources().length > 0, true);
  });
});
