import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton, AppText, spacing } from '@/design-system';

type HomeStatusRowProps = {
  status: 'empty' | 'offline' | 'error';
  onRetry: () => void;
};

// Three different situations with three different messages: "no connection" is not "the server
// failed", and "nothing to show" is not a failure at all. All of them offer a retry.
const copy = {
  empty: { title: 'home.states.emptyTitle', message: 'home.states.emptyMessage' },
  offline: { title: 'home.states.offlineTitle', message: 'home.states.offlineMessage' },
  error: { title: 'home.states.errorTitle', message: 'home.states.errorMessage' },
} as const;

/** Full-width state with its retry action, inside the list so pull-to-refresh also works here. */
export function HomeStatusRow({ status, onRetry }: Readonly<HomeStatusRowProps>) {
  const { t } = useTranslation();

  return (
    <View style={styles.column}>
      <AppText accessibilityRole="header" variant="subheading">
        {t(copy[status].title)}
      </AppText>
      <AppText tone="muted">{t(copy[status].message)}</AppText>
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
  column: {
    gap: spacing.md,
  },
  action: {
    alignItems: 'flex-start',
  },
});
