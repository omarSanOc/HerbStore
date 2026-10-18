import type { TFunction } from 'i18next';
import { useReducer, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { AppIcon, AppText, RemoteImage, radii, sizes, spacing, useAppTheme } from '@/design-system';
import { parseCategoryId } from '@/features/categories/parse-category-id';

import {
  initialBannerInteraction,
  reduceBannerInteraction,
} from '../carousel/banner-interaction';
import { canStepBanner, getBannerPosition, getCarouselMode } from '../carousel/banner-pager';
import { useBannerAutoplay } from '../carousel/use-banner-autoplay';
import { useBannerPager } from '../carousel/use-banner-pager';
import type { HomeBanner } from '../contracts/home';
import { BANNER_ASPECT_RATIO } from '../home-layout';
import { bannerCopyKeys } from '../logic/banner-copy';

// Module-level and closure-free. The key is the banner id, never the position.
const keyExtractor = (banner: HomeBanner) => banner.id;

const DOT_SIZE = 10;
const ACTIVE_DOT_WIDTH = 24;

type BannerCarouselProps = {
  banners: readonly HomeBanner[];
  onOpenCategory: (categoryId: string) => void;
  /** The carousel's row is inside Home's vertical viewport; autoplay only runs while it is. */
  isRowVisible: boolean;
};

/**
 * Home's banner carousel. Zero banners draw nothing (RF-15), one is shown alone (no dots, no
 * step buttons, nothing to swipe), two or more become a paged list with dots and buttons.
 * The three cases are three components so that the hooks of the paged one never run for the
 * others.
 */
export function BannerCarousel({ banners, ...handlers }: Readonly<BannerCarouselProps>) {
  const [first] = banners;

  switch (getCarouselMode(banners.length)) {
    case 'hidden':
      return null;
    case 'single':
      return <BannerSlide banner={first} onOpenCategory={handlers.onOpenCategory} />;
    case 'paged':
      return <PagedBanners banners={banners} {...handlers} />;
  }
}

/** Title and subtitle by banner id (es/en); the server text only for ids we do not know. */
function getBannerText(t: TFunction, banner: HomeBanner) {
  const keys = bannerCopyKeys(banner.id);

  return keys === undefined
    ? { title: banner.title, subtitle: banner.subtitle }
    : { title: t(keys.title), subtitle: t(keys.subtitle) };
}

function PagedBanners({ banners, onOpenCategory, isRowVisible }: Readonly<BannerCarouselProps>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotionPreference();
  // One page = the carousel's own width, measured: the list pages by the size of its viewport.
  const [pageWidth, setPageWidth] = useState(0);
  const count = banners.length;
  // What the user is doing with the list; fed only by touch / drag events, never by the pager's
  // own programmatic scrolls (see `banner-interaction.ts`).
  const [interaction, sendInteraction] = useReducer(
    reduceBannerInteraction,
    initialBannerInteraction,
  );
  const { listRef, index, goTo, step, listHandlers } = useBannerPager<HomeBanner>({
    count,
    pageWidth,
    reduceMotion,
    onGesture: sendInteraction,
  });
  useBannerAutoplay({
    count,
    index,
    goTo,
    isReady: pageWidth > 0,
    isRowVisible,
    reduceMotion,
    interaction,
    resetInteraction: () => sendInteraction('reset'),
  });

  const current = banners[index];
  const { title, subtitle } = getBannerText(t, current);
  const currentCategoryId = parseCategoryId(current.categoryId);

  const onLayout = (event: LayoutChangeEvent) => setPageWidth(event.nativeEvent.layout.width);

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case 'increment':
        step(1);
        break;
      case 'decrement':
        step(-1);
        break;
      case 'activate':
        if (currentCategoryId !== undefined) {
          onOpenCategory(currentCategoryId);
        }
        break;
    }
  };

  return (
    <View style={styles.carousel}>
      {/*
        The viewport is ONE accessibility element (an "adjustable", like UIPageControl or a
        slider): it reads the current banner and "Banner n of N", and the screen reader's
        increment / decrement gestures move the pager. The slides inside are hidden from the
        accessibility tree so they are not read twice.
      */}
      <View
        accessibilityActions={[
          { name: 'increment', label: t('home.banners.next') },
          { name: 'decrement', label: t('home.banners.previous') },
          ...(currentCategoryId === undefined
            ? []
            : [{ name: 'activate', label: t('home.banners.openCategory') }]),
        ]}
        accessibilityHint={currentCategoryId === undefined ? undefined : t('home.categoryHint')}
        accessibilityLabel={`${title}. ${subtitle}`}
        accessibilityRole="adjustable"
        accessibilityValue={{ text: t('home.banners.position', getBannerPosition(index, count)) }}
        accessible
        onAccessibilityAction={onAccessibilityAction}
        onLayout={onLayout}>
        {pageWidth > 0 ? (
          <FlatList
            accessibilityElementsHidden
            data={banners}
            // Every page has the same, known width: the list can place any page without
            // rendering the ones before it, which `scrollToOffset` relies on.
            getItemLayout={(_, position) => ({
              length: pageWidth,
              offset: pageWidth * position,
              index: position,
            })}
            horizontal
            importantForAccessibility="no-hide-descendants"
            keyExtractor={keyExtractor}
            pagingEnabled
            ref={listRef}
            renderItem={({ item }) => (
              <BannerSlide
                banner={item}
                grouped
                onOpenCategory={onOpenCategory}
                width={pageWidth}
              />
            )}
            showsHorizontalScrollIndicator={false}
            {...listHandlers}
          />
        ) : (
          // Before the first measure: the picture's frame, so the row does not start at zero height.
          <View
            style={[
              styles.measuring,
              { aspectRatio: BANNER_ASPECT_RATIO, backgroundColor: colors.border },
            ]}
          />
        )}
      </View>
      <View style={styles.controls}>
        <StepButton
          direction="previous"
          disabled={!canStepBanner(index, count, -1)}
          onPress={() => step(-1)}
        />
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.dots}>
          {banners.map((banner, position) => (
            <View
              key={banner.id}
              style={[
                styles.dot,
                position === index
                  ? { width: ACTIVE_DOT_WIDTH, backgroundColor: colors.primary, borderColor: colors.primary }
                  : { borderColor: colors.textMuted },
              ]}
            />
          ))}
        </View>
        <StepButton
          direction="next"
          disabled={!canStepBanner(index, count, 1)}
          onPress={() => step(1)}
        />
      </View>
    </View>
  );
}

type BannerSlideProps = {
  banner: HomeBanner;
  onOpenCategory: (categoryId: string) => void;
  /** Inside the paged list: the carousel's viewport is the accessibility element, not the slide. */
  grouped?: boolean;
  /** Page width; omitted for a lone banner, which takes the width of its parent. */
  width?: number;
};

/** One banner: picture, then its text (below, never over the picture, so contrast and large text hold). */
function BannerSlide({ banner, onOpenCategory, grouped = false, width }: Readonly<BannerSlideProps>) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotionPreference();
  const { title, subtitle } = getBannerText(t, banner);
  // The destination validates again; here an id that cannot be a category makes the banner inert.
  const categoryId = parseCategoryId(banner.categoryId);

  const content = (
    <>
      {/* Decorative: the title below and the label of the whole banner already describe it. */}
      <RemoteImage
        aspectRatio={BANNER_ASPECT_RATIO}
        fallbackText={t('image.unavailable')}
        path={banner.imageUrl}
        style={styles.image}
      />
      <View style={styles.text}>
        <AppText variant="subheading">{title}</AppText>
        <AppText tone="muted">{subtitle}</AppText>
      </View>
    </>
  );

  if (categoryId === undefined) {
    return <View style={[styles.slide, { width }]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityHint={t('home.categoryHint')}
      accessibilityLabel={`${title}. ${subtitle}`}
      accessibilityRole="button"
      accessible={!grouped}
      onPress={() => onOpenCategory(categoryId)}
      style={({ pressed }) => [styles.slide, { width }, pressed && !reduceMotion ? styles.pressed : null]}>
      {content}
    </Pressable>
  );
}

type StepButtonProps = {
  direction: 'previous' | 'next';
  disabled: boolean;
  onPress: () => void;
};

/** Round 48 dp button; disabled (and announced so) at the first / last banner. */
function StepButton({ direction, disabled, onPress }: Readonly<StepButtonProps>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotionPreference();
  const isNext = direction === 'next';

  return (
    <Pressable
      accessibilityHint={t(isNext ? 'home.banners.nextHint' : 'home.banners.previousHint')}
      accessibilityLabel={t(isNext ? 'home.banners.next' : 'home.banners.previous')}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepButton,
        { backgroundColor: colors.surface, borderColor: colors.controlBorder },
        disabled ? styles.disabled : null,
        pressed && !reduceMotion ? styles.pressed : null,
      ]}>
      <AppIcon
        name={
          isNext
            ? { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }
            : { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }
        }
        size={22}
        color={colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  carousel: {
    gap: spacing.sm,
  },
  measuring: {
    width: '100%',
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  slide: {
    gap: spacing.sm,
  },
  image: {
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  text: {
    gap: spacing.xs,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2,
  },
  stepButton: {
    width: sizes.minimumTouchTarget,
    height: sizes.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sizes.minimumTouchTarget / 2,
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.72,
  },
});
