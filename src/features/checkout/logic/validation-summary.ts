/** Builds the single label announced for the checkout validation summary. */
export function buildValidationSummary(heading: string, messages: readonly string[]): string {
  return [heading, ...messages].join(' ');
}
