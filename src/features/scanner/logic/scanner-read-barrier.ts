export type ScannerReadBarrier = Readonly<{
  /** Makes exactly one callback eligible and returns the identity of that rearm. */
  rearm: () => number;
  /** Claims the current rearm synchronously; later callbacks receive no identity. */
  claim: () => number | undefined;
  block: () => void;
}>;

/**
 * React state updates are observed on the next render. This barrier changes synchronously so two
 * native barcode callbacks delivered in one JS turn cannot both act on the same `ready` snapshot.
 */
export function createScannerReadBarrier(): ScannerReadBarrier {
  let nextAttempt = 0;
  let availableAttempt: number | undefined;

  return {
    rearm: () => {
      if (availableAttempt === undefined) availableAttempt = ++nextAttempt;
      return availableAttempt;
    },
    claim: () => {
      const attempt = availableAttempt;
      availableAttempt = undefined;
      return attempt;
    },
    block: () => {
      availableAttempt = undefined;
    },
  };
}
