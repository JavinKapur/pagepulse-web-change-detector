import { describe, it, expect } from 'vitest';
import { computeTextDiff } from './diff.js';

describe('Text Diff Engine', () => {
  it('detects identical text as no changes', () => {
    const text = 'Hello world\nThis is PagePulse';
    const result = computeTextDiff(text, text);
    expect(result.hasChanges).toBe(false);
    expect(result.textChangeRatio).toBe(0);
    expect(result.addedLines).toBe(0);
    expect(result.deletedLines).toBe(0);
  });

  it('detects line additions and deletions', () => {
    const oldText = 'Line 1\nLine 2\nLine 3';
    const newText = 'Line 1\nLine 2 Modified\nLine 3\nLine 4';
    const result = computeTextDiff(oldText, newText);
    expect(result.hasChanges).toBe(true);
    expect(result.addedLines).toBeGreaterThanOrEqual(1);
    expect(result.textChangeRatio).toBeGreaterThan(0);
    expect(result.chunks.some((c) => c.type === 'added')).toBe(true);
  });

  it('calculates word change metrics correctly', () => {
    const oldText = 'The quick brown fox';
    const newText = 'The fast brown fox jumps';
    const result = computeTextDiff(oldText, newText);
    expect(result.hasChanges).toBe(true);
    expect(result.addedWords).toBeGreaterThanOrEqual(1);
    expect(result.deletedWords).toBeGreaterThanOrEqual(1);
  });
});
