/// <reference types="jest" />
// RF-8, RF-9, RF-10, RNF-3 (T4a). Account is where language, currency and theme are chosen. Tested
// as a user of a screen reader would use it: controls by role and name, the selected one announced
// as selected, in Spanish and English and in both themes.
//
// Compose: `onNodeWithText("Dark").performClick()` + `assertIsSelected()`. XCUITest:
// `app.buttons["Dark"].tap()` and `isSelected`.
import { fireEvent, screen } from '@testing-library/react-native';
import { Appearance, StyleSheet } from 'react-native';

import { i18n } from '@/core/i18n';
import { createTestStore } from '@/test/fixtures';
import { resetRouterMock, router } from '@/test/mock-expo-router';
import { renderWithProviders } from '@/test/render-with-providers';

import { AccountScreen } from './AccountScreen';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);

const TEXT = {
  es: {
    headings: ['Idioma', 'Moneda de los precios', 'Tema'],
    language: { es: 'Español', en: 'English' },
    currency: { MXN: 'Pesos (MXN)', USD: 'Dólares (USD)' },
    theme: { system: 'Sistema', light: 'Claro', dark: 'Oscuro' },
  },
  en: {
    headings: ['Language', 'Price currency', 'Theme'],
    language: { es: 'Español', en: 'English' },
    currency: { MXN: 'Pesos (MXN)', USD: 'Dollars (USD)' },
    theme: { system: 'System', light: 'Light', dark: 'Dark' },
  },
} as const;

const isSelected = (name: string) => screen.getByRole('button', { name }).props.accessibilityState?.selected === true;

beforeEach(() => {
  resetRouterMock();
  jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
});

describe.each(['es', 'en'] as const)('Account preferences in %s', (language) => {
  const text = TEXT[language];

  it('shows the three preferences as headings, each control a named button with a hint', async () => {
    await renderWithProviders(<AccountScreen />, { language });

    for (const heading of text.headings) expect(screen.getByRole('header', { name: heading })).toBeOnTheScreen();
    for (const label of [...Object.values(text.language), ...Object.values(text.currency), ...Object.values(text.theme)]) {
      const button = screen.getByRole('button', { name: label });
      expect(button.props.accessibilityHint).toEqual(expect.any(String));
      expect(button.props.accessibilityHint).not.toBe('');
    }
  });

  it('starts with the current language, MXN and System selected, and only those', async () => {
    await renderWithProviders(<AccountScreen />, { language });

    expect(isSelected(text.language[language])).toBe(true);
    expect(isSelected(text.language[language === 'es' ? 'en' : 'es'])).toBe(false);
    expect(isSelected(text.currency.MXN)).toBe(true);
    expect(isSelected(text.currency.USD)).toBe(false);
    expect(isSelected(text.theme.system)).toBe(true);
    expect(isSelected(text.theme.light)).toBe(false);
    expect(isSelected(text.theme.dark)).toBe(false);
  });

  it('every preference control keeps a 44/48 target', async () => {
    await renderWithProviders(<AccountScreen />, { language });

    for (const label of [...Object.values(text.language), ...Object.values(text.currency), ...Object.values(text.theme)]) {
      const style = StyleSheet.flatten(screen.getByRole('button', { name: label }).props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
    }
  });

  it('choosing a currency and a theme updates the store and the selected state', async () => {
    const store = createTestStore();
    await renderWithProviders(<AccountScreen />, { language, store });

    await fireEvent.press(screen.getByRole('button', { name: text.currency.USD }));
    await fireEvent.press(screen.getByRole('button', { name: text.theme.dark }));

    expect(store.getState().preferences).toEqual({ currency: 'USD', theme: 'dark' });
    expect(isSelected(text.currency.USD)).toBe(true);
    expect(isSelected(text.currency.MXN)).toBe(false);
    expect(isSelected(text.theme.dark)).toBe(true);
    expect(isSelected(text.theme.system)).toBe(false);
    expect(Appearance.setColorScheme).toHaveBeenCalledWith('dark');
  });
});

describe('Account changes the language of the whole screen', () => {
  it('Spanish to English: texts, hints and the selected state follow, and the choice is recorded', async () => {
    const store = createTestStore();
    await renderWithProviders(<AccountScreen />, { language: 'es', store });

    await fireEvent.press(screen.getByRole('button', { name: 'English' }));

    // Choosing a language touches neither the currency nor the theme.
    expect(store.getState().preferences).toEqual({ language: 'en', currency: 'MXN', theme: 'system' });
    expect(i18n.language).toBe('en');
    expect(screen.getByRole('header', { name: 'Language' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Dollars (USD)' })).toBeOnTheScreen();
    expect(isSelected('English')).toBe(true);
    expect(isSelected('Español')).toBe(false);
    expect(screen.getByRole('button', { name: 'English' }).props.accessibilityHint).toBe('Changes the app to English.');
  });

  it('English to Spanish', async () => {
    const store = createTestStore();
    await renderWithProviders(<AccountScreen />, { language: 'en', store });

    await fireEvent.press(screen.getByRole('button', { name: 'Español' }));

    expect(i18n.language).toBe('es');
    expect(screen.getByRole('header', { name: 'Moneda de los precios' })).toBeOnTheScreen();
    expect(isSelected('Español')).toBe(true);
  });

  // T4b (RF-11): the way to "My orders" is a named button, and a double tap opens it once (singular route).
  it.each([
    ['es', 'Mis pedidos', 'Abre los pedidos confirmados en esta instalación.'],
    ['en', 'My orders', 'Opens the orders confirmed on this installation.'],
  ] as const)('%s: offers "%s" with a hint, and opens the orders list once', async (language, label, hint) => {
    await renderWithProviders(<AccountScreen />, { language });

    const button = screen.getByRole('button', { name: label });
    expect(button.props.accessibilityHint).toBe(hint);
    expect(StyleSheet.flatten(button.props.style).minHeight).toBeGreaterThanOrEqual(48);
    await fireEvent.press(button);
    await fireEvent.press(button);

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/(tabs)/(account)/orders');
  });

  it('keeps the way to Foundations and DeviceInsights', async () => {
    await renderWithProviders(<AccountScreen />);
    expect(screen.getByRole('button', { name: /Fundamentos/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /DeviceInsights/ })).toBeOnTheScreen();
  });
});

describe.each(['light', 'dark'] as const)('Account in the %s theme', (colorScheme) => {
  it('renders every control (no unreadable or missing control)', async () => {
    await renderWithProviders(<AccountScreen />, { colorScheme });
    expect(screen.getAllByRole('button')).toHaveLength(2 + 2 + 3 + 3); // language, currency, theme, three links
  });
});
