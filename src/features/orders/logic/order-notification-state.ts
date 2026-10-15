// Notification marks of each local order (spec 005, RF-23, RF-25, RF-39), persisted with the history.
//
// Pure transitions over immutable records: every function returns a NEW state.
// `unusableReason` (RF-39) is the category of the LAST evaluation of that order:
// - `denied-recoverable`: Android with the runtime dialog, the user said no, and the system could still
//   show the dialog again (never for this order: its single request is already on record, RF-23).
// - `blocked`: anything else that is unusable; only the system Settings can change it.
// It exists only while `status === 'unusable'`; every other transition removes it, so a retry always
// shows its own new evaluation. It is a label, never personal data (RNF-1).
//
// The type lives here (not in `notifications/`) so `orders → notifications` never becomes a cycle:
// `notification-permission.ts` imports it.

export type OrderNotificationStatus = 'idle' | 'scheduling' | 'unusable' | 'failed' | 'scheduled';

export const UNUSABLE_REASONS = ['denied-recoverable', 'blocked'] as const;
export type UnusableReason = (typeof UNUSABLE_REASONS)[number];

export type OrderNotificationRecord = Readonly<{
  permissionRequested: boolean;
  notified: boolean;
  status: OrderNotificationStatus;
  canOpenSettings: boolean;
  /** Present only with `status === 'unusable'`. */
  unusableReason?: UnusableReason;
}>;
export type OrderNotificationState = Readonly<{ records: Readonly<Record<string, OrderNotificationRecord>> }>;
export const emptyOrderNotificationState: OrderNotificationState = { records: {} };

const emptyRecord = (): OrderNotificationRecord => ({ permissionRequested: false, notified: false, status: 'idle', canOpenSettings: false });

export function isUnusableReason(value: unknown): value is UnusableReason {
  return typeof value === 'string' && (UNUSABLE_REASONS as readonly string[]).includes(value);
}

/** The record without its reason: the key itself is removed, not set to `undefined`. */
function withoutReason(record: OrderNotificationRecord): OrderNotificationRecord {
  const { unusableReason: _dropped, ...rest } = record;
  return rest;
}

function update(
  state: OrderNotificationState,
  orderId: string,
  change: (current: OrderNotificationRecord) => OrderNotificationRecord,
): OrderNotificationState {
  const current = state.records[orderId] ?? emptyRecord();
  return { records: { ...state.records, [orderId]: change(current) } };
}

export function markPermissionRequested(state: OrderNotificationState, orderId: string): OrderNotificationState {
  return update(state, orderId, (current) => ({ ...current, permissionRequested: true }));
}

export function markNotificationScheduled(state: OrderNotificationState, orderId: string): OrderNotificationState {
  return update(state, orderId, (current) => ({ ...withoutReason(current), notified: true, status: 'scheduled', canOpenSettings: false }));
}

export function markNotificationScheduling(state: OrderNotificationState, orderId: string): OrderNotificationState {
  return update(state, orderId, (current) => ({ ...withoutReason(current), status: 'scheduling', canOpenSettings: false }));
}

export function markNotificationUnusable(
  state: OrderNotificationState,
  orderId: string,
  canOpenSettings: boolean,
  reason: UnusableReason,
): OrderNotificationState {
  return update(state, orderId, (current) => ({ ...current, status: 'unusable', canOpenSettings, unusableReason: reason }));
}

export function markNotificationFailed(state: OrderNotificationState, orderId: string): OrderNotificationState {
  return update(state, orderId, (current) => ({ ...withoutReason(current), status: 'failed', canOpenSettings: false }));
}

/**
 * Storage is outside the app's control. Records of orders that are not in the history are dropped,
 * a transient `scheduling` becomes `idle`, and an `unusable` record without a valid reason (a v2
 * record, or a corrupt one) counts as `blocked`: the conservative text the v2 build already showed.
 */
export function sanitizeOrderNotificationState(stored: unknown, orderIds: readonly string[]): OrderNotificationState {
  const source = stored && typeof stored === 'object' && 'records' in stored && stored.records && typeof stored.records === 'object' ? stored.records as Record<string, unknown> : {};
  const allowed = new Set(orderIds);
  const records: Record<string, OrderNotificationRecord> = {};
  for (const [id, value] of Object.entries(source)) {
    if (!allowed.has(id) || !value || typeof value !== 'object') continue;
    const item = value as Record<string, unknown>;
    if (typeof item.permissionRequested !== 'boolean' || typeof item.notified !== 'boolean') continue;
    const storedStatus = item.status;
    const status: OrderNotificationStatus = item.notified
      ? 'scheduled'
      : storedStatus === 'unusable' || storedStatus === 'failed'
        ? storedStatus
        : 'idle';
    const record: OrderNotificationRecord = {
      permissionRequested: item.permissionRequested,
      notified: item.notified,
      status,
      canOpenSettings: status === 'unusable' && item.canOpenSettings === true,
    };
    records[id] = status === 'unusable'
      ? { ...record, unusableReason: isUnusableReason(item.unusableReason) ? item.unusableReason : 'blocked' }
      : record;
  }
  return { records };
}
