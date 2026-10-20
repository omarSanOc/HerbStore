/// <reference types="jest" />
// RF-8, RF-22 (spec 007, T3). A section heading is COPY OF THE CATALOG: the title of the localized
// response, shown as it arrives. The heading of the row is chrome, but the words inside it belong to
// the API, so the render below (Spanish chrome, English payload title) must print "Best sellers":
// while the heading was built with `t('home.sections.<id>')` it printed "Más vendidos" instead.
//
// Android: `string.xml` per section id drifts from the backend; SwiftUI: a `Localizable` entry has
// the same problem. The response owns the text, i18n owns only the chrome around it.
import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render-with-providers';
import { homeData } from '../testing/home-test-data';

import { ProductSection } from './ProductSection';

describe('ProductSection and remote copy', () => {
  it('RF-8: the heading is the section title the API sent, never a translation by section id', async () => {
    const section = homeData().sections[0];
    await renderWithProviders(<ProductSection section={section} onOpenProduct={jest.fn()} />, { language: 'es' });

    expect(screen.getByRole('header', { name: 'Best sellers' })).toBeOnTheScreen();
    expect(screen.queryByText('Más vendidos')).not.toBeOnTheScreen();
  });
});
