import { SENSITIVITY_PROFILES, type SensitivityLevel } from '@pagepulse/config';

export interface MeaningfulChangeEvaluation {
  isMeaningful: boolean;
  reason: string;
  textThreshold: number;
  visualThreshold: number;
  textExceeded: boolean;
  visualExceeded: boolean;
}

export function evaluateMeaningfulChange(
  sensitivity: SensitivityLevel,
  textChangeRatio: number,
  visualPixelDiffRatio: number,
  customThresholds?: { textChangeRatio?: number; visualPixelDiffRatio?: number }
): MeaningfulChangeEvaluation {
  let textThreshold: number;
  let visualThreshold: number;

  if (sensitivity === 'custom' && customThresholds) {
    textThreshold = customThresholds.textChangeRatio ?? SENSITIVITY_PROFILES.normal.textChangeRatio;
    visualThreshold = customThresholds.visualPixelDiffRatio ?? SENSITIVITY_PROFILES.normal.visualPixelDiffRatio;
  } else if (sensitivity in SENSITIVITY_PROFILES) {
    const profile = SENSITIVITY_PROFILES[sensitivity as keyof typeof SENSITIVITY_PROFILES];
    textThreshold = profile.textChangeRatio;
    visualThreshold = profile.visualPixelDiffRatio;
  } else {
    textThreshold = SENSITIVITY_PROFILES.normal.textChangeRatio;
    visualThreshold = SENSITIVITY_PROFILES.normal.visualPixelDiffRatio;
  }

  const textExceeded = textChangeRatio >= textThreshold && textChangeRatio > 0;
  const visualExceeded = visualPixelDiffRatio >= visualThreshold && visualPixelDiffRatio > 0;
  const isMeaningful = textExceeded || visualExceeded;

  let reason = 'Change below configured sensitivity threshold';
  if (textExceeded && visualExceeded) {
    reason = `Text changed by ${(textChangeRatio * 100).toFixed(1)}% (threshold: ${(textThreshold * 100).toFixed(1)}%) and visuals changed by ${(visualPixelDiffRatio * 100).toFixed(2)}% (threshold: ${(visualThreshold * 100).toFixed(2)}%)`;
  } else if (textExceeded) {
    reason = `Text changed by ${(textChangeRatio * 100).toFixed(1)}% (exceeded threshold ${(textThreshold * 100).toFixed(1)}%)`;
  } else if (visualExceeded) {
    reason = `Visuals changed by ${(visualPixelDiffRatio * 100).toFixed(2)}% (exceeded threshold ${(visualThreshold * 100).toFixed(2)}%)`;
  }

  return {
    isMeaningful,
    reason,
    textThreshold,
    visualThreshold,
    textExceeded,
    visualExceeded,
  };
}
