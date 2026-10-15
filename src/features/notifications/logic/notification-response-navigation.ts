import { isHomeNotificationPayload } from './notification-payload.ts';

export type NotificationResponseCandidate = Readonly<{ identifier: string; data: unknown }>;
export type NotificationResponseDecision = 'navigate' | 'ignored' | 'duplicate';

const MAX_CONSUMED_RESPONSES = 32;

/** Deduplicates the native initial value and active event by notification request identity. */
export function createNotificationResponseDeduplicator() {
  const consumed = new Set<string>();

  return {
    consume(response: NotificationResponseCandidate): NotificationResponseDecision {
      if (consumed.has(response.identifier)) return 'duplicate';
      consumed.add(response.identifier);
      if (consumed.size > MAX_CONSUMED_RESPONSES) {
        const oldest = consumed.values().next().value;
        if (typeof oldest === 'string') consumed.delete(oldest);
      }
      return isHomeNotificationPayload(response.data) ? 'navigate' : 'ignored';
    },
  };
}
