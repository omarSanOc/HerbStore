import { isValidEan13 } from './ean13.ts';

/** The small part of CameraView's scanning result that the scanner trusts. */
export type ScannerInput = string | Readonly<{ data: string; type?: string }>;

export type NormalizedScannerInput =
  | Readonly<{ kind: 'valid'; format: 'ean13' | 'qr'; code: string }>
  | Readonly<{ kind: 'invalid' }>;

/**
 * Treat camera data as untrusted input. QR is only an envelope for an EAN-13: trim its outer
 * whitespace, but do not normalize anything inside it. Direct EAN-13 reads remain strict for
 * backwards compatibility. Invalid data intentionally carries no payload so rejected URLs, ids
 * and arbitrary text cannot enter scanner state or logs.
 */
export function normalizeScannerInput(input: ScannerInput): NormalizedScannerInput {
  if (typeof input === 'string') {
    return isValidEan13(input) ? { kind: 'valid', format: 'ean13', code: input } : { kind: 'invalid' };
  }

  const format = input.type === undefined || input.type === 'ean13'
    ? 'ean13'
    : input.type === 'qr'
      ? 'qr'
      : undefined;
  if (format === undefined) return { kind: 'invalid' };

  const code = format === 'qr' ? input.data.trim() : input.data;
  return isValidEan13(code) ? { kind: 'valid', format, code } : { kind: 'invalid' };
}
