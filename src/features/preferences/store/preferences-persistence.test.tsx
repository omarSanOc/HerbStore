/// <reference types="jest" />
// RF-8, RF-9, RF-10, RNF-3 (T4a). The preferences on the REAL persisted store: a choice survives the
// "restart" (a new store over the same storage), the language and a forced theme are applied once the
// disk has answered, the device language is never written as if it were a choice, and the theme of
// `system` follows the OS while the app is open. The pure rules are in `preferences.test.ts` and
// `persist-policy.test.ts` (node:test); this file proves the wiring.
//
// Compose: DataStore + `AppCompatDelegate.setApplicationLocales` after the first read. SwiftUI:
// `@AppStorage` + `.preferredColorScheme`, which the framework re-applies on every launch.
import { act, screen } from '@testing-library/react-native';
import { Appearance, Text, useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';

import { i18n } from '@/core/i18n';
import { PERSIST_KEY, PERSIST_VERSION } from '@/core/storage/persist-policy';
import { useAppSelector } from '@/core/store/hooks';
import { selectIsRehydrated } from '@/core/store/rehydration';
import { selectSubtotalMxnCents } from '@/features/cart/logic/cart-selectors';
import { productAdded } from '@/features/cart/store/cart-slice';
import { useAppTheme } from '@/design-system';

import { createMemoryStorage, createTestStore, startPersistence } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render-with-providers';

import { currencyChanged, languageChanged, selectPreferredCurrency, themeChanged } from './preferences-slice';

const STORAGE_KEY = `persist:${PERSIST_KEY}`;

const PRODUCT = { productId: 'product-261009-001', name: 'Powder 001', unitPrice: 277.9, currency: 'MXN' as const, stock: 9 };

/** Starts the app once over `storage` and waits for the disk to answer. */
async function launch(storage: ReturnType<typeof createMemoryStorage>) {
  const store = createTestStore({ storage });
  const { persistor, rehydrated } = startPersistence(store);
  await rehydrated;
  return { store, persistor };
}

function readStored(storage: ReturnType<typeof createMemoryStorage>): Record<string, string> {
  return JSON.parse(storage.data.get(STORAGE_KEY) ?? '{}') as Record<string, string>;
}

describe('preferences survive a restart', () => {
  it('language, currency and theme come back after the process is "killed" and started again', async () => {
    const storage = createMemoryStorage();
    const first = await launch(storage);
    first.store.dispatch(languageChanged('en'));
    first.store.dispatch(currencyChanged('USD'));
    first.store.dispatch(themeChanged('dark'));
    await first.persistor.flush();
    first.persistor.pause();

    await i18n.changeLanguage('es'); // a new process starts in the device language
    const setColorScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
    const second = await launch(storage);

    expect(second.store.getState().preferences).toEqual({ language: 'en', currency: 'USD', theme: 'dark' });
    expect(i18n.language).toBe('en');
    expect(setColorScheme).toHaveBeenCalledTimes(1);
    expect(setColorScheme).toHaveBeenCalledWith('dark');
    second.persistor.pause();
  });

  it('no render ever shows the restored state with the old language (no flash)', async () => {
    const storage = createMemoryStorage({
      initial: { [STORAGE_KEY]: JSON.stringify({ preferences: JSON.stringify({ language: 'en', currency: 'MXN', theme: 'system' }), _persist: JSON.stringify({ version: PERSIST_VERSION, rehydrated: true }) }) },
      holdReads: true,
    });
    const store = createTestStore({ storage });
    const { persistor, rehydrated } = startPersistence(store); // like the app: persistence starts at import
    const frames: string[] = [];
    function Probe() {
      const { i18n: instance } = useTranslation();
      const restored = useAppSelector(selectIsRehydrated);
      frames.push(`${restored ? 'restored' : 'restoring'}:${instance.language}`);
      return <Text>{`${instance.language}`}</Text>;
    }
    await renderWithProviders(<Probe />, { store, language: 'es' });
    expect(frames).toEqual(['restoring:es']);

    await act(async () => {
      storage.releaseReads();
      await rehydrated;
    });

    expect(frames).not.toContain('restored:es');
    expect(frames.at(-1)).toBe('restored:en');
    expect(screen.getByText('en')).toBeOnTheScreen();
    persistor.pause();
  });

  it('a user who never chose a language keeps the device language and nothing about it is written', async () => {
    const storage = createMemoryStorage();
    await i18n.changeLanguage('en'); // the device speaks English
    const setColorScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);

    const first = await launch(storage);
    first.store.dispatch(currencyChanged('USD'));
    await first.persistor.flush();
    first.persistor.pause();

    expect(i18n.language).toBe('en');
    expect(setColorScheme).not.toHaveBeenCalled(); // `system` and no language: the OS and the device rule
    expect(JSON.parse(readStored(storage).preferences)).toEqual({ currency: 'USD', theme: 'system' });

    await i18n.changeLanguage('es'); // the device language changes between launches
    const second = await launch(storage);
    expect(second.store.getState().preferences.language).toBeUndefined();
    expect(i18n.language).toBe('es');
    second.persistor.pause();
  });

  it('a stored invalid language is ignored (device language) while the valid theme still applies', async () => {
    const storage = createMemoryStorage({
      initial: { [STORAGE_KEY]: JSON.stringify({ preferences: JSON.stringify({ language: 'fr', currency: 'USD', theme: 'light' }), _persist: JSON.stringify({ version: PERSIST_VERSION, rehydrated: true }) }) },
    });
    const setColorScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);

    const { store, persistor } = await launch(storage);

    expect(store.getState().preferences).toEqual({ currency: 'USD', theme: 'light' });
    expect(i18n.language).toBe('es');
    expect(setColorScheme).toHaveBeenCalledWith('light');
    persistor.pause();
  });

  it('an old v3 state keeps the cart and starts the preferences from their defaults, then upgrades on the next write', async () => {
    const line = { productId: 'product-261009-001', name: 'Powder 001', unitPrice: 100, currency: 'MXN', stock: 5, quantity: 2 };
    const storage = createMemoryStorage({
      initial: { [STORAGE_KEY]: JSON.stringify({ cart: JSON.stringify({ lines: [line] }), searchHistory: JSON.stringify({ entries: ['zinc'] }), _persist: JSON.stringify({ version: 3, rehydrated: true }) }) },
    });

    const { store, persistor } = await launch(storage);
    expect(store.getState().cart.lines).toEqual([line]);
    expect(store.getState().searchHistory.entries).toEqual(['zinc']);
    expect(store.getState().preferences).toEqual({ currency: 'MXN', theme: 'system' });

    store.dispatch(themeChanged('light'));
    await persistor.flush();
    expect(JSON.parse(readStored(storage)._persist)).toEqual({ version: 4, rehydrated: true });
    persistor.pause();
  });

  it('what reaches the disk is only the whitelist: no api cache, no address or personal data', async () => {
    const storage = createMemoryStorage();
    const { store, persistor } = await launch(storage);
    store.dispatch(languageChanged('en'));
    store.dispatch(productAdded({ product: PRODUCT, quantity: 1 }));
    await persistor.flush();

    expect(Object.keys(readStored(storage)).sort()).toEqual(['_persist', 'cart', 'checkoutAttempt', 'orderHistory', 'preferences', 'searchHistory']);
    expect(storage.data.get(STORAGE_KEY)).not.toMatch(/queries|fullName|phone|postalCode|street/);
    persistor.pause();
  });
});

describe('applying a choice while the app is open', () => {
  it('the language changes immediately and the theme goes to the native appearance (alerts, keyboard, status bar)', async () => {
    const setColorScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
    const store = createTestStore();

    store.dispatch(languageChanged('en'));
    expect(i18n.language).toBe('en');
    store.dispatch(themeChanged('dark'));
    store.dispatch(themeChanged('light'));
    store.dispatch(themeChanged('system'));

    expect(setColorScheme.mock.calls.map(([scheme]) => scheme)).toEqual(['dark', 'light', 'unspecified']);
  });

  it('changing language and currency together ends with the final pair and the canonical value intact', async () => {
    const store = createTestStore();
    store.dispatch(productAdded({ product: PRODUCT, quantity: 3 }));

    await act(async () => {
      store.dispatch(languageChanged('en'));
      store.dispatch(currencyChanged('USD'));
      store.dispatch(languageChanged('es'));
      store.dispatch(currencyChanged('MXN'));
      store.dispatch(languageChanged('en'));
      store.dispatch(currencyChanged('USD'));
    });

    expect(i18n.language).toBe('en');
    expect(selectPreferredCurrency(store.getState())).toBe('USD');
    expect(selectSubtotalMxnCents(store.getState())).toBe(83_370); // 3 x 277.90 MXN, never touched
  });
});

describe('the theme of the UI', () => {
  function SchemeProbe() {
    const { scheme, colors } = useAppTheme();
    return <Text>{`${scheme} ${colors.background}`}</Text>;
  }

  it('`system` follows the OS while the app is open, a forced theme does not', async () => {
    const store = createTestStore();
    const { rerender } = await renderWithProviders(<SchemeProbe />, { store, colorScheme: 'light' });
    expect(screen.getByText(/^light /)).toBeOnTheScreen();

    jest.mocked(useColorScheme).mockReturnValue('dark'); // the user switches the OS to dark
    await rerender(<SchemeProbe />);
    expect(screen.getByText(/^dark /)).toBeOnTheScreen();

    await act(async () => {
      store.dispatch(themeChanged('light')); // forced light, the OS says dark
    });
    expect(screen.getByText(/^light /)).toBeOnTheScreen();

    jest.mocked(useColorScheme).mockReturnValue('light');
    await rerender(<SchemeProbe />);
    await act(async () => {
      store.dispatch(themeChanged('dark')); // forced dark, the OS says light
    });
    expect(screen.getByText(/^dark /)).toBeOnTheScreen();

    await act(async () => {
      store.dispatch(themeChanged('system'));
    });
    expect(screen.getByText(/^light /)).toBeOnTheScreen();
  });

  it('every screen reads the same preference: a second consumer shows the same scheme', async () => {
    const store = createTestStore();
    store.dispatch(themeChanged('dark'));
    await renderWithProviders(
      <>
        <SchemeProbe />
        <SchemeProbe />
      </>,
      { store, colorScheme: 'light' },
    );
    expect(screen.getAllByText(/^dark /)).toHaveLength(2);
  });
});
