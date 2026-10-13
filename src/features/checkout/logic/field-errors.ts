export type FieldErrorMap = Readonly<{
  fields: Readonly<Record<string, string>>;
  lines: Readonly<Record<number, Readonly<{ productId?: string; quantity?: string }>>>;
  global: readonly string[];
}>;

const serverKey = 'checkout.server.invalid';
const unknownKey = 'checkout.server.fieldError';
const genericKey = 'checkout.server.genericError';

/** Maps server paths only; values are deliberately ignored to avoid echoing personal data. */
export function mapServerFieldErrors(fields: unknown): FieldErrorMap {
  const mapped: { fields: Record<string, string>; lines: Record<number, { productId?: string; quantity?: string }>; global: string[] } = {
    fields: {},
    lines: {},
    global: [],
  };

  if (!fields || typeof fields !== 'object' || Array.isArray(fields) || Object.keys(fields).length === 0) {
    mapped.global.push(genericKey);
    return mapped;
  }

  for (const path of Object.keys(fields)) {
    const addressMatch = /^shippingAddress\.(fullName|phone|postalCode|state|city|street|exteriorNumber|interiorNumber)$/.exec(path);
    const itemMatch = /^items(?:\[(\d+)\]|\.(\d+))\.(productId|quantity)$/.exec(path);
    if (addressMatch) {
      mapped.fields[addressMatch[1]] = serverKey;
    } else if (itemMatch) {
      const index = Number(itemMatch[1] ?? itemMatch[2]);
      const current = mapped.lines[index] ?? {};
      mapped.lines[index] = { ...current, [itemMatch[3]]: serverKey };
    } else {
      mapped.global.push(unknownKey);
    }
  }
  return mapped;
}
