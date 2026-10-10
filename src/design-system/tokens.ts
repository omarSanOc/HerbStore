export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 16,
  pill: 999,
} as const;

export const typography = {
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  label: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  heading: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
  },
  subheading: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
  },
} as const;

export const sizes = {
  minimumTouchTarget: 48,
  contentMaxWidth: 560,
} as const;
