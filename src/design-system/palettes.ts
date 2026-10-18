// The two color palettes, as plain data with no React Native import: the theme draws with them and
// the contrast audit (`contrast-audit.test.ts`) judges them in Node. Change a color HERE and the
// audit re-measures every pair that uses it.
//
// Two border tokens on purpose (T6c, RF-13): `border` is DECORATIVE (card outline, divider, skeleton,
// image frame; 1.4-2:1 and exempt from WCAG 1.4.11) and `controlBorder` is the edge of something the
// user must find and operate (field, chip, option row, stepper, outlined button), at least 3:1.
//
// Compose: `lightColorScheme(...)` / `darkColorScheme(...)`; SwiftUI: the light and dark variants of
// an Asset Catalog color set.
export const palettes = {
  light: {
    background: '#F4F7F2',
    surface: '#FFFFFF',
    text: '#172019',
    // 4.41:1 (#506055) -> 4.68:1 on `border`, where the image fallback text sits (needs 4.5:1).
    textMuted: '#4D5C51',
    primary: '#176B45',
    success: '#187F48',
    warning: '#7A4A00',
    error: '#A52A2A',
    onPrimary: '#FFFFFF',
    border: '#C9D5CC',
    controlBorder: '#78887C',
  },
  dark: {
    background: '#0F1611',
    surface: '#19231C',
    text: '#F1F5F2',
    textMuted: '#B7C5BA',
    primary: '#72DCA2',
    success: '#71D99A',
    warning: '#F4C66A',
    error: '#FFB4AB',
    onPrimary: '#092B1A',
    border: '#3B4D40',
    controlBorder: '#657D6C',
  },
} as const;

export type PaletteScheme = keyof typeof palettes;
export type Palette = (typeof palettes)[PaletteScheme];
export type PaletteToken = keyof Palette;
