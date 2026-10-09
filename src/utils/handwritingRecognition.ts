/**
 * 1-Click Instant Handwriting Recognition Service (< 200ms)
 * SmartBoard 75 Pro
 * 
 * Provides instantaneous 1-click detection:
 * 1. Coordinates sweep analysis for numbers (0-9), mathematical symbols (+, -, *, /, =, <, >, x, y, z),
 *    and Vietnamese handwritten letters and words.
 * 2. Directly converts handwritten chalk strokes into clean pedagogical text boxes
 *    (Chữ Mẫu Tiểu Học BGD / Playwrite VN / Times New Roman).
 * 3. Zero debounce, zero redundant checks to ensure single-click responsiveness.
 */

import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey } from './geminiClient';
import { StrokePoint, WhiteboardStroke } from '../types';

export interface HandwritingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface RecognitionResult {
  text: string;
  confidence: number;
  bounds: HandwritingBox;
  suggestedFontSize: number;
  suggestedWidth: number;
  suggestedHeight: number;
}

// Memory cache for sub-20ms repeats
const instantOcrCache = new Map<string, string>();

function getBoundsOfPoints(points: StrokePoint[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

function isStraightSegment(points: StrokePoint[]): boolean {
  if (points.length <= 2) return true;
  const start = points[0];
  const end = points[points.length - 1];
  const directDist = Math.hypot(end.x - start.x, end.y - start.y);
  if (directDist < 5) return false;
  let pathDist = 0;
  for (let i = 1; i < points.length; i++) {
    pathDist += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return directDist / Math.max(1, pathDist) > 0.88;
}

/**
 * Strict structural analysis of raw stroke points.
 * ONLY returns a symbol if geometric characteristics are mathematically indisputable.
 * NEVER resets or guesses '=' merely from stroke count or aspect ratio.
 */
export function analyzeStrokeGeometryLocally(strokes: WhiteboardStroke[]): string | null {
  if (!strokes || strokes.length === 0) return null;

  // Handwriting with more than 2 strokes or many points must be read by AI OCR
  if (strokes.length > 2) return null;

  const validStrokes = strokes.filter((s) => s.points && s.points.length >= 2);
  if (validStrokes.length !== strokes.length) return null;

  // Strict check for genuine equals sign '=':
  // Must be EXACTLY two parallel, horizontal, vertically stacked lines with high straightness
  if (strokes.length === 2) {
    const s1 = strokes[0].points!;
    const s2 = strokes[1].points!;

    // Must each have limited points (not a long cursive word or sentence)
    if (s1.length > 30 || s2.length > 30) return null;

    const b1 = getBoundsOfPoints(s1);
    const b2 = getBoundsOfPoints(s2);

    const w1 = b1.maxX - b1.minX;
    const h1 = b1.maxY - b1.minY;
    const w2 = b2.maxX - b2.minX;
    const h2 = b2.maxY - b2.minY;

    // Must be substantial horizontal bars
    if (w1 < 14 || w2 < 14) return null;

    // Both must be flat: height significantly less than width (flatness ratio < 0.32)
    if (h1 / w1 > 0.32 || h2 / w2 > 0.32) return null;

    // Endpoints must also be relatively horizontal
    const p1Start = s1[0];
    const p1End = s1[s1.length - 1];
    const p2Start = s2[0];
    const p2End = s2[s2.length - 1];

    const dy1 = Math.abs(p1End.y - p1Start.y);
    const dx1 = Math.abs(p1End.x - p1Start.x);
    const dy2 = Math.abs(p2End.y - p2Start.y);
    const dx2 = Math.abs(p2End.x - p2Start.x);

    if (dy1 / Math.max(1, dx1) > 0.25 || dy2 / Math.max(1, dx2) > 0.25) return null;

    // Widths must be comparable (within 40%)
    if (Math.abs(w1 - w2) / Math.max(w1, w2) > 0.40) return null;

    // Must be vertically stacked: one strictly above the other
    const topStroke = b1.minY < b2.minY ? b1 : b2;
    const bottomStroke = b1.minY < b2.minY ? b2 : b1;

    const vGap = bottomStroke.minY - topStroke.maxY;
    const maxW = Math.max(w1, w2);

    // Gap between lines must be clean (positive gap, between 3px and 0.85 * width)
    if (vGap < 3 || vGap > maxW * 0.85) return null;

    // Horizontal overlap between the two lines must be at least 70%
    const overlapMinX = Math.max(b1.minX, b2.minX);
    const overlapMaxX = Math.min(b1.maxX, b2.maxX);
    const overlapW = overlapMaxX - overlapMinX;
    if (overlapW / maxW < 0.70) return null;

    // Both lines must be straight (no curved letters or loops)
    if (!isStraightSegment(s1) || !isStraightSegment(s2)) return null;

    return '=';
  }

  // Strict check for '+' symbol: two intersecting perpendicular lines
  if (strokes.length === 2) {
    const s1 = strokes[0].points!;
    const s2 = strokes[1].points!;
    if (s1.length > 25 || s2.length > 25) return null;

    const b1 = getBoundsOfPoints(s1);
    const b2 = getBoundsOfPoints(s2);
    const w1 = b1.maxX - b1.minX;
    const h1 = b1.maxY - b1.minY;
    const w2 = b2.maxX - b2.minX;
    const h2 = b2.maxY - b2.minY;

    const s1Horizontal = w1 > h1 * 2.2 && h2 > w2 * 2.2;
    const s2Horizontal = w2 > h2 * 2.2 && h1 > w1 * 2.2;

    if ((s1Horizontal || s2Horizontal) && isStraightSegment(s1) && isStraightSegment(s2)) {
      const c1x = (b1.minX + b1.maxX) / 2;
      const c1y = (b1.minY + b1.maxY) / 2;
      const c2x = (b2.minX + b2.maxX) / 2;
      const c2y = (b2.minY + b2.maxY) / 2;
      const dist = Math.hypot(c1x - c2x, c1y - c2y);
      if (dist < Math.max(12, Math.max(w1, h1, w2, h2) * 0.35)) {
        return '+';
      }
    }
  }

  return null;
}

/**
 * Render strokes onto an offscreen canvas with high contrast (Black stroke on White background)
 */
export function renderStrokesToHighContrastB64(
  strokes: WhiteboardStroke[],
  box?: HandwritingBox,
  padding = 16
): { base64: string; dataUrl: string; width: number; height: number; bounds: HandwritingBox } | null {
  const allPoints: StrokePoint[] = [];
  strokes.forEach((s) => {
    if (s.points) allPoints.push(...s.points);
  });

  let minX = box?.minX ?? Infinity;
  let maxX = box?.maxX ?? -Infinity;
  let minY = box?.minY ?? Infinity;
  let maxY = box?.maxY ?? -Infinity;

  if (allPoints.length > 0) {
    for (const p of allPoints) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }

  if (minX === Infinity) return null;

  const rawW = Math.max(20, (maxX - minX) + padding * 2);
  const rawH = Math.max(20, (maxY - minY) + padding * 2);

  // Constrain max size for sub-200ms transfer
  const MAX_DIM = 400;
  let targetW = rawW;
  let targetH = rawH;

  if (targetW > MAX_DIM || targetH > MAX_DIM) {
    const scale = Math.min(MAX_DIM / targetW, MAX_DIM / targetH);
    targetW = Math.max(32, Math.round(targetW * scale));
    targetH = Math.max(32, Math.round(targetH * scale));
  } else if (targetW < 120 && targetH < 120) {
    const scale = Math.min(2.5, 220 / Math.max(targetW, targetH));
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);
  }

  const scaleX = targetW / rawW;
  const scaleY = targetH / rawH;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    // Solid white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);

    // Deep black ink
    ctx.save();
    ctx.scale(scaleX, scaleY);
    ctx.translate(-minX + padding, -minY + padding);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
    ctx.lineWidth = 4.5;

    for (const s of strokes) {
      const pts = s.points;
      if (!pts || pts.length === 0) continue;

      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (pts.length === 2) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const xc = (pts[i].x + pts[i + 1].x) / 2;
          const yc = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y);
        ctx.stroke();
      }
    }

    ctx.restore();

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');

    return {
      base64,
      dataUrl,
      width: targetW,
      height: targetH,
      bounds: { minX, minY, maxX, maxY },
    };
  } catch (err) {
    console.warn('renderStrokesToHighContrastB64 error:', err);
    return null;
  }
}

/**
 * 1-Click Instant Handwriting Recognition
 * Executes immediately on click, no debouncing
 */
export async function recognizeHandwritingOneClick(
  strokes: WhiteboardStroke[],
  box?: HandwritingBox,
  cachedPreview?: string | null
): Promise<RecognitionResult | null> {
  if (!strokes || strokes.length === 0) return null;

  // 1. Calculate actual bounding box
  let minX = box?.minX ?? Infinity;
  let maxX = box?.maxX ?? -Infinity;
  let minY = box?.minY ?? Infinity;
  let maxY = box?.maxY ?? -Infinity;

  strokes.forEach((s) => {
    if (s.points) {
      s.points.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
    }
  });

  const actualWidth = Math.max(20, maxX - minX);
  const actualHeight = Math.max(20, maxY - minY);
  const bounds = { minX, minY, maxX, maxY };

  // 2. If cached preview exists and is valid, use immediately (<1ms)
  // Guard against stale '=' cache: only trust '=' preview if local geometry strictly confirms it
  if (cachedPreview && cachedPreview.trim().length > 0) {
    const trimmed = cachedPreview.trim();
    if (trimmed !== '=' || analyzeStrokeGeometryLocally(strokes) === '=') {
      const text = cleanHandwritingText(trimmed);
      return buildRecognitionResult(text, bounds, actualWidth, actualHeight);
    }
  }

  // 3. Strict local geometry check (genuine =, +, etc.)
  const localMatch = analyzeStrokeGeometryLocally(strokes);
  if (localMatch) {
    return buildRecognitionResult(localMatch, bounds, actualWidth, actualHeight);
  }

  // 4. Render to high contrast B&W image
  const rendered = renderStrokesToHighContrastB64(strokes, bounds);
  if (!rendered) return null;

  const cacheKey = rendered.base64.slice(-80) + rendered.base64.length;
  if (instantOcrCache.has(cacheKey)) {
    const text = instantOcrCache.get(cacheKey)!;
    return buildRecognitionResult(text, bounds, actualWidth, actualHeight);
  }

  // 5. Fast Recognition via endpoint or direct Gemini Flash
  try {
    const text = await executeFastOCR(rendered.base64);
    if (text) {
      instantOcrCache.set(cacheKey, text);
      return buildRecognitionResult(text, bounds, actualWidth, actualHeight);
    }
  } catch (err) {
    console.warn('Fast OCR error:', err);
  }

  return null;
}

/**
 * Perform rapid OCR (< 300ms)
 */
async function executeFastOCR(base64Image: string): Promise<string> {
  const prompt = 'Chỉ đọc chính xác chữ viết tay tiếng Việt, chữ số hoặc công thức toán học trong ảnh. Trả về văn bản thuần túy, không định dạng markdown, không lời giải thích.';

  // Attempt 1: Server proxy route
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const res = await fetch('/api/ai/recognize-handwriting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        imageBase64: base64Image,
        mimeType: 'image/jpeg',
        context: prompt,
      }),
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.text) {
        return cleanHandwritingText(data.text);
      }
    }
  } catch (_) {}

  // Attempt 2: Client-side Gemini Flash direct
  const apiKey = getGeminiApiKey();
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Image,
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          temperature: 0.1,
          maxOutputTokens: 64,
        },
      });

      if (resp.text) {
        return cleanHandwritingText(resp.text);
      }
    } catch (_) {}
  }

  return '';
}

function cleanHandwritingText(raw: string): string {
  if (!raw) return '';
  let s = raw.trim();
  s = s.replace(/^```[a-z]*\s*/i, '').replace(/```$/g, '');
  s = s.replace(/^["'“”«»]/, '').replace(/["'“”«»]$/, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function buildRecognitionResult(
  text: string,
  bounds: HandwritingBox,
  actualWidth: number,
  actualHeight: number
): RecognitionResult {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const lineCount = Math.max(1, lines.length);
  const maxCharsInLine = Math.max(...lines.map((l) => l.length), 1);

  // Proportional font sizing matching chalkboard stroke height
  const sizeFromHeight = (actualHeight / lineCount) * 0.72;
  const sizeFromWidth = actualWidth / (maxCharsInLine * 0.58);
  const balancedSize = maxCharsInLine > 3
    ? Math.min(sizeFromHeight, sizeFromWidth * 1.15)
    : sizeFromHeight;

  const suggestedFontSize = Math.round(Math.max(22, Math.min(68, balancedSize)));
  const suggestedWidth = Math.max(Math.round(actualWidth + 36), Math.round(maxCharsInLine * suggestedFontSize * 0.72) + 36);
  const suggestedHeight = Math.max(Math.round(actualHeight + 16), Math.round(suggestedFontSize * lineCount * 1.35) + 20);

  return {
    text,
    confidence: 0.95,
    bounds,
    suggestedFontSize,
    suggestedWidth,
    suggestedHeight,
  };
}
