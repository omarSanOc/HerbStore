export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 16,
  pill: 999,
} as const;

export const typography = {
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  label: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  heading: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
  },
  subheading: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
  },
} as const;

export const sizes = {
  minimumTouchTarget: 48,
  contentMaxWidth: 560,
} as const;

/**
 * Upper bounds for system font scaling (`Text.maxFontSizeMultiplier`), only for chrome whose box
 * cannot grow with the text. Body content keeps scaling freely (accessibility first).
 *
 * - `tabLabel`: the tab bar has a fixed height and a 10 pt label; 1.2 keeps it at 12 pt on one line.
 *   Measured on Android at font scale 2.0: 1.3 still cut the descender of "Categorías"; 1.2 fits.
 * - `searchField`: the search "field" sits beside the scanner button; 1.5 (24 pt) fits a long
 *   Spanish word per line, while iOS AX5 (about 3x) broke "suplemen-tos" in the middle.
 */
export const fontScaleLimits = {
  tabLabel: 1.2,
  searchField: 1.5,
} as const;
