import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { AppText, fontScaleLimits, radii, spacing, useAppTheme } from '@/design-system';

import {
  type AddFeedbackModel,
  type AddFeedbackPart,
  resolveFeedbackMotion,
} from '../logic/add-feedback';

type AddToCartFeedbackProps = Readonly<{ model: AddFeedbackModel }>;

function feedbackPartText(part: AddFeedbackPart, t: ReturnType<typeof useTranslation>['t']) {
  switch (part.key) {
    case 'added':
      return t('product.feedback.added', { count: part.count });
    case 'maxInCart':
      return t('product.feedback.maxInCart', { count: part.count });
    case 'locked':
      return t('product.feedback.locked');
    case 'soldOut':
      return t('product.feedback.soldOut');
  }
}

/** A keyed instance is mounted for every add event, so equal consecutive messages animate again. */
export function AddToCartFeedback({ model }: AddToCartFeedbackProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const reducedMotion = useReducedMotionPreference();
  const motion = resolveFeedbackMotion(reducedMotion);
  const { animated, fadeInMs, fadeOutMs, holdMs } = motion;
  const opacity = useSharedValue(motion.animated ? 0 : 1);
  const translateY = useSharedValue(motion.startOffsetY);
  const scale = useSharedValue(motion.startScale);
  const [dismissed, setDismissed] = useState(false);
  const message = model.parts.map((part) => feedbackPartText(part, t)).join(' ');

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);

    if (animated) {
      opacity.value = withSequence(
        withTiming(1, { duration: fadeInMs, easing: Easing.out(Easing.cubic) }),
        withDelay(holdMs, withTiming(0, { duration: fadeOutMs })),
      );
      translateY.value = withTiming(0, {
        duration: fadeInMs,
        easing: Easing.out(Easing.cubic),
      });
      scale.value = withTiming(1, {
        duration: fadeInMs,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      // Android can report the system preference just after this component mounts. Reanimated may
      // already have reduced the initial sequence to its final opacity (0), so entering this branch
      // must restore the visible, motionless state explicitly.
      opacity.value = 1;
      translateY.value = 0;
      scale.value = 1;
    }

    const timer = setTimeout(
      () => setDismissed(true),
      fadeInMs + holdMs + fadeOutMs,
    );
    return () => clearTimeout(timer);
  }, [animated, fadeInMs, fadeOutMs, holdMs, message, opacity, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  if (dismissed) {
    return null;
  }

  return (
    <Animated.View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        styles.message,
        {
          backgroundColor: colors.surface,
          borderColor: model.tone === 'success' ? colors.primary : colors.border,
        },
        animatedStyle,
      ]}>
      <AppText maxFontSizeMultiplier={fontScaleLimits.purchaseBar} variant="label">
        {message}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  message: {
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    elevation: 4,
  },
});
