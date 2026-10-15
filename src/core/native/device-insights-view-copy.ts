export type DeviceInsightsViewCopy = Readonly<{
  fallbackLabel: string;
  available: string;
  unavailable: string;
  refreshing: string;
}>;

export function resolveDeviceInsightsViewCopy(
  label: string | undefined,
  copy: DeviceInsightsViewCopy,
  state: Readonly<{ available: boolean; refreshing: boolean }>,
) {
  const resolvedLabel = label?.trim() || copy.fallbackLabel;
  const status = state.refreshing ? copy.refreshing : state.available ? copy.available : copy.unavailable;
  return { label: resolvedLabel, state: status };
}
