import { View, type ViewProps } from 'react-native';

import { useAppTheme } from '@/design-system/theme';

type AppSurfaceProps = ViewProps & {
  level?: 'page' | 'card';
};

export function AppSurface({ level = 'card', style, ...props }: Readonly<AppSurfaceProps>) {
  const { colors } = useAppTheme();
  const backgroundColor = level === 'page' ? colors.background : colors.surface;

  return <View style={[{ backgroundColor }, style]} {...props} />;
}
