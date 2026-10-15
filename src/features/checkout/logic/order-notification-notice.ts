import type { OrderNotificationRecord } from '../../orders/logic/order-notification-state.ts';

/**
 * Notice shown on the order confirmation while the order is not notified (RF-23 to RF-25, RF-39).
 *
 * The screen only paints what this returns; every decision lives here so it is tested in Node.
 * - `null`: the order is notified; the screen hides the whole block.
 * - Both unusable categories (`denied-recoverable` and `blocked`) offer the SAME actions,
 *   Settings and retry; only the text changes (RF-39).
 * - There is deliberately no "ask again" action: the order already used its single permission
 *   request (RF-23), so a retry only re-evaluates and schedules if the system now allows it.
 * - The category is the one stored with the record (the LAST evaluation of that order), not a
 *   fresh system read, so it survives restarts and never needs async work in the UI.
 */
export type NotificationNoticeKey =
  | 'checkout.confirmation.notificationDeniedRecoverable'
  | 'checkout.confirmation.notificationUnavailableSettings'
  | 'checkout.confirmation.notificationFailed'
  | 'checkout.confirmation.notificationRetrying'
  | 'checkout.confirmation.notificationPending';

export type NotificationNotice = Readonly<{
  messageKey: NotificationNoticeKey;
  showSettings: boolean;
  showRetry: boolean;
  /** The retry button is shown disabled and busy while a schedule is in flight. */
  retrying: boolean;
}>;

const notice = (messageKey: NotificationNoticeKey, showSettings: boolean, retrying = false): NotificationNotice => ({
  messageKey,
  showSettings,
  showRetry: true,
  retrying,
});

export function buildNotificationNotice(record: OrderNotificationRecord | undefined): NotificationNotice | null {
  if (record?.notified === true) return null;
  switch (record?.status) {
    case 'unusable':
      // A missing reason (corrupt or legacy record) uses the conservative "blocked" text.
      return notice(
        record.unusableReason === 'denied-recoverable'
          ? 'checkout.confirmation.notificationDeniedRecoverable'
          : 'checkout.confirmation.notificationUnavailableSettings',
        true,
      );
    case 'failed':
      return notice('checkout.confirmation.notificationFailed', false);
    case 'scheduling':
      return notice('checkout.confirmation.notificationRetrying', false, true);
    default:
      return notice('checkout.confirmation.notificationPending', false);
  }
}
