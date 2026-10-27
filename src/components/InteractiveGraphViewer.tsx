import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Move, Sparkles, AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator: (
        element: HTMLElement,
        options?: Record<string, any>
      ) => any;
    };
  }
}

export interface InteractiveGraphViewerProps {
  latex?: string; // e.g. "y = x^2 - 3x", "y = x^3 - 3x + 1", "y = \frac{2x+1}{x-1}"
  functions?: string[]; // Multiple curves if needed
  points?: Array<{ x: number; y: number; label?: string }>;
  title?: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  isPresentationMode?: boolean; // For 75" TV display
}

/**
 * Chuẩn hóa công thức hàm số sang chuẩn LaTeX của Desmos API
 */
export function normalizeDesmosLatex(raw: string): string {
  if (!raw) return 'y = x^2';
  let s = raw.trim();

  // Bỏ bớt dấu $ nếu có
  s = s.replace(/^\$+|\$+$/g, '').trim();

  // Đổi các hàm theo thời gian: x(t) = ... -> y = ... hoặc giữ nguyên x = ...cos(...)
  if (/^x\s*\(t\)\s*=/i.test(s)) {
    s = s.replace(/^x\s*\(t\)\s*=\s*/i, 'y = ');
  }

  // Đổi biến t sang x nếu không có biến x trong vế phải
  if (/\bcos\b|\bsin\b/i.test(s) && /\bt\b/.test(s) && !/\bx\b/.test(s)) {
    s = s.replace(/\bt\b/g, 'x');
  }

  // Nếu chưa có dấu = (chỉ có biểu thức vế phải, vd: x^2 - 3x), tự thêm y =
  if (!s.includes('=')) {
    s = `y = ${s}`;
  }

  // Chuẩn hóa dấu nhân: * -> \cdot
  s = s.replace(/\*/g, ' ');

  // Chuẩn hóa pi: π -> \pi
  s = s.replace(/π/g, '\\pi ');

  return s;
}

export const InteractiveGraphViewer: React.FC<InteractiveGraphViewerProps> = ({
  latex = 'y = x^2 - 3x',
  functions,
  points,
  title,
  width = '100%',
  height = 300,
  className = '',
  isPresentationMode = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Danh sách các hàm cần vẽ
  const activeFunctions = functions && functions.length > 0 ? functions : [latex];

  // Khởi tạo Desmos Graphing Calculator
  useEffect(() => {
    let isMounted = true;

    const initDesmos = () => {
      if (!containerRef.current) return;
      if (!window.Desmos || !window.Desmos.GraphingCalculator) {
        // Nếu script chưa tải xong, thử lại sau 300ms
        setTimeout(() => {
          if (isMounted) initDesmos();
        }, 300);
        return;
      }

      try {
        if (!calcRef.current) {
          // Khởi tạo Desmos: Khóa menu chỉnh sửa phương trình nhưng CHO PHÉP pan và zoom trên SmartBoard
          const calc = window.Desmos.GraphingCalculator(containerRef.current, {
            keypad: false, // Ẩn bàn phím nhập
            expressions: false, // Khóa menu phương trình (chế độ chỉ xem)
            settingsMenu: false, // Ẩn cài đặt phức tạp
            zoomButtons: true, // Hiện 2 nút [+] [-] cảm ứng rất tiện trên TV 75"
            lockViewport: false, // Cho phép kéo di chuyển (Pan) và phóng to thu nhỏ (Zoom)
            pointsOfInterest: true, // Chạm vào cực trị/giao điểm tự hiện tọa độ
            trace: true, // Chạm vào đường cong hiển thị tọa độ điểm
            border: false,
            fontSize: isPresentationMode ? 16 : 14,
            xAxisLabel: 'x',
            yAxisLabel: 'y',
          });
          calcRef.current = calc;
        }

        // Đẩy các hàm số vào Desmos
        const colors = ['#4f46e5', '#e11d48', '#059669', '#d97706'];
        activeFunctions.forEach((fnStr, idx) => {
          const normLatex = normalizeDesmosLatex(fnStr);
          calcRef.current.setExpression({
            id: `fn_${idx + 1}`,
            latex: normLatex,
            color: colors[idx % colors.length],
            lineWidth: isPresentationMode ? 3.5 : 2.8,
          });
        });

        // Vẽ các điểm đặc biệt nếu có
        if (points && points.length > 0) {
          points.forEach((pt, pIdx) => {
            calcRef.current.setExpression({
              id: `pt_${pIdx + 1}`,
              latex: `(${pt.x}, ${pt.y})`,
              color: '#d97706',
              pointStyle: 'POINT',
              showLabel: Boolean(pt.label),
              label: pt.label || `(${pt.x}; ${pt.y})`,
            });
          });
        }

        if (isMounted) {
          setIsLoaded(true);
        }
      } catch (err: any) {
        console.warn('[Desmos Graph] Init notice:', err);
        if (isMounted) {
          setLoadError('Đang chuẩn bị đồ thị tương tác...');
        }
      }
    };

    initDesmos();

    return () => {
      isMounted = false;
      if (calcRef.current) {
        try {
          calcRef.current.destroy();
        } catch (_) {}
        calcRef.current = null;
      }
    };
  }, [isPresentationMode]);

  // Cập nhật hàm số khi props thay đổi
  useEffect(() => {
    if (!calcRef.current) return;
    try {
      const colors = ['#4f46e5', '#e11d48', '#059669', '#d97706'];
      activeFunctions.forEach((fnStr, idx) => {
        const normLatex = normalizeDesmosLatex(fnStr);
        calcRef.current.setExpression({
          id: `fn_${idx + 1}`,
          latex: normLatex,
          color: colors[idx % colors.length],
          lineWidth: isPresentationMode ? 3.5 : 2.8,
        });
      });
    } catch (err) {
      console.warn('[Desmos Graph] Update error:', err);
    }
  }, [activeFunctions, isPresentationMode]);

  // Nút đưa góc nhìn về tọa độ mặc định [-10, 10]
  const handleResetViewport = useCallback(() => {
    if (!calcRef.current) return;
    try {
      calcRef.current.setMathBounds({
        left: -8,
        right: 8,
        bottom: -6,
        top: 6,
      });
    } catch (_) {}
  }, []);

  // Nút zoom in
  const handleZoomIn = useCallback(() => {
    if (!calcRef.current) return;
    try {
      const b = calcRef.current.graphpaperBounds.mathCoordinates;
      const cx = (b.left + b.right) / 2;
      const cy = (b.bottom + b.top) / 2;
      const hw = ((b.right - b.left) / 2) * 0.75;
      const hh = ((b.top - b.bottom) / 2) * 0.75;
      calcRef.current.setMathBounds({
        left: cx - hw,
        right: cx + hw,
        bottom: cy - hh,
        top: cy + hh,
      });
    } catch (_) {}
  }, []);

  // Nút zoom out
  const handleZoomOut = useCallback(() => {
    if (!calcRef.current) return;
    try {
      const b = calcRef.current.graphpaperBounds.mathCoordinates;
      const cx = (b.left + b.right) / 2;
      const cy = (b.bottom + b.top) / 2;
      const hw = ((b.right - b.left) / 2) * 1.35;
      const hh = ((b.top - b.bottom) / 2) * 1.35;
      calcRef.current.setMathBounds({
        left: cx - hw,
        right: cx + hw,
        bottom: cy - hh,
        top: cy + hh,
      });
    } catch (_) {}
  }, []);

  const displayFormula = activeFunctions[0] || latex;

  return (
    <div
      className={`relative flex flex-col bg-white rounded-2xl border-2 border-indigo-200/80 shadow-md overflow-hidden ${className}`}
      style={{ width }}
    >
      {/* Header bar của đồ thị */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 text-white shrink-0 border-b border-slate-800">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs font-black tracking-wide truncate text-slate-100 uppercase">
            {title || 'Đồ thị tương tác (Desmos API)'}
          </span>
          <span className="text-[11px] font-mono font-bold text-amber-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 truncate">
            {displayFormula}
          </span>
        </div>

        {/* Quick Toolbar: Pan/Zoom Notice & Reset View */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
            title="Phóng to đồ thị (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
            title="Thu nhỏ đồ thị (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetViewport}
            className="p-1 rounded-lg bg-indigo-900/80 hover:bg-indigo-800 text-indigo-300 text-xs font-bold flex items-center gap-1 transition-all"
            title="Về góc nhìn mặc định"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden sm:inline">Về gốc</span>
          </button>
        </div>
      </div>

      {/* Vùng vẽ đồ thị Desmos tương tác */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: typeof height === 'number' ? `${height}px` : height,
          minHeight: '260px',
        }}
        className="w-full relative touch-none bg-white"
      />

      {/* Footer chú thích tiện ích cho SmartBoard 75" */}
      <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
        <span className="flex items-center gap-1 text-indigo-700 font-semibold">
          <Move className="w-3.5 h-3.5" />
          <span>Kéo 1 ngón để Pan • Chụm 2 ngón để Phóng to/Thu nhỏ • Chạm điểm để xem tọa độ</span>
        </span>
        <span className="font-mono text-[10px] text-slate-400 bg-slate-200/80 px-1.5 py-0.5 rounded">
          Chỉ xem &bull; Khóa sửa
        </span>
      </div>
    </div>
  );
};
