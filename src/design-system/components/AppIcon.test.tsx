/// <reference types="jest" />
// H-1/H-11 (= S-4, spec 006 T6c). On Android an icon of `SymbolView` is a `Text` that scales with the
// system font size inside a fixed box; from `font_scale` 1.3 its glyph was cut in the tab bar, the
// search field and the carousel arrows. `AppIcon` keeps the size it was given. Still decorative.
//
// Compose: `Icon(Modifier.size(24.dp))` (dp, never scaled). SwiftUI: an SF Symbol of fixed point size.
import { screen } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';

import { mockFontScale } from '@/test/font-scale';
import { renderWithProviders } from '@/test/render-with-providers';

import { AppIcon } from './AppIcon';

// The native symbol cannot run in Jest: a stand-in that records the props `AppIcon` gives it.
const mockSymbolProps = jest.fn();
jest.mock('expo-symbols', () => ({
  SymbolView: (props: object) => {
    mockSymbolProps(props);
    return null;
  },
}));

function symbol(): { size: number; style: object } {
  return mockSymbolProps.mock.lastCall?.[0];
}

const name = { ios: 'house.fill', android: 'home', web: 'home' } as const;

function symbolBox() {
  const style = StyleSheet.flatten(symbol().style) as { width: number; height: number };
  return { width: style.width, height: style.height };
}

describe('AppIcon', () => {
  beforeEach(() => {
    mockSymbolProps.mockClear();
  });

  describe('Android (the icon is a font glyph that scales)', () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'android');
    });

    it('is drawn at the requested size at the default font scale', async () => {
      mockFontScale(1);
      await renderWithProviders(<AppIcon name={name} size={26} />);

      expect(symbol().size).toBe(26);
      expect(symbolBox()).toEqual({ width: 26, height: 26 });
    });

    it.each([1.3, 1.5, 2])(
      'keeps a 26 dp glyph in a 26 dp box at font scale %s (the system multiplies the font size back)',
      async (fontScale) => {
        mockFontScale(fontScale);
        await renderWithProviders(<AppIcon name={name} size={26} />);

        const fontSize = symbol().size;
        expect(fontSize * fontScale).toBeCloseTo(26, 9);
        expect(symbolBox()).toEqual({ width: 26, height: 26 });
      },
    );
  });

  it('iOS: an SF Symbol is a fixed number of points, so nothing is compensated', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockFontScale(3.1);
    await renderWithProviders(<AppIcon name={name} size={26} />);

    expect(symbol().size).toBe(26);
    expect(symbolBox()).toEqual({ width: 26, height: 26 });
  });

  it('stays decorative: hidden from TalkBack and VoiceOver, with no accessible node of its own', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    mockFontScale(2);
    const { toJSON } = await renderWithProviders(<AppIcon name={name} size={26} />);

    const wrapper = JSON.stringify(toJSON());
    expect(wrapper).toContain('"importantForAccessibility":"no-hide-descendants"');
    expect(wrapper).toContain('"accessibilityElementsHidden":true');
    expect(screen.queryByRole('image')).toBeNull();
  });
});
