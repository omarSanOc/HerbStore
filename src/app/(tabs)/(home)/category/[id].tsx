import { useLocalSearchParams } from 'expo-router';

import { CategoryProductsScreen } from '@/features/categories/screens/CategoryProductsScreen';

export default function CategoryRoute() {
  // `id` is typed as string | string[] | undefined: validation happens in the feature.
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();

  return <CategoryProductsScreen rawId={id} />;
}
