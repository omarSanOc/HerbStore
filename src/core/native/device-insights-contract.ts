export type DevicePlatform = 'android' | 'ios';
export type DeviceInsightsAccent = 'primary' | 'success' | 'warning' | 'error';

export type DeviceInsights = {
  platform: DevicePlatform;
  model: string;
  systemVersion: string;
  isPhysical: boolean;
};

export type DeviceInsightsEvent = {
  insights: DeviceInsights;
  timestamp: string;
};

export type DeviceInsightsState =
  | { status: 'idle' }
  | { status: 'refreshing' }
  | { status: 'success'; data: DeviceInsights }
  | { status: 'error'; code: DeviceInsightsErrorCode };

export type DeviceInsightsErrorCode = 'invalid-response' | 'native-failure';

export type DeviceInsightsRefreshResult =
  | Extract<DeviceInsightsState, { status: 'success' | 'error' }>
  | { status: 'ignored' };

export const initialDeviceInsightsState: DeviceInsightsState = { status: 'idle' };

export function parseDeviceInsightsAccent(value: unknown): DeviceInsightsAccent {
  return value === 'success' || value === 'warning' || value === 'error' ? value : 'primary';
}

export function formatDeviceInsightsEventSummary(
  event: DeviceInsightsEvent,
  labels: { android: string; ios: string; physical: string; simulator: string },
): string {
  const deviceKind = event.insights.isPhysical ? labels.physical : labels.simulator;
  return `${labels[event.insights.platform]} · ${event.insights.model} · ${event.insights.systemVersion} · ${deviceKind}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function parseDevicePlatform(value: unknown): DevicePlatform | undefined {
  return value === 'android' || value === 'ios' ? value : undefined;
}

/** Whitelists the four non-sensitive fields that may cross the public boundary. */
export function parseDeviceInsightsPayload(value: unknown): DeviceInsights | undefined {
  if (!isRecord(value)) return undefined;

  const platform = parseDevicePlatform(value.platform);
  const model = nonEmptyString(value.model);
  const systemVersion = nonEmptyString(value.systemVersion);
  if (platform === undefined || model === undefined || systemVersion === undefined) return undefined;
  if (typeof value.isPhysical !== 'boolean') return undefined;

  return { platform, model, systemVersion, isPhysical: value.isPhysical };
}

function parseUtcIsoTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value ? undefined : value;
}

export function parseDeviceInsightsEvent(value: unknown): DeviceInsightsEvent | undefined {
  if (!isRecord(value)) return undefined;
  const insights = parseDeviceInsightsPayload(value);
  const timestamp = parseUtcIsoTimestamp(value.timestamp);
  return insights === undefined || timestamp === undefined ? undefined : { insights, timestamp };
}

export function startDeviceInsightsRefresh(state: DeviceInsightsState):
  | { outcome: 'started'; state: Extract<DeviceInsightsState, { status: 'refreshing' }> }
  | { outcome: 'ignored'; state: DeviceInsightsState } {
  if (state.status === 'refreshing') return { outcome: 'ignored', state };
  return { outcome: 'started', state: { status: 'refreshing' } };
}

export function completeDeviceInsightsRefresh(value: unknown): DeviceInsightsState {
  const data = parseDeviceInsightsPayload(value);
  return data === undefined
    ? { status: 'error', code: 'invalid-response' }
    : { status: 'success', data };
}

export function failDeviceInsightsRefresh(): DeviceInsightsState {
  return { status: 'error', code: 'native-failure' };
}

/** Owns the one-in-flight invariant used by the native facade. */
export function createDeviceInsightsRefreshCoordinator(refreshNative: () => Promise<unknown>) {
  let refreshing = false;

  return {
    async refresh(): Promise<DeviceInsightsRefreshResult> {
      if (refreshing) return { status: 'ignored' };
      refreshing = true;
      try {
        return completeDeviceInsightsRefresh(await refreshNative()) as DeviceInsightsRefreshResult;
      } catch {
        return failDeviceInsightsRefresh() as DeviceInsightsRefreshResult;
      } finally {
        refreshing = false;
      }
    },
  };
}
