import React, { useState, useEffect, useRef } from 'react';
import { Calculator, X, TrendingUp, AlertCircle, Check, Delete, RotateCcw, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
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
  initialFormula = 'y = 2x^3-3x+1',
  isOpen,
  onClose,
  onApply,
  isEditing = false,
}) => {
  // Chuẩn hóa initialFormula để các số hạng đứng liền nhau như máy tính Casio fx-580
  const normalizedInitial = (initialFormula || 'y = 2x^3-3x+1')
    .replace(/\s*([+\-*/=])\s*/g, '$1')
    .replace(/^(y|x|f\(x\)|x\(t\))=/, '$1 = ');

  const [formulaInput, setFormulaInput] = useState<string>(normalizedInitial);
  const [activeTab, setActiveTab] = useState<'toan12' | 'vatly12' | 'casio'>('toan12');
  const inputRef = useRef<HTMLInputElement>(null);

  // Đồng bộ khi mở modal
  useEffect(() => {
    if (isOpen) {
      const norm = (initialFormula || 'y = 2x^3-3x+1')
        .replace(/\s*([+\-*/=])\s*/g, '$1')
        .replace(/^(y|x|f\(x\)|x\(t\))=/, '$1 = ');
      setFormulaInput(norm);
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
   * Chèn ký hiệu hoặc số vào vị trí con trỏ (không thêm khoảng cách thừa, các số hạng đứng liền nhau)
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
   * Phím phân số chuẩn Casio fx-580VN Plus [ ■/□ ]:
   * - Nếu đang quét chọn chuỗi: biến chuỗi đó thành tử số: (selected)/( ) và đưa con trỏ vào mẫu số
   * - Nếu không quét chọn: chèn ( )/( ) và đặt con trỏ vào tử số để nhập ngay
   */
  const handleInsertFractionCasio = () => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? formulaInput.length;
      const end = input.selectionEnd ?? formulaInput.length;
      const selected = formulaInput.substring(start, end).trim();

      if (selected.length > 0) {
        const replacement = `(${selected})/()`;
        const nextVal = formulaInput.substring(0, start) + replacement + formulaInput.substring(end);
        setFormulaInput(nextVal);
        // Con trỏ nằm trong mẫu số
        const nextPos = start + selected.length + 4;
        requestAnimationFrame(() => {
          if (inputRef.current) {
            try {
              inputRef.current.setSelectionRange(nextPos, nextPos);
            } catch (_) {}
          }
        });
      } else {
        const replacement = '()/()';
        const nextVal = formulaInput.substring(0, start) + replacement + formulaInput.substring(end);
        setFormulaInput(nextVal);
        // Con trỏ nằm trong tử số: (|)/()
        const nextPos = start + 1;
        requestAnimationFrame(() => {
          if (inputRef.current) {
            try {
              inputRef.current.setSelectionRange(nextPos, nextPos);
            } catch (_) {}
          }
        });
      }
    } else {
      setFormulaInput((prev) => prev + '()/()');
    }
  };

  /**
   * Phím căn bậc hai chuẩn Casio fx-580VN Plus [ √(■) ]:
   * - Nếu đang quét chọn: bọc vào trong căn: √(selected)
   * - Nếu không quét chọn: chèn √( ) và đưa con trỏ vào trong căn
   */
  const handleInsertSqrtCasio = () => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? formulaInput.length;
      const end = input.selectionEnd ?? formulaInput.length;
      const selected = formulaInput.substring(start, end).trim();

      if (selected.length > 0) {
        const replacement = `√(${selected})`;
        const nextVal = formulaInput.substring(0, start) + replacement + formulaInput.substring(end);
        setFormulaInput(nextVal);
        const nextPos = start + replacement.length;
        requestAnimationFrame(() => {
          if (inputRef.current) {
            try {
              inputRef.current.setSelectionRange(nextPos, nextPos);
            } catch (_) {}
          }
        });
      } else {
        const replacement = '√()';
        const nextVal = formulaInput.substring(0, start) + replacement + formulaInput.substring(end);
        setFormulaInput(nextVal);
        // Con trỏ nằm trong căn: √(|)
        const nextPos = start + 2;
        requestAnimationFrame(() => {
          if (inputRef.current) {
            try {
              inputRef.current.setSelectionRange(nextPos, nextPos);
            } catch (_) {}
          }
        });
      }
    } else {
      setFormulaInput((prev) => prev + '√()');
    }
  };

  /**
   * Phím căn bậc 3 chuẩn Casio [ ∛(■) ]
   */
  const handleInsertCbrtCasio = () => {
    insertSymbol('∛()', 2);
  };

  /**
   * Phím lũy thừa bất kỳ chuẩn Casio [ x^■ ]:
   */
  const handleInsertPowerCasio = () => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? formulaInput.length;
      const end = input.selectionEnd ?? formulaInput.length;
      const selected = formulaInput.substring(start, end).trim();
      if (selected.length > 0) {
        insertSymbol(`^(${selected})`, selected.length + 3);
      } else {
        insertSymbol('^()', 2);
      }
    } else {
      insertSymbol('^');
    }
  };

  /**
   * Điều hướng con trỏ sang trái 1 bước (Casio D-Pad Left)
   */
  const handleMoveCursorLeft = () => {
    const input = inputRef.current;
    if (input) {
      const pos = Math.max(0, (input.selectionStart ?? formulaInput.length) - 1);
      input.setSelectionRange(pos, pos);
      input.focus({ preventScroll: true });
    }
  };

  /**
   * Điều hướng con trỏ sang phải 1 bước (Casio D-Pad Right)
   */
  const handleMoveCursorRight = () => {
    const input = inputRef.current;
    if (input) {
      const pos = Math.min(formulaInput.length, (input.selectionEnd ?? 0) + 1);
      input.setSelectionRange(pos, pos);
      input.focus({ preventScroll: true });
    }
  };

  /**
   * Điều hướng con trỏ lên trên / vào tử số (Casio D-Pad Up [ ▲ ])
   */
  const handleMoveCursorUp = () => {
    const input = inputRef.current;
    if (input) {
      const cur = input.selectionStart ?? 0;
      const slashIdx = formulaInput.lastIndexOf('/', cur);
      if (slashIdx !== -1) {
        const openParen = formulaInput.lastIndexOf('(', slashIdx);
        const targetPos = openParen !== -1 ? openParen + 1 : Math.max(0, slashIdx - 1);
        input.setSelectionRange(targetPos, targetPos);
        input.focus({ preventScroll: true });
        return;
      }
      input.setSelectionRange(0, 0);
      input.focus({ preventScroll: true });
    }
  };

  /**
   * Điều hướng con trỏ xuống dưới / vào mẫu số (Casio D-Pad Down [ ▼ ])
   */
  const handleMoveCursorDown = () => {
    const input = inputRef.current;
    if (input) {
      const cur = input.selectionStart ?? 0;
      const slashIdx = formulaInput.indexOf('/', cur);
      if (slashIdx !== -1) {
        const targetPos = slashIdx + (formulaInput[slashIdx + 1] === '(' ? 2 : 1);
        input.setSelectionRange(targetPos, targetPos);
        input.focus({ preventScroll: true });
        return;
      }
      input.setSelectionRange(formulaInput.length, formulaInput.length);
      input.focus({ preventScroll: true });
    }
  };

  /**
   * Xóa lùi 1 ký tự (Casio DEL)
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
   * Xóa trắng toàn bộ (Casio AC - All Clear)
   */
  const handleClearAll = () => {
    setFormulaInput('');
    inputRef.current?.focus({ preventScroll: true });
  };

  // Mẫu công thức chuẩn SGK Toán 12 (Số hạng viết liền chuẩn Casio)
  const toan12Presets = [
    { label: 'Hàm bậc ba', val: 'y = 2x^3-3x+1', desc: '2x³-3x+1' },
    { label: 'Trùng phương chữ W', val: 'y = x^4-2x^2-1', desc: 'x⁴-2x²-1' },
    { label: 'Trùng phương chữ M', val: 'y = -x^4+2x^2+1', desc: '-x⁴+2x²+1' },
    { label: 'Nhất biến (Phân thức)', val: 'y = (2x+1)/(x-1)', desc: '(2x+1)/(x-1)' },
    { label: 'Lượng giác sin', val: 'y = 2sin(2x)', desc: '2sin(2x)' },
    { label: 'Lượng giác cos', val: 'y = 3cos(x-π/4)', desc: '3cos(x-π/4)' },
    { label: 'Căn thức nửa tròn', val: 'y = √(4-x^2)', desc: '√(4-x²)' },
    { label: 'Hàm số mũ eˣ', val: 'y = e^x-2', desc: 'eˣ-2' },
  ];

  // Mẫu công thức chuẩn SGK Vật lý 12 (Dao động & Sóng)
  const vatly12Presets = [
    { label: 'Dao động điều hòa', val: 'x = 4cos(2πt)', desc: '4cos(2πt)' },
    { label: 'Dao động lệch pha', val: 'x = 4cos(2πt-π/3)', desc: '4cos(2πt-π/3)' },
    { label: 'Vận tốc dao động v(t)', val: 'v = -8π*sin(2πt)', desc: '-8π·sin(2πt)' },
    { label: 'Gia tốc dao động a(t)', val: 'a = -16π^2*cos(2πt)', desc: '-16π²·cos(2πt)' },
    { label: 'Dao động tắt dần', val: 'x = 4e^(-0.2t)cos(2πt)', desc: '4e^(-0.2t)·cos(2πt)' },
    { label: 'Tổng hợp 2 dao động', val: 'x = 3cos(2πt)+4sin(2πt)', desc: '3cos(2πt)+4sin(2πt)' },
    { label: 'Parabol ném ngang', val: 'y = -0.049x^2+5', desc: '-0.049x²+5' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 select-none animate-in fade-in duration-100">
      <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-3.5 sm:p-5 max-w-3xl w-full shadow-2xl text-white space-y-3 max-h-[96vh] overflow-y-auto custom-scrollbar">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/40">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm md:text-base text-white tracking-tight flex items-center gap-2">
                <span>Bàn Phím Toán Học & Phân Số Casio fx-580VN Plus</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hidden sm:inline font-mono">
                  Casio fx-580 Mode
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Bấm phân số [■/□], căn bậc hai [√■], số mũ liền nhau không cần phím cách
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Ô nhập công thức trực tiếp (Các số hạng đứng liền nhau) */}
        <div className="space-y-1">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={formulaInput}
              onChange={(e) => setFormulaInput(e.target.value)}
              placeholder="Nhập công thức (ví dụ: y = 2x^3-3x+1 hoặc y = (2x+1)/(x-1))"
              className="w-full px-4 py-2.5 rounded-2xl bg-slate-950 border-2 border-slate-700 text-white font-mono text-sm sm:text-base focus:border-amber-400 focus:outline-none pr-20 shadow-inner"
            />
            {formulaInput && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleDeleteChar();
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs cursor-pointer"
                  title="Xóa lùi 1 ký tự (DEL)"
                >
                  DEL
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleClearAll();
                  }}
                  className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-xs cursor-pointer"
                  title="Xóa hết (AC)"
                >
                  AC
                </button>
              </div>
            )}
          </div>

          {/* Hàng thông báo trạng thái cố định chiều cao (h-6) */}
          <div className="h-6 flex items-center justify-between px-1">
            <span className="text-[11px] text-slate-400 font-medium">
              Hiển thị phân số & căn thức trực quan KaTeX:
            </span>
            {parsed.error ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40 flex items-center gap-1 truncate max-w-[280px]">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span className="truncate">{parsed.error}</span>
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>Chuẩn Casio &bull; Sẵn sàng vẽ</span>
              </span>
            )}
          </div>

          {/* Vùng hiển thị KaTeX cố định chiều cao (h-22) - Màn hình Casio Natural Display không bao giờ nhảy */}
          <div className="h-22 min-h-[88px] max-h-[88px] bg-slate-950/95 rounded-2xl px-4 py-2 flex items-center justify-center border-2 border-emerald-500/40 text-white overflow-x-auto overflow-y-hidden shadow-inner relative select-all [&_.katex-display]:my-0 [&_.katex-display]:py-0 [&_.katex]:text-xl sm:[&_.katex]:text-2xl">
            <div className="absolute top-1.5 left-3 text-[9px] font-mono uppercase text-emerald-400/80 tracking-widest pointer-events-none">
              MÀN HÌNH TỰ NHIÊN CASIO FX-580VN PLUS
            </div>
            {katexHtml ? (
              <div
                className="text-amber-200 pt-2"
                dangerouslySetInnerHTML={{ __html: katexHtml }}
              />
            ) : (
              <span className="text-sm font-mono text-slate-400 pt-2">
                {parsed.displayFormula || formulaInput || 'y = f(x)'}
              </span>
            )}
          </div>
        </div>

        {/* BÀN PHÍM CẢM ỨNG ĐA NĂNG CHUẨN CASIO FX-580VN PLUS CHO MÀN HÌNH 75 INCH */}
        <div className="space-y-1.5 pt-1">
          {/* HÀNG PHÍM ĐẶC TRƯNG CASIO FX-580: PHÂN SỐ, CĂN BẬC HAI, CĂN BẬC BA, LŨY THỪA, ĐIỀU HƯỚNG CON TRỎ 4 CHIỀU */}
          <div className="p-2 rounded-2xl bg-slate-950/80 border border-amber-500/30 shadow-md">
            <div className="flex items-center justify-between text-[10px] font-black uppercase text-amber-400 mb-1.5 px-1 tracking-wider">
              <span>Phím phân số, căn thức & phím điều hướng con trỏ Replay Casio fx-580:</span>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 font-mono text-xs font-bold">
              {/* 1. Phím Phân Số [ ■/□ ] */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleInsertFractionCasio();
                }}
                className="p-2 rounded-xl bg-gradient-to-b from-amber-500/25 to-amber-600/30 hover:bg-amber-500 hover:text-slate-950 text-amber-300 transition-all border-2 border-amber-400/70 text-center active:scale-95 cursor-pointer shadow-md flex flex-col items-center justify-center gap-0.5"
                title="Phím phân số (■/□) kiểu Casio fx-580"
              >
                <div className="flex flex-col items-center leading-none">
                  <span className="w-3.5 h-2 border border-current rounded-xs mb-0.5 inline-block" />
                  <span className="w-4 h-[1.5px] bg-current inline-block my-0.5" />
                  <span className="w-3.5 h-2 border border-current rounded-xs mt-0.5 inline-block" />
                </div>
                <span className="text-[9px] font-sans">Phân số</span>
              </button>

              {/* 2. Phím Căn Bậc Hai [ √(■) ] */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleInsertSqrtCasio();
                }}
                className="p-2 rounded-xl bg-gradient-to-b from-purple-500/25 to-purple-600/30 hover:bg-purple-500 hover:text-slate-950 text-purple-300 transition-all border-2 border-purple-400/70 text-center active:scale-95 cursor-pointer shadow-md flex flex-col items-center justify-center"
                title="Phím căn bậc hai √(■) kiểu Casio"
              >
                <span className="text-base leading-none">&radic;■</span>
                <span className="text-[9px] font-sans mt-0.5">Căn bậc 2</span>
              </button>

              {/* 3. Phím Căn Bậc Ba [ ∛(■) ] */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleInsertCbrtCasio();
                }}
                className="p-2 rounded-xl bg-purple-900/30 hover:bg-purple-500 hover:text-slate-950 text-purple-300 transition-colors border border-purple-500/40 text-center active:scale-95 cursor-pointer flex flex-col items-center justify-center"
                title="Phím căn bậc ba ∛(■)"
              >
                <span className="text-base leading-none">&#8731;■</span>
                <span className="text-[9px] font-sans mt-0.5">Căn bậc 3</span>
              </button>

              {/* 4. Phím Lũy Thừa [ x^■ ] */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleInsertPowerCasio();
                }}
                className="p-2 rounded-xl bg-emerald-900/40 hover:bg-emerald-500 hover:text-slate-950 text-emerald-300 transition-colors border border-emerald-500/40 text-center active:scale-95 cursor-pointer flex flex-col items-center justify-center"
                title="Phím số mũ bất kỳ x^■ kiểu Casio"
              >
                <span className="text-sm leading-none">x<sup>■</sup></span>
                <span className="text-[9px] font-sans mt-0.5">Số mũ</span>
              </button>

              {/* 5. Phím Bình Phương [ x² ] */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('^2');
                }}
                className="p-2 rounded-xl bg-emerald-900/40 hover:bg-emerald-500 hover:text-slate-950 text-emerald-300 transition-colors border border-emerald-500/40 text-center active:scale-95 cursor-pointer flex flex-col items-center justify-center"
                title="Bình phương x²"
              >
                <span className="text-sm leading-none">x²</span>
                <span className="text-[9px] font-sans mt-0.5">Mũ 2</span>
              </button>

              {/* 6. Phím Lập Phương [ x³ ] */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('^3');
                }}
                className="p-2 rounded-xl bg-emerald-900/40 hover:bg-emerald-500 hover:text-slate-950 text-emerald-300 transition-colors border border-emerald-500/40 text-center active:scale-95 cursor-pointer flex flex-col items-center justify-center"
                title="Lập phương x³"
              >
                <span className="text-sm leading-none">x³</span>
                <span className="text-[9px] font-sans mt-0.5">Mũ 3</span>
              </button>

              {/* 7. Phím D-Pad Con Trỏ Trái [ ◄ ] */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleMoveCursorLeft();
                }}
                className="p-2 rounded-xl bg-cyan-900/40 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 transition-all border border-cyan-500/50 text-center active:scale-95 cursor-pointer flex flex-col items-center justify-center shadow-md"
                title="Lùi con trỏ sang trái 1 ký tự"
              >
                <span className="text-sm leading-none">◄</span>
                <span className="text-[9px] font-sans mt-0.5">Trái</span>
              </button>

              {/* 8. Phím D-Pad Lên [ ▲ Tử số ] */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleMoveCursorUp();
                }}
                className="p-2 rounded-xl bg-cyan-900/40 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 transition-all border border-cyan-500/50 text-center active:scale-95 cursor-pointer flex flex-col items-center justify-center shadow-md"
                title="Nhảy con trỏ lên tử số của phân số"
              >
                <span className="text-sm leading-none">▲</span>
                <span className="text-[9px] font-sans mt-0.5">Lên (Tử)</span>
              </button>

              {/* 9. Phím D-Pad Xuống [ ▼ Mẫu số ] */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleMoveCursorDown();
                }}
                className="p-2 rounded-xl bg-cyan-900/40 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 transition-all border border-cyan-500/50 text-center active:scale-95 cursor-pointer flex flex-col items-center justify-center shadow-md"
                title="Nhảy con trỏ xuống mẫu số của phân số"
              >
                <span className="text-sm leading-none">▼</span>
                <span className="text-[9px] font-sans mt-0.5">Xuống (Mẫu)</span>
              </button>

              {/* 10. Phím D-Pad Con Trỏ Phải [ ► ] */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleMoveCursorRight();
                }}
                className="p-2 rounded-xl bg-cyan-900/40 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 transition-all border border-cyan-500/50 text-center active:scale-95 cursor-pointer flex flex-col items-center justify-center shadow-md"
                title="Tiến con trỏ sang phải 1 ký tự (nhảy ra khỏi phân số)"
              >
                <span className="text-sm leading-none">►</span>
                <span className="text-[9px] font-sans mt-0.5">Phải</span>
              </button>
            </div>
          </div>

          {/* BÀN PHÍM SỐ VÀ CÁC PHÉP TOÁN KHÔNG KHOẢNG TRẮNG (SỐ HẠNG ĐỨNG SÁT NHAU) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            {/* Cột 1: Phím số 0-9 & Phép tính liền nhau (8 cột nhỏ trên Desktop) */}
            <div className="md:col-span-8 grid grid-cols-6 gap-1.5 font-mono text-sm font-bold">
              {/* Hàng 1: 7, 8, 9, ÷, (, ) */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('7');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white text-base"
              >
                7
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('8');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white text-base"
              >
                8
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('9');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white text-base"
              >
                9
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('/');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-indigo-900/40 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-indigo-500/30 text-center active:scale-95 cursor-pointer text-indigo-300 text-base font-bold"
                title="Dấu chia /"
              >
                ÷
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('(');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-amber-200 text-base"
              >
                (
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol(')');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-amber-200 text-base"
              >
                )
              </button>

              {/* Hàng 2: 4, 5, 6, ×, x, t */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('4');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white text-base"
              >
                4
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('5');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white text-base"
              >
                5
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('6');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white text-base"
              >
                6
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('*');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-indigo-900/40 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-indigo-500/30 text-center active:scale-95 cursor-pointer text-indigo-300 text-base font-bold"
                title="Dấu nhân *"
              >
                &times;
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('x');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-teal-900/40 hover:bg-teal-500 hover:text-slate-950 text-teal-300 transition-colors border border-teal-500/40 text-center active:scale-95 cursor-pointer font-bold text-base"
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
                className="p-2.5 sm:p-3 rounded-xl bg-teal-900/40 hover:bg-teal-500 hover:text-slate-950 text-teal-300 transition-colors border border-teal-500/40 text-center active:scale-95 cursor-pointer font-bold text-base"
                title="Biến thời gian t (Vật lý)"
              >
                t
              </button>

              {/* Hàng 3: 1, 2, 3, -, π, e */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('1');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white text-base"
              >
                1
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('2');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white text-base"
              >
                2
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('3');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white text-base"
              >
                3
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('-');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-indigo-900/40 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-indigo-500/30 text-center active:scale-95 cursor-pointer text-indigo-300 text-base font-bold"
                title="Dấu trừ (số hạng liền kề không cách)"
              >
                -
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('π');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-300 transition-colors border border-amber-500/40 text-center active:scale-95 cursor-pointer font-serif text-base font-bold"
                title="Số Pi (π ≈ 3.14159)"
              >
                &pi;
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('e');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-200 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-base"
                title="Cơ số tự nhiên e"
              >
                e
              </button>

              {/* Hàng 4: 0, ., =, +, DEL, AC */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('0');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white text-base"
              >
                0
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('.');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-95 cursor-pointer text-white text-base"
              >
                .
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('=');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-300 transition-colors border border-amber-500/40 text-center active:scale-95 cursor-pointer font-bold text-base"
              >
                =
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('+');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-indigo-900/40 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-indigo-500/30 text-center active:scale-95 cursor-pointer text-indigo-300 text-base font-bold"
                title="Dấu cộng (số hạng liền kề không cách)"
              >
                +
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleDeleteChar();
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-rose-500/25 hover:bg-rose-500 text-rose-300 hover:text-white transition-colors border border-rose-500/40 text-center active:scale-95 cursor-pointer font-sans font-bold text-xs"
                title="Xóa lùi 1 ký tự (Casio DEL)"
              >
                DEL
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleClearAll();
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-colors border border-rose-400 text-center active:scale-95 cursor-pointer font-sans font-bold text-xs shadow-md"
                title="Xóa toàn bộ công thức (Casio AC)"
              >
                AC
              </button>
            </div>

            {/* Cột 2: Hàm lượng giác, Mũ, Logarit, Trị tuyệt đối (4 cột nhỏ trên Desktop) */}
            <div className="md:col-span-4 grid grid-cols-2 gap-1.5 font-mono text-xs font-bold">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('sin()', 4);
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800/90 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 transition-colors border border-cyan-500/30 text-center active:scale-95 cursor-pointer"
              >
                sin( )
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('cos()', 4);
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800/90 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 transition-colors border border-cyan-500/30 text-center active:scale-95 cursor-pointer"
              >
                cos( )
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('tan()', 4);
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800/90 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 transition-colors border border-cyan-500/30 text-center active:scale-95 cursor-pointer"
              >
                tan( )
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('cot()', 4);
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800/90 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 transition-colors border border-cyan-500/30 text-center active:scale-95 cursor-pointer"
              >
                cot( )
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('ln()', 3);
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800/90 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 transition-colors border border-cyan-500/30 text-center active:scale-95 cursor-pointer"
              >
                ln( )
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('e^()', 3);
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800/90 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 transition-colors border border-cyan-500/30 text-center active:scale-95 cursor-pointer"
              >
                e<sup>( )</sup>
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('abs()', 4);
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800/90 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 transition-colors border border-cyan-500/30 text-center active:scale-95 cursor-pointer"
                title="Trị tuyệt đối"
              >
                |x|
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertSymbol('(-)');
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800/90 hover:bg-amber-500 hover:text-slate-950 text-amber-200 transition-colors border border-amber-500/30 text-center active:scale-95 cursor-pointer font-bold"
                title="Dấu âm của số (-)"
              >
                (-)
              </button>
            </div>
          </div>
        </div>

        {/* THƯ VIỆN CÔNG THỨC SGK 1-CHẠM TIỆN LỢI (CÔNG THỨC VIẾT LIỀN CHUẨN CASIO) */}
        <div className="space-y-1.5 pt-1 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Mẫu đồ thị 1-chạm chuẩn SGK (Số hạng liền nhau):</span>
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
                className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 hover:border-amber-400 text-left transition-all active:scale-95 cursor-pointer group"
              >
                <div className="text-[11px] font-bold text-amber-300 group-hover:text-amber-200 truncate">
                  {preset.label}
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate opacity-90">
                  {preset.val}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-white/10">
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
