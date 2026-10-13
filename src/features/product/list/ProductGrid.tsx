import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import type { ReactElement } from 'react';
import {
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewabilityConfig,
} from 'react-native';

import { useAppTheme } from '@/design-system';

import { ProductCard } from '../components/ProductCard';
import type { CatalogProduct } from '../contracts/catalog-product';
import { getGridColumnCount } from '../logic/product-card-layout';
import { GRID_CELL_PADDING, GRID_EDGE_PADDING } from './grid-layout';
import type { VisibleItemsChange } from './use-product-list';

type OpenProduct = (productId: string) => void;

type ProductGridProps = {
  products: readonly CatalogProduct[];
  onOpenProduct: OpenProduct;
  /** Scrolls with the grid: the title, the counter and the notice. */
  header: ReactElement;
  /** The end of the list: progress or the failure of the next page. */
  footer?: ReactElement | null;
  /** True while a pull-to-refresh runs; the products stay on screen meanwhile. */
  isRefreshing: boolean;
  onRefresh: () => void;
  /** Reports the visible items so the screen can ask for the next page (RF-10). */
  onViewableItemsChanged: (change: VisibleItemsChange) => void;
};

// Module-level and closure-free: the list gets the same functions on every render. The key is the
// product id, never the position, so FlashList can tell which cell is which when the data changes.
const keyExtractor = (product: CatalogProduct) => product.id;

/**
 * Viewability for "load more". Module-level because FlashList does not support changing
 * `viewabilityConfig` on the fly. `itemVisiblePercentThreshold` stays at its default (0): an item
 * is visible with a single pixel, which is "enters the screen" in RF-10. `minimumViewTime: 0`
 * reports at once instead of after the library's 250 ms default, so the request leaves as soon as
 * the last items appear; the callback only compares a few numbers (see `useProductList`).
 */
const viewabilityConfig: ViewabilityConfig = { minimumViewTime: 0 };

/** Dev-only datum for T15 (RF-21): FlashList's first-layout time. Absent in release builds. */
function logGridLoad({ elapsedTimeInMs }: { elapsedTimeInMs: number }) {
  console.log(`[products] grid onLoad ${elapsedTimeInMs} ms`);
}

/**
 * FlashList v2 does not re-render a cell when only a closure changes, so what the cell needs
 * besides its item travels in `extraData` (here, the function that opens a product). That keeps
 * `renderItem` a module-level function instead of a closure recreated on every render.
 */
function renderItem({ item, extraData }: ListRenderItemInfo<CatalogProduct>) {
  return (
    <View style={styles.cell}>
      <ProductCard onPress={extraData as OpenProduct} product={item} />
    </View>
  );
}

/**
 * The product grid on FlashList v2. It recycles the cells that leave the screen, so only the ones
 * near the viewport exist as native views even with 300 products.
 *
 * - `numColumns`: 2 (the spec), or 1 when the system font is so large that half a screen cannot
 *   hold a name and a price (`getGridColumnCount`).
 * - v2 measures every cell by itself: there is no `estimatedItemSize`, and a row is as tall as its
 *   tallest card (the cards stretch to it, see `ProductCard`).
 * - Spacing is padding in the cell plus padding in the container (`grid-layout.ts`).
 * - "Load more" uses `onViewableItemsChanged` (the last four items entering the screen, RF-10), not
 *   `onEndReached`, whose threshold is a fraction of the screen and not a number of items.
 * - Pull-to-refresh is a `refreshControl` themed like Home's; `refreshing` is true only for a pull.
 * - Keyboard (the search screen has a text field above the grid): `keyboardDismissMode="on-drag"`
 *   closes it when the user drags the list; `keyboardShouldPersistTaps="handled"` lets the first
 *   tap reach a card instead of only closing the keyboard; `automaticallyAdjustKeyboardInsets`
 *   (iOS) makes the keyboard push the content up instead of covering the last rows, and Android's
 *   default `adjustResize` already shrinks the window. All three do nothing without a keyboard,
 *   so the category screen is unchanged.
 * - `maintainVisibleContentPosition` keeps its default (ON in v2): when a page is appended or the
 *   60 s revalidation swaps the pages for equal ones, the visible items do not move.
 * - `drawDistance` keeps the library default: nothing justifies touching it until T15 measures.
 *
 * Compose: `LazyVerticalGrid(GridCells.Fixed(2))` with `items(key = { it.id })`; SwiftUI:
 * `LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())])` over `ForEach(id: \.id)`;
 * UIKit/Android Views: `UICollectionView` / `RecyclerView` with a `GridLayoutManager`.
 */
export function ProductGrid({
  products,
  onOpenProduct,
  header,
  footer = null,
  isRefreshing,
  onRefresh,
  onViewableItemsChanged,
}: Readonly<ProductGridProps>) {
  const { fontScale } = useWindowDimensions();
  const { colors } = useAppTheme();

  return (
    <FlashList
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={products}
      extraData={onOpenProduct}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      keyExtractor={keyExtractor}
      ListFooterComponent={footer}
      ListHeaderComponent={header}
      numColumns={getGridColumnCount(fontScale)}
      onLoad={__DEV__ ? logGridLoad : undefined}
      onViewableItemsChanged={onViewableItemsChanged}
      refreshControl={
        <RefreshControl
          colors={[colors.primary]}
          onRefresh={onRefresh}
          progressBackgroundColor={colors.surface}
          refreshing={isRefreshing}
          tintColor={colors.primary}
        />
      }
      renderItem={renderItem}
      viewabilityConfig={viewabilityConfig}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: GRID_EDGE_PADDING,
    paddingBottom: GRID_EDGE_PADDING,
  },
  // Fills the cell so the card can stretch to the height of its row.
  cell: {
    flexGrow: 1,
    padding: GRID_CELL_PADDING,
  },
});
