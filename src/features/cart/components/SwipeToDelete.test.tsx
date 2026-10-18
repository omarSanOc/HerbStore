/// <reference types="jest" />
// RF-30 (T6e). What the swipe row leaves MOUNTED, checked without dragging anything.
//
// `ReanimatedSwipeable` keeps its right action always mounted (opacity 0 until the row moves), so
// Jest sees the action, its accessibility flags and the `enabled` flag of the Pan gesture without
// simulating a drag. The drag itself (activation distance, release threshold, velocity) belongs to
// the library and is exercised on real devices (Maestro spike and `docs/evidence/day-6-cart-swipe.md`):
// calling its worklets by hand would test a mock, not the gesture (plan.md, "Decisiones de T6e y T6f").
// The REAL library is used on purpose: no mock of `ReanimatedSwipeable`. The one seam is a spy on
// `Gesture.Pan` (it keeps calling the real implementation) that records the config the row builds.
//
// Compose: `composeTestRule` that checks `SwipeToDismissBox(enableDismissFromEndToStart = false)`
// and the semantics of its background without a `performTouchInput { swipeLeft() }`.
// SwiftUI: a unit test of the `.swipeActions` content and of `.disabled(_:)`, not of the pan.
import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';

import { sizes } from '@/design-system';
import { renderWithProviders } from '@/test/render-with-providers';

import { SwipeToDelete } from './SwipeToDelete';

const LABEL = { es: 'Eliminar', en: 'Delete' } as const;

type PanSpy = jest.SpyInstance<ReturnType<typeof Gesture.Pan>, Parameters<typeof Gesture.Pan>>;

/** The config of the Pan gesture the swipe row built in its LAST render. */
const lastPanConfig = (spy: PanSpy) => {
  const gesture = spy.mock.results.at(-1)?.value as { config: Record<string, unknown> } | undefined;
  if (!gesture) throw new Error('The swipe row did not build a Pan gesture.');
  return gesture.config;
};

const row = (disabled: boolean, onDelete: () => void = () => undefined) => (
  <SwipeToDelete disabled={disabled} onDelete={onDelete}>
    <Text>row content</Text>
  </SwipeToDelete>
);

describe('SwipeToDelete', () => {
  describe.each<keyof typeof LABEL>(['es', 'en'])('in %s', (language) => {
    const name = LABEL[language];

    it('RF-28: the revealed action is mounted but hidden from the screen reader', async () => {
      await renderWithProviders(row(false), { language });

      // Not in the accessibility tree: a reader finds ONE delete action per line (the visible button).
      expect(screen.queryByRole('button', { name })).not.toBeOnTheScreen();
      expect(screen.queryByText(name)).not.toBeOnTheScreen();

      // It is there (the library mounts it before any drag), and BOTH platforms' flags hide it:
      // `accessibilityElementsHidden` (iOS) and `importantForAccessibility` (Android).
      const action = screen.getByRole('button', { name, includeHiddenElements: true });
      const frame = action.parent;
      expect(frame).toHaveProp('accessibilityElementsHidden', true);
      expect(frame).toHaveProp('importantForAccessibility', 'no-hide-descendants');
      // The row content is NOT hidden.
      expect(screen.getByText('row content')).toBeOnTheScreen();
    });

    it('RF-25: pressing the revealed action asks to delete exactly once per press', async () => {
      const onDelete = jest.fn();
      await renderWithProviders(row(false, onDelete), { language });

      await fireEvent.press(screen.getByRole('button', { name, includeHiddenElements: true }));

      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('RF-27: disabled, the pan is off, the action is inert and nothing is deleted', async () => {
      const onDelete = jest.fn();
      const pan = jest.spyOn(Gesture, 'Pan');
      await renderWithProviders(row(true, onDelete), { language });

      expect(lastPanConfig(pan).enabled).toBe(false);
      const action = screen.getByRole('button', { name, includeHiddenElements: true });
      expect(action).toBeDisabled();

      await fireEvent.press(action);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  it('RF-27: a row that is already mounted turns the pan off and back on with `disabled`', async () => {
    const onDelete = jest.fn();
    const pan = jest.spyOn(Gesture, 'Pan');
    const { rerender } = await renderWithProviders(row(false, onDelete));
    expect(lastPanConfig(pan).enabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Eliminar', includeHiddenElements: true })).toBeEnabled();

    await rerender(row(true, onDelete));
    expect(lastPanConfig(pan).enabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Eliminar', includeHiddenElements: true })).toBeDisabled();

    await rerender(row(false, onDelete));
    expect(lastPanConfig(pan).enabled).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar', includeHiddenElements: true }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('RF-24 / RF-26: the pan only starts after 24 pt to the left, so 20 pt or less never opens it', async () => {
    const pan = jest.spyOn(Gesture, 'Pan');
    await renderWithProviders(row(false));

    const config = lastPanConfig(pan);
    // Leftwards only (negative start), and the vertical drag stays the ScrollView's (`pan-y`).
    expect(config.activeOffsetXStart).toBe(-24);
    expect(Math.abs(config.activeOffsetXStart as number)).toBeGreaterThan(20);
    expect(config.touchAction).toBe('pan-y');
  });

  it('RF-24: the revealed action keeps a touch target of at least 48 and a frame wider than that', async () => {
    await renderWithProviders(row(false));

    const action = screen.getByRole('button', { name: 'Eliminar', includeHiddenElements: true });
    const style = StyleSheet.flatten(action.props.style);
    expect(sizes.minimumTouchTarget).toBeGreaterThanOrEqual(48);
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    expect(style.minWidth).toBeGreaterThanOrEqual(48);
    expect(StyleSheet.flatten(action.parent?.props.style).minWidth).toBeGreaterThanOrEqual(48);
  });

  // Found in T6f on the iPhone 17 Pro at AX5 ("Dele / te", 72 pt of text inside a FIXED 112 pt frame):
  // the label scales up to 2x (`fontScaleLimits.actionLabel`) so the frame must GROW with it. A fixed
  // `width` cannot (RF-29: the revealed action keeps its full name). `minWidth` keeps the 112 pt the
  // closed-to-open distance was tuned with and lets a larger label widen the frame.
  it('RF-29: the frame of the revealed action grows with its label instead of having a fixed width', async () => {
    await renderWithProviders(row(false));

    const action = screen.getByRole('button', { name: 'Eliminar', includeHiddenElements: true });
    const frame = StyleSheet.flatten(action.parent?.props.style);
    expect(frame.width).toBeUndefined();
    expect(frame.minWidth).toBeGreaterThanOrEqual(112);
  });
});
