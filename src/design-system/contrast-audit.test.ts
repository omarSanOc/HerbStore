/// <reference types="node" />
// RF-13 (spec 006, T6c). WCAG AA on BOTH palettes: every foreground/background pair the app draws
// (`contrast-pairs.ts`, written against palette tokens) is measured with `contrastRatio` and must reach
// its minimum (4.5:1 normal text, 3:1 large text and interface components). The ratios are printed so
// that `docs/evidence/day-6-accessibility.md` can copy them. A change in `palettes.ts` re-runs it all.
//
// Two source scans keep the table honest: no color literal outside the palettes (that is how the
// checkout error red `#B42318` escaped the dark theme), and every palette token a component reads is
// covered by at least one row.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { CONTRAST_MINIMUM, contrastRatio } from './contrast.ts';
import {
  contrastPairs,
  describeColor,
  resolveColor,
  textSizes,
  type ContrastPair,
} from './contrast-pairs.ts';
import { palettes, type PaletteScheme, type PaletteToken } from './palettes.ts';

const SRC = fileURLToPath(new URL('../', import.meta.url));
const schemes = Object.keys(palettes) as PaletteScheme[];

function measure(pair: ContrastPair, scheme: PaletteScheme): number {
  const palette = palettes[scheme];
  return contrastRatio(resolveColor(pair.foreground, palette), resolveColor(pair.background, palette));
}

/** For the test name only: a missing token must fail ITS row, not the whole suite while it is built. */
function printRatio(pair: ContrastPair, scheme: PaletteScheme): string {
  try {
    return `${measure(pair, scheme).toFixed(2)}:1`;
  } catch {
    return 'unresolved color';
  }
}

describe('palette contrast (RF-13)', () => {
  for (const scheme of schemes) {
    describe(`${scheme} palette`, () => {
      for (const pair of contrastPairs) {
        const label = `${pair.id}  ${describeColor(pair.foreground)} on ${describeColor(pair.background)}  ${printRatio(pair, scheme)}`;

        if (pair.requirement === 'exempt') {
          it(`[exempt] ${label}`, () => {
            // Recorded, not required. It must still be a real measurement.
            const ratio = measure(pair, scheme);
            assert.ok(ratio >= 1 && ratio <= 21, label);
            assert.ok(pair.reason !== undefined && pair.reason.length > 0, `${pair.id} needs a reason`);
          });
          continue;
        }

        const minimum = CONTRAST_MINIMUM[pair.requirement];
        it(`[${pair.requirement} >= ${minimum}] ${label}`, () => {
          const ratio = measure(pair, scheme);
          assert.ok(ratio >= minimum, `${pair.id} in ${scheme}: ${ratio.toFixed(2)}:1 < ${minimum}:1 (${pair.where})`);
        });
      }
    });
  }

  it('has unique row ids and covers text, components and the recorded exceptions', () => {
    const ids = contrastPairs.map((pair) => pair.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const requirement of ['normalText', 'largeText', 'uiComponent', 'exempt'] as const) {
      assert.ok(contrastPairs.some((pair) => pair.requirement === requirement), requirement);
    }
  });

  it('classifies large text only for the sizes that really are large', () => {
    const large = contrastPairs.filter((pair) => pair.requirement === 'largeText').map((pair) => pair.id);
    assert.deepEqual(large.sort(), ['heading/background', 'subheading/surface']);
    assert.ok(textSizes.heading.fontSize >= 18 && textSizes.subheading.fontSize >= 18);
    assert.ok(textSizes.body.fontSize < 18 && textSizes.label.fontSize < 18);
  });

  it('every state of a control keeps its pair: selected, error, placeholder, badge and disabled are rows', () => {
    const covered = (id: string) => assert.ok(contrastPairs.some((pair) => pair.id === id), id);
    covered('on-primary/primary'); // selected
    covered('error/surface'); // error text
    covered('error/background-outline'); // error outline
    covered('muted/surface'); // placeholder
    covered('badge/error'); // badge
    covered('disabled-stepper'); // disabled
  });

  it('the border of a control is stronger than the decorative border (the reason `controlBorder` exists)', () => {
    for (const scheme of schemes) {
      const palette = palettes[scheme];
      assert.ok(contrastRatio(palette.border, palette.surface) < CONTRAST_MINIMUM.uiComponent, `${scheme}: border is decorative`);
      assert.ok(contrastRatio(palette.controlBorder, palette.surface) >= CONTRAST_MINIMUM.uiComponent, `${scheme}: controlBorder`);
      assert.ok(contrastRatio(palette.controlBorder, palette.background) >= CONTRAST_MINIMUM.uiComponent, `${scheme}: controlBorder`);
    }
  });
});

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'test' ? [] : sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function codeLines(path: string): string[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line));
}

const HEX_LITERAL = /#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b(?![0-9A-Fa-f])/;

describe('color sources of the app', () => {
  it('has no color literal outside the palettes (a hard-coded red broke the dark theme)', () => {
    const offenders = sources(SRC)
      // `contrast.ts` names pure black and white: they are the two candidates of the text rule, not UI colors.
      .filter((path) => !/design-system\/(palettes|contrast)\.ts$/.test(path))
      .flatMap((path) =>
        codeLines(path)
          .filter((line) => HEX_LITERAL.test(line))
          .map((line) => `${relative(SRC, path)}: ${line.trim()}`),
      );

    assert.deepEqual(offenders, []);
  });

  it('flags a color literal (the scan is not blind)', () => {
    assert.ok(HEX_LITERAL.test("const ERROR_COLOR = '#B42318';"));
    assert.ok(HEX_LITERAL.test("color: '#fff'"));
    assert.ok(!HEX_LITERAL.test('const anchor = "#section";'));
  });

  it('every palette token a component reads appears in at least one pair', () => {
    const inPairs = new Set<string>();
    for (const pair of contrastPairs) {
      for (const spec of [pair.foreground, pair.background]) {
        if ('token' in spec) inPairs.add(spec.token);
        if ('bestTextOn' in spec) inPairs.add(spec.bestTextOn);
        if ('badgeTextOn' in spec) inPairs.add(spec.badgeTextOn);
      }
    }

    const used = new Set<string>();
    for (const path of sources(SRC)) {
      for (const line of codeLines(path)) {
        for (const match of line.matchAll(/\bcolors\.([a-zA-Z]+)\b/g)) used.add(match[1] as string);
      }
    }

    const tokens = new Set<string>(Object.keys(palettes.light));
    const unknown = [...used].filter((name) => !tokens.has(name));
    assert.deepEqual(unknown, [], 'colors.<x> that is not a palette token');
    const uncovered = [...used].filter((name) => !inPairs.has(name as PaletteToken));
    assert.deepEqual(uncovered, [], 'palette tokens drawn but absent from contrast-pairs.ts');
  });

  it('both palettes define the same tokens', () => {
    assert.deepEqual(Object.keys(palettes.dark).sort(), Object.keys(palettes.light).sort());
  });
});
