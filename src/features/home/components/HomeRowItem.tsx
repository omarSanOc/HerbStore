import type { HomeRow } from '../logic/build-home-rows';
import { BannerCarousel } from './BannerCarousel';
import { CategoryRow } from './CategoryRow';
import { ProductSection } from './ProductSection';
import { HomeNoticeRow } from './HomeNoticeRow';
import { HomeSkeleton } from './HomeSkeleton';
import { HomeStatusRow } from './HomeStatusRow';

type HomeRowItemProps = {
  row: HomeRow;
  /** Whether the banner row is inside Home's viewport; only the banner row uses it. */
  isBannerRowVisible: boolean;
  onRetry: () => void;
  onOpenCategory: (categoryId: string) => void;
  onOpenProduct: (productId: string) => void;
};

/** One `switch` over `row.kind`: the compiler flags any row kind that is not handled. */
export function HomeRowItem({
  row,
  isBannerRowVisible,
  onRetry,
  onOpenCategory,
  onOpenProduct,
}: Readonly<HomeRowItemProps>) {
  switch (row.kind) {
    case 'loading':
      return <HomeSkeleton />;
    case 'status':
      return <HomeStatusRow onRetry={onRetry} status={row.status} />;
    case 'notice':
      return <HomeNoticeRow notice={row.notice} onRetry={onRetry} />;
    case 'banners':
      // A different banner count restarts the carousel (index and scroll back to the first banner).
      return (
        <BannerCarousel
          banners={row.banners}
          isRowVisible={isBannerRowVisible}
          key={row.banners.length}
          onOpenCategory={onOpenCategory}
        />
      );
    case 'categories':
      return <CategoryRow categories={row.categories} onOpenCategory={onOpenCategory} />;
    case 'section':
      return <ProductSection onOpenProduct={onOpenProduct} section={row.section} />;
  }
}
