import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { resolveDeviceInsightsViewCopy } from '@/core/native/device-insights-view-copy';
import {
  resolveDeviceInsightsMinimumHeight,
  resolveDeviceInsightsViewStyle,
} from '@/core/native/device-insights-view-style';
import {
  formatDeviceInsightsEventSummary,
  initialDeviceInsightsState,
  type DeviceInsightsEvent,
  type DeviceInsightsState,
} from '@/core/native/device-insights-contract';
import { deviceInsights } from '@/core/native/device-insights-native';
import { AppButton, AppSurface, AppText, spacing, useAppTheme } from '@/design-system';
import { DeviceInsightsView } from '../../../../modules/device-insights';

export function DeviceInsightsScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotionPreference();
  const [state, setState] = useState<DeviceInsightsState>(initialDeviceInsightsState);
  const [lastEvent, setLastEvent] = useState<DeviceInsightsEvent>();
  const [nativePress, setNativePress] = useState<string>();
  const [platform] = useState(() => deviceInsights.getPlatform());

  useEffect(() => {
    const subscription = deviceInsights.subscribe(setLastEvent);
    return () => subscription.remove();
  }, []);

  const refresh = async () => {
    if (state.status === 'refreshing') return;
    setState({ status: 'refreshing' });
    const result = await deviceInsights.refresh();
    if (result.status === 'ignored') return;
    setState(result);
  };

  const platformLabel = platform === 'android' ? t('deviceInsights.android') : platform === 'ios' ? t('deviceInsights.ios') : t('deviceInsights.platformUnknown');
  const summary = useMemo(() => lastEvent && formatDeviceInsightsEventSummary(lastEvent, {
    android: t('deviceInsights.android'),
    ios: t('deviceInsights.ios'),
    physical: t('deviceInsights.physical'),
    simulator: t('deviceInsights.simulator'),
  }), [lastEvent, t]);
  const isRefreshing = state.status === 'refreshing';
  const nativeViewCopy = {
    fallbackLabel: t('deviceInsights.nativeLabel'),
    available: t('deviceInsights.nativeAvailable'),
    unavailable: t('deviceInsights.nativeUnavailable'),
    refreshing: t('deviceInsights.nativeRefreshing'),
  };
  const nativeViewText = resolveDeviceInsightsViewCopy(t('deviceInsights.nativeLabel'), nativeViewCopy, { available: true, refreshing: isRefreshing });
  const nativeViewStyle = resolveDeviceInsightsViewStyle(
    state.status === 'error' ? 'error' : state.status === 'success' ? 'success' : 'primary',
    colors,
  );
  const nativeViewMinimumHeight = resolveDeviceInsightsMinimumHeight(fontScale);
  const statusText = state.status === 'idle'
    ? t('deviceInsights.idle')
    : state.status === 'error'
      ? t(state.code === 'native-failure' ? 'deviceInsights.errorNative' : 'deviceInsights.error')
      : state.status === 'success'
        ? t('deviceInsights.success', {
            model: state.data.model,
            version: state.data.systemVersion,
            device: state.data.isPhysical ? t('deviceInsights.physical') : t('deviceInsights.simulator'),
          })
        : t('deviceInsights.refreshing');

  return (
    <AppSurface level="page" style={styles.page}>
      <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
          <View style={styles.heading}>
            <AppText accessibilityRole="header" variant="heading">{t('deviceInsights.title')}</AppText>
            <AppText tone="muted">{t('deviceInsights.subtitle')}</AppText>
          </View>

          <View accessible accessibilityRole="summary" style={styles.card}>
            <AppText accessibilityRole="header" variant="subheading">{t('deviceInsights.syncHeading')}</AppText>
            <AppText>{t('deviceInsights.platform', { platform: platformLabel })}</AppText>
          </View>

          <View style={styles.card}>
            <AppText accessibilityRole="header" variant="subheading">{t('deviceInsights.refreshHeading')}</AppText>
            <AppText accessibilityLiveRegion="polite">{statusText}</AppText>
            <AppButton
              accessibilityHint={t('deviceInsights.refreshHint')}
              disabled={isRefreshing}
              label={isRefreshing ? t('deviceInsights.refreshing') : t('deviceInsights.refresh')}
              onPress={() => void refresh()}
            />
          </View>

          <View style={styles.card}>
            <AppText accessibilityRole="header" variant="subheading">{t('deviceInsights.eventHeading')}</AppText>
            <AppText accessibilityLiveRegion="polite">
              {lastEvent && summary ? t('deviceInsights.event', { summary, timestamp: lastEvent.timestamp }) : t('deviceInsights.noEvent')}
            </AppText>
          </View>

          <View style={styles.card}>
            <AppText accessibilityRole="header" variant="subheading">{t('deviceInsights.viewHeading')}</AppText>
            <DeviceInsightsView
              accent={nativeViewStyle.accent}
              accentColor={nativeViewStyle.accentColor}
              available
              availableLabel={nativeViewCopy.available}
              fallbackLabel={nativeViewCopy.fallbackLabel}
              label={nativeViewText.label}
              onNativePress={(event) => setNativePress(t('deviceInsights.nativePressed', { platform: event.nativeEvent.platform }))}
              refreshing={isRefreshing}
              refreshingLabel={nativeViewCopy.refreshing}
              style={[
                styles.nativeView,
                { minHeight: nativeViewMinimumHeight },
                reducedMotion ? undefined : styles.nativeViewMotion,
              ]}
              unavailableLabel={nativeViewCopy.unavailable}
            />
            {nativePress ? <AppText accessibilityLiveRegion="polite">{nativePress}</AppText> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  safeArea: { flex: 1 },
  content: { gap: spacing.md, padding: spacing.md },
  heading: { gap: spacing.sm },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: 16, borderWidth: 1 },
  nativeView: { width: '100%' },
  nativeViewMotion: { opacity: 1 },
});
