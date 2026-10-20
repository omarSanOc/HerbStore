import { useState, type Ref, type RefObject } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ScreenReaderFocusTarget } from '@/core/accessibility/screen-reader-focus';
import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { useCurrentLanguage } from '@/core/i18n/use-current-language';
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
import { toApiError } from '@/core/api/api-error';

import type { BrandOption, CategoryNode } from '../contracts/catalog-product';
import { useGetBrandsQuery, useGetCategoriesQuery } from '../data/products-api';
import { shouldStackActions } from '../logic/action-bar-layout';
import {
  classifyFacetQueryState,
  type FacetProblemState,
} from '../logic/facet-query-state';
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
  /** The button that opens this sheet: the screen-reader focus goes back to it on close. */
  returnFocusTo?: RefObject<ScreenReaderFocusTarget | null>;
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
  returnFocusTo,
}: Readonly<AdvancedFiltersSheetProps>) {
  const { t } = useTranslation();

  return (
    <AppBottomSheet
      ref={ref}
      closeHint={t('productList.advanced.closeHint')}
      closeLabel={t('productList.advanced.close')}
      layout="fixed"
      name="advanced-filters"
      returnFocusTo={returnFocusTo}
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
  // Facet options are localized reads (RF-9, RF-22): the language is part of the query argument,
  // so the panel shows the names of the language the list is being read in, never a mix of both.
  const language = useCurrentLanguage();
  // The draft. `useState` keeps ONLY the first value: later renders (even with other applied
  // params) do not reset it while the sheet is open.
  const [draft, setDraft] = useState<AdvancedFiltersDraft>(() => ({
    brands: applied.brands,
    subcategories: applied.subcategories,
  }));
  const { fontScale, width: windowWidth } = useWindowDimensions();
  const brandsQuery = useGetBrandsQuery(language);
  const categoriesQuery = useGetCategoriesQuery(language);

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

  // RF-23, RF-30, RF-34: the panel's state is a pure rule over the query snapshot (`facet-query-state`),
  // the same way Home and the list classify theirs. `currentData` (never `data`) keeps the options
  // of the CURRENT language only, so a switch never prints names of the language being left.
  const brandsState = classifyFacetQueryState<BrandOption>({
    currentData: brandsQuery.currentData,
    error: toApiError(brandsQuery.error),
    isFetching: brandsQuery.isFetching,
  });
  const categoriesState = classifyFacetQueryState<CategoryNode>({
    currentData: categoriesQuery.currentData,
    error: toApiError(categoriesQuery.error),
    isFetching: categoriesQuery.isFetching,
  });
  // The subcategories offered: only the ones of this category (a vitamin filter never lists
  // "zinc"); empty when the tree is not there or knows no subcategory of it (never invented).
  const subcategoryOptions =
    categoriesState.status === 'ready' || categoriesState.status === 'stale'
      ? selectSubcategoryOptions(categoriesState.options, category)
      : [];

  const handleApply = () => {
    // Apply first, then close: the list already queries the new filters when the sheet leaves. The
    // focus goes back to the Filters button, whose label now says how many are active.
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
          {brandsState.status === 'ready' || brandsState.status === 'stale' ? (
            <>
              {brandsState.status === 'stale' ? (
                <OptionsNotice onRetry={() => void brandsQuery.refetch()} />
              ) : null}
              {brandsState.options.map((brand) => (
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
              ))}
            </>
          ) : (
            <OptionsStatus
              emptyLabel={t('productList.advanced.noBrands')}
              problem={brandsState}
              onRetry={() => void brandsQuery.refetch()}
            />
          )}
        </View>
        <View style={styles.section}>
          <AppText
            accessibilityRole="header"
            maxFontSizeMultiplier={fontScaleLimits.sectionHeading}
            variant="subheading">
            {t('productList.advanced.subcategoriesHeading')}
          </AppText>
          {categoriesState.status === 'ready' || categoriesState.status === 'stale' ? (
            <>
              {categoriesState.status === 'stale' ? (
                <OptionsNotice onRetry={() => void categoriesQuery.refetch()} />
              ) : null}
              {subcategoryOptions.length === 0 ? (
                <AppText accessibilityLiveRegion="polite" tone="muted">
                  {t('productList.advanced.noSubcategories')}
                </AppText>
              ) : (
                subcategoryOptions.map((subcategory) => (
                  // RF-9, RF-22: the label is the name the API sent in this language. No translation
                  // by id: the sheet shows the same words the server owns, never a mix of both.
                  <FacetOption
                    key={subcategory.id}
                    label={subcategory.name}
                    onPress={() =>
                      setDraft((current) => ({
                        ...current,
                        subcategories: toggleFacetValue(current.subcategories, subcategory.id),
                      }))
                    }
                    selected={draft.subcategories.includes(subcategory.id)}
                  />
                ))
              )}
            </>
          ) : (
            <OptionsStatus
              emptyLabel={t('productList.advanced.noSubcategories')}
              problem={categoriesState}
              onRetry={() => void categoriesQuery.refetch()}
            />
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
  /** One of the states that show a message instead of options: loading, empty, offline or error. */
  problem: FacetProblemState;
  /** What "there is nothing here" says: brands and subcategories say it differently. */
  emptyLabel: string;
  onRetry: () => void;
};

/**
 * What a facet shows when it has no options to offer (RF-30): a polite live-region message for
 * every state of the matrix, and a retry when the state is a failure. `ready` and `stale` never
 * come here: they show the options.
 */
function OptionsStatus({ problem, emptyLabel, onRetry }: Readonly<OptionsStatusProps>) {
  const { t } = useTranslation();

  switch (problem.status) {
    case 'loading':
      // Text only, no spinner: nothing moves, so reduced motion needs no special case (RNF-3).
      return (
        <AppText accessibilityLiveRegion="polite" tone="muted">
          {t('productList.advanced.loading')}
        </AppText>
      );
    case 'empty':
      // A valid empty array: the panel stays operable, it just has nothing to offer.
      return (
        <AppText accessibilityLiveRegion="polite" tone="muted">
          {emptyLabel}
        </AppText>
      );
    case 'offline':
    case 'error':
      // Different words for a dead connection and for a server that answered badly (RF-30/RF-34),
      // the same retry: the user never has to guess what happened.
      return (
        <View style={styles.status}>
          <AppText accessibilityLiveRegion="polite">
            {problem.status === 'offline'
              ? t('productList.advanced.offline')
              : t('productList.advanced.loadFailed')}
          </AppText>
          <AppButton
            accessibilityHint={t('productList.advanced.retryHint')}
            label={t('productList.advanced.retry')}
            onPress={onRetry}
          />
        </View>
      );
  }
}

/** RF-30: a failed refresh keeps the options on screen, with this notice and a retry above them. */
function OptionsNotice({ onRetry }: Readonly<{ onRetry: () => void }>) {
  const { t } = useTranslation();

  return (
    <View style={styles.status}>
      <AppText accessibilityLiveRegion="polite" tone="muted">
        {t('productList.advanced.updateFailed')}
      </AppText>
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
          borderColor: selected ? colors.primary : colors.controlBorder,
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
