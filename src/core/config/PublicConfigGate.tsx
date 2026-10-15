import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppSurface, AppText, spacing } from '@/design-system';

import { publicConfig, type PublicConfig } from './public-config';

type PublicConfigGateProps = {
  children: ReactNode;
  config?: PublicConfig;
};

/** Stops every catalog provider and navigator before they can mount with unusable configuration. */
export function PublicConfigGate({
  children,
  config = publicConfig,
}: Readonly<PublicConfigGateProps>) {
  const { t } = useTranslation();
  if (config.status === 'ready') return children;

  const messageKey = config.status === 'missing' ? 'config.missingApiOrigin' : 'config.invalidApiOrigin';

  return (
    <AppSurface level="page" style={styles.page}>
      <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.card}>
        <AppText accessibilityRole="header" variant="heading">
          {t('config.title')}
        </AppText>
        <AppText>{t(messageKey)}</AppText>
        <AppText tone="muted">{t('config.help')}</AppText>
      </View>
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    gap: spacing.md,
  },
});
