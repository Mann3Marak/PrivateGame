import { sanitizeFileName, sanitizePlainText } from './sanitize';

describe('sanitize utilities', () => {
  test('removes angle brackets and control characters from plain text', () => {
    const result = sanitizePlainText('  <b>Hello</b>\u0007 world  ', { maxLength: 100 });
    expect(result).toBe('bHello/b world');
  });

  test('preserves new lines when requested', () => {
    const result = sanitizePlainText(' line1 \r\n line2 ', { allowNewLines: true });
    expect(result).toBe('line1\nline2');
  });

  test('normalizes unsafe filenames', () => {
    const result = sanitizeFileName('  My File<script>.PNG  ');
    expect(result).toBe('my-file-script-.png');
  });
});
