/// <reference types="node" />
// H-4 (spec 006, T8): the release bundle must not carry development-only code. A fixture module that
// is imported with a plain `import` ends up in the release bundle even when a flag makes it inert
// at run time (Metro bundles what is IMPORTED, it does not reason about values). The one pattern
// that keeps a module out is a `require` inside a `__DEV__` branch: Metro replaces `__DEV__` with
// `false`, folds the branch away and never collects the dependency.
//
// This audit reads the app sources (no tests, no helpers) and fails if a development-only module is
// reached any other way. The real proof is still the exported bundle (`npx expo export --no-minify`
// and searching it); this test keeps the property from regressing between exports.
//
// Android: the same idea as `BuildConfig.DEBUG` + R8, or a `debug` source set that the `release`
// variant never compiles. iOS: `#if DEBUG` blocks, which the release build does not even parse.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import ts from 'typescript';

const SRC = fileURLToPath(new URL('../', import.meta.url));

/** Modules written for development scenarios only. Add here any new one. */
const DEV_ONLY_MODULES: readonly string[] = ['home-fixture-env', 'home-fixtures'];

/** Modules allowed to reference a dev-only module with a static import: the dev-only ones themselves. */
const DEV_ONLY_FILES: ReadonlySet<string> = new Set(
  DEV_ONLY_MODULES.map((name) => `features/home/data/${name}.ts`),
);

type Reference = Readonly<{ path: string; line: number; kind: 'import' | 'require'; guarded: boolean }>;

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

const isDevOnly = (specifier: string) => DEV_ONLY_MODULES.some((name) => specifier.endsWith(`/${name}`) || specifier.endsWith(`/${name}.ts`));

/** True when `node` sits in the branch of a conditional that only runs while `__DEV__` is true. */
function isInsideDevBranch(node: ts.Node): boolean {
  for (let child: ts.Node = node, parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (ts.isConditionalExpression(parent) && parent.whenTrue === child) {
      if (ts.isIdentifier(parent.condition) && parent.condition.text === '__DEV__') return true;
    }
    if (ts.isIfStatement(parent) && parent.thenStatement === child) {
      if (ts.isIdentifier(parent.expression) && parent.expression.text === '__DEV__') return true;
    }
  }
  return false;
}

/** Every import or `require` of a dev-only module found in `text`. Exported shape lets the cases below feed it. */
function findDevOnlyReferences(path: string, text: string): Reference[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: Reference[] = [];
  const lineOf = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && isDevOnly(node.moduleSpecifier.text)) {
      // `import type` is erased by the compiler, it never reaches the bundle.
      if (!node.importClause?.isTypeOnly) {
        found.push({ path, line: lineOf(node), kind: 'import', guarded: false });
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0]!) &&
      isDevOnly(node.arguments[0].text)
    ) {
      found.push({ path, line: lineOf(node), kind: 'require', guarded: isInsideDevBranch(node) });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('findDevOnlyReferences (the audit must see what it is meant to forbid)', () => {
  it('flags a plain import of a dev-only module', () => {
    const found = findDevOnlyReferences('a.ts', "import { applyHomeFixture } from './home-fixtures.ts';");
    assert.deepEqual(found.map(({ kind, guarded }) => [kind, guarded]), [['import', false]]);
  });

  it('accepts a type-only import, which the compiler erases', () => {
    assert.deepEqual(findDevOnlyReferences('a.ts', "import type { HomeFixture } from './home-fixtures.ts';"), []);
  });

  it('flags a require that is not under __DEV__', () => {
    const found = findDevOnlyReferences('a.ts', "const env = require('./home-fixture-env');");
    assert.deepEqual(found.map(({ guarded }) => guarded), [false]);
  });

  it('flags a require under __DEV__ only in the wrong branch', () => {
    const found = findDevOnlyReferences('a.ts', "const env = __DEV__ ? undefined : require('./home-fixture-env');");
    assert.deepEqual(found.map(({ guarded }) => guarded), [false]);
  });

  it('accepts a require in the __DEV__ branch of a conditional expression or an if', () => {
    const conditional = findDevOnlyReferences('a.ts', "const env = __DEV__ ? require('./home-fixture-env') : undefined;");
    const statement = findDevOnlyReferences('a.ts', "let env; if (__DEV__) { env = require('./home-fixtures'); }");
    assert.deepEqual(conditional.map(({ guarded }) => guarded), [true]);
    assert.deepEqual(statement.map(({ guarded }) => guarded), [true]);
  });

  it('ignores a different condition that merely mentions __DEV__', () => {
    const found = findDevOnlyReferences('a.ts', "const env = !__DEV__ ? require('./home-fixture-env') : undefined;");
    assert.deepEqual(found.map(({ guarded }) => guarded), [false]);
  });
});

describe('the release bundle (H-4)', () => {
  const references = appSources().flatMap(({ path, text }) => findDevOnlyReferences(path, text));
  const outsideDevModules = references.filter(({ path }) => !DEV_ONLY_FILES.has(path));

  it('reaches a development-only module only through a `require` under __DEV__', () => {
    const offenders = outsideDevModules
      .filter(({ kind, guarded }) => kind !== 'require' || !guarded)
      .map(({ path, line, kind }) => `${path}:${line} (${kind} outside a __DEV__ branch)`);

    assert.deepEqual(offenders, []);
  });

  it('still reaches them from somewhere (otherwise this audit would check nothing)', () => {
    assert.equal(outsideDevModules.length > 0, true);
  });
});
