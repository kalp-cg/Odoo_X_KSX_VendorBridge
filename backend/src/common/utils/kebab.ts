/**
 * Convert "PascalCase" or "camelCase" to "kebab-case".
 *   kebab("QuotationLineItem") -> "quotation-line-item"
 */
export function kebab(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}
