import { useCallback, useState } from 'react';
import type { FlatListProps, ViewToken } from 'react-native';

import type { HomeRow } from '../logic/build-home-rows';

/** Key of the banner row (`HomeRow.key`); `FlatList` reports viewable rows by their key. */
const BANNER_ROW_KEY: HomeRow['key'] = 'banners';

/**
 * Module-level on purpose: `FlatList` does not support changing `viewabilityConfig` after mount
 * (it throws an invariant), so there must be exactly one object. 50 % means "most of the row is
 * on screen"; a row that peeks at the edge does not count as being watched.
 */
const viewabilityConfig: NonNullable<FlatListProps<HomeRow>['viewabilityConfig']> = {
  itemVisiblePercentThreshold: 50,
};

/**
 * Is the banner row inside Home's vertical viewport? The answer for the autoplay of RF-13
 * ("carrusel fuera de pantalla"): navigation focus cannot tell it, because a carousel scrolled
 * away is still on the focused screen.
 *
 * The result is spread onto Home's `FlatList`. `onViewableItemsChanged` is wrapped in
 * `useCallback` because the list's contract asks for a stable callback (it also may not switch
 * between defined and `undefined`); this is a correctness reason, not a performance one. It reads
 * no state, so it has no dependencies and never changes.
 *
 * Compose: `LazyListState.layoutInfo.visibleItemsInfo` / `snapshotFlow`; SwiftUI: `onAppear` /
 * `onDisappear` of a row inside a `LazyVStack`.
 */
export function useBannerRowVisibility() {
  const [isBannerRowVisible, setIsBannerRowVisible] = useState(false);

  const onViewableItemsChanged = useCallback(
    ({
      viewableItems,
      changed,
    }: {
      viewableItems: ViewToken<HomeRow>[];
      changed: ViewToken<HomeRow>[];
    }) => {
      // `viewableItems` is the full current set: the answer never depends on what came before.
      const visible = viewableItems.some((token) => token.key === BANNER_ROW_KEY);
      setIsBannerRowVisible(visible);
      if (__DEV__ && changed.some((token) => token.key === BANNER_ROW_KEY)) {
        console.log(`[BannerAutoplay] banner row ${visible ? 'visible' : 'not visible'}`);
      }
    },
    [],
  );

  return { isBannerRowVisible, viewabilityConfig, onViewableItemsChanged };
}
