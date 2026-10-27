import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  History,
  RotateCcw,
  Sparkles,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export type CalculatorMode = 'COMP' | 'EQN' | 'TABLE' | 'MENU';

interface EquationResult {
  title: string;
  roots: string[];
  extremum?: {
    type: 'min' | 'max';
    x: string;
    y: string;
  };
  details?: string;
}

interface TableRow {
  x: number;
  fx: number;
}

export const CasioCalculatorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<CalculatorMode>('COMP');
  const [isShift, setIsShift] = useState<boolean>(false);
  const [isAlpha, setIsAlpha] = useState<boolean>(false);
  const [angleUnit, setAngleUnit] = useState<'DEG' | 'RAD'>('DEG');

  // COMP mode state
  const [expression, setExpression] = useState<string>('');
  const [displayResult, setDisplayResult] = useState<string>('0');
  const [ans, setAns] = useState<string>('0');
  const [memoryM, setMemoryM] = useState<number>(0);
  const [cursorPos, setCursorPos] = useState<number>(0);
  const [history, setHistory] = useState<Array<{ expr: string; res: string }>>([
    { expr: 'sin(30°)', res: '0.5' },
    { expr: '√(144) + 5²', res: '37' },
    { expr: '2026 × 12', res: '24312' },
  ]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [copiedRes, setCopiedRes] = useState<boolean>(false);

  // EQN mode state (Quadratic, Cubic, System 2 vars, System 3 vars)
  const [eqnType, setEqnType] = useState<'quad' | 'cubic' | 'sys2'>('quad');
  const [quadCoeffs, setQuadCoeffs] = useState({ a: '1', b: '-5', c: '6' });
  const [cubicCoeffs, setCubicCoeffs] = useState({ a: '1', b: '-3', c: '0', d: '4' });
  const [sys2Coeffs, setSys2Coeffs] = useState({ a1: '2', b1: '3', c1: '13', a2: '5', b2: '-1', c2: '7' });
  const [eqnResult, setEqnResult] = useState<EquationResult | null>(null);

  // TABLE mode state
  const [tableFunc, setTableFunc] = useState<string>('2x^2 - 4x + 1');
  const [tableStart, setTableStart] = useState<string>('-2');
  const [tableEnd, setTableEnd] = useState<string>('4');
  const [tableStep, setTableStep] = useState<string>('0.5');
  const [tableData, setTableData] = useState<TableRow[]>([]);

  // Sound feedback on key press (realistic tactile click)
  const playClick = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.035);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch (_) {}
  };

  // Keyboard navigation listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) {
        return;
      }
      if (e.key >= '0' && e.key <= '9') {
        insertChar(e.key);
      } else if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') {
        const opMap: Record<string, string> = { '+': '+', '-': '-', '*': '×', '/': '÷' };
        insertChar(opMap[e.key]);
      } else if (e.key === '.' || e.key === ',') {
        insertChar('.');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        calculateComp();
      } else if (e.key === 'Backspace') {
        deleteLast();
      } else if (e.key === 'Escape') {
        clearAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, expression]);

  const insertChar = (char: string) => {
    playClick();
    if (mode === 'MENU') {
      if (char === '1') setMode('COMP');
      else if (char === '9') setMode('EQN');
      else if (char === '8') setMode('TABLE');
      return;
    }
    setExpression((prev) => prev + char);
    setIsShift(false);
    setIsAlpha(false);
  };

  const deleteLast = () => {
    playClick();
    setExpression((prev) => prev.slice(0, -1));
  };

  const clearAll = () => {
    playClick();
    setExpression('');
    setDisplayResult('0');
    setIsShift(false);
    setIsAlpha(false);
    if (mode === 'MENU') setMode('COMP');
  };

  // Mathematical evaluator for COMP mode
  const calculateComp = () => {
    playClick();
    if (!expression.trim()) return;

    try {
      let expr = expression;

      // Replace visual symbols with JS math
      expr = expr.replace(/×/g, '*');
      expr = expr.replace(/÷/g, '/');
      expr = expr.replace(/π/g, 'Math.PI');
      expr = expr.replace(/e(?![a-zA-Z])/g, 'Math.E');
      expr = expr.replace(/Ans/g, `(${ans})`);

      // Power ^
      expr = expr.replace(/\^/g, '**');

      // Square root & Cube root
      expr = expr.replace(/∛\(([^)]+)\)/g, 'Math.cbrt($1)');
      expr = expr.replace(/∛([0-9.]+)/g, 'Math.cbrt($1)');
      expr = expr.replace(/√\(([^)]+)\)/g, 'Math.sqrt($1)');
      expr = expr.replace(/√([0-9.]+)/g, 'Math.sqrt($1)');

      // Inverse trig
      expr = expr.replace(/sin⁻¹\(([^)]+)\)/g, angleUnit === 'DEG' ? '(180/Math.PI)*Math.asin($1)' : 'Math.asin($1)');
      expr = expr.replace(/cos⁻¹\(([^)]+)\)/g, angleUnit === 'DEG' ? '(180/Math.PI)*Math.acos($1)' : 'Math.acos($1)');
      expr = expr.replace(/tan⁻¹\(([^)]+)\)/g, angleUnit === 'DEG' ? '(180/Math.PI)*Math.atan($1)' : 'Math.atan($1)');

      // Trig functions with degree or radian
      const angleMultiplier = angleUnit === 'DEG' ? '(Math.PI/180)*' : '';
      expr = expr.replace(/sin\(([^)]+)\)/g, `Math.sin(${angleMultiplier}($1))`);
      expr = expr.replace(/cos\(([^)]+)\)/g, `Math.cos(${angleMultiplier}($1))`);
      expr = expr.replace(/tan\(([^)]+)\)/g, `Math.tan(${angleMultiplier}($1))`);

      // Log and Ln
      expr = expr.replace(/ln\(([^)]+)\)/g, 'Math.log($1)');
      expr = expr.replace(/log\(([^)]+)\)/g, 'Math.log10($1)');
      expr = expr.replace(/abs\(([^)]+)\)/g, 'Math.abs($1)');

      // Factorial: n!
      expr = expr.replace(/(\d+)!/g, (_, n) => {
        let val = 1;
        const num = parseInt(n, 10);
        for (let i = 2; i <= num; i++) val *= i;
        return val.toString();
      });

      // Percent: %
      expr = expr.replace(/([0-9.]+)%/g, '($1/100)');

      // Safe evaluation
      // eslint-disable-next-line no-eval
      const res = Function(`"use strict"; return (${expr});`)();

      if (typeof res === 'number') {
        let formatted = '';
        if (Number.isNaN(res)) {
          formatted = 'Math ERROR';
        } else if (!Number.isFinite(res)) {
          formatted = 'Vô cùng (Infinity)';
        } else {
          // Format reasonable precision
          formatted = Number(res.toFixed(10)).toString();
        }
        setDisplayResult(formatted);
        setAns(formatted);
        setHistory((prev) => [{ expr: expression, res: formatted }, ...prev.slice(0, 19)]);
      } else {
        setDisplayResult('Syntax ERROR');
      }
    } catch (err) {
      setDisplayResult('Syntax ERROR');
    }
  };

  // Convert decimal to fraction string if possible (S<=>D button)
  const toggleFraction = () => {
    playClick();
    const val = parseFloat(displayResult);
    if (isNaN(val)) return;

    if (displayResult.includes('/')) {
      const parts = displayResult.split('/');
      const dec = parseFloat(parts[0]) / parseFloat(parts[1]);
      setDisplayResult(dec.toString());
      return;
    }

    let bestNumerator = 1;
    let bestDenominator = 1;
    let minError = Math.abs(val - bestNumerator / bestDenominator);

    for (let d = 1; d <= 2000; d++) {
      const n = Math.round(val * d);
      const err = Math.abs(val - n / d);
      if (err < 1e-9) {
        bestNumerator = n;
        bestDenominator = d;
        minError = err;
        break;
      }
    }

    if (minError < 1e-6 && bestDenominator !== 1) {
      setDisplayResult(`${bestNumerator}/${bestDenominator}`);
    }
  };

  // Solve Equations
  const solveEquation = () => {
    playClick();
    if (eqnType === 'quad') {
      const a = parseFloat(quadCoeffs.a);
      const b = parseFloat(quadCoeffs.b);
      const c = parseFloat(quadCoeffs.c);

      if (isNaN(a) || isNaN(b) || isNaN(c)) return;
      if (a === 0) {
        setEqnResult({
          title: 'Phương trình bậc nhất',
          roots: b !== 0 ? [`x = ${(-c / b).toFixed(4)}`] : ['Vô nghiệm'],
        });
        return;
      }

      const delta = b * b - 4 * a * c;
      const xPeak = -b / (2 * a);
      const yPeak = -delta / (4 * a);
      const extremumType = a > 0 ? 'min' : 'max';

      if (delta > 0) {
        const x1 = (-b + Math.sqrt(delta)) / (2 * a);
        const x2 = (-b - Math.sqrt(delta)) / (2 * a);
        setEqnResult({
          title: `ax² + bx + c = 0 (Δ = ${delta.toFixed(2)} > 0)`,
          roots: [`x₁ = ${x1.toFixed(6).replace(/\.?0+$/, '')}`, `x₂ = ${x2.toFixed(6).replace(/\.?0+$/, '')}`],
          extremum: {
            type: extremumType,
            x: xPeak.toFixed(6).replace(/\.?0+$/, ''),
            y: yPeak.toFixed(6).replace(/\.?0+$/, ''),
          },
          details: `Đỉnh parabol (${extremumType === 'min' ? 'cực tiểu' : 'cực đại'}) tại (${xPeak.toFixed(2)}, ${yPeak.toFixed(2)})`,
        });
      } else if (Math.abs(delta) < 1e-9) {
        setEqnResult({
          title: 'ax² + bx + c = 0 (Δ = 0, nghiệm kép)',
          roots: [`x₁ = x₂ = ${xPeak.toFixed(6).replace(/\.?0+$/, '')}`],
          extremum: {
            type: extremumType,
            x: xPeak.toFixed(6).replace(/\.?0+$/, ''),
            y: yPeak.toFixed(6).replace(/\.?0+$/, ''),
          },
        });
      } else {
        const realPart = (-b / (2 * a)).toFixed(4);
        const imagPart = (Math.sqrt(-delta) / (2 * a)).toFixed(4);
        setEqnResult({
          title: `ax² + bx + c = 0 (Δ < 0, 2 nghiệm phức)`,
          roots: [`x₁ = ${realPart} + ${imagPart}i`, `x₂ = ${realPart} - ${imagPart}i`],
        });
      }
    } else if (eqnType === 'cubic') {
      const a = parseFloat(cubicCoeffs.a);
      const b = parseFloat(cubicCoeffs.b);
      const c = parseFloat(cubicCoeffs.c);
      const d = parseFloat(cubicCoeffs.d);

      if (isNaN(a) || isNaN(b) || isNaN(c) || isNaN(d) || a === 0) return;

      const f = (x: number) => a * x * x * x + b * x * x + c * x + d;
      const roots: number[] = [];

      for (let x = -50; x <= 50; x += 0.25) {
        const xNext = x + 0.25;
        if (f(x) * f(xNext) <= 0) {
          let low = x;
          let high = xNext;
          for (let i = 0; i < 30; i++) {
            const mid = (low + high) / 2;
            if (f(low) * f(mid) <= 0) high = mid;
            else low = mid;
          }
          const rootVal = Number(((low + high) / 2).toFixed(5));
          if (!roots.some((r) => Math.abs(r - rootVal) < 0.001)) {
            roots.push(rootVal);
          }
        }
      }

      setEqnResult({
        title: 'ax³ + bx² + cx + d = 0',
        roots: roots.length > 0 ? roots.map((r, i) => `x${i + 1} = ${r}`) : ['Vô nghiệm thực'],
      });
    } else if (eqnType === 'sys2') {
      const a1 = parseFloat(sys2Coeffs.a1);
      const b1 = parseFloat(sys2Coeffs.b1);
      const c1 = parseFloat(sys2Coeffs.c1);
      const a2 = parseFloat(sys2Coeffs.a2);
      const b2 = parseFloat(sys2Coeffs.b2);
      const c2 = parseFloat(sys2Coeffs.c2);

      const D = a1 * b2 - a2 * b1;
      const Dx = c1 * b2 - c2 * b1;
      const Dy = a1 * c2 - a2 * c1;

      if (Math.abs(D) < 1e-9) {
        setEqnResult({ title: 'Hệ 2 ẩn', roots: ['Hệ vô nghiệm hoặc vô số nghiệm'] });
      } else {
        setEqnResult({
          title: 'Hệ phương trình bậc nhất 2 ẩn',
          roots: [`x = ${(Dx / D).toFixed(5).replace(/\.?0+$/, '')}`, `y = ${(Dy / D).toFixed(5).replace(/\.?0+$/, '')}`],
        });
      }
    }
  };

  // Generate TABLE mode
  const generateTable = () => {
    playClick();
    const start = parseFloat(tableStart);
    const end = parseFloat(tableEnd);
    const step = parseFloat(tableStep);

    if (isNaN(start) || isNaN(end) || isNaN(step) || step <= 0 || start > end) return;

    let cleanFunc = tableFunc.replace(/x\^2/g, '(x**2)').replace(/x\^3/g, '(x**3)').replace(/x\^(\d+)/g, '(x**$1)');
    cleanFunc = cleanFunc.replace(/(\d)x/g, '$1*x');
    cleanFunc = cleanFunc.replace(/x/g, '(x)');
    cleanFunc = cleanFunc.replace(/sin/g, 'Math.sin');
    cleanFunc = cleanFunc.replace(/cos/g, 'Math.cos');
    cleanFunc = cleanFunc.replace(/tan/g, 'Math.tan');
    cleanFunc = cleanFunc.replace(/ln/g, 'Math.log');
    cleanFunc = cleanFunc.replace(/√/g, 'Math.sqrt');

    const rows: TableRow[] = [];
    const count = Math.min(100, Math.floor((end - start) / step) + 1);

    for (let i = 0; i < count; i++) {
      const curX = Number((start + i * step).toFixed(4));
      try {
        // eslint-disable-next-line no-eval
        const val = Function('x', `"use strict"; return (${cleanFunc});`)(curX);
        rows.push({ x: curX, fx: typeof val === 'number' && !isNaN(val) ? Number(val.toFixed(4)) : NaN });
      } catch {
        rows.push({ x: curX, fx: NaN });
      }
    }
    setTableData(rows);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      {/* Authentic Casio fx-580VN X Body Casing */}
      <div className="relative w-full max-w-[420px] bg-[#12151a] rounded-[2.8rem] border-4 border-[#333d4b] shadow-[0_25px_70px_rgba(0,0,0,0.95)] p-4 sm:p-5 flex flex-col text-slate-100 font-sans">
        
        {/* Top Header Plate with Bitex Hologram & Casio Logos */}
        <div className="relative pb-2.5 flex items-center justify-between border-b border-[#242b35]">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold tracking-widest text-base text-white">CASIO</span>
          </div>

          {/* Authentic Hologram Seal: TEM CHỐNG GIẢ BITEX */}
          <div className="px-2 py-0.5 rounded-md bg-gradient-to-r from-teal-300 via-sky-200 to-indigo-300 text-slate-950 text-[9px] font-black tracking-wider uppercase shadow-inner border border-white/40 flex items-center gap-1">
            <span className="text-[10px]">🛡️</span>
            <span>TEM BITEX</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-xs tracking-tight text-white font-mono">fx-580VN X</span>
            <button
              onClick={onClose}
              className="p-1 rounded-full bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Đóng máy tính"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* CLASSWIZ Magenta Branding */}
        <div className="flex items-center justify-between pt-1 px-1">
          <span className="text-sm font-black tracking-wider text-[#f43f5e] font-sans">CLASSWIZ</span>
          <span className="text-[9px] font-mono font-bold text-slate-400">HIGH RESOLUTION • 552 FUNCTIONS</span>
        </div>

        {/* Authentic Greenish-Grey Dot-Matrix LCD Screen */}
        <div className="mt-2 bg-[#9fae97] border-[5px] border-[#65735e] rounded-2xl p-2.5 shadow-inner relative flex flex-col justify-between min-h-[118px] text-slate-950 font-mono">
          {/* Top Status Indicators */}
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-800 border-b border-slate-700/20 pb-0.5">
            <div className="flex items-center gap-2">
              <span className={`px-1 rounded text-[9px] ${isShift ? 'bg-slate-900 text-[#9fae97]' : 'opacity-20'}`}>S</span>
              <span className={`px-1 rounded text-[9px] ${isAlpha ? 'bg-rose-900 text-[#9fae97]' : 'opacity-20'}`}>A</span>
              <span className="opacity-30">M</span>
              <button
                onClick={() => setAngleUnit((u) => (u === 'DEG' ? 'RAD' : 'DEG'))}
                className="hover:underline font-black cursor-pointer"
                title="Bấm để đổi Đơn vị góc (DEG / RAD)"
              >
                [{angleUnit}]
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-sans font-bold opacity-80">Natural-V.P.A.M.</span>
              <span className="font-black text-slate-900">Math</span>
            </div>
          </div>

          {/* Screen Content by Mode */}
          {mode === 'COMP' && (
            <div className="flex-1 flex flex-col justify-between pt-1">
              <div className="text-right text-sm font-semibold tracking-wide text-slate-950 break-all overflow-x-auto min-h-[24px]">
                {expression || <span className="opacity-25">0</span>}
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-[10px] text-slate-800 hover:text-slate-950 flex items-center gap-0.5 underline cursor-pointer"
                >
                  <History className="w-3 h-3" />
                  <span>Lịch sử</span>
                </button>
                <div
                  className="text-right text-2xl font-black text-slate-950 tracking-tight cursor-pointer hover:opacity-85"
                  onClick={() => {
                    navigator.clipboard.writeText(displayResult);
                    setCopiedRes(true);
                    setTimeout(() => setCopiedRes(false), 1200);
                  }}
                  title="Bấm để sao chép kết quả"
                >
                  {displayResult}
                  {copiedRes && <span className="text-[10px] ml-1 text-emerald-900">Đã chép!</span>}
                </div>
              </div>
            </div>
          )}

          {mode === 'MENU' && (
            <div className="flex-1 flex flex-col justify-between text-xs py-1">
              <div className="text-[11px] font-black text-slate-900 border-b border-slate-700/20 pb-0.5">
                MENU SETUP - Chọn ứng dụng:
              </div>
              <div className="grid grid-cols-3 gap-1 text-[11px] font-bold text-slate-900 pt-1">
                <button
                  onClick={() => setMode('COMP')}
                  className="p-1 rounded bg-slate-900/10 hover:bg-slate-900/20 text-left cursor-pointer"
                >
                  1: Tính toán
                </button>
                <button
                  onClick={() => setMode('EQN')}
                  className="p-1 rounded bg-slate-900/10 hover:bg-slate-900/20 text-left cursor-pointer"
                >
                  9: PT/Hệ
                </button>
                <button
                  onClick={() => setMode('TABLE')}
                  className="p-1 rounded bg-slate-900/10 hover:bg-slate-900/20 text-left cursor-pointer"
                >
                  8: Bảng f(x)
                </button>
              </div>
              <div className="text-[9px] text-slate-700 text-right">Bấm số 1, 8, 9 hoặc AC để thoát</div>
            </div>
          )}

          {mode === 'EQN' && (
            <div className="flex-1 flex flex-col justify-center text-xs">
              <div className="font-bold text-slate-900 border-b border-slate-700/20 pb-0.5 mb-1 flex items-center justify-between">
                <span>{eqnResult ? eqnResult.title : 'Giải Phương trình & Hệ PT'}</span>
                <button onClick={() => setMode('COMP')} className="text-[10px] underline">Thoát</button>
              </div>
              {eqnResult ? (
                <div className="space-y-0.5">
                  <div className="font-black text-sm text-slate-950 flex flex-wrap gap-2">
                    {eqnResult.roots.map((r, idx) => (
                      <span key={idx} className="bg-slate-900/10 px-1.5 py-0.5 rounded">
                        {r}
                      </span>
                    ))}
                  </div>
                  {eqnResult.extremum && (
                    <div className="text-[10px] text-slate-800 font-bold">
                      Đỉnh ({eqnResult.extremum.type}): x = {eqnResult.extremum.x}, y = {eqnResult.extremum.y}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-slate-800 text-[11px]">
                  Nhập hệ số rồi bấm nút <b>GIẢI (=)</b>
                </div>
              )}
            </div>
          )}

          {mode === 'TABLE' && (
            <div className="flex-1 flex flex-col justify-between text-xs">
              <div className="flex items-center justify-between text-[11px] font-bold border-b border-slate-700/20 pb-0.5">
                <span>f(x) = {tableFunc}</span>
                <button onClick={() => setMode('COMP')} className="text-[10px] underline">Thoát</button>
              </div>
              <div className="text-[11px] text-slate-900 mt-1 max-h-[50px] overflow-y-auto">
                {tableData.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1 text-center font-bold">
                    <span className="text-slate-700">No.</span>
                    <span>x</span>
                    <span className="text-indigo-950">f(x)</span>
                    {tableData.slice(0, 4).map((row, idx) => (
                      <React.Fragment key={idx}>
                        <span className="text-slate-600">{idx + 1}</span>
                        <span>{row.x}</span>
                        <span className="text-indigo-950">{isNaN(row.fx) ? 'ERROR' : row.fx}</span>
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-800">Bấm LẬP BẢNG để duyệt giá trị</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* History Reel Tray */}
        {showHistory && (
          <div className="mt-2 p-2 bg-[#1a2028] rounded-xl border border-slate-700 text-xs max-h-36 overflow-y-auto space-y-1">
            <div className="flex items-center justify-between font-bold text-slate-400 pb-1 border-b border-slate-800">
              <span>Lịch sử phép tính gần đây</span>
              <button onClick={() => setHistory([])} className="text-[10px] text-rose-400 hover:underline">
                Xóa hết
              </button>
            </div>
            {history.map((h, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setExpression(h.expr);
                  setDisplayResult(h.res);
                  setShowHistory(false);
                }}
                className="flex items-center justify-between p-1 rounded-lg hover:bg-slate-800 cursor-pointer font-mono text-[11px]"
              >
                <span className="text-slate-300 truncate max-w-[200px]">{h.expr}</span>
                <span className="text-emerald-400 font-bold">= {h.res}</span>
              </div>
            ))}
          </div>
        )}

        {/* EQN Mode Drawer Input */}
        {mode === 'EQN' && (
          <div className="mt-2 p-2 bg-[#161c24] rounded-2xl border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center gap-1 text-[11px]">
              <button
                onClick={() => setEqnType('quad')}
                className={`flex-1 py-1 rounded-lg font-bold ${eqnType === 'quad' ? 'bg-amber-600 text-white' : 'bg-slate-800'}`}
              >
                Bậc 2 (ax²+bx+c=0)
              </button>
              <button
                onClick={() => setEqnType('cubic')}
                className={`flex-1 py-1 rounded-lg font-bold ${eqnType === 'cubic' ? 'bg-amber-600 text-white' : 'bg-slate-800'}`}
              >
                Bậc 3
              </button>
              <button
                onClick={() => setEqnType('sys2')}
                className={`flex-1 py-1 rounded-lg font-bold ${eqnType === 'sys2' ? 'bg-amber-600 text-white' : 'bg-slate-800'}`}
              >
                Hệ 2 ẩn
              </button>
            </div>
            {eqnType === 'quad' && (
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={quadCoeffs.a}
                  onChange={(e) => setQuadCoeffs({ ...quadCoeffs, a: e.target.value })}
                  placeholder="a"
                  className="px-2 py-1 bg-slate-800 rounded text-center font-bold"
                />
                <input
                  type="text"
                  value={quadCoeffs.b}
                  onChange={(e) => setQuadCoeffs({ ...quadCoeffs, b: e.target.value })}
                  placeholder="b"
                  className="px-2 py-1 bg-slate-800 rounded text-center font-bold"
                />
                <input
                  type="text"
                  value={quadCoeffs.c}
                  onChange={(e) => setQuadCoeffs({ ...quadCoeffs, c: e.target.value })}
                  placeholder="c"
                  className="px-2 py-1 bg-slate-800 rounded text-center font-bold"
                />
              </div>
            )}
            <button
              onClick={solveEquation}
              className="w-full py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black"
            >
              GIẢI PHƯƠNG TRÌNH (=)
            </button>
          </div>
        )}

        {/* TABLE Mode Drawer Input */}
        {mode === 'TABLE' && (
          <div className="mt-2 p-2 bg-[#161c24] rounded-2xl border border-slate-800 space-y-1.5 text-xs">
            <input
              type="text"
              value={tableFunc}
              onChange={(e) => setTableFunc(e.target.value)}
              placeholder="f(x) = 2x^2 - 4x + 1"
              className="w-full px-2 py-1 bg-slate-800 rounded font-bold"
            />
            <div className="grid grid-cols-3 gap-1 text-center">
              <input
                type="text"
                value={tableStart}
                onChange={(e) => setTableStart(e.target.value)}
                placeholder="Start"
                className="px-1 py-0.5 bg-slate-800 rounded text-center"
              />
              <input
                type="text"
                value={tableEnd}
                onChange={(e) => setTableEnd(e.target.value)}
                placeholder="End"
                className="px-1 py-0.5 bg-slate-800 rounded text-center"
              />
              <input
                type="text"
                value={tableStep}
                onChange={(e) => setTableStep(e.target.value)}
                placeholder="Step"
                className="px-1 py-0.5 bg-slate-800 rounded text-center"
              />
            </div>
            <button
              onClick={generateTable}
              className="w-full py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black"
            >
              LẬP BẢNG f(x)
            </button>
          </div>
        )}

        {/* ================= AUTHENTIC CASIO FX-580VN X KEYPAD ================= */}
        
        {/* ROW 1: METALLIC DOME BUTTONS & REPLAY D-PAD */}
        <div className="mt-2.5 flex items-center justify-between px-1">
          {/* SHIFT */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-[#eab308] tracking-wider">SHIFT</span>
            <button
              onClick={() => {
                playClick();
                setIsShift(!isShift);
                setIsAlpha(false);
              }}
              className={`w-10 h-8 rounded-full border-2 transition-all cursor-pointer shadow-md active:translate-y-0.5 ${
                isShift
                  ? 'bg-gradient-to-b from-amber-400 to-amber-600 border-amber-300 ring-2 ring-amber-400'
                  : 'bg-gradient-to-b from-[#e2e8f0] via-[#cbd5e1] to-[#94a3b8] border-[#f1f5f9]'
              }`}
            />
          </div>

          {/* ALPHA */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-[#f43f5e] tracking-wider">ALPHA</span>
            <button
              onClick={() => {
                playClick();
                setIsAlpha(!isAlpha);
                setIsShift(false);
              }}
              className={`w-10 h-8 rounded-full border-2 transition-all cursor-pointer shadow-md active:translate-y-0.5 ${
                isAlpha
                  ? 'bg-gradient-to-b from-rose-400 to-rose-600 border-rose-300 ring-2 ring-rose-400'
                  : 'bg-gradient-to-b from-[#e2e8f0] via-[#cbd5e1] to-[#94a3b8] border-[#f1f5f9]'
              }`}
            />
          </div>

          {/* REPLAY D-PAD (Metallic Silver 4-Way Pad) */}
          <div className="relative w-20 h-16 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-b from-[#e2e8f0] via-[#cbd5e1] to-[#64748b] border-2 border-slate-400 shadow-lg flex items-center justify-center relative">
              {/* Up arrow */}
              <button
                onClick={() => insertChar('(')}
                className="absolute top-1 text-[9px] font-black text-slate-800 hover:text-indigo-600 cursor-pointer"
              >
                ▲
              </button>
              {/* Down arrow */}
              <button
                onClick={() => insertChar(')')}
                className="absolute bottom-1 text-[9px] font-black text-slate-800 hover:text-indigo-600 cursor-pointer"
              >
                ▼
              </button>
              {/* Left arrow */}
              <button
                onClick={() => insertChar('-')}
                className="absolute left-1.5 text-[9px] font-black text-slate-800 hover:text-indigo-600 cursor-pointer"
              >
                ◀
              </button>
              {/* Right arrow */}
              <button
                onClick={() => insertChar('+')}
                className="absolute right-1.5 text-[9px] font-black text-slate-800 hover:text-indigo-600 cursor-pointer"
              >
                ▶
              </button>
              {/* Center hole */}
              <div className="w-6 h-6 rounded-full bg-[#12151a] border border-slate-600 shadow-inner" />
            </div>
          </div>

          {/* MENU SETUP */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-0.5 text-[9px] font-bold">
              <span className="text-[#eab308]">SETUP</span>
            </div>
            <button
              onClick={() => {
                playClick();
                setMode((m) => (m === 'MENU' ? 'COMP' : 'MENU'));
              }}
              className="w-10 h-8 rounded-full bg-gradient-to-b from-[#e2e8f0] via-[#cbd5e1] to-[#94a3b8] border-2 border-[#f1f5f9] transition-all cursor-pointer shadow-md active:translate-y-0.5 flex items-center justify-center text-[9px] font-black text-slate-900"
            >
              MENU
            </button>
          </div>

          {/* ON */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-slate-300 tracking-wider">ON</span>
            <button
              onClick={clearAll}
              className="w-10 h-8 rounded-full bg-gradient-to-b from-[#e2e8f0] via-[#cbd5e1] to-[#94a3b8] border-2 border-[#f1f5f9] transition-all cursor-pointer shadow-md active:translate-y-0.5 flex items-center justify-center text-[10px] font-black text-rose-700"
            >
              ON
            </button>
          </div>
        </div>

        {/* ROW 2: OPTN, CALC, ∫dx, x (Variable) */}
        <div className="mt-2 grid grid-cols-4 gap-2 px-1">
          {/* OPTN */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => insertChar('abs(')}
              className="w-full py-1.5 rounded-xl bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-xs font-bold text-white shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              OPTN
            </button>
          </div>

          {/* CALC (yellow SOLVE, red =) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[8px] font-bold">
              <span className="text-[#eab308]">SOLVE</span>
              <span className="text-[#f43f5e]">=</span>
            </div>
            <button
              onClick={() => (isShift ? solveEquation() : insertChar('='))}
              className="w-full py-1.5 rounded-xl bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-xs font-bold text-white shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              CALC
            </button>
          </div>

          {/* ∫dx (yellow d/dx, red :) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[8px] font-bold">
              <span className="text-[#eab308]">d/dx</span>
              <span className="text-[#f43f5e]">:</span>
            </div>
            <button
              onClick={() => insertChar('(')}
              className="w-full py-1.5 rounded-xl bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-xs font-serif font-bold text-white shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              ∫■
            </button>
          </div>

          {/* x (Variable x, yellow Σ) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[8px] font-bold">
              <span className="text-[#eab308]">Σ</span>
            </div>
            <button
              onClick={() => insertChar('x')}
              className="w-full py-1.5 rounded-xl bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-xs font-serif italic font-bold text-[#f43f5e] shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              x
            </button>
          </div>
        </div>

        {/* ROW 3: ■/□ (Fraction), √■, x², x^■, log_■(□), ln */}
        <div className="mt-1.5 grid grid-cols-6 gap-1 px-1">
          {/* Fraction ■/□ */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] font-bold text-[#eab308]">■ ■/□</span>
            <button
              onClick={() => insertChar('/')}
              className="w-full py-1.5 rounded-lg bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-xs font-bold text-white shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              ■/□
            </button>
          </div>

          {/* √■ (Square root, yellow ∛) */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] font-bold text-[#eab308]">∛</span>
            <button
              onClick={() => insertChar(isShift ? '∛(' : '√(')}
              className="w-full py-1.5 rounded-lg bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-xs font-bold text-white shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              √■
            </button>
          </div>

          {/* x² (yellow x³) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-0.5 text-[7px] font-bold">
              <span className="text-[#eab308]">x³</span>
            </div>
            <button
              onClick={() => insertChar(isShift ? '^3' : '^2')}
              className="w-full py-1.5 rounded-lg bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-xs font-bold text-white shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              x²
            </button>
          </div>

          {/* x^■ (Power) */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] font-bold text-[#eab308]">^x√</span>
            <button
              onClick={() => insertChar('^')}
              className="w-full py-1.5 rounded-lg bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-xs font-bold text-white shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              x^■
            </button>
          </div>

          {/* log_■(□) (yellow 10^x) */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] font-bold text-[#eab308]">10^x</span>
            <button
              onClick={() => insertChar(isShift ? '*10^' : 'log(')}
              className="w-full py-1.5 rounded-lg bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-[11px] font-bold text-white shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              log
            </button>
          </div>

          {/* ln (yellow e^x) */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] font-bold text-[#eab308]">e^x</span>
            <button
              onClick={() => insertChar(isShift ? 'e^' : 'ln(')}
              className="w-full py-1.5 rounded-lg bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-xs font-bold text-white shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              ln
            </button>
          </div>
        </div>

        {/* ROW 4: (-), ° ' ", x^-1, sin, cos, tan */}
        <div className="mt-1 grid grid-cols-6 gap-1 px-1">
          {/* (-) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-0.5 text-[7px] font-bold">
              <span className="text-[#f43f5e]">A</span>
            </div>
            <button
              onClick={() => insertChar('(-')}
              className="w-full py-1.5 rounded-lg bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-xs font-bold text-white shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              (-)
            </button>
          </div>

          {/* ° ' " (yellow FACT, red B) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-0.5 text-[7px] font-bold">
              <span className="text-[#eab308]">FACT</span>
              <span className="text-[#f43f5e]">B</span>
            </div>
            <button
              onClick={() => insertChar('°')}
              className="w-full py-1.5 rounded-lg bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-[11px] font-bold text-white shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              ° ' "
            </button>
          </div>

          {/* x^-1 (yellow x!, red C) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-0.5 text-[7px] font-bold">
              <span className="text-[#eab308]">x!</span>
              <span className="text-[#f43f5e]">C</span>
            </div>
            <button
              onClick={() => insertChar(isShift ? '!' : '^(-1)')}
              className="w-full py-1.5 rounded-lg bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-xs font-bold text-white shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              x⁻¹
            </button>
          </div>

          {/* sin (yellow sin^-1, red D) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-0.5 text-[7px] font-bold">
              <span className="text-[#eab308]">sin⁻¹</span>
              <span className="text-[#f43f5e]">D</span>
            </div>
            <button
              onClick={() => insertChar(isShift ? 'sin⁻¹(' : 'sin(')}
              className="w-full py-1.5 rounded-lg bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-xs font-bold text-[#38bdf8] shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              sin
            </button>
          </div>

          {/* cos (yellow cos^-1, red E) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-0.5 text-[7px] font-bold">
              <span className="text-[#eab308]">cos⁻¹</span>
              <span className="text-[#f43f5e]">E</span>
            </div>
            <button
              onClick={() => insertChar(isShift ? 'cos⁻¹(' : 'cos(')}
              className="w-full py-1.5 rounded-lg bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-xs font-bold text-[#38bdf8] shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              cos
            </button>
          </div>

          {/* tan (yellow tan^-1, red F) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-0.5 text-[7px] font-bold">
              <span className="text-[#eab308]">tan⁻¹</span>
              <span className="text-[#f43f5e]">F</span>
            </div>
            <button
              onClick={() => insertChar(isShift ? 'tan⁻¹(' : 'tan(')}
              className="w-full py-1.5 rounded-lg bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-xs font-bold text-[#38bdf8] shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              tan
            </button>
          </div>
        </div>

        {/* ROW 5: STO, ENG, (, ), S<=>D, M+ */}
        <div className="mt-1 grid grid-cols-6 gap-1 px-1">
          {/* STO */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] font-bold text-[#eab308]">RECALL</span>
            <button
              onClick={() => insertChar('Ans')}
              className="w-full py-1.5 rounded-lg bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-xs font-bold text-white shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              STO
            </button>
          </div>

          {/* ENG (red i) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-0.5 text-[7px] font-bold">
              <span className="text-[#f43f5e]">i</span>
            </div>
            <button
              onClick={() => insertChar('i')}
              className="w-full py-1.5 rounded-lg bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-xs font-bold text-white shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              ENG
            </button>
          </div>

          {/* ( (yellow Abs, red x) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-0.5 text-[7px] font-bold">
              <span className="text-[#eab308]">Abs</span>
            </div>
            <button
              onClick={() => insertChar(isShift ? 'abs(' : '(')}
              className="w-full py-1.5 rounded-lg bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-xs font-bold text-white shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              (
            </button>
          </div>

          {/* ) (yellow ,, red y) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-0.5 text-[7px] font-bold">
              <span className="text-[#eab308]">,</span>
            </div>
            <button
              onClick={() => insertChar(')')}
              className="w-full py-1.5 rounded-lg bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-xs font-bold text-white shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              )
            </button>
          </div>

          {/* S<=>D (yellow a b/c <=> d/c) */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] font-bold text-[#eab308]">a b/c⇔d/c</span>
            <button
              onClick={toggleFraction}
              className="w-full py-1.5 rounded-lg bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#eab308]/60 text-xs font-black text-[#eab308] shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              S⇔D
            </button>
          </div>

          {/* M+ (yellow M-, red M) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-0.5 text-[7px] font-bold">
              <span className="text-[#eab308]">M-</span>
              <span className="text-[#f43f5e]">M</span>
            </div>
            <button
              onClick={() => {
                const val = parseFloat(displayResult) || 0;
                setMemoryM((m) => m + val);
                playClick();
              }}
              className="w-full py-1.5 rounded-lg bg-gradient-to-b from-[#2a303c] to-[#1c222a] border border-[#3f4756] hover:border-slate-400 text-xs font-bold text-white shadow-sm active:translate-y-0.5 cursor-pointer"
            >
              M+
            </button>
          </div>
        </div>

        {/* ================= LOWER NUMERIC & OPERATOR KEYPAD ================= */}
        
        {/* ROW 6: 7, 8, 9 (White), DEL, AC (Vivid Blue) */}
        <div className="mt-2.5 grid grid-cols-5 gap-1.5 px-1">
          {/* 7 (yellow CONST) */}
          <div className="flex flex-col items-center">
            <span className="text-[8px] font-bold text-[#eab308]">CONST</span>
            <button
              onClick={() => insertChar('7')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#ffffff] via-[#f8fafc] to-[#e2e8f0] border-2 border-[#cbd5e1] text-slate-950 font-mono font-black text-lg shadow-[0_3px_0_#94a3b8] active:translate-y-1 active:shadow-none cursor-pointer"
            >
              7
            </button>
          </div>

          {/* 8 (yellow CONV) */}
          <div className="flex flex-col items-center">
            <span className="text-[8px] font-bold text-[#eab308]">CONV</span>
            <button
              onClick={() => insertChar('8')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#ffffff] via-[#f8fafc] to-[#e2e8f0] border-2 border-[#cbd5e1] text-slate-950 font-mono font-black text-lg shadow-[0_3px_0_#94a3b8] active:translate-y-1 active:shadow-none cursor-pointer"
            >
              8
            </button>
          </div>

          {/* 9 (yellow RESET) */}
          <div className="flex flex-col items-center">
            <span className="text-[8px] font-bold text-[#eab308]">RESET</span>
            <button
              onClick={() => insertChar('9')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#ffffff] via-[#f8fafc] to-[#e2e8f0] border-2 border-[#cbd5e1] text-slate-950 font-mono font-black text-lg shadow-[0_3px_0_#94a3b8] active:translate-y-1 active:shadow-none cursor-pointer"
            >
              9
            </button>
          </div>

          {/* DEL (Royal Blue, yellow INS, red UNDO) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[8px] font-bold">
              <span className="text-[#eab308]">INS</span>
              <span className="text-[#f43f5e]">UNDO</span>
            </div>
            <button
              onClick={deleteLast}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#2563eb] via-[#1d4ed8] to-[#1e40af] border-2 border-[#60a5fa] text-white font-sans font-black text-sm shadow-[0_3px_0_#172554] active:translate-y-1 active:shadow-none cursor-pointer"
            >
              DEL
            </button>
          </div>

          {/* AC (Royal Blue, yellow OFF) */}
          <div className="flex flex-col items-center">
            <span className="text-[8px] font-bold text-[#eab308]">OFF</span>
            <button
              onClick={clearAll}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#2563eb] via-[#1d4ed8] to-[#1e40af] border-2 border-[#60a5fa] text-white font-sans font-black text-sm shadow-[0_3px_0_#172554] active:translate-y-1 active:shadow-none cursor-pointer"
            >
              AC
            </button>
          </div>
        </div>

        {/* ROW 7: 4, 5, 6 (White), ×, ÷ (Dark Charcoal) */}
        <div className="mt-1.5 grid grid-cols-5 gap-1.5 px-1">
          {/* 4 */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => insertChar('4')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#ffffff] via-[#f8fafc] to-[#e2e8f0] border-2 border-[#cbd5e1] text-slate-950 font-mono font-black text-lg shadow-[0_3px_0_#94a3b8] active:translate-y-1 active:shadow-none cursor-pointer"
            >
              4
            </button>
          </div>

          {/* 5 */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => insertChar('5')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#ffffff] via-[#f8fafc] to-[#e2e8f0] border-2 border-[#cbd5e1] text-slate-950 font-mono font-black text-lg shadow-[0_3px_0_#94a3b8] active:translate-y-1 active:shadow-none cursor-pointer"
            >
              5
            </button>
          </div>

          {/* 6 */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => insertChar('6')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#ffffff] via-[#f8fafc] to-[#e2e8f0] border-2 border-[#cbd5e1] text-slate-950 font-mono font-black text-lg shadow-[0_3px_0_#94a3b8] active:translate-y-1 active:shadow-none cursor-pointer"
            >
              6
            </button>
          </div>

          {/* × (yellow nPr, red GCD) */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => insertChar('×')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#2a303c] to-[#1c222a] border-2 border-[#3f4756] text-white font-mono font-black text-xl shadow-[0_3px_0_#0f172a] active:translate-y-1 active:shadow-none cursor-pointer"
            >
              ×
            </button>
          </div>

          {/* ÷ (yellow nCr, red LCM) */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => insertChar('÷')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#2a303c] to-[#1c222a] border-2 border-[#3f4756] text-white font-mono font-black text-xl shadow-[0_3px_0_#0f172a] active:translate-y-1 active:shadow-none cursor-pointer"
            >
              ÷
            </button>
          </div>
        </div>

        {/* ROW 8: 1, 2, 3 (White), +, - (Dark Charcoal) */}
        <div className="mt-1.5 grid grid-cols-5 gap-1.5 px-1">
          {/* 1 */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => insertChar('1')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#ffffff] via-[#f8fafc] to-[#e2e8f0] border-2 border-[#cbd5e1] text-slate-950 font-mono font-black text-lg shadow-[0_3px_0_#94a3b8] active:translate-y-1 active:shadow-none cursor-pointer"
            >
              1
            </button>
          </div>

          {/* 2 */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => insertChar('2')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#ffffff] via-[#f8fafc] to-[#e2e8f0] border-2 border-[#cbd5e1] text-slate-950 font-mono font-black text-lg shadow-[0_3px_0_#94a3b8] active:translate-y-1 active:shadow-none cursor-pointer"
            >
              2
            </button>
          </div>

          {/* 3 */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => insertChar('3')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#ffffff] via-[#f8fafc] to-[#e2e8f0] border-2 border-[#cbd5e1] text-slate-950 font-mono font-black text-lg shadow-[0_3px_0_#94a3b8] active:translate-y-1 active:shadow-none cursor-pointer"
            >
              3
            </button>
          </div>

          {/* + (yellow Pol, red Int) */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => insertChar('+')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#2a303c] to-[#1c222a] border-2 border-[#3f4756] text-white font-mono font-black text-xl shadow-[0_3px_0_#0f172a] active:translate-y-1 active:shadow-none cursor-pointer"
            >
              +
            </button>
          </div>

          {/* - (yellow Rec, red Intg) */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => insertChar('-')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#2a303c] to-[#1c222a] border-2 border-[#3f4756] text-white font-mono font-black text-xl shadow-[0_3px_0_#0f172a] active:translate-y-1 active:shadow-none cursor-pointer"
            >
              -
            </button>
          </div>
        </div>

        {/* ROW 9: 0, •, ×10^x, Ans, = (All Off-White keys) */}
        <div className="mt-1.5 grid grid-cols-5 gap-1.5 px-1">
          {/* 0 (yellow Rnd) */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => insertChar('0')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#ffffff] via-[#f8fafc] to-[#e2e8f0] border-2 border-[#cbd5e1] text-slate-950 font-mono font-black text-lg shadow-[0_3px_0_#94a3b8] active:translate-y-1 active:shadow-none cursor-pointer"
            >
              0
            </button>
          </div>

          {/* • (yellow Ran#, red RanInt) */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => insertChar('.')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#ffffff] via-[#f8fafc] to-[#e2e8f0] border-2 border-[#cbd5e1] text-slate-950 font-mono font-black text-xl shadow-[0_3px_0_#94a3b8] active:translate-y-1 active:shadow-none cursor-pointer"
            >
              •
            </button>
          </div>

          {/* ×10^x (yellow π, red e) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[8px] font-bold">
              <span className="text-[#eab308]">π</span>
              <span className="text-[#f43f5e]">e</span>
            </div>
            <button
              onClick={() => {
                if (isShift) insertChar('π');
                else if (isAlpha) insertChar('e');
                else insertChar('*10^');
              }}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#ffffff] via-[#f8fafc] to-[#e2e8f0] border-2 border-[#cbd5e1] text-slate-950 font-mono font-black text-xs shadow-[0_3px_0_#94a3b8] active:translate-y-1 active:shadow-none cursor-pointer"
              title="Nhân 10 mũ x (Shift: π, Alpha: e)"
            >
              ×10ⁿ
            </button>
          </div>

          {/* Ans (yellow %, red PreAns) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[8px] font-bold">
              <span className="text-[#eab308]">%</span>
            </div>
            <button
              onClick={() => insertChar(isShift ? '%' : 'Ans')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#ffffff] via-[#f8fafc] to-[#e2e8f0] border-2 border-[#cbd5e1] text-slate-950 font-mono font-black text-sm shadow-[0_3px_0_#94a3b8] active:translate-y-1 active:shadow-none cursor-pointer"
            >
              Ans
            </button>
          </div>

          {/* = (yellow ≈) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[8px] font-bold">
              <span className="text-[#eab308]">≈</span>
            </div>
            <button
              onClick={calculateComp}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#ffffff] via-[#f8fafc] to-[#e2e8f0] border-2 border-[#cbd5e1] text-slate-950 font-mono font-black text-xl shadow-[0_3px_0_#94a3b8] active:translate-y-1 active:shadow-none cursor-pointer"
            >
              =
            </button>
          </div>
        </div>

        {/* Bottom Status bar */}
        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
          <span>Hỗ trợ bàn phím thật: 0-9, +, -, *, /, Enter (=), Esc (AC)</span>
          <span className="font-bold text-slate-300">SmartBoard 75 Pro</span>
        </div>
      </div>
    </div>
  );
};
