/**
 * ZSCII Character Set
 * 
 * ZSCII is the Z-machine's character encoding, similar to ASCII but with
 * extensions for special characters. ZSCII codes 32-126 match ASCII.
 * 
 * Reference: Z-Machine Specification §3
 * 
 * @module
 */

/**
 * Special ZSCII codes
 */
export const ZSCII = {
  /** Null (padding) */
  NULL: 0,
  /** Delete previous character (rare) */
  DELETE: 8,
  /** Newline (carriage return) */
  NEWLINE: 13,
  /** Escape key */
  ESCAPE: 27,
  /** Cursor up */
  CURSOR_UP: 129,
  /** Cursor down */
  CURSOR_DOWN: 130,
  /** Cursor left */
  CURSOR_LEFT: 131,
  /** Cursor right */
  CURSOR_RIGHT: 132,
  /** Function key 1 */
  F1: 133,
  /** Function key 12 */
  F12: 144,
  /** Keypad 0 */
  KEYPAD_0: 145,
  /** Keypad 9 */
  KEYPAD_9: 154,
  /** Single click */
  CLICK_SINGLE: 252,
  /** Double click */
  CLICK_DOUBLE: 253,
  /** Menu click (V6) */
  CLICK_MENU: 254,
} as const;

/**
 * Unicode mappings for ZSCII extra characters (codes 155-251)
 * 
 * These can be customized per-game via the Unicode translation table,
 * but these are the default mappings from the spec.
 * 
 * §3.8.5.3: Default Unicode translations
 */
export const DEFAULT_UNICODE_TABLE: string[] = [
  // 155-163: German characters
  'ä', 'ö', 'ü', 'Ä', 'Ö', 'Ü', 'ß', '»', '«',
  // 164-168: Spanish/Portuguese
  'ë', 'ï', 'ÿ', 'Ë', 'Ï',
  // 169-175: More accented
  'á', 'é', 'í', 'ó', 'ú', 'ý', 'Á',
  // 176-182
  'É', 'Í', 'Ó', 'Ú', 'Ý', 'à', 'è',
  // 183-189
  'ì', 'ò', 'ù', 'À', 'È', 'Ì', 'Ò',
  // 190-196
  'Ù', 'â', 'ê', 'î', 'ô', 'û', 'Â',
  // 197-203
  'Ê', 'Î', 'Ô', 'Û', 'å', 'Å', 'ø',
  // 204-210
  'Ø', 'ã', 'ñ', 'õ', 'Ã', 'Ñ', 'Õ',
  // 211-217
  'æ', 'Æ', 'ç', 'Ç', 'þ', 'ð', 'Þ',
  // 218-223
  'Ð', 'œ', 'Œ', '¡', '¿', '£',
  // 224 onward: unused in default table
];

/**
 * Convert a ZSCII code to a Unicode character
 * 
 * @param code - ZSCII code (0-255)
 * @param unicodeTable - Optional custom unicode table for codes 155-251
 * @returns The Unicode character, or empty string for unprintable codes
 */
export function zsciiToUnicode(
  code: number,
  unicodeTable: string[] = DEFAULT_UNICODE_TABLE
): string {
  // Null
  if (code === ZSCII.NULL) {
    return '';
  }
  
  // Newline
  if (code === ZSCII.NEWLINE) {
    return '\n';
  }
  
  // Standard ASCII range (32-126)
  if (code >= 32 && code <= 126) {
    return String.fromCharCode(code);
  }
  
  // Extra characters (155-251)
  if (code >= 155 && code <= 251) {
    const index = code - 155;
    if (index < unicodeTable.length) {
      return unicodeTable[index];
    }
    return '?'; // Unknown character
  }
  
  // Input codes and other special codes return empty
  return '';
}

/**
 * Convert a Unicode character to ZSCII code
 * 
 * @param char - Unicode character
 * @param unicodeTable - Optional custom unicode table
 * @returns ZSCII code, or 0 if not representable
 */
export function unicodeToZscii(
  char: string,
  unicodeTable: string[] = DEFAULT_UNICODE_TABLE
): number {
  if (char.length === 0) {
    return ZSCII.NULL;
  }
  
  const c = char.charAt(0);
  
  // Newline
  if (c === '\n' || c === '\r') {
    return ZSCII.NEWLINE;
  }
  
  // Standard ASCII range
  const code = c.charCodeAt(0);
  if (code >= 32 && code <= 126) {
    return code;
  }
  
  // Check extra characters table
  const index = unicodeTable.indexOf(c);
  if (index !== -1) {
    return 155 + index;
  }
  
  // Not representable
  return ZSCII.NULL;
}

/**
 * Check if a ZSCII code represents a printable character
 */
export function isZsciiPrintable(code: number): boolean {
  return (code >= 32 && code <= 126) || (code >= 155 && code <= 251) || code === ZSCII.NEWLINE;
}

/**
 * Check if a ZSCII code is an input terminator
 */
export function isZsciiTerminator(code: number): boolean {
  return code === ZSCII.NEWLINE || 
         code === ZSCII.ESCAPE ||
         (code >= ZSCII.F1 && code <= ZSCII.F12) ||
         (code >= ZSCII.CLICK_SINGLE && code <= ZSCII.CLICK_MENU);
}
