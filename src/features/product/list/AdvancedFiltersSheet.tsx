import { useState, type Ref } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import {
  AppBottomSheet,
  AppBottomSheetScrollView,
  AppButton,
  AppText,
  fontScaleLimits,
  radii,
  sizes,
  spacing,
  typography,
  useAppBottomSheet,
  useAppTheme,
  type AppBottomSheetHandle,
} from '@/design-system';
import { subcategoryLabelKey } from '@/features/categories/category-labels';

import { useGetBrandsQuery, useGetCategoriesQuery } from '../data/products-api';
import { shouldStackActions } from '../logic/action-bar-layout';
import { selectSubcategoryOptions } from '../logic/facet-options';
import {
  toggleFacetValue,
  type AdvancedFiltersDraft,
  type ListParams,
} from '../logic/list-params';

/** Width of "Cancelar" (the longest action label) in em at the label's font: measured, 4.0 / 3.97. */
const ACTION_LABEL_WIDTH_EM = 4;

type AdvancedFiltersSheetProps = {
  ref: Ref<AppBottomSheetHandle>;
  /** The applied params: the draft starts as a copy of their brands and subcategories. */
  applied: ListParams;
  /** Category of the list: only its subcategories are offered. Without it (search), all of them. */
  category?: string;
  /** Called with the final draft when the user presses Apply. Cancelling never calls it. */
  onApply: (draft: AdvancedFiltersDraft) => void;
};

/**
 * The advanced filters in a bottom sheet (RF-14): brands and subcategories as checkbox rows, with
 * Apply and Cancel always visible below the list.
 *
 * DRAFT versus APPLIED. What the user ticks here is a local DRAFT; the list does not change, and no
 * request is made, until Apply. Cancel, the Close button, the drag gesture, Android Back and a tap
 * on the backdrop all just close the sheet: the draft is thrown away and the applied filters stay.
 * The trick is where the draft lives: in `AdvancedFiltersForm`, which is rendered only while the
 * sheet is open (the modal unmounts its content when it closes). Opening it again mounts a new form
 * whose draft starts as a copy of whatever is applied NOW, so "discarding" needs no code at all.
 *
 * The options load when the sheet opens (the form is what asks for them), not when the list screen
 * mounts: a user who never opens the sheet never pays for the two requests. They are cached, so the
 * second opening shows them at once.
 *
 * Compose: a `ModalBottomSheet` whose content keeps `remember { mutableStateOf(applied) }` (a copy)
 * and calls `onApply(draft)` from its button. SwiftUI: `.sheet` whose view holds
 * `@State private var draft = applied` and passes it back from "Apply".
 */
export function AdvancedFiltersSheet({
  ref,
  applied,
  category,
  onApply,
}: Readonly<AdvancedFiltersSheetProps>) {
  const { t } = useTranslation();

  return (
    <AppBottomSheet
      ref={ref}
      closeHint={t('productList.advanced.closeHint')}
      closeLabel={t('productList.advanced.close')}
      layout="fixed"
      name="advanced-filters"
      title={t('productList.advanced.title')}>
      <AdvancedFiltersForm applied={applied} category={category} onApply={onApply} />
    </AppBottomSheet>
  );
}

type AdvancedFiltersFormProps = Pick<AdvancedFiltersSheetProps, 'applied' | 'category' | 'onApply'>;

function AdvancedFiltersForm({
  applied,
  category,
  onApply,
}: Readonly<AdvancedFiltersFormProps>) {
  const { t } = useTranslation();
  const { dismiss } = useAppBottomSheet();
  // The draft. `useState` keeps ONLY the first value: later renders (even with other applied
  // params) do not reset it while the sheet is open.
  const [draft, setDraft] = useState<AdvancedFiltersDraft>(() => ({
    brands: applied.brands,
    subcategories: applied.subcategories,
  }));
  const { fontScale, width: windowWidth } = useWindowDimensions();
  const brandsQuery = useGetBrandsQuery();
  const categoriesQuery = useGetCategoriesQuery();

  // One row while a half of it holds "Cancelar" on one line; otherwise one button above the other.
  const stackActions = shouldStackActions({
    windowWidth,
    horizontalInset: spacing.md,
    gap: spacing.sm,
    fontScale,
    maxFontScale: fontScaleLimits.actionLabel,
    baseFontSize: typography.label.fontSize,
    longestLabelEm: ACTION_LABEL_WIDTH_EM,
    buttonChrome: 2 * spacing.md + 2,
  });

  const brandOptions = brandsQuery.data;
  const subcategoryOptions =
    categoriesQuery.data === undefined
      ? undefined
      : selectSubcategoryOptions(categoriesQuery.data, category);

  const handleApply = () => {
    // Apply first, then close: the list already queries the new filters when the sheet leaves.
    onApply(draft);
    dismiss();
  };

  return (
    <>
      <AppBottomSheetScrollView
        contentContainerStyle={styles.scrollContent}
        style={styles.scroll}>
        <View style={styles.section}>
          <AppText
            accessibilityRole="header"
            maxFontSizeMultiplier={fontScaleLimits.sectionHeading}
            variant="subheading">
            {t('productList.advanced.brandsHeading')}
          </AppText>
          {brandOptions === undefined ? (
            <OptionsStatus
              failed={!brandsQuery.isFetching}
              onRetry={() => void brandsQuery.refetch()}
            />
          ) : (
            brandOptions.map((brand) => (
              <FacetOption
                key={brand.name}
                label={brand.name}
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    brands: toggleFacetValue(current.brands, brand.name),
                  }))
                }
                selected={draft.brands.includes(brand.name)}
              />
            ))
          )}
        </View>
        <View style={styles.section}>
          <AppText
            accessibilityRole="header"
            maxFontSizeMultiplier={fontScaleLimits.sectionHeading}
            variant="subheading">
            {t('productList.advanced.subcategoriesHeading')}
          </AppText>
          {subcategoryOptions === undefined ? (
            <OptionsStatus
              failed={!categoriesQuery.isFetching}
              onRetry={() => void categoriesQuery.refetch()}
            />
          ) : subcategoryOptions.length === 0 ? (
            <AppText tone="muted">{t('productList.advanced.noSubcategories')}</AppText>
          ) : (
            subcategoryOptions.map((subcategory) => {
              // Our translation of the 15 known ones; any other shows the text the server sent.
              const labelKey = subcategoryLabelKey(subcategory.id);
              return (
                <FacetOption
                  key={subcategory.id}
                  label={labelKey === undefined ? subcategory.name : t(labelKey)}
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      subcategories: toggleFacetValue(current.subcategories, subcategory.id),
                    }))
                  }
                  selected={draft.subcategories.includes(subcategory.id)}
                />
              );
            })
          )}
        </View>
      </AppBottomSheetScrollView>
      {/* Outside the scroll area: Cancel and Apply never scroll away with a long list. */}
      <View style={[styles.actions, stackActions ? styles.actionsStacked : null]}>
        <View style={stackActions ? null : styles.action}>
          <AppButton
            accessibilityHint={t('productList.advanced.cancelHint')}
            label={t('productList.advanced.cancel')}
            maxFontSizeMultiplier={fontScaleLimits.actionLabel}
            onPress={dismiss}
          />
        </View>
        <View style={stackActions ? null : styles.action}>
          <AppButton
            accessibilityHint={t('productList.advanced.applyHint')}
            label={t('productList.advanced.apply')}
            maxFontSizeMultiplier={fontScaleLimits.actionLabel}
            onPress={handleApply}
            variant="primary"
          />
        </View>
      </View>
    </>
  );
}

type OptionsStatusProps = {
  /** True when the request ended without options; false while it is still loading. */
  failed: boolean;
  onRetry: () => void;
};

/** What a facet shows before it has options: static "loading" text, or the failure and Retry. */
function OptionsStatus({ failed, onRetry }: Readonly<OptionsStatusProps>) {
  const { t } = useTranslation();

  if (!failed) {
    // Text only, no spinner: nothing moves, so reduced motion needs no special case (RNF-3).
    return (
      <AppText accessibilityLiveRegion="polite" tone="muted">
        {t('productList.advanced.loading')}
      </AppText>
    );
  }

  return (
    <View style={styles.status}>
      <AppText accessibilityLiveRegion="polite">{t('productList.advanced.loadFailed')}</AppText>
      <AppButton
        accessibilityHint={t('productList.advanced.retryHint')}
        label={t('productList.advanced.retry')}
        onPress={onRetry}
      />
    </View>
  );
}

type FacetOptionProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * One checkbox row (a brand or a subcategory). Role `checkbox` and state `checked`: iOS speaks
 * "checked", TalkBack "checked/not checked". Sighted users also get a check mark, a thicker border
 * and bolder text, so a selection does not depend on color alone. The layout is the one that fixed
 * T10 at large fonts: the label takes `flex: 1` (and may shrink: `minWidth: 0`), the mark has a slot
 * of fixed width, and the label scale is capped so one long word still fits the row.
 *
 * Compose: `Row(Modifier.toggleable(value, role = Role.Checkbox))`. SwiftUI: `Toggle(isOn:)` with
 * `.toggleStyle(.checkbox)` (macOS) or a `Button` with `.accessibilityAddTraits(.isSelected)`.
 */
function FacetOption({ label, selected, onPress }: Readonly<FacetOptionProps>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotionPreference();

  return (
    <Pressable
      accessibilityHint={t(
        selected ? 'productList.advanced.deselectHint' : 'productList.advanced.selectHint',
      )}
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          borderColor: selected ? colors.primary : colors.border,
          // A border of constant width, so selecting does not move the text.
          borderWidth: selected ? 2 : 1,
        },
        pressed && !reduceMotion ? styles.pressed : null,
      ]}>
      <AppText
        maxFontSizeMultiplier={fontScaleLimits.optionLabel}
        style={styles.optionLabel}
        variant={selected ? 'label' : 'body'}>
        {label}
      </AppText>
      <View style={styles.checkSlot}>
        <AppText
          accessibilityElementsHidden
          importantForAccessibility="no"
          maxFontSizeMultiplier={fontScaleLimits.selectionMark}
          style={{ color: colors.primary }}
          variant="label">
          {selected ? '✓' : ''}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  status: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  option: {
    minHeight: sizes.minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  optionLabel: {
    flex: 1,
    minWidth: 0,
  },
  checkSlot: {
    width: spacing.lg,
    alignItems: 'center',
  },
  // Cancel and Apply share the row, half each. When "Cancelar" does not fit half a row at the
  // scale in use, `actionsStacked` puts one above the other at full width (see `shouldStackActions`).
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionsStacked: {
    flexDirection: 'column',
  },
  action: {
    flex: 1,
  },
  pressed: {
    opacity: 0.72,
  },
});
