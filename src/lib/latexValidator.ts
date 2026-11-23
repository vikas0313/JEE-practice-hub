// ============================================================
// Phase 4: KaTeX & LaTeX Formula Validator (Item 24)
// ============================================================
// Ensures all LaTeX equations in questions, options, and solutions
// can be parsed without throwing errors or breaking the UI.

export interface LatexValidationResult {
  isValid: boolean;
  errors: string[];
  equationCount: number;
}

/**
 * Validates LaTeX syntax in a string.
 * Checks for balanced math delimiters ($ and $$) and balanced curly braces inside formulas.
 */
export function validateLatexString(text: string): LatexValidationResult {
  const errors: string[] = [];
  let equationCount = 0;

  if (!text || typeof text !== 'string') {
    return { isValid: true, errors: [], equationCount: 0 };
  }

  // Check display math $$...$$
  const displayMathRegex = /\$\$([\s\S]*?)\$\$/g;
  let match;
  while ((match = displayMathRegex.exec(text)) !== null) {
    equationCount++;
    const formula = match[1];
    const braceErr = checkBalancedBraces(formula);
    if (braceErr) {
      errors.push(`Display math error: ${braceErr} in "$$${formula.slice(0, 30)}...$$"`);
    }
  }

  // Remove display math before checking inline math
  const textWithoutDisplay = text.replace(displayMathRegex, '');

  // Check unescaped dollar signs for inline math
  const inlineMatches = textWithoutDisplay.match(/(?<!\\)\$([^\$]+?)(?<!\\)\$/g);
  if (inlineMatches) {
    for (const inline of inlineMatches) {
      equationCount++;
      const formula = inline.slice(1, -1);
      const braceErr = checkBalancedBraces(formula);
      if (braceErr) {
        errors.push(`Inline math error: ${braceErr} in "$${formula.slice(0, 30)}...$"`);
      }
    }
  }

  // Check for orphan / unbalanced dollar signs
  const totalSingleDollars = (textWithoutDisplay.match(/(?<!\\)\$/g) || []).length;
  if (totalSingleDollars % 2 !== 0) {
    errors.push(`Unbalanced dollar sign delimiter ($) detected in text`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    equationCount,
  };
}

function checkBalancedBraces(formula: string): string | null {
  let depth = 0;
  for (let i = 0; i < formula.length; i++) {
    const char = formula[i];
    // Ignore escaped braces \{ and \}
    if (i > 0 && formula[i - 1] === '\\') {
      continue;
    }
    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth < 0) {
        return 'Extra closing brace "}" detected';
      }
    }
  }
  if (depth > 0) {
    return `${depth} unclosed opening brace(s) "{" detected`;
  }
  return null;
}
