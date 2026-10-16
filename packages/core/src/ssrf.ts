import { isIP } from 'node:net';

export interface SsrfValidationResult {
  safe: boolean;
  reason?: string;
  ip?: string;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'instance-data',
  '169.254.169.254',
  '100.100.100.200',
]);

/**
 * Checks whether an IPv4 address is in a reserved/private/loopback range.
 */
export function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IP treated as unsafe
  }

  const [b0, b1] = parts;

  // 0.0.0.0/8 "This network"
  if (b0 === 0) return true;

  // 10.0.0.0/8 Private network
  if (b0 === 10) return true;

  // 127.0.0.0/8 Loopback
  if (b0 === 127) return true;

  // 100.64.0.0/10 Carrier-grade NAT
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

  // 169.254.0.0/16 Link-local / Cloud Metadata
  if (b0 === 169 && b1 === 254) return true;

  // 172.16.0.0/12 Private network
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

  // 192.0.0.0/24 IETF Protocol Assignments
  if (b0 === 192 && b1 === 0 && parts[2] === 0) return true;

  // 192.0.2.0/24 Documentation (TEST-NET-1)
  if (b0 === 192 && b1 === 0 && parts[2] === 2) return true;

  // 192.168.0.0/16 Private network
  if (b0 === 192 && b1 === 168) return true;

  // 198.18.0.0/15 Network benchmark tests
  if (b0 === 198 && (b1 === 18 || b1 === 19)) return true;

  // 198.51.100.0/24 Documentation (TEST-NET-2)
  if (b0 === 198 && b1 === 51 && parts[2] === 100) return true;

  // 203.0.113.0/24 Documentation (TEST-NET-3)
  if (b0 === 203 && b1 === 0 && parts[2] === 113) return true;

  // 224.0.0.0/4 Multicast (224-239)
  if (b0 >= 224 && b0 <= 239) return true;

  // 240.0.0.0/4 Reserved for future use (240-255)
  if (b0 >= 240) return true;

  return false;
}

/**
 * Checks whether an IPv6 address is in a reserved/private/loopback range.
 */
export function isPrivateOrReservedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // Loopback ::1
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
  // Unspecified ::
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

  // IPv4-mapped IPv6 ::ffff:192.168.x.x
  if (normalized.startsWith('::ffff:') || normalized.startsWith('0:0:0:0:0:ffff:')) {
    const ipv4Part = normalized.split(':').pop();
    if (ipv4Part && isIP(ipv4Part) === 4) {
      return isPrivateOrReservedIpv4(ipv4Part);
    }
    return true;
  }

  // Unique Local Address fc00::/7 (fc00:: through fdff::)
  if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) return true;

  // Link-local Unicast fe80::/10
  if (/^fe[89ab][0-9a-f]:/i.test(normalized)) return true;

  // Multicast ff00::/8
  if (/^ff[0-9a-f]{2}:/i.test(normalized)) return true;

  // Documentation / discarded / benchmarking
  if (normalized.startsWith('2001:db8:') || normalized.startsWith('2001:2:')) return true;

  // AWS IPv6 IMDS
  if (normalized.includes('fd00:ec2::254')) return true;

  return false;
}

/**
 * Validates a target URL or redirect URL against SSRF rules.
 */
export function validateUrlSsrf(rawUrl: string): SsrfValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: `Disallowed protocol: ${parsed.protocol}` };
  }

  if (parsed.username || parsed.password) {
    return { safe: false, reason: 'Credentials in URL are strictly prohibited' };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { safe: false, reason: `Access to internal hostname '${hostname}' is prohibited` };
  }

  // Check if hostname is directly an IP literal
  const ipVersion = isIP(hostname);
  if (ipVersion === 4) {
    if (isPrivateOrReservedIpv4(hostname)) {
      return { safe: false, reason: `Access to private IPv4 address '${hostname}' is prohibited`, ip: hostname };
    }
  } else if (ipVersion === 6) {
    if (isPrivateOrReservedIpv6(hostname)) {
      return { safe: false, reason: `Access to private IPv6 address '${hostname}' is prohibited`, ip: hostname };
    }
  }

  // Port restrictions: Only permit 80 and 443 by default
  if (parsed.port) {
    const port = Number.parseInt(parsed.port, 10);
    if (port !== 80 && port !== 443 && port !== 8080 && port !== 8443) {
      return { safe: false, reason: `Access to port ${port} is not permitted` };
    }
  }

  return { safe: true };
}
