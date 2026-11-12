declare global {
  interface Window {
    katex?: any;
    math?: any;
    nerdamer?: any;
  }
}

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * ============================================================================
 * 1. BỘ NẠP THƯ VIỆN AN TOÀN (KaTeX + mathjs + nerdamer)
 * ============================================================================
 */
const EXTERNAL_SCRIPTS = [
  { id: 'katex-js', src: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js' },
  { id: 'mathjs-js', src: 'https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.11.2/math.min.js' },
  { id: 'nerdamer-core', src: 'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/nerdamer.core.min.js' },
  { id: 'nerdamer-algebra', src: 'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/Algebra.min.js' },
  { id: 'nerdamer-calculus', src: 'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/Calculus.min.js' },
  { id: 'nerdamer-solve', src: 'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/Solve.min.js' },
];

function loadSingleScript(id: string, src: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const existing = document.getElementById(id);
      if (existing) {
        if (existing.getAttribute('data-loaded') === 'true') {
          resolve(true);
          return;
        }
        existing.addEventListener('load', () => resolve(true));
        existing.addEventListener('error', () => resolve(false));
        return;
      }
      const script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = false;
      script.onload = () => {
        script.setAttribute('data-loaded', 'true');
        resolve(true);
      };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    } catch (e) {
      resolve(false);
    }
  });
}

function useExternalMathLibraries() {
  const [status, setStatus] = useState({
    katexReady: typeof window !== 'undefined' && Boolean(window.katex || katex),
    engineReady: typeof window !== 'undefined' && Boolean(window.math),
  });

  useEffect(() => {
    let mounted = true;
    if (typeof window !== 'undefined' && !window.katex && katex) {
      window.katex = katex;
    }

    if (!document.getElementById('katex-css')) {
      const link = document.createElement('link');
      link.id = 'katex-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
      document.head.appendChild(link);
    }

    async function loadAll() {
      for (const item of EXTERNAL_SCRIPTS) {
        await loadSingleScript(item.id, item.src);
        if (!mounted) return;
        setStatus({
          katexReady: Boolean(window.katex || katex),
          engineReady: Boolean(window.math),
        });
      }
    }
    loadAll();
    return () => {
      mounted = false;
    };
  }, []);

  return status;
}

/**
 * Bộ nhớ đệm (Cache) chuỗi HTML KaTeX:
 * Lưu trữ vĩnh viễn kết quả biên dịch các ký hiệu phím bấm và biểu thức toán.
 * Giúp bàn phím phản hồi tức thì 0ms, loại bỏ hoàn toàn độ trễ trên TV cảm ứng 75 inch.
 */
const katexHtmlCache = new Map<string, string>();

export function getKatexHtml(latex: string, displayMode = false): string {
  if (!latex) return '';
  const cacheKey = `${displayMode ? 'D:' : 'T:'}${latex}`;
  const cached = katexHtmlCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const katexEngine = (typeof window !== 'undefined' && window.katex) || katex;
  if (!katexEngine || typeof katexEngine.renderToString !== 'function') {
    return latex;
  }

  try {
    const html = katexEngine.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: true,
    });
    katexHtmlCache.set(cacheKey, html);
    return html;
  } catch (err) {
    return latex;
  }
}

/**
 * Component render trực tiếp chuỗi LaTeX bằng KaTeX với HTML caching và React.memo
 */
interface KatexScreenRendererProps {
  latex: string;
  displayMode?: boolean;
  className?: string;
  isReady?: boolean;
}

const KatexScreenRenderer: React.FC<KatexScreenRendererProps> = React.memo(({
  latex,
  displayMode = false,
  className = '',
}) => {
  const html = useMemo(() => {
    return getKatexHtml(latex, displayMode);
  }, [latex, displayMode]);

  return (
    <span
      className={`select-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

/**
 * ============================================================================
 * 2. CẤU TRÚC DỮ LIỆU CÂY BIỂU THỨC (AST) CHO MÀN HÌNH NATURAL-V.P.A.M.
 * ============================================================================
 */
let globalNodeCounter = 1;
const nextId = (prefix = 'id') => `${prefix}_${globalNodeCounter++}`;

const createSlot = (items: any[] = []) => ({
  id: nextId('slot'),
  items,
});

const createToken = (latex: string, kind = 'symbol') => ({
  id: nextId('tok'),
  type: 'token',
  kind,
  latex,
});

const createStructureNode = (nodeType: string): any => {
  const id = nextId('node');
  switch (nodeType) {
    case 'frac':
      return { id, type: 'frac', slots: { num: createSlot(), den: createSlot() }, slotOrder: ['num', 'den'] };
    case 'mixedfrac':
      return {
        id,
        type: 'mixedfrac',
        slots: { whole: createSlot(), num: createSlot(), den: createSlot() },
        slotOrder: ['whole', 'num', 'den'],
      };
    case 'sqrt':
      return { id, type: 'sqrt', slots: { rad: createSlot() }, slotOrder: ['rad'] };
    case 'cbrt':
      return { id, type: 'cbrt', slots: { rad: createSlot() }, slotOrder: ['rad'] };
    case 'nthroot':
      return { id, type: 'nthroot', slots: { deg: createSlot(), rad: createSlot() }, slotOrder: ['deg', 'rad'] };
    case 'pow':
      return { id, type: 'pow', slots: { exp: createSlot() }, slotOrder: ['exp'] };
    case 'log2':
      return { id, type: 'log2', slots: { base: createSlot(), arg: createSlot() }, slotOrder: ['base', 'arg'] };
    case 'abs':
      return { id, type: 'abs', slots: { inner: createSlot() }, slotOrder: ['inner'] };
    case 'int':
      return {
        id,
        type: 'int',
        slots: { lower: createSlot(), upper: createSlot(), body: createSlot() },
        slotOrder: ['body', 'lower', 'upper'],
      };
    case 'deriv':
      return {
        id,
        type: 'deriv',
        slots: { body: createSlot(), at: createSlot() },
        slotOrder: ['body', 'at'],
      };
    default:
      return null;
  }
};

const cloneTree = (obj: any) => JSON.parse(JSON.stringify(obj));

const findSlotWithContext = (
  slot: any,
  targetSlotId: string,
  parentNode: any = null,
  slotKey: any = null,
  parentSlot: any = null,
  parentIndex = -1
): any => {
  if (!slot) return null;
  if (slot.id === targetSlotId) {
    return { slot, parentNode, slotKey, parentSlot, parentIndex };
  }
  for (let i = 0; i < slot.items.length; i++) {
    const item = slot.items[i];
    if (item.type !== 'token' && item.slots) {
      for (const key of item.slotOrder) {
        const found = findSlotWithContext(item.slots[key], targetSlotId, item, key, slot, i);
        if (found) return found;
      }
    }
  }
  return null;
};

/**
 * Chuyển đổi Cây Biểu Thức sang chuỗi LaTeX chuẩn cho KaTeX
 */
const serializeSlotToLatex = (slot: any, cursor: any, isRoot = false): string => {
  if (!slot) return '';
  const isCursorInThisSlot = cursor && cursor.slotId === slot.id;
  const cursorMark = '{\\color{#0e140e}\\rule[-1.5pt]{1.8pt}{1.05em}}';

  if (slot.items.length === 0) {
    if (isRoot) {
      return isCursorInThisSlot ? cursorMark : '';
    }
    return isCursorInThisSlot
      ? `{\\color{#0e140e}\\blacksquare}`
      : `{\\color{#4a574a}\\square}`;
  }

  let out = '';
  for (let i = 0; i <= slot.items.length; i++) {
    if (isCursorInThisSlot && cursor.index === i) {
      out += cursorMark;
    }
    if (i < slot.items.length) {
      out += serializeNodeToLatex(slot.items[i], cursor);
    }
  }
  return out;
};

const serializeNodeToLatex = (node: any, cursor: any): string => {
  if (!node) return '';
  if (node.type === 'token') return node.latex;

  switch (node.type) {
    case 'frac': {
      const num = serializeSlotToLatex(node.slots.num, cursor, false);
      const den = serializeSlotToLatex(node.slots.den, cursor, false);
      return `\\frac{${num}}{${den}}`;
    }
    case 'mixedfrac': {
      const whole = serializeSlotToLatex(node.slots.whole, cursor, false);
      const num = serializeSlotToLatex(node.slots.num, cursor, false);
      const den = serializeSlotToLatex(node.slots.den, cursor, false);
      return `${whole}\\frac{${num}}{${den}}`;
    }
    case 'sqrt': {
      const rad = serializeSlotToLatex(node.slots.rad, cursor, false);
      return `\\sqrt{${rad}}`;
    }
    case 'cbrt': {
      const rad = serializeSlotToLatex(node.slots.rad, cursor, false);
      return `\\sqrt[3]{${rad}}`;
    }
    case 'nthroot': {
      const deg = serializeSlotToLatex(node.slots.deg, cursor, false);
      const rad = serializeSlotToLatex(node.slots.rad, cursor, false);
      return `\\sqrt[${deg}]{${rad}}`;
    }
    case 'pow': {
      const exp = serializeSlotToLatex(node.slots.exp, cursor, false);
      return `^{${exp}}`;
    }
    case 'log2': {
      const base = serializeSlotToLatex(node.slots.base, cursor, false);
      const arg = serializeSlotToLatex(node.slots.arg, cursor, false);
      return `\\log_{${base}}\\left(${arg}\\right)`;
    }
    case 'abs': {
      const inner = serializeSlotToLatex(node.slots.inner, cursor, false);
      return `\\left|${inner}\\right|`;
    }
    case 'int': {
      const lower = serializeSlotToLatex(node.slots.lower, cursor, false);
      const upper = serializeSlotToLatex(node.slots.upper, cursor, false);
      const body = serializeSlotToLatex(node.slots.body, cursor, false);
      return `\\int_{${lower}}^{${upper}}\\left(${body}\\right)\\,\\mathrm{d}x`;
    }
    case 'deriv': {
      const body = serializeSlotToLatex(node.slots.body, cursor, false);
      const at = serializeSlotToLatex(node.slots.at, cursor, false);
      return `\\left.\\frac{\\mathrm{d}}{\\mathrm{d}x}\\left(${body}\\right)\\right|_{x=${at}}`;
    }
    default:
      return '';
  }
};

/**
 * ============================================================================
 * 3. MODULE TÍNH TOÁN ĐỘC LẬP (CasioMathEngine - mathjs & nerdamer)
 * ============================================================================
 */
const CasioMathEngine = (() => {
  const formatNumberToLatex = (val: any, preferFraction = true) => {
    if (val === null || val === undefined || Number.isNaN(val)) return '\\text{Math ERROR}';
    if (!Number.isFinite(val)) return '\\text{Math ERROR}';
    const cleanVal = Math.abs(val) < 1e-12 ? 0 : Number(val.toPrecision(12));
    if (cleanVal === 0) return '0';

    if (preferFraction && window.math) {
      try {
        const frac = window.math.fraction(cleanVal);
        const s = Number(frac.s);
        const n = Number(frac.n);
        const d = Number(frac.d);
        if (d === 1) return `${s * n}`;
        if (d > 1 && d <= 99999 && n <= 9999999) {
          return `${s < 0 ? '-' : ''}\\frac{${n}}{${d}}`;
        }
      } catch (e) {
        // Bỏ qua nếu không đổi được phân số
      }
    }

    if (Math.abs(cleanVal) >= 1e10 || (Math.abs(cleanVal) > 0 && Math.abs(cleanVal) < 1e-7)) {
      const expStr = cleanVal.toExponential(6);
      const [mantissa, expPart] = expStr.split('e');
      return `${parseFloat(mantissa)}\\times 10^{${parseInt(expPart, 10)}}`;
    }
    return String(Number(cleanVal.toPrecision(10)));
  };

  const preprocessCombinatorics = (expr: string) => {
    let s = expr;
    const cpRegex = /(\([^()]+\)|[0-9.]+|[A-Za-z_][A-Za-z0-9_]*)\s*#(C|P)#\s*(\([^()]+\)|[0-9.]+|[A-Za-z_][A-Za-z0-9_]*)/;
    let guard = 0;
    while (cpRegex.test(s) && guard < 25) {
      s = s.replace(cpRegex, (_, a, op, b) => (op === 'C' ? `nCr(${a},${b})` : `nPr(${a},${b})`));
      guard++;
    }
    const factRegex = /(\([^()]+\)|[0-9.]+|[A-Za-z_][A-Za-z0-9_]*)!/;
    guard = 0;
    while (factRegex.test(s) && guard < 25) {
      s = s.replace(factRegex, (_, a) => `fact(${a})`);
      guard++;
    }
    return s;
  };

  const tokenToMathString = (tok: any) => {
    const map: Record<string, string> = {
      '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
      '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
      '.': '.', '+': '+', '-': '-', '\\times ': '*', '\\div ': '/',
      '(': '(', ')': ')', ',': ',',
      '\\pi ': 'pi', '\\mathrm{e}': 'e',
      '\\text{Ans}': 'Ans',
      'x': 'x', 'y': 'y', 'z': 'z',
      'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'E': 'E', 'F': 'F', 'M': 'M',
      '\\sin(': 'sin(', '\\cos(': 'cos(', '\\tan(': 'tan(',
      '\\sin^{-1}(': 'asin(', '\\cos^{-1}(': 'acos(', '\\tan^{-1}(': 'atan(',
      '\\ln(': 'ln(', '\\text{Abs}(': 'abs(',
      '\\text{GCD}(': 'gcd(', '\\text{LCM}(': 'lcm(',
      '\\text{Pol}(': 'Pol(', '\\text{Rec}(': 'Rec(',
      '\\text{Int}(': 'fix(', '\\text{Intg}(': 'floor(',
      '\\text{Ran\\#}': 'ran()', '\\text{RanInt\\#}(': 'ranInt(',
      '\\%': '*0.01',
      '!': '!',
      '\\boldsymbol{\\mathrm{C}}': '#C#',
      '\\boldsymbol{\\mathrm{P}}': '#P#',
      '\\times 10^{': '*10^(',
      '^{\\circ}': '*1',
    };
    return map[tok.latex] !== undefined ? map[tok.latex] : tok.latex;
  };

  const needsImplicitMul = (leftItem: any, rightItem: any) => {
    if (!leftItem || !rightItem) return false;
    if (rightItem.type === 'pow') return false;
    if (rightItem.type === 'token') {
      const rl = rightItem.latex;
      if (['+', '-', '\\times ', '\\div ', ')', ',', '\\%', '!', '\\boldsymbol{\\mathrm{C}}', '\\boldsymbol{\\mathrm{P}}', '\\times 10^{', '^{\\circ}'].includes(rl)) {
        return false;
      }
      if (leftItem.type === 'token' && /^[0-9.]$/.test(leftItem.latex) && /^[0-9.]$/.test(rl)) {
        return false;
      }
    }
    const leftIsValue =
      leftItem.type !== 'token' ||
      /^[0-9.]$/.test(leftItem.latex) ||
      [')', '\\pi ', '\\mathrm{e}', '\\text{Ans}', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'M', '!'].includes(leftItem.latex);

    const rightStartsValue =
      rightItem.type !== 'token' ||
      ['(', '\\pi ', '\\mathrm{e}', '\\text{Ans}', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'M', '\\sin(', '\\cos(', '\\tan(', '\\sin^{-1}(', '\\cos^{-1}(', '\\tan^{-1}(', '\\ln(', '\\text{Abs}('].includes(rightItem.latex) ||
      (leftItem.type !== 'token' && /^[0-9]$/.test(rightItem.latex)) ||
      (leftItem.type === 'token' && !/^[0-9.]$/.test(leftItem.latex) && /^[0-9]$/.test(rightItem.latex));

    return leftIsValue && rightStartsValue;
  };

  const compileSlotToMathJs = (slot: any): string => {
    if (!slot || !slot.items || slot.items.length === 0) {
      throw new Error('SYNTAX_ERROR');
    }
    let parts: string[] = [];
    for (let i = 0; i < slot.items.length; i++) {
      const item = slot.items[i];
      if (i > 0 && needsImplicitMul(slot.items[i - 1], item)) {
        parts.push('*');
      }
      parts.push(compileNodeToMathJs(item));
    }
    let joined = parts.join('');
    const openCount = (joined.match(/\(/g) || []).length;
    const closeCount = (joined.match(/\)/g) || []).length;
    if (openCount > closeCount) {
      joined += ')'.repeat(openCount - closeCount);
    }
    return preprocessCombinatorics(joined);
  };

  const compileNodeToMathJs = (node: any): string => {
    if (node.type === 'token') return tokenToMathString(node);
    switch (node.type) {
      case 'frac':
        return `((${compileSlotToMathJs(node.slots.num)})/(${compileSlotToMathJs(node.slots.den)}))`;
      case 'mixedfrac':
        return `((${compileSlotToMathJs(node.slots.whole)})+((${compileSlotToMathJs(node.slots.num)})/(${compileSlotToMathJs(node.slots.den)})))`;
      case 'sqrt':
        return `sqrt(${compileSlotToMathJs(node.slots.rad)})`;
      case 'cbrt':
        return `cbrt(${compileSlotToMathJs(node.slots.rad)})`;
      case 'nthroot':
        return `nthRoot((${compileSlotToMathJs(node.slots.rad)}),(${compileSlotToMathJs(node.slots.deg)}))`;
      case 'pow':
        return `^(${compileSlotToMathJs(node.slots.exp)})`;
      case 'log2':
        return `log((${compileSlotToMathJs(node.slots.arg)}),(${compileSlotToMathJs(node.slots.base)}))`;
      case 'abs':
        return `abs(${compileSlotToMathJs(node.slots.inner)})`;
      case 'deriv': {
        const bodyExpr = compileSlotToMathJs(node.slots.body);
        const atExpr = compileSlotToMathJs(node.slots.at);
        return `casioDeriv("${bodyExpr.replace(/"/g, '')}", (${atExpr}))`;
      }
      case 'int': {
        const bodyExpr = compileSlotToMathJs(node.slots.body);
        const lowExpr = compileSlotToMathJs(node.slots.lower);
        const upExpr = compileSlotToMathJs(node.slots.upper);
        return `casioInt("${bodyExpr.replace(/"/g, '')}", (${lowExpr}), (${upExpr}))`;
      }
      default:
        throw new Error('SYNTAX_ERROR');
    }
  };

  const buildScope = (angleUnit = 'D', memoryVars: any = {}) => {
    const toRad = (x: number) => (angleUnit === 'D' ? (x * Math.PI) / 180 : angleUnit === 'G' ? (x * Math.PI) / 200 : x);
    const fromRad = (r: number) => (angleUnit === 'D' ? (r * 180) / Math.PI : angleUnit === 'G' ? (r * 200) / Math.PI : r);

    const scope: any = {
      pi: Math.PI,
      e: Math.E,
      Ans: 0,
      x: 0, y: 0, z: 0,
      A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, M: 0,
      ...memoryVars,
      sin: (v: any) => Math.sin(toRad(Number(v))),
      cos: (v: any) => Math.cos(toRad(Number(v))),
      tan: (v: any) => {
        const rad = toRad(Number(v));
        if (Math.abs(Math.cos(rad)) < 1e-12) throw new Error('MATH_ERROR');
        return Math.tan(rad);
      },
      asin: (v: any) => {
        if (v < -1 || v > 1) throw new Error('MATH_ERROR');
        return fromRad(Math.asin(Number(v)));
      },
      acos: (v: any) => {
        if (v < -1 || v > 1) throw new Error('MATH_ERROR');
        return fromRad(Math.acos(Number(v)));
      },
      atan: (v: any) => fromRad(Math.atan(Number(v))),
      ln: (v: any) => {
        if (v <= 0) throw new Error('MATH_ERROR');
        return Math.log(Number(v));
      },
      log: (v: any, b = 10) => {
        if (v <= 0 || b <= 0 || b === 1) throw new Error('MATH_ERROR');
        return Math.log(Number(v)) / Math.log(Number(b));
      },
      sqrt: (v: any) => {
        if (v < 0) throw new Error('MATH_ERROR');
        return Math.sqrt(Number(v));
      },
      cbrt: (v: any) => Math.cbrt(Number(v)),
      nthRoot: (v: any, n: any) => {
        if (n === 0) throw new Error('MATH_ERROR');
        if (v < 0 && n % 2 === 0) throw new Error('MATH_ERROR');
        return v < 0 ? -Math.pow(-v, 1 / n) : Math.pow(v, 1 / n);
      },
      nCr: (n: any, r: any) => {
        const nn = Math.round(Number(n));
        const rr = Math.round(Number(r));
        if (nn < 0 || rr < 0 || rr > nn) throw new Error('MATH_ERROR');
        return window.math ? window.math.combinations(nn, rr) : 1;
      },
      nPr: (n: any, r: any) => {
        const nn = Math.round(Number(n));
        const rr = Math.round(Number(r));
        if (nn < 0 || rr < 0 || rr > nn) throw new Error('MATH_ERROR');
        return window.math ? window.math.permutations(nn, rr) : 1;
      },
      fact: (n: any) => {
        const num = Number(n);
        if (!Number.isInteger(num) || num < 0 || num > 69) throw new Error('MATH_ERROR');
        let res = 1;
        for (let i = 2; i <= num; i++) res *= i;
        return res;
      },
      gcd: (a: any, b: any) => (window.math ? window.math.gcd(Math.round(a), Math.round(b)) : 1),
      lcm: (a: any, b: any) => (window.math ? window.math.lcm(Math.round(a), Math.round(b)) : 1),
      ran: () => Number(Math.random().toFixed(3)),
      ranInt: (a: any, b: any) => {
        const min = Math.ceil(Math.min(a, b));
        const max = Math.floor(Math.max(a, b));
        return Math.floor(Math.random() * (max - min + 1)) + min;
      },
      Pol: (x: any, y: any) => Math.hypot(x, y),
      Rec: (r: any, theta: any) => r * Math.cos(toRad(theta)),
      casioDeriv: (exprStr: string, x0: any) => evaluateDerivative(exprStr, Number(x0), angleUnit, memoryVars),
      casioInt: (exprStr: string, a: any, b: any) => evaluateDefiniteIntegral(exprStr, Number(a), Number(b), angleUnit, memoryVars),
    };
    return scope;
  };

  const evaluateExpressionString = (exprStr: string, angleUnit = 'D', memoryVars: any = {}) => {
    if (!window.math) throw new Error('ENGINE_NOT_READY');
    const scope = buildScope(angleUnit, memoryVars);
    const val = window.math.evaluate(exprStr, scope);
    const num = typeof val === 'object' && val !== null && val.valueOf ? Number(val.valueOf()) : Number(val);
    if (!Number.isFinite(num)) throw new Error('MATH_ERROR');
    return num;
  };

  const evaluateDerivative = (exprStr: string, x0: number, angleUnit = 'D', memoryVars: any = {}) => {
    if (window.nerdamer && angleUnit === 'R') {
      try {
        const dExpr = window.nerdamer(`diff(${exprStr}, x)`).text();
        const val = evaluateExpressionString(dExpr, angleUnit, { ...memoryVars, x: x0 });
        if (Number.isFinite(val)) return val;
      } catch (e) {
        // Fallback sang đạo hàm số học trung tâm
      }
    }
    const h = 1e-6;
    const f1 = evaluateExpressionString(exprStr, angleUnit, { ...memoryVars, x: x0 + h });
    const f2 = evaluateExpressionString(exprStr, angleUnit, { ...memoryVars, x: x0 - h });
    return (f1 - f2) / (2 * h);
  };

  const evaluateDefiniteIntegral = (exprStr: string, a: number, b: number, angleUnit = 'D', memoryVars: any = {}) => {
    if (a === b) return 0;
    const n = 100;
    const h = (b - a) / n;
    let sum =
      evaluateExpressionString(exprStr, angleUnit, { ...memoryVars, x: a }) +
      evaluateExpressionString(exprStr, angleUnit, { ...memoryVars, x: b });
    for (let i = 1; i < n; i++) {
      const xVal = a + i * h;
      const fx = evaluateExpressionString(exprStr, angleUnit, { ...memoryVars, x: xVal });
      sum += (i % 2 === 0 ? 2 : 4) * fx;
    }
    return (h / 3) * sum;
  };

  const evaluateCompTree = (rootSlot: any, angleUnit = 'D', memoryVars: any = {}) => {
    try {
      const exprStr = compileSlotToMathJs(rootSlot);
      const value = evaluateExpressionString(exprStr, angleUnit, memoryVars);
      const exactLatex = formatNumberToLatex(value, true);
      const decimalLatex = formatNumberToLatex(value, false);
      return { ok: true, value, exactLatex, decimalLatex, compiled: exprStr };
    } catch (err: any) {
      const msg = err.message === 'SYNTAX_ERROR' ? '\\text{Syntax ERROR}' : '\\text{Math ERROR}';
      return { ok: false, errorLatex: msg };
    }
  };

  const solveSingleVariableEquation = (rootSlot: any, xInit = 1, angleUnit = 'D', memoryVars: any = {}) => {
    try {
      const exprStr = compileSlotToMathJs(rootSlot);
      if (window.nerdamer && angleUnit === 'R') {
        try {
          const sol = window.nerdamer.solveEquations(`${exprStr}=0`, 'x');
          if (sol && sol.length > 0) {
            const firstVal = Number(window.nerdamer(sol[0]).evaluate().text('decimals'));
            if (Number.isFinite(firstVal)) {
              return {
                ok: true,
                root: firstVal,
                residual: 0,
                exactLatex: formatNumberToLatex(firstVal, true),
                decimalLatex: formatNumberToLatex(firstVal, false),
              };
            }
          }
        } catch (e) {
          // Tiếp tục với phương pháp Newton-Raphson
        }
      }

      let x = Number.isFinite(xInit) ? xInit : 1;
      for (let iter = 0; iter < 60; iter++) {
        const fx = evaluateExpressionString(exprStr, angleUnit, { ...memoryVars, x });
        if (Math.abs(fx) < 1e-10) {
          return {
            ok: true,
            root: x,
            residual: 0,
            exactLatex: formatNumberToLatex(x, true),
            decimalLatex: formatNumberToLatex(x, false),
          };
        }
        const dfx = evaluateDerivative(exprStr, x, angleUnit, memoryVars);
        if (Math.abs(dfx) < 1e-12) {
          x += 0.5;
          continue;
        }
        const nextX = x - fx / dfx;
        if (Math.abs(nextX - x) < 1e-10) {
          const finalF = evaluateExpressionString(exprStr, angleUnit, { ...memoryVars, x: nextX });
          if (Math.abs(finalF) < 1e-5) {
            return {
              ok: true,
              root: nextX,
              residual: Math.abs(finalF) < 1e-10 ? 0 : finalF,
              exactLatex: formatNumberToLatex(nextX, true),
              decimalLatex: formatNumberToLatex(nextX, false),
            };
          }
        }
        x = nextX;
      }
      return { ok: false, errorLatex: '\\text{Can not Solve}' };
    } catch (e) {
      return { ok: false, errorLatex: '\\text{Syntax ERROR}' };
    }
  };

  const solveLinearSystem = (size: number, matrix: any[][]) => {
    const varNames = ['x', 'y', 'z', 't'].slice(0, size);
    const A = matrix.map((row) => row.slice(0, size).map((v) => Number(v) || 0));
    const B = matrix.map((row) => Number(row[size]) || 0);

    const aug = A.map((row, i) => [...row, B[i]]);
    const n = size;
    let pivotRow = 0;

    for (let col = 0; col < n && pivotRow < n; col++) {
      let maxRow = pivotRow;
      for (let r = pivotRow + 1; r < n; r++) {
        if (Math.abs(aug[r][col]) > Math.abs(aug[maxRow][col])) maxRow = r;
      }
      if (Math.abs(aug[maxRow][col]) < 1e-11) continue;
      [aug[pivotRow], aug[maxRow]] = [aug[maxRow], aug[pivotRow]];
      const div = aug[pivotRow][col];
      for (let c = col; c <= n; c++) aug[pivotRow][c] /= div;
      for (let r = 0; r < n; r++) {
        if (r !== pivotRow && Math.abs(aug[r][col]) > 1e-11) {
          const factor = aug[r][col];
          for (let c = col; c <= n; c++) aug[r][c] -= factor * aug[pivotRow][c];
        }
      }
      pivotRow++;
    }

    for (let r = 0; r < n; r++) {
      const allZero = aug[r].slice(0, n).every((v) => Math.abs(v) < 1e-10);
      if (allZero && Math.abs(aug[r][n]) > 1e-10) {
        return { ok: false, status: 'NO_SOLUTION', messageLatex: '\\text{Vô nghiệm (No Solution)}' };
      }
    }
    if (pivotRow < n) {
      return { ok: false, status: 'INFINITE', messageLatex: '\\text{Vô số nghiệm (Infinite Sol)}' };
    }

    const solutions = varNames.map((vName, i) => ({
      label: vName,
      value: aug[i][n],
      exactLatex: formatNumberToLatex(aug[i][n], true),
      decimalLatex: formatNumberToLatex(aug[i][n], false),
    }));
    return { ok: true, solutions };
  };

  const solvePolynomialEquation = (degree: number, coeffs: any[]) => {
    if (degree === 2) {
      const [a, b, c] = coeffs.map((v) => Number(v) || 0);
      if (Math.abs(a) < 1e-12) {
        if (Math.abs(b) < 1e-12) {
          return { ok: false, messageLatex: '\\text{Vô nghiệm / Vô số nghiệm}' };
        }
        const x = -c / b;
        return {
          ok: true,
          solutions: [{ label: 'x', exactLatex: formatNumberToLatex(x, true), decimalLatex: formatNumberToLatex(x, false) }],
        };
      }

      const delta = b * b - 4 * a * c;
      const vx = -b / (2 * a);
      const vy = -delta / (4 * a);
      const extremumLabel = a > 0 ? '\\text{Min } y' : '\\text{Max } y';

      if (delta < -1e-12) {
        return {
          ok: true,
          solutions: [
            { label: '\\Delta', exactLatex: formatNumberToLatex(delta, true), decimalLatex: formatNumberToLatex(delta, false) },
            { label: '\\text{KL}', exactLatex: '\\text{PT vô nghiệm thực } (\\Delta < 0)', decimalLatex: '\\text{PT vô nghiệm thực } (\\Delta < 0)' },
            { label: 'x_{\\text{đỉnh}}', exactLatex: formatNumberToLatex(vx, true), decimalLatex: formatNumberToLatex(vx, false) },
            { label: extremumLabel, exactLatex: formatNumberToLatex(vy, true), decimalLatex: formatNumberToLatex(vy, false) },
          ],
        };
      }

      if (Math.abs(delta) <= 1e-12) {
        return {
          ok: true,
          solutions: [
            { label: 'x_1 = x_2', exactLatex: formatNumberToLatex(vx, true), decimalLatex: formatNumberToLatex(vx, false) },
            { label: extremumLabel, exactLatex: '0', decimalLatex: '0' },
          ],
        };
      }

      const x1 = (-b + Math.sqrt(delta)) / (2 * a);
      const x2 = (-b - Math.sqrt(delta)) / (2 * a);
      return {
        ok: true,
        solutions: [
          { label: 'x_1', exactLatex: formatNumberToLatex(x1, true), decimalLatex: formatNumberToLatex(x1, false) },
          { label: 'x_2', exactLatex: formatNumberToLatex(x2, true), decimalLatex: formatNumberToLatex(x2, false) },
          { label: 'x_{\\text{đỉnh}}', exactLatex: formatNumberToLatex(vx, true), decimalLatex: formatNumberToLatex(vx, false) },
          { label: extremumLabel, exactLatex: formatNumberToLatex(vy, true), decimalLatex: formatNumberToLatex(vy, false) },
        ],
      };
    }

    if (degree === 3) {
      const [a, b, c, d] = coeffs.map((v) => Number(v) || 0);
      if (Math.abs(a) < 1e-12) return solvePolynomialEquation(2, [b, c, d]);

      const A = b / a;
      const B = c / a;
      const C = d / a;
      const p = B - (A * A) / 3;
      const q = (2 * A * A * A) / 27 - (A * B) / 3 + C;
      const disc = (q * q) / 4 + (p * p * p) / 27;

      const roots: number[] = [];
      if (disc > 1e-12) {
        const u = Math.cbrt(-q / 2 + Math.sqrt(disc));
        const v = Math.cbrt(-q / 2 - Math.sqrt(disc));
        roots.push(u + v - A / 3);
      } else if (Math.abs(disc) <= 1e-12) {
        const u = Math.cbrt(-q / 2);
        roots.push(2 * u - A / 3);
        if (Math.abs(u) > 1e-10) roots.push(-u - A / 3);
      } else {
        const r = Math.sqrt(-(p * p * p) / 27);
        const phi = Math.acos(Math.max(-1, Math.min(1, -q / (2 * r))));
        const m = 2 * Math.cbrt(r);
        roots.push(m * Math.cos(phi / 3) - A / 3);
        roots.push(m * Math.cos((phi + 2 * Math.PI) / 3) - A / 3);
        roots.push(m * Math.cos((phi + 4 * Math.PI) / 3) - A / 3);
      }

      roots.sort((r1, r2) => r2 - r1);
      return {
        ok: true,
        solutions: roots.map((rVal, idx) => ({
          label: `x_${idx + 1}`,
          exactLatex: formatNumberToLatex(rVal, true),
          decimalLatex: formatNumberToLatex(rVal, false),
        })),
      };
    }
    return { ok: false, messageLatex: '\\text{Math ERROR}' };
  };

  const generateFunctionTable = (
    fSlot: any,
    gSlot: any,
    start: number,
    end: number,
    step: number,
    angleUnit = 'D',
    memoryVars: any = {}
  ) => {
    if (step <= 0 || end < start) return { ok: false, errorLatex: '\\text{Range ERROR}' };
    const count = Math.floor((end - start) / step) + 1;
    if (count > 45) return { ok: false, errorLatex: '\\text{Table Too Large (>45)}' };

    let fStr = '';
    let gStr = '';
    try {
      fStr = compileSlotToMathJs(fSlot);
    } catch (e) {
      return { ok: false, errorLatex: '\\text{Syntax ERROR in } f(x)' };
    }
    if (gSlot && gSlot.items && gSlot.items.length > 0) {
      try {
        gStr = compileSlotToMathJs(gSlot);
      } catch (e) {
        gStr = '';
      }
    }

    const rows = [];
    for (let i = 0; i < count; i++) {
      const xVal = Number((start + i * step).toPrecision(10));
      let fxLatex = '\\text{ERROR}';
      let gxLatex = '';
      try {
        const fx = evaluateExpressionString(fStr, angleUnit, { ...memoryVars, x: xVal });
        fxLatex = formatNumberToLatex(fx, false);
      } catch (e) {
        fxLatex = '\\text{ERROR}';
      }
      if (gStr) {
        try {
          const gx = evaluateExpressionString(gStr, angleUnit, { ...memoryVars, x: xVal });
          gxLatex = formatNumberToLatex(gx, false);
        } catch (e) {
          gxLatex = '\\text{ERROR}';
        }
      }
      rows.push({ xLatex: formatNumberToLatex(xVal, false), fxLatex, gxLatex });
    }
    return { ok: true, rows, hasG: Boolean(gStr) };
  };

  const extractVariablesFromTree = (slot: any) => {
    const vars = new Set<string>();
    const walk = (s: any) => {
      if (!s || !s.items) return;
      for (const item of s.items) {
        if (item.type === 'token' && ['x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'M'].includes(item.latex)) {
          vars.add(item.latex);
        } else if (item.slots) {
          for (const k of item.slotOrder) walk(item.slots[k]);
        }
      }
    };
    walk(slot);
    return Array.from(vars);
  };

  const evaluateVectorExpression = (slot: any, vectors: any, vctAns: any, angleUnit = 'D'): any => {
    const getVec = (name: string) => {
      const v = name === 'VctAns' ? vctAns : vectors[name];
      if (!v) throw new Error('MATH_ERROR');
      return v.coords.slice(0, v.dim).map((n: any) => Number(n) || 0);
    };

    const to3D = (arr: number[]) => (arr.length === 2 ? [arr[0], arr[1], 0] : [arr[0], arr[1], arr[2]]);
    const dot = (a: number[], b: number[]) => {
      if (a.length !== b.length) throw new Error('DIMENSION_ERROR');
      return a.reduce((s, val, i) => s + val * b[i], 0);
    };
    const norm = (a: number[]) => Math.hypot(...a);
    const cross = (a: number[], b: number[]) => {
      const u = to3D(a);
      const v = to3D(b);
      return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    };
    const angleBetween = (a: number[], b: number[]) => {
      const na = norm(a);
      const nb = norm(b);
      if (na < 1e-12 || nb < 1e-12) throw new Error('MATH_ERROR');
      const cosVal = Math.max(-1, Math.min(1, dot(a, b) / (na * nb)));
      const rad = Math.acos(cosVal);
      return angleUnit === 'D' ? (rad * 180) / Math.PI : angleUnit === 'G' ? (rad * 200) / Math.PI : rad;
    };

    try {
      const items = slot.items;
      if (!items || items.length === 0) throw new Error('SYNTAX_ERROR');

      if (items.length === 1 && items[0].type === 'abs') {
        const innerRes = evaluateVectorExpression(items[0].slots.inner, vectors, vctAns, angleUnit);
        if (!innerRes.ok || innerRes.kind !== 'vector') throw new Error('SYNTAX_ERROR');
        const val = norm(innerRes.vec);
        return {
          ok: true,
          kind: 'scalar',
          value: val,
          exactLatex: formatNumberToLatex(val, true),
          decimalLatex: formatNumberToLatex(val, false),
        };
      }

      const rawStr = items
        .map((it: any) => {
          if (it.type === 'abs') {
            const inner = it.slots.inner.items.map((x: any) => x.latex || '').join('');
            return `Abs(${inner})`;
          }
          return it.latex || '';
        })
        .join('')
        .replace(/\\text\{VctA\}/g, 'VctA')
        .replace(/\\text\{VctB\}/g, 'VctB')
        .replace(/\\text\{VctC\}/g, 'VctC')
        .replace(/\\text\{VctD\}/g, 'VctD')
        .replace(/\\text\{VctAns\}/g, 'VctAns')
        .replace(/\\text\{Angle\}\(/g, 'Angle(')
        .replace(/\\text\{Abs\}\(/g, 'Abs(')
        .replace(/\\boldsymbol\{\\cdot\}/g, ' DOT ')
        .replace(/\\times /g, ' CROSS ')
        .trim();

      const angleMatch = rawStr.match(/^Angle\(\s*(Vct[A-D]|VctAns)\s*,\s*(Vct[A-D]|VctAns)\s*\)?$/);
      if (angleMatch) {
        const ang = angleBetween(getVec(angleMatch[1]), getVec(angleMatch[2]));
        return {
          ok: true,
          kind: 'scalar',
          value: ang,
          exactLatex: formatNumberToLatex(ang, true),
          decimalLatex: formatNumberToLatex(ang, false),
        };
      }

      const absMatch = rawStr.match(/^Abs\(\s*(Vct[A-D]|VctAns)\s*\)?$/);
      if (absMatch) {
        const val = norm(getVec(absMatch[1]));
        return {
          ok: true,
          kind: 'scalar',
          value: val,
          exactLatex: formatNumberToLatex(val, true),
          decimalLatex: formatNumberToLatex(val, false),
        };
      }

      const dotMatch = rawStr.match(/^(Vct[A-D]|VctAns)\s*DOT\s*(Vct[A-D]|VctAns)$/);
      if (dotMatch) {
        const val = dot(getVec(dotMatch[1]), getVec(dotMatch[2]));
        return {
          ok: true,
          kind: 'scalar',
          value: val,
          exactLatex: formatNumberToLatex(val, true),
          decimalLatex: formatNumberToLatex(val, false),
        };
      }

      const crossMatch = rawStr.match(/^(Vct[A-D]|VctAns)\s*CROSS\s*(Vct[A-D]|VctAns)$/);
      if (crossMatch) {
        const cVec = cross(getVec(crossMatch[1]), getVec(crossMatch[2]));
        const ltx = `\\begin{bmatrix} ${cVec.map((x) => formatNumberToLatex(x, true)).join(' \\\\ ')} \\end{bmatrix}`;
        const decLtx = `\\begin{bmatrix} ${cVec.map((x) => formatNumberToLatex(x, false)).join(' \\\\ ')} \\end{bmatrix}`;
        return { ok: true, kind: 'vector', vec: cVec, exactLatex: ltx, decimalLatex: decLtx };
      }

      const termRegex = /([+-]?)\s*(?:([0-9.]+)\s*(?:CROSS|\*)?\s*)?(Vct[A-D]|VctAns)/g;
      let match;
      let resultVec: number[] | null = null;
      let consumed = '';
      while ((match = termRegex.exec(rawStr)) !== null) {
        consumed += match[0];
        const sign = match[1] === '-' ? -1 : 1;
        const scalar = match[2] !== undefined && match[2] !== '' ? Number(match[2]) : 1;
        const factor = sign * scalar;
        const v = getVec(match[3]);
        if (!resultVec) {
          resultVec = v.map((x: number) => factor * x);
        } else {
          if (resultVec.length !== v.length) throw new Error('DIMENSION_ERROR');
          resultVec = resultVec.map((x: number, idx: number) => x + factor * v[idx]);
        }
      }

      if (resultVec && consumed.replace(/\s+/g, '').length === rawStr.replace(/\s+/g, '').length) {
        const ltx = `\\begin{bmatrix} ${resultVec.map((x) => formatNumberToLatex(x, true)).join(' \\\\ ')} \\end{bmatrix}`;
        const decLtx = `\\begin{bmatrix} ${resultVec.map((x) => formatNumberToLatex(x, false)).join(' \\\\ ')} \\end{bmatrix}`;
        return { ok: true, kind: 'vector', vec: resultVec, exactLatex: ltx, decimalLatex: decLtx };
      }

      throw new Error('SYNTAX_ERROR');
    } catch (err: any) {
      const msg =
        err.message === 'DIMENSION_ERROR'
          ? '\\text{Dimension ERROR}'
          : err.message === 'SYNTAX_ERROR'
          ? '\\text{Syntax ERROR}'
          : '\\text{Math ERROR}';
      return { ok: false, errorLatex: msg };
    }
  };

  /**
   * Xử lý Thống kê (MENU 6: Statistics - Đơn biến & Mẫu số liệu ghép nhóm)
   */
  const calculateUngroupedStats = (rows: any[]) => {
    const validRows: Array<{ x: number; freq: number }> = [];
    for (const r of rows) {
      const x = Number(r.x);
      const freq = r.freq === '' || r.freq === undefined ? 1 : Number(r.freq);
      if (Number.isFinite(x) && Number.isFinite(freq) && freq > 0) {
        validRows.push({ x, freq: Math.round(freq) });
      }
    }
    if (validRows.length === 0) return { ok: false, messageLatex: '\\text{Data ERROR}' };

    validRows.sort((a, b) => a.x - b.x);
    let n = 0;
    let sumX = 0;
    let sumX2 = 0;
    const expanded: number[] = [];

    for (const item of validRows) {
      n += item.freq;
      sumX += item.x * item.freq;
      sumX2 += item.x * item.x * item.freq;
      for (let k = 0; k < item.freq; k++) {
        if (expanded.length < 5000) expanded.push(item.x);
      }
    }

    if (n === 0) return { ok: false, messageLatex: '\\text{Data ERROR}' };

    const mean = sumX / n;
    let sumDiffSq = 0;
    for (const item of validRows) {
      sumDiffSq += item.freq * Math.pow(item.x - mean, 2);
    }

    const popVar = sumDiffSq / n;
    const popStd = Math.sqrt(popVar);
    const sampleVar = n > 1 ? sumDiffSq / (n - 1) : 0;
    const sampleStd = Math.sqrt(sampleVar);

    const getMedianOfArr = (arr: number[]) => {
      const len = arr.length;
      if (len === 0) return 0;
      const mid = Math.floor(len / 2);
      return len % 2 === 1 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
    };

    const minX = validRows[0].x;
    const maxX = validRows[validRows.length - 1].x;
    const Q2 = getMedianOfArr(expanded);
    let Q1 = minX;
    let Q3 = maxX;

    if (expanded.length >= 2) {
      const half = Math.floor(expanded.length / 2);
      const lowerHalf = expanded.slice(0, half);
      const upperHalf = expanded.length % 2 === 0 ? expanded.slice(half) : expanded.slice(half + 1);
      Q1 = getMedianOfArr(lowerHalf);
      Q3 = getMedianOfArr(upperHalf);
    }
    const deltaQ = Q3 - Q1;

    const makeItem = (label: string, val: number) => ({
      label,
      exactLatex: formatNumberToLatex(val, true),
      decimalLatex: formatNumberToLatex(val, false),
    });

    return {
      ok: true,
      items: [
        makeItem('n\\;(\\text{Cỡ mẫu})', n),
        makeItem('\\bar{x}\\;(\\text{Trung bình})', mean),
        makeItem('Q_1\\;(\\text{Tứ phân vị 1})', Q1),
        makeItem('Q_2\\;(\\text{Trung vị } M_e)', Q2),
        makeItem('Q_3\\;(\\text{Tứ phân vị 3})', Q3),
        makeItem('\\Delta_Q = Q_3 - Q_1', deltaQ),
        makeItem('\\sigma_x^2\\;(\\text{Phương sai})', popVar),
        makeItem('\\sigma_x\\;(\\text{Độ lệch chuẩn})', popStd),
        makeItem('s_x^2\\;(\\text{PS hiệu chỉnh})', sampleVar),
        makeItem('s_x\\;(\\text{ĐLC hiệu chỉnh})', sampleStd),
        makeItem('\\sum x', sumX),
        makeItem('\\sum x^2', sumX2),
        makeItem('\\min(x)', minX),
        makeItem('\\max(x)', maxX),
      ],
    };
  };

  const calculateGroupedStats = (rows: any[]) => {
    const groups: Array<{ L: number; U: number; freq: number; mid: number; width: number }> = [];
    for (const r of rows) {
      const L = Number(r.L);
      const U = Number(r.U);
      const freq = Number(r.freq);
      if (Number.isFinite(L) && Number.isFinite(U) && U > L && Number.isFinite(freq) && freq >= 0) {
        groups.push({ L, U, freq, mid: (L + U) / 2, width: U - L });
      }
    }

    const n = groups.reduce((acc, g) => acc + g.freq, 0);
    if (groups.length === 0 || n <= 0) {
      return { ok: false, messageLatex: '\\text{Data ERROR (Kiểm tra } L < U, n > 0)' };
    }

    const sumMid = groups.reduce((acc, g) => acc + g.freq * g.mid, 0);
    const mean = sumMid / n;

    const sumSqDiff = groups.reduce((acc, g) => acc + g.freq * Math.pow(g.mid - mean, 2), 0);
    const popVar = sumSqDiff / n;
    const popStd = Math.sqrt(popVar);
    const sampleVar = n > 1 ? sumSqDiff / (n - 1) : popVar;
    const sampleStd = Math.sqrt(sampleVar);

    const computeQuartile = (k: number) => {
      const target = (k * n) / 4;
      let cumBefore = 0;
      for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        const cumAfter = cumBefore + g.freq;
        if (cumAfter >= target - 1e-11) {
          if (g.freq === 0) return g.L;
          return g.L + ((target - cumBefore) / g.freq) * g.width;
        }
        cumBefore = cumAfter;
      }
      return groups[groups.length - 1].U;
    };

    const Q1 = computeQuartile(1);
    const Q2 = computeQuartile(2);
    const Q3 = computeQuartile(3);
    const deltaQ = Q3 - Q1;

    let modalIdx = 0;
    for (let i = 1; i < groups.length; i++) {
      if (groups[i].freq > groups[modalIdx].freq) modalIdx = i;
    }
    const gModal = groups[modalIdx];
    const nPrev = modalIdx > 0 ? groups[modalIdx - 1].freq : 0;
    const nNext = modalIdx < groups.length - 1 ? groups[modalIdx + 1].freq : 0;
    const d1 = gModal.freq - nPrev;
    const d2 = gModal.freq - nNext;
    const Mo = d1 + d2 > 0 ? gModal.L + (d1 / (d1 + d2)) * gModal.width : gModal.mid;

    const makeItem = (label: string, val: number) => ({
      label,
      exactLatex: formatNumberToLatex(val, true),
      decimalLatex: formatNumberToLatex(val, false),
    });

    return {
      ok: true,
      items: [
        makeItem('Q_1\\;(\\text{Tứ phân vị 1})', Q1),
        makeItem('Q_2\\;(\\text{Trung vị } M_e)', Q2),
        makeItem('Q_3\\;(\\text{Tứ phân vị 3})', Q3),
        makeItem('\\Delta_Q = Q_3 - Q_1', deltaQ),
        makeItem('M_o\\;(\\text{Mốt ghép nhóm})', Mo),
        makeItem('\\bar{x}\\;(\\text{Số trung bình})', mean),
        makeItem('n\\;(\\text{Cỡ mẫu } \\sum n_i)', n),
        makeItem('s^2\\;(\\text{Phương sai } /n)', popVar),
        makeItem('s\\;(\\text{Độ lệch chuẩn})', popStd),
        makeItem('s_{\\text{hc}}^2\\;(\\text{PS } /(n-1))', sampleVar),
        makeItem('s_{\\text{hc}}\\;(\\text{ĐLC } /(n-1))', sampleStd),
      ],
    };
  };

  return {
    formatNumberToLatex,
    compileSlotToMathJs,
    evaluateExpressionString,
    evaluateCompTree,
    solveSingleVariableEquation,
    solveLinearSystem,
    solvePolynomialEquation,
    generateFunctionTable,
    extractVariablesFromTree,
    evaluateVectorExpression,
    calculateUngroupedStats,
    calculateGroupedStats,
  };
})();

const createInitialEmptyTree = () => {
  const rootSlot = createSlot([]);
  return {
    rootSlot,
    cursor: { slotId: rootSlot.id, index: 0 },
  };
};

/**
 * ============================================================================
 * 4. DỮ LIỆU BÀN PHÍM CASIO fx-580VN X
 * ============================================================================
 */
const SCIENTIFIC_ROWS = [
  [
    { id: 'optn', mainLatex: '\\mathsf{OPTN}', shiftText: 'SOLVE', alphaText: '=', shiftAction: { type: 'token', latex: '=' }, alphaAction: { type: 'token', latex: '=' } },
    { id: 'calc', mainLatex: '\\mathsf{CALC}', shiftText: 'd/dx', alphaText: ':', shiftAction: { type: 'struct', nodeType: 'deriv' }, alphaAction: { type: 'token', latex: ':' } },
    null,
    null,
    { id: 'int', mainLatex: '\\int_{\\square}^{\\square}', shiftText: 'd/dx', alphaText: '', action: { type: 'struct', nodeType: 'int' }, shiftAction: { type: 'struct', nodeType: 'deriv' } },
    { id: 'varx', mainLatex: 'x', shiftText: '∏', alphaText: 'e', isItalic: true, action: { type: 'token', latex: 'x' }, alphaAction: { type: 'token', latex: '\\mathrm{e}' } },
  ],
  [
    { id: 'frac', mainLatex: '\\frac{\\blacksquare}{\\square}', shiftText: '■ □/□', alphaText: '', action: { type: 'struct', nodeType: 'frac' }, shiftAction: { type: 'struct', nodeType: 'mixedfrac' } },
    { id: 'sqrt', mainLatex: '\\sqrt{\\blacksquare}', shiftText: '³√■', alphaText: '', action: { type: 'struct', nodeType: 'sqrt' }, shiftAction: { type: 'struct', nodeType: 'cbrt' } },
    { id: 'sqr', mainLatex: 'x^2', shiftText: 'x³', alphaText: 'DEC', action: { type: 'pow2' }, shiftAction: { type: 'pow3' } },
    { id: 'pow', mainLatex: 'x^{\\blacksquare}', shiftText: 'ⁿ√■', alphaText: 'HEX', action: { type: 'struct', nodeType: 'pow' }, shiftAction: { type: 'struct', nodeType: 'nthroot' } },
    { id: 'log', mainLatex: '\\log_{\\blacksquare}\\square', shiftText: '10^■', alphaText: 'BIN', action: { type: 'struct', nodeType: 'log2' }, shiftAction: { type: 'tenpow' } },
    { id: 'ln', mainLatex: '\\mathsf{ln}', shiftText: 'e^■', alphaText: 'OCT', action: { type: 'token', latex: '\\ln(' }, shiftAction: { type: 'epow' } },
  ],
  [
    { id: 'neg', mainLatex: '(-)', shiftText: '∠', alphaText: 'A', action: { type: 'token', latex: '-' }, alphaAction: { type: 'token', latex: 'A' } },
    { id: 'dms', mainLatex: '^{\\circ}\\,\\prime\\,\\prime\\prime', shiftText: 'FACT', alphaText: 'B', action: { type: 'token', latex: '^{\\circ}' }, alphaAction: { type: 'token', latex: 'B' } },
    { id: 'inv', mainLatex: 'x^{-1}', shiftText: 'x!', alphaText: 'C', action: { type: 'pow_neg1' }, shiftAction: { type: 'token', latex: '!' }, alphaAction: { type: 'token', latex: 'C' } },
    { id: 'sin', mainLatex: '\\mathsf{sin}', shiftText: 'sin⁻¹', alphaText: 'D', action: { type: 'token', latex: '\\sin(' }, shiftAction: { type: 'token', latex: '\\sin^{-1}(' }, alphaAction: { type: 'token', latex: 'D' } },
    { id: 'cos', mainLatex: '\\mathsf{cos}', shiftText: 'cos⁻¹', alphaText: 'E', action: { type: 'token', latex: '\\cos(' }, shiftAction: { type: 'token', latex: '\\cos^{-1}(' }, alphaAction: { type: 'token', latex: 'E' } },
    { id: 'tan', mainLatex: '\\mathsf{tan}', shiftText: 'tan⁻¹', alphaText: 'F', action: { type: 'token', latex: '\\tan(' }, shiftAction: { type: 'token', latex: '\\tan^{-1}(' }, alphaAction: { type: 'token', latex: 'F' } },
  ],
  [
    { id: 'sto', mainLatex: '\\mathsf{STO}', shiftText: 'RCL', alphaText: 'i', action: { type: 'sto' } },
    { id: 'eng', mainLatex: '\\mathsf{ENG}', shiftText: '←', alphaText: '%', shiftAction: { type: 'token', latex: '\\%' }, alphaAction: { type: 'token', latex: '\\%' } },
    { id: 'lpar', mainLatex: '(', shiftText: 'Abs', alphaText: 'x', action: { type: 'token', latex: '(' }, shiftAction: { type: 'struct', nodeType: 'abs' }, alphaAction: { type: 'token', latex: 'x' } },
    { id: 'rpar', mainLatex: ')', shiftText: ',', alphaText: 'y', action: { type: 'token', latex: ')' }, shiftAction: { type: 'token', latex: ',' }, alphaAction: { type: 'token', latex: 'y' } },
    { id: 'sd', mainLatex: '\\mathsf{S{\\Leftrightarrow}D}', shiftText: 'a b/c⇔d/c', alphaText: 'z', alphaAction: { type: 'token', latex: 'z' } },
    { id: 'mplus', mainLatex: '\\mathsf{M+}', shiftText: 'M-', alphaText: 'M', alphaAction: { type: 'token', latex: 'M' } },
  ],
];

const NUMPAD_ROWS = [
  [
    { id: 'num7', mainLatex: '\\mathbf{7}', shiftText: 'CONST', alphaText: '', variant: 'num', action: { type: 'token', latex: '7' } },
    { id: 'num8', mainLatex: '\\mathbf{8}', shiftText: 'CONV', alphaText: '', variant: 'num', action: { type: 'token', latex: '8' } },
    { id: 'num9', mainLatex: '\\mathbf{9}', shiftText: 'RESET', alphaText: '', variant: 'num', action: { type: 'token', latex: '9' } },
    { id: 'del', mainLatex: '\\mathsf{DEL}', shiftText: 'INS', alphaText: 'UNDO', variant: 'blue', action: { type: 'del' } },
    { id: 'ac', mainLatex: '\\mathsf{AC}', shiftText: 'OFF', alphaText: '', variant: 'blue', action: { type: 'ac' } },
  ],
  [
    { id: 'num4', mainLatex: '\\mathbf{4}', shiftText: '', alphaText: '', variant: 'num', action: { type: 'token', latex: '4' } },
    { id: 'num5', mainLatex: '\\mathbf{5}', shiftText: '', alphaText: '', variant: 'num', action: { type: 'token', latex: '5' } },
    { id: 'num6', mainLatex: '\\mathbf{6}', shiftText: '', alphaText: '', variant: 'num', action: { type: 'token', latex: '6' } },
    { id: 'mul', mainLatex: '\\times', shiftText: 'nPr', alphaText: 'GCD', variant: 'op', action: { type: 'token', latex: '\\times ' }, shiftAction: { type: 'token', latex: '\\boldsymbol{\\mathrm{P}}' }, alphaAction: { type: 'token', latex: '\\text{GCD}(' } },
    { id: 'div', mainLatex: '\\div', shiftText: 'nCr', alphaText: 'LCM', variant: 'op', action: { type: 'token', latex: '\\div ' }, shiftAction: { type: 'token', latex: '\\boldsymbol{\\mathrm{C}}' }, alphaAction: { type: 'token', latex: '\\text{LCM}(' } },
  ],
  [
    { id: 'num1', mainLatex: '\\mathbf{1}', shiftText: 'STAT', alphaText: '', variant: 'num', action: { type: 'token', latex: '1' } },
    { id: 'num2', mainLatex: '\\mathbf{2}', shiftText: 'COMPLX', alphaText: '', variant: 'num', action: { type: 'token', latex: '2' } },
    { id: 'num3', mainLatex: '\\mathbf{3}', shiftText: 'BASE', alphaText: '', variant: 'num', action: { type: 'token', latex: '3' } },
    { id: 'add', mainLatex: '+', shiftText: 'Pol', alphaText: 'Int', variant: 'op', action: { type: 'token', latex: '+' }, shiftAction: { type: 'token', latex: '\\text{Pol}(' }, alphaAction: { type: 'token', latex: '\\text{Int}(' } },
    { id: 'sub', mainLatex: '-', shiftText: 'Rec', alphaText: 'Intg', variant: 'op', action: { type: 'token', latex: '-' }, shiftAction: { type: 'token', latex: '\\text{Rec}(' }, alphaAction: { type: 'token', latex: '\\text{Intg}(' } },
  ],
  [
    { id: 'num0', mainLatex: '\\mathbf{0}', shiftText: 'Rnd', alphaText: '', variant: 'num', action: { type: 'token', latex: '0' } },
    { id: 'dot', mainLatex: '\\bullet', shiftText: 'Ran#', alphaText: 'RanInt', variant: 'num', action: { type: 'token', latex: '.' }, shiftAction: { type: 'token', latex: '\\text{Ran\\#}' }, alphaAction: { type: 'token', latex: '\\text{RanInt\\#}(' } },
    { id: 'exp', mainLatex: '\\times 10^x', shiftText: 'π', alphaText: 'e', variant: 'num', action: { type: 'token', latex: '\\times 10^{' }, shiftAction: { type: 'token', latex: '\\pi ' }, alphaAction: { type: 'token', latex: '\\mathrm{e}' } },
    { id: 'ans', mainLatex: '\\mathsf{Ans}', shiftText: 'DRG', alphaText: 'PreAns', variant: 'num', action: { type: 'token', latex: '\\text{Ans}' } },
    { id: 'eq', mainLatex: '=', shiftText: '≈', alphaText: '', variant: 'eq', action: { type: 'eval' } },
  ],
];

const ChalkboardDoodles = () => (
  <div className="pointer-events-none fixed inset-0 overflow-hidden select-none z-0">
    <svg className="absolute top-6 left-6 w-64 h-64 text-white/15" viewBox="0 0 200 200" fill="none">
      <path d="M 30 150 L 160 150 L 160 40 Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 2" />
      <rect x="145" y="135" width="15" height="15" stroke="currentColor" strokeWidth="1.5" />
      <text x="90" y="170" fill="currentColor" fontSize="13" fontFamily="serif" fontStyle="italic">a</text>
      <text x="168" y="100" fill="currentColor" fontSize="13" fontFamily="serif" fontStyle="italic">b</text>
      <text x="75" y="90" fill="currentColor" fontSize="13" fontFamily="serif" fontStyle="italic">c = √(a² + b²)</text>
    </svg>
    <svg className="absolute bottom-8 right-6 w-72 h-72 text-white/15" viewBox="0 0 220 220" fill="none">
      <line x1="20" y1="110" x2="200" y2="110" stroke="currentColor" strokeWidth="1.5" />
      <line x1="110" y1="20" x2="110" y2="200" stroke="currentColor" strokeWidth="1.5" />
      <path d="M 50 30 Q 110 190 170 30" stroke="currentColor" strokeWidth="2" fill="none" />
      <text x="145" y="55" fill="currentColor" fontSize="12" fontFamily="serif" fontStyle="italic">y = ax² + bx + c</text>
    </svg>
  </div>
);

/**
 * ============================================================================
 * CÁC PHÍM BẤM ĐƯỢC MEMO HÓA & TỐI ƯU CẢM ỨNG 0MS CHO MÀN HÌNH TIVI 75 INCH
 * ============================================================================
 */
interface KeypadButtonProps {
  keyItem: any;
  onPress: (keyItem: any, e?: React.SyntheticEvent) => void;
  katexLoaded: boolean;
}

const ScientificKeyButton = React.memo<KeypadButtonProps>(({ keyItem, onPress, katexLoaded }) => {
  return (
    <div className="flex flex-col items-center select-none" style={{ touchAction: 'none' }}>
      <div className="w-full h-[11px] flex items-end justify-between px-[1px] pb-[1px] text-[6.5px] font-bold leading-none whitespace-nowrap overflow-hidden pointer-events-none">
        <span className="text-[#e5b546] tracking-tighter truncate">{keyItem.shiftText}</span>
        <span className="text-[#e05368] tracking-tighter ml-auto">{keyItem.alphaText}</span>
      </div>
      <button
        type="button"
        onTouchStart={(e) => {
          e.stopPropagation();
          onPress(keyItem, e);
        }}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') return;
          e.stopPropagation();
          onPress(keyItem, e);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onPress(keyItem, e);
        }}
        style={{ touchAction: 'none' }}
        className="w-full h-[24px] rounded-[6px] bg-gradient-to-b from-[#383d47] via-[#272b33] to-[#1c1f26] border-t border-x border-zinc-500/40 shadow-[0_2.5px_0_#0b0d11,0_3px_4px_rgba(0,0,0,0.6)] active:translate-y-[1px] active:scale-[0.96] active:brightness-125 transition-transform duration-75 flex items-center justify-center px-0.5 cursor-pointer select-none"
      >
        <KatexScreenRenderer
          latex={keyItem.mainLatex}
          isReady={katexLoaded}
          className="text-[10px] text-white leading-none pointer-events-none"
        />
      </button>
    </div>
  );
});

const NumpadKeyButton = React.memo<KeypadButtonProps>(({ keyItem, onPress, katexLoaded }) => {
  const isBlue = keyItem.variant === 'blue';
  const buttonStyle = isBlue
    ? 'bg-gradient-to-b from-[#386796] via-[#285078] to-[#1d3d5e] border-t border-x border-[#6798c9]/50 text-white shadow-[0_3px_0_#0f2338,0_4px_5px_rgba(0,0,0,0.65)]'
    : 'bg-gradient-to-b from-[#f8fafc] via-[#e5e7eb] to-[#d1d5db] border-t border-x border-white text-zinc-900 shadow-[0_3px_0_#6b7280,0_4px_6px_rgba(0,0,0,0.55)]';

  return (
    <div className="flex flex-col items-center select-none" style={{ touchAction: 'none' }}>
      <div className="w-full h-[11px] flex items-end justify-between px-[1.5px] pb-[1px] text-[7px] font-extrabold leading-none whitespace-nowrap overflow-hidden pointer-events-none">
        <span className="text-[#e5b546] tracking-tight truncate">{keyItem.shiftText}</span>
        <span className="text-[#e05368] tracking-tight ml-auto">{keyItem.alphaText}</span>
      </div>
      <button
        type="button"
        onTouchStart={(e) => {
          e.stopPropagation();
          onPress(keyItem, e);
        }}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') return;
          e.stopPropagation();
          onPress(keyItem, e);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onPress(keyItem, e);
        }}
        style={{ touchAction: 'none' }}
        className={`w-full h-[31px] rounded-[8px] active:translate-y-[1.5px] active:scale-[0.96] active:brightness-110 flex items-center justify-center cursor-pointer select-none transition-all duration-75 ${buttonStyle}`}
      >
        <KatexScreenRenderer
          latex={keyItem.mainLatex}
          isReady={katexLoaded}
          className={`${isBlue ? 'text-[11.5px] text-white' : 'text-[14.5px] text-zinc-900'} pointer-events-none`}
        />
      </button>
    </div>
  );
});

/**
 * ============================================================================
 * 5. COMPONENT CHÍNH: CASIO fx-580VN X
 * ============================================================================
 */
interface StatGroupedRow {
  L: string;
  U: string;
  freq: string;
}

interface Stat1VarRow {
  x: string;
  freq: string;
}

interface CasioState {
  mode: string;
  rootSlot: any;
  cursor: any;
  resultLatex: string;
  exactResultLatex: string;
  decimalResultLatex: string;
  showingDecimal: boolean;
  ansValue: number;
  memoryVars: Record<string, number>;
  shift: boolean;
  alpha: boolean;
  stoMode: boolean;
  angleUnit: string;
  undoStack: any[];
  promptVars: string[];
  promptVarIndex: number;
  promptInputBuffer: string;
  eqnType: string;
  eqnSize: number;
  eqnMatrix: any[][];
  eqnPolyCoeffs: any[];
  eqnRow: number;
  eqnCol: number;
  eqnInputBuffer: string;
  eqnSolutions: any[];
  eqnSolIndex: number;
  tableFSlot: any;
  tableGSlot: any;
  tableParams: Record<string, string>;
  tableParamIndex: number;
  tableParamBuffer: string;
  tableRows: any[];
  tableHasG: boolean;
  tableScroll: number;
  vectors: Record<string, { dim: number; coords: string[] }>;
  vctAns: { dim: number; coords: any[] };
  activeVctName: string;
  vctCoordIndex: number;
  vctInputBuffer: string;
  vctCalcSlot: any;
  statType: string;
  stat1VarRows: Stat1VarRow[];
  statGroupedRows: StatGroupedRow[];
  statRow: number;
  statCol: number;
  statInputBuffer: string;
  statResults: any[];
  statResultIndex: number;
}

function getAllEqnLinesForBigScreen(state: CasioState): string[] {
  if (state.eqnType === 'SYS') {
    const vars = ['x', 'y', 'z', 't'].slice(0, state.eqnSize);
    const lines: string[] = [];
    for (let r = 0; r < state.eqnSize; r++) {
      const row = state.eqnMatrix[r];
      const lhs = vars
        .map((v: string, c: number) => {
          const cell =
            r === state.eqnRow && c === state.eqnCol
              ? `\\colorbox{#141c14}{$\\color{#c8d3c5}{${row[c]}}$}`
              : row[c];
          return `${cell}${v}`;
        })
        .join(' + ');
      const rhs =
        r === state.eqnRow && state.eqnCol === state.eqnSize
          ? `\\colorbox{#141c14}{$\\color{#c8d3c5}{${row[state.eqnSize]}}$}`
          : row[state.eqnSize];
      lines.push(`(\\text{PT } ${r + 1})\\quad ${lhs} = ${rhs}`);
    }
    return lines;
  } else {
    const deg = state.eqnSize;
    const terms: string[] = [];
    for (let c = 0; c <= deg; c++) {
      const p = deg - c;
      const raw = state.eqnPolyCoeffs[c];
      const cell = c === state.eqnCol ? `\\colorbox{#141c14}{$\\color{#c8d3c5}{${raw}}$}` : raw;
      const xPart = p === 0 ? '' : p === 1 ? 'x' : `x^${p}`;
      terms.push(`${cell}${xPart}`);
    }
    return [`${terms.join(' + ')} = 0`];
  }
}

/**
 * ============================================================================
 * 5. MÀN HÌNH LỚN CHO HỌC SINH (CLASSROOM BIG SCREEN PANEL)
 * ============================================================================
 */
interface ClassroomBigScreenProps {
  calcState: CasioState;
  setCalcState: React.Dispatch<React.SetStateAction<CasioState>>;
  katexLoaded: boolean;
  currentLatexExpression: string;
  onClose: () => void;
}

function ClassroomBigScreen({
  calcState,
  setCalcState,
  katexLoaded,
  currentLatexExpression,
  onClose,
}: ClassroomBigScreenProps) {
  const modeTitleMap: Record<string, string> = {
    COMP: 'CHẾ ĐỘ TÍNH TOÁN CHUNG (COMP)',
    MENU: 'DANH MỤC CHẾ ĐỘ MÁY TÍNH (MENU)',
    STAT_SELECT: 'THỐNG KÊ (MENU 6: CHỌN LOẠI MẪU SỐ LIỆU)',
    STAT_INPUT:
      calcState.statType === 'GROUPED'
        ? 'THỐNG KÊ MẪU SỐ LIỆU GHÉP NHÓM [Lᵢ ; Uᵢ)'
        : 'THỐNG KÊ ĐƠN BIẾN (MẪU KHÔNG GHÉP NHÓM)',
    STAT_RESULT:
      calcState.statType === 'GROUPED'
        ? 'KẾT QUẢ ĐẶC TRƯNG & TỨ PHÂN VỊ MẪU GHÉP NHÓM'
        : 'KẾT QUẢ CÁC SỐ ĐẶC TRƯNG THỐNG KÊ ĐƠN BIẾN',
    EQN_SELECT: 'GIẢI PHƯƠNG TRÌNH & HỆ PHƯƠNG TRÌNH (MENU 9)',
    EQN_SYS_SIZE: 'CHỌN SỐ ẨN CỦA HỆ PHƯƠNG TRÌNH (2 ~ 4 ẨN)',
    EQN_POLY_DEG: 'CHỌN BẬC CỦA PHƯƠNG TRÌNH ĐA THỨC (BẬC 2 ~ 3)',
    EQN_INPUT:
      calcState.eqnType === 'SYS'
        ? `NHẬP HỆ PHƯƠNG TRÌNH BẬC NHẤT ${calcState.eqnSize} ẨN`
        : `NHẬP PHƯƠNG TRÌNH BẬC ${calcState.eqnSize}`,
    EQN_RESULT: 'NGHIỆM CỦA PHƯƠNG TRÌNH / HỆ PHƯƠNG TRÌNH',
    TABLE_F: 'BẢNG GIÁ TRỊ HÀM SỐ: NHẬP HÀM f(x)',
    TABLE_G: 'BẢNG GIÁ TRỊ HÀM SỐ: NHẬP HÀM g(x)',
    TABLE_PARAMS: 'THIẾT LẬP MIỀN GIÁ TRỊ BẢNG (START, END, STEP)',
    TABLE_VIEW: 'BẢNG GIÁ TRỊ HÀM SỐ f(x), g(x)',
    VCT_SELECT: 'CHẾ ĐỘ VECTƠ (MENU 5: CHỌN VECTƠ)',
    VCT_DIM: `CHỌN SỐ CHIỀU CHO ${calcState.activeVctName}`,
    VCT_EDIT: `NHẬP TỌA ĐỘ VECTƠ ${calcState.activeVctName} (${calcState.vectors[calcState.activeVctName]?.dim || 3}D)`,
    VCT_OPTN: 'DANH MỤC PHÉP TOÁN VECTƠ (OPTN)',
    VCT_CALC: 'TÍNH TOÁN BIỂU THỨC VECTƠ',
    CALC_PROMPT: 'TÍNH GIÁ TRỊ BIỂU THỨC TẠI ĐIỂM (CALC)',
    SOLVE_PROMPT: 'DÒ NGHIỆM PHƯƠNG TRÌNH (SOLVE)',
  };

  return (
    <div className="w-full max-w-[680px] rounded-[28px] p-4 sm:p-6 bg-[#0b1710] border-2 border-emerald-400/40 shadow-2xl text-white flex flex-col justify-between transition-all duration-300">
      {/* Header Màn Hình Lớn */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-white/15">
        <div className="flex items-center gap-2.5">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold tracking-wide text-emerald-300 uppercase">
              MÀN HÌNH TRÌNH CHIẾU LỚP HỌC (PHÓNG ĐẠI)
            </h2>
            <p className="text-[11px] text-white/70">
              {modeTitleMap[calcState.mode] || 'MÀN HÌNH HIỂN THỊ CHI TIẾT CHO HỌC SINH'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setCalcState((p) => ({
                ...p,
                showingDecimal: !p.showingDecimal,
                resultLatex:
                  p.exactResultLatex && p.decimalResultLatex
                    ? !p.showingDecimal
                      ? p.decimalResultLatex
                      : p.exactResultLatex
                    : p.resultLatex,
              }))
            }
            className="px-3 py-1 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 border border-amber-300/40 text-amber-200 text-xs font-bold transition cursor-pointer"
          >
            S⇔D: {calcState.showingDecimal ? 'Số thập phân' : 'Phân số chuẩn'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-white/10 hover:bg-rose-500/40 border border-white/20 text-white/90 text-xs font-semibold transition cursor-pointer"
          >
            ✕ Thu nhỏ
          </button>
        </div>
      </div>

      {/* KHUNG LCD PHÓNG ĐẠI (MÀU MÀN HÌNH CASIO THẬT) */}
      <div
        className="w-full min-h-[220px] rounded-[18px] p-4 sm:p-5 flex flex-col justify-between shadow-[inset_0_4px_12px_rgba(0,0,0,0.45)] border-2 border-[#8c9c87] text-[#0e140e]"
        style={{
          background: 'linear-gradient(180deg, #cfdacb 0%, #c2cfc0 60%, #b6c4b3 100%)',
        }}
      >
        {/* Thanh trạng thái phóng đại */}
        <div className="flex items-center justify-between border-b-2 border-[#141c14]/20 pb-2 mb-3 text-xs sm:text-sm font-bold text-[#141c14]">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded ${calcState.shift ? 'bg-[#141c14] text-[#cfdacb]' : 'bg-[#141c14]/10 text-[#141c14]/40'}`}>
              SHIFT
            </span>
            <span className={`px-2 py-0.5 rounded ${calcState.alpha ? 'bg-[#141c14] text-[#cfdacb]' : 'bg-[#141c14]/10 text-[#141c14]/40'}`}>
              ALPHA
            </span>
            <span className="px-2 py-0.5 border border-[#141c14]/60 rounded">√□ MathIO</span>
            <span className="px-2.5 py-0.5 bg-[#141c14] text-[#cfdacb] rounded">
              Đơn vị góc: {calcState.angleUnit === 'D' ? 'Độ (D)' : calcState.angleUnit === 'R' ? 'Radian (R)' : 'Gradian (G)'}
            </span>
          </div>
          <span className="font-extrabold tracking-wider uppercase">{calcState.mode}</span>
        </div>

        {/* 1. CHẾ ĐỘ COMP / VCT_CALC */}
        {(calcState.mode === 'COMP' || calcState.mode === 'VCT_CALC') && (
          <div className="flex-1 flex flex-col justify-between py-2">
            <div className="overflow-x-auto py-2">
              <div className="text-xs uppercase font-bold text-[#141c14]/60 mb-1">Biểu thức đang nhập:</div>
              <KatexScreenRenderer
                latex={`\\displaystyle ${
                  calcState.mode === 'VCT_CALC'
                    ? serializeSlotToLatex(calcState.vctCalcSlot, calcState.cursor, true)
                    : currentLatexExpression
                }`}
                isReady={katexLoaded}
                className="text-2xl sm:text-3xl text-[#0e140e] font-semibold"
              />
            </div>

            <div className="border-t border-[#141c14]/20 pt-3 mt-2 flex items-end justify-between">
              <span className="text-xs uppercase font-bold text-[#141c14]/65">Kết quả tính toán:</span>
              {calcState.resultLatex ? (
                <KatexScreenRenderer
                  latex={`\\displaystyle ${calcState.resultLatex}`}
                  isReady={katexLoaded}
                  className="text-3xl sm:text-4xl text-[#0b110b] font-extrabold"
                />
              ) : (
                <span className="text-sm italic text-[#141c14]/50">Bấm phím [=] để xem kết quả</span>
              )}
            </div>
          </div>
        )}

        {/* 2. CHẾ ĐỘ MENU / SELECT */}
        {(calcState.mode === 'MENU' ||
          calcState.mode === 'STAT_SELECT' ||
          calcState.mode === 'EQN_SELECT' ||
          calcState.mode === 'EQN_SYS_SIZE' ||
          calcState.mode === 'EQN_POLY_DEG' ||
          calcState.mode === 'VCT_SELECT' ||
          calcState.mode === 'VCT_DIM' ||
          calcState.mode === 'VCT_OPTN') && (
          <div className="flex-1 flex flex-col justify-center gap-3 py-2">
            {calcState.mode === 'MENU' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-base font-bold">
                <div className="p-2.5 rounded-lg bg-[#141c14]/10">1 : COMP (Tính toán cơ bản, Tích phân, Đạo hàm)</div>
                <div className="p-2.5 rounded-lg bg-[#141c14]/10">5 : Vector (Phép toán Vectơ 2D / 3D)</div>
                <div className="p-2.5 rounded-lg bg-[#141c14]/15 border border-[#141c14]/30">
                  6 : Statistics (Thống kê & Tứ phân vị ghép nhóm)
                </div>
                <div className="p-2.5 rounded-lg bg-[#141c14]/10">8 : Table (Lập bảng giá trị hàm số f(x), g(x))</div>
                <div className="p-2.5 rounded-lg bg-[#141c14]/10 sm:col-span-2">
                  9 : Equation/Func (Giải hệ phương trình 2~4 ẩn & Phương trình bậc 2, 3)
                </div>
              </div>
            )}
            {calcState.mode === 'STAT_SELECT' && (
              <div className="space-y-3 text-lg font-bold">
                <div className="p-3 rounded-lg bg-[#141c14]/10">
                  Bấm phím [1] : Thống kê 1 biến không ghép nhóm (xᵢ, nᵢ)
                </div>
                <div className="p-3 rounded-lg bg-[#141c14] text-[#cfdacb]">
                  Bấm phím [2] : Mẫu số liệu ghép nhóm [Lᵢ ; Uᵢ) — Tính Q₁, Q₂ (Mₑ), Q₃, ΔQ, Mₒ, x̄, s
                </div>
              </div>
            )}
            {calcState.mode === 'EQN_SELECT' && (
              <div className="space-y-3 text-lg font-bold">
                <div className="p-3 rounded-lg bg-[#141c14]/10">Bấm phím [1] : Giải Hệ phương trình bậc nhất (2, 3, 4 ẩn)</div>
                <div className="p-3 rounded-lg bg-[#141c14]/10">Bấm phím [2] : Giải Phương trình đa thức (Bậc 2, Bậc 3)</div>
              </div>
            )}
            {(calcState.mode === 'EQN_SYS_SIZE' ||
              calcState.mode === 'EQN_POLY_DEG' ||
              calcState.mode === 'VCT_SELECT' ||
              calcState.mode === 'VCT_DIM' ||
              calcState.mode === 'VCT_OPTN') && (
              <div className="text-lg font-bold text-center py-6">
                Hãy bấm phím số tương ứng trên bàn phím máy tính bên trái để tiếp tục.
              </div>
            )}
          </div>
        )}

        {/* 3. CHẾ ĐỘ THỐNG KÊ: NHẬP LIỆU & KẾT QUẢ */}
        {calcState.mode === 'STAT_INPUT' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="text-xs sm:text-sm font-bold mb-2 flex items-center justify-between">
              <span>
                Đang chọn dòng {calcState.statRow + 1} — Nhập số rồi bấm [=] để sang ô tiếp theo
              </span>
              <span className="px-2 py-0.5 rounded bg-[#141c14] text-[#cfdacb]">
                Bấm [OPTN] để xuất kết quả Q₁, Q₂, Q₃
              </span>
            </div>
            <div className="overflow-x-auto max-h-[210px] rounded-lg border border-[#141c14]/30">
              {calcState.statType === 'GROUPED' ? (
                <table className="w-full text-left border-collapse text-sm sm:text-base font-bold">
                  <thead>
                    <tr className="bg-[#141c14] text-[#cfdacb]">
                      <th className="py-1.5 px-3">Nhóm</th>
                      <th className="py-1.5 px-3">Đầu mút trái (Lᵢ)</th>
                      <th className="py-1.5 px-3">Đầu mút phải (Uᵢ)</th>
                      <th className="py-1.5 px-3">Giá trị đại diện (cᵢ)</th>
                      <th className="py-1.5 px-3">Tần số (nᵢ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calcState.statGroupedRows.map((r, rIdx) => {
                      const mid = (Number(r.L) + Number(r.U)) / 2;
                      return (
                        <tr
                          key={rIdx}
                          className={`border-b border-[#141c14]/20 ${
                            rIdx === calcState.statRow ? 'bg-[#141c14]/15' : ''
                          }`}
                        >
                          <td className="py-1.5 px-3">[{r.L} ; {r.U})</td>
                          <td className={`py-1.5 px-3 ${rIdx === calcState.statRow && calcState.statCol === 0 ? 'bg-[#141c14] text-[#cfdacb] rounded' : ''}`}>
                            {r.L}
                          </td>
                          <td className={`py-1.5 px-3 ${rIdx === calcState.statRow && calcState.statCol === 1 ? 'bg-[#141c14] text-[#cfdacb] rounded' : ''}`}>
                            {r.U}
                          </td>
                          <td className="py-1.5 px-3 opacity-75">{Number.isFinite(mid) ? mid : '-'}</td>
                          <td className={`py-1.5 px-3 ${rIdx === calcState.statRow && calcState.statCol === 2 ? 'bg-[#141c14] text-[#cfdacb] rounded' : ''}`}>
                            {r.freq}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left border-collapse text-sm sm:text-base font-bold">
                  <thead>
                    <tr className="bg-[#141c14] text-[#cfdacb]">
                      <th className="py-1.5 px-3">STT</th>
                      <th className="py-1.5 px-3">Giá trị (xᵢ)</th>
                      <th className="py-1.5 px-3">Tần số (nᵢ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calcState.stat1VarRows.map((r, rIdx) => (
                      <tr
                        key={rIdx}
                        className={`border-b border-[#141c14]/20 ${
                          rIdx === calcState.statRow ? 'bg-[#141c14]/15' : ''
                        }`}
                      >
                        <td className="py-1.5 px-3">#{rIdx + 1}</td>
                        <td className={`py-1.5 px-3 ${rIdx === calcState.statRow && calcState.statCol === 0 ? 'bg-[#141c14] text-[#cfdacb]' : ''}`}>
                          {r.x}
                        </td>
                        <td className={`py-1.5 px-3 ${rIdx === calcState.statRow && calcState.statCol === 1 ? 'bg-[#141c14] text-[#cfdacb]' : ''}`}>
                          {r.freq}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* HIỂN THỊ TẤT CẢ CÁC GIÁ TRỊ ĐẶC TRƯNG CÙNG LÚC TRÊN MÀN HÌNH LỚN */}
        {calcState.mode === 'STAT_RESULT' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
              {calcState.statResults.map((item, idx) => {
                const isSelected = idx === calcState.statResultIndex;
                return (
                  <div
                    key={idx}
                    onClick={() => setCalcState((p) => ({ ...p, statResultIndex: idx }))}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      isSelected
                        ? 'bg-[#141c14] text-[#cfdacb] border-[#141c14] shadow-md'
                        : 'bg-[#141c14]/10 border-[#141c14]/25 text-[#0e140e]'
                    }`}
                  >
                    <KatexScreenRenderer
                      latex={item.label}
                      isReady={katexLoaded}
                      className="text-sm sm:text-base font-bold"
                    />
                    <KatexScreenRenderer
                      latex={calcState.showingDecimal ? item.decimalLatex : item.exactLatex}
                      isReady={katexLoaded}
                      className="text-lg sm:text-xl font-extrabold"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. CHẾ ĐỘ PHƯƠNG TRÌNH & HỆ PHƯƠNG TRÌNH (EQN) */}
        {calcState.mode === 'EQN_INPUT' && (
          <div className="flex-1 flex flex-col justify-between py-2">
            <div className="space-y-2">
              {getAllEqnLinesForBigScreen(calcState).map((lineLatex, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-lg ${
                    calcState.eqnType === 'SYS' && idx === calcState.eqnRow
                      ? 'bg-[#141c14]/15 border border-[#141c14]/35'
                      : ''
                  }`}
                >
                  <KatexScreenRenderer
                    latex={lineLatex}
                    isReady={katexLoaded}
                    className="text-xl sm:text-2xl font-bold text-[#0e140e]"
                  />
                </div>
              ))}
            </div>
            <div className="border-t border-[#141c14]/20 pt-2 text-right font-bold text-base">
              Hệ số đang nhập:{' '}
              <span className="px-2 py-0.5 rounded bg-[#141c14] text-[#cfdacb]">
                {calcState.eqnInputBuffer ||
                  (calcState.eqnType === 'SYS'
                    ? calcState.eqnMatrix[calcState.eqnRow][calcState.eqnCol]
                    : calcState.eqnPolyCoeffs[calcState.eqnCol])}
              </span>
            </div>
          </div>
        )}

        {calcState.mode === 'EQN_RESULT' && (
          <div className="flex-1 flex flex-col justify-center gap-2.5 py-2">
            <div className="text-xs uppercase font-bold text-[#141c14]/70">
              Tất cả nghiệm & Giá trị cực trị:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {calcState.eqnSolutions.map((sol, idx) => (
                <div
                  key={idx}
                  onClick={() => setCalcState((p) => ({ ...p, eqnSolIndex: idx }))}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer ${
                    idx === calcState.eqnSolIndex
                      ? 'bg-[#141c14] text-[#cfdacb] border-[#141c14]'
                      : 'bg-[#141c14]/10 border-[#141c14]/25 text-[#0e140e]'
                  }`}
                >
                  <KatexScreenRenderer latex={`${sol.label} =`} isReady={katexLoaded} className="text-lg font-bold" />
                  <KatexScreenRenderer
                    latex={calcState.showingDecimal ? sol.decimalLatex : sol.exactLatex}
                    isReady={katexLoaded}
                    className="text-xl sm:text-2xl font-extrabold"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. CHẾ ĐỘ BẢNG GIÁ TRỊ HÀM SỐ (TABLE) */}
        {(calcState.mode === 'TABLE_F' || calcState.mode === 'TABLE_G' || calcState.mode === 'TABLE_PARAMS') && (
          <div className="flex-1 flex flex-col justify-between py-2">
            <div className="space-y-3">
              <div className="p-2.5 rounded-lg bg-[#141c14]/10">
                <KatexScreenRenderer
                  latex={`f(x) = \\displaystyle ${serializeSlotToLatex(
                    calcState.tableFSlot,
                    calcState.mode === 'TABLE_F' ? calcState.cursor : null,
                    true
                  )}`}
                  isReady={katexLoaded}
                  className="text-xl sm:text-2xl font-bold"
                />
              </div>
              <div className="p-2.5 rounded-lg bg-[#141c14]/10">
                <KatexScreenRenderer
                  latex={`g(x) = \\displaystyle ${serializeSlotToLatex(
                    calcState.tableGSlot,
                    calcState.mode === 'TABLE_G' ? calcState.cursor : null,
                    true
                  )}`}
                  isReady={katexLoaded}
                  className="text-xl sm:text-2xl font-bold"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#141c14]/20 text-sm sm:text-base font-bold">
              <div>Start: {calcState.tableParams.start}</div>
              <div>End: {calcState.tableParams.end}</div>
              <div>Step: {calcState.tableParams.step}</div>
            </div>
          </div>
        )}

        {calcState.mode === 'TABLE_VIEW' && (
          <div className="flex-1 overflow-y-auto max-h-[240px] rounded-lg border border-[#141c14]/30">
            <table className="w-full text-left border-collapse text-base font-bold">
              <thead>
                <tr className="bg-[#141c14] text-[#cfdacb]">
                  <th className="py-1.5 px-3">#</th>
                  <th className="py-1.5 px-3">x</th>
                  <th className="py-1.5 px-3">f(x)</th>
                  {calcState.tableHasG && <th className="py-1.5 px-3">g(x)</th>}
                </tr>
              </thead>
              <tbody>
                {calcState.tableRows.map((r, i) => (
                  <tr key={i} className="border-b border-[#141c14]/20 hover:bg-[#141c14]/10">
                    <td className="py-1 px-3 opacity-65">{i + 1}</td>
                    <td className="py-1 px-3">
                      <KatexScreenRenderer latex={r.xLatex} isReady={katexLoaded} />
                    </td>
                    <td className="py-1 px-3">
                      <KatexScreenRenderer latex={r.fxLatex} isReady={katexLoaded} />
                    </td>
                    {calcState.tableHasG && (
                      <td className="py-1 px-3">
                        <KatexScreenRenderer latex={r.gxLatex} isReady={katexLoaded} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. CHẾ ĐỘ VECTƠ EDIT & CALC/SOLVE PROMPT */}
        {(calcState.mode === 'VCT_EDIT' || calcState.mode === 'CALC_PROMPT' || calcState.mode === 'SOLVE_PROMPT') && (
          <div className="flex-1 flex flex-col justify-center items-center py-4">
            {calcState.mode === 'VCT_EDIT' ? (
              <KatexScreenRenderer
                latex={`\\mathsf{${calcState.activeVctName}} = \\begin{bmatrix} ${(calcState.vectors[
                  calcState.activeVctName
                ]?.coords || [])
                  .slice(0, calcState.vectors[calcState.activeVctName]?.dim || 3)
                  .join(' \\\\ ')} \\end{bmatrix}`}
                isReady={katexLoaded}
                className="text-2xl sm:text-3xl font-bold"
              />
            ) : (
              <KatexScreenRenderer
                latex={`${
                  calcState.mode === 'SOLVE_PROMPT'
                    ? '\\text{Nhập giá trị khởi tạo } x_0 = '
                    : `\\text{Nhập biến } ${calcState.promptVars[calcState.promptVarIndex] || 'x'} = `
                } ${
                  calcState.promptInputBuffer ||
                  String(calcState.memoryVars[calcState.promptVars[calcState.promptVarIndex] || 'x'] || 0)
                }`}
                isReady={katexLoaded}
                className="text-2xl sm:text-3xl font-bold"
              />
            )}
          </div>
        )}
      </div>

      {/* Ghi chú hướng dẫn nhanh cho Học sinh ở chân Màn Hình Lớn */}
      <div className="mt-4 pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-xs text-white/80">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-semibold">
            Mẹo giảng dạy
          </span>
          <span>
            Giáo viên có thể click trực tiếp vào từng ô kết quả trên Màn hình lớn để đánh dấu cho học sinh chú ý.
          </span>
        </div>
        <span className="font-bold text-amber-300">Được phát triển bởi TTK</span>
      </div>
    </div>
  );
}

interface CasioFx580VNXInnerProps {
  onClose?: () => void;
}

function CasioFx580VNXInner({ onClose }: CasioFx580VNXInnerProps) {
  const { katexReady: katexLoaded } = useExternalMathLibraries();
  const [showChalk, setShowChalk] = useState(false);
  const [showBigScreen, setShowBigScreen] = useState(true);
  const [zoomScale, setZoomScale] = useState(1);

  const [calcState, setCalcState] = useState<CasioState>(() => {
    const initial = createInitialEmptyTree();
    return {
      mode: 'COMP',
      rootSlot: initial.rootSlot,
      cursor: initial.cursor,
      resultLatex: '',
      exactResultLatex: '',
      decimalResultLatex: '',
      showingDecimal: false,
      ansValue: 0,
      memoryVars: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, x: 0, y: 0, z: 0, M: 0 } as Record<string, number>,
      shift: false,
      alpha: false,
      stoMode: false,
      angleUnit: 'D',
      undoStack: [] as any[],
      // CALC & SOLVE
      promptVars: [] as string[],
      promptVarIndex: 0,
      promptInputBuffer: '',
      // MENU 9: EQN
      eqnType: 'SYS',
      eqnSize: 2,
      eqnMatrix: [
        ['1', '1', '5', '0'],
        ['2', '-1', '1', '0'],
        ['0', '0', '1', '0'],
        ['0', '0', '0', '1'],
      ],
      eqnPolyCoeffs: ['1', '-5', '6', '0'],
      eqnRow: 0,
      eqnCol: 0,
      eqnInputBuffer: '',
      eqnSolutions: [] as any[],
      eqnSolIndex: 0,
      // MENU 8: TABLE
      tableFSlot: createSlot([createToken('x'), createStructureNode('pow')]),
      tableGSlot: createSlot(),
      tableParams: { start: '1', end: '5', step: '1' } as Record<string, string>,
      tableParamIndex: 0,
      tableParamBuffer: '',
      tableRows: [] as any[],
      tableHasG: false,
      tableScroll: 0,
      // MENU 5: VECTOR
      vectors: {
        VctA: { dim: 3, coords: ['1', '2', '3'] },
        VctB: { dim: 3, coords: ['4', '5', '6'] },
        VctC: { dim: 2, coords: ['1', '0', '0'] },
        VctD: { dim: 2, coords: ['0', '1', '0'] },
      } as Record<string, { dim: number; coords: string[] }>,
      vctAns: { dim: 3, coords: [0, 0, 0] },
      activeVctName: 'VctA',
      vctCoordIndex: 0,
      vctInputBuffer: '',
      vctCalcSlot: createSlot(),
      // MENU 6: STATISTICS
      statType: 'GROUPED',
      stat1VarRows: [
        { x: '5', freq: '2' },
        { x: '6', freq: '5' },
        { x: '7', freq: '8' },
        { x: '8', freq: '3' },
        { x: '9', freq: '2' },
      ],
      statGroupedRows: [
        { L: '0', U: '10', freq: '5' },
        { L: '10', U: '20', freq: '12' },
        { L: '20', U: '30', freq: '18' },
        { L: '30', U: '40', freq: '10' },
        { L: '40', U: '50', freq: '5' },
      ],
      statRow: 0,
      statCol: 0,
      statInputBuffer: '',
      statResults: [] as any[],
      statResultIndex: 0,
    };
  });

  useEffect(() => {
    setCalcState((prev) => {
      if (prev.tableFSlot.items[1] && prev.tableFSlot.items[1].type === 'pow' && prev.tableFSlot.items[1].slots.exp.items.length === 0) {
        const cloned = cloneTree(prev.tableFSlot);
        cloned.items[1].slots.exp.items.push(createToken('2'));
        return { ...prev, tableFSlot: cloned };
      }
      return prev;
    });
  }, []);

  /**
   * Điều hướng D-Pad
   */
  const moveCursor = useCallback((direction: string) => {
    setCalcState((prev) => {
      if (prev.mode === 'EQN_RESULT') {
        const total = Math.max(1, prev.eqnSolutions.length);
        if (direction === 'DOWN' || direction === 'RIGHT') {
          return { ...prev, eqnSolIndex: (prev.eqnSolIndex + 1) % total, showingDecimal: false };
        }
        if (direction === 'UP' || direction === 'LEFT') {
          return { ...prev, eqnSolIndex: (prev.eqnSolIndex - 1 + total) % total, showingDecimal: false };
        }
        return prev;
      }

      if (prev.mode === 'EQN_INPUT') {
        if (prev.eqnType === 'SYS') {
          const rows = prev.eqnSize;
          const cols = prev.eqnSize + 1;
          let r = prev.eqnRow;
          let c = prev.eqnCol;
          if (direction === 'RIGHT') {
            c = (c + 1) % cols;
            if (c === 0) r = (r + 1) % rows;
          } else if (direction === 'LEFT') {
            c = (c - 1 + cols) % cols;
            if (c === cols - 1) r = (r - 1 + rows) % rows;
          } else if (direction === 'DOWN') {
            r = (r + 1) % rows;
          } else if (direction === 'UP') {
            r = (r - 1 + rows) % rows;
          }
          return { ...prev, eqnRow: r, eqnCol: c, eqnInputBuffer: '' };
        } else {
          const cols = prev.eqnSize + 1;
          let c = prev.eqnCol;
          if (direction === 'RIGHT' || direction === 'DOWN') c = (c + 1) % cols;
          if (direction === 'LEFT' || direction === 'UP') c = (c - 1 + cols) % cols;
          return { ...prev, eqnCol: c, eqnInputBuffer: '' };
        }
      }

      if (prev.mode === 'TABLE_VIEW') {
        const maxScroll = Math.max(0, prev.tableRows.length - 3);
        if (direction === 'DOWN') return { ...prev, tableScroll: Math.min(maxScroll, prev.tableScroll + 1) };
        if (direction === 'UP') return { ...prev, tableScroll: Math.max(0, prev.tableScroll - 1) };
        return prev;
      }

      if (prev.mode === 'VCT_EDIT') {
        const dim = prev.vectors[prev.activeVctName].dim;
        if (direction === 'DOWN' || direction === 'RIGHT') {
          return { ...prev, vctCoordIndex: (prev.vctCoordIndex + 1) % dim, vctInputBuffer: '' };
        }
        if (direction === 'UP' || direction === 'LEFT') {
          return { ...prev, vctCoordIndex: (prev.vctCoordIndex - 1 + dim) % dim, vctInputBuffer: '' };
        }
        return prev;
      }

      if (prev.mode === 'STAT_INPUT') {
        const isGrouped = prev.statType === 'GROUPED';
        const rowsCount = isGrouped ? prev.statGroupedRows.length : prev.stat1VarRows.length;
        const colsCount = isGrouped ? 3 : 2;
        let r = prev.statRow;
        let c = prev.statCol;

        if (direction === 'RIGHT') {
          if (c < colsCount - 1) c++;
          else if (r < rowsCount - 1) {
            r++;
            c = 0;
          }
        } else if (direction === 'LEFT') {
          if (c > 0) c--;
          else if (r > 0) {
            r--;
            c = colsCount - 1;
          }
        } else if (direction === 'DOWN') {
          if (r < rowsCount - 1) {
            r++;
          } else if (rowsCount < 15) {
            if (isGrouped) {
              const lastGroup = prev.statGroupedRows[prev.statGroupedRows.length - 1];
              const lastU = Number(lastGroup?.U || 0);
              const lastW = Number(lastGroup?.U || 10) - Number(lastGroup?.L || 0);
              const nextW = lastW > 0 ? lastW : 10;
              const newRows: StatGroupedRow[] = [
                ...prev.statGroupedRows,
                { L: String(lastU), U: String(lastU + nextW), freq: '0' },
              ];
              return { ...prev, statGroupedRows: newRows, statRow: r + 1, statCol: 2, statInputBuffer: '' };
            } else {
              const newRows: Stat1VarRow[] = [...prev.stat1VarRows, { x: '0', freq: '1' }];
              return { ...prev, stat1VarRows: newRows, statRow: r + 1, statCol: 0, statInputBuffer: '' };
            }
          }
        } else if (direction === 'UP' && r > 0) {
          r--;
        }
        return { ...prev, statRow: r, statCol: c, statInputBuffer: '' };
      }

      if (prev.mode === 'STAT_RESULT') {
        const total = Math.max(1, prev.statResults.length);
        if (direction === 'DOWN' || direction === 'RIGHT') {
          return { ...prev, statResultIndex: (prev.statResultIndex + 1) % total, showingDecimal: false };
        }
        if (direction === 'UP' || direction === 'LEFT') {
          return { ...prev, statResultIndex: (prev.statResultIndex - 1 + total) % total, showingDecimal: false };
        }
        return prev;
      }

      const rootField =
        prev.mode === 'TABLE_F'
          ? 'tableFSlot'
          : prev.mode === 'TABLE_G'
          ? 'tableGSlot'
          : prev.mode === 'VCT_CALC'
          ? 'vctCalcSlot'
          : 'rootSlot';
      const activeRoot = (prev as any)[rootField];
      const ctx = findSlotWithContext(activeRoot, prev.cursor.slotId);
      if (!ctx) return prev;
      const { slot, parentNode, slotKey, parentSlot, parentIndex } = ctx;
      const idx = prev.cursor.index;

      if (direction === 'LEFT') {
        if (idx > 0) {
          const prevItem = slot.items[idx - 1];
          if (prevItem.type !== 'token' && prevItem.slotOrder) {
            const lastKey = prevItem.slotOrder[prevItem.slotOrder.length - 1];
            const targetSlot = prevItem.slots[lastKey];
            return { ...prev, cursor: { slotId: targetSlot.id, index: targetSlot.items.length } };
          }
          return { ...prev, cursor: { slotId: slot.id, index: idx - 1 } };
        }
        if (parentNode && parentSlot) {
          const orderIdx = parentNode.slotOrder.indexOf(slotKey);
          if (orderIdx > 0) {
            const prevSlotKey = parentNode.slotOrder[orderIdx - 1];
            const targetSlot = parentNode.slots[prevSlotKey];
            return { ...prev, cursor: { slotId: targetSlot.id, index: targetSlot.items.length } };
          }
          return { ...prev, cursor: { slotId: parentSlot.id, index: parentIndex } };
        }
        return prev;
      }

      if (direction === 'RIGHT') {
        if (idx < slot.items.length) {
          const nextItem = slot.items[idx];
          if (nextItem.type !== 'token' && nextItem.slotOrder) {
            const firstKey = nextItem.slotOrder[0];
            const targetSlot = nextItem.slots[firstKey];
            return { ...prev, cursor: { slotId: targetSlot.id, index: 0 } };
          }
          return { ...prev, cursor: { slotId: slot.id, index: idx + 1 } };
        }
        if (parentNode && parentSlot) {
          const orderIdx = parentNode.slotOrder.indexOf(slotKey);
          if (orderIdx < parentNode.slotOrder.length - 1) {
            const nextSlotKey = parentNode.slotOrder[orderIdx + 1];
            const targetSlot = parentNode.slots[nextSlotKey];
            return { ...prev, cursor: { slotId: targetSlot.id, index: 0 } };
          }
          return { ...prev, cursor: { slotId: parentSlot.id, index: parentIndex + 1 } };
        }
        return prev;
      }

      if (direction === 'UP' && parentNode) {
        if (parentNode.type === 'frac' && slotKey === 'den') {
          return { ...prev, cursor: { slotId: parentNode.slots.num.id, index: parentNode.slots.num.items.length } };
        }
        if (parentNode.type === 'int' && (slotKey === 'lower' || slotKey === 'body')) {
          return { ...prev, cursor: { slotId: parentNode.slots.upper.id, index: parentNode.slots.upper.items.length } };
        }
      }

      if (direction === 'DOWN' && parentNode) {
        if (parentNode.type === 'frac' && slotKey === 'num') {
          return { ...prev, cursor: { slotId: parentNode.slots.den.id, index: parentNode.slots.den.items.length } };
        }
        if (parentNode.type === 'int' && (slotKey === 'upper' || slotKey === 'body')) {
          return { ...prev, cursor: { slotId: parentNode.slots.lower.id, index: parentNode.slots.lower.items.length } };
        }
      }
      return prev;
    });
  }, []);

  /**
   * Xử lý bấm phím
   */
  const handleKeyPress = useCallback((keyDef: any) => {
    if (!keyDef) return;

    setCalcState((prev) => {
      const keyId = keyDef.id;

      if (keyId === 'menu') {
        return { ...prev, mode: prev.mode === 'MENU' ? 'COMP' : 'MENU', shift: false, alpha: false };
      }

      if (keyId === 'on') {
        const emptySlot = createSlot();
        return {
          ...prev,
          mode: 'COMP',
          rootSlot: emptySlot,
          cursor: { slotId: emptySlot.id, index: 0 },
          resultLatex: '',
          exactResultLatex: '',
          decimalResultLatex: '',
          showingDecimal: false,
          shift: false,
          alpha: false,
          stoMode: false,
        };
      }

      if (keyId === 'ans' && prev.shift) {
        const nextUnit = prev.angleUnit === 'D' ? 'R' : prev.angleUnit === 'R' ? 'G' : 'D';
        return { ...prev, angleUnit: nextUnit, shift: false, alpha: false };
      }

      if (keyId === 'sd') {
        if (prev.mode === 'EQN_RESULT' && prev.eqnSolutions.length > 0) {
          return { ...prev, showingDecimal: !prev.showingDecimal, shift: false, alpha: false };
        }
        if (prev.mode === 'STAT_RESULT' && prev.statResults.length > 0) {
          return { ...prev, showingDecimal: !prev.showingDecimal, shift: false, alpha: false };
        }
        if (prev.exactResultLatex && prev.decimalResultLatex) {
          const nextDecimal = !prev.showingDecimal;
          return {
            ...prev,
            showingDecimal: nextDecimal,
            resultLatex: nextDecimal ? prev.decimalResultLatex : prev.exactResultLatex,
            shift: false,
            alpha: false,
          };
        }
      }

      const digitMap: Record<string, string> = {
        num0: '0', num1: '1', num2: '2', num3: '3', num4: '4',
        num5: '5', num6: '6', num7: '7', num8: '8', num9: '9',
        dot: '.', neg: '-', sub: '-',
      };

      // 1. MENU CHÍNH
      if (prev.mode === 'MENU') {
        if (keyId === 'num1' || keyId === 'eq') {
          return { ...prev, mode: 'COMP', shift: false, alpha: false };
        }
        if (keyId === 'num5') {
          return { ...prev, mode: 'VCT_SELECT', resultLatex: '', shift: false, alpha: false };
        }
        if (keyId === 'num6') {
          return { ...prev, mode: 'STAT_SELECT', resultLatex: '', shift: false, alpha: false };
        }
        if (keyId === 'num8') {
          return {
            ...prev,
            mode: 'TABLE_F',
            cursor: { slotId: prev.tableFSlot.id, index: prev.tableFSlot.items.length },
            shift: false,
            alpha: false,
          };
        }
        if (keyId === 'num9') {
          return { ...prev, mode: 'EQN_SELECT', shift: false, alpha: false };
        }
      }

      // 2. MENU 6: STATISTICS
      if (prev.mode === 'STAT_SELECT') {
        if (keyId === 'num1') {
          return { ...prev, mode: 'STAT_INPUT', statType: '1VAR', statRow: 0, statCol: 0, statInputBuffer: '' };
        }
        if (keyId === 'num2') {
          return { ...prev, mode: 'STAT_INPUT', statType: 'GROUPED', statRow: 0, statCol: 0, statInputBuffer: '' };
        }
        if (keyId === 'ac') return { ...prev, mode: 'COMP' };
        return prev;
      }

      if (prev.mode === 'STAT_INPUT') {
        const isGrouped = prev.statType === 'GROUPED';
        const colKeys = isGrouped ? ['L', 'U', 'freq'] : ['x', 'freq'];
        const activeColKey = colKeys[prev.statCol] || colKeys[0];

        if (keyId === 'ac') {
          return { ...prev, mode: 'STAT_SELECT', statInputBuffer: '' };
        }

        if (keyId === 'optn' || keyId === 'calc' || (prev.shift && keyId === 'num1')) {
          const res: any = isGrouped
            ? CasioMathEngine.calculateGroupedStats(prev.statGroupedRows)
            : CasioMathEngine.calculateUngroupedStats(prev.stat1VarRows);

          const resultList = res.ok
            ? res.items
            : [{ label: '\\text{Thông báo}', exactLatex: res.messageLatex, decimalLatex: res.messageLatex }];

          return {
            ...prev,
            mode: 'STAT_RESULT',
            statResults: resultList,
            statResultIndex: 0,
            showingDecimal: false,
            shift: false,
            alpha: false,
          };
        }

        if (keyId === 'del') {
          if (isGrouped) {
            if (prev.shift && prev.statGroupedRows.length > 1) {
              const nextRows = prev.statGroupedRows.filter((_, idx) => idx !== prev.statRow);
              return {
                ...prev,
                statGroupedRows: nextRows,
                statRow: Math.max(0, Math.min(prev.statRow, nextRows.length - 1)),
                statInputBuffer: '',
                shift: false,
              };
            }
            const nextBuf = prev.statInputBuffer.slice(0, -1);
            const nextRows = prev.statGroupedRows.map((r, idx) =>
              idx === prev.statRow ? { ...r, [activeColKey]: nextBuf || '0' } : r
            );
            return { ...prev, statInputBuffer: nextBuf, statGroupedRows: nextRows };
          } else {
            if (prev.shift && prev.stat1VarRows.length > 1) {
              const nextRows = prev.stat1VarRows.filter((_, idx) => idx !== prev.statRow);
              return {
                ...prev,
                stat1VarRows: nextRows,
                statRow: Math.max(0, Math.min(prev.statRow, nextRows.length - 1)),
                statInputBuffer: '',
                shift: false,
              };
            }
            const nextBuf = prev.statInputBuffer.slice(0, -1);
            const nextRows = prev.stat1VarRows.map((r, idx) =>
              idx === prev.statRow ? { ...r, [activeColKey]: nextBuf || '0' } : r
            );
            return { ...prev, statInputBuffer: nextBuf, stat1VarRows: nextRows };
          }
        }

        if (digitMap[keyId] !== undefined) {
          const nextBuf = prev.statInputBuffer + digitMap[keyId];
          if (isGrouped) {
            const nextRows = prev.statGroupedRows.map((r, idx) =>
              idx === prev.statRow ? { ...r, [activeColKey]: nextBuf } : r
            );
            return { ...prev, statInputBuffer: nextBuf, statGroupedRows: nextRows };
          } else {
            const nextRows = prev.stat1VarRows.map((r, idx) =>
              idx === prev.statRow ? { ...r, [activeColKey]: nextBuf } : r
            );
            return { ...prev, statInputBuffer: nextBuf, stat1VarRows: nextRows };
          }
        }

        if (keyId === 'eq') {
          const colsCount = colKeys.length;
          const rowsLength = isGrouped ? prev.statGroupedRows.length : prev.stat1VarRows.length;
          if (prev.statCol < colsCount - 1) {
            return { ...prev, statCol: prev.statCol + 1, statInputBuffer: '' };
          }
          if (prev.statRow < rowsLength - 1) {
            return { ...prev, statRow: prev.statRow + 1, statCol: 0, statInputBuffer: '' };
          }
          if (rowsLength < 15) {
            if (isGrouped) {
              const lastGroup = prev.statGroupedRows[prev.statGroupedRows.length - 1];
              const lastU = Number(lastGroup?.U || 0);
              const lastW = Number(lastGroup?.U || 10) - Number(lastGroup?.L || 0);
              const stepW = lastW > 0 ? lastW : 10;
              const nextRows: StatGroupedRow[] = [
                ...prev.statGroupedRows,
                { L: String(lastU), U: String(lastU + stepW), freq: '0' },
              ];
              return { ...prev, statGroupedRows: nextRows, statRow: prev.statRow + 1, statCol: 2, statInputBuffer: '' };
            } else {
              const nextRows: Stat1VarRow[] = [...prev.stat1VarRows, { x: '0', freq: '1' }];
              return { ...prev, stat1VarRows: nextRows, statRow: prev.statRow + 1, statCol: 0, statInputBuffer: '' };
            }
          }
          return { ...prev, statInputBuffer: '' };
        }
        return prev;
      }

      if (prev.mode === 'STAT_RESULT') {
        if (keyId === 'ac' || keyId === 'optn') {
          return { ...prev, mode: 'STAT_INPUT', statInputBuffer: '' };
        }
        if (keyId === 'eq') {
          const total = Math.max(1, prev.statResults.length);
          return { ...prev, statResultIndex: (prev.statResultIndex + 1) % total, showingDecimal: false };
        }
        return prev;
      }

      // 3. MENU 5: VECTOR
      if (prev.mode === 'VCT_SELECT') {
        const vMap: Record<string, string> = { num1: 'VctA', num2: 'VctB', num3: 'VctC', num4: 'VctD' };
        if (vMap[keyId]) {
          return { ...prev, mode: 'VCT_DIM', activeVctName: vMap[keyId] };
        }
        if (keyId === 'ac' || keyId === 'optn') {
          return {
            ...prev,
            mode: 'VCT_CALC',
            cursor: { slotId: prev.vctCalcSlot.id, index: prev.vctCalcSlot.items.length },
          };
        }
        return prev;
      }

      if (prev.mode === 'VCT_DIM') {
        if (keyId === 'num2' || keyId === 'num3') {
          const dim = keyId === 'num2' ? 2 : 3;
          const curV = prev.vectors[prev.activeVctName];
          return {
            ...prev,
            mode: 'VCT_EDIT',
            vectors: { ...prev.vectors, [prev.activeVctName]: { ...curV, dim } },
            vctCoordIndex: 0,
            vctInputBuffer: '',
          };
        }
        if (keyId === 'ac') return { ...prev, mode: 'VCT_SELECT' };
        return prev;
      }

      if (prev.mode === 'VCT_EDIT') {
        const curV = prev.vectors[prev.activeVctName];
        if (keyId === 'ac' || keyId === 'optn') {
          return {
            ...prev,
            mode: 'VCT_CALC',
            cursor: { slotId: prev.vctCalcSlot.id, index: prev.vctCalcSlot.items.length },
            vctInputBuffer: '',
          };
        }
        if (keyId === 'del') {
          const nextBuf = prev.vctInputBuffer.slice(0, -1);
          const nextCoords = [...curV.coords];
          nextCoords[prev.vctCoordIndex] = nextBuf || '0';
          return {
            ...prev,
            vctInputBuffer: nextBuf,
            vectors: { ...prev.vectors, [prev.activeVctName]: { ...curV, coords: nextCoords } },
          };
        }
        if (digitMap[keyId] !== undefined) {
          const nextBuf = prev.vctInputBuffer + digitMap[keyId];
          const nextCoords = [...curV.coords];
          nextCoords[prev.vctCoordIndex] = nextBuf;
          return {
            ...prev,
            vctInputBuffer: nextBuf,
            vectors: { ...prev.vectors, [prev.activeVctName]: { ...curV, coords: nextCoords } },
          };
        }
        if (keyId === 'eq') {
          if (prev.vctCoordIndex < curV.dim - 1) {
            return { ...prev, vctCoordIndex: prev.vctCoordIndex + 1, vctInputBuffer: '' };
          }
          return {
            ...prev,
            mode: 'VCT_CALC',
            cursor: { slotId: prev.vctCalcSlot.id, index: prev.vctCalcSlot.items.length },
            vctInputBuffer: '',
          };
        }
        return prev;
      }

      if (prev.mode === 'VCT_OPTN') {
        if (keyId === 'num1') return { ...prev, mode: 'VCT_SELECT' };
        if (keyId === 'num2') return { ...prev, mode: 'VCT_EDIT', vctCoordIndex: 0, vctInputBuffer: '' };
        const insertTokenMap: Record<string, string> = {
          num3: '\\text{VctA}',
          num4: '\\text{VctB}',
          num5: '\\text{VctC}',
          num6: '\\text{VctD}',
          num7: '\\boldsymbol{\\cdot}',
          num8: '\\text{Angle}(',
          ans: '\\text{VctAns}',
        };
        if (insertTokenMap[keyId]) {
          const newCalcSlot = cloneTree(prev.vctCalcSlot);
          const ctx = findSlotWithContext(newCalcSlot, prev.cursor.slotId);
          const curSlot = ctx ? ctx.slot : newCalcSlot;
          curSlot.items.splice(prev.cursor.index, 0, createToken(insertTokenMap[keyId]));
          return {
            ...prev,
            mode: 'VCT_CALC',
            vctCalcSlot: newCalcSlot,
            cursor: { slotId: curSlot.id, index: prev.cursor.index + 1 },
          };
        }
        if (keyId === 'ac' || keyId === 'optn') return { ...prev, mode: 'VCT_CALC' };
        return prev;
      }

      // 4. MENU 9: EQN
      if (prev.mode === 'EQN_SELECT') {
        if (keyId === 'num1') return { ...prev, mode: 'EQN_SYS_SIZE', eqnType: 'SYS' };
        if (keyId === 'num2') return { ...prev, mode: 'EQN_POLY_DEG', eqnType: 'POLY' };
        if (keyId === 'ac') return { ...prev, mode: 'COMP' };
        return prev;
      }

      if (prev.mode === 'EQN_SYS_SIZE') {
        if (['num2', 'num3', 'num4'].includes(keyId)) {
          const sz = parseInt(digitMap[keyId], 10);
          return { ...prev, mode: 'EQN_INPUT', eqnSize: sz, eqnRow: 0, eqnCol: 0, eqnInputBuffer: '' };
        }
        if (keyId === 'ac') return { ...prev, mode: 'EQN_SELECT' };
        return prev;
      }

      if (prev.mode === 'EQN_POLY_DEG') {
        if (['num2', 'num3'].includes(keyId)) {
          const deg = parseInt(digitMap[keyId], 10);
          return { ...prev, mode: 'EQN_INPUT', eqnSize: deg, eqnRow: 0, eqnCol: 0, eqnInputBuffer: '' };
        }
        if (keyId === 'ac') return { ...prev, mode: 'EQN_SELECT' };
        return prev;
      }

      if (prev.mode === 'EQN_INPUT') {
        if (keyId === 'ac') return { ...prev, mode: 'EQN_SELECT', eqnInputBuffer: '' };
        if (keyId === 'del') {
          const nextBuf = prev.eqnInputBuffer.slice(0, -1);
          if (prev.eqnType === 'SYS') {
            const mat = prev.eqnMatrix.map((r) => [...r]);
            mat[prev.eqnRow][prev.eqnCol] = nextBuf || '0';
            return { ...prev, eqnInputBuffer: nextBuf, eqnMatrix: mat };
          } else {
            const cfs = [...prev.eqnPolyCoeffs];
            cfs[prev.eqnCol] = nextBuf || '0';
            return { ...prev, eqnInputBuffer: nextBuf, eqnPolyCoeffs: cfs };
          }
        }
        if (digitMap[keyId] !== undefined) {
          const nextBuf = prev.eqnInputBuffer + digitMap[keyId];
          if (prev.eqnType === 'SYS') {
            const mat = prev.eqnMatrix.map((r) => [...r]);
            mat[prev.eqnRow][prev.eqnCol] = nextBuf;
            return { ...prev, eqnInputBuffer: nextBuf, eqnMatrix: mat };
          } else {
            const cfs = [...prev.eqnPolyCoeffs];
            cfs[prev.eqnCol] = nextBuf;
            return { ...prev, eqnInputBuffer: nextBuf, eqnPolyCoeffs: cfs };
          }
        }
        if (keyId === 'eq') {
          if (prev.eqnType === 'SYS') {
            const rows = prev.eqnSize;
            const cols = prev.eqnSize + 1;
            const isLast = prev.eqnRow === rows - 1 && prev.eqnCol === cols - 1;
            if (!isLast) {
              let c = prev.eqnCol + 1;
              let r = prev.eqnRow;
              if (c >= cols) {
                c = 0;
                r++;
              }
              return { ...prev, eqnRow: r, eqnCol: c, eqnInputBuffer: '' };
            }
            const res = CasioMathEngine.solveLinearSystem(prev.eqnSize, prev.eqnMatrix);
            const solList = res.ok
              ? res.solutions
              : [{ label: '\\text{KL}', exactLatex: res.messageLatex, decimalLatex: res.messageLatex }];
            return { ...prev, mode: 'EQN_RESULT', eqnSolutions: solList, eqnSolIndex: 0, showingDecimal: false };
          } else {
            const cols = prev.eqnSize + 1;
            if (prev.eqnCol < cols - 1) {
              return { ...prev, eqnCol: prev.eqnCol + 1, eqnInputBuffer: '' };
            }
            const res = CasioMathEngine.solvePolynomialEquation(prev.eqnSize, prev.eqnPolyCoeffs);
            const solList = res.ok
              ? res.solutions
              : [{ label: '\\text{KL}', exactLatex: res.messageLatex, decimalLatex: res.messageLatex }];
            return { ...prev, mode: 'EQN_RESULT', eqnSolutions: solList, eqnSolIndex: 0, showingDecimal: false };
          }
        }
        return prev;
      }

      if (prev.mode === 'EQN_RESULT') {
        if (keyId === 'ac') return { ...prev, mode: 'EQN_INPUT', eqnRow: 0, eqnCol: 0, eqnInputBuffer: '' };
        if (keyId === 'eq') {
          const total = Math.max(1, prev.eqnSolutions.length);
          if (prev.eqnSolIndex < total - 1) {
            return { ...prev, eqnSolIndex: prev.eqnSolIndex + 1, showingDecimal: false };
          }
          return { ...prev, mode: 'EQN_INPUT', eqnRow: 0, eqnCol: 0, eqnInputBuffer: '' };
        }
        return prev;
      }

      // 5. CALC & SOLVE PROMPT
      if (prev.mode === 'CALC_PROMPT' || prev.mode === 'SOLVE_PROMPT') {
        const currentVar = prev.promptVars[prev.promptVarIndex] || 'x';
        if (keyId === 'ac') return { ...prev, mode: 'COMP', promptInputBuffer: '' };
        if (keyId === 'del') return { ...prev, promptInputBuffer: prev.promptInputBuffer.slice(0, -1) };
        if (digitMap[keyId] !== undefined) {
          return { ...prev, promptInputBuffer: prev.promptInputBuffer + digitMap[keyId] };
        }
        if (keyId === 'eq') {
          const valNum = prev.promptInputBuffer !== '' ? Number(prev.promptInputBuffer) : prev.memoryVars[currentVar] || 0;
          const updatedMem = { ...prev.memoryVars, [currentVar]: Number.isFinite(valNum) ? valNum : 0 };

          if (prev.mode === 'SOLVE_PROMPT') {
            const solved = CasioMathEngine.solveSingleVariableEquation(prev.rootSlot, updatedMem.x, prev.angleUnit, updatedMem);
            if (solved.ok) {
              return {
                ...prev,
                mode: 'COMP',
                memoryVars: { ...updatedMem, x: solved.root },
                exactResultLatex: `x = ${solved.exactLatex},\\; L-R = 0`,
                decimalResultLatex: `x = ${solved.decimalLatex},\\; L-R = 0`,
                resultLatex: `x = ${solved.exactLatex},\\; L-R = 0`,
                showingDecimal: false,
                promptInputBuffer: '',
              };
            }
            return { ...prev, mode: 'COMP', resultLatex: solved.errorLatex, promptInputBuffer: '' };
          }

          if (prev.promptVarIndex < prev.promptVars.length - 1) {
            return { ...prev, memoryVars: updatedMem, promptVarIndex: prev.promptVarIndex + 1, promptInputBuffer: '' };
          }
          const evalRes = CasioMathEngine.evaluateCompTree(prev.rootSlot, prev.angleUnit, updatedMem);
          if (evalRes.ok) {
            return {
              ...prev,
              mode: 'COMP',
              memoryVars: updatedMem,
              ansValue: evalRes.value,
              exactResultLatex: evalRes.exactLatex,
              decimalResultLatex: evalRes.decimalLatex,
              resultLatex: evalRes.exactLatex,
              showingDecimal: false,
              promptInputBuffer: '',
            };
          }
          return { ...prev, mode: 'COMP', resultLatex: evalRes.errorLatex, promptInputBuffer: '' };
        }
        return prev;
      }

      // 6. MENU 8: TABLE PARAMS & VIEW
      if (prev.mode === 'TABLE_PARAMS') {
        const paramKeys = ['start', 'end', 'step'];
        const curKey = paramKeys[prev.tableParamIndex];
        if (keyId === 'ac') {
          return {
            ...prev,
            mode: 'TABLE_F',
            cursor: { slotId: prev.tableFSlot.id, index: prev.tableFSlot.items.length },
          };
        }
        if (keyId === 'del') {
          const nextBuf = prev.tableParamBuffer.slice(0, -1);
          return {
            ...prev,
            tableParamBuffer: nextBuf,
            tableParams: { ...prev.tableParams, [curKey]: nextBuf || '0' },
          };
        }
        if (digitMap[keyId] !== undefined) {
          const nextBuf = prev.tableParamBuffer + digitMap[keyId];
          return {
            ...prev,
            tableParamBuffer: nextBuf,
            tableParams: { ...prev.tableParams, [curKey]: nextBuf },
          };
        }
        if (keyId === 'eq') {
          if (prev.tableParamIndex < 2) {
            return { ...prev, tableParamIndex: prev.tableParamIndex + 1, tableParamBuffer: '' };
          }
          const s = Number(prev.tableParams.start);
          const e = Number(prev.tableParams.end);
          const st = Number(prev.tableParams.step);
          const tb = CasioMathEngine.generateFunctionTable(
            prev.tableFSlot,
            prev.tableGSlot,
            s,
            e,
            st,
            prev.angleUnit,
            prev.memoryVars
          );
          if (tb.ok) {
            return { ...prev, mode: 'TABLE_VIEW', tableRows: tb.rows, tableHasG: tb.hasG, tableScroll: 0 };
          }
          return { ...prev, mode: 'TABLE_VIEW', tableRows: [{ xLatex: '-', fxLatex: tb.errorLatex, gxLatex: '' }], tableHasG: false, tableScroll: 0 };
        }
        return prev;
      }

      if (prev.mode === 'TABLE_VIEW') {
        if (keyId === 'ac' || keyId === 'eq') {
          return {
            ...prev,
            mode: 'TABLE_F',
            cursor: { slotId: prev.tableFSlot.id, index: prev.tableFSlot.items.length },
          };
        }
        return prev;
      }

      // 7. CHẾ ĐỘ SOẠN THẢO BIỂU THỨC (COMP, TABLE_F, TABLE_G, VCT_CALC)
      if (keyId === 'shift') return { ...prev, shift: !prev.shift, alpha: false };
      if (keyId === 'alpha') return { ...prev, alpha: !prev.alpha, shift: false };

      if (prev.mode === 'VCT_CALC' && keyId === 'optn' && !prev.shift) {
        return { ...prev, mode: 'VCT_OPTN', shift: false, alpha: false };
      }

      if (prev.mode === 'COMP' && keyId === 'calc' && !prev.shift && !prev.alpha) {
        const vars = CasioMathEngine.extractVariablesFromTree(prev.rootSlot);
        const targetVars = vars.length > 0 ? vars : ['x'];
        return { ...prev, mode: 'CALC_PROMPT', promptVars: targetVars, promptVarIndex: 0, promptInputBuffer: '' };
      }

      if (prev.mode === 'COMP' && keyId === 'optn' && prev.shift) {
        return { ...prev, mode: 'SOLVE_PROMPT', promptVars: ['x'], promptVarIndex: 0, promptInputBuffer: '', shift: false };
      }

      if (prev.stoMode && keyDef.alphaAction && keyDef.alphaAction.type === 'token') {
        const varName = keyDef.alphaAction.latex;
        if (['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z', 'M'].includes(varName)) {
          const evalRes = CasioMathEngine.evaluateCompTree(prev.rootSlot, prev.angleUnit, { ...prev.memoryVars, Ans: prev.ansValue });
          const valToStore = evalRes.ok ? evalRes.value : prev.ansValue;
          return {
            ...prev,
            stoMode: false,
            ansValue: valToStore,
            memoryVars: { ...prev.memoryVars, [varName]: valToStore },
            exactResultLatex: `${varName} = ${CasioMathEngine.formatNumberToLatex(valToStore, true)}`,
            decimalResultLatex: `${varName} = ${CasioMathEngine.formatNumberToLatex(valToStore, false)}`,
            resultLatex: `${varName} = ${CasioMathEngine.formatNumberToLatex(valToStore, true)}`,
          };
        }
      }

      let chosenAction = keyDef.action;
      if (prev.shift && keyDef.shiftAction) chosenAction = keyDef.shiftAction;
      else if (prev.alpha && keyDef.alphaAction) chosenAction = keyDef.alphaAction;
      if (!chosenAction) return { ...prev, shift: false, alpha: false };

      if (chosenAction.type === 'sto') {
        return { ...prev, stoMode: !prev.stoMode, shift: false, alpha: false };
      }

      const rootField =
        prev.mode === 'TABLE_F'
          ? 'tableFSlot'
          : prev.mode === 'TABLE_G'
          ? 'tableGSlot'
          : prev.mode === 'VCT_CALC'
          ? 'vctCalcSlot'
          : 'rootSlot';

      if (chosenAction.type === 'ac') {
        const emptySlot = createSlot();
        return {
          ...prev,
          [rootField]: emptySlot,
          cursor: { slotId: emptySlot.id, index: 0 },
          resultLatex: '',
          exactResultLatex: '',
          decimalResultLatex: '',
          shift: false,
          alpha: false,
          stoMode: false,
        };
      }

      if (chosenAction.type === 'eval') {
        if (prev.mode === 'TABLE_F') {
          return {
            ...prev,
            mode: 'TABLE_G',
            cursor: { slotId: prev.tableGSlot.id, index: prev.tableGSlot.items.length },
          };
        }
        if (prev.mode === 'TABLE_G') {
          return { ...prev, mode: 'TABLE_PARAMS', tableParamIndex: 0, tableParamBuffer: '' };
        }
        if (prev.mode === 'VCT_CALC') {
          const vRes = CasioMathEngine.evaluateVectorExpression(prev.vctCalcSlot, prev.vectors, prev.vctAns, prev.angleUnit);
          if (vRes.ok) {
            return {
              ...prev,
              vctAns: vRes.kind === 'vector' ? { dim: vRes.vec.length, coords: vRes.vec } : prev.vctAns,
              ansValue: vRes.kind === 'scalar' ? vRes.value : prev.ansValue,
              exactResultLatex: vRes.exactLatex,
              decimalResultLatex: vRes.decimalLatex,
              resultLatex: prev.shift ? vRes.decimalLatex : vRes.exactLatex,
              showingDecimal: Boolean(prev.shift),
              shift: false,
              alpha: false,
            };
          }
          return { ...prev, resultLatex: vRes.errorLatex, shift: false, alpha: false };
        }

        const evalRes = CasioMathEngine.evaluateCompTree(prev.rootSlot, prev.angleUnit, {
          ...prev.memoryVars,
          Ans: prev.ansValue,
        });
        if (evalRes.ok) {
          const preferDec = Boolean(prev.shift);
          return {
            ...prev,
            ansValue: evalRes.value,
            exactResultLatex: evalRes.exactLatex,
            decimalResultLatex: evalRes.decimalLatex,
            resultLatex: preferDec ? evalRes.decimalLatex : evalRes.exactLatex,
            showingDecimal: preferDec,
            shift: false,
            alpha: false,
          };
        }
        return { ...prev, resultLatex: evalRes.errorLatex, exactResultLatex: '', decimalResultLatex: '', shift: false, alpha: false };
      }

      const newRoot = cloneTree((prev as any)[rootField]);
      const ctx = findSlotWithContext(newRoot, prev.cursor.slotId);
      if (!ctx) return prev;
      const { slot, parentNode, parentSlot, parentIndex } = ctx;
      let newCursor = { ...prev.cursor };

      if (chosenAction.type === 'del') {
        if (prev.alpha && prev.undoStack.length > 0) {
          const lastSnap = prev.undoStack[prev.undoStack.length - 1];
          return {
            ...prev,
            [rootField]: lastSnap.rootSlot,
            cursor: lastSnap.cursor,
            undoStack: prev.undoStack.slice(0, -1),
            alpha: false,
            shift: false,
          };
        }
        if (slot.items.length > 0 && newCursor.index > 0) {
          slot.items.splice(newCursor.index - 1, 1);
          newCursor.index -= 1;
        } else if (slot.items.length === 0 && parentNode && parentSlot) {
          parentSlot.items.splice(parentIndex, 1);
          newCursor = { slotId: parentSlot.id, index: parentIndex };
        }
        return { ...prev, [rootField]: newRoot, cursor: newCursor, resultLatex: '', shift: false, alpha: false };
      }

      const undoSnapshot = { rootSlot: cloneTree((prev as any)[rootField]), cursor: { ...prev.cursor } };
      const nextUndoStack = [...prev.undoStack.slice(-15), undoSnapshot];

      if (chosenAction.type === 'struct') {
        const structNode = createStructureNode(chosenAction.nodeType);
        if (chosenAction.nodeType === 'frac' && newCursor.index > 0 && slot.items[newCursor.index - 1]?.type === 'token') {
          const prevToken = slot.items.splice(newCursor.index - 1, 1)[0];
          structNode.slots.num.items.push(prevToken);
          slot.items.splice(newCursor.index - 1, 0, structNode);
          newCursor = { slotId: structNode.slots.den.id, index: 0 };
        } else {
          slot.items.splice(newCursor.index, 0, structNode);
          const firstSlotKey = structNode.slotOrder[0];
          newCursor = { slotId: structNode.slots[firstSlotKey].id, index: 0 };
        }
      } else if (chosenAction.type === 'pow2' || chosenAction.type === 'pow3' || chosenAction.type === 'pow_neg1') {
        const powNode = createStructureNode('pow');
        const expText = chosenAction.type === 'pow2' ? '2' : chosenAction.type === 'pow3' ? '3' : '-1';
        powNode.slots.exp.items.push(createToken(expText));
        slot.items.splice(newCursor.index, 0, powNode);
        newCursor = { slotId: slot.id, index: newCursor.index + 1 };
      } else if (chosenAction.type === 'tenpow' || chosenAction.type === 'epow') {
        const baseTok = createToken(chosenAction.type === 'tenpow' ? '10' : '\\mathrm{e}');
        const powNode = createStructureNode('pow');
        slot.items.splice(newCursor.index, 0, baseTok, powNode);
        newCursor = { slotId: powNode.slots.exp.id, index: 0 };
      } else if (chosenAction.type === 'token') {
        const tok = createToken(chosenAction.latex);
        slot.items.splice(newCursor.index, 0, tok);
        newCursor = { slotId: slot.id, index: newCursor.index + 1 };
      }

      return {
        ...prev,
        [rootField]: newRoot,
        cursor: newCursor,
        resultLatex: '',
        shift: false,
        alpha: false,
        undoStack: nextUndoStack,
      };
    });
  }, []);

  // Bộ chống rung / chống kích hoạt đúp và hỗ trợ phản hồi 0ms ngay khi chạm trên TV 75 inch
  const lastPointerPressTimeRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });

  const handleFastPress = useCallback((keyItem: any, e?: React.SyntheticEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      try {
        e.preventDefault();
      } catch (_) {}
    }
    const now = performance.now();
    const keyId = keyItem?.id || 'unknown';
    // Bỏ qua nếu sự kiện vừa bắn cách đây dưới 65ms trên cùng phím (tránh double firing touchstart + click)
    if (lastPointerPressTimeRef.current.id === keyId && now - lastPointerPressTimeRef.current.time < 65) {
      return;
    }
    lastPointerPressTimeRef.current = { id: keyId, time: now };
    handleKeyPress(keyItem);
  }, [handleKeyPress]);

  const handleFastCursor = useCallback((direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', e?: React.SyntheticEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      try {
        e.preventDefault();
      } catch (_) {}
    }
    const now = performance.now();
    const id = `dpad_${direction}`;
    if (lastPointerPressTimeRef.current.id === id && now - lastPointerPressTimeRef.current.time < 65) {
      return;
    }
    lastPointerPressTimeRef.current = { id, time: now };
    moveCursor(direction);
  }, [moveCursor]);

  const currentLatexExpression = useMemo(
    () => serializeSlotToLatex(calcState.rootSlot, calcState.cursor, true),
    [calcState.rootSlot, calcState.cursor]
  );

  return (
    <div
      className={`relative w-full ${showBigScreen ? 'max-w-[1180px]' : 'max-w-[450px]'} max-h-[95vh] flex flex-col items-center justify-start py-4 px-3 sm:px-6 overflow-y-auto overflow-x-hidden custom-scrollbar rounded-3xl border border-white/20 shadow-2xl transition-all duration-300`}
      style={{
        backgroundColor: '#193829',
        backgroundImage: `
          radial-gradient(circle at 50% 35%, rgba(45, 92, 68, 0.55) 0%, rgba(19, 44, 32, 0.95) 75%, #0e2218 100%),
          repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 2px, transparent 2px, transparent 8px)
        `,
      }}
    >
      {showChalk && <ChalkboardDoodles />}

      {/* Thanh tiêu đề & Nút Bật/Tắt Màn Hình Lớn + Phóng to */}
      <div className="relative z-10 mb-4 flex flex-wrap items-center justify-center gap-2.5 px-4 py-2 rounded-full bg-[#0d1c14] border border-white/20 text-white/90 text-xs shadow-lg">
        <span className="font-medium tracking-wide flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
          Casio fx-580VN X
        </span>
        <span className="text-white/30">•</span>
        <span className="font-bold text-amber-300 tracking-wide">
          Được phát triển bởi TTK
        </span>
        <span className="text-white/30">|</span>
        <button
          type="button"
          onClick={() => setShowBigScreen((v) => !v)}
          className={`px-3 py-1 rounded-full font-bold transition cursor-pointer flex items-center gap-1.5 ${
            showBigScreen
              ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
              : 'bg-white/15 text-emerald-200 hover:bg-white/25'
          }`}
        >
          <span>🖥️</span>
          <span>{showBigScreen ? 'Đang bật Màn hình lớn (Cho học sinh)' : 'Bật Màn hình lớn (Cho học sinh)'}</span>
        </button>
        <span className="text-white/30">|</span>
        <div className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-full border border-white/15">
          <span className="text-[10.5px] text-emerald-300 font-semibold mr-0.5">Phóng to:</span>
          <button
            type="button"
            onClick={() => setZoomScale((z) => Math.max(0.8, Number((z - 0.1).toFixed(2))))}
            className="px-1.5 py-0.5 text-xs hover:bg-white/20 rounded font-bold cursor-pointer"
            title="Thu nhỏ thân máy tính"
          >
            -
          </button>
          <span className="text-[11px] font-mono font-bold min-w-[34px] text-center text-amber-200">
            {Math.round(zoomScale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoomScale((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
            className="px-1.5 py-0.5 text-xs hover:bg-white/20 rounded font-bold cursor-pointer"
            title="Phóng to thân máy tính"
          >
            +
          </button>
          {zoomScale !== 1 && (
            <button
              type="button"
              onClick={() => setZoomScale(1)}
              className="text-[9.5px] text-amber-300 hover:underline ml-1 cursor-pointer"
              title="Đặt lại tỷ lệ chuẩn"
            >
              100%
            </button>
          )}
        </div>
        <span className="text-white/30">|</span>
        <button
          type="button"
          onClick={() => setShowChalk(!showChalk)}
          className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2 transition cursor-pointer"
        >
          {showChalk ? 'Ẩn phấn' : 'Hiện phấn'}
        </button>
        {onClose && (
          <>
            <span className="text-white/30">|</span>
            <button
              type="button"
              onClick={onClose}
              className="text-rose-300 hover:text-rose-100 font-bold transition cursor-pointer flex items-center gap-0.5"
              title="Đóng máy tính"
            >
              <X className="w-3.5 h-3.5" />
              <span>Đóng</span>
            </button>
          </>
        )}
      </div>

      {/* ====================================================================
          BỐ CỤC CHÍNH: MÁY TÍNH BÊN TRÁI + MÀN HÌNH LỚN BÊN PHẢI
      ==================================================================== */}
      <div
        className="relative z-10 w-full flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 transition-all duration-300"
      >
        {/* CỘT TRÁI: THÂN MÁY TÍNH CASIO + THANH CHẾ ĐỘ NHANH */}
        <div
          className="flex flex-col items-center shrink-0 transition-transform duration-200 origin-top"
          style={{
            transform: zoomScale !== 1 ? `scale(${zoomScale})` : undefined,
          }}
        >
          <div className="relative select-none">
        <div
          className="w-[340px] sm:w-[364px] rounded-[38px] p-[9px] shadow-[0_28px_70px_rgba(0,0,0,0.85),0_4px_16px_rgba(0,0,0,0.6)]"
          style={{
            background: 'linear-gradient(145deg, #e4e7ec 0%, #9ca3af 30%, #6b7280 70%, #374151 100%)',
          }}
        >
          <div className="rounded-[31px] p-[3px] bg-gradient-to-b from-zinc-900 via-zinc-950 to-black shadow-inner">
            <div
              className="relative rounded-[29px] px-3.5 pt-3.5 pb-5 flex flex-col justify-between overflow-hidden"
              style={{
                backgroundColor: '#1a1c20',
                backgroundImage: `
                  radial-gradient(#2c3038 1.25px, transparent 1.25px),
                  radial-gradient(#252830 1.25px, #17191d 1.25px)
                `,
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0, 4px 4px',
              }}
            >
              {/* 1. HEADER */}
              <div className="px-1.5 mb-2 flex items-start justify-between">
                <div>
                  <div className="text-white font-black tracking-[0.14em] text-[17px] leading-none font-sans">
                    CASIO
                  </div>
                  <div className="mt-1 text-zinc-200 font-bold italic text-[12px] tracking-wider font-serif">
                    fx-580VN X
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="font-extrabold text-[12.5px] tracking-[0.18em] leading-none uppercase"
                    style={{
                      background: 'linear-gradient(90deg, #93c5fd 0%, #e0e7ff 50%, #f9a8d4 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    CLASSWIZ
                  </div>
                  <div className="mt-1.5 text-[8px] font-semibold tracking-[0.16em] text-amber-400/90 uppercase">
                    NATURAL-V.P.A.M.
                  </div>
                </div>
              </div>

              {/* 2. KHUNG MÀN HÌNH LCD KA-TEX */}
              <div className="mx-0.5 mb-2.5 rounded-[16px] p-[7px] bg-gradient-to-b from-[#272a30] via-[#181a1f] to-[#23262c] shadow-[inset_0_3px_8px_rgba(0,0,0,0.9),0_1px_1px_rgba(255,255,255,0.12)] border border-zinc-700/60">
                <div className="rounded-[11px] p-[3px] bg-[#111317] shadow-inner">
                  <div
                    className="relative h-[110px] w-full rounded-[8px] px-2.5 py-1.5 flex flex-col justify-between overflow-hidden shadow-[inset_0_3px_7px_rgba(0,0,0,0.38)] border border-[#96a392]"
                    style={{
                      background: 'linear-gradient(180deg, #c6d1c3 0%, #bdcab9 60%, #b3c0af 100%)',
                    }}
                  >
                    {/* Thanh trạng thái */}
                    <div className="relative z-10 flex items-center justify-between border-b border-[#141c14]/20 pb-[2px] text-[9.5px] text-[#141c14]">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`px-[3px] py-[0.5px] rounded-[2px] transition font-bold ${
                            calcState.shift ? 'bg-[#141c14] text-[#c8d3c5]' : 'bg-[#141c14]/10 text-[#141c14]/35'
                          }`}
                        >
                          S
                        </span>
                        <span
                          className={`px-[3px] py-[0.5px] rounded-[2px] transition font-bold ${
                            calcState.alpha ? 'bg-[#141c14] text-[#c8d3c5]' : 'bg-[#141c14]/10 text-[#141c14]/35'
                          }`}
                        >
                          A
                        </span>
                        {calcState.stoMode && (
                          <span className="px-[3px] py-[0.5px] rounded-[2px] bg-[#141c14] text-[#c8d3c5] font-bold">
                            STO
                          </span>
                        )}
                        <span className="px-[3px] py-[0.5px] border border-[#141c14]/60 rounded-[2px] leading-none font-semibold">
                          √□
                        </span>
                        <span className="px-[3.5px] py-[0.5px] bg-[#141c14] text-[#c8d3c5] rounded-[2px] font-bold">
                          {calcState.angleUnit}
                        </span>
                        <span className="opacity-85 pl-0.5 font-semibold">
                          {calcState.mode.startsWith('EQN')
                            ? 'EQN'
                            : calcState.mode.startsWith('TABLE')
                            ? 'TABLE'
                            : calcState.mode.startsWith('VCT')
                            ? 'VCT'
                            : calcState.mode.startsWith('STAT')
                            ? 'STAT'
                            : 'Math'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 text-[8px]">
                        <span>▲▼</span>
                      </div>
                    </div>

                    {/* MENU CHÍNH */}
                    {calcState.mode === 'MENU' && (
                      <div className="relative z-10 flex-1 grid grid-cols-2 gap-x-1 content-between py-0.5 px-1">
                        <KatexScreenRenderer latex="\mathsf{1:COMP}" isReady={katexLoaded} className="text-[10px] text-[#0e140e]" />
                        <KatexScreenRenderer latex="\mathsf{5:Vector}" isReady={katexLoaded} className="text-[10px] text-[#0e140e]" />
                        <KatexScreenRenderer latex="\mathsf{6:Statistics}" isReady={katexLoaded} className="text-[10px] text-[#0e140e]" />
                        <KatexScreenRenderer latex="\mathsf{8:Table}" isReady={katexLoaded} className="text-[10px] text-[#0e140e]" />
                        <div className="col-span-2">
                          <KatexScreenRenderer latex="\mathsf{9:Equation/Func\;(EQN)}" isReady={katexLoaded} className="text-[10px] text-[#0e140e]" />
                        </div>
                      </div>
                    )}

                    {/* MENU 6: STATISTICS */}
                    {calcState.mode === 'STAT_SELECT' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-around py-0.5 px-1">
                        <KatexScreenRenderer
                          latex="\mathsf{1:1\text{-}Variable\;(x_i,\,n_i)}"
                          isReady={katexLoaded}
                          className="text-[10.5px] text-[#0e140e]"
                        />
                        <KatexScreenRenderer
                          latex="\mathsf{2:Grouped\;Data\;[L_i;U_i)\;(Q_1,Q_2,Q_3)}"
                          isReady={katexLoaded}
                          className="text-[10px] text-[#0e140e] font-bold"
                        />
                      </div>
                    )}

                    {calcState.mode === 'STAT_INPUT' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-between py-0.5 px-0.5 overflow-hidden">
                        <div className="flex flex-col space-y-0.5 overflow-hidden">
                          {calcState.statType === 'GROUPED' ? (
                            calcState.statGroupedRows
                              .map((row, rIdx) => ({ row, rIdx }))
                              .slice(Math.max(0, calcState.statRow - 1), Math.max(2, calcState.statRow + 1))
                              .map(({ row, rIdx }) => {
                                const cL =
                                  rIdx === calcState.statRow && calcState.statCol === 0
                                    ? `\\colorbox{#141c14}{$\\color{#c8d3c5}{${row.L}}$}`
                                    : row.L;
                                const cU =
                                  rIdx === calcState.statRow && calcState.statCol === 1
                                    ? `\\colorbox{#141c14}{$\\color{#c8d3c5}{${row.U}}$}`
                                    : row.U;
                                const cF =
                                  rIdx === calcState.statRow && calcState.statCol === 2
                                    ? `\\colorbox{#141c14}{$\\color{#c8d3c5}{${row.freq}}$}`
                                    : row.freq;
                                return (
                                  <div key={rIdx} className="flex items-center justify-between px-0.5">
                                    <KatexScreenRenderer
                                      latex={`\\small ${rIdx + 1}:\\;[${cL};\\,${cU})`}
                                      isReady={katexLoaded}
                                      className="text-[10.5px] text-[#0e140e]"
                                    />
                                    <KatexScreenRenderer
                                      latex={`\\small n_{${rIdx + 1}}=${cF}`}
                                      isReady={katexLoaded}
                                      className="text-[10.5px] text-[#0e140e]"
                                    />
                                  </div>
                                );
                              })
                          ) : (
                            calcState.stat1VarRows
                              .map((row, rIdx) => ({ row, rIdx }))
                              .slice(Math.max(0, calcState.statRow - 1), Math.max(2, calcState.statRow + 1))
                              .map(({ row, rIdx }) => {
                                const cX =
                                  rIdx === calcState.statRow && calcState.statCol === 0
                                    ? `\\colorbox{#141c14}{$\\color{#c8d3c5}{${row.x}}$}`
                                    : row.x;
                                const cF =
                                  rIdx === calcState.statRow && calcState.statCol === 1
                                    ? `\\colorbox{#141c14}{$\\color{#c8d3c5}{${row.freq}}$}`
                                    : row.freq;
                                return (
                                  <div key={rIdx} className="flex items-center justify-between px-0.5">
                                    <KatexScreenRenderer
                                      latex={`\\small x_{${rIdx + 1}}=${cX}`}
                                      isReady={katexLoaded}
                                      className="text-[10.5px] text-[#0e140e]"
                                    />
                                    <KatexScreenRenderer
                                      latex={`\\small n_{${rIdx + 1}}=${cF}`}
                                      isReady={katexLoaded}
                                      className="text-[10.5px] text-[#0e140e]"
                                    />
                                  </div>
                                );
                              })
                          )}
                        </div>
                        <div className="flex items-center justify-between border-t border-[#141c14]/20 pt-0.5 px-0.5">
                          <KatexScreenRenderer
                            latex="\mathsf{[OPTN]:\;Tính\;Q_1,Q_2,Q_3,\bar{x}}"
                            isReady={katexLoaded}
                            className="text-[9px] text-[#0e140e]/80"
                          />
                          <KatexScreenRenderer
                            latex="\mathsf{[=]:\;Tiếp}"
                            isReady={katexLoaded}
                            className="text-[9px] text-[#0b110b]"
                          />
                        </div>
                      </div>
                    )}

                    {calcState.mode === 'STAT_RESULT' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-between py-0.5 px-1">
                        <div className="flex items-center justify-between">
                          <KatexScreenRenderer
                            latex={`${calcState.statResults[calcState.statResultIndex]?.label || ''} =`}
                            isReady={katexLoaded}
                            className="text-[11px] text-[#0e140e]"
                          />
                          <KatexScreenRenderer
                            latex={`\\scriptstyle (${calcState.statResultIndex + 1}/${calcState.statResults.length})`}
                            isReady={katexLoaded}
                            className="text-[9px] text-[#0e140e]/70"
                          />
                        </div>
                        <div className="flex items-end justify-between overflow-x-auto scrollbar-none">
                          <KatexScreenRenderer
                            latex="\scriptstyle \mathsf{\blacktriangle\blacktriangledown:Đổi\;\;S\Leftrightarrow D}"
                            isReady={katexLoaded}
                            className="text-[8.5px] text-[#0e140e]/65"
                          />
                          <KatexScreenRenderer
                            latex={
                              calcState.showingDecimal
                                ? calcState.statResults[calcState.statResultIndex]?.decimalLatex
                                : calcState.statResults[calcState.statResultIndex]?.exactLatex
                            }
                            isReady={katexLoaded}
                            className="text-[13px] text-[#0b110b] font-bold"
                          />
                        </div>
                      </div>
                    )}

                    {/* MENU 5: VECTOR */}
                    {calcState.mode === 'VCT_SELECT' && (
                      <div className="relative z-10 flex-1 grid grid-cols-2 gap-x-2 content-around py-0.5 px-1">
                        <KatexScreenRenderer latex="\mathsf{1:VctA}" isReady={katexLoaded} className="text-[10.5px] text-[#0e140e]" />
                        <KatexScreenRenderer latex="\mathsf{2:VctB}" isReady={katexLoaded} className="text-[10.5px] text-[#0e140e]" />
                        <KatexScreenRenderer latex="\mathsf{3:VctC}" isReady={katexLoaded} className="text-[10.5px] text-[#0e140e]" />
                        <KatexScreenRenderer latex="\mathsf{4:VctD}" isReady={katexLoaded} className="text-[10.5px] text-[#0e140e]" />
                      </div>
                    )}

                    {calcState.mode === 'VCT_DIM' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-around py-0.5 px-1">
                        <KatexScreenRenderer
                          latex={`\\mathsf{${calcState.activeVctName}\\;Dimension?}`}
                          isReady={katexLoaded}
                          className="text-[10.5px] text-[#0e140e]"
                        />
                        <div className="flex items-center space-x-4">
                          <KatexScreenRenderer latex="\mathsf{2:2D\;(x,y)}" isReady={katexLoaded} className="text-[10.5px] text-[#0e140e]" />
                          <KatexScreenRenderer latex="\mathsf{3:3D\;(x,y,z)}" isReady={katexLoaded} className="text-[10.5px] text-[#0e140e]" />
                        </div>
                      </div>
                    )}

                    {calcState.mode === 'VCT_EDIT' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-between py-0.5 px-1 overflow-hidden">
                        <div className="flex items-center justify-between">
                          <KatexScreenRenderer
                            latex={`\\mathsf{${calcState.activeVctName}\\;(${calcState.vectors[calcState.activeVctName].dim}D)} =`}
                            isReady={katexLoaded}
                            className="text-[10.5px] text-[#0e140e]"
                          />
                          <div className="flex items-center space-x-1.5">
                            {calcState.vectors[calcState.activeVctName].coords
                              .slice(0, calcState.vectors[calcState.activeVctName].dim)
                              .map((val, idx) => {
                                const isSel = idx === calcState.vctCoordIndex;
                                const cellLatex = isSel ? `\\colorbox{#141c14}{$\\color{#c8d3c5}{${val}}$}` : val;
                                return (
                                  <KatexScreenRenderer
                                    key={idx}
                                    latex={cellLatex}
                                    isReady={katexLoaded}
                                    className="text-[11.5px] text-[#0e140e]"
                                  />
                                );
                              })}
                          </div>
                        </div>
                        <div className="text-right border-t border-[#141c14]/20 pt-0.5">
                          <KatexScreenRenderer
                            latex={`\\text{Coord } ${calcState.vctCoordIndex + 1} : ${
                              calcState.vctInputBuffer ||
                              calcState.vectors[calcState.activeVctName].coords[calcState.vctCoordIndex]
                            }`}
                            isReady={katexLoaded}
                            className="text-[10.5px] text-[#0b110b]"
                          />
                        </div>
                      </div>
                    )}

                    {calcState.mode === 'VCT_OPTN' && (
                      <div className="relative z-10 flex-1 grid grid-cols-2 gap-x-2 content-between py-0.5 px-1">
                        <KatexScreenRenderer latex="\mathsf{1:Def\;Vct}" isReady={katexLoaded} className="text-[9.5px] text-[#0e140e]" />
                        <KatexScreenRenderer latex="\mathsf{2:Edit\;Vct}" isReady={katexLoaded} className="text-[9.5px] text-[#0e140e]" />
                        <KatexScreenRenderer latex="\mathsf{3:VctA\;\;4:VctB}" isReady={katexLoaded} className="text-[9.5px] text-[#0e140e]" />
                        <KatexScreenRenderer latex="\mathsf{5:VctC\;\;6:VctD}" isReady={katexLoaded} className="text-[9.5px] text-[#0e140e]" />
                        <KatexScreenRenderer latex="\mathsf{7:Dot(\cdot)}" isReady={katexLoaded} className="text-[9.5px] text-[#0e140e]" />
                        <KatexScreenRenderer latex="\mathsf{8:Angle}" isReady={katexLoaded} className="text-[9.5px] text-[#0e140e]" />
                      </div>
                    )}

                    {calcState.mode === 'VCT_CALC' && (
                      <>
                        <div className="relative z-10 flex-1 flex items-center justify-start pt-0.5 pl-0.5 overflow-x-auto scrollbar-none">
                          <KatexScreenRenderer
                            latex={`\\displaystyle ${serializeSlotToLatex(calcState.vctCalcSlot, calcState.cursor, true)}`}
                            isReady={katexLoaded}
                            className="text-[13px] text-[#0e140e] tracking-tight whitespace-nowrap"
                          />
                        </div>
                        <div className="relative z-10 flex items-end justify-between pb-0.5 pr-0.5 min-h-[26px]">
                          <KatexScreenRenderer
                            latex="\scriptstyle \mathsf{[OPTN]:Vct}"
                            isReady={katexLoaded}
                            className="text-[9px] text-[#0e140e]/60"
                          />
                          {calcState.resultLatex && (
                            <KatexScreenRenderer
                              latex={calcState.resultLatex}
                              isReady={katexLoaded}
                              className="text-[12.5px] text-[#0b110b] font-bold"
                            />
                          )}
                        </div>
                      </>
                    )}

                    {/* MENU 9: EQN */}
                    {calcState.mode === 'EQN_SELECT' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-around py-0.5 px-1">
                        <KatexScreenRenderer latex="\mathsf{1:Simul\;Equation\;(Hệ\;PT)}" isReady={katexLoaded} className="text-[10.5px] text-[#0e140e]" />
                        <KatexScreenRenderer latex="\mathsf{2:Polynomial\;(PT\;Đa\;thức)}" isReady={katexLoaded} className="text-[10.5px] text-[#0e140e]" />
                      </div>
                    )}

                    {calcState.mode === 'EQN_SYS_SIZE' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-around py-0.5 px-1">
                        <KatexScreenRenderer latex="\mathsf{Number\;of\;Unknowns\;(2\sim 4)?}" isReady={katexLoaded} className="text-[10.5px] text-[#0e140e]" />
                        <KatexScreenRenderer latex="\mathsf{[2]\quad [3]\quad [4]}" isReady={katexLoaded} className="text-[11.5px] text-[#0e140e]" />
                      </div>
                    )}

                    {calcState.mode === 'EQN_POLY_DEG' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-around py-0.5 px-1">
                        <KatexScreenRenderer latex="\mathsf{Polynomial\;Degree\;(2\sim 3)?}" isReady={katexLoaded} className="text-[10.5px] text-[#0e140e]" />
                        <KatexScreenRenderer latex="\mathsf{[2:\;ax^2+bx+c=0]\quad [3]}" isReady={katexLoaded} className="text-[10.5px] text-[#0e140e]" />
                      </div>
                    )}

                    {calcState.mode === 'EQN_INPUT' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-between py-0.5 px-0.5 overflow-hidden">
                        <div className="overflow-x-auto scrollbar-none flex flex-col space-y-0.5">
                          {prevOrCurrentEqnLines(calcState).map((lineLatex, idx) => (
                            <KatexScreenRenderer
                              key={idx}
                              latex={lineLatex}
                              isReady={katexLoaded}
                              className="text-[11px] text-[#0e140e] whitespace-nowrap"
                            />
                          ))}
                        </div>
                        <div className="text-right border-t border-[#141c14]/20 pt-0.5">
                          <KatexScreenRenderer
                            latex={`\\text{Input} : ${
                              calcState.eqnInputBuffer ||
                              (calcState.eqnType === 'SYS'
                                ? calcState.eqnMatrix[calcState.eqnRow][calcState.eqnCol]
                                : calcState.eqnPolyCoeffs[calcState.eqnCol])
                            }`}
                            isReady={katexLoaded}
                            className="text-[10.5px] text-[#0b110b]"
                          />
                        </div>
                      </div>
                    )}

                    {calcState.mode === 'EQN_RESULT' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-between py-0.5 px-1">
                        <div className="flex items-center justify-between">
                          <KatexScreenRenderer
                            latex={`${calcState.eqnSolutions[calcState.eqnSolIndex]?.label || 'x'} =`}
                            isReady={katexLoaded}
                            className="text-[12px] text-[#0e140e]"
                          />
                          <KatexScreenRenderer
                            latex={`\\scriptstyle (${calcState.eqnSolIndex + 1}/${calcState.eqnSolutions.length})`}
                            isReady={katexLoaded}
                            className="text-[9.5px] text-[#0e140e]/70"
                          />
                        </div>
                        <div className="text-right overflow-x-auto scrollbar-none">
                          <KatexScreenRenderer
                            latex={
                              calcState.showingDecimal
                                ? calcState.eqnSolutions[calcState.eqnSolIndex]?.decimalLatex
                                : calcState.eqnSolutions[calcState.eqnSolIndex]?.exactLatex
                            }
                            isReady={katexLoaded}
                            className="text-[14px] text-[#0b110b] font-bold"
                          />
                        </div>
                      </div>
                    )}

                    {/* CALC / SOLVE PROMPT */}
                    {(calcState.mode === 'CALC_PROMPT' || calcState.mode === 'SOLVE_PROMPT') && (
                      <div className="relative z-10 flex-1 flex flex-col justify-between py-1 px-1">
                        <div className="flex items-center justify-between">
                          <KatexScreenRenderer
                            latex={`${
                              calcState.mode === 'SOLVE_PROMPT' ? '\\text{Solve for } x' : calcState.promptVars[calcState.promptVarIndex] || 'x'
                            } = ?`}
                            isReady={katexLoaded}
                            className="text-[12.5px] text-[#0e140e]"
                          />
                        </div>
                        <div className="text-right">
                          <KatexScreenRenderer
                            latex={
                              calcState.promptInputBuffer ||
                              String(calcState.memoryVars[calcState.promptVars[calcState.promptVarIndex] || 'x'] || 0)
                            }
                            isReady={katexLoaded}
                            className="text-[14px] text-[#0b110b]"
                          />
                        </div>
                      </div>
                    )}

                    {/* MENU 8: TABLE */}
                    {(calcState.mode === 'TABLE_F' || calcState.mode === 'TABLE_G') && (
                      <div className="relative z-10 flex-1 flex flex-col justify-between py-1 px-1">
                        <div className="overflow-x-auto scrollbar-none">
                          <KatexScreenRenderer
                            latex={`${calcState.mode === 'TABLE_F' ? 'f(x)=' : 'g(x)='}\\displaystyle ${serializeSlotToLatex(
                              calcState.mode === 'TABLE_F' ? calcState.tableFSlot : calcState.tableGSlot,
                              calcState.cursor,
                              true
                            )}`}
                            isReady={katexLoaded}
                            className="text-[13px] text-[#0e140e] whitespace-nowrap"
                          />
                        </div>
                        <div className="text-right">
                          <KatexScreenRenderer
                            latex="\mathsf{Press\;[=]\;to\;continue}"
                            isReady={katexLoaded}
                            className="text-[9px] text-[#0e140e]/70"
                          />
                        </div>
                      </div>
                    )}

                    {calcState.mode === 'TABLE_PARAMS' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-between py-0.5 px-1">
                        {['start', 'end', 'step'].map((pk, idx) => {
                          const label = pk === 'start' ? 'Start' : pk === 'end' ? 'End' : 'Step';
                          const active = calcState.tableParamIndex === idx;
                          const val = active && calcState.tableParamBuffer !== '' ? calcState.tableParamBuffer : calcState.tableParams[pk];
                          return (
                            <div key={pk} className="flex items-center justify-between">
                              <KatexScreenRenderer latex={`\\text{${label}} :`} isReady={katexLoaded} className="text-[10.5px] text-[#0e140e]" />
                              <KatexScreenRenderer
                                latex={active ? `\\colorbox{#141c14}{$\\color{#c8d3c5}{${val}}$}` : val}
                                isReady={katexLoaded}
                                className="text-[11px] text-[#0e140e]"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {calcState.mode === 'TABLE_VIEW' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-between py-0.5 px-1 text-[10px]">
                        <div className="grid grid-cols-3 border-b border-[#141c14]/30 pb-0.5">
                          <KatexScreenRenderer latex="x" isReady={katexLoaded} />
                          <KatexScreenRenderer latex="f(x)" isReady={katexLoaded} />
                          {calcState.tableHasG && <KatexScreenRenderer latex="g(x)" isReady={katexLoaded} />}
                        </div>
                        {calcState.tableRows.slice(calcState.tableScroll, calcState.tableScroll + 3).map((r, i) => (
                          <div key={i} className="grid grid-cols-3 py-[0.5px]">
                            <KatexScreenRenderer latex={r.xLatex} isReady={katexLoaded} />
                            <KatexScreenRenderer latex={r.fxLatex} isReady={katexLoaded} />
                            {calcState.tableHasG && <KatexScreenRenderer latex={r.gxLatex} isReady={katexLoaded} />}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* CHẾ ĐỘ COMP MẶC ĐỊNH */}
                    {calcState.mode === 'COMP' && (
                      <>
                        <div className="relative z-10 flex-1 flex items-center justify-start pt-0.5 pl-0.5 overflow-x-auto scrollbar-none">
                          <KatexScreenRenderer
                            latex={`\\displaystyle ${currentLatexExpression}`}
                            isReady={katexLoaded}
                            className="text-[13.5px] text-[#0e140e] tracking-tight whitespace-nowrap"
                          />
                        </div>
                        <div className="relative z-10 flex items-end justify-end pb-0.5 pr-0.5 min-h-[26px]">
                          {calcState.resultLatex && (
                            <KatexScreenRenderer
                              latex={`\\displaystyle ${calcState.resultLatex}`}
                              isReady={katexLoaded}
                              className="text-[15.5px] text-[#0b110b] font-bold"
                            />
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. BÀN PHÍM KHOA HỌC PHÍA TRÊN + D-PAD (TỐI ƯU CẢM ỨNG 0MS CHO TV 75 INCH) */}
              <div className="relative grid grid-cols-6 gap-x-[6px] gap-y-[2.5px] px-0.5 items-end select-none" style={{ touchAction: 'manipulation' }}>
                {/* Hàng 1 */}
                <div className="flex flex-col items-center">
                  <div className="h-[10px]" />
                  <button
                    type="button"
                    onTouchStart={(e) => { e.stopPropagation(); handleFastPress({ id: 'shift' }, e); }}
                    onPointerDown={(e) => { if (e.pointerType === 'touch') return; handleFastPress({ id: 'shift' }, e); }}
                    onClick={(e) => handleFastPress({ id: 'shift' }, e)}
                    style={{ touchAction: 'none' }}
                    className={`w-full h-[22px] rounded-full bg-gradient-to-b from-[#3f444e] to-[#23272e] border shadow-[0_2px_0_#0f1115] active:translate-y-[1px] active:scale-95 flex items-center justify-center cursor-pointer select-none transition-transform duration-75 ${
                      calcState.shift ? 'border-[#e5b546] ring-1 ring-[#e5b546]/60' : 'border-zinc-600/50'
                    }`}
                  >
                    <span className="text-[9px] font-extrabold tracking-tight text-[#e5b546] pointer-events-none">SHIFT</span>
                  </button>
                </div>

                <div className="flex flex-col items-center">
                  <div className="h-[10px]" />
                  <button
                    type="button"
                    onTouchStart={(e) => { e.stopPropagation(); handleFastPress({ id: 'alpha' }, e); }}
                    onPointerDown={(e) => { if (e.pointerType === 'touch') return; handleFastPress({ id: 'alpha' }, e); }}
                    onClick={(e) => handleFastPress({ id: 'alpha' }, e)}
                    style={{ touchAction: 'none' }}
                    className={`w-full h-[22px] rounded-full bg-gradient-to-b from-[#3f444e] to-[#23272e] border shadow-[0_2px_0_#0f1115] active:translate-y-[1px] active:scale-95 flex items-center justify-center cursor-pointer select-none transition-transform duration-75 ${
                      calcState.alpha ? 'border-[#e05368] ring-1 ring-[#e05368]/60' : 'border-zinc-600/50'
                    }`}
                  >
                    <span className="text-[9px] font-extrabold tracking-tight text-[#e05368] pointer-events-none">ALPHA</span>
                  </button>
                </div>

                {/* Cụm D-Pad Phản Hồi Tức Thì 0ms */}
                <div className="col-span-2 row-span-2 flex items-center justify-center pt-1 select-none" style={{ touchAction: 'none' }}>
                  <div
                    className="relative w-[84px] h-[64px] rounded-[32px] p-[2.5px] shadow-[0_4px_8px_rgba(0,0,0,0.75),inset_0_1px_2px_rgba(255,255,255,0.8)] border border-zinc-400"
                    style={{
                      background: 'radial-gradient(circle at 50% 30%, #f3f4f6 0%, #d1d5db 45%, #9ca3af 85%, #6b7280 100%)',
                    }}
                  >
                    <div className="relative w-full h-full rounded-[28px] border border-zinc-500/40 flex items-center justify-center overflow-hidden">
                      <div className="w-[32px] h-[24px] rounded-full bg-gradient-to-b from-zinc-200 to-zinc-400 border border-zinc-500/40 shadow-inner pointer-events-none" />
                      <button
                        type="button"
                        onTouchStart={(e) => { e.stopPropagation(); handleFastCursor('UP', e); }}
                        onPointerDown={(e) => { if (e.pointerType === 'touch') return; handleFastCursor('UP', e); }}
                        onClick={(e) => handleFastCursor('UP', e)}
                        style={{ touchAction: 'none' }}
                        className="absolute top-0.5 inset-x-4 h-4 flex items-center justify-center text-zinc-800 hover:text-black active:scale-90 cursor-pointer select-none"
                      >
                        <span className="text-[7.5px] pointer-events-none">▲</span>
                      </button>
                      <button
                        type="button"
                        onTouchStart={(e) => { e.stopPropagation(); handleFastCursor('DOWN', e); }}
                        onPointerDown={(e) => { if (e.pointerType === 'touch') return; handleFastCursor('DOWN', e); }}
                        onClick={(e) => handleFastCursor('DOWN', e)}
                        style={{ touchAction: 'none' }}
                        className="absolute bottom-0.5 inset-x-4 h-4 flex items-center justify-center text-zinc-800 hover:text-black active:scale-90 cursor-pointer select-none"
                      >
                        <span className="text-[7.5px] pointer-events-none">▼</span>
                      </button>
                      <button
                        type="button"
                        onTouchStart={(e) => { e.stopPropagation(); handleFastCursor('LEFT', e); }}
                        onPointerDown={(e) => { if (e.pointerType === 'touch') return; handleFastCursor('LEFT', e); }}
                        onClick={(e) => handleFastCursor('LEFT', e)}
                        style={{ touchAction: 'none' }}
                        className="absolute left-1 inset-y-2.5 w-4 flex items-center justify-center text-zinc-800 hover:text-black active:scale-90 cursor-pointer select-none"
                      >
                        <span className="text-[7.5px] pointer-events-none">◀</span>
                      </button>
                      <button
                        type="button"
                        onTouchStart={(e) => { e.stopPropagation(); handleFastCursor('RIGHT', e); }}
                        onPointerDown={(e) => { if (e.pointerType === 'touch') return; handleFastCursor('RIGHT', e); }}
                        onClick={(e) => handleFastCursor('RIGHT', e)}
                        style={{ touchAction: 'none' }}
                        className="absolute right-1 inset-y-2.5 w-4 flex items-center justify-center text-zinc-800 hover:text-black active:scale-90 cursor-pointer select-none"
                      >
                        <span className="text-[7.5px] pointer-events-none">▶</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  <div className="h-[10px] flex items-end justify-center">
                    <span className="text-[7px] font-bold text-[#e5b546] leading-none pointer-events-none">SETUP</span>
                  </div>
                  <button
                    type="button"
                    onTouchStart={(e) => { e.stopPropagation(); handleFastPress({ id: 'menu' }, e); }}
                    onPointerDown={(e) => { if (e.pointerType === 'touch') return; handleFastPress({ id: 'menu' }, e); }}
                    onClick={(e) => handleFastPress({ id: 'menu' }, e)}
                    style={{ touchAction: 'none' }}
                    className="w-full h-[22px] rounded-full bg-gradient-to-b from-[#3f444e] to-[#23272e] border border-zinc-600/50 shadow-[0_2px_0_#0f1115] active:translate-y-[1px] active:scale-95 flex items-center justify-center cursor-pointer select-none transition-transform duration-75"
                  >
                    <span className="text-[9px] font-bold tracking-tight text-zinc-100 pointer-events-none">MENU</span>
                  </button>
                </div>

                <div className="flex flex-col items-center">
                  <div className="h-[10px]" />
                  <button
                    type="button"
                    onTouchStart={(e) => { e.stopPropagation(); handleFastPress({ id: 'on' }, e); }}
                    onPointerDown={(e) => { if (e.pointerType === 'touch') return; handleFastPress({ id: 'on' }, e); }}
                    onClick={(e) => handleFastPress({ id: 'on' }, e)}
                    style={{ touchAction: 'none' }}
                    className="w-full h-[22px] rounded-full bg-gradient-to-b from-[#3f444e] to-[#23272e] border border-zinc-600/50 shadow-[0_2px_0_#0f1115] active:translate-y-[1px] active:scale-95 flex items-center justify-center cursor-pointer select-none transition-transform duration-75"
                  >
                    <span className="text-[9px] font-bold tracking-tight text-zinc-100 pointer-events-none">ON</span>
                  </button>
                </div>

                {/* Hàng 2..5 (Memoized Các Phím Khoa Học) */}
                {SCIENTIFIC_ROWS.map((row) =>
                  row.map((keyItem) => {
                    if (!keyItem) return null;
                    return (
                      <ScientificKeyButton
                        key={keyItem.id}
                        keyItem={keyItem}
                        onPress={handleFastPress}
                        katexLoaded={katexLoaded}
                      />
                    );
                  })
                )}
              </div>

              <div className="my-2 h-[1px] w-full bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />

              {/* 4. BÀN PHÍM SỐ PHÍA DƯỚI (Memoized Các Phím Số 0-9 & Phép Tính) */}
              <div className="grid grid-cols-5 gap-x-[7px] gap-y-[3.5px] px-0.5 select-none" style={{ touchAction: 'manipulation' }}>
                {NUMPAD_ROWS.map((row) =>
                  row.map((keyItem) => {
                    return (
                      <NumpadKeyButton
                        key={keyItem.id}
                        keyItem={keyItem}
                        onPress={handleFastPress}
                        katexLoaded={katexLoaded}
                      />
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Thanh chuyển nhanh chế độ */}
      <div className="relative z-10 mt-2.5 w-[340px] sm:w-[364px] rounded-xl bg-[#0d1c14] border border-white/20 px-3 py-2 text-white/90 shadow-lg select-none" style={{ touchAction: 'manipulation' }}>
        <div className="flex flex-wrap items-center justify-between gap-1 text-[10px]">
          <span className="text-emerald-300 font-semibold">Chế độ nhanh:</span>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onPointerDown={(e) => handleFastPress({ id: 'menu' }, e)}
              onClick={(e) => handleFastPress({ id: 'menu' }, e)}
              style={{ touchAction: 'manipulation' }}
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 active:scale-95 transition cursor-pointer select-none"
            >
              [MENU]
            </button>
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); setCalcState((p) => ({ ...p, mode: 'COMP' })); }}
              onClick={(e) => { e.preventDefault(); setCalcState((p) => ({ ...p, mode: 'COMP' })); }}
              style={{ touchAction: 'manipulation' }}
              className={`px-2 py-0.5 rounded active:scale-95 transition cursor-pointer select-none ${
                calcState.mode === 'COMP' ? 'bg-emerald-500/40 border border-emerald-300/50 text-white font-semibold' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              1: COMP
            </button>
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); setCalcState((p) => ({ ...p, mode: 'VCT_SELECT', resultLatex: '' })); }}
              onClick={(e) => { e.preventDefault(); setCalcState((p) => ({ ...p, mode: 'VCT_SELECT', resultLatex: '' })); }}
              style={{ touchAction: 'manipulation' }}
              className={`px-2 py-0.5 rounded active:scale-95 transition cursor-pointer select-none ${
                calcState.mode.startsWith('VCT') ? 'bg-emerald-500/40 border border-emerald-300/50 text-white font-semibold' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              5: VECTOR
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                setCalcState((p) => ({
                  ...p,
                  mode: 'STAT_INPUT',
                  statType: 'GROUPED',
                  statRow: 0,
                  statCol: 0,
                  statInputBuffer: '',
                }));
              }}
              onClick={(e) => {
                e.preventDefault();
                setCalcState((p) => ({
                  ...p,
                  mode: 'STAT_INPUT',
                  statType: 'GROUPED',
                  statRow: 0,
                  statCol: 0,
                  statInputBuffer: '',
                }));
              }}
              style={{ touchAction: 'manipulation' }}
              className={`px-2 py-0.5 rounded active:scale-95 transition cursor-pointer select-none ${
                calcState.mode.startsWith('STAT') ? 'bg-amber-500/40 border border-amber-300/60 text-amber-100 font-semibold' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              6: STAT (Ghép nhóm Q1,Q2,Q3)
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                setCalcState((p) => ({
                  ...p,
                  mode: 'TABLE_F',
                  cursor: { slotId: p.tableFSlot.id, index: p.tableFSlot.items.length },
                }));
              }}
              onClick={(e) => {
                e.preventDefault();
                setCalcState((p) => ({
                  ...p,
                  mode: 'TABLE_F',
                  cursor: { slotId: p.tableFSlot.id, index: p.tableFSlot.items.length },
                }));
              }}
              style={{ touchAction: 'manipulation' }}
              className={`px-2 py-0.5 rounded active:scale-95 transition cursor-pointer select-none ${
                calcState.mode.startsWith('TABLE') ? 'bg-emerald-500/40 border border-emerald-300/50 text-white font-semibold' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              8: TABLE
            </button>
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); setCalcState((p) => ({ ...p, mode: 'EQN_SELECT' })); }}
              onClick={(e) => { e.preventDefault(); setCalcState((p) => ({ ...p, mode: 'EQN_SELECT' })); }}
              style={{ touchAction: 'manipulation' }}
              className={`px-2 py-0.5 rounded active:scale-95 transition cursor-pointer select-none ${
                calcState.mode.startsWith('EQN') ? 'bg-emerald-500/40 border border-emerald-300/50 text-white font-semibold' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              9: EQN
            </button>
          </div>
        </div>
        <div className="mt-1.5 pt-1.5 border-t border-white/10 flex items-center justify-between text-[9.5px] text-white/75">
          <span>Mô phỏng Toán Phổ Thông & Tứ phân vị ghép nhóm</span>
          <span className="font-semibold text-amber-300">Được phát triển bởi TTK</span>
        </div>
      </div>
    </div>

    {/* CỘT PHẢI: MÀN HÌNH LỚN CHO HỌC SINH (PHÓNG ĐẠI) */}
    {showBigScreen && (
      <ClassroomBigScreen
        calcState={calcState}
        setCalcState={setCalcState}
        katexLoaded={katexLoaded}
        currentLatexExpression={currentLatexExpression}
        onClose={() => setShowBigScreen(false)}
      />
    )}
  </div>
</div>
);
}

function prevOrCurrentEqnLines(state: any): string[] {
  if (state.eqnType === 'SYS') {
    const vars = ['x', 'y', 'z', 't'].slice(0, state.eqnSize);
    const r = state.eqnRow;
    const row = state.eqnMatrix[r];
    const lhs = vars
      .map((v: string, c: number) => {
        const cell = r === state.eqnRow && c === state.eqnCol ? `\\colorbox{#141c14}{$\\color{#c8d3c5}{${row[c]}}$}` : row[c];
        return `${cell}${v}`;
      })
      .join('+');
    const rhs =
      r === state.eqnRow && state.eqnCol === state.eqnSize
        ? `\\colorbox{#141c14}{$\\color{#c8d3c5}{${row[state.eqnSize]}}$}`
        : row[state.eqnSize];
    return [`\\small (\\text{PT } ${r + 1}/${state.eqnSize})\\quad ${lhs}=${rhs}`];
  } else {
    const deg = state.eqnSize;
    const terms = [];
    for (let c = 0; c <= deg; c++) {
      const p = deg - c;
      const raw = state.eqnPolyCoeffs[c];
      const cell = c === state.eqnCol ? `\\colorbox{#141c14}{$\\color{#c8d3c5}{${raw}}$}` : raw;
      const xPart = p === 0 ? '' : p === 1 ? 'x' : `x^${p}`;
      terms.push(`${cell}${xPart}`);
    }
    return [`\\small ${terms.join('+')}=0`];
  }
}

class SafeCalculatorErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose?: () => void },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode; onClose?: () => void }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorMsg: error ? String(error.message || error) : 'Unknown Error' };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('Lỗi hệ thống Casio fx-580VN X:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[300px] flex flex-col items-center justify-center bg-[#193829] text-white p-6 text-center rounded-3xl border border-white/20 shadow-2xl">
          <h2 className="text-xl font-bold text-amber-300 mb-2">Đã xảy ra sự cố hiển thị</h2>
          <p className="text-xs text-white/80 mb-6 max-w-md font-mono bg-black/40 p-3 rounded-lg border border-white/10 shadow-inner">
            {this.state.errorMsg}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMsg: '' })}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold cursor-pointer transition shadow-lg"
            >
              Thử lại
            </button>
            {this.props.onClose && (
              <button
                type="button"
                onClick={this.props.onClose}
                className="px-5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-bold cursor-pointer transition shadow-lg"
              >
                Đóng
              </button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const CasioCalculatorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 animate-in fade-in duration-200 select-none overflow-y-auto">
      <div className="relative my-auto flex flex-col items-center">
        {/* Nút đóng nổi bật góc trên bên phải */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3.5 -right-3.5 z-50 p-2 rounded-full bg-slate-900/90 hover:bg-rose-600 text-white shadow-2xl border border-white/25 transition-all cursor-pointer active:scale-95"
          title="Đóng máy tính Casio fx-580VN X"
        >
          <X className="w-4 h-4" />
        </button>

        <SafeCalculatorErrorBoundary onClose={onClose}>
          <CasioFx580VNXInner onClose={onClose} />
        </SafeCalculatorErrorBoundary>
      </div>
    </div>
  );
};

export default CasioCalculatorModal;
