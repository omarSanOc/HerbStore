/// <reference types="jest" />
// RF-14 (T6a, G-2/G-3). The life cycle of a bottom sheet as a screen-reader user lives it:
// focus goes INTO the sheet when it settles, and BACK to the control that opened it when it closes
// (spec 006, edge case "close a modal or bottom sheet with a reader on: the focus returns to the
// control that opened it"). The opener's label says what changed, so the focus speech is the
// confirmation; the sheet announces nothing on top of it.
//
// Seen on the Samsung before this change (TalkBack, `docs/evidence/day-6-accessibility.md`): after
// the sheet closed the focus went to the screen's Back arrow, or nowhere.
//
// Compose: `ModalBottomSheet` + `LocalFocusManager`; Material restores focus to the trigger. SwiftUI:
// `.sheet` returns VoiceOver to the presenting button by itself.
import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo, BackHandler, type View } from 'react-native';
import { createRef, useRef } from 'react';

import { modalSheetRegistry } from '@/core/accessibility/modal-sheet-registry';
import { PRESENT_DELAY_MS } from '@/test/gorhom-interactive-mock';
import { renderWithProviders } from '@/test/render-with-providers';

import { AppBottomSheet, useAppBottomSheet, type AppBottomSheetHandle } from './AppBottomSheet';
import { AppButton } from './AppButton';

// This file needs a sheet that opens and closes; see the mock for what it models.
jest.mock('@gorhom/bottom-sheet', () => jest.requireActual('@/test/gorhom-interactive-mock').gorhomModule);

function ApplyButton() {
  const { dismiss } = useAppBottomSheet();
  return <AppButton accessibilityHint="h" label="Apply" onPress={dismiss} />;
}

type HarnessProps = Readonly<{
  /** Whether the sheet is told where the focus goes back to. */
  withOpener?: boolean;
  handleRef?: React.RefObject<AppBottomSheetHandle | null>;
  openerRef?: React.RefObject<View | null>;
}>;

function Harness({ withOpener = true, handleRef, openerRef }: HarnessProps) {
  const ownSheetRef = useRef<AppBottomSheetHandle>(null);
  const ownOpenerRef = useRef<View>(null);
  const sheet = handleRef ?? ownSheetRef;
  const opener = openerRef ?? ownOpenerRef;

  return (
    <>
      <AppButton
        ref={opener}
        accessibilityHint="Opens the sheet."
        label="Open sheet"
        onPress={() => sheet.current?.present()}
      />
      <AppBottomSheet
        ref={sheet}
        closeHint="Closes it."
        closeLabel="Close"
        name="test-sheet"
        returnFocusTo={withOpener ? opener : undefined}
        title="The sheet">
        <ApplyButton />
      </AppBottomSheet>
    </>
  );
}

describe('AppBottomSheet and the screen reader', () => {
  let focus: jest.SpyInstance;
  let announce: jest.SpyInstance;
  /** Whether the app behind the sheet was hidden from the reader when each focus event was sent. */
  let appHiddenAtFocus: boolean[];

  beforeEach(() => {
    jest.useFakeTimers();
    appHiddenAtFocus = [];
    focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    focus.mockClear();
    focus.mockImplementation(() => {
      appHiddenAtFocus.push(modalSheetRegistry.isAnyOpen());
    });
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();
  });

  /**
   * Advances the clock in small steps, one `act` each: the sheet closes in a timer and the focus
   * move is scheduled from the commit that follows, which one big `act` would postpone to its end.
   */
  const settle = async (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(50);
      });
    }
  };

  async function open() {
    await fireEvent.press(screen.getByRole('button', { name: 'Open sheet' }));
    await settle(PRESENT_DELAY_MS + 34);
  }

  it('OPEN: the focus goes to the title of the sheet once it has settled', async () => {
    await renderWithProviders(<Harness />);
    expect(focus).not.toHaveBeenCalled();

    await open();

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
    expect(screen.getByRole('header', { name: 'The sheet' })).toBeOnTheScreen();
  });

  it('CLOSE: the focus goes back to the control that opened the sheet, and only once the app behind is readable again', async () => {
    const openerRef = createRef<View>();
    await renderWithProviders(<Harness openerRef={openerRef} />);
    await open();
    focus.mockClear();
    appHiddenAtFocus = [];
    expect(modalSheetRegistry.isAnyOpen()).toBe(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await settle(1_000);

    expect(screen.queryByRole('header', { name: 'The sheet' })).not.toBeOnTheScreen();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(openerRef.current, 'focus');
    // The focus request of a hidden node is lost: the app must already be exposed again.
    expect(appHiddenAtFocus).toEqual([false]);
  });

  it('CLOSE: the app behind is readable again as soon as the sheet starts to leave, not when it is gone (a focus request to a still-hidden node is lost)', async () => {
    await renderWithProviders(<Harness />);
    await open();
    expect(modalSheetRegistry.isAnyOpen()).toBe(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    // Still on screen, animating out...
    expect(screen.getByRole('header', { name: 'The sheet' })).toBeOnTheScreen();
    // ...but the reader no longer hides the app.
    expect(modalSheetRegistry.isAnyOpen()).toBe(false);
  });

  it('CLOSE by any other way (the handle: Back, drag, escape gesture) gives the focus back too', async () => {
    const handleRef = createRef<AppBottomSheetHandle>();
    const openerRef = createRef<View>();
    await renderWithProviders(<Harness handleRef={handleRef} openerRef={openerRef} />);
    await open();
    focus.mockClear();

    await act(async () => {
      handleRef.current?.dismiss();
    });
    await settle(1_000);

    expect(focus).toHaveBeenCalledWith(openerRef.current, 'focus');
  });

  it('APPLY (a close with a result) gives the focus back too, and announces nothing: the opener label is the news', async () => {
    const openerRef = createRef<View>();
    await renderWithProviders(<Harness openerRef={openerRef} />);
    await open();
    focus.mockClear();

    await fireEvent.press(screen.getByRole('button', { name: 'Apply' }));
    await settle(1_000);

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(openerRef.current, 'focus');
    expect(announce).not.toHaveBeenCalled();
  });

  // F-3 (T6a). Android Back within ~100 ms of opening a sheet was lost (the sheet opened anyway) or
  // popped the screen under it: the library defers `present()` by a frame and ignores a `dismiss()`
  // that comes before the sheet is mounted, and the Back listener only existed after React's effect.
  describe('Back right after opening (F-3)', () => {
    let backHandlers: (() => boolean)[];

    beforeEach(() => {
      backHandlers = [];
      jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
        backHandlers.push(handler as () => boolean);
        return { remove: () => void backHandlers.splice(backHandlers.indexOf(handler as () => boolean), 1) };
      });
    });

    /** The newest listener answers first, as in Android. */
    const pressBack = () => [...backHandlers].reverse().some((handler) => handler());

    it('the sheet owns Back from the very moment it asks to open, before React has even committed', async () => {
      const handleRef = createRef<AppBottomSheetHandle>();
      await renderWithProviders(<Harness handleRef={handleRef} />);

      await act(async () => {
        handleRef.current?.present();
        // Still inside the same tick: no render, no effect yet. Back must already be ours.
        expect(pressBack()).toBe(true);
      });
      await settle(1_000);

      // And the sheet did not stay open: it closed once it was there.
      expect(screen.queryByRole('header', { name: 'The sheet' })).not.toBeOnTheScreen();
    });

    it('a Back that arrives before the sheet is mounted closes it as soon as it is (it is not lost)', async () => {
      await renderWithProviders(<Harness />);
      await fireEvent.press(screen.getByRole('button', { name: 'Open sheet' }));
      // Half a frame later: the stand-in has not mounted the sheet yet.
      await act(async () => {
        await jest.advanceTimersByTimeAsync(PRESENT_DELAY_MS / 2);
      });
      expect(screen.queryByRole('header', { name: 'The sheet' })).not.toBeOnTheScreen();

      expect(pressBack()).toBe(true);
      await settle(1_000);

      expect(screen.queryByRole('header', { name: 'The sheet' })).not.toBeOnTheScreen();
      expect(modalSheetRegistry.isAnyOpen()).toBe(false);
    });

    it('with the sheet closed, Back is NOT ours: the screen under it handles it', async () => {
      await renderWithProviders(<Harness />);
      await open();
      await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
      await settle(1_000);

      expect(pressBack()).toBe(false);
    });

    it('Back while the sheet is open closes it and focus goes back to the opener', async () => {
      const openerRef = createRef<View>();
      await renderWithProviders(<Harness openerRef={openerRef} />);
      await open();
      focus.mockClear();

      expect(pressBack()).toBe(true);
      await settle(1_000);

      expect(screen.queryByRole('header', { name: 'The sheet' })).not.toBeOnTheScreen();
      expect(focus).toHaveBeenCalledWith(openerRef.current, 'focus');
    });
  });

  it('without an opener nothing is focused on close (the sheet cannot guess where to go)', async () => {
    await renderWithProviders(<Harness withOpener={false} />);
    await open();
    focus.mockClear();

    await fireEvent.press(screen.getByRole('button', { name: 'Apply' }));
    await settle(1_000);

    expect(focus).not.toHaveBeenCalled();
  });

  it('the screen going away right after closing does not make a late focus move', async () => {
    const view = await renderWithProviders(<Harness />);
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Apply' }));
    focus.mockClear();
    // Closed, the focus move still pending.
    await settle(20);

    await view.unmount();
    await settle(2_000);

    expect(focus).not.toHaveBeenCalled();
  });
});
