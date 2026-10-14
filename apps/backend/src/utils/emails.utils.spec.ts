import { escapeHtml } from './emails.utils';

describe('escapeHtml', () => {
  it('returns plain text unchanged', () => {
    expect(escapeHtml('Jane Doe')).toBe('Jane Doe');
  });

  it('returns an empty string unchanged', () => {
    expect(escapeHtml('')).toBe('');
  });

  it.each([
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#39;'],
  ])('escapes %s as %s', (char, escaped) => {
    expect(escapeHtml(char)).toBe(escaped);
  });

  it('escapes an HTML tag so it is shown as text', () => {
    expect(escapeHtml('<script>alert("hi")</script>')).toBe(
      '&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt;',
    );
  });

  it('escapes & first so other entities are not double-escaped', () => {
    expect(escapeHtml('a & <b>')).toBe('a &amp; &lt;b&gt;');
  });
});
