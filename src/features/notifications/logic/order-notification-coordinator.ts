import type { UnusableReason } from '../../orders/logic/order-notification-state.ts';

export type OrderNotificationScheduleResult =
  | Readonly<{ kind: 'scheduled'; identifier: string }>
  /** `reason` (RF-39) comes from the last permission reading; the coordinator only forwards it. */
  | Readonly<{ kind: 'unusable'; canOpenSettings: boolean; reason: UnusableReason }>
  | Readonly<{ kind: 'failed'; error: unknown }>;

export type OrderNotificationRunResult = OrderNotificationScheduleResult['kind'] | 'already-notified';

type RunInput = Readonly<{
  orderId: string;
  permissionRequested: boolean;
  notified: boolean;
  schedule: (options: Readonly<{ requestPermission: boolean }>) => Promise<OrderNotificationScheduleResult>;
  onPermissionRequested: () => void;
  onScheduling: () => void;
  onScheduled: () => void;
  onUnusable: (canOpenSettings: boolean, reason: UnusableReason) => void;
  onFailed: () => void;
}>;

export function createOrderNotificationCoordinator() {
  const inFlight = new Map<string, Promise<OrderNotificationRunResult>>();

  return {
    run(input: RunInput): Promise<OrderNotificationRunResult> {
      if (input.notified) return Promise.resolve('already-notified');
      const existing = inFlight.get(input.orderId);
      if (existing) return existing;

      if (!input.permissionRequested) input.onPermissionRequested();
      input.onScheduling();

      const task = Promise.resolve()
        .then(() => input.schedule({ requestPermission: !input.permissionRequested }))
        .then((result): OrderNotificationRunResult => {
          if (result.kind === 'scheduled') input.onScheduled();
          else if (result.kind === 'unusable') input.onUnusable(result.canOpenSettings, result.reason);
          else input.onFailed();
          return result.kind;
        })
        .catch((): OrderNotificationRunResult => {
          input.onFailed();
          return 'failed';
        })
        .finally(() => {
          if (inFlight.get(input.orderId) === task) inFlight.delete(input.orderId);
        });

      inFlight.set(input.orderId, task);
      return task;
    },
  };
}
