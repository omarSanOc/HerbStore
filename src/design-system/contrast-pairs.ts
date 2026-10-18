// The list of foreground/background pairs the app really draws (RF-13, spec 006 T6c), written against
// the palette TOKENS, never against hex values: change a color in `palettes.ts` and
// `contrast-audit.test.ts` re-measures every pair that uses it, in both schemes.
//
// Each row says where the pair is drawn and which WCAG minimum it must reach:
//  - `normalText`  4.5:1  text under 18 pt (or under 14 pt bold);
//  - `largeText`   3:1    text from 18 pt (or 14 pt bold);
//  - `uiComponent` 3:1    the boundary of a control that is needed to find it, informative icons and
//                          the parts of a graphic needed to understand it;
//  - `exempt`      -      measured and recorded, but not required, with the reason (WCAG 1.4.3 and 1.4.11
//                          do not ask for decorative outlines or for inactive components).
// No React Native import: `node:test` loads it.
import {
  blendOver,
  classifyText,
  highestContrastText,
  navigationBadgeText,
  type ContrastKind,
} from './contrast.ts';
import type { Palette, PaletteToken } from './palettes.ts';
import { typography } from './tokens.ts';

export type ColorSpec =
  | Readonly<{ token: PaletteToken }>
  /** White or black, whichever contrasts more (the native accent button of DeviceInsights). */
  | Readonly<{ bestTextOn: PaletteToken }>
  /** What the navigator's `Badge` draws on that background (YIQ rule). */
  | Readonly<{ badgeTextOn: PaletteToken }>
  /** `token` drawn at `alpha` over `over` (a control with `opacity`). */
  | Readonly<{ token: PaletteToken; alpha: number; over: PaletteToken }>;

export type PairRequirement = ContrastKind | 'exempt';

export type ContrastPair = Readonly<{
  id: string;
  /** What the user sees: the screens and components that draw this pair. */
  where: string;
  foreground: ColorSpec;
  background: ColorSpec;
  requirement: PairRequirement;
  /** `exempt` only: why WCAG does not ask for it. */
  reason?: string;
}>;

export function resolveColor(spec: ColorSpec, palette: Palette): string {
  if ('bestTextOn' in spec) return highestContrastText(palette[spec.bestTextOn]);
  if ('badgeTextOn' in spec) return navigationBadgeText(palette[spec.badgeTextOn]);
  if ('alpha' in spec) return blendOver(palette[spec.token], palette[spec.over], spec.alpha);
  return palette[spec.token];
}

export function describeColor(spec: ColorSpec): string {
  if ('bestTextOn' in spec) return `black/white on ${spec.bestTextOn}`;
  if ('badgeTextOn' in spec) return `badge text on ${spec.badgeTextOn}`;
  if ('alpha' in spec) return `${spec.token} at ${spec.alpha * 100}% over ${spec.over}`;
  return spec.token;
}

const token = (name: PaletteToken): ColorSpec => ({ token: name });

/** Text size categories come from the real typography tokens (or a literal for chrome text). */
export const textSizes = {
  body: typography.body,
  label: typography.label,
  heading: typography.heading,
  subheading: typography.subheading,
  // `TabBarLabel`: 10 pt, weight 500 (13 pt beside the icon on tablets, still normal text).
  tabLabel: { fontSize: 10, fontWeight: '500' },
  // The tab badge: 12 pt regular.
  badge: { fontSize: 12, fontWeight: '400' },
} as const;

function text(
  id: string,
  where: string,
  foreground: ColorSpec,
  background: ColorSpec,
  size: keyof typeof textSizes,
): ContrastPair {
  return { id, where, foreground, background, requirement: classifyText(textSizes[size]) };
}

function ui(id: string, where: string, foreground: ColorSpec, background: ColorSpec): ContrastPair {
  return { id, where, foreground, background, requirement: 'uiComponent' };
}

function exempt(
  id: string,
  where: string,
  foreground: ColorSpec,
  background: ColorSpec,
  reason: string,
): ContrastPair {
  return { id, where, foreground, background, requirement: 'exempt', reason };
}

export const contrastPairs: readonly ContrastPair[] = [
  // ---- Text -------------------------------------------------------------------------------
  text('text/background', 'body and label text on the page (lists, forms, messages)', token('text'), token('background'), 'body'),
  text('text/surface', 'text on cards, sheets, headers, fields and outlined buttons', token('text'), token('surface'), 'label'),
  text('heading/background', 'screen titles (28 pt bold) on the page', token('text'), token('background'), 'heading'),
  text('subheading/surface', 'section and banner titles (20 pt) on cards and sheets', token('text'), token('surface'), 'subheading'),
  text('muted/background', 'secondary text and loading messages on the page', token('textMuted'), token('background'), 'body'),
  text('muted/surface', 'secondary text on cards, search placeholder, inactive tab label', token('textMuted'), token('surface'), 'body'),
  text('tab-label-muted/surface', 'inactive tab label (10 pt)', token('textMuted'), token('surface'), 'tabLabel'),
  text('muted/border', 'fallback text of an image that did not load (on the frame color)', token('textMuted'), token('border'), 'body'),
  text('on-primary/primary', 'label of a selected or primary button, card badge, swipe-to-delete action', token('onPrimary'), token('primary'), 'label'),
  text('primary/surface', 'check mark of the selected option in a sheet', token('primary'), token('surface'), 'label'),
  text('tab-label-primary/surface', 'active tab label (10 pt)', token('primary'), token('surface'), 'tabLabel'),
  text('error/surface', 'checkout error text inside a card or notice', token('error'), token('surface'), 'body'),
  text('error/background', 'checkout field error text on the page', token('error'), token('background'), 'body'),
  text('badge/error', 'cart count badge on the tab bar (12 pt)', { badgeTextOn: 'error' }, token('error'), 'badge'),
  text('success/surface', 'success token on cards (declared; no screen draws it yet)', token('success'), token('surface'), 'body'),
  text('success/background', 'success token on the page (declared; no screen draws it yet)', token('success'), token('background'), 'body'),
  text('warning/surface', 'warning token on cards (declared; no screen draws it yet)', token('warning'), token('surface'), 'body'),
  text('warning/background', 'warning token on the page (declared; no screen draws it yet)', token('warning'), token('background'), 'body'),
  text('accent-button/primary', 'DeviceInsights native button, accent "primary"', { bestTextOn: 'primary' }, token('primary'), 'label'),
  text('accent-button/success', 'DeviceInsights native button, accent "success"', { bestTextOn: 'success' }, token('success'), 'label'),
  text('accent-button/warning', 'DeviceInsights native button, accent "warning"', { bestTextOn: 'warning' }, token('warning'), 'label'),
  text('accent-button/error', 'DeviceInsights native button, accent "error"', { bestTextOn: 'error' }, token('error'), 'label'),

  // ---- Components and graphics ------------------------------------------------------------
  ui('control-border/surface', 'border of fields, chips, option rows, steppers and outlined buttons on a card or sheet', token('controlBorder'), token('surface')),
  ui('control-border/background', 'border of the same controls when they sit on the page (filter bar, search field, form)', token('controlBorder'), token('background')),
  ui('primary/surface-graphic', 'active tab icon, selected option outline, spinner on a card', token('primary'), token('surface')),
  ui('primary/background-graphic', 'active carousel dot, spinner and pull-to-refresh on the page', token('primary'), token('background')),
  ui('primary/border-graphic', 'filled part of the shipping progress bar over its track', token('primary'), token('border')),
  ui('muted/surface-icon', 'inactive tab icon, search and clear icons, inactive carousel dot', token('textMuted'), token('surface')),
  ui('muted/background-icon', 'inactive carousel dot and gallery dot on the page', token('textMuted'), token('background')),
  ui('text/surface-icon', 'header close cross, back arrow, carousel step arrows', token('text'), token('surface')),
  ui('on-primary/primary-icon', 'scanner icon inside the filled button of Home', token('onPrimary'), token('primary')),
  ui('error/surface-outline', 'error outline of a field or of the notice box on a card', token('error'), token('surface')),
  ui('error/background-outline', 'error outline of a field or of the notice box on the page', token('error'), token('background')),
  ui('accent-button/primary-boundary', 'DeviceInsights native button, accent "primary", against the page', token('primary'), token('background')),

  // ---- Measured, not required --------------------------------------------------------------
  exempt('border/surface', 'outline of a card or divider on a card', token('border'), token('surface'), 'decorative: the card is identified by its content; WCAG 1.4.11 asks only for what is needed to identify a control'),
  exempt('border/background', 'outline of a card, skeleton block and banner frame on the page', token('border'), token('background'), 'decorative: same reason as above; skeleton blocks are placeholders without information'),
  exempt('disabled-stepper', 'disabled "+/-" button (opacity 0.4), icon on its surface', { token: 'text', alpha: 0.4, over: 'background' }, { token: 'surface', alpha: 0.4, over: 'background' }, 'inactive component: WCAG 1.4.3 and 1.4.11 exempt disabled controls'),
  exempt('disabled-add-bar', 'disabled "Add to cart" (opacity 0.6): label over its fill', { token: 'onPrimary', alpha: 0.6, over: 'surface' }, { token: 'primary', alpha: 0.6, over: 'surface' }, 'inactive component: it is also announced as disabled and sold-out/locked text says why'),
];
