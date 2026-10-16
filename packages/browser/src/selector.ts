export interface SelectorAnalysis {
  isValid: boolean;
  selector: string;
  isSpecific: boolean;
  warning?: string;
}

/**
 * Validates a CSS selector string and checks for common pitfalls.
 */
export function validateCssSelector(selector: string): SelectorAnalysis {
  const trimmed = selector.trim();
  if (!trimmed) {
    return {
      isValid: false,
      selector: trimmed,
      isSpecific: false,
      warning: 'Selector cannot be empty',
    };
  }

  // Check for disallowed characters / injection attempts
  if (/[<>{};"']/.test(trimmed)) {
    return {
      isValid: false,
      selector: trimmed,
      isSpecific: false,
      warning: 'Selector contains invalid or dangerous characters',
    };
  }

  // Broad selector check
  const isBroad =
    trimmed === '*' ||
    trimmed === 'body' ||
    trimmed === 'html' ||
    trimmed === 'div' ||
    trimmed === 'span' ||
    trimmed === 'p';

  return {
    isValid: true,
    selector: trimmed,
    isSpecific: !isBroad,
    warning: isBroad ? 'Selector is very broad and will match large portions of the page' : undefined,
  };
}

/**
 * Generates an optimal stable CSS selector given DOM element attributes.
 */
export function generateElementSelector(info: {
  id?: string;
  testId?: string;
  tagName: string;
  classes?: string[];
  ancestorTag?: string;
}): string {
  const tag = info.tagName.toLowerCase();

  // 1. Data-testid or data-cy (highest priority)
  if (info.testId) {
    return `[data-testid="${info.testId}"]`;
  }

  // 2. Element ID
  if (info.id && !/^[0-9]/.test(info.id) && !/-(?:\d+|[a-f0-9]{8,})$/i.test(info.id)) {
    return `#${info.id}`;
  }

  // 3. Meaningful classes (exclude dynamic CSS modules or generated hashes)
  const safeClasses = (info.classes || []).filter(
    (cls) =>
      cls.length > 2 &&
      !cls.startsWith('_') &&
      !cls.startsWith('css-') &&
      !cls.startsWith('jsx-') &&
      !cls.includes(':') &&
      !cls.includes('/')
  );

  if (safeClasses.length > 0) {
    const classSelector = `${tag}.${safeClasses.slice(0, 2).join('.')}`;
    if (info.ancestorTag) {
      return `${info.ancestorTag.toLowerCase()} > ${classSelector}`;
    }
    return classSelector;
  }

  // 4. Fallback to ancestor path
  return info.ancestorTag ? `${info.ancestorTag.toLowerCase()} > ${tag}` : tag;
}
