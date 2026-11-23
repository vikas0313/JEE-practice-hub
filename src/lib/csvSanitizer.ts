// ============================================================
// JEE Practice Hub — CSV & Spreadsheet Formula Injection Defense
// Mitigates CWE-1236 (Improper Neutralization of Formula Elements in CSV File)
// ============================================================

const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r', '%'];

/**
 * Checks if a string represents a safe, benign standalone number (e.g. -1, +4, 3.14).
 * Standalone numeric values in score or marks columns are not executable formulas.
 */
function isSafeNumericString(val: string): boolean {
  return /^[+-]?\d+(?:\.\d+)?$/.test(val.trim());
}

/**
 * Sanitizes a single cell value against CSV / Spreadsheet formula execution.
 * If the value is a string starting with dangerous formula characters (=, +, -, @, \t, \r, %),
 * it prepends a single quote (') to force spreadsheet processors (Excel, Calc, Sheets)
 * to interpret the cell strictly as literal text.
 */
export function sanitizeCsvCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  const str = String(value);
  if (!str) return '';

  const trimmed = str.trimStart();
  if (trimmed.length > 0 && FORMULA_PREFIXES.includes(trimmed.charAt(0))) {
    if (isSafeNumericString(trimmed)) {
      return str;
    }
    // Prefix with single quote to escape spreadsheet formula parsing
    return `'${str}`;
  }

  return str;
}

/**
 * Recursively sanitizes all properties of an object or record before export to CSV / XLSX.
 */
export function sanitizeRecordForExport<T extends Record<string, any>>(record: T): T {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(record)) {
    if (val === null || val === undefined) {
      result[key] = '';
    } else if (Array.isArray(val)) {
      result[key] = val.map(item => (typeof item === 'object' && item !== null ? sanitizeRecordForExport(item) : sanitizeCsvCell(item)));
    } else if (typeof val === 'object') {
      result[key] = sanitizeRecordForExport(val);
    } else {
      result[key] = sanitizeCsvCell(val);
    }
  }
  return result as T;
}

/**
 * Formats a field for direct CSV string concatenation with RFC 4180 double-quoting
 * and formula injection sanitization.
 */
export function formatCsvField(value: unknown): string {
  const sanitized = sanitizeCsvCell(value);
  const str = String(sanitized ?? '').replace(/"/g, '""');
  return `"${str}"`;
}
