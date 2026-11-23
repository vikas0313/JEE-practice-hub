/**
 * Content Safety, Sanitization and KaTeX Hardening Module
 * Prevents XSS, prototype pollution, ReDoS, and KaTeX macro expansion attacks.
 */

export interface ContentSafetyResult {
  safe: boolean;
  sanitized: string;
  reason?: string;
}

export const MAX_CONTENT_LENGTH = 50_000;
export const MAX_TEX_NESTING_DEPTH = 50;

/**
 * Escapes standard HTML special characters.
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Strict HTML and script sanitization.
 * Strips dangerous HTML tags, event handlers, and javascript: pseudo-protocols.
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';

  let sanitized = input;

  // 1. Strip <script>...</script> and <iframe>...</iframe> tags entirely (even if unclosed)
  sanitized = sanitized.replace(/<script\b[\s\S]*?(?:<\/script>|$)/gi, '');
  sanitized = sanitized.replace(/<iframe\b[\s\S]*?(?:<\/iframe>|$)/gi, '');

  // 2. Strip event handlers (e.g., onerror=, onload=, onclick=) with boundary match
  sanitized = sanitized.replace(/\bon\w+\s*=\s*(?:["'][^"']*["']|[^\s>]+)/gi, '');

  // 3. Strip javascript: and vbscript: URLs, including whitespace/control char bypasses
  sanitized = sanitized.replace(/(?:java\s*script|vb\s*script|data\s*):/gi, 'blocked:');

  // 4. Strip dangerous tags like <object>, <embed>, <base>, <link>, <meta>, <style>, <form>
  sanitized = sanitized.replace(/<\/?(?:object|embed|base|link|meta|applet|style|form)\b[^>]*>/gi, '');

  return sanitized;
}

/**
 * Validates text for ReDoS, macro bombs, and excessive nesting.
 */
export function validateContentBounds(text: string): { safe: boolean; reason?: string } {
  if (!text) return { safe: true };

  // 1. Length bound
  if (text.length > MAX_CONTENT_LENGTH) {
    return {
      safe: false,
      reason: `Content exceeds maximum allowed size of ${MAX_CONTENT_LENGTH} characters (got ${text.length})`,
    };
  }

  // 2. TeX brace nesting depth bound (prevents parser stack overflow)
  let currentDepth = 0;
  let maxDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '{' && (i === 0 || text[i - 1] !== '\\')) {
      currentDepth++;
      if (currentDepth > maxDepth) maxDepth = currentDepth;
      if (currentDepth > MAX_TEX_NESTING_DEPTH) {
        return {
          safe: false,
          reason: `TeX nesting depth exceeds maximum allowed limit of ${MAX_TEX_NESTING_DEPTH}`,
        };
      }
    } else if (char === '}' && (i === 0 || text[i - 1] !== '\\')) {
      if (currentDepth > 0) currentDepth--;
    }
  }

  // 3. Detect recursive macro definitions
  const dangerousMacroPattern = /\\(?:def|gdef|edef|xdef|let|futurelet)\s*\\[a-zA-Z]+/i;
  if (dangerousMacroPattern.test(text)) {
    return {
      safe: false,
      reason: 'Custom macro definitions (\\def, \\let, etc.) are forbidden for security',
    };
  }

  return { safe: true };
}

/**
 * Hardened KaTeX options.
 * Strict safe-mode: trust: false disallows \url, \href to arbitrary protocols,
 * and maxExpand limits recursive expansions.
 */
export const KATEX_SAFE_OPTIONS = {
  displayMode: false,
  throwOnError: false,
  trust: false, // Disallow unsafe commands like \href, \url, or raw HTML
  maxSize: 50,
  maxExpand: 100, // Hard stop on macro expansion recursion
  strict: 'ignore' as const,
};

