import { createContext, type ReactNode, use } from 'react';
import { useColorScheme } from 'react-native';

import { palettes } from './palettes';

type ColorScheme = 'light' | 'dark';

export type AppTheme = {
  scheme: ColorScheme;
  colors: (typeof palettes)[ColorScheme];
};

const lightTheme: AppTheme = { scheme: 'light', colors: palettes.light };
const darkTheme: AppTheme = { scheme: 'dark', colors: palettes.dark };
const AppThemeContext = createContext<AppTheme>(lightTheme);

type AppThemeProviderProps = Readonly<{
  children: ReactNode;
  /**
   * The scheme to draw, already resolved by the owner of the user's preference
   * (`PreferencesThemeProvider`). Without it the provider follows the system scheme, which is what
   * the global error screen needs: it lives above the Redux store and cannot read a preference.
   */
  scheme?: ColorScheme;
}>;

export function AppThemeProvider({ children, scheme }: AppThemeProviderProps) {
  const systemScheme = useColorScheme();
  const theme = (scheme ?? systemScheme) === 'dark' ? darkTheme : lightTheme;

  return <AppThemeContext value={theme}>{children}</AppThemeContext>;
}

export function useAppTheme() {
  return use(AppThemeContext);
}
