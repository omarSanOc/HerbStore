// What happened to a share (spec 005, RF-26, RF-27). Pure: no React Native, so `test:logic` runs it.
//
// The two platforms do NOT answer the same way (RN 0.86 `Share.share`):
// - iOS resolves when the sheet closes: `{ action: 'sharedAction', activityType }` if an activity
//   ran, `{ action: 'dismissedAction', activityType: null }` if the person cancelled.
// - Android resolves `{ action: 'sharedAction' }` as soon as the chooser Intent is started: it can
//   never say "cancelled" (the chooser reports nothing back), so there a cancel looks like a share.
// Both reject when the sheet cannot open, and `Share.share` can even THROW before returning a
// promise (its `invariant`s). Anything that is not a recognised result is a missing native result.

export type ShareOutcome = 'shared' | 'cancelled' | 'failed';

/** `ignored`: a share is already in flight, so this press did nothing. */
export type ShareRun = ShareOutcome | 'ignored';

export function classifyShareResult(result: unknown): ShareOutcome {
  if (typeof result !== 'object' || result === null || Array.isArray(result)) {
    return 'failed';
  }

  const action = (result as { action?: unknown }).action;
  if (action === 'sharedAction') return 'shared';
  if (action === 'dismissedAction') return 'cancelled';
  return 'failed';
}

/**
 * One runner per screen: lets only one share be in flight and always answers with a classified
 * outcome, never an exception. A second press before the first settles is `ignored` (on Android it
 * would stack a second chooser; on iOS presenting twice rejects and would show a false error).
 * The gate opens again after ANY ending, so "Try again" always works.
 *
 * Compose: a `MutableStateFlow<Boolean>` "sharing" flag checked before `startActivity`; SwiftUI:
 * `ShareLink` is presented by the system, so the equivalent guard is the `isPresented` binding of
 * a `UIActivityViewController` sheet.
 */
export function createShareRunner() {
  let inFlight = false;

  return async function run(share: () => Promise<unknown>): Promise<ShareRun> {
    if (inFlight) {
      return 'ignored';
    }

    inFlight = true;
    try {
      return classifyShareResult(await share());
    } catch {
      return 'failed';
    } finally {
      inFlight = false;
    }
  };
}
