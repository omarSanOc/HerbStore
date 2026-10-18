/// <reference types="jest" />
// RF-14 (T6a). Spec 006, edge case: "closing a modal with a reader on: the focus returns to the
// control that opened it". A MODAL ROUTE (the scanner) is not a sheet: closing it just reveals the
// screen under it, and TalkBack puts its focus on that screen's title. The screen that opened the
// modal says "when I am back, go to my button".
//
// Seen on the Samsung before this change: closing the scanner left the focus on the title "Home",
// not on "Scan a product".
//
// Compose: `rememberSaveable` + `FocusRequester` restored on resume. SwiftUI: UIKit restores
// VoiceOver focus to the presenting control after dismissing a presented controller.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Pressable, Text } from 'react-native';

import { resetRouterMock, setFocused } from '@/test/mock-expo-router';

import { RETURN_FOCUS_DELAY_MS, useReturnFocusToOpener } from './use-return-focus-to-opener';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);

function Screen() {
  const { openerRef, markOpening } = useReturnFocusToOpener<React.ComponentRef<typeof Pressable>>();
  return (
    <Pressable ref={openerRef} accessibilityLabel="Scan a product" accessibilityRole="button" onPress={markOpening}>
      <Text>scan</Text>
    </Pressable>
  );
}

describe('useReturnFocusToOpener', () => {
  let focus: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    resetRouterMock();
    focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    focus.mockClear();
  });

  const advance = (ms: number) =>
    act(async () => {
      await jest.advanceTimersByTimeAsync(ms);
    });

  /** The screen loses navigation focus (the modal opens) and gets it back (the modal closes). */
  async function openAndCloseModal(view: Awaited<ReturnType<typeof render>>) {
    setFocused(false);
    await view.rerender(<Screen />);
    setFocused(true);
    await view.rerender(<Screen />);
  }

  const focusedName = () =>
    (focus.mock.calls.at(-1)?.[0] as { props?: { accessibilityLabel?: string } } | undefined)?.props
      ?.accessibilityLabel;

  it('after the modal it opened closes, the focus goes back to the control that opened it', async () => {
    const view = await render(<Screen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Scan a product' }));

    await openAndCloseModal(view);
    expect(focus).not.toHaveBeenCalled();
    await advance(RETURN_FOCUS_DELAY_MS);

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focusedName()).toBe('Scan a product');
  });

  it('only once per opening', async () => {
    const view = await render(<Screen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Scan a product' }));
    await openAndCloseModal(view);
    await advance(RETURN_FOCUS_DELAY_MS);
    focus.mockClear();

    // Another time the screen loses and regains focus (a tab switch): nobody opened anything.
    await openAndCloseModal(view);
    await advance(RETURN_FOCUS_DELAY_MS + 1_000);

    expect(focus).not.toHaveBeenCalled();
  });

  it('coming back without having opened anything (a tab switch, the app returning) moves nothing', async () => {
    const view = await render(<Screen />);

    await openAndCloseModal(view);
    await advance(RETURN_FOCUS_DELAY_MS + 1_000);

    expect(focus).not.toHaveBeenCalled();
  });

  it('a screen that goes away before the focus move makes none', async () => {
    const view = await render(<Screen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Scan a product' }));
    await openAndCloseModal(view);

    await view.unmount();
    await advance(RETURN_FOCUS_DELAY_MS + 1_000);

    expect(focus).not.toHaveBeenCalled();
  });
});
