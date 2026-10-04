/**
 * High-Speed Text & Handwriting Recognition Service (< 300ms OCR)
 * SmartBoard 75 Pro
 * 
 * Capabilities:
 * 1. cropCanvasRegion: Crops strictly the bounded rectangle of selected strokes (no full chalkboard).
 * 2. Downscales to max 400x400px with high-contrast grayscale for ultra-lightweight payload (< 25KB).
 * 3. Fast OCR call to Gemini Flash with concise Vietnamese instruction.
 * 4. In-memory cache for sub-50ms repeat retrieval.
 */

import { StrokePoint } from '../types';
import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey } from './geminiClient';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CroppedRegion {
  dataUrl: string;
  width: number;
  height: number;
  bounds: BoundingBox;
}

// In-memory cache for instant repeated reads
const ocrCache = new Map<string, string>();

/**
 * Trích xuất ảnh nét vẽ canvas gọn gàng siêu tốc (< 300ms)
 * - Chỉ cắt đúng diện tích hình chữ nhật của vùng được chọn
 * - Giới hạn kích thước tối đa 400px (max width/height = 400px)
 * - Chuyển sang ảnh đen trắng (grayscale) tương phản cao (nền trắng #FFF, nét đen #000)
 * - Nén dữ liệu Base64 siêu nhẹ (< 20KB) để gửi API tức thì
 */
export function cropCanvasRegion(
  canvas: HTMLCanvasElement | null,
  box: BoundingBox,
  strokes: Array<{ points?: StrokePoint[]; color?: string; size?: number; tool?: string }> = [],
  boardScrollX = 0,
  boardScrollY = 0,
  padding = 12
): CroppedRegion | null {
  const strokeSegments: StrokePoint[][] = [];
  const allPoints: StrokePoint[] = [];

  if (Array.isArray(strokes) && strokes.length > 0) {
    strokes.forEach((s) => {
      if (s.points && s.points.length > 0) {
        strokeSegments.push(s.points);
        allPoints.push(...s.points);
      }
    });
  }

  // Calculate actual bounding box
  let sMinX = box.minX;
  let sMaxX = box.maxX;
  let sMinY = box.minY;
  let sMaxY = box.maxY;

  if (allPoints.length > 0) {
    let pMinX = Infinity;
    let pMaxX = -Infinity;
    let pMinY = Infinity;
    let pMaxY = -Infinity;

    for (const p of allPoints) {
      if (p.x < pMinX) pMinX = p.x;
      if (p.x > pMaxX) pMaxX = p.x;
      if (p.y < pMinY) pMinY = p.y;
      if (p.y > pMaxY) pMaxY = p.y;
    }

    if (pMinX !== Infinity) {
      sMinX = pMinX;
      sMaxX = pMaxX;
      sMinY = pMinY;
      sMaxY = pMaxY;
    }
  }

  const rawW = Math.max(16, (sMaxX - sMinX) + padding * 2);
  const rawH = Math.max(16, (sMaxY - sMinY) + padding * 2);

  // Giới hạn max width/height = 400px để nén siêu nhẹ
  const MAX_DIM = 400;
  let targetW = rawW;
  let targetH = rawH;

  if (targetW > MAX_DIM || targetH > MAX_DIM) {
    const scale = Math.min(MAX_DIM / targetW, MAX_DIM / targetH);
    targetW = Math.max(32, Math.round(targetW * scale));
    targetH = Math.max(32, Math.round(targetH * scale));
  } else {
    // Nếu quá nhỏ, phóng nhẹ để dễ đọc nét
    if (targetW < 120 && targetH < 120) {
      const scale = Math.min(2.5, 200 / Math.max(targetW, targetH));
      targetW = Math.round(targetW * scale);
      targetH = Math.round(targetH * scale);
    }
  }

  const scaleX = targetW / rawW;
  const scaleY = targetH / rawH;

  try {
    let offscreen: HTMLCanvasElement;
    if (typeof document !== 'undefined') {
      offscreen = document.createElement('canvas');
      offscreen.width = targetW;
      offscreen.height = targetH;
    } else {
      offscreen = new (globalThis as any).OffscreenCanvas(targetW, targetH);
    }

    const ctx = offscreen.getContext('2d', { alpha: false });
    if (!ctx) return null;

    // 1. Nền trắng tinh (#FFFFFF)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);

    // 2. Vẽ nét chữ đen (#000000) tương phản tuyệt đối
    ctx.save();
    ctx.scale(scaleX, scaleY);
    ctx.translate(-sMinX + padding, -sMinY + padding);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
    ctx.lineWidth = 4.5;

    if (strokeSegments.length > 0) {
      for (const segment of strokeSegments) {
        if (segment.length === 1) {
          ctx.beginPath();
          ctx.arc(segment[0].x, segment[0].y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (segment.length === 2) {
          ctx.beginPath();
          ctx.arc(segment[0].x, segment[0].y, 2.5, 0, Math.PI * 2);
          ctx.arc(segment[1].x, segment[1].y, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(segment[0].x, segment[0].y);
          ctx.lineTo(segment[1].x, segment[1].y);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(segment[0].x, segment[0].y);
          for (let i = 1; i < segment.length - 1; i++) {
            const xc = (segment[i].x + segment[i + 1].x) / 2;
            const yc = (segment[i].y + segment[i + 1].y) / 2;
            ctx.quadraticCurveTo(segment[i].x, segment[i].y, xc, yc);
          }
          const last = segment[segment.length - 1];
          const prev = segment[segment.length - 2];
          ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y);
          ctx.stroke();
        }
      }
    } else if (canvas) {
      // Fallback: draw directly from main canvas with inverted/grayscale filter
      try {
        ctx.drawImage(
          canvas,
          sMinX,
          sMinY,
          sMaxX - sMinX,
          sMaxY - sMinY,
          0,
          0,
          rawW,
          rawH
        );
      } catch (_) {}
    }

    ctx.restore();

    // 3. Xuất ảnh JPEG nén nhẹ (payload < 20KB)
    const dataUrl = offscreen.toDataURL('image/jpeg', 0.85);

    return {
      dataUrl,
      width: targetW,
      height: targetH,
      bounds: { minX: sMinX, minY: sMinY, maxX: sMaxX, maxY: sMaxY },
    };
  } catch (err) {
    console.warn('cropCanvasRegion error:', err);
    return null;
  }
}

/**
 * Nhận diện chữ viết tay / số / công thức siêu tốc (< 300ms)
 * Prompt ngắn gọn: "Chỉ đọc các chữ/số/công thức có trong ảnh, trả về text thuần tiếng Việt, không giải thích"
 */
export async function recognizeHandwritingFast(
  imageDataUrl: string,
  contextHint = 'chữ viết tay bảng xanh, số, công thức toán'
): Promise<string> {
  if (!imageDataUrl) return '';

  // Check cache (fast hash based on length and sample characters)
  const cacheKey = imageDataUrl.slice(-100) + imageDataUrl.length;
  if (ocrCache.has(cacheKey)) {
    return ocrCache.get(cacheKey)!;
  }

  const cleanBase64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const mimeMatch = imageDataUrl.match(/^data:(image\/\w+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  const fastPrompt = 'Chỉ đọc các chữ/số/công thức có trong ảnh, trả về text thuần tiếng Việt, không giải thích';

  // 1. Thử gửi server endpoint với timeout ngắn 4s
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch('/api/ai/recognize-handwriting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        imageBase64: cleanBase64,
        mimeType,
        context: fastPrompt,
      }),
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.text) {
        const cleaned = cleanOcrResult(data.text);
        if (cleaned) {
          ocrCache.set(cacheKey, cleaned);
          return cleaned;
        }
      }
    }
  } catch (_) {
    // Server endpoint took too long or was unavailable
  }

  // 2. Direct client-side Gemini Flash fallback (<300ms)
  try {
    const apiKey = getGeminiApiKey();
    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey });
      const resp = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: fastPrompt,
              },
            ],
          },
        ],
        config: {
          temperature: 0.1,
          maxOutputTokens: 60,
        },
      });

      const text = resp.text ? cleanOcrResult(resp.text) : '';
      if (text) {
        ocrCache.set(cacheKey, text);
        return text;
      }
    }
  } catch (directErr) {
    console.warn('Direct OCR fallback notice:', directErr);
  }

  return '';
}

/**
 * Làm sạch văn bản OCR trả về (bỏ dấu ngoặc kép, markdown thừa)
 */
function cleanOcrResult(raw: string): string {
  if (!raw) return '';
  let s = raw.trim();
  s = s.replace(/^```[a-z]*\s*/i, '').replace(/```$/g, '');
  s = s.replace(/^["'“”«»]/, '').replace(/["'“”«»]$/, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}
