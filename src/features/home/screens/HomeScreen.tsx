import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, type View } from 'react-native';

import { useReturnFocusToOpener } from '@/core/accessibility/use-return-focus-to-opener';
import { AppSurface, spacing, useAppTheme } from '@/design-system';

import { useNavigationLockout } from '@/features/navigation/use-navigation-lockout';

import { HomeHeader } from '../components/HomeHeader';
import { HomeRowItem } from '../components/HomeRowItem';
import { HOME_GUTTER } from '../home-layout';
import { useBannerRowVisibility } from '../hooks/use-banner-row-visibility';
import { useHome } from '../hooks/use-home';
import { buildHomeRows, type HomeRow } from '../logic/build-home-rows';

// Module-level and closure-free: the list gets the same function on every render.
const keyExtractor = (row: HomeRow) => row.key;

/**
 * Home: the screen state (`loading | ready | empty | offline | error`) becomes a list of rows and
 * the `FlatList` only draws them. All rules (requests, refetch, which rows exist) live in pure
 * modules and in `useHome`; this component presents state and forwards events.
 *
 * Scroll position per tab needs no code here: the tab stays mounted while another is active.
 */
export function HomeScreen() {
  const router = useRouter();
  // Every destination of Home is a singular route: two taps ~100 ms apart must open ONE screen.
  const navigate = useNavigationLockout();
  const { colors } = useAppTheme();
  // The scanner is a MODAL route: when it closes, the screen reader goes back to the scan button
  // (spec 006), not to the title TalkBack finds first.
  const { openerRef: scanButtonRef, markOpening: markScannerOpening } =
    useReturnFocusToOpener<View>();
  const { state, isRefreshing, refetch } = useHome();
  const rows = buildHomeRows(state);
  const { isBannerRowVisible, viewabilityConfig, onViewableItemsChanged } =
    useBannerRowVisibility();

  // Typed routes: the id travels as the dynamic segment and is validated again by the destination.
  const openCategory = (id: string) =>
    navigate(() => router.push({ pathname: '/category/[id]', params: { id } }));
  const openProduct = (id: string) =>
    navigate(() => router.push({ pathname: '/product/[id]', params: { id } }));

  return (
    <AppSurface level="page" style={styles.page}>
      <FlatList
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        data={rows}
        keyExtractor={keyExtractor}
        onViewableItemsChanged={onViewableItemsChanged}
        ListHeaderComponent={
          <HomeHeader
            onScanPress={() =>
              navigate(() => {
                markScannerOpening();
                router.push('/scanner');
              })
            }
            scanButtonRef={scanButtonRef}
            onSearchPress={() => navigate(() => router.push('/search'))}
          />
        }
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={refetch}
            progressBackgroundColor={colors.surface}
            refreshing={isRefreshing}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <HomeRowItem
            isBannerRowVisible={isBannerRowVisible}
            onOpenCategory={openCategory}
            onOpenProduct={openProduct}
            onRetry={refetch}
            row={item}
          />
        )}
        viewabilityConfig={viewabilityConfig}
      />
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: HOME_GUTTER,
  },
});
