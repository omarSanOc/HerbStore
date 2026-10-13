import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
} from '@gorhom/bottom-sheet';
import {
  createContext,
  use,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, BackHandler, StyleSheet, Text, View } from 'react-native';
import { ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { modalSheetRegistry } from '@/core/accessibility/modal-sheet-registry';
import { AppButton } from '@/design-system/components/AppButton';
import { AppText } from '@/design-system/components/AppText';
import { radii, spacing } from '@/design-system/tokens';
import { useAppTheme } from '@/design-system/theme';

/** What a screen can ask of a sheet. */
export type AppBottomSheetHandle = {
  present: () => void;
  dismiss: () => void;
};

/** Height of a `fixed` sheet, as a share of the space under the status bar. */
const FIXED_SNAP_POINTS = ['90%'];

/**
 * The scroll view to use INSIDE a `fixed` sheet. It is Gorhom's own, re-exported so features do
 * not import the library: it is the one that lets the sheet's drag gesture and the list's scroll
 * share the touch (a plain `ScrollView` would fight the sheet for it).
 */
export { BottomSheetScrollView as AppBottomSheetScrollView };

type AppBottomSheetProps = {
  ref: Ref<AppBottomSheetHandle>;
  /** Unique per sheet: the registry that hides the app from screen readers keys on it. */
  name: string;
  title: string;
  closeLabel: string;
  closeHint: string;
  /**
   * `content` (default): the sheet is as tall as its content (up to the screen) and the title,
   * the Close button and the body scroll together.
   *
   * `fixed`: a tall sheet of constant height whose title row stays on top and whose body is a
   * column of the remaining height. The body brings its OWN scroll area (`AppBottomSheetScrollView`
   * with `flex: 1`) and, below it, any bar that must always be visible (Apply / Cancel). Use it
   * when the buttons that finish the task cannot scroll away with a long list.
   */
  layout?: 'content' | 'fixed';
  /** The body. Anything inside can close the sheet with `useAppBottomSheet().dismiss`. */
  children: ReactNode;
  /** After the sheet is fully closed and unmounted (any way of closing). */
  onDismiss?: () => void;
};

type AppBottomSheetControls = { dismiss: () => void };

const AppBottomSheetContext = createContext<AppBottomSheetControls>({ dismiss: () => {} });

/**
 * Controls of the sheet the caller is inside of. A context (and not a prop) because the content is
 * drawn in Gorhom's portal, but the provider below sits INSIDE the portal, next to the content, so
 * the value always reaches it.
 */
export function useAppBottomSheet(): AppBottomSheetControls {
  return use(AppBottomSheetContext);
}

// The three pieces below replace Gorhom's defaults on purpose. The defaults work, but they are
// white (wrong in dark theme) and they ARE accessible nodes with English text ("Bottom Sheet",
// "Bottom sheet handle", "Drag up or down to extend or minimize the bottom sheet", "Bottom sheet
// backdrop"), which a screen reader would read in a Spanish app. Module-level components, as
// Gorhom asks, so they keep their identity between renders.

function SheetBackground({ pointerEvents, style }: Readonly<BottomSheetBackgroundProps>) {
  const { colors } = useAppTheme();

  return (
    <View
      pointerEvents={pointerEvents}
      style={[
        style,
        styles.background,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    />
  );
}

/** The grab bar. Decorative: the Close button is the accessible way out, so it is not a node. */
function SheetHandle() {
  const { colors } = useAppTheme();

  return (
    <View style={styles.handleArea}>
      <View style={[styles.handle, { backgroundColor: colors.border }]} />
    </View>
  );
}

/** Dims what is behind and closes on tap. Not an accessible node (same reason as the handle). */
function SheetBackdrop(props: Readonly<BottomSheetBackdropProps>) {
  const { t } = useTranslation();

  return (
    <BottomSheetBackdrop
      {...props}
      // One snap point (index 0): the defaults (appear on 1, disappear on 0) would never dim.
      accessibilityHint={t('bottomSheet.backdropHint')}
      accessibilityLabel={null}
      accessibilityRole={null}
      accessible={false}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.5}
    />
  );
}

/**
 * A modal bottom sheet with a title and a VISIBLE Close button, on Gorhom's `BottomSheetModal`.
 *
 * What the library gives (5.2.14, checked in its source): `present()`/`dismiss()`, dynamic sizing
 * from the content, pan-down to close (`enablePanDownToClose`), the backdrop and the portal host
 * (`BottomSheetModalProvider` in the root layout). What it does NOT give, and this wrapper adds:
 *
 * - Android Back. There is no `BackHandler` in the library, so Back would close the SCREEN under
 *   the sheet. While the sheet is open this registers a `hardwareBackPress` listener that closes
 *   it (listeners run last-registered first, so it wins over the navigator's).
 * - Reduced motion. The sheet already follows Reanimated's reading of the system setting; to also
 *   follow the app's single source (`useReducedMotionPreference`) it passes
 *   `overrideReduceMotion={ReduceMotion.Always}` when it is on: the sheet then jumps to its
 *   position and the backdrop appears without sliding or fading in steps.
 * - Accessibility. The library marks the content as ONE accessible element (`role=adjustable`,
 *   "Bottom Sheet"), which on iOS would swallow every button inside it; `accessible={false}`
 *   undoes that. The background, handle and backdrop are replaced (above). The app behind is
 *   hidden from screen readers through the registry. Focus moves to the title when the sheet
 *   settles, and the iOS "escape" gesture (two-finger Z) closes it.
 *
 * Compose: `ModalBottomSheet(onDismissRequest, sheetState)` (a separate window, so accessibility
 * and Back are handled by the platform). SwiftUI: `.sheet(isPresented:)` with
 * `.presentationDetents([.medium, .large])` and `.presentationDragIndicator(.visible)`.
 */
export function AppBottomSheet({
  ref,
  name,
  title,
  closeLabel,
  closeHint,
  layout = 'content',
  children,
  onDismiss,
}: Readonly<AppBottomSheetProps>) {
  const modalRef = useRef<BottomSheetModal>(null);
  const titleRef = useRef<Text>(null);
  const reduceMotion = useReducedMotionPreference();
  const insets = useSafeAreaInsets();
  // True from `present()` until the sheet has unmounted: Back is ours during all of it.
  const [isOpen, setIsOpen] = useState(false);

  const open = () => {
    setIsOpen(true);
    modalRef.current?.present();
  };

  const close = () => {
    modalRef.current?.dismiss();
  };

  useImperativeHandle(ref, () => ({ present: open, dismiss: close }));

  // While open: Android Back closes the sheet (see the doc above) and the app behind is hidden
  // from screen readers. Both are an external system, hence an effect with its own cleanup (which
  // also runs if the screen unmounts with the sheet open).
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    modalSheetRegistry.setOpen(name, true);
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      modalRef.current?.dismiss();
      return true;
    });

    return () => {
      subscription.remove();
      modalSheetRegistry.setOpen(name, false);
    };
  }, [isOpen, name]);

  const handleDismissed = () => {
    setIsOpen(false);
    onDismiss?.();
  };

  const handleChange = (index: number) => {
    if (index >= 0 && titleRef.current !== null) {
      // Screen-reader focus on the title, once the sheet is in place (not trapped: Close, Back,
      // the escape gesture and a drag all leave).
      AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
    }
  };

  const isFixed = layout === 'fixed';
  const titleRow = (
    <View style={styles.titleRow}>
      <AppText
        ref={titleRef}
        accessibilityRole="header"
        style={styles.title}
        variant="subheading">
        {title}
      </AppText>
      <AppButton accessibilityHint={closeHint} label={closeLabel} onPress={close} />
    </View>
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      accessibilityLabel={null}
      accessibilityRole={null}
      accessible={false}
      backdropComponent={SheetBackdrop}
      backgroundComponent={SheetBackground}
      enableDynamicSizing={!isFixed}
      enablePanDownToClose
      handleComponent={SheetHandle}
      name={name}
      onChange={handleChange}
      onDismiss={handleDismissed}
      overrideReduceMotion={reduceMotion ? ReduceMotion.Always : ReduceMotion.System}
      snapPoints={isFixed ? FIXED_SNAP_POINTS : undefined}
      topInset={insets.top}>
      {isFixed ? (
        <View
          onAccessibilityEscape={close}
          style={[styles.fixed, { paddingBottom: insets.bottom + spacing.md }]}>
          {titleRow}
          <AppBottomSheetContext value={{ dismiss: close }}>
            <View style={styles.fixedBody}>{children}</View>
          </AppBottomSheetContext>
        </View>
      ) : (
        <BottomSheetScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.md },
          ]}
          onAccessibilityEscape={close}>
          {titleRow}
          <AppBottomSheetContext value={{ dismiss: close }}>{children}</AppBottomSheetContext>
        </BottomSheetScrollView>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: {
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radii.pill,
  },
  content: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  // `fixed` layout: the column that fills the sheet. Same side margin as the scrolling layout.
  fixed: {
    flex: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  // Takes what the title row leaves; its children decide how it is split (scroll area + bar).
  fixedBody: {
    flex: 1,
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flexShrink: 1,
  },
});
