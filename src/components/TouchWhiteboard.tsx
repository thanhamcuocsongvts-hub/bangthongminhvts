import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  MousePointer2,
  Hand,
  PenLine,
  Highlighter,
  Sparkles,
  Type,
  Shapes,
  TrendingUp,
  Palette,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  RotateCw,
  Trash2,
  X,
  Minus,
  MoveUpRight,
  MoveRight,
  Square,
  Circle,
  Box,
  Pipette,
  Grid,
  ZoomIn,
  ZoomOut,
  Triangle,
  Globe,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Move,
  Sliders,
} from 'lucide-react';
import { WhiteboardStroke, WhiteboardTool, StrokePoint } from '../types';
import { isFunctionGraphTool, drawFunctionGraph } from '../utils/mathGraphRenderer';

interface TouchWhiteboardProps {
  id?: string;
  isOverlay?: boolean;
  onCloseOverlay?: () => void;
  backgroundTheme?: 'blackboard' | 'slate' | 'graph' | 'white';
  onBackgroundChange?: (theme: 'blackboard' | 'slate' | 'graph' | 'white') => void;
  children?: React.ReactNode;
}

interface WhiteboardText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
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
  const [strokeSize, setStrokeSize] = useState<number>(2);
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [redoStack, setRedoStack] = useState<WhiteboardStroke[]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentPoints, setCurrentPoints] = useState<StrokePoint[]>([]);

  // Text items support
  const [texts, setTexts] = useState<WhiteboardText[]>([]);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);

  // Dock Collapse & Popovers state (matching ClassroomBlackboardView)
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [showShapePicker, setShowShapePicker] = useState<boolean>(false);
  const [showFunctionPicker, setShowFunctionPicker] = useState<boolean>(false);
  const [showColorPopover, setShowColorPopover] = useState<boolean>(false);
  const [showSizePopover, setShowSizePopover] = useState<boolean>(false);

  const dockRef = useRef<HTMLDivElement | null>(null);

  // Laser pointer position state
  const [laserPos, setLaserPos] = useState<{ x: number; y: number } | null>(null);
  const laserTimeoutRef = useRef<any>(null);

  // Smoothing & Calligraphy tracking refs
  const lastSmoothedRef = useRef<StrokePoint | null>(null);
  const lastTimeRef = useRef<number>(0);
  const lastVelocityRef = useRef<number>(0);

  // Selected stroke / drawn shape & interactive transformation state
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const [moveSpeed, setMoveSpeed] = useState<number>(15);
  const [isStrokeToolbarExpanded, setIsStrokeToolbarExpanded] = useState<boolean>(true);
  const [isDraggingStroke, setIsDraggingStroke] = useState<boolean>(false);
  const [isResizingStroke, setIsResizingStroke] = useState<boolean>(false);
  const dragStrokeStartRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    origPoints: StrokePoint[];
    centerX: number;
    centerY: number;
    origRotation: number;
  } | null>(null);
  const resizeStrokeStartRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    origScale: number;
    origBounds: { centerX: number; centerY: number; width: number; height: number };
    direction: string;
  } | null>(null);
  const strokeRafRef = useRef<number | null>(null);
  const continuousNudgeIntervalRef = useRef<any>(null);

  // Helper to compute bounding box for any stroke or shape
  const getStrokeBounds = useCallback((stroke: WhiteboardStroke) => {
    if (stroke.tool === 'circle') {
      let cx = 0, cy = 0, radius = 20;
      if (stroke.points && stroke.points.length >= 2) {
        const p1 = stroke.points[0];
        const p2 = stroke.points[stroke.points.length - 1];
        cx = p1.x;
        cy = p1.y;
        radius = Math.max(10, Math.hypot(p2.x - p1.x, p2.y - p1.y));
      }
      const padding = 12;
      return {
        minX: cx - radius - padding,
        maxX: cx + radius + padding,
        minY: cy - radius - padding,
        maxY: cy + radius + padding,
        centerX: cx,
        centerY: cy,
        width: (radius + padding) * 2,
        height: (radius + padding) * 2,
        radius,
      };
    }

    if (stroke.tool === 'ellipse') {
      let cx = 0, cy = 0, rx = 30, ry = 20;
      if (stroke.points && stroke.points.length >= 2) {
        const p1 = stroke.points[0];
        const p2 = stroke.points[stroke.points.length - 1];
        cx = (p1.x + p2.x) / 2;
        cy = (p1.y + p2.y) / 2;
        rx = Math.max(10, Math.abs(p2.x - p1.x) / 2);
        ry = Math.max(10, Math.abs(p2.y - p1.y) / 2);
      }
      const padding = 12;
      return {
        minX: cx - rx - padding,
        maxX: cx + rx + padding,
        minY: cy - ry - padding,
        maxY: cy + ry + padding,
        centerX: cx,
        centerY: cy,
        width: (rx + padding) * 2,
        height: (ry + padding) * 2,
        rx,
        ry,
      };
    }

    if (!stroke.points || stroke.points.length === 0) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    stroke.points.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    if (maxX - minX < 24) {
      const padX = (24 - (maxX - minX)) / 2;
      minX -= padX;
      maxX += padX;
    }
    if (maxY - minY < 24) {
      const padY = (24 - (maxY - minY)) / 2;
      minY -= padY;
      maxY += padY;
    }

    const padding = 12;
    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  }, []);

  // Nudge selected stroke smoothly
  const handleNudgeStroke = useCallback((deltaX: number, deltaY: number) => {
    if (!selectedStrokeId) return;
    setStrokes((prev) =>
      prev.map((s) => {
        if (s.id === selectedStrokeId) {
          const movedPoints = s.points ? s.points.map((p) => ({ ...p, x: p.x + deltaX, y: p.y + deltaY })) : [];
          return {
            ...s,
            points: movedPoints,
            centerX: s.centerX ? s.centerX + deltaX : undefined,
            centerY: s.centerY ? s.centerY + deltaY : undefined,
          };
        }
        return s;
      })
    );
  }, [selectedStrokeId]);

  // Continuous hold-to-move controller for 4-way navigation buttons
  const startContinuousNudge = useCallback((deltaXRatio: number, deltaYRatio: number) => {
    handleNudgeStroke(deltaXRatio * moveSpeed, deltaYRatio * moveSpeed);
    if (continuousNudgeIntervalRef.current) clearInterval(continuousNudgeIntervalRef.current);
    continuousNudgeIntervalRef.current = setInterval(() => {
      handleNudgeStroke(deltaXRatio * moveSpeed, deltaYRatio * moveSpeed);
    }, 60);
  }, [handleNudgeStroke, moveSpeed]);

  const stopContinuousNudge = useCallback(() => {
    if (continuousNudgeIntervalRef.current) {
      clearInterval(continuousNudgeIntervalRef.current);
      continuousNudgeIntervalRef.current = null;
    }
  }, []);

  // Center selected stroke to the current visible viewport
  const handleCenterStroke = useCallback(() => {
    if (!selectedStrokeId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const targetStroke = strokes.find((s) => s.id === selectedStrokeId);
    if (!targetStroke) return;
    const bounds = getStrokeBounds(targetStroke);
    if (!bounds) return;

    const visibleCenterX = canvas.width / (2 * (window.devicePixelRatio || 1));
    const visibleCenterY = canvas.height / (2 * (window.devicePixelRatio || 1));
    const deltaX = Math.round(visibleCenterX - bounds.centerX);
    const deltaY = Math.round(visibleCenterY - bounds.centerY);
    handleNudgeStroke(deltaX, deltaY);
  }, [selectedStrokeId, strokes, getStrokeBounds, handleNudgeStroke]);

  // Handle shape corner resize
  const handleShapeResizePointerDown = (e: React.PointerEvent, direction: string) => {
    e.stopPropagation();
    if (!selectedStrokeId) return;
    const selectedStroke = strokes.find((s) => s.id === selectedStrokeId);
    if (!selectedStroke) return;
    const bounds = getStrokeBounds(selectedStroke);
    if (!bounds) return;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}

    setIsResizingStroke(true);
    resizeStrokeStartRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      origScale: selectedStroke.scale || 1,
      origBounds: { centerX: bounds.centerX, centerY: bounds.centerY, width: bounds.width, height: bounds.height },
      direction,
    };
  };

  const handleShapeResizePointerMove = (e: React.PointerEvent) => {
    if (!isResizingStroke || !resizeStrokeStartRef.current || !selectedStrokeId) return;
    e.stopPropagation();
    const { startMouseX, startMouseY, origScale, origBounds, direction } = resizeStrokeStartRef.current;
    const dx = e.clientX - startMouseX;
    const dy = e.clientY - startMouseY;
    const signX = direction.includes('e') ? 1 : direction.includes('w') ? -1 : 0;
    const signY = direction.includes('s') ? 1 : direction.includes('n') ? -1 : 0;
    const factorX = signX !== 0 ? (dx * signX) / Math.max(origBounds.width, 60) : 0;
    const factorY = signY !== 0 ? (dy * signY) / Math.max(origBounds.height, 60) : 0;
    const factor = Math.max(factorX, factorY) || factorX || factorY;
    const newScale = Math.max(0.15, Math.min(6.0, Number((origScale * (1 + factor)).toFixed(2))));

    if (strokeRafRef.current) cancelAnimationFrame(strokeRafRef.current);
    strokeRafRef.current = requestAnimationFrame(() => {
      setStrokes((prev) =>
        prev.map((s) => (s.id === selectedStrokeId ? { ...s, scale: newScale } : s))
      );
    });
  };

  const handleShapeResizePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
    setIsResizingStroke(false);
    resizeStrokeStartRef.current = null;
  };

  // 17 Authentic Chalk & Neon Fluorescent Colors (matching ClassroomBlackboardView)
  const colors = [
    // 3 Siêu Phẩm Dạ Quang Neon Glow
    { label: '🌟 Dạ Quang Vàng Chanh', value: '#ccff00', isFluorescent: true },
    { label: '🌟 Dạ Quang Hồng Neon', value: '#ff007f', isFluorescent: true },
    { label: '🌟 Dạ Quang Xanh Ngọc', value: '#00ffff', isFluorescent: true },
    // 14 Màu Tiêu Chuẩn & Nâng Cao
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

  // Close popovers on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setShowShapePicker(false);
        setShowFunctionPicker(false);
        setShowColorPopover(false);
        setShowSizePopover(false);
      }
    };
    if (showShapePicker || showFunctionPicker || showColorPopover || showSizePopover) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
      return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
        document.removeEventListener('touchstart', handleOutsideClick);
      };
    }
  }, [showShapePicker, showFunctionPicker, showColorPopover, showSizePopover]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'Escape') {
        if (isOverlay && onCloseOverlay) {
          onCloseOverlay();
        }
      } else if (e.key === 'v' || e.key === 'V' || e.key === 's' || e.key === 'S') {
        setActiveTool('select');
      } else if (e.key === 'b' || e.key === 'B' || e.key === 'p' || e.key === 'P') {
        setActiveTool('pen');
      } else if (e.key === 'h' || e.key === 'H') {
        setActiveTool('highlighter');
      } else if (e.key === 'e' || e.key === 'E') {
        setActiveTool('eraser');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOverlay, onCloseOverlay, strokes, redoStack]);

  /**
   * High-End Calligraphy & Bezier Smoothing Renderer
   * Eliminates jitter and produces graceful calligraphy with tapered strokes and smooth curves
   */
  const renderSingleStroke = (
    ctx: CanvasRenderingContext2D,
    tool: WhiteboardTool,
    points: StrokePoint[],
    color: string,
    size: number,
    scale: number = 1,
    rotation: number = 0
  ) => {
    if (!points || points.length === 0) return;

    ctx.save();

    // Center of points for rotation & scale
    let cx = 0, cy = 0;
    points.forEach((p) => { cx += p.x; cy += p.y; });
    cx /= points.length;
    cy /= points.length;

    if (rotation) {
      ctx.translate(cx, cy);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    if (scale !== 1 && !isFunctionGraphTool(tool)) {
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
    }

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const isFluo = color === '#ccff00' || color === '#ff007f' || color === '#00ffff';

    if (tool === 'highlighter') {
      ctx.globalAlpha = isFluo ? 0.65 : 0.45;
      ctx.lineWidth = size * 2.8;
      if (isFluo) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
      }
    } else if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = size * 3;
    } else {
      ctx.globalAlpha = 1.0;
      if (isFluo) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
      }
    }

    // Mathematical Function Graph Curves
    if (isFunctionGraphTool(tool)) {
      let renderPts = points;
      if (!points || points.length === 1) {
        const p = points[0] || { x: 150, y: 150 };
        renderPts = [p, { x: p.x + 300, y: p.y + 240 }];
      }
      drawFunctionGraph(ctx, tool, renderPts, color, size, scale);
      ctx.restore();
      return;
    }

    const p1 = points[0];
    const p2 = points[points.length - 1];

    // 2D Plane Shapes
    if ((tool === 'rectangle' || tool === 'rect') && points.length >= 2) {
      ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    } else if (tool === 'circle' && points.length >= 2) {
      const radius = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (tool === 'ellipse' && points.length >= 2) {
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const rx = Math.max(4, Math.abs(p2.x - p1.x) / 2);
      const ry = Math.max(4, Math.abs(p2.y - p1.y) / 2);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (tool === 'line' && points.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else if (tool === 'dashed_line' && points.length >= 2) {
      ctx.beginPath();
      ctx.setLineDash([12, 8]);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (tool === 'arrow' && points.length >= 2) {
      const headLength = Math.max(14, size * 3.2);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const angle = Math.atan2(dy, dx);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2.x - headLength * Math.cos(angle - Math.PI / 6), p2.y - headLength * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2.x - headLength * Math.cos(angle + Math.PI / 6), p2.y - headLength * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    } else if (tool === 'dashed_arrow' && points.length >= 2) {
      const headLength = Math.max(14, size * 3.2);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const angle = Math.atan2(dy, dx);
      ctx.beginPath();
      ctx.setLineDash([10, 6]);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2.x - headLength * Math.cos(angle - Math.PI / 6), p2.y - headLength * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2.x - headLength * Math.cos(angle + Math.PI / 6), p2.y - headLength * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }
    // 3D Spatial Geometry with Textbook Hidden Dashed Lines
    else if (tool === 'cube' && points.length >= 2) {
      const w = p2.x - p1.x;
      const h = p2.y - p1.y;
      const s = Math.max(28, Math.min(Math.abs(w), Math.abs(h)));
      const sx = w >= 0 ? 1 : -1;
      const sy = h >= 0 ? 1 : -1;
      const x = p1.x + (sx < 0 ? -s : 0);
      const y = p1.y + (sy < 0 ? -s : 0);
      const dx = s * 0.35;
      const dy = -s * 0.35;

      ctx.beginPath();
      ctx.strokeRect(x, y, s, s);

      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy);
      ctx.moveTo(x + s, y); ctx.lineTo(x + s + dx, y + dy);
      ctx.moveTo(x + s, y + s); ctx.lineTo(x + s + dx, y + s + dy);
      ctx.moveTo(x + dx, y + dy); ctx.lineTo(x + s + dx, y + dy);
      ctx.moveTo(x + s + dx, y + dy); ctx.lineTo(x + s + dx, y + s + dy);
      ctx.stroke();

      ctx.beginPath();
      ctx.setLineDash([6, 5]);
      ctx.moveTo(x, y + s); ctx.lineTo(x + dx, y + s + dy);
      ctx.moveTo(x + dx, y + s + dy); ctx.lineTo(x + dx, y + dy);
      ctx.moveTo(x + dx, y + s + dy); ctx.lineTo(x + s + dx, y + s + dy);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (tool === 'cuboid' && points.length >= 2) {
      const w = Math.max(36, Math.abs(p2.x - p1.x));
      const h = Math.max(28, Math.abs(p2.y - p1.y));
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y) + h * 0.25;
      const fh = h * 0.75;
      const dx = Math.min(w * 0.35, 60);
      const dy = -Math.min(h * 0.3, 45);

      ctx.beginPath();
      ctx.strokeRect(x, y, w, fh);

      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy);
      ctx.moveTo(x + w, y); ctx.lineTo(x + w + dx, y + dy);
      ctx.moveTo(x + w, y + fh); ctx.lineTo(x + w + dx, y + fh + dy);
      ctx.moveTo(x + dx, y + dy); ctx.lineTo(x + w + dx, y + dy);
      ctx.moveTo(x + w + dx, y + dy); ctx.lineTo(x + w + dx, y + fh + dy);
      ctx.stroke();

      ctx.beginPath();
      ctx.setLineDash([6, 5]);
      ctx.moveTo(x, y + fh); ctx.lineTo(x + dx, y + fh + dy);
      ctx.moveTo(x + dx, y + fh + dy); ctx.lineTo(x + dx, y + dy);
      ctx.moveTo(x + dx, y + fh + dy); ctx.lineTo(x + w + dx, y + fh + dy);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (tool === 'cone' && points.length >= 2) {
      const topY = Math.min(p1.y, p2.y);
      const bottomY = Math.max(p1.y, p2.y);
      const cx = (p1.x + p2.x) / 2;
      const rx = Math.max(16, Math.abs(p2.x - p1.x) / 2);
      const ry = Math.max(6, Math.min(rx * 0.35, 45));

      ctx.beginPath();
      ctx.moveTo(cx, topY); ctx.lineTo(cx - rx, bottomY);
      ctx.moveTo(cx, topY); ctx.lineTo(cx + rx, bottomY);
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(cx, bottomY, rx, ry, 0, 0, Math.PI);
      ctx.stroke();

      ctx.beginPath();
      ctx.setLineDash([6, 5]);
      ctx.ellipse(cx, bottomY, rx, ry, 0, Math.PI, 2 * Math.PI);
      ctx.moveTo(cx, topY); ctx.lineTo(cx, bottomY);
      ctx.moveTo(cx, bottomY); ctx.lineTo(cx + rx, bottomY);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (tool === 'pyramid_tri' && points.length >= 2) {
      // 3D Triangular Pyramid (Hình chóp đáy tam giác S.ABC chuẩn SGK)
      const w = Math.max(50, Math.abs(p2.x - p1.x));
      const h = Math.max(50, Math.abs(p2.y - p1.y));
      const topX = (p1.x + p2.x) / 2;
      const topY = Math.min(p1.y, p2.y);
      const bottomY = Math.max(p1.y, p2.y);

      // Base vertices: A (back, hidden), B (front-left), C (front-right)
      const Ax = topX - w * 0.15;
      const Ay = bottomY - h * 0.28;
      const Bx = topX - w * 0.46;
      const By = bottomY;
      const Cx = topX + w * 0.44;
      const Cy = bottomY - h * 0.06;

      // Visible edges (solid)
      ctx.beginPath();
      ctx.moveTo(topX, topY); ctx.lineTo(Bx, By); // SB
      ctx.moveTo(topX, topY); ctx.lineTo(Cx, Cy); // SC
      ctx.moveTo(Bx, By); ctx.lineTo(Cx, Cy);     // BC
      ctx.stroke();

      // Hidden edges (dashed)
      ctx.beginPath();
      ctx.setLineDash([6, 5]);
      ctx.moveTo(topX, topY); ctx.lineTo(Ax, Ay); // SA (khuất)
      ctx.moveTo(Ax, Ay); ctx.lineTo(Bx, By);     // AB (khuất)
      ctx.moveTo(Ax, Ay); ctx.lineTo(Cx, Cy);     // AC (khuất)
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (tool === 'pyramid_quad' && points.length >= 2) {
      // 3D Parallelogram Pyramid (Hình chóp đáy hình bình hành S.ABCD chuẩn SGK)
      const w = Math.max(60, Math.abs(p2.x - p1.x));
      const h = Math.max(50, Math.abs(p2.y - p1.y));
      const topX = (p1.x + p2.x) / 2 - w * 0.08;
      const topY = Math.min(p1.y, p2.y);
      const bottomY = Math.max(p1.y, p2.y);

      // Base vertices: A (back-left, hidden), B (front-left), C (front-right), D (back-right)
      const Ax = topX - w * 0.3;
      const Ay = bottomY - h * 0.28;
      const Bx = topX - w * 0.46;
      const By = bottomY;
      const Cx = topX + w * 0.24;
      const Cy = bottomY;
      const Dx = topX + w * 0.4;
      const Dy = bottomY - h * 0.28;

      // Visible edges (solid)
      ctx.beginPath();
      ctx.moveTo(topX, topY); ctx.lineTo(Bx, By); // SB
      ctx.moveTo(topX, topY); ctx.lineTo(Cx, Cy); // SC
      ctx.moveTo(topX, topY); ctx.lineTo(Dx, Dy); // SD
      ctx.moveTo(Bx, By); ctx.lineTo(Cx, Cy);     // BC
      ctx.moveTo(Cx, Cy); ctx.lineTo(Dx, Dy);     // CD
      ctx.stroke();

      // Hidden edges (dashed)
      ctx.beginPath();
      ctx.setLineDash([6, 5]);
      ctx.moveTo(topX, topY); ctx.lineTo(Ax, Ay); // SA (khuất)
      ctx.moveTo(Ax, Ay); ctx.lineTo(Bx, By);     // AB (khuất)
      ctx.moveTo(Ax, Ay); ctx.lineTo(Dx, Dy);     // AD (khuất)
      ctx.stroke();
      ctx.setLineDash([]);
    } else if ((tool === 'cylinder' || tool === 'revolution_cylinder') && points.length >= 2) {
      const topY = Math.min(p1.y, p2.y);
      const bottomY = Math.max(p1.y, p2.y);
      const cx = (p1.x + p2.x) / 2;
      const rx = Math.max(18, Math.abs(p2.x - p1.x) / 2);
      const ry = Math.max(6, Math.min(rx * 0.32, 42));

      ctx.beginPath();
      ctx.ellipse(cx, topY, rx, ry, 0, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - rx, topY); ctx.lineTo(cx - rx, bottomY);
      ctx.moveTo(cx + rx, topY); ctx.lineTo(cx + rx, bottomY);
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(cx, bottomY, rx, ry, 0, 0, Math.PI);
      ctx.stroke();

      ctx.beginPath();
      ctx.setLineDash([6, 5]);
      ctx.ellipse(cx, bottomY, rx, ry, 0, Math.PI, 2 * Math.PI);
      ctx.moveTo(cx, topY); ctx.lineTo(cx, bottomY);
      ctx.moveTo(cx, bottomY); ctx.lineTo(cx + rx, bottomY);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (tool === 'sphere' && points.length >= 2) {
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const r = Math.max(16, Math.hypot(p2.x - p1.x, p2.y - p1.y) / 2);
      const ry = Math.max(6, r * 0.32);

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(cx, cy, r, ry, 0, 0, Math.PI);
      ctx.stroke();

      ctx.beginPath();
      ctx.setLineDash([6, 5]);
      ctx.ellipse(cx, cy, r, ry, 0, Math.PI, 2 * Math.PI);
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // FREEHAND CALLIGRAPHIC BEZIER SMOOTHING (PEN, HIGHLIGHTER, ERASER)
    else {
      if (points.length === 1) {
        ctx.beginPath();
        const r = (tool === 'highlighter' ? size * 2.8 : tool === 'eraser' ? size * 3 : size) / 2;
        ctx.arc(points[0].x, points[0].y, Math.max(1, r), 0, Math.PI * 2);
        ctx.fill();
      } else if (points.length === 2) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.stroke();
      } else {
        // Professional Calligraphy Bezier Spline
        // For 'pen': render segments with smooth calligraphic tapering at start/end and velocity responsiveness
        if (tool === 'pen') {
          const n = points.length;
          for (let i = 1; i < n - 1; i++) {
            const pPrev = points[i - 1];
            const pCurr = points[i];
            const pNext = points[i + 1];

            const mid1X = (pPrev.x + pCurr.x) / 2;
            const mid1Y = (pPrev.y + pCurr.y) / 2;
            const mid2X = (pCurr.x + pNext.x) / 2;
            const mid2Y = (pCurr.y + pNext.y) / 2;

            // Calligraphic weight taper
            let taper = 1.0;
            if (i === 1) taper = 0.55;
            else if (i === 2) taper = 0.8;
            else if (i === n - 3) taper = 0.8;
            else if (i === n - 2) taper = 0.45;

            // Velocity / pressure modulation
            const pressure = pCurr.pressure || 0.7;
            const segWidth = Math.max(1, size * taper * (0.5 + pressure * 0.7));

            ctx.lineWidth = segWidth;
            ctx.beginPath();
            ctx.moveTo(mid1X, mid1Y);
            ctx.quadraticCurveTo(pCurr.x, pCurr.y, mid2X, mid2Y);
            ctx.stroke();
          }

          // Smooth connect to endpoints
          const firstMid = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
          ctx.lineWidth = Math.max(1, size * 0.4);
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(firstMid.x, firstMid.y);
          ctx.stroke();

          const lastMid = { x: (points[n - 2].x + points[n - 1].x) / 2, y: (points[n - 2].y + points[n - 1].y) / 2 };
          ctx.lineWidth = Math.max(1, size * 0.35);
          ctx.beginPath();
          ctx.moveTo(lastMid.x, lastMid.y);
          ctx.lineTo(points[n - 1].x, points[n - 1].y);
          ctx.stroke();
        } else {
          // Highlighter or Eraser with continuous smooth Bezier curve
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length - 1; i++) {
            const xc = (points[i].x + points[i + 1].x) / 2;
            const yc = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
          }
          const last = points[points.length - 1];
          const prev = points[points.length - 2];
          ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  };

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
        renderSingleStroke(
          ctx,
          stroke.tool,
          stroke.points,
          stroke.color,
          stroke.size,
          stroke.scale || 1,
          stroke.rotation || 0
        );
      });
    },
    []
  );

  // Resize canvas to match container with High-DPI support
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
  }, [strokes, redrawCanvas]);

  useEffect(() => {
    resizeCanvas();
    const observer = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    const handleFsOrResize = () => {
      resizeCanvas();
      setTimeout(resizeCanvas, 60);
      setTimeout(resizeCanvas, 220);
    };
    window.addEventListener('resize', handleFsOrResize);
    document.addEventListener('fullscreenchange', handleFsOrResize);
    document.addEventListener('webkitfullscreenchange', handleFsOrResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleFsOrResize);
      document.removeEventListener('fullscreenchange', handleFsOrResize);
      document.removeEventListener('webkitfullscreenchange', handleFsOrResize);
    };
  }, [resizeCanvas]);

  useEffect(() => {
    redrawCanvas(strokes);
  }, [strokes, redrawCanvas]);

  // Keyboard arrow keys & delete for selected stroke
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedStrokeId) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const step = e.shiftKey ? moveSpeed * 2.5 : moveSpeed;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleNudgeStroke(0, -step);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNudgeStroke(0, step);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNudgeStroke(-step, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNudgeStroke(step, 0);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setStrokes((prev) => prev.filter((s) => s.id !== selectedStrokeId));
        setSelectedStrokeId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStrokeId, handleNudgeStroke, moveSpeed]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure && e.pressure > 0 ? e.pressure : 0.6,
    };
  };

  // Pointer event handlers with anti-jitter low-pass filter
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool === 'select') {
      const point = getCanvasCoords(e);
      // Hit-test on geometric shapes & math graphs (never select freehand handwriting)
      const hitStroke = strokes.slice().reverse().find((s) => {
        if (s.tool === 'pen' || s.tool === 'highlighter' || s.tool === 'eraser' || s.tool === 'laser') {
          return false;
        }
        const bounds = getStrokeBounds(s);
        if (!bounds) return false;
        if (s.tool === 'circle') {
          const dist = Math.hypot(point.x - bounds.centerX, point.y - bounds.centerY);
          return dist <= (bounds.radius || bounds.width / 2) + 20;
        }
        return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
      });
      if (hitStroke) {
        setSelectedStrokeId(hitStroke.id);
        setIsStrokeToolbarExpanded(true);
      } else {
        setSelectedStrokeId(null);
      }
      return;
    }

    e.preventDefault();
    const point = getCanvasCoords(e);

    if (activeTool === 'laser') {
      setLaserPos(point);
      return;
    }

    if (activeTool === 'text') {
      // Add text box at clicked location
      const newText: WhiteboardText = {
        id: 'txt_' + Date.now(),
        x: point.x,
        y: point.y,
        text: 'Nhập ghi chú bài giảng...',
        color: activeColor,
        size: Math.max(16, strokeSize * 5),
      };
      setTexts((prev) => [...prev, newText]);
      setActiveTextId(newText.id);
      return;
    }

    setIsDrawing(true);
    setCurrentPoints([point]);
    lastSmoothedRef.current = { ...point };
    lastTimeRef.current = Date.now();
    lastVelocityRef.current = 0;

    // Draw immediate responsive initial dot for freehand
    if (['pen', 'highlighter', 'eraser'].includes(activeTool)) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.save();
      ctx.fillStyle = activeColor;
      const isFluo = activeColor === '#ccff00' || activeColor === '#ff007f' || activeColor === '#00ffff';
      if (activeTool === 'highlighter') {
        ctx.globalAlpha = isFluo ? 0.65 : 0.45;
        if (isFluo) {
          ctx.shadowColor = activeColor;
          ctx.shadowBlur = 12;
        }
      } else if (activeTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
      } else if (isFluo) {
        ctx.shadowColor = activeColor;
        ctx.shadowBlur = 8;
      }
      ctx.beginPath();
      const r = (activeTool === 'highlighter' ? strokeSize * 2.8 : activeTool === 'eraser' ? strokeSize * 3 : strokeSize) / 2;
      ctx.arc(point.x, point.y, Math.max(1, r), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rawPoint = getCanvasCoords(e);

    if (activeTool === 'laser') {
      setLaserPos(rawPoint);
      if (laserTimeoutRef.current) clearTimeout(laserTimeoutRef.current);
      laserTimeoutRef.current = setTimeout(() => setLaserPos(null), 1800);
      return;
    }

    if (!isDrawing) return;

    // Anti-jitter noise reduction filter
    const lastSmoothed = lastSmoothedRef.current || currentPoints[currentPoints.length - 1];
    const dist = Math.hypot(rawPoint.x - lastSmoothed.x, rawPoint.y - lastSmoothed.y);

    // Filter micro-jitter (< 1.4px)
    if (dist < 1.4 && ['pen', 'highlighter', 'eraser'].includes(activeTool)) {
      return;
    }

    // Adaptive Exponential Moving Average (Low-Pass Filter)
    const alpha = 0.74;
    const smoothX = lastSmoothed.x * (1 - alpha) + rawPoint.x * alpha;
    const smoothY = lastSmoothed.y * (1 - alpha) + rawPoint.y * alpha;

    const now = Date.now();
    const dt = Math.max(1, now - lastTimeRef.current);
    const velocity = dist / dt;
    lastTimeRef.current = now;
    lastVelocityRef.current = velocity;

    // Calculate dynamic pressure
    const dynamicPressure = rawPoint.pressure && rawPoint.pressure > 0.1
      ? rawPoint.pressure
      : Math.max(0.35, Math.min(1.1, 1.0 - velocity * 0.08));

    const smoothedPoint: StrokePoint = {
      x: smoothX,
      y: smoothY,
      pressure: dynamicPressure,
    };
    lastSmoothedRef.current = smoothedPoint;

    const newPoints = [...currentPoints, smoothedPoint];
    setCurrentPoints(newPoints);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Freehand tools: Lightning-fast incremental Bezier rendering
    if (['pen', 'highlighter', 'eraser'].includes(activeTool)) {
      if (newPoints.length >= 3) {
        const p0 = newPoints[newPoints.length - 3];
        const p1 = newPoints[newPoints.length - 2];
        const p2 = newPoints[newPoints.length - 1];

        const mid1X = (p0.x + p1.x) / 2;
        const mid1Y = (p0.y + p1.y) / 2;
        const mid2X = (p1.x + p2.x) / 2;
        const mid2Y = (p1.y + p2.y) / 2;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const isFluo = activeColor === '#ccff00' || activeColor === '#ff007f' || activeColor === '#00ffff';

        if (activeTool === 'highlighter') {
          ctx.globalAlpha = isFluo ? 0.65 : 0.45;
          ctx.lineWidth = strokeSize * 2.8;
          ctx.strokeStyle = activeColor;
          if (isFluo) {
            ctx.shadowColor = activeColor;
            ctx.shadowBlur = 12;
          }
        } else if (activeTool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.lineWidth = strokeSize * 3;
          ctx.strokeStyle = '#000000';
        } else {
          ctx.globalAlpha = 1.0;
          ctx.strokeStyle = activeColor;
          if (isFluo) {
            ctx.shadowColor = activeColor;
            ctx.shadowBlur = 8;
          }
          // Dynamic calligraphy width
          const segWidth = Math.max(1, strokeSize * (0.6 + (p1.pressure || 0.6) * 0.6));
          ctx.lineWidth = segWidth;
        }

        ctx.beginPath();
        ctx.moveTo(mid1X, mid1Y);
        ctx.quadraticCurveTo(p1.x, p1.y, mid2X, mid2Y);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      // Shapes & Function Graphs: Interactive live dragging preview
      redrawCanvas(strokes);
      renderSingleStroke(ctx, activeTool, newPoints, activeColor, strokeSize);
    }
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
      opacity: activeTool === 'highlighter' ? 0.45 : 1,
    };

    setStrokes((prev) => {
      const updated = [...prev, newStroke];
      // Clean full-precision redraw on stroke commit
      setTimeout(() => redrawCanvas(updated), 0);
      return updated;
    });

    const isShapeOrGraph = !['pen', 'highlighter', 'eraser', 'laser', 'text'].includes(activeTool);
    if (isShapeOrGraph) {
      setSelectedStrokeId(newStroke.id);
      setIsStrokeToolbarExpanded(true);
    }

    setRedoStack([]);
    setIsDrawing(false);
    setCurrentPoints([]);
    lastSmoothedRef.current = null;
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

  const handleClearBoard = () => {
    if (strokes.length === 0 && texts.length === 0) return;
    setRedoStack([]);
    setStrokes([]);
    setTexts([]);
    setActiveTextId(null);
  };

  const handleToolChange = (tool: WhiteboardTool) => {
    setActiveTool(tool);
    if (tool === 'eraser' && strokeSize < 12) {
      // Convenience auto-size for eraser
      setStrokeSize(14);
    } else if (tool === 'pen' && strokeSize > 14) {
      setStrokeSize(2);
    }
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
        isOverlay ? 'rounded-none min-h-0 bg-transparent pointer-events-none' : `min-h-[500px] rounded-3xl ${getBgClass()}`
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
        onPointerDown={activeTool === 'select' ? undefined : handlePointerDown}
        onPointerMove={activeTool === 'select' ? undefined : handlePointerMove}
        onPointerUp={activeTool === 'select' ? undefined : handlePointerUp}
        onPointerLeave={activeTool === 'select' ? undefined : handlePointerUp}
        className={`absolute inset-0 w-full h-full ${
          activeTool === 'select'
            ? 'pointer-events-none cursor-default'
            : 'pointer-events-auto touch-canvas cursor-crosshair'
        } z-10`}
      />

      {/* Interactive Text Notes Layer */}
      {texts.map((item) => (
        <div
          key={item.id}
          className="absolute z-20 pointer-events-auto"
          style={{ left: item.x, top: item.y }}
        >
          {activeTextId === item.id ? (
            <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-950/95 border-2 border-indigo-400 shadow-2xl">
              <input
                type="text"
                autoFocus
                value={item.text}
                onChange={(e) => {
                  const val = e.target.value;
                  setTexts((prev) =>
                    prev.map((t) => (t.id === item.id ? { ...t, text: val } : t))
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setActiveTextId(null);
                }}
                className="px-2 py-1 rounded bg-black/40 border border-white/20 text-white text-sm font-bold focus:outline-none focus:border-indigo-400"
              />
              <button
                onClick={() => setActiveTextId(null)}
                className="px-2 py-1 rounded bg-emerald-600 text-white text-xs font-bold cursor-pointer"
              >
                Xong
              </button>
              <button
                onClick={() => {
                  setTexts((prev) => prev.filter((t) => t.id !== item.id));
                  setActiveTextId(null);
                }}
                className="p-1 rounded text-rose-400 hover:bg-rose-500/20 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => setActiveTextId(item.id)}
              className="px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/30 text-white font-bold text-sm shadow-xl cursor-pointer hover:border-indigo-400 hover:scale-105 transition-all select-none"
              style={{ color: item.color }}
            >
              {item.text}
            </div>
          )}
        </div>
      ))}

      {/* INTERACTIVE BOUNDING BOX & CONTROLLER FOR SELECTED STROKE / DRAWN SHAPE */}
      {selectedStrokeId && (() => {
        const selectedStroke = strokes.find((s) => s.id === selectedStrokeId);
        if (!selectedStroke) return null;
        const bounds = getStrokeBounds(selectedStroke);
        if (!bounds) return null;

        const currentRotation = selectedStroke.rotation || 0;
        const currentScale = selectedStroke.scale || 1;

        return (
          <div
            className="absolute pointer-events-none z-40 animate-fade-in"
            style={{
              left: `${bounds.minX}px`,
              top: `${bounds.minY}px`,
              width: `${bounds.width}px`,
              height: `${bounds.height}px`,
            }}
          >
            {/* Interactive Inner Drag Area allowing easy grabbing & movement of the entire shape */}
            <div
              onPointerDown={(e) => {
                e.stopPropagation();
                try {
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                } catch (_) {}
                setIsDraggingStroke(true);
                dragStrokeStartRef.current = {
                  startMouseX: e.clientX,
                  startMouseY: e.clientY,
                  origPoints: selectedStroke.points ? selectedStroke.points.map((p) => ({ ...p })) : [],
                  centerX: bounds.centerX,
                  centerY: bounds.centerY,
                  origRotation: selectedStroke.rotation || 0,
                };
              }}
              onPointerMove={(e) => {
                if (!isDraggingStroke || !dragStrokeStartRef.current || !selectedStrokeId) return;
                e.stopPropagation();
                const deltaX = e.clientX - dragStrokeStartRef.current.startMouseX;
                const deltaY = e.clientY - dragStrokeStartRef.current.startMouseY;
                const origPts = dragStrokeStartRef.current.origPoints;
                const origCenterX = dragStrokeStartRef.current.centerX;
                const origCenterY = dragStrokeStartRef.current.centerY;

                if (strokeRafRef.current) cancelAnimationFrame(strokeRafRef.current);
                strokeRafRef.current = requestAnimationFrame(() => {
                  setStrokes((prev) =>
                    prev.map((s) => {
                      if (s.id === selectedStrokeId) {
                        const movedPoints = origPts.map((p) => ({ ...p, x: p.x + deltaX, y: p.y + deltaY }));
                        return {
                          ...s,
                          points: movedPoints,
                          centerX: origCenterX + deltaX,
                          centerY: origCenterY + deltaY,
                        };
                      }
                      return s;
                    })
                  );
                });
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                try {
                  (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                } catch (_) {}
                setIsDraggingStroke(false);
              }}
              onPointerCancel={(e) => {
                e.stopPropagation();
                try {
                  (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                } catch (_) {}
                setIsDraggingStroke(false);
              }}
              className="absolute inset-0 cursor-move pointer-events-auto bg-cyan-400/10 hover:bg-cyan-400/20 active:bg-cyan-400/30 rounded-2xl transition-colors border-2 border-cyan-400/40 touch-none select-none flex items-center justify-center group"
              title="Chạm và kéo để di chuyển hình (hoặc dùng 4 nút điều hướng / phím mũi tên)"
            >
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/85 px-2.5 py-1 rounded-full text-cyan-300 text-[11px] font-bold shadow-lg flex items-center gap-1.5 pointer-events-none">
                <Move className="w-3.5 h-3.5" />
                Kéo di chuyển hình
              </div>
            </div>

            {/* Bounding box outline with rotation visual styling & active draggable corner handles */}
            <div
              className="w-full h-full border-2 border-dashed border-cyan-400/90 rounded-2xl relative shadow-lg ring-2 ring-cyan-400/30 pointer-events-none"
              style={{
                transform: `rotate(${currentRotation}deg) scale(${currentScale})`,
                transformOrigin: 'center center',
              }}
            >
              {/* 4 Active Draggable Corner Handles */}
              <div
                onPointerDown={(e) => handleShapeResizePointerDown(e, 'nw')}
                onPointerMove={handleShapeResizePointerMove}
                onPointerUp={handleShapeResizePointerUp}
                onPointerCancel={handleShapeResizePointerUp}
                className="absolute -top-2.5 -left-2.5 w-5 h-5 bg-white border-2 border-cyan-500 rounded-full shadow-lg cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center z-30 touch-none"
                title="Kéo co giãn phóng to / thu nhỏ hình vẽ"
              >
                <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
              </div>
              <div
                onPointerDown={(e) => handleShapeResizePointerDown(e, 'ne')}
                onPointerMove={handleShapeResizePointerMove}
                onPointerUp={handleShapeResizePointerUp}
                onPointerCancel={handleShapeResizePointerUp}
                className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-white border-2 border-cyan-500 rounded-full shadow-lg cursor-nesw-resize pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center z-30 touch-none"
                title="Kéo co giãn phóng to / thu nhỏ hình vẽ"
              >
                <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
              </div>
              <div
                onPointerDown={(e) => handleShapeResizePointerDown(e, 'sw')}
                onPointerMove={handleShapeResizePointerMove}
                onPointerUp={handleShapeResizePointerUp}
                onPointerCancel={handleShapeResizePointerUp}
                className="absolute -bottom-2.5 -left-2.5 w-5 h-5 bg-white border-2 border-cyan-500 rounded-full shadow-lg cursor-nesw-resize pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center z-30 touch-none"
                title="Kéo co giãn phóng to / thu nhỏ hình vẽ"
              >
                <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
              </div>
              <div
                onPointerDown={(e) => handleShapeResizePointerDown(e, 'se')}
                onPointerMove={handleShapeResizePointerMove}
                onPointerUp={handleShapeResizePointerUp}
                onPointerCancel={handleShapeResizePointerUp}
                className="absolute -bottom-2.5 -right-2.5 w-5 h-5 bg-white border-2 border-cyan-500 rounded-full shadow-lg cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center z-30 touch-none"
                title="Kéo co giãn phóng to / thu nhỏ hình vẽ"
              >
                <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
              </div>

              {/* Center crosshair */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 border border-cyan-300 rounded-full flex items-center justify-center pointer-events-none">
                <div className="w-1 h-1 bg-cyan-300 rounded-full" />
              </div>
            </div>

            {/* Floating Toolbar: Collapsed & Expandable */}
            {!isStrokeToolbarExpanded ? (
              /* DẠNG THU GỌN (Collapsed Compact Mode) */
              <div
                className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-950/95 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border-2 border-cyan-400/80 shadow-2xl text-white pointer-events-auto whitespace-nowrap z-50 select-none animate-fade-in"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {/* Mini Directional Movement */}
                <div className="flex items-center gap-1 bg-white/10 px-1.5 py-1 rounded-xl">
                  <button
                    onPointerDown={(e) => { e.stopPropagation(); startContinuousNudge(-1, 0); }}
                    onPointerUp={(e) => { e.stopPropagation(); stopContinuousNudge(); }}
                    onPointerLeave={stopContinuousNudge}
                    onPointerCancel={stopContinuousNudge}
                    className="p-1 bg-white/10 hover:bg-cyan-500/40 active:scale-90 rounded-lg text-cyan-200 hover:text-white transition-transform flex items-center justify-center cursor-pointer"
                    title="Dời sang TRÁI"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onPointerDown={(e) => { e.stopPropagation(); startContinuousNudge(0, -1); }}
                    onPointerUp={(e) => { e.stopPropagation(); stopContinuousNudge(); }}
                    onPointerLeave={stopContinuousNudge}
                    onPointerCancel={stopContinuousNudge}
                    className="p-1 bg-white/10 hover:bg-cyan-500/40 active:scale-90 rounded-lg text-cyan-200 hover:text-white transition-transform flex items-center justify-center cursor-pointer"
                    title="Dời lên TRÊN"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onPointerDown={(e) => { e.stopPropagation(); startContinuousNudge(0, 1); }}
                    onPointerUp={(e) => { e.stopPropagation(); stopContinuousNudge(); }}
                    onPointerLeave={stopContinuousNudge}
                    onPointerCancel={stopContinuousNudge}
                    className="p-1 bg-white/10 hover:bg-cyan-500/40 active:scale-90 rounded-lg text-cyan-200 hover:text-white transition-transform flex items-center justify-center cursor-pointer"
                    title="Dời xuống DƯỚI"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onPointerDown={(e) => { e.stopPropagation(); startContinuousNudge(1, 0); }}
                    onPointerUp={(e) => { e.stopPropagation(); stopContinuousNudge(); }}
                    onPointerLeave={stopContinuousNudge}
                    onPointerCancel={stopContinuousNudge}
                    className="p-1 bg-white/10 hover:bg-cyan-500/40 active:scale-90 rounded-lg text-cyan-200 hover:text-white transition-transform flex items-center justify-center cursor-pointer"
                    title="Dời sang PHẢI"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCenterStroke(); }}
                    className="px-1.5 py-0.5 bg-white/10 hover:bg-cyan-500/30 rounded-lg text-[10px] font-bold text-cyan-200 hover:text-white transition-colors cursor-pointer ml-0.5"
                    title="Đưa hình về giữa bảng"
                  >
                    🎯 Giữa
                  </button>
                </div>

                {/* Color Dot indicator */}
                <div
                  className="w-4 h-4 rounded-full border border-white/80 shadow-xs shrink-0"
                  style={{ backgroundColor: selectedStroke.color || '#ffffff' }}
                  title="Màu sắc hiện tại"
                />

                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setStrokes((prev) => prev.filter((s) => s.id !== selectedStroke.id));
                    setSelectedStrokeId(null);
                  }}
                  className="p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors flex items-center justify-center text-xs cursor-pointer"
                  title="Xóa hình này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* Expand Full Toolbar Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsStrokeToolbarExpanded(true);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-200 hover:text-white font-bold text-[11px] flex items-center gap-1.5 border border-cyan-400/50 transition-all cursor-pointer shadow-xs"
                  title="Bấm để mở đầy đủ thanh công cụ: Xoay 360°, chọn màu, phóng to/thu nhỏ"
                >
                  <Sliders className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Mở rộng ▾</span>
                </button>

                {/* Close button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStrokeId(null);
                  }}
                  className="p-1 rounded-lg hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Bỏ chọn"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              /* DẠNG MỞ RỘNG ĐẦY ĐỦ (Expanded Full Mode) */
              <div
                className="absolute -top-20 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-950/98 backdrop-blur-md px-3.5 py-2 rounded-2xl border-2 border-cyan-400/90 shadow-2xl text-white pointer-events-auto whitespace-nowrap z-50 select-none animate-fade-in"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {/* Collapse Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsStrokeToolbarExpanded(false);
                  }}
                  className="px-2 py-1 bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-200 rounded-xl text-[10.5px] font-black flex items-center gap-1 border border-cyan-400/40 cursor-pointer mr-0.5"
                  title="Thu gọn thanh công cụ lại"
                >
                  <ChevronUp className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Thu gọn ▴</span>
                </button>

                {/* 4-Way Smooth Directional Movement */}
                <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-xl">
                  <span className="text-[11px] font-black text-cyan-300 flex items-center gap-1 mr-0.5">
                    <Move className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Di chuyển:</span>
                  </span>

                  {/* Left */}
                  <button
                    onPointerDown={(e) => { e.stopPropagation(); startContinuousNudge(-1, 0); }}
                    onPointerUp={(e) => { e.stopPropagation(); stopContinuousNudge(); }}
                    onPointerLeave={stopContinuousNudge}
                    onPointerCancel={stopContinuousNudge}
                    className="p-1.5 bg-white/10 hover:bg-cyan-500/40 active:scale-90 rounded-lg text-cyan-200 hover:text-white transition-transform flex items-center justify-center cursor-pointer"
                    title="Dời sang TRÁI (Nhấn hoặc Giữ để di chuyển mượt)"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>

                  {/* Up */}
                  <button
                    onPointerDown={(e) => { e.stopPropagation(); startContinuousNudge(0, -1); }}
                    onPointerUp={(e) => { e.stopPropagation(); stopContinuousNudge(); }}
                    onPointerLeave={stopContinuousNudge}
                    onPointerCancel={stopContinuousNudge}
                    className="p-1.5 bg-white/10 hover:bg-cyan-500/40 active:scale-90 rounded-lg text-cyan-200 hover:text-white transition-transform flex items-center justify-center cursor-pointer"
                    title="Dời lên TRÊN (Nhấn hoặc Giữ để di chuyển mượt)"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  {/* Down */}
                  <button
                    onPointerDown={(e) => { e.stopPropagation(); startContinuousNudge(0, 1); }}
                    onPointerUp={(e) => { e.stopPropagation(); stopContinuousNudge(); }}
                    onPointerLeave={stopContinuousNudge}
                    onPointerCancel={stopContinuousNudge}
                    className="p-1.5 bg-white/10 hover:bg-cyan-500/40 active:scale-90 rounded-lg text-cyan-200 hover:text-white transition-transform flex items-center justify-center cursor-pointer"
                    title="Dời xuống DƯỚI (Nhấn hoặc Giữ để di chuyển mượt)"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Right */}
                  <button
                    onPointerDown={(e) => { e.stopPropagation(); startContinuousNudge(1, 0); }}
                    onPointerUp={(e) => { e.stopPropagation(); stopContinuousNudge(); }}
                    onPointerLeave={stopContinuousNudge}
                    onPointerCancel={stopContinuousNudge}
                    className="p-1.5 bg-white/10 hover:bg-cyan-500/40 active:scale-90 rounded-lg text-cyan-200 hover:text-white transition-transform flex items-center justify-center cursor-pointer"
                    title="Dời sang PHẢI (Nhấn hoặc Giữ để di chuyển mượt)"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  {/* Speed toggle presets */}
                  <div className="flex items-center gap-0.5 bg-slate-900/90 p-0.5 rounded-lg border border-white/10 ml-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setMoveSpeed(5); }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${moveSpeed === 5 ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                      title="Bước tinh chỉnh 5px"
                    >
                      5px
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMoveSpeed(15); }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${moveSpeed === 15 ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                      title="Bước tiêu chuẩn 15px"
                    >
                      15px
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMoveSpeed(35); }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${moveSpeed === 35 ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                      title="Bước nhanh 35px"
                    >
                      35px
                    </button>
                  </div>

                  {/* Center to Viewport Button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCenterStroke(); }}
                    className="px-2 py-1 bg-white/10 hover:bg-cyan-500/30 rounded-lg text-[10.5px] font-bold text-cyan-200 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                    title="Đưa hình vẽ về ngay giữa tầm nhìn bảng"
                  >
                    <span>🎯 Giữa</span>
                  </button>

                  {/* Coordinates Badge */}
                  <span className="text-[10px] font-mono text-cyan-400/90 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-500/30 hidden md:inline">
                    X:{Math.round(bounds.centerX)} Y:{Math.round(bounds.centerY)}
                  </span>
                </div>

                <div className="h-5 w-px bg-white/20 mx-1" />

                {/* 360-Degree Rotation Controls */}
                <div className="flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-xl">
                  <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-black text-amber-300 font-mono min-w-[36px] text-center">
                    {Math.round(currentRotation)}°
                  </span>

                  {/* Rotation Slider 0° -> 360° */}
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="5"
                    value={Math.round((currentRotation % 360 + 360) % 360)}
                    onChange={(e) => {
                      const newAngle = Number(e.target.value);
                      setStrokes((prev) =>
                        prev.map((s) => (s.id === selectedStroke.id ? { ...s, rotation: newAngle } : s))
                      );
                    }}
                    className="w-20 md:w-28 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    title="Kéo trượt để xoay hình 0 - 360 độ"
                  />

                  {/* Quick Rotate Buttons */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newAngle = (currentRotation - 15 + 360) % 360;
                      setStrokes((prev) =>
                        prev.map((s) => (s.id === selectedStroke.id ? { ...s, rotation: newAngle } : s))
                      );
                    }}
                    className="p-1 hover:bg-white/20 rounded-lg text-slate-200 text-[11px] font-bold cursor-pointer"
                    title="Xoay ngược chiều kim đồng hồ 15°"
                  >
                    -15°
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newAngle = (currentRotation + 15) % 360;
                      setStrokes((prev) =>
                        prev.map((s) => (s.id === selectedStroke.id ? { ...s, rotation: newAngle } : s))
                      );
                    }}
                    className="p-1 hover:bg-white/20 rounded-lg text-slate-200 text-[11px] font-bold cursor-pointer"
                    title="Xoay thuận chiều kim đồng hồ 15°"
                  >
                    +15°
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newAngle = (currentRotation + 90) % 360;
                      setStrokes((prev) =>
                        prev.map((s) => (s.id === selectedStroke.id ? { ...s, rotation: newAngle } : s))
                      );
                    }}
                    className="px-1.5 py-0.5 bg-amber-500/30 hover:bg-amber-500/50 rounded-lg text-amber-200 text-[10px] font-black cursor-pointer"
                    title="Xoay vuông góc 90°"
                  >
                    +90°
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newAngle = (currentRotation + 180) % 360;
                      setStrokes((prev) =>
                        prev.map((s) => (s.id === selectedStroke.id ? { ...s, rotation: newAngle } : s))
                      );
                    }}
                    className="px-1.5 py-0.5 bg-amber-500/30 hover:bg-amber-500/50 rounded-lg text-amber-200 text-[10px] font-black cursor-pointer"
                    title="Lật ngược 180°"
                  >
                    180°
                  </button>
                </div>

                <div className="h-5 w-px bg-white/20 mx-1" />

                {/* Change Color Palette */}
                <div className="flex items-center gap-1 max-w-[260px] sm:max-w-[340px] overflow-x-auto py-0.5 custom-scrollbar-none">
                  {colors.map((cp) => (
                    <button
                      key={cp.value}
                      onClick={(e) => {
                        e.stopPropagation();
                        setStrokes((prev) =>
                          prev.map((s) => (s.id === selectedStroke.id ? { ...s, color: cp.value } : s))
                        );
                      }}
                      className={`w-4 h-4 rounded-full border transition-transform shrink-0 cursor-pointer ${
                        selectedStroke.color === cp.value
                          ? 'border-white scale-125 ring-2 ring-cyan-400'
                          : 'border-transparent hover:scale-110'
                      }`}
                      style={{
                        backgroundColor: cp.value,
                        boxShadow: cp.isFluorescent ? `0 0 6px ${cp.value}` : undefined,
                      }}
                      title={cp.label}
                    />
                  ))}
                </div>

                <div className="h-5 w-px bg-white/20 mx-1" />

                {/* Scale +/- */}
                <div className="flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded-xl">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newScale = Math.max(0.3, currentScale - 0.15);
                      setStrokes((prev) =>
                        prev.map((s) => (s.id === selectedStroke.id ? { ...s, scale: newScale } : s))
                      );
                    }}
                    className="p-1 hover:bg-white/20 rounded-lg text-slate-300 hover:text-white cursor-pointer"
                    title="Thu nhỏ hình"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono text-cyan-300">{Math.round(currentScale * 100)}%</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newScale = Math.min(3.0, currentScale + 0.15);
                      setStrokes((prev) =>
                        prev.map((s) => (s.id === selectedStroke.id ? { ...s, scale: newScale } : s))
                      );
                    }}
                    className="p-1 hover:bg-white/20 rounded-lg text-slate-300 hover:text-white cursor-pointer"
                    title="Phóng to hình"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setStrokes((prev) =>
                        prev.map((s) => (s.id === selectedStroke.id ? { ...s, scale: 1.0 } : s))
                      );
                    }}
                    className="px-1.5 py-0.5 bg-cyan-500/30 hover:bg-cyan-500/50 rounded text-[9.5px] font-bold text-cyan-200 cursor-pointer"
                    title="Đặt lại kích thước chuẩn (100%)"
                  >
                    100%
                  </button>
                </div>

                <div className="h-5 w-px bg-white/20 mx-1" />

                {/* Delete Stroke */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setStrokes((prev) => prev.filter((s) => s.id !== selectedStroke.id));
                    setSelectedStrokeId(null);
                  }}
                  className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors flex items-center gap-1 text-xs cursor-pointer font-bold"
                  title="Xóa hình này (Phím tắt: Delete)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Xóa</span>
                </button>

                {/* Close Overlay Selection Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStrokeId(null);
                  }}
                  className="p-1 rounded-xl hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Bỏ chọn"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Top Right Close Button: Tắt công cụ và trở về màn hình trình chiếu */}
      {isOverlay && onCloseOverlay && (
        <div className="absolute top-3 right-4 z-50 pointer-events-auto flex items-center gap-2 animate-fade-in">
          <button
            id="top-right-close-overlay-btn"
            onClick={onCloseOverlay}
            className="px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs md:text-sm flex items-center gap-2 shadow-2xl border-2 border-white/50 backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer ring-4 ring-rose-500/30"
            title="Bấm nút để tắt công cụ và trở về màn hình trình chiếu (Phím tắt: Esc)"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
            <span>Trở về trình chiếu</span>
          </button>
        </div>
      )}

      {/* Banner thông báo chế độ Chuột / Cuộn tài liệu */}
      {activeTool === 'select' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 pointer-events-auto animate-fade-in">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-900/95 border-2 border-blue-400 text-white shadow-2xl backdrop-blur-md">
            <MousePointer2 className="w-4 h-4 text-blue-400 animate-bounce" />
            <span className="text-xs font-bold text-blue-100">
              Đang ở chế độ Chuột: Bạn có thể vuốt/cuộn tài liệu lên xuống tự do
            </span>
            <button
              onClick={() => setActiveTool('pen')}
              className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-all active:scale-95 ml-1"
              title="Bật lại Bút Phấn"
            >
              <div className="relative w-3.5 h-3.5 flex items-center justify-center">
                <Hand className="w-3 h-3 rotate-[-15deg] text-emerald-200" />
                <PenLine className="w-2 h-2 absolute -top-0.5 -right-0.5 text-amber-300" />
              </div>
              <span>Phấn</span>
            </button>
          </div>
        </div>
      )}

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

      {/* =========================================================================
          AUTHENTIC BOTTOM CHALK & TOOL DOCK (EXACT MATCH WITH CLASSROOM BLACKBOARD)
          ========================================================================= */}
      {!isDockCollapsed ? (
        <div
          ref={dockRef}
          className="absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-40 pointer-events-auto max-w-[98vw] animate-fade-in flex justify-center"
        >
          <div className="bg-slate-950/95 backdrop-blur-2xl px-3.5 py-2 rounded-2xl md:rounded-3xl border-2 border-white/25 shadow-2xl flex items-center gap-1 sm:gap-2 text-white shrink-0">
            {/* 1. Main Drawing Tools */}
            <div className="flex items-center gap-1 shrink-0">
              {/* 1. Chọn (Select) - Chuột & Cuộn tài liệu */}
              <button
                id="touch-tool-select-btn"
                onClick={() => handleToolChange('select')}
                className={`p-2 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeTool === 'select'
                    ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400'
                    : 'hover:bg-white/10 text-slate-300'
                }`}
                title="Chế độ Chuột & Chọn đối tượng: Cuộn lướt tài liệu tự do mà không vẽ (Phím tắt: V hoặc S)"
              >
                <MousePointer2 className="w-4 h-4" />
                <span className="text-[11px] font-bold">Chọn</span>
              </button>

              {/* 2. Phấn (Chalk) - Biểu tượng bàn tay viết */}
              <button
                id="touch-tool-pen-btn"
                onClick={() => handleToolChange('pen')}
                className={`p-2 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeTool === 'pen'
                    ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400'
                    : 'hover:bg-white/10 text-slate-300'
                }`}
                title="Bút phấn viết tự do thư pháp siêu mượt (Biểu tượng bàn tay viết - Phím tắt: B hoặc P)"
              >
                <div className="relative w-4 h-4 flex items-center justify-center">
                  <Hand className="w-3.5 h-3.5 rotate-[-15deg] text-emerald-200" />
                  <PenLine className="w-2.5 h-2.5 absolute -top-0.5 -right-0.5 text-amber-300" />
                </div>
                <span className="text-[11px] font-bold">Phấn</span>
              </button>

              {/* 3. Bút Dạ Quang */}
              <button
                id="touch-tool-highlighter-btn"
                onClick={() => handleToolChange('highlighter')}
                className={`p-2 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeTool === 'highlighter'
                    ? 'bg-amber-500 text-white shadow-md ring-2 ring-amber-300'
                    : 'hover:bg-white/10 text-slate-300'
                }`}
                title="Bút dạ quang đánh dấu (Phím tắt: H)"
              >
                <Highlighter className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px] font-bold">Dạ Quang</span>
              </button>

              {/* 4. Khăn Lau Bảng (Towel icon) */}
              <button
                id="touch-tool-eraser-btn"
                onClick={() => handleToolChange('eraser')}
                className={`p-2 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeTool === 'eraser'
                    ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400'
                    : 'hover:bg-white/10 text-slate-300'
                }`}
                title="Khăn lau bảng (Tự động chuyển nét 14p/50p để lau sạch cực nhanh - Phím tắt: E)"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
                  <path d="M5 10v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9" />
                  <path d="M9 14h6" />
                  <path d="M9 17h4" />
                </svg>
                <span className="text-[11px] font-bold">Khăn Lau</span>
              </button>

              {/* 5. Bút Laser chỉ điểm */}
              <button
                id="touch-tool-laser-btn"
                onClick={() => handleToolChange('laser')}
                className={`p-2 rounded-xl flex items-center gap-1 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeTool === 'laser'
                    ? 'bg-red-600 text-white shadow-md ring-2 ring-red-400'
                    : 'hover:bg-white/10 text-slate-300'
                }`}
                title="Bút laser chỉ điểm bài giảng"
              >
                <Sparkles className="w-4 h-4 text-yellow-300" />
                <span className="hidden xl:inline text-[11px]">Laser</span>
              </button>

              {/* 6. Chèn Chữ / Ghi Chú */}
              <button
                id="touch-tool-text-btn"
                onClick={() => handleToolChange('text')}
                className={`p-2 rounded-xl flex items-center gap-1 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeTool === 'text'
                    ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400'
                    : 'hover:bg-white/10 text-slate-300'
                }`}
                title="Chèn chữ / ghi chú bài giảng"
              >
                <Type className="w-4 h-4" />
                <span className="hidden xl:inline text-[11px]">Chữ</span>
              </button>
            </div>

            <div className="h-5 w-px bg-white/20 mx-0.5 shrink-0" />

            {/* 2. Geometric Shapes & Math Curves */}
            <div className="relative flex items-center gap-1 shrink-0">
              {/* Shape Menu Toggle for 2D & 3D Geometry */}
              <button
                id="touch-shape-menu-btn"
                onClick={() => {
                  setShowShapePicker((prev) => !prev);
                  setShowFunctionPicker(false);
                  setShowColorPopover(false);
                  setShowSizePopover(false);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                  [
                    'line',
                    'dashed_line',
                    'arrow',
                    'dashed_arrow',
                    'rectangle',
                    'rect',
                    'circle',
                    'ellipse',
                    'cube',
                    'cuboid',
                    'cone',
                    'cylinder',
                    'sphere',
                  ].includes(activeTool) || showShapePicker
                    ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-400'
                    : 'bg-white/10 hover:bg-white/20 text-purple-200'
                }`}
                title="Mở thư viện Hình học 2D & Hình học Không gian 3D"
              >
                <Shapes className="w-4 h-4 text-purple-300" />
                <span className="text-[11px]">Hình Học</span>
                <ChevronUp className={`w-3 h-3 transition-transform ${showShapePicker ? 'rotate-180' : ''}`} />
              </button>

              {/* Function Graph Tool Toggle for Math Graphs */}
              <button
                id="touch-function-menu-btn"
                onClick={() => {
                  setShowFunctionPicker((prev) => !prev);
                  setShowShapePicker(false);
                  setShowColorPopover(false);
                  setShowSizePopover(false);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                  isFunctionGraphTool(activeTool) || showFunctionPicker
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md ring-2 ring-amber-300'
                    : 'bg-white/10 hover:bg-white/20 text-amber-300'
                }`}
                title="Vẽ đồ thị hàm số chuẩn SGK Toán (Bậc 1, Bậc 2, Bậc 3, Nhất biến, Bậc 2/1, Mũ, Logarit)"
              >
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <span className="text-[11px]">Đồ Thị</span>
                <ChevronUp className={`w-3 h-3 transition-transform ${showFunctionPicker ? 'rotate-180' : ''}`} />
              </button>

              {/* Shape Picker Popover Menu */}
              {showShapePicker && (
                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 p-4 rounded-3xl bg-slate-950/95 backdrop-blur-xl border-2 border-purple-500/60 shadow-2xl w-[92vw] max-w-[420px] text-white flex flex-col gap-3 animate-fade-in max-h-[60vh] overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="text-xs font-black uppercase text-purple-300 tracking-wider flex items-center gap-1.5">
                      <Shapes className="w-4 h-4" />
                      Thư Viện Hình Học Giảng Dạy
                    </span>
                    <button
                      onClick={() => setShowShapePicker(false)}
                      className="p-1 rounded-lg hover:bg-white/10 text-slate-400 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 2D Plane Geometry */}
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 block">
                      1. Hình Phẳng & Nét Vẽ (2D)
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        onClick={() => {
                          setActiveTool('line');
                          setShowShapePicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activeTool === 'line' ? 'bg-indigo-600 text-white' : 'bg-white/5 hover:bg-white/15 text-slate-200'
                        }`}
                      >
                        <Minus className="w-4 h-4" />
                        <span className="text-[10px]">Nét Liền</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTool('dashed_line');
                          setShowShapePicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activeTool === 'dashed_line' ? 'bg-indigo-600 text-white' : 'bg-white/5 hover:bg-white/15 text-slate-200'
                        }`}
                      >
                        <span className="font-mono text-xs font-black tracking-tighter">----</span>
                        <span className="text-[10px]">Nét Đứt</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTool('arrow');
                          setShowShapePicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activeTool === 'arrow' ? 'bg-indigo-600 text-white' : 'bg-white/5 hover:bg-white/15 text-slate-200'
                        }`}
                      >
                        <MoveUpRight className="w-4 h-4" />
                        <span className="text-[10px]">Mũi Tên</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTool('dashed_arrow');
                          setShowShapePicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activeTool === 'dashed_arrow' ? 'bg-indigo-600 text-white' : 'bg-white/5 hover:bg-white/15 text-slate-200'
                        }`}
                      >
                        <MoveRight className="w-4 h-4" />
                        <span className="text-[10px]">Tên Nét Đứt</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTool('rectangle');
                          setShowShapePicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activeTool === 'rectangle' ? 'bg-indigo-600 text-white' : 'bg-white/5 hover:bg-white/15 text-slate-200'
                        }`}
                      >
                        <Square className="w-4 h-4" />
                        <span className="text-[10px]">Chữ Nhật</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTool('circle');
                          setShowShapePicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activeTool === 'circle' ? 'bg-indigo-600 text-white' : 'bg-white/5 hover:bg-white/15 text-slate-200'
                        }`}
                      >
                        <Circle className="w-4 h-4" />
                        <span className="text-[10px]">Hình Tròn</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTool('ellipse');
                          setShowShapePicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activeTool === 'ellipse' ? 'bg-indigo-600 text-white' : 'bg-white/5 hover:bg-white/15 text-slate-200'
                        }`}
                      >
                        <span className="w-5 h-3.5 border-2 border-current rounded-[50%] inline-block" />
                        <span className="text-[10px]">Hình Elip</span>
                      </button>
                    </div>
                  </div>

                  {/* 3D Spatial Geometry */}
                  <div>
                    <span className="text-[10px] font-bold uppercase text-purple-300 mb-1.5 block">
                      2. Hình Học Không Gian (3D - Nét khuất SGK)
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        onClick={() => {
                          setActiveTool('cube');
                          setShowShapePicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activeTool === 'cube' ? 'bg-purple-600 text-white ring-2 ring-purple-300' : 'bg-white/5 hover:bg-white/15 text-slate-200'
                        }`}
                        title="Hình lập phương"
                      >
                        <Box className="w-4 h-4 text-purple-300" />
                        <span className="text-[9.5px] font-bold">Lập Phương</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTool('cuboid');
                          setShowShapePicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activeTool === 'cuboid' ? 'bg-purple-600 text-white ring-2 ring-purple-300' : 'bg-white/5 hover:bg-white/15 text-slate-200'
                        }`}
                        title="Hình hộp chữ nhật"
                      >
                        <Box className="w-4 h-4 text-purple-300 scale-x-125" />
                        <span className="text-[9.5px] font-bold">Hộp CN</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTool('cone');
                          setShowShapePicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activeTool === 'cone' ? 'bg-purple-600 text-white ring-2 ring-purple-300' : 'bg-white/5 hover:bg-white/15 text-slate-200'
                        }`}
                        title="Hình nón không gian"
                      >
                        <span className="text-xs">▲</span>
                        <span className="text-[9.5px] font-bold">Hình Nón</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTool('cylinder');
                          setShowShapePicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activeTool === 'cylinder' ? 'bg-purple-600 text-white ring-2 ring-purple-300' : 'bg-white/5 hover:bg-white/15 text-slate-200'
                        }`}
                        title="Hình trụ tròn xoay"
                      >
                        <span className="text-xs">⌭</span>
                        <span className="text-[9.5px] font-bold">Hình Trụ</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTool('sphere');
                          setShowShapePicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activeTool === 'sphere' ? 'bg-purple-600 text-white ring-2 ring-purple-300' : 'bg-white/5 hover:bg-white/15 text-slate-200'
                        }`}
                        title="Hình cầu không gian"
                      >
                        <Circle className="w-4 h-4 text-purple-300" />
                        <span className="text-[9.5px] font-bold">Hình Cầu</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Function Graph Picker Popover Menu */}
              {showFunctionPicker && (
                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 p-4 rounded-3xl bg-slate-950/95 backdrop-blur-xl border-2 border-amber-500/80 shadow-2xl w-[92vw] max-w-[500px] text-white flex flex-col gap-3.5 animate-fade-in max-h-[60vh] overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="text-xs font-black uppercase text-amber-300 tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4" />
                      Thư Viện Đồ Thị Hàm Số SGK Toán
                    </span>
                    <button
                      onClick={() => setShowFunctionPicker(false)}
                      className="p-1 rounded-lg hover:bg-white/10 text-slate-400 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 1. Hàm Bậc 1 & Bậc 2 Parabol */}
                  <div>
                    <span className="text-[10px] font-bold uppercase text-amber-200/80 mb-1.5 block">
                      1. Hàm Tuyến Tính & Parabol (Bậc 1, Bậc 2)
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          setActiveTool('func_linear');
                          setShowFunctionPicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 cursor-pointer transition-all ${
                          activeTool === 'func_linear' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/5 hover:bg-white/15'
                        }`}
                      >
                        <span className="font-mono text-xs font-bold">y = ax + b</span>
                        <span className="text-[9.5px]">Đường Thẳng</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTool('func_quadratic_up');
                          setShowFunctionPicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 cursor-pointer transition-all ${
                          activeTool === 'func_quadratic_up' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/5 hover:bg-white/15'
                        }`}
                      >
                        <span className="font-mono text-xs font-bold">y = ax² (a&gt;0)</span>
                        <span className="text-[9.5px]">Parabol Lõm Lên</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTool('func_quadratic_down');
                          setShowFunctionPicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 cursor-pointer transition-all ${
                          activeTool === 'func_quadratic_down' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/5 hover:bg-white/15'
                        }`}
                      >
                        <span className="font-mono text-xs font-bold">y = ax² (a&lt;0)</span>
                        <span className="text-[9.5px]">Parabol Lõm Xuống</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. Hàm Bậc 3 & Phân Thức */}
                  <div>
                    <span className="text-[10px] font-bold uppercase text-amber-200/80 mb-1.5 block">
                      2. Hàm Bậc 3 & Phân Thức Hữu Tỉ
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          setActiveTool('func_cubic_2extrema_pos');
                          setShowFunctionPicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 cursor-pointer transition-all ${
                          activeTool === 'func_cubic_2extrema_pos' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/5 hover:bg-white/15'
                        }`}
                      >
                        <span className="font-mono text-xs font-bold">Bậc 3 (a&gt;0, 2 C.Trị)</span>
                        <span className="text-[9.5px]">Cực Đại - Cực Tiểu</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTool('func_rational_pos');
                          setShowFunctionPicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 cursor-pointer transition-all ${
                          activeTool === 'func_rational_pos' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/5 hover:bg-white/15'
                        }`}
                      >
                        <span className="font-mono text-xs font-bold">y = (ax+b)/(cx+d)</span>
                        <span className="text-[9.5px]">Nhất Biến (ad-bc&gt;0)</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTool('func_frac21');
                          setShowFunctionPicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 cursor-pointer transition-all ${
                          activeTool === 'func_frac21' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/5 hover:bg-white/15'
                        }`}
                      >
                        <span className="font-mono text-xs font-bold">Bậc 2 / Bậc 1</span>
                        <span className="text-[9.5px]">Tiệm Cận Xiên</span>
                      </button>
                    </div>
                  </div>

                  {/* 3. Hàm Mũ & Logarit */}
                  <div>
                    <span className="text-[10px] font-bold uppercase text-amber-200/80 mb-1.5 block">
                      3. Hàm Mũ & Hàm Logarit
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setActiveTool('func_exp_pos');
                          setShowFunctionPicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 cursor-pointer transition-all ${
                          activeTool === 'func_exp_pos' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/5 hover:bg-white/15'
                        }`}
                      >
                        <span className="font-mono text-xs font-bold">y = aˣ (a&gt;1)</span>
                        <span className="text-[9.5px]">Hàm Số Mũ Đồng Biến</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTool('func_log_pos');
                          setShowFunctionPicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 cursor-pointer transition-all ${
                          activeTool === 'func_log_pos' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/5 hover:bg-white/15'
                        }`}
                      >
                        <span className="font-mono text-xs font-bold">y = logₐ(x) (a&gt;1)</span>
                        <span className="text-[9.5px]">Hàm Số Logarit</span>
                      </button>
                    </div>
                  </div>

                  {/* 4. Đồ Thị Vật Lý */}
                  <div>
                    <span className="text-[10px] font-bold uppercase text-amber-200/80 mb-1.5 block">
                      4. Đồ Thị Vật Lý (Dao Động, Sóng)
                    </span>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <button
                        onClick={() => {
                          setActiveTool('phys_oscillation');
                          setShowFunctionPicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 cursor-pointer transition-all ${
                          activeTool === 'phys_oscillation' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/5 hover:bg-white/15'
                        }`}
                      >
                        <span className="font-mono text-xs font-bold">x = A.cos(ωt+φ)</span>
                        <span className="text-[9.5px]">Dao Động Điều Hoà</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTool('phys_wave');
                          setShowFunctionPicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 cursor-pointer transition-all ${
                          activeTool === 'phys_wave' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/5 hover:bg-white/15'
                        }`}
                      >
                        <span className="font-mono text-xs font-bold">u(x,t)</span>
                        <span className="text-[9.5px]">Sóng Dừng</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTool('phys_projectile');
                          setShowFunctionPicker(false);
                        }}
                        className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 cursor-pointer transition-all ${
                          activeTool === 'phys_projectile' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/5 hover:bg-white/15'
                        }`}
                      >
                        <span className="font-mono text-xs font-bold">Ném Xiên</span>
                        <span className="text-[9.5px]">Quỹ Đạo Parabol</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="h-5 w-px bg-white/20 mx-0.5 shrink-0" />

            {/* 3. Color Palette Popover Button (17 colors + RGB / Hex picker) */}
            <div className="relative shrink-0">
              <button
                id="touch-color-popover-btn"
                onClick={() => {
                  setShowColorPopover((prev) => !prev);
                  setShowShapePicker(false);
                  setShowFunctionPicker(false);
                  setShowSizePopover(false);
                }}
                className={`p-1.5 sm:p-2 rounded-xl border flex items-center justify-center gap-1 transition-all shrink-0 cursor-pointer ${
                  showColorPopover
                    ? 'bg-white/25 border-white ring-2 ring-white/50 shadow-lg'
                    : 'bg-white/10 hover:bg-white/20 border-white/20'
                }`}
                title="Bảng màu phấn & dạ quang (17 màu + Dải RGB)"
              >
                <div
                  className="w-5 h-5 rounded-full border-2 border-white shadow-md shrink-0 transition-all"
                  style={{
                    backgroundColor: activeColor,
                    boxShadow: ['#ccff00', '#ff007f', '#00ffff'].includes(activeColor)
                      ? `0 0 10px ${activeColor}`
                      : '0 1px 3px rgba(0,0,0,0.5)',
                  }}
                />
                <ChevronUp className={`w-3 h-3 text-slate-300 transition-transform ${showColorPopover ? 'rotate-180' : ''}`} />
              </button>

              {/* Color Palette Popover */}
              {showColorPopover && (
                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 p-3.5 rounded-3xl bg-slate-950/98 backdrop-blur-2xl border-2 border-white/25 shadow-2xl w-[320px] sm:w-[360px] text-white flex flex-col gap-3 select-none animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-1.5">
                      <Palette className="w-4 h-4 text-amber-400" />
                      <span className="text-[11px] font-black uppercase text-slate-200 tracking-wider">
                        BẢNG MÀU PHẤN & DẠ QUANG (17 MÀU)
                      </span>
                    </div>
                    <button
                      onClick={() => setShowColorPopover(false)}
                      className="p-1 rounded-lg hover:bg-white/10 text-slate-400 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Dải RGB tự do / Color input */}
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
                          id="touch-custom-color-input"
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

                  {/* 3 MÀU DẠ QUANG SIÊU SÁNG PHÁT SÁNG CỰC ĐẸP */}
                  <div className="p-2.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-cyan-500/15 border border-amber-400/40 space-y-1.5 shadow-inner">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-amber-300 tracking-wider flex items-center gap-1">
                        <span>✨</span> 3 MÀU DẠ QUANG SIÊU SÁNG
                      </span>
                      <span className="text-[8.5px] px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-200 font-bold border border-amber-400/30">
                        Glow Luminescent
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
                          <span className="text-[9.5px] font-black text-center text-white leading-tight">
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
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-[190px] overflow-y-auto pr-1 custom-scrollbar-none">
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
                              ? 'bg-white/20 ring-2 ring-white scale-105 shadow-md'
                              : 'hover:bg-white/10'
                          }`}
                        >
                          <div
                            className="w-5 h-5 rounded-full border border-white/70 shadow-inner"
                            style={{ backgroundColor: cp.value }}
                          />
                          <span className="text-[8.5px] font-bold text-slate-300 truncate max-w-[52px] text-center">
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

            {/* 4. Stroke Size Selector Dropdown (2p, 4p, 6p, 8p, 12p, 14p, 50p - Mặc định 2p) */}
            <div className="relative shrink-0">
              <button
                id="touch-size-popover-btn"
                onClick={() => {
                  setShowSizePopover((prev) => !prev);
                  setShowColorPopover(false);
                  setShowShapePicker(false);
                  setShowFunctionPicker(false);
                }}
                className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1 text-xs font-mono font-bold transition-all shrink-0 cursor-pointer ${
                  showSizePopover
                    ? 'bg-white text-slate-900 border-white ring-2 ring-white/50 shadow-md font-black'
                    : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
                }`}
                title="Kích cỡ nét phấn & khăn lau (Mặc định 2p - Bấm để chọn 2p, 4p, 6p, 8p, 12p, 14p, 50p)"
              >
                <span className="font-mono font-bold text-xs">{strokeSize}p</span>
                <ChevronUp className={`w-3 h-3 transition-transform ${showSizePopover ? 'rotate-180' : ''}`} />
              </button>

              {/* Popover chọn kích cỡ nét */}
              {showSizePopover && (
                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 p-2.5 rounded-2xl bg-slate-950/98 backdrop-blur-2xl border-2 border-white/25 shadow-2xl w-48 text-white flex flex-col gap-1 select-none animate-fade-in">
                  <div className="flex items-center justify-between pb-1.5 px-1 border-b border-white/10">
                    <span className="text-[10px] font-black uppercase text-slate-300 tracking-wider">
                      CỠ NÉT PHẤN & LAU
                    </span>
                    <button
                      onClick={() => setShowSizePopover(false)}
                      className="p-0.5 rounded hover:bg-white/10 text-slate-400 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-1 max-h-64 overflow-y-auto custom-scrollbar pr-0.5">
                    {[
                      { size: 2, label: '2p (Mặc định)' },
                      { size: 4, label: '4p (Nét vừa)' },
                      { size: 6, label: '6p (Nét đậm)' },
                      { size: 8, label: '8p (Tiêu đề)' },
                      { size: 12, label: '12p (Nhấn mạnh)' },
                      { size: 14, label: '14p (Siêu đậm)' },
                      { size: 50, label: '50p (Khăn lau bảng)' },
                    ].map((sz) => (
                      <button
                        key={sz.size}
                        onClick={() => {
                          setStrokeSize(sz.size);
                          setShowSizePopover(false);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-left text-xs flex items-center justify-between transition-all cursor-pointer ${
                          strokeSize === sz.size
                            ? 'bg-emerald-600 text-white font-black shadow-sm ring-1 ring-emerald-400'
                            : 'hover:bg-white/10 text-slate-200'
                        }`}
                      >
                        <span className="font-medium text-[11px]">{sz.label}</span>
                        <div
                          className="rounded-full bg-white ml-2 shrink-0"
                          style={{
                            width: `${Math.min(sz.size, 16)}px`,
                            height: `${Math.min(sz.size, 16)}px`,
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="h-6 w-px bg-white/20 mx-1" />

            {/* 5. Undo / Redo / Clear / Collapse */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                id="touch-undo-btn"
                onClick={handleUndo}
                disabled={strokes.length === 0}
                className={`p-2.5 rounded-xl flex items-center gap-1 font-bold text-xs transition-all cursor-pointer ${
                  strokes.length > 0
                    ? 'bg-white/15 hover:bg-white/25 text-amber-300 hover:scale-105 active:scale-95'
                    : 'text-slate-500 opacity-40 cursor-not-allowed'
                }`}
                title="Hoàn tác nét viết (Undo - Phím tắt: Ctrl+Z)"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-[10px] hidden lg:inline">Undo</span>
              </button>

              <button
                id="touch-redo-btn"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className={`p-2.5 rounded-xl flex items-center gap-1 font-bold text-xs transition-all cursor-pointer ${
                  redoStack.length > 0
                    ? 'bg-white/15 hover:bg-white/25 text-cyan-300 hover:scale-105 active:scale-95'
                    : 'text-slate-500 opacity-40 cursor-not-allowed'
                }`}
                title="Làm lại nét viết (Redo - Phím tắt: Ctrl+Y hoặc Ctrl+Shift+Z)"
              >
                <RotateCw className="w-4 h-4" />
                <span className="text-[10px] hidden lg:inline">Redo</span>
              </button>

              <button
                id="touch-clear-btn"
                onClick={handleClearBoard}
                disabled={strokes.length === 0 && texts.length === 0}
                className={`p-2.5 rounded-xl flex items-center gap-1 font-bold text-xs transition-all cursor-pointer ${
                  strokes.length > 0 || texts.length > 0
                    ? 'bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white'
                    : 'text-slate-500 opacity-40 cursor-not-allowed'
                }`}
                title="Lau sạch toàn bộ bảng"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-[10px] hidden lg:inline">Xóa Bảng</span>
              </button>

              {/* Theme switcher if background change supported */}
              {onBackgroundChange && (
                <button
                  id="touch-theme-btn"
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

              {/* Close / Collapse Toolbar Button */}
              <button
                id="touch-collapse-dock-btn"
                onClick={() => {
                  setIsDockCollapsed(true);
                  setShowShapePicker(false);
                  setShowFunctionPicker(false);
                  setShowColorPopover(false);
                  setShowSizePopover(false);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-amber-300 hover:text-white transition-all ml-1 flex items-center gap-1 text-xs font-bold border border-white/20 shadow-md active:scale-95 cursor-pointer shrink-0"
                title="Thu gọn toàn bộ thanh công cụ viết bảng"
              >
                <ChevronDown className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] font-bold">Thu Gọn</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Collapsed Floating Dock at Bottom-Right (matching Blackboard view) */
        <div className="absolute bottom-6 md:bottom-8 right-6 z-40 pointer-events-auto animate-fade-in flex items-center gap-2">
          <button
            id="touch-expand-dock-btn"
            onClick={() => setIsDockCollapsed(false)}
            className="px-4 py-2.5 rounded-2xl bg-slate-950/95 hover:bg-indigo-600 text-white font-black text-xs md:text-sm flex items-center gap-2 shadow-2xl backdrop-blur-xl border-2 border-indigo-400/80 transition-all hover:scale-105 active:scale-95 cursor-pointer ring-4 ring-indigo-500/20"
            title="Mở toàn bộ thanh công cụ viết bảng"
          >
            <div
              className="w-3.5 h-3.5 rounded-full border border-white shrink-0"
              style={{
                backgroundColor: activeColor,
                boxShadow: ['#ccff00', '#ff007f', '#00ffff'].includes(activeColor) ? `0 0 8px ${activeColor}` : undefined,
              }}
            />
            <div className="relative w-4 h-4 flex items-center justify-center">
              <Hand className="w-3.5 h-3.5 rotate-[-15deg] text-emerald-200" />
              <PenLine className="w-2.5 h-2.5 absolute -top-0.5 -right-0.5 text-amber-300" />
            </div>
            <span>Mở Thanh Công Cụ</span>
            <ChevronUp className="w-4 h-4 text-amber-300" />
          </button>

          {isOverlay && onCloseOverlay && (
            <button
              onClick={onCloseOverlay}
              className="px-3.5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xl border border-white/30 transition-all active:scale-95 cursor-pointer ring-2 ring-rose-400/50"
              title="Tắt công cụ vẽ để trở về màn hình trình chiếu"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
              <span>Trở về trình chiếu</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
