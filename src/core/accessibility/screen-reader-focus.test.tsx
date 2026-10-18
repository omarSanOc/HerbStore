/// <reference types="jest" />
// RF-14 (T6a, G-2/G-3/S-6). What a screen reader needs after a control disappears or a sheet
// closes: the focus lands somewhere deliberate FIRST, and what happened is announced AFTER it, so
// the focus speech does not cut the announcement off (seen on the Samsung: the announcement of a
// removed history entry was interrupted ~2 s in by TalkBack moving its focus to the search field).
//
// Compose: `LocalView.current.announceForAccessibility` + `FocusRequester.requestFocus()` in that
// order. SwiftUI: `AccessibilityFocusState` set first, then `AccessibilityNotification.Announcement`.
import { AccessibilityInfo, View } from 'react-native';
import { render } from '@testing-library/react-native';
import { createRef } from 'react';

import { ANNOUNCE_AFTER_FOCUS_MS, moveFocusThenAnnounce, moveScreenReaderFocus } from './screen-reader-focus';

describe('moveFocusThenAnnounce', () => {
  let focus: jest.SpyInstance;
  let announce: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    focus.mockClear();
    announce.mockClear();
  });

  async function mountTarget() {
    const ref = createRef<View>();
    await render(<View ref={ref} />);
    expect(ref.current).not.toBeNull();
    return ref.current as View;
  }

  it('moves the screen-reader focus to the target at once', async () => {
    const target = await mountTarget();

    moveFocusThenAnnounce(target, 'Done');

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(target, 'focus');
  });

  it('announces only AFTER the focus move, never in the same tick (an announcement made first is cut by the focus speech)', async () => {
    const target = await mountTarget();
    const order: string[] = [];
    focus.mockImplementation(() => void order.push('focus'));
    announce.mockImplementation(() => void order.push('announce'));

    moveFocusThenAnnounce(target, 'Done');
    expect(announce).not.toHaveBeenCalled();

    jest.advanceTimersByTime(ANNOUNCE_AFTER_FOCUS_MS - 1);
    expect(announce).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Done');
    expect(order).toEqual(['focus', 'announce']);
  });

  it('without a target (it unmounted, or none was given) it still announces, and sends no focus event', () => {
    moveFocusThenAnnounce(null, 'Done');
    moveFocusThenAnnounce(undefined, 'Done again');
    jest.advanceTimersByTime(ANNOUNCE_AFTER_FOCUS_MS);

    expect(focus).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledTimes(2);
  });

  it('without a message it only moves the focus', async () => {
    const target = await mountTarget();

    moveFocusThenAnnounce(target);
    jest.advanceTimersByTime(1_000);

    expect(focus).toHaveBeenCalledTimes(1);
    expect(announce).not.toHaveBeenCalled();
  });

  it('can be cancelled: a screen that unmounted must not speak', async () => {
    const target = await mountTarget();

    const cancel = moveFocusThenAnnounce(target, 'Done');
    cancel();
    jest.advanceTimersByTime(1_000);

    expect(announce).not.toHaveBeenCalled();
  });
});

describe('moveScreenReaderFocus', () => {
  it('sends the focus event to a mounted target, and ignores a target that is gone', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    focus.mockClear();
    const ref = createRef<View>();
    await render(<View ref={ref} />);

    moveScreenReaderFocus(ref.current);
    moveScreenReaderFocus(null);
    moveScreenReaderFocus(undefined);

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(ref.current, 'focus');
  });
});
