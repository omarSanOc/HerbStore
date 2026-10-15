import {
  parseDeviceInsightsAccent,
  type DeviceInsightsAccent,
} from './device-insights-contract.ts';

export type DeviceInsightsAccentPalette = Readonly<Record<DeviceInsightsAccent, string>>;

const opaqueHexColor = /^#[0-9a-f]{6}$/i;
const minimumTouchTarget = 48;

export function resolveDeviceInsightsMinimumHeight(fontScale: number): number {
  const safeScale = Number.isFinite(fontScale) && fontScale > 1 ? fontScale : 1;
  return Math.ceil(minimumTouchTarget * safeScale);
}

/** Resolves the closed semantic token to a native-safe color owned by the JS theme. */
export function resolveDeviceInsightsViewStyle(
  value: unknown,
  palette: DeviceInsightsAccentPalette,
): Readonly<{ accent: DeviceInsightsAccent; accentColor: string | undefined }> {
  const accent = parseDeviceInsightsAccent(value);
  const accentColor = palette[accent];
  if (opaqueHexColor.test(accentColor)) return { accent, accentColor };

  return {
    accent: 'primary',
    accentColor: opaqueHexColor.test(palette.primary) ? palette.primary : undefined,
  };
}
