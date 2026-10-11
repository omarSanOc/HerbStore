import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, radii, spacing, useAppTheme } from '@/design-system';

import { BANNER_ASPECT_RATIO, CATEGORY_IMAGE_SIZE, PRODUCT_CARD_WIDTH } from '../home-layout';

const CATEGORY_PLACEHOLDERS = 5;
const SECTION_PLACEHOLDERS = 2;
const CARDS_PER_SECTION = 2;

/**
 * First-load representation: blocks with the dimensions of the final rows (banner 16:9, round
 * categories of `CATEGORY_IMAGE_SIZE`, product pictures of `PRODUCT_CARD_WIDTH`) so nothing jumps
 * when the data arrives. It is static on
 * purpose (no shimmer), which also satisfies reduced motion, and it is one accessible element
 * announced as busy instead of a pile of empty views.
 */
export function HomeSkeleton() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const block = { backgroundColor: colors.border };

  return (
    <View
      accessibilityLabel={t('home.loading.label')}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      accessible
      style={styles.column}>
      <AppText tone="muted">{t('home.loading.text')}</AppText>
      <View style={[styles.banner, block]} />
      <View style={styles.categories}>
        {Array.from({ length: CATEGORY_PLACEHOLDERS }, (_, index) => (
          <View key={index} style={[styles.category, block]} />
        ))}
      </View>
      {Array.from({ length: SECTION_PLACEHOLDERS }, (_, section) => (
        <View key={section} style={styles.section}>
          <View style={[styles.sectionTitle, block]} />
          <View style={styles.cards}>
            {Array.from({ length: CARDS_PER_SECTION }, (_, card) => (
              <View key={card} style={[styles.card, block]} />
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
    gap: spacing.sm,
    // Like the real row: it is cut by the screen edge instead of wrapping to a second line.
    overflow: 'hidden',
  },
  category: {
    width: CATEGORY_IMAGE_SIZE,
    height: CATEGORY_IMAGE_SIZE,
    borderRadius: radii.pill,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    width: '40%',
    height: 20,
    borderRadius: radii.sm,
    borderCurve: 'continuous',
  },
  cards: {
    flexDirection: 'row',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  card: {
    width: PRODUCT_CARD_WIDTH,
    aspectRatio: 1,
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
});
