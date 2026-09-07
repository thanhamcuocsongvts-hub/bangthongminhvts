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
  RotateCw,
  Trash2,
  Download,
  Palette,
  Maximize2,
  Minimize2,
  Type,
  Dices,
  Plus,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  UploadCloud,
  FileText,
  Presentation,
  BookOpen,
  X,
  ChevronDown,
  ChevronUp,
  Move,
  Eye,
  Sliders,
  CheckCircle2,
  Award,
  Split,
  ZoomIn,
  ZoomOut,
  Sigma,
  ExternalLink,
  Pipette,
  HelpCircle,
  BookmarkCheck,
  CheckSquare,
  Box,
  Shapes,
  Globe,
  Triangle,
  MoveRight,
  Layers,
  AlertTriangle,
  Sparkle,
  TrendingUp,
  MousePointer2,
  FoldVertical,
  Hand,
  PenLine,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { WhiteboardStroke, WhiteboardTool, StrokePoint, StrokeVertex, ClassRoom, LessonDoc, TeacherProfile, BlackboardBackground } from '../types';
import { parseUploadedFileToLesson, cleanDocumentText } from '../utils/fileParser';
import { computeDefaultVertices, updateVertexWithConstraints, drawShapeWithVertices } from '../utils/geometryVertices';
import { isFunctionGraphTool, drawFunctionGraph } from '../utils/mathGraphRenderer';
import { MathFormulaRenderer } from './MathFormulaRenderer';
import { UniversalDocumentViewer } from './UniversalDocumentViewer';
import { BlackboardWordTextBox, BlackboardTextBox } from './BlackboardWordTextBox';

interface BlackboardPage {
  id: string;
  name: string;
  strokes: WhiteboardStroke[];
  redoStack: WhiteboardStroke[];
  texts: BlackboardTextBox[];
}

interface ClassroomBlackboardViewProps {
  classroom?: ClassRoom | null;
  activeTeacher?: TeacherProfile | null;
  lessons?: LessonDoc[];
  activeLessonId?: string;
  onSelectLesson?: (id: string) => void;
  onAddLesson?: (newDoc: LessonDoc) => void;
  onUpdateLesson?: (updatedDoc: LessonDoc) => void;
  onDeleteLesson?: (id: string) => void;
  onSwitchToPresentation?: () => void;
  onSwitchToReader?: () => void;
  onOpenRandomPicker?: () => void;
  isInitialFullScreen?: boolean;
}

export const ClassroomBlackboardView: React.FC<ClassroomBlackboardViewProps> = ({
  classroom,
  activeTeacher,
  lessons = [],
  activeLessonId,
  onSelectLesson,
  onAddLesson,
  onUpdateLesson,
  onDeleteLesson,
  onSwitchToPresentation,
  onSwitchToReader,
  onOpenRandomPicker,
  isInitialFullScreen = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fullscreen state
  const [isFullBoard, setIsFullBoard] = useState<boolean>(isInitialFullScreen);

  // Background style
  const [bgTheme, setBgTheme] = useState<BlackboardBackground>('blackboard');

  // Split-Screen Mode (Blackboard on Left + Document on Right)
  const [isSplitScreen, setIsSplitScreen] = useState<boolean>(false);
  const [splitRatio, setSplitRatio] = useState<'50/50' | '60/40' | '40/60'>('50/50');
  const [splitDocZoom, setSplitDocZoom] = useState<number>(100);

  // Active Tool & Chalk Styling (Mặc định nét 2p, riêng khăn lau là 50p)
  const [activeTool, setActiveTool] = useState<WhiteboardTool>('pen');
  const [activeColor, setActiveColor] = useState<string>('#ffffff');
  const [strokeSize, setStrokeSize] = useState<number>(2);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentPoints, setCurrentPoints] = useState<StrokePoint[]>([]);

  // Chuyển đổi công cụ vẽ: tất cả về mặc định 2p, riêng Khăn Lau là 50p
  const handleToolChange = (tool: WhiteboardTool) => {
    setActiveTool(tool);
    if (tool === 'eraser') {
      setStrokeSize(50);
    } else {
      if (strokeSize === 50) {
        setStrokeSize(2);
      }
    }
  };

  // Modals & Shape Popovers
  const [showShapePicker, setShowShapePicker] = useState<boolean>(false);
  const [showFunctionPicker, setShowFunctionPicker] = useState<boolean>(false);
  const [showClearBoardModal, setShowClearBoardModal] = useState<boolean>(false);
  const [docToDelete, setDocToDelete] = useState<LessonDoc | null>(null);

  // Dock UI state & Screen Space Optimization
  const [isTopBarCollapsed, setIsTopBarCollapsed] = useState<boolean>(true); // Default to collapsed for maximum blackboard space
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [isImmersiveMode, setIsImmersiveMode] = useState<boolean>(false); // 1-Click Clean Board Mode
  const [showColorPopover, setShowColorPopover] = useState<boolean>(false);
  const [showSizePopover, setShowSizePopover] = useState<boolean>(false);
  const [draggedVertexIdx, setDraggedVertexIdx] = useState<number | null>(null);

  // Infinite Scroll & Continuous Blackboard State (Dọc & Ngang Không Giới Hạn)
  const [boardScrollX, setBoardScrollX] = useState<number>(0);
  const [boardScrollY, setBoardScrollY] = useState<number>(0);
  const [boardExtraWidth, setBoardExtraWidth] = useState<number>(0);
  const [boardExtraHeight, setBoardExtraHeight] = useState<number>(0);

  // Data / Document Feature State
  const [showDocumentModal, setShowDocumentModal] = useState<boolean>(false);
  const [isProcessingUpload, setIsProcessingUpload] = useState<boolean>(false);

  // Picture-in-Picture Floating Corner Document on Blackboard
  const [isCornerDocOpen, setIsCornerDocOpen] = useState<boolean>(false);
  const [cornerDocPosition, setCornerDocPosition] = useState<'top-right' | 'top-left' | 'bottom-right'>('top-right');
  const [cornerDocTab, setCornerDocTab] = useState<'original' | 'slides' | 'content' | 'ai_extract'>('original');
  const [cornerDocSize, setCornerDocSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [cornerDocSlideIdx, setCornerDocSlideIdx] = useState<number>(0);
  const [isCornerDocMinimized, setIsCornerDocMinimized] = useState<boolean>(false);
  const [cornerDocZoom, setCornerDocZoom] = useState<number>(100);

  // On-demand AI extraction state in Corner Doc
  const [isCornerAIExtracting, setIsCornerAIExtracting] = useState<boolean>(false);
  const [cornerExtractedData, setCornerExtractedData] = useState<any>(null);

  // Word-style Text Box insertion & Drag selection state
  const [newTextBoxDrag, setNewTextBoxDrag] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [isDraggingText, setIsDraggingText] = useState<boolean>(false);
  const [dragLivePos, setDragLivePos] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ startMouseX: number; startMouseY: number; origX: number; origY: number } | null>(null);

  // Selected Stroke & 360-Degree Rotation & Smooth Scaling State
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const [isStrokeToolbarExpanded, setIsStrokeToolbarExpanded] = useState<boolean>(false);
  const [isDraggingStroke, setIsDraggingStroke] = useState<boolean>(false);
  const [isResizingStroke, setIsResizingStroke] = useState<boolean>(false);
  const resizeStrokeStartRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    origScale: number;
    origBounds: { centerX: number; centerY: number; width: number; height: number };
    direction: string;
  } | null>(null);
  const strokeRafRef = useRef<number | null>(null);
  const dragStrokeStartRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    origPoints: StrokePoint[];
    origVertices?: StrokeVertex[];
    centerX: number;
    centerY: number;
    origRotation: number;
  } | null>(null);

  // Dedicated movement speed and continuous hold-to-move timer for drawn shapes & graphs
  const [moveSpeed, setMoveSpeed] = useState<number>(15);
  const continuousNudgeIntervalRef = useRef<any>(null);

  // Active stroke refs for high-fps smooth drawing without React re-render lags
  const activePointsRef = useRef<StrokePoint[]>([]);
  const isDrawingRef = useRef<boolean>(false);

  // Laser pointer position state
  const [laserPos, setLaserPos] = useState<{ x: number; y: number } | null>(null);
  const laserTimeoutRef = useRef<any>(null);

  // Multi-page chalkboard management
  const [pages, setPages] = useState<BlackboardPage[]>([
    {
      id: 'page_1',
      name: 'Bảng 1',
      strokes: [],
      redoStack: [],
      texts: [],
    },
  ]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);

  const currentPage = pages[currentPageIndex] || pages[0];
  const strokes = currentPage.strokes;
  const redoStack = currentPage.redoStack;
  const texts = currentPage.texts;

  const currentLesson = (lessons || []).find((l) => l.id === activeLessonId) || lessons?.[0] || null;

  // Safe display text free from raw binary
  const displaySafeText = currentLesson
    ? cleanDocumentText(currentLesson.rawText) ||
      `Tài liệu: ${currentLesson.title}\nLoại tệp: ${currentLesson.fileType?.toUpperCase() || 'Tài liệu'} (${currentLesson.fileSize || 'Sẵn sàng'})\nĐã sẵn sàng hiển thị trực tiếp trên SmartBoard 75 Pro.`
    : '';

  // Chalk Palette Colors (Tổng cộng 17 màu - gồm 3 màu dạ quang siêu sáng cực nét)
  const chalkPalette = [
    // 3 MÀU DẠ QUANG SIÊU SÁNG PHÁT SÁNG TRÊN BẢNG (FLUORESCENT / NEON)
    { label: 'Dạ Quang Vàng Chanh', value: '#ccff00', isFluorescent: true, desc: 'Dạ quang siêu sáng chói' },
    { label: 'Dạ Quang Hồng Neon', value: '#ff007f', isFluorescent: true, desc: 'Dạ quang hồng phát sáng' },
    { label: 'Dạ Quang Xanh Ngọc', value: '#00ffff', isFluorescent: true, desc: 'Dạ quang lân tinh rực rỡ' },
    // 14 MÀU PHẤN & BÚT BẢNG TIÊU CHUẨN & MỞ RỘNG
    { label: 'Phấn Trắng', value: '#ffffff' },
    { label: 'Phấn Vàng Hoàng Yến', value: '#facc15' },
    { label: 'Vàng Hổ Phách Gold', value: '#f59e0b' },
    { label: 'Phấn Cam Rực Rỡ', value: '#fb923c' },
    { label: 'Cam San Hô Đào', value: '#fb7185' },
    { label: 'Đỏ Cờ Thuần Khiết', value: '#ef4444' },
    { label: 'Phấn Đỏ Hồng', value: '#f87171' },
    { label: 'Phấn Tím Mộng Mơ', value: '#c084fc' },
    { label: 'Tím Tử Đinh Hương', value: '#8b5cf6' },
    { label: 'Xanh Lam Hoàng Gia', value: '#2563eb' },
    { label: 'Phấn Cyan Sáng', value: '#38bdf8' },
    { label: 'Xanh Bạc Hà Tươi', value: '#2dd4bf' },
    { label: 'Phấn Xanh Non', value: '#4ade80' },
    { label: 'Xanh Lục Bảo Đậm', value: '#10b981' },
  ];

  // Chalk Stroke Sizes
  const chalkSizes = [
    { label: 'Nét Thanh (2p)', size: 2 },
    { label: 'Nét Vừa (4p)', size: 4 },
    { label: 'Nét Đậm (8p)', size: 8 },
    { label: 'Nét Rất Đậm (14p)', size: 14 },
    { label: 'Khăn Lau Bảng Nhanh (50p)', size: 50 },
  ];

  // Resize canvas according to container dimensions
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Calculate width taking split screen into account
    let targetWidth = container.clientWidth;
    if (isSplitScreen) {
      if (splitRatio === '50/50') targetWidth = container.clientWidth * 0.5;
      else if (splitRatio === '60/40') targetWidth = container.clientWidth * 0.6;
      else if (splitRatio === '40/60') targetWidth = container.clientWidth * 0.4;
    }

    const targetHeight = container.clientHeight;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = targetWidth * dpr;
    canvas.height = targetHeight * dpr;
    canvas.style.width = `${targetWidth}px`;
    canvas.style.height = `${targetHeight}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      redrawCanvas(ctx);
    }
  }, [strokes, texts, isSplitScreen, splitRatio]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  // Helper to calculate accurate bounding box and center of any whiteboard stroke
  const getStrokeBounds = useCallback((stroke: WhiteboardStroke) => {
    // 1. Dedicated precise calculation for Circle
    if (stroke.tool === 'circle') {
      let cx = 0, cy = 0, radius = 20;
      if (stroke.customVertices && stroke.customVertices.length >= 2) {
        const [O, R] = stroke.customVertices;
        cx = O.x;
        cy = O.y;
        radius = Math.max(10, Math.hypot(R.x - O.x, R.y - O.y));
      } else if (stroke.points && stroke.points.length >= 2) {
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

    // 2. Dedicated precise calculation for Ellipse
    if (stroke.tool === 'ellipse') {
      let cx = 0, cy = 0, rx = 30, ry = 20;
      if (stroke.customVertices && stroke.customVertices.length >= 2) {
        const O = stroke.customVertices[0];
        const Rx = stroke.customVertices[1];
        const Ry = stroke.customVertices[2] || { x: O.x, y: O.y + 20 };
        cx = O.x;
        cy = O.y;
        rx = Math.max(10, Math.abs(Rx.x - O.x));
        ry = Math.max(10, Math.abs(Ry.y - O.y));
      } else if (stroke.points && stroke.points.length >= 2) {
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

    // 3. Calculation for 3D and 2D shapes with custom vertices
    if (stroke.customVertices && stroke.customVertices.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      stroke.customVertices.forEach((v) => {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
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
      const padding = 14;
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
    }

    if (!stroke.points || stroke.points.length === 0) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    stroke.points.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    // Ensure a minimum bounding box for single clicks or small points
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

  // Helper function to render any whiteboard stroke (2D & 3D geometry math + rotation & scale + vertex constraints)
  const renderSingleStroke = (
    ctx: CanvasRenderingContext2D,
    tool: WhiteboardTool,
    points: StrokePoint[],
    color: string,
    size: number,
    rotation: number = 0,
    centerX?: number,
    centerY?: number,
    scale: number = 1,
    customVertices?: StrokeVertex[]
  ) => {
    if ((!points || points.length === 0) && (!customVertices || customVertices.length === 0)) return;

    ctx.save();

    // Apply 360-degree rotation and scaling around center point
    if (rotation !== 0 || scale !== 1) {
      let cx = centerX;
      let cy = centerY;
      if (cx === undefined || cy === undefined) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        if (customVertices && customVertices.length > 0) {
          customVertices.forEach((v) => {
            if (v.x < minX) minX = v.x;
            if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y;
            if (v.y > maxY) maxY = v.y;
          });
        } else if (points) {
          points.forEach((p) => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          });
        }
        cx = (minX + maxX) / 2;
        cy = (minY + maxY) / 2;
      }
      ctx.translate(cx, cy);
      ctx.rotate((rotation * Math.PI) / 180);
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
      ctx.globalAlpha = isFluo ? 0.65 : 0.35;
      if (isFluo) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
      }
    } else if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1.0;
    } else {
      ctx.globalAlpha = 0.95;
      ctx.shadowColor = color;
      ctx.shadowBlur = isFluo ? 8 : 1;
    }

    // Check if custom vertices are available for parallel geometry rendering
    if (customVertices && customVertices.length > 0) {
      drawShapeWithVertices(ctx, tool, customVertices, color, size);
      ctx.restore();
      return;
    }

    // Check if tool is a Mathematical Function Graph
    if (isFunctionGraphTool(tool)) {
      let renderPts = points;
      if (!points || points.length === 1) {
        const p = points && points.length > 0 ? points[0] : { x: 150, y: 150, pressure: 0.5 };
        renderPts = [
          p,
          { x: p.x + 300, y: p.y + 240, pressure: 0.5 },
        ];
      }
      drawFunctionGraph(ctx, tool, renderPts, color, size);
      ctx.restore();
      return;
    }

    const p1 = points[0];
    const p2 = points[points.length - 1];

    if ((tool === 'rectangle' || tool === 'rect') && points.length >= 2) {
      ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    } else if (tool === 'circle' && points.length >= 2) {
      const radius = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
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
    } else if (tool === 'cube' && points.length >= 2) {
      // 3D Cube (Hình lập phương chuẩn SGK Toán)
      const w = p2.x - p1.x;
      const h = p2.y - p1.y;
      const s = Math.max(28, Math.min(Math.abs(w), Math.abs(h)));
      const sx = w >= 0 ? 1 : -1;
      const sy = h >= 0 ? 1 : -1;
      const x = p1.x + (sx < 0 ? -s : 0);
      const y = p1.y + (sy < 0 ? -s : 0);
      const dx = s * 0.35;
      const dy = -s * 0.35;

      // Front face
      ctx.beginPath();
      ctx.strokeRect(x, y, s, s);

      // Visible edges
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy);
      ctx.moveTo(x + s, y); ctx.lineTo(x + s + dx, y + dy);
      ctx.moveTo(x + s, y + s); ctx.lineTo(x + s + dx, y + s + dy);
      ctx.moveTo(x + dx, y + dy); ctx.lineTo(x + s + dx, y + dy);
      ctx.moveTo(x + s + dx, y + dy); ctx.lineTo(x + s + dx, y + s + dy);
      ctx.stroke();

      // Hidden edges (dashed)
      ctx.beginPath();
      ctx.setLineDash([6, 5]);
      ctx.moveTo(x, y + s); ctx.lineTo(x + dx, y + s + dy);
      ctx.moveTo(x + dx, y + s + dy); ctx.lineTo(x + dx, y + dy);
      ctx.moveTo(x + dx, y + s + dy); ctx.lineTo(x + s + dx, y + s + dy);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (tool === 'cuboid' && points.length >= 2) {
      // 3D Cuboid (Hình hộp chữ nhật chuẩn SGK Toán)
      const w = Math.max(36, Math.abs(p2.x - p1.x));
      const h = Math.max(28, Math.abs(p2.y - p1.y));
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y) + h * 0.25;
      const fh = h * 0.75;
      const dx = Math.min(w * 0.35, 60);
      const dy = -Math.min(h * 0.3, 45);

      // Front face
      ctx.beginPath();
      ctx.strokeRect(x, y, w, fh);

      // Visible edges
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy);
      ctx.moveTo(x + w, y); ctx.lineTo(x + w + dx, y + dy);
      ctx.moveTo(x + w, y + fh); ctx.lineTo(x + w + dx, y + fh + dy);
      ctx.moveTo(x + dx, y + dy); ctx.lineTo(x + w + dx, y + dy);
      ctx.moveTo(x + w + dx, y + dy); ctx.lineTo(x + w + dx, y + fh + dy);
      ctx.stroke();

      // Hidden edges (dashed)
      ctx.beginPath();
      ctx.setLineDash([6, 5]);
      ctx.moveTo(x, y + fh); ctx.lineTo(x + dx, y + fh + dy);
      ctx.moveTo(x + dx, y + fh + dy); ctx.lineTo(x + dx, y + dy);
      ctx.moveTo(x + dx, y + fh + dy); ctx.lineTo(x + w + dx, y + fh + dy);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (tool === 'cone' && points.length >= 2) {
      // 3D Cone (Hình nón không gian)
      const topY = Math.min(p1.y, p2.y);
      const bottomY = Math.max(p1.y, p2.y);
      const cx = (p1.x + p2.x) / 2;
      const rx = Math.max(16, Math.abs(p2.x - p1.x) / 2);
      const ry = Math.max(6, Math.min(rx * 0.35, 45));

      // Side tangents
      ctx.beginPath();
      ctx.moveTo(cx, topY); ctx.lineTo(cx - rx, bottomY);
      ctx.moveTo(cx, topY); ctx.lineTo(cx + rx, bottomY);
      ctx.stroke();

      // Front bottom arc (solid)
      ctx.beginPath();
      ctx.ellipse(cx, bottomY, rx, ry, 0, 0, Math.PI);
      ctx.stroke();

      // Back bottom arc (dashed)
      ctx.beginPath();
      ctx.setLineDash([6, 5]);
      ctx.ellipse(cx, bottomY, rx, ry, 0, Math.PI, 2 * Math.PI);
      // Height axis (dashed)
      ctx.moveTo(cx, topY); ctx.lineTo(cx, bottomY);
      // Radius (dashed)
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
      // 3D Cylinder / Revolution Cylinder (Hình trụ tròn xoay có trục & đường sinh chuẩn SGK)
      const topY = Math.min(p1.y, p2.y);
      const bottomY = Math.max(p1.y, p2.y);
      const cx = (p1.x + p2.x) / 2;
      const rx = Math.max(18, Math.abs(p2.x - p1.x) / 2);
      const ry = Math.max(6, Math.min(rx * 0.32, 42));

      // Top full ellipse (solid)
      ctx.beginPath();
      ctx.ellipse(cx, topY, rx, ry, 0, 0, 2 * Math.PI);
      ctx.stroke();

      // Side generator lines (solid)
      ctx.beginPath();
      ctx.moveTo(cx - rx, topY); ctx.lineTo(cx - rx, bottomY);
      ctx.moveTo(cx + rx, topY); ctx.lineTo(cx + rx, bottomY);
      ctx.stroke();

      // Bottom front arc (solid)
      ctx.beginPath();
      ctx.ellipse(cx, bottomY, rx, ry, 0, 0, Math.PI);
      ctx.stroke();

      // Bottom back arc + center rotation axis O O' + base radius (dashed)
      ctx.beginPath();
      ctx.setLineDash([6, 5]);
      ctx.ellipse(cx, bottomY, rx, ry, 0, Math.PI, 2 * Math.PI);
      ctx.moveTo(cx, topY); ctx.lineTo(cx, bottomY); // Trục đối xứng OO'
      ctx.moveTo(cx, bottomY); ctx.lineTo(cx + rx, bottomY); // Bán kính đáy dưới R
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (tool === 'sphere' && points.length >= 2) {
      // 3D Sphere (Hình cầu không gian)
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const r = Math.max(16, Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)) / 2);
      const ry = Math.max(6, r * 0.32);

      // Outer circle (solid)
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.stroke();

      // Equator front arc (solid)
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, ry, 0, 0, Math.PI);
      ctx.stroke();

      // Equator back arc + axis (dashed)
      ctx.beginPath();
      ctx.setLineDash([6, 5]);
      ctx.ellipse(cx, cy, r, ry, 0, Math.PI, 2 * Math.PI);
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Freehand chalk stroke with ultra-smooth Catmull-Rom / Midpoint Bezier interpolation
      if (points.length === 1) {
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, (tool === 'highlighter' ? size * 2.5 : size) / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (points.length === 2) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
          const xc = (points[i].x + points[i + 1].x) / 2;
          const yc = (points[i].y + points[i + 1].y) / 2;
          ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        // Connect smoothly to the last point
        const last = points[points.length - 1];
        const prev = points[points.length - 2];
        ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y);
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  // Redraw all strokes & texts with boardScrollX & boardScrollY viewport translation
  const redrawCanvas = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      ctx.save();
      ctx.translate(-boardScrollX, -boardScrollY);

      // Render all saved strokes
      strokes.forEach((stroke) => {
        try {
          renderSingleStroke(
            ctx,
            stroke.tool,
            stroke.points,
            stroke.color,
            stroke.size,
            stroke.rotation || 0,
            stroke.centerX,
            stroke.centerY,
            stroke.scale || 1,
            stroke.customVertices
          );
        } catch (err) {
          console.warn('Safe catch in renderSingleStroke:', err);
        }
      });

      // Text boxes are rendered as high-fidelity interactive DOM overlays with full Word formatting & KaTeX support

      ctx.restore();
    },
    [strokes, texts, selectedTextId, boardScrollX, boardScrollY]
  );

  // Automatically refresh canvas whenever strokes, texts, or selection state change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    redrawCanvas(ctx);
  }, [redrawCanvas, strokes, texts, selectedTextId, selectedStrokeId, currentPageIndex, boardScrollX, boardScrollY]);

  // Ultra-smooth vertex dragging with parallel geometric constraints
  const handleVertexDrag = useCallback(
    (vIdx: number, canvasX: number, canvasY: number) => {
      if (!selectedStrokeId) return;

      setPages((prev) => {
        const updated = [...prev];
        const curr = updated[currentPageIndex];
        if (!curr) return prev;
        const newStrokes = curr.strokes.map((s) => {
          if (s.id === selectedStrokeId) {
            const curVerts =
              s.customVertices && s.customVertices.length > 0
                ? s.customVertices
                : computeDefaultVertices(s.tool, s.points);
            const newVerts = updateVertexWithConstraints(s.tool, curVerts, vIdx, canvasX, canvasY);
            const bounds = getStrokeBounds({ ...s, customVertices: newVerts });
            return {
              ...s,
              customVertices: newVerts,
              centerX: bounds ? bounds.centerX : s.centerX,
              centerY: bounds ? bounds.centerY : s.centerY,
            };
          }
          return s;
        });
        updated[currentPageIndex] = { ...curr, strokes: newStrokes };
        return updated;
      });
    },
    [selectedStrokeId, currentPageIndex, getStrokeBounds]
  );

  // Nudge selected stroke smoothly up, down, left, or right
  const handleNudgeStroke = useCallback((deltaX: number, deltaY: number) => {
    if (!selectedStrokeId) return;
    setPages((prev) => {
      const updated = [...prev];
      const curr = updated[currentPageIndex];
      if (!curr) return prev;
      const newStrokes = curr.strokes.map((s) => {
        if (s.id === selectedStrokeId) {
          const movedPoints = s.points ? s.points.map((p) => ({ ...p, x: p.x + deltaX, y: p.y + deltaY })) : [];
          const movedVertices = s.customVertices ? s.customVertices.map((v) => ({ ...v, x: v.x + deltaX, y: v.y + deltaY })) : undefined;
          return {
            ...s,
            points: movedPoints,
            customVertices: movedVertices,
            centerX: s.centerX ? s.centerX + deltaX : undefined,
            centerY: s.centerY ? s.centerY + deltaY : undefined,
          };
        }
        return s;
      });
      updated[currentPageIndex] = { ...curr, strokes: newStrokes };
      return updated;
    });
  }, [selectedStrokeId, currentPageIndex]);

  // Continuous hold-to-move controller for 4-way navigation buttons (Up, Down, Left, Right)
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
    const curr = pages[currentPageIndex];
    if (!curr) return;
    const targetStroke = curr.strokes.find((s) => s.id === selectedStrokeId);
    if (!targetStroke) return;
    const bounds = getStrokeBounds(targetStroke);
    if (!bounds) return;

    const visibleCenterX = canvas.width / 2 + boardScrollX;
    const visibleCenterY = canvas.height / 2 + boardScrollY;
    const deltaX = Math.round(visibleCenterX - bounds.centerX);
    const deltaY = Math.round(visibleCenterY - bounds.centerY);
    handleNudgeStroke(deltaX, deltaY);
  }, [selectedStrokeId, pages, currentPageIndex, boardScrollX, boardScrollY, getStrokeBounds, handleNudgeStroke]);

  // Clean up continuous interval when unmounting or stroke changes
  useEffect(() => {
    return () => {
      if (continuousNudgeIntervalRef.current) {
        clearInterval(continuousNudgeIntervalRef.current);
        continuousNudgeIntervalRef.current = null;
      }
    };
  }, [selectedStrokeId]);

  // Keyboard arrow keys for smooth movement
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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStrokeId, handleNudgeStroke, moveSpeed]);

  // Pointer Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const x = canvasX + boardScrollX;
    const y = canvasY + boardScrollY;

    if (activeTool === 'laser') {
      setLaserPos({ x: canvasX, y: canvasY });
      return;
    }

    if (activeTool === 'select') {
      // 1. Hit-test on text elements from top to bottom
      const hitText = texts.slice().reverse().find((t) => {
        const textWidth = t.width || Math.max(t.text.length * (t.size * 0.65), 140);
        const textHeight = t.height || (t.size * 2 + 20);
        return x >= t.x && x <= t.x + textWidth && y >= t.y && y <= t.y + textHeight;
      });

      if (hitText) {
        setSelectedTextId(hitText.id);
        setSelectedStrokeId(null);
        setIsDraggingText(true);
        setIsDraggingStroke(false);
        setDragLivePos({ x: hitText.x, y: hitText.y });
        dragStartRef.current = {
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          origX: hitText.x,
          origY: hitText.y,
        };
        return;
      }

      // 2. Hit-test on drawn strokes & geometric shapes (with accurate radial math for circles & ellipses)
      const hitStroke = strokes.slice().reverse().find((s) => {
        const bounds = getStrokeBounds(s);
        if (!bounds) return false;
        if (s.tool === 'circle') {
          const dist = Math.hypot(x - bounds.centerX, y - bounds.centerY);
          return dist <= (bounds.radius || bounds.width / 2) + 20;
        }
        if (s.tool === 'ellipse') {
          const rx = (bounds.rx || bounds.width / 2) + 15;
          const ry = (bounds.ry || bounds.height / 2) + 15;
          const normX = (x - bounds.centerX) / rx;
          const normY = (y - bounds.centerY) / ry;
          return normX * normX + normY * normY <= 1.0;
        }
        return x >= bounds.minX - 10 && x <= bounds.maxX + 10 && y >= bounds.minY - 10 && y <= bounds.maxY + 10;
      });

      if (hitStroke) {
        setSelectedStrokeId(hitStroke.id);
        setIsStrokeToolbarExpanded(false);
        setSelectedTextId(null);
        setIsDraggingStroke(true);
        setIsDraggingText(false);
        const bounds = getStrokeBounds(hitStroke)!;
        dragStrokeStartRef.current = {
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          origPoints: hitStroke.points ? hitStroke.points.map((p) => ({ ...p })) : [],
          origVertices: hitStroke.customVertices ? hitStroke.customVertices.map((v) => ({ ...v })) : undefined,
          centerX: bounds.centerX,
          centerY: bounds.centerY,
          origRotation: hitStroke.rotation || 0,
        };
        return;
      }

      // If clicked on empty space, deselect both
      setSelectedTextId(null);
      setSelectedStrokeId(null);
      setIsStrokeToolbarExpanded(false);
      setDragLivePos(null);
      return;
    }

    // Deselect active items when clicking anywhere on the blackboard with other tools
    if (selectedTextId || selectedStrokeId) {
      setSelectedTextId(null);
      setSelectedStrokeId(null);
      setIsStrokeToolbarExpanded(false);
      setDragLivePos(null);
    }

    // Word Text Box marquee drag initiation
    if (activeTool === 'text') {
      setNewTextBoxDrag({ startX: x, startY: y, curX: x, curY: y });
      return;
    }

    isDrawingRef.current = true;
    setIsDrawing(true);
    const startPt = { x, y, pressure: e.pressure || 0.5 };
    activePointsRef.current = [startPt];
    setCurrentPoints([startPt]);

    // For freehand pen/eraser/highlighter, draw initial dot immediately
    const ctx = canvas.getContext('2d');
    if (ctx && (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser')) {
      ctx.save();
      ctx.translate(-boardScrollX, -boardScrollY);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (activeTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';
      } else {
        ctx.fillStyle = activeColor;
        if (activeTool === 'highlighter') ctx.globalAlpha = 0.45;
      }
      ctx.beginPath();
      ctx.arc(x, y, (activeTool === 'highlighter' ? strokeSize * 2.5 : strokeSize) / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const x = canvasX + boardScrollX;
    const y = canvasY + boardScrollY;

    if (activeTool === 'laser') {
      setLaserPos({ x: canvasX, y: canvasY });
      clearTimeout(laserTimeoutRef.current);
      laserTimeoutRef.current = setTimeout(() => setLaserPos(null), 1200);
      return;
    }

    // Live marquee dragging for creating new Word Text Box
    if (newTextBoxDrag) {
      setNewTextBoxDrag((prev) => (prev ? { ...prev, curX: x, curY: y } : null));
      return;
    }

    // Live scaling of selected geometric shape via corner handles
    if (isResizingStroke && resizeStrokeStartRef.current && selectedStrokeId) {
      const { startMouseX, startMouseY, origScale, origBounds, direction } = resizeStrokeStartRef.current;
      const dx = e.clientX - startMouseX;
      const dy = e.clientY - startMouseY;
      const signX = direction.includes('e') ? 1 : direction.includes('w') ? -1 : 0;
      const signY = direction.includes('s') ? 1 : direction.includes('n') ? -1 : 0;
      const factorX = signX !== 0 ? (dx * signX) / Math.max(origBounds.width, 60) : 0;
      const factorY = signY !== 0 ? (dy * signY) / Math.max(origBounds.height, 60) : 0;
      const factor = Math.max(factorX, factorY) || factorX || factorY;
      const newScale = Math.max(0.15, Math.min(5.0, Number((origScale * (1 + factor)).toFixed(2))));

      if (strokeRafRef.current) cancelAnimationFrame(strokeRafRef.current);
      strokeRafRef.current = requestAnimationFrame(() => {
        setPages((prev) => {
          const updated = [...prev];
          const curr = updated[currentPageIndex];
          if (!curr) return prev;
          const newStrokes = curr.strokes.map((s) =>
            s.id === selectedStrokeId ? { ...s, scale: newScale } : s
          );
          updated[currentPageIndex] = { ...curr, strokes: newStrokes };
          return updated;
        });
      });
      return;
    }

    // Live dragging of a vertex on a geometric shape (with parallel constraints)
    if (draggedVertexIdx !== null && selectedStrokeId) {
      handleVertexDrag(draggedVertexIdx, x, y);
      return;
    }

    // Live dragging of selected text
    if (isDraggingText && dragStartRef.current && selectedTextId) {
      const deltaX = e.clientX - dragStartRef.current.startMouseX;
      const deltaY = e.clientY - dragStartRef.current.startMouseY;
      const newX = Math.max(10, Math.round(dragStartRef.current.origX + deltaX));
      const newY = Math.max(30, Math.round(dragStartRef.current.origY + deltaY));
      setDragLivePos({ x: newX, y: newY });
      return;
    }

    // Live dragging of selected stroke / drawn shape with 120fps requestAnimationFrame
    if (isDraggingStroke && dragStrokeStartRef.current && selectedStrokeId) {
      const deltaX = e.clientX - dragStrokeStartRef.current.startMouseX;
      const deltaY = e.clientY - dragStrokeStartRef.current.startMouseY;
      const origPts = dragStrokeStartRef.current.origPoints;
      const origVerts = dragStrokeStartRef.current.origVertices;

      if (strokeRafRef.current) cancelAnimationFrame(strokeRafRef.current);
      strokeRafRef.current = requestAnimationFrame(() => {
        setPages((prev) => {
          const updated = [...prev];
          const curr = updated[currentPageIndex];
          if (!curr) return prev;
          const newStrokes = curr.strokes.map((s) => {
            if (s.id === selectedStrokeId) {
              const movedPoints = origPts.map((p) => ({
                ...p,
                x: p.x + deltaX,
                y: p.y + deltaY,
              }));
              const movedVertices = origVerts
                ? origVerts.map((v) => ({
                    ...v,
                    x: v.x + deltaX,
                    y: v.y + deltaY,
                  }))
                : s.customVertices;
              const newCenterX = dragStrokeStartRef.current!.centerX + deltaX;
              const newCenterY = dragStrokeStartRef.current!.centerY + deltaY;
              return {
                ...s,
                points: movedPoints,
                customVertices: movedVertices,
                centerX: newCenterX,
                centerY: newCenterY,
              };
            }
            return s;
          });
          updated[currentPageIndex] = { ...curr, strokes: newStrokes };
          return updated;
        });
      });
      return;
    }

    if (!isDrawingRef.current) return;

    const currentPt = { x, y, pressure: e.pressure || 0.5 };
    const pts = activePointsRef.current;
    pts.push(currentPt);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser') {
      // Incremental smooth bezier rendering for 120fps fluid drawing without clearing canvas
      if (pts.length >= 3) {
        const p0 = pts[pts.length - 3];
        const p1 = pts[pts.length - 2];
        const p2 = pts[pts.length - 1];
        const mid1X = (p0.x + p1.x) / 2;
        const mid1Y = (p0.y + p1.y) / 2;
        const mid2X = (p1.x + p2.x) / 2;
        const mid2Y = (p1.y + p2.y) / 2;

        const isLiveFluo = activeColor === '#ccff00' || activeColor === '#ff007f' || activeColor === '#00ffff';

        ctx.save();
        ctx.translate(-boardScrollX, -boardScrollY);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = activeTool === 'highlighter' ? strokeSize * 2.5 : strokeSize;
        if (activeTool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = '#000';
        } else {
          ctx.strokeStyle = activeColor;
          if (activeTool === 'highlighter') {
            ctx.globalAlpha = isLiveFluo ? 0.65 : 0.45;
            if (isLiveFluo) {
              ctx.shadowColor = activeColor;
              ctx.shadowBlur = 12;
            }
          } else if (isLiveFluo) {
            ctx.shadowColor = activeColor;
            ctx.shadowBlur = 8;
          }
        }
        ctx.beginPath();
        ctx.moveTo(mid1X, mid1Y);
        ctx.quadraticCurveTo(p1.x, p1.y, mid2X, mid2Y);
        ctx.stroke();
        ctx.restore();
      } else if (pts.length === 2) {
        const p0 = pts[0];
        const p1 = pts[1];
        const isLiveFluo = activeColor === '#ccff00' || activeColor === '#ff007f' || activeColor === '#00ffff';
        ctx.save();
        ctx.translate(-boardScrollX, -boardScrollY);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = activeTool === 'highlighter' ? strokeSize * 2.5 : strokeSize;
        if (activeTool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = '#000';
        } else {
          ctx.strokeStyle = activeColor;
          if (activeTool === 'highlighter') {
            ctx.globalAlpha = isLiveFluo ? 0.65 : 0.45;
            if (isLiveFluo) {
              ctx.shadowColor = activeColor;
              ctx.shadowBlur = 12;
            }
          } else if (isLiveFluo) {
            ctx.shadowColor = activeColor;
            ctx.shadowBlur = 8;
          }
        }
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      // For geometric 2D/3D shapes, preview shape with full redraw
      redrawCanvas(ctx);
      ctx.save();
      ctx.translate(-boardScrollX, -boardScrollY);
      renderSingleStroke(ctx, activeTool, pts, activeColor, strokeSize);
      ctx.restore();
    }
  };

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

  const handlePointerUp = () => {
    // 1. Finalize Word Text Box marquee drag
    if (newTextBoxDrag) {
      const minX = Math.min(newTextBoxDrag.startX, newTextBoxDrag.curX);
      const minY = Math.min(newTextBoxDrag.startY, newTextBoxDrag.curY);
      const dragW = Math.abs(newTextBoxDrag.curX - newTextBoxDrag.startX);
      const dragH = Math.abs(newTextBoxDrag.curY - newTextBoxDrag.startY);

      const finalWidth = dragW > 40 ? Math.round(dragW) : 260;
      const finalHeight = dragH > 30 ? Math.round(dragH) : 90;

      const newTextBox: BlackboardTextBox = {
        id: `txt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        x: minX,
        y: minY,
        width: finalWidth,
        height: finalHeight,
        text: '',
        color: activeColor,
        size: 28,
        fontFamily: 'sans',
        bold: false,
        italic: false,
        underline: false,
        align: 'left',
        bgColor: 'transparent',
        borderStyle: 'dashed',
      };

      setPages((prev) => {
        const updated = [...prev];
        const curr = updated[currentPageIndex];
        if (!curr) return prev;
        updated[currentPageIndex] = {
          ...curr,
          texts: [...(curr.texts || []), newTextBox],
        };
        return updated;
      });

      setSelectedTextId(newTextBox.id);
      setSelectedStrokeId(null);
      setNewTextBoxDrag(null);
      return;
    }

    // 2. Finalize Shape Resizing
    if (isResizingStroke) {
      setIsResizingStroke(false);
      resizeStrokeStartRef.current = null;
      return;
    }

    if (draggedVertexIdx !== null) {
      setDraggedVertexIdx(null);
      return;
    }

    if (isDraggingText) {
      if (dragLivePos && selectedTextId) {
        setPages((prev) => {
          const updated = [...prev];
          const curr = updated[currentPageIndex];
          if (!curr) return prev;
          const newTexts = curr.texts.map((t) =>
            t.id === selectedTextId ? { ...t, x: dragLivePos.x, y: dragLivePos.y } : t
          );
          updated[currentPageIndex] = { ...curr, texts: newTexts };
          return updated;
        });
      }
      setIsDraggingText(false);
      setDragLivePos(null);
      dragStartRef.current = null;
      return;
    }

    if (isDraggingStroke) {
      setIsDraggingStroke(false);
      dragStrokeStartRef.current = null;
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setIsDrawing(false);

    const completedPoints = [...activePointsRef.current];
    activePointsRef.current = [];
    setCurrentPoints([]);

    if (completedPoints.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      completedPoints.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });

      const initialVertices = computeDefaultVertices(activeTool, completedPoints);
      const tempStroke: WhiteboardStroke = {
        id: 'temp',
        points: completedPoints,
        color: activeColor,
        size: strokeSize,
        tool: activeTool,
        timestamp: Date.now(),
        rotation: 0,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
        scale: 1,
        customVertices: initialVertices && initialVertices.length > 0 ? initialVertices : undefined,
      };
      const bounds = getStrokeBounds(tempStroke);

      const newStroke: WhiteboardStroke = {
        ...tempStroke,
        id: `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        centerX: bounds ? bounds.centerX : (minX + maxX) / 2,
        centerY: bounds ? bounds.centerY : (minY + maxY) / 2,
      };

      setPages((prev) => {
        const updated = [...prev];
        const curr = updated[currentPageIndex];
        updated[currentPageIndex] = {
          ...curr,
          strokes: [...curr.strokes, newStroke],
          redoStack: [],
        };
        return updated;
      });
    }
  };

  // Undo & Redo handlers
  const handleUndo = useCallback(() => {
    if (strokes.length === 0) return;
    setPages((prev) => {
      const updated = [...prev];
      const curr = updated[currentPageIndex];
      if (!curr || curr.strokes.length === 0) return prev;
      const last = curr.strokes[curr.strokes.length - 1];
      updated[currentPageIndex] = {
        ...curr,
        strokes: curr.strokes.slice(0, -1),
        redoStack: [...curr.redoStack, last],
      };
      return updated;
    });
  }, [strokes.length, currentPageIndex]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    setPages((prev) => {
      const updated = [...prev];
      const curr = updated[currentPageIndex];
      if (!curr || curr.redoStack.length === 0) return prev;
      const last = curr.redoStack[curr.redoStack.length - 1];
      updated[currentPageIndex] = {
        ...curr,
        strokes: [...curr.strokes, last],
        redoStack: curr.redoStack.slice(0, -1),
      };
      return updated;
    });
  }, [redoStack.length, currentPageIndex]);

  // Global Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Delete/Backspace)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedTextId) {
          setPages((prev) => {
            const updated = [...prev];
            const curr = updated[currentPageIndex];
            if (!curr) return prev;
            const newTexts = curr.texts.filter((t) => t.id !== selectedTextId);
            updated[currentPageIndex] = { ...curr, texts: newTexts };
            return updated;
          });
          setSelectedTextId(null);
        } else if (selectedStrokeId) {
          setPages((prev) => {
            const updated = [...prev];
            const curr = updated[currentPageIndex];
            if (!curr) return prev;
            const newStrokes = curr.strokes.filter((s) => s.id !== selectedStrokeId);
            updated[currentPageIndex] = { ...curr, strokes: newStrokes };
            return updated;
          });
          setSelectedStrokeId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, selectedTextId, selectedStrokeId, currentPageIndex]);

  const handleClearBoard = () => {
    if (strokes.length === 0 && texts.length === 0) return;
    setShowClearBoardModal(true);
  };

  const confirmClearBoard = () => {
    setPages((prev) => {
      const updated = [...prev];
      const curr = updated[currentPageIndex];
      updated[currentPageIndex] = {
        ...curr,
        strokes: [],
        redoStack: [],
        texts: [],
      };
      return updated;
    });
    setShowClearBoardModal(false);
  };

  // Export board screenshot
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `Bang_Giang_${classroom?.name || 'Lop'}_${currentPage.name}.png`;
    a.click();
  };

  // Multi-page management
  const handleAddNewPage = () => {
    const newIdx = pages.length + 1;
    const newPage: BlackboardPage = {
      id: `page_${Date.now()}`,
      name: `Bảng ${newIdx}`,
      strokes: [],
      redoStack: [],
      texts: [],
    };
    setPages((prev) => [...prev, newPage]);
    setCurrentPageIndex(pages.length);
  };

  // Handle Uploading Document from Blackboard
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    try {
      setIsProcessingUpload(true);
      const newDoc = await parseUploadedFileToLesson(file);
      onAddLesson?.(newDoc);
      onSelectLesson?.(newDoc.id);
      setIsCornerDocOpen(true);
      setCornerDocTab('original');
      setCornerDocSlideIdx(0);
      setShowDocumentModal(false);
    } catch (err: any) {
      alert('Không thể đọc tệp: ' + (err.message || 'Lỗi không xác định'));
    } finally {
      setIsProcessingUpload(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Open existing document from library
  const handleOpenExistingDoc = (docId: string, mode: 'corner' | 'split' | 'full' | 'presentation') => {
    onSelectLesson?.(docId);
    setShowDocumentModal(false);
    if (mode === 'corner') {
      setIsCornerDocOpen(true);
      setCornerDocTab('original');
      setCornerDocSlideIdx(0);
    } else if (mode === 'split') {
      setIsSplitScreen(true);
    } else if (mode === 'full') {
      onSwitchToReader?.();
    } else if (mode === 'presentation') {
      onSwitchToPresentation?.();
    }
  };

  // On-demand AI Extraction inside Corner Doc
  const handleCornerAIExtract = async (target: 'formulas' | 'summary' | 'exercises') => {
    if (!currentLesson) return;
    try {
      setIsCornerAIExtracting(true);
      const res = await fetch('/api/ai/extract-specific', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          title: currentLesson.title,
          content: displaySafeText,
        }),
      });

      const data = await res.json();
      setCornerExtractedData(data);
      setCornerDocTab('ai_extract');
    } catch (e: any) {
      alert('Không thể trích xuất AI: ' + (e.message || 'Thử lại sau'));
    } finally {
      setIsCornerAIExtracting(false);
    }
  };

  const getBackgroundClass = () => {
    switch (bgTheme) {
      case 'blackboard':
        return 'blackboard-bg border-8 border-[#3d2714] shadow-2xl';
      case 'oli':
        return 'oli-grid-bg border-8 border-[#3d2714] shadow-2xl';
      case 'lined':
        return 'lined-blackboard-bg border-8 border-[#3d2714] shadow-2xl';
      case 'graph':
        return 'graph-paper-bg border-8 border-slate-800 shadow-2xl';
      case 'slate':
        return 'slate-board-bg border-8 border-slate-900 shadow-2xl';
      case 'navy':
        return 'navy-board-bg border-8 border-slate-900 shadow-2xl';
      case 'wood':
        return 'wood-board-bg border-8 border-[#29180d] shadow-2xl';
      case 'white':
        return 'whiteboard-clean-bg border-8 border-slate-300 shadow-2xl text-slate-900';
      default:
        return 'blackboard-bg border-8 border-[#3d2714] shadow-2xl';
    }
  };

  // Custom visual cursors inside the green blackboard (Bàn tay viết, Mũi tên chọn, Chiếc khăn lau)
  const getCanvasCursorStyle = (): React.CSSProperties => {
    switch (activeTool) {
      case 'select':
        // 1. Mũi tên chỉ chọn sắc nét trên nền bảng xanh
        return {
          cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Cpath d='M3 2 L3 21 L8 16 L12 24 L15 22 L11 15 L17 15 Z' fill='%23ffffff' stroke='%230f172a' stroke-width='1.6' stroke-linejoin='round'/%3E%3C/svg%3E") 2 2, default`,
        };
      case 'pen':
        // 2. Biểu tượng bàn tay cầm phấn đang viết trên bảng
        return {
          cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'%3E%3Cpolygon points='2,2 8,1 15,13 9,14' fill='%23ffffff' stroke='%230f172a' stroke-width='1.5' stroke-linejoin='round'/%3E%3Ccircle cx='2' cy='2' r='2' fill='%2338bdf8'/%3E%3Cpath d='M10,11 C9,7 13,6 16,9 C18,7 22,8 22,11 C24,10 27,11 26,14 C27,16 26,19 23,21 L18,24 C14,25 11,23 9,19 Z' fill='%23fef08a' stroke='%23ca8a04' stroke-width='1.6' stroke-linejoin='round'/%3E%3Cpath d='M14,12 L18,18' stroke='%23ca8a04' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E") 2 2, crosshair`,
        };
      case 'eraser':
        // 3. Biểu tượng giống chiếc khăn lau bảng
        return {
          cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'%3E%3Crect x='3' y='5' width='28' height='22' rx='5' fill='%23ffffff' stroke='%230f172a' stroke-width='1.6'/%3E%3Cpath d='M6 11 Q17 14 28 11' stroke='%2338bdf8' stroke-width='2.2' stroke-linecap='round' fill='none'/%3E%3Cpath d='M6 16 Q17 19 28 16' stroke='%230284c7' stroke-width='2.2' stroke-linecap='round' fill='none'/%3E%3Cpath d='M6 21 Q17 24 28 21' stroke='%2338bdf8' stroke-width='2.2' stroke-linecap='round' fill='none'/%3E%3Cpath d='M22 5 L31 14 L22 14 Z' fill='%23cbd5e1' stroke='%230f172a' stroke-width='1.4'/%3E%3C/svg%3E") 16 16, pointer`,
        };
      case 'text':
        return { cursor: 'text' };
      case 'highlighter':
        return { cursor: 'cell' };
      case 'laser':
        return { cursor: 'none' };
      default:
        return { cursor: 'crosshair' };
    }
  };

  const getCanvasCursorClass = () => {
    switch (activeTool) {
      case 'select':
        return 'cursor-default';
      case 'pen':
        return 'cursor-crosshair';
      case 'text':
        return 'cursor-text';
      case 'highlighter':
        return 'cursor-cell';
      case 'eraser':
        return 'cursor-pointer';
      case 'laser':
        return 'cursor-none';
      default:
        return 'cursor-crosshair';
    }
  };

  const getCornerSizeClass = () => {
    switch (cornerDocSize) {
      case 'sm':
        return 'w-72 md:w-80 max-h-[360px]';
      case 'lg':
        return 'w-[90vw] md:w-[680px] max-h-[580px]';
      case 'md':
      default:
        return 'w-80 md:w-[480px] max-h-[460px]';
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden transition-all duration-300 select-none flex ${
        isFullBoard
          ? 'fixed inset-0 z-50 h-screen w-screen rounded-none'
          : 'h-[calc(100vh-80px)] min-h-[580px] rounded-3xl'
      } ${getBackgroundClass()}`}
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.doc,.pdf,.pptx,.ppt,.xlsx,.xls,.csv,.txt,.md,.json"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Blackboard Top Bar */}
      {!isTopBarCollapsed && !isImmersiveMode && (
        <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none gap-2 animate-fade-in">
          {/* Left: Blackboard Title & Multi-Page Selector */}
          <div className="flex items-center gap-2 pointer-events-auto bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/20 text-white shadow-lg">
            <span className="font-black text-xs md:text-sm text-emerald-400 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>BẢNG XANH {classroom ? classroom.name : ''}</span>
            </span>

            <div className="h-4 w-px bg-white/20 mx-1" />

            {/* Page navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPageIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentPageIndex === 0}
                className="p-1 rounded-lg hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Trang bảng trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-black font-mono px-2 py-0.5 rounded-md bg-white/10">
                {currentPage.name} ({currentPageIndex + 1}/{pages.length})
              </span>

              <button
                onClick={() => setCurrentPageIndex((prev) => Math.min(pages.length - 1, prev + 1))}
                disabled={currentPageIndex === pages.length - 1}
                className="p-1 rounded-lg hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Trang bảng sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={handleAddNewPage}
                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 transition-all ml-1 shadow-xs"
                title="Thêm trang bảng mới (Bảng 2, Bảng 3...)"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Thêm Bảng</span>
              </button>
            </div>
          </div>

          {/* Right: Data / Document Hub + Split Screen + Background Grid + Fullscreen */}
          <div className="flex items-center gap-2 pointer-events-auto flex-wrap">
            {/* NÚT 1: KHO TÀI LIỆU CÓ SẴN */}
            <button
              onClick={() => setShowDocumentModal(true)}
              className="px-3 py-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 shadow-lg border border-indigo-400/40 active:scale-95 transition-all"
              title="Dùng kho tài liệu, bài giảng có sẵn trong hệ thống"
            >
              <FolderOpen className="w-4 h-4 text-indigo-200" />
              <span>Kho Tài Liệu</span>
              {currentLesson && (
                <span className="max-w-[100px] truncate text-[10px] bg-white/20 px-1.5 py-0.5 rounded-md text-white font-normal hidden lg:inline">
                  {currentLesson.title}
                </span>
              )}
            </button>

            {/* NÚT 2: TẢI TÀI LIỆU MỚI */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-lg border border-emerald-400/40 active:scale-95 transition-all"
              title="Tải tệp bài giảng mới từ máy tính (Word, PDF, PowerPoint, Excel...)"
            >
              <UploadCloud className="w-4 h-4 text-emerald-200" />
              <span>Tải Tệp Mới</span>
            </button>

            {/* SPLIT SCREEN 50/50 TOGGLE */}
            {currentLesson && (
              <button
                onClick={() => setIsSplitScreen(!isSplitScreen)}
                className={`px-3 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 border transition-all shadow-md ${
                  isSplitScreen
                    ? 'bg-purple-600 text-white border-purple-300 ring-2 ring-purple-400/50'
                    : 'bg-slate-900/80 text-purple-300 border-white/20 hover:bg-slate-900'
                }`}
                title={isSplitScreen ? 'Tắt chia đôi bảng' : 'Bật chia đôi màn hình: Vừa viết bảng vừa đọc tài liệu'}
              >
                <Split className="w-3.5 h-3.5" />
                <span>{isSplitScreen ? 'Tắt Chia Đôi' : 'Chia Đôi Bảng'}</span>
              </button>
            )}

            {/* Quick Corner Doc Toggle */}
            {currentLesson && !isSplitScreen && (
              <button
                onClick={() => setIsCornerDocOpen(!isCornerDocOpen)}
                className={`px-2.5 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-1 border transition-all shadow-md ${
                  isCornerDocOpen
                    ? 'bg-amber-500 text-white border-amber-300'
                    : 'bg-slate-900/80 text-amber-300 border-white/20 hover:bg-slate-900'
                }`}
                title={isCornerDocOpen ? 'Tắt khung tài liệu góc' : 'Hiển thị tài liệu ở góc bảng xanh'}
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Góc Bảng</span>
              </button>
            )}

            {/* Background switcher */}
            <div className="bg-slate-950/80 backdrop-blur-md p-1 rounded-2xl border border-white/20 text-white flex items-center gap-1 shadow-lg hidden md:flex">
              <button
                onClick={() => setBgTheme('blackboard')}
                className={`px-2 py-1 rounded-xl text-[11px] font-bold transition-all ${
                  bgTheme === 'blackboard' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
                title="Bảng Xanh Sư Phạm"
              >
                Xanh
              </button>
              <button
                onClick={() => setBgTheme('white')}
                className={`px-2 py-1 rounded-xl text-[11px] font-bold transition-all ${
                  bgTheme === 'white' ? 'bg-slate-200 text-slate-900 shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
                title="Bảng Trắng Hiện Đại"
              >
                Trắng
              </button>
              <button
                onClick={() => setBgTheme('slate')}
                className={`px-2 py-1 rounded-xl text-[11px] font-bold transition-all ${
                  bgTheme === 'slate' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
                title="Bảng Đen Đá Cổ Điển"
              >
                Đen
              </button>
              <button
                onClick={() => setBgTheme('navy')}
                className={`px-2 py-1 rounded-xl text-[11px] font-bold transition-all ${
                  bgTheme === 'navy' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
                title="Bảng Xanh Dương Navy"
              >
                Navy
              </button>
              <button
                onClick={() => setBgTheme('wood')}
                className={`px-2 py-1 rounded-xl text-[11px] font-bold transition-all ${
                  bgTheme === 'wood' ? 'bg-amber-900 text-amber-100 shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
                title="Bảng Gỗ Mun Sang Trọng"
              >
                Gỗ
              </button>
              <button
                onClick={() => setBgTheme('oli')}
                className={`px-2 py-1 rounded-xl text-[11px] font-bold transition-all ${
                  bgTheme === 'oli' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
                title="Bảng Ô Ly Học Sinh"
              >
                Ô Ly
              </button>
              <button
                onClick={() => setBgTheme('lined')}
                className={`px-2 py-1 rounded-xl text-[11px] font-bold transition-all ${
                  bgTheme === 'lined' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
                title="Bảng Kẻ Ngang Luyện Chữ"
              >
                Kẻ Ngang
              </button>
              <button
                onClick={() => setBgTheme('graph')}
                className={`px-2 py-1 rounded-xl text-[11px] font-bold transition-all ${
                  bgTheme === 'graph' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
                title="Bảng Tọa Độ / Math Grid"
              >
                Tọa Độ
              </button>
            </div>

            {/* 1-Click Clean Board / Immersive Mode */}
            <button
              onClick={() => {
                setIsImmersiveMode(true);
                setIsTopBarCollapsed(true);
                setIsDockCollapsed(true);
              }}
              className="px-2.5 py-1.5 rounded-2xl bg-cyan-600/80 hover:bg-cyan-600 text-white border border-cyan-400/40 text-xs font-black flex items-center gap-1 shadow-lg transition-all"
              title="Chế độ Tối đa diện tích: Ẩn thanh trên và thanh dưới để viết toàn màn hình"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Toàn Bảng Sạch</span>
            </button>

            {/* Minimize / Collapse Top Bar */}
            <button
              onClick={() => setIsTopBarCollapsed(true)}
              className="p-2 rounded-2xl bg-slate-950/80 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 shadow-lg transition-colors"
              title="Ẩn thanh điều khiển trên để mở rộng bảng"
            >
              <ChevronUp className="w-4 h-4" />
            </button>

            {/* Fullscreen Board Toggle */}
            <button
              onClick={() => setIsFullBoard(!isFullBoard)}
              className="p-2 rounded-2xl bg-slate-950/80 hover:bg-slate-900 text-white border border-white/20 shadow-lg active:scale-95 transition-all"
              title={isFullBoard ? 'Thu nhỏ bảng' : 'Bảng toàn màn hình 75 inch'}
            >
              {isFullBoard ? <Minimize2 className="w-4 h-4 text-amber-400" /> : <Maximize2 className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>
        </div>
      )}

      {/* Floating Restore Pill when Top Bar is collapsed - Right Aligned to maximize blackboard space */}
      {(isTopBarCollapsed || isImmersiveMode) && (
        <div className="absolute top-3 right-4 z-30 pointer-events-auto animate-fade-in flex items-center gap-2">
          <button
            onClick={() => {
              setIsTopBarCollapsed(false);
              setIsImmersiveMode(false);
            }}
            className="px-3.5 py-1.5 rounded-full bg-slate-950/90 hover:bg-slate-900 text-emerald-300 border-2 border-emerald-500/50 text-xs font-black shadow-2xl backdrop-blur-xl flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Nhấp để hiển thị lại thanh điều khiển trên"
          >
            <ChevronDown className="w-4 h-4 text-emerald-400" />
            <span>Hiện Thanh Công Cụ</span>
          </button>

          <button
            onClick={() => setShowDocumentModal(true)}
            className="px-3 py-1.5 rounded-full bg-indigo-600/90 hover:bg-indigo-600 text-white border border-indigo-400 text-xs font-bold shadow-xl flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Mở Kho Tài Liệu"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Kho Tài Liệu</span>
          </button>
        </div>
      )}

      {/* LEFT CANVAS AREA (DRAWING BOARD) */}
      <div
        className="relative h-full transition-all duration-300 overflow-hidden flex-1 select-none"
        onWheel={(e) => {
          if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
            setBoardScrollX((prev) => {
              const next = Math.max(0, prev + dx * 0.85);
              if (next > boardExtraWidth) {
                setBoardExtraWidth((w) => w + 800);
              }
              return next;
            });
          } else {
            setBoardScrollY((prev) => {
              const next = Math.max(0, prev + e.deltaY * 0.85);
              if (next > boardExtraHeight) {
                setBoardExtraHeight((h) => h + 800);
              }
              return next;
            });
          }
        }}
        style={{
          width: isSplitScreen
            ? splitRatio === '50/50'
              ? '50%'
              : splitRatio === '60/40'
              ? '60%'
              : '40%'
            : '100%',
        }}
      >
        {/* Main Touch Drawing Canvas */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={getCanvasCursorStyle()}
          className={`absolute inset-0 w-full h-full touch-canvas z-10 ${getCanvasCursorClass()}`}
        />

        {/* Floating Reset to Origin when scrolled (Unobtrusive & Minimal) */}
        {(boardScrollX > 20 || boardScrollY > 20) && (
          <button
            onClick={() => {
              setBoardScrollX(0);
              setBoardScrollY(0);
            }}
            className="absolute right-4 top-4 z-30 px-3 py-1.5 rounded-full bg-slate-950/80 hover:bg-emerald-600 border border-emerald-400/50 text-emerald-300 hover:text-white text-[11px] font-black shadow-xl backdrop-blur-md transition-all active:scale-95 flex items-center gap-1.5"
            title="Nhấp để cuộn về góc gốc ban đầu của bảng"
          >
            <span>Về Gốc Bảng</span>
            <span className="font-mono text-[9px] opacity-75">
              ({Math.round(boardScrollX)}, {Math.round(boardScrollY)})
            </span>
          </button>
        )}

        {/* Laser Pointer Animated Glow */}
        {laserPos && (
          <div
            className="absolute pointer-events-none z-30 -translate-x-1/2 -translate-y-1/2"
            style={{ left: laserPos.x, top: laserPos.y }}
          >
            <div className="w-10 h-10 rounded-full bg-red-500/80 laser-dot flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-white shadow-sm" />
            </div>
          </div>
        )}

        {/* PICTURE-IN-PICTURE FLOATING CORNER DOCUMENT VIEWER ON BLACKBOARD */}
        {isCornerDocOpen && currentLesson && !isSplitScreen && (
          <div
            className={`absolute z-20 transition-all shadow-2xl rounded-2xl bg-slate-900/95 text-white border-2 border-indigo-500/80 backdrop-blur-xl flex flex-col overflow-hidden ${
              cornerDocPosition === 'top-right'
                ? 'top-16 right-4'
                : cornerDocPosition === 'top-left'
                ? 'top-16 left-4'
                : 'bottom-20 right-4'
            } ${isCornerDocMinimized ? 'w-64 h-12' : getCornerSizeClass()}`}
          >
            {/* Header of Corner Box */}
            <div className="px-3 py-2 bg-indigo-950/90 border-b border-indigo-500/40 flex items-center justify-between">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <BookOpen className="w-4 h-4 text-indigo-300 shrink-0" />
                <span className="text-xs font-bold text-indigo-100 truncate">
                  {currentLesson.title}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* Switch to Split Screen Button */}
                <button
                  onClick={() => {
                    setIsSplitScreen(true);
                    setIsCornerDocOpen(false);
                  }}
                  title="Chia đôi màn hình 50/50"
                  className="px-2 py-0.5 rounded bg-purple-600/80 hover:bg-purple-600 text-white text-[10px] font-bold flex items-center gap-1"
                >
                  <Split className="w-3 h-3" />
                  <span className="hidden sm:inline">Chia Đôi</span>
                </button>

                {/* Resize Corner */}
                <button
                  onClick={() =>
                    setCornerDocSize((prev) => (prev === 'sm' ? 'md' : prev === 'md' ? 'lg' : 'sm'))
                  }
                  title="Đổi kích thước góc"
                  className="p-1 rounded-lg hover:bg-white/20 text-slate-300 hover:text-white"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>

                {/* Position switcher */}
                <button
                  onClick={() =>
                    setCornerDocPosition((prev) =>
                      prev === 'top-right' ? 'top-left' : prev === 'top-left' ? 'bottom-right' : 'top-right'
                    )
                  }
                  title="Đổi vị trí góc hiển thị"
                  className="p-1 rounded-lg hover:bg-white/20 text-slate-300 hover:text-white"
                >
                  <Move className="w-3 h-3" />
                </button>

                {/* Minimize/Expand */}
                <button
                  onClick={() => setIsCornerDocMinimized(!isCornerDocMinimized)}
                  title={isCornerDocMinimized ? 'Mở rộng' : 'Thu nhỏ'}
                  className="p-1 rounded-lg hover:bg-white/20 text-slate-300 hover:text-white"
                >
                  {isCornerDocMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                </button>

                {/* Close */}
                <button
                  onClick={() => setIsCornerDocOpen(false)}
                  title="Đóng góc tài liệu"
                  className="p-1 rounded-lg hover:bg-rose-500/30 text-slate-300 hover:text-rose-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Corner View Tabs */}
            {!isCornerDocMinimized && (
              <div className="flex items-center gap-1 bg-slate-950/80 px-3 py-1.5 border-b border-white/10 text-[11px] font-bold">
                <button
                  onClick={() => setCornerDocTab('original')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    cornerDocTab === 'original' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📄 Tệp Gốc
                </button>
                {currentLesson.slides && currentLesson.slides.length > 0 && (
                  <button
                    onClick={() => setCornerDocTab('slides')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      cornerDocTab === 'slides' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📑 Slide ({currentLesson.slides.length})
                  </button>
                )}
                <button
                  onClick={() => setCornerDocTab('content')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    cornerDocTab === 'content' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📝 Tóm Tắt
                </button>
                <button
                  onClick={() => setCornerDocTab('ai_extract')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    cornerDocTab === 'ai_extract' ? 'bg-purple-600 text-white' : 'text-purple-300 hover:text-white'
                  }`}
                >
                  ✨ Trích Xuất AI
                </button>
              </div>
            )}

            {/* Content of Corner Box */}
            {!isCornerDocMinimized && (
              <div className="p-3 overflow-y-auto flex-1 space-y-2.5 text-xs text-slate-200">
                {/* 1. ORIGINAL VIEWER IN CORNER */}
                {cornerDocTab === 'original' && (
                  <div className="space-y-2 h-full flex flex-col">
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <div className="flex items-center gap-1">
                        <span>Thu phóng:</span>
                        <button
                          onClick={() => setCornerDocZoom((prev) => Math.max(50, prev - 20))}
                          className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20"
                        >
                          -
                        </button>
                        <span className="font-mono text-amber-300">{cornerDocZoom}%</span>
                        <button
                          onClick={() => setCornerDocZoom((prev) => Math.min(200, prev + 20))}
                          className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20"
                        >
                          +
                        </button>
                      </div>
                      {currentLesson.fileUrl && (
                        <a
                          href={currentLesson.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-300 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Mở tab mới</span>
                        </a>
                      )}
                    </div>

                    <div className="flex-1 min-h-[220px] bg-slate-950 rounded-xl overflow-hidden border border-white/10 flex flex-col">
                      <UniversalDocumentViewer
                        lesson={currentLesson}
                        compact
                        initialZoom={cornerDocZoom}
                        onLaunchSlides={onSwitchToPresentation}
                      />
                    </div>
                  </div>
                )}

                {/* 2. SLIDES IN CORNER */}
                {cornerDocTab === 'slides' && currentLesson.slides && currentLesson.slides.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <span className="text-[11px] font-black text-indigo-300 uppercase">
                        Slide {cornerDocSlideIdx + 1}/{currentLesson.slides.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCornerDocSlideIdx((prev) => Math.max(0, prev - 1))}
                          disabled={cornerDocSlideIdx === 0}
                          className="p-1 rounded bg-white/10 disabled:opacity-30 hover:bg-white/20"
                        >
                          <ChevronLeft className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() =>
                            setCornerDocSlideIdx((prev) =>
                              Math.min(currentLesson.slides.length - 1, prev + 1)
                            )
                          }
                          disabled={cornerDocSlideIdx === currentLesson.slides.length - 1}
                          className="p-1 rounded bg-white/10 disabled:opacity-30 hover:bg-white/20"
                        >
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-black text-amber-300 text-xs mb-1">
                        {currentLesson.slides[cornerDocSlideIdx].title}
                      </h4>
                      <p className="text-[11px] text-slate-300 whitespace-pre-line leading-relaxed">
                        {currentLesson.slides[cornerDocSlideIdx].content}
                      </p>
                    </div>

                    {currentLesson.slides[cornerDocSlideIdx].formula && (
                      <div className="p-2 rounded-xl bg-indigo-950/90 border border-indigo-400/40 text-center font-mono text-emerald-300">
                        <MathFormulaRenderer
                          content={currentLesson.slides[cornerDocSlideIdx].formula!}
                          isBlock
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 3. CLEAN TEXT CONTENT IN CORNER */}
                {cornerDocTab === 'content' && (
                  <div className="whitespace-pre-line text-slate-300 max-h-56 overflow-y-auto leading-relaxed font-sans">
                    {displaySafeText}
                  </div>
                )}

                {/* 4. ON-DEMAND AI EXTRACTION IN CORNER */}
                {cornerDocTab === 'ai_extract' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => handleCornerAIExtract('formulas')}
                        disabled={isCornerAIExtracting}
                        className="p-2 rounded-xl bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 text-[10px] font-bold flex flex-col items-center gap-1 border border-indigo-500/30"
                      >
                        <Sigma className="w-3.5 h-3.5 text-indigo-300" />
                        <span>Công Thức</span>
                      </button>
                      <button
                        onClick={() => handleCornerAIExtract('summary')}
                        disabled={isCornerAIExtracting}
                        className="p-2 rounded-xl bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 text-[10px] font-bold flex flex-col items-center gap-1 border border-emerald-500/30"
                      >
                        <BookmarkCheck className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Tóm Tắt</span>
                      </button>
                      <button
                        onClick={() => handleCornerAIExtract('exercises')}
                        disabled={isCornerAIExtracting}
                        className="p-2 rounded-xl bg-amber-900/60 hover:bg-amber-800 text-amber-200 text-[10px] font-bold flex flex-col items-center gap-1 border border-amber-500/30"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-amber-300" />
                        <span>Bài Tập</span>
                      </button>
                    </div>

                    {isCornerAIExtracting && (
                      <div className="p-4 text-center text-slate-400 space-y-1">
                        <Sparkles className="w-5 h-5 mx-auto text-amber-400 animate-spin" />
                        <p className="text-[11px]">AI đang trích xuất theo yêu cầu...</p>
                      </div>
                    )}

                    {cornerExtractedData && !isCornerAIExtracting && (
                      <div className="p-2.5 rounded-xl bg-indigo-950/90 border border-indigo-500/30 space-y-2 max-h-52 overflow-y-auto">
                        <span className="text-[10px] font-black uppercase text-amber-300">
                          {cornerExtractedData.category || 'Kết Quả Trích Xuất'}:
                        </span>
                        {cornerExtractedData.summary && (
                          <p className="text-xs text-slate-200 leading-relaxed font-semibold">
                            {cornerExtractedData.summary}
                          </p>
                        )}
                        {cornerExtractedData.items &&
                          cornerExtractedData.items.map((it: any, idx: number) => (
                            <div key={idx} className="p-2 rounded-lg bg-white/5 border border-white/10 space-y-1">
                              <h5 className="font-bold text-amber-200 text-[11px]">{it.name}</h5>
                              {it.formula && (
                                <div className="text-emerald-300 font-mono text-center">
                                  <MathFormulaRenderer content={it.formula} />
                                </div>
                              )}
                              {it.problem && <p className="text-[11px] text-slate-300">{it.problem}</p>}
                              {it.solution && (
                                <p className="text-[10px] text-emerald-300">Giải: {it.solution}</p>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Navigation */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                  <button
                    onClick={onSwitchToPresentation}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold flex items-center gap-1"
                  >
                    <Presentation className="w-3 h-3" />
                    <span>Trình Chiếu</span>
                  </button>
                  <button
                    onClick={onSwitchToReader}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" />
                    <span>Mở Full Reader</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Word Text Box Marquee Drag Box Preview */}
        {newTextBoxDrag && (
          <div
            className="absolute pointer-events-none border-2 border-dashed border-cyan-400 bg-cyan-400/15 rounded-xl z-50 flex items-center justify-center shadow-2xl backdrop-blur-[1px]"
            style={{
              left: `${Math.min(newTextBoxDrag.startX, newTextBoxDrag.curX) - boardScrollX}px`,
              top: `${Math.min(newTextBoxDrag.startY, newTextBoxDrag.curY) - boardScrollY}px`,
              width: `${Math.max(160, Math.abs(newTextBoxDrag.curX - newTextBoxDrag.startX))}px`,
              height: `${Math.max(50, Math.abs(newTextBoxDrag.curY - newTextBoxDrag.startY))}px`,
            }}
          >
            <span className="text-xs font-bold text-cyan-300 bg-slate-950/85 px-2.5 py-1 rounded-lg font-mono border border-cyan-500/40 shadow">
              Hộp văn bản Word ({Math.round(Math.abs(newTextBoxDrag.curX - newTextBoxDrag.startX))} × {Math.round(Math.abs(newTextBoxDrag.curY - newTextBoxDrag.startY))})
            </span>
          </div>
        )}

        {/* All Blackboard Word Text Boxes (Crisp HTML + KaTeX rendering + Word Formatting Toolbar + 8-Point Resizing) */}
        {currentPage?.texts?.map((tb) => (
          <BlackboardWordTextBox
            key={tb.id}
            textBox={tb}
            isSelected={selectedTextId === tb.id}
            boardScrollX={boardScrollX}
            boardScrollY={boardScrollY}
            chalkPalette={chalkPalette}
            onSelect={() => {
              setSelectedTextId(tb.id);
              setSelectedStrokeId(null);
            }}
            onChange={(updated) => {
              setPages((prev) => {
                const up = [...prev];
                const curr = up[currentPageIndex];
                if (!curr) return prev;
                up[currentPageIndex] = {
                  ...curr,
                  texts: curr.texts.map((t) => (t.id === updated.id ? updated : t)),
                };
                return up;
              });
            }}
            onDelete={() => {
              setPages((prev) => {
                const up = [...prev];
                const curr = up[currentPageIndex];
                if (!curr) return prev;
                up[currentPageIndex] = {
                  ...curr,
                  texts: curr.texts.filter((t) => t.id !== tb.id),
                };
                return up;
              });
              if (selectedTextId === tb.id) setSelectedTextId(null);
            }}
          />
        ))}

        {/* INTERACTIVE BOUNDING BOX & 360-DEGREE ROTATION CONTROLLER FOR SELECTED STROKE / DRAWN SHAPE */}
        {selectedStrokeId && (() => {
          const selectedStroke = strokes.find((s) => s.id === selectedStrokeId);
          if (!selectedStroke) return null;
          const bounds = getStrokeBounds(selectedStroke);
          if (!bounds) return null;

          const currentRotation = selectedStroke.rotation || 0;
          const currentScale = selectedStroke.scale || 1;

          // Compute vertices for geometric shapes
          const activeVertices =
            selectedStroke.customVertices && selectedStroke.customVertices.length > 0
              ? selectedStroke.customVertices
              : computeDefaultVertices(selectedStroke.tool, selectedStroke.points);

          return (
            <div
              className="absolute pointer-events-none z-40 animate-fade-in"
              style={{
                left: `${bounds.minX - boardScrollX}px`,
                top: `${bounds.minY - boardScrollY}px`,
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
                  setIsDraggingText(false);
                  dragStrokeStartRef.current = {
                    startMouseX: e.clientX,
                    startMouseY: e.clientY,
                    origPoints: selectedStroke.points ? selectedStroke.points.map((p) => ({ ...p })) : [],
                    origVertices: selectedStroke.customVertices ? selectedStroke.customVertices.map((v) => ({ ...v })) : undefined,
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
                  const origVerts = dragStrokeStartRef.current.origVertices;
                  const origCenterX = dragStrokeStartRef.current.centerX;
                  const origCenterY = dragStrokeStartRef.current.centerY;

                  if (strokeRafRef.current) cancelAnimationFrame(strokeRafRef.current);
                  strokeRafRef.current = requestAnimationFrame(() => {
                    setPages((prev) => {
                      const updated = [...prev];
                      const curr = updated[currentPageIndex];
                      if (!curr) return prev;
                      const newStrokes = curr.strokes.map((s) => {
                        if (s.id === selectedStrokeId) {
                          const movedPoints = origPts.map((p) => ({
                            ...p,
                            x: p.x + deltaX,
                            y: p.y + deltaY,
                          }));
                          const movedVertices = origVerts
                            ? origVerts.map((v) => ({
                                ...v,
                                x: v.x + deltaX,
                                y: v.y + deltaY,
                              }))
                            : s.customVertices;
                          return {
                            ...s,
                            points: movedPoints,
                            customVertices: movedVertices,
                            centerX: origCenterX + deltaX,
                            centerY: origCenterY + deltaY,
                          };
                        }
                        return s;
                      });
                      updated[currentPageIndex] = { ...curr, strokes: newStrokes };
                      return updated;
                    });
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
                title="Chạm và kéo để di chuyển hình mượt mà (hoặc dùng 4 nút điều hướng / phím mũi tên)"
              >
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/85 px-2.5 py-1 rounded-full text-cyan-300 text-[11px] font-bold shadow-lg flex items-center gap-1.5 pointer-events-none">
                  <Move className="w-3.5 h-3.5" />
                  Kéo di chuyển hình
                </div>
              </div>

              {/* Draggable Vertex Handles for Geometric Shapes (preserves parallel sides) */}
              {activeVertices && activeVertices.length > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  {activeVertices.map((vertex, vIdx) => {
                    // Position relative to bounds container
                    const relX = vertex.x - bounds.minX;
                    const relY = vertex.y - bounds.minY;
                    const isBeingDragged = draggedVertexIdx === vIdx;
                    const vertexLabel = vertex.name || (vertex as any).label || `Đỉnh ${vIdx + 1}`;

                    return (
                      <div
                        key={vertex.id || `v_${vIdx}`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          try {
                            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                          } catch (_) {}
                          setDraggedVertexIdx(vIdx);
                        }}
                        onPointerMove={(e) => {
                          if (draggedVertexIdx === vIdx && selectedStrokeId) {
                            e.stopPropagation();
                            const canvas = canvasRef.current;
                            if (!canvas) return;
                            const rect = canvas.getBoundingClientRect();
                            const vx = e.clientX - rect.left + boardScrollX;
                            const vy = e.clientY - rect.top + boardScrollY;
                            handleVertexDrag(vIdx, vx, vy);
                          }
                        }}
                        onPointerUp={(e) => {
                          e.stopPropagation();
                          try {
                            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                          } catch (_) {}
                          setDraggedVertexIdx(null);
                        }}
                        onPointerCancel={(e) => {
                          e.stopPropagation();
                          try {
                            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                          } catch (_) {}
                          setDraggedVertexIdx(null);
                        }}
                        style={{
                          left: `${relX}px`,
                          top: `${relY}px`,
                          touchAction: 'none',
                        }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing flex items-center justify-center group z-50 select-none pointer-events-auto ${
                          isBeingDragged ? 'scale-125' : 'hover:scale-115'
                        } transition-transform`}
                        title={`Kéo để di chuyển đỉnh ${vertexLabel} (bảo toàn tính song song)`}
                      >
                        {/* Outer Glow Ring */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shadow-xl border-2 ${
                            isBeingDragged
                              ? 'bg-amber-400 border-white ring-4 ring-amber-300/80 animate-pulse'
                              : 'bg-indigo-600/90 hover:bg-emerald-500 border-white ring-2 ring-indigo-400/50'
                          }`}
                        >
                          {/* Vertex Center Dot */}
                          <div className="w-2 h-2 bg-white rounded-full shadow-xs" />
                        </div>

                        {/* Vertex Name Badge (A, B, C, D, S, O...) */}
                        <div className="absolute -top-6 bg-slate-950/95 text-amber-300 text-[10.5px] font-black font-mono px-2 py-0.5 rounded-md border border-amber-400/80 shadow-lg whitespace-nowrap pointer-events-none">
                          {vertexLabel}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bounding box outline with rotation visual styling & active draggable corner handles */}
              <div
                className="w-full h-full border-2 border-dashed border-cyan-400/90 rounded-2xl relative shadow-lg ring-2 ring-cyan-400/30 pointer-events-none"
                style={{
                  transform: `rotate(${currentRotation}deg) scale(${currentScale})`,
                  transformOrigin: 'center center',
                }}
              >
                {/* 4 Active Draggable Corner Handles for Direct Interactive Shape Scaling */}
                <div
                  onPointerDown={(e) => handleShapeResizePointerDown(e, 'nw')}
                  className="absolute -top-2.5 -left-2.5 w-5 h-5 bg-white border-2 border-cyan-500 rounded-full shadow-lg cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center z-30"
                  title="Kéo co giãn phóng to / thu nhỏ hình vẽ"
                >
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                </div>
                <div
                  onPointerDown={(e) => handleShapeResizePointerDown(e, 'ne')}
                  className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-white border-2 border-cyan-500 rounded-full shadow-lg cursor-nesw-resize pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center z-30"
                  title="Kéo co giãn phóng to / thu nhỏ hình vẽ"
                >
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                </div>
                <div
                  onPointerDown={(e) => handleShapeResizePointerDown(e, 'sw')}
                  className="absolute -bottom-2.5 -left-2.5 w-5 h-5 bg-white border-2 border-cyan-500 rounded-full shadow-lg cursor-nesw-resize pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center z-30"
                  title="Kéo co giãn phóng to / thu nhỏ hình vẽ"
                >
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                </div>
                <div
                  onPointerDown={(e) => handleShapeResizePointerDown(e, 'se')}
                  className="absolute -bottom-2.5 -right-2.5 w-5 h-5 bg-white border-2 border-cyan-500 rounded-full shadow-lg cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center z-30"
                  title="Kéo co giãn phóng to / thu nhỏ hình vẽ"
                >
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                </div>

                {/* Center crosshair */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 border border-cyan-300 rounded-full flex items-center justify-center pointer-events-none">
                  <div className="w-1 h-1 bg-cyan-300 rounded-full" />
                </div>
              </div>

              {/* Floating Toolbar: Collapsed by Default (Thu gọn) & Expandable (Mở rộng khi bấm vào) */}
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
                      setPages((prev) => {
                        const updated = [...prev];
                        const curr = updated[currentPageIndex];
                        if (!curr) return prev;
                        const newStrokes = curr.strokes.filter((s) => s.id !== selectedStroke.id);
                        updated[currentPageIndex] = { ...curr, strokes: newStrokes };
                        return updated;
                      });
                      setSelectedStrokeId(null);
                    }}
                    className="p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors flex items-center justify-center text-xs"
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
                    className="p-1 rounded-lg hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
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
                {/* 4-Way Smooth Directional Movement (Press or Hold to Move Continuously) */}
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
                    title="Dời sang TRÁI (Nhấn hoặc Giữ để di chuyển mượt, hoặc phím mũi tên Trái)"
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
                    title="Dời lên TRÊN (Nhấn hoặc Giữ để di chuyển mượt, hoặc phím mũi tên Lên)"
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
                    title="Dời xuống DƯỚI (Nhấn hoặc Giữ để di chuyển mượt, hoặc phím mũi tên Xuống)"
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
                    title="Dời sang PHẢI (Nhấn hoặc Giữ để di chuyển mượt, hoặc phím mũi tên Phải)"
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
                      setPages((prev) => {
                        const updated = [...prev];
                        const curr = updated[currentPageIndex];
                        if (!curr) return prev;
                        const newStrokes = curr.strokes.map((s) =>
                          s.id === selectedStroke.id ? { ...s, rotation: newAngle } : s
                        );
                        updated[currentPageIndex] = { ...curr, strokes: newStrokes };
                        return updated;
                      });
                    }}
                    className="w-20 md:w-28 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    title="Kéo trượt để xoay hình 0 - 360 độ"
                  />

                  {/* Quick Rotate Buttons */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newAngle = (currentRotation - 15 + 360) % 360;
                      setPages((prev) => {
                        const updated = [...prev];
                        const curr = updated[currentPageIndex];
                        if (!curr) return prev;
                        const newStrokes = curr.strokes.map((s) =>
                          s.id === selectedStroke.id ? { ...s, rotation: newAngle } : s
                        );
                        updated[currentPageIndex] = { ...curr, strokes: newStrokes };
                        return updated;
                      });
                    }}
                    className="p-1 hover:bg-white/20 rounded-lg text-slate-200 text-[11px] font-bold"
                    title="Xoay ngược chiều kim đồng hồ 15°"
                  >
                    -15°
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newAngle = (currentRotation + 15) % 360;
                      setPages((prev) => {
                        const updated = [...prev];
                        const curr = updated[currentPageIndex];
                        if (!curr) return prev;
                        const newStrokes = curr.strokes.map((s) =>
                          s.id === selectedStroke.id ? { ...s, rotation: newAngle } : s
                        );
                        updated[currentPageIndex] = { ...curr, strokes: newStrokes };
                        return updated;
                      });
                    }}
                    className="p-1 hover:bg-white/20 rounded-lg text-slate-200 text-[11px] font-bold"
                    title="Xoay thuận chiều kim đồng hồ 15°"
                  >
                    +15°
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newAngle = (currentRotation + 90) % 360;
                      setPages((prev) => {
                        const updated = [...prev];
                        const curr = updated[currentPageIndex];
                        if (!curr) return prev;
                        const newStrokes = curr.strokes.map((s) =>
                          s.id === selectedStroke.id ? { ...s, rotation: newAngle } : s
                        );
                        updated[currentPageIndex] = { ...curr, strokes: newStrokes };
                        return updated;
                      });
                    }}
                    className="px-1.5 py-0.5 bg-amber-500/30 hover:bg-amber-500/50 rounded-lg text-amber-200 text-[10px] font-black"
                    title="Xoay vuông góc 90°"
                  >
                    +90°
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newAngle = (currentRotation + 180) % 360;
                      setPages((prev) => {
                        const updated = [...prev];
                        const curr = updated[currentPageIndex];
                        if (!curr) return prev;
                        const newStrokes = curr.strokes.map((s) =>
                          s.id === selectedStroke.id ? { ...s, rotation: newAngle } : s
                        );
                        updated[currentPageIndex] = { ...curr, strokes: newStrokes };
                        return updated;
                      });
                    }}
                    className="px-1.5 py-0.5 bg-amber-500/30 hover:bg-amber-500/50 rounded-lg text-amber-200 text-[10px] font-black"
                    title="Lật ngược 180°"
                  >
                    180°
                  </button>
                </div>

                <div className="h-5 w-px bg-white/20 mx-1" />

                {/* Change Color Palette */}
                <div className="flex items-center gap-1 max-w-[260px] sm:max-w-[340px] overflow-x-auto py-0.5 custom-scrollbar-none">
                  {chalkPalette.map((cp) => (
                    <button
                      key={cp.value}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPages((prev) => {
                          const updated = [...prev];
                          const curr = updated[currentPageIndex];
                          const newStrokes = curr.strokes.map((s) =>
                            s.id === selectedStroke.id ? { ...s, color: cp.value } : s
                          );
                          updated[currentPageIndex] = { ...curr, strokes: newStrokes };
                          return updated;
                        });
                      }}
                      className={`w-4 h-4 rounded-full border transition-transform shrink-0 ${
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
                      setPages((prev) => {
                        const updated = [...prev];
                        const curr = updated[currentPageIndex];
                        if (!curr) return prev;
                        const newStrokes = curr.strokes.map((s) =>
                          s.id === selectedStroke.id ? { ...s, scale: newScale } : s
                        );
                        updated[currentPageIndex] = { ...curr, strokes: newStrokes };
                        return updated;
                      });
                    }}
                    className="p-1 hover:bg-white/20 rounded-lg text-slate-300 hover:text-white"
                    title="Thu nhỏ hình"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono text-cyan-300">{Math.round(currentScale * 100)}%</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newScale = Math.min(3.0, currentScale + 0.15);
                      setPages((prev) => {
                        const updated = [...prev];
                        const curr = updated[currentPageIndex];
                        if (!curr) return prev;
                        const newStrokes = curr.strokes.map((s) =>
                          s.id === selectedStroke.id ? { ...s, scale: newScale } : s
                        );
                        updated[currentPageIndex] = { ...curr, strokes: newStrokes };
                        return updated;
                      });
                    }}
                    className="p-1 hover:bg-white/20 rounded-lg text-slate-300 hover:text-white"
                    title="Phóng to hình"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="h-5 w-px bg-white/20 mx-1" />

                {/* Delete Stroke */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPages((prev) => {
                      const updated = [...prev];
                      const curr = updated[currentPageIndex];
                      if (!curr) return prev;
                      const newStrokes = curr.strokes.filter((s) => s.id !== selectedStroke.id);
                      updated[currentPageIndex] = { ...curr, strokes: newStrokes };
                      return updated;
                    });
                    setSelectedStrokeId(null);
                  }}
                  className="p-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors flex items-center gap-1 text-xs px-2"
                  title="Xóa hình/nét vẽ này khỏi bảng (Phím Delete)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa</span>
                </button>

                {/* Close floating toolbar */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStrokeId(null);
                  }}
                  className="p-1 rounded-lg hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
                  title="Bỏ chọn (Giữ nguyên hình vẽ trên bảng)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          );
        })()}
      </div>

      {/* RIGHT SIDE: LIVE SPLIT-SCREEN DOCUMENT VIEWER (WHEN SPLIT-SCREEN IS ACTIVE) */}
      {isSplitScreen && currentLesson && (
        <div
          className="h-full bg-slate-950 border-l-4 border-purple-500/80 shadow-2xl z-20 flex flex-col transition-all duration-300"
          style={{
            width:
              splitRatio === '50/50'
                ? '50%'
                : splitRatio === '60/40'
                ? '40%'
                : '60%',
          }}
        >
          {/* Split Screen Header */}
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white text-xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <BookOpen className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="font-bold text-slate-100 truncate">{currentLesson.title}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Ratio toggle */}
              <button
                onClick={() =>
                  setSplitRatio((prev) => (prev === '50/50' ? '60/40' : prev === '60/40' ? '40/60' : '50/50'))
                }
                className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-purple-200 text-[10px] font-bold"
                title="Đổi tỷ lệ chia đôi màn hình"
              >
                {splitRatio}
              </button>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
                <button
                  onClick={() => setSplitDocZoom((prev) => Math.max(50, prev - 20))}
                  className="p-1 hover:bg-white/20 rounded text-slate-300"
                  title="Thu nhỏ tài liệu"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] font-bold text-amber-300 px-1">
                  {splitDocZoom}%
                </span>
                <button
                  onClick={() => setSplitDocZoom((prev) => Math.min(250, prev + 20))}
                  className="p-1 hover:bg-white/20 rounded text-slate-300"
                  title="Phóng to tài liệu"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Close Split Screen */}
              <button
                onClick={() => setIsSplitScreen(false)}
                className="p-1 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white"
                title="Đóng chế độ chia đôi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Split Screen Native Document Viewer */}
          <div className="flex-1 w-full h-full overflow-hidden bg-slate-950 flex flex-col p-1">
            <UniversalDocumentViewer
              lesson={currentLesson}
              initialZoom={splitDocZoom}
              onLaunchSlides={onSwitchToPresentation}
            />
          </div>
        </div>
      )}

      {/* AUTHENTIC BOTTOM CHALK & TOOL DOCK (75 INCH TOUCH OPTIMIZED) */}
      {!isDockCollapsed && (
        <div className="absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-40 pointer-events-auto max-w-[98vw] animate-fade-in flex justify-center">
          <div className="bg-slate-950/95 backdrop-blur-2xl px-3.5 py-2 rounded-2xl md:rounded-3xl border-2 border-white/25 shadow-2xl flex items-center gap-1 sm:gap-2 text-white shrink-0">
          {/* Main Drawing Tools */}
          <div className="flex items-center gap-1 shrink-0">
            {/* 1. Chọn (Select) - Always visible label */}
            <button
              onClick={() => handleToolChange('select')}
              className={`p-2 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all shrink-0 ${
                activeTool === 'select'
                  ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400'
                  : 'hover:bg-white/10 text-slate-300'
              }`}
              title="Chọn và di chuyển đối tượng / chữ trên bảng"
            >
              <MousePointer2 className="w-4 h-4" />
              <span className="text-[11px] font-bold">Chọn</span>
            </button>

            {/* 2. Phấn (Chalk) - Biểu tượng bàn tay viết */}
            <button
              onClick={() => handleToolChange('pen')}
              className={`p-2 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all shrink-0 ${
                activeTool === 'pen'
                  ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400'
                  : 'hover:bg-white/10 text-slate-300'
              }`}
              title="Bút phấn viết tự do (Biểu tượng bàn tay viết)"
            >
              <div className="relative w-4 h-4 flex items-center justify-center">
                <Hand className="w-3.5 h-3.5 rotate-[-15deg] text-emerald-200" />
                <PenLine className="w-2.5 h-2.5 absolute -top-0.5 -right-0.5 text-amber-300" />
              </div>
              <span className="text-[11px] font-bold">Phấn</span>
            </button>

            {/* 3. Bút Dạ Quang */}
            <button
              onClick={() => handleToolChange('highlighter')}
              className={`p-2 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all shrink-0 ${
                activeTool === 'highlighter'
                  ? 'bg-amber-500 text-white shadow-md ring-2 ring-amber-300'
                  : 'hover:bg-white/10 text-slate-300'
              }`}
              title="Bút dạ quang đánh dấu"
            >
              <Highlighter className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px] font-bold">Dạ Quang</span>
            </button>

            {/* 4. Khăn Lau Bảng (Towel icon & 50p fast erase) */}
            <button
              onClick={() => handleToolChange('eraser')}
              className={`p-2 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all shrink-0 ${
                activeTool === 'eraser'
                  ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400'
                  : 'hover:bg-white/10 text-slate-300'
              }`}
              title="Khăn lau bảng (Tự động chuyển nét 50p để lau sạch cực nhanh)"
            >
              {/* Biểu tượng chiếc khăn lau bảng */}
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
                <path d="M5 10v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9" />
                <path d="M9 14h6" />
                <path d="M9 17h4" />
              </svg>
              <span className="text-[11px] font-bold">Khăn Lau</span>
            </button>

            <button
              onClick={() => handleToolChange('laser')}
              className={`p-2 rounded-xl flex items-center gap-1 text-xs font-bold transition-all shrink-0 ${
                activeTool === 'laser'
                  ? 'bg-red-600 text-white shadow-md ring-2 ring-red-400'
                  : 'hover:bg-white/10 text-slate-300'
              }`}
              title="Bút laser chỉ điểm"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden xl:inline text-[11px]">Laser</span>
            </button>

            <button
              onClick={() => handleToolChange('text')}
              className={`p-2 rounded-xl flex items-center gap-1 text-xs font-bold transition-all shrink-0 ${
                activeTool === 'text'
                  ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400'
                  : 'hover:bg-white/10 text-slate-300'
              }`}
              title="Chèn chữ / Công thức lên bảng"
            >
              <Type className="w-4 h-4" />
              <span className="hidden xl:inline text-[11px]">Chữ</span>
            </button>
          </div>

          <div className="h-5 w-px bg-white/20 mx-0.5 shrink-0" />

          {/* Geometric Shapes & Math Curves */}
          <div className="relative flex items-center gap-1 shrink-0">
            {/* Shape Menu Toggle for 2D & 3D Geometry */}
            <button
              onClick={() => {
                setShowShapePicker((prev) => !prev);
                setShowFunctionPicker(false);
                setShowColorPopover(false);
                setShowSizePopover(false);
              }}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                [
                  'line',
                  'dashed_line',
                  'arrow',
                  'dashed_arrow',
                  'rectangle',
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
              onClick={() => {
                setShowFunctionPicker((prev) => !prev);
                setShowShapePicker(false);
                setShowColorPopover(false);
                setShowSizePopover(false);
              }}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
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
                    className="p-1 rounded-lg hover:bg-white/10 text-slate-400"
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
                      className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all ${
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
                      className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all ${
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
                      className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all ${
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
                      className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all ${
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
                      className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all ${
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
                      className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all ${
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
                      className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all ${
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
                      className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all ${
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
                      className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all ${
                        activeTool === 'cuboid' ? 'bg-purple-600 text-white ring-2 ring-purple-300' : 'bg-white/5 hover:bg-white/15 text-slate-200'
                      }`}
                      title="Hình hộp chữ nhật"
                    >
                      <Box className="w-4 h-4 text-purple-300 scale-x-125" />
                      <span className="text-[9.5px] font-bold">Hộp CN</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('pyramid_tri');
                        setShowShapePicker(false);
                      }}
                      className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all ${
                        activeTool === 'pyramid_tri' ? 'bg-purple-600 text-white ring-2 ring-purple-300' : 'bg-white/5 hover:bg-white/15 text-slate-200'
                      }`}
                      title="Hình chóp đáy tam giác S.ABC"
                    >
                      <Triangle className="w-4 h-4 text-purple-300" />
                      <span className="text-[9.5px] font-bold">Chóp T.Giác</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('pyramid_quad');
                        setShowShapePicker(false);
                      }}
                      className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all ${
                        activeTool === 'pyramid_quad' ? 'bg-purple-600 text-white ring-2 ring-purple-300' : 'bg-white/5 hover:bg-white/15 text-slate-200'
                      }`}
                      title="Hình chóp đáy hình bình hành S.ABCD"
                    >
                      <Layers className="w-4 h-4 text-purple-300 rotate-45" />
                      <span className="text-[9.5px] font-bold">Chóp B.Hành</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('cone');
                        setShowShapePicker(false);
                      }}
                      className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all ${
                        activeTool === 'cone' ? 'bg-purple-600 text-white ring-2 ring-purple-300' : 'bg-white/5 hover:bg-white/15 text-slate-200'
                      }`}
                      title="Hình nón"
                    >
                      <Triangle className="w-4 h-4 text-purple-300 rotate-180" />
                      <span className="text-[9.5px] font-bold">Hình Nón</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('revolution_cylinder');
                        setShowShapePicker(false);
                      }}
                      className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all ${
                        activeTool === 'revolution_cylinder' ? 'bg-purple-600 text-white ring-2 ring-purple-300' : 'bg-white/5 hover:bg-white/15 text-slate-200'
                      }`}
                      title="Hình trụ tròn xoay (Trục OO' & Bán kính R)"
                    >
                      <Layers className="w-4 h-4 text-purple-300" />
                      <span className="text-[9.5px] font-bold">Trụ Tròn Xoay</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('sphere');
                        setShowShapePicker(false);
                      }}
                      className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all ${
                        activeTool === 'sphere' ? 'bg-purple-600 text-white ring-2 ring-purple-300' : 'bg-white/5 hover:bg-white/15 text-slate-200'
                      }`}
                      title="Hình cầu không gian"
                    >
                      <Globe className="w-4 h-4 text-purple-300" />
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
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    Thư Viện Đồ Thị Hàm Số Toán Học (SGK)
                  </span>
                  <button
                    onClick={() => setShowFunctionPicker(false)}
                    className="p-1 rounded-lg hover:bg-white/10 text-slate-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 1. Linear & Quadratic */}
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-300 mb-1.5 block tracking-wide">
                    1. Hàm Bậc Nhất & Bậc Hai (Parabol)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setActiveTool('func_linear');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2.5 rounded-2xl text-xs flex flex-col items-center gap-1 border transition-all ${
                        activeTool === 'func_linear'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-xs text-amber-300">y = ax + b</span>
                      <span className="text-[10px] text-slate-300 font-medium">Đường Thẳng</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('func_quadratic_up');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2.5 rounded-2xl text-xs flex flex-col items-center gap-1 border transition-all ${
                        activeTool === 'func_quadratic_up'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-xs text-emerald-300">y = ax² (a&gt;0)</span>
                      <span className="text-[10px] text-slate-300 font-medium">Parabol Lõm Lên</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('func_quadratic_down');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2.5 rounded-2xl text-xs flex flex-col items-center gap-1 border transition-all ${
                        activeTool === 'func_quadratic_down'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-xs text-rose-300">y = ax² (a&lt;0)</span>
                      <span className="text-[10px] text-slate-300 font-medium">Parabol Lõm Xuống</span>
                    </button>
                  </div>
                </div>

                {/* 2. Cubic Functions */}
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-300 mb-1.5 block tracking-wide">
                    2. Hàm Số Bậc Ba y = ax³ + bx² + cx + d (Đầy Đủ Các Dạng)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setActiveTool('func_cubic_2extrema_pos');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_cubic_2extrema_pos'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-[11px] text-indigo-300">a &gt; 0 (2 Cực trị)</span>
                      <span className="text-[9.5px] text-slate-300">Dạng chữ N chuẩn</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('func_cubic_2extrema_neg');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_cubic_2extrema_neg'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-[11px] text-indigo-300">a &lt; 0 (2 Cực trị)</span>
                      <span className="text-[9.5px] text-slate-300">Dạng chữ N ngược</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('func_cubic_noextrema_pos');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_cubic_noextrema_pos'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-[11px] text-indigo-300">a &gt; 0 (Đơn điệu)</span>
                      <span className="text-[9.5px] text-slate-300">Không có cực trị</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('func_cubic_noextrema_neg');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_cubic_noextrema_neg'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-[11px] text-indigo-300">a &lt; 0 (Đơn điệu)</span>
                      <span className="text-[9.5px] text-slate-300">Nghịch biến R</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('func_cubic_inflection_pos');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_cubic_inflection_pos'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-[11px] text-indigo-300">a &gt; 0 (Tiếp tuyến //)</span>
                      <span className="text-[9.5px] text-slate-300">Uốn tiếp tuyến ngang</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('func_cubic_inflection_neg');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_cubic_inflection_neg'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-[11px] text-indigo-300">a &lt; 0 (Tiếp tuyến //)</span>
                      <span className="text-[9.5px] text-slate-300">Uốn tiếp tuyến ngang</span>
                    </button>
                  </div>
                </div>

                {/* 3. Rational Functions */}
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-300 mb-1.5 block tracking-wide">
                    3. Hàm Phân Thức Hữu Tỉ (Nhất Biến & Bậc 2 / Bậc 1)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setActiveTool('func_rational_pos');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_rational_pos'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-[11px] text-cyan-300">(ax+b)/(cx+d)</span>
                      <span className="text-[9.5px] text-slate-300">Đồng biến (ad-bc &gt; 0)</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('func_rational_neg');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_rational_neg'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-[11px] text-cyan-300">(ax+b)/(cx+d)</span>
                      <span className="text-[9.5px] text-slate-300">Nghịch biến (ad-bc &lt; 0)</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('func_frac21');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_frac21'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-[11px] text-cyan-300">Bậc 2 / Bậc 1</span>
                      <span className="text-[9.5px] text-slate-300">Tiệm Cận Xiên</span>
                    </button>
                  </div>
                </div>

                {/* 4. Exponential & Logarithmic Functions */}
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-300 mb-1.5 block tracking-wide">
                    4. Hàm Số Mũ & Hàm Số Logarit
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      onClick={() => {
                        setActiveTool('func_exp_pos');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_exp_pos'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-[11px] text-emerald-300">y = a^x (a &gt; 1)</span>
                      <span className="text-[9.5px] text-slate-300">Mũ Đồng Biến</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('func_exp_neg');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_exp_neg'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-[11px] text-rose-300">y = a^x (a &lt; 1)</span>
                      <span className="text-[9.5px] text-slate-300">Mũ Nghịch Biến</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('func_log_pos');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_log_pos'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-[11px] text-emerald-300">log_a(x) (a &gt; 1)</span>
                      <span className="text-[9.5px] text-slate-300">Logarit Đồng Biến</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('func_log_neg');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_log_neg'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-[11px] text-rose-300">log_a(x) (a &lt; 1)</span>
                      <span className="text-[9.5px] text-slate-300">Logarit Nghịch Biến</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-white/20 mx-0.5 shrink-0" />

          {/* Chalk Color Picker (Compact with Popover Menu & Custom Color Picker) */}
          <div className="relative shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowColorPopover((prev) => !prev)}
                className="p-1.5 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center gap-1.5 text-xs font-bold text-white transition-all shadow-sm shrink-0 cursor-pointer"
                title="Bảng màu phấn & dạ quang (Nhấp để chọn màu khác)"
              >
                <div
                  className="w-5 h-5 rounded-full border-2 border-white shadow-md ring-2 shrink-0 transition-all"
                  style={{
                    backgroundColor: activeColor,
                    boxShadow: (activeColor === '#ccff00' || activeColor === '#ff007f' || activeColor === '#00ffff') ? `0 0 10px ${activeColor}` : undefined,
                    borderColor: (activeColor === '#ccff00' || activeColor === '#ff007f' || activeColor === '#00ffff') ? '#ffffff' : 'rgba(255,255,255,0.8)',
                  }}
                />
                <span className="hidden xl:inline text-[11px] font-semibold text-slate-200">
                  {chalkPalette.find((c) => c.value === activeColor)?.label || 'Màu phấn'}
                </span>
                <ChevronUp className={`w-3.5 h-3.5 text-slate-300 transition-transform ${showColorPopover ? 'rotate-180' : ''}`} />
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
                        id="blackboard-custom-color-input"
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

                {/* 3 MÀU DẠ QUANG SIÊU SÁNG PHÁT SÁNG CỰC ĐẸP TRÊN BẢNG */}
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
                    {chalkPalette.filter((cp) => cp.isFluorescent).map((cp) => (
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
                          {cp.label.replace('Dạ Quang ', '')}
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
                    {chalkPalette.filter((cp) => !cp.isFluorescent).map((cp) => (
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
                          {cp.label.replace('Phấn ', '')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-white/20 mx-1" />

          {/* Stroke Size Selector - Mặc định các nét viết là 2p, riêng Khăn lau là 50p */}
          <div className="flex items-center gap-1">
            {chalkSizes.slice(0, 4).map((cs) => (
              <button
                key={cs.size}
                onClick={() => setStrokeSize(cs.size)}
                className={`w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                  strokeSize === cs.size
                    ? 'bg-white text-slate-900 shadow-md font-black ring-2 ring-white/50'
                    : 'hover:bg-white/10 text-slate-300'
                }`}
                title={cs.label}
              >
                {cs.size}p
              </button>
            ))}
            {activeTool === 'eraser' && (
              <button
                onClick={() => setStrokeSize(50)}
                className={`px-2 h-7 rounded-xl flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                  strokeSize === 50
                    ? 'bg-rose-500 text-white shadow-md font-black ring-2 ring-rose-300'
                    : 'hover:bg-white/10 text-rose-200'
                }`}
                title="Khăn lau bảng siêu tốc 50p"
              >
                50p
              </button>
            )}
          </div>

          <div className="h-6 w-px bg-white/20 mx-1" />

          {/* Undo / Redo / Clear / Random Picker / Export */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className={`p-2.5 rounded-xl flex items-center gap-1 font-bold text-xs transition-all ${
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
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className={`p-2.5 rounded-xl flex items-center gap-1 font-bold text-xs transition-all ${
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
              onClick={handleClearBoard}
              disabled={strokes.length === 0 && texts.length === 0}
              className={`p-2.5 rounded-xl flex items-center gap-1 font-bold text-xs transition-all ${
                strokes.length > 0 || texts.length > 0
                  ? 'bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white'
                  : 'text-slate-500 opacity-40 cursor-not-allowed'
              }`}
              title="Lau sạch toàn bộ bảng trang này"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-[10px] hidden lg:inline">Xóa Bảng</span>
            </button>
            {onOpenRandomPicker && (
              <button
                onClick={onOpenRandomPicker}
                className="p-2 rounded-xl bg-amber-500/80 hover:bg-amber-500 text-white ml-1"
                title="Vòng quay gọi học sinh ngẫu nhiên"
              >
                <Dices className="w-4 h-4" />
              </button>
            )}
            {/* Close / Collapse Toolbar Button */}
            <button
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
      )}

      {/* Floating Restore Toolbar Button when collapsed - Moved to Bottom Right */}
      {isDockCollapsed && (
        <div className="absolute bottom-6 md:bottom-8 right-6 z-40 pointer-events-auto animate-fade-in">
          <button
            onClick={() => setIsDockCollapsed(false)}
            className="px-4 py-2.5 rounded-2xl bg-slate-950/95 hover:bg-indigo-600 border-2 border-indigo-400/80 text-white font-black text-xs md:text-sm flex items-center gap-2 shadow-2xl backdrop-blur-xl transition-all hover:scale-105 active:scale-95 cursor-pointer ring-4 ring-indigo-500/20"
            title="Nhấp để hiển thị lại toàn bộ thanh công cụ viết bảng"
          >
            <div
              className="w-3.5 h-3.5 rounded-full border border-white shrink-0"
              style={{
                backgroundColor: activeColor,
                boxShadow: (activeColor === '#ccff00' || activeColor === '#ff007f' || activeColor === '#00ffff') ? `0 0 8px ${activeColor}` : undefined,
              }}
            />
            <Pen className="w-4 h-4 text-emerald-400" />
            <span>Mở Thanh Công Cụ Viết Bảng</span>
            <ChevronUp className="w-4 h-4 text-amber-300" />
          </button>
        </div>
      )}

      {/* MODAL: CONFIRM CLEAR BOARD */}
      {showClearBoardModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl text-white space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-2xl bg-rose-500/20">
                <Trash2 className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-black">XÁC NHẬN LAU SẠCH BẢNG</h3>
                <p className="text-xs text-slate-400">Trang bảng hiện tại: Trang {currentPageIndex + 1}/{pages.length}</p>
              </div>
            </div>
            <p className="text-sm text-slate-300">
              Thầy/Cô có chắc chắn muốn xóa toàn bộ nét phấn và nội dung trên trang bảng này không? Hành động này có thể hoàn tác bằng nút Undo.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowClearBoardModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmClearBoard}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-lg transition-all"
              >
                Xác Nhận Xóa Bảng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DOCUMENT & DATA HUB (TẢI LÊN & CHỌN BÀI HỌC) */}
      {showDocumentModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col space-y-4 max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
                  <FolderOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    KHO TÀI LIỆU & DỮ LIỆU BÀI GIẢNG
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tải lên hoặc mở tệp tài liệu để hiển thị trực tiếp trên SmartBoard 75"
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDocumentModal(false)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Upload Area (No forced translation - instant fidelity!) */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-6 rounded-2xl border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/50 hover:bg-indigo-50 cursor-pointer flex flex-col items-center justify-center text-center space-y-2 transition-all"
            >
              <UploadCloud className="w-10 h-10 text-indigo-600 animate-bounce" />
              <div>
                <p className="text-sm font-black text-slate-800">
                  {isProcessingUpload ? 'Đang nạp tài liệu...' : 'Nhấp để tải lên tệp bài giảng mới'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hỗ trợ: PDF (.pdf), Word (.docx, .doc), PowerPoint (.pptx), Excel (.xlsx), Hình ảnh sách giáo khoa
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                ✓ Hiển thị nguyên bản sắc nét • Trích xuất AI theo yêu cầu
              </span>
            </div>

            {/* Document Library List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <span className="text-xs font-black uppercase text-slate-600 tracking-wider">
                DANH SÁCH BÀI GIẢNG HIỆN CÓ ({lessons.length}):
              </span>
              {lessons.map((les) => {
                const isCurrent = les.id === currentLesson?.id;
                return (
                  <div
                    key={les.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-indigo-50/90 border-indigo-400 ring-2 ring-indigo-300/60'
                        : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="p-2 rounded-xl bg-slate-100 text-slate-700 shrink-0">
                        <FileText className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="text-sm font-black text-slate-900 truncate">{les.title}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span className="font-bold text-indigo-600">{les.subject}</span>
                          <span>•</span>
                          <span>{les.grade}</span>
                          <span>•</span>
                          <span>{les.fileType?.toUpperCase() || 'DOC'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleOpenExistingDoc(les.id, 'split')}
                        className="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1 shadow-2xs"
                        title="Chia đôi màn hình vừa viết bảng vừa xem"
                      >
                        <Split className="w-3.5 h-3.5" />
                        <span>Chia Đôi</span>
                      </button>

                      <button
                        onClick={() => handleOpenExistingDoc(les.id, 'corner')}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1 shadow-2xs"
                        title="Mở ở góc bảng"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Góc Bảng</span>
                      </button>

                      <button
                        onClick={() => handleOpenExistingDoc(les.id, 'full')}
                        className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 shadow-2xs"
                        title="Mở toàn màn hình xem chi tiết"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Đọc Full</span>
                      </button>

                      {onDeleteLesson && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDocToDelete(les);
                          }}
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-300 transition-all"
                          title="Xóa tài liệu này khỏi hệ thống"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM DELETE LESSON DOCUMENT (HIGH PRIORITY Z-INDEX Z-[70]) */}
      {docToDelete && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-900 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 rounded-2xl bg-rose-100">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">XÓA BÀI GIẢNG / TÀI LIỆU</h3>
                <p className="text-xs text-slate-500">Hành động này không thể khôi phục</p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-sm font-bold text-slate-900">{docToDelete.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">Môn: {docToDelete.subject} • Khối: {docToDelete.grade}</p>
            </div>
            <p className="text-xs text-slate-600">
              Thầy/Cô có chắc chắn muốn xóa bài giảng này khỏi kho tài liệu không?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDocToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  if (onDeleteLesson && docToDelete) {
                    onDeleteLesson(docToDelete.id);
                  }
                  setDocToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-lg transition-all"
              >
                Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
