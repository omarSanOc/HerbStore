import { useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  AppButton,
  AppText,
  spacing,
  type AppBottomSheetHandle,
} from '@/design-system';

import {
  applyAdvancedFilters,
  clearFilters,
  countAdvancedFilters,
  DEFAULT_LIST_PARAMS,
  describeParamsForLog,
  hasActiveFilters,
  setSort,
  toggleQuickFilter,
  toProductQueryArgs,
  type AdvancedFiltersDraft,
  type ListParams,
  type ListScope,
  type QuickFilterKey,
} from '../logic/list-params';
import type { ProductSort } from '../logic/product-query';
import { AdvancedFiltersSheet } from './AdvancedFiltersSheet';
import { GRID_CELL_PADDING, GRID_EDGE_PADDING } from './grid-layout';
import { ProductGrid } from './ProductGrid';
import { ProductGridSkeleton } from './ProductGridSkeleton';
import {
  ProductListFooterRow,
  ProductListNoticeRow,
  ProductListStatus,
  type EmptyAction,
  type EmptyCopy,
} from './ProductListStatus';
import { QuickFilters } from './QuickFilters';
import { SortSheet, sortLabelKeys } from './SortSheet';
import { useProductList } from './use-product-list';

type ProductListViewProps = {
  /** What the route decides: the category (T8) or the search text (T12), or both. */
  scope: ListScope;
  /**
   * The screen is still deciding WHICH list this is (search: the text has not settled yet). The
   * view stays mounted, keeps its filters and shows the loading skeleton, but asks for nothing.
   */
  paused?: boolean;
  /** Title of the screen (category name, search text...): scrolls with the list. */
  header: ReactNode;
  /** What the "no products" state offers. */
  emptyAction?: EmptyAction;
  /**
   * What the empty state offers when FILTERS are on. Default: "Clear filters". The search replaces
   * it with one action that clears the text and the filters together (plan, RF-19).
   */
  emptyFilteredAction?: EmptyAction;
  /** Own wording for an empty list without filters (default: the generic one). */
  emptyCopy?: EmptyCopy;
  /** Own wording for an empty list with filters on. */
  emptyFilteredCopy?: EmptyCopy;
  onOpenProduct: (productId: string) => void;
};

/**
 * Composes everything a product list screen shows: the filter bar, the title, the counter
 * ("N products"), the two-column grid and the states (loading skeleton, empty, offline, error,
 * stale notice). Category and search both use it, so the states are written once.
 *
 * The applied filters and sort (`ListParams`, including the brands and subcategories chosen in the
 * advanced-filters sheet) are LOCAL state of this view, not Redux and not a
 * URL parameter: they only matter to this list, and going to a product and back keeps them
 * because the screen stays mounted under the product. Each change builds new immutable params
 * (`list-params.ts`), which become the query identity (`toProductQueryArgs`): RTK Query opens
 * another entry, the list shows page 1 and the grid, keyed by identity, starts on top.
 * A screen that shows ANOTHER list (another category) must remount this view with a `key` so the
 * filters of the old list do not follow the user.
 *
 * The filter bar (sort button, advanced-filters button and quick filters) is pinned ABOVE the list branch and never moves
 * between states. That is deliberate: the branches below swap the grid for a skeleton, the empty
 * state or an error, and a control that lived inside them would be destroyed and recreated each
 * time the user toggles a filter, taking the screen-reader focus with it. It is also what keeps
 * the chips visible when the filters leave no results (RF-19) or the request fails.
 *
 * The state comes from `useProductList` as a discriminated union and this component only maps it
 * to views (scroll pagination, pull-to-refresh and the 60 s revalidation live in the hook). With
 * products the grid is the scroll container (title, counter and notice scroll with it); every
 * other state is a short `ScrollView` so the text can grow with the system font without clipping
 * the retry button.
 *
 * Compose: a `ViewModel` with a `MutableStateFlow<FilterState>` (or `rememberSaveable`) whose
 * `flatMapLatest` re-queries; SwiftUI: `@State var filters` passed to a `.task(id: filters)`.
 */
export function ProductListView({
  scope,
  paused = false,
  header,
  emptyAction,
  emptyFilteredAction,
  emptyCopy,
  emptyFilteredCopy,
  onOpenProduct,
}: Readonly<ProductListViewProps>) {
  const { t } = useTranslation();
  const [params, setParams] = useState<ListParams>(DEFAULT_LIST_PARAMS);
  const sortSheetRef = useRef<AppBottomSheetHandle>(null);
  const advancedSheetRef = useRef<AppBottomSheetHandle>(null);
  const {
    state,
    identity,
    retry,
    retryNextPage,
    isRefreshing,
    onRefresh,
    onViewableItemsChanged,
  } = useProductList(toProductQueryArgs(scope, params), paused);

  const applyParams = (next: ListParams) => {
    if (next === params) {
      return;
    }
    if (__DEV__) {
      console.log(`[products] ${describeParamsForLog(next)}`);
    }
    setParams(next);
  };
  const filtered = hasActiveFilters(params);
  const sortLabel = t(sortLabelKeys[params.sort]);
  // Only brands and subcategories: what the sheet edits. The four chips show their own state.
  const advancedCount = countAdvancedFilters(params);

  const handleSelectSort = (sort: ProductSort) => {
    applyParams(setSort(params, sort));
    // The sheet closes and the button label changes; neither is announced by itself.
    AccessibilityInfo.announceForAccessibility(
      t('productList.sort.applied', { option: t(sortLabelKeys[sort]) }),
    );
  };

  const handleApplyAdvanced = (draft: AdvancedFiltersDraft) => {
    applyParams(applyAdvancedFilters(params, draft));
    // The sheet closes and the counter on the button changes; neither is announced by itself.
    AccessibilityInfo.announceForAccessibility(t('productList.advanced.applied'));
  };

  // When filters caused the emptiness the action is about them ("Clear filters", or the screen's
  // own one); otherwise it is the screen's (go Home, clear the search).
  const resolvedEmptyAction: EmptyAction | undefined = filtered
    ? (emptyFilteredAction ?? {
        label: t('productList.filters.clear'),
        hint: t('productList.filters.clearHint'),
        onPress: () => applyParams(clearFilters(params)),
      })
    : emptyAction;

  // A sheet opens over the keyboard of the search field otherwise (no-op without a keyboard).
  const presentSheet = (sheet: AppBottomSheetHandle | null) => {
    Keyboard.dismiss();
    sheet?.present();
  };

  return (
    <View style={styles.root}>
      <View style={styles.filterBar}>
        <QuickFilters
          leading={[
            {
              key: 'sort',
              node: (
                <AppButton
                  accessibilityHint={t('productList.sort.buttonHint')}
                  label={t('productList.sort.button', { option: sortLabel })}
                  onPress={() => presentSheet(sortSheetRef.current)}
                />
              ),
            },
            {
              key: 'advanced',
              node: (
                <AppButton
                  // The count is in the drawn text too, so it does not depend on color alone.
                  accessibilityHint={t('productList.advanced.buttonHint')}
                  accessibilityLabel={
                    advancedCount === 0
                      ? t('productList.advanced.button')
                      : t('productList.advanced.buttonSpoken', { count: advancedCount })
                  }
                  label={
                    advancedCount === 0
                      ? t('productList.advanced.button')
                      : t('productList.advanced.buttonCount', { count: advancedCount })
                  }
                  onPress={() => presentSheet(advancedSheetRef.current)}
                  variant={advancedCount === 0 ? 'default' : 'primary'}
                />
              ),
            },
          ]}
          onToggle={(key: QuickFilterKey) => applyParams(toggleQuickFilter(params, key))}
          params={params}
        />
      </View>
      {state.status === 'ready' ? (
        <ProductGrid
          // Another list (identity) is another grid: it starts on top and with no recycled cells.
          key={identity}
          footer={
            state.footer === 'idle' ? null : (
              <ProductListFooterRow footer={state.footer} onRetry={retryNextPage} />
            )
          }
          header={
            <View style={styles.header}>
              {header}
              {/* Polite live region: a screen reader announces the total when it appears or changes. */}
              <AppText accessibilityLiveRegion="polite" tone="muted">
                {t('productList.count', { count: state.total })}
              </AppText>
              {state.notice === undefined ? null : (
                <ProductListNoticeRow notice={state.notice} onRetry={retry} />
              )}
            </View>
          }
          isRefreshing={isRefreshing}
          onOpenProduct={onOpenProduct}
          onRefresh={onRefresh}
          onViewableItemsChanged={onViewableItemsChanged}
          products={state.products}
        />
      ) : (
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.statusContent}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled">
          <View style={styles.header}>{header}</View>
          {state.status === 'loading' ? (
            <ProductGridSkeleton />
          ) : (
            <ProductListStatus
              emptyAction={resolvedEmptyAction}
              emptyCopy={filtered ? emptyFilteredCopy : emptyCopy}
              filtered={filtered}
              onRetry={retry}
              status={state.status}
            />
          )}
        </ScrollView>
      )}
      <SortSheet ref={sortSheetRef} onSelect={handleSelectSort} sort={params.sort} />
      <AdvancedFiltersSheet
        ref={advancedSheetRef}
        applied={params}
        category={scope.category}
        onApply={handleApplyAdvanced}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // Same horizontal alignment as the title and the cards: edge padding + the padding of a cell.
  filterBar: {
    paddingHorizontal: GRID_EDGE_PADDING + GRID_CELL_PADDING,
    paddingTop: spacing.xs,
  },
  // The grid pads its container by the screen margin minus the padding of a cell; the header
  // adds that cell padding back so its text lines up with the cards.
  header: {
    gap: spacing.sm,
    paddingHorizontal: GRID_CELL_PADDING,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  statusContent: {
    paddingHorizontal: GRID_EDGE_PADDING,
    paddingBottom: spacing.md,
  },
});
