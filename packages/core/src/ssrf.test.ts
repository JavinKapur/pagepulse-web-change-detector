import { describe, it, expect } from 'vitest';
import { validateUrlSsrf, isPrivateOrReservedIpv4, isPrivateOrReservedIpv6 } from './ssrf.js';

describe('SSRF Protection', () => {
  it('allows safe public URLs', () => {
    expect(validateUrlSsrf('https://example.com/').safe).toBe(true);
    expect(validateUrlSsrf('https://github.com/trending').safe).toBe(true);
    expect(validateUrlSsrf('http://info.cern.ch/').safe).toBe(true);
  });

  it('rejects loopback addresses', () => {
    expect(validateUrlSsrf('http://localhost:3000').safe).toBe(false);
    expect(validateUrlSsrf('http://127.0.0.1/').safe).toBe(false);
    expect(validateUrlSsrf('http://127.0.1.5:8080/').safe).toBe(false);
    expect(validateUrlSsrf('http://[::1]/').safe).toBe(false);
  });

  it('rejects RFC1918 private IPv4 networks', () => {
    // 10.0.0.0/8
    expect(validateUrlSsrf('http://10.0.0.1/admin').safe).toBe(false);
    expect(isPrivateOrReservedIpv4('10.254.1.1')).toBe(true);

    // 172.16.0.0/12
    expect(validateUrlSsrf('http://172.16.0.5/').safe).toBe(false);
    expect(validateUrlSsrf('http://172.31.255.255/').safe).toBe(false);
    expect(isPrivateOrReservedIpv4('172.20.10.4')).toBe(true);

    // 192.168.0.0/16
    expect(validateUrlSsrf('http://192.168.1.1/router').safe).toBe(false);
    expect(isPrivateOrReservedIpv4('192.168.100.50')).toBe(true);
  });

  it('rejects cloud metadata IP and hostnames', () => {
    expect(validateUrlSsrf('http://169.254.169.254/latest/meta-data/').safe).toBe(false);
    expect(validateUrlSsrf('http://metadata.google.internal/computeMetadata/v1/').safe).toBe(false);
    expect(validateUrlSsrf('http://instance-data/latest/').safe).toBe(false);
  });

  it('rejects carrier-grade NAT and multicast', () => {
    // Carrier-grade NAT: 100.64.0.0/10
    expect(validateUrlSsrf('http://100.64.0.1/').safe).toBe(false);
    // Multicast: 224.0.0.1
    expect(validateUrlSsrf('http://224.0.0.1/').safe).toBe(false);
  });

  it('rejects IPv6 private, link-local, and mapped addresses', () => {
    // fe80::/10 link-local
    expect(isPrivateOrReservedIpv6('fe80::1')).toBe(true);
    // fc00::/7 unique local
    expect(isPrivateOrReservedIpv6('fd12:3456:789a::1')).toBe(true);
    // IPv4-mapped loopback
    expect(isPrivateOrReservedIpv6('::ffff:127.0.0.1')).toBe(true);
    // IPv4-mapped private
    expect(isPrivateOrReservedIpv6('::ffff:192.168.1.1')).toBe(true);
  });

  it('rejects forbidden ports', () => {
    expect(validateUrlSsrf('https://example.com:22/').safe).toBe(false);
    expect(validateUrlSsrf('https://example.com:25/').safe).toBe(false);
    expect(validateUrlSsrf('https://example.com:5432/').safe).toBe(false);
    expect(validateUrlSsrf('https://example.com:6379/').safe).toBe(false);
  });
});
