import { createListenerMiddleware } from '@reduxjs/toolkit';

import type { OrderHistoryState } from '../../orders/logic/order-history.ts';
import {
  notificationFailed,
  notificationPermissionRequested,
  notificationRetryRequested,
  notificationScheduled,
  notificationScheduling,
  notificationUnusable,
  orderRecorded,
} from '../../orders/store/order-history-slice.ts';
import type { NotificationLanguage } from '../logic/notification-payload.ts';
import { createOrderNotificationCoordinator, type OrderNotificationScheduleResult } from '../logic/order-notification-coordinator.ts';

type StateWithOrders = Readonly<{ orderHistory: OrderHistoryState }>;

type Dependencies = Readonly<{
  /** The native boundary: resolves a discriminated result and is allowed to reject or throw. */
  schedule: (language: NotificationLanguage, options: Readonly<{ requestPermission: boolean }>) => Promise<OrderNotificationScheduleResult>;
  getLanguage: () => NotificationLanguage;
}>;

/**
 * Notifies a confirmed order once (spec 005, RF-23, RF-25). It runs AFTER the reducer accepted
 * `orderRecorded` or an explicit retry, so the notification is never a requirement to confirm.
 *
 * - A response that repeats an order already in the local history (idempotent recovery) does nothing:
 *   `getOriginalState()` already contains it.
 * - A retry for an order that is not in the history does nothing.
 * - The access request is recorded by the coordinator BEFORE the system is invoked, and `notified`
 *   only after the scheduler succeeded. The marks live in the persisted order history.
 * - One operation per order id at a time (the coordinator shares the in-flight promise).
 *
 * The native call is injected so the rule runs in Node with the real slice; `order-notification-listener.ts`
 * is the app wiring. Compose: a collector of `orders` in an app-scoped `CoroutineScope`; SwiftUI: an
 * observer app-scoped `Task` — the effect starts after the state change is accepted.
 */
export function createOrderNotificationListener(dependencies: Dependencies) {
  const listener = createListenerMiddleware();
  const coordinator = createOrderNotificationCoordinator();

  listener.startListening({
    predicate: (action) => orderRecorded.match(action) || notificationRetryRequested.match(action),
    effect: async (action, api) => {
      const isRetry = notificationRetryRequested.match(action);
      const orderId = isRetry ? action.payload : orderRecorded.match(action) ? action.payload.id : undefined;
      if (!orderId) return;
      if (!isRetry && (api.getOriginalState() as StateWithOrders).orderHistory.orders.some((order) => order.id === orderId)) return;

      const { orders, notifications } = (api.getState() as StateWithOrders).orderHistory;
      if (!orders.some((order) => order.id === orderId)) return;
      const record = notifications.records[orderId];
      if (record?.notified) return;

      await coordinator.run({
        orderId,
        permissionRequested: record?.permissionRequested === true,
        notified: record?.notified === true,
        schedule: (options) => dependencies.schedule(dependencies.getLanguage(), options),
        onPermissionRequested: () => api.dispatch(notificationPermissionRequested(orderId)),
        onScheduling: () => api.dispatch(notificationScheduling(orderId)),
        onScheduled: () => api.dispatch(notificationScheduled(orderId)),
        onUnusable: (canOpenSettings, reason) => api.dispatch(notificationUnusable({ orderId, canOpenSettings, reason })),
        onFailed: () => api.dispatch(notificationFailed(orderId)),
      });
    },
  });

  return listener;
}
