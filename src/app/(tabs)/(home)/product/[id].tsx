import { useLocalSearchParams } from 'expo-router';

import { ProductPlaceholderScreen } from '@/features/product/screens/ProductPlaceholderScreen';

export default function ProductRoute() {
  // `id` is typed as string | string[] | undefined: validation happens in the feature.
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();

  return <ProductPlaceholderScreen rawId={id} />;
}
