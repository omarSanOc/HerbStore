import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { I18nextProvider, useTranslation } from 'react-i18next';

import { i18n } from '@/core/i18n';
import {
  AppButton,
  AppSurface,
  AppText,
  AppThemeProvider,
  sizes,
  spacing,
} from '@/design-system';

type GlobalErrorContentProps = {
  retry: () => Promise<void>;
};

function GlobalErrorContent({ retry }: Readonly<GlobalErrorContentProps>) {
  const router = useRouter();
  const { t } = useTranslation();

  const handleRetry = () => {
    void retry();
  };

  const handleGoHome = () => {
    // Clear the installed boundary first. If the old route throws again, its fresh fallback is
    // committed before the next task replaces that route with Home and unmounts its local state.
    void retry().then(() => {
      setTimeout(() => router.replace('/'), 0);
    });
  };

  return (
    <AppSurface
      accessibilityViewIsModal
      importantForAccessibility="yes"
      level="page"
      style={styles.page}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.copy}>
            <AppText accessibilityRole="header" variant="heading">
              {t('errorBoundary.title')}
            </AppText>
            <AppText tone="muted">{t('errorBoundary.message')}</AppText>
          </View>
          <View style={styles.actions}>
            <AppButton
              accessibilityHint={t('errorBoundary.retryHint')}
              label={t('errorBoundary.retry')}
              onPress={handleRetry}
              variant="primary"
            />
            <AppButton
              accessibilityHint={t('errorBoundary.goHomeHint')}
              label={t('errorBoundary.goHome')}
              onPress={handleGoHome}
            />
          </View>
        </View>
      </SafeAreaView>
    </AppSurface>
  );
}

type GlobalErrorScreenProps = {
  retry: () => Promise<void>;
};

/**
 * The root route's boundary replaces RootLayout, so its theme and translation providers must live
 * inside the fallback rather than relying on the providers that just failed.
 */
export function GlobalErrorScreen({ retry }: Readonly<GlobalErrorScreenProps>) {
  return (
    <I18nextProvider i18n={i18n}>
      <AppThemeProvider>
        <StatusBar style="auto" />
        <GlobalErrorContent retry={retry} />
      </AppThemeProvider>
    </I18nextProvider>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: sizes.contentMaxWidth,
    alignSelf: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xl,
  },
  copy: {
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.md,
  },
});
