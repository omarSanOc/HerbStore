import DeviceInsightsModule from '../../../modules/device-insights/index.ts';

import {
  createDeviceInsightsFacade,
  type DeviceInsightsFacade,
  type DeviceInsightsNativeBridge,
} from './device-insights.ts';

const nativeBridge: DeviceInsightsNativeBridge = {
  getPlatform: () => DeviceInsightsModule.getPlatform(),
  getInsightsAsync: () => DeviceInsightsModule.getInsightsAsync(),
  addListener: (listener) => DeviceInsightsModule.addListener('onChange', listener),
};

/** The application-facing DeviceInsights instance for native builds. */
export const deviceInsights: DeviceInsightsFacade = createDeviceInsightsFacade(nativeBridge);
