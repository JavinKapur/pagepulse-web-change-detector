export interface NormalizationOptions {
  stripTimestamps?: boolean;
  stripRelativeTime?: boolean;
  stripCounters?: boolean;
  stripRandomTokens?: boolean;
  customIgnoreRegexes?: string[];
}

export interface NormalizationResult {
  normalizedText: string;
  removedPatternsCount: number;
}

// ISO 8601, RFC 2822, YYYY-MM-DD, DD/MM/YYYY, etc.
const TIMESTAMP_REGEX = /\b(?:\d{4}[-/]\d{2}[-/]\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?|\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b/g;

// Relative times: "3 minutes ago", "just now", "yesterday", "updated 2 hours ago"
const RELATIVE_TIME_REGEX = /\b(?:just now|moments ago|yesterday|tomorrow|\d+\s+(?:second|sec|minute|min|hour|hr|day|week|month|year)s?\s+ago)\b/gi;

// Volatile counters: "1,234 views", "45 items in stock", "12 users online", "10 items"
const COUNTER_REGEX = /\b(?:\d{1,3}(?:,\d{3})*|\d+)\s+(?:views?|visitors?|users?|readers?|watching|online|in stock|items in stock|items|results)\b/gi;

// Nonces, hashes, tokens: "token=abc12345", "csrf: 8f9b...", hex or base64 > 16 chars
const TOKEN_NONCE_REGEX = /\b(?:csrf[_-]?token|nonce|session[_-]?id|_token|request[_-]?id)\s*[:=]\s*[a-zA-Z0-9_=-]{16,}\b/gi;

/**
 * Normalizes text content and removes configured dynamic noise.
 */
export function normalizeText(
  rawText: string,
  options: NormalizationOptions = {}
): NormalizationResult {
  let text = rawText || '';
  let removedPatternsCount = 0;

  // 1. Normalize line endings and non-breaking spaces
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  text = text.replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ');

  // 2. Strip timestamps if enabled
  if (options.stripTimestamps) {
    const matches = text.match(TIMESTAMP_REGEX);
    if (matches) {
      removedPatternsCount += matches.length;
      text = text.replace(TIMESTAMP_REGEX, '[TIMESTAMP]');
    }
  }

  // 3. Strip relative time if enabled
  if (options.stripRelativeTime) {
    const matches = text.match(RELATIVE_TIME_REGEX);
    if (matches) {
      removedPatternsCount += matches.length;
      text = text.replace(RELATIVE_TIME_REGEX, '[RELATIVE_TIME]');
    }
  }

  // 4. Strip volatile counters if enabled
  if (options.stripCounters) {
    const matches = text.match(COUNTER_REGEX);
    if (matches) {
      removedPatternsCount += matches.length;
      text = text.replace(COUNTER_REGEX, '[COUNTER]');
    }
  }

  // 5. Strip tokens / nonces if enabled
  if (options.stripRandomTokens) {
    const matches = text.match(TOKEN_NONCE_REGEX);
    if (matches) {
      removedPatternsCount += matches.length;
      text = text.replace(TOKEN_NONCE_REGEX, '[TOKEN]');
    }
  }

  // 6. Apply custom user regex patterns safely
  if (options.customIgnoreRegexes && Array.isArray(options.customIgnoreRegexes)) {
    for (const rawRegex of options.customIgnoreRegexes) {
      if (!rawRegex || typeof rawRegex !== 'string' || rawRegex.length > 200) {
        continue;
      }
      try {
        const regex = new RegExp(rawRegex, 'gi');
        const matches = text.match(regex);
        if (matches) {
          removedPatternsCount += matches.length;
          text = text.replace(regex, '[IGNORED]');
        }
      } catch {
        // Ignore invalid regular expressions safely
      }
    }
  }

  // 7. Normalize line-by-line whitespace and blank lines
  const lines = text.split('\n');
  const cleanedLines: string[] = [];
  let prevWasEmpty = false;

  for (const line of lines) {
    // Collapse multi-spaces within the line
    const cleaned = line.replace(/[ \t]+/g, ' ').trim();
    if (cleaned.length === 0) {
      if (!prevWasEmpty) {
        cleanedLines.push('');
        prevWasEmpty = true;
      }
    } else {
      cleanedLines.push(cleaned);
      prevWasEmpty = false;
    }
  }

  const normalizedText = cleanedLines.join('\n').trim();

  return {
    normalizedText,
    removedPatternsCount,
  };
}
