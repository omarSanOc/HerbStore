import { requireNativeViewManager } from 'expo-modules-core';

import type { DeviceInsightsViewProps } from './DeviceInsights.types';

export default requireNativeViewManager<DeviceInsightsViewProps>('DeviceInsights');
