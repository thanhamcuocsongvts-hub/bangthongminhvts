import React, { useState, useRef, useEffect } from 'react';
import {
  Move,
  Type,
  Trash2,
  Check,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Plus,
  Minus,
  GripHorizontal,
  StickyNote,
  Sparkles,
} from 'lucide-react';
import { MathFormulaRenderer } from './MathFormulaRenderer';

export interface BlackboardTextBox {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text: string;
  color: string;
  size: number;
  fontFamily?: 'sans' | 'serif' | 'mono' | 'handwriting';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right';
  bgColor?: string; // 'transparent' | 'dark' | 'white' | 'yellow' | 'cyan'
  borderColor?: string;
  borderStyle?: 'none' | 'dashed' | 'solid';
}

interface BlackboardWordTextBoxProps {
  textBox: BlackboardTextBox;
  isSelected: boolean;
  boardScrollX: number;
  boardScrollY: number;
  chalkPalette: Array<{ name?: string; label: string; value: string; isFluorescent?: boolean; desc?: string }>;
  onSelect: () => void;
  onChange: (updated: BlackboardTextBox) => void;
  onDelete: () => void;
  onDragStart?: (e: React.PointerEvent) => void;
}

export const BlackboardWordTextBox: React.FC<BlackboardWordTextBoxProps> = ({
  textBox,
  isSelected,
  boardScrollX,
  boardScrollY,
  chalkPalette,
  onSelect,
  onChange,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(!textBox.text || textBox.text.trim() === '');
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);
  const [showBgPicker, setShowBgPicker] = useState<boolean>(false);
  const [showMathPresets, setShowMathPresets] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Default width and height
  const width = textBox.width || Math.max(220, (textBox.text.length || 10) * (textBox.size * 0.55) + 40);
  const height = textBox.height || Math.max(70, textBox.size * 2 + 30);
  const fontFamily = textBox.fontFamily || 'sans';
  const align = textBox.align || 'left';
  const bgColor = textBox.bgColor || 'transparent';
  const borderStyle = textBox.borderStyle || (isSelected ? 'dashed' : 'none');

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // Quick font families mapping
  const getFontFamilyCss = () => {
    switch (fontFamily) {
      case 'serif':
        return '"Times New Roman", Times, "Be Vietnam Pro", serif';
      case 'mono':
        return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      case 'handwriting':
        return '"Caveat", "Patrick Hand", "Comic Sans MS", cursive, sans-serif';
      case 'sans':
      default:
        return '"Be Vietnam Pro", Inter, system-ui, sans-serif';
    }
  };

  // Background styling mapping
  const getBgStyle = () => {
    switch (bgColor) {
      case 'dark':
        return 'bg-slate-950/85 backdrop-blur-md shadow-2xl border-cyan-400/40';
      case 'white':
        return 'bg-white/95 text-slate-900 shadow-2xl border-slate-300';
      case 'yellow':
        return 'bg-amber-100/95 text-slate-900 shadow-2xl border-amber-300';
      case 'cyan':
        return 'bg-sky-100/95 text-slate-900 shadow-2xl border-sky-300';
      case 'transparent':
      default:
        return isSelected
          ? 'bg-slate-900/40 backdrop-blur-[2px] border-cyan-400/60'
          : 'bg-transparent border-transparent';
    }
  };

  // Dragging the whole text box
  const handleHeaderPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const origX = textBox.x;
    const origY = textBox.y;

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = moveEv.clientX - startMouseX;
      const dy = moveEv.clientY - startMouseY;
      const newX = Math.round(origX + dx);
      const newY = Math.round(origY + dy);
      onChange({ ...textBox, x: newX, y: newY });
    };

    const onPointerUp = (upEv: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(upEv.pointerId);
      } catch (_) {}
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Resizing the text box via 8 handles
  const handleResizePointerDown = (e: React.PointerEvent, direction: string) => {
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const origX = textBox.x;
    const origY = textBox.y;
    const origW = width;
    const origH = height;

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = moveEv.clientX - startMouseX;
      const dy = moveEv.clientY - startMouseY;

      let newW = origW;
      let newH = origH;
      let newX = origX;
      let newY = origY;

      if (direction.includes('e')) {
        newW = Math.max(80, origW + dx);
      }
      if (direction.includes('s')) {
        newH = Math.max(40, origH + dy);
      }
      if (direction.includes('w')) {
        const potentialW = Math.max(80, origW - dx);
        newX = origX + (origW - potentialW);
        newW = potentialW;
      }
      if (direction.includes('n')) {
        const potentialH = Math.max(40, origH - dy);
        newY = origY + (origH - potentialH);
        newH = potentialH;
      }

      onChange({
        ...textBox,
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
      });
    };

    const onPointerUp = (upEv: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(upEv.pointerId);
      } catch (_) {}
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Quick Math / Science formula insert
  const insertMathFormula = (snippet: string) => {
    const prev = textBox.text || '';
    const updated = prev ? `${prev} ${snippet}` : snippet;
    onChange({ ...textBox, text: updated });
    setIsEditing(true);
  };

  return (
    <div
      ref={boxRef}
      id={`word_textbox_${textBox.id}`}
      className="absolute select-none pointer-events-auto transition-shadow"
      style={{
        left: `${textBox.x - boardScrollX}px`,
        top: `${textBox.y - boardScrollY}px`,
        width: `${width}px`,
        minHeight: `${height}px`,
        zIndex: isSelected ? 45 : 20,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
    >
      {/* 1. FLOATING WORD-STYLE FORMATTING TOOLBAR (WHEN SELECTED) */}
      {isSelected && (
        <div
          className="absolute -top-16 left-0 flex items-center gap-1 bg-slate-950/95 backdrop-blur-md px-2 py-1.5 rounded-2xl border-2 border-cyan-400/90 shadow-2xl text-white pointer-events-auto z-50 whitespace-nowrap"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Header Drag Handle like Word Text Box */}
          <div
            onPointerDown={handleHeaderPointerDown}
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold text-xs cursor-move"
            title="Kéo thanh này để di chuyển Hộp văn bản"
          >
            <Move className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Text Box</span>
          </div>

          <div className="h-4 w-px bg-white/20 mx-0.5" />

          {/* Font Family Selector */}
          <select
            value={fontFamily}
            onChange={(e) => onChange({ ...textBox, fontFamily: e.target.value as any })}
            className="bg-slate-800 text-white text-xs font-semibold px-2 py-1 rounded-lg border border-slate-700 outline-none focus:ring-1 focus:ring-cyan-400"
            title="Kiểu phông chữ (Chuẩn Word & Sách Giáo Khoa)"
          >
            <option value="sans">Phông Sans (Arial / Chuẩn)</option>
            <option value="serif">Phông Serif (Times New Roman / SGK)</option>
            <option value="mono">Phông Mono (Toán tin / Mã)</option>
            <option value="handwriting">Phông Viết phấn (Phấn bảng)</option>
          </select>

          {/* Font Size A- / A+ */}
          <div className="flex items-center bg-white/10 rounded-lg p-0.5">
            <button
              onClick={() => onChange({ ...textBox, size: Math.max(12, textBox.size - 4) })}
              className="p-1 hover:bg-white/20 rounded text-slate-300"
              title="Giảm cỡ chữ"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-[11px] font-mono font-bold px-1 text-amber-300">
              {textBox.size}px
            </span>
            <button
              onClick={() => onChange({ ...textBox, size: Math.min(96, textBox.size + 4) })}
              className="p-1 hover:bg-white/20 rounded text-slate-300"
              title="Tăng cỡ chữ"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <div className="h-4 w-px bg-white/20 mx-0.5" />

          {/* Bold / Italic / Underline */}
          <button
            onClick={() => onChange({ ...textBox, bold: !textBox.bold })}
            className={`p-1.5 rounded-lg text-xs font-black transition-colors ${
              textBox.bold ? 'bg-cyan-500 text-slate-950 shadow' : 'hover:bg-white/10 text-slate-300'
            }`}
            title="In đậm (Bold)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onChange({ ...textBox, italic: !textBox.italic })}
            className={`p-1.5 rounded-lg text-xs font-black transition-colors ${
              textBox.italic ? 'bg-cyan-500 text-slate-950 shadow' : 'hover:bg-white/10 text-slate-300'
            }`}
            title="In nghiêng (Italic)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onChange({ ...textBox, underline: !textBox.underline })}
            className={`p-1.5 rounded-lg text-xs font-black transition-colors ${
              textBox.underline ? 'bg-cyan-500 text-slate-950 shadow' : 'hover:bg-white/10 text-slate-300'
            }`}
            title="Gạch chân (Underline)"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-white/20 mx-0.5" />

          {/* Alignment */}
          <button
            onClick={() => onChange({ ...textBox, align: 'left' })}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              align === 'left' ? 'bg-cyan-500 text-slate-950 shadow' : 'hover:bg-white/10 text-slate-300'
            }`}
            title="Căn trái"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onChange({ ...textBox, align: 'center' })}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              align === 'center' ? 'bg-cyan-500 text-slate-950 shadow' : 'hover:bg-white/10 text-slate-300'
            }`}
            title="Căn giữa"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onChange({ ...textBox, align: 'right' })}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              align === 'right' ? 'bg-cyan-500 text-slate-950 shadow' : 'hover:bg-white/10 text-slate-300'
            }`}
            title="Căn phải"
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-white/20 mx-0.5" />

          {/* Text Color Picker Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="p-1.5 rounded-lg hover:bg-white/10 flex items-center gap-1 text-xs"
              title="Màu chữ / Màu phấn"
            >
              <div
                className="w-3.5 h-3.5 rounded-full border border-white"
                style={{ backgroundColor: textBox.color }}
              />
            </button>
            {showColorPicker && (
              <div className="absolute top-10 left-0 bg-slate-900 border border-slate-700 p-2 rounded-xl shadow-2xl flex gap-1 z-50">
                {chalkPalette.map((cp) => (
                  <button
                    key={cp.value}
                    onClick={() => {
                      onChange({ ...textBox, color: cp.value });
                      setShowColorPicker(false);
                    }}
                    className={`w-5 h-5 rounded-full border transition-transform ${
                      textBox.color === cp.value ? 'scale-125 border-white ring-2 ring-cyan-400' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: cp.value }}
                    title={cp.label}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Background Note Style Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowBgPicker(!showBgPicker)}
              className={`p-1.5 rounded-lg flex items-center gap-1 text-xs ${
                bgColor !== 'transparent' ? 'bg-amber-500/20 text-amber-300' : 'hover:bg-white/10 text-slate-300'
              }`}
              title="Kiểu nền / Giấy ghi chú"
            >
              <StickyNote className="w-3.5 h-3.5" />
            </button>
            {showBgPicker && (
              <div className="absolute top-10 left-0 bg-slate-900 border border-slate-700 p-2 rounded-xl shadow-2xl flex flex-col gap-1 text-xs text-white z-50 min-w-[130px]">
                <button
                  onClick={() => {
                    onChange({ ...textBox, bgColor: 'transparent' });
                    setShowBgPicker(false);
                  }}
                  className="px-2 py-1 text-left hover:bg-white/10 rounded"
                >
                  Không nền (Trong suốt)
                </button>
                <button
                  onClick={() => {
                    onChange({ ...textBox, bgColor: 'dark' });
                    setShowBgPicker(false);
                  }}
                  className="px-2 py-1 text-left hover:bg-white/10 rounded"
                >
                  Kính mờ bảng đen
                </button>
                <button
                  onClick={() => {
                    onChange({ ...textBox, bgColor: 'yellow', color: '#0f172a' });
                    setShowBgPicker(false);
                  }}
                  className="px-2 py-1 text-left hover:bg-amber-100/20 rounded text-amber-300 font-bold"
                >
                  Giấy nhớ vàng (Sticky)
                </button>
                <button
                  onClick={() => {
                    onChange({ ...textBox, bgColor: 'white', color: '#0f172a' });
                    setShowBgPicker(false);
                  }}
                  className="px-2 py-1 text-left hover:bg-white/20 rounded font-bold"
                >
                  Giấy trắng học sinh
                </button>
              </div>
            )}
          </div>

          {/* Math Formulas Helper */}
          <div className="relative">
            <button
              onClick={() => setShowMathPresets(!showMathPresets)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-purple-300"
              title="Chèn công thức toán/hóa học chuẩn LaTeX"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
            {showMathPresets && (
              <div className="absolute top-10 right-0 bg-slate-900 border border-slate-700 p-2 rounded-xl shadow-2xl grid grid-cols-2 gap-1 text-xs text-white z-50 min-w-[180px]">
                <button
                  onClick={() => {
                    insertMathFormula('$\\frac{a}{b}$');
                    setShowMathPresets(false);
                  }}
                  className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded font-mono text-left"
                >
                  Phân số \frac
                </button>
                <button
                  onClick={() => {
                    insertMathFormula('$\\sqrt{x}$');
                    setShowMathPresets(false);
                  }}
                  className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded font-mono text-left"
                >
                  Căn \sqrt
                </button>
                <button
                  onClick={() => {
                    insertMathFormula('$x^2 + y^2$');
                    setShowMathPresets(false);
                  }}
                  className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded font-mono text-left"
                >
                  Số mũ x^2
                </button>
                <button
                  onClick={() => {
                    insertMathFormula('$\\int_{a}^{b} f(x)dx$');
                    setShowMathPresets(false);
                  }}
                  className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded font-mono text-left"
                >
                  Tích phân \int
                </button>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-white/20 mx-0.5" />

          {/* Finish Editing button */}
          <button
            onClick={() => setIsEditing(false)}
            className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow"
            title="Xong / Xem kết quả trình bày"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Xong</span>
          </button>

          {/* Delete Button */}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white transition-colors"
            title="Xóa hộp văn bản này"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. TEXT BOX CONTAINER WITH RESIZE HANDLERS */}
      <div
        className={`relative w-full h-full rounded-xl p-2.5 transition-all ${getBgStyle()} ${
          isSelected ? 'ring-2 ring-cyan-400/80 shadow-2xl' : ''
        }`}
        style={{
          borderStyle: borderStyle as any,
          borderWidth: isSelected ? '2px' : borderStyle === 'none' ? '0px' : '1.5px',
        }}
      >
        {/* Top Header Grip for dragging */}
        <div
          onPointerDown={handleHeaderPointerDown}
          className={`w-full py-0.5 px-1 flex items-center justify-between cursor-move rounded-md mb-1 transition-opacity ${
            isSelected ? 'opacity-100 bg-white/10' : 'opacity-0 hover:opacity-100'
          }`}
          title="Kéo để di chuyển vị trí Hộp văn bản trên bảng"
        >
          <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-cyan-300 font-mono">
            <GripHorizontal className="w-3.5 h-3.5" />
            <span>Hộp văn bản Word</span>
          </div>
          <span className="text-[9px] text-slate-400 font-mono">Double click để gõ</span>
        </div>

        {/* Text Body: Either Live Editable Textarea OR Beautiful LaTeX/Math Formula View */}
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={textBox.text}
            onChange={(e) => onChange({ ...textBox, text: e.target.value })}
            onBlur={() => {
              if (textBox.text.trim()) {
                setIsEditing(false);
              }
            }}
            placeholder="Gõ văn bản, tiêu đề, công thức toán $x^2 + y^2 = r^2$..."
            className="w-full h-full min-h-[44px] bg-transparent resize-none outline-none leading-relaxed custom-scrollbar-none"
            style={{
              color: textBox.color,
              fontSize: `${textBox.size}px`,
              fontFamily: getFontFamilyCss(),
              fontWeight: textBox.bold ? 700 : 400,
              fontStyle: textBox.italic ? 'italic' : 'normal',
              textDecoration: textBox.underline ? 'underline' : 'none',
              textAlign: align,
            }}
          />
        ) : (
          <div
            className="w-full h-full min-h-[44px] break-words cursor-pointer leading-relaxed"
            style={{
              color: textBox.color,
              fontSize: `${textBox.size}px`,
              fontFamily: getFontFamilyCss(),
              fontWeight: textBox.bold ? 700 : 400,
              fontStyle: textBox.italic ? 'italic' : 'normal',
              textDecoration: textBox.underline ? 'underline' : 'none',
              textAlign: align,
            }}
            onClick={() => onSelect()}
            onDoubleClick={() => setIsEditing(true)}
          >
            {textBox.text.includes('$') || textBox.text.includes('\\') ? (
              <MathFormulaRenderer content={textBox.text} />
            ) : (
              <span className="whitespace-pre-wrap">{textBox.text}</span>
            )}
          </div>
        )}

        {/* 3. EIGHT WORD-LIKE RESIZE HANDLES (VISIBLE WHEN SELECTED) */}
        {isSelected && (
          <>
            {/* Top-Left */}
            <div
              onPointerDown={(e) => handleResizePointerDown(e, 'nw')}
              className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-cyan-500 rounded-xs shadow-md cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform"
              title="Kéo co giãn góc trên-trái"
            />
            {/* Top-Right */}
            <div
              onPointerDown={(e) => handleResizePointerDown(e, 'ne')}
              className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-cyan-500 rounded-xs shadow-md cursor-nesw-resize pointer-events-auto hover:scale-125 transition-transform"
              title="Kéo co giãn góc trên-phải"
            />
            {/* Bottom-Left */}
            <div
              onPointerDown={(e) => handleResizePointerDown(e, 'sw')}
              className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-cyan-500 rounded-xs shadow-md cursor-nesw-resize pointer-events-auto hover:scale-125 transition-transform"
              title="Kéo co giãn góc dưới-trái"
            />
            {/* Bottom-Right */}
            <div
              onPointerDown={(e) => handleResizePointerDown(e, 'se')}
              className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-cyan-500 rounded-xs shadow-md cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform"
              title="Kéo co giãn góc dưới-phải"
            />
            {/* Top-Center */}
            <div
              onPointerDown={(e) => handleResizePointerDown(e, 'n')}
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-cyan-500 rounded-xs shadow-md cursor-ns-resize pointer-events-auto hover:scale-125 transition-transform"
              title="Kéo co giãn cạnh trên"
            />
            {/* Bottom-Center */}
            <div
              onPointerDown={(e) => handleResizePointerDown(e, 's')}
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-cyan-500 rounded-xs shadow-md cursor-ns-resize pointer-events-auto hover:scale-125 transition-transform"
              title="Kéo co giãn cạnh dưới"
            />
            {/* Left-Center */}
            <div
              onPointerDown={(e) => handleResizePointerDown(e, 'w')}
              className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-cyan-500 rounded-xs shadow-md cursor-ew-resize pointer-events-auto hover:scale-125 transition-transform"
              title="Kéo co giãn cạnh trái"
            />
            {/* Right-Center */}
            <div
              onPointerDown={(e) => handleResizePointerDown(e, 'e')}
              className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-cyan-500 rounded-xs shadow-md cursor-ew-resize pointer-events-auto hover:scale-125 transition-transform"
              title="Kéo co giãn cạnh phải"
            />
          </>
        )}
      </div>
    </div>
  );
};
