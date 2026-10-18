import assert from 'node:assert/strict';
import test from 'node:test';

import { collectKeyUsage, findUntranslatedLiterals, hasTranslatableLetters } from './source-audit.ts';

// The audit of the real sources (`i18n-audit.test.ts`) is only worth something if the scanner really
// sees a hard-coded text. These cases feed it small sources that MUST fail and sources that MUST pass.

const NAMESPACES = new Set(['checkout', 'home', 'scanner']);
const KNOWN = new Set(['home.states.emptyTitle', 'checkout.status.wait']);
const isKnownKey = (text: string) => KNOWN.has(text);
const scan = (text: string, path = 'Screen.tsx') => findUntranslatedLiterals({ path, text }, isKnownKey);
const details = (text: string) => scan(text).map((finding) => finding.detail);

test('flags text written between JSX tags', () => {
  assert.deepEqual(details('export const A = () => <Text>Hello there</Text>;'), ['JSX text "Hello there"']);
  assert.deepEqual(details('export const A = () => <Text>{"Hola"}</Text>;'), ['JSX child "Hola"']);
});

test('flags a hard-coded accessible or visible text prop', () => {
  assert.deepEqual(details('const a = <AppButton label="Retry" accessibilityHint="Tries again" />;'), [
    'prop label="Retry"',
    'prop accessibilityHint="Tries again"',
  ]);
  assert.deepEqual(details("const a = <Pressable accessibilityLabel={'Close'} />;"), ['prop accessibilityLabel="Close"']);
  assert.deepEqual(details('const a = <TextInput placeholder="Search" />;'), ['prop placeholder="Search"']);
});

test('flags a hard-coded announcement, alert or share message', () => {
  assert.deepEqual(details("AccessibilityInfo.announceForAccessibility('Item removed');"), [
    'AccessibilityInfo.announceForAccessibility("Item removed")',
  ]);
  assert.deepEqual(details("Alert.alert('Oops', 'Something broke');"), ['Alert.alert("Oops")', 'Alert.alert("Something broke")']);
  assert.deepEqual(details("Share.share({ message: 'Look at this' });"), ['Share.share({ ... "Look at this" })']);
});

test('flags a hard-coded title in navigator options', () => {
  assert.deepEqual(details("const o = { title: 'Orders', headerBackTitle: 'Back' };"), ['option title: "Orders"', 'option headerBackTitle: "Back"']);
  assert.deepEqual(details("<Stack.Screen name=\"x\" options={{ title: 'Orders' }} />"), ['option title: "Orders"']);
});

test('accepts text that comes from the resources', () => {
  const source = `
    const a = <AppButton label={t('checkout.submit')} accessibilityHint={t('checkout.submitHint')} />;
    AccessibilityInfo.announceForAccessibility(t('home.x'));
    const b = <Text>{t('home.y')}</Text>;
    const o = { title: t('home.title') };
  `;
  assert.deepEqual(details(source), []);
});

test('accepts a resource key kept as a plain string, but not a sentence', () => {
  assert.deepEqual(details("const copy = { title: 'home.states.emptyTitle' };"), []);
  assert.deepEqual(details("const copy = { title: 'Nothing here' };"), ['option title: "Nothing here"']);
});

test('accepts symbols, numbers, route and enum props, and the names that never change', () => {
  const source = `
    const a = <AppButton label="−" />;
    const b = <Stack.Screen name="product/[id]" />;
    const c = <AppText variant="subheading" tone="muted" accessibilityRole="header">{'1'}</AppText>;
    const d = <Text>HerbStore</Text>;
    const e = { title: 'HerbStore' };
    const f = <AppButton label="★" />;
  `;
  assert.deepEqual(details(source), []);
  assert.equal(hasTranslatableLetters('HerbStore'), false);
  assert.equal(hasTranslatableLetters('HerbStore Plus'), true);
});

test('reports the line of each finding', () => {
  const findings = scan('const a = 1;\nconst b = <Text>Hola</Text>;\n');
  assert.equal(findings[0]?.line, 2);
  assert.equal(findings[0]?.path, 'Screen.tsx');
});

// ---- key usage -----------------------------------------------------------------------------

const usage = (text: string) => collectKeyUsage({ path: 'x.tsx', text }, NAMESPACES);

test('collects literal keys wherever they are written, not only inside t()', () => {
  const found = usage(`
    const a = t('checkout.submit');
    const copy = { title: 'home.states.emptyTitle', other: 'scanner.temporaryError' };
    const route = '/(tabs)/(cart)/cart';
    const id = 'product-261009-001';
    const version = '1.0.0';
  `);
  assert.deepEqual(found.keys.map(({ key }) => key), ['checkout.submit', 'home.states.emptyTitle', 'scanner.temporaryError']);
});

test('detects keys built at runtime', () => {
  const found = usage('const a = t(`scanner.${state.kind}`); const b = t(`unrelated.${x}`);');
  assert.deepEqual(found.templates.map(({ head }) => head), ['scanner.']);
});

test('finds the calls that pass a count, with the key when it is literal or a conditional of literals', () => {
  const found = usage(`
    t('checkout.validationSummary', { count: errors.length });
    t('home.items', { count });
    t(ok ? 'home.a' : 'home.b', { count: 2 });
    t(key, { count: 1 });
    t('home.plain', { name });
    i18n.t('home.viaInstance', { count: 3 });
  `);
  assert.deepEqual(found.countedCalls.map(({ key }) => key), [
    'checkout.validationSummary',
    'home.items',
    'home.a',
    'home.b',
    undefined,
    'home.viaInstance',
  ]);
});
