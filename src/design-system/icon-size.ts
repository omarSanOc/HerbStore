// Geometry of an icon that keeps its size whatever the system font size (H-1/H-11, spec 006 T6c).
// Pure: see `icon-size.test.ts` for the reason (the Android icon is a `Text`, which scales).

/**
 * `box` is the width and height the icon must occupy; `fontSize` is what to give the symbol's font so
 * that, after the system multiplies it by `fontScale`, the glyph is `size` again.
 */
export function fixedIconGeometry(
  size: number,
  fontScale: number,
): Readonly<{ box: number; fontSize: number }> {
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  return { box: size, fontSize: size / scale };
}
