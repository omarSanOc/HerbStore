import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, radii, scaleWithFont, spacing, typography, useAppTheme } from '@/design-system';
import { ProductCardSkeleton } from '@/features/product/components/ProductCardSkeleton';
import { getProductCardWidth } from '@/features/product/logic/product-card-layout';

import { BANNER_ASPECT_RATIO, CATEGORY_IMAGE_SIZE, PRODUCT_CARD_WIDTH } from '../home-layout';

const CATEGORY_PLACEHOLDERS = 5;
const SECTION_PLACEHOLDERS = 2;
const CARDS_PER_SECTION = 2;

/**
 * First-load representation: blocks with the dimensions of the final rows (banner 16:9, round
 * categories of `CATEGORY_IMAGE_SIZE` with the line of their label, product cards of the width Home
 * gives them at this font scale) so nothing jumps when the data arrives. Whatever exists BECAUSE of
 * the text (the label line, the title line, the body of a card) is as tall as that text at the
 * current font scale (`scaleWithFont`), or the rows were a fraction of the real ones at 2.0 (H-12).
 * It is static on purpose (no shimmer), which also satisfies reduced motion, and it is one accessible
 * element announced as busy instead of a pile of empty views.
 *
 * Not reserved (H-3, accepted in Day 2 and closed in Day 6, see `plan.md`): the banner TEXT. Its
 * length comes from the server, so any guess would still move the page when the real text arrives.
 */
export function HomeSkeleton() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const block = { backgroundColor: colors.border };
  const labelLine = scaleWithFont(typography.label.lineHeight, fontScale);
  const titleLine = scaleWithFont(typography.subheading.lineHeight, fontScale);
  const cardWidth = getProductCardWidth(PRODUCT_CARD_WIDTH, fontScale);

  return (
    <View
      accessibilityLabel={t('home.loading.label')}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      accessible
      style={styles.column}>
      <AppText tone="muted">{t('home.loading.text')}</AppText>
      <View style={[styles.banner, block]} />
      <View style={[styles.categories, { gap: scaleWithFont(spacing.sm, fontScale) }]}>
        {Array.from({ length: CATEGORY_PLACEHOLDERS }, (_, index) => (
          <View key={index} style={styles.categoryItem}>
            <View style={[styles.category, block]} />
            <View testID="home-skeleton-category-label" style={{ height: labelLine, justifyContent: 'center' }}>
              <View style={[styles.categoryLabel, block, { height: labelLine * 0.7 }]} />
            </View>
          </View>
        ))}
      </View>
      {Array.from({ length: SECTION_PLACEHOLDERS }, (_, section) => (
        <View key={section} style={styles.section}>
          <View testID="home-skeleton-section-title" style={{ height: titleLine, justifyContent: 'center' }}>
            <View style={[styles.sectionTitle, block, { height: titleLine * 0.7 }]} />
          </View>
          <View style={styles.cards}>
            {Array.from({ length: CARDS_PER_SECTION }, (_, card) => (
              <ProductCardSkeleton key={card} width={cardWidth} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: spacing.md,
  },
  banner: {
    aspectRatio: BANNER_ASPECT_RATIO,
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  categories: {
    flexDirection: 'row',
    // Like the real row: it is cut by the screen edge instead of wrapping to a second line.
    overflow: 'hidden',
  },
  categoryItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  category: {
    width: CATEGORY_IMAGE_SIZE,
    height: CATEGORY_IMAGE_SIZE,
    borderRadius: radii.pill,
  },
  categoryLabel: {
    width: CATEGORY_IMAGE_SIZE,
    borderRadius: radii.sm,
    borderCurve: 'continuous',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    width: '40%',
    borderRadius: radii.sm,
    borderCurve: 'continuous',
  },
  cards: {
    flexDirection: 'row',
    gap: spacing.sm,
    overflow: 'hidden',
  },
});
