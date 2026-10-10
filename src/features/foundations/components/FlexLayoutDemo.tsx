import { PixelRatio, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, radii, sizes, spacing, useAppTheme } from '@/design-system';

export type FlexDirectionOption = 'row' | 'column';

type FlexLayoutDemoProps = {
  direction: FlexDirectionOption;
};

const flexTiles = [
  { id: 'start', flex: 1 },
  { id: 'center', flex: 2 },
  { id: 'end', flex: 1 },
] as const;

export function FlexLayoutDemo({ direction }: Readonly<FlexLayoutDemoProps>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const pixelRatio = PixelRatio.get();

  if (__DEV__) {
    console.log('[FlexLayoutDemo] render', { direction });
  }

  return (
    <View style={styles.container}>
      <View
        accessibilityLabel={t('foundations.layout.containerLabel', {
          direction:
            direction === 'row' ? t('foundations.layout.row') : t('foundations.layout.column'),
        })}
        style={[
          styles.track,
          direction === 'row' ? styles.trackRow : styles.trackColumn,
          { borderColor: colors.border },
        ]}>
        {flexTiles.map((tile) => (
          <View
            accessible
            accessibilityLabel={t('foundations.layout.tileLabel', { flex: tile.flex })}
            key={tile.id}
            style={[styles.tile, { flex: tile.flex, backgroundColor: colors.primary }]}>
            <AppText tone="onPrimary" variant="label">
              {`${tile.flex}×`}
            </AppText>
          </View>
        ))}
      </View>
      <AppText tone="muted">{t('foundations.layout.density', { ratio: pixelRatio })}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  track: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  trackColumn: {
    flexDirection: 'column',
    // A column needs a bounded main axis for flex ratios to be visible.
    height: 5 * sizes.minimumTouchTarget,
  },
  tile: {
    minHeight: sizes.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    borderCurve: 'continuous',
  },
});
