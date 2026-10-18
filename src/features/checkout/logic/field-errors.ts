export const ADDRESS_FIELD_NAMES = ['fullName', 'phone', 'postalCode', 'state', 'city', 'street', 'exteriorNumber', 'interiorNumber'] as const;
export type AddressFieldName = (typeof ADDRESS_FIELD_NAMES)[number];

function isAddressFieldName(name: string): name is AddressFieldName {
  return (ADDRESS_FIELD_NAMES as readonly string[]).includes(name);
}

export type FieldErrorMap = Readonly<{
  fields: Readonly<Partial<Record<AddressFieldName, string>>>;
  lines: Readonly<Record<number, Readonly<{ productId?: string; quantity?: string }>>>;
  global: readonly string[];
}>;

const serverKey = 'checkout.server.invalid';
const genericKey = 'checkout.server.genericError';

/** Maps server paths only; values are deliberately ignored to avoid echoing personal data. */
export function mapServerFieldErrors(fields: unknown): FieldErrorMap {
  const mapped: { fields: Partial<Record<AddressFieldName, string>>; lines: Record<number, { productId?: string; quantity?: string }>; global: string[] } = {
    fields: {},
    lines: {},
    global: [],
  };

  if (!fields || typeof fields !== 'object' || Array.isArray(fields) || Object.keys(fields).length === 0) {
    mapped.global.push(genericKey);
    return mapped;
  }

  for (const path of Object.keys(fields)) {
    const addressMatch = /^shippingAddress\.([A-Za-z]+)$/.exec(path);
    const itemMatch = /^items(?:\[(\d+)\]|\.(\d+))\.(productId|quantity)$/.exec(path);
    if (addressMatch && isAddressFieldName(addressMatch[1])) {
      mapped.fields[addressMatch[1]] = serverKey;
    } else if (itemMatch) {
      const index = Number(itemMatch[1] ?? itemMatch[2]);
      const current = mapped.lines[index] ?? {};
      mapped.lines[index] = { ...current, [itemMatch[3]]: serverKey };
    } else {
      mapped.global.push(genericKey);
    }
  }
  return mapped;
}

/** True when part of the complaint cannot sit under a field (a cart line, an unknown path or no path at all). */
export function hasGeneralServerError(map: FieldErrorMap): boolean {
  return map.global.length > 0 || Object.keys(map.lines).length > 0;
}
