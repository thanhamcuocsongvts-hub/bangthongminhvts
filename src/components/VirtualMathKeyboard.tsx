import React, { useState, useEffect, useRef, useDeferredValue } from 'react';
import { Calculator, X, TrendingUp, AlertCircle, Check } from 'lucide-react';
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
  // 1. Trạng thái chuỗi ký tự thô: Phản hồi gõ phím ngay lập tức (<16ms)
  const [formulaInput, setFormulaInput] = useState<string>(initialFormula);
  const inputRef = useRef<HTMLInputElement>(null);

  // Đồng bộ khi mở modal hoặc thay đổi initialFormula
  useEffect(() => {
    if (isOpen) {
      setFormulaInput(initialFormula || 'y = 2x^3 - 3x + 1');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialFormula]);

  // 2. Trạng thái KaTeX xem trước tách biệt - áp dụng useDeferredValue và debounce 120ms
  // để biên dịch toán học không làm đơ bàn phím ảo khi chạm liên tục trên màn hình 75 inch
  const deferredFormula = useDeferredValue(formulaInput);
  const [previewMath, setPreviewMath] = useState<{
    latex: string | null;
    katexHtml: string | null;
    parsed: any;
  }>({
    latex: null,
    katexHtml: null,
    parsed: compileMathExpression(initialFormula),
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const parsed = compileMathExpression(deferredFormula);
        let katexHtml: string | null = null;
        if (parsed.latex) {
          try {
            katexHtml = katex.renderToString(parsed.latex, {
              displayMode: true,
              throwOnError: false,
              strict: false,
            });
          } catch {
            katexHtml = null;
          }
        }
        setPreviewMath({ latex: parsed.latex, katexHtml, parsed });
      } catch (err) {
        setPreviewMath({
          latex: null,
          katexHtml: null,
          parsed: { error: 'Lỗi công thức toán học' },
        });
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [deferredFormula]);

  if (!isOpen) return null;

  // Xử lý chèn ký tự tức thì vào vị trí con trỏ (thời gian phản hồi < 16ms)
  const insertSymbol = (sym: string) => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? formulaInput.length;
      const end = input.selectionEnd ?? formulaInput.length;
      const nextVal = formulaInput.substring(0, start) + sym + formulaInput.substring(end);
      setFormulaInput(nextVal);
      const nextPos = start + sym.length;
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(nextPos, nextPos);
        }
      });
    } else {
      setFormulaInput((prev) => prev + sym);
    }
  };

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
            inputRef.current.focus();
            inputRef.current.setSelectionRange(start - 1, start - 1);
          }
        });
      } else if (start !== end) {
        const nextVal = formulaInput.substring(0, start) + formulaInput.substring(end);
        setFormulaInput(nextVal);
        requestAnimationFrame(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.setSelectionRange(start, start);
          }
        });
      }
    } else {
      setFormulaInput((prev) => prev.slice(0, -1));
    }
  };

  const handleClearAll = () => {
    setFormulaInput('');
    inputRef.current?.focus();
  };

  const presets = [
    { label: 'Bậc 3: 2x³ - 3x + 1', val: 'y = 2x^3 - 3x + 1' },
    { label: 'Trùng phương: x⁴ - 2x² - 1', val: 'y = x^4 - 2x^2 - 1' },
    { label: 'Trùng phương: -x⁴ + 2x² + 1', val: 'y = -x^4 + 2x^2 + 1' },
    { label: 'Nhất biến: (2x+1)/(x-1)', val: 'y = (2x+1)/(x-1)' },
    { label: 'Lượng giác: 2sin(2x)', val: 'y = 2sin(2x)' },
    { label: 'Vật lý: Ly độ 4cos(2πt)', val: 'x = 4cos(2πt)' },
    { label: 'Vật lý: Dao động 4cos(2πt - π/3)', val: 'x = 4cos(2πt - π/3)' },
    { label: 'Vật lý: Vận tốc -8π sin(2πt)', val: 'v = -8π sin(2πt)' },
    { label: 'Vật lý: Dao động tắt dần', val: 'x = 4e^(-0.2t)cos(2πt)' },
    { label: 'Căn thức: √(4 - x²)', val: 'y = √(4 - x^2)' },
    { label: 'Parabol ném ngang', val: 'y = -0.049x^2 + 5' },
  ];

  const parsed = previewMath.parsed || {};

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-5 md:p-6 max-w-2xl w-full shadow-2xl text-white space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm md:text-base text-white tracking-tight">
                {isEditing ? 'Chỉnh Sửa Đồ Thị Hàm Số' : 'Vẽ Đồ Thị Hàm Số & Dao Động Vật Lý'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Nhập công thức tự do &bull; Hỗ trợ SGK Toán 12, Vật lý 12, MathType, KaTeX
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input box & Math Live Preview */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span>Công thức hàm số (Nhập trực tiếp hoặc chạm bàn phím ảo bên dưới):</span>
            <span className="text-[10px] text-amber-300 font-mono">Ví dụ: y = 2x^3 - 3x + 1 hoặc x = 4cos(2πt)</span>
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={formulaInput}
              onChange={(e) => setFormulaInput(e.target.value)}
              placeholder="Nhập công thức hàm số (ví dụ: y = 2x^3 - 3x + 1 hoặc x = 4cos(2πt))"
              className="w-full px-4 py-3 rounded-2xl bg-slate-950 border-2 border-slate-700 text-white font-mono text-sm focus:border-amber-400 focus:outline-none pr-10 shadow-inner"
            />
            {formulaInput && (
              <button
                type="button"
                onClick={handleClearAll}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 cursor-pointer"
                title="Xóa trắng"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Validation Status */}
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[11px] text-slate-400 font-medium">
              Xem trước hiển thị công thức chuẩn LaTeX / KaTeX:
            </span>
            {parsed.error ? (
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>{parsed.error}</span>
              </span>
            ) : (
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>Chuẩn MathType &bull; Sẵn sàng vẽ</span>
              </span>
            )}
          </div>

          {/* KaTeX Math Display Container */}
          <div className="min-h-[58px] bg-slate-950/80 rounded-2xl px-4 py-3 flex items-center justify-center border border-white/10 text-white overflow-x-auto custom-scrollbar shadow-inner">
            {previewMath.katexHtml ? (
              <div
                className="text-lg md:text-xl text-amber-200 select-all"
                dangerouslySetInnerHTML={{ __html: previewMath.katexHtml }}
              />
            ) : (
              <span className="text-sm font-mono text-slate-400">
                {parsed.displayFormula || formulaInput || 'y = f(x)'}
              </span>
            )}
          </div>

          {/* Value verification test & variable info */}
          {!parsed.error && parsed.sampleTest && (
            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 px-1 pt-0.5 gap-2 border-t border-white/5">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                <span>Hàm theo {parsed.variableName === 't' ? 'biến thời gian (t)' : 'biến số (x)'}</span>
              </span>
              <span className="font-mono text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded-lg border border-cyan-800/40">
                {parsed.variableName === 't'
                  ? `Kiểm tra giá trị: x(0) = ${parsed.sampleTest.at0 ?? 'N/A'}, x(1) = ${parsed.sampleTest.at1 ?? 'N/A'}`
                  : `Kiểm tra giá trị: y(0) = ${parsed.sampleTest.at0 ?? 'N/A'}, y(1) = ${parsed.sampleTest.at1 ?? 'N/A'}`}
              </span>
            </div>
          )}
        </div>

        {/* BÀN PHÍM KÝ HIỆU NHANH PHẢN HỒI SIÊU TỐC (<16ms) */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-bold uppercase text-slate-400 block">
            Bàn phím ký hiệu nhanh (Tiện lợi chạm trên bảng 75 inch - Phản hồi siêu tốc):
          </span>

          <div className="space-y-1.5">
            {/* Row 1: Variables, Constants, Superscripts */}
            <div className="grid grid-cols-8 gap-1.5 font-mono text-xs font-bold">
              <button
                type="button"
                onClick={() => insertSymbol('x')}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-90 cursor-pointer text-cyan-300"
                title="Biến số x"
              >
                x
              </button>

              <button
                type="button"
                onClick={() => insertSymbol('t')}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-90 cursor-pointer text-cyan-300"
                title="Biến thời gian t (Vật lý)"
              >
                t
              </button>

              <button
                type="button"
                onClick={() => insertSymbol('π')}
                className="p-2.5 rounded-xl bg-amber-500/25 hover:bg-amber-500 hover:text-slate-950 text-amber-300 transition-colors border-2 border-amber-400/80 text-center active:scale-90 cursor-pointer font-serif text-sm font-bold shadow-md shadow-amber-500/20"
                title="Số Pi chuẩn toán học (π ≈ 3.14159)"
              >
                &pi;
              </button>

              <button
                type="button"
                onClick={() => insertSymbol('e')}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-90 cursor-pointer text-amber-200"
                title="Cơ số tự nhiên e (e ≈ 2.718)"
              >
                e
              </button>

              <button
                type="button"
                onClick={() => insertSymbol('^2')}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-90 cursor-pointer text-emerald-300"
                title="Bình phương (^2)"
              >
                x²
              </button>

              <button
                type="button"
                onClick={() => insertSymbol('^3')}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-90 cursor-pointer text-emerald-300"
                title="Lập phương (^3)"
              >
                x³
              </button>

              <button
                type="button"
                onClick={() => insertSymbol('^')}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-90 cursor-pointer text-emerald-300"
                title="Mũ lũy thừa (^)"
              >
                ^
              </button>

              <button
                type="button"
                onClick={() => insertSymbol('√(')}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-90 cursor-pointer text-purple-300"
                title="Căn bậc hai √(...)"
              >
                &radic;(
              </button>
            </div>

            {/* Row 2: Basic Operators, Parentheses, Editing */}
            <div className="grid grid-cols-8 gap-1.5 font-mono text-xs font-bold">
              <button
                type="button"
                onClick={() => insertSymbol('+')}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-90 cursor-pointer"
              >
                +
              </button>

              <button
                type="button"
                onClick={() => insertSymbol('-')}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-90 cursor-pointer"
              >
                -
              </button>

              <button
                type="button"
                onClick={() => insertSymbol('*')}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-90 cursor-pointer"
                title="Dấu nhân (* hoặc ·)"
              >
                &times;
              </button>

              <button
                type="button"
                onClick={() => insertSymbol('/')}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-90 cursor-pointer"
                title="Chia / Phân số"
              >
                /
              </button>

              <button
                type="button"
                onClick={() => insertSymbol('(')}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-90 cursor-pointer text-amber-200"
              >
                (
              </button>

              <button
                type="button"
                onClick={() => insertSymbol(')')}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-90 cursor-pointer text-amber-200"
              >
                )
              </button>

              <button
                type="button"
                onClick={handleDeleteChar}
                className="p-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white transition-colors border border-rose-500/30 text-center active:scale-90 cursor-pointer"
                title="Xóa ký tự vừa nhập"
              >
                &larr; Xóa
              </button>

              <button
                type="button"
                onClick={handleClearAll}
                className="p-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white transition-colors border border-rose-500/30 text-center active:scale-90 cursor-pointer"
                title="Xóa toàn bộ công thức"
              >
                C
              </button>
            </div>

            {/* Row 3: Trigonometric & Advanced Functions */}
            <div className="grid grid-cols-7 gap-1.5 font-mono text-xs font-bold">
              {['sin(', 'cos(', 'tan(', 'cot(', 'ln(', 'exp(', 'abs('].map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => insertSymbol(sym)}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-amber-500 hover:text-slate-950 transition-colors border border-white/10 text-center active:scale-90 cursor-pointer text-cyan-200"
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sample Presets */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase text-slate-400 block">
            Mẫu hàm số & Dao động phổ biến (Chuẩn SGK & MathType):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setFormulaInput(preset.val);
                  inputRef.current?.focus();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-400 text-[11px] text-slate-300 hover:text-amber-300 transition-colors active:scale-95 cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={() => onApply(formulaInput)}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-transform active:scale-95 cursor-pointer"
          >
            <TrendingUp className="w-4 h-4" />
            <span>{isEditing ? 'Cập Nhật Đồ Thị' : 'Vẽ Đồ Thị Lên Bảng Xanh'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
