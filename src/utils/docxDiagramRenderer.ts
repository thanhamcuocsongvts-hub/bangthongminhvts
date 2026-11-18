/**
 * High-DPI Canvas-to-PNG Diagram Renderer & Embedded Table/Diagram Extractor
 * for Publication-Grade GDPT 2018 Word (.docx) Export.
 *
 * Generates crisp 2.5x retina PNG diagrams (ImageRun) matching QuizRichContentRenderer,
 * StandardTextbookGraph, and PracticalMathIllustration for:
 * - Bảng biến thiên (variation_table)
 * - Bảng xét dấu (sign_table)
 * - Đồ thị hàm số (function_graph)
 * - Hình học không gian 3D (geometry / geometry_3d)
 * - Bài toán thực tế (practical_illustration)
 * - Mạch điện vật lý (physics_circuit)
 */

import { QuizDiagramData } from '../components/QuizRichContentRenderer';
import { detectPracticalScenario, PracticalScenario } from '../components/PracticalMathIllustration';
import { analyzeAndSampleSgkGraph } from './sgkGraphMath';

export interface RenderedDocxPng {
  pngBytes: Uint8Array;
  /** Display width in docx points/px (96dpi logical size) */
  width: number;
  /** Display height in docx points/px (96dpi logical size) */
  height: number;
}

export interface ExtractedDiagramResult {
  cleanContent: string;
  detectedType?:
    | 'variation_table'
    | 'sign_table'
    | 'function_graph'
    | 'geometry'
    | 'data_table'
    | 'practical_illustration'
    | 'physics_circuit'
    | 'chemistry_diagram';
  detectedData?: QuizDiagramData;
}

/**
 * Clean a LaTeX fragment into crisp textbook Unicode notation for Canvas drawing
 */
export function formatMathLabelForCanvas(raw: string): string {
  if (!raw) return '';
  let s = raw.replace(/^\$+|\$+$/g, '').trim();
  s = s
    .replace(/\\infty\b/g, '∞')
    .replace(/\\pi\b/g, 'π')
    .replace(/\\alpha\b/g, 'α')
    .replace(/\\beta\b/g, 'β')
    .replace(/\\gamma\b/g, 'γ')
    .replace(/\\delta\b/g, 'δ')
    .replace(/\\Delta\b/g, 'Δ')
    .replace(/\\varphi\b|\\phi\b/g, 'φ')
    .replace(/\\theta\b/g, 'θ')
    .replace(/\\omega\b/g, 'ω')
    .replace(/\\Omega\b/g, 'Ω')
    .replace(/\\pm\b/g, '±')
    .replace(/\\mp\b/g, '∓')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\times\b/g, '×')
    .replace(/\\le(?:q)?\b/g, '≤')
    .replace(/\\ge(?:q)?\b/g, '≥')
    .replace(/\\ne(?:q)?\b/g, '≠')
    .replace(/\\to\b|\\rightarrow\b/g, '→')
    .replace(/\\mathbb\{([A-Z])\}/g, '$1')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\mathrm\{([^}]*)\}/g, '$1')
    .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
    .replace(/\\sqrt\s*([a-zA-Z0-9])/g, '√$1')
    .replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')
    .replace(/\^\\circ|\\degree/g, '°')
    .replace(/\\(?:sin|cos|tan|cot|ln|log|lim|exp)\b/g, (m) => m.slice(1))
    .replace(/\\left\s*([(\[{|])/g, '$1')
    .replace(/\\right\s*([)\]}|])/g, '$1')
    .replace(/\\[,;! ]/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Replace simple superscripts digits ^2 -> ² etc.
  const supMap: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', 'n': 'ⁿ', 'i': 'ⁱ',
  };
  s = s.replace(/\^([0-9+\-ni]+)/g, (_, exp: string) =>
    exp.split('').map((c) => supMap[c] || c).join('')
  );
  const subMap: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  };
  s = s.replace(/_([0-9]+)/g, (_, sub: string) =>
    sub.split('').map((c) => subMap[c] || c).join('')
  );
  return s;
}

/**
 * Helper to create a high-DPI offscreen 2D Canvas and convert it cleanly to PNG Uint8Array.
 */
function renderOnCanvas(
  logicalWidth: number,
  logicalHeight: number,
  scale: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  docxTargetWidth: number
): RenderedDocxPng | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(logicalWidth * scale);
    canvas.height = Math.round(logicalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    draw(ctx, logicalWidth, logicalHeight);

    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    if (!base64) return null;
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }

    const ratio = logicalHeight / logicalWidth;
    return {
      pngBytes: bytes,
      width: docxTargetWidth,
      height: Math.round(docxTargetWidth * ratio),
    };
  } catch {
    return null;
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  size: number = 7,
  color: string = '#1e293b'
) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - size * Math.cos(angle - Math.PI / 6), toY - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - size * Math.cos(angle + Math.PI / 6), toY - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Draw stacked math label or crisp inline math centered around (cx, cy).
 */
function drawCanvasMathCentered(
  ctx: CanvasRenderingContext2D,
  rawLabel: string,
  cx: number,
  cy: number,
  fontSize: number = 13,
  color: string = '#0f172a',
  bold: boolean = true
) {
  const cleaned = (rawLabel || '').replace(/^\$+|\$+$/g, '').trim();
  const fracMatch = cleaned.match(/^(-?)\\d?frac\{([^{}]+)\}\{([^{}]+)\}$/);
  if (fracMatch) {
    const sign = fracMatch[1];
    const num = formatMathLabelForCanvas(fracMatch[2]);
    const den = formatMathLabelForCanvas(fracMatch[3]);
    const subFontSize = Math.max(10, Math.round(fontSize * 0.85));
    ctx.save();
    ctx.font = `${bold ? 'bold ' : ''}${subFontSize}px "Times New Roman", Times, serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const barHalf = Math.max(ctx.measureText(num).width, ctx.measureText(den).width) / 2 + 3;
    const offsetX = sign ? 5 : 0;
    if (sign) {
      ctx.font = `${bold ? 'bold ' : ''}${fontSize}px "Times New Roman", Times, serif`;
      ctx.fillText(sign, cx - barHalf - 2, cy);
      ctx.font = `${bold ? 'bold ' : ''}${subFontSize}px "Times New Roman", Times, serif`;
    }
    ctx.fillText(num, cx + offsetX, cy - subFontSize * 0.56);
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.1;
    ctx.moveTo(cx + offsetX - barHalf, cy);
    ctx.lineTo(cx + offsetX + barHalf, cy);
    ctx.stroke();
    ctx.fillText(den, cx + offsetX, cy + subFontSize * 0.6);
    ctx.restore();
    return;
  }

  const label = formatMathLabelForCanvas(cleaned);
  ctx.save();
  ctx.font = `${bold ? 'bold ' : ''}${fontSize}px "Times New Roman", Times, serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy);
  ctx.restore();
}

/**
 * Extract Markdown tables or LaTeX \begin{array} / \begin{tabular} cleanly,
 * plus detect embedded SGK diagrams when diagramType is omitted.
 */
export function extractEmbeddedDiagramAndCleanText(content: string): ExtractedDiagramResult {
  if (!content) return { cleanContent: content || '' };

  // 1a. Multi-line Markdown Table detection (sign table, variation table, or statistics data table)
  const lines = content.split(/\r?\n/);
  for (let start = 0; start < lines.length - 1; start++) {
    const line = lines[start].trim();
    if (line.includes('|') && (line.startsWith('|') || line.split('|').length >= 3)) {
      let end = start;
      while (end < lines.length && lines[end].trim().includes('|')) {
        end++;
      }
      const tableLines = lines.slice(start, end).map((l) => l.trim());
      if (tableLines.length >= 2) {
        const parsedRows = tableLines
          .filter((l) => !/^\|?[\s:\-|]+\|?$/.test(l))
          .map((l) =>
            l
              .replace(/^\|/, '')
              .replace(/\|$/, '')
              .split('|')
              .map((c) => c.trim())
          )
          .filter((cells) => cells.length >= 2);

        if (parsedRows.length >= 2) {
          const cleanContent = [...lines.slice(0, start), ...lines.slice(end)].join('\n').trim();
          const firstColLower = (parsedRows[0][0] || '').toLowerCase();
          const secondColLower = (parsedRows[1]?.[0] || '').toLowerCase();

          // Check if it's a Bảng biến thiên / Bảng xét dấu
          if (
            firstColLower === 'x' &&
            (secondColLower.includes("y'") || secondColLower.includes("f'") || secondColLower.includes('f(x)') || secondColLower === 'y')
          ) {
            const xVals = parsedRows[0].slice(1).filter(Boolean);
            const row2Signs = parsedRows[1].slice(1).filter((s) => s !== '');
            if (parsedRows.length >= 3 && (parsedRows[2][0] || '').toLowerCase().includes('y')) {
              const row3Vals = parsedRows[2].slice(1).filter(Boolean);
              const arrows: any[] = [];
              for (let k = 0; k < Math.max(0, xVals.length - 1); k++) {
                const sign = row2Signs[k * 2 + 1] || row2Signs[k] || '+';
                const isUp = !sign.includes('-');
                arrows.push({
                  start: row3Vals[k] || (isUp ? '-\\infty' : '+\\infty'),
                  end: row3Vals[k + 1] || (isUp ? '+\\infty' : '-\\infty'),
                  dir: isUp ? 'up' : 'down',
                });
              }
              return {
                cleanContent,
                detectedType: 'variation_table',
                detectedData: {
                  title: 'Bảng biến thiên của hàm số',
                  x: xVals,
                  yPrime: row2Signs,
                  yArrows: arrows,
                },
              };
            }
            return {
              cleanContent,
              detectedType: 'sign_table',
              detectedData: {
                title: 'Bảng xét dấu',
                x: xVals,
                rows: parsedRows.slice(1).map((r) => ({
                  label: r[0] || "f'(x)",
                  signs: r.slice(1),
                })),
              },
            };
          }

          // Otherwise treat as a full Statistics / Data Table
          return {
            cleanContent,
            detectedType: 'data_table',
            detectedData: {
              title: 'Bảng số liệu thống kê',
              headers: parsedRows[0],
              tableRows: parsedRows.slice(1),
            },
          };
        }
      }
    }
  }

  // 1b. LaTeX \begin{array} or \begin{tabular}
  const latexTableMatch = content.match(
    /\\begin\{(array|tabular)\}(?:\{[^}]*\})?([\s\S]*?)\\end\{\1\}/i
  );
  if (latexTableMatch) {
    const inner = latexTableMatch[2];
    const cleanContent = content
      .replace(latexTableMatch[0], ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    const rawRows = inner
      .split(/\\\\/g)
      .map((l) => l.replace(/\\hline/g, '').trim())
      .filter(Boolean)
      .map((l) => l.split('&').map((p) => p.trim()));

    if (rawRows.length >= 2) {
      const r0Lower = (rawRows[0][0] || '').toLowerCase();
      const r1Lower = (rawRows[1][0] || '').toLowerCase();
      if (r0Lower.includes('x') && (r1Lower.includes("y'") || r1Lower.includes("f'") || r1Lower === 'y')) {
        const xVals = rawRows[0].slice(1).filter(Boolean);
        const yPrime = rawRows[1].slice(1).filter(Boolean);
        if (rawRows.length >= 3) {
          const yRaw = rawRows[2].slice(1).filter((v) => v !== '' && !/\\nearrow|\\searrow|\\uparrow|\\downarrow/i.test(v));
          const arrows: any[] = [];
          for (let k = 0; k < Math.max(0, xVals.length - 1); k++) {
            const sign = yPrime[k * 2 + 1] || yPrime[k] || '+';
            const isUp = !sign.includes('-');
            arrows.push({
              start: yRaw[k] || (isUp ? '-\\infty' : '+\\infty'),
              end: yRaw[k + 1] || (isUp ? '+\\infty' : '-\\infty'),
              dir: isUp ? 'up' : 'down',
            });
          }
          return {
            cleanContent,
            detectedType: 'variation_table',
            detectedData: {
              title: 'Bảng biến thiên của hàm số',
              x: xVals,
              yPrime,
              yArrows: arrows,
            },
          };
        }
        return {
          cleanContent,
          detectedType: 'sign_table',
          detectedData: {
            title: 'Bảng xét dấu',
            x: xVals,
            rows: rawRows.slice(1).map((r) => ({ label: r[0] || "f'(x)", signs: r.slice(1) })),
          },
        };
      }

      return {
        cleanContent,
        detectedType: 'data_table',
        detectedData: {
          title: 'Bảng số liệu',
          headers: rawRows[0],
          tableRows: rawRows.slice(1),
        },
      };
    }
  }

  const lower = content.toLowerCase();

  // 2. Spatial Geometry 3D keywords
  if (lower.includes('chóp tam giác') || lower.includes('tứ diện') || lower.includes('s.abc')) {
    return {
      cleanContent: content,
      detectedType: 'geometry',
      detectedData: { title: 'Hình chóp tam giác S.ABC', shape: 'pyramid_triangular' },
    };
  }
  if (lower.includes('chóp tứ giác') || lower.includes('s.abcd')) {
    return {
      cleanContent: content,
      detectedType: 'geometry',
      detectedData: { title: 'Hình chóp tứ giác S.ABCD', shape: 'pyramid_quad' },
    };
  }
  if (lower.includes('lăng trụ') || lower.includes("abc.a'b'c'")) {
    return {
      cleanContent: content,
      detectedType: 'geometry',
      detectedData: { title: "Hình lăng trụ tam giác ABC.A'B'C'", shape: 'prism' },
    };
  }
  if (lower.includes('hình nón') || lower.includes('khối nón')) {
    return {
      cleanContent: content,
      detectedType: 'geometry',
      detectedData: { title: 'Hình nón tròn xoay', shape: 'cone' },
    };
  }
  if (lower.includes('hình trụ') || lower.includes('khối trụ')) {
    return {
      cleanContent: content,
      detectedType: 'geometry',
      detectedData: { title: 'Hình trụ tròn xoay', shape: 'cylinder' },
    };
  }
  if (lower.includes('mặt cầu') || lower.includes('khối cầu') || lower.includes('hình cầu')) {
    return {
      cleanContent: content,
      detectedType: 'geometry',
      detectedData: { title: 'Mặt cầu tâm O bán kính R', shape: 'sphere' },
    };
  }
  if (lower.includes('lập phương') || lower.includes('hộp chữ nhật')) {
    return {
      cleanContent: content,
      detectedType: 'geometry',
      detectedData: { title: "Hình hộp chữ nhật / lập phương ABCD.A'B'C'D'", shape: 'cuboid' },
    };
  }

  // 3. Variation table keyword fallback
  if (lower.includes('bảng biến thiên') || /\bbbt\b/i.test(lower)) {
    return {
      cleanContent: content,
      detectedType: 'variation_table',
      detectedData: {
        title: 'Bảng biến thiên của hàm số',
        x: ['-\\infty', '-1', '1', '+\\infty'],
        yPrime: ['+', '0', '-', '0', '+'],
        yArrows: [
          { start: '-\\infty', end: '4', dir: 'up' },
          { start: '4', end: '-2', dir: 'down' },
          { start: '-2', end: '+\\infty', dir: 'up' },
        ],
      },
    };
  }

  // 4. Sign table keyword fallback
  if (lower.includes('bảng xét dấu') || lower.includes('xét dấu của')) {
    return {
      cleanContent: content,
      detectedType: 'sign_table',
      detectedData: {
        title: 'Bảng xét dấu',
        x: ['-\\infty', '-2', '3', '+\\infty'],
        rows: [{ label: "f'(x)", signs: ['+', '0', '-', '0', '+'] }],
      },
    };
  }

  // 5. Statistics table keyword fallback
  if (lower.includes('bảng thống kê') || lower.includes('tần số') || lower.includes('tần suất')) {
    return {
      cleanContent: content,
      detectedType: 'data_table',
      detectedData: {
        title: 'Bảng phân bố tần số ghép nhóm',
        headers: ['Nhóm [a; b)', 'Giá trị đại diện', 'Tần số (n_i)', 'Tần suất (%)'],
        tableRows: [
          ['[0; 2)', '1', '5', '10%'],
          ['[2; 4)', '3', '12', '24%'],
          ['[4; 6)', '5', '18', '36%'],
          ['[6; 8)', '7', '10', '20%'],
          ['[8; 10]', '9', '5', '10%'],
          ['Tổng cộng', '—', 'n = 50', '100%'],
        ],
      },
    };
  }

  // 6. Function graph keyword fallback
  if (
    lower.includes('đồ thị') ||
    lower.includes('hình vẽ') ||
    lower.includes('như hình') ||
    lower.includes('hình bên') ||
    lower.includes('đường cong')
  ) {
    const isRational =
      lower.includes('tiệm cận') ||
      lower.includes('phân thức') ||
      lower.includes('hyperbol') ||
      /\\d?frac/.test(content);
    const isBiquad = lower.includes('trùng phương') || lower.includes('bậc bốn') || /x\^\{?4\}?/.test(content);
    const isQuad = lower.includes('parabol') || lower.includes('bậc hai') || (!isBiquad && /x\^\{?2\}?/.test(content));
    const formulaMatch = content.match(/(?:y|f\(x\))\s*=\s*([^$,\n?]+)/i);
    const extractedLatex = formulaMatch ? formulaMatch[0].replace(/\$/g, '').trim() : '';

    return {
      cleanContent: content,
      detectedType: 'function_graph',
      detectedData: {
        title: isRational
          ? 'Đồ thị hàm phân thức'
          : isBiquad
          ? 'Đồ thị hàm số bậc bốn trùng phương'
          : isQuad
          ? 'Đồ thị hàm số bậc hai (Parabol)'
          : 'Đồ thị hàm số bậc ba',
        graphType: isRational ? 'rational' : isBiquad ? 'biquadratic' : isQuad ? 'quadratic' : 'cubic',
        latex:
          extractedLatex ||
          (isRational
            ? 'y = \\frac{ax+b}{cx+d}'
            : isBiquad
            ? 'y = x^4 - 2x^2 - 1'
            : isQuad
            ? 'y = x^2 - 4x + 3'
            : 'y = x^3 - 3x + 1'),
      },
    };
  }

  // 7. Practical Math Scenario fallback
  const practicalScenario = detectPracticalScenario(content);
  if (practicalScenario) {
    return {
      cleanContent: content,
      detectedType: 'practical_illustration',
      detectedData: {
        scenario: practicalScenario,
        title: 'Hình vẽ minh họa bài toán thực tế',
      },
    };
  }

  return { cleanContent: content };
}

function normalizeSgkRowSignsDocx(
  rawList: string[],
  xCount: number,
  fallbackDirs?: Array<{ dir?: string }>
): { roots: string[]; intervals: string[] } {
  const n = Math.max(2, xCount);
  const list = Array.isArray(rawList) ? rawList.map((s) => (s ?? '').toString().trim()) : [];
  const roots: string[] = [];
  const intervals: string[] = [];

  if (list.length === 2 * n - 3) {
    for (let i = 0; i < n - 1; i++) {
      intervals.push(list[i * 2] || (fallbackDirs?.[i]?.dir === 'up' ? '+' : '-'));
    }
    for (let i = 1; i < n - 1; i++) {
      roots.push(list[i * 2 - 1] || '0');
    }
  } else if (list.length >= 2 * n - 2) {
    for (let i = 0; i < n - 1; i++) {
      intervals.push(list[i * 2 + 1] || list[i * 2] || (fallbackDirs?.[i]?.dir === 'up' ? '+' : '-'));
    }
    for (let i = 1; i < n - 1; i++) {
      roots.push(list[i * 2] || '0');
    }
  } else {
    for (let i = 0; i < n - 1; i++) {
      intervals.push(list[i] || (fallbackDirs?.[i]?.dir === 'up' ? '+' : '-'));
    }
    for (let i = 1; i < n - 1; i++) {
      roots.push('0');
    }
  }
  return { roots, intervals };
}

/**
 * 1. Render Bảng Biến Thiên chuẩn SGK GDPT 2018 thành ảnh PNG sắc nét (không tiêu đề thừa)
 */
export function renderVariationTablePng(data: QuizDiagramData): RenderedDocxPng | null {
  const xVals: string[] = Array.isArray(data?.x) && data.x.length >= 2 ? data.x : ['-\\infty', '-1', '2', '+\\infty'];
  const n = xVals.length;
  const rawArrows: any[] =
    Array.isArray(data?.yArrows) && data.yArrows.length > 0
      ? data.yArrows
      : [
          { start: '-\\infty', end: '3', dir: 'up' },
          { start: '3', end: '-2', dir: 'down' },
          { start: '-2', end: '+\\infty', dir: 'up' },
        ];
  const yPrimeList: string[] = Array.isArray(data?.yPrime) && data.yPrime.length > 0 ? data.yPrime : ['+', '0', '-', '0', '+'];
  const { roots: yPrimeRoots, intervals: yPrimeIntervals } = normalizeSgkRowSignsDocx(yPrimeList, n, rawArrows);

  const W = 520;
  const H = 194;

  return renderOnCanvas(
    W,
    H,
    2.5,
    (ctx) => {
      const margin = 8;
      const leftColW = 50;
      const boxX = margin;
      const boxY = margin;
      const boxW = W - 2 * margin;
      const row1H = 32;
      const row2H = 32;
      const row3H = H - boxY - row1H - row2H - margin;
      const areaX = boxX + leftColW;
      const areaW = boxW - leftColW;
      const padX = 28;
      const getX = (idx: number) =>
        n <= 1 ? areaX + areaW / 2 : areaX + padX + (idx * (areaW - 2 * padX)) / (n - 1);

      // Outer border & clean SGK table dividers
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(boxX, boxY, boxW, row1H + row2H + row3H);

      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(areaX, boxY);
      ctx.lineTo(areaX, boxY + row1H + row2H + row3H);
      ctx.moveTo(boxX, boxY + row1H);
      ctx.lineTo(boxX + boxW, boxY + row1H);
      ctx.moveTo(boxX, boxY + row1H + row2H);
      ctx.lineTo(boxX + boxW, boxY + row1H + row2H);
      ctx.stroke();

      // Left column labels: x, y', y (Times New Roman italic chuẩn SGK)
      ctx.font = 'bold italic 14px "Times New Roman", serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('x', boxX + leftColW / 2, boxY + row1H / 2);
      ctx.fillText("y'", boxX + leftColW / 2, boxY + row1H + row2H / 2);
      ctx.fillText('y', boxX + leftColW / 2, boxY + row1H + row2H + row3H / 2);

      // X values
      xVals.forEach((val, idx) => {
        drawCanvasMathCentered(ctx, val, getX(idx), boxY + row1H / 2, 13, '#0f172a', false);
      });

      // Row 2: y' critical zeros / asymptotes || and interval signs
      const y2Center = boxY + row1H + row2H / 2;
      const y3Top = boxY + row1H + row2H;
      const y3Bot = y3Top + row3H;

      for (let idx = 1; idx < n - 1; idx++) {
        const rootSign = (yPrimeRoots[idx - 1] || '0').trim();
        const cx = getX(idx);
        if (rootSign === '||' || rootSign === '|') {
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1.35;
          ctx.beginPath();
          ctx.moveTo(cx - 2.3, boxY + row1H);
          ctx.lineTo(cx - 2.3, y3Bot);
          ctx.moveTo(cx + 2.3, boxY + row1H);
          ctx.lineTo(cx + 2.3, y3Bot);
          ctx.stroke();
        } else {
          drawCanvasMathCentered(ctx, rootSign, cx, y2Center, 13, '#0f172a', false);
        }
      }

      // Interval signs between critical points (clean black ink chuẩn SGK)
      for (let idx = 0; idx < n - 1; idx++) {
        const midX = (getX(idx) + getX(idx + 1)) / 2;
        const sign = (yPrimeIntervals[idx] || (rawArrows[idx]?.dir === 'up' ? '+' : '-')).trim();
        ctx.font = 'bold 14.5px "Times New Roman", serif';
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sign, midX, y2Center);
      }

      // Compute high / low elevation for each point in row y
      const points: { val: string; isHigh: boolean }[] = [];
      for (let i = 0; i < n; i++) {
        if (i === 0) {
          const isHigh = rawArrows[0]?.dir === 'down';
          points.push({ val: rawArrows[0]?.start || '-\\infty', isHigh });
        } else {
          const prev = rawArrows[i - 1];
          const isHigh = prev ? prev.dir === 'up' : false;
          points.push({ val: prev?.end || (isHigh ? '+\\infty' : '-\\infty'), isHigh });
        }
      }

      const highY = y3Top + 20;
      const lowY = y3Bot - 20;

      // Diagonal variation arrows in row 3
      for (let i = 0; i < Math.min(rawArrows.length, n - 1); i++) {
        const arr = rawArrows[i];
        const isUp = arr?.dir === 'up';
        const x1 = getX(i) + 22;
        const x2 = getX(i + 1) - 22;
        if (x2 <= x1 + 6) continue;
        const sy = isUp ? lowY - 5 : highY + 5;
        const ey = isUp ? highY + 5 : lowY - 5;

        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x1, sy);
        ctx.lineTo(x2, ey);
        ctx.stroke();
        drawArrowhead(ctx, x1, sy, x2, ey, 7, '#0f172a');
      }

      // Draw endpoint values cleanly without overlap
      points.forEach((pt, idx) => {
        const cx = getX(idx);
        const cy = pt.isHigh ? highY : lowY;
        const rootSign = idx > 0 && idx < n - 1 ? (yPrimeRoots[idx - 1] || '').trim() : '';
        const asym = rootSign === '||' || rootSign === '|';
        if (asym && idx > 0 && idx < n - 1) {
          const prevArr = rawArrows[idx - 1];
          const nextArr = rawArrows[idx];
          if (prevArr?.end) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(cx - 28, (prevArr.dir === 'up' ? highY : lowY) - 10, 22, 20);
            drawCanvasMathCentered(ctx, prevArr.end, cx - 17, prevArr.dir === 'up' ? highY : lowY, 12.5, '#0f172a', false);
          }
          if (nextArr?.start) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(cx + 6, (nextArr.dir === 'down' ? highY : lowY) - 10, 22, 20);
            drawCanvasMathCentered(ctx, nextArr.start, cx + 17, nextArr.dir === 'down' ? highY : lowY, 12.5, '#0f172a', false);
          }
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(cx - 20, cy - 11, 40, 22);
          drawCanvasMathCentered(ctx, pt.val, cx, cy, 13, '#0f172a', false);
        }
      });
    },
    420
  );
}

/**
 * 2. Render Bảng Xét Dấu chuẩn SGK GDPT 2018 thành ảnh PNG sắc nét (không tiêu đề thừa)
 */
export function renderSignTablePng(data: QuizDiagramData): RenderedDocxPng | null {
  const xVals: string[] = Array.isArray(data?.x) && data.x.length >= 2 ? data.x : ['-\\infty', '-2', '3', '+\\infty'];
  const rows: Array<{ label: string; signs: string[] }> =
    Array.isArray(data?.rows) && data.rows.length > 0
      ? data.rows
      : [{ label: "f'(x)", signs: ['+', '0', '-', '0', '+'] }];

  const W = 520;
  const rowH = 34;
  const margin = 8;
  const H = margin * 2 + rowH * (1 + rows.length);

  return renderOnCanvas(
    W,
    H,
    2.5,
    (ctx) => {
      const leftColW = 74;
      const boxX = margin;
      const boxY = margin;
      const boxW = W - 2 * margin;
      const boxH = rowH * (1 + rows.length);
      const areaX = boxX + leftColW;
      const areaW = boxW - leftColW;
      const n = xVals.length;
      const padX = 28;
      const getX = (idx: number) =>
        n <= 1 ? areaX + areaW / 2 : areaX + padX + (idx * (areaW - 2 * padX)) / (n - 1);

      // Outer border & crisp dividers (chuẩn SGK giấy trắng nét đen)
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(areaX, boxY);
      ctx.lineTo(areaX, boxY + boxH);
      for (let r = 1; r <= rows.length; r++) {
        ctx.moveTo(boxX, boxY + r * rowH);
        ctx.lineTo(boxX + boxW, boxY + r * rowH);
      }
      ctx.stroke();

      // Label 'x' and x values
      drawCanvasMathCentered(ctx, 'x', boxX + leftColW / 2, boxY + rowH / 2, 14, '#0f172a', true);
      xVals.forEach((val, idx) => {
        drawCanvasMathCentered(ctx, val, getX(idx), boxY + rowH / 2, 13, '#0f172a', false);
      });

      // Sign rows
      rows.forEach((row, rIdx) => {
        const cy = boxY + (rIdx + 1) * rowH + rowH / 2;
        drawCanvasMathCentered(ctx, row.label || "f'(x)", boxX + leftColW / 2, cy, 13, '#0f172a', true);
        const { roots, intervals } = normalizeSgkRowSignsDocx(row.signs || [], n);

        for (let i = 1; i < n - 1; i++) {
          const rootSym = (roots[i - 1] || '0').trim();
          const cx = getX(i);
          if (rootSym === '||' || rootSym === '|') {
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.35;
            ctx.beginPath();
            ctx.moveTo(cx - 2.3, boxY + (rIdx + 1) * rowH);
            ctx.lineTo(cx - 2.3, boxY + (rIdx + 2) * rowH);
            ctx.moveTo(cx + 2.3, boxY + (rIdx + 1) * rowH);
            ctx.lineTo(cx + 2.3, boxY + (rIdx + 2) * rowH);
            ctx.stroke();
          } else {
            drawCanvasMathCentered(ctx, rootSym, cx, cy, 13, '#0f172a', false);
          }
        }
        for (let i = 0; i < n - 1; i++) {
          const s = (intervals[i] || '+').trim();
          const midX = (getX(i) + getX(i + 1)) / 2;
          ctx.font = 'bold 14.5px "Times New Roman", serif';
          ctx.fillStyle = '#0f172a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(s, midX, cy);
        }
      });
    },
    420
  );
}

/**
 * 3. Render Đồ Thị Hàm Số chuẩn SGK (Oxy trắng tinh khiết, không tiêu đề, không hiện tên hàm số)
 */
export function renderFunctionGraphPng(data: QuizDiagramData, questionText: string = ''): RenderedDocxPng | null {
  const cleanLatex = ((data?.latex || data?.equation || data?.fn || '') + '').replace(/\$/g, '').trim();
  const analysis = analyzeAndSampleSgkGraph({
    latex: cleanLatex,
    questionText,
    graphType: data?.graphType || data?.functionType,
    title: data?.title,
    asymptoteX: data?.asymptoteX !== undefined ? Number(data.asymptoteX) : undefined,
    asymptoteY: data?.asymptoteY !== undefined ? Number(data.asymptoteY) : undefined,
  });

  const W = 400;
  const H = 265;
  const padLeft = 24;
  const padRight = 24;
  const padTop = 20;
  const padBot = 20;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBot;

  const spanX = Math.max(1e-4, analysis.maxX - analysis.minX);
  const spanY = Math.max(1e-4, analysis.maxY - analysis.minY);
  const toX = (x: number) => padLeft + ((x - analysis.minX) / spanX) * plotW;
  const toY = (y: number) => padTop + ((analysis.maxY - y) / spanY) * plotH;
  const originX = toX(0);
  const originY = toY(0);

  return renderOnCanvas(
    W,
    H,
    2.5,
    (ctx) => {
      // Clip plot area for curves & asymptotes (nền trắng tinh chuẩn SGK, không viền hộp hay tiêu đề)
      ctx.save();
      ctx.beginPath();
      ctx.rect(padLeft - 4, padTop - 4, plotW + 8, plotH + 8);
      ctx.clip();

      // 1. Asymptotes (dashed crimson)
      analysis.asymptotes.forEach((asym) => {
        ctx.save();
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1.3;
        ctx.setLineDash([5, 3.5]);
        ctx.beginPath();
        if (asym.kind === 'vertical' && asym.x !== undefined) {
          const sx = toX(asym.x);
          ctx.moveTo(sx, padTop);
          ctx.lineTo(sx, H - padBot);
        } else if (asym.kind === 'horizontal' && asym.y !== undefined) {
          const sy = toY(asym.y);
          ctx.moveTo(padLeft, sy);
          ctx.lineTo(W - padRight, sy);
        } else if (asym.kind === 'oblique' && asym.m !== undefined && asym.q !== undefined) {
          ctx.moveTo(toX(analysis.minX), toY(asym.m * analysis.minX + asym.q));
          ctx.lineTo(toX(analysis.maxX), toY(asym.m * analysis.maxX + asym.q));
        }
        ctx.stroke();
        ctx.restore();
      });

      // 2. Projection dashed lines from extrema to Ox / Oy
      analysis.keyPoints.forEach((pt) => {
        if (!pt.showProjections) return;
        const sx = toX(pt.x);
        const sy = toY(pt.y);
        ctx.save();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3.5, 2.5]);
        if (Math.abs(pt.y) > 0.08) {
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx, originY);
          ctx.stroke();
        }
        if (Math.abs(pt.x) > 0.08) {
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(originX, sy);
          ctx.stroke();
        }
        ctx.restore();
      });

      // 3. Smooth blue SGK curves
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 2.35;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      analysis.branches.forEach((pts) => {
        if (pts.length < 2) return;
        ctx.beginPath();
        pts.forEach((p, idx) => {
          const sx = toX(p.x);
          const sy = toY(p.y);
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
      });
      ctx.restore(); // unclip

      // 4. Axes Ox & Oy with sharp arrows
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.65;
      ctx.beginPath();
      ctx.moveTo(padLeft - 6, originY);
      ctx.lineTo(W - padRight + 10, originY);
      ctx.moveTo(originX, H - padBot + 6);
      ctx.lineTo(originX, padTop - 10);
      ctx.stroke();
      drawArrowhead(ctx, padLeft - 6, originY, W - padRight + 10, originY, 7, '#0f172a');
      drawArrowhead(ctx, originX, H - padBot + 6, originX, padTop - 10, 7, '#0f172a');

      const drawHaloText = (text: string, x: number, y: number, align: CanvasTextAlign, font: string, color: string) => {
        ctx.save();
        ctx.font = font;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3.2;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeText(text, x, y);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        ctx.restore();
      };

      // Axis labels x, y, O in italic Times New Roman
      drawHaloText('x', W - padRight + 8, originY + 13, 'center', 'bold italic 14px "Times New Roman", serif', '#0f172a');
      drawHaloText('y', originX - 12, padTop + 1, 'center', 'bold italic 14px "Times New Roman", serif', '#0f172a');
      drawHaloText('O', originX - 10, originY + 12, 'center', 'italic 13px "Times New Roman", serif', '#0f172a');

      // 5. Key ticks only (collision-avoidance opposite projection lines)
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.25;
      analysis.xTicks.forEach((t) => {
        const sx = toX(t.val);
        ctx.beginPath();
        ctx.moveTo(sx, originY - 2.8);
        ctx.lineTo(sx, originY + 2.8);
        ctx.stroke();
        const placeAbove = analysis.keyPoints.some(
          (pt) => pt.showProjections && Math.abs(pt.x - t.val) < 0.15 && pt.y < -0.1
        );
        drawHaloText(
          t.label,
          sx,
          placeAbove ? originY - 12 : originY + 13,
          'center',
          '12.5px "Times New Roman", serif',
          '#0f172a'
        );
      });

      analysis.yTicks.forEach((t) => {
        const sy = toY(t.val);
        ctx.beginPath();
        ctx.moveTo(originX - 2.8, sy);
        ctx.lineTo(originX + 2.8, sy);
        ctx.stroke();
        const placeRight = analysis.keyPoints.some(
          (pt) => pt.showProjections && Math.abs(pt.y - t.val) < 0.15 && pt.x < -0.1
        );
        drawHaloText(
          t.label,
          placeRight ? originX + 7 : originX - 7,
          sy,
          placeRight ? 'left' : 'right',
          '12.5px "Times New Roman", serif',
          '#0f172a'
        );
      });

      // 6. Key points (solid dots + center I)
      analysis.keyPoints.forEach((pt) => {
        const sx = toX(pt.x);
        const sy = toY(pt.y);
        ctx.save();
        ctx.fillStyle = pt.isCenter ? '#dc2626' : '#0f172a';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(sx, sy, pt.isCenter || pt.isExtremum ? 3.2 : 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        if (pt.isCenter) {
          drawHaloText(pt.label || 'I', sx + 8, sy - 8, 'left', 'bold italic 13px "Times New Roman", serif', '#dc2626');
        }
      });
    },
    345
  );
}

/**
 * 4. Render Hình Học Không Gian 3D chuẩn SGK GDPT 2018 thành ảnh PNG
 */
export function renderGeometry3DPng(data: QuizDiagramData): RenderedDocxPng | null {
  const shape = data?.shape || 'pyramid_quad';
  const W = 320;
  const H = 235;

  return renderOnCanvas(
    W,
    H,
    2.5,
    (ctx) => {
      // Title bar
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, W, 28);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(1, 1, W - 2, H - 2);
      ctx.beginPath();
      ctx.moveTo(0, 28);
      ctx.lineTo(W, 28);
      ctx.stroke();

      ctx.font = 'bold 11px Arial, sans-serif';
      ctx.fillStyle = '#312e81';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(data?.title || 'HÌNH HỌC KHÔNG GIAN CHUẨN SGK', W / 2, 14);

      const ox = 40;
      const oy = 25;

      const lineSolid = (x1: number, y1: number, x2: number, y2: number, color = '#1e293b', lw = 1.9) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(ox + x1, oy + y1);
        ctx.lineTo(ox + x2, oy + y2);
        ctx.stroke();
        ctx.restore();
      };

      const lineDash = (x1: number, y1: number, x2: number, y2: number, color = '#64748b', lw = 1.6) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(ox + x1, oy + y1);
        ctx.lineTo(ox + x2, oy + y2);
        ctx.stroke();
        ctx.restore();
      };

      const labelPt = (text: string, x: number, y: number, color = '#0f172a') => {
        ctx.font = 'bold 12px "Times New Roman", serif';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, ox + x, oy + y);
      };

      if (shape === 'prism') {
        lineSolid(50, 150, 140, 170);
        lineSolid(140, 170, 185, 145);
        lineDash(50, 150, 185, 145);
        lineSolid(50, 55, 140, 75);
        lineSolid(140, 75, 185, 50);
        lineSolid(185, 50, 50, 55);
        lineSolid(50, 55, 50, 150);
        lineSolid(140, 75, 140, 170);
        lineSolid(185, 50, 185, 145);
        labelPt("A'", 36, 52);
        labelPt("B'", 145, 84);
        labelPt("C'", 196, 50);
        labelPt('A', 36, 155);
        labelPt('B', 144, 184);
        labelPt('C', 196, 148);
      } else if (shape === 'pyramid_triangular') {
        lineSolid(120, 18, 40, 145);
        lineSolid(120, 18, 135, 170);
        lineSolid(120, 18, 200, 140);
        lineSolid(40, 145, 135, 170);
        lineSolid(135, 170, 200, 140);
        lineDash(40, 145, 200, 140);
        lineDash(120, 18, 120, 152, '#ea580c', 1.6);
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(ox + 120, oy + 152, 2.8, 0, Math.PI * 2);
        ctx.fill();
        labelPt('S', 120, 10, '#4338ca');
        labelPt('A', 28, 148);
        labelPt('B', 135, 184);
        labelPt('C', 212, 144);
        labelPt('H', 130, 157, '#ea580c');
      } else if (shape === 'cone') {
        lineSolid(120, 18, 45, 150);
        lineSolid(120, 18, 195, 150);
        // Front half solid ellipse
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.9;
        ctx.beginPath();
        ctx.ellipse(ox + 120, oy + 150, 75, 22, 0, 0, Math.PI);
        ctx.stroke();
        // Back half dashed ellipse
        ctx.save();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.ellipse(ox + 120, oy + 150, 75, 22, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        lineDash(120, 18, 120, 150, '#ea580c', 1.6);
        lineDash(120, 150, 195, 150, '#ea580c', 1.6);
        // Right angle marker at O
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 1.3;
        ctx.strokeRect(ox + 120, oy + 141, 9, 9);
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(ox + 120, oy + 150, 2.8, 0, Math.PI * 2);
        ctx.fill();
        labelPt('S', 120, 10, '#4338ca');
        labelPt('O', 117, 165, '#ea580c');
        labelPt('A', 33, 154);
        labelPt('B', 206, 154);
        labelPt('h', 110, 90, '#ea580c');
        labelPt('R', 158, 142, '#ea580c');
      } else if (shape === 'cylinder') {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.9;
        ctx.beginPath();
        ctx.ellipse(ox + 120, oy + 50, 70, 20, 0, 0, Math.PI * 2);
        ctx.stroke();
        lineSolid(50, 50, 50, 150);
        lineSolid(190, 50, 190, 150);
        ctx.beginPath();
        ctx.ellipse(ox + 120, oy + 150, 70, 20, 0, 0, Math.PI);
        ctx.stroke();
        ctx.save();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.ellipse(ox + 120, oy + 150, 70, 20, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        lineDash(120, 50, 120, 150, '#ea580c', 1.6);
        lineDash(120, 150, 190, 150, '#ea580c', 1.5);
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(ox + 120, oy + 50, 2.8, 0, Math.PI * 2);
        ctx.arc(ox + 120, oy + 150, 2.8, 0, Math.PI * 2);
        ctx.fill();
        labelPt('O', 115, 40, '#ea580c');
        labelPt("O'", 115, 165, '#ea580c');
        labelPt('r', 155, 142, '#ea580c');
        labelPt('h', 111, 100, '#ea580c');
      } else if (shape === 'sphere') {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.9;
        ctx.beginPath();
        ctx.arc(ox + 120, oy + 98, 68, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(ox + 120, oy + 98, 68, 22, 0, 0, Math.PI);
        ctx.stroke();
        ctx.save();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.ellipse(ox + 120, oy + 98, 68, 22, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        lineDash(120, 98, 188, 98, '#ea580c', 1.6);
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(ox + 120, oy + 98, 3, 0, Math.PI * 2);
        ctx.fill();
        labelPt('O', 114, 88, '#ea580c');
        labelPt('R', 154, 88, '#ea580c');
      } else if (shape === 'cuboid' || shape === 'cube') {
        lineSolid(50, 150, 140, 165);
        lineSolid(140, 165, 190, 140);
        lineSolid(50, 65, 140, 80);
        lineSolid(140, 80, 190, 55);
        lineSolid(190, 55, 100, 40);
        lineSolid(100, 40, 50, 65);
        lineSolid(50, 65, 50, 150);
        lineSolid(140, 80, 140, 165);
        lineSolid(190, 55, 190, 140);
        lineDash(100, 40, 100, 125);
        lineDash(50, 150, 100, 125);
        lineDash(190, 140, 100, 125);
        labelPt("A'", 36, 64);
        labelPt("B'", 145, 89);
        labelPt("C'", 202, 55);
        labelPt("D'", 100, 29);
        labelPt('A', 36, 155);
        labelPt('B', 145, 179);
        labelPt('C', 202, 145);
        labelPt('D', 100, 136);
      } else {
        // Default pyramid_quad S.ABCD
        lineSolid(40, 140, 140, 165);
        lineSolid(140, 165, 200, 130);
        lineDash(40, 140, 100, 110);
        lineDash(100, 110, 200, 130);
        lineSolid(120, 18, 40, 140);
        lineSolid(120, 18, 140, 165);
        lineSolid(120, 18, 200, 130);
        lineDash(120, 18, 100, 110);
        // Optional subtle height SO
        lineDash(120, 18, 120, 137, '#ea580c', 1.4);
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(ox + 120, oy + 137, 2.4, 0, Math.PI * 2);
        ctx.fill();
        labelPt('S', 120, 10, '#4338ca');
        labelPt('A', 28, 145);
        labelPt('B', 142, 179);
        labelPt('C', 212, 134);
        labelPt('D', 92, 100);
        labelPt('O', 129, 142, '#ea580c');
      }
    },
    265
  );
}

/**
 * 5. Render Hình Minh Họa Bài Toán Thực Tế thành ảnh PNG
 */
export function renderPracticalIllustrationPng(data: QuizDiagramData, questionText: string = ''): RenderedDocxPng | null {
  const scenario: PracticalScenario = data?.scenario || detectPracticalScenario(questionText) || 'box_folding';
  const W = 450;
  const H = 225;

  return renderOnCanvas(
    W,
    H,
    2.5,
    (ctx) => {
      ctx.fillStyle = '#fffbeb';
      ctx.fillRect(0, 0, W, 30);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(1, 1, W - 2, H - 2);
      ctx.beginPath();
      ctx.moveTo(0, 30);
      ctx.lineTo(W, 30);
      ctx.stroke();

      ctx.font = 'bold 11px Arial, sans-serif';
      ctx.fillStyle = '#92400e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((data?.title || 'HÌNH VẼ MINH HỌA BÀI TOÁN THỰC TẾ').toUpperCase(), W / 2, 15);

      const oy = 38;
      if (scenario === 'cylinder_can') {
        // 3D cylinder left
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(125, oy + 36, 54, 17, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(71, oy + 36);
        ctx.lineTo(71, oy + 138);
        ctx.moveTo(179, oy + 36);
        ctx.lineTo(179, oy + 138);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(125, oy + 138, 54, 17, 0, 0, Math.PI);
        ctx.stroke();
        // Axis & R
        ctx.save();
        ctx.strokeStyle = '#ea580c';
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(125, oy + 36);
        ctx.lineTo(125, oy + 138);
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(125, oy + 36);
        ctx.lineTo(179, oy + 36);
        ctx.stroke();
        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.fillStyle = '#2563eb';
        ctx.fillText('R', 152, oy + 26);
        ctx.fillStyle = '#dc2626';
        ctx.fillText('h', 194, oy + 88);
        // Formula card right
        ctx.fillStyle = '#f8fafc';
        drawRoundedRect(ctx, 225, oy + 22, 195, 122, 8);
        ctx.fill();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.textAlign = 'left';
        ctx.fillStyle = '#0f172a';
        ctx.fillText('Thông số hình trụ:', 240, oy + 46);
        ctx.font = '12px Arial, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.fillText('• V = π·R²·h', 240, oy + 72);
        ctx.fillStyle = '#1d4ed8';
        ctx.fillText('• S_tp = 2πR² + 2πRh', 240, oy + 96);
        ctx.font = 'bold 11.5px Arial, sans-serif';
        ctx.fillStyle = '#16a34a';
        ctx.fillText('• Đạt tối ưu khi h = 2R', 240, oy + 122);
      } else if (scenario === 'parabola_arch') {
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(35, oy + 140);
        ctx.lineTo(415, oy + 140);
        ctx.stroke();
        ctx.fillStyle = '#eff6ff';
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(75, oy + 140);
        ctx.quadraticCurveTo(225, oy - 8, 375, oy + 140);
        ctx.fill();
        ctx.stroke();
        ctx.save();
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(225, oy + 66);
        ctx.lineTo(225, oy + 140);
        ctx.stroke();
        ctx.restore();
        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.fillStyle = '#dc2626';
        ctx.fillText('H (đỉnh vòm)', 270, oy + 96);
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'center';
        ctx.fillText('Chiều rộng chân cổng W', 225, oy + 158);
      } else if (scenario === 'boat_river') {
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(25, oy + 26, 400, 86);
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(25, oy + 26);
        ctx.lineTo(425, oy + 26);
        ctx.moveTo(25, oy + 112);
        ctx.lineTo(425, oy + 112);
        ctx.stroke();
        ctx.save();
        ctx.strokeStyle = '#94a3b8';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(75, oy + 26);
        ctx.lineTo(75, oy + 112);
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(75, oy + 26);
        ctx.lineTo(195, oy + 112);
        ctx.stroke();
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(195, oy + 112);
        ctx.lineTo(385, oy + 112);
        ctx.stroke();
        ctx.font = 'bold 11.5px Arial, sans-serif';
        ctx.fillStyle = '#dc2626';
        ctx.fillText('A (Xuất phát)', 90, oy + 14);
        ctx.fillText('Chèo (v₁)', 160, oy + 62);
        ctx.fillStyle = '#64748b';
        ctx.fillText('H', 75, oy + 128);
        ctx.fillStyle = '#ea580c';
        ctx.fillText('M (x)', 195, oy + 128);
        ctx.fillStyle = '#16a34a';
        ctx.fillText('B (Đích)', 385, oy + 128);
        ctx.fillText('Chạy (v₂)', 290, oy + 98);
      } else if (scenario === 'fence_plot') {
        ctx.strokeStyle = '#0369a1';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(40, oy + 26);
        ctx.lineTo(410, oy + 26);
        ctx.stroke();
        ctx.fillStyle = '#f0fdf4';
        ctx.fillRect(85, oy + 26, 280, 104);
        ctx.save();
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2.4;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(85, oy + 26);
        ctx.lineTo(85, oy + 130);
        ctx.lineTo(365, oy + 130);
        ctx.lineTo(365, oy + 26);
        ctx.stroke();
        ctx.restore();
        ctx.font = 'bold 11.5px Arial, sans-serif';
        ctx.fillStyle = '#0369a1';
        ctx.fillText('Bờ sông / Bờ tường thẳng', 225, oy + 14);
        ctx.fillStyle = '#dc2626';
        ctx.fillText('x', 70, oy + 80);
        ctx.fillText('x', 380, oy + 80);
        ctx.fillText('y (chiều dài)', 225, oy + 148);
        ctx.fillStyle = '#15803d';
        ctx.fillText('Diện tích S = x · y (lớn nhất)', 225, oy + 80);
      } else if (scenario === 'cone_tank') {
        ctx.fillStyle = '#f1f5f9';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(225, oy + 24, 75, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(150, oy + 24);
        ctx.lineTo(225, oy + 150);
        ctx.lineTo(300, oy + 24);
        ctx.stroke();
        ctx.fillStyle = '#bae6fd';
        ctx.beginPath();
        ctx.moveTo(183, oy + 85);
        ctx.lineTo(225, oy + 150);
        ctx.lineTo(267, oy + 85);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#0284c7';
        ctx.beginPath();
        ctx.ellipse(225, oy + 85, 42, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.font = 'bold 11.5px Arial, sans-serif';
        ctx.fillStyle = '#2563eb';
        ctx.fillText('R', 262, oy + 16);
        ctx.fillStyle = '#0369a1';
        ctx.fillText('r', 246, oy + 76);
        ctx.fillStyle = '#dc2626';
        ctx.fillText('h', 213, oy + 118);
      } else {
        // Default: box_folding
        // Flat sheet left
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.8;
        ctx.fillRect(25, oy + 24, 154, 106);
        ctx.strokeRect(25, oy + 24, 154, 106);
        const corners = [
          [25, oy + 24],
          [151, oy + 24],
          [25, oy + 102],
          [151, oy + 102],
        ];
        corners.forEach(([cx, cy]) => {
          ctx.fillStyle = '#fee2e2';
          ctx.fillRect(cx, cy, 28, 28);
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 1.3;
          ctx.strokeRect(cx, cy, 28, 28);
        });
        ctx.save();
        ctx.strokeStyle = '#2563eb';
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(53, oy + 52, 98, 50);
        ctx.restore();
        ctx.font = 'bold 11px Arial, sans-serif';
        ctx.fillStyle = '#dc2626';
        ctx.fillText('x', 39, oy + 38);
        ctx.fillText('x', 165, oy + 38);
        ctx.fillStyle = '#0f172a';
        ctx.fillText('Tấm tôn cắt 4 góc', 102, oy + 12);
        ctx.fillText('a', 102, oy + 144);
        ctx.fillText('b', 14, oy + 77);
        // Arrow
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(195, oy + 77);
        ctx.lineTo(240, oy + 77);
        ctx.stroke();
        drawArrowhead(ctx, 195, oy + 77, 240, oy + 77, 7, '#2563eb');
        ctx.fillStyle = '#2563eb';
        ctx.fillText('Gập hộp', 217, oy + 63);
        // 3D open box right
        ctx.fillStyle = '#cbd5e1';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(268, oy + 118);
        ctx.lineTo(364, oy + 118);
        ctx.lineTo(396, oy + 92);
        ctx.lineTo(300, oy + 92);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.fillRect(268, oy + 72, 96, 46);
        ctx.strokeRect(268, oy + 72, 96, 46);
        ctx.beginPath();
        ctx.moveTo(364, oy + 72);
        ctx.lineTo(396, oy + 46);
        ctx.lineTo(396, oy + 92);
        ctx.moveTo(268, oy + 72);
        ctx.lineTo(300, oy + 46);
        ctx.lineTo(396, oy + 46);
        ctx.stroke();
        ctx.fillStyle = '#0f172a';
        ctx.fillText('Hộp không nắp V(x)', 332, oy + 12);
        ctx.fillStyle = '#dc2626';
        ctx.fillText('x', 256, oy + 96);
        ctx.fillStyle = '#1e3a8a';
        ctx.fillText('a - 2x', 316, oy + 135);
      }
    },
    360
  );
}

/**
 * 6. Render Mạch Điện RLC nối tiếp Vật Lý thành ảnh PNG
 */
export function renderPhysicsCircuitPng(data: QuizDiagramData): RenderedDocxPng | null {
  const W = 320;
  const H = 120;
  return renderOnCanvas(
    W,
    H,
    2.5,
    (ctx) => {
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(1, 1, W - 2, H - 2);
      ctx.font = 'bold 11px Arial, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.fillText((data?.title || 'MẠCH ĐIỆN RLC NỐI TIẾP').toUpperCase(), W / 2, 18);

      const y = 68;
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(35, y);
      ctx.lineTo(75, y);
      ctx.stroke();
      // R
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(75, y - 9, 40, 18);
      ctx.strokeRect(75, y - 9, 40, 18);
      ctx.fillStyle = '#4338ca';
      ctx.fillText('R', 95, y + 4);
      // Wire to L
      ctx.beginPath();
      ctx.moveTo(115, y);
      ctx.lineTo(138, y);
      ctx.stroke();
      // L coils
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        ctx.arc(146 + i * 16, y, 8, Math.PI, 0);
      }
      ctx.stroke();
      ctx.fillStyle = '#059669';
      ctx.fillText('L', 162, y - 16);
      // Wire to C
      ctx.beginPath();
      ctx.moveTo(186, y);
      ctx.lineTo(212, y);
      ctx.moveTo(212, y - 13);
      ctx.lineTo(212, y + 13);
      ctx.moveTo(222, y - 13);
      ctx.lineTo(222, y + 13);
      ctx.moveTo(222, y);
      ctx.lineTo(285, y);
      ctx.stroke();
      ctx.fillStyle = '#dc2626';
      ctx.fillText('C', 217, y - 18);
      // Terminals A & B
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(35, y, 3.5, 0, Math.PI * 2);
      ctx.arc(285, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText('A', 35, y + 20);
      ctx.fillText('B', 285, y + 20);
    },
    265
  );
}
