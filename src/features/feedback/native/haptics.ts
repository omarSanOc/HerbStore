import * as Haptics from 'expo-haptics';

/**
 * The only import of `expo-haptics` (SDK 57). `impactAsync(Light)` is a `UIImpactFeedbackGenerator`
 * on iOS and a short `Vibrator` waveform on Android (needs the `VIBRATE` permission that the module
 * itself declares). The promise can reject (no actuator, module missing); the caller
 * (`createCartFeedbackListener`) absorbs that through `runOptionalFeedback`, so nothing here can
 * touch the cart.
 *
 * Alternative chosen: `impactAsync` on both platforms, one call, the same "light" intent.
 * Trade-off: on Android it goes through the Vibrator service, which Expo's docs call less
 * recommended than the view haptics. Discarded: `performAndroidHapticsAsync(AndroidHaptics.*)`
 * (Android only, depends on the system "touch feedback" setting and needs a `Platform.select`).
 */
export function requestLightImpact(): Promise<void> {
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}
