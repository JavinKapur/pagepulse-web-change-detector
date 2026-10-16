import { describe, it, expect } from 'vitest';
import { evaluateMeaningfulChange } from './sensitivity.js';

describe('Sensitivity Engine', () => {
  it('suppresses small changes under Low sensitivity', () => {
    // Low requires 15% text change or 5% visual change
    const evalResult = evaluateMeaningfulChange('low', 0.04, 0.01);
    expect(evalResult.isMeaningful).toBe(false);
  });

  it('triggers on meaningful changes under Low sensitivity', () => {
    const evalResult = evaluateMeaningfulChange('low', 0.20, 0.01);
    expect(evalResult.isMeaningful).toBe(true);
    expect(evalResult.textExceeded).toBe(true);
  });

  it('triggers on moderate changes under Normal sensitivity', () => {
    // Normal requires 5% text change
    const evalResult = evaluateMeaningfulChange('normal', 0.06, 0.01);
    expect(evalResult.isMeaningful).toBe(true);
  });

  it('triggers on slight changes under High sensitivity', () => {
    // High requires 1% text change
    const evalResult = evaluateMeaningfulChange('high', 0.015, 0.001);
    expect(evalResult.isMeaningful).toBe(true);
  });

  it('supports custom thresholds', () => {
    const evalResult = evaluateMeaningfulChange('custom', 0.08, 0.005, {
      textChangeRatio: 0.10,
      visualPixelDiffRatio: 0.01,
    });
    expect(evalResult.isMeaningful).toBe(false);
  });
});
