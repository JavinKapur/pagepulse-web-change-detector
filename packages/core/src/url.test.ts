import { describe, it, expect } from 'vitest';
import { canonicalizeUrl, deriveTargetKey } from './url.js';

describe('URL Canonicalization', () => {
  it('normalizes uppercase hostnames and default ports', () => {
    const res1 = canonicalizeUrl('HTTPS://Example.COM:443/docs/guide/');
    expect(res1.canonicalUrl).toBe('https://example.com/docs/guide');
    expect(res1.hostname).toBe('example.com');
    expect(res1.port).toBeNull();

    const res2 = canonicalizeUrl('http://MY-SITE.org:80/');
    expect(res2.canonicalUrl).toBe('http://my-site.org/');
    expect(res2.port).toBeNull();
  });

  it('preserves non-default ports', () => {
    const res = canonicalizeUrl('https://example.com:8443/api');
    expect(res.canonicalUrl).toBe('https://example.com:8443/api');
    expect(res.port).toBe(8443);
  });

  it('removes URL fragments', () => {
    const res = canonicalizeUrl('https://example.com/page#heading-2');
    expect(res.canonicalUrl).toBe('https://example.com/page');
  });

  it('sorts query parameters deterministically', () => {
    const res1 = canonicalizeUrl('https://example.com/search?q=test&page=2&sort=asc');
    const res2 = canonicalizeUrl('https://example.com/search?sort=asc&q=test&page=2');
    expect(res1.canonicalUrl).toBe(res2.canonicalUrl);
    expect(res1.canonicalUrl).toBe('https://example.com/search?page=2&q=test&sort=asc');
  });

  it('rejects unsupported protocols', () => {
    expect(() => canonicalizeUrl('ftp://ftp.example.com/file')).toThrow('Unsupported protocol');
    expect(() => canonicalizeUrl('file:///etc/passwd')).toThrow('Unsupported protocol');
    expect(() => canonicalizeUrl('javascript:alert(1)')).toThrow('Unsupported protocol');
  });

  it('rejects embedded credentials', () => {
    expect(() => canonicalizeUrl('https://user:pass@example.com/secret')).toThrow('embedded credentials');
  });

  it('derives identical targetKey for identical canonical URLs and render profiles', () => {
    const key1 = deriveTargetKey('https://example.com', { width: 1440, height: 900 });
    const key2 = deriveTargetKey('https://example.com', { height: 900, width: 1440 });
    expect(key1).toBe(key2);
    expect(key1).toHaveLength(64);
  });
});
