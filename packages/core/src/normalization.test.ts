import { describe, it, expect } from 'vitest';
import { normalizeText } from './normalization.js';

describe('Text Normalization & Noise Filtering', () => {
  it('normalizes CRLF and collapses excess whitespace', () => {
    const raw = 'Header 1  \r\n\r\n\r\n   Paragraph text with    extra spaces.   \r\n\r\nFooter';
    const result = normalizeText(raw);
    expect(result.normalizedText).toBe('Header 1\n\nParagraph text with extra spaces.\n\nFooter');
  });

  it('filters ISO timestamps when stripTimestamps is enabled', () => {
    const raw = 'Last updated on 2026-10-15T21:16:15Z by system.';
    const result = normalizeText(raw, { stripTimestamps: true });
    expect(result.normalizedText).toBe('Last updated on [TIMESTAMP] by system.');
    expect(result.removedPatternsCount).toBe(1);
  });

  it('filters relative time labels', () => {
    const raw = 'Published 5 minutes ago.\nComments: 10\nEdited just now.';
    const result = normalizeText(raw, { stripRelativeTime: true });
    expect(result.normalizedText).toContain('Published [RELATIVE_TIME].');
    expect(result.normalizedText).toContain('Edited [RELATIVE_TIME].');
  });

  it('filters dynamic counters', () => {
    const raw = 'Product Catalog\n1,420 items in stock\n98 users online';
    const result = normalizeText(raw, { stripCounters: true });
    expect(result.normalizedText).toContain('[COUNTER]');
    expect(result.removedPatternsCount).toBeGreaterThanOrEqual(2);
  });

  it('filters CSRF and session tokens', () => {
    const raw = 'Form page\ncsrf_token=9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d\nSubmit';
    const result = normalizeText(raw, { stripRandomTokens: true });
    expect(result.normalizedText).toContain('[TOKEN]');
  });

  it('applies custom user regex filters safely', () => {
    const raw = 'Welcome to PagePulse Version v1.0.45-beta. Have fun!';
    const result = normalizeText(raw, {
      customIgnoreRegexes: ['v\\d+\\.\\d+\\.\\d+(?:-[a-z]+)?'],
    });
    expect(result.normalizedText).toBe('Welcome to PagePulse Version [IGNORED]. Have fun!');
  });
});
