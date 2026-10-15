import { useLocalSearchParams } from 'expo-router';

import { ScannerProductFrame } from '@/features/scanner/components/ScannerProductFrame';
import { ProductDetailScreen } from '@/features/product/screens/ProductDetailScreen';

export default function ScannedProductRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  // The scanner modal has no tab bar: the frame keeps the purchase bar above the system bar.
  return (
    <ScannerProductFrame>
      <ProductDetailScreen rawId={id} />
    </ScannerProductFrame>
  );
}
