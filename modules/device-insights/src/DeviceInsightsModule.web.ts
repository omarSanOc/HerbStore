import { registerWebModule, NativeModule } from 'expo';

import { DeviceInsightsModuleEvents } from './DeviceInsights.types';

// DeviceInsightsModule is not available on the web platform.
class DeviceInsightsModule extends NativeModule<DeviceInsightsModuleEvents> {}

export default registerWebModule(DeviceInsightsModule, 'DeviceInsightsModule');
