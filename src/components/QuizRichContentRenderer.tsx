import React from 'react';
import { MathFormulaRenderer } from './MathFormulaRenderer';
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
  // Function graph
  graphType?: 'cubic' | 'quadratic' | 'rational' | 'biquadratic' | 'rational_21' | 'sine' | 'linear';
  equation?: string;
  extrema?: Array<{ x: number; y: number; label?: string }>;
  asymptotes?: {
    vertical?: number[];
    horizontal?: number[];
    slant?: { a: number; b: number };
  };
  // Spatial Geometry
  shape?: 'pyramid' | 'prism' | 'cone' | 'cylinder' | 'cube';
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
}

/**
 * Tự động phân tích nội dung câu hỏi để trích xuất bảng biến thiên / bảng xét dấu
 * nếu câu hỏi chứa dạng bảng markdown hoặc text SGK
 */
function parseEmbeddedDiagram(content: string): {
  cleanContent: string;
  detectedType?: 'variation_table' | 'sign_table' | 'function_graph';
  detectedData?: QuizDiagramData;
} {
  if (!content) return { cleanContent: content };

  // 1. Nhận diện Bảng xét dấu dạng markdown hoặc text
  // Ví dụ: | x | -∞ | 1 | 3 | +∞ |
  //        | f'(x) | + | 0 | - | 0 | + |
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
          title: 'Bảng xét dấu',
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

  // 2. Nhận diện Bảng biến thiên có mũi tên hoặc chiều biến thiên
  if (
    content.includes('Bảng biến thiên') ||
    content.includes('bảng biến thiên') ||
    content.includes('BBT')
  ) {
    // Nếu trong câu hỏi có đề cập bảng biến thiên hàm bậc 3 hoặc phân thức
    if (content.includes('cực đại') || content.includes('đồng biến') || content.includes('nghịch biến')) {
      // Giữ nguyên content, tạo mẫu đồ họa BBT chuẩn nếu chưa có
    }
  }

  return { cleanContent: content };
}

export const QuizRichContentRenderer: React.FC<QuizRichContentRendererProps> = ({
  content,
  diagramType: initialType,
  diagramData: initialData,
  className = '',
  textClassName = '',
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
          {diagramType === 'variation_table' && (
            <div className="w-full max-w-xl bg-white rounded-xl border-2 border-slate-700 shadow-md p-3.5 font-serif text-xs">
              <div className="text-xs font-sans font-extrabold text-slate-800 mb-2.5 text-center flex items-center justify-center gap-1.5 uppercase tracking-wide">
                <Table className="w-4 h-4 text-indigo-600" />
                <span>{diagramData.title || 'Bảng biến thiên của hàm số'}</span>
              </div>

              {/* Bảng viền kép chuẩn mực SGK Toán KNTT & Cánh Diều */}
              <div className="border border-slate-800 rounded overflow-hidden">
                <table className="w-full border-collapse border-slate-800 text-center font-sans">
                  <tbody>
                    {/* HÀNG 1: DÒNG BIẾN SỐ x */}
                    <tr className="border-b-2 border-slate-800 bg-slate-100/90">
                      <td className="w-16 py-2 px-3 font-bold italic text-slate-900 border-r-2 border-slate-800 bg-slate-200/80">
                        x
                      </td>
                      {(diagramData.x || ['-\\infty', '-1', '1', '+\\infty']).map((val, i) => (
                        <td key={i} className="py-2 px-3 font-semibold text-slate-900 border-r border-slate-300 last:border-r-0">
                          <MathFormulaRenderer content={val.startsWith('$') ? val : `$${val}$`} />
                        </td>
                      ))}
                    </tr>

                    {/* HÀNG 2: DÒNG ĐẠO HÀM y' HOẶC f'(x) */}
                    <tr className="border-b-2 border-slate-800 bg-white">
                      <td className="w-16 py-2 px-3 font-bold italic text-slate-900 border-r-2 border-slate-800 bg-slate-100/80">
                        y'
                      </td>
                      {(diagramData.yPrime || ['+', '0', '-', '0', '+']).map((sign, i) => {
                        const trimmed = sign.trim();
                        const isPlus = trimmed === '+';
                        const isMinus = trimmed === '-';
                        const isZero = trimmed === '0';
                        const isAsymptote = trimmed === '||' || trimmed === '|';

                        return (
                          <td
                            key={i}
                            className={`py-2 px-3 font-bold text-sm border-r border-slate-300 last:border-r-0 ${
                              isPlus
                                ? 'text-rose-600'
                                : isMinus
                                ? 'text-blue-600'
                                : isZero
                                ? 'text-slate-900'
                                : isAsymptote
                                ? 'text-slate-800 font-black font-mono tracking-tighter'
                                : 'text-slate-700'
                            }`}
                          >
                            {isAsymptote ? '||' : trimmed}
                          </td>
                        );
                      })}
                    </tr>

                    {/* HÀNG 3: DÒNG HÀM SỐ y VỚI MŨI TÊN BIẾN THIÊN CHUẨN */}
                    <tr className="bg-white">
                      <td className="w-16 py-4 px-3 font-bold italic text-slate-900 border-r-2 border-slate-800 bg-slate-100/80 align-middle">
                        y
                      </td>
                      <td colSpan={(diagramData.x || ['-\\infty', '-1', '1', '+\\infty']).length} className="p-3">
                        <div className="flex items-center justify-around gap-1.5 px-2 py-1 min-h-[56px]">
                          {(
                            diagramData.yArrows || [
                              { start: '-\\infty', end: '4', dir: 'up' },
                              { start: '4', end: '-2', dir: 'down' },
                              { start: '-2', end: '+\\infty', dir: 'up' },
                            ]
                          ).map((arr, i) => {
                            const isUp = arr.dir === 'up';

                            return (
                              <div
                                key={i}
                                className="flex items-center gap-1.5 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200/90 shadow-2xs"
                              >
                                <span className="text-[11px] font-semibold text-slate-700">
                                  <MathFormulaRenderer
                                    content={arr.start.startsWith('$') ? arr.start : `$${arr.start}$`}
                                  />
                                </span>

                                {isUp ? (
                                  <div className="flex items-center text-rose-600">
                                    <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                                  </div>
                                ) : (
                                  <div className="flex items-center text-blue-600">
                                    <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
                                  </div>
                                )}

                                <span className="text-[11px] font-bold text-slate-900">
                                  <MathFormulaRenderer
                                    content={arr.end.startsWith('$') ? arr.end : `$${arr.end}$`}
                                  />
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
          {/* 3. ĐỒ THỊ HÀM SỐ OXY CHUẨN SÁCH GIÁO KHOA TOÁN VIỆT NAM   */}
          {/* ========================================================= */}
          {diagramType === 'function_graph' && (
            <div className="flex flex-col items-center">
              <div className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                <span>{diagramData.title || 'Đồ thị hàm số trên mặt phẳng tọa độ Oxy'}</span>
              </div>

              <div className="relative bg-white rounded-2xl border-2 border-slate-300 shadow-md p-2 overflow-hidden">
                <svg
                  width="300"
                  height="220"
                  viewBox="0 0 300 220"
                  className="rounded-xl"
                >
                  <defs>
                    <marker
                      id="arrow-axis"
                      viewBox="0 0 10 10"
                      refX="6"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#334155" />
                    </marker>

                    {/* Subtle Grid Pattern (Ô ly chuẩn vở học sinh) */}
                    <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="0" x2="20" y2="0" stroke="#f1f5f9" strokeWidth="1" />
                      <line x1="0" y1="0" x2="0" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                    </pattern>
                  </defs>

                  {/* Lưới ô vuông mờ */}
                  <rect width="300" height="220" fill="url(#grid-pattern)" />

                  {/* Trục hoành Ox */}
                  <line
                    x1="20"
                    y1="110"
                    x2="285"
                    y2="110"
                    stroke="#334155"
                    strokeWidth="1.8"
                    markerEnd="url(#arrow-axis)"
                  />
                  {/* Trục tung Oy */}
                  <line
                    x1="150"
                    y1="205"
                    x2="150"
                    y2="15"
                    stroke="#334155"
                    strokeWidth="1.8"
                    markerEnd="url(#arrow-axis)"
                  />

                  {/* Nhãn trục x, y, gốc O */}
                  <text x="288" y="114" fontSize="12" fontWeight="bold" fontStyle="italic" fill="#0f172a">
                    x
                  </text>
                  <text x="156" y="16" fontSize="12" fontWeight="bold" fontStyle="italic" fill="#0f172a">
                    y
                  </text>
                  <text x="138" y="125" fontSize="11" fontWeight="bold" fill="#475569">
                    O
                  </text>

                  {/* Vạch chia đơn vị (ticks) trên trục Ox */}
                  {[-2, -1, 1, 2].map((val) => {
                    const posX = 150 + val * 45;
                    return (
                      <g key={`tick-x-${val}`}>
                        <line x1={posX} y1="107" x2={posX} y2="113" stroke="#475569" strokeWidth="1.2" />
                        <text x={posX - 4} y="125" fontSize="9" fontWeight="bold" fill="#64748b">
                          {val}
                        </text>
                      </g>
                    );
                  })}

                  {/* Vạch chia đơn vị (ticks) trên trục Oy */}
                  {[-1, 1, 2].map((val) => {
                    const posY = 110 - val * 40;
                    return (
                      <g key={`tick-y-${val}`}>
                        <line x1="147" y1={posY} x2="153" y2={posY} stroke="#475569" strokeWidth="1.2" />
                        <text x="133" y={posY + 3} fontSize="9" fontWeight="bold" fill="#64748b">
                          {val}
                        </text>
                      </g>
                    );
                  })}

                  {/* 1. Hàm số bậc 3: y = ax^3 + bx^2 + cx + d */}
                  {(!diagramData.graphType || diagramData.graphType === 'cubic') && (
                    <>
                      {/* Đường dóng nét đứt tọa độ cực đại & cực tiểu */}
                      <line x1="105" y1="110" x2="105" y2="40" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1="105" y1="40" x2="150" y2="40" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1="195" y1="110" x2="195" y2="160" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1="150" y1="160" x2="195" y2="160" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />

                      {/* Đường cong hàm bậc 3 mượt mà */}
                      <path
                        d="M 50 195 C 90 30, 110 35, 150 100 C 185 165, 210 170, 250 25"
                        fill="none"
                        stroke="#4f46e5"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                      />

                      {/* Điểm cực đại & cực tiểu */}
                      <circle cx="105" cy="40" r="3.5" fill="#e11d48" />
                      <circle cx="195" cy="160" r="3.5" fill="#2563eb" />
                    </>
                  )}

                  {/* 2. Hàm phân thức hữu tỉ bậc nhất / bậc nhất y = (ax+b)/(cx+d) */}
                  {diagramData.graphType === 'rational' && (
                    <>
                      {/* Tiệm cận đứng x = 1 (nét đứt màu cam) */}
                      <line x1="195" y1="10" x2="195" y2="210" stroke="#ea580c" strokeWidth="1.4" strokeDasharray="4 3" />
                      {/* Tiệm cận ngang y = 1 (nét đứt màu cam) */}
                      <line x1="15" y1="70" x2="285" y2="70" stroke="#ea580c" strokeWidth="1.4" strokeDasharray="4 3" />

                      {/* Nhánh 1 (bên trái tiệm cận đứng) */}
                      <path
                        d="M 25 60 Q 180 50 185 15"
                        fill="none"
                        stroke="#dc2626"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                      />
                      {/* Nhánh 2 (bên phải tiệm cận đứng) */}
                      <path
                        d="M 205 205 Q 210 80 275 75"
                        fill="none"
                        stroke="#dc2626"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                      />
                    </>
                  )}

                  {/* 3. Hàm bậc 4 trùng phương: y = ax^4 + bx^2 + c (chữ W) */}
                  {diagramData.graphType === 'biquadratic' && (
                    <>
                      {/* Đường cong hình chữ W với 3 cực trị */}
                      <path
                        d="M 55 25 C 75 160, 95 160, 110 160 C 130 160, 140 70, 150 70 C 160 70, 170 160, 190 160 C 205 160, 225 160, 245 25"
                        fill="none"
                        stroke="#7c3aed"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                      />
                      <circle cx="110" cy="160" r="3" fill="#2563eb" />
                      <circle cx="150" cy="70" r="3" fill="#e11d48" />
                      <circle cx="190" cy="160" r="3" fill="#2563eb" />
                    </>
                  )}

                  {/* 4. Hàm parabol bậc 2: y = ax^2 + bx + c */}
                  {diagramData.graphType === 'quadratic' && (
                    <>
                      <line x1="150" y1="10" x2="150" y2="200" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
                      <path
                        d="M 70 30 Q 150 190 230 30"
                        fill="none"
                        stroke="#0284c7"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                      />
                      <circle cx="150" cy="190" r="3.5" fill="#e11d48" />
                    </>
                  )}

                  {/* 5. Hàm lượng giác hình sin: y = sin(x) */}
                  {diagramData.graphType === 'sine' && (
                    <path
                      d="M 30 110 Q 75 40 120 110 T 210 110 T 280 110"
                      fill="none"
                      stroke="#059669"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                    />
                  )}
                </svg>
              </div>
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
              <svg width="230" height="185" viewBox="0 0 230 185" className="bg-white rounded-xl border border-slate-300 shadow-xs">
                {diagramData.shape === 'prism' ? (
                  // Lăng trụ tam giác ABC.A'B'C'
                  <>
                    <polygon points="50,140 140,160 180,135" fill="none" stroke="#334155" strokeWidth="1.6" />
                    <polygon points="50,50 140,70 180,45" fill="none" stroke="#334155" strokeWidth="1.6" />
                    <line x1="50" y1="50" x2="50" y2="140" stroke="#334155" strokeWidth="1.6" />
                    <line x1="140" y1="70" x2="140" y2="160" stroke="#334155" strokeWidth="1.6" />
                    <line x1="180" y1="45" x2="180" y2="135" stroke="#334155" strokeWidth="1.6" />
                    <text x="35" y="45" fontSize="10" fontWeight="bold">A'</text>
                    <text x="145" y="70" fontSize="10" fontWeight="bold">B'</text>
                    <text x="185" y="45" fontSize="10" fontWeight="bold">C'</text>
                    <text x="35" y="145" fontSize="10" fontWeight="bold">A</text>
                    <text x="145" y="170" fontSize="10" fontWeight="bold">B</text>
                    <text x="185" y="140" fontSize="10" fontWeight="bold">C</text>
                  </>
                ) : (
                  // Hình chóp S.ABCD
                  <>
                    <line x1="40" y1="130" x2="140" y2="155" stroke="#334155" strokeWidth="1.6" />
                    <line x1="140" y1="155" x2="190" y2="120" stroke="#334155" strokeWidth="1.6" />
                    <line x1="40" y1="130" x2="90" y2="105" stroke="#94a3b8" strokeWidth="1.6" strokeDasharray="4 3" />
                    <line x1="90" y1="105" x2="190" y2="120" stroke="#94a3b8" strokeWidth="1.6" strokeDasharray="4 3" />
                    <line x1="110" y1="20" x2="40" y2="130" stroke="#334155" strokeWidth="1.6" />
                    <line x1="110" y1="20" x2="140" y2="155" stroke="#334155" strokeWidth="1.6" />
                    <line x1="110" y1="20" x2="190" y2="120" stroke="#334155" strokeWidth="1.6" />
                    <line x1="110" y1="20" x2="90" y2="105" stroke="#94a3b8" strokeWidth="1.6" strokeDasharray="4 3" />
                    <text x="108" y="15" fontSize="11" fontWeight="bold" fill="#4338ca">S</text>
                    <text x="25" y="135" fontSize="10" fontWeight="bold">A</text>
                    <text x="140" y="170" fontSize="10" fontWeight="bold">B</text>
                    <text x="195" y="125" fontSize="10" fontWeight="bold">C</text>
                    <text x="80" y="100" fontSize="10" fontWeight="bold">D</text>
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
                  {(diagramData.tableRows || diagramData.rows || []).map((row: string[], rIdx: number) => (
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
