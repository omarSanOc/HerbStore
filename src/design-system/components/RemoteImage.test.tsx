/// <reference types="jest" />
// RF-15 (spec 006, T6c). An image that arrives fades in over 200 ms; with reduced motion it appears at
// once (a cross-fade is a transition the user did not ask for). The frame, the label and the fallback do
// not change either way.
//
// Android: Coil `crossfade(false)`; iOS: `UIView.transition` skipped; Compose: `crossfade(enable)`.
import { act, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { apiOrigin } from '@/core/network/api-origin';
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

// RF-32, RF-35 (spec 007, T3). The states of a picture the user can meet: reserved frame with its
// placeholder while it loads, and the labelled fallback when it cannot be shown (empty path, 4xx,
// 5xx, bytes that will not decode, an unsafe path). The fallback is TEXT inside the frame: it is
// never a button, so there is no action that leads nowhere, and it travels with the name when the
// image is information on its own.
//
// Android: Coil `error(drawable)` + a placeholder color; an `ImageView` is not clickable, so
// TalkBack reads the content description. SwiftUI: `AsyncImage` with the `error` and `empty`
// phases, `.accessibilityLabel` on the resolved image only.
describe('RemoteImage and a picture that cannot be shown', () => {
  const lastImageProps = () => mockImageProps.mock.lastCall?.[0] as Record<string, any>;

  /** The reserved frame: the first view whose style carries the aspect ratio the test gave. */
  function frameNode(aspectRatio: number) {
    const root = screen.toJSON() as unknown as Record<string, any> | null;
    const pending = [root];
    while (pending.length > 0) {
      const node = pending.shift() as Record<string, any> | null;
      if (node === null || node === undefined) continue;
      if (StyleSheet.flatten(node.props?.style)?.aspectRatio === aspectRatio) return node;
      pending.push(...((node.children as Record<string, any>[] | undefined) ?? []));
    }
    return undefined;
  }

  beforeEach(() => {
    mockImageProps.mockClear();
    jest.mocked(useReducedMotionPreference).mockReturnValue(false);
  });

  it('LOADING: the reserved frame keeps its neutral placeholder and no fallback text is drawn', async () => {
    await renderWithProviders(<RemoteImage aspectRatio={2} fallbackText="No image" path="/images/a.png" />);

    // The picture is in flight (one view, exact URI), and the frame is already laid out with a
    // neutral color so the layout never jumps. No spinner, no text, nothing that moves.
    expect(mockImageProps).toHaveBeenCalledTimes(1);
    expect(lastImageProps().source).toEqual({ uri: `${apiOrigin}/images/a.png` });
    expect(screen.queryByText('No image')).not.toBeOnTheScreen();
    expect(StyleSheet.flatten(frameNode(2)?.props.style).backgroundColor).toEqual(expect.any(String));
  });

  it('EMPTY PATH: the labelled fallback is shown, nothing is requested and nothing is pressable', async () => {
    await renderWithProviders(
      <RemoteImage aspectRatio={1} fallbackText="No image" label="Complete Daily Powder" path="" />,
    );

    expect(mockImageProps).not.toHaveBeenCalled();
    expect(screen.getByText('No image')).toBeOnTheScreen();
    // The name travels with the fallback: the reader says WHAT is missing, not only "no image".
    expect(screen.getByLabelText('Complete Daily Powder. No image')).toBeOnTheScreen();
    // No ghost action: the frame is a plain view, never a button.
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('DECORATIVE: without a label the picture and its fallback leave the accessibility tree', async () => {
    await renderWithProviders(<RemoteImage aspectRatio={1} fallbackText="No image" path={undefined} />);

    const frame = frameNode(1);
    expect(frame?.props.accessible).toBe(false);
    expect(frame?.props.accessibilityElementsHidden).toBe(true);
    expect(frame?.props.importantForAccessibility).toBe('no-hide-descendants');
    // The text is still VISIBLE for whoever reads the screen, it is only not read aloud twice.
    expect(screen.getByText('No image', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('ERROR: `onError` (4xx, 5xx or bytes that will not decode) swaps the picture for the fallback', async () => {
    await renderWithProviders(
      <RemoteImage aspectRatio={1} fallbackText="No image" label="Complete Daily Powder" path="/images/a.png" />,
    );
    expect(screen.queryByText('No image')).not.toBeOnTheScreen();

    // expo-image reports every failure the same way, so one branch covers a missing file, a
    // non-2xx answer and undecodable bytes (RF-32).
    await act(async () => {
      lastImageProps().onError(new Error('decoding failed'));
    });

    expect(mockImageProps).toHaveBeenCalledTimes(1); // the picture is gone; no new attempt is drawn
    expect(screen.getByText('No image')).toBeOnTheScreen();
    expect(screen.getByLabelText('Complete Daily Powder. No image')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('A NEW PATH tries again: the failure is remembered per URI, not forever', async () => {
    const view = await renderWithProviders(
      <RemoteImage aspectRatio={1} fallbackText="No image" path="/images/a.png" />,
    );
    await act(async () => {
      lastImageProps().onError(new Error('404'));
    });
    expect(screen.getByText('No image', { includeHiddenElements: true })).toBeOnTheScreen();

    await view.rerender(<RemoteImage aspectRatio={1} fallbackText="No image" path="/images/b.png" />);

    expect(mockImageProps).toHaveBeenCalledTimes(2);
    expect(lastImageProps().source).toEqual({ uri: `${apiOrigin}/images/b.png` });
    expect(screen.queryByText('No image', { includeHiddenElements: true })).not.toBeOnTheScreen();
  });

  it('AN UNSAFE PATH never reaches the image component (it is shown as its fallback)', async () => {
    await renderWithProviders(
      <RemoteImage aspectRatio={1} fallbackText="No image" path="javascript:alert(1)" />,
    );

    expect(mockImageProps).not.toHaveBeenCalled();
    expect(screen.getByText('No image', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
