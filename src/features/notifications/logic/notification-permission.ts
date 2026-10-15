// Can the app post a notification, and may the system dialog still resolve it? (spec 005, RF-23)
//
// Pure and injectable: no React Native and no expo-notifications values, so `test:logic` runs the
// whole Android/iOS matrix. Two layers:
// - `toPermissionInput` maps the REAL response of `getPermissionsAsync`/`requestPermissionsAsync`
//   (expo-notifications 57, read from its Kotlin and Swift sources) onto the classifier input.
// - `classifyNotificationPermission` decides `usable | request | unusable`.
// - `classifyUnusableReason` (RF-39) labels an unusable order `denied-recoverable | blocked`.
//
// Android with a runtime dialog (API 33+), Android without one (API < 33, where "can notify" is only
// `areNotificationsEnabled()`) and iOS (`ios.status`) are the three variants of the matrix.
//
// Compose: `ActivityResultContracts.RequestPermission` + `NotificationManagerCompat.areNotificationsEnabled()`;
// SwiftUI/UIKit: `UNUserNotificationCenter.notificationSettings().authorizationStatus`.

import type { UnusableReason } from '../../orders/logic/order-notification-state.ts';

export type { UnusableReason };

export type NotificationPlatform = 'android' | 'ios';
export type NotificationStatus = 'granted' | 'denied' | 'undetermined' | 'provisional' | 'ephemeral';

export type PermissionInput = Readonly<{
  platform: NotificationPlatform;
  status: NotificationStatus;
  canAskAgain: boolean;
  /** Android only: does this OS version have a runtime dialog (API 33+)? Unknown is treated as no. */
  hasRuntimePrompt?: boolean;
  /** The runtime permission itself is granted (Android), whatever the app-level switch says. */
  runtimeGranted?: boolean;
  /** Injected effective capability (tests of the variant the device does not represent). */
  effective?: boolean;
}>;

export type PermissionDecision =
  | Readonly<{ kind: 'usable' }>
  | Readonly<{ kind: 'request' }>
  | Readonly<{ kind: 'unusable'; canOpenSettings: boolean }>;

/** Effective capability is deliberately separate from whether the OS displayed a prompt. */
export function classifyNotificationPermission(input: PermissionInput): PermissionDecision {
  if (input.status === 'granted' || input.status === 'provisional' || input.status === 'ephemeral' || input.effective === true) return { kind: 'usable' };
  if (canDialogResolve(input)) return { kind: 'request' };
  // The dialog cannot resolve it for this order: Settings is the only way left, on both platforms.
  return { kind: 'unusable', canOpenSettings: true };
}

/**
 * Which text an unusable order shows (RF-39, H-T8-4). Apply it to the LAST reading of the evaluation:
 * the answer of `requestPermissionsAsync` if this order asked, `getPermissionsAsync` otherwise.
 * - `denied-recoverable`: Android with the runtime dialog (API 33+) and the dialog could still resolve
 *   it, i.e. `denied` + `canAskAgain` without the runtime permission granted (first denial). It
 *   never means "ask again for this order": that is decided by the order's request on record (RF-23).
 * - `blocked`: everything else. Android without `canAskAgain` (second denial or "don't ask again"),
 *   without a runtime dialog, or with notifications switched off for the app; iOS in any state (it
 *   asks once, from notDetermined, and that order already used it); and any unknown state.
 * Only meaningful for an input that is not usable.
 *
 * Compose: `shouldShowRequestPermissionRationale()` true after the first denial → recoverable;
 * SwiftUI: `UNAuthorizationStatus.denied` is terminal → blocked.
 */
export function classifyUnusableReason(input: PermissionInput): UnusableReason {
  if (input.platform === 'android' && input.hasRuntimePrompt === true && classifyNotificationPermission(input).kind === 'request') {
    return 'denied-recoverable';
  }
  return 'blocked';
}

function canDialogResolve(input: PermissionInput): boolean {
  if (!input.canAskAgain) return false;
  // iOS asks exactly once, from notDetermined (`undetermined`); after that only Settings can change it.
  if (input.platform === 'ios') return input.status === 'undetermined';
  // Android 13+ reports a fresh install as `denied` + canAskAgain (see `toPermissionInput`), and keeps
  // the dialog available after the first denial, so `denied` + canAskAgain still asks.
  if (input.hasRuntimePrompt !== true) return false;
  // Runtime permission granted but notifications switched off in Settings: no dialog can fix that.
  if (input.runtimeGranted === true) return false;
  return input.status === 'undetermined' || input.status === 'denied';
}

/** The fields of expo-notifications' `NotificationPermissionsStatus` the app reads. */
export type ExpoPermissionResponse = Readonly<{
  status: string;
  granted?: boolean;
  canAskAgain?: boolean;
  ios?: Readonly<{ status?: number }>;
}>;

export type PermissionEnvironment =
  | Readonly<{ platform: 'ios' }>
  | Readonly<{ platform: 'android'; apiLevel?: number }>;

/** `POST_NOTIFICATIONS` became a runtime permission in Android 13 (API 33). */
const ANDROID_RUNTIME_PROMPT_API_LEVEL = 33;

// `IosAuthorizationStatus`: NOT_DETERMINED, DENIED, AUTHORIZED, PROVISIONAL, EPHEMERAL.
const IOS_STATUS: readonly NotificationStatus[] = ['undetermined', 'denied', 'granted', 'provisional', 'ephemeral'];

const GENERIC_STATUS: readonly string[] = ['granted', 'denied', 'undetermined'];

export function toPermissionInput(response: ExpoPermissionResponse, environment: PermissionEnvironment): PermissionInput {
  if (environment.platform === 'ios') {
    // Only `.authorized` becomes top-level `granted`; `.provisional` and `.ephemeral` surface as
    // top-level `undetermined`, so `ios.status` is the source of truth when it is present.
    const iosStatus = response.ios?.status;
    if (iosStatus !== undefined) {
      const status = IOS_STATUS[iosStatus] ?? 'denied';
      return {
        platform: 'ios',
        status,
        // An unknown native value never asks: only a known notDetermined can.
        canAskAgain: IOS_STATUS[iosStatus] === 'undetermined' && response.canAskAgain !== false,
      };
    }
    return { platform: 'ios', status: toGenericStatus(response.status), canAskAgain: knowsStatus(response.status) && response.canAskAgain === true };
  }

  return {
    platform: 'android',
    status: toGenericStatus(response.status),
    canAskAgain: knowsStatus(response.status) && response.canAskAgain === true,
    hasRuntimePrompt: typeof environment.apiLevel === 'number' && environment.apiLevel >= ANDROID_RUNTIME_PROMPT_API_LEVEL,
    runtimeGranted: response.granted === true,
  };
}

function knowsStatus(status: string): boolean {
  return GENERIC_STATUS.includes(status);
}

/** A status this code does not know is treated as denied: never usable, and never asked (see `knowsStatus`). */
function toGenericStatus(status: string): NotificationStatus {
  return knowsStatus(status) ? (status as NotificationStatus) : 'denied';
}
