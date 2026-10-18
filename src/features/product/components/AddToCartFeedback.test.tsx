/// <reference types="jest" />
// RF-15 (spec 006, T6c). The "added to the cart" message ends in a static result with reduced motion:
// fully opaque, at its place (no 12 dp offset) and at full size (no 0.96 scale), with the same text and
// the same time on screen. Without the preference it starts transparent and offset, and moves in.
// `add-feedback.test.ts` fixes the numbers (`resolveFeedbackMotion`); this fixes what the user's screen
// gets from them, through Reanimated.
//
// Android: `ANIMATOR_DURATION_SCALE` = 0 ("remove animations"); iOS: `UIAccessibility.isReduceMotionEnabled`;
// Compose: `LocalReduceMotion`-style checks on `AnimatedVisibility`; SwiftUI: `@Environment(\.accessibilityReduceMotion)`.
import { act, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { renderWithProviders } from '@/test/render-with-providers';

import { FEEDBACK_HOLD_MS } from '../logic/add-feedback';
import { AddToCartFeedback } from './AddToCartFeedback';

jest.mock('@/core/accessibility/use-reduced-motion', () => ({ useReducedMotionPreference: jest.fn(() => false) }));

const model = { tone: 'success', parts: [{ key: 'added', count: 1 }] } as const;

const MESSAGE = 'Se agregó 1 unidad al carrito.';

/** The message is hidden from the accessibility tree on purpose (it is announced instead). */
const message = () => screen.getByText(MESSAGE, { includeHiddenElements: true });

/** The animated message: the parent of its text is the only view with a transform. */
function messageStyle() {
  return StyleSheet.flatten(message().parent?.props.style);
}

const transformOf = (style: ReturnType<typeof messageStyle>) =>
  Object.assign({}, ...(style.transform as Record<string, number>[]));

describe('AddToCartFeedback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(useReducedMotionPreference).mockReturnValue(false);
  });

  it('REDUCED MOTION: the message is there at once, opaque, in place and at full size', async () => {
    jest.mocked(useReducedMotionPreference).mockReturnValue(true);
    await renderWithProviders(<AddToCartFeedback model={model} />);

    const style = messageStyle();
    expect(style.opacity).toBe(1);
    expect(transformOf(style)).toEqual({ translateY: 0, scale: 1 });
  });

  it('REDUCED MOTION: the text stays on screen as long as with motion, then goes', async () => {
    jest.mocked(useReducedMotionPreference).mockReturnValue(true);
    await renderWithProviders(<AddToCartFeedback model={model} />);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS - 1);
    });
    expect(message()).toBeOnTheScreen();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2);
    });
    expect(screen.queryByText(MESSAGE, { includeHiddenElements: true })).toBeNull();
  });

  it('WITH MOTION: it starts transparent, lowered and slightly small, and moves in', async () => {
    await renderWithProviders(<AddToCartFeedback model={model} />);

    const style = messageStyle();
    expect(style.opacity).toBe(0);
    expect(transformOf(style)).toEqual({ translateY: 12, scale: 0.96 });
  });

  it('is never an accessibility stop: the message is announced, and hidden from the tree', async () => {
    jest.mocked(useReducedMotionPreference).mockReturnValue(true);
    await renderWithProviders(<AddToCartFeedback model={model} />);

    expect(screen.queryByText(MESSAGE)).toBeNull(); // hidden from the default query
    expect(message()).toBeOnTheScreen();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(MESSAGE);
  });
});
