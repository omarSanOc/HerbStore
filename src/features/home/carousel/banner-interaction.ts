/**
 * What counts as "the user is interacting with the carousel", as a tiny pure state machine.
 *
 * Only the user's own events feed it: a finger touching the list (`touchStart` / `touchEnd`) and a
 * drag (`dragStart` / `dragEnd`, from `onScrollBeginDrag` / `onScrollEndDrag`). A programmatic
 * scroll (the step buttons, the accessibility actions, the autoplay itself) sends neither, so it
 * can never be mistaken for a person. That is why `onMomentumScrollEnd` is NOT an input: it also
 * fires after `scrollToOffset`, and it only tells us where a scroll settled, not who started it.
 *
 * Two flags instead of one because the platforms disagree on the order of the events: Android
 * cancels the JS touch when the native scroll takes over, while iOS keeps sending touches during
 * the drag. A drag therefore stays an interaction until its own end, whatever the touch said.
 */
export type BannerInteractionState = Readonly<{
  /** A finger is down on the list (between `touchStart` and `touchEnd` / cancel). */
  touching: boolean;
  /** A drag is in progress (between `onScrollBeginDrag` and `onScrollEndDrag`). */
  dragging: boolean;
  /**
   * Counts finished interactions. The autoplay timer depends on it, so an interaction that ends
   * always restarts a full wait, even if the flags flipped within one React batch.
   */
  epoch: number;
}>;

export type BannerInteractionEvent = 'touchStart' | 'touchEnd' | 'dragStart' | 'dragEnd' | 'reset';

export const initialBannerInteraction: BannerInteractionState = {
  touching: false,
  dragging: false,
  epoch: 0,
};

export function isBannerInteracting(state: BannerInteractionState): boolean {
  return state.touching || state.dragging;
}

/**
 * Returns the SAME object when an event changes nothing, so React bails out of the render.
 * `reset` clears flags that may have been left up by a gesture that never reported its end (the
 * app went to the background mid-touch); it does not count as a finished interaction.
 */
export function reduceBannerInteraction(
  state: BannerInteractionState,
  event: BannerInteractionEvent,
): BannerInteractionState {
  switch (event) {
    case 'touchStart':
      return state.touching ? state : { ...state, touching: true };
    case 'dragStart':
      return state.dragging ? state : { ...state, dragging: true };
    case 'touchEnd':
      return state.touching ? { ...state, touching: false, epoch: state.epoch + 1 } : state;
    case 'dragEnd':
      // The finger lifted: it cannot be touching any more, even if no touch end was delivered.
      return state.dragging
        ? { touching: false, dragging: false, epoch: state.epoch + 1 }
        : state;
    case 'reset':
      return isBannerInteracting(state) ? { ...state, touching: false, dragging: false } : state;
  }
}
