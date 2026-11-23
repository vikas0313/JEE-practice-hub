import React, { useMemo } from 'react';
import katex from 'katex';
import {
  sanitizeHtml,
  validateContentBounds,
  KATEX_SAFE_OPTIONS,
  escapeHtml,
} from './contentSafety';

interface KaTeXProps {
  text: string;
  className?: string;
}

// Global bounded LRU cache for rendered math expressions & full texts
const MAX_KATEX_CACHE_SIZE = 2000;
const katexFullTextCache = new Map<string, string>();
const katexFormulaCache = new Map<string, string>();

export function clearKaTeXCache(): void {
  katexFullTextCache.clear();
  katexFormulaCache.clear();
}

function getOrRenderFormula(tex: string, displayMode: boolean): string {
  const cacheKey = `${displayMode ? 'D:' : 'I:'}${tex}`;
  const cached = katexFormulaCache.get(cacheKey);
  if (cached !== undefined) {
    // Re-insert to refresh LRU order
    katexFormulaCache.delete(cacheKey);
    katexFormulaCache.set(cacheKey, cached);
    return cached;
  }

  try {
    const rendered = katex.renderToString(tex, {
      ...KATEX_SAFE_OPTIONS,
      displayMode,
    });
    if (katexFormulaCache.size >= MAX_KATEX_CACHE_SIZE) {
      const oldestKey = katexFormulaCache.keys().next().value;
      if (oldestKey) katexFormulaCache.delete(oldestKey);
    }
    katexFormulaCache.set(cacheKey, rendered);
    return rendered;
  } catch {
    return `<span class="text-red-500">[Math Error]</span>`;
  }
}

/**
 * Renders text containing LaTeX math delimiters with full XSS and ReDoS protections.
 * Supports $...$ for inline and $$...$$ for display math.
 */
export const KaTeXText = React.memo(function KaTeXText({ text, className = '' }: KaTeXProps) {
  const html = useMemo(() => renderMathInText(text), [text]);
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

export function renderMathInText(text: string): string {
  if (!text) return '';

  const fullCached = katexFullTextCache.get(text);
  if (fullCached !== undefined) {
    katexFullTextCache.delete(text);
    katexFullTextCache.set(text, fullCached);
    return fullCached;
  }

  const boundsCheck = validateContentBounds(text);
  if (!boundsCheck.safe) {
    return `<span class="text-amber-600">[Content Blocked: ${escapeHtml(boundsCheck.reason || 'Unsafe content')}]</span>`;
  }

  // Pre-sanitize any malicious script/HTML injection
  const safeText = sanitizeHtml(text);

  // First handle display math: $$...$$ and \[...\]
  let result = safeText.replace(/(?:\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\])/g, (_match, tex1, tex2) => {
    const tex = tex1 !== undefined ? tex1 : tex2;
    return getOrRenderFormula(tex.trim(), true);
  });

  // Then handle inline math: \(...\)
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_match, tex) => {
    return getOrRenderFormula(tex.trim(), false);
  });

  // Then handle inline math: $...$
  result = result.replace(/\$([^$\n]+?)\$/g, (_match, tex) => {
    return getOrRenderFormula(tex.trim(), false);
  });

  // Convert **bold** to <strong>
  result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Convert newlines to <br>
  result = result.replace(/\n/g, '<br/>');

  if (katexFullTextCache.size >= MAX_KATEX_CACHE_SIZE) {
    const oldest = katexFullTextCache.keys().next().value;
    if (oldest) katexFullTextCache.delete(oldest);
  }
  katexFullTextCache.set(text, result);

  return result;
}

