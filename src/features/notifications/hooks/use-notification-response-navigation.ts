import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { goHome } from '../logic/go-home';
import { createNotificationResponseDeduplicator } from '../logic/notification-response-navigation';

// The hook can remount while the native "last response" still points at the same tap.
const responseDeduplicator = createNotificationResponseDeduplicator();

/**
 * A tap on the order notification opens Home, in a cold start (the native "last response" read once)
 * and with the app active (the subscription). Both paths go through one deduplicator keyed by the
 * notification request id, accept only the closed `{ destination: 'home' }` payload, and clear the
 * native response once read so it cannot navigate again. `goHome` explains how Home is reached.
 *
 * Compose: the `PendingIntent` of the notification starts the Activity (`onCreate` intent = cold,
 * `onNewIntent` = active); SwiftUI: `UNUserNotificationCenterDelegate.userNotificationCenter(_:didReceive:)`.
 */
export function useNotificationResponseNavigation() {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    const navigate = (source: 'initial' | 'active', response: Notifications.NotificationResponse | null) => {
      if (!active || !response) return;
      const decision = responseDeduplicator.consume({
        identifier: response.notification.request.identifier,
        data: response.notification.request.content.data,
      });
      try {
        Notifications.clearLastNotificationResponse();
      } catch {
        // Dedupe still prevents a stale native response from navigating twice this process.
      }
      if (__DEV__) console.log(`[notifications] tap source=${source} decision=${decision}`);
      if (decision === 'navigate') goHome(router);
    };
    try {
      navigate('initial', Notifications.getLastNotificationResponse());
    } catch {
      // The native module is unavailable: the active subscription below is all there is.
    }
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => navigate('active', response));
    return () => {
      active = false;
      subscription.remove();
    };
  }, [router]);
}
