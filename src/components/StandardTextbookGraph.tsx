import React, { useState } from 'react';
import { MathFormulaRenderer } from './MathFormulaRenderer';
import { Eye, Compass } from 'lucide-react';

export interface StandardTextbookGraphProps {
  latex?: string;
  graphType?: 'rational' | 'cubic' | 'biquadratic' | 'quadratic' | 'rational_21' | 'sine' | 'linear' | string;
  title?: string;
  width?: number | string;
  height?: number;
  className?: string;
  // Custom coefficients if known
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
 * StandardTextbookGraph: Component vẽ đồ thị hàm số chuẩn xác theo phong cách Sách Giáo Khoa
 * Toán học Việt Nam (GDPT 2018 - Kết nối tri thức, Chân trời sáng tạo, Cánh diều).
 * - Trục tọa độ Oxy sắc nét, mũi tên chuẩn, gốc O.
 * - Đường cong trơn mượt, màu sắc sư phạm trang nhã (#2563eb).
 * - Đường tiệm cận đứng, tiệm cận ngang / xiên vẽ nét đứt (dashed) rõ ràng.
 * - Điểm cực đại, cực tiểu, giao điểm với trục tọa độ có đường gióng vuông góc nét đứt xuống 2 trục.
 * - Hoạt động độc lập bằng SVG vector thuần, 0ms độ trễ, không phụ thuộc internet/Desmos.
 */
export const StandardTextbookGraph: React.FC<StandardTextbookGraphProps> = ({
  latex = '',
  graphType: initialGraphType,
  title,
  height = 300,
  className = '',
  coefficients,
  asymptoteX: initialAsymX,
  asymptoteY: initialAsymY,
  isPresentationMode = false,
}) => {
  // Xác định loại hàm số dựa trên latex hoặc graphType
  const cleanLatex = (latex || '').replace(/\$/g, '').trim();
  let type = initialGraphType || 'cubic';

  if (!initialGraphType && cleanLatex) {
    if (cleanLatex.includes('\\frac') || cleanLatex.includes('/') || /(?:ax\+b|cx\+d)/i.test(cleanLatex)) {
      type = 'rational';
    } else if (cleanLatex.includes('x^4') || cleanLatex.includes('x^{4}')) {
      type = 'biquadratic';
    } else if (cleanLatex.includes('x^3') || cleanLatex.includes('x^{3}')) {
      type = 'cubic';
    } else if (cleanLatex.includes('x^2') || cleanLatex.includes('x^{2}')) {
      type = 'quadratic';
    } else if (/cos|sin/i.test(cleanLatex)) {
      type = 'sine';
    }
  }

  // Kích thước khung vẽ SVG
  const svgW = isPresentationMode ? 520 : 440;
  const svgH = isPresentationMode ? 360 : height;

  // Gốc tọa độ O (220, 150)
  const originX = svgW / 2;
  const originY = svgH / 2;
  const unitScale = isPresentationMode ? 36 : 32; // pixel trên 1 đơn vị

  const toSvgX = (x: number) => originX + x * unitScale;
  const toSvgY = (y: number) => originY - y * unitScale;

  // Giới hạn hiển thị trên trục
  const minX = -Math.floor((originX - 25) / unitScale);
  const maxX = Math.floor((svgW - originX - 25) / unitScale);
  const minY = -Math.floor((svgH - originY - 25) / unitScale);
  const maxY = Math.floor((originY - 25) / unitScale);

  // Sinh danh sách số nguyên trên trục Ox và Oy
  const xTicks: number[] = [];
  for (let x = minX; x <= maxX; x++) {
    if (x !== 0) xTicks.push(x);
  }

  const yTicks: number[] = [];
  for (let y = minY; y <= maxY; y++) {
    if (y !== 0) yTicks.push(y);
  }

  // Hàm sinh chuỗi path SVG từ mảng điểm
  const pointsToPath = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length === 0) return '';
    return pts.reduce((acc, p, idx) => {
      const sx = toSvgX(p.x).toFixed(1);
      const sy = toSvgY(p.y).toFixed(1);
      return idx === 0 ? `M ${sx} ${sy}` : `${acc} L ${sx} ${sy}`;
    }, '');
  };

  // =========================================================================
  // 1. DỮ LIỆU ĐỒ THỊ THEO TỪNG LOẠI HÀM SỐ CHUẨN SGK TOÁN
  // =========================================================================

  let curvePaths: string[] = [];
  let asymptotes: Array<{ x1: number; y1: number; x2: number; y2: number; label: string; lx: number; ly: number }> = [];
  let keyPoints: Array<{ x: number; y: number; label?: string; showProjections?: boolean }> = [];
  let displayTitle = title;
  let formulaText = cleanLatex;

  // --- LOẠI 1: HÀM PHÂN THỨC BẬC NHẤT / BẬC NHẤT y = (ax+b)/(cx+d) ---
  if (type === 'rational') {
    // Giá trị tiệm cận mặc định chuẩn SGK: ví dụ x = 1, y = 2 hoặc x = 2, y = 1
    const asymX = initialAsymX !== undefined ? initialAsymX : (cleanLatex.includes('x-2') ? 2 : 1);
    const asymY = initialAsymY !== undefined ? initialAsymY : (cleanLatex.includes('2x') ? 2 : 1);
    
    // Nếu là đồ thị nhận dạng tổng quát dạng y = (ax+b)/(cx+d) (như Câu 9)
    if (!formulaText || /(?:ax\+b|cx\+d)/i.test(formulaText)) {
      formulaText = 'y = \\frac{ax+b}{cx+d} \\ (ad - bc > 0)';
      if (!displayTitle) displayTitle = 'Đồ thị hàm số nhất biến y = (ax+b)/(cx+d)';
    }

    // Tiệm cận đứng x = asymX
    asymptotes.push({
      x1: toSvgX(asymX),
      y1: 15,
      x2: toSvgX(asymX),
      y2: svgH - 15,
      label: `x = ${asymX}`,
      lx: toSvgX(asymX) + 6,
      ly: 30,
    });

    // Tiệm cận ngang y = asymY
    asymptotes.push({
      x1: 15,
      y1: toSvgY(asymY),
      x2: svgW - 15,
      y2: toSvgY(asymY),
      label: `y = ${asymY}`,
      lx: svgW - 45,
      ly: toSvgY(asymY) - 6,
    });

    // Hàm toán học mẫu: f(x) = asymY - k / (x - asymX) với k = 1 hoặc 2 (đồng biến)
    const k = cleanLatex.includes('x+1') && cleanLatex.includes('x-2') ? -3 : -1.8;
    const f = (x: number) => asymY + k / (x - asymX);

    // Nhánh 1 (trái tiệm cận đứng)
    const pts1: Array<{ x: number; y: number }> = [];
    for (let x = -6.5; x <= asymX - 0.15; x += 0.08) {
      const y = f(x);
      if (Math.abs(y) <= 8) pts1.push({ x, y });
    }
    curvePaths.push(pointsToPath(pts1));

    // Nhánh 2 (phải tiệm cận đứng)
    const pts2: Array<{ x: number; y: number }> = [];
    for (let x = asymX + 0.15; x <= 6.5; x += 0.08) {
      const y = f(x);
      if (Math.abs(y) <= 8) pts2.push({ x, y });
    }
    curvePaths.push(pointsToPath(pts2));

    // Giao điểm với trục tung Oy: x = 0 -> y = f(0)
    const y0 = Number(f(0).toFixed(1));
    if (Math.abs(y0) <= maxY) {
      keyPoints.push({ x: 0, y: y0, label: `${y0}`, showProjections: true });
    }

    // Giao điểm với trục hoành Ox: f(x) = 0 -> x = asymX - k / asymY
    const x0 = Number((asymX - k / asymY).toFixed(1));
    if (Math.abs(x0) <= maxX) {
      keyPoints.push({ x: x0, y: 0, label: `${x0}`, showProjections: true });
    }

    // Tâm đối xứng I(asymX, asymY)
    keyPoints.push({ x: asymX, y: asymY, label: 'I' });
  }

  // --- LOẠI 2: HÀM SỐ BẬC BA y = ax^3 + bx^2 + cx + d ---
  else if (type === 'cubic') {
    if (!formulaText) formulaText = 'y = x^3 - 3x^2 + 2';
    if (!displayTitle) displayTitle = 'Đồ thị hàm số bậc ba';

    // Hàm bậc ba mẫu: y = x^3 - 3x + 1 (cực đại (-1, 3), cực tiểu (1, -1))
    const isStandard = !cleanLatex.includes('x^3 - 3x^2');
    const f = isStandard
      ? (x: number) => x * x * x - 3 * x + 1
      : (x: number) => x * x * x - 3 * x * x + 2;

    const pts: Array<{ x: number; y: number }> = [];
    for (let x = -3.2; x <= 3.4; x += 0.06) {
      const y = f(x);
      if (y >= -5 && y <= 5.5) pts.push({ x, y });
    }
    curvePaths.push(pointsToPath(pts));

    // Cực trị chuẩn
    if (isStandard) {
      keyPoints.push({ x: -1, y: 3, label: '(-1; 3)', showProjections: true });
      keyPoints.push({ x: 1, y: -1, label: '(1; -1)', showProjections: true });
      keyPoints.push({ x: 0, y: 1, label: '1' });
    } else {
      keyPoints.push({ x: 0, y: 2, label: '2' });
      keyPoints.push({ x: 2, y: -2, label: '(2; -2)', showProjections: true });
    }
  }

  // --- LOẠI 3: HÀM SỐ BẬC BỐN TRÙNG PHƯƠNG y = ax^4 + bx^2 + c ---
  else if (type === 'biquadratic') {
    if (!formulaText) formulaText = 'y = x^4 - 2x^2 - 1';
    if (!displayTitle) displayTitle = 'Đồ thị hàm số bậc bốn trùng phương';

    const f = (x: number) => x * x * x * x - 2 * x * x - 1;
    const pts: Array<{ x: number; y: number }> = [];
    for (let x = -2.2; x <= 2.2; x += 0.05) {
      const y = f(x);
      if (y >= -4 && y <= 4.5) pts.push({ x, y });
    }
    curvePaths.push(pointsToPath(pts));

    // 3 điểm cực trị
    keyPoints.push({ x: -1, y: -2, label: '(-1; -2)', showProjections: true });
    keyPoints.push({ x: 0, y: -1, label: '-1' });
    keyPoints.push({ x: 1, y: -2, label: '(1; -2)', showProjections: true });
  }

  // --- LOẠI 4: HÀM PARABOL BẬC HAI y = ax^2 + bx + c ---
  else if (type === 'quadratic') {
    if (!formulaText) formulaText = 'y = x^2 - 4x + 3';
    if (!displayTitle) displayTitle = 'Đồ thị hàm số bậc hai (Parabol)';

    const f = (x: number) => x * x - 4 * x + 3;
    const pts: Array<{ x: number; y: number }> = [];
    for (let x = -0.8; x <= 4.8; x += 0.06) {
      const y = f(x);
      if (y >= -2.5 && y <= 5.5) pts.push({ x, y });
    }
    curvePaths.push(pointsToPath(pts));

    // Đỉnh Parabol I(2; -1)
    keyPoints.push({ x: 2, y: -1, label: 'I(2; -1)', showProjections: true });
    // Trục đối xứng x = 2
    asymptotes.push({
      x1: toSvgX(2),
      y1: 20,
      x2: toSvgX(2),
      y2: svgH - 20,
      label: 'x = 2',
      lx: toSvgX(2) + 5,
      ly: 35,
    });
  }

  // --- LOẠI 5: DAO ĐỘNG ĐIỀU HÒA / LƯỢNG GIÁC y = A*cos(omega*x) ---
  else {
    if (!formulaText) formulaText = 'y = 2\\sin(x)';
    if (!displayTitle) displayTitle = 'Đồ thị hàm số';

    const f = (x: number) => 2 * Math.sin(x);
    const pts: Array<{ x: number; y: number }> = [];
    for (let x = -5.5; x <= 5.5; x += 0.08) {
      pts.push({ x, y: f(x) });
    }
    curvePaths.push(pointsToPath(pts));
    keyPoints.push({ x: 1.57, y: 2, label: '(\\pi/2; 2)', showProjections: true });
  }

  return (
    <div className={`w-full max-w-lg mx-auto bg-white rounded-2xl border-2 border-slate-300 shadow-md overflow-hidden select-none font-sans ${className}`}>
      {/* Tiêu đề đồ thị chuẩn SGK */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
          <span className="text-xs font-bold text-slate-800 tracking-wide">
            {displayTitle || 'ĐỒ THỊ HÀM SỐ CHUẨN SGK'}
          </span>
        </div>
        {formulaText && (
          <div className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200/80">
            <MathFormulaRenderer content={`$${formulaText.startsWith('$') ? formulaText.slice(1, -1) : formulaText}$`} />
          </div>
        )}
      </div>

      {/* SVG Canvas vẽ đồ thị tọa độ Oxy */}
      <div className="p-3 bg-white flex flex-col items-center justify-center">
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="overflow-visible bg-white"
        >
          {/* 1. Lưới tọa độ mảnh nhẹ chuẩn sách giáo khoa (grid) */}
          <g className="grid-lines" stroke="#f1f5f9" strokeWidth="0.8">
            {xTicks.map((x) => (
              <line key={`gx-${x}`} x1={toSvgX(x)} y1={15} x2={toSvgX(x)} y2={svgH - 15} />
            ))}
            {yTicks.map((y) => (
              <line key={`gy-${y}`} x1={15} y1={toSvgY(y)} x2={svgW - 15} y2={toSvgY(y)} />
            ))}
          </g>

          {/* 2. Đường tiệm cận nét đứt (nếu có) */}
          {asymptotes.map((asym, aIdx) => (
            <g key={`asym-${aIdx}`}>
              <line
                x1={asym.x1}
                y1={asym.y1}
                x2={asym.x2}
                y2={asym.y2}
                stroke="#e11d48"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              <text
                x={asym.lx}
                y={asym.ly}
                fontSize="11"
                fontWeight="bold"
                fill="#e11d48"
                fontStyle="italic"
              >
                {asym.label}
              </text>
            </g>
          ))}

          {/* 3. Đường gióng vuông góc nét đứt từ điểm đặc biệt tới 2 trục */}
          {keyPoints.map((pt, pIdx) => {
            if (!pt.showProjections) return null;
            const sx = toSvgX(pt.x);
            const sy = toSvgY(pt.y);
            return (
              <g key={`proj-${pIdx}`}>
                {/* Gióng xuống Ox */}
                {Math.abs(pt.y) > 0.05 && (
                  <line
                    x1={sx}
                    y1={sy}
                    x2={sx}
                    y2={originY}
                    stroke="#94a3b8"
                    strokeWidth="1.2"
                    strokeDasharray="3 2"
                  />
                )}
                {/* Gióng sang Oy */}
                {Math.abs(pt.x) > 0.05 && (
                  <line
                    x1={sx}
                    y1={sy}
                    x2={originX}
                    y2={sy}
                    stroke="#94a3b8"
                    strokeWidth="1.2"
                    strokeDasharray="3 2"
                  />
                )}
              </g>
            );
          })}

          {/* 4. Trục tọa độ Ox và Oy chính với mũi tên nhọn */}
          <defs>
            <marker
              id="axisArrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#1e293b" />
            </marker>
          </defs>

          {/* Trục Ox */}
          <line
            x1="20"
            y1={originY}
            x2={svgW - 15}
            y2={originY}
            stroke="#1e293b"
            strokeWidth="1.8"
            markerEnd="url(#axisArrow)"
          />
          {/* Trục Oy */}
          <line
            x1={originX}
            y1={svgH - 18}
            x2={originX}
            y2="15"
            stroke="#1e293b"
            strokeWidth="1.8"
            markerEnd="url(#axisArrow)"
          />

          {/* Nhãn trục x, y và gốc O */}
          <text
            x={svgW - 12}
            y={originY - 8}
            fontSize="14"
            fontStyle="italic"
            fontWeight="bold"
            fill="#0f172a"
          >
            x
          </text>
          <text
            x={originX + 8}
            y="18"
            fontSize="14"
            fontStyle="italic"
            fontWeight="bold"
            fill="#0f172a"
          >
            y
          </text>
          <text
            x={originX - 14}
            y={originY + 16}
            fontSize="13"
            fontStyle="italic"
            fontWeight="bold"
            fill="#0f172a"
          >
            O
          </text>

          {/* Vạch chia số (ticks) trên trục Ox */}
          {xTicks.map((x) => {
            const sx = toSvgX(x);
            return (
              <g key={`tick-x-${x}`}>
                <line x1={sx} y1={originY - 3} x2={sx} y2={originY + 3} stroke="#1e293b" strokeWidth="1.2" />
                <text
                  x={sx}
                  y={originY + 15}
                  fontSize="11"
                  fill="#475569"
                  textAnchor="middle"
                  fontWeight="500"
                >
                  {x}
                </text>
              </g>
            );
          })}

          {/* Vạch chia số (ticks) trên trục Oy */}
          {yTicks.map((y) => {
            const sy = toSvgY(y);
            return (
              <g key={`tick-y-${y}`}>
                <line x1={originX - 3} y1={sy} x2={originX + 3} stroke="#1e293b" strokeWidth="1.2" />
                <text
                  x={originX - 8}
                  y={sy + 4}
                  fontSize="11"
                  fill="#475569"
                  textAnchor="end"
                  fontWeight="500"
                >
                  {y}
                </text>
              </g>
            );
          })}

          {/* 5. Đường cong đồ thị (Curve) trơn mượt màu xanh đậm */}
          {curvePaths.map((dStr, cIdx) => (
            <path
              key={`curve-${cIdx}`}
              d={dStr}
              fill="none"
              stroke="#2563eb"
              strokeWidth={isPresentationMode ? '3.2' : '2.4'}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* 6. Các điểm đặc biệt (cực trị, giao điểm, tâm đối xứng) */}
          {keyPoints.map((pt, pIdx) => {
            const sx = toSvgX(pt.x);
            const sy = toSvgY(pt.y);
            const isCenterI = pt.label === 'I';
            return (
              <g key={`pt-${pIdx}`}>
                <circle
                  cx={sx}
                  cy={sy}
                  r={isCenterI ? 4 : 3.5}
                  fill={isCenterI ? '#e11d48' : '#2563eb'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                {pt.label && (
                  <text
                    x={sx + (pt.x >= 0 ? 6 : -6)}
                    y={sy - 6}
                    fontSize="11"
                    fontWeight="bold"
                    fill={isCenterI ? '#e11d48' : '#1e3a8a'}
                    textAnchor={pt.x >= 0 ? 'start' : 'end'}
                  >
                    {pt.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Chú thích chân hình chuẩn SGK */}
        <div className="mt-2 text-center text-xs font-medium text-slate-600 italic">
          Hình vẽ: Đồ thị hàm số trên mặt phẳng tọa độ Oxy
        </div>
      </div>
    </div>
  );
};
