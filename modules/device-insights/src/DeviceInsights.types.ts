export type DeviceInsightsModuleEvents = {
  onChange: (params: DeviceInsightsEventPayload) => void;
};

export type DeviceInsightsViewProps = ViewProps & {
  label?: string;
  fallbackLabel: string;
  availableLabel: string;
  unavailableLabel: string;
  refreshingLabel: string;
  accent?: 'primary' | 'success' | 'warning' | 'error';
  accentColor?: string;
  available?: boolean;
  refreshing?: boolean;
  onNativePress?: (event: { nativeEvent: { platform: 'android' | 'ios'; timestamp: string } }) => void;
};

export type DeviceInsightsPayload = {
  platform: 'android' | 'ios';
  model: string;
  systemVersion: string;
  isPhysical: boolean;
};

export type DeviceInsightsEventPayload = DeviceInsightsPayload & {
  timestamp: string;
};
import type { ViewProps } from 'react-native';
