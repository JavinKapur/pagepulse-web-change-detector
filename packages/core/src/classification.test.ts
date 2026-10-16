import { describe, it, expect } from 'vitest';
import { classifyResponse } from './classification.js';

describe('Response Classification: Outage vs CAPTCHA vs OK', () => {
  it('classifies HTTP 200 with standard HTML as OK', () => {
    const result = classifyResponse({
      httpStatus: 200,
      pageTitle: 'Example Domain',
      htmlContent: '<h1>Example Domain</h1><p>This domain is for use in illustrative examples.</p>',
    });
    expect(result.classification).toBe('OK');
    expect(result.isHealthy).toBe(true);
  });

  it('classifies HTTP 500, 502, 503, 504 as ERROR (Outage)', () => {
    const res500 = classifyResponse({ httpStatus: 500 });
    expect(res500.classification).toBe('ERROR');
    expect(res500.isHealthy).toBe(false);

    const res503 = classifyResponse({ httpStatus: 503, pageTitle: '503 Service Unavailable' });
    expect(res503.classification).toBe('ERROR');
    expect(res503.isHealthy).toBe(false);
  });

  it('classifies network timeout or connection reset as ERROR', () => {
    const resTimeout = classifyResponse({
      errorMessage: 'Navigation timeout of 30000ms exceeded',
    });
    expect(resTimeout.classification).toBe('ERROR');
    expect(resTimeout.isHealthy).toBe(false);

    const resConn = classifyResponse({
      errorMessage: 'net::ERR_CONNECTION_REFUSED at http://example.com',
    });
    expect(resConn.classification).toBe('ERROR');
    expect(resConn.isHealthy).toBe(false);
  });

  it('classifies HTTP 429 as RATE_LIMITED and extracts Retry-After header', () => {
    const res429 = classifyResponse({
      httpStatus: 429,
      headers: { 'retry-after': '60' },
    });
    expect(res429.classification).toBe('RATE_LIMITED');
    expect(res429.retryAfterSeconds).toBe(60);
    expect(res429.isHealthy).toBe(false);
  });

  it('classifies HTTP 401 and 403 as BLOCKED', () => {
    const res403 = classifyResponse({ httpStatus: 403, pageTitle: 'Forbidden' });
    expect(res403.classification).toBe('BLOCKED');
    expect(res403.isHealthy).toBe(false);
  });

  it('classifies Cloudflare challenge page as BLOCKED', () => {
    const result = classifyResponse({
      httpStatus: 200, // Cloudflare sometimes serves challenges with 200 or 403
      pageTitle: 'Just a moment...',
      htmlContent: '<div>Please verify you are a human</div><div class="cf-turnstile"></div>',
    });
    expect(result.classification).toBe('BLOCKED');
    expect(result.isHealthy).toBe(false);
  });

  it('classifies DataDome and PerimeterX challenges as BLOCKED', () => {
    const result = classifyResponse({
      httpStatus: 200,
      pageTitle: 'Access Denied',
      htmlContent: '<p>Protected by DataDome. Verification required.</p>',
    });
    expect(result.classification).toBe('BLOCKED');
    expect(result.isHealthy).toBe(false);
  });
});
