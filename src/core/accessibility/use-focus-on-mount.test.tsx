/// <reference types="jest" />
// RF-14 (T6a). A screen that REPLACES the one where the user just pressed a button (checkout ->
// order status -> confirmation) says where the screen reader goes: its title. Seen on the Samsung
// before this change: the focused button vanished and TalkBack parked on the "Home" tab, so the
// user heard "Home" instead of "Order confirmed".
//
// Compose: `LaunchedEffect(Unit) { requester.requestFocus() }`. SwiftUI: `.onAppear { focus = .title }`.
import { render } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

import { FOCUS_ON_MOUNT_DELAY_MS, useFocusOnMount } from './use-focus-on-mount';

function Screen() {
  const titleRef = useFocusOnMount<Text>();
  return <Text ref={titleRef}>Order confirmed</Text>;
}

describe('useFocusOnMount', () => {
  let focus: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    focus.mockClear();
  });

  it('puts the screen-reader focus on the element after the screen mounted, not before', async () => {
    await render(<Screen />);
    jest.advanceTimersByTime(Math.max(FOCUS_ON_MOUNT_DELAY_MS - 1, 0));
    if (FOCUS_ON_MOUNT_DELAY_MS > 0) {
      expect(focus).not.toHaveBeenCalled();
    }

    jest.advanceTimersByTime(1);

    expect(focus).toHaveBeenCalledTimes(1);
    const target = focus.mock.calls[0]?.[0] as { props?: { children?: unknown } };
    expect(target.props?.children).toBe('Order confirmed');
    expect(focus.mock.calls[0]?.[1]).toBe('focus');
  });

  it('does nothing if the screen is gone before the delay ends', async () => {
    const view = await render(<Screen />);

    await view.unmount();
    jest.advanceTimersByTime(FOCUS_ON_MOUNT_DELAY_MS + 1_000);

    expect(focus).not.toHaveBeenCalled();
  });
});
