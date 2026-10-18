import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, spacing } from '@/design-system';

import { ProductCardSkeleton } from '../components/ProductCardSkeleton';
import { getGridColumnCount } from '../logic/product-card-layout';
import { GRID_CELL_PADDING } from './grid-layout';

const ROWS = 3;

/**
 * First-load representation of the grid: cells with the shape of a product card (square picture
 * and four text lines as tall as the text at the current font scale, H-12) in the same number of columns as the real grid. It is static on purpose
 * (no shimmer), which also satisfies reduced motion (RNF-3), and it is one accessible element
 * announced as busy instead of a pile of empty views.
 *
 * It is not a FlashList: six placeholder cells need no virtualization, and a plain `View` grid
 * is easier to keep identical to the final layout.
 */
export function ProductGridSkeleton() {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const columns = getGridColumnCount(fontScale);
  const rows = columns === 1 ? 2 : ROWS;

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
              <ProductCardSkeleton />
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
});
