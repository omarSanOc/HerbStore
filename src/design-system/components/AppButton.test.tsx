/// <reference types="jest" />
// RF-4 (T3a). The button every screen is built on: its accessible contract (role, name, state,
// hint), its 44/48-point target, and the reduced-motion rule (no pressed fade).
//
// Compose: `Modifier.semantics { role = Role.Button; selected = … }` + `assertHasClickAction()`.
// SwiftUI: `.accessibilityAddTraits(.isButton)` / `.isSelected`.
import { fireEvent, screen, userEvent } from '@testing-library/react-native';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { renderWithProviders } from '@/test/render-with-providers';

import { AppButton } from './AppButton';

jest.mock('@/core/accessibility/use-reduced-motion', () => ({ useReducedMotionPreference: jest.fn(() => false) }));

describe('AppButton', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(useReducedMotionPreference).mockReturnValue(false);
  });

  it('is a button named by its label, with a hint, and presses call onPress', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<AppButton accessibilityHint="Does the thing." label="Retry" onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Retry' });
    expect(button).toHaveProp('accessibilityHint', 'Does the thing.');
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('can speak more than it draws: "Filters (2)" is named "Filters, 2 active"', async () => {
    await renderWithProviders(
      <AppButton accessibilityHint="h" accessibilityLabel="Filters, 2 active" label="Filters (2)" onPress={jest.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Filters, 2 active' })).toBeOnTheScreen();
  });

  it('DISABLED: exposes the disabled state and ignores presses', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<AppButton accessibilityHint="h" disabled label="Pay" onPress={onPress} />);

    expect(screen.getByRole('button', { name: 'Pay' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Pay' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('SELECTED is announced as a state; `primary` looks selected but is NOT announced as such', async () => {
    await renderWithProviders(
      <>
        <AppButton accessibilityHint="h" label="On" onPress={jest.fn()} selected />
        <AppButton accessibilityHint="h" label="Apply" onPress={jest.fn()} variant="primary" />
      </>,
    );

    expect(screen.getByRole('button', { name: 'On' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Apply' })).not.toBeSelected();
  });

  it('keeps a touch target of at least 44 points', async () => {
    await renderWithProviders(<AppButton accessibilityHint="h" label="Tap" onPress={jest.fn()} />);

    const button = screen.getByRole('button', { name: 'Tap' });
    const style = Object.assign({}, ...[button.props.style].flat(Infinity).filter(Boolean));
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
  });

  it('PRESSED feedback fades the button, except with reduced motion', async () => {
    await renderWithProviders(<AppButton accessibilityHint="h" label="Tap" onPress={jest.fn()} />);
    const user = userEvent.setup();

    // A long press keeps the finger down long enough to observe the pressed state.
    const pressing = user.longPress(screen.getByRole('button', { name: 'Tap' }), { duration: 500 });
    await jest.advanceTimersByTimeAsync(100);
    expect(screen.getByRole('button', { name: 'Tap' })).toHaveStyle({ opacity: 0.72 });
    await jest.advanceTimersByTimeAsync(600);
    await pressing;
  });

  it('REDUCED MOTION: no pressed fade', async () => {
    jest.mocked(useReducedMotionPreference).mockReturnValue(true);
    await renderWithProviders(<AppButton accessibilityHint="h" label="Tap" onPress={jest.fn()} />);

    const user = userEvent.setup();

    const pressing = user.longPress(screen.getByRole('button', { name: 'Tap' }), { duration: 500 });
    await jest.advanceTimersByTimeAsync(100);
    expect(screen.getByRole('button', { name: 'Tap' })).not.toHaveStyle({ opacity: 0.72 });
    await jest.advanceTimersByTimeAsync(600);
    await pressing;
  });
});
