/**
 * High-performance, safe mathematical expression evaluator and MathType-style parser for Math & Physics graphs.
 * Supports natural mathematical notation (implicit multiplication without needing '*'):
 *  - y = 2x^3 - 3x + 1 or y = 2x³ - 3x + 1
 *  - y = (2x + 1)/(x - 1)
 *  - x = 4cos(2πt) or x = 4cos(2*pi*t) or 4cos(2πt - π/3)
 *  - y = 2sin(2x)
 *  - y = 0.5x^4 - 2x^2 + 1
 *  - y = sqrt(4 - x^2) or y = √(4 - x²)
 *  - x = 4e^(-0.2t)cos(2πt)
 *  - (x+1)(x-2), 2(x-1), x cos(x)
 */

export interface ParsedFunctionResult {
  fn: (val: number) => number;
  variableName: 'x' | 't';
  expression: string;
  originalInput: string;
  displayFormula: string;
  latex: string;
  sampleTest?: { at0: number | null; at1: number | null };
  error?: string;
}

/**
 * Converts unicode superscripts (², ³, ⁴, ⁻, etc.) to standard power syntax (^2, ^3, etc.)
 */
export function normalizeSuperscripts(str: string): string {
  const map: Record<string, string> = {
    '⁰': '^0',
    '¹': '^1',
    '²': '^2',
    '³': '^3',
    '⁴': '^4',
    '⁵': '^5',
    '⁶': '^6',
    '⁷': '^7',
    '⁸': '^8',
    '⁹': '^9',
    '⁻': '^-',
    '⁺': '^+',
  };
  return str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]/g, (char) => map[char] || char);
}

/**
 * Formats math formula to LaTeX for professional MathType / KaTeX preview
 */
export function formatEquationToLatex(raw: string, variable: 'x' | 't', prefix?: string): string {
  let s = raw.trim();
  const prefixMatch = s.match(/^([yufxvas]\s*(?:\([^)]*\))?)\s*=\s*/i);
  if (prefixMatch) {
    s = s.substring(prefixMatch[0].length).trim();
  }

  const lhs = prefix || (variable === 't' ? 'x(t)' : 'y');

  // Normalize superscripts and symbols
  s = normalizeSuperscripts(s);
  s = s.replace(/π/g, '\\pi ').replace(/\bpi\b/gi, '\\pi ');

  // Clean explicit multiplication stars between numbers and variables/functions
  s = s.replace(/(\d)\s*\*\s*([a-zA-Z\\pi\(])/g, '$1 $2');
  s = s.replace(/([a-zA-Z\\pi\)])\s*\*\s*([a-zA-Z\\pi\(])/g, '$1 $2');
  s = s.replace(/\s*\*\s*/g, ' \\cdot ');

  // Convert fractions (A)/(B) -> \frac{A}{B}
  s = s.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, '\\frac{$1}{$2}');
  s = s.replace(/\(([^()]+)\)\s*\/\s*([0-9a-zA-Z\\pi]+)/g, '\\frac{$1}{$2}');
  s = s.replace(/([0-9a-zA-Z\\pi]+)\s*\/\s*\(([^()]+)\)/g, '\\frac{$1}{$2}');
  s = s.replace(/([0-9a-zA-Z\\pi]+)\s*\/\s*([0-9a-zA-Z\\pi]+)/g, '\\frac{$1}{$2}');

  // Convert sqrt
  s = s.replace(/sqrt\s*\(([^()]+)\)/g, '\\sqrt{$1}');
  s = s.replace(/√\s*\(([^()]+)\)/g, '\\sqrt{$1}');
  s = s.replace(/√([0-9a-zA-Z\\pi]+)/g, '\\sqrt{$1}');

  // Convert exp
  s = s.replace(/exp\s*\(([^()]+)\)/g, 'e^{$1}');
  s = s.replace(/e\^\(([^()]+)\)/g, 'e^{$1}');

  // Convert functions to LaTeX
  s = s.replace(/(^|[^a-zA-Z\\])(sin|cos|tan|cot|ln|log|abs)(?![a-zA-Z])/g, '$1\\$2');

  // Convert powers x^3 -> x^{3}
  s = s.replace(/\^([0-9a-zA-Z\\pi\-\.]+)/g, '^{$1}');

  return `${lhs} = ${s}`;
}

/**
 * Normalizes input equation: strips "y =", "f(x) =", "x(t) =", formats natural MathType multiplication,
 * converts pi/π, unicode math symbols, powers, fractions, and square roots.
 */
export function sanitizeMathExpression(raw: string): {
  expr: string;
  variable: 'x' | 't';
  displayFormula: string;
  latex: string;
} {
  let clean = raw.trim();

  // Strip or detect prefixes: y =, f(x) =, x(t) =, x =, v(t) =, a(t) =, etc.
  let prefix = '';
  const prefixMatch = clean.match(/^([yufxvas]\s*(?:\([^)]*\))?)\s*=\s*/i);
  if (prefixMatch) {
    prefix = prefixMatch[1].trim();
    clean = clean.substring(prefixMatch[0].length).trim();
  }

  // Determine variable: default to 'x', detect 't' if used in physics/time equations
  let variable: 'x' | 't' = 'x';
  const hasT = /\b[t]\b/i.test(clean) || /[0-9\(\*\+\-\/][t][0-9\)\*\+\-\/\s]|^[t]\b|\b[t]$/i.test(clean);
  const hasX = /\b[x]\b/i.test(clean) || /[0-9\(\*\+\-\/][x][0-9\)\*\+\-\/\s]|^[x]\b|\b[x]$/i.test(clean);
  
  if (/^[xva]/i.test(prefix) && hasT) {
    variable = 't';
  } else if (hasT && !hasX) {
    variable = 't';
  }

  // Vietnamese / comma decimal notation (e.g., 0,5 -> 0.5)
  clean = clean.replace(/(\d),(\d)/g, '$1.$2');

  // Convert unicode superscripts (e.g. 2x² -> 2x^2)
  clean = normalizeSuperscripts(clean);

  // Math symbols normalization
  clean = clean.replace(/[×·•]/g, '*');
  clean = clean.replace(/[÷:]/g, '/');
  clean = clean.replace(/√\s*\(([^)]+)\)/g, 'sqrt($1)');
  clean = clean.replace(/√([0-9a-zA-Z_]+)/g, 'sqrt($1)');
  clean = clean.replace(/\|([^|]+)\|/g, 'abs($1)');
  clean = clean.replace(/\bln\s*\(/gi, 'log(');
  clean = clean.replace(/\btg\s*\(/gi, 'tan(');
  clean = clean.replace(/\bcotg\s*\(/gi, 'cot(');
  clean = clean.replace(/e\^\(([^)]+)\)/g, 'exp($1)');
  clean = clean.replace(/e\^([0-9a-zA-Z_\.\-]+)/g, 'exp($1)');

  // Standardize pi / π representation using intermediate token __PI__
  clean = clean.replace(/π/g, '__PI__');
  clean = clean.replace(/\bpi\b/gi, '__PI__');

  // MathType Natural Implicit Multiplication
  // (allows typing 4cos(2πt), 2x^3 - 3x + 1, 2(x-1), (x+1)(x-2), x cos(x) without any '*')
  const funcs = 'sin|cos|tan|cot|asin|acos|atan|sqrt|cbrt|abs|exp|log|log10|log2';
  const vars = 'xt'; // variables

  // 1. Number before variable, __PI__, function, or open paren: 2x -> 2*x, 4cos -> 4*cos, 2__PI__ -> 2*__PI__, 3( -> 3*(
  clean = clean.replace(
    new RegExp(`(\\d)\\s*(?:(?<![a-zA-Z])([${vars}])(?![a-zA-Z])|(__PI__)|(\\()|(${funcs}))`, 'g'),
    (m, p1, p2, p3, p4, p5) => `${p1}*${p2 || p3 || p4 || p5}`
  );

  // 2. __PI__ before variable, number, function, or open paren: __PI__t -> __PI__*t, __PI__( -> __PI__*(
  clean = clean.replace(
    new RegExp(`(__PI__)\\s*(?:(?<![a-zA-Z])([${vars}])(?![a-zA-Z])|([0-9\\(])|(${funcs}))`, 'g'),
    (m, p1, p2, p3, p4) => `${p1}*${p2 || p3 || p4}`
  );

  // 3. Variable before __PI__, function, or open paren: x cos(x) -> x*cos(x), x(x+1) -> x*(x+1)
  clean = clean.replace(
    new RegExp(`(?<![a-zA-Z])([${vars}])\\s*(?:(__PI__)|(\\()|(${funcs}))`, 'g'),
    (m, p1, p2, p3, p4) => `${p1}*${p2 || p3 || p4}`
  );

  // 4. Closed paren before variable, __PI__, number, function, or open paren: )( -> )*(, )x -> )*x, )cos -> )*cos
  clean = clean.replace(
    new RegExp(`(\\))\\s*(?:(?<![a-zA-Z])([${vars}])(?![a-zA-Z])|([0-9\\(]|__PI__)|(${funcs}))`, 'g'),
    (m, p1, p2, p3, p4) => `${p1}*${p2 || p3 || p4}`
  );

  // 5. Space between variables: x t -> x*t
  clean = clean.replace(new RegExp(`(?<![a-zA-Z])([${vars}])\\s+([${vars}])(?![a-zA-Z])`, 'g'), '$1*$2');

  // Generate clean display formula (e.g. "x(t) = 4cos(2πt)" or "y = 2x³ - 3x + 1")
  const displayPrefix = prefix || (variable === 't' ? 'x(t)' : 'y');
  let prettyBody = raw.trim();
  if (prefixMatch) {
    prettyBody = prettyBody.substring(prefixMatch[0].length).trim();
  }
  // Beautify for blackboard display:
  prettyBody = prettyBody
    .replace(/\bpi\b/gi, 'π')
    .replace(/(\d)\s*\*\s*([a-zA-Zπ\(])/g, '$1$2')
    .replace(/([a-zA-Zπ\)])\s*\*\s*([a-zA-Zπ\(])/g, '$1$2')
    .replace(/\s*\*\s*/g, '·')
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .replace(/\^4/g, '⁴');
  const displayFormula = `${displayPrefix} = ${prettyBody}`;

  // Generate LaTeX for MathType / KaTeX rendering
  const latex = formatEquationToLatex(raw, variable, prefix);

  // Replace __PI__ with Math.PI for JS evaluation
  const codeExpr = clean.replace(/__PI__/g, 'Math.PI');

  return { expr: codeExpr, variable, displayFormula, latex };
}

/**
 * Compiles a mathematical expression into a fast native JavaScript numerical evaluator function
 * with comprehensive error handling and live sample testing.
 */
export function compileMathExpression(rawInput: string): ParsedFunctionResult {
  const { expr, variable, displayFormula, latex } = sanitizeMathExpression(rawInput);

  if (!expr.trim()) {
    return {
      fn: () => 0,
      variableName: variable,
      expression: '0',
      originalInput: rawInput,
      displayFormula: variable === 't' ? 'x(t) = 0' : 'y = 0',
      latex: `${variable === 't' ? 'x(t)' : 'y'} = 0`,
      error: 'Biểu thức trống',
    };
  }

  // Tokenize and transform mathematical operators to JS Math functions
  let jsCode = expr;

  // Power operator ^ -> Math.pow(base, exp)
  // Safely handles nested powers like x^3, (x+1)^3, 10^-2, e^(-0.2*t)
  let prevCode = '';
  while (jsCode.includes('^') && jsCode !== prevCode) {
    prevCode = jsCode;
    jsCode = jsCode.replace(
      /([a-zA-Z0-9_\.]+|\([^\(\)]+\))\s*\^\s*([+-]?[a-zA-Z0-9_\.]+|\([^\(\)]+\))/,
      'Math.pow($1, $2)'
    );
  }

  // Math constants & functions replacements
  const replacements: Array<[RegExp, string]> = [
    [/\bMath\.PI\b/g, 'Math.PI'],
    [/\be\b/gi, 'Math.E'],
    [/\bsin\s*\(/gi, 'Math.sin('],
    [/\bcos\s*\(/gi, 'Math.cos('],
    [/\btan\s*\(/gi, 'Math.tan('],
    [/\bcot\s*\(([^\)]+)\)/gi, '(1/Math.tan($1))'],
    [/\basin\s*\(/gi, 'Math.asin('],
    [/\bacos\s*\(/gi, 'Math.acos('],
    [/\batan\s*\(/gi, 'Math.atan('],
    [/\bsqrt\s*\(/gi, 'Math.sqrt('],
    [/\bcbrt\s*\(/gi, 'Math.cbrt('],
    [/\babs\s*\(/gi, 'Math.abs('],
    [/\bexp\s*\(/gi, 'Math.exp('],
    [/\blog\s*\(/gi, 'Math.log('],
    [/\blog10\s*\(/gi, 'Math.log10('],
    [/\blog2\s*\(/gi, 'Math.log2('],
  ];

  for (const [re, rep] of replacements) {
    jsCode = jsCode.replace(re, rep);
  }

  // Security check: Only allow safe characters (letters, numbers, operators, parens, Math methods)
  const disallowed = jsCode
    .replace(/\bMath\.(PI|E|sin|cos|tan|asin|acos|atan|sqrt|cbrt|abs|exp|log|log10|log2|pow)\b/g, '')
    .replace(/[0-9\.\+\-\*\/\(\)\s,xXtT]/g, '');

  if (disallowed.trim().length > 0) {
    return {
      fn: () => NaN,
      variableName: variable,
      expression: jsCode,
      originalInput: rawInput,
      displayFormula,
      latex,
      error: `Ký tự không hợp lệ: "${disallowed.trim()}"`,
    };
  }

  try {
    // Construct evaluator function safely with parameter 'x' or 't'
    const evalFn = new Function(variable, `"use strict"; try { return Number(${jsCode}); } catch(e) { return NaN; }`);

    // Test evaluation at sample values 0 and 1
    const valAt0 = evalFn(0);
    const valAt1 = evalFn(1);

    if (typeof valAt0 !== 'number' && typeof valAt1 !== 'number') {
      throw new Error('Biểu thức không trả về giá trị số hợp lệ.');
    }

    return {
      fn: (val: number) => {
        try {
          const res = evalFn(val);
          return typeof res === 'number' && !isNaN(res) && isFinite(res) ? res : NaN;
        } catch {
          return NaN;
        }
      },
      variableName: variable,
      expression: jsCode,
      originalInput: rawInput,
      displayFormula,
      latex,
      sampleTest: {
        at0: typeof valAt0 === 'number' && !isNaN(valAt0) && isFinite(valAt0) ? Number(valAt0.toFixed(3)) : null,
        at1: typeof valAt1 === 'number' && !isNaN(valAt1) && isFinite(valAt1) ? Number(valAt1.toFixed(3)) : null,
      },
    };
  } catch (err: any) {
    return {
      fn: () => NaN,
      variableName: variable,
      expression: jsCode,
      originalInput: rawInput,
      displayFormula,
      latex,
      error: `Lỗi công thức: ${err.message || 'Không thể tính toán'}`,
    };
  }
}
