/// <reference types="jest" />
// RF-22 to RF-24, RNF-3 (T2). The value every localized query takes as an argument: exactly what
// i18n is showing, narrowed to `es | en`, and updated when i18n announces a new language.
//
// `.tsx` with no JSX: the extension only selects the runner (Jest), because a hook needs RNTL.
import { act, renderHook } from '@testing-library/react-native';

import { deviceLanguage, i18n, supportedLanguages } from './index';
import { useCurrentLanguage } from './use-current-language';

describe('useCurrentLanguage', () => {
  afterEach(async () => {
    await i18n.changeLanguage('es');
  });

  it('returns the language i18n is showing', async () => {
    await i18n.changeLanguage('en');

    const { result } = await renderHook(() => useCurrentLanguage());

    expect(result.current).toBe('en');
  });

  it('re-renders with the new language when i18n changes, without any other source of truth', async () => {
    await i18n.changeLanguage('es');
    const { result } = await renderHook(() => useCurrentLanguage());
    expect(result.current).toBe('es');

    await act(async () => {
      await i18n.changeLanguage('en');
    });

    expect(result.current).toBe('en');
  });

  it('never returns a code outside es|en: anything else falls back to the device language', async () => {
    const original = i18n.language;
    i18n.language = 'fr';
    try {
      const { result } = await renderHook(() => useCurrentLanguage());

      expect(result.current).toBe(deviceLanguage);
      expect(supportedLanguages).toContain(result.current);
    } finally {
      i18n.language = original;
    }
  });
});
