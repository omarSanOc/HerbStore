/// <reference types="jest" />
// RF-15 (spec 006, T6c). A bottom sheet jumps to its position with reduced motion instead of sliding.
// The library animates with Reanimated, which reads the SYSTEM setting by itself; the app also has its own
// single source of that preference (`useReducedMotionPreference`), so the sheet tells Reanimated
// `ReduceMotion.Always` when it is on and lets the system decide otherwise.
//
// Android: `TRANSITION_ANIMATION_SCALE` = 0 (what Reanimated reads) vs `ANIMATOR_DURATION_SCALE` (what React
// Native reads); iOS: `UIAccessibility.isReduceMotionEnabled`. Compose: `ModalBottomSheet` snaps
// when `LocalReduceMotion` says so; SwiftUI: `.sheet` follows the system by itself.
import { createRef } from 'react';
import { ReduceMotion } from 'react-native-reanimated';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { renderWithProviders } from '@/test/render-with-providers';

import { AppBottomSheet } from './AppBottomSheet';
import { AppText } from './AppText';

jest.mock('@/core/accessibility/use-reduced-motion', () => ({ useReducedMotionPreference: jest.fn(() => false) }));

// A stand-in that records the props the app gives the library's modal.
const mockModalProps = jest.fn();
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: (props: object) => {
    mockModalProps(props);
    return null;
  },
  BottomSheetModalProvider: ({ children }: Readonly<{ children: unknown }>) => children,
  BottomSheetBackdrop: () => null,
  BottomSheetScrollView: () => null,
}));

const reduceMotionOfSheet = () => mockModalProps.mock.lastCall?.[0].overrideReduceMotion as ReduceMotion;

async function renderSheet() {
  await renderWithProviders(
    <AppBottomSheet closeHint="Closes" closeLabel="Close" name="filters" ref={createRef()} title="Filters">
      <AppText>Content</AppText>
    </AppBottomSheet>,
  );
}

describe('AppBottomSheet and reduced motion', () => {
  beforeEach(() => {
    mockModalProps.mockClear();
    jest.mocked(useReducedMotionPreference).mockReturnValue(false);
  });

  it('REDUCED MOTION: the sheet is told to always reduce motion (it jumps to its snap point)', async () => {
    jest.mocked(useReducedMotionPreference).mockReturnValue(true);
    await renderSheet();

    expect(reduceMotionOfSheet()).toBe(ReduceMotion.Always);
  });

  it('WITHOUT the preference: the sheet follows the system, which is also "off"', async () => {
    await renderSheet();

    expect(reduceMotionOfSheet()).toBe(ReduceMotion.System);
  });
});
