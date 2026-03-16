import sanitizeHtml from 'sanitize-html';

export function sanitizeMessageContent(input: string | null | undefined): string | null {
  if (input == null || typeof input !== 'string') {
    return null;
  }
  const trimmed = input.trim();
  if (trimmed === '') {
    return null;
  }
  const sanitized = sanitizeHtml(trimmed, {
    allowedTags: [],
    allowedAttributes: {},
    allowedSchemes: [],
  });
  return sanitized.trim() || null;
}
