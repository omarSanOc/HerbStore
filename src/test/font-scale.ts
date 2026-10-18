/// <reference types="jest" />
import { Dimensions } from 'react-native';

/**
 * Makes `useWindowDimensions().fontScale` (and `Dimensions.get`) answer `fontScale`, the way the
 * system font setting does on a device (Android `font_scale`, iOS Dynamic Type). The Jest preset's
 * own window already has a fontScale of 2, so a test that cares about the layout says it out loud.
 * Undone by `jest.restoreAllMocks()` (`jest.setup.ts` runs it after each test).
 *
 * Compose: `CompositionLocalProvider(LocalDensity provides Density(density, fontScale = 2f))`.
 * SwiftUI: `.environment(\.dynamicTypeSize, .accessibility3)`.
 */
export function mockFontScale(fontScale: number): void {
  // Called again in the same test (the user changes the size while the app is open): undo the first
  // spy so the second one wraps the real `get`, not the first spy.
  activeSpy?.mockRestore();
  const real = Dimensions.get.bind(Dimensions);
  activeSpy = jest.spyOn(Dimensions, 'get').mockImplementation((dimension) => ({ ...real(dimension), fontScale }));
}

let activeSpy: jest.SpyInstance | undefined;
