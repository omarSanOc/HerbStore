// Re-export the native module. On web, it will be resolved to DeviceInsightsModule.web.ts
// and on native platforms to DeviceInsightsModule.ts
export { default } from './src/DeviceInsightsModule';
export * from './src/DeviceInsights.types';
export { default as DeviceInsightsView } from './src/DeviceInsightsView';
