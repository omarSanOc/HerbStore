import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton, AppText, radii, spacing, useAppTheme } from '@/design-system';

import type { HomeNotice } from '../logic/classify-home-result';

type HomeNoticeRowProps = {
  notice: HomeNotice;
  onRetry: () => void;
};

/**
 * Warning above data that is kept after a failed refresh. The text is a polite live region so the
 * screen reader announces it when it appears; the retry button gives non-touch users an
 * alternative to the pull gesture.
 */
export function HomeNoticeRow({ notice, onRetry }: Readonly<HomeNoticeRowProps>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppText accessibilityLiveRegion="polite" accessibilityRole="alert">
        {t(notice === 'offline' ? 'home.notice.offline' : 'home.notice.updateFailed')}
      </AppText>
      <View style={styles.action}>
        <AppButton
          accessibilityHint={t('home.states.retryHint')}
          label={t('home.states.retry')}
          onPress={onRetry}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  action: {
    alignItems: 'flex-start',
  },
});
