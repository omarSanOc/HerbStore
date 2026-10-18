/// <reference types="jest" />
// RF-15 (spec 006, T6c). An image that arrives fades in over 200 ms; with reduced motion it appears at
// once (a cross-fade is a transition the user did not ask for). The frame, the label and the fallback do
// not change either way.
//
// Android: Coil `crossfade(false)`; iOS: `UIView.transition` skipped; Compose: `crossfade(enable)`.
import { screen } from '@testing-library/react-native';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { renderWithProviders } from '@/test/render-with-providers';

import { RemoteImage } from './RemoteImage';

jest.mock('@/core/accessibility/use-reduced-motion', () => ({ useReducedMotionPreference: jest.fn(() => false) }));

// `expo-image` is a native view: a stand-in that records the props `RemoteImage` gives it.
const mockImageProps = jest.fn();
jest.mock('expo-image', () => ({
  Image: (props: object) => {
    mockImageProps(props);
    return null;
  },
}));

const lastTransition = () => mockImageProps.mock.lastCall?.[0].transition as number;

describe('RemoteImage and reduced motion', () => {
  beforeEach(() => {
    mockImageProps.mockClear();
    jest.mocked(useReducedMotionPreference).mockReturnValue(false);
  });

  it('WITH MOTION: the picture fades in over 200 ms', async () => {
    await renderWithProviders(<RemoteImage aspectRatio={1} fallbackText="No image" path="/images/a.png" />);

    expect(lastTransition()).toBe(200);
  });

  it('REDUCED MOTION: the picture appears at once (no transition)', async () => {
    jest.mocked(useReducedMotionPreference).mockReturnValue(true);
    await renderWithProviders(<RemoteImage aspectRatio={1} fallbackText="No image" path="/images/a.png" />);

    expect(lastTransition()).toBe(0);
  });

  it('REDUCED MOTION: the fallback text of a missing picture is the same static text', async () => {
    jest.mocked(useReducedMotionPreference).mockReturnValue(true);
    await renderWithProviders(<RemoteImage aspectRatio={1} fallbackText="No image" path={undefined} />);

    expect(screen.getByText('No image', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(mockImageProps).not.toHaveBeenCalled();
  });
});
