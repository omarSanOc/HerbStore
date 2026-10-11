import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';

import { AppSurface, spacing, useAppTheme } from '@/design-system';

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
  const { colors } = useAppTheme();
  const { state, isRefreshing, refetch } = useHome();
  const rows = buildHomeRows(state);
  const { isBannerRowVisible, viewabilityConfig, onViewableItemsChanged } =
    useBannerRowVisibility();

  // Typed routes: the id travels as the dynamic segment and is validated again by the destination.
  const openCategory = (id: string) => router.push({ pathname: '/category/[id]', params: { id } });
  const openProduct = (id: string) => router.push({ pathname: '/product/[id]', params: { id } });

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
            onScanPress={() => router.push('/scanner')}
            onSearchPress={() => router.push('/search')}
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
