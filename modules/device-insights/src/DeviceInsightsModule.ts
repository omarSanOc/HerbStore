import { NativeModule, requireNativeModule } from 'expo';

import { DeviceInsightsModuleEvents, DeviceInsightsPayload } from './DeviceInsights.types';

declare class DeviceInsightsModule extends NativeModule<DeviceInsightsModuleEvents> {
  getPlatform(): 'android' | 'ios';
  getInsightsAsync(): Promise<DeviceInsightsPayload>;
}

export default requireNativeModule<DeviceInsightsModule>('DeviceInsights');
