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
 * - `listTitle`: the 28 pt title of a product list is a single long word ("Vitaminas") that can
 *   be wider than the screen at the largest scales. iOS AX5 (about 3.1x, 87 pt) split it as "Vitamin / as";
 *   2.0 (56 pt) keeps the longest category name on one line even on a 360 dp phone, and equals the
 *   largest scale Android offers, so Android does not change.
 * - `optionLabel`: a row of the sort sheet holds one long word ("Destacados") beside a check mark.
 *   At iOS AX5 (about 3.1x, 50 pt) the word alone is about 300 pt, as wide as the row, so it was split
 *   as "Destacad / os"; at 2.0 (32 pt) it needs about 190 pt, which fits even a 320 pt phone, and
 *   Android's largest scale is 2.0, so Android does not change.
 * - `selectionMark`: the check of a selected option is a decorative glyph in a fixed slot; capping it
 *   at 1.5 (24 pt) keeps the slot from taking the width the label needs.
 * - `sectionHeading`: a section heading of the filters sheet is one long word ("Subcategorías",
 *   6.4 em wide). At iOS AX5 (3.57x, 71 pt) it measured 459 pt on a 370 pt line and was split as
 *   "Subcatego / rías"; at 2.0 (40 pt) it needs 259 pt, which fits a 320 pt phone, and 2.0 is the
 *   largest scale Android offers, so Android does not change.
 * - `actionLabel`: the labels of the Cancel / Apply bar, and of a button whose label holds a long word
 *   ("Abrir ajustes de notificaciones": at iOS AX5 "notificaciones" was split as "notificacione / s",
 *   H-T8-6; at 2.0 it needs about 235 pt of a 338 pt label). At iOS AX5 "Cancelar" (4.0 em) was 229 pt
 *   in a 181 pt half row and was split as "Canc / elar", and even stacked the two buttons took 188 pt
 *   and left two rows of the list; at 2.0 the word needs 128 pt (a half row holds it on 384 pt
 *   and wider windows, narrower ones stack) and the bar is 58 pt high. Android's largest scale is
 *   2.0, so Android does not change.
 * - `productTitle`: the name and the price of the product detail use the 28 pt heading. A catalog
 *   name is made of long words ("Magnesium", "Glycinate", 9 letters) and a price of long numbers
 *   ("USD 1,187.01"). At iOS AX5 (about 3.6x, 100 pt) the name was split as "Magnes / ium /
 *   Glycina / te"; at 2.0 (56 pt) the longest word needs about 300 pt, which fits a 360 pt phone,
 *   and 2.0 is the largest scale Android offers, so Android does not change.
 * - `filterBar`: the bar pinned above a product list (sort, filters and quick-filter chips). At iOS AX5
 *   (about 3.1x, 50 pt) "Sort: Featured" alone was 150 pt tall and "Filters" was pushed off the right
 *   edge of the scroll row (G-4/S-8); at 1.5 (24 pt) both buttons fit side by side on a 370 pt line
 *   (about 330 pt) and the bar stays about 60 pt high. The chips scroll, the pair of buttons does not.
 * - `inlineFeedback`: a message that appears after an action, with its retry button (the failed
 *   share of the product detail). With the purchase bar pinned, an iOS AX5 screen (about 3.1x) shows
 *   only about 55 % of its height to scroll in, and the message (343 pt, seven lines) plus the
 *   button (161 pt) did not fit it, so the button stayed partly under the bar; at 2.0 the pair is
 *   about 320 pt and fits. 2.0 is the largest scale Android offers, so Android does not change.
 * - `cardText`: the name, the price and the rating of a product card, whose width is its own (Home's
 *   rows grow it only up to 1.5x, 240 pt). At iOS AX5 (about 3.1x, 53 pt) the name and the price were
 *   split in the middle of the word ("Complet / e Daily", "$233.8 / 2"); at 2.0 (34 pt) a 9-letter name
 *   word needs about 185 pt and a price about 140 pt of the 224 pt the card leaves, and 2.0 is the
 *   largest scale Android offers, so Android does not change.
 * - `screenTitle`: the heading of a scanner state ("Consultando producto…", "Sin conexión…"), a line or
 *   two of long words over a preview that takes the free height. At iOS AX5 (about 3.5x, 100 pt)
 *   "Consultando" (about 4 em) measured 398 pt on a 370 pt line and was split as "Consultand / o"; at 2.0
 *   (56 pt) it needs about 223 pt, which fits any phone, and 2.0 is the largest scale Android offers, so
 *   Android does not change.
 * - `purchaseBar`: the bar pinned under the product detail (total + "Add to cart"). At iOS AX5
 *   (about 3.1x) it stacked "Total", the amount and a two-line button and took 43 % of the screen
 *   height, leaving only the picture to scroll; at 2.0 it is about 22 % and the button label still
 *   fits one line on a 360 pt phone. 2.0 is the largest scale Android offers, so Android does not
 *   change.
 */
export const fontScaleLimits = {
  tabLabel: 1.2,
  searchField: 1.5,
  listTitle: 2,
  optionLabel: 2,
  selectionMark: 1.5,
  sectionHeading: 2,
  actionLabel: 2,
  productTitle: 2,
  filterBar: 1.5,
  inlineFeedback: 2,
  cardText: 2,
  screenTitle: 2,
  purchaseBar: 2,
} as const;
