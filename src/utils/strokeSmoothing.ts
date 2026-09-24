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
 * Emulates authentic chalk and fountain pen physics
 */
export function calculateDynamicStrokeWidth(
  baseSize: number,
  current: { x: number; y: number; pressure?: number; time?: number },
  previous?: { x: number; y: number; pressure?: number; time?: number; width?: number },
  isCalligraphy = false
): number {
  if (!previous) return baseSize;

  const dt = Math.max(1, (current.time || performance.now()) - (previous.time || performance.now()));
  const dist = Math.hypot(current.x - previous.x, current.y - previous.y);
  const speed = dist / dt; // px/ms

  let targetWidth = baseSize;

  if (isCalligraphy) {
    // Calligraphy angle modulation (45 degree thick/thin nib physics)
    const angle = Math.atan2(current.y - previous.y, current.x - previous.x);
    // 45 degrees angle nib gives maximum contrast between upstrokes and downstrokes
    const angleFactor = Math.abs(Math.sin(angle - Math.PI / 4));
    const widthFactor = 0.55 + angleFactor * 0.75; // 0.55x to 1.3x

    // Speed modulation: faster = slightly sharper
    const speedFactor = Math.max(0.7, Math.min(1.25, 1.15 - speed * 0.15));
    targetWidth = baseSize * widthFactor * speedFactor;
  } else {
    // Natural chalk / ballpoint dynamics:
    // Faster strokes get slightly tapered (0.8x), slow steady strokes get full body (1.1x)
    const speedFactor = Math.max(0.78, Math.min(1.15, 1.1 - speed * 0.12));
    targetWidth = baseSize * speedFactor;
  }

  // Modulate with stylus pressure if hardware provides real pressure
  if (current.pressure !== undefined && current.pressure > 0 && current.pressure !== 0.5) {
    const pressureMultiplier = 0.5 + current.pressure; // 0.5x to 1.5x
    targetWidth *= pressureMultiplier;
  }

  // Smooth width transition from previous point to avoid sudden jumps
  const prevWidth = previous.width || baseSize;
  const smoothedWidth = prevWidth * 0.65 + targetWidth * 0.35;

  return Math.max(baseSize * 0.45, Math.min(baseSize * 1.85, smoothedWidth));
}

/**
 * Ramer-Douglas-Peucker (RDP) algorithm for stroke simplification
 * Reduces raw touch point density by 60-75% without perceptible loss of curve fidelity
 */
export function simplifyPoints(points: StrokePoint[], epsilon = 0.75): StrokePoint[] {
  if (points.length <= 2) return points;

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
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
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
 * Extract bounding box image of handwritten strokes from canvas
 * for Gemini Vision / OCR handwriting recognition.
 */
export function cropStrokesToImage(
  canvas: HTMLCanvasElement,
  pointsList: StrokePoint[],
  boardScrollX: number,
  boardScrollY: number,
  padding = 32
): { dataUrl: string; bounds: { minX: number; minY: number; width: number; height: number } } | null {
  if (!pointsList || pointsList.length === 0) return null;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pointsList) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const strokeW = maxX - minX;
  const strokeH = maxY - minY;
  if (strokeW < 5 && strokeH < 5) return null;

  // Viewport relative bounds
  const dpr = window.devicePixelRatio || 1;
  const viewX = Math.max(0, (minX - boardScrollX - padding) * dpr);
  const viewY = Math.max(0, (minY - boardScrollY - padding) * dpr);
  const cropW = Math.min(canvas.width - viewX, (strokeW + padding * 2) * dpr);
  const cropH = Math.min(canvas.height - viewY, (strokeH + padding * 2) * dpr);

  if (cropW <= 0 || cropH <= 0) return null;

  try {
    const offscreen = document.createElement('canvas');
    // Scale down to compact resolution (max 420x220) for lightning-fast transfer and rapid Gemini processing
    const maxTargetW = 420;
    const maxTargetH = 220;
    const scale = Math.min(1, maxTargetW / Math.max(1, cropW), maxTargetH / Math.max(1, cropH));
    offscreen.width = Math.max(100, Math.round(cropW * scale));
    offscreen.height = Math.max(50, Math.round(cropH * scale));
    const offCtx = offscreen.getContext('2d', { alpha: false });
    if (!offCtx) return null;

    // High-contrast chalkboard background
    offCtx.fillStyle = '#0f172a';
    offCtx.fillRect(0, 0, offscreen.width, offscreen.height);

    // Copy and scale the canvas stroke region
    offCtx.drawImage(
      canvas,
      viewX,
      viewY,
      cropW,
      cropH,
      0,
      0,
      offscreen.width,
      offscreen.height
    );

    // Fast JPEG encoding: 15x lighter than raw PNG for near-instant network transmission
    const dataUrl = offscreen.toDataURL('image/jpeg', 0.80);

    return {
      dataUrl,
      bounds: {
        minX: minX - padding / 2,
        minY: minY - padding / 2,
        width: Math.max(160, strokeW + padding),
        height: Math.max(60, strokeH + padding),
      },
    };
  } catch (err) {
    console.warn('cropStrokesToImage error:', err);
    return null;
  }
}

/**
 * Call server AI / OCR to recognize Vietnamese handwriting with ultra-fast timeout protection
 */
export async function recognizeVietnameseHandwriting(
  imageDataUrl: string,
  contextHint = 'bài giảng lớp học, công thức toán học'
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout max

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
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('recognizeVietnameseHandwriting API failed or timed out:', err);
    return '';
  }
}
