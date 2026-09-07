import React from 'react';
import { MathFormulaRenderer } from './MathFormulaRenderer';
import { ArrowUpRight, ArrowDownRight, ArrowRight, Zap, Activity } from 'lucide-react';

export interface QuizDiagramData {
  // Variation table for math (Bảng biến thiên)
  x?: string[];
  yPrime?: string[];
  yArrows?: Array<{ start: string; end: string; dir: 'up' | 'down' }>;
  // Function graph
  graphType?: 'cubic' | 'quadratic' | 'rational' | 'sine' | 'linear';
  title?: string;
  // Spatial Geometry
  shape?: 'pyramid' | 'prism' | 'cone' | 'cylinder' | 'cube';
  // Physics Circuit
  circuitType?: 'rlc_series' | 'parallel' | 'pendulum';
  // Chemistry
  equation?: string;
  conditions?: string;
  // Data table
  headers?: string[];
  rows?: string[][];
  [key: string]: any;
}

interface QuizRichContentRendererProps {
  content: string;
  diagramType?: 'variation_table' | 'function_graph' | 'geometry' | 'physics_circuit' | 'chemistry_diagram' | 'data_table' | string;
  diagramData?: QuizDiagramData;
  className?: string;
  textClassName?: string;
}

export const QuizRichContentRenderer: React.FC<QuizRichContentRendererProps> = ({
  content,
  diagramType,
  diagramData,
  className = '',
  textClassName = '',
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Primary Question Text with full LaTeX rendering */}
      <div className={`leading-relaxed ${textClassName}`}>
        <MathFormulaRenderer content={content} className={textClassName} />
      </div>

      {/* Render diagram according to Vietnamese standard SGK (Kết nối tri thức, v.v.) */}
      {diagramType && diagramData && (
        <div className="my-3 p-3 bg-slate-50/90 rounded-xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center overflow-x-auto">
          {/* BẢNG BIẾN THIÊN HÀM SỐ (Toán học) */}
          {diagramType === 'variation_table' && diagramData.x && (
            <div className="w-full max-w-lg bg-white rounded-lg border border-slate-300 p-2 shadow-xs text-xs font-mono">
              <div className="text-[11px] font-sans font-bold text-slate-600 mb-1 text-center">
                {diagramData.title || 'Bảng biến thiên của hàm số'}
              </div>
              <table className="w-full border-collapse border border-slate-300 text-center">
                <tbody>
                  {/* Row x */}
                  <tr className="border-b border-slate-300">
                    <td className="w-16 p-1.5 font-bold bg-slate-100 border-r border-slate-300">x</td>
                    {diagramData.x.map((val, i) => (
                      <td key={i} className="p-1.5 font-semibold">
                        <MathFormulaRenderer content={val.startsWith('$') ? val : `$${val}$`} />
                      </td>
                    ))}
                  </tr>
                  {/* Row y' (Đạo hàm) */}
                  {diagramData.yPrime && (
                    <tr className="border-b border-slate-300">
                      <td className="w-16 p-1.5 font-bold bg-slate-100 border-r border-slate-300">y'</td>
                      {diagramData.yPrime.map((sign, i) => (
                        <td
                          key={i}
                          className={`p-1.5 font-bold text-sm ${
                            sign.trim() === '+'
                              ? 'text-rose-600'
                              : sign.trim() === '-'
                              ? 'text-blue-600'
                              : 'text-slate-700'
                          }`}
                        >
                          {sign}
                        </td>
                      ))}
                    </tr>
                  )}
                  {/* Row y (Chiều biến thiên) */}
                  <tr>
                    <td className="w-16 p-3 font-bold bg-slate-100 border-r border-slate-300 align-middle">y</td>
                    <td colSpan={diagramData.x.length} className="p-2">
                      <div className="flex items-center justify-around gap-2 px-3 py-1">
                        {(diagramData.yArrows || [
                          { start: '-\\infty', end: '4', dir: 'up' },
                          { start: '4', end: '-3', dir: 'down' },
                          { start: '-3', end: '+\\infty', dir: 'up' },
                        ]).map((arr, i) => (
                          <div key={i} className="flex items-center gap-1 text-slate-700">
                            <span className="text-[11px] text-slate-500">
                              <MathFormulaRenderer content={arr.start.startsWith('$') ? arr.start : `$${arr.start}$`} />
                            </span>
                            {arr.dir === 'up' ? (
                              <ArrowUpRight className="w-4 h-4 text-rose-500 stroke-[2.5]" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4 text-blue-500 stroke-[2.5]" />
                            )}
                            <span className="text-[11px] font-bold text-slate-800">
                              <MathFormulaRenderer content={arr.end.startsWith('$') ? arr.end : `$${arr.end}$`} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ĐỒ THỊ HÀM SỐ (SVG Cartesian Coordinate Grid) */}
          {diagramType === 'function_graph' && (
            <div className="flex flex-col items-center">
              <div className="text-xs font-bold text-slate-700 mb-1">
                {diagramData.title || 'Đồ thị tọa độ Oxy'}
              </div>
              <svg width="260" height="180" viewBox="0 0 260 180" className="bg-white rounded-lg border border-slate-300 shadow-xs">
                {/* Grid lines */}
                <line x1="20" y1="90" x2="240" y2="90" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />
                <line x1="130" y1="165" x2="130" y2="15" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />
                <text x="245" y="94" fontSize="11" fontWeight="bold" fill="#475569">x</text>
                <text x="135" y="15" fontSize="11" fontWeight="bold" fill="#475569">y</text>
                <text x="122" y="102" fontSize="10" fill="#64748b">O</text>

                {/* Graph Curves */}
                {diagramData.graphType === 'cubic' ? (
                  // Bậc 3: uốn lượn 2 cực trị
                  <path d="M 40 160 C 90 20, 110 30, 130 90 C 150 150, 170 160, 220 20" fill="none" stroke="#4f46e5" strokeWidth="2.5" />
                ) : diagramData.graphType === 'rational' ? (
                  // Nhất biến y = (ax+b)/(cx+d)
                  <>
                    <line x1="100" y1="10" x2="100" y2="170" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 3" />
                    <line x1="20" y1="60" x2="240" y2="60" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 3" />
                    <path d="M 30 50 Q 85 45 90 15" fill="none" stroke="#e11d48" strokeWidth="2.5" />
                    <path d="M 110 165 Q 115 75 230 70" fill="none" stroke="#e11d48" strokeWidth="2.5" />
                  </>
                ) : diagramData.graphType === 'sine' ? (
                  // Hình sin dao động điều hòa (Lý/Toán)
                  <path d="M 30 90 Q 65 30 100 90 T 170 90 T 240 90" fill="none" stroke="#059669" strokeWidth="2.5" />
                ) : (
                  // Parabol bậc 2
                  <path d="M 50 25 Q 130 160 210 25" fill="none" stroke="#2563eb" strokeWidth="2.5" />
                )}
              </svg>
            </div>
          )}

          {/* HÌNH HỌC KHÔNG GIAN (Toán 11 & 12) */}
          {diagramType === 'geometry' && (
            <div className="flex flex-col items-center">
              <div className="text-xs font-bold text-slate-700 mb-1">
                {diagramData.title || 'Hình học không gian chuẩn SGK'}
              </div>
              <svg width="220" height="180" viewBox="0 0 220 180" className="bg-white rounded-lg border border-slate-300 shadow-xs">
                {/* Pyramid S.ABCD */}
                {diagramData.shape === 'prism' ? (
                  // Lăng trụ tam giác ABC.A'B'C'
                  <>
                    <polygon points="50,140 140,160 180,135" fill="none" stroke="#334155" strokeWidth="1.5" />
                    <polygon points="50,50 140,70 180,45" fill="none" stroke="#334155" strokeWidth="1.5" />
                    <line x1="50" y1="50" x2="50" y2="140" stroke="#334155" strokeWidth="1.5" />
                    <line x1="140" y1="70" x2="140" y2="160" stroke="#334155" strokeWidth="1.5" />
                    <line x1="180" y1="45" x2="180" y2="135" stroke="#334155" strokeWidth="1.5" />
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
                    {/* Base ABCD with AC dashed */}
                    <line x1="40" y1="130" x2="140" y2="155" stroke="#334155" strokeWidth="1.5" />
                    <line x1="140" y1="155" x2="190" y2="120" stroke="#334155" strokeWidth="1.5" />
                    <line x1="40" y1="130" x2="90" y2="105" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />
                    <line x1="90" y1="105" x2="190" y2="120" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />
                    {/* Apex S */}
                    <line x1="110" y1="20" x2="40" y2="130" stroke="#334155" strokeWidth="1.5" />
                    <line x1="110" y1="20" x2="140" y2="155" stroke="#334155" strokeWidth="1.5" />
                    <line x1="110" y1="20" x2="190" y2="120" stroke="#334155" strokeWidth="1.5" />
                    <line x1="110" y1="20" x2="90" y2="105" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />
                    {/* Labels */}
                    <text x="108" y="15" fontSize="10" fontWeight="bold" fill="#4338ca">S</text>
                    <text x="25" y="135" fontSize="10" fontWeight="bold">A</text>
                    <text x="140" y="170" fontSize="10" fontWeight="bold">B</text>
                    <text x="195" y="125" fontSize="10" fontWeight="bold">C</text>
                    <text x="80" y="100" fontSize="10" fontWeight="bold">D</text>
                  </>
                )}
              </svg>
            </div>
          )}

          {/* SƠ ĐỒ MẠCH ĐIỆN VẬT LÝ (Physics R-L-C) */}
          {diagramType === 'physics_circuit' && (
            <div className="flex flex-col items-center">
              <div className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>{diagramData.title || 'Mạch điện RLC mắc nối tiếp'}</span>
              </div>
              <svg width="240" height="90" viewBox="0 0 240 90" className="bg-white rounded-lg border border-slate-300 p-2 shadow-xs">
                {/* Main wire */}
                <line x1="20" y1="45" x2="50" y2="45" stroke="#334155" strokeWidth="2" />
                {/* Resistor R */}
                <rect x="50" y="37" width="35" height="16" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
                <text x="63" y="49" fontSize="10" fontWeight="bold" fill="#4338ca">R</text>
                <line x1="85" y1="45" x2="105" y2="45" stroke="#334155" strokeWidth="2" />
                {/* Inductor L (Cuộn cảm) */}
                <path d="M 105 45 C 108 30, 115 30, 118 45 C 121 30, 128 30, 131 45 C 134 30, 141 30, 144 45" fill="none" stroke="#334155" strokeWidth="2" />
                <text x="122" y="27" fontSize="10" fontWeight="bold" fill="#059669">L</text>
                <line x1="144" y1="45" x2="165" y2="45" stroke="#334155" strokeWidth="2" />
                {/* Capacitor C (Tụ điện) */}
                <line x1="165" y1="35" x2="165" y2="55" stroke="#334155" strokeWidth="2" />
                <line x1="173" y1="35" x2="173" y2="55" stroke="#334155" strokeWidth="2" />
                <text x="166" y="27" fontSize="10" fontWeight="bold" fill="#dc2626">C</text>
                <line x1="173" y1="45" x2="220" y2="45" stroke="#334155" strokeWidth="2" />
                {/* Terminal dots */}
                <circle cx="20" cy="45" r="3" fill="#334155" />
                <circle cx="220" cy="45" r="3" fill="#334155" />
                <text x="15" y="65" fontSize="10" fontWeight="bold">A</text>
                <text x="215" y="65" fontSize="10" fontWeight="bold">B</text>
              </svg>
            </div>
          )}

          {/* PHẢN ỨNG HÓA HỌC / CÔNG THỨC HÓA HỌC */}
          {diagramType === 'chemistry_diagram' && diagramData.equation && (
            <div className="w-full max-w-md bg-white rounded-lg border border-amber-200 p-3 shadow-xs text-center">
              <div className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-rose-500" />
                <span>Phương trình hóa học</span>
              </div>
              <div className="font-mono text-sm py-1 bg-amber-50/50 rounded border border-amber-200/60 font-semibold text-slate-900">
                <MathFormulaRenderer content={diagramData.equation} isBlock />
              </div>
              {diagramData.conditions && (
                <div className="text-[11px] text-slate-500 mt-1">
                  Điều kiện: <span className="font-semibold">{diagramData.conditions}</span>
                </div>
              )}
            </div>
          )}

          {/* BẢNG SỐ LIỆU THỐNG KÊ (Địa lý, Lịch sử, Sinh học, Kinh tế - Pháp luật) */}
          {diagramType === 'data_table' && diagramData.headers && diagramData.rows && (
            <div className="w-full max-w-lg bg-white rounded-lg border border-slate-300 p-2 shadow-xs text-xs">
              {diagramData.title && (
                <div className="text-[11px] font-bold text-slate-700 mb-1.5 text-center">
                  {diagramData.title}
                </div>
              )}
              <table className="w-full border-collapse border border-slate-300 text-center">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    {diagramData.headers.map((h, i) => (
                      <th key={i} className="p-1.5 border-r border-slate-300 font-bold text-slate-700">
                        <MathFormulaRenderer content={h} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {diagramData.rows.map((row, rIdx) => (
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
