/**
 * SmartBoard 75 Pro - Professional Whiteboard Stroke Smoothing & Calligraphy Engine
 * Implements Catmull-Rom spline interpolation, anti-jitter filtering,
 * velocity/pressure-based natural stroke dynamics, and stroke simplification.
 */

import { StrokePoint } from '../types';

/**
 * Adaptive Anti-Jitter Low-Pass Filter
 * Eliminates high-frequency touch noise from large infrared/capacitive TV frames
 * without introducing perceived latency.
 */
export function filterPointJitter(
  current: { x: number; y: number; pressure?: number; time?: number },
  previous?: { x: number; y: number; pressure?: number; time?: number }
): { x: number; y: number; pressure: number; time: number } {
  const now = current.time || performance.now();
  const rawPressure = current.pressure !== undefined && current.pressure > 0 ? current.pressure : 0.5;

  if (!previous) {
    return {
      x: current.x,
      y: current.y,
      pressure: rawPressure,
      time: now,
    };
  }

  const dt = Math.max(1, now - (previous.time || now));
  const dist = Math.hypot(current.x - previous.x, current.y - previous.y);
  const velocity = dist / dt; // pixels per millisecond

  // Dynamic alpha: for fast motions (flicks), respond instantly (alpha ~ 0.9).
  // For slow precision handwriting, smooth out hand tremor/sensor jitter (alpha ~ 0.6).
  const alpha = Math.min(0.92, Math.max(0.58, 0.55 + velocity * 0.25));

  return {
    x: previous.x + (current.x - previous.x) * alpha,
    y: previous.y + (current.y - previous.y) * alpha,
    pressure: previous.pressure + (rawPressure - previous.pressure) * 0.5,
    time: now,
  };
}

/**
 * Calculate natural velocity & pressure modulated stroke width
 * Emulates authentic chalk and fountain pen physics:
 * - "Thanh thoát, mượt mà": Nét thanh khi lia nhanh/chạm nhẹ, nét đậm khi đi chậm/chạm ấn
 * - BẢO ĐẢM KHÔNG BAO GIỜ MẤT NÉT KHI CHẠM NHẸ: Sàn kích thước tối thiểu bảo đảm luôn hiển thị rõ nét
 */
export function calculateDynamicStrokeWidth(
  baseSize: number,
  current: { x: number; y: number; pressure?: number; time?: number },
  previous?: { x: number; y: number; pressure?: number; time?: number; width?: number },
  isCalligraphy = false
): number {
  if (!previous) return Math.max(1.8, baseSize);

  const dt = Math.max(1, (current.time || performance.now()) - (previous.time || performance.now()));
  const dist = Math.hypot(current.x - previous.x, current.y - previous.y);
  const speed = dist / dt; // px/ms

  let targetWidth = baseSize;

  if (isCalligraphy) {
    // Calligraphy angle modulation (45 degree thick/thin nib physics)
    const angle = Math.atan2(current.y - previous.y, current.x - previous.x);
    // 45 degrees angle nib gives maximum contrast between upstrokes (nét thanh) and downstrokes (nét đậm)
    const angleFactor = Math.abs(Math.sin(angle - Math.PI / 4));
    const widthFactor = 0.70 + angleFactor * 0.55; // 0.70x to 1.25x

    // Speed modulation: faster = slightly sharper but never below visible threshold
    const speedFactor = Math.max(0.82, Math.min(1.20, 1.12 - speed * 0.10));
    targetWidth = baseSize * widthFactor * speedFactor;
  } else {
    // Natural chalk / ballpoint dynamics:
    // Faster strokes get slightly tapered (0.85x), slow steady strokes get full body (1.15x)
    const speedFactor = Math.max(0.85, Math.min(1.15, 1.10 - speed * 0.08));
    targetWidth = baseSize * speedFactor;
  }

  // Modulate with stylus/touch pressure:
  // KHẮC PHỤC TRIỆT ĐỂ: Khi chạm nhẹ (pressure ~ 0.01 - 0.2), giữ tỉ lệ nét thanh thoát 0.82x - 1.30x
  // Không bao giờ để nét bị teo nhỏ hoặc biến mất
  if (current.pressure !== undefined && current.pressure > 0 && current.pressure !== 0.5) {
    const clampedPressure = Math.max(0, Math.min(1, current.pressure));
    const pressureMultiplier = 0.82 + clampedPressure * 0.48; // 0.82x -> 1.30x
    targetWidth *= pressureMultiplier;
  }

  // Smooth width transition from previous point to avoid sudden jumps
  const prevWidth = previous.width || baseSize;
  const smoothedWidth = prevWidth * 0.60 + targetWidth * 0.40;

  // Bảo đảm sàn hiển thị: Tối thiểu 1.8px hoặc 75% baseSize
  const minFloor = Math.max(1.8, baseSize * 0.72);
  const maxCeil = Math.max(minFloor + 1, baseSize * 1.65);
  return Math.max(minFloor, Math.min(maxCeil, smoothedWidth));
}

/**
 * Ramer-Douglas-Peucker (RDP) algorithm for stroke simplification
 * Giữ nguyên các nét ngắn (dấu chấm, dấu phẩy, dấu tiếng Việt) để không bị nuốt mất nét
 */
export function simplifyPoints(points: StrokePoint[], epsilon = 0.65): StrokePoint[] {
  // Nét chấm, dấu thanh, nét ngắn (<= 4 điểm): KHÔNG làm suy giảm để giữ trọn vẹn nét chạm nhẹ
  if (points.length <= 4) return points;

  let maxDistance = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > maxDistance) {
      maxDistance = d;
      index = i;
    }
  }

  if (maxDistance > epsilon) {
    const recResults1 = simplifyPoints(points.slice(0, index + 1), epsilon);
    const recResults2 = simplifyPoints(points.slice(index), epsilon);
    return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
  } else {
    return [points[0], points[end]];
  }
}

function perpendicularDistance(point: StrokePoint, lineStart: StrokePoint, lineEnd: StrokePoint): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);

  const u = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (mag * mag);
  const clampedU = Math.max(0, Math.min(1, u));
  const projX = lineStart.x + clampedU * dx;
  const projY = lineStart.y + clampedU * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}

/**
 * Render an ultra-smooth spline path onto a 2D canvas context.
 * Uses mid-point quadratic/cubic bezier curves with round caps.
 */
export function drawSmoothSpline(
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  color: string,
  baseSize: number,
  options?: {
    isHighlighter?: boolean;
    isEraser?: boolean;
    isCalligraphy?: boolean;
    opacity?: number;
  }
) {
  if (!points || points.length === 0) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (options?.isEraser) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
    ctx.lineWidth = baseSize;
  } else if (options?.isHighlighter) {
    ctx.globalAlpha = options.opacity || 0.45;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = baseSize * 2.5;
  } else {
    ctx.globalAlpha = options?.opacity ?? 0.98;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = baseSize;
  }

  if (points.length === 1) {
    // Single touch/click dot
    const p = points[0];
    const r = (options?.isHighlighter ? baseSize * 2.5 : baseSize) / 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (points.length === 2) {
    const midX = (points[0].x + points[1].x) / 2;
    const midY = (points[0].y + points[1].y) / 2;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.quadraticCurveTo(points[0].x, points[0].y, midX, midY);
    ctx.quadraticCurveTo(points[1].x, points[1].y, points[1].x, points[1].y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Smooth continuous midpoint bezier curve
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
  }

  const last = points[points.length - 1];
  const secondLast = points[points.length - 2];
  ctx.quadraticCurveTo(secondLast.x, secondLast.y, last.x, last.y);
  ctx.stroke();

  ctx.restore();
}

/**
 * Extract bounding box image of handwritten strokes
 * Renders directly with high contrast (solid chalk on chalkboard background)
 * for 100% reliable, zero-artifact Gemini Vision handwriting recognition.
 */
/**
 * Trích xuất ảnh vùng chữ viết tay chuẩn OCR cao cấp (High-Precision B&W OffscreenCanvas)
 * 
 * KHẮC PHỤC TRIỆT ĐỂ LỖI API KHÔNG ĐỌC ĐƯỢC CHỮ (Yêu cầu 2):
 * - Nguyên nhân: Trước đây bị dính nền xanh bảng/trong suốt khiến API AI nhận diện bị mù.
 * - Giải pháp BẮT BUỘC:
 *   1. Tạo OffscreenCanvas ẩn, kích thước đúng bằng bounding box vừa quét (+ padding an toàn).
 *   2. BẮT BUỘC fill toàn bộ nền của OffscreenCanvas bằng màu TRẮNG (#FFFFFF).
 *   3. BẮT BUỘC cấu hình ctx.lineCap = 'round' và ctx.lineJoin = 'round'.
 *   4. BẮT BUỘC vẽ toàn bộ phần nét chữ đã cắt đè lên bằng màu ĐEN (#000000).
 *   5. Trích xuất canvas.toDataURL('image/png') để gửi cho API nhận diện với độ tương phản tuyệt đối 100%.
 */
export function cropStrokesToImage(
  canvas: HTMLCanvasElement | null,
  pointsOrStrokes: StrokePoint[] | Array<{ points?: StrokePoint[]; color?: string; size?: number; tool?: string }>,
  boardScrollX = 0,
  boardScrollY = 0,
  padding = 24,
  customBounds?: { minX: number; minY: number; maxX: number; maxY: number }
): {
  dataUrl: string;
  bounds: { minX: number; minY: number; width: number; height: number };
  actualBounds: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
} | null {
  if (!pointsOrStrokes || (pointsOrStrokes as any[]).length === 0) return null;

  // Chuẩn hóa thành danh sách các mảng điểm nét vẽ
  const strokeSegments: StrokePoint[][] = [];
  const allPoints: StrokePoint[] = [];

  if (Array.isArray(pointsOrStrokes) && pointsOrStrokes.length > 0) {
    if ('points' in pointsOrStrokes[0] && Array.isArray((pointsOrStrokes[0] as any).points)) {
      (pointsOrStrokes as Array<{ points?: StrokePoint[] }>).forEach((s) => {
        if (s.points && s.points.length > 0) {
          strokeSegments.push(s.points);
          allPoints.push(...s.points);
        }
      });
    } else {
      // Danh sách điểm liên tục
      const pts = pointsOrStrokes as StrokePoint[];
      strokeSegments.push(pts);
      allPoints.push(...pts);
    }
  }

  if (allPoints.length === 0) return null;

  // Luôn luôn tính toán Bounding Box THẬT sự của các nét vẽ từ allPoints để crop bám sát chữ, phóng to tối đa
  let sMinX = Infinity;
  let sMaxX = -Infinity;
  let sMinY = Infinity;
  let sMaxY = -Infinity;

  for (const p of allPoints) {
    if (p.x < sMinX) sMinX = p.x;
    if (p.x > sMaxX) sMaxX = p.x;
    if (p.y < sMinY) sMinY = p.y;
    if (p.y > sMaxY) sMaxY = p.y;
  }

  const minX = sMinX;
  const maxX = sMaxX;
  const minY = sMinY;
  const maxY = sMaxY;

  const strokeW = Math.max(1, maxX - minX);
  const strokeH = Math.max(1, maxY - minY);
  if (strokeW < 4 && strokeH < 4) return null;

  try {
    // 1. Tạo OffscreenCanvas ẩn kích thước bám sát nét chữ + padding an toàn
    const pad = Math.max(24, padding);
    const rawW = strokeW + pad * 2;
    const rawH = strokeH + pad * 2;

    // Chuẩn hóa độ phân giải tối ưu cho OCR nhận diện chữ viết tay (360px - 800px)
    const targetW = Math.max(360, Math.min(800, rawW * 1.5));
    const scale = targetW / rawW;
    const targetH = Math.max(140, Math.min(600, Math.round(rawH * scale)));

    let offscreen: HTMLCanvasElement;
    if (typeof document !== 'undefined') {
      offscreen = document.createElement('canvas');
      offscreen.width = targetW;
      offscreen.height = targetH;
    } else {
      offscreen = new (globalThis as any).OffscreenCanvas(targetW, targetH);
    }

    const offCtx = offscreen.getContext('2d', { alpha: false });
    if (!offCtx) return null;

    // BẮT BUỘC 1: Nền TRẮNG (#FFFFFF) tuyệt đối 100%
    offCtx.fillStyle = '#FFFFFF';
    offCtx.fillRect(0, 0, targetW, targetH);

    // BẮT BUỘC 2: Vẽ nét mực ĐEN (#000000) đậm rõ, đầu tròn, kể cả chữ viết xấu/vội vẫn rất sắc nét
    offCtx.save();
    offCtx.scale(scale, scale);
    offCtx.translate(-minX + pad, -minY + pad);
    offCtx.lineCap = 'round';
    offCtx.lineJoin = 'round';
    offCtx.strokeStyle = '#000000';
    offCtx.fillStyle = '#000000';
    offCtx.lineWidth = 5.0; // Nét mực đậm đà giúp AI nhận diện chữ xấu cực kỳ dễ dàng

    for (const segment of strokeSegments) {
      if (segment.length === 1) {
        // Nét chấm đơn lẻ (dấu chấm chữ i/j, dấu nặng, dấu chấm câu)
        offCtx.beginPath();
        offCtx.arc(segment[0].x, segment[0].y, 4.5, 0, Math.PI * 2);
        offCtx.fill();
      } else if (segment.length === 2) {
        // Nét gạch cực ngắn (dấu sắc, dấu huyền, dấu mũ)
        offCtx.beginPath();
        offCtx.arc(segment[0].x, segment[0].y, 3.2, 0, Math.PI * 2);
        offCtx.arc(segment[1].x, segment[1].y, 3.2, 0, Math.PI * 2);
        offCtx.fill();

        offCtx.beginPath();
        offCtx.moveTo(segment[0].x, segment[0].y);
        offCtx.lineTo(segment[1].x, segment[1].y);
        offCtx.stroke();
      } else if (segment.length > 2) {
        offCtx.beginPath();
        offCtx.moveTo(segment[0].x, segment[0].y);
        for (let i = 1; i < segment.length - 1; i++) {
          const xc = (segment[i].x + segment[i + 1].x) / 2;
          const yc = (segment[i].y + segment[i + 1].y) / 2;
          offCtx.quadraticCurveTo(segment[i].x, segment[i].y, xc, yc);
        }
        const last = segment[segment.length - 1];
        const prev = segment[segment.length - 2];
        offCtx.quadraticCurveTo(prev.x, prev.y, last.x, last.y);
        offCtx.stroke();
      }
    }
    offCtx.restore();

    // =========================================================================
    // BẮT BUỘC 4: Cuối cùng mới trích xuất canvas.toDataURL() để gửi cho API
    // Sử dụng PNG để giữ nguyên độ sắc nét nhị phân (đen - trắng tuyệt đối)
    // =========================================================================
    const dataUrl = offscreen.toDataURL('image/png');

    return {
      dataUrl,
      bounds: {
        minX: minX - pad / 2,
        minY: minY - pad / 2,
        width: Math.max(160, strokeW + pad),
        height: Math.max(50, strokeH + pad),
      },
      actualBounds: {
        minX,
        minY,
        maxX,
        maxY,
        width: strokeW,
        height: strokeH,
      },
    };
  } catch (err) {
    console.warn('cropStrokesToImage error:', err);
    return null;
  }
}

/**
 * Thuật toán nhận diện hình khối tự động (Auto-Shape Smart Recognition)
 * Phân tích nét vẽ tay phác thảo của giáo viên để tự động chuẩn hóa thành:
 * Hình tròn, Hình chữ nhật, Hình elip, Hình tam giác, Đường thẳng hoặc Mũi tên.
 */
export function recognizeGeometricShape(points: StrokePoint[]): {
  tool: 'circle' | 'rectangle' | 'ellipse' | 'line' | 'arrow';
  points: StrokePoint[];
  label: string;
} | null {
  if (!points || points.length < 5) return null;

  // 1. Tính toán Bounding Box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let totalPerimeter = 0;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (i > 0) {
      totalPerimeter += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
    }
  }

  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 20 && h < 20) return null; // Quá nhỏ để thành hình

  const startPt = points[0];
  const endPt = points[points.length - 1];
  const closeDist = Math.hypot(startPt.x - endPt.x, startPt.y - endPt.y);
  const isClosed = closeDist < Math.max(45, totalPerimeter * 0.28);

  // Trọng tâm
  const cx = points.reduce((acc, p) => acc + p.x, 0) / points.length;
  const cy = points.reduce((acc, p) => acc + p.y, 0) / points.length;

  // 2. Kiểm tra nếu là đường thẳng hoặc mũi tên (hình mở)
  if (!isClosed) {
    const chord = Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y);
    const straightness = chord / (totalPerimeter || 1);

    if (straightness > 0.85) {
      // Kiểm tra có nét gấp nhọn ở đuôi (mũi tên)
      const lastSegmentLen = Math.hypot(endPt.x - points[Math.max(0, points.length - 4)].x, endPt.y - points[Math.max(0, points.length - 4)].y);
      if (lastSegmentLen > 15 && straightness < 0.92) {
        return {
          tool: 'arrow',
          points: [startPt, endPt],
          label: 'Mũi Tên Thẳng',
        };
      }
      return {
        tool: 'line',
        points: [startPt, endPt],
        label: 'Đường Thẳng',
      };
    }
  }

  // 3. Hình khép kín: Tính độ phân tán bán kính từ tâm
  const radii = points.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const avgRadius = radii.reduce((acc, r) => acc + r, 0) / radii.length;
  const varianceR = Math.sqrt(radii.reduce((acc, r) => acc + Math.pow(r - avgRadius, 2), 0) / radii.length) / (avgRadius || 1);

  const aspectRatio = w / (h || 1);

  // A. Hình tròn: Bán kính đồng đều, tỷ lệ khung hình gần vuông
  if (varianceR < 0.20 && aspectRatio >= 0.78 && aspectRatio <= 1.28) {
    const radius = Math.round((w + h) / 4);
    return {
      tool: 'circle',
      points: [
        { x: cx, y: cy },
        { x: cx + radius, y: cy },
      ],
      label: 'Hình Tròn',
    };
  }

  // B. Hình Elip: Bán kính biến thiên đều theo góc
  if (varianceR < 0.28 && (aspectRatio < 0.75 || aspectRatio > 1.35)) {
    return {
      tool: 'ellipse',
      points: [
        { x: minX, y: minY },
        { x: maxX, y: maxY },
      ],
      label: 'Hình Elip',
    };
  }

  // C. RDP Simplification tìm đỉnh góc (Corners)
  const simplified = simplifyPoints(points, Math.max(14, totalPerimeter * 0.05));
  const cornerCount = simplified.length - 1; // trừ điểm trùng cuối

  // Hình chữ nhật / Vuông
  if (cornerCount === 4 || (cornerCount >= 3 && cornerCount <= 5 && varianceR > 0.25)) {
    // Tính diện tích đa giác thực tế (Shoelace formula) so với W * H
    let polyArea = 0;
    for (let i = 0; i < points.length - 1; i++) {
      polyArea += points[i].x * points[i + 1].y - points[i + 1].x * points[i].y;
    }
    polyArea = Math.abs(polyArea) / 2;
    const boxArea = w * h;
    const fillRatio = polyArea / (boxArea || 1);

    if (fillRatio > 0.72) {
      return {
        tool: 'rectangle',
        points: [
          { x: minX, y: minY },
          { x: maxX, y: maxY },
        ],
        label: aspectRatio >= 0.88 && aspectRatio <= 1.14 ? 'Hình Vuông' : 'Hình Chữ Nhật',
      };
    }
  }

  // D. Hình tam giác
  if (cornerCount === 3) {
    return {
      tool: 'line',
      points: [simplified[0], simplified[1], simplified[2], simplified[0]],
      label: 'Hình Tam Giác',
    };
  }

  // Fallback: nếu tỷ lệ gần tròn thì chọn hình tròn, ngược lại hình chữ nhật
  if (varianceR < 0.24) {
    const radius = Math.round((w + h) / 4);
    return {
      tool: 'circle',
      points: [
        { x: cx, y: cy },
        { x: cx + radius, y: cy },
      ],
      label: 'Hình Tròn',
    };
  }

  return {
    tool: 'rectangle',
    points: [
      { x: minX, y: minY },
      { x: maxX, y: maxY },
    ],
    label: 'Hình Khối Chuẩn',
  };
}

/**
 * Call server AI / OCR to recognize Vietnamese handwriting with 16s timeout protection
 */
export async function recognizeVietnameseHandwriting(
  imageDataUrl: string,
  contextHint = 'bài giảng lớp học, công thức toán học'
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18000); // 18s timeout for reliable AI recognition

  try {
    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const mimeMatch = imageDataUrl.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    const response = await fetch('/api/ai/recognize-handwriting', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        imageBase64: base64Data,
        mimeType,
        context: contextHint,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    return (data.text || '').trim();
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn('recognizeVietnameseHandwriting API failed or timed out:', err?.message || err);
    return '';
  }
}
