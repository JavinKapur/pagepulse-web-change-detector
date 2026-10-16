import { createHash } from 'node:crypto';

export interface CanonicalUrlResult {
  canonicalUrl: string;
  hostname: string;
  port: number | null;
  pathname: string;
}

/**
 * Normalizes and canonicalizes a URL for consistent monitoring and deduplication.
 * - Enforces http/https
 * - Lowercases hostname
 * - Strips default ports (80 for http, 443 for https)
 * - Removes URL fragment / hash
 * - Sorts query parameters deterministically
 * - Strips trailing slash on root pathname
 */
export function canonicalizeUrl(rawUrl: string): CanonicalUrlResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('URL cannot be empty');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Malformed URL: ${rawUrl}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported protocol: ${parsed.protocol}. Only http: and https: are supported.`);
  }

  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials (user:password@) are not allowed.');
  }

  const hostname = parsed.hostname.toLowerCase();

  let port: number | null = null;
  if (parsed.port) {
    const portNum = Number.parseInt(parsed.port, 10);
    const isDefault =
      (parsed.protocol === 'http:' && portNum === 80) ||
      (parsed.protocol === 'https:' && portNum === 443);
    if (!isDefault) {
      port = portNum;
    }
  }

  // Sort query parameters
  const searchParams = new URLSearchParams(parsed.search);
  const sortedParams = new URLSearchParams();
  const keys = Array.from(searchParams.keys()).sort();
  for (const key of keys) {
    const values = searchParams.getAll(key).sort();
    for (const val of values) {
      sortedParams.append(key, val);
    }
  }

  let pathname = parsed.pathname || '/';
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  const hostWithPort = port ? `${hostname}:${port}` : hostname;
  const queryString = sortedParams.toString() ? `?${sortedParams.toString()}` : '';
  const canonicalUrl = `${parsed.protocol}//${hostWithPort}${pathname}${queryString}`;

  return {
    canonicalUrl,
    hostname,
    port,
    pathname,
  };
}

/**
 * Derives a deterministic targetKey from canonical URL and rendering profile.
 */
export function deriveTargetKey(
  canonicalUrl: string,
  renderProfile: Record<string, unknown> = {}
): string {
  const profileString = JSON.stringify(renderProfile, Object.keys(renderProfile).sort());
  return createHash('sha256')
    .update(`${canonicalUrl}|${profileString}`)
    .digest('hex');
}
