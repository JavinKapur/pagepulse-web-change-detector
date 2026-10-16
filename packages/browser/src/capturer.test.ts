import { describe, it, expect } from 'vitest';
import { MockCapturer } from './capturer.js';

describe('Browser Capturer & SSRF Integration', () => {
  it('blocks SSRF targets immediately prior to navigation', async () => {
    const capturer = new MockCapturer();
    const result = await capturer.capture({ url: 'http://169.254.169.254/latest/meta-data/' });

    expect(result.httpStatus).toBeNull();
    expect(result.errorMessage).toContain('Blocked by SSRF Policy');
  });

  it('captures fixture page results properly', async () => {
    const capturer = new MockCapturer();
    capturer.setFixture('https://example.com/pricing', {
      httpStatus: 200,
      pageTitle: 'Acme Pricing',
      rawText: 'Starter: $10/mo\nPro: $29/mo',
    });

    const result = await capturer.capture({ url: 'https://example.com/pricing' });
    expect(result.httpStatus).toBe(200);
    expect(result.pageTitle).toBe('Acme Pricing');
    expect(result.rawText).toContain('Starter: $10/mo');
  });
});
