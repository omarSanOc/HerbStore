// Which bottom sheets are open (pure logic: no React Native).
//
// While a modal sheet is open, everything BEHIND it must disappear from the accessibility tree,
// otherwise TalkBack and VoiceOver still walk the list, the tabs and the header "under" the sheet.
// React Native has no "this is a modal" switch that works the same on both platforms for a view
// that is not a native window (`accessibilityViewIsModal` is iOS only; Android needs
// `importantForAccessibility="no-hide-descendants"` on the siblings). So the app root asks this
// registry and hides its own subtree while any sheet is open. The registry is a tiny observable
// (`subscribe` + `isAnyOpen`) so React can read it with `useSyncExternalStore`.
//
// Compose/SwiftUI do not need it: a `ModalBottomSheet` is a separate window and a `.sheet` makes
// the presenting view inaccessible by itself.

export type ModalSheetRegistry = {
  /** Marks a sheet (by name) as open or closed. Idempotent. */
  setOpen: (name: string, open: boolean) => void;
  isAnyOpen: () => boolean;
  /** Called only when "any sheet open" flips. Returns the unsubscribe function. */
  subscribe: (listener: () => void) => () => void;
};

export function createModalSheetRegistry(): ModalSheetRegistry {
  const open = new Set<string>();
  const listeners = new Set<() => void>();

  return {
    setOpen(name, isOpen) {
      const before = open.size > 0;
      if (isOpen) {
        open.add(name);
      } else {
        open.delete(name);
      }

      if (before !== open.size > 0) {
        listeners.forEach((listener) => listener());
      }
    },
    isAnyOpen: () => open.size > 0,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The one registry of the app. */
export const modalSheetRegistry = createModalSheetRegistry();
