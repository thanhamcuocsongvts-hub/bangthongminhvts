/**
 * MathType MTEF (MathType Equation Format v3 & v5) Binary Parser & LaTeX Converter
 * 
 * MathType stores mathematical formulas inside OLE objects (.bin embeddings in Word docx)
 * as an OLE Compound File Binary or direct stream called "Equation Native".
 * This parser extracts the MTEF stream and translates standard MTEF records
 * (lines, characters, templates: fractions, radicals, subscripts/superscripts,
 * integrals, sums, matrices, parentheses) into clean LaTeX formulas for KaTeX rendering.
 */

// MTEF Record Types
const MTEF_END = 0;
const MTEF_LINE = 1;
const MTEF_CHAR = 2;
const MTEF_TMPL = 3;
const MTEF_PILE = 4;
const MTEF_MATRIX = 5;
const MTEF_EMBELL = 6;
const MTEF_RULER = 7;
const MTEF_FONT = 8;
const MTEF_COLOR = 9;
const MTEF_COLOR_DEF = 10;
const MTEF_FONT_STYLE_DEF = 11;
const MTEF_EQN_PREFS = 12;
const MTEF_ENCODING_DEF = 13;

/**
 * Extracts the raw MTEF byte stream from an OLE binary file (Compound File or Equation Native)
 */
export function extractMtefFromOleBuffer(buffer: ArrayBuffer | Uint8Array): Uint8Array | null {
  try {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (bytes.length < 16) return null;

    // 1. Direct 28-byte Equation Native header check: [0x1c, 0x00, ...] followed by MTEF version (3 or 5)
    if (bytes[0] === 0x1c && bytes[1] === 0x00 && bytes.length > 28) {
      const ver = bytes[28];
      if ((ver === 3 || ver === 5) && (bytes[29] === 1 || bytes[29] === 2)) {
        return bytes.subarray(28);
      }
    }

    // 2. Search for MTEF header signature: version (3 or 5), platform (1 or 2), product (1 or 2)
    for (let i = 0; i < bytes.length - 8; i++) {
      const ver = bytes[i];
      const plat = bytes[i + 1];
      const prod = bytes[i + 2];
      const pVer = bytes[i + 3];
      const pSub = bytes[i + 4];

      if (
        (ver === 3 || ver === 5) &&
        (plat === 1 || plat === 2) &&
        (prod === 1 || prod === 2) &&
        pVer <= 20 &&
        pSub <= 20
      ) {
        return bytes.subarray(i);
      }
    }

    // 3. Search for "Equation Native" in UTF-16LE or ASCII within OLE Compound Document
    for (let i = 0; i < bytes.length - 30; i++) {
      // Check UTF-16LE for "Eq" (0x45 0x00 0x71 0x00)
      if (
        bytes[i] === 0x45 && bytes[i + 1] === 0x00 &&
        bytes[i + 2] === 0x71 && bytes[i + 3] === 0x00
      ) {
        // Look ahead for MTEF version byte sequence within next 512 bytes
        const searchLimit = Math.min(bytes.length - 5, i + 512);
        for (let j = i; j < searchLimit; j++) {
          if (
            (bytes[j] === 3 || bytes[j] === 5) &&
            (bytes[j + 1] === 1 || bytes[j + 1] === 2) &&
            (bytes[j + 2] === 1 || bytes[j + 2] === 2)
          ) {
            return bytes.subarray(j);
          }
        }
      }
    }

    return null;
  } catch (err) {
    console.warn('MTEF extraction notice:', err);
    return null;
  }
}

/**
 * Converts MTEF binary data into LaTeX string
 */
export function parseMtefToLatex(mtefBytes: Uint8Array): string {
  try {
    if (!mtefBytes || mtefBytes.length < 5) return '';

    let pos = 0;
    const version = mtefBytes[pos++]; // 3, 4, or 5
    const platform = mtefBytes[pos++]; // 1 = Windows, 2 = Mac
    const product = mtefBytes[pos++]; // 1 = MathType, 2 = Equation Editor
    const prodVersion = mtefBytes[pos++];
    const prodSubVersion = mtefBytes[pos++];

    // Helper reader
    function readByte(): number {
      if (pos >= mtefBytes.length) return MTEF_END;
      return mtefBytes[pos++];
    }

    function readWord(): number {
      const b1 = readByte();
      const b2 = readByte();
      return b1 | (b2 << 8);
    }

    function parseLine(): string {
      let result = '';
      const lineOptions = readByte();

      while (pos < mtefBytes.length) {
        const recordType = readByte();
        if (recordType === MTEF_END) {
          break;
        }

        switch (recordType) {
          case MTEF_CHAR: {
            const charOptions = readByte();
            const fontTag = (charOptions & 0x01) ? readByte() : 0;
            let charCode = 0;

            if (version >= 5) {
              charCode = readWord();
            } else {
              charCode = readByte();
            }

            result += decodeMtefChar(charCode, fontTag);
            break;
          }

          case MTEF_TMPL: {
            result += parseTemplate();
            break;
          }

          case MTEF_PILE: {
            // Vertical pile
            const pileOptions = readByte();
            const align = readByte();
            result += parseLine();
            break;
          }

          case MTEF_MATRIX: {
            result += parseMatrix();
            break;
          }

          case MTEF_EMBELL: {
            const embellOptions = readByte();
            const embellType = readByte();
            result += getEmbellishment(embellType);
            break;
          }

          case MTEF_FONT: {
            // Font definition record: typeface (byte), font name (null terminated)
            const typeface = readByte();
            while (pos < mtefBytes.length && mtefBytes[pos] !== 0) {
              pos++;
            }
            if (pos < mtefBytes.length) pos++; // skip null
            break;
          }

          case MTEF_COLOR_DEF:
          case MTEF_FONT_STYLE_DEF:
          case MTEF_EQN_PREFS:
          case MTEF_ENCODING_DEF: {
            // Skip variable length headers
            const count = readByte();
            pos += count;
            break;
          }

          default:
            break;
        }
      }

      return result;
    }

    function parseTemplate(): string {
      const tmplOptions = readByte();
      const selector = readByte();
      const variation = readWord();

      switch (selector) {
        // 0: Parentheses, Brackets, Braces
        case 0: {
          const content = parseLine();
          if (variation === 0) return `\\left( ${content} \\right)`;
          if (variation === 1) return `\\left[ ${content} \\right]`;
          if (variation === 2) return `\\left\\{ ${content} \\right\\}`;
          if (variation === 3) return `\\left| ${content} \\right|`;
          return `\\left( ${content} \\right)`;
        }

        // 1: Fractions
        case 1: {
          const num = parseLine();
          const den = parseLine();
          return `\\frac{${num}}{${den}}`;
        }

        // 2: Radicals (Square root / N-th root)
        case 2: {
          if (variation === 1) {
            // N-th root
            const root = parseLine();
            const radicand = parseLine();
            return `\\sqrt[${root}]{${radicand}}`;
          } else {
            // Square root
            const radicand = parseLine();
            return `\\sqrt{${radicand}}`;
          }
        }

        // 3: Subscript and Superscript
        case 3: {
          if (variation === 0) {
            // Sup only
            const sup = parseLine();
            return `^{${sup}}`;
          } else if (variation === 1) {
            // Sub only
            const sub = parseLine();
            return `_{${sub}}`;
          } else {
            // Both Sub and Sup
            const sub = parseLine();
            const sup = parseLine();
            return `_{${sub}}^{${sup}}`;
          }
        }

        // 4: Integrals
        case 4: {
          const lower = parseLine();
          const upper = parseLine();
          const integrand = parseLine();
          if (lower || upper) {
            return `\\int_{${lower}}^{${upper}} {${integrand}}`;
          }
          return `\\int {${integrand}}`;
        }

        // 5: Summations
        case 5: {
          const lower = parseLine();
          const upper = parseLine();
          const body = parseLine();
          return `\\sum_{${lower}}^{${upper}} {${body}}`;
        }

        // 6: Products
        case 6: {
          const lower = parseLine();
          const upper = parseLine();
          const body = parseLine();
          return `\\prod_{${lower}}^{${upper}} {${body}}`;
        }

        // 8: Limit
        case 8: {
          const sub = parseLine();
          return `\\lim_{${sub}}`;
        }

        // 12: Overbar / Underbar
        case 12: {
          const content = parseLine();
          return variation === 1 ? `\\underline{${content}}` : `\\overline{${content}}`;
        }

        // 13: Vector arrow
        case 13: {
          const content = parseLine();
          return `\\vec{${content}}`;
        }

        default: {
          // Unknown template, parse content safely
          const content = parseLine();
          return content;
        }
      }
    }

    function parseMatrix(): string {
      const matrixOptions = readByte();
      const rows = readByte() || 2;
      const cols = readByte() || 2;

      const elements: string[][] = [];
      for (let r = 0; r < rows; r++) {
        elements[r] = [];
        for (let c = 0; c < cols; c++) {
          elements[r][c] = parseLine();
        }
      }

      const rowStrings = elements.map((row) => row.join(' & ')).join(' \\\\ ');
      return `\\begin{matrix} ${rowStrings} \\end{matrix}`;
    }

    function getEmbellishment(type: number): string {
      switch (type) {
        case 1: return "'"; // single prime
        case 2: return "''"; // double prime
        case 3: return "'''"; // triple prime
        case 4: return '^{\\bullet}';
        case 5: return '^{\\circ}';
        default: return '';
      }
    }

    function decodeMtefChar(code: number, font: number): string {
      // Standard ASCII alphanumeric
      if (code >= 32 && code <= 126) {
        const char = String.fromCharCode(code);
        if (char === '<') return ' < ';
        if (char === '>') return ' > ';
        if (char === '&') return ' & ';
        return char;
      }

      // Mathematical symbols lookup
      switch (code) {
        case 0x00b1: return ' \\pm ';
        case 0x00d7: return ' \\times ';
        case 0x00f7: return ' \\div ';
        case 0x2260: return ' \\neq ';
        case 0x2264: return ' \\le ';
        case 0x2265: return ' \\ge ';
        case 0x221e: return ' \\infty ';
        case 0x2208: return ' \\in ';
        case 0x2209: return ' \\notin ';
        case 0x2282: return ' \\subset ';
        case 0x222a: return ' \\cup ';
        case 0x2229: return ' \\cap ';
        case 0x2205: return ' \\emptyset ';
        case 0x2192: return ' \\to ';
        case 0x21d2: return ' \\Rightarrow ';
        case 0x21d4: return ' \\Leftrightarrow ';
        case 0x03b1: return ' \\alpha ';
        case 0x03b2: return ' \\beta ';
        case 0x03b3: return ' \\gamma ';
        case 0x03b4: return ' \\delta ';
        case 0x03c0: return ' \\pi ';
        case 0x03c9: return ' \\omega ';
        case 0x03c6: return ' \\varphi ';
        case 0x03bb: return ' \\lambda ';
        case 0x0394: return ' \\Delta ';
        case 0x03a9: return ' \\Omega ';
        default:
          return code > 0 ? String.fromCharCode(code) : '';
      }
    }

    // Top-level parse
    return parseLine().trim();
  } catch (err) {
    console.warn('MTEF to LaTeX parser notice:', err);
    return '';
  }
}

/**
 * Given an OLE Object Buffer from Word docx (embeddings/oleObjectX.bin),
 * parses it and returns the LaTeX formula.
 */
export function extractMathTypeLatex(oleBuffer: ArrayBuffer | Uint8Array): string {
  const mtef = extractMtefFromOleBuffer(oleBuffer);
  if (!mtef) return '';
  return parseMtefToLatex(mtef);
}
