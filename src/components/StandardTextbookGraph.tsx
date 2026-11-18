import React, { useId } from 'react';
import { analyzeAndSampleSgkGraph } from '../utils/sgkGraphMath';

export interface StandardTextbookGraphProps {
  latex?: string;
  graphType?: 'rational' | 'cubic' | 'biquadratic' | 'quadratic' | 'rational_21' | 'sine' | 'linear' | 'exp' | 'log' | string;
  title?: string;
  width?: number | string;
  height?: number;
  className?: string;
  questionText?: string;
  coefficients?: {
    a?: number;
    b?: number;
    c?: number;
    d?: number;
    e?: number;
  };
  asymptoteX?: number;
  asymptoteY?: number;
  isPresentationMode?: boolean;
}

/**
 * StandardTextbookGraph: Đồ thị hàm số chuẩn mực Sách Giáo Khoa Toán học Việt Nam (GDPT 2018).
 * - Nền trắng tinh khiết chuẩn giấy in SGK (không lưới tọa độ rườm rà).
 * - Phân tích và vẽ CHÍNH XÁC biểu thức hàm số (tiệm cận, cực trị, giao điểm trục).
 * - Chỉ ghi các giá trị tọa độ quan trọng & đặt nhãn tự động né đường gióng (như SGK Kết nối tri thức / Cánh diều).
 */
export const StandardTextbookGraph: React.FC<StandardTextbookGraphProps> = ({
  latex = '',
  graphType,
  title,
  height = 290,
  className = '',
  questionText = '',
  coefficients,
  asymptoteX,
  asymptoteY,
  isPresentationMode = false,
}) => {
  const clipUid = useId().replace(/:/g, '_');
  const analysis = analyzeAndSampleSgkGraph({
    latex,
    questionText,
    graphType,
    title,
    coefficients,
    asymptoteX,
    asymptoteY,
  });

  const svgW = isPresentationMode ? 480 : 410;
  const svgH = isPresentationMode ? 330 : height;

  const padLeft = 26;
  const padRight = 26;
  const padTop = 24;
  const padBot = 24;
  const plotW = svgW - padLeft - padRight;
  const plotH = svgH - padTop - padBot;

  const spanX = Math.max(1e-4, analysis.maxX - analysis.minX);
  const spanY = Math.max(1e-4, analysis.maxY - analysis.minY);

  const toSvgX = (x: number) => padLeft + ((x - analysis.minX) / spanX) * plotW;
  const toSvgY = (y: number) => padTop + ((analysis.maxY - y) / spanY) * plotH;

  const originX = toSvgX(0);
  const originY = toSvgY(0);

  const pointsToSmoothPath = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length === 0) return '';
    return pts.reduce((acc, p, idx) => {
      const sx = toSvgX(p.x).toFixed(1);
      const sy = toSvgY(p.y).toFixed(1);
      return idx === 0 ? `M ${sx} ${sy}` : `${acc} L ${sx} ${sy}`;
    }, '');
  };

  // Helper: xác định phía tránh đường gióng cho nhãn trên trục Ox
  const isProjectionBelowOx = (xVal: number): boolean => {
    return analysis.keyPoints.some(
      (pt) => pt.showProjections && Math.abs(pt.x - xVal) < 0.15 && pt.y < -0.1
    );
  };

  // Helper: xác định phía tránh đường gióng cho nhãn trên trục Oy
  const isProjectionLeftOfOy = (yVal: number): boolean => {
    return analysis.keyPoints.some(
      (pt) => pt.showProjections && Math.abs(pt.y - yVal) < 0.15 && pt.x < -0.1
    );
  };

  const markerId = `sgkArrow_${clipUid}`;
  const clipId = `sgkPlotClip_${clipUid}`;

  return (
    <div className={`w-full max-w-md mx-auto bg-white rounded-xl overflow-hidden select-none ${className}`}>
      {/* SVG Canvas chuẩn SGK trắng tinh khiết (không tiêu đề, không ghi tên hàm số) */}
      <div className="p-2 bg-white flex flex-col items-center justify-center">
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="bg-white overflow-visible"
        >
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6.5"
              markerHeight="6.5"
              orient="auto"
            >
              <path d="M 0 1.5 L 10 5 L 0 8.5 L 2.2 5 z" fill="#0f172a" />
            </marker>
            <clipPath id={clipId}>
              <rect x={padLeft - 4} y={padTop - 4} width={plotW + 8} height={plotH + 8} />
            </clipPath>
          </defs>

          {/* 1. Đường tiệm cận nét đứt (ẩn trong vùng vẽ) */}
          <g clipPath={`url(#${clipId})`}>
            {analysis.asymptotes.map((asym, idx) => {
              if (asym.kind === 'vertical' && asym.x !== undefined) {
                const sx = toSvgX(asym.x);
                return (
                  <g key={`asym-v-${idx}`}>
                    <line
                      x1={sx}
                      y1={padTop}
                      x2={sx}
                      y2={svgH - padBot}
                      stroke="#dc2626"
                      strokeWidth="1.25"
                      strokeDasharray="5 3.5"
                      opacity="0.88"
                    />
                  </g>
                );
              }
              if (asym.kind === 'horizontal' && asym.y !== undefined) {
                const sy = toSvgY(asym.y);
                return (
                  <g key={`asym-h-${idx}`}>
                    <line
                      x1={padLeft}
                      y1={sy}
                      x2={svgW - padRight}
                      y2={sy}
                      stroke="#dc2626"
                      strokeWidth="1.25"
                      strokeDasharray="5 3.5"
                      opacity="0.88"
                    />
                  </g>
                );
              }
              if (asym.kind === 'oblique' && asym.m !== undefined && asym.q !== undefined) {
                const y1 = asym.m * analysis.minX + asym.q;
                const y2 = asym.m * analysis.maxX + asym.q;
                return (
                  <line
                    key={`asym-o-${idx}`}
                    x1={toSvgX(analysis.minX)}
                    y1={toSvgY(y1)}
                    x2={toSvgX(analysis.maxX)}
                    y2={toSvgY(y2)}
                    stroke="#dc2626"
                    strokeWidth="1.25"
                    strokeDasharray="5 3.5"
                    opacity="0.88"
                  />
                );
              }
              return null;
            })}

            {/* 2. Đường gióng vuông góc nét đứt từ điểm cực trị xuống Ox, Oy */}
            {analysis.keyPoints.map((pt, idx) => {
              if (!pt.showProjections) return null;
              const sx = toSvgX(pt.x);
              const sy = toSvgY(pt.y);
              return (
                <g key={`proj-${idx}`}>
                  {Math.abs(pt.y) > 0.08 && (
                    <line
                      x1={sx}
                      y1={sy}
                      x2={sx}
                      y2={originY}
                      stroke="#334155"
                      strokeWidth="1.2"
                      strokeDasharray="3.5 2.5"
                    />
                  )}
                  {Math.abs(pt.x) > 0.08 && (
                    <line
                      x1={sx}
                      y1={sy}
                      x2={originX}
                      y2={sy}
                      stroke="#334155"
                      strokeWidth="1.2"
                      strokeDasharray="3.5 2.5"
                    />
                  )}
                </g>
              );
            })}

            {/* 3. Đường cong đồ thị hàm số */}
            {analysis.branches.map((pts, bIdx) => (
              <path
                key={`curve-${bIdx}`}
                d={pointsToSmoothPath(pts)}
                fill="none"
                stroke="#1d4ed8"
                strokeWidth={isPresentationMode ? '2.6' : '2.25'}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>

          {/* 4. Trục tọa độ Ox & Oy với mũi tên nhọn chuẩn SGK */}
          <line
            x1={padLeft - 6}
            y1={originY}
            x2={svgW - padRight + 10}
            y2={originY}
            stroke="#0f172a"
            strokeWidth="1.6"
            markerEnd={`url(#${markerId})`}
          />
          <line
            x1={originX}
            y1={svgH - padBot + 6}
            x2={originX}
            y2={padTop - 10}
            stroke="#0f172a"
            strokeWidth="1.6"
            markerEnd={`url(#${markerId})`}
          />

          {/* 5. Nhãn x, y, O theo font Times New Roman nghiêng chuẩn SGK */}
          <text
            x={svgW - padRight + 8}
            y={originY + 16}
            fontFamily="'Times New Roman', Times, serif"
            fontSize="15"
            fontStyle="italic"
            fontWeight="bold"
            fill="#0f172a"
            textAnchor="middle"
          >
            x
          </text>
          <text
            x={originX - 13}
            y={padTop + 2}
            fontFamily="'Times New Roman', Times, serif"
            fontSize="15"
            fontStyle="italic"
            fontWeight="bold"
            fill="#0f172a"
            textAnchor="middle"
          >
            y
          </text>
          <text
            x={originX - 11}
            y={originY + 14}
            fontFamily="'Times New Roman', Times, serif"
            fontSize="14"
            fontStyle="italic"
            fill="#0f172a"
            textAnchor="middle"
            stroke="#ffffff"
            strokeWidth="3"
            paintOrder="stroke"
          >
            O
          </text>

          {/* 6. Vạch chia và số liệu tại các điểm tọa độ quan trọng trên Ox */}
          {analysis.xTicks.map((t, idx) => {
            const sx = toSvgX(t.val);
            const placeAbove = isProjectionBelowOx(t.val);
            return (
              <g key={`xt-${idx}`}>
                <line x1={sx} y1={originY - 2.8} x2={sx} y2={originY + 2.8} stroke="#0f172a" strokeWidth="1.3" />
                <text
                  x={sx}
                  y={placeAbove ? originY - 7 : originY + 15}
                  fontFamily="'Times New Roman', Times, serif"
                  fontSize="13"
                  fill="#0f172a"
                  textAnchor="middle"
                  stroke="#ffffff"
                  strokeWidth="3.5"
                  paintOrder="stroke"
                >
                  {t.label}
                </text>
              </g>
            );
          })}

          {/* 7. Vạch chia và số liệu tại các điểm tọa độ quan trọng trên Oy */}
          {analysis.yTicks.map((t, idx) => {
            const sy = toSvgY(t.val);
            const placeRight = isProjectionLeftOfOy(t.val);
            return (
              <g key={`yt-${idx}`}>
                <line x1={originX - 2.8} y1={sy} x2={originX + 2.8} y2={sy} stroke="#0f172a" strokeWidth="1.3" />
                <text
                  x={placeRight ? originX + 7 : originX - 7}
                  y={sy + 4}
                  fontFamily="'Times New Roman', Times, serif"
                  fontSize="13"
                  fill="#0f172a"
                  textAnchor={placeRight ? 'start' : 'end'}
                  stroke="#ffffff"
                  strokeWidth="3.5"
                  paintOrder="stroke"
                >
                  {t.label}
                </text>
              </g>
            );
          })}

          {/* 8. Điểm đặc biệt (chấm tròn đặc chuẩn SGK & tâm đối xứng I) */}
          {analysis.keyPoints.map((pt, idx) => {
            const sx = toSvgX(pt.x);
            const sy = toSvgY(pt.y);
            if (pt.isCenter) {
              return (
                <g key={`kp-${idx}`}>
                  <circle cx={sx} cy={sy} r="3.2" fill="#dc2626" stroke="#ffffff" strokeWidth="1.2" />
                  <text
                    x={sx + 8}
                    y={sy - 6}
                    fontFamily="'Times New Roman', Times, serif"
                    fontSize="13"
                    fontStyle="italic"
                    fontWeight="bold"
                    fill="#dc2626"
                    stroke="#ffffff"
                    strokeWidth="3"
                    paintOrder="stroke"
                  >
                    {pt.label || 'I'}
                  </text>
                </g>
              );
            }
            return (
              <circle
                key={`kp-${idx}`}
                cx={sx}
                cy={sy}
                r={pt.isExtremum ? 3.2 : 2.6}
                fill="#0f172a"
                stroke="#ffffff"
                strokeWidth="1"
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
};
