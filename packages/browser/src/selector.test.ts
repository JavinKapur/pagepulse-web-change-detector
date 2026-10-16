import { describe, it, expect } from 'vitest';
import { validateCssSelector, generateElementSelector } from './selector.js';

describe('CSS Selector Utilities', () => {
  it('validates good specific CSS selectors', () => {
    const res = validateCssSelector('#main-content .article-title');
    expect(res.isValid).toBe(true);
    expect(res.isSpecific).toBe(true);
    expect(res.warning).toBeUndefined();
  });

  it('flags broad selectors with warnings', () => {
    const res1 = validateCssSelector('div');
    expect(res1.isValid).toBe(true);
    expect(res1.isSpecific).toBe(false);
    expect(res1.warning).toBeDefined();

    const res2 = validateCssSelector('*');
    expect(res2.isSpecific).toBe(false);
  });

  it('rejects dangerous or malformed characters', () => {
    expect(validateCssSelector('<script>').isValid).toBe(false);
    expect(validateCssSelector('div; drop table').isValid).toBe(false);
    expect(validateCssSelector('').isValid).toBe(false);
  });

  it('generates optimal selectors preferring testId and IDs', () => {
    expect(
      generateElementSelector({
        tagName: 'BUTTON',
        testId: 'submit-order-btn',
        id: 'btn-1',
      })
    ).toBe('[data-testid="submit-order-btn"]');

    expect(
      generateElementSelector({
        tagName: 'H1',
        id: 'page-headline',
      })
    ).toBe('#page-headline');

    expect(
      generateElementSelector({
        tagName: 'SPAN',
        classes: ['price-amount', 'currency-usd'],
        ancestorTag: 'DIV',
      })
    ).toBe('div > span.price-amount.currency-usd');
  });
});
