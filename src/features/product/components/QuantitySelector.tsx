import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { AppText, radii, sizes, spacing, useAppTheme } from '@/design-system';

import { MIN_QUANTITY } from '../logic/quantity';

/** Where a change came from: a screen reader's own gesture already reads the new value. */
export type QuantityStepSource = 'button' | 'accessibility-action';

type QuantitySelectorProps = {
  /** The quantity on screen: `1 <= quantity <= stock`. */
  quantity: number;
  /** Units that can be ordered now, already formatted for the language ("1,500"). */
  stockText: string;
  /** "Maximum available: 3 units." Always visible: the limit is known before it is hit. */
  limitText: string;
  /** The last attempt went past the stock: the text gets emphasis, not only a sound (RF-6). */
  limitReached: boolean;
  onStep: (step: 1 | -1, source: QuantityStepSource) => void;
};

/**
 * Minus, the quantity and plus (spec 004, RF-6). The quantity itself is LOCAL state of the screen
 * (it dies with it); this component only draws it and reports the person's intent.
 *
 * - Both buttons are 48 dp and carry text glyphs, not an icon font: they scale with the system
 *   font and never depend on a symbol set. Minus is disabled at one unit (and announced so).
 *   Plus stays ENABLED at the stock: pressing it there is the "attempt to exceed" that must keep
 *   the maximum and say so, which a disabled button could not do.
 * - The quantity is an "adjustable" accessibility element (like a slider or iOS's Stepper): it
 *   reads "Quantity, 3 of 99" and the increment / decrement gestures of the screen reader change
 *   it. The buttons stay reachable for people who explore by touch or by switch.
 * - The limit is TEXT below the row (always there, bold once it is hit), so it never depends on a
 *   sound or a color.
 *
 * Compose: a `Row` with two `IconButton`s and a `Text`, or `Modifier.semantics { stateDescription }`
 * on the value; SwiftUI: `Stepper`, which is one adjustable element with + and - as its actions.
 */
export function QuantitySelector({
  quantity,
  stockText,
  limitText,
  limitReached,
  onStep,
}: Readonly<QuantitySelectorProps>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case 'increment':
        onStep(1, 'accessibility-action');
        break;
      case 'decrement':
        onStep(-1, 'accessibility-action');
        break;
    }
  };

  return (
    <View style={styles.column}>
      <View style={styles.row}>
        <StepButton
          accessibilityHint={t('product.quantity.decreaseHint')}
          accessibilityLabel={t('product.quantity.decrease')}
          disabled={quantity <= MIN_QUANTITY}
          glyph={'−'}
          onPress={() => onStep(-1, 'button')}
        />
        <View
          accessibilityActions={[
            { name: 'increment', label: t('product.quantity.increase') },
            { name: 'decrement', label: t('product.quantity.decrease') },
          ]}
          accessibilityLabel={t('product.quantity.heading')}
          accessibilityRole="adjustable"
          accessibilityValue={{ text: t('product.quantity.value', { quantity, max: stockText }) }}
          accessible
          onAccessibilityAction={onAccessibilityAction}
          style={[styles.value, { backgroundColor: colors.surface, borderColor: colors.controlBorder }]}>
          <AppText maxFontSizeMultiplier={2} variant="subheading">
            {quantity}
          </AppText>
        </View>
        <StepButton
          accessibilityHint={t('product.quantity.increaseHint')}
          accessibilityLabel={t('product.quantity.increase')}
          disabled={false}
          glyph="+"
          onPress={() => onStep(1, 'button')}
        />
      </View>
      {/*
        Permanent on purpose: a line that APPEARS at the end of a scrolled page lands under the pinned
        bar and cannot be seen. Hitting the limit only changes its emphasis; the announcement is made
        by the screen.
      */}
      <AppText style={limitReached ? styles.limitReached : null} tone={limitReached ? 'default' : 'muted'}>
        {limitText}
      </AppText>
    </View>
  );
}

type StepButtonProps = {
  accessibilityLabel: string;
  accessibilityHint: string;
  disabled: boolean;
  glyph: string;
  onPress: () => void;
};

function StepButton({
  accessibilityLabel,
  accessibilityHint,
  disabled,
  glyph,
  onPress,
}: Readonly<StepButtonProps>) {
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotionPreference();

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
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
      {/* Decorative: the button already has its own spoken label. */}
      <AppText
        accessibilityElementsHidden
        importantForAccessibility="no"
        maxFontSizeMultiplier={2}
        variant="subheading">
        {glyph}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepButton: {
    minWidth: sizes.minimumTouchTarget,
    minHeight: sizes.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  value: {
    minWidth: sizes.minimumTouchTarget + spacing.md,
    minHeight: sizes.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  // Same line height as the muted body text: hitting the limit must not move the page by a pixel.
  limitReached: {
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.72,
  },
});
