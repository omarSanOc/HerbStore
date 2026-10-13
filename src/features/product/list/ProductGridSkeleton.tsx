import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, radii, spacing, useAppTheme } from '@/design-system';

import { getGridColumnCount } from '../logic/product-card-layout';
import { GRID_CELL_PADDING } from './grid-layout';

const ROWS = 3;

/**
 * First-load representation of the grid: cells with the shape of a product card (square picture
 * and three text lines) in the same number of columns as the real grid. It is static on purpose
 * (no shimmer), which also satisfies reduced motion (RNF-3), and it is one accessible element
 * announced as busy instead of a pile of empty views.
 *
 * It is not a FlashList: six placeholder cells need no virtualization, and a plain `View` grid
 * is easier to keep identical to the final layout.
 */
export function ProductGridSkeleton() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const columns = getGridColumnCount(fontScale);
  const rows = columns === 1 ? 2 : ROWS;
  const block = { backgroundColor: colors.border };

  return (
    <View
      accessibilityLabel={t('productList.loading.label')}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      accessible
      style={styles.root}>
      <AppText style={styles.text} tone="muted">
        {t('productList.loading.text')}
      </AppText>
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} style={styles.row}>
          {Array.from({ length: columns }, (_, column) => (
            <View key={column} style={styles.cell}>
              <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <View style={[styles.picture, block]} />
                <View style={styles.body}>
                  <View style={[styles.line, block]} />
                  <View style={[styles.shortLine, block]} />
                  <View style={[styles.shortLine, block]} />
                </View>
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {},
  text: {
    paddingHorizontal: GRID_CELL_PADDING,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    padding: GRID_CELL_PADDING,
  },
  card: {
    overflow: 'hidden',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  picture: {
    aspectRatio: 1,
  },
  body: {
    gap: spacing.sm,
    padding: spacing.sm,
  },
  line: {
    height: 16,
    borderRadius: radii.sm,
    borderCurve: 'continuous',
  },
  shortLine: {
    width: '60%',
    height: 14,
    borderRadius: radii.sm,
    borderCurve: 'continuous',
  },
});
