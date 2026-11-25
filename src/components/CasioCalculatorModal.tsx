declare global {
  interface Window {
    katex?: any;
    math?: any;
    nerdamer?: any;
  }
}

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Columns2, Monitor, ArrowLeftRight } from 'lucide-react';
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
  const formatNumberToLatex = (
    val: any,
    preferFraction = true,
    fmtOptions?: {
      numberFormat?: { type: 'Norm1' | 'Norm2' | 'Fix' | 'Sci'; digits: number };
      fractionResult?: 'ab/c' | 'd/c';
    }
  ) => {
    if (val === null || val === undefined || Number.isNaN(val)) return '\\text{Math ERROR}';
    if (!Number.isFinite(val)) return '\\text{Math ERROR}';
    const cleanVal = Math.abs(val) < 1e-12 ? 0 : Number(val.toPrecision(12));
    const nf = fmtOptions?.numberFormat;

    if (cleanVal === 0) {
      if (!preferFraction && nf?.type === 'Fix') return (0).toFixed(nf.digits);
      if (!preferFraction && nf?.type === 'Sci') return `0\\times 10^{0}`;
      return '0';
    }

    if (preferFraction && window.math) {
      try {
        const frac = window.math.fraction(cleanVal);
        const s = Number(frac.s);
        const n = Number(frac.n);
        const d = Number(frac.d);
        if (d === 1) return `${s * n}`;
        if (d > 1 && d <= 99999 && n <= 9999999) {
          if (fmtOptions?.fractionResult === 'ab/c' && n > d) {
            const whole = Math.floor(n / d);
            const rem = n % d;
            return `${s < 0 ? '-' : ''}${whole}\\frac{${rem}}{${d}}`;
          }
          return `${s < 0 ? '-' : ''}\\frac{${n}}{${d}}`;
        }
      } catch (e) {
        // Bỏ qua nếu không đổi được phân số
      }
    }

    if (nf?.type === 'Fix') {
      return cleanVal.toFixed(Math.max(0, Math.min(9, nf.digits)));
    }
    if (nf?.type === 'Sci') {
      const sig = Math.max(0, Math.min(9, nf.digits));
      const expStr = cleanVal.toExponential(Math.max(0, sig > 0 ? sig - 1 : 0));
      const [mantissa, expPart] = expStr.split('e');
      return `${mantissa}\\times 10^{${parseInt(expPart, 10)}}`;
    }

    const lowThresh = nf?.type === 'Norm2' ? 1e-9 : 1e-3;
    if (Math.abs(cleanVal) >= 1e10 || (Math.abs(cleanVal) > 0 && Math.abs(cleanVal) < lowThresh)) {
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
    for (const item of slot.items) {
      if (item.type === 'token' && (item.latex === '=' || item.latex === ':')) {
        throw new Error('SYNTAX_ERROR');
      }
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

  const evaluateCompTree = (rootSlot: any, angleUnit = 'D', memoryVars: any = {}, fmtOptions?: any) => {
    try {
      const exprStr = compileSlotToMathJs(rootSlot);
      const value = evaluateExpressionString(exprStr, angleUnit, memoryVars);
      const exactLatex = formatNumberToLatex(value, true, fmtOptions);
      const decimalLatex = formatNumberToLatex(value, false, fmtOptions);
      return { ok: true, value, exactLatex, decimalLatex, compiled: exprStr };
    } catch (err: any) {
      const msg = err.message === 'SYNTAX_ERROR' ? '\\text{Syntax ERROR}' : '\\text{Math ERROR}';
      return { ok: false, errorLatex: msg };
    }
  };

  const solveSingleVariableEquation = (rootSlot: any, xInit = 1, angleUnit = 'D', memoryVars: any = {}, fmtOptions?: any) => {
    try {
      const items = rootSlot?.items || [];
      if (items.length === 0) return { ok: false, errorLatex: '\\text{Syntax ERROR}' };

      const eqIndex = items.findIndex((it: any) => it.type === 'token' && it.latex === '=');
      let exprStr = '';
      if (eqIndex !== -1) {
        const lhsSlot = createSlot(items.slice(0, eqIndex));
        const rhsSlot = createSlot(items.slice(eqIndex + 1));
        if (lhsSlot.items.length === 0 || rhsSlot.items.length === 0) {
          return { ok: false, errorLatex: '\\text{Syntax ERROR}' };
        }
        const lhsStr = compileSlotToMathJs(lhsSlot);
        const rhsStr = compileSlotToMathJs(rhsSlot);
        exprStr = `(${lhsStr})-(${rhsStr})`;
      } else {
        exprStr = compileSlotToMathJs(rootSlot);
      }

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
                exactLatex: formatNumberToLatex(firstVal, true, fmtOptions),
                decimalLatex: formatNumberToLatex(firstVal, false, fmtOptions),
              };
            }
          }
        } catch (e) {
          // Tiếp tục với phương pháp Newton-Raphson
        }
      }

      const startGuesses = [Number.isFinite(xInit) ? xInit : 1, 0.5, -1, 2, -3, 5];
      for (const guess of startGuesses) {
        let x = guess;
        for (let iter = 0; iter < 65; iter++) {
          let fx: number;
          try {
            fx = evaluateExpressionString(exprStr, angleUnit, { ...memoryVars, x });
          } catch {
            x += 0.37;
            continue;
          }
          if (Math.abs(fx) < 1e-10) {
            return {
              ok: true,
              root: x,
              residual: 0,
              exactLatex: formatNumberToLatex(x, true, fmtOptions),
              decimalLatex: formatNumberToLatex(x, false, fmtOptions),
            };
          }
          let dfx = 0;
          try {
            dfx = evaluateDerivative(exprStr, x, angleUnit, memoryVars);
          } catch {
            dfx = 0;
          }
          if (!Number.isFinite(dfx) || Math.abs(dfx) < 1e-12) {
            x += 0.43;
            continue;
          }
          const step = Math.max(-100, Math.min(100, fx / dfx));
          const nextX = x - step;
          if (!Number.isFinite(nextX)) break;
          if (Math.abs(nextX - x) < 1e-10) {
            try {
              const finalF = evaluateExpressionString(exprStr, angleUnit, { ...memoryVars, x: nextX });
              if (Math.abs(finalF) < 1e-5) {
                return {
                  ok: true,
                  root: nextX,
                  residual: Math.abs(finalF) < 1e-10 ? 0 : Number(finalF.toPrecision(4)),
                  exactLatex: formatNumberToLatex(nextX, true, fmtOptions),
                  decimalLatex: formatNumberToLatex(nextX, false, fmtOptions),
                };
              }
            } catch {
              // ignore
            }
          }
          x = nextX;
        }
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

  const evaluateVectorExpression = (slot: any, vectors: any, vctAns: any, angleUnit = 'D', fmtOptions?: any): any => {
    const getVec = (name: string) => {
      const v = name === 'VctAns' ? vctAns : vectors[name];
      if (!v || (name !== 'VctAns' && v.defined === false)) throw new Error('DIMENSION_ERROR');
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
        const innerRes = evaluateVectorExpression(items[0].slots.inner, vectors, vctAns, angleUnit, fmtOptions);
        if (!innerRes.ok || innerRes.kind !== 'vector') throw new Error('SYNTAX_ERROR');
        const val = norm(innerRes.vec);
        return {
          ok: true,
          kind: 'scalar',
          value: val,
          exactLatex: formatNumberToLatex(val, true, fmtOptions),
          decimalLatex: formatNumberToLatex(val, false, fmtOptions),
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
        .replace(/\\text\{UnitVct\}\(/g, 'UnitVct(')
        .replace(/\\text\{Abs\}\(/g, 'Abs(')
        .replace(/\\boldsymbol\{\\cdot\}/g, ' DOT ')
        .replace(/\\times /g, ' CROSS ')
        .trim();

      const unitMatch = rawStr.match(/^UnitVct\(\s*(Vct[A-D]|VctAns)\s*\)?$/);
      if (unitMatch) {
        const v = getVec(unitMatch[1]);
        const nv = norm(v);
        if (nv < 1e-12) throw new Error('MATH_ERROR');
        const uVec = v.map((x: number) => x / nv);
        const ltx = `\\begin{bmatrix} ${uVec.map((x: number) => formatNumberToLatex(x, true, fmtOptions)).join(' \\\\ ')} \\end{bmatrix}`;
        const decLtx = `\\begin{bmatrix} ${uVec.map((x: number) => formatNumberToLatex(x, false, fmtOptions)).join(' \\\\ ')} \\end{bmatrix}`;
        return { ok: true, kind: 'vector', vec: uVec, exactLatex: ltx, decimalLatex: decLtx };
      }

      const angleMatch = rawStr.match(/^Angle\(\s*(Vct[A-D]|VctAns)\s*,\s*(Vct[A-D]|VctAns)\s*\)?$/);
      if (angleMatch) {
        const ang = angleBetween(getVec(angleMatch[1]), getVec(angleMatch[2]));
        return {
          ok: true,
          kind: 'scalar',
          value: ang,
          exactLatex: formatNumberToLatex(ang, true, fmtOptions),
          decimalLatex: formatNumberToLatex(ang, false, fmtOptions),
        };
      }

      const absMatch = rawStr.match(/^Abs\(\s*(Vct[A-D]|VctAns)\s*\)?$/);
      if (absMatch) {
        const val = norm(getVec(absMatch[1]));
        return {
          ok: true,
          kind: 'scalar',
          value: val,
          exactLatex: formatNumberToLatex(val, true, fmtOptions),
          decimalLatex: formatNumberToLatex(val, false, fmtOptions),
        };
      }

      const dotMatch = rawStr.match(/^(Vct[A-D]|VctAns)\s*DOT\s*(Vct[A-D]|VctAns)$/);
      if (dotMatch) {
        const val = dot(getVec(dotMatch[1]), getVec(dotMatch[2]));
        return {
          ok: true,
          kind: 'scalar',
          value: val,
          exactLatex: formatNumberToLatex(val, true, fmtOptions),
          decimalLatex: formatNumberToLatex(val, false, fmtOptions),
        };
      }

      const crossMatch = rawStr.match(/^(Vct[A-D]|VctAns)\s*CROSS\s*(Vct[A-D]|VctAns)$/);
      if (crossMatch) {
        const cVec = cross(getVec(crossMatch[1]), getVec(crossMatch[2]));
        const ltx = `\\begin{bmatrix} ${cVec.map((x) => formatNumberToLatex(x, true, fmtOptions)).join(' \\\\ ')} \\end{bmatrix}`;
        const decLtx = `\\begin{bmatrix} ${cVec.map((x) => formatNumberToLatex(x, false, fmtOptions)).join(' \\\\ ')} \\end{bmatrix}`;
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
        const ltx = `\\begin{bmatrix} ${resultVec.map((x) => formatNumberToLatex(x, true, fmtOptions)).join(' \\\\ ')} \\end{bmatrix}`;
        const decLtx = `\\begin{bmatrix} ${resultVec.map((x) => formatNumberToLatex(x, false, fmtOptions)).join(' \\\\ ')} \\end{bmatrix}`;
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
  const calculateUngroupedStats = (rows: any[], useFreq = true) => {
    const validRows: Array<{ x: number; freq: number }> = [];
    for (const r of rows) {
      if (r.x === '' || r.x === undefined || r.x === null) continue;
      const x = Number(r.x);
      const freq = !useFreq || r.freq === '' || r.freq === undefined ? 1 : Number(r.freq);
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
      if (r.L === '' || r.U === '' || r.L === undefined || r.U === undefined) continue;
      const L = Number(r.L);
      const U = Number(r.U);
      const freq = r.freq === '' || r.freq === undefined ? 0 : Number(r.freq);
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
    { id: 'optn', mainLatex: '\\mathsf{OPTN}', shiftText: '', alphaText: '' },
    { id: 'calc', mainLatex: '\\mathsf{CALC}', shiftText: 'SOLVE', alphaText: '=', alphaAction: { type: 'token', latex: '=' } },
    null,
    null,
    { id: 'int', mainLatex: '\\int_{\\square}^{\\square}', shiftText: 'd/dx', alphaText: ':', action: { type: 'struct', nodeType: 'int' }, shiftAction: { type: 'struct', nodeType: 'deriv' }, alphaAction: { type: 'token', latex: ':' } },
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
  onPress: (keyItem: any, e?: React.SyntheticEvent, source?: 'pointer' | 'touch' | 'click') => void;
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
          onPress(keyItem, e, 'touch');
        }}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') return;
          e.stopPropagation();
          onPress(keyItem, e, 'pointer');
        }}
        onClick={(e) => {
          e.stopPropagation();
          onPress(keyItem, e, 'click');
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
          onPress(keyItem, e, 'touch');
        }}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') return;
          e.stopPropagation();
          onPress(keyItem, e, 'pointer');
        }}
        onClick={(e) => {
          e.stopPropagation();
          onPress(keyItem, e, 'click');
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
  language: 'vi' | 'en';
  inputOutput: 'MathI/MathO' | 'MathI/DecimalO' | 'LineI/MathO' | 'LineI/DecimalO';
  numberFormat: { type: 'Norm1' | 'Norm2' | 'Fix' | 'Sci'; digits: number };
  fractionResult: 'ab/c' | 'd/c';
  statFreqOn: boolean;
  setupReturnMode: string;
  setupPage: number;
  setupMenuIndex: number;
  setupSubType: '' | 'IO' | 'ANGLE' | 'FORMAT' | 'FIX_DIGITS' | 'SCI_DIGITS' | 'NORM_TYPE' | 'FRAC' | 'STAT_FREQ' | 'LANG';
  setupSubIndex: number;
  menuCursorIndex: number;
  vctOptnPage: number;
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
  vectors: Record<string, { dim: number; coords: string[]; defined?: boolean }>;
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

const createEmptyEqnMatrix = () => [
  ['', '', '', '', ''],
  ['', '', '', '', ''],
  ['', '', '', '', ''],
  ['', '', '', '', ''],
];

const createEmptyPolyCoeffs = () => ['', '', '', ''];

const createEmptyStat1VarRows = (): Stat1VarRow[] => [
  { x: '', freq: '' },
  { x: '', freq: '' },
  { x: '', freq: '' },
  { x: '', freq: '' },
];

const createEmptyStatGroupedRows = (): StatGroupedRow[] => [
  { L: '', U: '', freq: '' },
  { L: '', U: '', freq: '' },
  { L: '', U: '', freq: '' },
  { L: '', U: '', freq: '' },
];

const MENU_ITEMS = [
  { key: 'num1', code: '1', target: 'COMP', icon: '+-×÷', vi: '1: Tính toán', en: '1: Calculate' },
  { key: 'num5', code: '5', target: 'VCT_SELECT', icon: 'u⃗·v⃗', vi: '5: Vectơ', en: '5: Vector' },
  { key: 'num6', code: '6', target: 'STAT_SELECT', icon: 'x̄ Q₁', vi: '6: Thống kê', en: '6: Statistics' },
  { key: 'num8', code: '8', target: 'TABLE_F', icon: 'f(x)', vi: '8: Bảng giá trị', en: '8: Table' },
  { key: 'num9', code: '9', target: 'EQN_SELECT', icon: 'x=y', vi: '9: PT / Hệ PT', en: '9: Equation/Func' },
];

const getSetupMainItems = (lang: 'vi' | 'en') => [
  // Page 0
  [
    { id: 'IO', label: lang === 'vi' ? '1: Nhập/Xuất (Math/Line)' : '1: Input/Output' },
    { id: 'ANGLE', label: lang === 'vi' ? '2: Đơn vị góc (D/R/G)' : '2: Angle Unit' },
    { id: 'FORMAT', label: lang === 'vi' ? '3: Định dạng số (Fix/Sci)' : '3: Number Format' },
    { id: 'FRAC', label: lang === 'vi' ? '4: Kết quả phân số' : '4: Fraction Result' },
  ],
  // Page 1
  [
    { id: 'STAT_FREQ', label: lang === 'vi' ? '1: Thống kê (Tần số)' : '1: Statistics (Freq)' },
    { id: 'LANG', label: lang === 'vi' ? '2: Ngôn ngữ (VI/EN)' : '2: Language (EN/VI)' },
    { id: 'RESET_SETUP', label: lang === 'vi' ? '3: Khôi phục cài đặt' : '3: Reset Setup' },
  ],
];

const getSetupSubOptions = (subType: CasioState['setupSubType'], lang: 'vi' | 'en') => {
  switch (subType) {
    case 'IO':
      return [
        { code: '1', label: '1: MathI / MathO', value: 'MathI/MathO' },
        { code: '2', label: '2: MathI / DecimalO', value: 'MathI/DecimalO' },
        { code: '3', label: '3: LineI / MathO', value: 'LineI/MathO' },
        { code: '4', label: '4: LineI / DecimalO', value: 'LineI/DecimalO' },
      ];
    case 'ANGLE':
      return [
        { code: '1', label: lang === 'vi' ? '1: Độ (Degree)' : '1: Degree', value: 'D' },
        { code: '2', label: '2: Radian', value: 'R' },
        { code: '3', label: '3: Gradian', value: 'G' },
      ];
    case 'FORMAT':
      return [
        { code: '1', label: '1: Fix (0~9)', value: 'FIX' },
        { code: '2', label: '2: Sci (0~9)', value: 'SCI' },
        { code: '3', label: '3: Norm (1/2)', value: 'NORM' },
      ];
    case 'NORM_TYPE':
      return [
        { code: '1', label: '1: Norm 1', value: 'Norm1' },
        { code: '2', label: '2: Norm 2', value: 'Norm2' },
      ];
    case 'FRAC':
      return [
        { code: '1', label: lang === 'vi' ? '1: ab/c (Hỗn số)' : '1: ab/c', value: 'ab/c' },
        { code: '2', label: lang === 'vi' ? '2: d/c (Phân số)' : '2: d/c', value: 'd/c' },
      ];
    case 'STAT_FREQ':
      return [
        { code: '1', label: lang === 'vi' ? '1: Bật tần số (On)' : '1: On', value: 'ON' },
        { code: '2', label: lang === 'vi' ? '2: Tắt tần số (Off)' : '2: Off', value: 'OFF' },
      ];
    case 'LANG':
      return [
        { code: '1', label: '1: English', value: 'en' },
        { code: '2', label: '2: Tiếng Việt', value: 'vi' },
      ];
    default:
      return [];
  }
};

function CasioCellBox({
  value,
  active = false,
  size = 'lcd',
  onClick,
}: {
  value?: string;
  active?: boolean;
  size?: 'lcd' | 'big';
  onClick?: () => void;
}) {
  const isEmpty = value === undefined || value === null || value === '';
  const dimCls =
    size === 'big'
      ? 'min-w-[64px] h-[38px] px-2.5 text-lg sm:text-xl rounded-md'
      : 'min-w-[26px] h-[18px] px-1 text-[10.5px] rounded-[2px]';

  if (active) {
    return (
      <span
        onClick={onClick}
        className={`inline-flex items-center justify-center font-mono font-bold border border-[#141c14] bg-[#141c14] text-[#c8d3c5] shadow-inner ${dimCls} ${
          onClick ? 'cursor-pointer' : ''
        }`}
      >
        {isEmpty ? (
          <span
            className={`inline-block border border-[#c8d3c5]/85 ${
              size === 'big' ? 'w-5 h-5 rounded-[3px]' : 'w-2.5 h-2.5 rounded-[1px]'
            }`}
          />
        ) : (
          <span>{value}</span>
        )}
      </span>
    );
  }

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center justify-center font-mono font-bold border ${
        isEmpty
          ? 'border-[#141c14]/65 bg-white/20 text-transparent'
          : 'border-[#141c14]/35 bg-white/30 text-[#0e140e]'
      } ${dimCls} ${onClick ? 'cursor-pointer hover:border-[#141c14]' : ''}`}
    >
      {isEmpty ? (
        <span
          className={`inline-block border border-[#141c14]/45 ${
            size === 'big' ? 'w-5 h-5 rounded-[3px]' : 'w-2.5 h-2.5 rounded-[1px]'
          }`}
        />
      ) : (
        <span>{value}</span>
      )}
    </span>
  );
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
  const isVi = calcState.language !== 'en';
  const modeTitleMap: Record<string, string> = {
    COMP: isVi ? 'CHẾ ĐỘ TÍNH TOÁN CHUNG (COMP)' : 'CALCULATE MODE (COMP)',
    MENU: isVi ? 'DANH MỤC CHẾ ĐỘ MÁY TÍNH (MENU)' : 'MODE SELECTION MENU',
    SETUP_MAIN: isVi ? 'CÀI ĐẶT HỆ THỐNG MÁY TÍNH (SHIFT + MENU)' : 'SYSTEM SETUP (SHIFT + MENU)',
    SETUP_SUB: isVi ? 'THIẾT LẬP THÔNG SỐ HỆ THỐNG (SETUP)' : 'CONFIGURE SETUP OPTION',
    COMP_OPTN: isVi ? 'TÙY CHỌN TÍNH TOÁN (OPTN)' : 'CALCULATE OPTIONS (OPTN)',
    STAT_SELECT: isVi ? 'THỐNG KÊ (MENU 6: CHỌN LOẠI MẪU SỐ LIỆU)' : 'STATISTICS (MENU 6: SELECT TYPE)',
    STAT_OPTN: isVi ? 'TÙY CHỌN THỐNG KÊ (OPTN)' : 'STATISTICS OPTIONS (OPTN)',
    STAT_INPUT:
      calcState.statType === 'GROUPED'
        ? isVi
          ? 'THỐNG KÊ MẪU SỐ LIỆU GHÉP NHÓM [Lᵢ ; Uᵢ)'
          : 'GROUPED STATISTICS [Lᵢ ; Uᵢ)'
        : isVi
        ? 'THỐNG KÊ ĐƠN BIẾN (MẪU KHÔNG GHÉP NHÓM)'
        : '1-VARIABLE STATISTICS',
    STAT_RESULT:
      calcState.statType === 'GROUPED'
        ? isVi
          ? 'KẾT QUẢ ĐẶC TRƯNG & TỨ PHÂN VỊ MẪU GHÉP NHÓM'
          : 'GROUPED STATISTICS RESULTS'
        : isVi
        ? 'KẾT QUẢ CÁC SỐ ĐẶC TRƯNG THỐNG KÊ ĐƠN BIẾN'
        : '1-VARIABLE RESULTS',
    EQN_SELECT: isVi ? 'GIẢI PHƯƠNG TRÌNH & HỆ PHƯƠNG TRÌNH (MENU 9)' : 'EQUATION / FUNCTION (MENU 9)',
    EQN_SYS_SIZE: isVi ? 'CHỌN SỐ ẨN CỦA HỆ PHƯƠNG TRÌNH (2 ~ 4 ẨN)' : 'SIMUL EQUATION: NUMBER OF UNKNOWNS (2~4)',
    EQN_POLY_DEG: isVi ? 'CHỌN BẬC CỦA PHƯƠNG TRÌNH ĐA THỨC (BẬC 2 ~ 3)' : 'POLYNOMIAL DEGREE (2~3)',
    EQN_INPUT:
      calcState.eqnType === 'SYS'
        ? isVi
          ? `NHẬP HỆ PHƯƠNG TRÌNH BẬC NHẤT ${calcState.eqnSize} ẨN`
          : `${calcState.eqnSize}-UNKNOWN SIMUL EQUATION`
        : isVi
        ? `NHẬP PHƯƠNG TRÌNH BẬC ${calcState.eqnSize}`
        : `DEGREE ${calcState.eqnSize} POLYNOMIAL`,
    EQN_RESULT: isVi ? 'NGHIỆM CỦA PHƯƠNG TRÌNH / HỆ PHƯƠNG TRÌNH' : 'EQUATION SOLUTIONS',
    TABLE_F: isVi ? 'BẢNG GIÁ TRỊ HÀM SỐ: NHẬP HÀM f(x)' : 'TABLE: ENTER FUNCTION f(x)',
    TABLE_G: isVi ? 'BẢNG GIÁ TRỊ HÀM SỐ: NHẬP HÀM g(x)' : 'TABLE: ENTER FUNCTION g(x)',
    TABLE_PARAMS: isVi ? 'THIẾT LẬP MIỀN GIÁ TRỊ BẢNG (START, END, STEP)' : 'TABLE RANGE (START, END, STEP)',
    TABLE_VIEW: isVi ? 'BẢNG GIÁ TRỊ HÀM SỐ f(x), g(x)' : 'FUNCTION VALUE TABLE',
    VCT_SELECT: isVi ? 'CHẾ ĐỘ VECTƠ (MENU 5: CHỌN VECTƠ)' : 'VECTOR MODE (MENU 5: DEFINE VECTOR)',
    VCT_DIM: isVi ? `CHỌN SỐ CHIỀU CHO ${calcState.activeVctName}` : `SELECT DIMENSION FOR ${calcState.activeVctName}`,
    VCT_EDIT: isVi
      ? `NHẬP TỌA ĐỘ VECTƠ ${calcState.activeVctName} (${calcState.vectors[calcState.activeVctName]?.dim || 3}D)`
      : `ENTER ${calcState.activeVctName} (${calcState.vectors[calcState.activeVctName]?.dim || 3}D)`,
    VCT_OPTN: isVi ? 'DANH MỤC PHÉP TOÁN VECTƠ (OPTN)' : 'VECTOR OPTIONS (OPTN)',
    VCT_CALC: isVi ? 'TÍNH TOÁN BIỂU THỨC VECTƠ' : 'VECTOR CALCULATION',
    CALC_PROMPT: isVi ? 'TÍNH GIÁ TRỊ BIỂU THỨC TẠI ĐIỂM (CALC)' : 'EVALUATE EXPRESSION (CALC)',
    SOLVE_PROMPT: isVi ? 'DÒ NGHIỆM PHƯƠNG TRÌNH (SHIFT + CALC : SOLVE)' : 'SOLVE EQUATION FOR x (SOLVE)',
  };

  const setupMainPages = getSetupMainItems(calcState.language);
  const activeSetupPageItems = setupMainPages[calcState.setupPage] || setupMainPages[0];
  const setupSubOptions = getSetupSubOptions(calcState.setupSubType, calcState.language);

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
              {isVi ? 'MÀN HÌNH TRÌNH CHIẾU LỚP HỌC (PHÓNG ĐẠI)' : 'CLASSROOM PROJECTION DISPLAY'}
            </h2>
            <p className="text-[11px] text-white/70">
              {modeTitleMap[calcState.mode] || (isVi ? 'MÀN HÌNH HIỂN THỊ CHI TIẾT CHO HỌC SINH' : 'DETAILED DISPLAY')}
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
            S⇔D: {calcState.showingDecimal ? (isVi ? 'Số thập phân' : 'Decimal') : isVi ? 'Phân số chuẩn' : 'Exact'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-white/10 hover:bg-rose-500/40 border border-white/20 text-white/90 text-xs font-semibold transition cursor-pointer"
          >
            ✕ {isVi ? 'Thu nhỏ' : 'Minimize'}
          </button>
        </div>
      </div>

      {/* KHUNG LCD PHÓNG ĐẠI (MÀU MÀN HÌNH CASIO THẬT) */}
      <div
        className="w-full min-h-[240px] rounded-[18px] p-4 sm:p-5 flex flex-col justify-between shadow-[inset_0_4px_12px_rgba(0,0,0,0.45)] border-2 border-[#8c9c87] text-[#0e140e]"
        style={{
          background: 'linear-gradient(180deg, #cfdacb 0%, #c2cfc0 60%, #b6c4b3 100%)',
        }}
      >
        {/* Thanh trạng thái phóng đại */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#141c14]/20 pb-2 mb-3 text-xs sm:text-sm font-bold text-[#141c14]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`px-2 py-0.5 rounded ${calcState.shift ? 'bg-[#141c14] text-[#cfdacb]' : 'bg-[#141c14]/10 text-[#141c14]/40'}`}>
              S
            </span>
            <span className={`px-2 py-0.5 rounded ${calcState.alpha ? 'bg-[#141c14] text-[#cfdacb]' : 'bg-[#141c14]/10 text-[#141c14]/40'}`}>
              A
            </span>
            <span className="px-2 py-0.5 border border-[#141c14]/60 rounded">
              {calcState.inputOutput.startsWith('MathI') ? '√□ MathI' : 'LineI'}
            </span>
            <span className="px-2.5 py-0.5 bg-[#141c14] text-[#cfdacb] rounded">
              {calcState.angleUnit === 'D' ? 'Deg (D)' : calcState.angleUnit === 'R' ? 'Rad (R)' : 'Gra (G)'}
            </span>
            {calcState.numberFormat.type === 'Fix' && (
              <span className="px-2 py-0.5 bg-[#141c14] text-[#cfdacb] rounded">FIX({calcState.numberFormat.digits})</span>
            )}
            {calcState.numberFormat.type === 'Sci' && (
              <span className="px-2 py-0.5 bg-[#141c14] text-[#cfdacb] rounded">SCI({calcState.numberFormat.digits})</span>
            )}
            <span className="px-2 py-0.5 border border-[#141c14]/40 rounded uppercase">
              {calcState.language === 'vi' ? 'VI' : 'EN'}
            </span>
          </div>
          <span className="font-extrabold tracking-wider uppercase">{calcState.mode}</span>
        </div>

        {/* 1. CHẾ ĐỘ COMP / VCT_CALC */}
        {(calcState.mode === 'COMP' || calcState.mode === 'VCT_CALC') && (
          <div className="flex-1 flex flex-col justify-between py-2">
            <div className="overflow-x-auto py-2">
              <div className="text-xs uppercase font-bold text-[#141c14]/60 mb-1">
                {isVi ? 'Biểu thức đang nhập:' : 'Input Expression:'}
              </div>
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
              <span className="text-xs uppercase font-bold text-[#141c14]/65">
                {isVi ? 'Kết quả:' : 'Result:'}
              </span>
              {calcState.resultLatex ? (
                <KatexScreenRenderer
                  latex={`\\displaystyle ${calcState.resultLatex}`}
                  isReady={katexLoaded}
                  className="text-3xl sm:text-4xl text-[#0b110b] font-extrabold"
                />
              ) : (
                <span className="text-sm italic text-[#141c14]/50">
                  {isVi ? 'Bấm [=] để tính • [SHIFT]+[CALC] để SOLVE' : 'Press [=] to calculate'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 2. CHẾ ĐỘ MENU CHÍNH (LƯỚI ICON CASIO) */}
        {calcState.mode === 'MENU' && (
          <div className="flex-1 flex flex-col justify-between py-2 gap-3">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
              {MENU_ITEMS.map((item, idx) => {
                const active = calcState.menuCursorIndex === idx;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      if (item.target === 'TABLE_F') {
                        setCalcState((p) => ({
                          ...p,
                          mode: 'TABLE_F',
                          menuCursorIndex: 0,
                          cursor: { slotId: p.tableFSlot.id, index: p.tableFSlot.items.length },
                        }));
                      } else {
                        setCalcState((p) => ({ ...p, mode: item.target, menuCursorIndex: 0, resultLatex: '' }));
                      }
                    }}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                      active
                        ? 'bg-[#141c14] text-[#cfdacb] border-[#141c14] shadow-md scale-[1.03]'
                        : 'bg-[#141c14]/10 text-[#0e140e] border-[#141c14]/25 hover:bg-[#141c14]/20'
                    }`}
                  >
                    <span className="text-xs font-extrabold px-1.5 py-0.5 rounded border border-current opacity-80">
                      {item.code}
                    </span>
                    <span className="text-lg font-black font-mono">{item.icon}</span>
                    <span className="text-[11px] font-bold text-center leading-tight">
                      {isVi ? item.vi.replace(/^\d+:\s*/, '') : item.en.replace(/^\d+:\s*/, '')}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="p-2.5 rounded-lg bg-[#141c14] text-[#cfdacb] text-sm font-bold flex items-center justify-between">
              <span>{isVi ? MENU_ITEMS[calcState.menuCursorIndex]?.vi : MENU_ITEMS[calcState.menuCursorIndex]?.en}</span>
              <span className="text-xs opacity-80">{isVi ? 'Dùng ◀▶▲▼ + [=] hoặc phím số' : 'Use ◀▶▲▼ + [=] or number key'}</span>
            </div>
          </div>
        )}

        {/* 2B. CHẾ ĐỘ CÀI ĐẶT (SHIFT + MENU : SETUP) */}
        {calcState.mode === 'SETUP_MAIN' && (
          <div className="flex-1 flex flex-col justify-between py-1 gap-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase opacity-75">
              <span>{isVi ? 'Cài đặt hệ thống (SETUP)' : 'System Setup'}</span>
              <span>{isVi ? `Trang ${calcState.setupPage + 1}/2 (▲▼)` : `Page ${calcState.setupPage + 1}/2 (▲▼)`}</span>
            </div>
            <div className="space-y-2">
              {activeSetupPageItems.map((it, idx) => {
                const active = calcState.setupMenuIndex === idx;
                return (
                  <div
                    key={it.id}
                    className={`p-2.5 rounded-lg text-base font-bold flex items-center justify-between ${
                      active ? 'bg-[#141c14] text-[#cfdacb]' : 'bg-[#141c14]/10 text-[#0e140e]'
                    }`}
                  >
                    <span>{it.label}</span>
                    <span className="text-xs opacity-75">
                      {it.id === 'IO' && calcState.inputOutput}
                      {it.id === 'ANGLE' && (calcState.angleUnit === 'D' ? 'Degree' : calcState.angleUnit === 'R' ? 'Radian' : 'Gradian')}
                      {it.id === 'FORMAT' && `${calcState.numberFormat.type}${calcState.numberFormat.type === 'Fix' || calcState.numberFormat.type === 'Sci' ? `(${calcState.numberFormat.digits})` : ''}`}
                      {it.id === 'FRAC' && calcState.fractionResult}
                      {it.id === 'STAT_FREQ' && (calcState.statFreqOn ? 'On' : 'Off')}
                      {it.id === 'LANG' && (calcState.language === 'vi' ? 'Tiếng Việt' : 'English')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {calcState.mode === 'SETUP_SUB' && (
          <div className="flex-1 flex flex-col justify-center gap-2 py-2">
            {(calcState.setupSubType === 'FIX_DIGITS' || calcState.setupSubType === 'SCI_DIGITS') ? (
              <div className="p-4 rounded-xl bg-[#141c14]/10 border border-[#141c14]/30 text-center space-y-2">
                <div className="text-xl font-extrabold">
                  {calcState.setupSubType === 'FIX_DIGITS'
                    ? (isVi ? 'Chọn số chữ số thập phân Fix (0 ~ 9)?' : 'Fix: Select number of digits (0 ~ 9)')
                    : (isVi ? 'Chọn số chữ số có nghĩa Sci (0 ~ 9)?' : 'Sci: Select digits (0 ~ 9)')}
                </div>
                <div className="text-sm opacity-75">
                  {isVi ? 'Bấm phím số từ [0] đến [9] trên máy tính' : 'Press number key [0] ~ [9]'}
                </div>
              </div>
            ) : (
              setupSubOptions.map((opt, idx) => {
                const active = calcState.setupSubIndex === idx;
                return (
                  <div
                    key={opt.code}
                    className={`p-2.5 rounded-lg text-base font-bold ${
                      active ? 'bg-[#141c14] text-[#cfdacb]' : 'bg-[#141c14]/10 text-[#0e140e]'
                    }`}
                  >
                    {opt.label}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 2C. CÁC MENU CHỌN & OPTN */}
        {(calcState.mode === 'STAT_SELECT' ||
          calcState.mode === 'STAT_OPTN' ||
          calcState.mode === 'COMP_OPTN' ||
          calcState.mode === 'EQN_SELECT' ||
          calcState.mode === 'EQN_SYS_SIZE' ||
          calcState.mode === 'EQN_POLY_DEG' ||
          calcState.mode === 'VCT_SELECT' ||
          calcState.mode === 'VCT_DIM' ||
          calcState.mode === 'VCT_OPTN') && (
          <div className="flex-1 flex flex-col justify-center gap-2.5 py-2">
            {calcState.mode === 'COMP_OPTN' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-base font-bold">
                {[
                  isVi ? '1 : SOLVE (Tìm nghiệm phương trình)' : '1 : Equation SOLVE',
                  isVi ? '2 : d/dx (Đạo hàm tại x₀)' : '2 : Derivative d/dx',
                  isVi ? '3 : ∫dx (Tích phân xác định)' : '3 : Definite Integral',
                  isVi ? '4 : Abs |■| (Giá trị tuyệt đối)' : '4 : Absolute Value |■|',
                ].map((txt, idx) => (
                  <div key={idx} className={`p-2.5 rounded-lg ${calcState.menuCursorIndex === idx ? 'bg-[#141c14] text-[#cfdacb]' : 'bg-[#141c14]/10'}`}>
                    {txt}
                  </div>
                ))}
              </div>
            )}
            {calcState.mode === 'STAT_SELECT' && (
              <div className="space-y-3 text-lg font-bold">
                {[
                  isVi ? '1 : Thống kê 1 biến không ghép nhóm (xᵢ, nᵢ)' : '1 : 1-Variable (xᵢ, nᵢ)',
                  isVi ? '2 : Mẫu số liệu ghép nhóm [Lᵢ ; Uᵢ) — Tính Q₁, Q₂, Q₃, x̄, s' : '2 : Grouped Data [Lᵢ ; Uᵢ)',
                ].map((txt, idx) => (
                  <div key={idx} className={`p-3 rounded-lg ${calcState.menuCursorIndex === idx ? 'bg-[#141c14] text-[#cfdacb]' : 'bg-[#141c14]/10'}`}>
                    {txt}
                  </div>
                ))}
              </div>
            )}
            {calcState.mode === 'STAT_OPTN' && (
              <div className="space-y-2.5 text-base font-bold">
                {[
                  isVi ? '1 : Chọn lại loại thống kê (Select Type)' : '1 : Select Type',
                  isVi ? '2 : Nhập / Sửa bảng dữ liệu (Data)' : '2 : Data Editor',
                  isVi ? '3 : Tính các số đặc trưng (1-Var Calc)' : '3 : 1-Variable Calc',
                ].map((txt, idx) => (
                  <div key={idx} className={`p-2.5 rounded-lg ${calcState.menuCursorIndex === idx ? 'bg-[#141c14] text-[#cfdacb]' : 'bg-[#141c14]/10'}`}>
                    {txt}
                  </div>
                ))}
              </div>
            )}
            {calcState.mode === 'EQN_SELECT' && (
              <div className="space-y-3 text-lg font-bold">
                {[
                  isVi ? '1 : Giải Hệ phương trình bậc nhất (2, 3, 4 ẩn)' : '1 : Simul Equation (2~4 Unknowns)',
                  isVi ? '2 : Giải Phương trình đa thức (Bậc 2, Bậc 3)' : '2 : Polynomial (Degree 2~3)',
                ].map((txt, idx) => (
                  <div key={idx} className={`p-3 rounded-lg ${calcState.menuCursorIndex === idx ? 'bg-[#141c14] text-[#cfdacb]' : 'bg-[#141c14]/10'}`}>
                    {txt}
                  </div>
                ))}
              </div>
            )}
            {calcState.mode === 'EQN_SYS_SIZE' && (
              <div className="space-y-2 text-lg font-bold">
                <div className="opacity-80">{isVi ? 'Số ẩn của hệ phương trình? (2~4)' : 'Number of Unknowns? (2~4)'}</div>
                <div className="grid grid-cols-3 gap-2">
                  {[2, 3, 4].map((sz, idx) => (
                    <div key={sz} className={`p-3 rounded-lg text-center ${calcState.menuCursorIndex === idx ? 'bg-[#141c14] text-[#cfdacb]' : 'bg-[#141c14]/10'}`}>
                      {sz}: {sz} {isVi ? 'ẩn' : 'Unk'}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {calcState.mode === 'EQN_POLY_DEG' && (
              <div className="space-y-2 text-lg font-bold">
                <div className="opacity-80">{isVi ? 'Bậc của phương trình đa thức? (2~3)' : 'Polynomial Degree? (2~3)'}</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { d: 2, label: '2 : ax² + bx + c = 0' },
                    { d: 3, label: '3 : ax³ + bx² + cx + d = 0' },
                  ].map((item, idx) => (
                    <div key={item.d} className={`p-3 rounded-lg text-center ${calcState.menuCursorIndex === idx ? 'bg-[#141c14] text-[#cfdacb]' : 'bg-[#141c14]/10'}`}>
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {calcState.mode === 'VCT_SELECT' && (
              <div className="grid grid-cols-2 gap-2.5 text-base font-bold">
                {(['VctA', 'VctB', 'VctC', 'VctD'] as const).map((vName, idx) => {
                  const vObj = calcState.vectors[vName];
                  return (
                    <div
                      key={vName}
                      className={`p-2.5 rounded-lg flex items-center justify-between ${
                        calcState.menuCursorIndex === idx ? 'bg-[#141c14] text-[#cfdacb]' : 'bg-[#141c14]/10'
                      }`}
                    >
                      <span>{idx + 1}: {vName}</span>
                      <span className="text-xs opacity-75">{vObj?.defined ? `${vObj.dim}D` : 'None'}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {calcState.mode === 'VCT_DIM' && (
              <div className="space-y-2 text-lg font-bold">
                <div className="opacity-80">{calcState.activeVctName}: {isVi ? 'Chọn số chiều (2 hoặc 3)' : 'Dimension? Select 2~3'}</div>
                <div className="grid grid-cols-2 gap-2.5">
                  {['2 : 2D (x, y)', '3 : 3D (x, y, z)'].map((txt, idx) => (
                    <div key={txt} className={`p-3 rounded-lg text-center ${calcState.menuCursorIndex === idx ? 'bg-[#141c14] text-[#cfdacb]' : 'bg-[#141c14]/10'}`}>
                      {txt}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {calcState.mode === 'VCT_OPTN' && (
              <div className="grid grid-cols-2 gap-2 text-sm sm:text-base font-bold">
                {(calcState.vctOptnPage === 0
                  ? [
                      isVi ? '1: Tạo Vectơ mới' : '1: Define Vector',
                      isVi ? '2: Sửa tọa độ Vectơ' : '2: Edit Vector',
                      '3: VctA',
                      '4: VctB',
                    ]
                  : [
                      '1: VctC',
                      '2: VctD',
                      isVi ? '3: Tích vô hướng (•)' : '3: Dot Product (•)',
                      isVi ? '4: Góc giữa 2 vectơ' : '4: Angle(',
                    ]
                ).map((txt, idx) => (
                  <div key={idx} className={`p-2.5 rounded-lg ${calcState.menuCursorIndex === idx ? 'bg-[#141c14] text-[#cfdacb]' : 'bg-[#141c14]/10'}`}>
                    {txt}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. CHẾ ĐỘ THỐNG KÊ: NHẬP LIỆU & KẾT QUẢ */}
        {calcState.mode === 'STAT_INPUT' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="text-xs sm:text-sm font-bold mb-2 flex items-center justify-between">
              <span>
                {isVi
                  ? `Dòng ${calcState.statRow + 1} — Nhập số rồi bấm [=] để sang ô tiếp theo`
                  : `Row ${calcState.statRow + 1} — Enter value & press [=]`}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#141c14] text-[#cfdacb]">
                {isVi ? 'Bấm [OPTN] để tính kết quả' : 'Press [OPTN] for Calc'}
              </span>
            </div>
            <div className="overflow-x-auto max-h-[210px] rounded-lg border border-[#141c14]/30">
              {calcState.statType === 'GROUPED' ? (
                <table className="w-full text-left border-collapse text-sm sm:text-base font-bold">
                  <thead>
                    <tr className="bg-[#141c14] text-[#cfdacb]">
                      <th className="py-1.5 px-3">{isVi ? 'Nhóm' : 'Class'}</th>
                      <th className="py-1.5 px-3">Lᵢ</th>
                      <th className="py-1.5 px-3">Uᵢ</th>
                      <th className="py-1.5 px-3">cᵢ</th>
                      <th className="py-1.5 px-3">nᵢ (Freq)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calcState.statGroupedRows.map((r, rIdx) => {
                      const hasBounds = r.L !== '' && r.U !== '';
                      const mid = hasBounds ? (Number(r.L) + Number(r.U)) / 2 : NaN;
                      return (
                        <tr
                          key={rIdx}
                          className={`border-b border-[#141c14]/20 ${rIdx === calcState.statRow ? 'bg-[#141c14]/10' : ''}`}
                        >
                          <td className="py-1.5 px-3">
                            [{r.L === '' ? '□' : r.L} ; {r.U === '' ? '□' : r.U})
                          </td>
                          <td className="py-1.5 px-3">
                            <CasioCellBox value={r.L} active={rIdx === calcState.statRow && calcState.statCol === 0} size="big" />
                          </td>
                          <td className="py-1.5 px-3">
                            <CasioCellBox value={r.U} active={rIdx === calcState.statRow && calcState.statCol === 1} size="big" />
                          </td>
                          <td className="py-1.5 px-3 opacity-75">{Number.isFinite(mid) ? mid : '—'}</td>
                          <td className="py-1.5 px-3">
                            <CasioCellBox value={r.freq} active={rIdx === calcState.statRow && calcState.statCol === 2} size="big" />
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
                      <th className="py-1.5 px-3">#</th>
                      <th className="py-1.5 px-3">xᵢ</th>
                      {calcState.statFreqOn && <th className="py-1.5 px-3">Freq (nᵢ)</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {calcState.stat1VarRows.map((r, rIdx) => (
                      <tr
                        key={rIdx}
                        className={`border-b border-[#141c14]/20 ${rIdx === calcState.statRow ? 'bg-[#141c14]/10' : ''}`}
                      >
                        <td className="py-1.5 px-3">#{rIdx + 1}</td>
                        <td className="py-1.5 px-3">
                          <CasioCellBox value={r.x} active={rIdx === calcState.statRow && calcState.statCol === 0} size="big" />
                        </td>
                        {calcState.statFreqOn && (
                          <td className="py-1.5 px-3">
                            <CasioCellBox value={r.freq} active={rIdx === calcState.statRow && calcState.statCol === 1} size="big" />
                          </td>
                        )}
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
          <div className="flex-1 flex flex-col justify-between py-2 gap-2">
            <div className="space-y-2.5 overflow-x-auto">
              {calcState.eqnType === 'SYS' ? (
                Array.from({ length: calcState.eqnSize }).map((_, r) => {
                  const vars = ['x', 'y', 'z', 't'].slice(0, calcState.eqnSize);
                  const row = calcState.eqnMatrix[r] || ['', '', '', '', ''];
                  return (
                    <div
                      key={r}
                      className={`p-2 rounded-lg flex flex-wrap items-center gap-1.5 text-lg font-bold ${
                        r === calcState.eqnRow ? 'bg-[#141c14]/15 border border-[#141c14]/35' : ''
                      }`}
                    >
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[#141c14]/15 mr-1">PT {r + 1}</span>
                      {vars.map((v, c) => (
                        <React.Fragment key={c}>
                          <CasioCellBox
                            value={row[c]}
                            active={r === calcState.eqnRow && c === calcState.eqnCol}
                            size="big"
                            onClick={() => setCalcState((p) => ({ ...p, eqnRow: r, eqnCol: c, eqnInputBuffer: '' }))}
                          />
                          <span className="font-serif italic pr-1">
                            {v}
                            {c < vars.length - 1 ? ' +' : ''}
                          </span>
                        </React.Fragment>
                      ))}
                      <span className="px-1">=</span>
                      <CasioCellBox
                        value={row[calcState.eqnSize]}
                        active={r === calcState.eqnRow && calcState.eqnCol === calcState.eqnSize}
                        size="big"
                        onClick={() => setCalcState((p) => ({ ...p, eqnRow: r, eqnCol: calcState.eqnSize, eqnInputBuffer: '' }))}
                      />
                    </div>
                  );
                })
              ) : (
                <div className="p-3 rounded-xl bg-[#141c14]/10 border border-[#141c14]/25 flex flex-wrap items-center justify-center gap-2 text-lg font-bold">
                  {Array.from({ length: calcState.eqnSize + 1 }).map((_, c) => {
                    const p = calcState.eqnSize - c;
                    return (
                      <React.Fragment key={c}>
                        <CasioCellBox
                          value={calcState.eqnPolyCoeffs[c]}
                          active={c === calcState.eqnCol}
                          size="big"
                          onClick={() => setCalcState((prev) => ({ ...prev, eqnCol: c, eqnInputBuffer: '' }))}
                        />
                        {p > 0 && (
                          <span className="font-serif italic">
                            x{p > 1 ? <sup>{p}</sup> : null} +
                          </span>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <span className="pl-1">= 0</span>
                </div>
              )}
            </div>
            <div className="border-t border-[#141c14]/20 pt-2 flex items-center justify-between text-sm font-bold">
              <span className="opacity-70">{isVi ? 'Bấm [=] để chuyển ô & giải' : 'Press [=] to advance & solve'}</span>
              <span>
                {isVi ? 'Đang nhập:' : 'Entry:'}{' '}
                <CasioCellBox
                  value={
                    calcState.eqnInputBuffer ||
                    (calcState.eqnType === 'SYS'
                      ? calcState.eqnMatrix[calcState.eqnRow]?.[calcState.eqnCol]
                      : calcState.eqnPolyCoeffs[calcState.eqnCol])
                  }
                  active
                  size="lcd"
                />
              </span>
            </div>
          </div>
        )}

        {calcState.mode === 'EQN_RESULT' && (
          <div className="flex-1 flex flex-col justify-center gap-2.5 py-2">
            <div className="text-xs uppercase font-bold text-[#141c14]/70">
              {isVi ? 'Tất cả nghiệm & Giá trị cực trị:' : 'Solutions:'}
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
          <div className="flex-1 flex flex-col justify-between py-2 gap-2">
            <div className="space-y-3">
              <div className={`p-2.5 rounded-lg border ${calcState.mode === 'TABLE_F' ? 'bg-[#141c14]/15 border-[#141c14]' : 'bg-[#141c14]/5 border-[#141c14]/20'}`}>
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
              <div className={`p-2.5 rounded-lg border ${calcState.mode === 'TABLE_G' ? 'bg-[#141c14]/15 border-[#141c14]' : 'bg-[#141c14]/5 border-[#141c14]/20'}`}>
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
              {(['start', 'end', 'step'] as const).map((pk, idx) => {
                const active = calcState.mode === 'TABLE_PARAMS' && calcState.tableParamIndex === idx;
                const val = active && calcState.tableParamBuffer !== '' ? calcState.tableParamBuffer : calcState.tableParams[pk];
                return (
                  <div key={pk} className="flex items-center gap-2">
                    <span className="capitalize">{pk}:</span>
                    <CasioCellBox value={val} active={active} size="big" />
                  </div>
                );
              })}
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
          <div className="flex-1 flex flex-col justify-center items-center py-4 gap-3">
            {calcState.mode === 'VCT_EDIT' ? (
              <div className="flex items-center gap-4">
                <span className="text-2xl sm:text-3xl font-extrabold font-sans">
                  {calcState.activeVctName} ({calcState.vectors[calcState.activeVctName]?.dim || 3}D) =
                </span>
                <div className="flex items-center">
                  <div className="w-3 self-stretch border-l-3 border-t-3 border-b-3 border-[#0e140e] rounded-l-md mr-2" />
                  <div className="flex flex-col gap-2 py-1">
                    {(calcState.vectors[calcState.activeVctName]?.coords || ['', '', ''])
                      .slice(0, calcState.vectors[calcState.activeVctName]?.dim || 3)
                      .map((val, idx) => (
                        <CasioCellBox
                          key={idx}
                          value={val}
                          active={idx === calcState.vctCoordIndex}
                          size="big"
                          onClick={() => setCalcState((p) => ({ ...p, vctCoordIndex: idx, vctInputBuffer: '' }))}
                        />
                      ))}
                  </div>
                  <div className="w-3 self-stretch border-r-3 border-t-3 border-b-3 border-[#0e140e] rounded-r-md ml-2" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="text-xl sm:text-2xl font-extrabold flex items-center gap-3">
                  <span>
                    {calcState.mode === 'SOLVE_PROMPT'
                      ? isVi
                        ? 'Nhập giá trị khởi tạo x₀ ='
                        : 'Solve for x (Init x₀) ='
                      : `${calcState.promptVars[calcState.promptVarIndex] || 'x'} =`}
                  </span>
                  <CasioCellBox value={calcState.promptInputBuffer} active size="big" />
                </div>
                <span className="text-xs font-semibold opacity-70">
                  {isVi ? 'Nhập số rồi bấm [=] để thực hiện' : 'Enter value then press [=]'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ghi chú hướng dẫn nhanh cho Học sinh ở chân Màn Hình Lớn */}
      <div className="mt-4 pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-xs text-white/80">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-semibold">
            {isVi ? 'Mẹo giảng dạy' : 'Teaching Tip'}
          </span>
          <span>
            {isVi
              ? 'Bấm [SHIFT] + [MENU] để cài đặt đơn vị góc, định dạng số, ngôn ngữ EN/VI.'
              : 'Press [SHIFT] + [MENU] to configure Angle Unit, Format, Language.'}
          </span>
        </div>
        <span className="font-bold text-amber-300">Được phát triển bởi TTK</span>
      </div>
    </div>
  );
}

export type CasioDisplayMode = 'standalone' | 'with_blackboard';

let latestPreservedCasioState: CasioState | null = null;

function createInitialCasioState(): CasioState {
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
    memoryVars: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, x: 0, y: 0, z: 0, M: 0 },
    shift: false,
    alpha: false,
    stoMode: false,
    angleUnit: 'D',
    language: 'vi',
    inputOutput: 'MathI/MathO',
    numberFormat: { type: 'Norm1', digits: 0 },
    fractionResult: 'd/c',
    statFreqOn: true,
    setupReturnMode: 'COMP',
    setupPage: 0,
    setupMenuIndex: 0,
    setupSubType: '',
    setupSubIndex: 0,
    menuCursorIndex: 0,
    vctOptnPage: 0,
    undoStack: [],
    promptVars: [],
    promptVarIndex: 0,
    promptInputBuffer: '',
    eqnType: 'SYS',
    eqnSize: 2,
    eqnMatrix: createEmptyEqnMatrix(),
    eqnPolyCoeffs: createEmptyPolyCoeffs(),
    eqnRow: 0,
    eqnCol: 0,
    eqnInputBuffer: '',
    eqnSolutions: [],
    eqnSolIndex: 0,
    tableFSlot: createSlot(),
    tableGSlot: createSlot(),
    tableParams: { start: '', end: '', step: '' },
    tableParamIndex: 0,
    tableParamBuffer: '',
    tableRows: [],
    tableHasG: false,
    tableScroll: 0,
    vectors: {
      VctA: { dim: 3, coords: ['', '', ''], defined: false },
      VctB: { dim: 3, coords: ['', '', ''], defined: false },
      VctC: { dim: 2, coords: ['', '', ''], defined: false },
      VctD: { dim: 2, coords: ['', '', ''], defined: false },
    },
    vctAns: { dim: 3, coords: [0, 0, 0] },
    activeVctName: 'VctA',
    vctCoordIndex: 0,
    vctInputBuffer: '',
    vctCalcSlot: createSlot(),
    statType: 'GROUPED',
    stat1VarRows: createEmptyStat1VarRows(),
    statGroupedRows: createEmptyStatGroupedRows(),
    statRow: 0,
    statCol: 0,
    statInputBuffer: '',
    statResults: [],
    statResultIndex: 0,
  };
}

interface CasioFx580VNXInnerProps {
  onClose?: () => void;
  displayMode?: CasioDisplayMode;
  onChangeDisplayMode?: (mode: CasioDisplayMode) => void;
  dockPosition?: 'left' | 'right';
  onToggleDockPosition?: () => void;
  onBigScreenChange?: (active: boolean) => void;
}

function CasioFx580VNXInner({
  onClose,
  displayMode = 'standalone',
  onChangeDisplayMode,
  dockPosition = 'right',
  onToggleDockPosition,
  onBigScreenChange,
}: CasioFx580VNXInnerProps) {
  const isDocked = displayMode === 'with_blackboard';
  const { katexReady: katexLoaded } = useExternalMathLibraries();
  const [showChalk, setShowChalk] = useState(false);
  const [showBigScreen, setShowBigScreen] = useState(!isDocked);
  const [zoomScale, setZoomScale] = useState(isDocked ? 0.92 : 1);
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const autoMobileFit = viewportWidth < 392 ? Math.max(0.82, (viewportWidth - 36) / 348) : 1;
  const effectiveScale = Number((zoomScale * autoMobileFit).toFixed(3));

  useEffect(() => {
    onBigScreenChange?.(showBigScreen);
  }, [showBigScreen, onBigScreenChange]);

  const [calcState, setCalcState] = useState<CasioState>(() => {
    const base = createInitialCasioState();
    if (latestPreservedCasioState) {
      return { ...base, ...latestPreservedCasioState };
    }
    return base;
  });

  /**
   * Điều hướng D-Pad
   */
  const moveCursor = useCallback((direction: string) => {
    setCalcState((prev) => {
      // 0A. MENU CHÍNH (Lưới Icon 5 chế độ)
      if (prev.mode === 'MENU') {
        const total = MENU_ITEMS.length;
        if (direction === 'RIGHT' || direction === 'DOWN') {
          return { ...prev, menuCursorIndex: (prev.menuCursorIndex + 1) % total };
        }
        if (direction === 'LEFT' || direction === 'UP') {
          return { ...prev, menuCursorIndex: (prev.menuCursorIndex - 1 + total) % total };
        }
        return prev;
      }

      // 0B. SETUP MAIN (SHIFT + MENU)
      if (prev.mode === 'SETUP_MAIN') {
        const pages = getSetupMainItems(prev.language);
        const curPageLen = pages[prev.setupPage].length;
        if (direction === 'DOWN') {
          if (prev.setupMenuIndex < curPageLen - 1) {
            return { ...prev, setupMenuIndex: prev.setupMenuIndex + 1 };
          }
          const nextPage = (prev.setupPage + 1) % pages.length;
          return { ...prev, setupPage: nextPage, setupMenuIndex: 0 };
        }
        if (direction === 'UP') {
          if (prev.setupMenuIndex > 0) {
            return { ...prev, setupMenuIndex: prev.setupMenuIndex - 1 };
          }
          const prevPage = (prev.setupPage - 1 + pages.length) % pages.length;
          return { ...prev, setupPage: prevPage, setupMenuIndex: pages[prevPage].length - 1 };
        }
        return prev;
      }

      // 0C. SETUP SUB
      if (prev.mode === 'SETUP_SUB') {
        const opts = getSetupSubOptions(prev.setupSubType, prev.language);
        if (opts.length > 0) {
          if (direction === 'DOWN' || direction === 'RIGHT') {
            return { ...prev, setupSubIndex: (prev.setupSubIndex + 1) % opts.length };
          }
          if (direction === 'UP' || direction === 'LEFT') {
            return { ...prev, setupSubIndex: (prev.setupSubIndex - 1 + opts.length) % opts.length };
          }
        }
        return prev;
      }

      // 0D. CÁC MENU CHỌN (D-Pad UP/DOWN/LEFT/RIGHT)
      const subMenuCounts: Record<string, number> = {
        COMP_OPTN: 4,
        STAT_SELECT: 2,
        STAT_OPTN: 3,
        EQN_SELECT: 2,
        EQN_SYS_SIZE: 3,
        EQN_POLY_DEG: 2,
        VCT_SELECT: 4,
        VCT_DIM: 2,
      };
      if (subMenuCounts[prev.mode]) {
        const count = subMenuCounts[prev.mode];
        if (direction === 'DOWN' || direction === 'RIGHT') {
          return { ...prev, menuCursorIndex: (prev.menuCursorIndex + 1) % count };
        }
        if (direction === 'UP' || direction === 'LEFT') {
          return { ...prev, menuCursorIndex: (prev.menuCursorIndex - 1 + count) % count };
        }
        return prev;
      }

      if (prev.mode === 'VCT_OPTN') {
        if (direction === 'DOWN') {
          if (prev.menuCursorIndex < 3) return { ...prev, menuCursorIndex: prev.menuCursorIndex + 1 };
          return { ...prev, vctOptnPage: prev.vctOptnPage === 0 ? 1 : 0, menuCursorIndex: 0 };
        }
        if (direction === 'UP') {
          if (prev.menuCursorIndex > 0) return { ...prev, menuCursorIndex: prev.menuCursorIndex - 1 };
          return { ...prev, vctOptnPage: prev.vctOptnPage === 0 ? 1 : 0, menuCursorIndex: 3 };
        }
        if (direction === 'RIGHT') {
          return { ...prev, vctOptnPage: prev.vctOptnPage === 0 ? 1 : 0, menuCursorIndex: 0 };
        }
        if (direction === 'LEFT') {
          return { ...prev, vctOptnPage: prev.vctOptnPage === 0 ? 1 : 0, menuCursorIndex: 0 };
        }
        return prev;
      }

      if (prev.mode === 'TABLE_PARAMS') {
        if (direction === 'DOWN' || direction === 'RIGHT') {
          return { ...prev, tableParamIndex: (prev.tableParamIndex + 1) % 3, tableParamBuffer: '' };
        }
        if (direction === 'UP' || direction === 'LEFT') {
          return { ...prev, tableParamIndex: (prev.tableParamIndex + 2) % 3, tableParamBuffer: '' };
        }
        return prev;
      }

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
        const colsCount = isGrouped ? 3 : prev.statFreqOn ? 2 : 1;
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
              const newRows: StatGroupedRow[] = [...prev.statGroupedRows, { L: '', U: '', freq: '' }];
              return { ...prev, statGroupedRows: newRows, statRow: r + 1, statCol: 0, statInputBuffer: '' };
            } else {
              const newRows: Stat1VarRow[] = [...prev.stat1VarRows, { x: '', freq: '' }];
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
      const fmtOptions = {
        numberFormat: prev.numberFormat,
        fractionResult: prev.fractionResult,
      };

      // Tắt/bật SHIFT & ALPHA hoạt động trên mọi màn hình
      if (keyId === 'shift') {
        return { ...prev, shift: !prev.shift, alpha: false };
      }
      if (keyId === 'alpha') {
        return { ...prev, alpha: !prev.alpha, shift: false };
      }

      // MENU & SHIFT+MENU (SETUP)
      if (keyId === 'menu') {
        if (prev.shift) {
          const returnMode =
            prev.mode === 'SETUP_MAIN' || prev.mode === 'SETUP_SUB' ? prev.setupReturnMode : prev.mode;
          return {
            ...prev,
            mode: 'SETUP_MAIN',
            setupReturnMode: returnMode || 'COMP',
            setupPage: 0,
            setupMenuIndex: 0,
            setupSubType: '',
            setupSubIndex: 0,
            shift: false,
            alpha: false,
          };
        }
        const currentMenuIdx = MENU_ITEMS.findIndex((it) =>
          prev.mode.startsWith(it.target.split('_')[0])
        );
        return {
          ...prev,
          mode: prev.mode === 'MENU' ? 'COMP' : 'MENU',
          menuCursorIndex: currentMenuIdx >= 0 ? currentMenuIdx : 0,
          shift: false,
          alpha: false,
        };
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

      // 0. SETUP (SHIFT + MENU)
      if (prev.mode === 'SETUP_MAIN') {
        if (keyId === 'ac') {
          return { ...prev, mode: prev.setupReturnMode || 'COMP', shift: false, alpha: false };
        }
        const pages = getSetupMainItems(prev.language);
        const curPageItems = pages[prev.setupPage] || pages[0];
        let chosenIdx = -1;
        if (keyId === 'num1') chosenIdx = 0;
        else if (keyId === 'num2') chosenIdx = 1;
        else if (keyId === 'num3') chosenIdx = 2;
        else if (keyId === 'num4') chosenIdx = 3;
        else if (keyId === 'eq') chosenIdx = prev.setupMenuIndex;

        const chosenItem = chosenIdx >= 0 ? curPageItems[chosenIdx] : null;
        if (!chosenItem) return prev;

        if (chosenItem.id === 'RESET_SETUP') {
          return {
            ...prev,
            mode: prev.setupReturnMode || 'COMP',
            angleUnit: 'D',
            inputOutput: 'MathI/MathO',
            numberFormat: { type: 'Norm1', digits: 0 },
            fractionResult: 'd/c',
            statFreqOn: true,
            language: 'vi',
            shift: false,
            alpha: false,
          };
        }

        const subType = chosenItem.id as CasioState['setupSubType'];
        let initSubIdx = 0;
        if (subType === 'IO') {
          initSubIdx = Math.max(
            0,
            ['MathI/MathO', 'MathI/DecimalO', 'LineI/MathO', 'LineI/DecimalO'].indexOf(prev.inputOutput)
          );
        } else if (subType === 'ANGLE') {
          initSubIdx = prev.angleUnit === 'D' ? 0 : prev.angleUnit === 'R' ? 1 : 2;
        } else if (subType === 'FORMAT') {
          initSubIdx = prev.numberFormat.type === 'Fix' ? 0 : prev.numberFormat.type === 'Sci' ? 1 : 2;
        } else if (subType === 'FRAC') {
          initSubIdx = prev.fractionResult === 'ab/c' ? 0 : 1;
        } else if (subType === 'STAT_FREQ') {
          initSubIdx = prev.statFreqOn ? 0 : 1;
        } else if (subType === 'LANG') {
          initSubIdx = prev.language === 'en' ? 0 : 1;
        }

        return {
          ...prev,
          mode: 'SETUP_SUB',
          setupSubType: subType,
          setupSubIndex: initSubIdx,
          shift: false,
          alpha: false,
        };
      }

      if (prev.mode === 'SETUP_SUB') {
        if (keyId === 'ac') {
          return { ...prev, mode: 'SETUP_MAIN', shift: false, alpha: false };
        }
        if (prev.setupSubType === 'FIX_DIGITS' || prev.setupSubType === 'SCI_DIGITS') {
          const dStr = digitMap[keyId];
          if (dStr !== undefined && /^[0-9]$/.test(dStr)) {
            return {
              ...prev,
              mode: prev.setupReturnMode || 'COMP',
              numberFormat: {
                type: prev.setupSubType === 'FIX_DIGITS' ? 'Fix' : 'Sci',
                digits: Number(dStr),
              },
              shift: false,
              alpha: false,
            };
          }
          return prev;
        }

        const opts = getSetupSubOptions(prev.setupSubType, prev.language);
        let chosenIdx = -1;
        if (keyId === 'num1') chosenIdx = 0;
        else if (keyId === 'num2') chosenIdx = 1;
        else if (keyId === 'num3') chosenIdx = 2;
        else if (keyId === 'num4') chosenIdx = 3;
        else if (keyId === 'eq') chosenIdx = prev.setupSubIndex;

        const chosenOpt = chosenIdx >= 0 ? opts[chosenIdx] : null;
        if (!chosenOpt) return prev;

        const retMode = prev.setupReturnMode || 'COMP';
        if (prev.setupSubType === 'IO') {
          return { ...prev, mode: retMode, inputOutput: chosenOpt.value as CasioState['inputOutput'] };
        }
        if (prev.setupSubType === 'ANGLE') {
          return { ...prev, mode: retMode, angleUnit: chosenOpt.value };
        }
        if (prev.setupSubType === 'FORMAT') {
          if (chosenOpt.value === 'FIX') {
            return { ...prev, setupSubType: 'FIX_DIGITS', setupSubIndex: 0 };
          }
          if (chosenOpt.value === 'SCI') {
            return { ...prev, setupSubType: 'SCI_DIGITS', setupSubIndex: 0 };
          }
          return {
            ...prev,
            setupSubType: 'NORM_TYPE',
            setupSubIndex: prev.numberFormat.type === 'Norm2' ? 1 : 0,
          };
        }
        if (prev.setupSubType === 'NORM_TYPE') {
          return {
            ...prev,
            mode: retMode,
            numberFormat: { type: chosenOpt.value as 'Norm1' | 'Norm2', digits: 0 },
          };
        }
        if (prev.setupSubType === 'FRAC') {
          return { ...prev, mode: retMode, fractionResult: chosenOpt.value as 'ab/c' | 'd/c' };
        }
        if (prev.setupSubType === 'STAT_FREQ') {
          const nextFreqOn = chosenOpt.value === 'ON';
          return {
            ...prev,
            mode: retMode,
            statFreqOn: nextFreqOn,
            statCol: nextFreqOn ? prev.statCol : 0,
          };
        }
        if (prev.setupSubType === 'LANG') {
          return { ...prev, mode: retMode, language: chosenOpt.value as 'vi' | 'en' };
        }
        return prev;
      }

      // 1. MENU CHÍNH
      if (prev.mode === 'MENU') {
        const selectMenuTarget = (target: string) => {
          if (target === 'COMP') {
            return { ...prev, mode: 'COMP', menuCursorIndex: 0, shift: false, alpha: false };
          }
          if (target === 'VCT_SELECT') {
            return { ...prev, mode: 'VCT_SELECT', menuCursorIndex: 0, resultLatex: '', shift: false, alpha: false };
          }
          if (target === 'STAT_SELECT') {
            return { ...prev, mode: 'STAT_SELECT', menuCursorIndex: 0, resultLatex: '', shift: false, alpha: false };
          }
          if (target === 'TABLE_F') {
            return {
              ...prev,
              mode: 'TABLE_F',
              menuCursorIndex: 0,
              cursor: { slotId: prev.tableFSlot.id, index: prev.tableFSlot.items.length },
              shift: false,
              alpha: false,
            };
          }
          if (target === 'EQN_SELECT') {
            return { ...prev, mode: 'EQN_SELECT', menuCursorIndex: 0, shift: false, alpha: false };
          }
          return prev;
        };

        if (keyId === 'eq') {
          const item = MENU_ITEMS[prev.menuCursorIndex] || MENU_ITEMS[0];
          return selectMenuTarget(item.target);
        }
        const matched = MENU_ITEMS.find((it) => it.key === keyId);
        if (matched) return selectMenuTarget(matched.target);
        if (keyId === 'ac') return { ...prev, mode: 'COMP', shift: false, alpha: false };
        return prev;
      }

      // 1B. COMP OPTN
      if (prev.mode === 'COMP_OPTN') {
        if (keyId === 'ac' || keyId === 'optn') {
          return { ...prev, mode: 'COMP', shift: false, alpha: false };
        }
        let chosen = -1;
        if (keyId === 'num1') chosen = 0;
        else if (keyId === 'num2') chosen = 1;
        else if (keyId === 'num3') chosen = 2;
        else if (keyId === 'num4') chosen = 3;
        else if (keyId === 'eq') chosen = prev.menuCursorIndex;

        if (chosen === 0) {
          return {
            ...prev,
            mode: 'SOLVE_PROMPT',
            promptVars: ['x'],
            promptVarIndex: 0,
            promptInputBuffer: '',
            shift: false,
            alpha: false,
          };
        }
        if (chosen >= 1 && chosen <= 3) {
          const nodeType = chosen === 1 ? 'deriv' : chosen === 2 ? 'int' : 'abs';
          const newRoot = cloneTree(prev.rootSlot);
          const ctx = findSlotWithContext(newRoot, prev.cursor.slotId);
          const targetSlot = ctx ? ctx.slot : newRoot;
          const idx = ctx ? prev.cursor.index : targetSlot.items.length;
          const structNode = createStructureNode(nodeType);
          targetSlot.items.splice(idx, 0, structNode);
          const firstSlotKey = structNode.slotOrder[0];
          return {
            ...prev,
            mode: 'COMP',
            rootSlot: newRoot,
            cursor: { slotId: structNode.slots[firstSlotKey].id, index: 0 },
            resultLatex: '',
            shift: false,
            alpha: false,
          };
        }
        return prev;
      }

      // 2. MENU 6: STATISTICS
      if (prev.mode === 'STAT_SELECT') {
        if (keyId === 'num1' || (keyId === 'eq' && prev.menuCursorIndex === 0)) {
          return {
            ...prev,
            mode: 'STAT_INPUT',
            statType: '1VAR',
            stat1VarRows: createEmptyStat1VarRows(),
            statRow: 0,
            statCol: 0,
            statInputBuffer: '',
            shift: false,
            alpha: false,
          };
        }
        if (keyId === 'num2' || (keyId === 'eq' && prev.menuCursorIndex === 1)) {
          return {
            ...prev,
            mode: 'STAT_INPUT',
            statType: 'GROUPED',
            statGroupedRows: createEmptyStatGroupedRows(),
            statRow: 0,
            statCol: 0,
            statInputBuffer: '',
            shift: false,
            alpha: false,
          };
        }
        if (keyId === 'ac') return { ...prev, mode: 'MENU', menuCursorIndex: 2 };
        return prev;
      }

      if (prev.mode === 'STAT_OPTN') {
        if (keyId === 'ac' || keyId === 'optn') {
          return { ...prev, mode: 'STAT_INPUT', statInputBuffer: '' };
        }
        let chosen = -1;
        if (keyId === 'num1') chosen = 0;
        else if (keyId === 'num2') chosen = 1;
        else if (keyId === 'num3') chosen = 2;
        else if (keyId === 'eq') chosen = prev.menuCursorIndex;

        if (chosen === 0) {
          return {
            ...prev,
            mode: 'STAT_SELECT',
            menuCursorIndex: prev.statType === 'GROUPED' ? 1 : 0,
          };
        }
        if (chosen === 1) {
          return { ...prev, mode: 'STAT_INPUT', statInputBuffer: '' };
        }
        if (chosen === 2) {
          const isGrouped = prev.statType === 'GROUPED';
          const res: any = isGrouped
            ? CasioMathEngine.calculateGroupedStats(prev.statGroupedRows)
            : CasioMathEngine.calculateUngroupedStats(prev.stat1VarRows, prev.statFreqOn);
          const resultList = res.ok
            ? res.items
            : [{ label: '\\text{Thông báo}', exactLatex: res.messageLatex, decimalLatex: res.messageLatex }];
          return {
            ...prev,
            mode: 'STAT_RESULT',
            statResults: resultList,
            statResultIndex: 0,
            showingDecimal: prev.inputOutput.endsWith('DecimalO'),
            shift: false,
            alpha: false,
          };
        }
        return prev;
      }

      if (prev.mode === 'STAT_INPUT') {
        const isGrouped = prev.statType === 'GROUPED';
        const colKeys = isGrouped ? ['L', 'U', 'freq'] : prev.statFreqOn ? ['x', 'freq'] : ['x'];
        const safeCol = Math.min(prev.statCol, colKeys.length - 1);
        const activeColKey = colKeys[safeCol] || colKeys[0];

        if (keyId === 'ac') {
          return { ...prev, mode: 'STAT_SELECT', menuCursorIndex: isGrouped ? 1 : 0, statInputBuffer: '' };
        }

        if (keyId === 'optn') {
          return { ...prev, mode: 'STAT_OPTN', menuCursorIndex: 2, shift: false, alpha: false };
        }

        if (keyId === 'calc' || (prev.shift && keyId === 'num1')) {
          const res: any = isGrouped
            ? CasioMathEngine.calculateGroupedStats(prev.statGroupedRows)
            : CasioMathEngine.calculateUngroupedStats(prev.stat1VarRows, prev.statFreqOn);

          const resultList = res.ok
            ? res.items
            : [{ label: '\\text{Thông báo}', exactLatex: res.messageLatex, decimalLatex: res.messageLatex }];

          return {
            ...prev,
            mode: 'STAT_RESULT',
            statResults: resultList,
            statResultIndex: 0,
            showingDecimal: prev.inputOutput.endsWith('DecimalO'),
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
            const curVal = String((prev.statGroupedRows[prev.statRow] as any)?.[activeColKey] ?? '');
            const src = prev.statInputBuffer !== '' ? prev.statInputBuffer : curVal;
            const nextBuf = src.slice(0, -1);
            const nextRows = prev.statGroupedRows.map((r, idx) =>
              idx === prev.statRow ? { ...r, [activeColKey]: nextBuf } : r
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
            const curVal = String((prev.stat1VarRows[prev.statRow] as any)?.[activeColKey] ?? '');
            const src = prev.statInputBuffer !== '' ? prev.statInputBuffer : curVal;
            const nextBuf = src.slice(0, -1);
            const nextRows = prev.stat1VarRows.map((r, idx) =>
              idx === prev.statRow ? { ...r, [activeColKey]: nextBuf } : r
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
          if (safeCol < colsCount - 1) {
            return { ...prev, statCol: safeCol + 1, statInputBuffer: '' };
          }
          if (prev.statRow < rowsLength - 1) {
            return { ...prev, statRow: prev.statRow + 1, statCol: 0, statInputBuffer: '' };
          }
          if (rowsLength < 15) {
            if (isGrouped) {
              const nextRows: StatGroupedRow[] = [
                ...prev.statGroupedRows,
                { L: '', U: '', freq: '' },
              ];
              return { ...prev, statGroupedRows: nextRows, statRow: prev.statRow + 1, statCol: 0, statInputBuffer: '' };
            } else {
              const nextRows: Stat1VarRow[] = [...prev.stat1VarRows, { x: '', freq: '' }];
              return { ...prev, stat1VarRows: nextRows, statRow: prev.statRow + 1, statCol: 0, statInputBuffer: '' };
            }
          }
          return { ...prev, statInputBuffer: '' };
        }
        return prev;
      }

      if (prev.mode === 'STAT_RESULT') {
        if (keyId === 'ac') {
          return { ...prev, mode: 'STAT_INPUT', statInputBuffer: '' };
        }
        if (keyId === 'optn') {
          return { ...prev, mode: 'STAT_OPTN', menuCursorIndex: 1 };
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
        let selectedVct = vMap[keyId];
        if (keyId === 'eq') {
          selectedVct = ['VctA', 'VctB', 'VctC', 'VctD'][prev.menuCursorIndex] || 'VctA';
        }
        if (selectedVct) {
          const vDim = prev.vectors[selectedVct]?.dim === 2 ? 0 : 1;
          return { ...prev, mode: 'VCT_DIM', activeVctName: selectedVct, menuCursorIndex: vDim };
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
        let dim = 0;
        if (keyId === 'num2') dim = 2;
        else if (keyId === 'num3') dim = 3;
        else if (keyId === 'eq') dim = prev.menuCursorIndex === 0 ? 2 : 3;

        if (dim === 2 || dim === 3) {
          return {
            ...prev,
            mode: 'VCT_EDIT',
            vectors: {
              ...prev.vectors,
              [prev.activeVctName]: { dim, coords: ['', '', ''], defined: true },
            },
            vctCoordIndex: 0,
            vctInputBuffer: '',
            menuCursorIndex: 0,
          };
        }
        if (keyId === 'ac') return { ...prev, mode: 'VCT_SELECT', menuCursorIndex: 0 };
        return prev;
      }

      if (prev.mode === 'VCT_EDIT') {
        const curV = prev.vectors[prev.activeVctName];
        if (keyId === 'optn') {
          return {
            ...prev,
            mode: 'VCT_OPTN',
            vctOptnPage: 0,
            menuCursorIndex: 0,
            vctInputBuffer: '',
          };
        }
        if (keyId === 'ac') {
          return {
            ...prev,
            mode: 'VCT_CALC',
            cursor: { slotId: prev.vctCalcSlot.id, index: prev.vctCalcSlot.items.length },
            vctInputBuffer: '',
          };
        }
        if (keyId === 'del') {
          const curVal = curV.coords[prev.vctCoordIndex] ?? '';
          const src = prev.vctInputBuffer !== '' ? prev.vctInputBuffer : curVal;
          const nextBuf = src.slice(0, -1);
          const nextCoords = [...curV.coords];
          nextCoords[prev.vctCoordIndex] = nextBuf;
          return {
            ...prev,
            vctInputBuffer: nextBuf,
            vectors: { ...prev.vectors, [prev.activeVctName]: { ...curV, coords: nextCoords, defined: true } },
          };
        }
        if (digitMap[keyId] !== undefined) {
          const nextBuf = prev.vctInputBuffer + digitMap[keyId];
          const nextCoords = [...curV.coords];
          nextCoords[prev.vctCoordIndex] = nextBuf;
          return {
            ...prev,
            vctInputBuffer: nextBuf,
            vectors: { ...prev.vectors, [prev.activeVctName]: { ...curV, coords: nextCoords, defined: true } },
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
        if (keyId === 'ac' || keyId === 'optn') {
          return { ...prev, mode: 'VCT_CALC' };
        }
        if (keyId === 'ans') {
          const newCalcSlot = cloneTree(prev.vctCalcSlot);
          const ctx = findSlotWithContext(newCalcSlot, prev.cursor.slotId);
          const curSlot = ctx ? ctx.slot : newCalcSlot;
          curSlot.items.splice(prev.cursor.index, 0, createToken('\\text{VctAns}'));
          return {
            ...prev,
            mode: 'VCT_CALC',
            vctCalcSlot: newCalcSlot,
            cursor: { slotId: curSlot.id, index: prev.cursor.index + 1 },
          };
        }

        const insertVctToken = (latexTok: string) => {
          const newCalcSlot = cloneTree(prev.vctCalcSlot);
          const ctx = findSlotWithContext(newCalcSlot, prev.cursor.slotId);
          const curSlot = ctx ? ctx.slot : newCalcSlot;
          curSlot.items.splice(prev.cursor.index, 0, createToken(latexTok));
          return {
            ...prev,
            mode: 'VCT_CALC',
            vctCalcSlot: newCalcSlot,
            cursor: { slotId: curSlot.id, index: prev.cursor.index + 1 },
          };
        };

        // Phím tắt 1..4 theo trang hiện tại hoặc 5..8 trực tiếp
        let chosenSlotIdx = -1;
        if (keyId === 'num1') chosenSlotIdx = 0;
        else if (keyId === 'num2') chosenSlotIdx = 1;
        else if (keyId === 'num3') chosenSlotIdx = 2;
        else if (keyId === 'num4') chosenSlotIdx = 3;
        else if (keyId === 'num5') return insertVctToken('\\text{VctC}');
        else if (keyId === 'num6') return insertVctToken('\\text{VctD}');
        else if (keyId === 'num7') return insertVctToken('\\boldsymbol{\\cdot}');
        else if (keyId === 'num8') return insertVctToken('\\text{Angle}(');
        else if (keyId === 'eq') chosenSlotIdx = prev.menuCursorIndex;

        if (prev.vctOptnPage === 0) {
          if (chosenSlotIdx === 0) return { ...prev, mode: 'VCT_SELECT', menuCursorIndex: 0 };
          if (chosenSlotIdx === 1) return { ...prev, mode: 'VCT_EDIT', vctCoordIndex: 0, vctInputBuffer: '' };
          if (chosenSlotIdx === 2) return insertVctToken('\\text{VctA}');
          if (chosenSlotIdx === 3) return insertVctToken('\\text{VctB}');
        } else {
          if (chosenSlotIdx === 0) return insertVctToken('\\text{VctC}');
          if (chosenSlotIdx === 1) return insertVctToken('\\text{VctD}');
          if (chosenSlotIdx === 2) return insertVctToken('\\boldsymbol{\\cdot}');
          if (chosenSlotIdx === 3) return insertVctToken('\\text{Angle}(');
        }
        return prev;
      }

      // 4. MENU 9: EQN
      if (prev.mode === 'EQN_SELECT') {
        if (keyId === 'num1' || (keyId === 'eq' && prev.menuCursorIndex === 0)) {
          return { ...prev, mode: 'EQN_SYS_SIZE', eqnType: 'SYS', menuCursorIndex: 0 };
        }
        if (keyId === 'num2' || (keyId === 'eq' && prev.menuCursorIndex === 1)) {
          return { ...prev, mode: 'EQN_POLY_DEG', eqnType: 'POLY', menuCursorIndex: 0 };
        }
        if (keyId === 'ac') return { ...prev, mode: 'MENU', menuCursorIndex: 4 };
        return prev;
      }

      if (prev.mode === 'EQN_SYS_SIZE') {
        let sz = 0;
        if (['num2', 'num3', 'num4'].includes(keyId)) {
          sz = parseInt(digitMap[keyId], 10);
        } else if (keyId === 'eq') {
          sz = [2, 3, 4][prev.menuCursorIndex] || 2;
        }
        if (sz >= 2 && sz <= 4) {
          return {
            ...prev,
            mode: 'EQN_INPUT',
            eqnSize: sz,
            eqnMatrix: createEmptyEqnMatrix(),
            eqnRow: 0,
            eqnCol: 0,
            eqnInputBuffer: '',
          };
        }
        if (keyId === 'ac') return { ...prev, mode: 'EQN_SELECT', menuCursorIndex: 0 };
        return prev;
      }

      if (prev.mode === 'EQN_POLY_DEG') {
        let deg = 0;
        if (['num2', 'num3'].includes(keyId)) {
          deg = parseInt(digitMap[keyId], 10);
        } else if (keyId === 'eq') {
          deg = prev.menuCursorIndex === 1 ? 3 : 2;
        }
        if (deg === 2 || deg === 3) {
          return {
            ...prev,
            mode: 'EQN_INPUT',
            eqnSize: deg,
            eqnPolyCoeffs: createEmptyPolyCoeffs(),
            eqnRow: 0,
            eqnCol: 0,
            eqnInputBuffer: '',
          };
        }
        if (keyId === 'ac') return { ...prev, mode: 'EQN_SELECT', menuCursorIndex: 1 };
        return prev;
      }

      if (prev.mode === 'EQN_INPUT') {
        if (keyId === 'ac') {
          return {
            ...prev,
            mode: 'EQN_SELECT',
            menuCursorIndex: prev.eqnType === 'POLY' ? 1 : 0,
            eqnInputBuffer: '',
          };
        }
        if (keyId === 'del') {
          if (prev.eqnType === 'SYS') {
            const curVal = String(prev.eqnMatrix[prev.eqnRow]?.[prev.eqnCol] ?? '');
            const src = prev.eqnInputBuffer !== '' ? prev.eqnInputBuffer : curVal;
            const nextBuf = src.slice(0, -1);
            const mat = prev.eqnMatrix.map((r) => [...r]);
            mat[prev.eqnRow][prev.eqnCol] = nextBuf;
            return { ...prev, eqnInputBuffer: nextBuf, eqnMatrix: mat };
          } else {
            const curVal = String(prev.eqnPolyCoeffs[prev.eqnCol] ?? '');
            const src = prev.eqnInputBuffer !== '' ? prev.eqnInputBuffer : curVal;
            const nextBuf = src.slice(0, -1);
            const cfs = [...prev.eqnPolyCoeffs];
            cfs[prev.eqnCol] = nextBuf;
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
            return {
              ...prev,
              mode: 'EQN_RESULT',
              eqnSolutions: solList,
              eqnSolIndex: 0,
              showingDecimal: prev.inputOutput.endsWith('DecimalO'),
            };
          } else {
            const cols = prev.eqnSize + 1;
            if (prev.eqnCol < cols - 1) {
              return { ...prev, eqnCol: prev.eqnCol + 1, eqnInputBuffer: '' };
            }
            const res = CasioMathEngine.solvePolynomialEquation(prev.eqnSize, prev.eqnPolyCoeffs);
            const solList = res.ok
              ? res.solutions
              : [{ label: '\\text{KL}', exactLatex: res.messageLatex, decimalLatex: res.messageLatex }];
            return {
              ...prev,
              mode: 'EQN_RESULT',
              eqnSolutions: solList,
              eqnSolIndex: 0,
              showingDecimal: prev.inputOutput.endsWith('DecimalO'),
            };
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
            const solved = CasioMathEngine.solveSingleVariableEquation(
              prev.rootSlot,
              updatedMem.x,
              prev.angleUnit,
              updatedMem,
              fmtOptions
            );
            if (solved.ok) {
              const preferDec = prev.inputOutput.endsWith('DecimalO');
              const exactOut = `x = ${solved.exactLatex},\\; L-R = 0`;
              const decOut = `x = ${solved.decimalLatex},\\; L-R = 0`;
              return {
                ...prev,
                mode: 'COMP',
                memoryVars: { ...updatedMem, x: solved.root },
                exactResultLatex: exactOut,
                decimalResultLatex: decOut,
                resultLatex: preferDec ? decOut : exactOut,
                showingDecimal: preferDec,
                promptInputBuffer: '',
              };
            }
            return { ...prev, mode: 'COMP', resultLatex: solved.errorLatex, promptInputBuffer: '' };
          }

          if (prev.promptVarIndex < prev.promptVars.length - 1) {
            return { ...prev, memoryVars: updatedMem, promptVarIndex: prev.promptVarIndex + 1, promptInputBuffer: '' };
          }
          const evalRes = CasioMathEngine.evaluateCompTree(prev.rootSlot, prev.angleUnit, updatedMem, fmtOptions);
          if (evalRes.ok) {
            const preferDec = prev.inputOutput.endsWith('DecimalO');
            return {
              ...prev,
              mode: 'COMP',
              memoryVars: updatedMem,
              ansValue: evalRes.value,
              exactResultLatex: evalRes.exactLatex,
              decimalResultLatex: evalRes.decimalLatex,
              resultLatex: preferDec ? evalRes.decimalLatex : evalRes.exactLatex,
              showingDecimal: preferDec,
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
          const curVal = prev.tableParams[curKey] ?? '';
          const src = prev.tableParamBuffer !== '' ? prev.tableParamBuffer : curVal;
          const nextBuf = src.slice(0, -1);
          return {
            ...prev,
            tableParamBuffer: nextBuf,
            tableParams: { ...prev.tableParams, [curKey]: nextBuf },
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
          if (
            prev.tableParams.start === '' ||
            prev.tableParams.end === '' ||
            prev.tableParams.step === ''
          ) {
            return {
              ...prev,
              mode: 'TABLE_VIEW',
              tableRows: [{ xLatex: '-', fxLatex: '\\text{Range ERROR}', gxLatex: '' }],
              tableHasG: false,
              tableScroll: 0,
            };
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
          return {
            ...prev,
            mode: 'TABLE_VIEW',
            tableRows: [{ xLatex: '-', fxLatex: tb.errorLatex, gxLatex: '' }],
            tableHasG: false,
            tableScroll: 0,
          };
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
      if (prev.mode === 'VCT_CALC' && keyId === 'optn' && !prev.shift) {
        return { ...prev, mode: 'VCT_OPTN', vctOptnPage: 0, menuCursorIndex: 0, shift: false, alpha: false };
      }

      if (prev.mode === 'COMP' && keyId === 'optn' && !prev.shift && !prev.alpha) {
        return { ...prev, mode: 'COMP_OPTN', menuCursorIndex: 0, shift: false, alpha: false };
      }

      if (prev.mode === 'COMP' && keyId === 'calc') {
        if (prev.shift) {
          return {
            ...prev,
            mode: 'SOLVE_PROMPT',
            promptVars: ['x'],
            promptVarIndex: 0,
            promptInputBuffer: '',
            shift: false,
            alpha: false,
          };
        }
        if (!prev.alpha) {
          const vars = CasioMathEngine.extractVariablesFromTree(prev.rootSlot);
          const targetVars = vars.length > 0 ? vars : ['x'];
          return {
            ...prev,
            mode: 'CALC_PROMPT',
            promptVars: targetVars,
            promptVarIndex: 0,
            promptInputBuffer: '',
          };
        }
      }

      if (prev.stoMode && keyDef.alphaAction && keyDef.alphaAction.type === 'token') {
        const varName = keyDef.alphaAction.latex;
        if (['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z', 'M'].includes(varName)) {
          const evalRes = CasioMathEngine.evaluateCompTree(
            prev.rootSlot,
            prev.angleUnit,
            { ...prev.memoryVars, Ans: prev.ansValue },
            fmtOptions
          );
          const valToStore = evalRes.ok ? evalRes.value : prev.ansValue;
          const exactStr = `${varName} = ${CasioMathEngine.formatNumberToLatex(valToStore, true, fmtOptions)}`;
          const decStr = `${varName} = ${CasioMathEngine.formatNumberToLatex(valToStore, false, fmtOptions)}`;
          return {
            ...prev,
            stoMode: false,
            ansValue: valToStore,
            memoryVars: { ...prev.memoryVars, [varName]: valToStore },
            exactResultLatex: exactStr,
            decimalResultLatex: decStr,
            resultLatex: prev.inputOutput.endsWith('DecimalO') ? decStr : exactStr,
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
            shift: false,
            alpha: false,
          };
        }
        if (prev.mode === 'TABLE_G') {
          return {
            ...prev,
            mode: 'TABLE_PARAMS',
            tableParamIndex: 0,
            tableParamBuffer: '',
            shift: false,
            alpha: false,
          };
        }
        if (prev.mode === 'VCT_CALC') {
          const vRes = CasioMathEngine.evaluateVectorExpression(
            prev.vctCalcSlot,
            prev.vectors,
            prev.vctAns,
            prev.angleUnit,
            fmtOptions
          );
          if (vRes.ok) {
            const preferDec = prev.shift ? !prev.inputOutput.endsWith('DecimalO') : prev.inputOutput.endsWith('DecimalO');
            return {
              ...prev,
              vctAns: vRes.kind === 'vector' ? { dim: vRes.vec.length, coords: vRes.vec } : prev.vctAns,
              ansValue: vRes.kind === 'scalar' ? vRes.value : prev.ansValue,
              exactResultLatex: vRes.exactLatex,
              decimalResultLatex: vRes.decimalLatex,
              resultLatex: preferDec ? vRes.decimalLatex : vRes.exactLatex,
              showingDecimal: preferDec,
              shift: false,
              alpha: false,
            };
          }
          return { ...prev, resultLatex: vRes.errorLatex, shift: false, alpha: false };
        }

        const evalRes = CasioMathEngine.evaluateCompTree(
          prev.rootSlot,
          prev.angleUnit,
          { ...prev.memoryVars, Ans: prev.ansValue },
          fmtOptions
        );
        if (evalRes.ok) {
          const baseDec = prev.inputOutput.endsWith('DecimalO');
          const preferDec = prev.shift ? !baseDec : baseDec;
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

  // Bộ chống kích hoạt đúp (triệt tiêu hoàn toàn lỗi bấm 1 lần ra 88) nhưng vẫn phản hồi 0ms khi chạm
  const pointerDownStateRef = useRef<{ keyId: string; downTime: number; waitingForClick: boolean }>({
    keyId: '',
    downTime: 0,
    waitingForClick: false,
  });

  const handleFastPress = useCallback((
    keyItem: any,
    e?: React.SyntheticEvent,
    source: 'pointer' | 'touch' | 'click' = 'pointer'
  ) => {
    const now = performance.now();
    const keyId = keyItem?.id || 'unknown';

    if (source === 'click') {
      // Bỏ qua sự kiện click tổng hợp (sau khi thả tay/chuột) nếu đã xử lý lúc nhấn xuống (touchstart/pointerdown)
      const isKeyboardActivation = (e as any)?.nativeEvent?.detail === 0 && !pointerDownStateRef.current.waitingForClick;
      if (
        !isKeyboardActivation &&
        (pointerDownStateRef.current.waitingForClick ||
          (pointerDownStateRef.current.keyId === keyId && now - pointerDownStateRef.current.downTime < 1200))
      ) {
        pointerDownStateRef.current.waitingForClick = false;
        return;
      }
    } else {
      // Nếu touchstart và pointerdown cùng bắn trong <45ms cho cùng 1 phím, chỉ xử lý 1 lần
      if (pointerDownStateRef.current.keyId === keyId && now - pointerDownStateRef.current.downTime < 45) {
        return;
      }
      pointerDownStateRef.current = { keyId, downTime: now, waitingForClick: true };
    }

    if (e && e.type !== 'touchstart' && typeof e.preventDefault === 'function') {
      try {
        e.preventDefault();
      } catch (_) {}
    }

    handleKeyPress(keyItem);
  }, [handleKeyPress]);

  const handleFastCursor = useCallback((
    direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT',
    e?: React.SyntheticEvent,
    source: 'pointer' | 'touch' | 'click' = 'pointer'
  ) => {
    const now = performance.now();
    const keyId = `dpad_${direction}`;

    if (source === 'click') {
      const isKeyboardActivation = (e as any)?.nativeEvent?.detail === 0 && !pointerDownStateRef.current.waitingForClick;
      if (
        !isKeyboardActivation &&
        (pointerDownStateRef.current.waitingForClick ||
          (pointerDownStateRef.current.keyId === keyId && now - pointerDownStateRef.current.downTime < 1200))
      ) {
        pointerDownStateRef.current.waitingForClick = false;
        return;
      }
    } else {
      if (pointerDownStateRef.current.keyId === keyId && now - pointerDownStateRef.current.downTime < 45) {
        return;
      }
      pointerDownStateRef.current = { keyId, downTime: now, waitingForClick: true };
    }

    if (e && e.type !== 'touchstart' && typeof e.preventDefault === 'function') {
      try {
        e.preventDefault();
      } catch (_) {}
    }

    moveCursor(direction);
  }, [moveCursor]);

  useEffect(() => {
    latestPreservedCasioState = calcState;
  }, [calcState]);

  const currentLatexExpression = useMemo(
    () => serializeSlotToLatex(calcState.rootSlot, calcState.cursor, true),
    [calcState.rootSlot, calcState.cursor]
  );

  return (
    <div
      className={`relative w-full ${
        isDocked
          ? 'h-full rounded-2xl border border-emerald-500/35 py-2 px-2 sm:py-2.5 sm:px-3.5 shadow-xl'
          : `${showBigScreen ? 'max-w-[1180px]' : 'max-w-[450px]'} max-h-[92dvh] sm:max-h-[95vh] rounded-2xl sm:rounded-3xl border border-white/20 py-3 px-2.5 sm:py-4 sm:px-6 shadow-2xl`
      } flex flex-col items-center justify-start overflow-y-auto overflow-x-hidden custom-scrollbar transition-all duration-300`}
      style={{
        backgroundColor: '#193829',
        backgroundImage: `
          radial-gradient(circle at 50% 35%, rgba(45, 92, 68, 0.55) 0%, rgba(19, 44, 32, 0.95) 75%, #0e2218 100%),
          repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 2px, transparent 2px, transparent 8px)
        `,
      }}
    >
      {showChalk && <ChalkboardDoodles />}

      {/* Thanh tiêu đề & Tùy chọn Hiển thị Độc lập / Song song Bảng Xanh + Màn Hình Lớn + Phóng to */}
      <div
        className={`relative z-10 ${
          isDocked
            ? 'mb-2 px-2.5 py-1.5 rounded-2xl w-full'
            : 'mb-3 sm:mb-4 px-2.5 py-2 sm:px-4 sm:py-2 rounded-2xl sm:rounded-full w-full sm:w-auto pr-10 sm:pr-4'
        } flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 bg-[#0d1c14] border border-white/20 text-white/90 text-xs shadow-lg`}
      >
        <span className="font-medium tracking-wide flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
          Casio fx-580VN X
        </span>
        {!isDocked && (
          <>
            <span className="text-white/30 hidden sm:inline">•</span>
            <span className="font-bold text-amber-300 tracking-wide hidden sm:inline">
              Được phát triển bởi TTK
            </span>
          </>
        )}

        {onChangeDisplayMode && (
          <>
            <span className="text-white/30 hidden sm:inline">|</span>
            <div className="inline-flex items-center p-0.5 rounded-full bg-white/10 border border-white/15 gap-0.5">
              <button
                type="button"
                onClick={() => onChangeDisplayMode('standalone')}
                className={`px-2.5 py-1 min-h-[30px] rounded-full text-[11px] font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                  !isDocked
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : 'text-slate-200 hover:bg-white/15'
                }`}
                title="Hiển thị cửa sổ máy tính độc lập"
              >
                <Monitor className="w-3 h-3" />
                <span>Độc lập</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeDisplayMode('with_blackboard')}
                className={`px-2.5 py-1 min-h-[30px] rounded-full text-[11px] font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                  isDocked
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-emerald-200 hover:bg-white/15'
                }`}
                title="Chèn máy tính song song cùng Bảng Xanh, Tài Liệu, Tạo Đề, Trò Chơi..."
              >
                <Columns2 className="w-3 h-3" />
                <span>Chèn Song Song</span>
              </button>
            </div>
          </>
        )}

        {isDocked && onToggleDockPosition && (
          <button
            type="button"
            onClick={onToggleDockPosition}
            className="px-2.5 py-1 min-h-[30px] rounded-full bg-white/10 hover:bg-white/20 text-amber-200 text-[11px] font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap"
            title="Đổi vị trí máy tính sang Trái hoặc Phải màn hình"
          >
            <ArrowLeftRight className="w-3 h-3" />
            <span>{dockPosition === 'right' ? 'Sang Trái' : 'Sang Phải'}</span>
          </button>
        )}

        <span className="text-white/30 hidden sm:inline">|</span>
        <button
          type="button"
          onClick={() => setShowBigScreen((v) => !v)}
          className={`px-2.5 py-1 min-h-[30px] rounded-full font-bold text-[11px] transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
            showBigScreen
              ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
              : 'bg-white/15 text-emerald-200 hover:bg-white/25'
          }`}
        >
          <span>🖥️</span>
          <span className="sm:hidden">{showBigScreen ? 'Màn hình lớn: Bật' : 'Màn hình lớn'}</span>
          <span className="hidden sm:inline">
            {isDocked
              ? showBigScreen
                ? 'Màn hình lớn: Bật'
                : 'Màn hình lớn'
              : showBigScreen
              ? 'Đang bật Màn hình lớn (Cho học sinh)'
              : 'Bật Màn hình lớn (Cho học sinh)'}
          </span>
        </button>

        <span className="text-white/30 hidden sm:inline">|</span>
        <div className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-full border border-white/15">
          <span className="text-[10.5px] text-emerald-300 font-semibold mr-0.5 hidden sm:inline">Thu phóng:</span>
          <button
            type="button"
            onClick={() => setZoomScale((z) => Math.max(0.75, Number((z - 0.1).toFixed(2))))}
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
          {zoomScale !== (isDocked ? 0.92 : 1) && (
            <button
              type="button"
              onClick={() => setZoomScale(isDocked ? 0.92 : 1)}
              className="text-[9.5px] text-amber-300 hover:underline ml-1 cursor-pointer"
              title="Đặt lại tỷ lệ chuẩn"
            >
              Chuẩn
            </button>
          )}
        </div>

        {!isDocked && (
          <>
            <span className="text-white/30 hidden sm:inline">|</span>
            <button
              type="button"
              onClick={() => setShowChalk(!showChalk)}
              className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2 transition cursor-pointer"
            >
              {showChalk ? 'Ẩn phấn' : 'Hiện phấn'}
            </button>
          </>
        )}

        {onClose && (
          <>
            <span className="text-white/30 hidden sm:inline">|</span>
            <button
              type="button"
              onClick={onClose}
              className="text-rose-300 hover:text-rose-100 font-bold transition cursor-pointer flex items-center gap-0.5 whitespace-nowrap"
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
        className={`relative z-10 w-full flex ${
          isDocked
            ? 'flex-col items-center gap-4'
            : 'flex-col lg:flex-row items-center lg:items-start justify-center gap-4 sm:gap-6'
        } transition-all duration-300`}
      >
        {/* CỘT TRÁI: THÂN MÁY TÍNH CASIO + THANH CHẾ ĐỘ NHANH */}
        <div
          className="flex flex-col items-center shrink-0 transition-transform duration-200 origin-top"
          style={{
            transform: effectiveScale !== 1 ? `scale(${effectiveScale})` : undefined,
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
                    {/* Thanh trạng thái Casio chuẩn */}
                    <div className="relative z-10 flex items-center justify-between border-b border-[#141c14]/20 pb-[2px] text-[9px] text-[#141c14]">
                      <div className="flex items-center space-x-1">
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
                          {calcState.inputOutput.startsWith('MathI') ? '√□' : 'Line'}
                        </span>
                        <span className="px-[3.5px] py-[0.5px] bg-[#141c14] text-[#c8d3c5] rounded-[2px] font-bold">
                          {calcState.angleUnit}
                        </span>
                        {(calcState.numberFormat.type === 'Fix' || calcState.numberFormat.type === 'Sci') && (
                          <span className="px-[3px] py-[0.5px] bg-[#141c14] text-[#c8d3c5] rounded-[2px] font-bold uppercase">
                            {calcState.numberFormat.type}
                          </span>
                        )}
                        <span className="opacity-85 pl-0.5 font-semibold">
                          {calcState.mode.startsWith('SETUP')
                            ? 'SETUP'
                            : calcState.mode === 'MENU'
                            ? 'MENU'
                            : calcState.mode.startsWith('EQN')
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
                      <div className="flex items-center space-x-1 text-[8px] font-bold">
                        <span className="opacity-70">{calcState.language === 'vi' ? 'VI' : 'EN'}</span>
                        <span>▲▼</span>
                      </div>
                    </div>

                    {/* MENU CHÍNH (ICON CASIO) */}
                    {calcState.mode === 'MENU' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-between py-0.5 px-0.5">
                        <div className="grid grid-cols-5 gap-1">
                          {MENU_ITEMS.map((item, idx) => {
                            const active = calcState.menuCursorIndex === idx;
                            return (
                              <button
                                key={item.key}
                                type="button"
                                onClick={() => handleKeyPress({ id: item.key })}
                                className={`flex flex-col items-center justify-center rounded-[4px] py-1 px-0.5 border cursor-pointer transition ${
                                  active
                                    ? 'bg-[#141c14] text-[#c8d3c5] border-[#141c14]'
                                    : 'bg-[#141c14]/10 text-[#0e140e] border-[#141c14]/25'
                                }`}
                              >
                                <span className="text-[7.5px] font-extrabold leading-none opacity-80">{item.code}</span>
                                <span className="text-[9.5px] font-black font-mono leading-tight mt-0.5">{item.icon}</span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="bg-[#141c14] text-[#c8d3c5] rounded-[3px] px-1.5 py-[1px] text-[9.5px] font-bold flex items-center justify-between">
                          <span>
                            {calcState.language === 'vi'
                              ? MENU_ITEMS[calcState.menuCursorIndex]?.vi
                              : MENU_ITEMS[calcState.menuCursorIndex]?.en}
                          </span>
                          <span className="text-[8px] opacity-75">[=]</span>
                        </div>
                      </div>
                    )}

                    {/* SETUP MAIN (SHIFT + MENU) */}
                    {calcState.mode === 'SETUP_MAIN' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-between py-0.5 px-0.5 overflow-hidden">
                        <div className="flex flex-col space-y-[1.5px]">
                          {(getSetupMainItems(calcState.language)[calcState.setupPage] || []).map((it, idx) => {
                            const active = calcState.setupMenuIndex === idx;
                            return (
                              <div
                                key={it.id}
                                className={`px-1 py-[0.5px] rounded-[2px] text-[9px] font-bold flex items-center justify-between ${
                                  active ? 'bg-[#141c14] text-[#c8d3c5]' : 'text-[#0e140e]'
                                }`}
                              >
                                <span className="truncate">{it.label}</span>
                                <span className="text-[8px] opacity-75">
                                  {it.id === 'ANGLE' ? calcState.angleUnit : it.id === 'LANG' ? calcState.language.toUpperCase() : ''}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* SETUP SUB */}
                    {calcState.mode === 'SETUP_SUB' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-center py-0.5 px-0.5 overflow-hidden">
                        {calcState.setupSubType === 'FIX_DIGITS' || calcState.setupSubType === 'SCI_DIGITS' ? (
                          <div className="text-center text-[10px] font-bold text-[#0e140e]">
                            <div>
                              {calcState.setupSubType === 'FIX_DIGITS'
                                ? calcState.language === 'vi'
                                  ? 'Fix: Chọn số lẻ (0~9)?'
                                  : 'Fix: Select 0~9?'
                                : calcState.language === 'vi'
                                ? 'Sci: Chọn số chữ số (0~9)?'
                                : 'Sci: Select 0~9?'}
                            </div>
                            <div className="text-[8.5px] opacity-75 mt-1">[0] ~ [9]</div>
                          </div>
                        ) : (
                          <div className="flex flex-col space-y-[1.5px]">
                            {getSetupSubOptions(calcState.setupSubType, calcState.language).map((opt, idx) => {
                              const active = calcState.setupSubIndex === idx;
                              return (
                                <div
                                  key={opt.code}
                                  className={`px-1 py-[0.5px] rounded-[2px] text-[9px] font-bold truncate ${
                                    active ? 'bg-[#141c14] text-[#c8d3c5]' : 'text-[#0e140e]'
                                  }`}
                                >
                                  {opt.label}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* COMP OPTN */}
                    {calcState.mode === 'COMP_OPTN' && (
                      <div className="relative z-10 flex-1 grid grid-cols-2 gap-1 content-center py-0.5 px-0.5">
                        {[
                          '1:SOLVE',
                          '2:d/dx',
                          '3:∫dx',
                          '4:Abs |■|',
                        ].map((txt, idx) => (
                          <div
                            key={txt}
                            className={`px-1.5 py-1 rounded-[3px] text-[9.5px] font-bold ${
                              calcState.menuCursorIndex === idx ? 'bg-[#141c14] text-[#c8d3c5]' : 'bg-[#141c14]/10 text-[#0e140e]'
                            }`}
                          >
                            {txt}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* MENU 6: STATISTICS */}
                    {calcState.mode === 'STAT_SELECT' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-around py-0.5 px-0.5">
                        {[
                          calcState.language === 'vi' ? '1: 1-Biến (xᵢ, nᵢ)' : '1: 1-Variable',
                          calcState.language === 'vi' ? '2: Ghép nhóm [Lᵢ; Uᵢ)' : '2: Grouped [Lᵢ; Uᵢ)',
                        ].map((txt, idx) => (
                          <div
                            key={txt}
                            className={`px-1.5 py-1 rounded-[3px] text-[10px] font-bold ${
                              calcState.menuCursorIndex === idx ? 'bg-[#141c14] text-[#c8d3c5]' : 'text-[#0e140e]'
                            }`}
                          >
                            {txt}
                          </div>
                        ))}
                      </div>
                    )}

                    {calcState.mode === 'STAT_OPTN' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-around py-0.5 px-0.5">
                        {[
                          calcState.language === 'vi' ? '1: Chọn lại loại' : '1: Select Type',
                          calcState.language === 'vi' ? '2: Nhập dữ liệu' : '2: Data',
                          calcState.language === 'vi' ? '3: Tính toán (1-Var)' : '3: 1-Variable Calc',
                        ].map((txt, idx) => (
                          <div
                            key={txt}
                            className={`px-1.5 py-[1px] rounded-[2px] text-[9.5px] font-bold ${
                              calcState.menuCursorIndex === idx ? 'bg-[#141c14] text-[#c8d3c5]' : 'text-[#0e140e]'
                            }`}
                          >
                            {txt}
                          </div>
                        ))}
                      </div>
                    )}

                    {calcState.mode === 'STAT_INPUT' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-between py-0.5 px-0.5 overflow-hidden">
                        <div className="flex flex-col space-y-[2px] overflow-hidden">
                          {calcState.statType === 'GROUPED' ? (
                            calcState.statGroupedRows
                              .map((row, rIdx) => ({ row, rIdx }))
                              .slice(Math.max(0, calcState.statRow - 1), Math.max(2, calcState.statRow + 1))
                              .map(({ row, rIdx }) => (
                                <div key={rIdx} className="flex items-center justify-between gap-1 text-[9.5px] font-bold text-[#0e140e]">
                                  <div className="flex items-center gap-0.5">
                                    <span className="opacity-70">{rIdx + 1}:</span>
                                    <span>[</span>
                                    <CasioCellBox value={row.L} active={rIdx === calcState.statRow && calcState.statCol === 0} size="lcd" />
                                    <span>;</span>
                                    <CasioCellBox value={row.U} active={rIdx === calcState.statRow && calcState.statCol === 1} size="lcd" />
                                    <span>)</span>
                                  </div>
                                  <div className="flex items-center gap-0.5">
                                    <span>n=</span>
                                    <CasioCellBox value={row.freq} active={rIdx === calcState.statRow && calcState.statCol === 2} size="lcd" />
                                  </div>
                                </div>
                              ))
                          ) : (
                            calcState.stat1VarRows
                              .map((row, rIdx) => ({ row, rIdx }))
                              .slice(Math.max(0, calcState.statRow - 1), Math.max(2, calcState.statRow + 1))
                              .map(({ row, rIdx }) => (
                                <div key={rIdx} className="flex items-center justify-between gap-1 text-[9.5px] font-bold text-[#0e140e]">
                                  <div className="flex items-center gap-1">
                                    <span>x{rIdx + 1}=</span>
                                    <CasioCellBox value={row.x} active={rIdx === calcState.statRow && calcState.statCol === 0} size="lcd" />
                                  </div>
                                  {calcState.statFreqOn && (
                                    <div className="flex items-center gap-1">
                                      <span>n{rIdx + 1}=</span>
                                      <CasioCellBox value={row.freq} active={rIdx === calcState.statRow && calcState.statCol === 1} size="lcd" />
                                    </div>
                                  )}
                                </div>
                              ))
                          )}
                        </div>
                        <div className="flex items-center justify-between border-t border-[#141c14]/20 pt-[1px] px-0.5 text-[8.5px] font-bold text-[#0e140e]/80">
                          <span>{calcState.language === 'vi' ? '[OPTN]: Tính' : '[OPTN]: Calc'}</span>
                          <span>{calcState.language === 'vi' ? '[=]: Tiếp' : '[=]: Next'}</span>
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
                            latex="\scriptstyle \mathsf{\blacktriangle\blacktriangledown:S\Leftrightarrow D}"
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
                      <div className="relative z-10 flex-1 grid grid-cols-2 gap-1 content-around py-0.5 px-0.5">
                        {(['VctA', 'VctB', 'VctC', 'VctD'] as const).map((vName, idx) => {
                          const vObj = calcState.vectors[vName];
                          const active = calcState.menuCursorIndex === idx;
                          return (
                            <div
                              key={vName}
                              className={`px-1.5 py-0.5 rounded-[2px] text-[9.5px] font-bold flex items-center justify-between ${
                                active ? 'bg-[#141c14] text-[#c8d3c5]' : 'text-[#0e140e]'
                              }`}
                            >
                              <span>{idx + 1}:{vName}</span>
                              <span className="text-[8px] opacity-75">{vObj?.defined ? `${vObj.dim}D` : 'None'}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {calcState.mode === 'VCT_DIM' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-around py-0.5 px-1">
                        <div className="text-[10px] font-bold text-[#0e140e]">
                          {calcState.activeVctName} {calcState.language === 'vi' ? 'Số chiều?' : 'Dimension?'}
                        </div>
                        <div className="flex items-center space-x-2">
                          {['2: 2D (x,y)', '3: 3D (x,y,z)'].map((txt, idx) => (
                            <div
                              key={txt}
                              className={`px-2 py-0.5 rounded-[3px] text-[9.5px] font-bold ${
                                calcState.menuCursorIndex === idx ? 'bg-[#141c14] text-[#c8d3c5]' : 'bg-[#141c14]/10 text-[#0e140e]'
                              }`}
                            >
                              {txt}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {calcState.mode === 'VCT_EDIT' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-between py-0.5 px-0.5 overflow-hidden">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold text-[#0e140e] whitespace-nowrap">
                            {calcState.activeVctName}({calcState.vectors[calcState.activeVctName].dim}D)=
                          </span>
                          <div className="flex items-center space-x-1">
                            {calcState.vectors[calcState.activeVctName].coords
                              .slice(0, calcState.vectors[calcState.activeVctName].dim)
                              .map((val, idx) => (
                                <CasioCellBox
                                  key={idx}
                                  value={val}
                                  active={idx === calcState.vctCoordIndex}
                                  size="lcd"
                                />
                              ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-[#141c14]/20 pt-0.5 text-[9.5px] font-bold text-[#0b110b]">
                          <span className="text-[8.5px] opacity-75">[OPTN]</span>
                          <div className="flex items-center gap-1">
                            <span>Coord {calcState.vctCoordIndex + 1}:</span>
                            <CasioCellBox
                              value={
                                calcState.vctInputBuffer ||
                                calcState.vectors[calcState.activeVctName].coords[calcState.vctCoordIndex]
                              }
                              active
                              size="lcd"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {calcState.mode === 'VCT_OPTN' && (
                      <div className="relative z-10 flex-1 grid grid-cols-2 gap-1 content-center py-0.5 px-0.5">
                        {(calcState.vctOptnPage === 0
                          ? ['1:Def Vct', '2:Edit Vct', '3:VctA', '4:VctB']
                          : ['1:VctC', '2:VctD', '3:Dot(•)', '4:Angle(']
                        ).map((txt, idx) => (
                          <div
                            key={txt}
                            className={`px-1.5 py-0.5 rounded-[2px] text-[9.5px] font-bold ${
                              calcState.menuCursorIndex === idx ? 'bg-[#141c14] text-[#c8d3c5]' : 'text-[#0e140e]'
                            }`}
                          >
                            {txt}
                          </div>
                        ))}
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
                      <div className="relative z-10 flex-1 flex flex-col justify-around py-0.5 px-0.5">
                        {[
                          calcState.language === 'vi' ? '1: Hệ phương trình' : '1: Simul Equation',
                          calcState.language === 'vi' ? '2: PT Đa thức' : '2: Polynomial',
                        ].map((txt, idx) => (
                          <div
                            key={txt}
                            className={`px-1.5 py-1 rounded-[3px] text-[10px] font-bold ${
                              calcState.menuCursorIndex === idx ? 'bg-[#141c14] text-[#c8d3c5]' : 'text-[#0e140e]'
                            }`}
                          >
                            {txt}
                          </div>
                        ))}
                      </div>
                    )}

                    {calcState.mode === 'EQN_SYS_SIZE' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-around py-0.5 px-1">
                        <div className="text-[9.5px] font-bold text-[#0e140e]">
                          {calcState.language === 'vi' ? 'Số ẩn (2~4)?' : 'Unknowns (2~4)?'}
                        </div>
                        <div className="flex items-center gap-2">
                          {[2, 3, 4].map((sz, idx) => (
                            <div
                              key={sz}
                              className={`px-2 py-0.5 rounded-[3px] text-[10px] font-bold ${
                                calcState.menuCursorIndex === idx ? 'bg-[#141c14] text-[#c8d3c5]' : 'bg-[#141c14]/10 text-[#0e140e]'
                              }`}
                            >
                              {sz}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {calcState.mode === 'EQN_POLY_DEG' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-around py-0.5 px-1">
                        <div className="text-[9.5px] font-bold text-[#0e140e]">
                          {calcState.language === 'vi' ? 'Bậc đa thức (2~3)?' : 'Degree (2~3)?'}
                        </div>
                        <div className="flex items-center gap-2">
                          {[
                            { d: 2, label: '2: ax²+bx+c=0' },
                            { d: 3, label: '3: Bậc 3' },
                          ].map((it, idx) => (
                            <div
                              key={it.d}
                              className={`px-1.5 py-0.5 rounded-[3px] text-[9.5px] font-bold ${
                                calcState.menuCursorIndex === idx ? 'bg-[#141c14] text-[#c8d3c5]' : 'bg-[#141c14]/10 text-[#0e140e]'
                              }`}
                            >
                              {it.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {calcState.mode === 'EQN_INPUT' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-between py-0.5 px-0.5 overflow-hidden">
                        <div className="overflow-x-auto scrollbar-none flex items-center gap-1 text-[9.5px] font-bold text-[#0e140e]">
                          {calcState.eqnType === 'SYS' ? (
                            <>
                              <span className="opacity-70 whitespace-nowrap">P{calcState.eqnRow + 1}:</span>
                              {['x', 'y', 'z', 't'].slice(0, calcState.eqnSize).map((v, c) => (
                                <React.Fragment key={c}>
                                  <CasioCellBox
                                    value={calcState.eqnMatrix[calcState.eqnRow]?.[c]}
                                    active={c === calcState.eqnCol}
                                    size="lcd"
                                  />
                                  <span>{v}{c < calcState.eqnSize - 1 ? '+' : ''}</span>
                                </React.Fragment>
                              ))}
                              <span>=</span>
                              <CasioCellBox
                                value={calcState.eqnMatrix[calcState.eqnRow]?.[calcState.eqnSize]}
                                active={calcState.eqnCol === calcState.eqnSize}
                                size="lcd"
                              />
                            </>
                          ) : (
                            <>
                              {Array.from({ length: calcState.eqnSize + 1 }).map((_, c) => {
                                const p = calcState.eqnSize - c;
                                return (
                                  <React.Fragment key={c}>
                                    <CasioCellBox
                                      value={calcState.eqnPolyCoeffs[c]}
                                      active={c === calcState.eqnCol}
                                      size="lcd"
                                    />
                                    {p > 0 && <span>x{p > 1 ? <sup>{p}</sup> : ''}+</span>}
                                  </React.Fragment>
                                );
                              })}
                              <span>=0</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center justify-end gap-1 border-t border-[#141c14]/20 pt-0.5 text-[9.5px] font-bold text-[#0b110b]">
                          <span>{calcState.language === 'vi' ? 'Nhập:' : 'Input:'}</span>
                          <CasioCellBox
                            value={
                              calcState.eqnInputBuffer ||
                              (calcState.eqnType === 'SYS'
                                ? calcState.eqnMatrix[calcState.eqnRow]?.[calcState.eqnCol]
                                : calcState.eqnPolyCoeffs[calcState.eqnCol])
                            }
                            active
                            size="lcd"
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
                        <div className="flex items-center justify-between text-[11px] font-bold text-[#0e140e]">
                          <span>
                            {calcState.mode === 'SOLVE_PROMPT'
                              ? calcState.language === 'vi'
                                ? 'Solve x₀ ='
                                : 'Solve for x ='
                              : `${calcState.promptVars[calcState.promptVarIndex] || 'x'} =`}
                          </span>
                        </div>
                        <div className="flex items-center justify-end">
                          <CasioCellBox value={calcState.promptInputBuffer} active size="lcd" />
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
                        <div className="text-right text-[9px] font-bold text-[#0e140e]/70">
                          {calcState.language === 'vi' ? 'Bấm [=] để tiếp tục' : 'Press [=] to continue'}
                        </div>
                      </div>
                    )}

                    {calcState.mode === 'TABLE_PARAMS' && (
                      <div className="relative z-10 flex-1 flex flex-col justify-between py-0.5 px-1">
                        {(['start', 'end', 'step'] as const).map((pk, idx) => {
                          const label = pk === 'start' ? 'Start' : pk === 'end' ? 'End' : 'Step';
                          const active = calcState.tableParamIndex === idx;
                          const val = active && calcState.tableParamBuffer !== '' ? calcState.tableParamBuffer : calcState.tableParams[pk];
                          return (
                            <div key={pk} className="flex items-center justify-between text-[9.5px] font-bold text-[#0e140e]">
                              <span>{label} :</span>
                              <CasioCellBox value={val} active={active} size="lcd" />
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
                    onTouchStart={(e) => { e.stopPropagation(); handleFastPress({ id: 'shift' }, e, 'touch'); }}
                    onPointerDown={(e) => { if (e.pointerType === 'touch') return; handleFastPress({ id: 'shift' }, e, 'pointer'); }}
                    onClick={(e) => handleFastPress({ id: 'shift' }, e, 'click')}
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
                    onTouchStart={(e) => { e.stopPropagation(); handleFastPress({ id: 'alpha' }, e, 'touch'); }}
                    onPointerDown={(e) => { if (e.pointerType === 'touch') return; handleFastPress({ id: 'alpha' }, e, 'pointer'); }}
                    onClick={(e) => handleFastPress({ id: 'alpha' }, e, 'click')}
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
                        onTouchStart={(e) => { e.stopPropagation(); handleFastCursor('UP', e, 'touch'); }}
                        onPointerDown={(e) => { if (e.pointerType === 'touch') return; handleFastCursor('UP', e, 'pointer'); }}
                        onClick={(e) => handleFastCursor('UP', e, 'click')}
                        style={{ touchAction: 'none' }}
                        className="absolute top-0.5 inset-x-4 h-4 flex items-center justify-center text-zinc-800 hover:text-black active:scale-90 cursor-pointer select-none"
                      >
                        <span className="text-[7.5px] pointer-events-none">▲</span>
                      </button>
                      <button
                        type="button"
                        onTouchStart={(e) => { e.stopPropagation(); handleFastCursor('DOWN', e, 'touch'); }}
                        onPointerDown={(e) => { if (e.pointerType === 'touch') return; handleFastCursor('DOWN', e, 'pointer'); }}
                        onClick={(e) => handleFastCursor('DOWN', e, 'click')}
                        style={{ touchAction: 'none' }}
                        className="absolute bottom-0.5 inset-x-4 h-4 flex items-center justify-center text-zinc-800 hover:text-black active:scale-90 cursor-pointer select-none"
                      >
                        <span className="text-[7.5px] pointer-events-none">▼</span>
                      </button>
                      <button
                        type="button"
                        onTouchStart={(e) => { e.stopPropagation(); handleFastCursor('LEFT', e, 'touch'); }}
                        onPointerDown={(e) => { if (e.pointerType === 'touch') return; handleFastCursor('LEFT', e, 'pointer'); }}
                        onClick={(e) => handleFastCursor('LEFT', e, 'click')}
                        style={{ touchAction: 'none' }}
                        className="absolute left-1 inset-y-2.5 w-4 flex items-center justify-center text-zinc-800 hover:text-black active:scale-90 cursor-pointer select-none"
                      >
                        <span className="text-[7.5px] pointer-events-none">◀</span>
                      </button>
                      <button
                        type="button"
                        onTouchStart={(e) => { e.stopPropagation(); handleFastCursor('RIGHT', e, 'touch'); }}
                        onPointerDown={(e) => { if (e.pointerType === 'touch') return; handleFastCursor('RIGHT', e, 'pointer'); }}
                        onClick={(e) => handleFastCursor('RIGHT', e, 'click')}
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
                    onTouchStart={(e) => { e.stopPropagation(); handleFastPress({ id: 'menu' }, e, 'touch'); }}
                    onPointerDown={(e) => { if (e.pointerType === 'touch') return; handleFastPress({ id: 'menu' }, e, 'pointer'); }}
                    onClick={(e) => handleFastPress({ id: 'menu' }, e, 'click')}
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
                    onTouchStart={(e) => { e.stopPropagation(); handleFastPress({ id: 'on' }, e, 'touch'); }}
                    onPointerDown={(e) => { if (e.pointerType === 'touch') return; handleFastPress({ id: 'on' }, e, 'pointer'); }}
                    onClick={(e) => handleFastPress({ id: 'on' }, e, 'click')}
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
          <span className="text-emerald-300 font-semibold">
            {calcState.language === 'vi' ? 'Chế độ nhanh:' : 'Quick Mode:'}
          </span>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onTouchStart={(e) => { e.stopPropagation(); handleFastPress({ id: 'menu' }, e, 'touch'); }}
              onPointerDown={(e) => { if (e.pointerType === 'touch') return; handleFastPress({ id: 'menu' }, e, 'pointer'); }}
              onClick={(e) => handleFastPress({ id: 'menu' }, e, 'click')}
              style={{ touchAction: 'manipulation' }}
              className={`px-2 py-0.5 rounded active:scale-95 transition cursor-pointer select-none ${
                calcState.mode === 'MENU' ? 'bg-emerald-500/40 border border-emerald-300/50 text-white font-semibold' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              [MENU]
            </button>
            <button
              type="button"
              onClick={() =>
                setCalcState((p) => ({
                  ...p,
                  mode: 'SETUP_MAIN',
                  setupReturnMode: p.mode === 'SETUP_MAIN' || p.mode === 'SETUP_SUB' ? p.setupReturnMode : p.mode,
                  setupPage: 0,
                  setupMenuIndex: 0,
                  shift: false,
                  alpha: false,
                }))
              }
              style={{ touchAction: 'manipulation' }}
              className={`px-2 py-0.5 rounded active:scale-95 transition cursor-pointer select-none ${
                calcState.mode.startsWith('SETUP') ? 'bg-amber-500/40 border border-amber-300/60 text-amber-100 font-semibold' : 'bg-white/10 hover:bg-white/20 text-amber-200'
              }`}
            >
              SETUP
            </button>
            <button
              type="button"
              onClick={() => setCalcState((p) => ({ ...p, mode: 'COMP' }))}
              style={{ touchAction: 'manipulation' }}
              className={`px-2 py-0.5 rounded active:scale-95 transition cursor-pointer select-none ${
                calcState.mode === 'COMP' ? 'bg-emerald-500/40 border border-emerald-300/50 text-white font-semibold' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              1: COMP
            </button>
            <button
              type="button"
              onClick={() => setCalcState((p) => ({ ...p, mode: 'VCT_SELECT', menuCursorIndex: 0, resultLatex: '' }))}
              style={{ touchAction: 'manipulation' }}
              className={`px-2 py-0.5 rounded active:scale-95 transition cursor-pointer select-none ${
                calcState.mode.startsWith('VCT') ? 'bg-emerald-500/40 border border-emerald-300/50 text-white font-semibold' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              5: VECTOR
            </button>
            <button
              type="button"
              onClick={() => {
                setCalcState((p) => ({
                  ...p,
                  mode: 'STAT_SELECT',
                  menuCursorIndex: 1,
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
              6: STAT
            </button>
            <button
              type="button"
              onClick={() => {
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
              onClick={() => setCalcState((p) => ({ ...p, mode: 'EQN_SELECT', menuCursorIndex: 0 }))}
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
  displayMode?: CasioDisplayMode;
  onChangeDisplayMode?: (mode: CasioDisplayMode) => void;
  dockPosition?: 'left' | 'right';
  onToggleDockPosition?: () => void;
  onBigScreenChange?: (active: boolean) => void;
}> = ({
  isOpen,
  onClose,
  displayMode = 'standalone',
  onChangeDisplayMode,
  dockPosition = 'right',
  onToggleDockPosition,
  onBigScreenChange,
}) => {
  if (!isOpen) return null;

  if (displayMode === 'with_blackboard') {
    return (
      <div className="w-full h-full flex flex-col select-none">
        <SafeCalculatorErrorBoundary onClose={onClose}>
          <CasioFx580VNXInner
            onClose={onClose}
            displayMode="with_blackboard"
            onChangeDisplayMode={onChangeDisplayMode}
            dockPosition={dockPosition}
            onToggleDockPosition={onToggleDockPosition}
            onBigScreenChange={onBigScreenChange}
          />
        </SafeCalculatorErrorBoundary>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[10060] flex items-center justify-center p-1.5 sm:p-4 bg-slate-950/90 animate-in fade-in duration-200 select-none overflow-y-auto pb-safe">
      <div className="relative my-auto w-full sm:w-auto max-w-full flex flex-col items-center">
        {/* Nút đóng nổi bật góc trên bên phải */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 sm:-top-3.5 sm:-right-3.5 z-50 min-w-[36px] min-h-[36px] p-2 rounded-full bg-slate-900/95 hover:bg-rose-600 text-white shadow-2xl border border-white/25 flex items-center justify-center transition-all cursor-pointer active:scale-95"
          title="Đóng máy tính Casio fx-580VN X"
        >
          <X className="w-4 h-4" />
        </button>

        <SafeCalculatorErrorBoundary onClose={onClose}>
          <CasioFx580VNXInner
            onClose={onClose}
            displayMode="standalone"
            onChangeDisplayMode={onChangeDisplayMode}
            onBigScreenChange={onBigScreenChange}
          />
        </SafeCalculatorErrorBoundary>
      </div>
    </div>
  );
};

export default CasioCalculatorModal;
