/**
 * SgkGraphMath — Bộ phân tích biểu thức hàm số & sinh dữ liệu đồ thị chuẩn SGK Toán Việt Nam (GDPT 2018).
 * Dùng chung cho cả SVG trên màn hình (StandardTextbookGraph) và xuất file Word PNG (docxDiagramRenderer).
 */

export type SgkGraphType =
  | 'rational'
  | 'rational_21'
  | 'cubic'
  | 'biquadratic'
  | 'quadratic'
  | 'linear'
  | 'sine'
  | 'exp'
  | 'log';

export interface SgkPoint {
  x: number;
  y: number;
  label?: string;
  showProjections?: boolean;
  isCenter?: boolean;
  isIntercept?: boolean;
  isExtremum?: boolean;
}

export interface SgkAsymptote {
  kind: 'vertical' | 'horizontal' | 'oblique';
  x?: number;
  y?: number;
  m?: number; // y = m*x + q for oblique
  q?: number;
  label: string;
}

export interface SgkGraphAnalysis {
  type: SgkGraphType;
  formulaLatex: string;
  title: string;
  branches: Array<Array<{ x: number; y: number }>>;
  asymptotes: SgkAsymptote[];
  keyPoints: SgkPoint[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  xTicks: Array<{ val: number; label: string }>;
  yTicks: Array<{ val: number; label: string }>;
}

/**
 * Format số thành nhãn chuẩn SGK Việt Nam (ví dụ 0.5 -> "1/2" hoặc "-3/2", số nguyên giữ nguyên)
 */
export function formatSgkTickNumber(val: number): string {
  if (Math.abs(val) < 1e-6) return '0';
  const rounded = Math.round(val);
  if (Math.abs(val - rounded) < 0.025) return String(rounded);

  // Check simple small denominators 2, 3, 4
  for (const den of [2, 3, 4]) {
    const num = Math.round(val * den);
    if (Math.abs(val - num / den) < 0.025) {
      if (num % den === 0) return String(num / den);
      return `${num}/${den}`;
    }
  }
  const oneDec = Number(val.toFixed(1));
  return String(oneDec).replace('.', ',');
}

function normalizeFormulaString(raw: string): string {
  let s = (raw || '').replace(/\$/g, '').trim();
  // Remove leading "y =" or "f(x) ="
  s = s.replace(/^(?:y|f\s*\(\s*x\s*\)|g\s*\(\s*x\s*\))\s*=\s*/i, '');
  // Strip trailing Vietnamese words if raw came from question prose
  s = s.split(/\s+(?:có|trên|với|như|khi|tại|để|biết|và|là|trong)\b/i)[0].trim();
  // Normalize common LaTeX whitespace & wrappers
  s = s
    .replace(/\\displaystyle/g, '')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\cdot/g, '*')
    .replace(/\\times/g, '*')
    .replace(/\\,/g, '')
    .replace(/−/g, '-')
    .replace(/–/g, '-')
    .replace(/\s+/g, '')
    .trim();
  // Normalize \dfrac, \tfrac to \frac
  s = s.replace(/\\(?:d|t|c)?frac/g, '\\frac');
  // Strip condition suffix like (x \ne 1) or , ad-bc>0 or ; ...
  s = s.split(/\\?[;,]|\\quad|\(x\\?ne|\(ad/i)[0].trim();
  return s;
}

function sampleBranchClipped(
  f: (x: number) => number,
  xFrom: number,
  xTo: number,
  steps: number,
  minY: number,
  maxY: number
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  if (xTo <= xFrom || steps < 4) return pts;
  const dx = (xTo - xFrom) / steps;
  let prevX: number | null = null;
  let prevY: number | null = null;
  let prevIn = false;

  const clipVal = (y: number) => Math.max(minY, Math.min(maxY, y));

  for (let i = 0; i <= steps; i++) {
    const x = xFrom + i * dx;
    const y = f(x);
    if (!isFinite(y) || Math.abs(y) > 1e5) {
      prevX = null;
      prevY = null;
      prevIn = false;
      continue;
    }
    const isIn = y >= minY && y <= maxY;
    if (isIn) {
      if (!prevIn && prevX !== null && prevY !== null && Math.abs(y - prevY) > 1e-6) {
        const edgeY = prevY < minY ? minY : maxY;
        const t = (edgeY - prevY) / (y - prevY);
        if (t >= 0 && t <= 1) {
          pts.push({ x: prevX + t * (x - prevX), y: edgeY });
        }
      }
      pts.push({ x, y });
    } else if (prevIn && prevX !== null && prevY !== null && Math.abs(y - prevY) > 1e-6) {
      const edgeY = y < minY ? minY : maxY;
      const t = (edgeY - prevY) / (y - prevY);
      if (t >= 0 && t <= 1) {
        pts.push({ x: prevX + t * (x - prevX), y: clipVal(edgeY) });
      }
    }
    prevX = x;
    prevY = y;
    prevIn = isIn;
  }
  return pts;
}

/**
 * Parse a simple linear polynomial string in x: e.g. "2x-1", "-x+3", "3x", "4", "1-2x" -> { a, b } for a*x + b
 */
function parseLinearExpr(expr: string): { a: number; b: number; valid: boolean } {
  const s = expr.replace(/[{}()]/g, '').replace(/^\+/, '');
  if (!s || /[a-wyz]/i.test(s.replace(/x/gi, ''))) {
    // Symbolic parameters like ax+b
    return { a: 0, b: 0, valid: false };
  }
  // Normalize x^1 -> x
  const cleaned = s.replace(/x\^1(?![0-9])/gi, 'x');
  // Split into additive terms using + or -
  const terms = cleaned.match(/[+-]?[^+-]+/g);
  if (!terms) return { a: 0, b: 0, valid: false };

  let a = 0;
  let b = 0;
  for (const term of terms) {
    if (/x$/i.test(term)) {
      const coeffStr = term.slice(0, -1).replace(/\*$/, '');
      if (coeffStr === '' || coeffStr === '+') a += 1;
      else if (coeffStr === '-') a -= 1;
      else {
        const val = parseNumberOrFraction(coeffStr);
        if (isNaN(val)) return { a: 0, b: 0, valid: false };
        a += val;
      }
    } else if (!/x/i.test(term)) {
      const val = parseNumberOrFraction(term);
      if (isNaN(val)) return { a: 0, b: 0, valid: false };
      b += val;
    } else {
      return { a: 0, b: 0, valid: false };
    }
  }
  return { a, b, valid: true };
}

function parseNumberOrFraction(raw: string): number {
  const s = raw.replace(/\s+/g, '').replace(/^\+/, '');
  if (!s) return NaN;
  const latexFrac = s.match(/^(-?)\\frac\{([^}]+)\}\{([^}]+)\}$/);
  if (latexFrac) {
    const sign = latexFrac[1] === '-' ? -1 : 1;
    const n = parseFloat(latexFrac[2]);
    const d = parseFloat(latexFrac[3]);
    return d !== 0 && !isNaN(n) && !isNaN(d) ? (sign * n) / d : NaN;
  }
  const slashFrac = s.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (slashFrac) {
    const n = parseFloat(slashFrac[1]);
    const d = parseFloat(slashFrac[2]);
    return d !== 0 && !isNaN(n) && !isNaN(d) ? n / d : NaN;
  }
  return Number(s);
}

/**
 * Parse a polynomial of degree <= 4 in x: a4*x^4 + a3*x^3 + a2*x^2 + a1*x + a0
 */
function parsePolynomial(expr: string): { c: [number, number, number, number, number]; valid: boolean; maxDeg: number } {
  const zero: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let s = expr.replace(/^\+/, '');
  // Convert \frac{p}{q}x^k or \frac{p}{q} into decimal coeff tokens temporarily using marker
  s = s.replace(/\\frac\{(-?\d+(?:\.\d+)?)\}\{(-?\d+(?:\.\d+)?)\}/g, (_, n, d) => {
    const val = parseFloat(n) / parseFloat(d);
    return isFinite(val) ? String(val) : '0';
  });
  s = s.replace(/x\^\{(\d)\}/g, 'x^$1');
  if (!s || /[a-wyz\\]/i.test(s.replace(/x/gi, ''))) {
    return { c: zero, valid: false, maxDeg: 0 };
  }

  const terms = s.match(/[+-]?[^+-]+/g);
  if (!terms) return { c: zero, valid: false, maxDeg: 0 };

  const c: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let maxDeg = 0;

  for (const rawTerm of terms) {
    const m = rawTerm.match(/^([+-]?(?:\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?)?)?\*?x(?:\^([1-4]))?$/i);
    if (m) {
      const coeffRaw = (m[1] || '').trim();
      const deg = m[2] ? parseInt(m[2], 10) : 1;
      let coeff = 1;
      if (coeffRaw === '' || coeffRaw === '+') coeff = 1;
      else if (coeffRaw === '-') coeff = -1;
      else coeff = parseNumberOrFraction(coeffRaw);
      if (isNaN(coeff)) return { c: zero, valid: false, maxDeg: 0 };
      c[deg] += coeff;
      if (deg > maxDeg) maxDeg = deg;
    } else if (!/x/i.test(rawTerm)) {
      const val = parseNumberOrFraction(rawTerm);
      if (isNaN(val)) return { c: zero, valid: false, maxDeg: 0 };
      c[0] += val;
    } else {
      return { c: zero, valid: false, maxDeg: 0 };
    }
  }
  return { c, valid: true, maxDeg };
}

/**
 * Extract balanced \frac{num}{den} or plain (num)/(den) / num/den
 */
function extractRationalParts(expr: string): { numStr: string; denStr: string } | null {
  // Handle \frac{...}{...}
  if (expr.startsWith('\\frac{') || expr.startsWith('-\\frac{')) {
    const neg = expr.startsWith('-');
    let idx = neg ? 7 : 6; // after '{'
    let depth = 1;
    const numStart = idx;
    while (idx < expr.length && depth > 0) {
      if (expr[idx] === '{') depth++;
      else if (expr[idx] === '}') depth--;
      idx++;
    }
    if (depth === 0 && expr[idx] === '{') {
      const numRaw = expr.slice(numStart, idx - 1);
      idx++;
      const denStart = idx;
      depth = 1;
      while (idx < expr.length && depth > 0) {
        if (expr[idx] === '{') depth++;
        else if (expr[idx] === '}') depth--;
        idx++;
      }
      if (depth === 0 && idx === expr.length) {
        const denRaw = expr.slice(denStart, idx - 1);
        return { numStr: neg ? `-(${numRaw})` : numRaw, denStr: denRaw };
      }
    }
  }

  // Handle plain slash num/den like (2x-1)/(3x+2) or 2x-1/3x+2
  const slashIdx = expr.indexOf('/');
  if (slashIdx > 0 && slashIdx < expr.length - 1 && !expr.includes('\\frac')) {
    const left = expr.slice(0, slashIdx).replace(/^\((.+)\)$/, '$1');
    const right = expr.slice(slashIdx + 1).replace(/^\((.+)\)$/, '$1');
    if (right.includes('x')) {
      return { numStr: left, denStr: right };
    }
  }
  return null;
}

function addTickUnique(list: Array<{ val: number; label: string }>, val: number, customLabel?: string) {
  if (!isFinite(val) || Math.abs(val) < 0.05) return;
  if (list.some((t) => Math.abs(t.val - val) < 0.22)) return;
  list.push({ val, label: customLabel || formatSgkTickNumber(val) });
}

/**
 * Phân tích biểu thức & sinh dữ liệu đồ thị chuẩn SGK Toán GDPT 2018
 */
export function analyzeAndSampleSgkGraph(options: {
  latex?: string;
  questionText?: string;
  graphType?: string;
  title?: string;
  coefficients?: { a?: number; b?: number; c?: number; d?: number; e?: number };
  asymptoteX?: number;
  asymptoteY?: number;
}): SgkGraphAnalysis {
  const rawLatex = (options.latex || '').replace(/\$/g, '').trim();
  const qLower = (options.questionText || '').toLowerCase();
  const normalized = normalizeFormulaString(rawLatex);

  // Determine graph type from formula first, then hints
  let detectedType: SgkGraphType = 'cubic';
  const rationalParts = extractRationalParts(normalized);

  if (rationalParts) {
    detectedType = /x\^2|x\^\{2\}/.test(rationalParts.numStr) ? 'rational_21' : 'rational';
  } else if (options.graphType === 'rational_21') {
    detectedType = 'rational_21';
  } else if (options.graphType === 'rational' || /\\frac/.test(normalized) || /(?:ax\+b|cx\+d)/i.test(normalized)) {
    detectedType = 'rational';
  } else if (/\\?(?:sin|cos|tan)/i.test(normalized) || options.graphType === 'sine') {
    detectedType = 'sine';
  } else if (/\\?(?:ln|log)/i.test(normalized) || options.graphType === 'log') {
    detectedType = 'log';
  } else if (/\^x|\^\{x\}|e\^/i.test(normalized) || options.graphType === 'exp') {
    detectedType = 'exp';
  } else if (/x\^4|x\^\{4\}/.test(normalized) || options.graphType === 'biquadratic') {
    detectedType = 'biquadratic';
  } else if (/x\^3|x\^\{3\}/.test(normalized) || options.graphType === 'cubic') {
    detectedType = 'cubic';
  } else if (/x\^2|x\^\{2\}/.test(normalized) || options.graphType === 'quadratic') {
    detectedType = 'quadratic';
  } else if (/x/i.test(normalized) && !/\^/.test(normalized)) {
    detectedType = 'linear';
  } else if (options.graphType === 'linear') {
    detectedType = 'linear';
  } else if (qLower.includes('tiệm cận') || qLower.includes('phân thức')) {
    detectedType = 'rational';
  } else if (qLower.includes('trùng phương') || qLower.includes('bậc bốn')) {
    detectedType = 'biquadratic';
  } else if (qLower.includes('parabol') || qLower.includes('bậc hai')) {
    detectedType = 'quadratic';
  }

  const branches: Array<Array<{ x: number; y: number }>> = [];
  const asymptotes: SgkAsymptote[] = [];
  const keyPoints: SgkPoint[] = [];
  const xTicks: Array<{ val: number; label: string }> = [];
  const yTicks: Array<{ val: number; label: string }> = [];

  let minX = -4.2;
  let maxX = 4.2;
  let minY = -4.2;
  let maxY = 4.2;
  let displayTitle = options.title || '';
  let formulaLatex = rawLatex;

  // =========================================================================
  // 1. HÀM PHÂN THỨC BẬC 1 / BẬC 1: y = (ax + b) / (cx + d)
  // =========================================================================
  if (detectedType === 'rational') {
    let a = 2, b = -1, c = 1, d = 1; // fallback chuẩn: y = (2x-1)/(x+1)
    let parsedExact = false;

    if (rationalParts) {
      // Handle leading -(...) on numerator if present
      let numStr = rationalParts.numStr;
      let numNeg = false;
      if (numStr.startsWith('-(') && numStr.endsWith(')')) {
        numNeg = true;
        numStr = numStr.slice(2, -1);
      }
      const numLin = parseLinearExpr(numStr);
      const denLin = parseLinearExpr(rationalParts.denStr);
      if (numLin.valid && denLin.valid && Math.abs(denLin.a) > 1e-6) {
        a = numNeg ? -numLin.a : numLin.a;
        b = numNeg ? -numLin.b : numLin.b;
        c = denLin.a;
        d = denLin.b;
        parsedExact = true;
      }
    }

    if (!parsedExact && options.coefficients?.a !== undefined && options.coefficients?.c !== undefined) {
      a = options.coefficients.a;
      b = options.coefficients.b ?? 0;
      c = options.coefficients.c || 1;
      d = options.coefficients.d ?? 0;
      parsedExact = true;
    }

    let asymX = options.asymptoteX !== undefined ? options.asymptoteX : -d / c;
    let asymY = options.asymptoteY !== undefined ? options.asymptoteY : a / c;

    // If generic symbolic formula like y = (ax+b)/(cx+d), choose clean SGK example
    if (!parsedExact && /(?:ax\+b|cx\+d)/i.test(normalized)) {
      asymX = options.asymptoteX !== undefined ? options.asymptoteX : 1;
      asymY = options.asymptoteY !== undefined ? options.asymptoteY : 2;
      a = 2; b = -1; c = 1; d = -1; // f(x) = (2x-1)/(x-1)
      if (!formulaLatex) formulaLatex = 'y = \\frac{ax+b}{cx+d}';
      if (!displayTitle) displayTitle = 'Đồ thị hàm phân thức bậc nhất';
    } else if (!parsedExact) {
      a = 2; b = -1; c = 1; d = 1;
      asymX = -1; asymY = 2;
      if (!formulaLatex) formulaLatex = 'y = \\frac{2x-1}{x+1}';
    }
    if (!displayTitle) displayTitle = 'Đồ thị hàm số phân thức';

    const f = (x: number) => (a * x + b) / (c * x + d);

    // Compute intercepts accurately
    const y0 = Math.abs(d) > 1e-6 ? b / d : NaN;
    const x0 = Math.abs(a) > 1e-6 ? -b / a : NaN;

    // Adaptive balanced viewport around asymptotes, origin & intercepts
    const xs = [0, asymX];
    if (isFinite(x0) && Math.abs(x0) < 12) xs.push(x0);
    const ys = [0, asymY];
    if (isFinite(y0) && Math.abs(y0) < 12) ys.push(y0);

    const spanHalfX = Math.max(3.6, ...xs.map((v) => Math.abs(v - asymX * 0.4) + 2.4));
    const spanHalfY = Math.max(3.8, ...ys.map((v) => Math.abs(v - asymY * 0.4) + 2.4));
    minX = Math.min(-3.8, Math.floor(Math.min(...xs) - 2.3), asymX - spanHalfX * 0.85);
    maxX = Math.max(3.8, Math.ceil(Math.max(...xs) + 2.3), asymX + spanHalfX * 0.85);
    minY = Math.min(-3.5, Math.floor(Math.min(...ys) - 2.2), asymY - spanHalfY * 0.85);
    maxY = Math.max(3.8, Math.ceil(Math.max(...ys) + 2.2), asymY + spanHalfY * 0.85);

    // Keep reasonable proportions
    minX = Math.max(-8, minX);
    maxX = Math.min(8, maxX);
    minY = Math.max(-8, minY);
    maxY = Math.min(8, maxY);

    asymptotes.push({
      kind: 'vertical',
      x: asymX,
      label: `x = ${formatSgkTickNumber(asymX)}`,
    });
    asymptotes.push({
      kind: 'horizontal',
      y: asymY,
      label: `y = ${formatSgkTickNumber(asymY)}`,
    });

    // Sample left and right branches cleanly clipped to [minY, maxY]
    const b1 = sampleBranchClipped(f, minX, asymX - 0.015, 220, minY, maxY);
    const b2 = sampleBranchClipped(f, asymX + 0.015, maxX, 220, minY, maxY);
    if (b1.length > 1) branches.push(b1);
    if (b2.length > 1) branches.push(b2);

    // Ticks only at key SGK values (asymptotes & intercepts)
    addTickUnique(xTicks, asymX);
    addTickUnique(yTicks, asymY);
    if (isFinite(y0) && y0 >= minY && y0 <= maxY) {
      addTickUnique(yTicks, y0);
      keyPoints.push({ x: 0, y: y0, isIntercept: true });
    }
    if (isFinite(x0) && x0 >= minX && x0 <= maxX) {
      addTickUnique(xTicks, x0);
      keyPoints.push({ x: x0, y: 0, isIntercept: true });
    }
    keyPoints.push({ x: asymX, y: asymY, label: 'I', isCenter: true });
  }

  // =========================================================================
  // 2. HÀM BẬC 2 / BẬC 1 (TIỆM CẬN XIÊN): y = (ax^2 + bx + c) / (dx + e)
  // =========================================================================
  else if (detectedType === 'rational_21') {
    let a = 1, b = -1, c = 1, d = 1, e = -1; // fallback: y = (x^2 - x + 1)/(x - 1) = x + 1/(x-1)
    if (rationalParts) {
      const numPoly = parsePolynomial(rationalParts.numStr);
      const denLin = parseLinearExpr(rationalParts.denStr);
      if (numPoly.valid && denLin.valid && Math.abs(denLin.a) > 1e-6) {
        a = numPoly.c[2];
        b = numPoly.c[1];
        c = numPoly.c[0];
        d = denLin.a;
        e = denLin.b;
      }
    }
    if (!formulaLatex) formulaLatex = 'y = \\frac{x^2 - x + 1}{x - 1}';
    if (!displayTitle) displayTitle = 'Đồ thị hàm phân thức có tiệm cận xiên';

    const asymX = -e / d;
    const m = a / d;
    const q = (b - m * e) / d;
    const kRem = c - q * e;
    const f = (x: number) => (a * x * x + b * x + c) / (d * x + e);

    // Extrema occur where (x - asymX)^2 = kRem / (a/d^2...) => derivative of m*x + q + k/(d(x-asymX)):
    // f'(x) = m - kRem / (d*(x - asymX)^2 * d) wait simplify f(x) = m*x + q + r/(d*x+e)
    // Better direct derivative: f'(x) = m - r*d / (d*x+e)^2 = 0 => (x - asymX)^2 = r / (m*d) where r = kRem / d
    const r = kRem; // since f(x) = (m*x + q) + kRem / (d*(x - asymX)) -> check!
    // Check: (m*x+q)*(d*x+e) + kRem = (a/d)*d*x^2 + ((a/d)*e + q*d)x + q*e + c - q*e = a*x^2 + (a*e/d + b - a*e/d)x + c = a*x^2+bx+c! Exact!
    const deltaSq = m !== 0 ? r / (m * d) : -1;

    minX = asymX - 4.2;
    maxX = asymX + 4.2;
    minY = Math.min(-4.5, m * asymX + q - 4.5);
    maxY = Math.max(4.5, m * asymX + q + 4.5);

    asymptotes.push({ kind: 'vertical', x: asymX, label: `x = ${formatSgkTickNumber(asymX)}` });
    asymptotes.push({
      kind: 'oblique',
      m,
      q,
      label: `y = ${m === 1 ? '' : m === -1 ? '-' : formatSgkTickNumber(m)}x${q === 0 ? '' : q > 0 ? '+' + formatSgkTickNumber(q) : formatSgkTickNumber(q)}`,
    });

    const b1 = sampleBranchClipped(f, minX, asymX - 0.02, 220, minY, maxY);
    const b2 = sampleBranchClipped(f, asymX + 0.02, maxX, 220, minY, maxY);
    if (b1.length > 1) branches.push(b1);
    if (b2.length > 1) branches.push(b2);

    addTickUnique(xTicks, asymX);
    if (deltaSq > 0) {
      const offset = Math.sqrt(deltaSq);
      for (const exX of [asymX - offset, asymX + offset]) {
        const exY = f(exX);
        if (exX >= minX && exX <= maxX && exY >= minY && exY <= maxY) {
          keyPoints.push({ x: exX, y: exY, showProjections: true, isExtremum: true });
          addTickUnique(xTicks, exX);
          addTickUnique(yTicks, exY);
        }
      }
    }
  }

  // =========================================================================
  // 3. HÀM SỐ BẬC BA: y = ax^3 + bx^2 + cx + d
  // =========================================================================
  else if (detectedType === 'cubic') {
    let a = 1, b = 0, c = -3, d = 1;
    const poly = parsePolynomial(normalized);
    if (poly.valid && Math.abs(poly.c[3]) > 1e-6) {
      a = poly.c[3];
      b = poly.c[2];
      c = poly.c[1];
      d = poly.c[0];
    } else if (/3x\^2|3x\^\{2\}/.test(normalized)) {
      a = 1; b = -3; c = 0; d = 2;
      if (!formulaLatex) formulaLatex = 'y = x^3 - 3x^2 + 2';
    } else if (!formulaLatex) {
      formulaLatex = 'y = x^3 - 3x + 1';
    }
    if (!displayTitle) displayTitle = 'Đồ thị hàm số bậc ba';

    const f = (x: number) => a * x * x * x + b * x * x + c * x + d;
    const xInf = -b / (3 * a);
    const yInf = f(xInf);

    // Extrema: 3ax^2 + 2bx + c = 0 => disc = b^2 - 3ac
    const disc = b * b - 3 * a * c;
    const extXs: number[] = [];
    if (disc > 1e-5) {
      const sq = Math.sqrt(disc);
      extXs.push((-b - sq) / (3 * a), (-b + sq) / (3 * a));
      extXs.sort((u, v) => u - v);
    }

    const xsInterest = [0, xInf, ...extXs];
    const ysInterest = [0, d, yInf, ...extXs.map((vx) => f(vx))];

    const maxAbsExtDistX = Math.max(1.8, ...extXs.map((v) => Math.abs(v - xInf) * 1.9));
    minX = Math.min(-2.8, Math.min(...xsInterest) - 1.6, xInf - maxAbsExtDistX);
    maxX = Math.max(2.8, Math.max(...xsInterest) + 1.6, xInf + maxAbsExtDistX);
    minY = Math.min(-3.2, Math.min(...ysInterest) - 1.5);
    maxY = Math.max(3.5, Math.max(...ysInterest) + 1.5);

    minX = Math.max(-7, minX);
    maxX = Math.min(7, maxX);
    minY = Math.max(-8, minY);
    maxY = Math.min(8, maxY);

    const pts = sampleBranchClipped(f, minX, maxX, 320, minY, maxY);
    if (pts.length > 1) branches.push(pts);

    extXs.forEach((vx) => {
      const vy = f(vx);
      keyPoints.push({ x: vx, y: vy, showProjections: true, isExtremum: true });
      addTickUnique(xTicks, vx);
      addTickUnique(yTicks, vy);
    });
    if (Math.abs(d) > 0.08 && d >= minY && d <= maxY) {
      addTickUnique(yTicks, d);
      keyPoints.push({ x: 0, y: d, isIntercept: true });
    }
  }

  // =========================================================================
  // 4. HÀM BẬC BỐN TRÙNG PHƯƠNG: y = ax^4 + bx^2 + c
  // =========================================================================
  else if (detectedType === 'biquadratic') {
    let a = 1, b = -2, c = -1;
    const poly = parsePolynomial(normalized);
    if (poly.valid && Math.abs(poly.c[4]) > 1e-6) {
      a = poly.c[4];
      b = poly.c[2];
      c = poly.c[0];
    } else if (/^\s*-\s*x\^4/i.test(normalized)) {
      a = -1; b = 2; c = 1;
      if (!formulaLatex) formulaLatex = 'y = -x^4 + 2x^2 + 1';
    } else if (!formulaLatex) {
      formulaLatex = 'y = x^4 - 2x^2 - 1';
    }
    if (!displayTitle) displayTitle = 'Đồ thị hàm số bậc bốn trùng phương';

    const f = (x: number) => a * x * x * x * x + b * x * x + c;
    const extXs: number[] = [0];
    if (-b / (2 * a) > 1e-5) {
      const r = Math.sqrt(-b / (2 * a));
      extXs.push(-r, r);
    }

    const maxExtX = Math.max(1.5, ...extXs.map((v) => Math.abs(v)));
    const ysInterest = [0, ...extXs.map((vx) => f(vx))];

    minX = Math.max(-5.5, -maxExtX * 2.3);
    maxX = Math.min(5.5, maxExtX * 2.3);
    minY = Math.max(-7, Math.min(-3.2, Math.min(...ysInterest) - 1.6));
    maxY = Math.min(7, Math.max(3.5, Math.max(...ysInterest) + 1.6));

    const pts = sampleBranchClipped(f, minX, maxX, 320, minY, maxY);
    if (pts.length > 1) branches.push(pts);

    extXs.forEach((vx) => {
      const vy = f(vx);
      const isOriginX = Math.abs(vx) < 0.05;
      keyPoints.push({ x: vx, y: vy, showProjections: !isOriginX, isExtremum: true });
      addTickUnique(xTicks, vx);
      addTickUnique(yTicks, vy);
    });
  }

  // =========================================================================
  // 5. HÀM BẬC HAI (PARABOL): y = ax^2 + bx + c
  // =========================================================================
  else if (detectedType === 'quadratic') {
    let a = 1, b = -4, c = 3;
    const poly = parsePolynomial(normalized);
    if (poly.valid && Math.abs(poly.c[2]) > 1e-6) {
      a = poly.c[2];
      b = poly.c[1];
      c = poly.c[0];
    } else if (!formulaLatex) {
      formulaLatex = 'y = x^2 - 4x + 3';
    }
    if (!displayTitle) displayTitle = 'Đồ thị hàm số bậc hai (Parabol)';

    const f = (x: number) => a * x * x + b * x + c;
    const vx = -b / (2 * a);
    const vy = f(vx);
    const delta = b * b - 4 * a * c;
    const roots: number[] = [];
    if (delta >= 0) {
      const sq = Math.sqrt(delta);
      roots.push((-b - sq) / (2 * a), (-b + sq) / (2 * a));
    }

    const xsInterest = [0, vx, ...roots.filter((r) => Math.abs(r) < 10)];
    const ysInterest = [0, vy, c];

    minX = Math.max(-7, Math.min(...xsInterest, vx - 2.6) - 0.8);
    maxX = Math.min(7, Math.max(...xsInterest, vx + 2.6) + 0.8);
    minY = Math.max(-7, Math.min(-2.5, ...ysInterest) - 1.4);
    maxY = Math.min(8, Math.max(3.8, ...ysInterest) + 1.6);

    const pts = sampleBranchClipped(f, minX, maxX, 280, minY, maxY);
    if (pts.length > 1) branches.push(pts);

    keyPoints.push({ x: vx, y: vy, label: 'I', showProjections: true, isExtremum: true });
    addTickUnique(xTicks, vx);
    addTickUnique(yTicks, vy);
    if (Math.abs(c) > 0.08 && c >= minY && c <= maxY) {
      addTickUnique(yTicks, c);
      keyPoints.push({ x: 0, y: c, isIntercept: true });
    }
    roots.forEach((rx) => {
      if (Math.abs(rx) > 0.08 && rx >= minX && rx <= maxX) {
        addTickUnique(xTicks, rx);
        keyPoints.push({ x: rx, y: 0, isIntercept: true });
      }
    });
  }

  // =========================================================================
  // 6. HÀM BẬC NHẤT: y = ax + b
  // =========================================================================
  else if (detectedType === 'linear') {
    const lin = parseLinearExpr(normalized);
    const a = lin.valid && Math.abs(lin.a) > 1e-6 ? lin.a : 2;
    const b = lin.valid ? lin.b : -2;
    if (!formulaLatex) formulaLatex = 'y = 2x - 2';
    if (!displayTitle) displayTitle = 'Đồ thị hàm số bậc nhất';

    const f = (x: number) => a * x + b;
    const x0 = -b / a;
    minX = Math.max(-6, Math.min(-3.2, x0 - 1.8));
    maxX = Math.min(6, Math.max(3.2, x0 + 1.8));
    minY = Math.max(-6, Math.min(-3.2, b - 1.8));
    maxY = Math.min(6, Math.max(3.2, b + 1.8));

    const pts = sampleBranchClipped(f, minX, maxX, 80, minY, maxY);
    if (pts.length > 1) branches.push(pts);
    addTickUnique(yTicks, b);
    addTickUnique(xTicks, x0);
    keyPoints.push({ x: 0, y: b, isIntercept: true });
    keyPoints.push({ x: x0, y: 0, isIntercept: true });
  }

  // =========================================================================
  // 7. HÀM MŨ / LOGARIT / LƯỢNG GIÁC
  // =========================================================================
  else if (detectedType === 'exp') {
    const baseMatch = normalized.match(/(\d+(?:\.\d+)?)\^/);
    const base = baseMatch ? parseFloat(baseMatch[1]) : Math.E;
    if (!formulaLatex) formulaLatex = 'y = 2^x';
    if (!displayTitle) displayTitle = 'Đồ thị hàm số mũ';
    minX = -3.6; maxX = 3.6; minY = -1.6; maxY = 5.4;
    const f = (x: number) => Math.pow(base, x);
    const pts = sampleBranchClipped(f, minX, maxX, 220, minY, maxY);
    if (pts.length > 1) branches.push(pts);
    keyPoints.push({ x: 0, y: 1, isIntercept: true });
    keyPoints.push({ x: 1, y: base, showProjections: true });
    addTickUnique(yTicks, 1);
    addTickUnique(xTicks, 1);
    addTickUnique(yTicks, base);
  } else if (detectedType === 'log') {
    const baseMatch = normalized.match(/log_?\{?(\d+(?:\.\d+)?)/i);
    const base = baseMatch ? parseFloat(baseMatch[1]) : normalized.includes('ln') ? Math.E : 2;
    if (!formulaLatex) formulaLatex = 'y = \\log_2 x';
    if (!displayTitle) displayTitle = 'Đồ thị hàm số lôgarit';
    minX = -1.5; maxX = 5.2; minY = -3.4; maxY = 3.6;
    const f = (x: number) => Math.log(x) / Math.log(base);
    const pts = sampleBranchClipped(f, 0.04, maxX, 220, minY, maxY);
    if (pts.length > 1) branches.push(pts);
    keyPoints.push({ x: 1, y: 0, isIntercept: true });
    keyPoints.push({ x: base, y: 1, showProjections: true });
    addTickUnique(xTicks, 1);
    addTickUnique(xTicks, base);
    addTickUnique(yTicks, 1);
  } else {
    // Trig: A*sin(bx) or A*cos(bx)
    const isCos = /cos/i.test(normalized);
    const ampMatch = normalized.match(/^(-?\d+(?:\.\d+)?)\s*\*?\\?(?:sin|cos)/i);
    const amp = ampMatch ? parseFloat(ampMatch[1]) : 2;
    const freqMatch = normalized.match(/(?:sin|cos)\s*\(\s*(-?\d+(?:\.\d+)?)?\s*\*?x/i);
    const omega = freqMatch && freqMatch[1] ? parseFloat(freqMatch[1]) : 1;
    if (!formulaLatex) formulaLatex = isCos ? 'y = 2\\cos x' : 'y = 2\\sin x';
    if (!displayTitle) displayTitle = 'Đồ thị hàm số lượng giác';

    minX = -4.2; maxX = 4.2;
    minY = Math.min(-2.8, -Math.abs(amp) - 1);
    maxY = Math.max(2.8, Math.abs(amp) + 1);
    const f = (x: number) => amp * (isCos ? Math.cos(omega * x) : Math.sin(omega * x));
    const pts: Array<{ x: number; y: number }> = [];
    for (let x = minX; x <= maxX; x += 0.05) {
      pts.push({ x, y: f(x) });
    }
    if (pts.length > 1) branches.push(pts);
    const peakX = isCos ? 0 : Math.PI / (2 * omega);
    keyPoints.push({ x: peakX, y: amp, showProjections: peakX !== 0 });
    addTickUnique(yTicks, amp);
    addTickUnique(yTicks, -amp);
    if (peakX !== 0) addTickUnique(xTicks, peakX, 'π/2');
  }

  // Bảo đảm luôn có ít nhất 1 vạch đơn vị chuẩn trên mỗi trục nếu chưa có điểm đánh dấu nào
  if (xTicks.length === 0) {
    addTickUnique(xTicks, 1);
  }
  if (yTicks.length === 0) {
    addTickUnique(yTicks, 1);
  }

  return {
    type: detectedType,
    formulaLatex,
    title: displayTitle || 'Đồ thị hàm số chuẩn SGK',
    branches,
    asymptotes,
    keyPoints,
    minX,
    maxX,
    minY,
    maxY,
    xTicks,
    yTicks,
  };
}
