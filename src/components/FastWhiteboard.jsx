import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * FastWhiteboard.jsx - High-Performance 4K Interactive Whiteboard Component
 * 
 * Thiết kế chuẩn chuyên gia Web Graphics cho màn hình tương tác kích thước lớn (75" - 86", 4K, 120Hz)
 * Giải quyết triệt để 3 vấn đề:
 * 1. Zero Latency (Khử độ trễ): { desynchronized: true } + getCoalescedEvents() + vẽ trực tiếp qua useRef (không useState)
 * 2. 4K Sharpness (Khử răng cưa): Xử lý devicePixelRatio chuẩn xác
 * 3. Smooth & Beautiful (Nét thanh nét đậm): Midpoint Quadratic Bézier curve + e.pressure
 */

export const FastWhiteboard = ({
  color = '#ffffff',
  baseSize = 4,
  className = '',
  theme = 'chalkboard',
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  // Lưu trữ dữ liệu nét vẽ hoàn toàn trong Ref (KHÔNG GÂY RE-RENDER DOM)
  const strokesRef = useRef([]);
  const currentPointsRef = useRef([]);
  const isDrawingRef = useRef(false);
  const activePointerIdRef = useRef(null);

  // Điểm trung điểm phục vụ nội suy đường cong Bézier liên tục
  const lastMidPointRef = useRef(null);
  const lastWidthRef = useRef(baseSize);

  // Tham chiếu giá trị màu và nét vẽ mới nhất
  const colorRef = useRef(color);
  const baseSizeRef = useRef(baseSize);
  colorRef.current = color;
  baseSizeRef.current = baseSize;

  // State chỉ dành riêng cho thanh công cụ UI (Toolbar buttons)
  const [activeColor, setActiveColor] = useState(color);
  const [activeSize, setActiveSize] = useState(baseSize);
  const [canUndo, setCanUndo] = useState(false);

  /**
   * 1. KHỞI TẠO CANVAS 4K & DESYNCHRONIZED (BYPASS BROWSER COMPOSITOR)
   */
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    // Kích thước Pixel vật lý thực tế trên Tivi 4K
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    // Kích thước CSS Logic
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    /**
     * THUỘC TÍNH SỐ 1: desynchronized: true
     * Bỏ qua cơ chế Compositor tiêu chuẩn của trình duyệt, xuất tín hiệu vẽ trực tiếp ra Front-Buffer
     * Giảm thời gian trễ từ hàng chục mili-giây xuống chỉ còn ~3-5ms!
     */
    const ctx = canvas.getContext('2d', {
      desynchronized: true,
      alpha: true,
      willReadFrequently: false,
    });

    if (!ctx) return;
    ctxRef.current = ctx;

    // Scale theo tỉ lệ DPR để giữ độ sắc nét 4K tuyệt đối, không vỡ hạt
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    redrawCanvas();
  }, []);

  /**
   * Tính toán độ dày nét thanh nét đậm theo lực nhấn (Pressure) và tốc độ lia bút
   */
  const computeStrokeWidth = (p1, p2, base) => {
    const rawPressure = p2.pressure > 0.01 ? p2.pressure : 0.5;
    const normPressure = Math.max(0.18, Math.min(1.0, rawPressure));

    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const dt = Math.max(1, p2.time - p1.time);
    const velocity = dist / dt;

    // Lia nhanh: nét hơi vuốt thanh; Nhấn mạnh: nét đậm đà rõ ràng
    const velocityFactor = Math.max(0.75, Math.min(1.15, 1.08 - velocity * 0.03));
    const targetWidth = base * (0.65 + normPressure * 0.8) * velocityFactor;

    // Lọc mượt Low-Pass Filter để bề dày nét chuyển tiếp êm ái
    const smoothedWidth = lastWidthRef.current * 0.65 + targetWidth * 0.35;
    lastWidthRef.current = smoothedWidth;
    return Math.max(1.5, smoothedWidth);
  };

  /**
   * Vẽ lại toàn bộ nét đã lưu
   */
  const redrawCanvas = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    ctx.scale(dpr, dpr);

    for (const stroke of strokesRef.current) {
      const { points, color: strokeColor, baseSize: bSize } = stroke;
      if (points.length === 0) continue;

      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = strokeColor;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (points.length === 1) {
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, Math.max(1.8, bSize / 2), 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      if (points.length === 2) {
        ctx.beginPath();
        ctx.lineWidth = bSize;
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.stroke();
        continue;
      }

      let prevMid = {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      };

      ctx.beginPath();
      ctx.lineWidth = bSize;
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(prevMid.x, prevMid.y);
      ctx.stroke();

      for (let i = 1; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const nextMid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

        const width = computeStrokeWidth(p1, p2, bSize);
        ctx.beginPath();
        ctx.lineWidth = width;
        ctx.moveTo(prevMid.x, prevMid.y);
        ctx.quadraticCurveTo(p1.x, p1.y, nextMid.x, nextMid.y);
        ctx.stroke();

        prevMid = nextMid;
      }

      const last = points[points.length - 1];
      ctx.beginPath();
      ctx.lineWidth = bSize * 0.7;
      ctx.moveTo(prevMid.x, prevMid.y);
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }

    ctx.restore();
  }, []);

  /**
   * 2. XỬ LÝ POINTER DOWN
   */
  const handlePointerDown = (e) => {
    if (activePointerIdRef.current !== null && activePointerIdRef.current !== e.pointerId) {
      return;
    }
    activePointerIdRef.current = e.pointerId;

    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
    }

    const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
    const rawPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
      time: performance.now(),
    };

    isDrawingRef.current = true;
    currentPointsRef.current = [rawPoint];
    lastMidPointRef.current = { x: rawPoint.x, y: rawPoint.y };
    lastWidthRef.current = baseSizeRef.current;

    // Render ngay lập tức điểm chạm đầu tiên (Zero-delay visual feedback)
    const ctx = ctxRef.current;
    if (ctx) {
      ctx.save();
      ctx.fillStyle = colorRef.current;
      ctx.beginPath();
      const r = Math.max(1.8, baseSizeRef.current / 2);
      ctx.arc(rawPoint.x, rawPoint.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  /**
   * 3. XỬ LÝ POINTER MOVE: COALESCED EVENTS + DIRECT DOM MUTATION + BEZIER
   */
  const handlePointerMove = (e) => {
    if (!isDrawingRef.current || e.pointerId !== activePointerIdRef.current) return;

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();

    /**
     * BẮT BUỘC: getCoalescedEvents()
     * Đọc toàn bộ các mẫu tọa độ phần cứng tần số cao (120Hz/240Hz)
     * Tránh việc ngòi bút đi nhanh thì nét chữ bị gãy góc thành các đoạn thẳng thô ráp
     */
    const coalescedList = [];
    const nativeEvt = e.nativeEvent;

    if (nativeEvt && typeof nativeEvt.getCoalescedEvents === 'function') {
      const events = nativeEvt.getCoalescedEvents();
      if (Array.isArray(events) && events.length > 0) {
        for (const ce of events) {
          coalescedList.push({
            x: ce.clientX - rect.left,
            y: ce.clientY - rect.top,
            pressure: ce.pressure > 0 ? ce.pressure : 0.5,
            time: performance.now(),
          });
        }
      }
    }

    if (coalescedList.length === 0) {
      coalescedList.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pressure: e.pressure > 0 ? e.pressure : 0.5,
        time: performance.now(),
      });
    }

    ctx.save();
    ctx.strokeStyle = colorRef.current;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const pt of coalescedList) {
      const pts = currentPointsRef.current;
      const lastPt = pts[pts.length - 1];

      const dist = Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y);
      if (dist < 0.25) continue;

      pts.push(pt);

      if (pts.length === 2) {
        const width = computeStrokeWidth(pts[0], pts[1], baseSizeRef.current);
        ctx.beginPath();
        ctx.lineWidth = width;
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();

        lastMidPointRef.current = {
          x: (pts[0].x + pt.x) / 2,
          y: (pts[0].y + pt.y) / 2,
        };
      } else if (pts.length >= 3) {
        /**
         * THUẬT TOÁN MIDPOINT QUADRATIC BÉZIER:
         * prevMid -> pPrev (Control Point) -> currentMid
         * Nét chữ uốn lượn liên tục, triệt tiêu hoàn toàn góc gãy khúc
         */
        const pPrev = pts[pts.length - 2];
        const currentMid = {
          x: (pPrev.x + pt.x) / 2,
          y: (pPrev.y + pt.y) / 2,
        };

        const width = computeStrokeWidth(pPrev, pt, baseSizeRef.current);
        ctx.beginPath();
        ctx.lineWidth = width;
        ctx.moveTo(lastMidPointRef.current.x, lastMidPointRef.current.y);
        ctx.quadraticCurveTo(pPrev.x, pPrev.y, currentMid.x, currentMid.y);
        ctx.stroke();

        lastMidPointRef.current = currentMid;
      }
    }

    ctx.restore();
  };

  /**
   * 4. XỬ LÝ POINTER UP / CANCEL
   */
  const handlePointerUp = (e) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (e && canvasRef.current) {
      try {
        canvasRef.current.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
    activePointerIdRef.current = null;

    if (currentPointsRef.current.length > 0) {
      strokesRef.current.push({
        points: [...currentPointsRef.current],
        color: colorRef.current,
        baseSize: baseSizeRef.current,
      });
      setCanUndo(true);
    }

    currentPointsRef.current = [];
    lastMidPointRef.current = null;
  };

  const handleClear = () => {
    strokesRef.current = [];
    redrawCanvas();
    setCanUndo(false);
  };

  const handleUndo = () => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current.pop();
    redrawCanvas();
    setCanUndo(strokesRef.current.length > 0);
  };

  useEffect(() => {
    initCanvas();
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      initCanvas();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [initCanvas]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none ${
        theme === 'chalkboard'
          ? 'bg-[#0b2e21]'
          : theme === 'whiteboard'
          ? 'bg-slate-100'
          : 'bg-[#121820]'
      } ${className}`}
      style={{ touchAction: 'none' }}
    >
      {/* Canvas 4K */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          touchAction: 'none',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
        className="absolute inset-0 w-full h-full cursor-crosshair z-10"
      />

      {/* Floating Toolbar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 shadow-2xl text-white">
        {/* Colors */}
        <div className="flex items-center gap-1.5 pr-2 border-r border-white/20">
          {[
            { label: 'Trắng', val: '#ffffff' },
            { label: 'Vàng phấn', val: '#fef08a' },
            { label: 'Hồng phấn', val: '#f472b6' },
            { label: 'Xanh lơ', val: '#38bdf8' },
            { label: 'Xanh lá', val: '#4ade80' },
          ].map((c) => (
            <button
              key={c.val}
              onClick={() => {
                setActiveColor(c.val);
                colorRef.current = c.val;
              }}
              style={{ backgroundColor: c.val }}
              className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                activeColor === c.val ? 'scale-125 border-cyan-400 ring-2 ring-white/50' : 'border-transparent'
              }`}
              title={c.label}
            />
          ))}
        </div>

        {/* Sizes */}
        <div className="flex items-center gap-1.5 px-2 border-r border-white/20">
          {[
            { label: 'Thanh', size: 2 },
            { label: 'Vừa', size: 4 },
            { label: 'Đậm', size: 8 },
            { label: 'Rất đậm', size: 14 },
          ].map((s) => (
            <button
              key={s.size}
              onClick={() => {
                setActiveSize(s.size);
                baseSizeRef.current = s.size;
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeSize === s.size ? 'bg-cyan-500 text-slate-950 shadow' : 'bg-white/10 hover:bg-white/20 text-slate-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleUndo}
          disabled={!canUndo}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-40 rounded-xl text-xs font-bold cursor-pointer transition-colors"
        >
          Hoàn tác
        </button>

        <button
          onClick={handleClear}
          className="px-3 py-1.5 bg-rose-500/80 hover:bg-rose-600 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow"
        >
          Xóa bảng
        </button>
      </div>
    </div>
  );
};

export default FastWhiteboard;
