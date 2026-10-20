/// <reference types="jest" />
import type { ReactNode } from 'react';

import { renderWithProviders } from '@/test/render-with-providers';

import TabsLayout from '@/app/(tabs)/_layout';

const mockTabNames: string[] = [];

jest.mock('expo-router', () => {
  const Tabs = Object.assign(
    ({ children }: Readonly<{ children: ReactNode }>) => children,
    {
      Screen: ({ name }: Readonly<{ name: string }>) => {
        mockTabNames.push(name);
        return null;
      },
    },
  );

  return { Tabs };
});

describe('TabsLayout', () => {
  beforeEach(() => {
    mockTabNames.length = 0;
  });

  it('registers exactly Home, Cart and Account tabs', async () => {
    await renderWithProviders(<TabsLayout />);

    expect(mockTabNames).toEqual(['(home)', '(cart)', '(account)']);
  });
});
