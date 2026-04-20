export interface SanitizeOptions {
  maxLength?: number;
  allowNewLines?: boolean;
}

const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function normalizeWhitespace(input: string, allowNewLines: boolean): string {
  const withoutControls = input.replace(CONTROL_CHARS_REGEX, '');
  const normalized = withoutControls.replace(/\r\n?/g, '\n');

  if (allowNewLines) {
    return normalized
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .trim();
  }

  return normalized.replace(/\s+/g, ' ').trim();
}

export function sanitizePlainText(input: string, options: SanitizeOptions = {}): string {
  const maxLength = options.maxLength;
  const allowNewLines = options.allowNewLines ?? false;
  const normalized = normalizeWhitespace(input, allowNewLines).replace(/[<>]/g, '');

  if (typeof maxLength === 'number' && maxLength >= 0) {
    return normalized.slice(0, maxLength);
  }

  return normalized;
}

export function sanitizeFileName(input: string): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');

  return cleaned || 'upload';
}
