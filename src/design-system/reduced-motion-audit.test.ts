/// <reference types="node" />
// RF-15 (spec 006, T6c). "Reduced motion keeps a static result for animated actions" has a code-level
// guard, like the truncation audit: every way the app can MOVE something is listed here with what it does
// with the preference, and a new one fails this test until someone decides. The behavior of each is in
// its own test (`AddToCartFeedback`, `BannerCarousel`, `ProductGallery`, `RemoteImage`,
// `AppBottomSheet.reduced-motion`, `CartRestoring`, `ProductDetailScreen.reduced-motion`, `QuickFilters`).
//
// Android: lint has no equivalent; iOS: no equivalent. Compose: `LocalReduceMotion`-style checks.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../', import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'test' ? [] : sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** Source lines with their file, comments dropped. */
const lines = sources(SRC).flatMap((path) =>
  readFileSync(path, 'utf8')
    .split('\n')
    .map((text, index) => ({ file: relative(SRC, path).split('\\').join('/'), line: index + 1, text }))
    .filter(({ text }) => !/^\s*(\*|\/\/|\/\*|\{\/\*)/.test(text)),
);

const REDUCED = /educe\w*Motion|educedMotion/;
const rel = (found: readonly { file: string; line: number }[]) => found.map(({ file, line }) => `${file}:${line}`);

describe('reduced motion audit (RF-15)', () => {
  it('only the listed files use an animation library, and each says what reduced motion does', () => {
    const ALLOWED: Readonly<Record<string, string>> = {
      'features/product/components/AddToCartFeedback.tsx':
        'Reanimated shared values; with reduced motion opacity 1, translate 0, scale 1 from the first frame (AddToCartFeedback.test.tsx)',
      'features/cart/components/SwipeToDelete.tsx':
        'ReanimatedSwipeable follows the finger (direct manipulation); Reanimated\'s springs use ReduceMotion.System, and the visible delete button of each cart line is the motionless alternative',
      'design-system/components/AppBottomSheet.tsx':
        'overrideReduceMotion = ReduceMotion.Always with the preference (AppBottomSheet.reduced-motion.test.tsx)',
    };
    const ANIMATION = /from 'react-native-reanimated'|from 'react-native-gesture-handler\/ReanimatedSwipeable'|\b(withTiming|withSpring|withRepeat|withDelay|withSequence|LayoutAnimation)\b|\bAnimated\.(timing|spring|loop|Value)\b/;

    const found = [...new Set(lines.filter(({ text }) => ANIMATION.test(text)).map(({ file }) => file))].sort();
    assert.deepEqual(found, Object.keys(ALLOWED).sort());
  });

  it('every programmatic scroll is animated only without the preference', () => {
    const animated = lines.filter(({ text }) => /\banimated:\s*(?:(?!false\b)\S)/.test(text));

    assert.deepEqual(rel(animated.filter(({ text }) => !REDUCED.test(text))), []);
    assert.ok(animated.length >= 5, 'the audit must see the scrolls it guards');
  });

  it('every pressed-state fade is skipped with the preference', () => {
    const pressed = lines.filter(({ text }) => /styles\.pressed/.test(text));

    assert.deepEqual(rel(pressed.filter(({ text }) => !REDUCED.test(text))), []);
    assert.ok(pressed.length >= 12);
  });

  it('every spinner file reads the preference (and draws no spinner with it)', () => {
    const files = [...new Set(lines.filter(({ text }) => /<ActivityIndicator\b/.test(text)).map(({ file }) => file))];
    const withPreference = files.filter((file) => lines.some((l) => l.file === file && REDUCED.test(l.text)));

    assert.deepEqual(files.filter((file) => !withPreference.includes(file)), []);
    assert.ok(files.length >= 3);
  });

  it('every image transition is zero with the preference', () => {
    const transitions = lines.filter(({ text }) => /\btransition=/.test(text));

    assert.deepEqual(rel(transitions.filter(({ text }) => !REDUCED.test(text))), []);
    assert.ok(transitions.length >= 1);
  });

  it('flags what it should (the audit is not blind)', () => {
    assert.ok(/\banimated:\s*(?:(?!false\b)\S)/.test('scrollTo({ y: 0, animated: true })'));
    assert.ok(!/\banimated:\s*(?:(?!false\b)\S)/.test('scrollTo({ y: 0, animated: false })'));
    assert.ok(/styles\.pressed/.test('pressed ? styles.pressed : null'));
  });
});
