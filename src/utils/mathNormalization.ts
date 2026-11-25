/**
 * Comprehensive Mathematical & Scientific Notation Normalization Utility
 * Ensures all formulas from Gemini AI, AsciiMath, Unicode, and LaTeX render cleanly via KaTeX.
 */

const VIETNAMESE_CHAR_RE = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;

const KNOWN_LATEX_COMMANDS = new Set([
  'frac', 'dfrac', 'tfrac', 'cfrac', 'sqrt', 'vec', 'overrightarrow', 'overleftarrow',
  'overleftrightarrow', 'widehat', 'overline', 'underline', 'hat', 'bar', 'tilde', 'widetilde',
  'mathbb', 'mathcal', 'mathbf', 'mathrm', 'mathit', 'mathsf', 'text', 'textbf', 'textit',
  'operatorname', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'tg', 'cotg', 'arctg',
  'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'ln', 'log', 'lg', 'exp',
  'lim', 'limsup', 'liminf', 'int', 'iint', 'iiint', 'oint', 'sum', 'prod', 'coprod',
  'infty', 'alpha', 'beta', 'gamma', 'delta', 'Delta', 'epsilon', 'varepsilon', 'zeta',
  'eta', 'theta', 'vartheta', 'iota', 'kappa', 'lambda', 'Lambda', 'mu', 'nu', 'xi', 'Xi',
  'pi', 'Pi', 'rho', 'sigma', 'Sigma', 'tau', 'upsilon', 'phi', 'varphi', 'Phi', 'chi',
  'psi', 'Psi', 'omega', 'Omega', 'in', 'notin', 'ni', 'subset', 'subseteq', 'nsubseteq',
  'supset', 'supseteq', 'cup', 'cap', 'setminus', 'backslash', 'emptyset', 'varnothing',
  'le', 'leq', 'leqslant', 'ge', 'geq', 'geqslant', 'ne', 'neq', 'approx', 'equiv', 'cong',
  'sim', 'simeq', 'propto', 'pm', 'mp', 'times', 'cdot', 'div', 'ast', 'star', 'circ',
  'bullet', 'to', 'rightarrow', 'leftarrow', 'leftrightarrow', 'longrightarrow',
  'longleftrightarrow', 'Rightarrow', 'Leftarrow', 'Leftrightarrow', 'mapsto', 'implies', 'iff',
  'forall', 'exists', 'nexists', 'neg', 'land', 'lor', 'perp', 'parallel', 'nparallel',
  'angle', 'measuredangle', 'triangle', 'bigtriangleup', 'square', 'degree', 'prime',
  'binom', 'dbinom', 'tbinom', 'choose', 'left', 'right', 'middle', 'big', 'Big', 'bigg',
  'Bigg', 'begin', 'end', 'quad', 'qquad', 'ldots', 'cdots', 'vdots', 'ddots', 'dots',
  'mid', 'nmid', 'lfloor', 'rfloor', 'lceil', 'rceil', 'langle', 'rangle', 'lbrace', 'rbrace',
  'uparrow', 'downarrow', 'rightleftharpoons', 'not', 'overbrace', 'underbrace',
  'overset', 'underset', 'stackrel', 'xrightarrow', 'xleftarrow', 'cases', 'aligned',
  'array', 'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'max', 'min', 'sup', 'inf',
]);

const UNICODE_SUPER_MAP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-', 'ⁿ': 'n', 'ⁱ': 'i',
};

const UNICODE_SUB_MAP: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '₊': '+', '₋': '-', 'ₙ': 'n', 'ᵢ': 'i', 'ⱼ': 'j',
};

/**
 * Splits text into math ($...$, $$...$$, \(...\), \[...\]) and plain-text segments safely,
 * respecting escaped \$ and nested content.
 */
export function splitMathDelimiters(input: string): Array<{ type: 'math' | 'display' | 'text'; value: string; inner: string }> {
  if (!input) return [];
  const segments: Array<{ type: 'math' | 'display' | 'text'; value: string; inner: string }> = [];
  let i = 0;
  let textStart = 0;

  while (i < input.length) {
    const ch = input[i];
    if (ch === '\\' && input[i + 1] === '$') {
      i += 2;
      continue;
    }

    if (ch === '$' && input[i + 1] === '$') {
      const closeIdx = input.indexOf('$$', i + 2);
      if (closeIdx !== -1 && closeIdx > i + 2) {
        if (i > textStart) {
          const val = input.slice(textStart, i);
          segments.push({ type: 'text', value: val, inner: val });
        }
        const raw = input.slice(i, closeIdx + 2);
        segments.push({ type: 'display', value: raw, inner: input.slice(i + 2, closeIdx) });
        i = closeIdx + 2;
        textStart = i;
        continue;
      }
    } else if (ch === '$') {
      let closeIdx = i + 1;
      while (closeIdx < input.length) {
        if (input[closeIdx] === '$' && input[closeIdx - 1] !== '\\') break;
        closeIdx++;
      }
      if (closeIdx < input.length && closeIdx > i + 1) {
        if (i > textStart) {
          const val = input.slice(textStart, i);
          segments.push({ type: 'text', value: val, inner: val });
        }
        const raw = input.slice(i, closeIdx + 1);
        segments.push({ type: 'math', value: raw, inner: input.slice(i + 1, closeIdx) });
        i = closeIdx + 1;
        textStart = i;
        continue;
      }
    } else if (input.startsWith('\\(', i)) {
      const closeIdx = input.indexOf('\\)', i + 2);
      if (closeIdx !== -1 && closeIdx > i + 2) {
        if (i > textStart) {
          const val = input.slice(textStart, i);
          segments.push({ type: 'text', value: val, inner: val });
        }
        const raw = input.slice(i, closeIdx + 2);
        segments.push({ type: 'math', value: raw, inner: input.slice(i + 2, closeIdx) });
        i = closeIdx + 2;
        textStart = i;
        continue;
      }
    } else if (input.startsWith('\\[', i)) {
      const closeIdx = input.indexOf('\\]', i + 2);
      if (closeIdx !== -1 && closeIdx > i + 2) {
        if (i > textStart) {
          const val = input.slice(textStart, i);
          segments.push({ type: 'text', value: val, inner: val });
        }
        const raw = input.slice(i, closeIdx + 2);
        segments.push({ type: 'display', value: raw, inner: input.slice(i + 2, closeIdx) });
        i = closeIdx + 2;
        textStart = i;
        continue;
      }
    }
    i++;
  }

  if (textStart < input.length) {
    const val = input.slice(textStart);
    segments.push({ type: 'text', value: val, inner: val });
  }

  return segments;
}

/**
 * Recovers ASCII control characters produced when JSON.parse interprets single-backslash LaTeX
 * such as \frac (\f), \tan/\times/\theta/\text (\t), \beta/\binom/\begin (\b), \right/\rightarrow/\rho (\r).
 */
export function recoverCorruptedJsonLatexControlChars(text: string, inMathMode: boolean): string {
  if (!text) return text;
  let out = text
    // \f -> \frac, \forall
    .replace(/\u000c(rac|orall)\b/g, '\\f$1')
    // \t -> \times, \tan, \theta, \tau, \text, \tfrac, \triangle, \tilde, \to
    .replace(/\u0009(imes|an|heta|au|ext|frac|riangle|ilde|o(?![a-zA-Z]))/g, '\\t$1')
    // \b -> \beta, \binom, \bar, \begin, \big, \backslash, \bullet
    .replace(/\u0008(eta|inom|ar|egin|ig|igg|igl|igr|ackslash|ullet)/g, '\\b$1')
    // \r -> \right, \rightarrow, \rho, \rangle, \rbrace, \rceil, \rfloor
    .replace(/\u000d(ightarrow|ight|ho|angle|brace|ceil|floor)/g, '\\r$1');

  if (inMathMode) {
    out = out.replace(/\n(eq(?![a-zA-Z])|e(?![a-zA-Z])|otin|abla|exists|mid)/g, '\\n$1');
  }
  return out;
}

/**
 * Safely collapses double-escaped LaTeX commands (\\frac -> \frac) without corrupting
 * row line breaks like "\\ x - y = 1" inside \begin{cases}...\end{cases} or matrices.
 */
export function collapseDoubleBackslashLatexCommands(text: string): string {
  if (!text || !text.includes('\\\\')) return text;
  return text.replace(/\\\\([a-zA-Z]{2,})/g, (full, cmd) =>
    KNOWN_LATEX_COMMANDS.has(cmd) ? `\\${cmd}` : full
  );
}

/**
 * Finds matching closing parenthesis starting from openParenIdx ('(').
 */
function findMatchingParen(str: string, openParenIdx: number): number {
  let depth = 0;
  for (let i = openParenIdx; i < str.length; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Replaces function-style AsciiMath constructs like vec(...), sqrt(...), frac(a, b), ^(a+b), _(a+b)
 * respecting nested parentheses.
 */
function replaceAsciiMathCalls(text: string): string {
  let out = text;

  // 1. Named unary calls: vec(...), hat(...), widehat(...), overline(...), bar(...), sqrt(...), cbrt(...)
  const unaryMap: Record<string, (arg: string) => string> = {
    '\\vec': (a) => `\\overrightarrow{${a}}`,
    vec: (a) => `\\overrightarrow{${a}}`,
    '\\hat': (a) => `\\widehat{${a}}`,
    hat: (a) => `\\widehat{${a}}`,
    widehat: (a) => `\\widehat{${a}}`,
    '\\overline': (a) => `\\overline{${a}}`,
    overline: (a) => `\\overline{${a}}`,
    '\\bar': (a) => `\\overline{${a}}`,
    bar: (a) => `\\overline{${a}}`,
    '\\sqrt': (a) => `\\sqrt{${a}}`,
    sqrt: (a) => `\\sqrt{${a}}`,
    cbrt: (a) => `\\sqrt[3]{${a}}`,
  };

  for (let pass = 0; pass < 3; pass++) {
    let changed = false;

    // Handle root(n)(x) or root(n, x)
    out = out.replace(/(?:\\)?\broot\s*\(([^()]+)\)\s*\(([^()]+)\)/g, (_, n, x) => {
      changed = true;
      return `\\sqrt[${n.trim()}]{${x.trim()}}`;
    });
    out = out.replace(/(?:\\)?\broot\s*\(([^(),]+),([^()]+)\)/g, (_, n, x) => {
      changed = true;
      return `\\sqrt[${n.trim()}]{${x.trim()}}`;
    });

    // Handle frac(a)(b) and frac(a, b)
    out = out.replace(/(?:\\frac|\bfrac)\s*\(([^()]+)\)\s*\(([^()]+)\)/g, (_, a, b) => {
      changed = true;
      return `\\frac{${a.trim()}}{${b.trim()}}`;
    });
    out = out.replace(/(?:\\frac|\bfrac)\s*\(([^(),]+),([^()]+)\)/g, (_, a, b) => {
      changed = true;
      return `\\frac{${a.trim()}}{${b.trim()}}`;
    });

    // Handle unary function calls with balanced parens
    const callRe = /(\\?(?:vec|hat|widehat|overline|bar|sqrt|cbrt))\s*\(/g;
    let res = '';
    let idx = 0;
    let match: RegExpExecArray | null;
    while ((match = callRe.exec(out)) !== null) {
      const fnName = match[1];
      const matchStart = match.index;
      // Ensure word boundary for unslashed call names
      if (!fnName.startsWith('\\') && matchStart > 0 && /[a-zA-Z0-9_\\]/.test(out[matchStart - 1])) {
        continue;
      }
      const openIdx = matchStart + match[0].length - 1;
      const closeIdx = findMatchingParen(out, openIdx);
      if (closeIdx !== -1 && unaryMap[fnName]) {
        res += out.slice(idx, matchStart);
        const inner = out.slice(openIdx + 1, closeIdx).trim();
        res += unaryMap[fnName](inner);
        idx = closeIdx + 1;
        callRe.lastIndex = idx;
        changed = true;
      }
    }
    if (idx > 0) {
      res += out.slice(idx);
      out = res;
    }

    // Handle ^(expr) -> ^{expr} and _(expr) -> _{expr} with balanced parens
    const scriptRe = /([\^_])\s*\(/g;
    let sRes = '';
    let sIdx = 0;
    while ((match = scriptRe.exec(out)) !== null) {
      const op = match[1];
      const openIdx = match.index + match[0].length - 1;
      const closeIdx = findMatchingParen(out, openIdx);
      if (closeIdx !== -1) {
        sRes += out.slice(sIdx, match.index);
        const inner = out.slice(openIdx + 1, closeIdx).trim();
        sRes += `${op}{${inner}}`;
        sIdx = closeIdx + 1;
        scriptRe.lastIndex = sIdx;
        changed = true;
      }
    }
    if (sIdx > 0) {
      sRes += out.slice(sIdx);
      out = sRes;
    }

    if (!changed) break;
  }

  return out;
}

/**
 * Converts Oxyz unit vector basis linear combinations like i - 2j + 3k -> \overrightarrow{i} - 2\overrightarrow{j} + 3\overrightarrow{k}.
 */
export function formatUnitVectorsInMath(math: string): string {
  if (!math) return math;

  const tokens: string[] = [];
  const hold = (segment: string) => {
    const idx = tokens.length;
    tokens.push(segment);
    return `__MVTOK_${idx}__`;
  };

  let protectedStr = math
    .replace(/\\text\s*\{[^{}]*\}/g, hold)
    .replace(/\\(?:overrightarrow|overleftarrow|overleftrightarrow|widehat|overline|vec)\s*\{[^{}]*\}/g, hold)
    .replace(/\\[a-zA-Z]+/g, hold);

  const hasVectorMarker = math.includes('\\overrightarrow') || math.includes('\\vec');
  const hasExplicitUnitCombo =
    /(?:^|[^a-zA-Z_])[+-]?\s*\d*\s*[ijk]\s*[+-]\s*\d*\s*[jk](?![a-zA-Z0-9_])/.test(protectedStr) ||
    /(?:^|[^a-zA-Z_])[+-]?\s*\d*\s*[ij]\s*[+-]\s*\d*\s*[ijk](?![a-zA-Z0-9_])/.test(protectedStr);
  const hasVecEqUnitVector =
    hasVectorMarker && /=\s*[+-]?\s*\d*\s*[ijk](?:\s*[+-]|[^a-zA-Z0-9_]|$)/.test(protectedStr);

  if (hasExplicitUnitCombo || hasVecEqUnitVector) {
    protectedStr = protectedStr.replace(
      /(?<![a-zA-Z_\\])([ijk])(?![a-zA-Z0-9_])/g,
      '\\overrightarrow{$1}'
    );
  }

  return protectedStr.replace(/__MVTOK_(\d+)__/g, (_, i) => tokens[Number(i)] || '');
}

/**
 * Converts Unicode superscripts/subscripts, √ radicals, and vector/accent syntaxes into standard LaTeX.
 */
export function normalizeAccentsAndUnicodeScripts(text: string): string {
  if (!text) return '';
  let out = text;

  // Recover unicode radicals before paren conversion
  out = out
    .replace(/∛\s*\(([^()]+)\)/g, '\\sqrt[3]{$1}')
    .replace(/∛\s*([a-zA-Z0-9]+)/g, '\\sqrt[3]{$1}')
    .replace(/√\s*\(([^()]+)\)/g, '\\sqrt{$1}')
    .replace(/√\s*([a-zA-Z0-9]+)/g, '\\sqrt{$1}');

  // AsciiMath function calls (vec(...), sqrt(...), frac(...), ^(expr), _(expr))
  out = replaceAsciiMathCalls(out);

  // Vector, hat, overline syntaxes
  out = out
    .replace(/\\vec\s*\{([^{}]+)\}/g, '\\overrightarrow{$1}')
    .replace(/\\vec\s+([a-zA-Z][a-zA-Z0-9']*)/g, '\\overrightarrow{$1}')
    .replace(/([a-zA-Z][a-zA-Z0-9']*)(?:\u20D7|[\u2192\u27F6])/g, '\\overrightarrow{$1}')
    .replace(/\\hat\s*\{([^{}]+)\}/g, '\\widehat{$1}')
    .replace(/\\hat\s+([a-zA-Z][a-zA-Z0-9']*)/g, '\\widehat{$1}')
    .replace(/([a-zA-Z0-9']+)̂/g, '\\widehat{$1}')
    .replace(/\\bar\s*\{([^{}]+)\}/g, '\\overline{$1}')
    .replace(/\\bar\s+([a-zA-Z][a-zA-Z0-9']*)/g, '\\overline{$1}')
    .replace(/([a-zA-Z0-9']+)̄/g, '\\overline{$1}');

  // Unicode superscripts (⁰¹²³...) and subscripts (₀₁₂₃...)
  out = out
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿⁱ]+/g, (m) => `^{${m.split('').map((c) => UNICODE_SUPER_MAP[c] || c).join('')}}`)
    .replace(/[₀₁₂₃₄₅₆₇₈₉₊₋ₙᵢⱼ]+/g, (m) => `_{${m.split('').map((c) => UNICODE_SUB_MAP[c] || c).join('')}}`);

  // Set difference backslash before braces (e.g. \mathbb{R} \ {1} or R \ {1})
  out = out
    .replace(/(\\mathbb\s*\{[A-Z]\}|ℝ|ℕ|ℤ|ℚ)\s*\\\s*(\\{[^}]*\\\}|\{[^}]*\})/g, '$1 \\setminus $2')
    .replace(/(?<![\\a-zA-Z])([RNZQ])\s*\\\s*(\\{[^}]*\\\}|\{[^}]*\})/g, '\\mathbb{$1} \\setminus $2')
    .replace(/\\setminus\s*(?<!\\)\{([^{}]+)(?<!\\)\}/g, '\\setminus \\{$1\\}');

  // Degree sign attached to numbers, letters, closing parens/braces, or ^\circ
  out = out
    .replace(/\^\s*\{\s*\\circ\s*\}|\^\\circ|\\degree\b/g, '^{\\circ}')
    .replace(/([0-9a-zA-Z)'}\]])\s*°/g, '$1^{\\circ}');

  // Unicode minus / primes
  out = out
    .replace(/−/g, '-')
    .replace(/″/g, "''")
    .replace(/′/g, "'");

  return out;
}

/**
 * Converts slash fractions inside math mode (e.g. (x+1)/(x-2), 3/4, -1/2, \pi/3, \sqrt{2}/2)
 * into clean \frac{...}{...} while preserving units (m/s, km/h) and \text{...}.
 */
function convertSlashFractionsInMath(math: string): string {
  if (!math || !math.includes('/')) return math;

  // 1. Convert parenthesized fractions: (num)/(den), (num)/den, num/(den)
  let out = math;
  for (let pass = 0; pass < 2; pass++) {
    let changed = false;
    out = out.replace(
      /(-?(?:\\?(?:arcsin|arccos|arctan|sin|cos|tan|cot|ln|log)\s*|[a-zA-Z][0-9']*)\([^()$]+\))\s*\/\s*(\([^()$]+\)|\\[a-zA-Z]+(?:\{[^{}]*\})?|[a-zA-Z0-9]+(?:\^[0-9{}]+|_[0-9{}]+)?)/g,
      (full, num, den) => {
        const dClean = den.startsWith('(') && den.endsWith(')') ? den.slice(1, -1).trim() : den.trim();
        const nTrim = num.trim();
        changed = true;
        if (nTrim.startsWith('-')) {
          return `-\\frac{${nTrim.slice(1)}}{${dClean}}`;
        }
        return `\\frac{${nTrim}}{${dClean}}`;
      }
    );
    out = out.replace(
      /(?<![a-zA-Z_])\(([^()$]+)\)\s*\/\s*\(([^()$]+)\)/g,
      (_, num, den) => {
        changed = true;
        return `\\frac{${num.trim()}}{${den.trim()}}`;
      }
    );
    out = out.replace(
      /(?<![a-zA-Z_])\(([^()$]+)\)\s*\/\s*(\\[a-zA-Z]+(?:\{[^{}]*\})?|[a-zA-Z0-9]+(?:\^[0-9{}]+|_[0-9{}]+)?)/g,
      (_, num, den) => {
        changed = true;
        return `\\frac{${num.trim()}}{${den.trim()}}`;
      }
    );
    out = out.replace(
      /(-?(?:\\sqrt(?:\[[0-9]+\])?\{[^{}]+\}|\\pi|\d*[a-zA-Z]?(?:\^[0-9{}]+|_[0-9{}]+)?))\s*\/\s*\(([^()$]+)\)/g,
      (full, num, den) => {
        const nTrim = num.trim();
        if (!nTrim || nTrim === '-') return full;
        changed = true;
        if (nTrim.startsWith('-')) {
          return `-\\frac{${nTrim.slice(1)}}{${den.trim()}}`;
        }
        return `\\frac{${nTrim}}{${den.trim()}}`;
      }
    );
    if (!changed) break;
  }

  // 2. Convert simple atomic fractions: 3/4, -1/2, 2x/3, \pi/3, \sqrt{2}/2, a\sqrt{3}/2
  const unitSkipRe = /^(?:km|m|cm|mm|dm|g|kg|mg|l|ml|mol|rad|bit|byte)\/(?:h|s|p|min|l|m|mol)$/i;
  out = out.replace(
    /(?<![a-zA-Z0-9_\\/])(-?(?:\d*(?:\\sqrt(?:\[[0-9]+\])?\{[^{}]+\}|\\pi)|\d+[a-zA-Z]|\d+|[a-zA-Z])(?:'|\^[0-9{}]+|_[0-9{}]+)?)\/(\d+[a-zA-Z]?|\d+|[a-zA-Z](?:\^[0-9{}]+|_[0-9{}]+)?)(?![a-zA-Z0-9_/])/g,
    (full, num, den) => {
      if (unitSkipRe.test(`${num}/${den}`)) return full;
      if (num.startsWith('-')) {
        return `-\\frac{${num.slice(1)}}{${den}}`;
      }
      return `\\frac{${num}}{${den}}`;
    }
  );

  return out;
}

const UNICODE_SYMBOL_REPLACEMENTS: Array<[RegExp, string]> = [
  [/ℝ/g, '\\mathbb{R}'],
  [/ℕ/g, '\\mathbb{N}'],
  [/ℤ/g, '\\mathbb{Z}'],
  [/ℚ/g, '\\mathbb{Q}'],
  [/ℂ/g, '\\mathbb{C}'],
  [/∈/g, '\\in '],
  [/∉/g, '\\notin '],
  [/⊂/g, '\\subset '],
  [/⊆/g, '\\subseteq '],
  [/⊄/g, '\\not\\subset '],
  [/⊃/g, '\\supset '],
  [/⊇/g, '\\supseteq '],
  [/∪/g, '\\cup '],
  [/∩/g, '\\cap '],
  [/∅/g, '\\emptyset'],
  [/∞/g, '\\infty'],
  [/±/g, '\\pm '],
  [/∓/g, '\\mp '],
  [/≤/g, '\\le '],
  [/≥/g, '\\ge '],
  [/≠/g, '\\neq '],
  [/≈/g, '\\approx '],
  [/≡/g, '\\equiv '],
  [/⇔/g, '\\Leftrightarrow '],
  [/⇒/g, '\\Rightarrow '],
  [/⇐/g, '\\Leftarrow '],
  [/→/g, '\\to '],
  [/←/g, '\\leftarrow '],
  [/↦/g, '\\mapsto '],
  [/∀/g, '\\forall '],
  [/∃/g, '\\exists '],
  [/⊥|⟂/g, '\\perp '],
  [/∥/g, '\\parallel '],
  [/∠/g, '\\angle '],
  [/△/g, '\\triangle '],
  [/×/g, '\\times '],
  [/÷/g, '\\div '],
  [/[·⋅]/g, '\\cdot '],
  [/…/g, '\\dots '],
  [/α/g, '\\alpha '],
  [/β/g, '\\beta '],
  [/γ/g, '\\gamma '],
  [/δ/g, '\\delta '],
  [/Δ/g, '\\Delta '],
  [/ε/g, '\\varepsilon '],
  [/ζ/g, '\\zeta '],
  [/η/g, '\\eta '],
  [/θ/g, '\\theta '],
  [/λ/g, '\\lambda '],
  [/μ/g, '\\mu '],
  [/π/g, '\\pi '],
  [/ρ/g, '\\rho '],
  [/σ/g, '\\sigma '],
  [/τ/g, '\\tau '],
  [/φ/g, '\\varphi '],
  [/Φ/g, '\\Phi '],
  [/ψ/g, '\\psi '],
  [/ω/g, '\\omega '],
  [/Ω/g, '\\Omega '],
];

/**
 * Full KaTeX-ready sanitization for expressions ALREADY inside math delimiters ($...$ or $$...$$).
 */
export function sanitizeMathExpression(raw: string): string {
  if (!raw) return '';
  // Recover JSON-corrupted control chars BEFORE .trim() so leading \f (\u000c), \t (\u0009), \r (\u000d) are not stripped
  let math = recoverCorruptedJsonLatexControlChars(raw, true).trim();
  math = collapseDoubleBackslashLatexCommands(math);

  // Protect \text{...} blocks from math-operator rewrites
  const heldText: string[] = [];
  const holdText = (m: string) => {
    const idx = heldText.length;
    heldText.push(m);
    return `__KTEXT_${idx}__`;
  };
  math = math.replace(/\\text\s*\{[^{}]*\}/g, holdText);

  // Normalize accents, vec(...), sqrt(...), frac(...), unicode scripts & set difference
  math = normalizeAccentsAndUnicodeScripts(math);
  math = formatUnitVectorsInMath(math);

  // Convert AsciiMath relational & infinity operators inside math mode
  math = math
    .replace(/<=>/g, '\\Leftrightarrow ')
    .replace(/=>/g, '\\Rightarrow ')
    .replace(/->/g, '\\to ')
    .replace(/<=/g, '\\le ')
    .replace(/>=/g, '\\ge ')
    .replace(/!=/g, '\\neq ')
    .replace(/\+-/g, '\\pm ')
    .replace(/(?<![a-zA-Z\\])([+-]?)\s*oo(?![a-zA-Z])/g, '$1\\infty');

  // Brace unbraced multi-char/signed exponents and subscripts (x^10 -> x^{10}, x^-2 -> x^{-2}, C_12^3 -> C_{12}^{3})
  math = math
    .replace(/\^([+-]\d+|\d{2,}|-[a-zA-Z])/g, '^{$1}')
    .replace(/_([a-zA-Z]\d+|\d{2,}|-[a-zA-Z0-9])/g, '_{$1}');

  // Convert slash fractions inside math into clean \frac{...}{...}
  math = convertSlashFractionsInMath(math);

  // Replace unicode symbols with LaTeX commands
  for (const [re, rep] of UNICODE_SYMBOL_REPLACEMENTS) {
    math = math.replace(re, rep);
  }

  // Normalize legacy Vietnamese trig/log shortcuts and ensure upright trig/log/lim commands
  math = math
    .replace(/\\mathbb\s+([A-Z])/g, '\\mathbb{$1}')
    .replace(/\\tg\b|(?<![a-zA-Z\\])tg(?![a-zA-Z])/g, '\\tan')
    .replace(/\\cotg\b|(?<![a-zA-Z\\])cotg(?![a-zA-Z])/g, '\\cot')
    .replace(/\\arctg\b|(?<![a-zA-Z\\])arctg(?![a-zA-Z])/g, '\\arctan')
    .replace(/\\varDelta\b/g, '\\Delta')
    .replace(/\\empty\b/g, '\\emptyset')
    .replace(/\\rightarrow/g, '\\to ')
    .replace(/\\leftrightarrow/g, '\\longleftrightarrow ')
    .replace(/\\ne(?![a-zA-Z])/g, '\\neq ')
    .replace(/(?<![a-zA-Z\\])(int|iint|sum|prod)(?=\s*[_^])/g, '\\$1')
    .replace(/(?<![a-zA-Z\\])(arcsin|arccos|arctan|sin|cos|tan|cot|ln|log|lg|lim)(?![a-zA-Z])/g, '\\$1');

  // Escape raw '%' inside math mode so KaTeX does not treat rest of expression as comment
  math = math.replace(/(?<!\\)%/g, '\\%');

  // Restore \text{...}
  math = math.replace(/__KTEXT_(\d+)__/g, (_, i) => heldText[Number(i)] || '');

  // Wrap any remaining bare Vietnamese words inside math mode in \text{...} so KaTeX renders cleanly
  const vietnameseWordRegex =
    /([a-zA-Z0-9]*[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]+[a-zA-Z0-9]*)/g;

  math = math.replace(/\\text\s*\{[^{}]*\}/g, holdText);
  math = math.replace(vietnameseWordRegex, (word) => `\\text{ ${word} }`);
  math = math.replace(/__KTEXT_(\d+)__/g, (_, i) => heldText[Number(i)] || '');

  return math;
}

const MATH_TOKEN_DETECT_RE =
  /\\(?:frac|dfrac|tfrac|sqrt|int|iint|sum|prod|lim|vec|overrightarrow|overleftarrow|overleftrightarrow|widehat|overline|alpha|beta|gamma|delta|Delta|epsilon|theta|lambda|mu|pi|sigma|varphi|phi|omega|Omega|infty|times|cdot|div|le|leq|ge|geq|ne|neq|approx|equiv|pm|mp|to|rightarrow|leftarrow|Leftrightarrow|Rightarrow|mathbb|setminus|cup|cap|subset|subseteq|emptyset|varnothing|forall|exists|perp|parallel|angle|triangle|circ|in|notin|sin|cos|tan|cot|ln|log)/;

const UNICODE_MATH_DETECT_RE =
  /[ℝℕℤℚℂ∈∉⊂⊆⊄⊃∪∩∅∞±∓≤≥≠≈≡⇔⇒⇐→←↦∀∃⊥⟂∥∠△√∛⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ₀₁₂₃₄₅₆₇₈₉αβγδεζηθλμπρστφΦψωΩ]/;

/**
 * Normalizes a plain-text segment OUTSIDE $...$ delimiters and automatically wraps
 * unwrapped mathematical expressions in $...$ so KaTeX renders them cleanly.
 */
export function normalizeAndWrapPlainMathSegment(plain: string): string {
  if (!plain) return plain;
  // Do not alter URLs
  if (/https?:\/\/\S+/i.test(plain)) return plain;

  let normalized = recoverCorruptedJsonLatexControlChars(plain, false);
  normalized = collapseDoubleBackslashLatexCommands(normalized);

  // Convert AsciiMath calls & unicode scripts/radicals/vectors first so they expose LaTeX tokens
  normalized = normalizeAccentsAndUnicodeScripts(normalized);

  // Convert bare AsciiMath calculus / relational tokens when clearly mathematical
  normalized = normalized
    .replace(/(?<![a-zA-Z_\\])(int|iint|sum|prod|lim)\s*(?=[_^])/g, '\\$1')
    .replace(/(?<![a-zA-Z\\])([+-]?)\s*oo(?![a-zA-Z])/g, '$1\\infty');

  // If pure numeric/algebraic fraction like "3/8", "-5/8", or "(x+1)/(x-2)" stands alone
  if (/^-?\d+\/\d+$/.test(normalized.trim())) {
    const trimmed = normalized.trim();
    return `$${trimmed.replace(/^(-?)(\d+)\/(\d+)$/, '$1\\frac{$2}{$3}')}$`;
  }

  const hasUnitVectorLinearCombo =
    /(?:^|[^a-zA-Z_\\])[+-]?\s*\d*\s*[ijk]\s*[+-]\s*\d*\s*[jk](?![a-zA-Z0-9_])/.test(normalized) ||
    /(?:^|[^a-zA-Z_\\])[+-]?\s*\d*\s*[ij]\s*[+-]\s*\d*\s*[ijk](?![a-zA-Z0-9_])/.test(normalized);

  const hasEquationInProse =
    /(?:^|[\s:(,;])(?:[a-zA-Z][0-9']*(?:\([a-zA-Z,;\s]+\))?|[0-9a-zA-Z+\-*/^_{}()\s]+[+\-*/][0-9a-zA-Z+\-*/^_{}()\s]+)\s*=\s*[-+]?[0-9a-zA-Z(\\]/.test(normalized);

  const hasMathContent =
    MATH_TOKEN_DETECT_RE.test(normalized) ||
    UNICODE_MATH_DETECT_RE.test(normalized) ||
    hasUnitVectorLinearCombo ||
    hasEquationInProse ||
    /\^[0-9{+-]|_[0-9{]/.test(normalized) ||
    /\([^()]+\)\s*\/\s*(?:\([^()]+\)|[0-9a-zA-Z]+)/.test(normalized) ||
    /(?:<=|>=|!=|<=>)/.test(normalized) ||
    /^(?:y|f\(x\)|g\(x\)|h\(x\)|y'|f'\(x\))\s*=\s*[^$.]+$/i.test(normalized.trim());

  if (!hasMathContent) {
    // Still check pure non-Vietnamese algebraic equation (e.g., "2x - y + 3z - 4 = 0") or coordinate tuple ("M(1; -2; 3)")
    const trimmed = normalized.trim();
    const isPureMathOption =
      !VIETNAMESE_CHAR_RE.test(trimmed) &&
      trimmed.length <= 120 &&
      !trimmed.includes('_') &&
      (
        (/^[a-zA-Z0-9\s()\[\]{}.,;+\-*/=<>']+$/.test(trimmed) && /[=<>]/.test(trimmed) && /[0-9a-zA-Z]/.test(trimmed)) ||
        /^[A-Z]?\s*\(\s*[-+]?\d+(?:[.,]\d+)?(?:\s*;\s*[-+]?\d+(?:[.,]\d+)?){1,3}\s*\)$/.test(trimmed)
      );
    if (isPureMathOption) {
      return `$${sanitizeMathExpression(trimmed)}$`;
    }
    return normalized;
  }

  // Case 1: Pure math text (no Vietnamese prose words at all)
  if (!VIETNAMESE_CHAR_RE.test(normalized) && !/\b(?:Cho|Tim|Khi|Voi|Bang|Trong|Tren|Khoang|Doan|Ham|So|Phuong|Trinh|He|Bat|Gia|Tri|Lon|Nhat|Nho|Nhat)\b/.test(normalized)) {
    const trailingMatch = normalized.match(/^([\s\S]*?)([.,;!?]+)?$/);
    const body = trailingMatch?.[1]?.trim() || normalized.trim();
    const punct = trailingMatch?.[2] || '';
    if (body) {
      return `$${sanitizeMathExpression(body)}$${punct}`;
    }
  }

  // Case 2: Mixed Vietnamese prose + math expressions
  // Convert unicode symbols ONLY inside candidate math segments during extraction,
  // or first convert symbols that are unambiguously mathematical (ℝ, ∈, ∞, ≤, ≥, ≠, ⊥, ∥, ∠, ∪, ∩, ∅, ∀, ∃, ±)
  for (const [re, rep] of UNICODE_SYMBOL_REPLACEMENTS) {
    normalized = normalized.replace(re, rep);
  }

  const braceArg = '(?:\\{[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\})';
  const escapedSetBrace = '(?:\\\\\\{[^{}]*\\\\\\})';
  const parenTuple = '(?:\\([^()$]+\\))';
  const bracketTuple = '(?:\\[[^\\[\\]$]+\\])';
  const trigOrFnCall = `(?:(?:arcsin|arccos|arctan|sin|cos|tan|cot|tg|cotg|arctg|ln|log|lg)(?:\\s*${parenTuple}|\\s+[a-zA-Z0-9']+)|[a-zA-Z][0-9']*${parenTuple}(?:\\s*[\\^_]\\s*(?:${braceArg}|[a-zA-Z0-9'+-]+))*)`;
  const mathTerm =
    `(?:(?:[+-]\\s*)?\\\\[a-zA-Z]+(?:\\s*\\[[^\\[\\]]+\\])?(?:\\s*${braceArg})*(?:\\s*[\\^_]\\s*(?:${braceArg}|[a-zA-Z0-9'+-]+))*` +
    `|(?:[+-]?\\s*)?(?:${trigOrFnCall}|${escapedSetBrace}|${braceArg}|${parenTuple}|${bracketTuple}|\\d+(?:[.,]\\d+)?(?:'|[a-zA-Z](?:[0-9']*))?(?:\\s*[\\^_]\\s*(?:${braceArg}|[a-zA-Z0-9'+-]+))*|[A-Z][a-zA-Z0-9']*(?:\\s*[\\^_]\\s*(?:${braceArg}|[a-zA-Z0-9'+-]+))*|[a-zA-Z](?:[0-9']+)?(?:\\s*[\\^_]\\s*(?:${braceArg}|[a-zA-Z0-9'+-]+))*))`;
  const mathOp =
    `(?:\\s*(?:[+\\-*/=<>≤≥≠]|<=|>=|!=|<=>|=>|->|\\\\(?:cdot|times|div|le|leq|ge|geq|ne|neq|approx|equiv|pm|mp|in|notin|cup|cap|subset|subseteq|supset|setminus|to|rightarrow|leftarrow|Rightarrow|Leftrightarrow|perp|parallel)(?![a-zA-Z]))\\s*)`;
  const exprRegex = new RegExp(`${mathTerm}(?:${mathOp}${mathTerm})*(?:\\s*d[xyz])?`, 'g');

  normalized = normalized.replace(exprRegex, (match) => {
    const trimmed = match.trim();
    if (!trimmed) return match;

    const isUnitCombo =
      /(?:^|[^a-zA-Z_\\])[+-]?\s*\d*\s*[ijk]\s*[+-]\s*\d*\s*[jk](?![a-zA-Z0-9_])/.test(trimmed) ||
      /(?:^|[^a-zA-Z_\\])[+-]?\s*\d*\s*[ij]\s*[+-]\s*\d*\s*[ijk](?![a-zA-Z0-9_])/.test(trimmed);

    const hasSlashExpr = /(?:[a-zA-Z][0-9']*|\([^()]+\))\s*\/\s*(?:\([^()]+\)|[a-zA-Z0-9]+)/.test(trimmed);
    const hasEquation = /[=<>]/.test(trimmed) && (/[0-9^_\\()]/.test(trimmed) || /^[a-zA-Z][0-9']*(\([a-zA-Z]\))?\s*[=<>]/.test(trimmed));
    const hasIntervalWithInfOrCmd = /^[\[(].*(?:\\infty|\\pi|\\frac|\\sqrt|;).*[)\]]$/.test(trimmed);
    const hasMathCmd = MATH_TOKEN_DETECT_RE.test(trimmed);
    const hasScript = /\^[0-9{+-]|_[0-9{]/.test(trimmed);

    if (hasMathCmd || isUnitCombo || hasScript || hasSlashExpr || hasEquation || hasIntervalWithInfOrCmd) {
      const leadingSpace = /^\s/.test(match) ? ' ' : '';
      const trailingSpace = /\s$/.test(match) ? ' ' : '';
      return `${leadingSpace}$${sanitizeMathExpression(trimmed)}$${trailingSpace}`;
    }
    return match;
  });

  return normalized;
}

/**
 * Full text-level math normalizer for storage (Gemini outputs, question bank, server & client).
 * Standardizes vectors, fractions, radicals, integrals, limits, powers, subscripts, sets, and wraps bare formulas in $...$.
 */
export function normalizeAllMathInText(text: string): string {
  if (!text || typeof text !== 'string') return text || '';

  let prepared = text
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

  // Wrap bare \begin{cases|array|matrix|...} blocks
  prepared = prepared.replace(
    /(?<!\$|\\begin\{)(\\begin\{(?:array|matrix|pmatrix|bmatrix|vmatrix|cases|aligned)\}[\s\S]*?\\end\{(?:array|matrix|pmatrix|bmatrix|vmatrix|cases|aligned)\})(?!\$)/gi,
    '$$$$$1$$$$'
  );

  const segments = splitMathDelimiters(prepared);
  return segments
    .map((seg) => {
      if (seg.type === 'display') {
        return `$$${sanitizeMathExpression(seg.inner)}$$`;
      }
      if (seg.type === 'math') {
        return `$${sanitizeMathExpression(seg.inner)}$`;
      }
      return normalizeAndWrapPlainMathSegment(seg.value);
    })
    .join('');
}
