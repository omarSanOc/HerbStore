// Dependency-free structural guards shared by the payload parsers (Home and catalog).
// Zod belongs to the stack but is not installed yet; when it arrives these are the pieces it replaces.

export type Json = Record<string, unknown>;

export function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isText(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

/** A non-negative integer: counts, page numbers and totals. */
export function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function hasUniqueIds(items: readonly { id: string }[]): boolean {
  return new Set(items.map(({ id }) => id)).size === items.length;
}

/** Maps every element or gives `undefined` as soon as one fails. */
export function mapAll<T>(
  value: unknown,
  parseItem: (item: unknown) => T | undefined,
): T[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const parsed: T[] = [];
  for (const item of value) {
    const result = parseItem(item);
    if (result === undefined) {
      return undefined;
    }
    parsed.push(result);
  }

  return parsed;
}
