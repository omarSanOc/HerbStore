// The sequence behind "notify this order" (spec 005, RF-23, RF-24, RF-25), free of the native module.
//
// `native/order-notifications.ts` is the only file that imports expo-notifications; it implements
// `OrderNotificationPort`. Everything that decides something lives here, so `test:logic` runs it:
// 1. Android: create the channel BEFORE reading or requesting the permission (on API 33+ the system
//    dialog does not appear until the app has a channel).
// 2. Read the effective capability and classify it (`notification-permission.ts`).
// 3. Ask the system AT MOST ONCE per order: only when the classifier says the dialog can still
//    resolve it AND the caller says this order has no request yet. Otherwise the result is
//    `unusable` and Settings is offered, labelled `denied-recoverable | blocked` (RF-39) from the
//    last permission reading.
// 4. Schedule the immediate, closed-shape content. Anything that throws becomes `failed`, never a throw.
//
// Compose: `NotificationManager.createNotificationChannel` + `ActivityResultContracts.RequestPermission`
// + `NotificationManagerCompat.notify`; SwiftUI: `UNUserNotificationCenter.requestAuthorization` +
// `add(UNNotificationRequest)`.

import { buildNotificationContent, notificationChannelName, type NotificationLanguage } from './notification-payload.ts';
import { classifyNotificationPermission, classifyUnusableReason, toPermissionInput, type ExpoPermissionResponse, type PermissionEnvironment } from './notification-permission.ts';
import type { OrderNotificationScheduleResult } from './order-notification-coordinator.ts';

export type OrderNotificationContent = Readonly<{ title: string; body: string; data: Readonly<{ destination: 'home' }> }>;

export type OrderNotificationPort = Readonly<{
  /** Android: create or rename the orders channel. iOS: nothing to do. */
  ensureChannel: (name: string) => Promise<void>;
  getPermissions: () => Promise<ExpoPermissionResponse>;
  requestPermissions: () => Promise<ExpoPermissionResponse>;
  /** Schedules an immediate notification and resolves its identifier. */
  schedule: (content: OrderNotificationContent) => Promise<string>;
}>;

export async function scheduleOrderNotification(input: Readonly<{
  port: OrderNotificationPort;
  env: PermissionEnvironment;
  language: NotificationLanguage;
  /** False when this order already has its (single) access request on record. */
  requestPermission: boolean;
}>): Promise<OrderNotificationScheduleResult> {
  const { port, env, language, requestPermission } = input;
  try {
    if (env.platform === 'android') await port.ensureChannel(notificationChannelName(language));

    // `permission` is always the LAST reading of this evaluation: RF-39 labels it, never an older one.
    let permission = toPermissionInput(await port.getPermissions(), env);
    let decision = classifyNotificationPermission(permission);
    if (decision.kind === 'request' && requestPermission) {
      permission = toPermissionInput(await port.requestPermissions(), env);
      decision = classifyNotificationPermission(permission);
    }
    // `request` here means the system COULD ask but this order already used its request: the
    // honest state is "unusable" with Settings, never a claim that a new dialog was shown. The
    // reason only chooses the text (recoverable vs blocked); both keep Settings and the retry.
    if (decision.kind !== 'usable') return { kind: 'unusable', canOpenSettings: true, reason: classifyUnusableReason(permission) };

    return { kind: 'scheduled', identifier: await port.schedule(buildNotificationContent(language)) };
  } catch (error) {
    return { kind: 'failed', error };
  }
}
