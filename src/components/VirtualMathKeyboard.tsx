import React, { useState, useEffect, useRef } from 'react';
import { Calculator, X, TrendingUp, AlertCircle, Check, Delete, RotateCcw, Sparkles } from 'lucide-react';
import { compileMathExpression } from '../utils/mathExpressionParser';
import katex from 'katex';

interface VirtualMathKeyboardProps {
  initialFormula?: string;
  isOpen: boolean;
  onClose: () => void;
  onApply: (formula: string) => void;
  isEditing?: boolean;
}

export const VirtualMathKeyboard: React.FC<VirtualMathKeyboardProps> = ({
  initialFormula = 'y = 2x^3 - 3x + 1',
  isOpen,
  onClose,
  onApply,
  isEditing = false,
}) => {
  const [formulaInput, setFormulaInput] = useState<string>(initialFormula);
  const [activeTab, setActiveTab] = useState<'toan12' | 'vatly12' | 'coban'>('toan12');
  const inputRef = useRef<HTMLInputElement>(null);

  // Đồng bộ khi mở modal
  useEffect(() => {
    if (isOpen) {
      setFormulaInput(initialFormula || 'y = 2x^3 - 3x + 1');
    }
  }, [isOpen, initialFormula]);

  // Biên dịch toán học & KaTeX trực tiếp tức thì (<16ms), không trễ debounce gây giật nhảy
  const parsed = React.useMemo(() => {
    return compileMathExpression(formulaInput);
  }, [formulaInput]);

  const katexHtml = React.useMemo(() => {
    if (!parsed.latex) return null;
    try {
      return katex.renderToString(parsed.latex, {
        displayMode: true,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return null;
    }
  }, [parsed.latex]);

  if (!isOpen) return null;

  /**
   * Chèn ký hiệu hoặc số vào vị trí con trỏ
   * - onPointerDown e.preventDefault() ngăn chặn OS virtual keyboard giật nhảy màn hình trên TV 75"
   * - Hỗ trợ tự động đặt con trỏ vào giữa ngoặc (ví dụ: sin(|))
   */
  const insertSymbol = (sym: string, cursorOffset?: number) => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? formulaInput.length;
      const end = input.selectionEnd ?? formulaInput.length;
      const nextVal = formulaInput.substring(0, start) + sym + formulaInput.substring(end);
      setFormulaInput(nextVal);

      // Đặt vị trí con trỏ sau khi chèn
      const nextPos = cursorOffset !== undefined ? start + cursorOffset : start + sym.length;
      requestAnimationFrame(() => {
        if (inputRef.current) {
          try {
            inputRef.current.setSelectionRange(nextPos, nextPos);
          } catch (_) {}
        }
      });
    } else {
      setFormulaInput((prev) => prev + sym);
    }
  };

  /**
   * Xóa lùi 1 ký tự (Backspace)
   */
  const handleDeleteChar = () => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? formulaInput.length;
      const end = input.selectionEnd ?? formulaInput.length;
      if (start === end && start > 0) {
        const nextVal = formulaInput.substring(0, start - 1) + formulaInput.substring(end);
        setFormulaInput(nextVal);
        requestAnimationFrame(() => {
          if (inputRef.current) {
            try {
              inputRef.current.setSelectionRange(start - 1, start - 1);
            } catch (_) {}
          }
        });
      } else if (start !== end) {
        const nextVal = formulaInput.substring(0, start) + formulaInput.substring(end);
        setFormulaInput(nextVal);
        requestAnimationFrame(() => {
          if (inputRef.current) {
            try {
              inputRef.current.setSelectionRange(start, start);
            } catch (_) {}
          }
        });
      }
    } else {
      setFormulaInput((prev) => prev.slice(0, -1));
    }
  };

  /**
   * Xóa trắng toàn bộ
   */
  const handleClearAll = () => {
    setFormulaInput('');
    inputRef.current?.focus({ preventScroll: true });
  };

  // Mẫu công thức chuẩn SGK Toán 12
  const toan12Presets = [
    { label: 'Hàm bậc ba', val: 'y = 2x^3 - 3x + 1', desc: 'Cực đại, cực tiểu' },
    { label: 'Trùng phương 1', val: 'y = x^4 - 2x^2 - 1', desc: 'Đồ thị chữ W' },
    { label: 'Trùng phương 2', val: 'y = -x^4 + 2x^2 + 1', desc: 'Đồ thị chữ M' },
    { label: 'Nhất biến (Phân thức)', val: 'y = (2x+1)/(x-1)', desc: 'Tiệm cận đứng & ngang' },
    { label: 'Lượng giác sin', val: 'y = 2sin(2x)', desc: 'Tuần hoàn chu kỳ π' },
    { label: 'Lượng giác cos', val: 'y = 3cos(x - π/4)', desc: 'Pha ban đầu π/4' },
    { label: 'Căn thức', val: 'y = √(4 - x^2)', desc: 'Nửa đường tròn R=2' },
    { label: 'Mũ & Logarit', val: 'y = e^x - 2', desc: 'Hàm số mũ cơ số e' },
  ];

  // Mẫu công thức chuẩn SGK Vật lý 12
  const vatly12Presets = [
    { label: 'Dao động điều hòa ly độ x(t)', val: 'x = 4cos(2πt)', desc: 'A=4cm, ω=2π rad/s' },
    { label: 'Dao động lệch pha', val: 'x = 4cos(2πt - π/3)', desc: 'Pha ban đầu -π/3' },
    { label: 'Vận tốc dao động v(t)', val: 'v = -8π sin(2πt)', desc: 'Sớm pha π/2 so với x' },
    { label: 'Gia tốc dao động a(t)', val: 'a = -16π^2 cos(2πt)', desc: 'Ngược pha so với x' },
    { label: 'Dao động tắt dần', val: 'x = 4e^(-0.2t)cos(2πt)', desc: 'Biên độ giảm theo hàm mũ' },
    { label: 'Tổng hợp 2 dao động', val: 'x = 3cos(2πt) + 4sin(2πt)', desc: 'Hai dao động vuông pha' },
    { label: 'Parabol ném ngang', val: 'y = -0.049x^2 + 5', desc: 'Quỹ đạo rơi tự do' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-100">
      <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-4 sm:p-5 max-w-3xl w-full shadow-2xl text-white space-y-3.5 max-h-[95vh] overflow-y-auto custom-scrollbar">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm md:text-base text-white tracking-tight flex items-center gap-2">
                <span>{isEditing ? 'Chỉnh Sửa Đồ Thị Hàm Số' : 'Bàn Phím Nhập Đồ Thị & Dao Động 75 Pro'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hidden sm:inline">
                  Không trễ &bull; Chạm nhạy
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Nhập tự do &bull; Hỗ trợ SGK Toán 12, Vật lý 12, MathType, KaTeX
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Ô nhập công thức trực tiếp */}
        <div className="space-y-1.5">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={formulaInput}
              onChange={(e) => setFormulaInput(e.target.value)}
              placeholder="Nhập công thức (ví dụ: y = 2x^3 - 3x + 1 hoặc x = 4cos(2πt))"
              className="w-full px-4 py-3 rounded-2xl bg-slate-950 border-2 border-slate-700 text-white font-mono text-sm sm:text-base focus:border-amber-400 focus:outline-none pr-20 shadow-inner"
            />
            {formulaInput && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleDeleteChar();
                  }}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                  title="Xóa ký tự cuối"
                >
                  <Delete className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleClearAll();
                  }}
                  className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white cursor-pointer"
                  title="Xóa sạch"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Hàng thông báo trạng thái cố định chiều cao (h-7) - CHỐNG NHẢY GIAO DIỆN */}
          <div className="h-7 flex items-center justify-between px-1">
            <span className="text-[11px] text-slate-400 font-medium">
              Xem trước hiển thị công thức chuẩn KaTeX / MathType:
            </span>
            {parsed.error ? (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40 flex items-center gap-1 truncate max-w-[280px]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{parsed.error}</span>
              </span>
            ) : (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Chuẩn công thức &bull; Sẵn sàng vẽ</span>
              </span>
            )}
          </div>

          {/* Vùng hiển thị KaTeX cố định chiều cao (h-20) - TUYỆT ĐỐI KHÔNG BỊ CO GIÃN NHẢY MÀN HÌNH */}
          <div className="h-20 bg-slate-950/90 rounded-2xl px-4 py-2 flex items-center justify-center border border-white/10 text-white overflow-x-auto overflow-y-hidden custom-scrollbar shadow-inner">
            {katexHtml ? (
              <div
                className="text-lg md:text-xl text-amber-200 select-all"
                dangerouslySetInnerHTML={{ __html: katexHtml }}
              />
            ) : (
              <span className="text-sm font-mono text-slate-400">
                {parsed.displayFormula || formulaInput || 'y = f(x)'}
              </span>
            )}
          </div>
        </div>

        {/* BÀN PHÍM CẢM ỨNG ĐA NĂNG CHO MÀN HÌNH 75 INCH (SỐ, BIẾN, PHÉP TÍNH, HÀM SỐ) */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase text-slate-400 px-1">
            <span>Bàn phím cảm ứng thông minh (Chạm phản hồi tức thì 16ms):</span>
            <span className="text-[10px] text-amber-300/80 font-mono">Không giật &bull; Không trễ</span>
          </div>

          {/* Bố cục bàn phím 2 cột: Bên trái là Phím số + Biến + Phép tính; Bên phải là Hàm nâng cao */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            {/* Cột 1: Bàn phím số & Phép tính cơ bản (7 cột nhỏ) */}
            <div className="md:col-span-8 grid grid-cols-6 gap-1.5 font-mono text-sm font-bold">
              {/* Hàng 1 */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('7');
                }}
                className="p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white"
              >
                7
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('8');
                }}
                className="p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white"
              >
                8
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('9');
                }}
                className="p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white"
              >
                9
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol(' / ');
                }}
                className="p-3 rounded-xl bg-indigo-900/40 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-indigo-500/30 text-center active:scale-95 cursor-pointer text-indigo-300"
                title="Phép chia / Phân thức"
              >
                ÷
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('(');
                }}
                className="p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-amber-200"
              >
                (
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol(')');
                }}
                className="p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-amber-200"
              >
                )
              </button>

              {/* Hàng 2 */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('4');
                }}
                className="p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white"
              >
                4
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('5');
                }}
                className="p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white"
              >
                5
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('6');
                }}
                className="p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white"
              >
                6
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol(' * ');
                }}
                className="p-3 rounded-xl bg-indigo-900/40 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-indigo-500/30 text-center active:scale-95 cursor-pointer text-indigo-300"
                title="Phép nhân"
              >
                &times;
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('x');
                }}
                className="p-3 rounded-xl bg-teal-900/40 hover:bg-teal-500 hover:text-slate-950 text-teal-300 transition-colors border border-teal-500/40 text-center active:scale-95 cursor-pointer font-bold"
                title="Biến số x (Toán học)"
              >
                x
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('t');
                }}
                className="p-3 rounded-xl bg-teal-900/40 hover:bg-teal-500 hover:text-slate-950 text-teal-300 transition-colors border border-teal-500/40 text-center active:scale-95 cursor-pointer font-bold"
                title="Biến thời gian t (Vật lý)"
              >
                t
              </button>

              {/* Hàng 3 */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('1');
                }}
                className="p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white"
              >
                1
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('2');
                }}
                className="p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white"
              >
                2
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('3');
                }}
                className="p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white"
              >
                3
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol(' - ');
                }}
                className="p-3 rounded-xl bg-indigo-900/40 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-indigo-500/30 text-center active:scale-95 cursor-pointer text-indigo-300"
                title="Phép trừ"
              >
                -
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('^2');
                }}
                className="p-3 rounded-xl bg-emerald-900/40 hover:bg-emerald-500 hover:text-slate-950 text-emerald-300 transition-colors border border-emerald-500/40 text-center active:scale-95 cursor-pointer"
                title="Bình phương"
              >
                x²
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('^3');
                }}
                className="p-3 rounded-xl bg-emerald-900/40 hover:bg-emerald-500 hover:text-slate-950 text-emerald-300 transition-colors border border-emerald-500/40 text-center active:scale-95 cursor-pointer"
                title="Lập phương"
              >
                x³
              </button>

              {/* Hàng 4 */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('0');
                }}
                className="p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white"
              >
                0
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('.');
                }}
                className="p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white"
              >
                .
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol(' = ');
                }}
                className="p-3 rounded-xl bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-300 transition-colors border border-amber-500/40 text-center active:scale-95 cursor-pointer font-bold"
              >
                =
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol(' + ');
                }}
                className="p-3 rounded-xl bg-indigo-900/40 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-indigo-500/30 text-center active:scale-95 cursor-pointer text-indigo-300"
                title="Phép cộng"
              >
                +
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('^');
                }}
                className="p-3 rounded-xl bg-emerald-900/40 hover:bg-emerald-500 hover:text-slate-950 text-emerald-300 transition-colors border border-emerald-500/40 text-center active:scale-95 cursor-pointer"
                title="Số mũ lũy thừa"
              >
                ^
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('√()', 2);
                }}
                className="p-3 rounded-xl bg-purple-900/40 hover:bg-purple-500 hover:text-slate-950 text-purple-300 transition-colors border border-purple-500/40 text-center active:scale-95 cursor-pointer"
                title="Căn bậc hai"
              >
                &radic;
              </button>
            </div>

            {/* Cột 2: Hàm lượng giác, Mũ, Logarit, Hằng số (4 cột nhỏ) */}
            <div className="md:col-span-4 grid grid-cols-3 gap-1.5 font-mono text-xs font-bold">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('sin()', 4);
                }}
                className="p-3 rounded-xl bg-slate-800/90 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 transition-colors border border-cyan-500/30 text-center active:scale-95 cursor-pointer"
              >
                sin
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('cos()', 4);
                }}
                className="p-3 rounded-xl bg-slate-800/90 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 transition-colors border border-cyan-500/30 text-center active:scale-95 cursor-pointer"
              >
                cos
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('tan()', 4);
                }}
                className="p-3 rounded-xl bg-slate-800/90 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 transition-colors border border-cyan-500/30 text-center active:scale-95 cursor-pointer"
              >
                tan
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('cot()', 4);
                }}
                className="p-3 rounded-xl bg-slate-800/90 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 transition-colors border border-cyan-500/30 text-center active:scale-95 cursor-pointer"
              >
                cot
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('ln()', 3);
                }}
                className="p-3 rounded-xl bg-slate-800/90 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 transition-colors border border-cyan-500/30 text-center active:scale-95 cursor-pointer"
              >
                ln
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('e^()', 3);
                }}
                className="p-3 rounded-xl bg-slate-800/90 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 transition-colors border border-cyan-500/30 text-center active:scale-95 cursor-pointer"
              >
                eˣ
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('π');
                }}
                className="p-3 rounded-xl bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-300 transition-colors border border-amber-500/40 text-center active:scale-95 cursor-pointer font-serif text-sm font-bold"
                title="Số Pi (π ≈ 3.14159)"
              >
                &pi;
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('abs()', 4);
                }}
                className="p-3 rounded-xl bg-slate-800/90 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 transition-colors border border-cyan-500/30 text-center active:scale-95 cursor-pointer"
                title="Trị tuyệt đối"
              >
                |x|
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleDeleteChar();
                }}
                className="p-3 rounded-xl bg-rose-500/25 hover:bg-rose-500 text-rose-300 hover:text-white transition-colors border border-rose-500/40 text-center active:scale-95 cursor-pointer flex items-center justify-center font-sans font-bold"
                title="Xóa lùi"
              >
                &larr; Xóa
              </button>

              {/* Nút Xóa hết & Nút Trợ giúp */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleClearAll();
                }}
                className="col-span-3 p-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-600 text-rose-300 hover:text-white transition-colors border border-rose-500/30 text-center active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 font-sans font-bold text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xóa Toàn Bộ Công Thức</span>
              </button>
            </div>
          </div>
        </div>

        {/* THƯ VIỆN CÔNG THỨC SGK 1-CHẠM TIỆN LỢI (PHÂN LOẠI TOÁN 12 & VẬT LÝ 12) */}
        <div className="space-y-2 pt-1 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Mẫu đồ thị 1-chạm chuẩn SGK:</span>
            </span>

            {/* Tab chuyển đổi Toán 12 vs Vật lý 12 */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-white/10 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('toan12')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'toan12'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Toán 12
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('vatly12')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'vatly12'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Vật Lý 12
              </button>
            </div>
          </div>

          {/* Danh sách nút mẫu hàm số */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {(activeTab === 'toan12' ? toan12Presets : vatly12Presets).map((preset) => (
              <button
                key={preset.label}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setFormulaInput(preset.val);
                }}
                className="px-2.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 hover:border-amber-400 text-left transition-all active:scale-95 cursor-pointer group"
              >
                <div className="text-[11px] font-bold text-amber-300 group-hover:text-amber-200 truncate">
                  {preset.label}
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5 opacity-90">
                  {preset.val}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={() => {
              if (formulaInput.trim()) {
                onApply(formulaInput);
              }
            }}
            disabled={!!parsed.error}
            className={`px-6 py-2.5 rounded-2xl font-black text-xs md:text-sm shadow-xl flex items-center gap-2 transition-all cursor-pointer ${
              parsed.error
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/25 active:scale-95 ring-2 ring-amber-400/40'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>{isEditing ? 'Cập Nhật Đồ Thị' : 'Vẽ Đồ Thị Lên Bảng Xanh'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
