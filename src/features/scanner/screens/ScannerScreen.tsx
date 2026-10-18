import { CameraView } from 'expo-camera';
import { Linking, ScrollView, StyleSheet } from 'react-native';
import { useEffect, type ReactNode } from 'react';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppSurface, AppText, fontScaleLimits, spacing } from '@/design-system';
import { useGoBackOrHome } from '@/features/navigation/use-go-back-or-home';

import { useScannerController } from '../hooks/use-scanner-controller';
import { getScannerViewState, isScannerFailureKind, scannerFailureTitleKey, shouldMountScannerCamera } from '../logic/scanner-view-state';
import { SCANNER_SEARCH_ROUTE } from '../logic/scanner-navigation';

export function ScannerScreen() {
  const { t } = useTranslation();
  const close = useGoBackOrHome();
  const controller = useScannerController();
  const router = useRouter();
  const { state, navigationFailed, navigationSucceeded, retryNavigation } = controller;
  const view = getScannerViewState(state);
  const cameraMounted = shouldMountScannerCamera(state, controller.cameraActive);
  const cancelAndClose = () => {
    controller.cancel();
    close();
  };
  const cancelAndSearch = () => {
    controller.cancel();
    router.replace(SCANNER_SEARCH_ROUTE as Href);
  };

  useEffect(() => {
    if (state.kind !== 'navigating') return;
    try {
      router.push(`/scanner/product/${state.product.id}` as Href);
      navigationSucceeded();
    } catch {
      navigationFailed();
    }
  }, [navigationFailed, navigationSucceeded, router, state]);

  if (state.kind === 'preview') {
    return (
      <MessageScreen title={t('scanner.heading')} message={t('scanner.preview')}>
        <AppButton accessibilityHint={t('scanner.continueHint')} label={t('scanner.continue')} onPress={controller.confirm} variant="primary" />
        <AppButton accessibilityHint={t('scanner.closeHint')} label={t('scanner.close')} onPress={close} />
      </MessageScreen>
    );
  }

  if (cameraMounted) {
    return (
      <ScannerPage>
        <AppText accessibilityLiveRegion="polite" accessibilityRole="header" maxFontSizeMultiplier={fontScaleLimits.screenTitle} variant="subheading">
          {state.kind === 'querying' ? t('scanner.querying') : state.kind === 'mounting-camera' ? t('scanner.permission') : t('scanner.ready')}
        </AppText>
        <CameraView
          active={controller.cameraActive}
          barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
          facing="back"
          mute
          onBarcodeScanned={(result) => controller.readCode(result.data)}
          onCameraReady={controller.cameraReady}
          onMountError={(error) => controller.mountError(error.message)}
          style={styles.camera}
        />
        <AppButton accessibilityHint={t('scanner.cancelHint')} label={t('scanner.cancel')} onPress={cancelAndClose} />
      </ScannerPage>
    );
  }

  const title = state.kind === 'invalid-code' ? t('scanner.invalid')
    : state.kind === 'not-found' ? t('scanner.notFound')
      : state.kind === 'unavailable' ? t('scanner.unavailable')
           : state.kind === 'navigating' ? t('scanner.found')
             : state.kind === 'navigation-error' ? t('scanner.navigationError')
          // "No connection" is news only while the device has not reported coming back; afterwards the
          // title says so, because the lookup is NOT retried by itself and the old text would lie.
          : state.kind === 'offline' && controller.isOnline ? t('scanner.reconnected')
          : isScannerFailureKind(state.kind) ? t(scannerFailureTitleKey(state.kind))
            : t('scanner.heading');

  return (
    <MessageScreen title={title} message={state.kind === 'unavailable' ? t('scanner.permission') : state.kind === 'navigation-error' ? t('scanner.navigationErrorMessage') : t('scanner.body')}>
      {state.kind === 'checking-permission' ? <AppText accessibilityLiveRegion="polite">{t('scanner.permission')}</AppText> : null}
      {state.kind === 'invalid-code' || state.kind === 'not-found' ? (
        <AppButton accessibilityHint={t('scanner.scanAgainHint')} label={state.kind === 'invalid-code' ? t('scanner.accept') : t('scanner.scanAgain')} onPress={controller.rearm} variant="primary" />
      ) : null}
      {state.kind === 'unavailable' ? (
        <>
          <AppButton accessibilityHint={t('scanner.searchHint')} label={t('scanner.search')} onPress={cancelAndSearch} variant="primary" />
          <AppButton accessibilityHint={t('scanner.openSettingsHint')} label={t('scanner.openSettings')} onPress={() => void Linking.openSettings()} />
        </>
      ) : null}
      {state.kind === 'navigation-error' ? <AppButton accessibilityHint={t('scanner.retryNavigationHint')} label={t('scanner.retryNavigation')} onPress={retryNavigation} variant="primary" /> : null}
      {view.actions.retry ? <AppButton accessibilityHint={t('scanner.retryHint')} label={t('scanner.retry')} onPress={controller.retry} variant="primary" /> : null}
      {view.actions.cancel || state.kind === 'checking-permission' ? <AppButton accessibilityHint={t('scanner.cancelHint')} label={t('scanner.cancel')} onPress={cancelAndClose} /> : null}
    </MessageScreen>
  );
}

/**
 * Frame shared by every state of the scanner (camera, messages, preview). The scanner is a modal
 * with NO tab bar, and the app draws edge-to-edge: without this the bottom button ("Cancel") lands
 * under the system navigation bar (Android) or the home indicator (iOS) and cannot be pressed. The
 * header of the inner stack already covers the TOP inset, so only bottom/left/right are asked for.
 * `SafeAreaView` adds the native inset to the padding of its `style` ("additive" mode).
 *
 * `scrollable` is for the states that are TEXT and buttons (`MessageScreen`): at a large font the
 * title, the message and the actions are taller than the screen (iOS AX5: "Continue" and "Close" were
 * below the edge with nothing to scroll), so they live in a `ScrollView`. The camera state is not
 * scrollable: the preview takes the free height (`flex: 1`) and its button stays in view.
 */
function ScannerPage({ children, scrollable = false }: { children: ReactNode; scrollable?: boolean }) {
  return (
    <AppSurface level="page" style={styles.page}>
      <SafeAreaView edges={['bottom', 'left', 'right']} style={scrollable ? styles.page : styles.content}>
        {scrollable ? <ScrollView contentContainerStyle={styles.messageContent} testID="scanner-message-scroll">{children}</ScrollView> : children}
      </SafeAreaView>
    </AppSurface>
  );
}

function MessageScreen({ title, message, children }: { title: string; message: string; children: ReactNode }) {
  return (
    <ScannerPage scrollable>
      <AppText accessibilityRole="header" maxFontSizeMultiplier={fontScaleLimits.screenTitle} variant="subheading">{title}</AppText>
      <AppText accessibilityLiveRegion="polite">{message}</AppText>
      {children}
    </ScannerPage>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flex: 1, gap: spacing.md, padding: spacing.md },
  messageContent: { gap: spacing.md, padding: spacing.md },
  camera: { flex: 1, minHeight: 240, borderRadius: 12 },
});
