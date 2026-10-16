export const WATCH_INTERVALS = {
  MIN_MINUTES: 15,
  MAX_MINUTES: 1440,
  PRESETS: [15, 30, 60, 180, 360, 720, 1440] as const,
} as const;

export const BROWSER_DEFAULTS = {
  VIEWPORT: {
    width: 1440,
    height: 900,
  },
  LOCALE: 'en-US',
  TIMEZONE: 'UTC',
  COLOR_SCHEME: 'light' as const,
  TIMEOUT_MS: 30000,
  MAX_PAGE_HEIGHT_PX: 16000,
  MAX_SCREENSHOT_BYTES: 10 * 1024 * 1024, // 10MB limit
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 PagePulse/1.0 (+https://pagepulse.dev/bot)',
} as const;

export const SENSITIVITY_PROFILES = {
  low: {
    textChangeRatio: 0.15, // 15% text change required
    visualPixelDiffRatio: 0.05, // 5% pixels changed
  },
  normal: {
    textChangeRatio: 0.05, // 5% text change required
    visualPixelDiffRatio: 0.02, // 2% pixels changed
  },
  high: {
    textChangeRatio: 0.01, // 1% text change required
    visualPixelDiffRatio: 0.005, // 0.5% pixels changed
  },
} as const;

export type SensitivityLevel = keyof typeof SENSITIVITY_PROFILES | 'custom';

export const WATCH_STATUS = {
  OK: 'OK',
  ERROR: 'ERROR',
  BLOCKED: 'BLOCKED',
  PAUSED: 'PAUSED',
  UNKNOWN: 'UNKNOWN',
} as const;

export type WatchStatus = (typeof WATCH_STATUS)[keyof typeof WATCH_STATUS];

export const RETENTION_DEFAULTS = {
  SNAPSHOT_DAYS: 90,
  CHECK_RUN_DAYS: 30,
  UNCHANGED_ARTIFACT_DAYS: 7,
  DIFF_ARTIFACT_DAYS: 30,
} as const;
