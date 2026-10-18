// Static audit of the app sources for the i18n tests (spec 006, T4b, RF-7). It reads TypeScript with
// the compiler API (already a dev dependency) and answers two questions without running the app:
//   1. Is there TEXT the user can see or hear that is written in the code instead of in the
//      resources (JSX text, text props, announcements, native-stack titles)?
//   2. Which resource keys does the code use (literal keys, templates, plural calls)?
//
// Pure Node: no React Native, so `npm run test:logic` runs the tests that use it. It is test
// infrastructure, not shipped code: nothing in the app imports it.
//
// Compose/Android: the closest tool is Android Lint's `HardcodedText` and `MissingTranslation`
// checks; Swift/Xcode: the "Export for localization" step that lists strings missing from the String Catalog.
import ts from 'typescript';

export type AuditedFile = Readonly<{ path: string; text: string }>;
export type Finding = Readonly<{ path: string; line: number; detail: string }>;

/** JSX props whose string value is read or heard by the user. `name`, `testID`, `variant`... are not. */
export const TEXT_PROPS: ReadonlySet<string> = new Set([
  'accessibilityLabel',
  'accessibilityHint',
  'aria-label',
  'alt',
  'label',
  'title',
  'placeholder',
  'fallbackText',
  'headerBackTitle',
  'subtitle',
  'message',
  'hint',
  'text',
  'description',
]);

/** Keys of options objects (native-stack, tabs, share sheet) whose string value is user-facing text. */
export const TEXT_OPTION_KEYS: ReadonlySet<string> = new Set([
  'title',
  'headerBackTitle',
  'tabBarLabel',
  'tabBarAccessibilityLabel',
  'dialogTitle',
  'accessibilityLabel',
  'accessibilityHint',
]);

/** Calls that put a string in front of the user (or the screen reader) right now. */
const SPEECH_CALLS = /(^|\.)(announceForAccessibility|announceForAccessibilityWithOptions|alert|show|share)$/;
const SPEECH_OWNERS = new Set(['AccessibilityInfo', 'Alert', 'ToastAndroid', 'Share']);

/** Fictional proper names that are the same in every language (spec 006 RF-7). */
export const PROPER_NAMES: readonly string[] = ['HerbStore', 'DeviceInsights', 'EAN-13'];

const LETTER = /\p{L}/u;

function sourceOf(file: AuditedFile): ts.SourceFile {
  const kind = file.path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, kind);
}

function lineOf(node: ts.Node, source: ts.SourceFile): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

/** A static string: `'x'` or a template without substitutions. */
function staticText(node: ts.Node | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

/** Words that need translating: letters left after removing the names that never change. */
export function hasTranslatableLetters(text: string): boolean {
  let rest = text;
  for (const name of PROPER_NAMES) rest = rest.split(name).join('');
  return LETTER.test(rest);
}

/**
 * Text written in the code that the user sees or hears. `isKnownKey(text)` says that a literal is a
 * resource key (the code passes keys around as plain strings, e.g. `title: 'home.states.emptyTitle'`),
 * which is exactly what must be written there.
 */
export function findUntranslatedLiterals(file: AuditedFile, isKnownKey: (text: string) => boolean): Finding[] {
  const source = sourceOf(file);
  const findings: Finding[] = [];
  const add = (node: ts.Node, detail: string) => findings.push({ path: file.path, line: lineOf(node, source), detail });
  const untranslated = (text: string) => hasTranslatableLetters(text) && !isKnownKey(text);

  function visit(node: ts.Node) {
    if (ts.isJsxText(node) && hasTranslatableLetters(node.text)) {
      add(node, `JSX text ${JSON.stringify(node.text.trim())}`);
    }

    if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent)) {
      const text = staticText(node.expression);
      if (text !== undefined && untranslated(text)) add(node, `JSX child ${JSON.stringify(text)}`);
    }

    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(source);
      const text = ts.isJsxExpression(node.initializer) ? staticText(node.initializer.expression) : staticText(node.initializer);
      if (TEXT_PROPS.has(name) && text !== undefined && untranslated(text)) {
        add(node, `prop ${name}=${JSON.stringify(text)}`);
      }
    }

    if (ts.isPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : undefined;
      const text = staticText(node.initializer);
      if (name !== undefined && TEXT_OPTION_KEYS.has(name) && text !== undefined && untranslated(text)) {
        add(node, `option ${name}: ${JSON.stringify(text)}`);
      }
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const owner = node.expression.expression.getText(source);
      const callee = `${owner}.${node.expression.name.text}`;
      if (SPEECH_OWNERS.has(owner) && SPEECH_CALLS.test(callee)) {
        for (const argument of node.arguments) {
          const direct = staticText(argument);
          if (direct !== undefined && untranslated(direct)) add(node, `${callee}(${JSON.stringify(direct)})`);
          if (ts.isObjectLiteralExpression(argument)) {
            for (const property of argument.properties) {
              const value = ts.isPropertyAssignment(property) ? staticText(property.initializer) : undefined;
              if (value !== undefined && untranslated(value)) add(node, `${callee}({ ... ${JSON.stringify(value)} })`);
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }
  visit(source);
  return findings;
}

export type KeyUsage = Readonly<{
  /** Every string literal that looks like a resource key (first segment is a resource namespace). */
  keys: readonly Readonly<{ key: string; line: number }>[];
  /** Template literals that build a key at runtime (`checkout.fields.${name}`): the static head. */
  templates: readonly Readonly<{ head: string; line: number }>[];
  /** Calls `t(key, { count })`: the keys that must have plural forms (`undefined` = key not literal). */
  countedCalls: readonly Readonly<{ key: string | undefined; line: number }>[];
}>;

function isTranslateCall(node: ts.CallExpression): boolean {
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return callee.text === 't';
  return ts.isPropertyAccessExpression(callee) && callee.name.text === 't';
}

function literalBranches(node: ts.Expression | undefined): (string | undefined)[] {
  if (!node) return [];
  if (ts.isConditionalExpression(node)) return [...literalBranches(node.whenTrue), ...literalBranches(node.whenFalse)];
  if (ts.isParenthesizedExpression(node)) return literalBranches(node.expression);
  return [staticText(node)];
}

export function collectKeyUsage(file: AuditedFile, namespaces: ReadonlySet<string>): KeyUsage {
  const source = sourceOf(file);
  const keys: { key: string; line: number }[] = [];
  const templates: { head: string; line: number }[] = [];
  const countedCalls: { key: string | undefined; line: number }[] = [];
  const looksLikeKey = (text: string) => /^[A-Za-z]+(\.[A-Za-z0-9_-]+)+$/.test(text) && namespaces.has(text.split('.')[0] ?? '');
  const startsLikeKey = (head: string) => /^[A-Za-z]+\./.test(head) && namespaces.has(head.split('.')[0] ?? '');

  function visit(node: ts.Node) {
    const text = staticText(node);
    if (text !== undefined && looksLikeKey(text)) keys.push({ key: text, line: lineOf(node, source) });

    if (ts.isTemplateExpression(node) && startsLikeKey(node.head.text)) {
      templates.push({ head: node.head.text, line: lineOf(node, source) });
    }

    if (ts.isCallExpression(node) && isTranslateCall(node)) {
      const options = node.arguments[1];
      if (options && ts.isObjectLiteralExpression(options)) {
        const hasCount = options.properties.some(
          (property) =>
            (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) && property.name.getText(source) === 'count',
        );
        if (hasCount) {
          const branches = literalBranches(node.arguments[0]);
          for (const key of branches.length > 0 ? branches : [undefined]) {
            countedCalls.push({ key, line: lineOf(node, source) });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }
  visit(source);
  return { keys, templates, countedCalls };
}
