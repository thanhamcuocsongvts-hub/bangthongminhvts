import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
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
  BookmarkPlus,
  Activity,
  Waves,
  Calculator,
  FunctionSquare,
  Pencil,
  Feather,
  Wand2,
  Loader2,
  Zap,
  Volume2,
  Check,
} from 'lucide-react';
import {
  VOICE_TONE_PRESETS,
  VoiceTonePreset,
  speakText,
  stopAllSpeech,
  speakWithGeminiAudio,
} from '../utils/aiSpeechService';
import { FloatingSelectionToolbar } from './FloatingSelectionToolbar';
import { cropCanvasRegion, recognizeHandwritingFast } from '../utils/textRecognitionService';
import { recognizeHandwritingOneClick } from '../utils/handwritingRecognition';
import {
  filterPointJitter,
  calculateDynamicStrokeWidth,
  simplifyPoints,
  cropStrokesToImage,
  recognizeVietnameseHandwriting,
} from '../utils/strokeSmoothing';
import { WhiteboardStroke, WhiteboardTool, StrokePoint, StrokeVertex, ClassRoom, LessonDoc, TeacherProfile, BlackboardBackground } from '../types';
import { parseUploadedFileToLesson, cleanDocumentText } from '../utils/fileParser';
import { computeDefaultVertices, updateVertexWithConstraints, drawShapeWithVertices } from '../utils/geometryVertices';
import { isFunctionGraphTool, drawFunctionGraph, getGraphBounds } from '../utils/mathGraphRenderer';
import { compileMathExpression } from '../utils/mathExpressionParser';
import katex from 'katex';
import { MathFormulaRenderer } from './MathFormulaRenderer';
import { UniversalDocumentViewer } from './UniversalDocumentViewer';
import { BlackboardWordTextBox, BlackboardTextBox } from './BlackboardWordTextBox';
import { useDeviceDetection } from '../hooks/useDeviceDetection';
import { VirtualMathKeyboard } from './VirtualMathKeyboard';

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
  onOpenTemporaryLesson?: (lesson: LessonDoc) => void;
  onSaveToLibrary?: (lesson: LessonDoc) => void;
  isSavedInLibrary?: boolean;
  onUpdateLesson?: (updatedDoc: LessonDoc) => void;
  onDeleteLesson?: (id: string) => void;
  onSwitchToPresentation?: () => void;
  onSwitchToReader?: () => void;
  onSwitchToFastWhiteboard?: () => void;
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
  onOpenTemporaryLesson,
  onSaveToLibrary,
  isSavedInLibrary = false,
  onUpdateLesson,
  onDeleteLesson,
  onSwitchToPresentation,
  onSwitchToReader,
  onSwitchToFastWhiteboard,
  onOpenRandomPicker,
  isInitialFullScreen = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRectRef = useRef<DOMRect | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
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

  // Chuyển đổi công cụ vẽ: Bắt buộc tất cả các công cụ khác tự động về 2p, riêng Khăn Lau là 50p
  const handleToolChange = (tool: WhiteboardTool) => {
    setActiveTool(tool);
    if (tool === 'eraser') {
      setStrokeSize(50);
    } else {
      setStrokeSize(2);
    }
  };

  // Tự động đồng bộ: Khi giáo viên bấm bất kỳ tính năng/công cụ nào khác thì tự động về 2p, chỉ có khăn lau là 50p
  useEffect(() => {
    if (activeTool === 'eraser') {
      setStrokeSize(50);
    } else {
      setStrokeSize(2);
    }
  }, [activeTool]);

  // Viết Chữ Đẹp (Smart Handwriting to Beautiful Calligraphy Font via Sweep Selection)
  const [calligraphyFont, setCalligraphyFont] = useState<'calligraphy' | 'handwriting' | 'primary' | 'cursive' | 'tapviet' | 'luyenchu' | 'tieuhoc_chuan' | 'tieuhoc_oly'>('tieuhoc_chuan');
  const [showCalligraphyPopover, setShowCalligraphyPopover] = useState<boolean>(false);
  const [isConvertingCalligraphy, setIsConvertingCalligraphy] = useState<boolean>(false);
  const [calligraphyStatusBanner, setCalligraphyStatusBanner] = useState<string | null>(null);
  const [lastConvertedInfo, setLastConvertedInfo] = useState<{
    textBoxId: string;
    replacedStrokes: WhiteboardStroke[];
  } | null>(null);

  // Marquee sweep state for Viết Chữ Đẹp (Quét văn bản)
  const [calligraphySweep, setCalligraphySweep] = useState<{
    startX: number;
    startY: number;
    curX: number;
    curY: number;
  } | null>(null);

  // Confirmed swept selection waiting for user to click "Bấm chọn: Chuyển Chữ Đẹp"
  const [sweptSelection, setSweptSelection] = useState<{
    box: { minX: number; minY: number; maxX: number; maxY: number };
    strokeIds: string[];
    textIds: string[];
  } | null>(null);

  // Text-To-Speech (TTS) Voice reading state
  const [isSpeakingTTS, setIsSpeakingTTS] = useState<boolean>(false);
  const [showTTSVoiceMenu, setShowTTSVoiceMenu] = useState<boolean>(false);
  const [showBottomTTSMenu, setShowBottomTTSMenu] = useState<boolean>(false);
  const [ttsVoicePreset, setTtsVoicePreset] = useState<VoiceTonePreset>(VOICE_TONE_PRESETS[0]);
  const [recognizedTextPreview, setRecognizedTextPreview] = useState<string | null>(null);

  const calligraphySessionStrokesRef = useRef<string[]>([]);
  const lastPointerPointRef = useRef<{ x: number; y: number; pressure: number; time: number; width?: number } | null>(null);
  const lastMidPointRef = useRef<{ x: number; y: number } | null>(null);

  const isFreehandStrokeTool = useCallback(
    (tool: WhiteboardTool) =>
      tool === 'pen' ||
      tool === 'calligraphy' ||
      tool === 'highlighter' ||
      tool === 'eraser',
    []
  );

  // Device detection & mobile phone optimization
  const { isMobile, isLandscape } = useDeviceDetection();
  const [showMobileColorSheet, setShowMobileColorSheet] = useState<boolean>(false);
  const [showMobileShapeSheet, setShowMobileShapeSheet] = useState<boolean>(false);
  const [showMobileMoreSheet, setShowMobileMoreSheet] = useState<boolean>(false);
  const [isMobileChalkDockMinimized, setIsMobileChalkDockMinimized] = useState<boolean>(false);

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
  const [showRotateDropdown, setShowRotateDropdown] = useState<boolean>(false);
  const [showColorPickerDropdown, setShowColorPickerDropdown] = useState<boolean>(false);
  const [isDraggingStroke, setIsDraggingStroke] = useState<boolean>(false);
  const [isResizingStroke, setIsResizingStroke] = useState<boolean>(false);
  const resizeStrokeStartRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    origScale: number;
    origBounds: {
      centerX: number;
      centerY: number;
      width: number;
      height: number;
      minX?: number;
      maxX?: number;
      minY?: number;
      maxY?: number;
    };
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
  const p0Ref = useRef<{ x: number; y: number } | null>(null);
  const p1Ref = useRef<{ x: number; y: number } | null>(null);

  // 2-finger touch panning on 75" TV touch screen
  const twoFingerStartRef = useRef<{ x: number; y: number } | null>(null);
  const isTwoFingerPanningRef = useRef<boolean>(false);
  const twoFingerCooldownUntilRef = useRef<number>(0);

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
  const pagesRef = useRef<BlackboardPage[]>(pages);
  const currentPageIndexRef = useRef<number>(currentPageIndex);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);
  useEffect(() => {
    currentPageIndexRef.current = currentPageIndex;
  }, [currentPageIndex]);

  // Custom Equation Dialog state (Hàm số toán học & vật lý do giáo viên tự nhập)
  const [showEquationModal, setShowEquationModal] = useState<boolean>(false);
  const [equationInput, setEquationInput] = useState<string>('y = 2x^3-3x+1');
  const [editingEquationStrokeId, setEditingEquationStrokeId] = useState<string | null>(null);

  // Helper to adjust graph scale (Zoom in / out)
  const handleZoomGraph = (strokeId: string, delta: number) => {
    setPages((prev) => {
      const up = [...prev];
      const curr = up[currentPageIndex];
      if (!curr) return prev;
      const newStrokes = curr.strokes.map((s) => {
        if (s.id !== strokeId) return s;
        const currentGScale = s.graphScale || 1.0;
        const newScale = Math.max(0.3, Math.min(4.0, Number((currentGScale + delta).toFixed(2))));
        return { ...s, graphScale: newScale };
      });
      up[currentPageIndex] = { ...curr, strokes: newStrokes };
      return up;
    });
  };

  // Helper to pan graph Ox / Oy coordinate system
  const handlePanGraph = (strokeId: string, dx: number, dy: number) => {
    setPages((prev) => {
      const up = [...prev];
      const curr = up[currentPageIndex];
      if (!curr) return prev;
      const newStrokes = curr.strokes.map((s) => {
        if (s.id !== strokeId) return s;
        const curX = s.graphOffsetX || 0;
        const curY = s.graphOffsetY || 0;
        return {
          ...s,
          graphOffsetX: curX + dx,
          graphOffsetY: curY + dy,
        };
      });
      up[currentPageIndex] = { ...curr, strokes: newStrokes };
      return up;
    });
  };

  // Helper to reset graph Ox / Oy origin to center
  const handleResetGraphOrigin = (strokeId: string) => {
    setPages((prev) => {
      const up = [...prev];
      const curr = up[currentPageIndex];
      if (!curr) return prev;
      const newStrokes = curr.strokes.map((s) => {
        if (s.id !== strokeId) return s;
        return {
          ...s,
          graphOffsetX: 0,
          graphOffsetY: 0,
          graphScale: 1.0,
        };
      });
      up[currentPageIndex] = { ...curr, strokes: newStrokes };
      return up;
    });
  };

  // Helper to toggle hatch pattern for integral/volume shapes
  const handleToggleHatch = (strokeId: string) => {
    setPages((prev) => {
      const up = [...prev];
      const curr = up[currentPageIndex];
      if (!curr) return prev;
      const newStrokes = curr.strokes.map((s) => {
        if (s.id !== strokeId) return s;
        const curHatch = s.hatchPattern ?? true;
        return { ...s, hatchPattern: !curHatch };
      });
      up[currentPageIndex] = { ...curr, strokes: newStrokes };
      return up;
    });
  };

  // Helper to insert or update custom equation graph
  const handleApplyEquationGraph = (eqFormula: string) => {
    const trimmed = eqFormula.trim();
    if (!trimmed) return;

    if (editingEquationStrokeId) {
      setPages((prev) => {
        const up = [...prev];
        const curr = up[currentPageIndex];
        if (!curr) return prev;
        const newStrokes = curr.strokes.map((s) =>
          s.id === editingEquationStrokeId ? { ...s, customEquation: trimmed } : s
        );
        up[currentPageIndex] = { ...curr, strokes: newStrokes };
        return up;
      });
      setEditingEquationStrokeId(null);
      setShowEquationModal(false);
      return;
    }

    // Insert new graph centered in the board viewport
    const canvas = canvasRef.current;
    const viewW = canvas?.clientWidth || 1000;
    const viewH = canvas?.clientHeight || 600;
    const cx = boardScrollX + viewW / 2;
    const cy = boardScrollY + viewH / 2;
    const gw = 400;
    const gh = 300;
    const p1: StrokePoint = { x: cx - gw / 2, y: cy - gh / 2, pressure: 0.5 };
    const p2: StrokePoint = { x: cx + gw / 2, y: cy + gh / 2, pressure: 0.5 };

    const newStroke: WhiteboardStroke = {
      id: `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      tool: 'func_custom_equation',
      points: [p1, p2],
      color: activeColor || '#38bdf8',
      size: strokeSize || 2.5,
      timestamp: Date.now(),
      rotation: 0,
      centerX: cx,
      centerY: cy,
      scale: 1,
      graphScale: 1,
      graphOffsetX: 0,
      graphOffsetY: 0,
      customEquation: trimmed,
    };

    setPages((prev) => {
      const up = [...prev];
      const curr = up[currentPageIndex];
      if (!curr) return prev;
      up[currentPageIndex] = {
        ...curr,
        strokes: [...curr.strokes, newStroke],
        redoStack: [],
      };
      return up;
    });

    setSelectedStrokeId(newStroke.id);
    setIsStrokeToolbarExpanded(false);
    setShowRotateDropdown(false);
    setShowColorPickerDropdown(false);
    setShowEquationModal(false);
  };

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

  // Chalk Palette Colors (14 màu phấn bảng sư phạm tiêu chuẩn & mở rộng)
  const chalkPalette = [
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

    const ctx = canvas.getContext('2d', { desynchronized: true });
    if (ctx) {
      ctxRef.current = ctx;
      redrawCanvas(ctx);
    }
    canvasRectRef.current = canvas.getBoundingClientRect();
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

    // 3. Calculation for Mathematical & Physical Function Graphs
    if (isFunctionGraphTool(stroke.tool)) {
      let renderPts = stroke.points;
      if (!renderPts || renderPts.length === 1) {
        const p = renderPts && renderPts.length > 0 ? renderPts[0] : { x: 150, y: 150, pressure: 0.5 };
        renderPts = [
          p,
          { x: p.x + 380, y: p.y + 280, pressure: 0.5 },
        ];
      }
      const b = getGraphBounds(renderPts, stroke.scale || 1);
      const padding = 24; // Generous padding so all axis labels, projections, formulas & arrows are enclosed
      return {
        minX: b.minX - padding,
        maxX: b.maxX + padding,
        minY: b.minY - padding,
        maxY: b.maxY + padding,
        centerX: b.cx,
        centerY: b.cy,
        width: b.width + padding * 2,
        height: b.height + padding * 2,
      };
    }

    // 4. Calculation for 3D and 2D shapes with custom vertices
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
    customVertices?: StrokeVertex[],
    graphOptions?: {
      graphOffsetX?: number;
      graphOffsetY?: number;
      graphScale?: number;
      customEquation?: string;
      hatchPattern?: boolean;
      fillColor?: string;
    }
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
        ctx.shadowBlur = 0;
      }
    } else if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1.0;
    } else {
      ctx.globalAlpha = 0.98;
      ctx.shadowColor = color;
      ctx.shadowBlur = 0;
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
          { x: p.x + 380, y: p.y + 280, pressure: 0.5 },
        ];
      }
      drawFunctionGraph(ctx, tool, renderPts, color, size, scale, {
        scale,
        graphOffsetX: graphOptions?.graphOffsetX,
        graphOffsetY: graphOptions?.graphOffsetY,
        graphScale: graphOptions?.graphScale,
        customEquation: graphOptions?.customEquation,
        hatchPattern: graphOptions?.hatchPattern,
        fillColor: graphOptions?.fillColor,
      });
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
      // Freehand chalk & calligraphy stroke with ultra-smooth Catmull-Rom / Midpoint Bezier interpolation
      // BẢO ĐẢM HIỂN THỊ TRỌN VẸN MỌI NÉT CHẠM NHẸ, CHẤM PHẤN, DẤU CÂU & LƯỚT NHANH
      const dotRadius = Math.max(1.8, (tool === 'highlighter' ? size * 2.5 : size) / 2);

      if (points.length === 1) {
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      } else if (points.length === 2) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.stroke();

        // Vẽ 2 điểm tròn hai đầu để những nét chạm nhẹ / vẩy bút cực ngắn không bao giờ bị mất
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, dotRadius, 0, Math.PI * 2);
        ctx.arc(points[1].x, points[1].y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i];
          const p1 = points[i + 1];
          const midX = (p0.x + p1.x) / 2;
          const midY = (p0.y + p1.y) / 2;
          ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
        }
        const last = points[points.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  // Redraw all strokes with transparent background to preserve pedagogical grid lines
  const redrawCanvas = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas.width / dpr, ctx.canvas.height / dpr);

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
            stroke.customVertices,
            {
              graphOffsetX: stroke.graphOffsetX,
              graphOffsetY: stroke.graphOffsetY,
              graphScale: stroke.graphScale,
              customEquation: stroke.customEquation,
              hatchPattern: stroke.hatchPattern,
              fillColor: stroke.fillColor,
            }
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

  // 2-Finger Touch gesture handler on 75" touch TV: smooth scrolling up/down/left/right without mouse
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
        isTwoFingerPanningRef.current = true;
        // Abort single-finger stroke if one was started
        if (isDrawingRef.current) {
          isDrawingRef.current = false;
          activePointsRef.current = [];
          const ctx = canvas.getContext('2d');
          if (ctx) redrawCanvas(ctx);
        }
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        twoFingerStartRef.current = {
          x: (t0.clientX + t1.clientX) / 2,
          y: (t0.clientY + t1.clientY) / 2,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
        isTwoFingerPanningRef.current = true;
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const currentMidX = (t0.clientX + t1.clientX) / 2;
        const currentMidY = (t0.clientY + t1.clientY) / 2;

        if (twoFingerStartRef.current) {
          const deltaX = twoFingerStartRef.current.x - currentMidX;
          const deltaY = twoFingerStartRef.current.y - currentMidY;

          setBoardScrollY((prev) => {
            const next = Math.max(0, prev + deltaY);
            if (next > boardExtraHeight) {
              setBoardExtraHeight((h) => h + 800);
            }
            return next;
          });

          setBoardScrollX((prev) => {
            const next = Math.max(0, prev + deltaX);
            if (next > boardExtraWidth) {
              setBoardExtraWidth((w) => w + 800);
            }
            return next;
          });
        }
        twoFingerStartRef.current = { x: currentMidX, y: currentMidY };
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isTwoFingerPanningRef.current) {
        if (e.touches.length < 2) {
          twoFingerStartRef.current = null;
          twoFingerCooldownUntilRef.current = Date.now() + 60;
          if (e.touches.length === 0) {
            isTwoFingerPanningRef.current = false;
          }
        }
      }
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [redrawCanvas, boardExtraHeight, boardExtraWidth]);

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

  // Viết Chữ Đẹp: Convert handwritten chalk strokes to beautiful calligraphy font text box
  const handleConvertHandwritingToCalligraphy = useCallback(async (forcedStrokeIds?: string[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use latest pages from pagesRef to eliminate any React stale closure issues!
    const currPages = pagesRef.current;
    const currIdx = currentPageIndexRef.current;
    const currPage = currPages[currIdx];
    if (!currPage) return;

    // 1. Gather stroke IDs to convert (from swept selection, forced IDs, or selected stroke)
    let strokeIds: string[] = forcedStrokeIds && forcedStrokeIds.length > 0
      ? [...forcedStrokeIds]
      : sweptSelection && sweptSelection.strokeIds.length > 0
      ? [...sweptSelection.strokeIds]
      : [...calligraphySessionStrokesRef.current];

    // If no session strokes, check if teacher currently selected a stroke
    if (strokeIds.length === 0 && selectedStrokeId) {
      strokeIds = [selectedStrokeId];
    }

    // 1b. If swept selection contains existing text boxes but no strokes, convert text box font family directly (0ms latency!)
    if (sweptSelection && sweptSelection.textIds.length > 0 && strokeIds.length === 0) {
      setPages((prev) => {
        const updated = [...prev];
        const curr = updated[currIdx];
        if (!curr) return prev;
        const updatedTexts = (curr.texts || []).map((t) =>
          sweptSelection.textIds.includes(t.id) ? { ...t, fontFamily: calligraphyFont } : t
        );
        const newPages = [
          ...updated.slice(0, currIdx),
          { ...curr, texts: updatedTexts },
          ...updated.slice(currIdx + 1),
        ];
        pagesRef.current = newPages;
        return newPages;
      });
      setSweptSelection(null);
      setCalligraphyStatusBanner('✨ Đã áp dụng phông chữ đẹp cho văn bản vừa quét!');
      setTimeout(() => setCalligraphyStatusBanner(null), 3500);
      return;
    }

    // If still no strokes found, prompt teacher to sweep over handwriting
    if (strokeIds.length === 0) {
      setCalligraphyStatusBanner('💡 Thầy cô vui lòng kéo quét bao quanh vùng chữ trên bảng rồi bấm chọn nhé!');
      setTimeout(() => setCalligraphyStatusBanner(null), 3500);
      return;
    }

    const targetStrokes = currPage.strokes.filter((s) => strokeIds.includes(s.id));
    if (targetStrokes.length === 0) {
      setCalligraphyStatusBanner('💡 Không tìm thấy nét vẽ nào trong vùng đã quét.');
      setTimeout(() => setCalligraphyStatusBanner(null), 3000);
      return;
    }

    const allPoints: StrokePoint[] = [];
    targetStrokes.forEach((s) => {
      if (s.points) allPoints.push(...s.points);
    });

    if (allPoints.length < 3) {
      setCalligraphyStatusBanner('💡 Nét vẽ quá ngắn, hãy quét trọn vẹn từ ngữ cần chuyển đổi nhé.');
      setTimeout(() => setCalligraphyStatusBanner(null), 3000);
      return;
    }

    // =========================================================================
    // YÊU CẦU 2 (Tối ưu OCR):
    // Trích xuất ảnh vùng chữ viết tay qua OffscreenCanvas ẩn nền TRẮNG (#FFFFFF),
    // nét vẽ ĐEN (#000000), loại bỏ hoàn toàn nền xanh / trong suốt.
    // =========================================================================
    const crop = cropStrokesToImage(
      canvas,
      targetStrokes,
      boardScrollX,
      boardScrollY,
      20,
      sweptSelection ? sweptSelection.box : undefined
    );
    if (!crop) {
      setCalligraphyStatusBanner('⚠️ Không thể trích xuất nét vẽ.');
      setTimeout(() => setCalligraphyStatusBanner(null), 3000);
      return;
    }

    setIsConvertingCalligraphy(true);
    setCalligraphyStatusBanner('⚡ Đang chuyển thành chữ đẹp 1-click...');

    try {
      // 1-Click Fast Recognition
      let text = (recognizedTextPreview || '').trim();
      let oneClickResult = null;

      if (!text) {
        oneClickResult = await recognizeHandwritingOneClick(targetStrokes, sweptSelection ? sweptSelection.box : undefined, recognizedTextPreview);
        if (oneClickResult && oneClickResult.text) {
          text = oneClickResult.text;
        }
      }

      if (!text) {
        const teacherName = activeTeacher?.name || '';
        const contextHint = `Giáo viên: ${teacherName}, học sinh lớp học Việt Nam, nhận diện tên riêng tiếng Việt, bài giảng môn học Toán/Tiếng Việt/Văn`;
        const recognized = await recognizeVietnameseHandwriting(crop.dataUrl, contextHint);
        text = (recognized || '').trim();
      }
      if (text.length > 0) {
        // Tính toán chính xác kích thước và tọa độ thật của nét vẽ lúc giáo viên viết phấn
        let sMinX = Infinity, sMaxX = -Infinity;
        let sMinY = Infinity, sMaxY = -Infinity;
        targetStrokes.forEach((s) => {
          if (s.points) {
            s.points.forEach((p) => {
              if (p.x < sMinX) sMinX = p.x;
              if (p.x > sMaxX) sMaxX = p.x;
              if (p.y < sMinY) sMinY = p.y;
              if (p.y > sMaxY) sMaxY = p.y;
            });
          }
        });

        const actualStrokeHeight = sMaxY > sMinY ? (sMaxY - sMinY) : (crop.actualBounds?.height || crop.bounds.height);
        const actualStrokeWidth = sMaxX > sMinX ? (sMaxX - sMinX) : (crop.actualBounds?.width || crop.bounds.width);
        const origX = sMinX < Infinity ? sMinX : crop.bounds.minX;
        const origY = sMinY < Infinity ? sMinY : crop.bounds.minY;

        // Phân tích tỷ lệ nét chữ viết tay thật của giáo viên để định hình dòng
        let processedText = text;
        const rawLines = processedText.split('\n').map((l) => l.trim()).filter(Boolean);
        const strokeAspectRatio = actualStrokeWidth / Math.max(1, actualStrokeHeight);

        // Nếu nét vẽ trải ngang rộng (tỷ lệ ngang/dọc >= 2.0), giáo viên viết trên 1 hàng ngang -> không ngắt dòng
        if (strokeAspectRatio >= 2.0 && rawLines.length > 1) {
          processedText = rawLines.join(' ');
        }

        const lines = processedText.split('\n').map((l) => l.trim()).filter(Boolean);
        const lineCount = Math.max(1, lines.length);
        const maxCharsInLine = Math.max(...lines.map((l) => l.length), 1);

        // Chuẩn hóa kích thước font chữ tương đồng chuẩn xác với nét phấn vẽ thật (khắc phục lỗi chữ khổng lồ 126px):
        // 1. Theo chiều cao nét vẽ thực tế:
        const sizeFromHeight = (actualStrokeHeight / lineCount) * 0.68;
        // 2. Theo chiều ngang nét vẽ thực tế:
        const sizeFromWidth = actualStrokeWidth / (maxCharsInLine * 0.55);

        // Cân bằng hài hòa giữa chiều ngang và chiều dọc để vừa khít nét vẽ ban đầu:
        let balancedSize = maxCharsInLine > 3
          ? Math.min(sizeFromHeight, sizeFromWidth * 1.1)
          : sizeFromHeight;

        // Giới hạn trong khoảng hợp lý (20px - 64px, đảm bảo size chữ đẹp luôn tương đồng với nét vẽ thật)
        let calculatedSize = Math.round(Math.max(20, Math.min(64, balancedSize)));

        // Độ rộng hộp đủ rộng để chứa trọn vẹn văn bản, ngăn chặn triệt để tình trạng tự động rớt dòng
        const neededTextWidth = Math.round(maxCharsInLine * calculatedSize * 0.68) + 40;
        const boxWidth = Math.max(Math.round(actualStrokeWidth + 40), neededTextWidth);
        const boxHeight = Math.max(Math.round(actualStrokeHeight + 14), Math.round(calculatedSize * lineCount * 1.3) + 16);

        const newTextBox: BlackboardTextBox = {
          id: `calligraphy_txt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          x: Math.round(origX),
          y: Math.round(origY),
          width: boxWidth,
          height: boxHeight,
          text: processedText,
          color: targetStrokes[0]?.color || activeColor,
          size: calculatedSize,
          fontFamily: calligraphyFont,
          bold: false,
          italic: false,
          underline: false,
          align: 'left',
          bgColor: 'transparent',
          borderStyle: 'none',
        };

        setLastConvertedInfo({
          textBoxId: newTextBox.id,
          replacedStrokes: targetStrokes,
        });

        setPages((prev) => {
          const updated = [...prev];
          const curr = updated[currIdx];
          if (!curr) return prev;
          const strokeIdSet = new Set(strokeIds);
          const remainingStrokes = curr.strokes.filter((s) => !strokeIdSet.has(s.id));
          const newPages = [
            ...updated.slice(0, currIdx),
            {
              ...curr,
              strokes: remainingStrokes,
              texts: [...(curr.texts || []), newTextBox],
            },
            ...updated.slice(currIdx + 1),
          ];
          pagesRef.current = newPages;
          return newPages;
        });

        setSweptSelection(null);
        calligraphySessionStrokesRef.current = [];
        setSelectedTextId(newTextBox.id);
        setSelectedStrokeId(null);
        setCalligraphyStatusBanner(`✨ Đã chuyển hóa thành công: "${text}"`);
        setTimeout(() => setCalligraphyStatusBanner(null), 5000);
      } else {
        setCalligraphyStatusBanner('⚠️ Không nhận diện được chữ rõ ràng. Thầy cô vui lòng quét lại nét chữ hoàn chỉnh hơn nhé.');
        setTimeout(() => setCalligraphyStatusBanner(null), 4000);
      }
    } catch (err) {
      console.warn('Calligraphy conversion error:', err);
      setCalligraphyStatusBanner('⚠️ Lỗi kết nối dịch vụ nhận diện. Thầy cô vui lòng thử lại.');
      setTimeout(() => setCalligraphyStatusBanner(null), 4000);
    } finally {
      setIsConvertingCalligraphy(false);
    }
  }, [boardScrollX, boardScrollY, activeColor, calligraphyFont, selectedStrokeId, sweptSelection]);

  // Text-To-Speech (TTS): Phát âm văn bản hoặc chữ viết tay trên bảng xanh với bộ lọc giọng tự nhiên & tiền xử lý toán học
  const speakTextWithWebSpeech = useCallback((text: string, preset: VoiceTonePreset) => {
    stopAllSpeech();
    setIsSpeakingTTS(true);

    const ok = speakText(text, {
      preset,
      onStart: () => setIsSpeakingTTS(true),
      onEnd: () => {
        setIsSpeakingTTS(false);
        setCalligraphyStatusBanner(null);
      },
      onError: (err) => {
        console.warn('SpeechSynthesis error:', err);
        setIsSpeakingTTS(false);
        setCalligraphyStatusBanner(null);
      },
    });

    if (!ok && !('speechSynthesis' in window)) {
      alert('Trình duyệt không hỗ trợ Web Speech Synthesis API');
      setIsSpeakingTTS(false);
    }
  }, []);

  const handleStopTTS = useCallback(() => {
    stopAllSpeech();
    setIsSpeakingTTS(false);
    setCalligraphyStatusBanner(null);
  }, []);

  const handleSpeakSweptContent = useCallback(async (overridePreset?: VoiceTonePreset) => {
    const preset = overridePreset || ttsVoicePreset;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const currPages = pagesRef.current;
    const currIdx = currentPageIndexRef.current;
    const currPage = currPages[currIdx];
    if (!currPage) return;

    // 1. If swept selection contains existing text boxes:
    if (sweptSelection && sweptSelection.textIds.length > 0) {
      const textObjects = (currPage.texts || []).filter((t) => sweptSelection.textIds.includes(t.id));
      const combinedText = textObjects.map((t) => t.text).join(' ').trim();
      if (combinedText) {
        setCalligraphyStatusBanner(`🔊 AI đang đọc: "${combinedText}"`);
        speakTextWithWebSpeech(combinedText, preset);
        return;
      }
    }

    // 2. If a text box is selected:
    if (selectedTextId) {
      const targetText = (currPage.texts || []).find((t) => t.id === selectedTextId);
      if (targetText && targetText.text) {
        setCalligraphyStatusBanner(`🔊 AI đang đọc: "${targetText.text}"`);
        speakTextWithWebSpeech(targetText.text, preset);
        return;
      }
    }

    // 3. If swept selection has handwriting strokes:
    let strokeIds: string[] = sweptSelection?.strokeIds || [];
    if (strokeIds.length === 0 && selectedStrokeId) {
      strokeIds = [selectedStrokeId];
    }

    if (strokeIds.length === 0) {
      setCalligraphyStatusBanner('💡 Thầy cô vui lòng quét bao quanh chữ cần đọc hoặc nhấp vào hộp chữ nhé!');
      setTimeout(() => setCalligraphyStatusBanner(null), 3000);
      return;
    }

    const targetStrokes = currPage.strokes.filter((s) => strokeIds.includes(s.id));
    if (targetStrokes.length === 0) return;

    // Fast check: nếu đã có preview nhận diện trước đó (<0.5s), đọc ngay lập tức (<150ms)
    if (recognizedTextPreview && recognizedTextPreview.trim().length > 0) {
      setCalligraphyStatusBanner(`🔊 AI đang đọc: "${recognizedTextPreview}"`);
      speakTextWithWebSpeech(recognizedTextPreview, preset);
      return;
    }

    // Cắt ảnh vùng chọn siêu tốc (< 400px, grayscale tương phản cao)
    const box = sweptSelection?.box || { minX: 0, minY: 0, maxX: 400, maxY: 400 };
    const crop = cropCanvasRegion(canvas, box, targetStrokes, boardScrollX, boardScrollY, 12);
    if (!crop) return;

    setCalligraphyStatusBanner('⚡ AI đang nhận diện chữ siêu tốc...');
    setIsSpeakingTTS(true);

    try {
      const recognized = await recognizeHandwritingFast(crop.dataUrl);
      if (recognized && recognized.trim().length > 0) {
        const cleanText = recognized.trim();
        setRecognizedTextPreview(cleanText);
        setCalligraphyStatusBanner(`🔊 AI đang đọc: "${cleanText}"`);
        speakTextWithWebSpeech(cleanText, preset);
      } else {
        setCalligraphyStatusBanner('⚠️ Không nhận diện được chữ để đọc.');
        setIsSpeakingTTS(false);
        setTimeout(() => setCalligraphyStatusBanner(null), 3000);
      }
    } catch (err) {
      console.error('TTS error:', err);
      setIsSpeakingTTS(false);
      setCalligraphyStatusBanner('⚠️ Có lỗi xảy ra khi đọc.');
      setTimeout(() => setCalligraphyStatusBanner(null), 3000);
    }
  }, [boardScrollX, boardScrollY, recognizedTextPreview, selectedStrokeId, selectedTextId, speakTextWithWebSpeech, sweptSelection, ttsVoicePreset]);

  // Undo Calligraphy: revert converted text box back to original handwritten chalk strokes
  const handleUndoCalligraphy = useCallback(() => {
    if (!lastConvertedInfo) return;
    const { textBoxId, replacedStrokes } = lastConvertedInfo;
    const currIdx = currentPageIndexRef.current;
    setPages((prev) => {
      const updated = [...prev];
      const curr = updated[currIdx];
      if (!curr) return prev;
      const remainingTexts = (curr.texts || []).filter((t) => t.id !== textBoxId);
      const newPages = [
        ...updated.slice(0, currIdx),
        {
          ...curr,
          strokes: [...curr.strokes, ...replacedStrokes],
          texts: remainingTexts,
        },
        ...updated.slice(currIdx + 1),
      ];
      pagesRef.current = newPages;
      return newPages;
    });
    setLastConvertedInfo(null);
    setCalligraphyStatusBanner('↩️ Đã hoàn tác về nét viết phấn ban đầu.');
    setTimeout(() => setCalligraphyStatusBanner(null), 4000);
  }, [lastConvertedInfo]);

  // Convert a specific selected stroke to calligraphy text box
  const convertSelectedStrokeToCalligraphy = useCallback(
    async (stroke: WhiteboardStroke) => {
      await handleConvertHandwritingToCalligraphy([stroke.id]);
    },
    [handleConvertHandwritingToCalligraphy]
  );

  // Smart mobile selection: Select all recently written strokes (last 1-6 strokes) without manual dragging
  const handleSelectRecentStrokes = useCallback(() => {
    const curr = pagesRef.current[currentPageIndexRef.current] || pages[currentPageIndex];
    if (!curr || curr.strokes.length === 0) {
      setCalligraphyStatusBanner('Chưa có nét chữ nào trên bảng để chọn');
      setTimeout(() => setCalligraphyStatusBanner(null), 3000);
      return;
    }
    const sessionIds = calligraphySessionStrokesRef.current;
    let targetStrokes: WhiteboardStroke[] = [];
    if (sessionIds && sessionIds.length > 0) {
      targetStrokes = curr.strokes.filter((s) => sessionIds.includes(s.id));
    }
    if (targetStrokes.length === 0) {
      targetStrokes = curr.strokes.slice(-6);
    }
    if (targetStrokes.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const ids: string[] = [];
    for (const s of targetStrokes) {
      const b = getStrokeBounds(s);
      if (b) {
        ids.push(s.id);
        minX = Math.min(minX, b.minX);
        minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX);
        maxY = Math.max(maxY, b.maxY);
      }
    }
    if (ids.length > 0) {
      setSweptSelection({
        box: {
          minX: Math.max(0, minX - 16),
          minY: Math.max(0, minY - 16),
          maxX: maxX + 16,
          maxY: maxY + 16,
        },
        strokeIds: ids,
        textIds: [],
      });
      setCalligraphyStatusBanner(`✨ Đã chọn ${ids.length} nét vừa viết`);
    }
  }, [pages, currentPageIndex]);

  // Smart mobile selection: Select all handwriting strokes on the current page
  const handleSelectAllStrokes = useCallback(() => {
    const curr = pagesRef.current[currentPageIndexRef.current] || pages[currentPageIndex];
    if (!curr || curr.strokes.length === 0) {
      setCalligraphyStatusBanner('Chưa có nét chữ nào trên bảng để chọn');
      setTimeout(() => setCalligraphyStatusBanner(null), 3000);
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const ids: string[] = [];
    for (const s of curr.strokes) {
      const b = getStrokeBounds(s);
      if (b) {
        ids.push(s.id);
        minX = Math.min(minX, b.minX);
        minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX);
        maxY = Math.max(maxY, b.maxY);
      }
    }
    if (ids.length > 0) {
      setSweptSelection({
        box: {
          minX: Math.max(0, minX - 20),
          minY: Math.max(0, minY - 20),
          maxX: maxX + 20,
          maxY: maxY + 20,
        },
        strokeIds: ids,
        textIds: [],
      });
      setCalligraphyStatusBanner(`✨ Đã chọn toàn bộ ${ids.length} nét trên bảng`);
    }
  }, [pages, currentPageIndex]);

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
    // Chống va chạm thao tác cuộn 2 ngón tay trên màn hình Tivi cảm ứng
    if (isTwoFingerPanningRef.current || Date.now() < twoFingerCooldownUntilRef.current) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}

    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const x = canvasX + boardScrollX;
    const y = canvasY + boardScrollY;

    if (activeTool === 'laser') {
      setLaserPos({ x: canvasX, y: canvasY });
      return;
    }

    // Viết Chữ Đẹp: Drag to sweep / marquee select text area to convert to beautiful font
    if (activeTool === 'calligraphy') {
      setCalligraphySweep({ startX: x, startY: y, curX: x, curY: y });
      setSweptSelection(null);
      setSelectedStrokeId(null);
      setSelectedTextId(null);
      setIsStrokeToolbarExpanded(false);
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch (_) {}
      return;
    }

    if (activeTool === 'select' || isFunctionGraphTool(activeTool)) {
      // Yêu cầu người dùng: "Thiết kế khi bấm chọn thì khung chữ nhật hiện ra"
      // Cho phép bấm chọn hình học và đồ thị toán học khi ở công cụ Chọn hoặc bấm trực tiếp vào đồ thị đã vẽ
      const hitStroke = strokes.slice().reverse().find((s) => {
        // Freehand pen strokes, highlighters, erasers, creative brushes are handwriting - NEVER select them with mouse/pointer
        if (isFreehandStrokeTool(s.tool) || s.tool === 'laser') {
          return false;
        }
        if (isFunctionGraphTool(activeTool) && !isFunctionGraphTool(s.tool)) {
          return false;
        }
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
        const bounds = getStrokeBounds(hitStroke);
        dragStrokeStartRef.current = {
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          origPoints: hitStroke.points ? hitStroke.points.map((p) => ({ ...p })) : [],
          origVertices: hitStroke.customVertices ? hitStroke.customVertices.map((v) => ({ ...v })) : undefined,
          centerX: bounds?.centerX ?? 0,
          centerY: bounds?.centerY ?? 0,
          origRotation: hitStroke.rotation || 0,
        };
        try {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } catch (_) {}
        return;
      }

      if (activeTool === 'select') {
        // If clicked on empty space in select mode, allow dragging to sweep a marquee box over handwriting or text
        setCalligraphySweep({ startX: x, startY: y, curX: x, curY: y });
        setSweptSelection(null);
        setSelectedTextId(null);
        setSelectedStrokeId(null);
        setIsStrokeToolbarExpanded(false);
        setDragLivePos(null);
        try {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } catch (_) {}
        return;
      }
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
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}
    canvasRectRef.current = canvas.getBoundingClientRect();
    ctxRef.current = canvas.getContext('2d', { desynchronized: true });

    const now = performance.now();
    const effectivePressure = e.pressure && e.pressure > 0 ? Math.max(0.25, e.pressure) : 0.5;
    const initialWidth = activeTool === 'pen'
      ? calculateDynamicStrokeWidth(strokeSize, { x, y, pressure: effectivePressure, time: now }, undefined, false)
      : strokeSize;

    p0Ref.current = { x, y };
    p1Ref.current = { x, y };
    lastPointerPointRef.current = { x, y, pressure: effectivePressure, time: now, width: initialWidth };
    lastMidPointRef.current = { x, y };
    const startPt: StrokePoint = { x, y, pressure: effectivePressure, time: now, width: initialWidth };
    activePointsRef.current = [startPt];

    // Khởi tạo nét vẽ với ctx.lineCap = 'round' và ctx.lineJoin = 'round' cùng DPI chuẩn
    const ctx = canvas.getContext('2d');
    if (ctx && isFreehandStrokeTool(activeTool)) {
      ctx.save();
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(-boardScrollX, -boardScrollY);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (activeTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';
      } else if (activeTool === 'highlighter') {
        ctx.fillStyle = activeColor;
        ctx.globalAlpha = 0.45;
      } else {
        ctx.fillStyle = activeColor;
        ctx.globalAlpha = 0.98;
      }
      ctx.beginPath();
      const dotRadius = Math.max(1.8, (activeTool === 'highlighter' ? strokeSize * 2.5 : initialWidth) / 2);
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isTwoFingerPanningRef.current || Date.now() < twoFingerCooldownUntilRef.current) {
      return;
    }
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvasRectRef.current || canvas.getBoundingClientRect();
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

    // Live marquee sweep for Viết Chữ Đẹp (Quét văn bản)
    if (calligraphySweep) {
      setCalligraphySweep((prev) => (prev ? { ...prev, curX: x, curY: y } : null));
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
      const origCenterX = dragStrokeStartRef.current.centerX ?? 0;
      const origCenterY = dragStrokeStartRef.current.centerY ?? 0;

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
              const newCenterX = origCenterX + deltaX;
              const newCenterY = origCenterY + deltaY;
              return {
                ...s,
                points: movedPoints,
                customVertices: movedVertices,
                centerX: newCenterX,
                centerY: newCenterY,
                graphCenterX: s.graphCenterX !== undefined ? s.graphCenterX + deltaX : undefined,
                graphCenterY: s.graphCenterY !== undefined ? s.graphCenterY + deltaY : undefined,
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

    // Bắt trọn điểm chạm phần cứng 120Hz qua getCoalescedEvents; gỡ bỏ hoàn toàn getPredictedEvents chống vệt gai nhọn li ti
    const coalescedList: { x: number; y: number; pressure: number }[] = [];
    const nativeEvt = e.nativeEvent as any;
    if (nativeEvt && typeof nativeEvt.getCoalescedEvents === 'function') {
      const cEvents = nativeEvt.getCoalescedEvents();
      if (Array.isArray(cEvents) && cEvents.length > 0) {
        for (const ce of cEvents) {
          coalescedList.push({
            x: ce.clientX - rect.left + boardScrollX,
            y: ce.clientY - rect.top + boardScrollY,
            pressure: ce.pressure && ce.pressure > 0 ? Math.max(0.25, ce.pressure) : 0.5,
          });
        }
      }
    }
    if (coalescedList.length === 0) {
      coalescedList.push({
        x,
        y,
        pressure: e.pressure && e.pressure > 0 ? Math.max(0.25, e.pressure) : 0.5,
      });
    }

    const pts = activePointsRef.current;
    const ctx = ctxRef.current || canvas.getContext('2d', { desynchronized: true });
    if (!ctx) return;

    if (isFreehandStrokeTool(activeTool)) {
      const isLiveFluo = activeColor === '#ccff00' || activeColor === '#ff007f' || activeColor === '#00ffff';
      ctx.save();
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(-boardScrollX, -boardScrollY);

      // Cấu hình nét vẽ bo tròn tự nhiên
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (activeTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = '#000000';
        ctx.fillStyle = '#000000';
        ctx.lineWidth = strokeSize;
      } else if (activeTool === 'highlighter') {
        ctx.strokeStyle = activeColor;
        ctx.fillStyle = activeColor;
        ctx.globalAlpha = isLiveFluo ? 0.65 : 0.45;
        ctx.lineWidth = strokeSize * 2.5;
      } else {
        ctx.strokeStyle = activeColor;
        ctx.fillStyle = activeColor;
        ctx.globalAlpha = 0.98;
        ctx.lineWidth = strokeSize;
      }

      let prevPt = p1Ref.current || { x, y };
      const now = performance.now();

      ctx.beginPath();
      ctx.moveTo(prevPt.x, prevPt.y);

      for (let i = 0; i < coalescedList.length; i++) {
        const rawPt = coalescedList[i];
        const current = { x: rawPt.x, y: rawPt.y };
        const midPoint = { x: (prevPt.x + current.x) * 0.5, y: (prevPt.y + current.y) * 0.5 };

        // 1. Nối mượt đường cong bậc hai và bám sát 100% ngòi bút tức thời (Zero Latency trên TV 75 inch)
        ctx.quadraticCurveTo(prevPt.x, prevPt.y, midPoint.x, midPoint.y);
        ctx.lineTo(current.x, current.y);

        prevPt = current;

        const effectivePressure = Math.max(0.25, rawPt.pressure || 0.5);
        const dynWidth = activeTool === 'calligraphy'
          ? calculateDynamicStrokeWidth(strokeSize, { x: current.x, y: current.y, pressure: effectivePressure, time: now }, lastPointerPointRef.current || undefined, true)
          : (activeTool === 'pen'
            ? calculateDynamicStrokeWidth(strokeSize, { x: current.x, y: current.y, pressure: effectivePressure, time: now }, lastPointerPointRef.current || undefined, false)
            : strokeSize);

        const ptWithWidth = {
          x: current.x,
          y: current.y,
          pressure: effectivePressure,
          time: now,
          width: dynWidth,
        };
        pts.push(ptWithWidth);
        lastPointerPointRef.current = ptWithWidth;
      }

      ctx.stroke();
      p1Ref.current = prevPt;
      lastMidPointRef.current = prevPt;

      ctx.restore();
    } else {
      // For geometric 2D/3D shapes, preview shape with full redraw
      pts.push(coalescedList[coalescedList.length - 1]);
      redrawCanvas(ctx);
      ctx.save();
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(-boardScrollX, -boardScrollY);
      renderSingleStroke(ctx, activeTool, pts, activeColor, strokeSize, 0, undefined, undefined, 1, undefined, {
        customEquation: activeTool === 'func_custom_equation' ? equationInput : undefined,
        hatchPattern: activeTool === 'shape_curved_trapezoid_area' ? true : undefined,
        fillColor: (activeTool === 'shape_curved_trapezoid_area' || activeTool === 'shape_solid_revolution_volume') ? 'rgba(56, 189, 248, 0.25)' : undefined,
      });
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
      origBounds: {
        centerX: bounds.centerX,
        centerY: bounds.centerY,
        width: bounds.width,
        height: bounds.height,
        minX: bounds.minX,
        maxX: bounds.maxX,
        minY: bounds.minY,
        maxY: bounds.maxY,
      },
      direction,
    };
  };

  const handleShapeResizePointerMove = (e: React.PointerEvent) => {
    if (!isResizingStroke || !resizeStrokeStartRef.current || !selectedStrokeId) return;
    e.stopPropagation();
    const { startMouseX, startMouseY, origScale, origBounds, direction } = resizeStrokeStartRef.current;
    const dx = e.clientX - startMouseX;
    const dy = e.clientY - startMouseY;

    const currStroke = strokes.find((s) => s.id === selectedStrokeId);
    if (!currStroke) return;

    // 1. ĐỐI VỚI ĐỒ THỊ TOÁN HỌC / VẬT LÝ (isFunctionGraphTool)
    // Yêu cầu người dùng: "và khi tăng kích thước khung chữ nhật thì sẽ thấy thêm được phần đồ thị hàm số"
    // Trực tiếp mở rộng khung chữ nhật (points), giữ unitPx = 36px để miền toạ độ x, y mở rộng ra,
    // cho phép nhìn thấy thêm trọn vẹn các nhánh, cực trị, chu kỳ của đồ thị!
    if (isFunctionGraphTool(currStroke.tool)) {
      const padding = 24;
      const bMinX = (origBounds as any).minX + padding;
      const bMaxX = (origBounds as any).maxX - padding;
      const bMinY = (origBounds as any).minY + padding;
      const bMaxY = (origBounds as any).maxY - padding;

      let newMinX = bMinX;
      let newMaxX = bMaxX;
      let newMinY = bMinY;
      let newMaxY = bMaxY;

      if (direction.includes('e')) {
        newMaxX = Math.max(bMinX + 160, bMaxX + dx);
      }
      if (direction.includes('w')) {
        newMinX = Math.min(bMaxX - 160, bMinX + dx);
      }
      if (direction.includes('s')) {
        newMaxY = Math.max(bMinY + 120, bMaxY + dy);
      }
      if (direction.includes('n')) {
        newMinY = Math.min(bMaxY - 120, bMinY + dy);
      }

      const newPoints: StrokePoint[] = [
        { x: newMinX, y: newMinY, pressure: 0.5 },
        { x: newMaxX, y: newMaxY, pressure: 0.5 },
      ];

      if (strokeRafRef.current) cancelAnimationFrame(strokeRafRef.current);
      strokeRafRef.current = requestAnimationFrame(() => {
        setPages((prev) => {
          const updated = [...prev];
          const curr = updated[currentPageIndex];
          if (!curr) return prev;
          const newStrokes = curr.strokes.map((s) =>
            s.id === selectedStrokeId
              ? {
                  ...s,
                  points: newPoints,
                  scale: 1, // Giữ scale = 1 để đồ thị sắc nét và hệ trục toạ độ nở rộng tự nhiên
                  centerX: (newMinX + newMaxX) / 2,
                  centerY: (newMinY + newMaxY) / 2,
                }
              : s
          );
          updated[currentPageIndex] = { ...curr, strokes: newStrokes };
          return updated;
        });
      });
      return;
    }

    // 2. Các hình học 2D / 3D thông thường
    const signX = direction.includes('e') ? 1 : direction.includes('w') ? -1 : 0;
    const signY = direction.includes('s') ? 1 : direction.includes('n') ? -1 : 0;
    const factorX = signX !== 0 ? (dx * signX) / Math.max(origBounds.width, 60) : 0;
    const factorY = signY !== 0 ? (dy * signY) / Math.max(origBounds.height, 60) : 0;
    const factor = Math.max(factorX, factorY) || factorX || factorY;
    const newScale = Math.max(0.15, Math.min(6.0, Number((origScale * (1 + factor)).toFixed(2))));

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
  };

  const handleShapeResizePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
    setIsResizingStroke(false);
    resizeStrokeStartRef.current = null;
  };

  const handlePointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    // 0. Finalize Calligraphy Marquee Sweep (Quét văn bản chuyển chữ đẹp) - Optimized for hand/finger touch & stylus
    if (calligraphySweep) {
      const minX = Math.min(calligraphySweep.startX, calligraphySweep.curX);
      const maxX = Math.max(calligraphySweep.startX, calligraphySweep.curX);
      const minY = Math.min(calligraphySweep.startY, calligraphySweep.curY);
      const maxY = Math.max(calligraphySweep.startY, calligraphySweep.curY);
      const dragW = maxX - minX;
      const dragH = maxY - minY;

      setCalligraphySweep(null);

      const curr = pagesRef.current[currentPageIndexRef.current] || pages[currentPageIndex];
      if (!curr) return;

      let matchedStrokeIds: string[] = [];
      let matchedTextIds: string[] = [];
      let selMinX = minX;
      let selMaxX = maxX;
      let selMinY = minY;
      let selMaxY = maxY;

      // Case A: Hand/Finger Tap or slight press (< 22px) -> Smart Proximity & Formula Cluster Selection
      if (dragW < 22 && dragH < 22) {
        const tapX = calligraphySweep.startX;
        const tapY = calligraphySweep.startY;
        let nearestStroke: WhiteboardStroke | null = null;
        let nearestDist = 52; // Generous touch target for human finger (52px radius)

        for (const s of curr.strokes) {
          if (s.points && s.points.length > 0) {
            for (const p of s.points) {
              const d = Math.hypot(p.x - tapX, p.y - tapY);
              if (d < nearestDist) {
                nearestDist = d;
                nearestStroke = s;
              }
            }
          } else {
            const b = getStrokeBounds(s);
            if (b) {
              const d = Math.hypot(b.centerX - tapX, b.centerY - tapY);
              if (d < nearestDist) {
                nearestDist = d;
                nearestStroke = s;
              }
            }
          }
        }

        // Also check if teacher tapped on an existing text box
        const hitText = (curr.texts || []).find(
          (t) => tapX >= t.x - 20 && tapX <= t.x + t.width + 20 && tapY >= t.y - 20 && tapY <= t.y + t.height + 20
        );
        if (hitText) {
          matchedTextIds.push(hitText.id);
          selMinX = hitText.x;
          selMaxX = hitText.x + hitText.width;
          selMinY = hitText.y;
          selMaxY = hitText.y + hitText.height;
        }

        if (nearestStroke) {
          // Cluster all strokes forming the same word/formula
          const cluster = [nearestStroke];
          const clusterIds = new Set([nearestStroke.id]);
          let added = true;
          while (added) {
            added = false;
            for (const s of curr.strokes) {
              if (clusterIds.has(s.id)) continue;
              const sBounds = getStrokeBounds(s);
              if (!sBounds) continue;
              const isNear = cluster.some((c) => {
                const cb = getStrokeBounds(c);
                if (!cb) return false;
                const dx = Math.max(0, Math.max(sBounds.minX - cb.maxX, cb.minX - sBounds.maxX));
                const dy = Math.max(0, Math.max(sBounds.minY - cb.maxY, cb.minY - sBounds.maxY));
                return dx < 48 && dy < 36;
              });
              if (isNear) {
                cluster.push(s);
                clusterIds.add(s.id);
                added = true;
              }
            }
          }
          matchedStrokeIds = Array.from(clusterIds);
          let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
          cluster.forEach((s) => {
            const b = getStrokeBounds(s);
            if (b) {
              bMinX = Math.min(bMinX, b.minX);
              bMaxX = Math.max(bMaxX, b.maxX);
              bMinY = Math.min(bMinY, b.minY);
              bMaxY = Math.max(bMaxY, b.maxY);
            }
          });
          selMinX = Math.max(0, bMinX - 16);
          selMaxX = bMaxX + 16;
          selMinY = Math.max(0, bMinY - 16);
          selMaxY = bMaxY + 16;
        }
      } else {
        // Case B: Hand/Finger or Stylus Drag Sweep -> Generous finger tolerance
        const margin = 28;
        const sweepLeft = minX - margin;
        const sweepRight = maxX + margin;
        const sweepTop = minY - margin;
        const sweepBottom = maxY + margin;

        const matchedStrokes = curr.strokes.filter((s) => {
          if (s.points && s.points.length > 0) {
            return s.points.some(
              (p) => p.x >= sweepLeft && p.x <= sweepRight && p.y >= sweepTop && p.y <= sweepBottom
            );
          }
          const bounds = getStrokeBounds(s);
          if (!bounds) return false;
          return (
            bounds.minX <= sweepRight &&
            bounds.maxX >= sweepLeft &&
            bounds.minY <= sweepBottom &&
            bounds.maxY >= sweepTop
          );
        });

        matchedStrokeIds = matchedStrokes.map((s) => s.id);

        matchedTextIds = (curr.texts || []).filter((t) => {
          const tRight = t.x + t.width;
          const tBottom = t.y + t.height;
          return t.x <= sweepRight && tRight >= sweepLeft && t.y <= sweepBottom && tBottom >= sweepTop;
        }).map((t) => t.id);

        if (matchedStrokes.length > 0) {
          let bMinX = minX, bMaxX = maxX, bMinY = minY, bMaxY = maxY;
          matchedStrokes.forEach((s) => {
            const b = getStrokeBounds(s);
            if (b) {
              bMinX = Math.min(bMinX, b.minX);
              bMaxX = Math.max(bMaxX, b.maxX);
              bMinY = Math.min(bMinY, b.minY);
              bMaxY = Math.max(bMaxY, b.maxY);
            }
          });
          // Bám sát nét bút (tight bounding box)
          selMinX = Math.max(0, bMinX - 8);
          selMaxX = bMaxX + 8;
          selMinY = Math.max(0, bMinY - 8);
          selMaxY = bMaxY + 8;
        }
      }

      if (matchedStrokeIds.length > 0 || matchedTextIds.length > 0) {
        const newBox = { minX: selMinX, minY: selMinY, maxX: selMaxX, maxY: selMaxY };
        setSweptSelection({
          box: newBox,
          strokeIds: matchedStrokeIds,
          textIds: matchedTextIds,
        });
        setRecognizedTextPreview(null);
        setCalligraphyStatusBanner(`✨ Đã chọn ${matchedStrokeIds.length > 0 ? `${matchedStrokeIds.length} nét chữ/công thức` : `${matchedTextIds.length} văn bản`}. Bấm nút nổi để chuyển đổi siêu tốc!`);

        // Tự động nhận diện chữ chạy ngầm siêu tốc (< 300ms) để sẵn sàng khi giáo viên bấm nút
        if (matchedStrokeIds.length > 0) {
          const selectedStrokes = curr.strokes.filter((s) => matchedStrokeIds.includes(s.id));
          const crop = cropCanvasRegion(canvasRef.current, newBox, selectedStrokes, boardScrollX, boardScrollY, 12);
          if (crop) {
            recognizeHandwritingFast(crop.dataUrl).then((text) => {
              if (text) setRecognizedTextPreview(text);
            }).catch(() => {});
          }
        }
      } else {
        setSweptSelection(null);
        setRecognizedTextPreview(null);
        setCalligraphyStatusBanner('💡 Chạm hoặc quét bao quanh vùng chữ/công thức cần chuyển đổi nhé!');
        setTimeout(() => setCalligraphyStatusBanner(null), 3000);
      }
      return;
    }

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

    const canvas = canvasRef.current;
    if (canvas && e) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    canvasRectRef.current = null;

    // Nối mượt mà đoạn cuối cùng đến chính xác vị trí nhấc bút
    const pLast = lastPointerPointRef.current;
    if (canvas && pLast && isFreehandStrokeTool(activeTool)) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.translate(-boardScrollX, -boardScrollY);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (activeTool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = strokeSize;
        } else {
          ctx.strokeStyle = activeColor;
          ctx.lineWidth = activeTool === 'highlighter' ? strokeSize * 2.5 : strokeSize;
          ctx.globalAlpha = activeTool === 'highlighter' ? 0.45 : 0.98;
        }
        if (lastMidPointRef.current && activePointsRef.current.length > 2) {
          ctx.beginPath();
          ctx.moveTo(lastMidPointRef.current.x, lastMidPointRef.current.y);
          ctx.lineTo(pLast.x, pLast.y);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    p0Ref.current = null;
    p1Ref.current = null;
    lastPointerPointRef.current = null;
    lastMidPointRef.current = null;

    const completedPoints = [...activePointsRef.current];
    activePointsRef.current = [];

    if (completedPoints.length > 0) {
      let finalPoints = completedPoints;
      // High-precision RDP curve smoothing to remove infrared jitter & redundant samples
      // Chỉ làm mượt RDP khi nét đủ dài (>= 5 điểm) để không làm suy biến nét chạm nhẹ, dấu chấm, dấu câu
      if (isFreehandStrokeTool(activeTool)) {
        finalPoints = completedPoints.length >= 5 ? simplifyPoints(completedPoints, 0.65) : completedPoints;
      }
      if (isFunctionGraphTool(activeTool) && completedPoints.length <= 2) {
        const p0 = completedPoints[0];
        const p1 = completedPoints[completedPoints.length - 1];
        const dx = Math.abs(p1.x - p0.x);
        const dy = Math.abs(p1.y - p0.y);
        if (dx < 50 && dy < 50) {
          finalPoints = [
            { x: p0.x - 190, y: p0.y - 140, pressure: 0.5 },
            { x: p0.x + 190, y: p0.y + 140, pressure: 0.5 },
          ];
        }
      }

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      finalPoints.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });

      // Bảo đảm bounding box có kích thước tối thiểu cho nét chấm / chạm nhẹ
      if (minX === maxX) {
        minX -= 3;
        maxX += 3;
      }
      if (minY === maxY) {
        minY -= 3;
        maxY += 3;
      }

      const initialVertices = computeDefaultVertices(activeTool, finalPoints);
      const tempStroke: WhiteboardStroke = {
        id: 'temp',
        points: finalPoints,
        color: activeColor,
        size: strokeSize,
        tool: activeTool,
        timestamp: Date.now(),
        rotation: 0,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
        scale: 1,
        graphScale: 1,
        graphOffsetX: 0,
        graphOffsetY: 0,
        customEquation: activeTool === 'func_custom_equation' ? equationInput : undefined,
        hatchPattern: activeTool === 'shape_curved_trapezoid_area' ? true : undefined,
        fillColor: (activeTool === 'shape_curved_trapezoid_area' || activeTool === 'shape_solid_revolution_volume') ? 'rgba(56, 189, 248, 0.25)' : undefined,
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
        pagesRef.current = updated;
        return updated;
      });

      // Track session strokes for instant 1-tap mobile calligraphy selection
      calligraphySessionStrokesRef.current.push(newStroke.id);

      // Automatically select function graphs so the user can easily zoom/scale and move them immediately
      if (isFunctionGraphTool(activeTool)) {
        setSelectedStrokeId(newStroke.id);
        setIsStrokeToolbarExpanded(false);
      }
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Nếu có điểm vẽ dở (kể cả chỉ 1 điểm chạm nhẹ), chuyển sang handlePointerUp để bảo toàn nét vẽ
    if (isDrawingRef.current && activePointsRef.current.length > 0) {
      handlePointerUp(e);
      return;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
    lastPointerPointRef.current = null;
    lastMidPointRef.current = null;
    isDrawingRef.current = false;
    activePointsRef.current = [];
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

      if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'y') {
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
      if (onOpenTemporaryLesson) {
        onOpenTemporaryLesson(newDoc);
      } else {
        onAddLesson?.(newDoc);
        onSelectLesson?.(newDoc.id);
      }
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
        return 'blackboard-bg border-[10px] md:border-[12px] border-[#3e2211] rounded-[24px] sm:rounded-[28px] md:rounded-[32px] shadow-[0_15px_45px_rgba(0,0,0,0.35),inset_0_2px_6px_rgba(0,0,0,0.5)]';
      case 'oli':
        return 'oli-grid-bg border-[10px] md:border-[12px] border-[#3e2211] rounded-[24px] sm:rounded-[28px] md:rounded-[32px] shadow-[0_15px_45px_rgba(0,0,0,0.35),inset_0_2px_6px_rgba(0,0,0,0.5)]';
      case 'lined':
        return 'lined-blackboard-bg border-[10px] md:border-[12px] border-[#3e2211] rounded-[24px] sm:rounded-[28px] md:rounded-[32px] shadow-[0_15px_45px_rgba(0,0,0,0.35),inset_0_2px_6px_rgba(0,0,0,0.5)]';
      case 'graph':
        return 'graph-paper-bg border-8 border-slate-800 rounded-3xl shadow-2xl';
      case 'slate':
        return 'slate-board-bg border-8 border-slate-900 rounded-3xl shadow-2xl';
      case 'navy':
        return 'navy-board-bg border-8 border-slate-900 rounded-3xl shadow-2xl';
      case 'wood':
        return 'wood-board-bg border-8 border-[#29180d] rounded-3xl shadow-2xl';
      case 'white':
        return 'whiteboard-clean-bg border-8 border-slate-300 rounded-3xl shadow-2xl text-slate-900';
      default:
        return 'blackboard-bg border-[10px] md:border-[12px] border-[#3e2211] rounded-[24px] sm:rounded-[28px] md:rounded-[32px] shadow-[0_15px_45px_rgba(0,0,0,0.35),inset_0_2px_6px_rgba(0,0,0,0.5)]';
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
          : 'h-full w-full min-h-[500px]'
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
        isMobile ? (
          <div className="absolute top-2 left-2 right-2 z-30 flex items-center justify-between pointer-events-none gap-1 animate-fade-in select-none">
            {/* Page navigation compact for phone */}
            <div className="flex items-center gap-1 pointer-events-auto bg-slate-950/90 backdrop-blur-md px-2 py-1 rounded-xl border border-white/20 text-white shadow-lg text-xs">
              <button
                onClick={() => setCurrentPageIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentPageIndex === 0}
                className="p-1 rounded-lg hover:bg-white/20 disabled:opacity-30 transition-colors cursor-pointer"
                title="Trang trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono font-bold text-[11px] px-1">
                {currentPageIndex + 1}/{pages.length}
              </span>
              <button
                onClick={() => setCurrentPageIndex((prev) => Math.min(pages.length - 1, prev + 1))}
                disabled={currentPageIndex === pages.length - 1}
                className="p-1 rounded-lg hover:bg-white/20 disabled:opacity-30 transition-colors cursor-pointer"
                title="Trang sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleAddNewPage}
                className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white ml-0.5 cursor-pointer"
                title="Thêm trang bảng mới"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick action buttons on mobile */}
            <div className="flex items-center gap-1 pointer-events-auto">
              {/* Document Modal */}
              <button
                onClick={() => setShowDocumentModal(true)}
                className="px-2.5 py-1 rounded-xl bg-indigo-600 text-white text-[11px] font-bold flex items-center gap-1 shadow cursor-pointer"
                title="Mở tài liệu"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Tài liệu</span>
              </button>

              {/* Mobile Fullscreen toggle */}
              <button
                onClick={() => setIsFullBoard((prev) => !prev)}
                className="p-1.5 rounded-xl bg-slate-900/90 text-white border border-white/20 hover:bg-slate-800 cursor-pointer"
                title={isFullBoard ? 'Thu nhỏ bảng' : 'Bảng toàn màn hình điện thoại'}
              >
                {isFullBoard ? <Minimize2 className="w-3.5 h-3.5 text-amber-300" /> : <Maximize2 className="w-3.5 h-3.5 text-emerald-300" />}
              </button>

              {/* Collapse Top Bar to free up canvas */}
              <button
                onClick={() => setIsTopBarCollapsed(true)}
                className="p-1.5 rounded-xl bg-slate-900/90 text-slate-300 border border-white/20 hover:text-white cursor-pointer"
                title="Thu gọn để viết rộng hơn"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
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

            {/* Quick Switch to Fast Whiteboard 120Hz */}
            {onSwitchToFastWhiteboard && (
              <button
                onClick={onSwitchToFastWhiteboard}
                className="px-2.5 py-1.5 rounded-2xl text-xs font-black flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 border border-amber-300 shadow-md transition-all active:scale-95 cursor-pointer"
                title="Chuyển sang Bảng Siêu Tốc 120Hz 4K Zero-Latency"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span className="hidden sm:inline">Bảng Siêu Tốc 120Hz</span>
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
        )
      )}

      {/* Floating Restore Pill when Top Bar is collapsed - Đúng chuẩn giao diện Ảnh 1 */}
      {(isTopBarCollapsed || isImmersiveMode) && (
        <div className="absolute top-3.5 right-4 z-30 pointer-events-auto animate-fade-in flex items-center gap-2">
          <button
            onClick={() => {
              setIsTopBarCollapsed(false);
              setIsImmersiveMode(false);
            }}
            className="px-3.5 py-1.5 rounded-full bg-slate-950/85 hover:bg-slate-900 text-emerald-400 border border-emerald-500/50 text-xs font-bold shadow-lg backdrop-blur-md flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95"
            title="Nhấp để hiển thị lại thanh điều khiển trên"
          >
            <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hiện Thanh Công Cụ</span>
          </button>

          <button
            onClick={() => setShowDocumentModal(true)}
            className="px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95"
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
          backgroundColor: bgTheme === 'blackboard' || bgTheme === 'oli' ? '#0c3323' : undefined,
          backgroundImage: bgTheme === 'blackboard'
            ? 'linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px), radial-gradient(ellipse at 50% 50%, rgba(14, 58, 39, 0.45) 0%, rgba(8, 36, 23, 0.95) 100%)'
            : bgTheme === 'oli'
            ? 'linear-gradient(to right, rgba(255, 255, 255, 0.16) 1.5px, transparent 1.5px), linear-gradient(to bottom, rgba(255, 255, 255, 0.16) 1.5px, transparent 1.5px), linear-gradient(to right, rgba(255, 255, 255, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.08) 1px, transparent 1px), radial-gradient(ellipse at 50% 50%, rgba(14, 58, 39, 0.55) 0%, rgba(8, 36, 23, 0.95) 100%)'
            : undefined,
          backgroundSize: bgTheme === 'blackboard'
            ? '50px 50px, 50px 50px, 100% 100%'
            : bgTheme === 'oli'
            ? '200px 200px, 200px 200px, 40px 40px, 40px 40px, 100% 100%'
            : undefined,
          backgroundPosition: bgTheme === 'blackboard'
            ? `${-boardScrollX}px ${-boardScrollY}px, ${-boardScrollX}px ${-boardScrollY}px, center center`
            : bgTheme === 'oli'
            ? `${-boardScrollX}px ${-boardScrollY}px, ${-boardScrollX}px ${-boardScrollY}px, ${-boardScrollX}px ${-boardScrollY}px, ${-boardScrollX}px ${-boardScrollY}px, center center`
            : undefined,
        }}
      >
        {/* Main Touch Drawing Canvas */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{
            ...getCanvasCursorStyle(),
            touchAction: 'none',
            userSelect: 'none',
            willChange: 'transform',
          }}
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

        {/* Floating Calligraphy Status / Indicator Banner - Gọn nhẹ, không che khuất bảng vẽ */}
        {(activeTool === 'calligraphy' || isConvertingCalligraphy || calligraphyStatusBanner) && !calligraphySweep && (
          isMobile ? (
            <div className="absolute top-2 left-2 right-2 z-30 flex flex-col gap-1.5 p-2 bg-slate-950/95 backdrop-blur-md border border-purple-500/50 rounded-2xl text-white shadow-2xl pointer-events-auto">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0 animate-pulse" />
                  <span className="truncate text-purple-200 font-bold text-[11px]">
                    {calligraphyStatusBanner || (sweptSelection ? `Đã chọn ${sweptSelection.strokeIds.length} nét chữ` : 'Chế độ Chuyển Chữ Đẹp')}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {lastConvertedInfo && (
                    <button
                      onClick={handleUndoCalligraphy}
                      className="px-2 py-0.5 bg-rose-600/80 hover:bg-rose-500 rounded-lg text-[10px] font-bold text-white transition-all shadow flex items-center gap-1 cursor-pointer"
                      title="Khôi phục lại nét vẽ phấn tay ban đầu"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Hoàn tác</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setCalligraphyStatusBanner(null);
                      setSweptSelection(null);
                      handleToolChange('pen');
                    }}
                    className="p-1 text-slate-400 hover:text-white"
                    title="Đóng chế độ chữ đẹp"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Mobile Quick Action Selectors */}
              <div className="flex items-center gap-1.5 pt-0.5 border-t border-purple-500/30">
                <button
                  type="button"
                  onClick={handleSelectRecentStrokes}
                  className="flex-1 py-1 px-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/40 text-[10px] font-black text-purple-200 flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>Chọn nét vừa viết</span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllStrokes}
                  className="py-1 px-2.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/40 text-[10px] font-black text-indigo-200 flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                >
                  <span>Chọn cả bảng</span>
                </button>
                {sweptSelection && (
                  <button
                    type="button"
                    onClick={() => handleConvertHandwritingToCalligraphy()}
                    disabled={isConvertingCalligraphy}
                    className="py-1 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white font-black text-[10.5px] shadow flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Wand2 className="w-3 h-3 text-amber-300" />
                    <span>{isConvertingCalligraphy ? 'Đang chuyển...' : 'Chuyển Ngay'}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 max-w-[85vw] flex items-center gap-2.5 px-4 py-2 bg-slate-900/95 backdrop-blur-md border border-purple-500/50 shadow-2xl rounded-2xl md:rounded-full text-white text-xs font-semibold whitespace-nowrap overflow-hidden pointer-events-auto animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-1.5 text-purple-300 shrink-0">
                <Feather className="w-4 h-4 text-purple-300" />
                {isConvertingCalligraphy ? (
                  <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                )}
              </div>
              <span className="text-slate-200 truncate">
                {calligraphyStatusBanner || (
                  <>
                    Chế độ <strong className="text-purple-300">Quét Chữ Đẹp</strong>: Kéo quét bao quanh vùng chữ trên bảng, sau đó bấm chọn để chuyển đổi siêu tốc!
                  </>
                )}
              </span>
              {lastConvertedInfo && (
                <button
                  onClick={handleUndoCalligraphy}
                  className="ml-1 px-2.5 py-1 bg-rose-600/80 hover:bg-rose-500 rounded-full text-[10.5px] font-bold text-white transition-all shadow flex items-center gap-1 cursor-pointer shrink-0"
                  title="Khôi phục lại nét vẽ phấn tay ban đầu"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Hoàn tác phấn</span>
                </button>
              )}
              <button
                onClick={() => handleConvertHandwritingToCalligraphy()}
                disabled={isConvertingCalligraphy}
                className="ml-1 px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 rounded-full text-[10.5px] font-bold text-white transition-all shadow flex items-center gap-1 cursor-pointer disabled:opacity-50 ring-1 ring-purple-400/50 shrink-0"
              >
                <Wand2 className="w-3 h-3 text-amber-300" />
                <span>{sweptSelection ? 'Bấm chọn chuyển ngay' : 'Chuyển chữ đẹp'}</span>
              </button>
            </div>
          )
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
                {onSaveToLibrary && currentLesson && !isSavedInLibrary && (
                  <button
                    onClick={() => {
                      onSaveToLibrary(currentLesson);
                    }}
                    title="Lưu bài giảng này vào Kho Bài Giảng"
                    className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <BookmarkPlus className="w-3 h-3" />
                    <span className="hidden sm:inline">Lưu Vào Kho</span>
                  </button>
                )}

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

        {/* Live Calligraphy Sweep Preview (Yêu cầu 1: Khung chữ nhật nét đứt động, bám sát tọa độ quét, mờ đi ở ngoài vùng chọn, KHÔNG có popup chữ che khuất) */}
        {calligraphySweep && (
          <div
            className="absolute pointer-events-none border-2 border-dashed border-purple-400 z-50 transition-none"
            style={{
              left: `${Math.min(calligraphySweep.startX, calligraphySweep.curX) - boardScrollX}px`,
              top: `${Math.min(calligraphySweep.startY, calligraphySweep.curY) - boardScrollY}px`,
              width: `${Math.abs(calligraphySweep.curX - calligraphySweep.startX)}px`,
              height: `${Math.abs(calligraphySweep.curY - calligraphySweep.startY)}px`,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
              backgroundColor: 'transparent',
            }}
          />
        )}

        {/* Swept Selection Highlight & Floating Selection Toolbar (Thanh công cụ nổi tím trên vùng chữ) */}
        {sweptSelection && (
          <FloatingSelectionToolbar
            sweptSelection={sweptSelection}
            boardScrollX={boardScrollX}
            boardScrollY={boardScrollY}
            isMobile={isMobile}
            calligraphyFont={calligraphyFont}
            setCalligraphyFont={setCalligraphyFont}
            isConvertingCalligraphy={isConvertingCalligraphy}
            onConvert={() => handleConvertHandwritingToCalligraphy()}
            isSpeakingTTS={isSpeakingTTS}
            ttsVoicePreset={ttsVoicePreset}
            setTtsVoicePreset={setTtsVoicePreset}
            onSpeak={(preset) => handleSpeakSweptContent(preset)}
            onStopTTS={handleStopTTS}
            onClose={() => {
              setSweptSelection(null);
              setRecognizedTextPreview(null);
            }}
            recognizedTextPreview={recognizedTextPreview}
          />
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

          // Render Condensed Rotation Button & Popover
          const renderRotateControl = () => (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRotateDropdown((prev) => !prev);
                  setShowColorPickerDropdown(false);
                }}
                className={`px-2 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  showRotateDropdown
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                    : 'bg-white/10 hover:bg-white/20 text-amber-300'
                }`}
                title="Bấm để mở bảng xoay hình"
              >
                <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                <span>Xoay hình</span>
                {Math.round(currentRotation) !== 0 && (
                  <span className="text-[10px] font-mono text-amber-200 bg-amber-950/70 px-1 py-0.5 rounded">
                    {Math.round(currentRotation)}°
                  </span>
                )}
                <ChevronDown className={`w-3 h-3 transition-transform ${showRotateDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Xoay hình popover */}
              {showRotateDropdown && (
                <div
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-950/98 backdrop-blur-md p-2.5 rounded-2xl border-2 border-amber-400/90 shadow-2xl z-50 flex flex-col gap-2 min-w-[220px]"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-amber-300 pb-1 border-b border-white/10">
                    <span className="flex items-center gap-1">
                      <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                      Góc xoay hình:
                    </span>
                    <span className="font-mono text-amber-200 bg-amber-900/60 px-1.5 py-0.5 rounded text-[11px]">
                      {Math.round(currentRotation)}°
                    </span>
                  </div>

                  {/* Rotation slider */}
                  <div className="flex items-center gap-2 px-1">
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="5"
                      value={Math.round(((currentRotation % 360) + 360) % 360)}
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
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                  </div>

                  {/* Preset angle buttons */}
                  <div className="grid grid-cols-4 gap-1 pt-1">
                    {[
                      { label: '0°', angle: 0 },
                      { label: '45°', angle: 45 },
                      { label: '90°', angle: 90 },
                      { label: '180°', angle: 180 },
                    ].map((p) => (
                      <button
                        key={p.label}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPages((prev) => {
                            const updated = [...prev];
                            const curr = updated[currentPageIndex];
                            if (!curr) return prev;
                            const newStrokes = curr.strokes.map((s) =>
                              s.id === selectedStroke.id ? { ...s, rotation: p.angle } : s
                            );
                            updated[currentPageIndex] = { ...curr, strokes: newStrokes };
                            return updated;
                          });
                        }}
                        className="px-1.5 py-1 bg-white/10 hover:bg-amber-500/40 rounded-lg text-amber-200 text-[10.5px] font-bold text-center transition-colors"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-1 pt-0.5">
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
                      className="flex-1 py-1 bg-white/10 hover:bg-amber-500/30 rounded-lg text-amber-200 text-[10.5px] font-bold"
                      title="Xoay ngược chiều 15°"
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
                      className="flex-1 py-1 bg-white/10 hover:bg-amber-500/30 rounded-lg text-amber-200 text-[10.5px] font-bold"
                      title="Xoay thuận chiều 15°"
                    >
                      +15°
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowRotateDropdown(false);
                      }}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              )}
            </div>
          );

          // Render Condensed Color Picker Button & Popover
          const renderColorPickerControl = () => (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowColorPickerDropdown((prev) => !prev);
                  setShowRotateDropdown(false);
                }}
                className={`px-2 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  showColorPickerDropdown
                    ? 'bg-white text-slate-950 shadow-md'
                    : 'bg-white/10 hover:bg-white/20 text-slate-200'
                }`}
                title="Bấm để chọn màu sắc nét vẽ (Mặc định: Màu Trắng)"
              >
                <div
                  className="w-3.5 h-3.5 rounded-full border border-white/80 shadow-xs shrink-0"
                  style={{ backgroundColor: selectedStroke.color || '#ffffff' }}
                />
                <span className="text-[11px]">Màu</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showColorPickerDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Color palette popover */}
              {showColorPickerDropdown && (
                <div
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-950/98 backdrop-blur-md p-2.5 rounded-2xl border-2 border-cyan-400/90 shadow-2xl z-50 flex flex-col gap-2 min-w-[210px]"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-200 pb-1 border-b border-white/10">
                    <span>Bảng màu phấn:</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowColorPickerDropdown(false);
                      }}
                      className="text-[10px] text-slate-400 hover:text-white px-1"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5 py-1">
                    {chalkPalette.map((cp) => (
                      <button
                        key={cp.value}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPages((prev) => {
                            const updated = [...prev];
                            const curr = updated[currentPageIndex];
                            if (!curr) return prev;
                            const newStrokes = curr.strokes.map((s) =>
                              s.id === selectedStroke.id ? { ...s, color: cp.value } : s
                            );
                            updated[currentPageIndex] = { ...curr, strokes: newStrokes };
                            return updated;
                          });
                          setShowColorPickerDropdown(false);
                        }}
                        className={`w-6 h-6 rounded-full border transition-transform flex items-center justify-center ${
                          (selectedStroke.color || '#ffffff') === cp.value
                            ? 'border-white scale-115 ring-2 ring-cyan-400'
                            : 'border-transparent hover:scale-110'
                        }`}
                        style={{ backgroundColor: cp.value }}
                        title={cp.label}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );

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
                    centerX: bounds?.centerX ?? 0,
                    centerY: bounds?.centerY ?? 0,
                    origRotation: selectedStroke.rotation || 0,
                  };
                }}
                onPointerMove={(e) => {
                  if (!isDraggingStroke || !dragStrokeStartRef.current || !selectedStrokeId) return;
                  e.stopPropagation();
                  const startData = dragStrokeStartRef.current;
                  if (!startData) return;
                  const deltaX = e.clientX - startData.startMouseX;
                  const deltaY = e.clientY - startData.startMouseY;
                  const origPts = startData.origPoints;
                  const origVerts = startData.origVertices;
                  const origCenterX = startData.centerX ?? 0;
                  const origCenterY = startData.centerY ?? 0;

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
                  if (strokeRafRef.current) cancelAnimationFrame(strokeRafRef.current);
                  setIsDraggingStroke(false);
                  dragStrokeStartRef.current = null;
                }}
                onPointerCancel={(e) => {
                  e.stopPropagation();
                  try {
                    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                  } catch (_) {}
                  if (strokeRafRef.current) cancelAnimationFrame(strokeRafRef.current);
                  setIsDraggingStroke(false);
                  dragStrokeStartRef.current = null;
                }}
                onWheel={(e) => {
                  if (isFunctionGraphTool(selectedStroke.tool)) {
                    e.stopPropagation();
                    const zoomDelta = e.deltaY < 0 ? 0.1 : -0.1;
                    handleZoomGraph(selectedStroke.id, zoomDelta);
                  }
                }}
                className="absolute inset-0 cursor-move pointer-events-auto bg-cyan-400/10 hover:bg-cyan-400/20 active:bg-cyan-400/30 rounded-2xl transition-colors border-2 border-cyan-400/40 touch-none select-none flex items-center justify-center group"
                title={
                  isFunctionGraphTool(selectedStroke.tool)
                    ? 'Kéo di chuyển • Cuộn chuột để phóng to/thu nhỏ hệ trục • Dùng thanh công cụ để chỉnh gốc'
                    : 'Chạm và kéo để di chuyển hình mượt mà (hoặc dùng 4 nút điều hướng / phím mũi tên)'
                }
              >
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/85 px-2.5 py-1 rounded-full text-cyan-300 text-[11px] font-bold shadow-lg flex items-center gap-1.5 pointer-events-none">
                  <Move className="w-3.5 h-3.5" />
                  {isFunctionGraphTool(selectedStroke.tool) ? 'Kéo đồ thị • Cuộn để zoom trục' : 'Kéo di chuyển hình'}
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
                  onPointerMove={handleShapeResizePointerMove}
                  onPointerUp={handleShapeResizePointerUp}
                  onPointerCancel={handleShapeResizePointerUp}
                  className="absolute -top-2.5 -left-2.5 w-5 h-5 bg-white border-2 border-cyan-500 rounded-full shadow-lg cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center z-30 touch-none"
                  title="Kéo góc trên-trái để mở rộng / thu nhỏ"
                >
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                </div>
                <div
                  onPointerDown={(e) => handleShapeResizePointerDown(e, 'ne')}
                  onPointerMove={handleShapeResizePointerMove}
                  onPointerUp={handleShapeResizePointerUp}
                  onPointerCancel={handleShapeResizePointerUp}
                  className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-white border-2 border-cyan-500 rounded-full shadow-lg cursor-nesw-resize pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center z-30 touch-none"
                  title="Kéo góc trên-phải để mở rộng / thu nhỏ"
                >
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                </div>
                <div
                  onPointerDown={(e) => handleShapeResizePointerDown(e, 'sw')}
                  onPointerMove={handleShapeResizePointerMove}
                  onPointerUp={handleShapeResizePointerUp}
                  onPointerCancel={handleShapeResizePointerUp}
                  className="absolute -bottom-2.5 -left-2.5 w-5 h-5 bg-white border-2 border-cyan-500 rounded-full shadow-lg cursor-nesw-resize pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center z-30 touch-none"
                  title="Kéo góc dưới-trái để mở rộng / thu nhỏ"
                >
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                </div>
                <div
                  onPointerDown={(e) => handleShapeResizePointerDown(e, 'se')}
                  onPointerMove={handleShapeResizePointerMove}
                  onPointerUp={handleShapeResizePointerUp}
                  onPointerCancel={handleShapeResizePointerUp}
                  className="absolute -bottom-2.5 -right-2.5 w-5 h-5 bg-white border-2 border-cyan-500 rounded-full shadow-lg cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center z-30 touch-none"
                  title="Kéo góc dưới-phải để mở rộng / thu nhỏ"
                >
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                </div>

                {/* 4 Active Draggable Edge Handles for Expanding Graph in Specific Directions */}
                <div
                  onPointerDown={(e) => handleShapeResizePointerDown(e, 'n')}
                  onPointerMove={handleShapeResizePointerMove}
                  onPointerUp={handleShapeResizePointerUp}
                  onPointerCancel={handleShapeResizePointerUp}
                  className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-3 bg-white border-2 border-cyan-500 rounded-full shadow-lg cursor-ns-resize pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center z-30 touch-none"
                  title="Kéo cạnh trên để mở rộng trục Oy lên trên"
                >
                  <div className="w-2.5 h-0.5 bg-cyan-600 rounded-full" />
                </div>
                <div
                  onPointerDown={(e) => handleShapeResizePointerDown(e, 's')}
                  onPointerMove={handleShapeResizePointerMove}
                  onPointerUp={handleShapeResizePointerUp}
                  onPointerCancel={handleShapeResizePointerUp}
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-3 bg-white border-2 border-cyan-500 rounded-full shadow-lg cursor-ns-resize pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center z-30 touch-none"
                  title="Kéo cạnh dưới để mở rộng trục Oy xuống dưới"
                >
                  <div className="w-2.5 h-0.5 bg-cyan-600 rounded-full" />
                </div>
                <div
                  onPointerDown={(e) => handleShapeResizePointerDown(e, 'w')}
                  onPointerMove={handleShapeResizePointerMove}
                  onPointerUp={handleShapeResizePointerUp}
                  onPointerCancel={handleShapeResizePointerUp}
                  className="absolute top-1/2 -left-2 -translate-y-1/2 w-3 h-6 bg-white border-2 border-cyan-500 rounded-full shadow-lg cursor-ew-resize pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center z-30 touch-none"
                  title="Kéo cạnh trái để mở rộng trục Ox sang trái"
                >
                  <div className="w-0.5 h-2.5 bg-cyan-600 rounded-full" />
                </div>
                <div
                  onPointerDown={(e) => handleShapeResizePointerDown(e, 'e')}
                  onPointerMove={handleShapeResizePointerMove}
                  onPointerUp={handleShapeResizePointerUp}
                  onPointerCancel={handleShapeResizePointerUp}
                  className="absolute top-1/2 -right-2 -translate-y-1/2 w-3 h-6 bg-white border-2 border-cyan-500 rounded-full shadow-lg cursor-ew-resize pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center z-30 touch-none"
                  title="Kéo cạnh phải để mở rộng trục Ox sang phải"
                >
                  <div className="w-0.5 h-2.5 bg-cyan-600 rounded-full" />
                </div>

                {/* Function Graph expansion helper badge */}
                {isFunctionGraphTool(selectedStroke.tool) && (
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-950/90 text-cyan-300 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-cyan-400/60 shadow-lg pointer-events-none whitespace-nowrap">
                    Kéo các cạnh/góc để thấy thêm đồ thị • Kéo giữa để di chuyển
                  </div>
                )}

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

                  {/* Mục Xoay hình gom gọn */}
                  {renderRotateControl()}

                  {/* Mục Bảng màu gom gọn (mặc định trắng) */}
                  {renderColorPickerControl()}

                  {/* Mini Scale */}
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
                      className="p-1 hover:bg-white/20 rounded-md text-slate-300"
                      title="Thu nhỏ hình"
                    >
                      <ZoomOut className="w-3 h-3" />
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
                      className="p-1 hover:bg-white/20 rounded-md text-slate-300"
                      title="Phóng to hình"
                    >
                      <ZoomIn className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Mini Graph Zoom in Compact Toolbar */}
                  {isFunctionGraphTool(selectedStroke.tool) && (
                    <div className="flex items-center gap-1 bg-amber-500/20 px-2 py-0.5 rounded-xl border border-amber-400/40">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleZoomGraph(selectedStroke.id, -0.15);
                        }}
                        className="p-1 hover:bg-white/20 rounded-md text-amber-200"
                        title="Thu nhỏ hệ trục Ox / Oy"
                      >
                        <ZoomOut className="w-3 h-3" />
                      </button>
                      <span className="text-[10px] font-mono font-bold text-amber-300">
                        Trục: {Math.round((selectedStroke.graphScale || 1.0) * 100)}%
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleZoomGraph(selectedStroke.id, 0.15);
                        }}
                        className="p-1 hover:bg-white/20 rounded-md text-amber-200"
                        title="Phóng to hệ trục Ox / Oy"
                      >
                        <ZoomIn className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Chuyển hóa nét vẽ thành chữ đẹp AI */}
                  {selectedStroke.points && selectedStroke.points.length > 2 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        convertSelectedStrokeToCalligraphy(selectedStroke);
                      }}
                      disabled={isConvertingCalligraphy}
                      className="flex items-center gap-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white px-2 py-1 rounded-xl text-xs font-bold shadow transition-all cursor-pointer disabled:opacity-50"
                      title="Chuyển nét vẽ này thành phông chữ viết tay tuyệt đẹp"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                      <span>{isConvertingCalligraphy ? 'Đang chuyển...' : 'Chữ Đẹp'}</span>
                    </button>
                  )}

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
                      setShowRotateDropdown(false);
                      setShowColorPickerDropdown(false);
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
                      setShowRotateDropdown(false);
                      setShowColorPickerDropdown(false);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-200 hover:text-white font-bold text-[11px] flex items-center gap-1.5 border border-cyan-400/50 transition-all cursor-pointer shadow-xs"
                    title="Bấm để mở công cụ chi tiết (dời trục Ox/Oy, bước nhảy di chuyển, sửa công thức)"
                  >
                    <Sliders className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Chi tiết ▾</span>
                  </button>

                  {/* Close button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedStrokeId(null);
                      setShowRotateDropdown(false);
                      setShowColorPickerDropdown(false);
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
                      setShowRotateDropdown(false);
                      setShowColorPickerDropdown(false);
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
                    X:{Math.round(bounds?.centerX ?? 0)} Y:{Math.round(bounds?.centerY ?? 0)}
                  </span>
                </div>

                <div className="h-5 w-px bg-white/20 mx-1" />

                {/* Xoay hình gom gọn */}
                {renderRotateControl()}

                <div className="h-5 w-px bg-white/20 mx-1" />

                {/* Bảng màu gom gọn (mặc định trắng) */}
                {renderColorPickerControl()}


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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPages((prev) => {
                        const updated = [...prev];
                        const curr = updated[currentPageIndex];
                        if (!curr) return prev;
                        const newStrokes = curr.strokes.map((s) =>
                          s.id === selectedStroke.id ? { ...s, scale: 1.0 } : s
                        );
                        updated[currentPageIndex] = { ...curr, strokes: newStrokes };
                        return updated;
                      });
                    }}
                    className="px-1.5 py-0.5 bg-cyan-500/30 hover:bg-cyan-500/50 rounded text-[9.5px] font-bold text-cyan-200"
                    title="Đặt lại kích thước chuẩn (100%)"
                  >
                    100%
                  </button>
                </div>

                {/* Specialized Math & Physics Graph Controls */}
                {isFunctionGraphTool(selectedStroke.tool) && (
                  <>
                    <div className="h-5 w-px bg-white/20 mx-1" />

                    {/* Ox / Oy Axes Zoom */}
                    <div className="flex items-center gap-1 bg-amber-500/15 border border-amber-400/40 px-2 py-0.5 rounded-xl">
                      <span className="text-[10px] font-bold text-amber-300 mr-0.5">Trục:</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleZoomGraph(selectedStroke.id, -0.15);
                        }}
                        className="p-1 hover:bg-white/20 rounded-lg text-amber-200 cursor-pointer"
                        title="Thu nhỏ hệ trục tọa độ Ox / Oy"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] font-mono text-amber-300 font-bold min-w-[32px] text-center">
                        {Math.round((selectedStroke.graphScale || 1.0) * 100)}%
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleZoomGraph(selectedStroke.id, 0.15);
                        }}
                        className="p-1 hover:bg-white/20 rounded-lg text-amber-200 cursor-pointer"
                        title="Phóng to hệ trục tọa độ Ox / Oy"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleZoomGraph(selectedStroke.id, 1.0 - (selectedStroke.graphScale || 1.0));
                        }}
                        className="px-1.5 py-0.5 bg-amber-500/30 hover:bg-amber-500/50 rounded text-[9.5px] font-bold text-amber-200 cursor-pointer"
                        title="Đặt lại zoom trục 100%"
                      >
                        100%
                      </button>
                    </div>

                    {/* Ox / Oy Axes Pan (Dời trục) */}
                    <div className="flex items-center gap-0.5 bg-cyan-500/15 border border-cyan-400/40 px-2 py-0.5 rounded-xl">
                      <span className="text-[10px] font-bold text-cyan-300 mr-1">Dời trục:</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePanGraph(selectedStroke.id, -20, 0);
                        }}
                        className="p-1 hover:bg-white/20 rounded text-cyan-200 cursor-pointer"
                        title="Dời trục Ox sang trái"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePanGraph(selectedStroke.id, 0, -20);
                        }}
                        className="p-1 hover:bg-white/20 rounded text-cyan-200 cursor-pointer"
                        title="Dời trục Oy lên trên"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePanGraph(selectedStroke.id, 0, 20);
                        }}
                        className="p-1 hover:bg-white/20 rounded text-cyan-200 cursor-pointer"
                        title="Dời trục Oy xuống dưới"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePanGraph(selectedStroke.id, 20, 0);
                        }}
                        className="p-1 hover:bg-white/20 rounded text-cyan-200 cursor-pointer"
                        title="Dời trục Ox sang phải"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResetGraphOrigin(selectedStroke.id);
                        }}
                        className="px-1.5 py-0.5 bg-cyan-500/30 hover:bg-cyan-500/50 rounded text-[9.5px] font-bold text-cyan-200 ml-0.5 cursor-pointer"
                        title="Đặt lại gốc tọa độ O(0,0) về chính giữa"
                      >
                        🎯 Gốc
                      </button>
                    </div>

                    {/* Hatch Pattern Toggle for Curved Trapezoid / Solid of Revolution */}
                    {(selectedStroke.tool === 'shape_curved_trapezoid_area' ||
                      selectedStroke.tool === 'shape_solid_revolution_volume') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleHatch(selectedStroke.id);
                        }}
                        className="px-2 py-1 bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-400/50 rounded-xl text-emerald-200 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Chuyển đổi tô sọc chéo chuẩn SGK hoặc tô màu mịn"
                      >
                        <Layers className="w-3.5 h-3.5 text-emerald-300" />
                        <span>{selectedStroke.hatchPattern !== false ? 'Tô Sọc Chéo' : 'Tô Màu Mịn'}</span>
                      </button>
                    )}

                    {/* Edit Custom Equation Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingEquationStrokeId(selectedStroke.id);
                        setEquationInput(selectedStroke.customEquation || 'y = 2x^3-3x+1');
                        setShowEquationModal(true);
                      }}
                      className="px-2.5 py-1 bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/50 rounded-xl text-amber-200 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                      title="Sửa công thức toán học hoặc phương trình dao động vật lý"
                    >
                      <Pencil className="w-3.5 h-3.5 text-amber-300" />
                      <span>Sửa Công Thức</span>
                    </button>
                  </>
                )}

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
              {onSaveToLibrary && currentLesson && !isSavedInLibrary && (
                <button
                  onClick={() => {
                    onSaveToLibrary(currentLesson);
                  }}
                  title="Lưu bài giảng này vào Kho Bài Giảng"
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  <span>Lưu Vào Kho</span>
                </button>
              )}

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

      {/* MOBILE PHONE CHALK DOCK (< 768px) */}
      {isMobile ? (
        isMobileChalkDockMinimized ? (
          <button
            onClick={() => setIsMobileChalkDockMinimized(false)}
            className={`absolute ${isFullBoard ? 'bottom-4' : 'bottom-[74px]'} right-4 z-40 p-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xl border-2 border-white flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-all`}
            title="Mở thanh bút phấn"
          >
            <Pen className="w-5 h-5 text-white" />
          </button>
        ) : (
        <div className={`absolute ${isFullBoard || (isMobile && isLandscape) ? 'bottom-2' : 'bottom-[74px]'} left-1/2 -translate-x-1/2 z-40 pointer-events-auto ${isLandscape ? 'w-[98vw] max-w-[620px]' : 'w-[96vw] max-w-[440px]'} flex flex-col items-center gap-1.5 animate-in slide-in-from-bottom-2 select-none transition-all duration-200`}>
          {/* Sub-sheet: Mobile Function Graph Picker (Toán & Vật lý) */}
          {showFunctionPicker && (
            <div
              className={`w-full bg-slate-900/98 backdrop-blur-2xl border-2 border-amber-500/80 rounded-2xl p-3 shadow-2xl text-white flex flex-col gap-2.5 animate-in fade-in ${
                isLandscape ? 'max-h-[82vh]' : 'max-h-[72vh]'
              } overflow-y-auto custom-scrollbar`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
                <span className="text-xs font-black uppercase text-amber-300 tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  Đồ Thị Hàm Số Toán Học & Vật Lý
                </span>
                <button
                  onClick={() => setShowFunctionPicker(false)}
                  className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Custom Equation Formula Input Button */}
              <button
                onClick={() => {
                  setEditingEquationStrokeId(null);
                  setShowEquationModal(true);
                  setShowFunctionPicker(false);
                }}
                className="w-full p-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black shadow-md flex items-center justify-between transition-transform active:scale-98 cursor-pointer shrink-0"
              >
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-slate-950" />
                  <span className="text-xs font-black">TỰ NHẬP CÔNG THỨC y = f(x) / x(t)</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950/20 font-bold">Mở Bảng →</span>
              </button>

              {/* 1. Hàm Bậc Nhất & Bậc Hai */}
              <div>
                <span className="text-[10px] font-black uppercase text-amber-300 mb-1 block">
                  1. Bậc Nhất & Bậc Hai (Parabol)
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => {
                      setActiveTool('func_linear');
                      setShowFunctionPicker(false);
                    }}
                    className={`p-2 rounded-xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                      activeTool === 'func_linear'
                        ? 'bg-amber-500 text-slate-950 font-black border-amber-300'
                        : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                    }`}
                  >
                    <span className="font-mono font-bold text-[11px] text-amber-300">y = ax + b</span>
                    <span className="text-[9px] text-slate-300">Đường Thẳng</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTool('func_quadratic_up');
                      setShowFunctionPicker(false);
                    }}
                    className={`p-2 rounded-xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                      activeTool === 'func_quadratic_up'
                        ? 'bg-amber-500 text-slate-950 font-black border-amber-300'
                        : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                    }`}
                  >
                    <span className="font-mono font-bold text-[11px] text-emerald-300">y = ax² (a&gt;0)</span>
                    <span className="text-[9px] text-slate-300">Parabol Lõm Lên</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTool('func_quadratic_down');
                      setShowFunctionPicker(false);
                    }}
                    className={`p-2 rounded-xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                      activeTool === 'func_quadratic_down'
                        ? 'bg-amber-500 text-slate-950 font-black border-amber-300'
                        : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                    }`}
                  >
                    <span className="font-mono font-bold text-[11px] text-rose-300">y = ax² (a&lt;0)</span>
                    <span className="text-[9px] text-slate-300">Parabol Lõm Xuống</span>
                  </button>
                </div>
              </div>

              {/* 2. Hàm Bậc Ba */}
              <div>
                <span className="text-[10px] font-black uppercase text-amber-300 mb-1 block">
                  2. Hàm Bậc Ba (SGK Chuẩn)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  <button
                    onClick={() => {
                      setActiveTool('func_cubic_2extrema_pos');
                      setShowFunctionPicker(false);
                    }}
                    className="p-2 rounded-xl text-xs flex flex-col items-center gap-0.5 border bg-white/5 hover:bg-white/15 text-slate-200 border-white/10"
                  >
                    <span className="font-mono font-bold text-[11px] text-indigo-300">a &gt; 0 (2 Cực trị)</span>
                    <span className="text-[9px] text-slate-300">Dạng chữ N chuẩn</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTool('func_cubic_2extrema_neg');
                      setShowFunctionPicker(false);
                    }}
                    className="p-2 rounded-xl text-xs flex flex-col items-center gap-0.5 border bg-white/5 hover:bg-white/15 text-slate-200 border-white/10"
                  >
                    <span className="font-mono font-bold text-[11px] text-rose-300">a &lt; 0 (2 Cực trị)</span>
                    <span className="text-[9px] text-slate-300">Chữ N ngược</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTool('func_cubic_noextrema_pos');
                      setShowFunctionPicker(false);
                    }}
                    className="p-2 rounded-xl text-xs flex flex-col items-center gap-0.5 border bg-white/5 hover:bg-white/15 text-slate-200 border-white/10"
                  >
                    <span className="font-mono font-bold text-[11px] text-emerald-300">Đơn điệu tăng</span>
                    <span className="text-[9px] text-slate-300">Không có cực trị</span>
                  </button>
                </div>
              </div>

              {/* 3. Hàm Trùng Phương Bậc 4 */}
              <div>
                <span className="text-[10px] font-black uppercase text-amber-300 mb-1 block">
                  3. Hàm Trùng Phương (Bậc 4)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    onClick={() => {
                      setActiveTool('func_biquadratic_3extrema_pos');
                      setShowFunctionPicker(false);
                    }}
                    className="p-2 rounded-xl text-xs flex flex-col items-center gap-0.5 border bg-white/5 hover:bg-white/15 text-slate-200 border-white/10"
                  >
                    <span className="font-mono font-bold text-[10.5px] text-amber-300">3 Cực trị (W)</span>
                    <span className="text-[9px] text-slate-300">a &gt; 0, ab &lt; 0</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTool('func_biquadratic_3extrema_neg');
                      setShowFunctionPicker(false);
                    }}
                    className="p-2 rounded-xl text-xs flex flex-col items-center gap-0.5 border bg-white/5 hover:bg-white/15 text-slate-200 border-white/10"
                  >
                    <span className="font-mono font-bold text-[10.5px] text-rose-300">3 Cực trị (M)</span>
                    <span className="text-[9px] text-slate-300">a &lt; 0, ab &lt; 0</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTool('func_biquadratic_1extremum_pos');
                      setShowFunctionPicker(false);
                    }}
                    className="p-2 rounded-xl text-xs flex flex-col items-center gap-0.5 border bg-white/5 hover:bg-white/15 text-slate-200 border-white/10"
                  >
                    <span className="font-mono font-bold text-[10.5px] text-emerald-300">1 Cực trị (U)</span>
                    <span className="text-[9px] text-slate-300">a &gt; 0, ab ≥ 0</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTool('func_biquadratic_1extremum_neg');
                      setShowFunctionPicker(false);
                    }}
                    className="p-2 rounded-xl text-xs flex flex-col items-center gap-0.5 border bg-white/5 hover:bg-white/15 text-slate-200 border-white/10"
                  >
                    <span className="font-mono font-bold text-[10.5px] text-pink-300">1 Cực trị (∩)</span>
                    <span className="text-[9px] text-slate-300">a &lt; 0, ab ≥ 0</span>
                  </button>
                </div>
              </div>

              {/* 4. Hàm Phân Thức & Hàm Mũ / Logarit */}
              <div>
                <span className="text-[10px] font-black uppercase text-amber-300 mb-1 block">
                  4. Phân Thức & Mũ / Logarit
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    onClick={() => {
                      setActiveTool('func_rational_pos');
                      setShowFunctionPicker(false);
                    }}
                    className="p-2 rounded-xl text-xs flex flex-col items-center gap-0.5 border bg-white/5 hover:bg-white/15 text-slate-200 border-white/10"
                  >
                    <span className="font-mono font-bold text-[10.5px] text-sky-300">(ax+b)/(cx+d)</span>
                    <span className="text-[9px] text-slate-300">Nhất biến (Đồng biến)</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTool('func_rational_neg');
                      setShowFunctionPicker(false);
                    }}
                    className="p-2 rounded-xl text-xs flex flex-col items-center gap-0.5 border bg-white/5 hover:bg-white/15 text-slate-200 border-white/10"
                  >
                    <span className="font-mono font-bold text-[10.5px] text-orange-300">(ax+b)/(cx+d)</span>
                    <span className="text-[9px] text-slate-300">Nhất biến (Nghịch biến)</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTool('func_exp_pos');
                      setShowFunctionPicker(false);
                    }}
                    className="p-2 rounded-xl text-xs flex flex-col items-center gap-0.5 border bg-white/5 hover:bg-white/15 text-slate-200 border-white/10"
                  >
                    <span className="font-mono font-bold text-[10.5px] text-emerald-300">y = a^x (a &gt; 1)</span>
                    <span className="text-[9px] text-slate-300">Hàm Số Mũ</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTool('func_log_pos');
                      setShowFunctionPicker(false);
                    }}
                    className="p-2 rounded-xl text-xs flex flex-col items-center gap-0.5 border bg-white/5 hover:bg-white/15 text-slate-200 border-white/10"
                  >
                    <span className="font-mono font-bold text-[10.5px] text-purple-300">log_a(x) (a &gt; 1)</span>
                    <span className="text-[9px] text-slate-300">Hàm Số Logarit</span>
                  </button>
                </div>
              </div>

              {/* 5. Vật Lý: Dao Động & Sóng */}
              <div>
                <span className="text-[10px] font-black uppercase text-cyan-300 mb-1 block flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  5. Vật Lý: Dao Động & Sóng
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  <button
                    onClick={() => {
                      setActiveTool('phys_shm_displacement');
                      setShowFunctionPicker(false);
                    }}
                    className="p-2 rounded-xl text-xs flex flex-col items-center gap-0.5 border bg-white/5 hover:bg-white/15 text-slate-200 border-white/10"
                  >
                    <span className="font-mono font-bold text-[10.5px] text-cyan-300">x = A·cos(ωt + φ)</span>
                    <span className="text-[9px] text-slate-300">Ly Độ Dao Động</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTool('phys_shm_velocity');
                      setShowFunctionPicker(false);
                    }}
                    className="p-2 rounded-xl text-xs flex flex-col items-center gap-0.5 border bg-white/5 hover:bg-white/15 text-slate-200 border-white/10"
                  >
                    <span className="font-mono font-bold text-[10.5px] text-amber-300">v = -ωA·sin(...)</span>
                    <span className="text-[9px] text-slate-300">Vận Tốc Dao Động</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTool('phys_wave');
                      setShowFunctionPicker(false);
                    }}
                    className="p-2 rounded-xl text-xs flex flex-col items-center gap-0.5 border bg-white/5 hover:bg-white/15 text-slate-200 border-white/10"
                  >
                    <span className="font-mono font-bold text-[10.5px] text-emerald-300">Sóng Dừng</span>
                    <span className="text-[9px] text-slate-300">Bụng Sóng & Nút Sóng</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sub-sheet 0: Mobile Calligraphy / Chữ Đẹp AI Sheet */}
          {showCalligraphyPopover && (
            <div
              className="w-full bg-slate-900/98 backdrop-blur-xl border border-purple-500/50 rounded-2xl p-3 shadow-2xl text-white flex flex-col gap-2.5 animate-in fade-in max-h-[75vh] overflow-y-auto custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/30">
                    <Feather className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5 text-white">
                      Viết Chữ Đẹp
                      <span className="text-[9px] px-1.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 font-black rounded-md">AI OCR</span>
                    </div>
                    <div className="text-[10px] text-slate-400">Chọn font chữ tập viết tiểu học chuẩn</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowCalligraphyPopover(false)}
                  className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Font Selection */}
              <div className="text-[11px] font-semibold text-purple-300">Chọn kiểu chữ viết:</div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'tieuhoc_chuan', label: 'Chữ Mẫu Tiểu Học', sub: 'Chuẩn Bộ GD (Playwrite VN)', sample: 'Luyện nét chữ rèn nết người' },
                  { id: 'tieuhoc_oly', label: 'Tập Viết Có Ô Ly', sub: 'Kẻ ô ly học sinh tiểu học', sample: 'Nét chữ cô dạy em thơ' },
                  { id: 'luyenchu', label: 'Vở Sạch Chữ Đẹp', sub: 'Nét thanh nét đậm Charm', sample: 'Luyện chữ rèn nết' },
                  { id: 'tapviet', label: 'Tập Viết Nét Tròn', sub: 'Nét tròn Playpen / HP001', sample: 'Nét chữ nết người' },
                  { id: 'primary', label: 'Nét Phấn Học Trò', sub: 'Patrick Hand / Mali', sample: 'Rõ ràng, tròn trịa' },
                  { id: 'handwriting', label: 'Bút Mài Giáo Viên', sub: 'Caveat thanh thoát', sample: 'Nét bút cô giáo' },
                  { id: 'calligraphy', label: 'Thư Pháp Mềm Mại', sub: 'Dancing Script', sample: 'Nghệ thuật thư pháp' },
                  { id: 'cursive', label: 'Nét Cọ Bay Bổng', sub: 'Marck Script', sample: 'Uốn lượn bay bổng' },
                ].map((font) => (
                  <button
                    key={font.id}
                    onClick={() => setCalligraphyFont(font.id as any)}
                    className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                      calligraphyFont === font.id
                        ? 'bg-purple-600/30 border-purple-400 text-white shadow ring-1 ring-purple-400'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-[11px] font-bold flex items-center gap-1">
                      {font.id === 'tieuhoc_chuan' && <span className="text-amber-300">🌟</span>}
                      {font.id === 'tieuhoc_oly' && <span className="text-cyan-300">📐</span>}
                      {font.id === 'luyenchu' && <span className="text-pink-400">✨</span>}
                      {font.id === 'tapviet' && <span className="text-amber-400">📖</span>}
                      <span>{font.label}</span>
                    </div>
                    <div className="text-[9px] text-slate-400 mb-0.5">{font.sub}</div>
                    <div
                      className="text-[12px] text-amber-200 truncate"
                      style={{
                        fontFamily:
                          font.id === 'tieuhoc_chuan'
                            ? '"Playwrite VN", "HP001 4 hàng normal", cursive, sans-serif'
                            : font.id === 'tieuhoc_oly'
                            ? '"Playwrite VN Guides", "Playwrite VN", cursive, sans-serif'
                            : font.id === 'tapviet'
                            ? '"Playwrite VN", "Playpen Sans", cursive, sans-serif'
                            : font.id === 'luyenchu'
                            ? '"Charm", "Dancing Script", cursive'
                            : font.id === 'calligraphy'
                            ? '"Dancing Script", cursive'
                            : font.id === 'handwriting'
                            ? '"Caveat", cursive'
                            : font.id === 'primary'
                            ? '"Playpen Sans", "Mali", "Patrick Hand", cursive'
                            : '"Marck Script", cursive',
                      }}
                    >
                      {font.sample}
                    </div>
                  </button>
                ))}
              </div>

              {/* Sweep & Select Guidance */}
              <div className="bg-purple-500/10 border border-purple-500/30 p-2.5 rounded-xl text-left">
                <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Cách chuyển chữ đẹp siêu tốc</span>
                </div>
                <div className="text-[10px] text-slate-300 leading-relaxed">
                  1. Kéo quét bao quanh vùng chữ cần chuyển trên bảng.<br/>
                  2. Bấm nút <strong>"Chuyển Chữ Đẹp"</strong> để hoàn tất tức thì!
                </div>
              </div>

              {/* Action Buttons */}
              <button
                onClick={() => {
                  setShowCalligraphyPopover(false);
                  handleConvertHandwritingToCalligraphy();
                }}
                disabled={isConvertingCalligraphy}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                <span>{isConvertingCalligraphy ? 'Đang chuyển siêu tốc...' : sweptSelection ? 'Bấm chọn chuyển ngay' : 'Chuyển chữ đẹp'}</span>
              </button>

              {lastConvertedInfo && (
                <button
                  onClick={() => {
                    handleUndoCalligraphy();
                    setShowCalligraphyPopover(false);
                  }}
                  className="w-full py-1.5 px-3 rounded-xl bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Hoàn tác nét phấn ban đầu</span>
                </button>
              )}
            </div>
          )}

          {/* Sub-sheet 1: Mobile Color & Size Drawer */}
          {showMobileColorSheet && (
            <div className="w-full bg-slate-900/98 backdrop-blur-xl border border-white/20 rounded-2xl p-2.5 shadow-2xl text-white flex flex-col gap-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
                <span>Màu phấn viết:</span>
                <button onClick={() => setShowMobileColorSheet(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center justify-around gap-1">
                {[
                  { color: '#ffffff', label: 'Trắng' },
                  { color: '#fef08a', label: 'Vàng' },
                  { color: '#fdba74', label: 'Cam' },
                  { color: '#f472b6', label: 'Hồng' },
                  { color: '#38bdf8', label: 'Lam' },
                  { color: '#4ade80', label: 'Lục' },
                ].map((c) => (
                  <button
                    key={c.color}
                    onClick={() => {
                      setActiveColor(c.color);
                      setShowMobileColorSheet(false);
                    }}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      activeColor === c.color ? 'ring-2 ring-white scale-110 shadow-lg' : 'opacity-85 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.color }}
                    title={c.label}
                  >
                    {activeColor === c.color && (
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-950/60" />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-white/10 px-1 text-xs">
                <span className="text-slate-400">Nét phấn:</span>
                <div className="flex items-center gap-1.5">
                  {[
                    { size: 2, label: 'Nhỏ' },
                    { size: 4, label: 'Vừa' },
                    { size: 8, label: 'Đậm' },
                  ].map((s) => (
                    <button
                      key={s.size}
                      onClick={() => {
                        setStrokeSize(s.size);
                        setShowMobileColorSheet(false);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                        strokeSize === s.size ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sub-sheet 2: Mobile Shapes Drawer */}
          {showMobileShapeSheet && (
            <div className="w-full bg-slate-900/98 backdrop-blur-xl border border-white/20 rounded-2xl p-2.5 shadow-2xl text-white flex flex-col gap-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-purple-300 px-1">
                <span>Vẽ hình học cơ bản:</span>
                <button onClick={() => setShowMobileShapeSheet(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { tool: 'line', label: 'Thẳng', icon: <Minus className="w-4 h-4" /> },
                  { tool: 'arrow', label: 'Mũi tên', icon: <MoveRight className="w-4 h-4" /> },
                  { tool: 'rectangle', label: 'C.Nhật', icon: <Square className="w-4 h-4" /> },
                  { tool: 'circle', label: 'Tròn', icon: <Circle className="w-4 h-4" /> },
                  { tool: 'triangle', label: 'T.Giác', icon: <Triangle className="w-4 h-4" /> },
                ].map((sh) => (
                  <button
                    key={sh.tool}
                    onClick={() => {
                      setActiveTool(sh.tool as any);
                      setShowMobileShapeSheet(false);
                    }}
                    className={`p-2 rounded-xl flex flex-col items-center gap-1 text-[10px] font-bold cursor-pointer ${
                      activeTool === sh.tool ? 'bg-purple-600 text-white ring-1 ring-purple-300' : 'bg-white/10 text-slate-200'
                    }`}
                  >
                    {sh.icon}
                    <span>{sh.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sub-sheet 3: Mobile More Options Drawer */}
          {showMobileMoreSheet && (
            <div className="w-full bg-slate-900/98 backdrop-blur-xl border border-white/20 rounded-2xl p-3 shadow-2xl text-white flex flex-col gap-2.5 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>Tùy chọn bảng viết:</span>
                <button onClick={() => setShowMobileMoreSheet(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Trang bảng */}
              <div className="flex items-center justify-between bg-white/5 p-2 rounded-xl border border-white/10">
                <span className="text-xs text-slate-300">Trang bảng:</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
                    disabled={currentPageIndex === 0}
                    className="p-1.5 rounded-lg bg-white/10 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-xs font-bold px-2">{currentPageIndex + 1}/{pages.length}</span>
                  <button
                    onClick={() => setCurrentPageIndex((p) => Math.min(pages.length - 1, p + 1))}
                    disabled={currentPageIndex === pages.length - 1}
                    className="p-1.5 rounded-lg bg-white/10 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      handleAddNewPage();
                      setShowMobileMoreSheet(false);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-xs font-bold ml-1 shadow cursor-pointer"
                  >
                    + Thêm
                  </button>
                </div>
              </div>

              {/* Nền bảng */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400">Chọn nền bảng:</span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => {
                      setBgTheme('oli');
                      setShowMobileMoreSheet(false);
                    }}
                    className={`p-2 rounded-xl text-center text-[10px] font-bold border transition-all cursor-pointer ${
                      bgTheme === 'oli' ? 'bg-emerald-800 border-emerald-400 text-white shadow' : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                  >
                    📗 Bảng Ô Ly SGK
                  </button>
                  <button
                    onClick={() => {
                      setBgTheme('slate');
                      setShowMobileMoreSheet(false);
                    }}
                    className={`p-2 rounded-xl text-center text-[10px] font-bold border transition-all cursor-pointer ${
                      bgTheme === 'slate' ? 'bg-slate-800 border-slate-400 text-white shadow' : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                  >
                    ⬛ Bảng Đen Mun
                  </button>
                  <button
                    onClick={() => {
                      setBgTheme('white');
                      setShowMobileMoreSheet(false);
                    }}
                    className={`p-2 rounded-xl text-center text-[10px] font-bold border transition-all cursor-pointer ${
                      bgTheme === 'white' ? 'bg-slate-100 border-indigo-500 text-slate-900 shadow' : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                  >
                    ⬜ Bảng Trắng
                  </button>
                </div>
              </div>

              {/* Lau Sạch Toàn Bộ Bảng */}
              <button
                onClick={() => {
                  setShowMobileMoreSheet(false);
                  handleClearBoard();
                }}
                disabled={strokes.length === 0 && texts.length === 0}
                className="w-full py-2 rounded-xl bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Lau sạch toàn bộ trang bảng</span>
              </button>
            </div>
          )}

          {/* Main Floating Tool Pill on Phone */}
          <div className="w-full bg-slate-950/95 backdrop-blur-2xl border border-white/20 shadow-2xl rounded-2xl px-2 py-1.5 flex items-center justify-start gap-1.5 text-white overflow-x-auto scrollbar-none touch-pan-x">
            {/* 0. Chọn (Select) - Tiện lợi cho giáo viên trên di động */}
            <button
              onClick={() => {
                handleToolChange('select');
                setShowMobileColorSheet(false);
                setShowMobileShapeSheet(false);
                setShowMobileMoreSheet(false);
              }}
              className={`px-2.5 py-1.5 rounded-xl flex items-center gap-1 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTool === 'select'
                  ? 'bg-blue-600 text-white shadow ring-2 ring-blue-400'
                  : 'text-slate-300 hover:bg-white/10'
              }`}
              title="Chọn và di chuyển đối tượng"
            >
              <MousePointer2 className="w-4 h-4 text-blue-300" />
              <span className="text-[11px]">Chọn</span>
            </button>

            {/* 1. Phấn */}
            <button
              onClick={() => {
                handleToolChange('pen');
                setShowMobileColorSheet(false);
                setShowMobileShapeSheet(false);
                setShowMobileMoreSheet(false);
              }}
              className={`px-2.5 py-1.5 rounded-xl flex items-center gap-1 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTool === 'pen'
                  ? 'bg-emerald-600 text-white shadow ring-2 ring-emerald-400'
                  : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              <div className="relative w-4 h-4 flex items-center justify-center">
                <Hand className="w-3.5 h-3.5 text-emerald-200" />
                <PenLine className="w-2 h-2 absolute -top-0.5 -right-0.5 text-amber-300" />
              </div>
              <span className="text-[11px]">Phấn</span>
            </button>

            {/* 2. Chữ Đẹp AI (Quét để chọn văn bản - Không bật hộp thoại) */}
            <button
              onClick={() => {
                handleToolChange('calligraphy');
                setShowCalligraphyPopover(false);
                setShowMobileColorSheet(false);
                setShowMobileShapeSheet(false);
                setShowMobileMoreSheet(false);
                setCalligraphyStatusBanner('✨ Chế độ Quét Chữ Đẹp: Kéo quét bao quanh vùng chữ trên bảng để chọn. Kiểu chữ chọn trên thanh công cụ phía trên!');
                setTimeout(() => setCalligraphyStatusBanner(''), 4500);
              }}
              className={`px-2.5 py-1.5 rounded-xl flex items-center gap-1 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTool === 'calligraphy'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow ring-2 ring-purple-400'
                  : 'text-purple-300 hover:bg-white/10'
              }`}
              title="Quét để chọn vùng chữ cần chuyển sang chữ đẹp"
            >
              <div className="relative w-4 h-4 flex items-center justify-center">
                <Feather className="w-3.5 h-3.5 text-purple-200" />
                <Sparkles className="w-2 h-2 absolute -top-1 -right-1 text-amber-300 animate-pulse" />
              </div>
              <span className="text-[11px]">Chữ Đẹp</span>
              <span className="text-[8px] px-1 bg-amber-400 text-slate-950 font-black rounded-full">AI</span>
            </button>

            {/* 3. Khăn Lau */}
            <button
              onClick={() => {
                handleToolChange('eraser');
                setShowMobileColorSheet(false);
                setShowMobileShapeSheet(false);
                setShowMobileMoreSheet(false);
              }}
              className={`px-2.5 py-1.5 rounded-xl flex items-center gap-1 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTool === 'eraser'
                  ? 'bg-rose-600 text-white shadow ring-2 ring-rose-400'
                  : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              <Eraser className="w-4 h-4" />
              <span className="text-[11px]">Lau</span>
            </button>

            {/* 4. Màu Phấn & Độ Dày */}
            <button
              onClick={() => {
                setShowMobileColorSheet((v) => !v);
                setShowMobileShapeSheet(false);
                setShowMobileMoreSheet(false);
              }}
              className="p-1.5 rounded-xl hover:bg-white/10 flex items-center gap-1 text-xs font-bold cursor-pointer"
              title="Chọn màu phấn và độ dày nét"
            >
              <span
                className="w-5 h-5 rounded-full border border-white/60 shadow-sm"
                style={{ backgroundColor: activeColor }}
              />
            </button>

            {/* 5. Hình Học */}
            <button
              onClick={() => {
                setShowMobileShapeSheet((v) => !v);
                setShowMobileColorSheet(false);
                setShowMobileMoreSheet(false);
                setShowFunctionPicker(false);
              }}
              className={`p-2 rounded-xl text-xs font-bold cursor-pointer ${
                ['line', 'arrow', 'rectangle', 'circle', 'triangle'].includes(activeTool) || showMobileShapeSheet
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-purple-300 hover:bg-white/10'
              }`}
              title="Vẽ hình học cơ bản"
            >
              <Shapes className="w-4 h-4" />
            </button>

            {/* 5.1 Đồ Thị Hàm Số Toán Học (SGK) */}
            <button
              onClick={() => {
                setShowFunctionPicker((v) => !v);
                setShowMobileColorSheet(false);
                setShowMobileShapeSheet(false);
                setShowMobileMoreSheet(false);
              }}
              className={`px-2 py-1.5 rounded-xl flex items-center gap-1 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                showFunctionPicker
                  ? 'bg-amber-500 text-slate-950 font-black shadow ring-2 ring-amber-300'
                  : 'text-amber-300 hover:bg-white/10'
              }`}
              title="Vẽ đồ thị hàm số chuẩn SGK Toán"
            >
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span className="text-[11px]">Đồ thị</span>
            </button>

            {/* 6. Hoàn Tác (Undo) */}
            <button
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className="p-2 rounded-xl text-amber-300 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Hoàn tác nét phấn"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* 7. Thêm (...) */}
            <button
              onClick={() => {
                setShowMobileMoreSheet((v) => !v);
                setShowMobileColorSheet(false);
                setShowMobileShapeSheet(false);
              }}
              className="p-2 rounded-xl text-slate-300 hover:bg-white/10 cursor-pointer"
              title="Tùy chọn thêm: Đổi trang, Nền bảng, Xóa sạch"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* 8. Thu gọn thanh vẽ */}
            <button
              onClick={() => {
                setIsMobileChalkDockMinimized(true);
                setShowMobileColorSheet(false);
                setShowMobileShapeSheet(false);
                setShowMobileMoreSheet(false);
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              title="Thu gọn thanh bút phấn"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
        )
      ) : isDockCollapsed ? (
        /* Minimized Dock Trigger Button */
        <button
          onClick={() => setIsDockCollapsed(false)}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-full bg-slate-950/85 hover:bg-slate-900 text-emerald-300 border border-emerald-500/40 text-xs font-bold shadow-2xl backdrop-blur-xl flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95 pointer-events-auto"
          title="Mở thanh công cụ sư phạm"
        >
          <PenLine className="w-3.5 h-3.5 text-emerald-400" />
          <span>Thanh Công Cụ</span>
          <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />
        </button>
      ) : (
        /* AUTHENTIC BOTTOM CHALK & TOOL DOCK (75 INCH TOUCH OPTIMIZED - ALWAYS VISIBLE) */
        <div className="absolute bottom-2.5 sm:bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-auto max-w-[98vw] flex justify-center">
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

            {/* 2b. Viết Chữ Đẹp (Smart Handwriting to Beautiful Font - Quét để chọn) */}
            <div className="relative shrink-0 flex items-center">
              <button
                onClick={() => {
                  handleToolChange('calligraphy');
                  setShowCalligraphyPopover(false);
                  setShowShapePicker(false);
                  setShowFunctionPicker(false);
                  setShowColorPopover(false);
                  setShowSizePopover(false);
                  setCalligraphyStatusBanner('✨ Chế độ Quét Chữ Đẹp: Kéo quét bao quanh vùng chữ trên bảng để chọn. Kiểu chữ chọn trên thanh công cụ phía trên!');
                  setTimeout(() => setCalligraphyStatusBanner(''), 4500);
                }}
                className={`p-2 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeTool === 'calligraphy'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md ring-2 ring-purple-400'
                    : 'hover:bg-white/10 text-slate-300'
                }`}
                title="Quét để chọn vùng chữ trên bảng cần chuyển sang chữ đẹp (chọn kiểu chữ trên thanh công cụ phía trên)"
              >
                <div className="relative w-4 h-4 flex items-center justify-center">
                  <Feather className="w-3.5 h-3.5 text-purple-200" />
                  <Sparkles className="w-2.5 h-2.5 absolute -top-1 -right-1 text-amber-300 animate-pulse" />
                </div>
                <span className="text-[11px] font-bold">Chữ Đẹp</span>
                <span className="text-[8px] px-1 py-0.5 bg-amber-400 text-slate-950 font-black rounded-full leading-none">AI</span>
              </button>

              {/* Calligraphy Options Popover */}
              {showCalligraphyPopover && (
                <div
                  className="absolute bottom-full mb-3 left-0 w-80 bg-slate-900/98 backdrop-blur-xl border border-purple-500/50 rounded-2xl shadow-2xl p-3.5 z-50 text-white animate-in fade-in slide-in-from-bottom-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-2.5 border-b border-white/10 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/30">
                        <Feather className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold flex items-center gap-1.5 text-white">
                          Viết Chữ Đẹp
                          <span className="text-[9px] px-1.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 font-black rounded-md">AI OCR</span>
                        </div>
                        <div className="text-[10px] text-slate-400">Viết tự do rồi ứng dụng tự động biến thành font chữ đẹp</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowCalligraphyPopover(false)}
                      className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Font Selection */}
                  <div className="text-[11px] font-semibold text-purple-300 mb-1.5">Chọn kiểu chữ viết tay:</div>
                  <div className="grid grid-cols-2 gap-1.5 mb-3">
                    {[
                      { id: 'tieuhoc_chuan', label: 'Chữ Mẫu Tiểu Học', sub: 'Chuẩn Bộ GD (Playwrite VN)', sample: 'Luyện nét chữ rèn nết người' },
                      { id: 'tieuhoc_oly', label: 'Tập Viết Có Ô Ly', sub: 'Dòng kẻ ô ly cấp 1 (Guides)', sample: 'Nét chữ cô dạy em thơ' },
                      { id: 'luyenchu', label: 'Vở Sạch Chữ Đẹp', sub: 'Nét thanh nét đậm Charm - Ảnh 3', sample: 'Luyện chữ rèn nết' },
                      { id: 'tapviet', label: 'Tập Viết Nét Tròn', sub: 'Playpen Sans / HP001', sample: 'Nét chữ nết người' },
                      { id: 'primary', label: 'Nét Phấn Học Trò', sub: 'Patrick Hand / Mali', sample: 'Rõ ràng, tròn trịa' },
                      { id: 'handwriting', label: 'Bút Mài Giáo Viên', sub: 'Caveat thanh thoát', sample: 'Nét bút cô giáo' },
                      { id: 'calligraphy', label: 'Thư Pháp Mềm Mại', sub: 'Dancing Script', sample: 'Nghệ thuật thư pháp' },
                      { id: 'cursive', label: 'Nét Cọ Bay Bổng', sub: 'Marck Script', sample: 'Uốn lượn bay bổng' },
                    ].map((font) => (
                      <button
                        key={font.id}
                        onClick={() => setCalligraphyFont(font.id as any)}
                        className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                          calligraphyFont === font.id
                            ? 'bg-purple-600/30 border-purple-400 text-white shadow ring-1 ring-purple-400'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-[11px] font-bold flex items-center gap-1">
                          {font.id === 'tieuhoc_chuan' && <span className="text-amber-300">🌟</span>}
                          {font.id === 'tieuhoc_oly' && <span className="text-cyan-300">📐</span>}
                          {font.id === 'luyenchu' && <span className="text-pink-400">✨</span>}
                          {font.id === 'tapviet' && <span className="text-amber-400">📖</span>}
                          <span>{font.label}</span>
                        </div>
                        <div className="text-[9px] text-slate-400 mb-1">{font.sub}</div>
                        <div
                          className="text-[13px] text-amber-200 truncate"
                          style={{
                            fontFamily:
                              font.id === 'tieuhoc_chuan'
                                ? '"Playwrite VN", "HP001 4 hàng normal", cursive, sans-serif'
                                : font.id === 'tieuhoc_oly'
                                ? '"Playwrite VN Guides", "Playwrite VN", cursive, sans-serif'
                                : font.id === 'tapviet'
                                ? '"Playwrite VN", "Playpen Sans", cursive, sans-serif'
                                : font.id === 'luyenchu'
                                ? '"Charm", "Dancing Script", cursive'
                                : font.id === 'calligraphy'
                                ? '"Dancing Script", cursive'
                                : font.id === 'handwriting'
                                ? '"Caveat", cursive'
                                : font.id === 'primary'
                                ? '"Playpen Sans", "Mali", "Patrick Hand", cursive'
                                : '"Marck Script", cursive',
                          }}
                        >
                          {font.sample}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Sweep & Select Guidance */}
                  <div className="bg-purple-500/10 border border-purple-500/30 p-2.5 rounded-xl text-left mb-3">
                    <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Cơ chế Quét & Bấm Chọn mới</span>
                    </div>
                    <div className="text-[10px] text-slate-300 leading-relaxed">
                      1. Kéo quét bao quanh vùng chữ cần chuyển trên bảng.<br/>
                      2. Bấm nút <strong>"Bấm chọn: Chuyển Chữ Đẹp"</strong> nổi lên để chuyển đổi siêu tốc!
                    </div>
                  </div>

                  {/* Manual Convert Now button */}
                  <button
                    onClick={() => {
                      setShowCalligraphyPopover(false);
                      handleConvertHandwritingToCalligraphy();
                    }}
                    disabled={isConvertingCalligraphy}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                    <span>{isConvertingCalligraphy ? 'Đang chuyển siêu tốc...' : sweptSelection ? 'Bấm chọn chuyển ngay' : 'Chuyển chữ đẹp'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* 2c. Giọng Đọc AI (TTS) với Menu Popover chọn 4 sắc thái giọng ngay cạnh */}
            <div className="relative flex items-center shrink-0">
              <div className="flex items-center rounded-xl overflow-hidden border border-emerald-500/40 bg-emerald-950/70 shadow-lg">
                <button
                  onClick={() => {
                    if (isSpeakingTTS) {
                      handleStopTTS();
                      return;
                    }
                    if (sweptSelection || selectedTextId || selectedStrokeId) {
                      handleSpeakSweptContent();
                    } else {
                      handleToolChange('calligraphy');
                      setCalligraphyStatusBanner('🔊 Chế độ Đọc AI: Kéo quét bao quanh chữ trên bảng để AI phát âm to rõ!');
                      setTimeout(() => setCalligraphyStatusBanner(null), 4500);
                    }
                  }}
                  className={`px-2.5 py-2 flex items-center gap-1.5 text-xs font-black transition-all cursor-pointer ${
                    isSpeakingTTS
                      ? 'bg-emerald-600 text-white animate-pulse shadow-md'
                      : 'hover:bg-emerald-800/80 text-emerald-300'
                  }`}
                  title={isSpeakingTTS ? 'Dừng đọc AI' : 'Đọc chữ viết tay hoặc văn bản trên bảng bằng giọng đọc AI (Nhấn để đọc)'}
                >
                  <Volume2 className={`w-4 h-4 ${isSpeakingTTS ? 'animate-bounce text-white' : 'text-emerald-400'}`} />
                  <span className="text-[11px] font-black whitespace-nowrap">
                    {isSpeakingTTS ? 'Đang Đọc' : '🔊 Đọc AI'}
                  </span>
                </button>

                {/* Nút Popover chọn nhanh sắc thái giọng đọc AI */}
                <button
                  onClick={() => setShowBottomTTSMenu((prev) => !prev)}
                  className="px-1.5 py-2 hover:bg-emerald-800/80 text-emerald-300 border-l border-emerald-500/30 flex items-center gap-0.5 cursor-pointer"
                  title="Chọn sắc thái giọng đọc AI (4 giọng chuẩn)"
                >
                  <span className="text-xs">{ttsVoicePreset.icon || '🎙️'}</span>
                  <ChevronDown className={`w-3 h-3 text-emerald-400 transition-transform ${showBottomTTSMenu ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Popover Dropdown 4 Sắc Thái Giọng AI Chuẩn */}
              {showBottomTTSMenu && (
                <div className="absolute left-0 bottom-full mb-2 w-72 bg-slate-950/98 backdrop-blur-2xl border-2 border-emerald-500/70 rounded-2xl shadow-2xl p-2 z-50 text-white space-y-1.5 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-white/10">
                    <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                      4 SẮC THÁI GIỌNG AI (vi-VN)
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono">
                      Âm lượng 1.0 (Max)
                    </span>
                  </div>

                  {VOICE_TONE_PRESETS.map((preset) => {
                    const isSelected = ttsVoicePreset.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setTtsVoicePreset(preset);
                          setShowBottomTTSMenu(false);
                          if (isSpeakingTTS) {
                            handleStopTTS();
                            setTimeout(() => handleSpeakSweptContent(preset), 50);
                          }
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition-all flex flex-col gap-0.5 cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold shadow-md ring-1 ring-emerald-400'
                            : 'hover:bg-white/10 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold">
                            <span>{preset.icon}</span>
                            <span>{preset.name}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-amber-300" />}
                        </div>
                        <p className="text-[10px] opacity-80 line-clamp-1">{preset.description}</p>
                        <span className="text-[9px] opacity-60 font-mono">{preset.sub}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Khăn Lau Bảng (Towel icon & 50p fast erase) */}
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

                {/* 3. Calculus: Curved Trapezoid Area & Solid of Revolution */}
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-300 mb-1.5 block">
                    3. Ứng Dụng Tích Phân & Tròn Xoay (Chuẩn SGK 12)
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => {
                        setActiveTool('shape_curved_trapezoid_area');
                        setShowShapePicker(false);
                      }}
                      className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all ${
                        activeTool === 'shape_curved_trapezoid_area' ? 'bg-emerald-600 text-white ring-2 ring-emerald-300' : 'bg-white/5 hover:bg-white/15 text-slate-200'
                      }`}
                      title="Diện tích hình thang cong giới hạn bởi y=f(x), trục hoành và hai đường thẳng x=a, x=b (có tô sọc chéo / tô màu)"
                    >
                      <Sigma className="w-4 h-4 text-emerald-300" />
                      <span className="text-[10px] font-bold">Hình Thang Cong (S)</span>
                      <span className="text-[8.5px] text-emerald-200/80">Tô sọc chéo / Tô màu</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('shape_solid_revolution_volume');
                        setShowShapePicker(false);
                      }}
                      className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 transition-all ${
                        activeTool === 'shape_solid_revolution_volume' ? 'bg-emerald-600 text-white ring-2 ring-emerald-300' : 'bg-white/5 hover:bg-white/15 text-slate-200'
                      }`}
                      title="Thể tích khối tròn xoay tạo thành khi quay hình phẳng quanh trục Ox"
                    >
                      <Box className="w-4 h-4 text-emerald-300" />
                      <span className="text-[10px] font-bold">Vật Thể Tròn Xoay (V)</span>
                      <span className="text-[8.5px] text-emerald-200/80">Quay quanh trục Ox</span>
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

                {/* Custom Equation Formula Input Banner */}
                <button
                  onClick={() => {
                    setEditingEquationStrokeId(null);
                    setShowEquationModal(true);
                    setShowFunctionPicker(false);
                  }}
                  className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black shadow-lg flex items-center justify-between transition-transform active:scale-98 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-slate-950/20 flex items-center justify-center">
                      <Calculator className="w-4 h-4 text-slate-950" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-black tracking-wide">NHẬP CÔNG THỨC HÀM SỐ (TOÁN & VẬT LÝ)</div>
                      <div className="text-[10px] font-medium opacity-90">Tự do nhập hàm y = f(x), ly độ x(t), vận tốc, gia tốc</div>
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-950/25 font-bold">Mở Bảng Nhập →</span>
                </button>

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

                {/* 3. Biquadratic Functions: y = ax^4 + bx^2 + c */}
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-300 mb-1.5 block tracking-wide">
                    3. Hàm Trùng Phương y = ax⁴ + bx² + c (4 Trường Hợp Chuẩn SGK)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      onClick={() => {
                        setActiveTool('func_biquadratic_3extrema_pos');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_biquadratic_3extrema_pos'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-[11px] text-amber-300">a &gt; 0, ab &lt; 0</span>
                      <span className="text-[9.5px] text-slate-300">3 Cực Trị (Chữ W)</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('func_biquadratic_3extrema_neg');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_biquadratic_3extrema_neg'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-[11px] text-rose-300">a &lt; 0, ab &lt; 0</span>
                      <span className="text-[9.5px] text-slate-300">3 Cực Trị (Chữ M)</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('func_biquadratic_1extremum_pos');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_biquadratic_1extremum_pos'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-[11px] text-emerald-300">a &gt; 0, ab ≥ 0</span>
                      <span className="text-[9.5px] text-slate-300">1 Cực Tiểu (Chữ U)</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('func_biquadratic_1extremum_neg');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_biquadratic_1extremum_neg'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-[11px] text-sky-300">a &lt; 0, ab ≥ 0</span>
                      <span className="text-[9.5px] text-slate-300">1 Cực Đại (Úp)</span>
                    </button>
                  </div>
                </div>

                {/* 4. Rational Functions: y = (ax+b)/(cx+d) */}
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-300 mb-1.5 block tracking-wide">
                    4. Hàm Nhất Biến y = (ax+b)/(cx+d) (Đủ 4 Dạng Đồ Thị Chuẩn SGK)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                      title="Hàm nhất biến đồng biến, tiệm cận đứng bên trái trục tung (x = -1)"
                    >
                      <span className="font-mono font-bold text-[11px] text-cyan-300">Đồng Biến (x = -1)</span>
                      <span className="text-[9.5px] text-slate-300">ad - bc &gt; 0, x &lt; 0</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('func_rational_pos_right');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_rational_pos_right'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                      title="Hàm nhất biến đồng biến, tiệm cận đứng bên phải trục tung (x = 1)"
                    >
                      <span className="font-mono font-bold text-[11px] text-cyan-300">Đồng Biến (x = 1)</span>
                      <span className="text-[9.5px] text-slate-300">ad - bc &gt; 0, x &gt; 0</span>
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
                      title="Hàm nhất biến nghịch biến, tiệm cận đứng bên phải trục tung (x = 1)"
                    >
                      <span className="font-mono font-bold text-[11px] text-rose-300">Nghịch Biến (x = 1)</span>
                      <span className="text-[9.5px] text-slate-300">ad - bc &lt; 0, x &gt; 0</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('func_rational_neg_left');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_rational_neg_left'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                      title="Hàm nhất biến nghịch biến, tiệm cận đứng bên trái trục tung (x = -1)"
                    >
                      <span className="font-mono font-bold text-[11px] text-rose-300">Nghịch Biến (x = -1)</span>
                      <span className="text-[9.5px] text-slate-300">ad - bc &lt; 0, x &lt; 0</span>
                    </button>
                  </div>
                </div>

                {/* 5. Degree 2 over Degree 1 Rational Functions */}
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-300 mb-1.5 block tracking-wide">
                    5. Hàm Phân Thức Bậc 2 / Bậc 1 (Đủ 4 Dạng Tiệm Cận Xiên SGK 12)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                      title="Có 2 cực trị, tiệm cận xiên dốc lên (hệ số góc m > 0)"
                    >
                      <span className="font-mono font-bold text-[11px] text-emerald-300">2 Cực Trị (m &gt; 0)</span>
                      <span className="text-[9.5px] text-slate-300">TCX dốc lên (C.Đại & C.Tiểu)</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('func_frac21_neg_slope');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_frac21_neg_slope'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                      title="Có 2 cực trị, tiệm cận xiên dốc xuống (hệ số góc m < 0)"
                    >
                      <span className="font-mono font-bold text-[11px] text-amber-300">2 Cực Trị (m &lt; 0)</span>
                      <span className="text-[9.5px] text-slate-300">TCX dốc xuống (C.Tiểu & C.Đại)</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('func_frac21_noextrema_pos');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_frac21_noextrema_pos'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                      title="Không có cực trị, luôn đồng biến trên từng khoảng xác định (m > 0)"
                    >
                      <span className="font-mono font-bold text-[11px] text-sky-300">Đơn Điệu (m &gt; 0)</span>
                      <span className="text-[9.5px] text-slate-300">Không cực trị (Đồng biến)</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('func_frac21_noextrema_neg');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'func_frac21_noextrema_neg'
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                      title="Không có cực trị, luôn nghịch biến trên từng khoảng xác định (m < 0)"
                    >
                      <span className="font-mono font-bold text-[11px] text-purple-300">Đơn Điệu (m &lt; 0)</span>
                      <span className="text-[9.5px] text-slate-300">Không cực trị (Nghịch biến)</span>
                    </button>
                  </div>
                </div>

                {/* 6. Exponential & Logarithmic Functions */}
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-300 mb-1.5 block tracking-wide">
                    6. Hàm Số Mũ & Hàm Số Logarit
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

                {/* 7. Physics: Harmonic Motion & Waves */}
                <div>
                  <span className="text-[10px] font-black uppercase text-cyan-300 mb-1.5 block tracking-wide flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    7. Bộ Môn Vật Lý: Dao Động Điều Hòa & Sóng (SGK Chuẩn)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setActiveTool('phys_shm_displacement');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'phys_shm_displacement'
                          ? 'bg-cyan-500 text-slate-950 font-black border-cyan-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                      title="Ly độ dao động x = A·cos(ωt + φ)"
                    >
                      <span className="font-mono font-bold text-[11px] text-cyan-300">x = A·cos(ωt + φ)</span>
                      <span className="text-[9.5px] text-slate-300">Ly Độ (x - t)</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('phys_shm_velocity');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'phys_shm_velocity'
                          ? 'bg-cyan-500 text-slate-950 font-black border-cyan-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                      title="Vận tốc dao động v = -ωA·sin(ωt + φ) (sớm pha π/2 so với x)"
                    >
                      <span className="font-mono font-bold text-[11px] text-emerald-300">v = -ωA·sin(...)</span>
                      <span className="text-[9.5px] text-slate-300">Vận Tốc (v - t)</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('phys_shm_acceleration');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'phys_shm_acceleration'
                          ? 'bg-cyan-500 text-slate-950 font-black border-cyan-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                      title="Gia tốc dao động a = -ω²x (ngược pha so với x)"
                    >
                      <span className="font-mono font-bold text-[11px] text-rose-300">a = -ω²x</span>
                      <span className="text-[9.5px] text-slate-300">Gia Tốc (a - t)</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('phys_shm_energy');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'phys_shm_energy'
                          ? 'bg-cyan-500 text-slate-950 font-black border-cyan-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                      title="Biểu đồ Động năng Wđ và Thế năng Wt biến thiên tuần hoàn chu kỳ T/2"
                    >
                      <span className="font-mono font-bold text-[11px] text-amber-300">Wđ & Wt (Năng lượng)</span>
                      <span className="text-[9.5px] text-slate-300">Tuần hoàn T/2</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('phys_shm_damped');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'phys_shm_damped'
                          ? 'bg-cyan-500 text-slate-950 font-black border-cyan-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                      title="Dao động tắt dần với biên độ giảm dần theo thời gian"
                    >
                      <span className="font-mono font-bold text-[11px] text-purple-300">A(t) Giảm Dần</span>
                      <span className="text-[9.5px] text-slate-300">Dao Động Tắt Dần</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('phys_projectile');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all ${
                        activeTool === 'phys_projectile'
                          ? 'bg-cyan-500 text-slate-950 font-black border-cyan-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                      title="Quỹ đạo chuyển động ném ngang / ném xiên dạng Parabol"
                    >
                      <span className="font-mono font-bold text-[11px] text-orange-300">Ném Ngang / Xiên</span>
                      <span className="text-[9.5px] text-slate-300">Quỹ Đạo Parabol</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTool('phys_wave');
                        setShowFunctionPicker(false);
                      }}
                      className={`p-2 rounded-2xl text-xs flex flex-col items-center gap-0.5 border transition-all col-span-2 sm:col-span-3 ${
                        activeTool === 'phys_wave'
                          ? 'bg-cyan-500 text-slate-950 font-black border-cyan-300 shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                      }`}
                      title="Sóng dừng trên sợi dây với các nút sóng và bụng sóng rõ rệt"
                    >
                      <div className="flex items-center gap-1.5">
                        <Waves className="w-3.5 h-3.5 text-cyan-300" />
                        <span className="font-mono font-bold text-[11px] text-cyan-200">Sóng Dừng (Bụng Sóng & Nút Sóng)</span>
                      </div>
                      <span className="text-[9.5px] text-slate-300">Mô hình bó sóng 2 đầu cố định</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-white/20 mx-0.5 shrink-0" />

          {/* Chalk Color Picker (Gom gọn: Không hiển thị 3 màu ra ngoài, không hiển thị tên màu) */}
          <div className="relative shrink-0">
            <button
              onClick={() => {
                setShowColorPopover((prev) => !prev);
                setShowSizePopover(false);
                setShowShapePicker(false);
                setShowFunctionPicker(false);
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
                  boxShadow: (activeColor === '#ccff00' || activeColor === '#ff007f' || activeColor === '#00ffff')
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
                      BẢNG MÀU PHẤN VIẾT BẢNG (14 MÀU)
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

                {/* 14 MÀU PHẤN TIÊU CHUẨN */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    MÀU PHẤN BẢNG TIÊU CHUẨN SƯ PHẠM
                  </span>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar-none">
                    {chalkPalette.map((cp) => (
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
                          className="w-6 h-6 rounded-full border border-white/70 shadow-inner"
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

          <div className="h-5 w-px bg-white/20 mx-0.5 shrink-0" />

          {/* Stroke Size Selector - Gom chung 2p, 4p, 6p, 8p, 12p, 14p, 50p thành 1 nút, mặc định 2p */}
          <div className="relative shrink-0">
            <button
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
                    <X className="w-3 h-3" />
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
                className="p-2 rounded-xl bg-amber-500/80 hover:bg-amber-500 text-white ml-1 cursor-pointer"
                title="Vòng quay gọi học sinh ngẫu nhiên"
              >
                <Dices className="w-4 h-4" />
              </button>
            )}

            {/* Thu gọn thanh công cụ để ngắm trọn vẹn mặt bảng xanh như ảnh chụp */}
            <button
              onClick={() => setIsDockCollapsed(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ml-0.5"
              title="Thu gọn thanh công cụ để ngắm trọn vẹn mặt bảng"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
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

      {/* VIRTUAL MATHTYPE KEYBOARD & GRAPH PLOTTER MODAL (SEPARATED STATE FOR ZERO-LATENCY INPUT) */}
      <VirtualMathKeyboard
        isOpen={showEquationModal}
        initialFormula={equationInput}
        isEditing={Boolean(editingEquationStrokeId)}
        onClose={() => {
          setShowEquationModal(false);
          setEditingEquationStrokeId(null);
        }}
        onApply={(formula) => {
          setEquationInput(formula);
          setShowEquationModal(false);
          setEditingEquationStrokeId(null);
          handleApplyEquationGraph(formula);
        }}
      />

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
