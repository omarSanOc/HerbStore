// The ONLY import of expo-notifications for the order notification: a thin adapter to the port that
// `logic/schedule-order-notification.ts` drives. Nothing here decides anything (spec 005, RF-23–RF-25).
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { NotificationLanguage } from '../logic/notification-payload';
import type { OrderNotificationScheduleResult } from '../logic/order-notification-coordinator';
import { scheduleOrderNotification as runScheduling, type OrderNotificationPort } from '../logic/schedule-order-notification';

export type ScheduleResult = OrderNotificationScheduleResult;

const ORDERS_CHANNEL_ID = 'orders';

// Without a handler the SDK does NOT present a notification that arrives while the app is open
// ("the default behavior when the handler is not set ... is not to show the notification"), and the
// order is confirmed precisely while the app is open. Banner and list only: no sound, no badge.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const port: OrderNotificationPort = {
  ensureChannel: async (name) => {
    await Notifications.setNotificationChannelAsync(ORDERS_CHANNEL_ID, { name, importance: Notifications.AndroidImportance.DEFAULT });
  },
  getPermissions: () => Notifications.getPermissionsAsync(),
  requestPermissions: () => Notifications.requestPermissionsAsync(),
  // `trigger: null` is "now", but on Android it lands in the SDK's fallback channel; a trigger with
  // `channelId` is the immediate form that uses the localized orders channel created above.
  schedule: (content) =>
    Notifications.scheduleNotificationAsync({
      content,
      trigger: Platform.OS === 'android' ? { channelId: ORDERS_CHANNEL_ID } : null,
    }),
};

export function scheduleOrderNotification(
  language: NotificationLanguage,
  options: Readonly<{ requestPermission: boolean }>,
): Promise<ScheduleResult> {
  return runScheduling({
    port,
    env: Platform.OS === 'ios' ? { platform: 'ios' } : { platform: 'android', apiLevel: Number(Platform.Version) },
    language,
    requestPermission: options.requestPermission,
  });
}
