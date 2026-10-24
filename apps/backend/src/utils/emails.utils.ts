/**
 * The subject and HTML body of an email.
 */
export interface EmailContent {
  subject: string;
  bodyHtml: string;
}

/**
 * Escapes characters so user-provided
 * values can be safely inserted into email bodies.
 *
 * @param value - The raw string.
 * @returns The HTML-escaped string.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
