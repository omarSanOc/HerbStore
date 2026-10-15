import { createContext, type ReactNode, use } from 'react';
import { useColorScheme } from 'react-native';

type ColorScheme = 'light' | 'dark';

const palettes = {
  light: {
    background: '#F4F7F2',
    surface: '#FFFFFF',
    text: '#172019',
    textMuted: '#506055',
    primary: '#176B45',
    success: '#187F48',
    warning: '#7A4A00',
    error: '#A52A2A',
    onPrimary: '#FFFFFF',
    border: '#C9D5CC',
  },
  dark: {
    background: '#0F1611',
    surface: '#19231C',
    text: '#F1F5F2',
    textMuted: '#B7C5BA',
    primary: '#72DCA2',
    success: '#71D99A',
    warning: '#F4C66A',
    error: '#FFB4AB',
    onPrimary: '#092B1A',
    border: '#3B4D40',
  },
} as const;

export type AppTheme = {
  scheme: ColorScheme;
  colors: (typeof palettes)[ColorScheme];
};

const lightTheme: AppTheme = { scheme: 'light', colors: palettes.light };
const darkTheme: AppTheme = { scheme: 'dark', colors: palettes.dark };
const AppThemeContext = createContext<AppTheme>(lightTheme);

export function AppThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  return <AppThemeContext value={theme}>{children}</AppThemeContext>;
}

export function useAppTheme() {
  return use(AppThemeContext);
}
