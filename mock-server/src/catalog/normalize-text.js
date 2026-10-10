/**
 * Normalizes searchable catalog text without changing the source value.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  return text
    .normalize('NFD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
