export type ActionBarLayoutInput = {
  /** Width of the window, in dp/pt. */
  windowWidth: number;
  /** Space between the window edge and the bar, on EACH side. */
  horizontalInset: number;
  /** Space between the two buttons when they share a row. */
  gap: number;
  /** The system font scale (`useWindowDimensions().fontScale`). */
  fontScale: number;
  /** The largest scale the label really gets (`maxFontSizeMultiplier`); `Infinity` for none. */
  maxFontScale: number;
  /** Font size of the label at scale 1. */
  baseFontSize: number;
  /** Width, in em, of the longest label ("Cancelar"): measured, about 4.0 on iOS and Android. */
  longestLabelEm: number;
  /** What a button adds around its label: horizontal padding on both sides plus the border. */
  buttonChrome: number;
};

/**
 * Whether Cancel and Apply must go one above the other instead of sharing a row.
 *
 * A word that does not fit its line is split INSIDE the word by the platform (iOS AX5 drew
 * "Canc / elar"): a button cannot wrap "Cancelar" any other way. So the row is only used when one
 * half of it can hold the longest label on one line; otherwise each button takes the full width,
 * which always fits (the label is capped, so it is never wider than the window).
 *
 * The width of the label is an ESTIMATE (`longestLabelEm` times the size it is drawn at), not a
 * measurement, so this stays a pure function. The em width was measured with `onTextLayout` on
 * both platforms (iOS 4.00, Android 3.97) and is the same in English ("Cancel" is shorter).
 * An invalid font scale counts as 1; an invalid window width stacks (the safe layout).
 */
export function shouldStackActions({
  windowWidth,
  horizontalInset,
  gap,
  fontScale,
  maxFontScale,
  baseFontSize,
  longestLabelEm,
  buttonChrome,
}: ActionBarLayoutInput): boolean {
  if (!Number.isFinite(windowWidth) || windowWidth <= 0) {
    return true;
  }

  const scale = Number.isFinite(fontScale) && fontScale > 0 ? Math.min(fontScale, maxFontScale) : 1;
  const neededWidth = baseFontSize * scale * longestLabelEm + buttonChrome;
  const halfRowWidth = (windowWidth - 2 * horizontalInset - gap) / 2;

  return neededWidth > halfRowWidth;
}
