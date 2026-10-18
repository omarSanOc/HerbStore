// A `@gorhom/bottom-sheet` stand-in that OPENS and CLOSES, for tests that need the life cycle of a
// sheet (focus on open, focus back on close, what is announced after closing).
//
// The official mock (`@gorhom/bottom-sheet/mock`, installed for every test in `jest.setup.ts`)
// renders the content all the time and never calls `onChange`/`onDismiss`, which is right for tests
// that only read a sheet's content but cannot say anything about its life cycle. A test file that
// needs the life cycle opts in with:
//
//   jest.mock('@gorhom/bottom-sheet', () => jest.requireActual('@/test/gorhom-interactive-mock').gorhomModule);
//
// It models only what `AppBottomSheet` uses: `present()` mounts the content and reports index 0
// ("settled"), `dismiss()` unmounts it and reports `onDismiss`. There are no animations: the real
// library animates for ~300 ms between those two moments, which the tests do not need.
//
// Compose: a `SheetState` driven by `show()` / `hide()` in a `ModalBottomSheet` test.
import { Component, type ReactNode } from 'react';
import { ScrollView } from 'react-native';

/** How long the stand-in takes to close: tests advance their fake timers past it. */
export const CLOSE_ANIMATION_MS = 250;
/**
 * How long `present()` takes to take effect. The real `BottomSheetModal` defers it by one frame
 * (`requestAnimationFrame` in `handlePresent`), and a `dismiss()` that arrives before the sheet is
 * mounted is IGNORED (its "already closed" early exit). Seen on the Samsung as F-3: Back within
 * ~100 ms of opening was lost (the sheet then opened anyway) or popped the screen.
 */
export const PRESENT_DELAY_MS = 16;

type ModalProps = Readonly<{
  children?: ReactNode;
  onAnimate?: (fromIndex: number, toIndex: number) => void;
  onChange?: (index: number) => void;
  onDismiss?: () => void;
}>;

class BottomSheetModal extends Component<ModalProps, { presented: boolean }> {
  state = { presented: false };

  present() {
    setTimeout(() => {
      this.props.onAnimate?.(-1, 0);
      this.setState({ presented: true }, () => this.props.onChange?.(0));
    }, PRESENT_DELAY_MS);
  }

  dismiss() {
    // Like the library: nothing to close until the sheet is mounted.
    if (!this.state.presented) {
      return;
    }
    // The real sheet reports "about to animate to closed" when it starts to leave and `onDismiss`
    // when it is gone, one animation later (modelled as a timer, so a test can look at what is true
    // in between).
    this.props.onAnimate?.(0, -1);
    setTimeout(() => {
      this.setState({ presented: false }, () => this.props.onDismiss?.());
    }, CLOSE_ANIMATION_MS);
  }

  render() {
    return this.state.presented ? this.props.children : null;
  }
}

export const gorhomModule = {
  BottomSheetModal,
  BottomSheetModalProvider: ({ children }: Readonly<{ children: ReactNode }>) => children,
  BottomSheetBackdrop: () => null,
  BottomSheetScrollView: ScrollView,
};
