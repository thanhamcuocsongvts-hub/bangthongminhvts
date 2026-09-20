import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Pen,
  Eraser,
  Sparkles,
  Layers,
  RotateCcw,
  AlertCircle,
  Check,
  MousePointer,
  Sun,
  Moon,
  Grid,
  Eye,
  FileText,
  Download,
  ExternalLink,
  HelpCircle,
  MonitorPlay,
  Share2,
  FileUp,
} from 'lucide-react';
import { LessonDoc, SlideItem } from '../types';
import JSZip from 'jszip';
import { init } from 'pptx-preview';
import { exportOriginalLessonFile } from '../utils/exportUtils';
import { MathFormulaRenderer } from './MathFormulaRenderer';
import { decodeXmlEntities, convertOmmlToLatex } from '../utils/fileParser';

/**
 * Ensures all text in PPTX rendered DOM has high contrast and is completely visible.
 * Solves the issue where PPTX text had matching white/transparent colors or zero opacity.
 */
function healSlideDom(container: HTMLElement | null) {
  if (!container) return;
  try {
    const textEls = container.querySelectorAll('p, span, div, text, tspan, a, h1, h2, h3, h4, h5, h6');
    textEls.forEach((node) => {
      const el = node as HTMLElement;
      // Skip pptx-preview toolbar buttons that we intentionally hide
      if (
        el.classList.contains('pptx-preview-wrapper-next') ||
        el.classList.contains('pptx-preview-wrapper-pre') ||
        el.classList.contains('pptx-preview-wrapper-pagination')
      ) {
        return;
      }

      const style = window.getComputedStyle(el);
      // If opacity was set to 0 or very faint by broken PPT animations, make it visible
      if (parseFloat(style.opacity || '1') < 0.2) {
        el.style.opacity = '1';
      }

      // Check text color contrast
      const col = style.color?.toLowerCase() || '';
      const isWhiteOrNearWhite =
        col.includes('rgb(255, 255, 255)') ||
        col.includes('rgba(255, 255, 255') ||
        col === '#fff' ||
        col === '#ffffff';

      if (isWhiteOrNearWhite) {
        // Inspect parent background
        let parent: HTMLElement | null = el.parentElement;
        let hasDarkBg = false;
        while (parent && parent !== container) {
          const bg = window.getComputedStyle(parent).backgroundColor;
          if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
            const rgb = bg.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
              const lum = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
              if (lum < 130) {
                hasDarkBg = true;
                break;
              }
            }
          }
          parent = parent.parentElement;
        }

        if (!hasDarkBg) {
          el.style.color = '#0f172a';
          el.style.textShadow = 'none';
        }
      }
    });
  } catch (e) {
    console.warn('healSlideDom notice:', e);
  }
}

interface PPTXViewerProps {
  url?: string;
  lesson?: LessonDoc;
  title?: string;
  onFullscreen?: () => void;
  onClose?: () => void;
}

export const PPTXViewer: React.FC<PPTXViewerProps> = ({
  url,
  lesson,
  title = 'Bài thuyết trình PowerPoint',
  onFullscreen,
  onClose,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingStatus, setLoadingStatus] = useState<string>('Đang nạp bài giảng PowerPoint...');
  const [error, setError] = useState<string | null>(null);

  // Slides data
  const [slides, setSlides] = useState<SlideItem[]>(() => lesson?.slides || []);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [totalSlides, setTotalSlides] = useState<number>(() => lesson?.slides?.length || 1);

  // Engine state: 'pptx-preview' (native openxml DOM), 'smart-deck' (high-contrast structured deck), 'office-iframe' (Office Web)
  const [renderEngine, setRenderEngine] = useState<'pptx-preview' | 'smart-deck' | 'office-iframe'>('pptx-preview');
  const [isLegacyPpt, setIsLegacyPpt] = useState<boolean>(false);

  // 75" TV presentation controls
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);
  const [blackoutMode, setBlackoutMode] = useState<'none' | 'black' | 'white'>('none');
  const [showControls, setShowControls] = useState<boolean>(true);
  const [slideTransition, setSlideTransition] = useState<'slide' | 'fade' | 'zoom'>('slide');
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev'>('next');
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [showTransitionToast, setShowTransitionToast] = useState<string | null>(null);

  // Sync slides data when lesson changes
  useEffect(() => {
    if (lesson?.slides && lesson.slides.length > 0) {
      setSlides(lesson.slides);
      setTotalSlides(lesson.slides.length);
    }
    setCurrentSlideIndex(0);
  }, [lesson?.id, lesson?.fileUrl]);

  // Pen / Annotation state
  const [isPenActive, setIsPenActive] = useState<boolean>(false);
  const [penColor, setPenColor] = useState<string>('#ef4444'); // Red default
  const [penWidth, setPenWidth] = useState<number>(4);
  const [isLaserActive, setIsLaserActive] = useState<boolean>(false);
  const [laserPos, setLaserPos] = useState<{ x: number; y: number } | null>(null);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const pptxMountRef = useRef<HTMLDivElement>(null);
  const previewerInstanceRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef<boolean>(false);
  const controlsTimeoutRef = useRef<any>(null);

  // Load and parse PPTX file
  useEffect(() => {
    let isCancelled = false;

    async function loadPresentation() {
      setLoading(true);
      setError(null);
      setLoadingStatus('Đang nạp dữ liệu PowerPoint (.pptx)...');

      try {
        let arrayBuffer: ArrayBuffer | null = null;
        const targetUrl = url || lesson?.fileUrl;

        if (!targetUrl) {
          if (lesson?.slides && lesson.slides.length > 0) {
            setSlides(lesson.slides);
            setTotalSlides(lesson.slides.length);
            setRenderEngine('smart-deck');
            setLoading(false);
            return;
          }
          throw new Error('Chưa có đường dẫn tệp hoặc nội dung bài giảng.');
        }

        // Fetch ArrayBuffer
        setLoadingStatus('Đang tải tệp trình chiếu...');
        const response = await fetch(targetUrl);
        if (!response.ok) {
          throw new Error(`Không thể nạp tệp từ máy chủ (Mã lỗi HTTP: ${response.status})`);
        }
        arrayBuffer = await response.arrayBuffer();

        if (isCancelled) return;

        // Check magic bytes
        const bytes = new Uint8Array(arrayBuffer);
        const isZip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04;
        const isOlePpt = bytes.length > 8 && bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0;

        if (isOlePpt && !isZip) {
          // Legacy PowerPoint 97-2003 binary format
          setIsLegacyPpt(true);
          setLoadingStatus('Đang xử lý tệp PowerPoint 97-2003 (.ppt)...');
          const extracted = extractTextFromBinaryPpt(bytes);
          if (extracted.length > 0) {
            const legacySlides: SlideItem[] = extracted.map((text, idx) => ({
              id: `ppt_legacy_${idx + 1}`,
              title: text.split('\n')[0] || `Slide ${idx + 1}`,
              subtitle: '',
              content: text.split('\n').slice(1).join('\n') || text,
            }));
            setSlides(legacySlides);
            setTotalSlides(legacySlides.length);
          }
          setRenderEngine('smart-deck');
          setLoading(false);
          return;
        }

        // It is an OpenXML PPTX file (or renamed .pptx)
        setIsLegacyPpt(false);
        setLoadingStatus('Đang phân tích cấu trúc slide & hiệu ứng...');

        // 1. Extract slides data using JSZip as reliable fallback/content provider
        try {
          const zip = await JSZip.loadAsync(arrayBuffer);
          const slideFiles = Object.keys(zip.files)
            .filter((f) => /^ppt\/slides\/slide\d+\.xml$/i.test(f))
            .sort((a, b) => {
              const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
              const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
              return numA - numB;
            });

          if (slideFiles.length > 0) {
            const extractedSlides: SlideItem[] = [];
            for (let i = 0; i < slideFiles.length; i++) {
              const rawXml = await zip.files[slideFiles[i]].async('text');
              const xml = convertOmmlToLatex(rawXml);
              const paragraphs: string[] = [];
              const formulas: string[] = [];

              const pRegex = /<a:p(?:\s+[^>]*)?>([\s\S]*?)<\/a:p>/gi;
              let pMatch;
              while ((pMatch = pRegex.exec(xml)) !== null) {
                const pXml = pMatch[1];
                const tRegex = /<a:t(?:\s+[^>]*)?>([\s\S]*?)<\/a:t>/gi;
                let tMatch;
                const textParts: string[] = [];
                while ((tMatch = tRegex.exec(pXml)) !== null) {
                  if (tMatch[1]) {
                    const decoded = decodeXmlEntities(tMatch[1]);
                    textParts.push(decoded);
                    if (decoded.includes('$')) {
                      formulas.push(decoded);
                    }
                  }
                }
                const paragraphText = textParts.join('').trim();
                if (paragraphText) paragraphs.push(paragraphText);
              }

              // Extract slide image if present
              let slideImg: string | undefined;
              try {
                const slideFileName = slideFiles[i].split('/').pop() || '';
                const relPath = `ppt/slides/_rels/${slideFileName}.rels`;
                if (zip.files[relPath]) {
                  const relXml = await zip.files[relPath].async('text');
                  const match = relXml.match(/Target="(?:\.\.\/)?media\/([^"]+)"/i);
                  if (match && match[1]) {
                    const mediaPath = `ppt/media/${match[1]}`;
                    if (zip.files[mediaPath]) {
                      const ext = match[1].split('.').pop()?.toLowerCase() || 'png';
                      const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
                      const b64 = await zip.files[mediaPath].async('base64');
                      slideImg = `data:${mime};base64,${b64}`;
                    }
                  }
                }
              } catch {}

              const slideTitle = paragraphs[0] || `Slide ${i + 1}`;
              const subtitle = paragraphs.length > 1 && paragraphs[1].length < 120 ? paragraphs[1] : '';
              const contentLines = subtitle ? paragraphs.slice(2) : paragraphs.slice(1);
              const content = contentLines.length > 0 ? contentLines.join('\n') : (paragraphs[0] || '');

              extractedSlides.push({
                id: `slide_${i + 1}`,
                title: slideTitle,
                subtitle,
                content,
                formula: formulas.length > 0 ? formulas.join(' ; ') : undefined,
                image: slideImg,
              });
            }

            if (extractedSlides.length > 0) {
              setSlides(extractedSlides);
              setTotalSlides(extractedSlides.length);
            }
          }
        } catch (zipErr) {
          console.warn('JSZip extraction notice:', zipErr);
        }

        // 2. Render visually using pptx-preview
        if (pptxMountRef.current && arrayBuffer) {
          setLoadingStatus('Đang kết xuất hình ảnh & bố cục slide chuẩn PowerPoint...');
          try {
            // Clean previous mount
            pptxMountRef.current.innerHTML = '';

            // Compute ideal dimensions based on container width & height (16:9 standard for 75" TV)
            const containerW = pptxMountRef.current.clientWidth || window.innerWidth;
            const containerH = pptxMountRef.current.clientHeight || (window.innerHeight - 90);

            let cWidth = containerW;
            let cHeight = Math.round((containerW * 9) / 16);

            if (cHeight > containerH) {
              cHeight = containerH;
              cWidth = Math.round((containerH * 16) / 9);
            }

            cWidth = Math.max(640, Math.min(1920, cWidth));
            cHeight = Math.max(360, Math.min(1080, cHeight));

            const previewer = init(pptxMountRef.current, {
              width: cWidth,
              height: cHeight,
              mode: 'slide',
            });

            await previewer.preview(arrayBuffer);
            previewerInstanceRef.current = previewer;

            // Injected styles to hide pptx-preview's unhandled buttons which caused jump
            const hideStyles = document.createElement('style');
            hideStyles.textContent = `
              .pptx-preview-wrapper-next,
              .pptx-preview-wrapper-pre,
              .pptx-preview-wrapper-pagination,
              .pptx-preview-wrapper-toolbar,
              .pptx-preview-wrapper button {
                display: none !important;
                visibility: hidden !important;
                pointer-events: none !important;
                opacity: 0 !important;
              }
              .pptx-preview-wrapper * {
                -webkit-font-smoothing: antialiased;
              }
            `;
            pptxMountRef.current.appendChild(hideStyles);

            // Heal text contrast and visibility
            healSlideDom(pptxMountRef.current);
            setTimeout(() => healSlideDom(pptxMountRef.current), 150);

            if (previewer.slideCount && previewer.slideCount > 0) {
              setTotalSlides(previewer.slideCount);
            }

            setRenderEngine('pptx-preview');
            setLoading(false);
            return;
          } catch (previewErr: any) {
            console.warn('pptx-preview failed, switching to SmartDeck renderer:', previewErr);
            // Fallback to high-contrast smart-deck
            setRenderEngine('smart-deck');
            setLoading(false);
          }
        } else {
          setRenderEngine('smart-deck');
          setLoading(false);
        }
      } catch (err: any) {
        console.error('PPTXViewer load error:', err);
        if (!isCancelled) {
          setError(err.message || 'Không thể nạp bài giảng PowerPoint.');
          // If we have slides already, don't block
          if (slides.length > 0) {
            setRenderEngine('smart-deck');
          }
          setLoading(false);
        }
      }
    }

    loadPresentation();

    return () => {
      isCancelled = true;
      if (previewerInstanceRef.current) {
        try {
          previewerInstanceRef.current.destroy?.();
        } catch {}
      }
    };
  }, [url, lesson?.fileUrl, lesson?.id]);

  // Clear pen canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Toggle transition style with toast confirmation
  const toggleSlideTransition = useCallback(() => {
    const order: Array<'slide' | 'fade' | 'zoom'> = ['slide', 'fade', 'zoom'];
    const currentIdx = order.indexOf(slideTransition);
    const nextTransition = order[(currentIdx + 1) % order.length];
    setSlideTransition(nextTransition);

    const labels = {
      slide: 'Hiệu ứng: Trượt Mượt (Slide)',
      fade: 'Hiệu ứng: Mờ Dần Êm Ái (Fade)',
      zoom: 'Hiệu ứng: Thu Phóng Sư Phạm (Zoom)',
    };
    setShowTransitionToast(labels[nextTransition]);
    setTimeout(() => setShowTransitionToast(null), 2000);
  }, [slideTransition]);

  // Handle slide change with smooth professional transitions
  const goToSlide = useCallback(
    (index: number) => {
      if (index < 0 || index >= totalSlides) return;
      if (index === currentSlideIndex) return;

      const direction = index > currentSlideIndex ? 'next' : 'prev';
      setSlideDirection(direction);
      setIsTransitioning(true);

      // If in pptx-preview mode, control previewer
      if (renderEngine === 'pptx-preview' && previewerInstanceRef.current) {
        try {
          previewerInstanceRef.current.renderSingleSlide?.(index);
          setTimeout(() => healSlideDom(pptxMountRef.current), 60);
          setTimeout(() => healSlideDom(pptxMountRef.current), 200);
        } catch (e) {
          console.warn('Previewer renderSingleSlide error:', e);
        }
      }

      setCurrentSlideIndex(index);
      clearCanvas();

      setTimeout(() => {
        setIsTransitioning(false);
      }, 320);
    },
    [currentSlideIndex, renderEngine, totalSlides, clearCanvas]
  );

  const nextSlide = useCallback(() => {
    if (currentSlideIndex < totalSlides - 1) {
      goToSlide(currentSlideIndex + 1);
    }
  }, [currentSlideIndex, totalSlides, goToSlide]);

  const prevSlide = useCallback(() => {
    if (currentSlideIndex > 0) {
      goToSlide(currentSlideIndex - 1);
    }
  }, [currentSlideIndex, goToSlide]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'PageDown':
          e.preventDefault();
          nextSlide();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          prevSlide();
          break;
        case 'Home':
          e.preventDefault();
          goToSlide(0);
          break;
        case 'End':
          e.preventDefault();
          goToSlide(totalSlides - 1);
          break;
        case 'b':
        case 'B':
          setBlackoutMode((prev) => (prev === 'black' ? 'none' : 'black'));
          break;
        case 'w':
        case 'W':
          setBlackoutMode((prev) => (prev === 'white' ? 'none' : 'white'));
          break;
        case 'p':
        case 'P':
          setIsPenActive((prev) => !prev);
          break;
        case 'l':
        case 'L':
          setIsLaserActive((prev) => !prev);
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'Escape':
          if (blackoutMode !== 'none') setBlackoutMode('none');
          if (isPenActive) setIsPenActive(false);
          if (showThumbnails) setShowThumbnails(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide, goToSlide, totalSlides, blackoutMode, isPenActive, showThumbnails]);

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    const target = containerRef.current;
    if (!target) return;

    if (!document.fullscreenElement) {
      target.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
    onFullscreen?.();
  };

  // Sync native fullscreen events
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Controls auto-hide on inactivity
  const handleMouseMove = (e: React.MouseEvent) => {
    setShowControls(true);
    if (isLaserActive) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setLaserPos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    }
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (!isPenActive) {
        setShowControls(false);
      }
    }, 4000);
  };

  // Live Canvas Drawing Handlers
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPenActive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    ctx.beginPath();
    ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !isPenActive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  // Adjust canvas size to container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && containerRef.current) {
      canvas.width = containerRef.current.clientWidth || 1280;
      canvas.height = containerRef.current.clientHeight || 720;
    }
  }, [isFullscreen]);

  const currentSlide: SlideItem = slides[currentSlideIndex] || {
    id: 'empty',
    title: title || 'Slide Trình Chiếu',
    subtitle: '',
    content: 'Đang hiển thị nội dung slide PowerPoint...',
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`w-full h-full bg-slate-950 text-white relative select-none overflow-hidden flex flex-col items-center justify-center ${
        isFullscreen ? 'fixed inset-0 z-[9999]' : 'rounded-2xl border border-slate-800 shadow-2xl'
      }`}
    >
      {/* Blackout / Whiteout screens (PowerPoint feature B/W) */}
      {blackoutMode === 'black' && (
        <div
          onClick={() => setBlackoutMode('none')}
          className="absolute inset-0 z-50 bg-black flex items-center justify-center cursor-pointer"
        >
          <span className="text-slate-600 text-sm font-mono animate-pulse">
            [Màn hình Đen - Bấm phím 'B' hoặc chạm vào màn hình để quay lại]
          </span>
        </div>
      )}
      {blackoutMode === 'white' && (
        <div
          onClick={() => setBlackoutMode('none')}
          className="absolute inset-0 z-50 bg-white flex items-center justify-center cursor-pointer"
        >
          <span className="text-slate-400 text-sm font-mono animate-pulse">
            [Màn hình Trắng - Bấm phím 'W' hoặc chạm vào màn hình để quay lại]
          </span>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/20 border-2 border-orange-500/40 flex items-center justify-center animate-pulse">
              <MonitorPlay className="w-8 h-8 text-orange-500 animate-bounce" />
            </div>
            <Loader2 className="w-8 h-8 text-orange-400 animate-spin absolute -top-1 -right-1" />
          </div>
          <h3 className="text-xl font-black text-white mb-2">Trình Chiếu PowerPoint 75"</h3>
          <p className="text-sm font-medium text-slate-300 max-w-md mb-4">{loadingStatus}</p>
          <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 w-2/3 animate-pulse rounded-full" />
          </div>
        </div>
      )}

      {/* Legacy PPT Banner Notice */}
      {isLegacyPpt && !loading && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-amber-950/90 border border-amber-600/50 text-amber-200 px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg backdrop-blur-md max-w-xl">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Đang mở tệp định dạng <b>.ppt cũ (97-2003)</b>. Để có 100% đồ họa và hoạt ảnh gốc, Thầy/Cô hãy mở tệp trong
            PowerPoint rồi chọn <b>"Save As" (.pptx)</b> nhé!
          </span>
        </div>
      )}

      {/* Transition Notification Toast */}
      {showTransitionToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-amber-500/40 text-amber-300 px-4 py-2 rounded-2xl text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in duration-150">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{showTransitionToast}</span>
        </div>
      )}

      {/* MAIN PRESENTATION RENDER AREA */}
      <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
        {/* ENGINE 1: NATIVE OPENXML DOM RENDERER (pptx-preview) */}
        <div
          ref={pptxMountRef}
          className={`w-full h-full flex items-center justify-center transition-all duration-300 ease-out ${
            renderEngine === 'pptx-preview' ? 'opacity-100' : 'hidden opacity-0 pointer-events-none'
          } ${
            isTransitioning
              ? slideTransition === 'fade'
                ? 'opacity-0 scale-100'
                : slideTransition === 'zoom'
                ? 'opacity-25 scale-95'
                : slideDirection === 'next'
                ? '-translate-x-12 opacity-20'
                : 'translate-x-12 opacity-20'
              : 'opacity-100 translate-x-0 scale-100'
          }`}
          style={{
            maxHeight: '100%',
            maxWidth: '100%',
          }}
        />

        {/* ENGINE 2: SMART-DECK HIGH-CONTRAST VECTOR PRESENTATION (Optimized for 75" TV) */}
        {renderEngine === 'smart-deck' && (
          <div
            className={`w-full h-full max-w-6xl max-h-[90vh] aspect-video m-auto bg-gradient-to-br from-slate-900 via-indigo-950/90 to-slate-950 rounded-2xl border border-indigo-500/30 p-8 md:p-14 shadow-2xl flex flex-col justify-between relative transition-all duration-300 ease-out ${
              isTransitioning
                ? slideTransition === 'fade'
                  ? 'opacity-0 scale-100'
                  : slideTransition === 'zoom'
                  ? 'opacity-0 scale-90'
                  : slideDirection === 'next'
                  ? '-translate-x-16 opacity-0'
                  : 'translate-x-16 opacity-0'
                : 'opacity-100 translate-x-0 scale-100'
            }`}
          >
            {/* Slide Header */}
            <div>
              <div className="flex items-center justify-between border-b border-indigo-500/20 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold font-mono border border-orange-500/30">
                    Slide {currentSlideIndex + 1} / {totalSlides}
                  </span>
                  <span className="text-xs text-slate-400 font-bold truncate max-w-md">{title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-indigo-400 bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-500/30">
                    SmartBoard 75" 4K Mode
                  </span>
                </div>
              </div>

              <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight mb-4 text-balance">
                {currentSlide.title}
              </h1>
              {currentSlide.subtitle && (
                <h2 className="text-lg md:text-2xl font-semibold text-indigo-300 mb-6">{currentSlide.subtitle}</h2>
              )}
            </div>

            {/* Slide Body Content & Media */}
            <div className="flex-1 overflow-y-auto custom-scrollbar my-4 pr-2 flex flex-col md:flex-row gap-6 items-center">
              <div className="flex-1 space-y-4 text-base md:text-xl text-slate-200 leading-relaxed font-sans w-full">
                {currentSlide.content.split('\n').map((line, lIdx) => {
                  if (!line.trim()) return null;
                  const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
                  const cleanLine = line.replace(/^[•\-▸]\s*/, '');
                  return (
                    <div key={lIdx} className="flex items-start gap-3">
                      <span className="text-orange-400 font-black text-xl leading-none mt-1 shrink-0">
                        {isBullet ? '•' : '▸'}
                      </span>
                      <div className="flex-1">
                        <MathFormulaRenderer text={cleanLine} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Render slide image/diagram if present */}
              {currentSlide.image && (
                <div className="shrink-0 max-w-sm md:max-w-md max-h-72 bg-slate-950/70 p-2 rounded-xl border border-indigo-500/30 flex items-center justify-center overflow-hidden shadow-xl">
                  <img
                    src={currentSlide.image}
                    alt="Slide diagram"
                    className="max-h-64 object-contain rounded-lg"
                  />
                </div>
              )}
            </div>

            {/* Presentation Navigation Hot Zones (Touch left 25% for prev, right 75% for next) */}
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                if (clickX < rect.width * 0.25) {
                  prevSlide();
                } else {
                  nextSlide();
                }
              }}
              className="absolute inset-0 z-10 cursor-pointer pointer-events-auto opacity-0"
              title="Chạm bên trái để lùi slide, chạm bên phải để sang slide tiếp"
            />

            {/* Slide Footer */}
            <div className="pt-4 border-t border-indigo-500/20 flex items-center justify-between text-xs text-slate-500 font-mono">
              <span>{title}</span>
              <span>
                Trang {currentSlideIndex + 1} của {totalSlides}
              </span>
            </div>
          </div>
        )}

        {/* ENGINE 3: OFFICE WEB VIEWER (Online fallback iframe) */}
        {renderEngine === 'office-iframe' && url && (
          <iframe
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
            className="w-full h-full border-none"
            title="Office Online Viewer"
            allowFullScreen
          />
        )}

        {/* FLOATING FORMULA BAR (Shows extracted KaTeX math formulas when in pptx-preview mode) */}
        {renderEngine === 'pptx-preview' && currentSlide?.formula && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[92%] bg-slate-950/95 border border-indigo-500/50 backdrop-blur-xl rounded-2xl px-4 py-2.5 shadow-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 overflow-x-auto custom-scrollbar flex-1 pr-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-bold text-xs text-indigo-300 font-mono shrink-0">Công Thức:</span>
              <div className="text-white text-sm">
                <MathFormulaRenderer text={currentSlide.formula} />
              </div>
            </div>
            <button
              onClick={() => setRenderEngine('smart-deck')}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold shrink-0 transition-colors shadow-sm"
              title="Chuyển sang chế độ SmartDeck 4K để xem toàn bộ công thức và slide cực nét"
            >
              Xem 4K KaTeX
            </button>
          </div>
        )}

        {/* LIVE PEN DRAWING CANVAS OVERLAY */}
        <canvas
          ref={canvasRef}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          className={`absolute inset-0 z-30 touch-none ${
            isPenActive ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
          }`}
        />

        {/* LASER POINTER OVERLAY */}
        {isLaserActive && laserPos && (
          <div
            className="absolute pointer-events-none z-40 transition-transform duration-75 ease-out"
            style={{
              left: `${laserPos.x}px`,
              top: `${laserPos.y}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="w-5 h-5 rounded-full bg-red-500 shadow-[0_0_15px_#ef4444] animate-ping opacity-75" />
            <div className="w-3.5 h-3.5 rounded-full bg-red-400 shadow-[0_0_10px_#ef4444] absolute inset-0 m-auto border-2 border-white" />
          </div>
        )}
      </div>

      {/* FLOATING PRESENTATION TOOLBAR (75" TOUCH-FRIENDLY) */}
      <div
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 flex items-center gap-2 bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 p-2 rounded-2xl shadow-2xl ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {/* Previous Slide Button */}
        <button
          onClick={prevSlide}
          disabled={currentSlideIndex === 0}
          className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-white font-bold transition-all active:scale-95 cursor-pointer shadow-md"
          title="Slide Trước (Mũi tên trái / PageUp)"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Slide Counter & Quick Jumper */}
        <button
          onClick={() => setShowThumbnails(!showThumbnails)}
          className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-sm font-mono font-black text-amber-400 transition-all flex items-center gap-2 cursor-pointer"
          title="Xem danh sách tất cả slide (Grid)"
        >
          <Grid className="w-4 h-4 text-slate-400" />
          <span>
            {currentSlideIndex + 1} / {totalSlides}
          </span>
        </button>

        {/* Next Slide Button */}
        <button
          onClick={nextSlide}
          disabled={currentSlideIndex >= totalSlides - 1}
          className="p-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-30 disabled:pointer-events-none text-white font-bold transition-all active:scale-95 cursor-pointer shadow-md shadow-orange-600/30"
          title="Slide Tiếp Theo (Mũi tên phải / Space / PageDown)"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        <div className="w-px h-6 bg-slate-700 mx-1" />

        {/* Pen / Annotation Tool */}
        <button
          onClick={() => {
            setIsPenActive(!isPenActive);
            if (isLaserActive) setIsLaserActive(false);
          }}
          className={`p-2.5 rounded-xl font-bold transition-all cursor-pointer ${
            isPenActive
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40 ring-2 ring-rose-400'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
          title="Bút vẽ ghi chú lên slide (Phím 'P')"
        >
          <Pen className="w-5 h-5" />
        </button>

        {/* Pen color picker & clear when pen is active */}
        {isPenActive && (
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            {['#ef4444', '#eab308', '#22c55e', '#06b6d4', '#ffffff'].map((color) => (
              <button
                key={color}
                onClick={() => setPenColor(color)}
                className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                  penColor === color ? 'scale-125 ring-2 ring-white' : 'opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
            <button
              onClick={clearCanvas}
              className="p-1 rounded text-slate-400 hover:text-white"
              title="Xóa nét vẽ"
            >
              <Eraser className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Laser Pointer Tool */}
        <button
          onClick={() => {
            setIsLaserActive(!isLaserActive);
            if (isPenActive) setIsPenActive(false);
          }}
          className={`p-2.5 rounded-xl font-bold transition-all cursor-pointer ${
            isLaserActive
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/40 ring-2 ring-red-400'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
          title="Đèn Laser chỉ điểm (Phím 'L')"
        >
          <MousePointer className="w-5 h-5" />
        </button>

        {/* Blackout toggle (B) */}
        <button
          onClick={() => setBlackoutMode((prev) => (prev === 'black' ? 'none' : 'black'))}
          className={`p-2.5 rounded-xl font-bold transition-all cursor-pointer ${
            blackoutMode === 'black' ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
          title="Màn hình Đen - Tập trung chú ý (Phím 'B')"
        >
          <Moon className="w-5 h-5" />
        </button>

        {/* Slide Transition Selector (Fade / Slide / Zoom) */}
        <button
          onClick={toggleSlideTransition}
          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          title="Đổi hiệu ứng chuyển trang khi bấm Next/Prev (Trượt / Fade Mờ Dần / Zoom)"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline">
            {slideTransition === 'fade'
              ? 'Hiệu ứng: Fade'
              : slideTransition === 'zoom'
              ? 'Hiệu ứng: Zoom'
              : 'Hiệu ứng: Trượt'}
          </span>
        </button>

        {/* Engine switcher toggle */}
        <button
          onClick={() =>
            setRenderEngine((prev) => (prev === 'pptx-preview' ? 'smart-deck' : 'pptx-preview'))
          }
          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
          title="Đổi chế độ kết xuất (Native OpenXML vs SmartDeck 4K)"
        >
          <Layers className="w-4 h-4 text-indigo-400" />
          <span className="hidden sm:inline">
            {renderEngine === 'pptx-preview' ? 'Bản Gốc PPTX' : 'SmartDeck 4K'}
          </span>
        </button>

        {/* Download original PPTX */}
        {lesson && (
          <button
            onClick={() => exportOriginalLessonFile(lesson)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold transition-all cursor-pointer"
            title={`Tải về máy tệp gốc: ${lesson.fileName || lesson.title}`}
          >
            <Download className="w-5 h-5 text-orange-400" />
          </button>
        )}

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold transition-all cursor-pointer"
          title="Toàn màn hình Tivi 75 inch (Phím 'F')"
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </div>

      {/* THUMBNAIL DRAWER / MODAL */}
      {showThumbnails && (
        <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col p-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
            <div className="flex items-center gap-3">
              <Grid className="w-6 h-6 text-orange-500" />
              <h3 className="text-xl font-black text-white">Danh Sách Slide ({totalSlides} slide)</h3>
            </div>
            <button
              onClick={() => setShowThumbnails(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm cursor-pointer"
            >
              Đóng
            </button>
          </div>

          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 custom-scrollbar p-2">
            {Array.from({ length: Math.max(totalSlides, slides.length) }).map((_, idx) => {
              const s = slides[idx] || {
                id: `slide_${idx}`,
                title: `Slide ${idx + 1}`,
                subtitle: '',
                content: 'Chạm để trình chiếu slide này',
              };
              return (
                <button
                  key={s.id || idx}
                  onClick={() => {
                    goToSlide(idx);
                    setShowThumbnails(false);
                  }}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between aspect-video ${
                    currentSlideIndex === idx
                      ? 'bg-indigo-900/70 border-indigo-500 ring-2 ring-indigo-400 shadow-xl'
                      : 'bg-slate-900/90 border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div>
                    <span className="text-[11px] font-mono font-bold text-orange-400 uppercase">
                      Slide {idx + 1}
                    </span>
                    <h4 className="text-sm font-bold text-white line-clamp-2 mt-1">{s.title}</h4>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-2">{s.content || s.subtitle}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {/* PPTX OpenXML Slide Styles */}
      <style>{`
        .pptx-preview-wrapper {
          background: #020617 !important;
          margin: auto !important;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7) !important;
          border-radius: 8px !important;
          position: relative !important;
          overflow: hidden !important;
        }
        .pptx-preview-slide-wrapper {
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5) !important;
        }
        .pptx-preview-wrapper .text-block,
        .pptx-preview-wrapper .shape-wrapper {
          user-select: none;
        }
        .pptx-preview-wrapper-next,
        .pptx-preview-wrapper-pre,
        .pptx-preview-wrapper-pagination,
        .pptx-preview-wrapper-toolbar,
        .pptx-preview-wrapper button {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
          opacity: 0 !important;
        }
      `}</style>
    </div>
  );
};

// Helper: Extract text from legacy PowerPoint 97-2003 binary files
function extractTextFromBinaryPpt(bytes: Uint8Array): string[] {
  const strings: string[] = [];
  let currentAscii = '';

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if ((b >= 32 && b <= 126) || b === 10 || b === 13) {
      currentAscii += String.fromCharCode(b);
    } else {
      if (currentAscii.trim().length >= 5 && !/^(Arial|Calibri|Times|Font|Default|Root|Current)/i.test(currentAscii.trim())) {
        strings.push(currentAscii.trim());
      }
      currentAscii = '';
    }
  }

  // UTF-16LE extraction (Vietnamese / Unicode text)
  let currentUtf16 = '';
  for (let i = 0; i < bytes.length - 1; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    if ((code >= 32 && code <= 126) || (code >= 0x00c0 && code <= 0x1ef9) || code === 10 || code === 13) {
      currentUtf16 += String.fromCharCode(code);
    } else {
      if (currentUtf16.trim().length >= 5 && !/^(Arial|Calibri|Times|Segoe)/i.test(currentUtf16.trim())) {
        strings.push(currentUtf16.trim());
      }
      currentUtf16 = '';
    }
  }

  const combined = Array.from(new Set([...strings, ...currentUtf16]));
  return combined.filter((s) => s.length > 10 && !s.includes('___'));
}
