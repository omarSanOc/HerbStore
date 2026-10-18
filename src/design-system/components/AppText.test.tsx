/// <reference types="jest" />
// H-10 (= N-4, spec 006 T6c). On iOS, changing the text size with the app open leaves every `Text` at the
// box it measured before; a text that is remounted is measured again. `AppText` is the only text of
// the app, so it remounts its `Text` when the font scale changes, on iOS only (Android relaunches the
// Activity on that change). Its parents, and so their state, are untouched.
//
// Android: `onConfigurationChanged` / recreate(); iOS: `UIContentSizeCategory.didChangeNotification`.
import { act, screen } from '@testing-library/react-native';
import { Dimensions, Platform } from 'react-native';

import { mockFontScale } from '@/test/font-scale';
import { renderWithProviders } from '@/test/render-with-providers';

import { AppText } from './AppText';

/** The system announces a new size: the same event a Settings change sends. */
async function changeFontScaleTo(fontScale: number) {
  mockFontScale(fontScale);
  await act(async () => {
    Dimensions.set({ window: Dimensions.get('window'), screen: Dimensions.get('screen') });
  });
}

describe('AppText', () => {
  it('draws its text with the theme colors and keeps the typography of its variant', async () => {
    mockFontScale(1);
    await renderWithProviders(<AppText variant="heading">Vitamins</AppText>);

    expect(screen.getByText('Vitamins')).toHaveStyle({ fontSize: 28, fontWeight: '700' });
  });

  it('iOS: a new text size remounts the text so it is measured again', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockFontScale(1);
    const attached = jest.fn();
    await renderWithProviders(<AppText ref={attached}>Vitamins</AppText>);
    const attachments = () => attached.mock.calls.filter(([node]) => node !== null).length;
    expect(attachments()).toBe(1);

    await changeFontScaleTo(2);
    expect(attachments()).toBe(2);

    await changeFontScaleTo(3.1);
    expect(attachments()).toBe(3);
    expect(screen.getByText('Vitamins')).toBeOnTheScreen();
  });

  it('iOS: the same text size does not remount (no work without a change)', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockFontScale(2);
    const attached = jest.fn();
    await renderWithProviders(<AppText ref={attached}>Vitamins</AppText>);

    await changeFontScaleTo(2);
    expect(attached.mock.calls.filter(([node]) => node !== null)).toHaveLength(1);
  });

  it('Android: the system relaunches the screen on a font change, so the text is not remounted', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    mockFontScale(1);
    const attached = jest.fn();
    await renderWithProviders(<AppText ref={attached}>Vitamins</AppText>);

    await changeFontScaleTo(2);
    expect(attached.mock.calls.filter(([node]) => node !== null)).toHaveLength(1);
  });
});
