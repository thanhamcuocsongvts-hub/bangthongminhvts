import React from 'react';
import { MathFormulaRenderer } from './MathFormulaRenderer';
import { StandardTextbookGraph } from './StandardTextbookGraph';
import { PracticalMathIllustration, detectPracticalScenario, PracticalScenario } from './PracticalMathIllustration';
import {
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Activity,
  BarChart2,
  Table,
} from 'lucide-react';

export interface QuizDiagramData {
  // Variation table for math (Bảng biến thiên)
  title?: string;
  x?: string[];
  yPrime?: string[]; // +, -, 0, ||
  yArrows?: Array<{
    start: string;
    end: string;
    dir: 'up' | 'down';
    startPos?: 'top' | 'bottom' | 'mid';
    endPos?: 'top' | 'bottom' | 'mid';
    hasAsymptote?: boolean;
  }>;
  yValues?: Array<{
    label: string;
    level: 'top' | 'bottom' | 'mid';
    isAsymptote?: boolean; // vạch đôi ||
  }>;
  // Sign table for math (Bảng xét dấu)
  rows?: Array<{
    label: string; // f(x), f'(x), (x-1)...
    signs: string[]; // +, -, 0, ||
  }>;
  // Function graph (Interactive Desmos & LaTeX)
  latex?: string;
  fn?: string;
  functions?: string[];
  points?: Array<{ x: number; y: number; label?: string }>;
  graphType?: 'cubic' | 'quadratic' | 'rational' | 'biquadratic' | 'rational_21' | 'sine' | 'linear';
  equation?: string;
  extrema?: Array<{ x: number; y: number; label?: string }>;
  asymptotes?: {
    vertical?: number[];
    horizontal?: number[];
    slant?: { a: number; b: number };
  };
  // Spatial Geometry
  shape?: 'pyramid' | 'pyramid_triangular' | 'pyramid_quad' | 'prism' | 'cone' | 'cylinder' | 'cube' | 'cuboid' | 'sphere' | string;
  // Physics Circuit
  circuitType?: 'rlc_series' | 'parallel' | 'pendulum';
  conditions?: string;
  // Data table
  headers?: string[];
  tableRows?: string[][];
  [key: string]: any;
}

interface QuizRichContentRendererProps {
  content: string;
  diagramType?:
    | 'variation_table'
    | 'sign_table'
    | 'function_graph'
    | 'geometry'
    | 'physics_circuit'
    | 'chemistry_diagram'
    | 'data_table'
    | string;
  diagramData?: QuizDiagramData;
  className?: string;
  textClassName?: string;
  isPresentationMode?: boolean;
}

/**
 * Tự động phân tích nội dung câu hỏi để trích xuất bảng biến thiên / bảng xét dấu
 * nếu câu hỏi chứa dạng bảng markdown hoặc text SGK
 */
function parseEmbeddedDiagram(content: string): {
  cleanContent: string;
  detectedType?: 'variation_table' | 'sign_table' | 'function_graph' | 'geometry' | 'data_table' | 'practical_illustration';
  detectedData?: QuizDiagramData;
} {
  if (!content) return { cleanContent: content };

  // 1. Nhận diện Bảng xét dấu dạng markdown hoặc text
  const signTableMatch = content.match(/\|?\s*x\s*\|([^\n]+)\n\s*\|?\s*(?:f'\(x\)|y'|f\(x\)|y)\s*\|([^\n]+)/i);
  if (signTableMatch) {
    const rawX = signTableMatch[1].split('|').map((s) => s.trim()).filter(Boolean);
    const rawSigns = signTableMatch[2].split('|').map((s) => s.trim()).filter(Boolean);

    if (rawX.length > 0 && rawSigns.length > 0) {
      const clean = content.replace(signTableMatch[0], '').trim();
      return {
        cleanContent: clean,
        detectedType: 'sign_table',
        detectedData: {
          title: 'Bảng xét dấu của hàm số',
          x: rawX,
          rows: [
            {
              label: "f'(x)",
              signs: rawSigns,
            },
          ],
        },
      };
    }
  }

  const lower = content.toLowerCase();

  // 2. Nhận diện Hình học không gian chuẩn SGK (Toán 11 & 12)
  if (lower.includes('chóp tam giác') || lower.includes('tứ diện') || lower.includes('s.abc')) {
    return {
      cleanContent: content,
      detectedType: 'geometry',
      detectedData: {
        title: 'Hình chóp tam giác S.ABC',
        shape: 'pyramid_triangular',
      },
    };
  }

  if (lower.includes('chóp tứ giác') || lower.includes('s.abcd')) {
    return {
      cleanContent: content,
      detectedType: 'geometry',
      detectedData: {
        title: 'Hình chóp tứ giác S.ABCD',
        shape: 'pyramid_quad',
      },
    };
  }

  if (lower.includes('lăng trụ') || lower.includes("abc.a'b'c'")) {
    return {
      cleanContent: content,
      detectedType: 'geometry',
      detectedData: {
        title: "Hình lăng trụ tam giác ABC.A'B'C'",
        shape: 'prism',
      },
    };
  }

  if (lower.includes('hình nón') || lower.includes('khối nón')) {
    return {
      cleanContent: content,
      detectedType: 'geometry',
      detectedData: {
        title: 'Hình nón tròn xoay',
        shape: 'cone',
      },
    };
  }

  if (lower.includes('hình trụ') || lower.includes('khối trụ')) {
    return {
      cleanContent: content,
      detectedType: 'geometry',
      detectedData: {
        title: 'Hình trụ tròn xoay',
        shape: 'cylinder',
      },
    };
  }

  if (lower.includes('mặt cầu') || lower.includes('khối cầu') || lower.includes('hình cầu')) {
    return {
      cleanContent: content,
      detectedType: 'geometry',
      detectedData: {
        title: 'Mặt cầu tâm O bán kính R',
        shape: 'sphere',
      },
    };
  }

  if (lower.includes('lập phương') || lower.includes('hộp chữ nhật')) {
    return {
      cleanContent: content,
      detectedType: 'geometry',
      detectedData: {
        title: "Hình hộp chữ nhật / lập phương ABCD.A'B'C'D'",
        shape: 'cuboid',
      },
    };
  }

  // 3. Nhận diện Bảng biến thiên
  if (lower.includes('bảng biến thiên') || lower.includes('bbt')) {
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

  // 4. Nhận diện Bảng xét dấu
  if (lower.includes('bảng xét dấu') || lower.includes('xét dấu của')) {
    return {
      cleanContent: content,
      detectedType: 'sign_table',
      detectedData: {
        title: 'Bảng xét dấu',
        x: ['-\\infty', '-2', '3', '+\\infty'],
        rows: [
          {
            label: "f'(x)",
            signs: ['+', '0', '-', '0', '+'],
          },
        ],
      },
    };
  }

  // 5. Nhận diện Bảng thống kê số liệu
  if (lower.includes('bảng thống kê') || lower.includes('tần số') || lower.includes('tần suất')) {
    return {
      cleanContent: content,
      detectedType: 'data_table',
      detectedData: {
        title: 'Bảng phân bố tần số - tần suất ghép nhóm',
        headers: ['Khoảng giá trị [a; b)', 'Giá trị đại diện', 'Tần số (n_i)', 'Tần suất (%)'],
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

  // 6. Nhận diện Đồ thị hàm số (bảo đảm 100% câu hỏi có đồ thị đều được vẽ)
  const hasGraphKeywords =
    lower.includes('đồ thị') ||
    lower.includes('hình vẽ') ||
    lower.includes('như hình') ||
    lower.includes('hình bên') ||
    lower.includes('đường cong');

  if (hasGraphKeywords) {
    const isRational =
      lower.includes('tiệm cận') ||
      lower.includes('phân thức') ||
      lower.includes('hyperbol') ||
      content.includes('\\frac') ||
      content.includes('/') ||
      /(?:ax\+b|cx\+d)/i.test(content) ||
      /y\s*=\s*\\frac/i.test(content);
    const isBiquad =
      lower.includes('trùng phương') ||
      lower.includes('bậc bốn') ||
      lower.includes('chữ w') ||
      content.includes('x^4') ||
      content.includes('x^{4}');
    const isQuad =
      lower.includes('parabol') ||
      lower.includes('bậc hai') ||
      (!isBiquad && (content.includes('x^2') || content.includes('x^{2}')));

    // Trích xuất công thức LaTeX nếu có trong câu hỏi
    const formulaMatch =
      content.match(/(?:y|f\(x\))\s*=\s*([^$,\n?]+)/i) ||
      content.match(/\$([^$]+=[^$]+)\$/);
    const extractedLatex = formulaMatch ? formulaMatch[0].replace(/\$/g, '').trim() : '';

    return {
      cleanContent: content,
      detectedType: 'function_graph',
      detectedData: {
        title: isRational
          ? 'Đồ thị hàm phân thức y = (ax+b)/(cx+d)'
          : isBiquad
          ? 'Đồ thị hàm số bậc bốn trùng phương'
          : isQuad
          ? 'Đồ thị hàm số bậc hai (Parabol)'
          : 'Đồ thị hàm số bậc ba',
        graphType: isRational ? 'rational' : isBiquad ? 'biquadratic' : isQuad ? 'quadratic' : 'cubic',
        latex: extractedLatex || (isRational ? 'y = \\frac{ax+b}{cx+d}' : isBiquad ? 'y = x^4 - 2x^2 - 1' : isQuad ? 'y = x^2 - 4x + 3' : 'y = x^3 - 3x + 1'),
      },
    };
  }

  // 7. Nhận diện Bài toán thực tế / ứng dụng cần hình minh họa trực quan
  const practicalScenario = detectPracticalScenario(content);
  if (practicalScenario) {
    return {
      cleanContent: content,
      detectedType: 'practical_illustration',
      detectedData: {
        scenario: practicalScenario,
        title: 'Mô hình minh họa bài toán thực tế',
      },
    };
  }

  return { cleanContent: content };
}

export const QuizRichContentRenderer: React.FC<QuizRichContentRendererProps> = ({
  content,
  diagramType: initialType,
  diagramData: initialData,
  className = '',
  textClassName = '',
  isPresentationMode = false,
}) => {
  const parsed = parseEmbeddedDiagram(content);
  const displayContent = initialType ? content : parsed.cleanContent;
  const diagramType = initialType || parsed.detectedType;
  const diagramData = initialData || parsed.detectedData;

  return (
    <div className={`space-y-3.5 ${className}`}>
      {/* Primary Question Text with LaTeX KaTeX */}
      <div className={`leading-relaxed ${textClassName}`}>
        <MathFormulaRenderer content={displayContent} className={textClassName} />
      </div>

      {/* Render diagram theo chuẩn Sách Giáo Khoa Toán Việt Nam */}
      {diagramType && diagramData && (
        <div className="my-3 p-3.5 bg-gradient-to-b from-slate-50 to-slate-100/80 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col items-center justify-center overflow-x-auto select-none">
          {/* ========================================================= */}
          {/* 1. BẢNG BIẾN THIÊN HÀM SỐ CHUẨN SGK TOÁN 12 VIỆT NAM      */}
          {/* ========================================================= */}
          {diagramType === 'variation_table' && (() => {
            const xVals: string[] = diagramData.x || ['-\\infty', '-1', '2', '+\\infty'];
            const n = Math.max(2, xVals.length);
            const padPct = 7;
            const getXPos = (i: number) => padPct + (i * (100 - 2 * padPct)) / (n - 1);

            // Raw or default arrows
            const rawArrows: { start: string; end: string; dir: 'up' | 'down' }[] =
              diagramData.yArrows && diagramData.yArrows.length > 0
                ? diagramData.yArrows
                : [
                    { start: '-\\infty', end: '3', dir: 'up' },
                    { start: '3', end: '-2', dir: 'down' },
                    { start: '-2', end: '+\\infty', dir: 'up' },
                  ];

            // Determine elevations (high = 18%, low = 80%) for each x point
            const pointValues: { val: string; isHigh: boolean; isAsymptote?: boolean }[] = [];
            for (let i = 0; i < n; i++) {
              if (i === 0) {
                const isHigh = rawArrows[0]?.dir === 'down';
                pointValues.push({ val: rawArrows[0]?.start || '-\\infty', isHigh });
              } else {
                const prevArr = rawArrows[i - 1];
                const isHigh = prevArr ? prevArr.dir === 'up' : false;
                pointValues.push({ val: prevArr?.end || (isHigh ? '+\\infty' : '-\\infty'), isHigh });
              }
            }

            // Raw or default yPrime signs and zeros
            const yPrimeList = diagramData.yPrime || ['+', '0', '-', '0', '+'];

            return (
              <div className="w-full max-w-xl bg-white rounded-xl border-2 border-slate-800 shadow-md p-3.5 font-serif text-xs">
                <div className="text-xs font-sans font-extrabold text-slate-800 mb-2.5 text-center flex items-center justify-center gap-1.5 uppercase tracking-wide">
                  <Table className="w-4 h-4 text-indigo-600" />
                  <span>{diagramData.title || 'Bảng biến thiên của hàm số'}</span>
                </div>

                {/* Khung Bảng Chuẩn Mực SGK Việt Nam */}
                <div className="border border-slate-900 rounded overflow-hidden select-none bg-white">
                  {/* HÀNG 1: DÒNG BIẾN SỐ x */}
                  <div className="flex border-b-2 border-slate-900 bg-slate-100">
                    <div className="w-14 shrink-0 flex items-center justify-center font-bold italic text-slate-900 border-r-2 border-slate-900 bg-slate-200/90 py-2 text-sm">
                      x
                    </div>
                    <div className="relative flex-1 h-9 flex items-center">
                      {xVals.map((val, idx) => (
                        <div
                          key={idx}
                          className="absolute -translate-x-1/2 font-semibold text-slate-900 text-xs whitespace-nowrap"
                          style={{ left: `${getXPos(idx)}%` }}
                        >
                          <MathFormulaRenderer content={val.startsWith('$') ? val : `$${val}$`} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* HÀNG 2: DÒNG ĐẠO HÀM y' HOẶC f'(x) */}
                  <div className="flex border-b-2 border-slate-900 bg-white">
                    <div className="w-14 shrink-0 flex items-center justify-center font-bold italic text-slate-900 border-r-2 border-slate-900 bg-slate-100/90 py-2 text-sm">
                      y'
                    </div>
                    <div className="relative flex-1 h-9 flex items-center">
                      {/* Critical roots & asymptotes directly under critical x points */}
                      {xVals.map((_, idx) => {
                        if (idx === 0 || idx === n - 1) return null;
                        // Find sign or 0 at this point
                        const rootSign = yPrimeList[idx * 2] || '0';
                        const isAsymptote = rootSign === '||' || rootSign === '|';
                        return (
                          <div
                            key={`root-${idx}`}
                            className={`absolute -translate-x-1/2 font-bold text-xs ${
                              isAsymptote ? 'text-slate-900 tracking-tighter font-mono' : 'text-slate-900'
                            }`}
                            style={{ left: `${getXPos(idx)}%` }}
                          >
                            {isAsymptote ? '||' : rootSign}
                          </div>
                        );
                      })}

                      {/* Interval Signs centered between critical x points */}
                      {rawArrows.map((_, idx) => {
                        if (idx >= n - 1) return null;
                        const midLeft = (getXPos(idx) + getXPos(idx + 1)) / 2;
                        // Get sign from yPrimeList
                        const sign = yPrimeList[idx * 2 + 1] || (rawArrows[idx]?.dir === 'up' ? '+' : '-');
                        const isPlus = sign.includes('+');
                        const isMinus = sign.includes('-');
                        return (
                          <div
                            key={`sign-${idx}`}
                            className={`absolute -translate-x-1/2 font-bold text-sm ${
                              isPlus ? 'text-rose-600' : isMinus ? 'text-blue-600' : 'text-slate-800'
                            }`}
                            style={{ left: `${midLeft}%` }}
                          >
                            {sign.trim()}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* HÀNG 3: DÒNG HÀM SỐ y VỚI CÁC MỨC CAO/THẤP VÀ MŨI TÊN CHÉO SGK */}
                  <div className="flex bg-white">
                    <div className="w-14 shrink-0 flex items-center justify-center font-bold italic text-slate-900 border-r-2 border-slate-900 bg-slate-100/90 text-sm">
                      y
                    </div>
                    <div className="relative flex-1 h-28 bg-white overflow-hidden">
                      {/* SVG Canvas vẽ các mũi tên chéo biến thiên và vạch tiệm cận đứng kép */}
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <marker
                            id="sgkArrow"
                            viewBox="0 0 10 10"
                            refX="7"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto"
                          >
                            <path d="M 0 1 L 9 5 L 0 9 z" fill="#1e293b" />
                          </marker>
                        </defs>

                        {/* Tiệm cận đứng || kép nếu có */}
                        {xVals.map((_, idx) => {
                          const rootSign = yPrimeList[idx * 2];
                          if (rootSign === '||' || rootSign === '|') {
                            const xP = getXPos(idx);
                            return (
                              <g key={`asymp-${idx}`}>
                                <line x1={xP - 0.4} y1="0" x2={xP - 0.4} y2="100" stroke="#0f172a" strokeWidth="0.8" />
                                <line x1={xP + 0.4} y1="0" x2={xP + 0.4} y2="100" stroke="#0f172a" strokeWidth="0.8" />
                              </g>
                            );
                          }
                          return null;
                        })}

                        {/* Mũi tên chéo biến thiên */}
                        {rawArrows.map((arr, idx) => {
                          if (idx >= n - 1) return null;
                          const x1 = getXPos(idx);
                          const x2 = getXPos(idx + 1);
                          const isUp = arr.dir === 'up';

                          // Tránh đè lên text: start padding & end padding
                          const startX = x1 + 3.5;
                          const endX = x2 - 3.5;
                          const startY = isUp ? 76 : 24;
                          const endY = isUp ? 24 : 76;

                          return (
                            <line
                              key={`arr-${idx}`}
                              x1={startX}
                              y1={startY}
                              x2={endX}
                              y2={endY}
                              stroke="#1e293b"
                              strokeWidth="1.6"
                              markerEnd="url(#sgkArrow)"
                            />
                          );
                        })}
                      </svg>

                      {/* Các giá trị số cực trị / vô cùng tại vị trí Cao (đỉnh) hoặc Thấp (đáy) */}
                      {pointValues.map((pt, idx) => {
                        const xPos = getXPos(idx);
                        return (
                          <div
                            key={`val-${idx}`}
                            className={`absolute -translate-x-1/2 font-semibold text-slate-900 text-xs px-1 bg-white/95 rounded whitespace-nowrap z-10 ${
                              pt.isHigh ? 'top-2' : 'bottom-2'
                            }`}
                            style={{ left: `${xPos}%` }}
                          >
                            <MathFormulaRenderer content={pt.val.startsWith('$') ? pt.val : `$${pt.val}$`} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ========================================================= */}
          {/* 2. BẢNG XÉT DẤU CHUẨN SGK (Toán 10, 11 & 12)               */}
          {/* ========================================================= */}
          {diagramType === 'sign_table' && (
            <div className="w-full max-w-xl bg-white rounded-xl border-2 border-slate-700 shadow-md p-3.5 text-xs">
              <div className="text-xs font-sans font-extrabold text-slate-800 mb-2.5 text-center flex items-center justify-center gap-1.5 uppercase tracking-wide">
                <BarChart2 className="w-4 h-4 text-emerald-600" />
                <span>{diagramData.title || 'Bảng xét dấu'}</span>
              </div>

              <div className="border border-slate-800 rounded overflow-hidden">
                <table className="w-full border-collapse border-slate-800 text-center font-sans">
                  <tbody>
                    {/* Hàng x */}
                    <tr className="border-b-2 border-slate-800 bg-slate-100/90">
                      <td className="w-20 py-2 px-3 font-bold italic text-slate-900 border-r-2 border-slate-800 bg-slate-200/80">
                        x
                      </td>
                      {(diagramData.x || ['-\\infty', '-2', '3', '+\\infty']).map((val, i) => (
                        <td key={i} className="py-2 px-3 font-semibold text-slate-900 border-r border-slate-300 last:border-r-0">
                          <MathFormulaRenderer content={val.startsWith('$') ? val : `$${val}$`} />
                        </td>
                      ))}
                    </tr>

                    {/* Các hàng xét dấu: f'(x), f(x), v.v. */}
                    {(
                      diagramData.rows || [
                        {
                          label: "f'(x)",
                          signs: ['+', '0', '-', '0', '+'],
                        },
                      ]
                    ).map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-slate-300 last:border-b-0 bg-white">
                        <td className="w-20 py-2 px-3 font-bold italic text-slate-900 border-r-2 border-slate-800 bg-slate-100/80">
                          {row.label}
                        </td>
                        {row.signs.map((sign, sIdx) => {
                          const trimmed = sign.trim();
                          const isPlus = trimmed === '+';
                          const isMinus = trimmed === '-';
                          const isZero = trimmed === '0';
                          const isAsymptote = trimmed === '||' || trimmed === '|';

                          return (
                            <td
                              key={sIdx}
                              className={`py-2 px-3 font-bold text-sm border-r border-slate-300 last:border-r-0 ${
                                isPlus
                                  ? 'text-rose-600 bg-rose-50/30'
                                  : isMinus
                                  ? 'text-blue-600 bg-blue-50/30'
                                  : isZero
                                  ? 'text-slate-900'
                                  : isAsymptote
                                  ? 'text-slate-800 font-mono tracking-tighter'
                                  : 'text-slate-700'
                              }`}
                            >
                              {isAsymptote ? '||' : trimmed}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. ĐỒ THỊ HÀM SỐ CHUẨN SÁCH GIÁO KHOA (SVG NATIVE)       */}
          {/* ========================================================= */}
          {diagramType === 'function_graph' && (() => {
            // Trích xuất công thức LaTeX từ diagramData hoặc từ nội dung câu hỏi
            let targetLatex = diagramData.latex || diagramData.equation || diagramData.fn || '';

            if (!targetLatex && content) {
              const formulaMatch =
                content.match(/(?:y|f\(x\)|x\(t\)|x)\s*=\s*([^$,\n?]+)/i) ||
                content.match(/\$([^$]+=[^$]+)\$/);
              if (formulaMatch) {
                targetLatex = formulaMatch[0].replace(/\$/g, '').trim();
              }
            }

            if (!targetLatex) {
              targetLatex =
                diagramData.graphType === 'quadratic'
                  ? 'y = x^2 - 3x'
                  : diagramData.graphType === 'biquadratic'
                  ? 'y = x^4 - 2x^2 - 1'
                  : diagramData.graphType === 'rational'
                  ? 'y = \\frac{ax+b}{cx+d}'
                  : diagramData.graphType === 'sine'
                  ? 'y = 2\\sin(x)'
                  : 'y = x^3 - 3x + 1';
            }

            return (
              <div className="w-full max-w-lg my-2 flex justify-center">
                <StandardTextbookGraph
                  latex={targetLatex}
                  graphType={diagramData.graphType}
                  title={diagramData.title}
                  asymptoteX={diagramData.asymptoteX}
                  asymptoteY={diagramData.asymptoteY}
                  height={isPresentationMode ? 340 : 290}
                  isPresentationMode={isPresentationMode}
                />
              </div>
            );
          })()}

          {/* ========================================================= */}
          {/* 3B. BÀI TOÁN THỰC TẾ & HÌNH VẼ MINH HỌA TRỰC QUAN         */}
          {/* ========================================================= */}
          {(diagramType === 'practical_illustration' || diagramType === 'practical') && (
            <div className="w-full max-w-lg my-2 flex justify-center">
              <PracticalMathIllustration
                scenario={diagramData.scenario || detectPracticalScenario(content) || 'box_folding'}
                title={diagramData.title}
                isPresentationMode={isPresentationMode}
              />
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. HÌNH HỌC KHÔNG GIAN (Toán 11 & 12)                      */}
          {/* ========================================================= */}
          {diagramType === 'geometry' && (
            <div className="flex flex-col items-center">
              <div className="text-xs font-bold text-slate-800 mb-1">
                {diagramData.title || 'Hình học không gian chuẩn SGK'}
              </div>
              <svg width="240" height="195" viewBox="0 0 240 195" className="bg-white rounded-xl border border-slate-300 shadow-xs">
                {/* 1. LĂNG TRỤ TAM GIÁC ABC.A'B'C' */}
                {diagramData.shape === 'prism' && (
                  <>
                    <polygon points="50,150 140,170 185,145" fill="none" stroke="#334155" strokeWidth="1.8" />
                    <polygon points="50,55 140,75 185,50" fill="none" stroke="#334155" strokeWidth="1.8" />
                    <line x1="50" y1="55" x2="50" y2="150" stroke="#334155" strokeWidth="1.8" />
                    <line x1="140" y1="75" x2="140" y2="170" stroke="#334155" strokeWidth="1.8" />
                    <line x1="185" y1="50" x2="185" y2="145" stroke="#334155" strokeWidth="1.8" />
                    <line x1="50" y1="150" x2="185" y2="145" stroke="#94a3b8" strokeWidth="1.6" strokeDasharray="4 3" />
                    <text x="35" y="52" fontSize="11" fontWeight="bold">A'</text>
                    <text x="145" y="75" fontSize="11" fontWeight="bold">B'</text>
                    <text x="190" y="50" fontSize="11" fontWeight="bold">C'</text>
                    <text x="35" y="155" fontSize="11" fontWeight="bold">A</text>
                    <text x="145" y="180" fontSize="11" fontWeight="bold">B</text>
                    <text x="190" y="150" fontSize="11" fontWeight="bold">C</text>
                  </>
                )}

                {/* 2. HÌNH CHÓP TAM GIÁC ĐỀU S.ABC */}
                {diagramData.shape === 'pyramid_triangular' && (
                  <>
                    <line x1="120" y1="20" x2="40" y2="145" stroke="#334155" strokeWidth="1.8" />
                    <line x1="120" y1="20" x2="135" y2="170" stroke="#334155" strokeWidth="1.8" />
                    <line x1="120" y1="20" x2="200" y2="140" stroke="#334155" strokeWidth="1.8" />
                    <line x1="40" y1="145" x2="135" y2="170" stroke="#334155" strokeWidth="1.8" />
                    <line x1="135" y1="170" x2="200" y2="140" stroke="#334155" strokeWidth="1.8" />
                    <line x1="40" y1="145" x2="200" y2="140" stroke="#94a3b8" strokeWidth="1.6" strokeDasharray="4 3" />
                    {/* Trọng tâm H và đường cao SH nét đứt */}
                    <line x1="120" y1="20" x2="120" y2="152" stroke="#ea580c" strokeWidth="1.5" strokeDasharray="3 3" />
                    <circle cx="120" cy="152" r="2.5" fill="#ea580c" />
                    <text x="117" y="15" fontSize="12" fontWeight="bold" fill="#4338ca">S</text>
                    <text x="25" y="150" fontSize="11" fontWeight="bold">A</text>
                    <text x="135" y="185" fontSize="11" fontWeight="bold">B</text>
                    <text x="205" y="145" fontSize="11" fontWeight="bold">C</text>
                    <text x="124" y="156" fontSize="9" fontWeight="bold" fill="#ea580c">H</text>
                  </>
                )}

                {/* 3. HÌNH CHÓP TỨ GIÁC S.ABCD */}
                {(!diagramData.shape || diagramData.shape === 'pyramid_quad') && (
                  <>
                    <line x1="40" y1="140" x2="140" y2="165" stroke="#334155" strokeWidth="1.8" />
                    <line x1="140" y1="165" x2="200" y2="130" stroke="#334155" strokeWidth="1.8" />
                    <line x1="40" y1="140" x2="100" y2="110" stroke="#94a3b8" strokeWidth="1.6" strokeDasharray="4 3" />
                    <line x1="100" y1="110" x2="200" y2="130" stroke="#94a3b8" strokeWidth="1.6" strokeDasharray="4 3" />
                    <line x1="120" y1="20" x2="40" y2="140" stroke="#334155" strokeWidth="1.8" />
                    <line x1="120" y1="20" x2="140" y2="165" stroke="#334155" strokeWidth="1.8" />
                    <line x1="120" y1="20" x2="200" y2="130" stroke="#334155" strokeWidth="1.8" />
                    <line x1="120" y1="20" x2="100" y2="110" stroke="#94a3b8" strokeWidth="1.6" strokeDasharray="4 3" />
                    <text x="118" y="15" fontSize="12" fontWeight="bold" fill="#4338ca">S</text>
                    <text x="25" y="145" fontSize="11" fontWeight="bold">A</text>
                    <text x="140" y="180" fontSize="11" fontWeight="bold">B</text>
                    <text x="205" y="135" fontSize="11" fontWeight="bold">C</text>
                    <text x="90" y="105" fontSize="11" fontWeight="bold">D</text>
                  </>
                )}

                {/* 4. HÌNH NÓN TRÒN XOAY */}
                {diagramData.shape === 'cone' && (
                  <>
                    <line x1="120" y1="20" x2="45" y2="150" stroke="#334155" strokeWidth="1.8" />
                    <line x1="120" y1="20" x2="195" y2="150" stroke="#334155" strokeWidth="1.8" />
                    {/* Nửa trước elip đáy nét liền */}
                    <path d="M 45 150 A 75 22 0 0 0 195 150" fill="none" stroke="#334155" strokeWidth="1.8" />
                    {/* Nửa sau elip đáy nét đứt */}
                    <path d="M 45 150 A 75 22 0 0 1 195 150" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeDasharray="4 3" />
                    {/* Trục SO và bán kính đáy OA */}
                    <line x1="120" y1="20" x2="120" y2="150" stroke="#ea580c" strokeWidth="1.5" strokeDasharray="4 3" />
                    <line x1="120" y1="150" x2="195" y2="150" stroke="#ea580c" strokeWidth="1.5" strokeDasharray="4 3" />
                    <circle cx="120" cy="150" r="2.5" fill="#ea580c" />
                    <text x="117" y="15" fontSize="12" fontWeight="bold" fill="#4338ca">S</text>
                    <text x="117" y="165" fontSize="11" fontWeight="bold" fill="#ea580c">O</text>
                    <text x="30" y="155" fontSize="11" fontWeight="bold">A</text>
                    <text x="200" y="155" fontSize="11" fontWeight="bold">B</text>
                  </>
                )}

                {/* 5. HÌNH TRỤ TRÒN XOAY */}
                {diagramData.shape === 'cylinder' && (
                  <>
                    <ellipse cx="120" cy="50" rx="70" ry="20" fill="none" stroke="#334155" strokeWidth="1.8" />
                    <line x1="50" y1="50" x2="50" y2="150" stroke="#334155" strokeWidth="1.8" />
                    <line x1="190" y1="50" x2="190" y2="150" stroke="#334155" strokeWidth="1.8" />
                    {/* Nửa trước elip đáy dưới nét liền */}
                    <path d="M 50 150 A 70 20 0 0 0 190 150" fill="none" stroke="#334155" strokeWidth="1.8" />
                    {/* Nửa sau elip đáy dưới nét đứt */}
                    <path d="M 50 150 A 70 20 0 0 1 190 150" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeDasharray="4 3" />
                    {/* Trục OO' */}
                    <line x1="120" y1="50" x2="120" y2="150" stroke="#ea580c" strokeWidth="1.5" strokeDasharray="4 3" />
                    <circle cx="120" cy="50" r="2.5" fill="#ea580c" />
                    <circle cx="120" cy="150" r="2.5" fill="#ea580c" />
                    <text x="116" y="42" fontSize="11" fontWeight="bold" fill="#ea580c">O</text>
                    <text x="116" y="165" fontSize="11" fontWeight="bold" fill="#ea580c">O'</text>
                  </>
                )}

                {/* 6. MẶT CẦU (S) */}
                {diagramData.shape === 'sphere' && (
                  <>
                    <circle cx="120" cy="98" r="68" fill="none" stroke="#334155" strokeWidth="1.8" />
                    {/* Đường xích đạo elip: nửa trước liền, nửa sau đứt */}
                    <path d="M 52 98 A 68 22 0 0 0 188 98" fill="none" stroke="#334155" strokeWidth="1.8" />
                    <path d="M 52 98 A 68 22 0 0 1 188 98" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeDasharray="4 3" />
                    {/* Bán kính R */}
                    <line x1="120" y1="98" x2="188" y2="98" stroke="#ea580c" strokeWidth="1.5" strokeDasharray="4 3" />
                    <circle cx="120" cy="98" r="3" fill="#ea580c" />
                    <text x="115" y="90" fontSize="11" fontWeight="bold" fill="#ea580c">O</text>
                    <text x="150" y="92" fontSize="11" fontWeight="bold" fill="#ea580c">R</text>
                  </>
                )}

                {/* 7. HÌNH HỘP CHỮ NHẬT / LẬP PHƯƠNG */}
                {diagramData.shape === 'cuboid' && (
                  <>
                    <polygon points="50,150 140,165 190,140" fill="none" stroke="#334155" strokeWidth="1.8" />
                    <polygon points="50,65 140,80 190,55" fill="none" stroke="#334155" strokeWidth="1.8" />
                    <line x1="50" y1="65" x2="50" y2="150" stroke="#334155" strokeWidth="1.8" />
                    <line x1="140" y1="80" x2="140" y2="165" stroke="#334155" strokeWidth="1.8" />
                    <line x1="190" y1="55" x2="190" y2="140" stroke="#334155" strokeWidth="1.8" />
                    <line x1="100" y1="40" x2="50" y2="65" stroke="#334155" strokeWidth="1.8" />
                    <line x1="100" y1="40" x2="190" y2="55" stroke="#334155" strokeWidth="1.8" />
                    <line x1="100" y1="40" x2="100" y2="125" stroke="#94a3b8" strokeWidth="1.6" strokeDasharray="4 3" />
                    <line x1="50" y1="150" x2="100" y2="125" stroke="#94a3b8" strokeWidth="1.6" strokeDasharray="4 3" />
                    <line x1="190" y1="140" x2="100" y2="125" stroke="#94a3b8" strokeWidth="1.6" strokeDasharray="4 3" />
                    <text x="35" y="65" fontSize="11" fontWeight="bold">A'</text>
                    <text x="145" y="80" fontSize="11" fontWeight="bold">B'</text>
                    <text x="195" y="55" fontSize="11" fontWeight="bold">C'</text>
                    <text x="100" y="35" fontSize="11" fontWeight="bold">D'</text>
                    <text x="35" y="155" fontSize="11" fontWeight="bold">A</text>
                    <text x="145" y="175" fontSize="11" fontWeight="bold">B</text>
                    <text x="195" y="145" fontSize="11" fontWeight="bold">C</text>
                    <text x="100" y="135" fontSize="11" fontWeight="bold">D</text>
                  </>
                )}
              </svg>
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. MẠCH ĐIỆN VẬT LÝ                                        */}
          {/* ========================================================= */}
          {diagramType === 'physics_circuit' && (
            <div className="flex flex-col items-center">
              <div className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>{diagramData.title || 'Mạch điện RLC mắc nối tiếp'}</span>
              </div>
              <svg width="250" height="95" viewBox="0 0 250 95" className="bg-white rounded-xl border border-slate-300 p-2 shadow-xs">
                <line x1="20" y1="45" x2="50" y2="45" stroke="#334155" strokeWidth="2" />
                <rect x="50" y="37" width="35" height="16" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
                <text x="63" y="49" fontSize="10" fontWeight="bold" fill="#4338ca">R</text>
                <line x1="85" y1="45" x2="105" y2="45" stroke="#334155" strokeWidth="2" />
                <path d="M 105 45 C 108 30, 115 30, 118 45 C 121 30, 128 30, 131 45 C 134 30, 141 30, 144 45" fill="none" stroke="#334155" strokeWidth="2" />
                <text x="122" y="27" fontSize="10" fontWeight="bold" fill="#059669">L</text>
                <line x1="144" y1="45" x2="165" y2="45" stroke="#334155" strokeWidth="2" />
                <line x1="165" y1="35" x2="165" y2="55" stroke="#334155" strokeWidth="2" />
                <line x1="173" y1="35" x2="173" y2="55" stroke="#334155" strokeWidth="2" />
                <text x="166" y="27" fontSize="10" fontWeight="bold" fill="#dc2626">C</text>
                <line x1="173" y1="45" x2="225" y2="45" stroke="#334155" strokeWidth="2" />
                <circle cx="20" cy="45" r="3" fill="#334155" />
                <circle cx="225" cy="45" r="3" fill="#334155" />
                <text x="15" y="65" fontSize="10" fontWeight="bold">A</text>
                <text x="220" y="65" fontSize="10" fontWeight="bold">B</text>
              </svg>
            </div>
          )}

          {/* ========================================================= */}
          {/* 6. HÓA HỌC / PHƯƠNG TRÌNH PHẢN ỨNG                       */}
          {/* ========================================================= */}
          {diagramType === 'chemistry_diagram' && diagramData.equation && (
            <div className="w-full max-w-md bg-white rounded-xl border border-amber-300 p-3 shadow-xs text-center">
              <div className="text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-rose-500" />
                <span>Phương trình phản ứng hóa học</span>
              </div>
              <div className="font-mono text-sm py-1.5 px-3 bg-amber-50/60 rounded-lg border border-amber-200 font-semibold text-slate-900">
                <MathFormulaRenderer content={diagramData.equation} isBlock />
              </div>
              {diagramData.conditions && (
                <div className="text-[11px] text-slate-600 mt-1">
                  Điều kiện phản ứng: <span className="font-semibold text-slate-800">{diagramData.conditions}</span>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* 7. BẢNG SỐ LIỆU THỐNG KÊ (Địa lý, Lịch sử, Sinh học)     */}
          {/* ========================================================= */}
          {diagramType === 'data_table' && diagramData.headers && (diagramData.tableRows || diagramData.rows) && (
            <div className="w-full max-w-lg bg-white rounded-xl border border-slate-300 p-2.5 shadow-xs text-xs">
              {diagramData.title && (
                <div className="text-xs font-bold text-slate-800 mb-2 text-center">
                  {diagramData.title}
                </div>
              )}
              <table className="w-full border-collapse border border-slate-300 text-center">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    {diagramData.headers.map((h, i) => (
                      <th key={i} className="p-2 border-r border-slate-300 font-bold text-slate-700">
                        <MathFormulaRenderer content={h} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(diagramData.tableRows || []).map((row: string[], rIdx: number) => (
                    <tr key={rIdx} className="border-b border-slate-200 hover:bg-slate-50">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="p-1.5 border-r border-slate-200 text-slate-800">
                          <MathFormulaRenderer content={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
