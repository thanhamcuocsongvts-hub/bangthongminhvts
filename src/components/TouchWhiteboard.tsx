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
} from 'lucide-react';
import { WhiteboardStroke, WhiteboardTool, StrokePoint } from '../types';

interface TouchWhiteboardProps {
  id?: string;
  isOverlay?: boolean;
  backgroundTheme?: 'blackboard' | 'slate' | 'graph' | 'white';
  onBackgroundChange?: (theme: 'blackboard' | 'slate' | 'graph' | 'white') => void;
  children?: React.ReactNode;
}

export const TouchWhiteboard: React.FC<TouchWhiteboardProps> = ({
  id = 'interactive-whiteboard-area',
  isOverlay = false,
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
        <button
          id="restore-touch-toolbar-btn"
          onClick={() => setIsToolbarCollapsed(false)}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-slate-900/90 hover:bg-slate-950 text-white font-bold text-xs flex items-center gap-2 shadow-2xl backdrop-blur-md border border-slate-700/80 transition-all active:scale-95 animate-bounce hover:animate-none"
          title="Mở thanh công cụ viết/vẽ"
        >
          <Pen className="w-4 h-4 text-amber-400" />
          <span>Mở Hộp Bút Viết & Vẽ</span>
        </button>
      ) : (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl max-w-[96vw]">
          {/* Tool Pickers */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              id="tool-pen-btn"
              onClick={() => setActiveTool('pen')}
              title="Bút vẽ (Pen)"
              className={`p-2 rounded-lg transition-all flex items-center gap-1 text-xs font-bold ${
                activeTool === 'pen' ? 'bg-indigo-600 text-white shadow-sm scale-105' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Pen className="w-4 h-4" />
              <span className="hidden md:inline">Bút</span>
            </button>

            <button
              id="tool-highlighter-btn"
              onClick={() => setActiveTool('highlighter')}
              title="Bút dạ quang (Highlighter)"
              className={`p-2 rounded-lg transition-all flex items-center gap-1 text-xs font-bold ${
                activeTool === 'highlighter' ? 'bg-amber-500 text-white shadow-sm scale-105' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Highlighter className="w-4 h-4" />
              <span className="hidden md:inline">Dạ quang</span>
            </button>

            <button
              id="tool-laser-btn"
              onClick={() => setActiveTool('laser')}
              title="Con trỏ Laser chỉ điểm"
              className={`p-2 rounded-lg transition-all flex items-center gap-1 text-xs font-bold ${
                activeTool === 'laser' ? 'bg-red-600 text-white shadow-sm scale-105' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span className="hidden md:inline">Laser</span>
            </button>

            <button
              id="tool-eraser-btn"
              onClick={() => setActiveTool('eraser')}
              title="Cục tẩy nét vẽ"
              className={`p-2 rounded-lg transition-all flex items-center gap-1 text-xs font-bold ${
                activeTool === 'eraser' ? 'bg-rose-600 text-white shadow-sm scale-105' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Eraser className="w-4 h-4" />
              <span className="hidden md:inline">Tẩy</span>
            </button>
          </div>

          {/* Geometric Shapes */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              id="tool-line-btn"
              onClick={() => setActiveTool('line')}
              title="Đường thẳng"
              className={`p-1.5 rounded-lg ${activeTool === 'line' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              id="tool-arrow-btn"
              onClick={() => setActiveTool('arrow')}
              title="Mũi tên chỉ dẫn"
              className={`p-1.5 rounded-lg ${activeTool === 'arrow' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}
            >
              <MoveUpRight className="w-4 h-4" />
            </button>
            <button
              id="tool-rect-btn"
              onClick={() => setActiveTool('rect')}
              title="Hình chữ nhật"
              className={`p-1.5 rounded-lg ${activeTool === 'rect' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}
            >
              <Square className="w-4 h-4" />
            </button>
            <button
              id="tool-circle-btn"
              onClick={() => setActiveTool('circle')}
              title="Hình tròn / Elip"
              className={`p-1.5 rounded-lg ${activeTool === 'circle' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}
            >
              <Circle className="w-4 h-4" />
            </button>
          </div>

          {/* Color Palette (Large Touch Dots) */}
          <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1.5 rounded-xl border border-slate-200">
            {colors.map((c) => (
              <button
                key={c.value}
                id={`color-btn-${c.value.replace('#', '')}`}
                onClick={() => setActiveColor(c.value)}
                title={c.label}
                style={{ backgroundColor: c.value }}
                className={`w-6 h-6 rounded-full transition-all border-2 ${
                  activeColor === c.value ? 'scale-125 border-slate-900 ring-2 ring-indigo-400 shadow-sm' : 'border-slate-300 hover:scale-110'
                }`}
              />
            ))}
          </div>

          {/* Stroke Width Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {[2, 4, 8, 14].map((sz) => (
              <button
                key={sz}
                id={`stroke-sz-${sz}`}
                onClick={() => setStrokeSize(sz)}
                title={`Độ dày: ${sz}px`}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                  strokeSize === sz ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <div
                  style={{ width: `${Math.min(sz * 1.5, 12)}px`, height: `${Math.min(sz * 1.5, 12)}px` }}
                  className="bg-current rounded-full"
                />
              </button>
            ))}
          </div>

          {/* Canvas Actions: Undo, Redo, Clear */}
          <div className="flex items-center gap-1">
            <button
              id="whiteboard-undo-btn"
              onClick={handleUndo}
              disabled={strokes.length === 0}
              title="Hoàn tác (Undo)"
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:pointer-events-none border border-slate-200"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              id="whiteboard-clear-btn"
              onClick={handleClear}
              disabled={strokes.length === 0}
              title="Xóa toàn bộ nét vẽ"
              className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 disabled:opacity-30 disabled:pointer-events-none"
            >
              <Trash2 className="w-4 h-4" />
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
                className="px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1"
              >
                <Grid className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden xl:inline">
                  {backgroundTheme === 'blackboard' ? 'Bảng xanh' : backgroundTheme === 'graph' ? 'Ô ly' : backgroundTheme === 'white' ? 'Trắng' : 'Tối'}
                </span>
              </button>
            )}

            {/* Collapse Toolbar Button */}
            <button
              id="collapse-touch-toolbar-btn"
              onClick={() => setIsToolbarCollapsed(true)}
              title="Thu gọn thanh công cụ để nhìn rộng bảng"
              className="p-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-600 hover:text-slate-900 border border-slate-300"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
