/**
 * First visible character of a name, uppercased: what a circular category shows when its image
 * cannot load. `Array.from` iterates by code point, so an emoji is not cut in half.
 *
 * This is the only thing this module keeps: category, subcategory and section names are COPY OF THE
 * CATALOG (RF-9, RF-22), owned by the localized API response. The translation tables by server id
 * that used to live here made the screen disagree with the server, so they were removed (spec 007,
 * T3); the initial is a safe, language-neutral derivation of the remote name, not a replacement.
 */
export function categoryInitial(name: string): string {
  const [first] = Array.from(name.trim());
  return first === undefined ? '?' : first.toLocaleUpperCase();
}
