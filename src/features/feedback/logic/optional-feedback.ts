/**
 * Runs a native feedback effect (a haptic impact) that is polish, never the source of truth.
 * A device without an actuator, a missing native module, a revoked permission or a rejected
 * promise is absorbed: the answer is `false` and the caller carries on. Nothing here can undo or
 * delay a cart change, and the effect never replaces the visual/accessible confirmation (RF-22).
 *
 * Compose: `runCatching { haptic.performHapticFeedback(...) }`; SwiftUI: a `try?` around the
 * `UIImpactFeedbackGenerator` call.
 */
export async function runOptionalFeedback(effect: () => Promise<unknown> | unknown): Promise<boolean> {
  try {
    await effect();
    return true;
  } catch {
    return false;
  }
}
