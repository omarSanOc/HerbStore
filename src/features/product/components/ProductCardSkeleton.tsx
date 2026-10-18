import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { radii, scaleWithFont, spacing, typography, useAppTheme } from '@/design-system';

/** Placeholder text lines of a card body and how much of the width each one fills. */
const BODY_LINES = [1, 0.65, 0.45, 0.55] as const;

type ProductCardSkeletonProps = {
  /** Fixed width, as `ProductCard`'s: Home's rows pass theirs; a grid cell leaves it out and fills. */
  width?: number;
};

/**
 * What a product card looks like while it loads: the square picture and the body of four text lines
 * (a name that wraps over two lines, the price and the rating), laid out like `ProductCard`
 * (same border, padding and gap) so nothing jumps when the data arrives. Each line is as tall as a
 * line of `typography.label` at the CURRENT font scale (`scaleWithFont`): the font scale only
 * multiplies text, so fixed 14 dp bars made the skeleton a fraction of the real card at 2.0 (H-12).
 * It is static on purpose (no shimmer), which also satisfies reduced motion. Decorative: the
 * parent skeleton is the one accessible, busy element.
 */
export function ProductCardSkeleton({ width }: Readonly<ProductCardSkeletonProps>) {
  const { colors } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const lineHeight = scaleWithFont(typography.label.lineHeight, fontScale);
  const block = { backgroundColor: colors.border };

  return (
    <View
      testID="product-card-skeleton"
      style={[
        styles.card,
        width === undefined ? styles.fill : { width },
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}>
      <View style={[styles.picture, block]} />
      <View style={styles.body}>
        {BODY_LINES.map((fill, index) => (
          <View key={index} testID="product-card-skeleton-line" style={{ height: lineHeight, justifyContent: 'center' }}>
            <View style={[styles.line, block, { height: lineHeight * 0.7, width: `${fill * 100}%` }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  fill: {
    flexGrow: 1,
  },
  picture: {
    aspectRatio: 1,
  },
  body: {
    gap: spacing.xs,
    padding: spacing.sm,
  },
  line: {
    borderRadius: radii.sm,
    borderCurve: 'continuous',
  },
});
