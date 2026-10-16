export type ResponseClassification = 'OK' | 'ERROR' | 'BLOCKED' | 'RATE_LIMITED';

export interface ClassificationInput {
  httpStatus?: number | null;
  errorMessage?: string | null;
  pageTitle?: string | null;
  htmlContent?: string | null;
  headers?: Record<string, string | undefined>;
}

export interface ClassificationResult {
  classification: ResponseClassification;
  reason: string;
  isHealthy: boolean;
  retryAfterSeconds?: number;
}

const CHALLENGE_TEXT_PATTERNS = [
  /attention required!\s*\|\s*cloudflare/i,
  /checking your browser before accessing/i,
  /just a moment\.\.\./i,
  /please verify you are a human/i,
  /verify you are human/i,
  /security check to access/i,
  /access to this page has been denied/i,
  /protected by datadome/i,
  /perimeterx/i,
  /blocked by akamai/i,
  /incident id:\s*[a-f0-9-]+/i,
];

const CHALLENGE_TAG_PATTERNS = [
  /class=["'][^"']*(?:g-recaptcha|h-captcha|cf-turnstile)[^"']*["']/i,
  /src=["'][^"']*(?:recaptcha\/api|hcaptcha\.com|challenges\.cloudflare\.com)[^"']*["']/i,
];

export function classifyResponse(input: ClassificationInput): ClassificationResult {
  const { httpStatus, errorMessage, pageTitle = '', htmlContent = '', headers = {} } = input;

  // 1. Network / Transport errors
  if (errorMessage) {
    const lowerError = errorMessage.toLowerCase();
    if (
      lowerError.includes('timeout') ||
      lowerError.includes('econnrefused') ||
      lowerError.includes('enotfound') ||
      lowerError.includes('err_connection_') ||
      lowerError.includes('err_name_not_resolved') ||
      lowerError.includes('navigation failed')
    ) {
      return {
        classification: 'ERROR',
        reason: `Network/Transport failure: ${errorMessage}`,
        isHealthy: false,
      };
    }
  }

  // 2. Rate Limiting (429)
  if (httpStatus === 429) {
    let retryAfterSeconds: number | undefined;
    const retryAfterHeader = headers['retry-after'] || headers['Retry-After'];
    if (retryAfterHeader) {
      const parsedSeconds = Number.parseInt(retryAfterHeader, 10);
      if (!Number.isNaN(parsedSeconds)) {
        retryAfterSeconds = parsedSeconds;
      }
    }
    return {
      classification: 'RATE_LIMITED',
      reason: `Rate limited (HTTP 429)${retryAfterSeconds ? `, Retry-After: ${retryAfterSeconds}s` : ''}`,
      isHealthy: false,
      retryAfterSeconds,
    };
  }

  // 3. Bot Challenges / CAPTCHA / Access Denied (401, 403, Cloudflare/DataDome challenge pages)
  if (httpStatus === 401 || httpStatus === 403) {
    return {
      classification: 'BLOCKED',
      reason: `Access denied / bot challenge (HTTP ${httpStatus})`,
      isHealthy: false,
    };
  }

  const safeTitle = pageTitle || '';
  const safeHtml = htmlContent || '';
  const combinedContent = `${safeTitle}\n${safeHtml}`;
  for (const pattern of CHALLENGE_TEXT_PATTERNS) {
    if (pattern.test(combinedContent)) {
      return {
        classification: 'BLOCKED',
        reason: `Anti-bot / CAPTCHA challenge detected matching '${pattern.source}'`,
        isHealthy: false,
      };
    }
  }

  for (const pattern of CHALLENGE_TAG_PATTERNS) {
    if (pattern.test(safeHtml)) {
      return {
        classification: 'BLOCKED',
        reason: 'Embedded CAPTCHA / Turnstile challenge widget detected',
        isHealthy: false,
      };
    }
  }

  // 4. HTTP Outages (5xx)
  if (httpStatus && httpStatus >= 500 && httpStatus <= 599) {
    return {
      classification: 'ERROR',
      reason: `Server outage (HTTP ${httpStatus})`,
      isHealthy: false,
    };
  }

  // 5. Normal successful response
  if (httpStatus && httpStatus >= 200 && httpStatus < 400) {
    return {
      classification: 'OK',
      reason: `Healthy response (HTTP ${httpStatus})`,
      isHealthy: true,
    };
  }

  // Fallback for missing or unhandled statuses
  return {
    classification: httpStatus ? 'ERROR' : 'ERROR',
    reason: errorMessage || (httpStatus ? `Unexpected status HTTP ${httpStatus}` : 'Unknown response state'),
    isHealthy: false,
  };
}
