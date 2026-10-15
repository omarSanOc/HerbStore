/** Returns true only for an unambiguous, valid EAN-13 string. */
export function isValidEan13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;

  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    sum += Number(value[index]) * (index % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(value[12]);
}
