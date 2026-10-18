/// <reference types="jest" />
// RF-8, RNF-3 (T4a). Foundations has no preference of its own: its language buttons go through the
// same slice as Account, so there is one source of truth (the tests prove the store receives it and
// that Account shows the same choice).
//
// Compose: two screens reading the same `StateFlow`. SwiftUI: two views over the same `@Observable`.
import { fireEvent, screen } from '@testing-library/react-native';

import { i18n } from '@/core/i18n';
import { createTestStore } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render-with-providers';

import { FoundationScreen } from './FoundationScreen';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);

describe('Foundations language buttons', () => {
  it('shows the theme that the preference resolved', async () => {
    const store = createTestStore();
    store.dispatch({ type: 'preferences/themeChanged', payload: 'dark' });
    await renderWithProviders(<FoundationScreen />, { language: 'es', store, colorScheme: 'light' });

    expect(screen.getByText(/^Tema:\s+oscuro$/)).toBeOnTheScreen();
  });

  it('record the choice in the shared preference (the same slice Account reads)', async () => {
    const store = createTestStore();
    await renderWithProviders(<FoundationScreen />, { language: 'es', store });

    await fireEvent.press(screen.getByRole('button', { name: 'Inglés' }));

    expect(store.getState().preferences.language).toBe('en');
    expect(i18n.language).toBe('en');
    expect(screen.getByRole('button', { name: 'English' }).props.accessibilityState.selected).toBe(true);
  });
});
