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
  ChevronDown,
  ChevronUp,
  Pipette,
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
  const [showColorPopover, setShowColorPopover] = useState<boolean>(false);
  const colorPopoverRef = useRef<HTMLDivElement | null>(null);

  // Close color popover on outside click/tap
  useEffect(() => {
    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      if (colorPopoverRef.current && !colorPopoverRef.current.contains(e.target as Node)) {
        setShowColorPopover(false);
      }
    };
    if (showColorPopover) {
      document.addEventListener('mousedown', handlePointerDownOutside);
      document.addEventListener('touchstart', handlePointerDownOutside);
      return () => {
        document.removeEventListener('mousedown', handlePointerDownOutside);
        document.removeEventListener('touchstart', handlePointerDownOutside);
      };
    }
  }, [showColorPopover]);

  // Laser pointer position state
  const [laserPos, setLaserPos] = useState<{ x: number; y: number } | null>(null);
  const laserTimeoutRef = useRef<any>(null);

  // Quick palette colors (17 màu - gồm 3 màu dạ quang siêu sáng phát sáng trên bảng)
  const colors = [
    // 3 Màu dạ quang siêu sáng
    { label: '🌟 Dạ Quang Vàng Chanh', value: '#ccff00', isFluorescent: true },
    { label: '🌟 Dạ Quang Hồng Neon', value: '#ff007f', isFluorescent: true },
    { label: '🌟 Dạ Quang Xanh Ngọc', value: '#00ffff', isFluorescent: true },
    // 14 Màu tiêu chuẩn & mở rộng
    { label: 'Trắng Tinh Khôi', value: '#ffffff' },
    { label: 'Vàng Hoàng Yến', value: '#facc15' },
    { label: 'Vàng Hổ Phách Gold', value: '#f59e0b' },
    { label: 'Cam Rực Rỡ', value: '#fb923c' },
    { label: 'Cam San Hô Đào', value: '#fb7185' },
    { label: 'Đỏ Cờ Tươi', value: '#ef4444' },
    { label: 'Đỏ Hồng Phấn', value: '#f87171' },
    { label: 'Tím Mộng Mơ', value: '#c084fc' },
    { label: 'Tím Tử Đinh Hương', value: '#8b5cf6' },
    { label: 'Xanh Lam Hoàng Gia', value: '#2563eb' },
    { label: 'Cyan Sáng', value: '#38bdf8' },
    { label: 'Xanh Bạc Hà Tươi', value: '#2dd4bf' },
    { label: 'Xanh Non Tươi', value: '#4ade80' },
    { label: 'Xanh Lục Bảo', value: '#10b981' },
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

        const isFluo = stroke.color === '#ccff00' || stroke.color === '#ff007f' || stroke.color === '#00ffff';

        if (stroke.tool === 'highlighter') {
          ctx.globalAlpha = isFluo ? 0.65 : (stroke.opacity || 0.4);
          ctx.lineWidth = stroke.size * 2.5;
          if (isFluo) {
            ctx.shadowColor = stroke.color;
            ctx.shadowBlur = 12;
          }
        } else if (stroke.tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.lineWidth = stroke.size * 3;
        } else {
          ctx.globalAlpha = 1;
          if (isFluo) {
            ctx.shadowColor = stroke.color;
            ctx.shadowBlur = 8;
          }
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

    const isLiveFluo = activeColor === '#ccff00' || activeColor === '#ff007f' || activeColor === '#00ffff';

    if (activeTool === 'highlighter') {
      ctx.globalAlpha = isLiveFluo ? 0.65 : 0.4;
      ctx.lineWidth = strokeSize * 2.5;
      if (isLiveFluo) {
        ctx.shadowColor = activeColor;
        ctx.shadowBlur = 12;
      }
    } else if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = strokeSize * 3;
    } else if (isLiveFluo) {
      ctx.shadowColor = activeColor;
      ctx.shadowBlur = 8;
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
      className={`relative w-full h-full ${
        isOverlay ? 'rounded-none min-h-0 bg-transparent' : `min-h-[500px] rounded-3xl ${getBgClass()}`
      } overflow-hidden flex flex-col`}
    >
      {/* Underlying Content or Blackboard Grid */}
      {children && (
        <div className="absolute inset-0 pointer-events-auto overflow-y-auto">
          {children}
        </div>
      )}

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
        <div className="absolute bottom-3 right-4 z-40 pointer-events-auto animate-fade-in flex items-center gap-2">
          <button
            id="restore-touch-toolbar-btn"
            onClick={() => setIsToolbarCollapsed(false)}
            className="px-4 py-2.5 rounded-2xl bg-slate-950/95 hover:bg-indigo-600 text-white font-black text-xs md:text-sm flex items-center gap-2 shadow-2xl backdrop-blur-xl border-2 border-indigo-400/80 transition-all hover:scale-105 active:scale-95 cursor-pointer ring-4 ring-indigo-500/20"
            title="Mở toàn bộ thanh công cụ viết/vẽ"
          >
            <div
              className="w-3.5 h-3.5 rounded-full border border-white shrink-0"
              style={{
                backgroundColor: activeColor,
                boxShadow: ['#ccff00', '#ff007f', '#00ffff'].includes(activeColor) ? `0 0 8px ${activeColor}` : undefined,
              }}
            />
            <Pen className="w-4 h-4 text-emerald-400" />
            <span>Mở Thanh Công Cụ</span>
            <ChevronUp className="w-4 h-4 text-amber-300" />
          </button>
          {isOverlay && onCloseOverlay && (
            <button
              onClick={onCloseOverlay}
              className="px-3.5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xl border border-white/30 transition-all active:scale-95 cursor-pointer"
              title="Tắt chế độ vẽ đè trên tài liệu"
            >
              <X className="w-4 h-4" />
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

          {/* Compact Color Palette (Thu gọn bảng màu, khi chọn thì hiển thị popover & có thêm chọn màu RGB/Hex) */}
          <div className="relative shrink-0" ref={colorPopoverRef}>
            <div className="flex items-center gap-1">
              <button
                id="open-color-popover-btn"
                onClick={() => setShowColorPopover((prev) => !prev)}
                title="Bảng màu phấn & dạ quang (Nhấn để mở chọn màu)"
                className={`px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all text-xs font-bold border cursor-pointer ${
                  showColorPopover
                    ? 'bg-white text-slate-900 border-white shadow-lg ring-2 ring-white/60 font-black'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/25'
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full border border-white/90 shadow-sm shrink-0 transition-all"
                  style={{
                    backgroundColor: activeColor,
                    boxShadow: ['#ccff00', '#ff007f', '#00ffff'].includes(activeColor)
                      ? `0 0 8px ${activeColor}`
                      : undefined,
                  }}
                />
                <Palette className="w-3.5 h-3.5 text-amber-300" />
                <span className="text-[11px] hidden sm:inline">Màu</span>
                <ChevronUp className={`w-3.5 h-3.5 transition-transform ${showColorPopover ? 'rotate-180' : ''}`} />
              </button>

              {/* 3 Nút tắt nhanh màu phấn cốt lõi (Trắng, Vàng, Dạ quang chanh) */}
              <div className="hidden sm:flex items-center gap-1 shrink-0 pl-0.5">
                {[
                  { val: '#ffffff', title: 'Phấn trắng' },
                  { val: '#facc15', title: 'Phấn vàng' },
                  { val: '#ccff00', title: 'Dạ quang chanh', isGlow: true },
                ].map((sw) => (
                  <button
                    key={sw.val}
                    onClick={() => {
                      setActiveColor(sw.val);
                      if (activeTool === 'eraser') setActiveTool('pen');
                    }}
                    title={sw.title}
                    className={`w-5 h-5 rounded-full border transition-all cursor-pointer ${
                      activeColor === sw.val
                        ? 'scale-125 border-white ring-2 ring-white shadow-md'
                        : 'border-white/40 opacity-75 hover:opacity-100 hover:scale-110'
                    }`}
                    style={{
                      backgroundColor: sw.val,
                      boxShadow: sw.isGlow ? `0 0 6px ${sw.val}` : undefined,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Popover Bảng Màu Phấn, Dạ Quang & Chọn Màu Tùy Thích */}
            {showColorPopover && (
              <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 z-50 p-4 rounded-3xl bg-slate-950/98 backdrop-blur-2xl border-2 border-white/30 shadow-2xl w-[320px] sm:w-[360px] text-white flex flex-col gap-3 select-none animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-white/15">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-black uppercase text-slate-200 tracking-wider">
                      BẢNG MÀU PHẤN & DẠ QUANG
                    </span>
                  </div>
                  <button
                    onClick={() => setShowColorPopover(false)}
                    className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Tính Năng Chọn Màu Tự Do / Color Wheel Picker */}
                <div className="p-2.5 rounded-2xl bg-white/5 border border-white/15 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-cyan-300 tracking-wider flex items-center gap-1.5">
                      <Pipette className="w-3.5 h-3.5 text-cyan-400" />
                      TÙY CHỌN MÀU BẤT KỲ (DẢI RGB)
                    </span>
                    <span className="text-[9px] font-mono text-slate-300 bg-white/10 px-1.5 py-0.5 rounded-md font-bold">
                      {activeColor.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="relative w-9 h-9 rounded-xl overflow-hidden border-2 border-white/50 shadow-md shrink-0 cursor-pointer">
                      <input
                        type="color"
                        id="custom-color-picker-input"
                        value={activeColor.startsWith('#') && activeColor.length === 7 ? activeColor : '#ffffff'}
                        onChange={(e) => {
                          setActiveColor(e.target.value);
                          if (activeTool === 'eraser') setActiveTool('pen');
                        }}
                        className="absolute -top-3 -left-3 w-16 h-16 cursor-pointer border-0 bg-transparent"
                        title="Bấm để chọn màu bất kỳ từ dải màu RGB"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="text-[10.5px] font-medium text-slate-300 leading-snug">
                        Bấm ô vuông bên trái để mở dải màu sắc tự do hoặc nhập mã Hex:
                      </div>
                      <input
                        type="text"
                        value={activeColor}
                        onChange={(e) => {
                          const val = e.target.value;
                          setActiveColor(val);
                          if (activeTool === 'eraser') setActiveTool('pen');
                        }}
                        placeholder="#ffffff"
                        className="mt-1 w-full px-2 py-1 rounded-lg bg-black/40 border border-white/20 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                </div>

                {/* 3 MÀU DẠ QUANG PHÁT SÁNG CỰC ĐẸP TRÊN BẢNG */}
                <div className="p-2.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-cyan-500/15 border border-amber-400/40 space-y-1.5 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-amber-300 tracking-wider flex items-center gap-1">
                      <span>✨</span> 3 MÀU DẠ QUANG SIÊU SÁNG
                    </span>
                    <span className="text-[8.5px] px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-200 font-bold border border-amber-400/30">
                      Glow Neon
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {colors.filter((cp) => cp.isFluorescent).map((cp) => (
                      <button
                        key={cp.value}
                        onClick={() => {
                          setActiveColor(cp.value);
                          if (activeTool === 'eraser') setActiveTool('pen');
                          setShowColorPopover(false);
                        }}
                        className={`p-2 rounded-2xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activeColor === cp.value
                            ? 'bg-white/25 ring-2 ring-white scale-105 shadow-lg'
                            : 'hover:bg-white/10 hover:scale-102'
                        }`}
                      >
                        <div
                          className="w-7 h-7 rounded-full border-2 border-white shadow-lg relative flex items-center justify-center"
                          style={{
                            backgroundColor: cp.value,
                            boxShadow: `0 0 10px ${cp.value}, inset 0 0 4px #ffffff`,
                          }}
                        >
                          <span className="text-[9px] drop-shadow-md">✨</span>
                        </div>
                        <span className="text-[9px] font-black text-center text-white leading-tight">
                          {cp.label.replace('🌟 Dạ Quang ', '')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 14 MÀU PHẤN TIÊU CHUẨN */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    MÀU PHẤN BẢNG TIÊU CHUẨN (14 MÀU)
                  </span>
                  <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar-none">
                    {colors.filter((cp) => !cp.isFluorescent).map((cp) => (
                      <button
                        key={cp.value}
                        onClick={() => {
                          setActiveColor(cp.value);
                          if (activeTool === 'eraser') setActiveTool('pen');
                          setShowColorPopover(false);
                        }}
                        title={cp.label}
                        className={`p-1.5 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activeColor === cp.value
                            ? 'bg-white/25 ring-2 ring-white scale-105 shadow-md'
                            : 'hover:bg-white/10'
                        }`}
                      >
                        <div
                          className="w-5 h-5 rounded-full border border-white/70 shadow-inner"
                          style={{ backgroundColor: cp.value }}
                        />
                        <span className="text-[8px] font-bold text-slate-300 truncate max-w-[42px] text-center">
                          {cp.label.split(' ')[0]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
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
                className={`w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-mono font-bold transition-all cursor-pointer ${
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
              className={`p-2 rounded-xl flex items-center gap-1 font-bold text-xs transition-all cursor-pointer ${
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
              className={`p-2 rounded-xl flex items-center gap-1 font-bold text-xs transition-all cursor-pointer ${
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
                className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Grid className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden xl:inline text-[11px]">
                  {backgroundTheme === 'blackboard' ? 'Bảng xanh' : backgroundTheme === 'graph' ? 'Ô ly' : backgroundTheme === 'white' ? 'Trắng' : 'Tối'}
                </span>
              </button>
            )}

            {/* Nút Thu Gọn Toàn Thanh Công Cụ (Bên Phải) */}
            <button
              id="collapse-touch-toolbar-btn"
              onClick={() => {
                setIsToolbarCollapsed(true);
                setShowColorPopover(false);
              }}
              title="Thu gọn toàn bộ thanh công cụ"
              className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-amber-300 hover:text-white font-bold text-xs flex items-center gap-1 border border-white/20 shadow-md transition-all active:scale-95 cursor-pointer ml-1 shrink-0"
            >
              <ChevronDown className="w-4 h-4 text-amber-400" />
              <span className="text-[11px] font-bold">Thu Gọn</span>
            </button>

            {/* Tắt Chế Độ Vẽ Đè (Nếu là Overlay) */}
            {isOverlay && onCloseOverlay && (
              <button
                id="close-overlay-touch-btn"
                onClick={onCloseOverlay}
                title="Tắt chế độ vẽ đè trên tài liệu"
                className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 shadow-md transition-all ml-1 active:scale-95 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
                <span className="text-[11px]">Tắt Vẽ</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
