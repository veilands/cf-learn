/**
 * Sanitize strings for InfluxDB line protocol
 * @param value String value to sanitize
 * @returns Sanitized string safe for InfluxDB line protocol
 */
export function sanitizeTag(value: string): string {
  return value
    .replace(/,/g, '\\,')
    .replace(/ /g, '\\ ')
    .replace(/=/g, '\\=')
    .replace(/"/g, '\\"');
}
