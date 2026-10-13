import { useLocalSearchParams } from 'expo-router';

import { ProductDetailScreen } from '@/features/product/screens/ProductDetailScreen';

export default function ProductRoute() {
  // `id` is typed as string | string[] | undefined: validation happens in the feature.
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();

  return <ProductDetailScreen rawId={id} />;
}
