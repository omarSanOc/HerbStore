import {
  createDeviceInsightsRefreshCoordinator,
  parseDeviceInsightsEvent,
  parseDevicePlatform,
  type DeviceInsights,
  type DeviceInsightsEvent,
  type DeviceInsightsRefreshResult,
  type DevicePlatform,
} from './device-insights-contract.ts';

export type DeviceInsightsSubscription = { remove: () => void };

export type DeviceInsightsNativeBridge = {
  getPlatform: () => unknown;
  getInsightsAsync: () => Promise<unknown>;
  addListener: (listener: (value: unknown) => void) => DeviceInsightsSubscription;
};

export type DeviceInsightsFacade = {
  getPlatform: () => DevicePlatform | undefined;
  refresh: () => Promise<DeviceInsightsRefreshResult>;
  subscribe: (listener: (event: DeviceInsightsEvent) => void) => DeviceInsightsSubscription;
};

/** Keeps the native module behind one validated boundary. */
export function createDeviceInsightsFacade(native: DeviceInsightsNativeBridge): DeviceInsightsFacade {
  const coordinator = createDeviceInsightsRefreshCoordinator(native.getInsightsAsync);

  return {
    getPlatform: () => parseDevicePlatform(native.getPlatform()),
    refresh: () => coordinator.refresh(),
    subscribe: (listener) => {
      let active = true;
      const subscription = native.addListener((value) => {
        if (!active) return;
        const event = parseDeviceInsightsEvent(value);
        if (event !== undefined) listener(event);
      });

      return {
        remove: () => {
          if (!active) return;
          active = false;
          subscription.remove();
        },
      };
    },
  };
}

export type { DeviceInsights, DeviceInsightsEvent, DevicePlatform };
