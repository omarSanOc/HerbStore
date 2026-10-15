/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const kotlinModule = readFileSync(
  new URL('../../../modules/device-insights/android/src/main/java/expo/modules/deviceinsights/DeviceInsightsModule.kt', import.meta.url),
  'utf8',
);
const kotlinView = readFileSync(
  new URL('../../../modules/device-insights/android/src/main/java/expo/modules/deviceinsights/DeviceInsightsView.kt', import.meta.url),
  'utf8',
);
const swiftModule = readFileSync(
  new URL('../../../modules/device-insights/ios/DeviceInsightsModule.swift', import.meta.url),
  'utf8',
);
const screen = readFileSync(
  new URL('../../features/device-insights/screens/DeviceInsightsScreen.tsx', import.meta.url),
  'utf8',
);

describe('DeviceInsights accentColor propagation', () => {
  it('passes the resolved semantic color from the JS panel', () => {
    assert.match(screen, /accentColor=\{nativeViewStyle\.accentColor\}/);
    assert.match(screen, /minHeight: nativeViewMinimumHeight/);
  });

  it('allows the Android native label to wrap when text is enlarged', () => {
    assert.match(kotlinView, /button\.setSingleLine\(false\)/);
  });

  it('uses bounded hex parsing and a system fallback on both platforms', () => {
    assert.match(kotlinView, /\^#\[0-9A-Fa-f\]\{6\}\$/);
    assert.match(kotlinView, /toLongOrNull\(16\)/);
    assert.doesNotMatch(kotlinView, /Color\.parseColor/);
    assert.match(swiftModule, /value\.count == 7/);
    assert.match(swiftModule, /guard let rgb = UInt64\(hex, radix: 16\)/);
    assert.match(swiftModule, /accentColor \?\? \.systemBlue/);
  });

  it('forwards accentColor to the Android native view instead of ignoring it', () => {
    assert.match(
      kotlinModule,
      /Prop\("accentColor"\) \{ view, value: String\? -> view\.setAccentColor\(value\) \}/,
    );
  });

  it('forwards accentColor to the iOS native view instead of ignoring it', () => {
    assert.match(
      swiftModule,
      /Prop\("accentColor"\) \{ \(view, value: String\?\) in view\.setAccentColor\(value\) \}/,
    );
  });
});
