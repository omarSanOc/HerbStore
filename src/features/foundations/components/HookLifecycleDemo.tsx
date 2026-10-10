import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton, AppText, spacing } from '@/design-system';

const TICK_INTERVAL_MS = 1000;

type LifecycleTimerProps = {
  isRunning: boolean;
};

function LifecycleTimer({ isRunning }: Readonly<LifecycleTimerProps>) {
  const { t } = useTranslation();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }

    if (__DEV__) {
      console.log('[LifecycleTimer] effect: interval started');
    }
    const intervalId = setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, TICK_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      if (__DEV__) {
        console.log('[LifecycleTimer] cleanup: interval cleared');
      }
    };
  }, [isRunning]);

  return (
    <View style={styles.group}>
      <AppText>{t('foundations.hooks.elapsed', { seconds: elapsedSeconds })}</AppText>
      <AppText tone="muted">
        {isRunning ? t('foundations.hooks.timerRunning') : t('foundations.hooks.timerPaused')}
      </AppText>
    </View>
  );
}

export function HookLifecycleDemo() {
  const { t } = useTranslation();
  const [tapCount, setTapCount] = useState(0);
  const [isTimerMounted, setIsTimerMounted] = useState(true);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  if (__DEV__) {
    console.log('[HookLifecycleDemo] render', { tapCount, isTimerMounted, isTimerRunning });
  }

  return (
    <View style={styles.container}>
      <View style={styles.group}>
        <AppText>{t('foundations.hooks.tapCount', { count: tapCount })}</AppText>
        <View style={styles.buttonRow}>
          <AppButton
            accessibilityHint={t('foundations.hooks.addTapHint')}
            label={t('foundations.hooks.addTap')}
            onPress={() => setTapCount((current) => current + 1)}
          />
        </View>
      </View>

      <View style={styles.group}>
        {isTimerMounted ? (
          <LifecycleTimer isRunning={isTimerRunning} />
        ) : (
          <AppText tone="muted">{t('foundations.hooks.timerUnmounted')}</AppText>
        )}
        <View style={styles.buttonRow}>
          <AppButton
            accessibilityHint={t('foundations.hooks.toggleRunningHint')}
            disabled={!isTimerMounted}
            label={
              isTimerRunning ? t('foundations.hooks.pauseTimer') : t('foundations.hooks.startTimer')
            }
            onPress={() => setIsTimerRunning((current) => !current)}
          />
          <AppButton
            accessibilityHint={t('foundations.hooks.toggleMountedHint')}
            label={
              isTimerMounted ? t('foundations.hooks.hideTimer') : t('foundations.hooks.showTimer')
            }
            onPress={() => {
              setIsTimerMounted((current) => !current);
              setIsTimerRunning(false);
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  group: {
    gap: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
