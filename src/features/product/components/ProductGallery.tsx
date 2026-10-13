import { useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { RemoteImage, spacing, useAppTheme } from '@/design-system';
// The pure rules of Home's pager (offset <-> index, bounded steps, "n of N") are generic: the
// gallery pages exactly like the banners. Importing them avoids a second copy; moving them to
// `core/` is a refactor for later (their names still say "banner").
import {
  clampBannerIndex,
  getBannerPosition,
  getCarouselMode,
  indexFromOffset,
  offsetForIndex,
  stepBannerIndex,
  type BannerStep,
} from '@/features/home/carousel/banner-pager';

const DOT_SIZE = 10;
const ACTIVE_DOT_WIDTH = 24;

type ProductGalleryProps = {
  /** Server paths such as `/images/products/product-001-front.png`; may be empty. */
  images: readonly string[];
  /** Product name: it labels the gallery for a screen reader. */
  name: string;
};

/**
 * The pictures of a product, square and full width. Zero pictures draw the labelled fallback of
 * `RemoteImage` ("Image not available"), one is shown alone (nothing to swipe, no dots) and two or
 * more become a paged horizontal list with dots. The three cases are three components so the hooks
 * of the paged one never run for the others (the same split as Home's banner carousel).
 *
 * The pictures come from `RemoteImage` (expo-image underneath): the frame is square BEFORE the
 * bitmap arrives, so the layout never jumps, and an image that fails shows visible text.
 */
export function ProductGallery({ images, name }: Readonly<ProductGalleryProps>) {
  const { t } = useTranslation();

  switch (getCarouselMode(images.length)) {
    case 'hidden':
      return (
        <RemoteImage
          aspectRatio={1}
          fallbackText={t('image.unavailable')}
          label={name}
          path={undefined}
        />
      );
    case 'single':
      return (
        <RemoteImage
          aspectRatio={1}
          fallbackText={t('image.unavailable')}
          label={name}
          path={images[0]}
        />
      );
    case 'paged':
      return <PagedGallery images={images} name={name} />;
  }
}

function PagedGallery({ images, name }: Readonly<ProductGalleryProps>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotionPreference();
  const scrollRef = useRef<ScrollView>(null);
  // One page = the gallery's own width, measured: the list pages by the size of its viewport.
  const [pageWidth, setPageWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const count = images.length;
  const position = getBannerPosition(index, count);

  const goTo = (target: number) => {
    const next = clampBannerIndex(target, count);
    setIndex(next);
    scrollRef.current?.scrollTo({
      x: offsetForIndex(next, pageWidth, count),
      // A jump instead of a slide when the person asked for less motion (RNF-3).
      animated: !reduceMotion,
    });
  };
  const step = (direction: BannerStep) => goTo(stepBannerIndex(index, count, direction));

  // The index changes when a swipe SETTLES, not on every scroll frame: a frame-by-frame `setState`
  // would re-render the gallery 60 times per swipe for nothing.
  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(indexFromOffset(event.nativeEvent.contentOffset.x, pageWidth, count));

  // A new page width (rotation, split screen) leaves the offset pointing elsewhere: realign.
  const onContentSizeChange = () =>
    scrollRef.current?.scrollTo({ x: offsetForIndex(index, pageWidth, count), animated: false });

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case 'increment':
        step(1);
        break;
      case 'decrement':
        step(-1);
        break;
    }
  };

  return (
    <View style={styles.gallery}>
      {/*
        The viewport is ONE accessibility element (an "adjustable", like UIPageControl or a slider):
        it reads the name of the product and "Picture n of N", and the increment / decrement gestures
        of the screen reader move the pager. The pages are hidden from the accessibility tree so
        they are not read twice, and the dots below are decorative.
      */}
      <View
        accessibilityActions={[
          { name: 'increment', label: t('product.gallery.next') },
          { name: 'decrement', label: t('product.gallery.previous') },
        ]}
        accessibilityLabel={t('product.gallery.label', { name })}
        accessibilityRole="adjustable"
        accessibilityValue={{ text: t('product.gallery.position', position) }}
        accessible
        onAccessibilityAction={onAccessibilityAction}
        onLayout={(event: LayoutChangeEvent) => setPageWidth(event.nativeEvent.layout.width)}>
        {pageWidth > 0 ? (
          <ScrollView
            accessibilityElementsHidden
            horizontal
            importantForAccessibility="no-hide-descendants"
            onContentSizeChange={onContentSizeChange}
            onMomentumScrollEnd={onMomentumScrollEnd}
            pagingEnabled
            ref={scrollRef}
            showsHorizontalScrollIndicator={false}>
            {images.map((path, page) => (
              <RemoteImage
                key={`${page}:${path}`}
                aspectRatio={1}
                fallbackText={t('image.unavailable')}
                path={path}
                style={{ width: pageWidth }}
              />
            ))}
          </ScrollView>
        ) : (
          // Before the first measure: the square frame, so the screen does not start at zero height.
          <View style={[styles.measuring, { backgroundColor: colors.border }]} />
        )}
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.dots}>
        {images.map((path, dot) => (
          <View
            key={`${dot}:${path}`}
            style={[
              styles.dot,
              dot === index
                ? {
                    width: ACTIVE_DOT_WIDTH,
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  }
                : { borderColor: colors.textMuted },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gallery: {
    gap: spacing.sm,
  },
  measuring: {
    width: '100%',
    aspectRatio: 1,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2,
  },
});
