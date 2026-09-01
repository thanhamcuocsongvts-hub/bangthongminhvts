import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Pen,
  Highlighter,
  Eraser,
  Sparkles,
  Square,
  Circle,
  MoveUpRight,
  Minus,
  RotateCcw,
  Trash2,
  Download,
  Palette,
  Eye,
  Type,
  Grid,
  Check,
  X,
} from 'lucide-react';
import { WhiteboardStroke, WhiteboardTool, StrokePoint } from '../types';

interface TouchWhiteboardProps {
  id?: string;
  isOverlay?: boolean;
  onCloseOverlay?: () => void;
  backgroundTheme?: 'blackboard' | 'slate' | 'graph' | 'white';
  onBackgroundChange?: (theme: 'blackboard' | 'slate' | 'graph' | 'white') => void;
  children?: React.ReactNode;
}

export const TouchWhiteboard: React.FC<TouchWhiteboardProps> = ({
  id = 'interactive-whiteboard-area',
  isOverlay = false,
  onCloseOverlay,
  backgroundTheme = 'blackboard',
  onBackgroundChange,
  children,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [activeTool, setActiveTool] = useState<WhiteboardTool>('pen');
  const [activeColor, setActiveColor] = useState<string>('#ffffff');
  const [strokeSize, setStrokeSize] = useState<number>(4);
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [redoStack, setRedoStack] = useState<WhiteboardStroke[]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentPoints, setCurrentPoints] = useState<StrokePoint[]>([]);
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState<boolean>(false);

  // Laser pointer position state
  const [laserPos, setLaserPos] = useState<{ x: number; y: number } | null>(null);
  const laserTimeoutRef = useRef<any>(null);

  // Quick palette colors optimized for high-contrast visibility on 75" TV
  const colors = [
    { label: 'Trắng tinh', value: '#ffffff' },
    { label: 'Vàng neon', value: '#facc15' },
    { label: 'Xanh lục neon', value: '#4ade80' },
    { label: 'Cyan sáng', value: '#38bdf8' },
    { label: 'Đỏ cam', value: '#f87171' },
    { label: 'Tím hồng', value: '#c084fc' },
    { label: 'Cam rực rỡ', value: '#fb923c' },
  ];

  // Adjust canvas size to match container
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      redrawCanvas(strokes);
    }
  }, [strokes]);

  useEffect(() => {
    resizeCanvas();
    const observer = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [resizeCanvas]);

  // Redraw all strokes on canvas
  const redrawCanvas = useCallback(
    (strokeList: WhiteboardStroke[]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      strokeList.forEach((stroke) => {
        if (stroke.points.length === 0) return;

        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (stroke.tool === 'highlighter') {
          ctx.globalAlpha = stroke.opacity || 0.4;
          ctx.lineWidth = stroke.size * 2.5;
        } else if (stroke.tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.lineWidth = stroke.size * 3;
        } else {
          ctx.globalAlpha = 1;
        }

        const pts = stroke.points;
        if (stroke.tool === 'line' && pts.length >= 2) {
          ctx.moveTo(pts[0].x, pts[pts.length - 1].x);
          ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
          ctx.stroke();
        } else if (stroke.tool === 'arrow' && pts.length >= 2) {
          const from = pts[0];
          const to = pts[pts.length - 1];
          const headlen = 16;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const angle = Math.atan2(dy, dx);
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.lineTo(to.x - headlen * Math.cos(angle - Math.PI / 6), to.y - headlen * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(to.x, to.y);
          ctx.lineTo(to.x - headlen * Math.cos(angle + Math.PI / 6), to.y - headlen * Math.sin(angle + Math.PI / 6));
          ctx.stroke();
        } else if (stroke.tool === 'rect' && pts.length >= 2) {
          const start = pts[0];
          const end = pts[pts.length - 1];
          ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
        } else if (stroke.tool === 'circle' && pts.length >= 2) {
          const start = pts[0];
          const end = pts[pts.length - 1];
          const radius = Math.hypot(end.x - start.x, end.y - start.y);
          ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Freehand pen or highlighter
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
        }

        ctx.restore();
      });
    },
    []
  );

  useEffect(() => {
    redrawCanvas(strokes);
  }, [strokes, redrawCanvas]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const point = getCanvasCoords(e);

    if (activeTool === 'laser') {
      setLaserPos(point);
      return;
    }

    setIsDrawing(true);
    setCurrentPoints([point]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasCoords(e);

    if (activeTool === 'laser') {
      setLaserPos(point);
      if (laserTimeoutRef.current) clearTimeout(laserTimeoutRef.current);
      laserTimeoutRef.current = setTimeout(() => setLaserPos(null), 1800);
      return;
    }

    if (!isDrawing) return;

    const newPoints = [...currentPoints, point];
    setCurrentPoints(newPoints);

    // Dynamic preview drawing
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    redrawCanvas(strokes);

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = strokeSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (activeTool === 'highlighter') {
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = strokeSize * 2.5;
    } else if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = strokeSize * 3;
    }

    if (activeTool === 'line' && newPoints.length >= 2) {
      ctx.moveTo(newPoints[0].x, newPoints[0].y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    } else if (activeTool === 'arrow' && newPoints.length >= 2) {
      const from = newPoints[0];
      const to = point;
      const headlen = 16;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const angle = Math.atan2(dy, dx);
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.lineTo(to.x - headlen * Math.cos(angle - Math.PI / 6), to.y - headlen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - headlen * Math.cos(angle + Math.PI / 6), to.y - headlen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    } else if (activeTool === 'rect' && newPoints.length >= 2) {
      const start = newPoints[0];
      ctx.strokeRect(start.x, start.y, point.x - start.x, point.y - start.y);
    } else if (activeTool === 'circle' && newPoints.length >= 2) {
      const start = newPoints[0];
      const radius = Math.hypot(point.x - start.x, point.y - start.y);
      ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.moveTo(newPoints[0].x, newPoints[0].y);
      for (let i = 1; i < newPoints.length; i++) {
        ctx.lineTo(newPoints[i].x, newPoints[i].y);
      }
      ctx.stroke();
    }

    ctx.restore();
  };

  const handlePointerUp = () => {
    if (activeTool === 'laser') return;
    if (!isDrawing || currentPoints.length === 0) {
      setIsDrawing(false);
      return;
    }

    const newStroke: WhiteboardStroke = {
      id: 'stroke_' + Date.now(),
      tool: activeTool,
      points: currentPoints,
      color: activeColor,
      size: strokeSize,
      opacity: activeTool === 'highlighter' ? 0.4 : 1,
    };

    setStrokes((prev) => [...prev, newStroke]);
    setRedoStack([]);
    setIsDrawing(false);
    setCurrentPoints([]);
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setStrokes((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, last]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setStrokes((prev) => [...prev, next]);
  };

  const handleClear = () => {
    if (strokes.length === 0) return;
    setRedoStack([]);
    setStrokes([]);
  };

  // Background styling classes
  const getBgClass = () => {
    if (isOverlay) return 'bg-transparent';
    switch (backgroundTheme) {
      case 'blackboard':
        return 'blackboard-bg border border-emerald-900/60 text-slate-100 shadow-2xl';
      case 'graph':
        return 'bg-slate-900 graph-paper-bg border border-slate-800 text-slate-100 shadow-2xl';
      case 'white':
        return 'bg-slate-50 border border-slate-300 text-slate-900 shadow-2xl';
      case 'slate':
      default:
        return 'bg-slate-950 border border-slate-800 text-slate-100 shadow-2xl';
    }
  };

  return (
    <div
      id={id}
      ref={containerRef}
      className={`relative w-full h-full min-h-[500px] rounded-3xl overflow-hidden flex flex-col ${getBgClass()}`}
    >
      {/* Underlying Content or Blackboard Grid */}
      <div className="absolute inset-0 pointer-events-auto overflow-y-auto">
        {children}
      </div>

      {/* Drawing Canvas Layer */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="absolute inset-0 w-full h-full touch-canvas cursor-crosshair z-10"
      />

      {/* Laser Pointer Animated Glow */}
      {laserPos && (
        <div
          className="absolute pointer-events-none z-30 -translate-x-1/2 -translate-y-1/2"
          style={{ left: laserPos.x, top: laserPos.y }}
        >
          <div className="w-8 h-8 rounded-full bg-red-500/80 laser-dot flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
          </div>
        </div>
      )}

      {/* Floating 75-Inch Touch Toolbar (Collapsible Sleek Interface) */}
      {isToolbarCollapsed ? (
        <div className="absolute bottom-3 right-4 z-30 pointer-events-auto animate-fade-in flex items-center gap-2">
          <button
            id="restore-touch-toolbar-btn"
            onClick={() => setIsToolbarCollapsed(false)}
            className="px-4 py-2.5 rounded-full bg-slate-950/90 hover:bg-indigo-600 text-white font-bold text-xs md:text-sm flex items-center gap-2 shadow-2xl backdrop-blur-xl border-2 border-white/40 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Mở thanh công cụ viết/vẽ"
          >
            <Pen className="w-4 h-4 text-emerald-400" />
            <span>Mở Thanh Bút Viết & Vẽ</span>
          </button>
          {isOverlay && onCloseOverlay && (
            <button
              onClick={onCloseOverlay}
              className="px-3 py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 shadow-2xl border border-white/30 transition-all active:scale-95 cursor-pointer"
              title="Tắt chế độ vẽ đè"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Tắt Vẽ</span>
            </button>
          )}
        </div>
      ) : (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-2xl md:rounded-3xl bg-slate-950/95 backdrop-blur-2xl border-2 border-white/25 shadow-2xl text-white max-w-[98vw] overflow-x-auto custom-scrollbar-none shrink-0">
          {/* Tool Pickers */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              id="tool-pen-btn"
              onClick={() => setActiveTool('pen')}
              title="Bút phấn viết tự do"
              className={`p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-bold shrink-0 ${
                activeTool === 'pen' ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400' : 'hover:bg-white/10 text-slate-300'
              }`}
            >
              <Pen className="w-4 h-4" />
              <span className="hidden lg:inline text-[11px]">Bút Viết</span>
            </button>

            <button
              id="tool-highlighter-btn"
              onClick={() => setActiveTool('highlighter')}
              title="Bút dạ quang đánh dấu"
              className={`p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-bold shrink-0 ${
                activeTool === 'highlighter' ? 'bg-amber-500 text-white shadow-md ring-2 ring-amber-300' : 'hover:bg-white/10 text-slate-300'
              }`}
            >
              <Highlighter className="w-4 h-4" />
              <span className="hidden lg:inline text-[11px]">Dạ Quang</span>
            </button>

            <button
              id="tool-laser-btn"
              onClick={() => setActiveTool('laser')}
              title="Con trỏ Laser chỉ điểm"
              className={`p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-bold shrink-0 ${
                activeTool === 'laser' ? 'bg-red-600 text-white shadow-md ring-2 ring-red-400' : 'hover:bg-white/10 text-slate-300'
              }`}
            >
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span className="hidden xl:inline text-[11px]">Laser</span>
            </button>

            <button
              id="tool-eraser-btn"
              onClick={() => setActiveTool('eraser')}
              title="Cục tẩy nét vẽ"
              className={`p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-bold shrink-0 ${
                activeTool === 'eraser' ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400' : 'hover:bg-white/10 text-slate-300'
              }`}
            >
              <Eraser className="w-4 h-4" />
              <span className="hidden lg:inline text-[11px]">Khăn Lau</span>
            </button>
          </div>

          <div className="h-5 w-px bg-white/20 mx-0.5 shrink-0" />

          {/* Geometric Shapes */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              id="tool-line-btn"
              onClick={() => setActiveTool('line')}
              title="Đường thẳng"
              className={`p-2 rounded-xl transition-all text-xs font-bold flex items-center gap-1 shrink-0 ${activeTool === 'line' ? 'bg-purple-600 text-white ring-2 ring-purple-400' : 'hover:bg-white/10 text-purple-300'}`}
            >
              <Minus className="w-4 h-4" />
              <span className="hidden xl:inline text-[11px]">Thẳng</span>
            </button>
            <button
              id="tool-arrow-btn"
              onClick={() => setActiveTool('arrow')}
              title="Mũi tên chỉ dẫn"
              className={`p-2 rounded-xl transition-all text-xs font-bold flex items-center gap-1 shrink-0 ${activeTool === 'arrow' ? 'bg-purple-600 text-white ring-2 ring-purple-400' : 'hover:bg-white/10 text-purple-300'}`}
            >
              <MoveUpRight className="w-4 h-4" />
              <span className="hidden xl:inline text-[11px]">Mũi tên</span>
            </button>
            <button
              id="tool-rect-btn"
              onClick={() => setActiveTool('rect')}
              title="Hình chữ nhật"
              className={`p-2 rounded-xl transition-all text-xs font-bold flex items-center gap-1 shrink-0 ${activeTool === 'rect' ? 'bg-purple-600 text-white ring-2 ring-purple-400' : 'hover:bg-white/10 text-purple-300'}`}
            >
              <Square className="w-4 h-4" />
              <span className="hidden xl:inline text-[11px]">Chữ nhật</span>
            </button>
            <button
              id="tool-circle-btn"
              onClick={() => setActiveTool('circle')}
              title="Hình tròn / Elip"
              className={`p-2 rounded-xl transition-all text-xs font-bold flex items-center gap-1 shrink-0 ${activeTool === 'circle' ? 'bg-purple-600 text-white ring-2 ring-purple-400' : 'hover:bg-white/10 text-purple-300'}`}
            >
              <Circle className="w-4 h-4" />
              <span className="hidden xl:inline text-[11px]">Hình tròn</span>
            </button>
          </div>

          <div className="h-5 w-px bg-white/20 mx-0.5 shrink-0" />

          {/* Color Palette */}
          <div className="flex items-center gap-1.5 shrink-0">
            {colors.map((c) => (
              <button
                key={c.value}
                id={`color-btn-${c.value.replace('#', '')}`}
                onClick={() => {
                  setActiveColor(c.value);
                  if (activeTool === 'eraser') setActiveTool('pen');
                }}
                title={c.label}
                style={{ backgroundColor: c.value }}
                className={`w-6 h-6 rounded-full transition-all border-2 ${
                  activeColor === c.value ? 'scale-125 border-white ring-2 ring-white/60 shadow-md' : 'border-white/40 hover:scale-110 opacity-80 hover:opacity-100'
                }`}
              />
            ))}
          </div>

          <div className="h-5 w-px bg-white/20 mx-0.5 shrink-0" />

          {/* Stroke Width Selector */}
          <div className="flex items-center gap-1 shrink-0">
            {[2, 4, 8, 14].map((sz) => (
              <button
                key={sz}
                id={`stroke-sz-${sz}`}
                onClick={() => setStrokeSize(sz)}
                title={`Độ dày: ${sz}px`}
                className={`w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                  strokeSize === sz ? 'bg-white text-slate-900 shadow-md font-black' : 'hover:bg-white/10 text-slate-300'
                }`}
              >
                {sz}p
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-white/20 mx-0.5 shrink-0" />

          {/* Canvas Actions: Undo, Redo, Clear */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              id="whiteboard-undo-btn"
              onClick={handleUndo}
              disabled={strokes.length === 0}
              title="Hoàn tác (Undo)"
              className={`p-2 rounded-xl flex items-center gap-1 font-bold text-xs transition-all ${
                strokes.length > 0
                  ? 'bg-white/15 hover:bg-white/25 text-amber-300 hover:scale-105 active:scale-95'
                  : 'text-slate-500 opacity-40 cursor-not-allowed'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span className="text-[10px] hidden lg:inline">Undo</span>
            </button>

            <button
              id="whiteboard-clear-btn"
              onClick={handleClear}
              disabled={strokes.length === 0}
              title="Xóa toàn bộ nét vẽ"
              className={`p-2 rounded-xl flex items-center gap-1 font-bold text-xs transition-all ${
                strokes.length > 0
                  ? 'bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white'
                  : 'text-slate-500 opacity-40 cursor-not-allowed'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-[10px] hidden lg:inline">Xóa Bảng</span>
            </button>

            {/* Blackboard Theme Switcher */}
            {onBackgroundChange && (
              <button
                id="whiteboard-theme-btn"
                onClick={() => {
                  const themes: Array<'blackboard' | 'slate' | 'graph' | 'white'> = ['blackboard', 'graph', 'slate', 'white'];
                  const currentIdx = themes.indexOf(backgroundTheme as any);
                  const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % themes.length;
                  const nextTheme = themes[nextIdx] ?? 'blackboard';
                  onBackgroundChange(nextTheme);
                }}
                title="Đổi nền bảng"
                className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold flex items-center gap-1"
              >
                <Grid className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden xl:inline text-[11px]">
                  {backgroundTheme === 'blackboard' ? 'Bảng xanh' : backgroundTheme === 'graph' ? 'Ô ly' : backgroundTheme === 'white' ? 'Trắng' : 'Tối'}
                </span>
              </button>
            )}

            {/* Close / Collapse Toolbar Button */}
            <button
              id="collapse-touch-toolbar-btn"
              onClick={() => {
                if (isOverlay && onCloseOverlay) {
                  onCloseOverlay();
                } else {
                  setIsToolbarCollapsed(true);
                }
              }}
              title={isOverlay && onCloseOverlay ? "Tắt chế độ vẽ đè" : "Thu gọn thanh công cụ"}
              className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 shadow-md transition-all ml-1 active:scale-95 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span className="text-[11px]">{isOverlay && onCloseOverlay ? "Tắt vẽ" : "Thu gọn"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
