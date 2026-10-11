import { useLocalSearchParams } from 'expo-router';

import { CategoryPlaceholderScreen } from '@/features/categories/screens/CategoryPlaceholderScreen';

export default function CategoryRoute() {
  // `id` is typed as string | string[] | undefined: validation happens in the feature.
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();

  return <CategoryPlaceholderScreen rawId={id} />;
}
