import { WhiteboardTool, StrokePoint } from '../types';
import { compileMathExpression } from './mathExpressionParser';

export interface GraphBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

export interface GraphRenderOptions {
  showGrid?: boolean;
  showProjections?: boolean;
  scale?: number;
  graphOffsetX?: number;
  graphOffsetY?: number;
  graphScale?: number;
  customEquation?: string;
  hatchPattern?: boolean;
  fillColor?: string;
}

export function isFunctionGraphTool(tool: WhiteboardTool): boolean {
  return [
    'func_linear',
    'func_quadratic_up',
    'func_quadratic_down',
    'func_cubic_2extrema_pos',
    'func_cubic_2extrema_neg',
    'func_cubic_noextrema_pos',
    'func_cubic_noextrema_neg',
    'func_cubic_inflection_pos',
    'func_cubic_inflection_neg',
    'func_biquadratic_3extrema_pos',
    'func_biquadratic_3extrema_neg',
    'func_biquadratic_1extremum_pos',
    'func_biquadratic_1extremum_neg',
    'func_rational_pos',
    'func_rational_neg',
    'func_rational_pos_right',
    'func_rational_neg_left',
    'func_frac21',
    'func_frac21_neg_slope',
    'func_frac21_noextrema_pos',
    'func_frac21_noextrema_neg',
    'func_exp_pos',
    'func_exp_neg',
    'func_log_pos',
    'func_log_neg',
    'func_custom_equation',
    'shape_curved_trapezoid_area',
    'shape_solid_revolution_volume',
    'phys_oscillation',
    'phys_shm_displacement',
    'phys_shm_velocity',
    'phys_shm_acceleration',
    'phys_shm_energy',
    'phys_shm_damped',
    'phys_projectile',
    'phys_wave',
  ].includes(tool);
}

export function getGraphBounds(points: StrokePoint[], scale: number = 1): GraphBounds {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  if (!points || points.length === 0) {
    return { minX: 100, maxX: 460, minY: 100, maxY: 420, width: 360, height: 320, cx: 280, cy: 260 };
  }

  if (points.length === 1) {
    const p = points[0];
    const w = 360 * Math.max(0.4, scale);
    const h = 300 * Math.max(0.4, scale);
    return {
      minX: p.x,
      maxX: p.x + w,
      minY: p.y,
      maxY: p.y + h,
      width: w,
      height: h,
      cx: p.x + w / 2,
      cy: p.y + h / 2,
    };
  }

  points.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  const rawWidth = Math.max(160, maxX - minX);
  const rawHeight = Math.max(140, maxY - minY);
  const cx = minX + rawWidth / 2;
  const cy = minY + rawHeight / 2;

  // Apply scale relative to center if scale !== 1
  const width = rawWidth * Math.max(0.3, scale);
  const height = rawHeight * Math.max(0.3, scale);
  const scaledMinX = cx - width / 2;
  const scaledMaxX = cx + width / 2;
  const scaledMinY = cy - height / 2;
  const scaledMaxY = cy + height / 2;

  return {
    minX: scaledMinX,
    maxX: scaledMaxX,
    minY: scaledMinY,
    maxY: scaledMaxY,
    width,
    height,
    cx,
    cy,
  };
}

/**
 * Draws Textbook-standard Coordinate Axes Oxy (Sách giáo khoa Toán Việt Nam)
 */
function drawTextbookAxes(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  left: number,
  right: number,
  top: number,
  bottom: number,
  unitPx: number,
  axisColor: string,
  gridOpacity: number = 0.35,
  showGrid: boolean = true,
  labelXStr: string = 'x',
  labelYStr: string = 'y',
  unitPxY?: number,
  customTicksX?: Array<{ val: number; label: string }>,
  customTicksY?: Array<{ val: number; label: string }>
) {
  ctx.save();
  const uX = unitPx;
  const uY = unitPxY ?? unitPx;

  // 1. Subtle Notebook Grid (Lưới ô ly chuẩn SGK)
  if (showGrid && uX >= 16) {
    ctx.save();
    ctx.strokeStyle = axisColor;
    ctx.globalAlpha = Math.min(0.25, gridOpacity * 0.4);
    ctx.lineWidth = 0.6;
    ctx.setLineDash([]);

    // Vertical grid lines
    const gridStepX = uX > 90 ? uX / 2 : uX;
    for (let x = originX + gridStepX; x <= right - 4; x += gridStepX) {
      ctx.beginPath();
      ctx.moveTo(x, top + 4);
      ctx.lineTo(x, bottom - 4);
      ctx.stroke();
    }
    for (let x = originX - gridStepX; x >= left + 4; x -= gridStepX) {
      ctx.beginPath();
      ctx.moveTo(x, top + 4);
      ctx.lineTo(x, bottom - 4);
      ctx.stroke();
    }
    // Horizontal grid lines
    const gridStepY = uY > 90 ? uY / 2 : uY;
    for (let y = originY + gridStepY; y <= bottom - 4; y += gridStepY) {
      ctx.beginPath();
      ctx.moveTo(left + 4, y);
      ctx.lineTo(right - 4, y);
      ctx.stroke();
    }
    for (let y = originY - gridStepY; y >= top + 4; y -= gridStepY) {
      ctx.beginPath();
      ctx.moveTo(left + 4, y);
      ctx.lineTo(right - 4, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 2. Main Axes Lines
  ctx.strokeStyle = axisColor;
  ctx.fillStyle = axisColor;
  ctx.lineWidth = 1.6;
  ctx.setLineDash([]);

  // Horizontal Axis Ox
  ctx.beginPath();
  ctx.moveTo(left, originY);
  ctx.lineTo(right, originY);
  ctx.stroke();

  // Sharp Arrow for Ox
  const arrowLen = 10;
  const arrowWidth = 4;
  ctx.beginPath();
  ctx.moveTo(right + 2, originY);
  ctx.lineTo(right - arrowLen, originY - arrowWidth);
  ctx.lineTo(right - arrowLen + 2, originY);
  ctx.lineTo(right - arrowLen, originY + arrowWidth);
  ctx.closePath();
  ctx.fill();

  // Vertical Axis Oy
  ctx.beginPath();
  ctx.moveTo(originX, bottom);
  ctx.lineTo(originX, top);
  ctx.stroke();

  // Sharp Arrow for Oy
  ctx.beginPath();
  ctx.moveTo(originX, top - 2);
  ctx.lineTo(originX - arrowWidth, top + arrowLen);
  ctx.lineTo(originX, top + arrowLen - 2);
  ctx.lineTo(originX + arrowWidth, top + arrowLen);
  ctx.closePath();
  ctx.fill();

  // 3. Coordinate Unit Ticks & Small Labels
  ctx.lineWidth = 1.2;
  const tickHalf = 3.5;
  ctx.font = 'bold 11px "Cambria", "Times New Roman", serif';

  // Ox Ticks
  if (customTicksX && customTicksX.length > 0) {
    for (const t of customTicksX) {
      const px = originX + t.val * uX;
      if (px >= left + 4 && px <= right - 12) {
        ctx.beginPath();
        ctx.moveTo(px, originY - tickHalf);
        ctx.lineTo(px, originY + tickHalf);
        ctx.stroke();
        if (t.label) {
          const wLbl = ctx.measureText(t.label).width;
          ctx.fillText(t.label, px - wLbl / 2, originY + 15);
        }
      }
    }
  } else {
    let countX = 0;
    for (let x = originX + uX; x <= right - 16; x += uX) {
      countX++;
      ctx.beginPath();
      ctx.moveTo(x, originY - tickHalf);
      ctx.lineTo(x, originY + tickHalf);
      ctx.stroke();
      if (uX > 26 || countX % 2 === 0 || countX === 1) {
        ctx.fillText(String(countX), x - 3, originY + 14);
      }
    }
    let countNegX = 0;
    for (let x = originX - uX; x >= left + 14; x -= uX) {
      countNegX++;
      ctx.beginPath();
      ctx.moveTo(x, originY - tickHalf);
      ctx.lineTo(x, originY + tickHalf);
      ctx.stroke();
      if (uX > 26 || countNegX % 2 === 0 || countNegX === 1) {
        ctx.fillText(`-${countNegX}`, x - 7, originY + 14);
      }
    }
  }

  // Oy Ticks
  if (customTicksY && customTicksY.length > 0) {
    for (const t of customTicksY) {
      const py = originY - t.val * uY;
      if (py >= top + 14 && py <= bottom - 10) {
        ctx.beginPath();
        ctx.moveTo(originX - tickHalf, py);
        ctx.lineTo(originX + tickHalf, py);
        ctx.stroke();
        if (t.label) {
          const wLbl = ctx.measureText(t.label).width;
          ctx.fillText(t.label, originX - wLbl - 6, py + 4);
        }
      }
    }
  } else {
    let countY = 0;
    for (let y = originY - uY; y >= top + 16; y -= uY) {
      countY++;
      ctx.beginPath();
      ctx.moveTo(originX - tickHalf, y);
      ctx.lineTo(originX + tickHalf, y);
      ctx.stroke();
      if (uY > 26 || countY % 2 === 0 || countY === 1) {
        ctx.fillText(String(countY), originX - 14, y + 4);
      }
    }
    let countNegY = 0;
    for (let y = originY + uY; y <= bottom - 14; y += uY) {
      countNegY++;
      ctx.beginPath();
      ctx.moveTo(originX - tickHalf, y);
      ctx.lineTo(originX + tickHalf, y);
      ctx.stroke();
      if (uY > 26 || countNegY % 2 === 0 || countNegY === 1) {
        ctx.fillText(`-${countNegY}`, originX - 17, y + 4);
      }
    }
  }

  // 4. Textbook Labels: x, y, O
  ctx.font = 'italic 13px "Cambria", "Times New Roman", serif';
  ctx.fillText(labelXStr, right - 4, originY + 15);
  ctx.fillText(labelYStr, originX - 15, top + 8);
  ctx.fillText('O', originX - 13, originY + 13);

  ctx.restore();
}

/**
 * Draws Textbook Projection Lines (Đường dóng nét đứt chuẩn SGK từ điểm cực trị/đỉnh đến 2 trục)
 */
function drawTextbookProjection(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  px: number,
  py: number,
  labelX: string,
  labelY: string,
  lineColor: string = 'rgba(56, 189, 248, 0.85)',
  pointColor: string = '#facc15'
) {
  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1.1;
  ctx.setLineDash([3, 3]);

  // Dóng xuống Ox
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, originY);
  ctx.stroke();

  // Dóng sang Oy
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(originX, py);
  ctx.stroke();

  ctx.setLineDash([]);

  // Điểm tọa độ đặc biệt (Solid Dot)
  ctx.fillStyle = pointColor;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(px, py, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Chữ số / nhãn tọa độ tại chân đường dóng
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold italic 11px "Cambria", "Times New Roman", serif';

  if (labelX) {
    const yOffset = py > originY ? -6 : 14;
    ctx.fillText(labelX, px - 4, originY + yOffset);
  }
  if (labelY) {
    const xOffset = px > originX ? -16 : 6;
    ctx.fillText(labelY, originX + xOffset, py + 4);
  }

  ctx.restore();
}

/**
 * Draws Asymptote Line (Đường tiệm cận nét đứt chuẩn SGK)
 * Yêu cầu người dùng: "khỏi hiển thị tên tiệm cận" -> Chỉ vẽ nét đứt tinh tế, không chèn chữ lên đường tiệm cận
 */
function drawAsymptote(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  _label?: string,
  _labelX?: number,
  _labelY?: number,
  color: string = '#38bdf8'
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.3;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Phân tích đa thức bậc 0, 1, 2 cho tử số và mẫu số để tìm tiệm cận chuẩn SGK Toán 12
 */
function parsePolynomialForAsymptotes(str: string): { a: number; b: number; c: number; deg: number } {
  let s = str.replace(/\s+/g, '').replace(/\^2/g, '²').replace(/\^3/g, '³');
  let a = 0, b = 0, c = 0;

  // Hạng tử bậc 2: ax²
  const m2 = s.match(/([+-]?[0-9]*\.?[0-9]*)x[²2]/);
  if (m2) {
    const coef = m2[1];
    a = coef === '' || coef === '+' ? 1 : coef === '-' ? -1 : parseFloat(coef);
    s = s.replace(m2[0], '');
  }

  // Hạng tử bậc 1: bx
  const m1 = s.match(/([+-]?[0-9]*\.?[0-9]*)x(?![²2³3])/);
  if (m1) {
    const coef = m1[1];
    b = coef === '' || coef === '+' ? 1 : coef === '-' ? -1 : parseFloat(coef);
    s = s.replace(m1[0], '');
  }

  // Hệ số tự do: c
  if (s && s !== '+' && s !== '-') {
    c = parseFloat(s) || 0;
  }

  return { a, b, c, deg: a !== 0 ? 2 : b !== 0 ? 1 : 0 };
}

function formatAsymptoteNumber(val: number): string {
  if (Number.isInteger(val)) return String(val);
  const commonFracs = [
    { v: 0.5, s: '1/2' }, { v: -0.5, s: '-1/2' },
    { v: 0.25, s: '1/4' }, { v: -0.25, s: '-1/4' },
    { v: 0.75, s: '3/4' }, { v: -0.75, s: '-3/4' },
    { v: 1.5, s: '3/2' }, { v: -1.5, s: '-3/2' },
    { v: 2.5, s: '5/2' }, { v: -2.5, s: '-5/2' },
    { v: 0.3333, s: '1/3' }, { v: -0.3333, s: '-1/3' },
    { v: 0.6667, s: '2/3' }, { v: -0.6667, s: '-2/3' },
  ];
  const found = commonFracs.find((f) => Math.abs(f.v - val) < 0.01);
  if (found) return found.s;
  return Number(val.toFixed(2)).toString();
}

/**
 * Tự động phát hiện các đường tiệm cận đứng (TCĐ), tiệm cận ngang (TCN), tiệm cận xiên (TCX)
 * cho hàm phân thức nhất biến và bậc 2 trên bậc 1
 */
function detectCustomFunctionAsymptotes(eqInput: string): {
  tcD?: { x: number; label: string; xStr: string };
  tcN?: { y: number; label: string; yStr: string };
  tcX?: { a: number; b: number; label: string };
  I?: { x: number; y: number; xStr: string; yStr: string };
  discontinuities: number[];
} | null {
  const s = eqInput.replace(/^(y|x\(t\)|f\(x\))\s*=\s*/i, '').trim();
  const fracMatch = s.match(/(?:\(([^()]+)\)|([a-zA-Z0-9^+\-*.]+))\s*\/\s*(?:\(([^()]+)\)|([a-zA-Z0-9^+\-*.]+))/);
  if (!fracMatch) return null;

  const numStr = fracMatch[1] || fracMatch[2] || '';
  const denStr = fracMatch[3] || fracMatch[4] || '';
  const np = parsePolynomialForAsymptotes(numStr);
  const dp = parsePolynomialForAsymptotes(denStr);

  // Mẫu số bậc 1: dx + e (d khác 0)
  if (dp.deg === 1 && dp.b !== 0) {
    const d = dp.b;
    const e = dp.c;
    const x0 = -e / d;
    const xStr = formatAsymptoteNumber(x0);
    const tcD = { x: x0, label: `x = ${xStr}`, xStr };
    const discontinuities = [x0];

    // 1. Hàm Phân Thức Nhất Biến: (ax + b)/(cx + d)
    if (np.deg <= 1) {
      const a = np.b;
      const y0 = a / d;
      const yStr = formatAsymptoteNumber(y0);
      const tcN = { y: y0, label: `y = ${yStr}`, yStr };
      const I = { x: x0, y: y0, xStr, yStr };
      return { tcD, tcN, I, discontinuities };
    }

    // 2. Hàm Phân Thức Bậc 2 trên Bậc 1: (ax² + bx + c)/(dx + e)
    if (np.deg === 2) {
      const a = np.a;
      const b = np.b;
      const A = a / d;
      const B = (b - A * e) / d;
      const strA = A === 1 ? 'x' : A === -1 ? '-x' : `${formatAsymptoteNumber(A)}x`;
      const strB = B === 0 ? '' : B > 0 ? ` + ${formatAsymptoteNumber(B)}` : ` - ${formatAsymptoteNumber(Math.abs(B))}`;
      const label = `y = ${strA}${strB}`;
      const yI = A * x0 + B;
      const I = { x: x0, y: yI, xStr, yStr: formatAsymptoteNumber(yI) };
      return { tcD, tcX: { a: A, b: B, label }, I, discontinuities };
    }
  }

  return null;
}

export interface PeriodicHarmonicInfo {
  isPeriodic: boolean;
  isTimeVariable: boolean;
  omega: number;
  T: number;
  amplitude: number;
  displayTStr: string;
  displayAStr: string;
}

function formatPeriodNumber(val: number): string {
  if (Math.abs(val - 1) < 0.02) return '1';
  if (Math.abs(val - 2) < 0.02) return '2';
  if (Math.abs(val - 0.5) < 0.01) return '0.5';
  if (Math.abs(val - 0.25) < 0.01) return '0.25';
  if (Math.abs(val - 0.2) < 0.01) return '0.2';
  if (Math.abs(val - 0.1) < 0.005) return '0.1';
  if (Math.abs(val - Math.PI) < 0.02) return 'π';
  if (Math.abs(val - 2 * Math.PI) < 0.02) return '2π';
  if (Math.abs(val - Math.PI / 2) < 0.02) return 'π/2';
  if (Number.isInteger(val)) return String(val);
  return Number(val.toFixed(2)).toString();
}

function formatAmplitudeNumber(val: number): string {
  if (Math.abs(val - Math.PI) < 0.02) return 'π';
  if (Math.abs(val - 2 * Math.PI) < 0.02) return '2π';
  if (Math.abs(val - 4 * Math.PI) < 0.05) return '4π';
  if (Math.abs(val - 8 * Math.PI) < 0.05) return '8π';
  if (Math.abs(val - 16 * Math.PI * Math.PI) < 1) return '16π²';
  if (Number.isInteger(val)) return String(val);
  return Number(val.toFixed(1)).toString();
}

/**
 * Tự động phân tích hàm tuần hoàn / dao động điều hòa (Vật lý 12 & Toán 12):
 * - Nhận diện omega (rad/s) và chu kỳ T = 2pi / omega
 * - Nhận diện biên độ A
 * - Nhận diện biến thời gian t (đồ thị dao động theo thời gian)
 */
export function analyzePeriodicHarmonicFunction(
  eqInput: string,
  fn: (val: number) => number,
  variableName: string
): PeriodicHarmonicInfo | null {
  if (!eqInput) return null;
  const s = eqInput.toLowerCase().replace(/\s+/g, '');

  const hasTrig = /sin|cos/.test(s);
  const isTimeVar = variableName === 't' || /\bt\b/.test(s) || /x\(t\)|v\(t\)|a\(t\)/.test(s);

  if (!hasTrig && !isTimeVar) {
    return null;
  }

  let omega = 0;
  let amplitude = 0;

  // 1. Phân tích giải tích: Tìm biểu thức bên trong cos(...) hoặc sin(...)
  // e.g. 4cos(2πt), 4cos(2*pi*t), 2sin(2x), 3cos(x - π/4), 4cos(100πt), v = -8π*sin(2πt), a = -16π^2*cos(2πt)
  const trigMatch = s.match(/(?:cos|sin)\s*\(\s*([^()]+)\s*\)/);
  if (trigMatch) {
    const inside = trigMatch[1];
    const v = isTimeVar ? 't' : 'x';
    // Tìm cụm chứa biến v: e.g. 2πt, 2*pi*t, 2t, 0.5t, πt, t
    const varRegex = new RegExp(`([0-9.]*)\\s*\\*?\\s*(?:π|pi|__pi__)?\\s*\\*?\\s*${v}`);
    const matchVar = inside.match(varRegex);

    if (matchVar) {
      const fullTerm = matchVar[0];
      const hasPi = /π|pi|__pi__/.test(fullTerm);
      const numPart = matchVar[1];
      const factor = numPart === '' || numPart === '+' ? 1 : numPart === '-' ? 1 : parseFloat(numPart) || 1;
      omega = factor * (hasPi ? Math.PI : 1);

      // Xử lý mẫu số nếu có dạng chia: (2π/3)t, 2πt/3, t/2, πt/2
      const divMatch = inside.match(new RegExp(`(?:${v}|\\))\\s*\\/\\s*([0-9.]+)`)) || inside.match(new RegExp(`\\/\\s*([0-9.]+)`));
      if (divMatch && divMatch[1]) {
        const divisor = parseFloat(divMatch[1]);
        if (divisor > 0) omega /= divisor;
      }
    }
  }

  // Phân tích biên độ A:
  // e.g. x = 4cos..., 4cos..., y = 2sin..., v = -8π*sin..., a = -16π^2*cos..., x = 4e^(-0.2t)cos...
  const ampMatch = s.match(/(?:^|=|x|y|v|a)\s*([+-]?[0-9.]*)\s*\*?\s*(?:π|pi|__pi__)?\s*\*?\s*(?:\^2|²)?\s*\*?\s*(?:e\^[^)]+\)?\*?)?(?:cos|sin)/);
  if (ampMatch && ampMatch[1] !== undefined) {
    const rawAmp = ampMatch[1];
    const fullAmpTerm = ampMatch[0];
    const hasPi = /π|pi|__pi__/.test(fullAmpTerm);
    const hasPiSq = /(?:π|pi|__pi__)(?:\^2|²)/.test(fullAmpTerm);
    const factor = rawAmp === '' || rawAmp === '+' ? 1 : rawAmp === '-' ? 1 : Math.abs(parseFloat(rawAmp)) || 1;
    amplitude = factor * (hasPiSq ? Math.PI * Math.PI : hasPi ? Math.PI : 1);
  }

  // 2. Kiểm chứng / dò tìm số học (Numerical detection) nếu giải tích chưa xác định được hoặc có tổng hợp sóng
  if (omega <= 0 || !Number.isFinite(omega)) {
    let prevVal = fn(0);
    let firstPeakT = -1;
    let secondPeakT = -1;
    let maxVal = Math.abs(prevVal);

    const step = 0.005;
    for (let t = step; t <= 20; t += step) {
      const val = fn(t);
      if (Number.isFinite(val)) {
        if (Math.abs(val) > maxVal) maxVal = Math.abs(val);
        const prevPrevVal = fn(t - step * 2);
        if (prevVal > val && prevVal > prevPrevVal && prevVal > 0.05 * maxVal) {
          if (firstPeakT < 0) {
            firstPeakT = t - step;
          } else if (secondPeakT < 0 && (t - step - firstPeakT) > 0.05) {
            secondPeakT = t - step;
            break;
          }
        }
      }
      prevVal = val;
    }

    if (firstPeakT >= 0 && secondPeakT > firstPeakT) {
      const detectedT = secondPeakT - firstPeakT;
      if (detectedT > 0.01 && detectedT < 50) {
        omega = (2 * Math.PI) / detectedT;
        if (amplitude <= 0) amplitude = maxVal;
      }
    }
  }

  if (omega <= 0 || !Number.isFinite(omega)) {
    omega = isTimeVar ? 2 * Math.PI : 1;
  }

  const T = (2 * Math.PI) / omega;
  if (amplitude <= 0 || !Number.isFinite(amplitude)) {
    let maxFound = 0;
    for (let t = 0; t <= T; t += T / 50) {
      const v = Math.abs(fn(t));
      if (Number.isFinite(v) && v > maxFound) maxFound = v;
    }
    amplitude = maxFound > 0.01 ? maxFound : 4;
  }

  return {
    isPeriodic: true,
    isTimeVariable: isTimeVar,
    omega,
    T,
    amplitude,
    displayTStr: formatPeriodNumber(T),
    displayAStr: formatAmplitudeNumber(amplitude),
  };
}

/**
 * Vẽ nhãn tên đồ thị chuẩn toán học (phân số có gạch ngang, căn thức có gạch đầu, số mũ)
 * VỊ TRÍ: NẰM Ở PHÍA DƯỚI ĐỒ THỊ, TUYỆT ĐỐI KHÔNG CHE KHUẤT HỆ TRỤC TỌA ĐỘ VÀ ĐƯỜNG CONG
 */
function drawStandardMathBanner(
  ctx: CanvasRenderingContext2D,
  eqInput: string,
  parsed: any,
  asymptotes: any,
  cx: number,
  bottom: number,
  width: number,
  labelVarX: string,
  labelVarY: string,
  left: number = 0,
  right: number = 1000
) {
  ctx.save();

  if (parsed.error) {
    const errorTxt = `⚠️ ${parsed.error}`;
    ctx.font = 'bold 12px "Cambria", "Times New Roman", serif';
    const errW = Math.min(width - 20, ctx.measureText(errorTxt).width + 28);
    const bannerH = 30;
    const bannerY = bottom - bannerH - 4;
    const bannerX = Math.max(left + 8, Math.min(right - errW - 8, cx - errW / 2));
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, errW, bannerH, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f87171';
    ctx.fillText(errorTxt, bannerX + 12, bannerY + 19);
    ctx.restore();
    return;
  }

  const rawClean = (parsed.displayFormula || eqInput).trim();
  const prefixMatch = rawClean.match(/^([yufxvas]\s*(?:\([^)]*\))?)\s*=\s*/i);
  const prefixStr = (prefixMatch ? prefixMatch[1].trim() : labelVarY) + ' = ';
  const bodyStr = prefixMatch ? rawClean.substring(prefixMatch[0].length).trim() : rawClean;

  // Kiểm tra cấu trúc phân số
  const fracMatch =
    bodyStr.match(/^\(([^()]+)\)\s*\/\s*\(([^()]+)\)$/) ||
    bodyStr.match(/^([a-zA-Z0-9^+\-*.]+)\s*\/\s*\(([^()]+)\)$/) ||
    bodyStr.match(/^\(([^()]+)\)\s*\/\s*([a-zA-Z0-9^+\-*.]+)$/);

  // Kiểm tra căn thức
  const sqrtMatch = bodyStr.match(/^(?:sqrt|√)\s*\(([^()]+)\)$/i);

  ctx.font = 'bold 13px "Cambria", "Times New Roman", serif';
  const wPrefix = ctx.measureText(prefixStr).width;

  let bannerH = 34;
  let formulaW = 0;
  let isFrac = false;
  let isSqrt = false;
  let numStr = '';
  let denStr = '';
  let rootStr = '';
  let standardStr = '';
  let wNum = 0;
  let wDen = 0;
  let wBar = 0;

  if (fracMatch) {
    isFrac = true;
    bannerH = 40;
    numStr = fracMatch[1].replace(/\^2/g, '²').replace(/\^3/g, '³').replace(/\^4/g, '⁴').trim();
    denStr = fracMatch[2].replace(/\^2/g, '²').replace(/\^3/g, '³').replace(/\^4/g, '⁴').trim();
    ctx.font = 'bold 11.5px "Cambria", "Times New Roman", serif';
    wNum = ctx.measureText(numStr).width;
    wDen = ctx.measureText(denStr).width;
    wBar = Math.max(wNum, wDen) + 14;
    formulaW = wPrefix + wBar;
  } else if (sqrtMatch) {
    isSqrt = true;
    rootStr = sqrtMatch[1].replace(/\^2/g, '²').replace(/\^3/g, '³').replace(/\^4/g, '⁴').trim();
    ctx.font = 'bold 12.5px "Cambria", "Times New Roman", serif';
    const wRoot = ctx.measureText(rootStr).width;
    formulaW = wPrefix + 14 + wRoot;
  } else {
    standardStr = bodyStr.replace(/\^2/g, '²').replace(/\^3/g, '³').replace(/\^4/g, '⁴').trim();
    ctx.font = 'bold 12.5px "Cambria", "Times New Roman", serif';
    formulaW = wPrefix + ctx.measureText(standardStr).width;
  }

  // Yêu cầu người dùng: "Tên đồ thị nằm phía dưới và không che khuất phần đồ thị đang vẽ, khỏi hiển thị tên tiệm cận."
  // Banner chỉ hiển thị tên công thức hàm số toán học (phân số, căn thức, luỹ thừa...), không chèn tiệm cận làm rối mắt
  const bannerW = Math.min(width - 20, Math.max(120, formulaW + 24));

  // VỊ TRÍ: NẰM Ở PHÍA DƯỚI ĐỒ THỊ (sát cạnh dưới bottom - bannerH - 2) - Hoàn toàn không che khuất đồ thị!
  const bannerY = bottom - bannerH - 2;
  const bannerX = Math.max(left + 6, Math.min(right - bannerW - 6, cx - bannerW / 2));

  // Khung nền đen mờ sang trọng, viền vàng ánh kim/xanh cyan thanh mảnh
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 8);
  ctx.fill();
  ctx.stroke();

  const startX = bannerX + (bannerW - formulaW) / 2;
  const centerY = bannerY + bannerH / 2;

  // Vẽ tiền tố (y = )
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 13px "Cambria", "Times New Roman", serif';
  ctx.fillText(prefixStr, startX, centerY + 4.5);

  let currentDrawX = startX + wPrefix;

  if (isFrac) {
    // 1. Vẽ gạch ngang phân số chuẩn
    const barStartX = currentDrawX + 2;
    const barEndX = barStartX + wBar;
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(barStartX, centerY);
    ctx.lineTo(barEndX, centerY);
    ctx.stroke();

    // 2. Vẽ tử số (ở trên gạch ngang)
    ctx.font = 'bold 11.5px "Cambria", "Times New Roman", serif';
    ctx.fillStyle = '#fef08a';
    ctx.fillText(numStr, barStartX + (wBar - wNum) / 2, centerY - 4);

    // 3. Vẽ mẫu số (ở dưới gạch ngang)
    ctx.fillText(denStr, barStartX + (wBar - wDen) / 2, centerY + 13.5);
  } else if (isSqrt) {
    // Ký hiệu căn bậc hai √
    ctx.fillStyle = '#facc15';
    ctx.font = '14px "Cambria", "Times New Roman", serif';
    ctx.fillText('√', currentDrawX, centerY + 5);

    // Dấu gạch ngang trên đầu biểu thức căn
    ctx.font = 'bold 12.5px "Cambria", "Times New Roman", serif';
    ctx.fillStyle = '#fef08a';
    const textStartX = currentDrawX + 12;
    ctx.fillText(rootStr, textStartX, centerY + 4.5);

    const wRootText = ctx.measureText(rootStr).width;
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(textStartX - 2, centerY - 8.5);
    ctx.lineTo(textStartX + wRootText + 2, centerY - 8.5);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 12.5px "Cambria", "Times New Roman", serif';
    ctx.fillText(standardStr, currentDrawX, centerY + 4.5);
  }

  ctx.restore();
}

/**
 * Plots a real analytical mathematical function y = f(x) smoothly
 */
function plotAnalyticalFunction(
  ctx: CanvasRenderingContext2D,
  fn: (x: number) => number,
  xMinMath: number,
  xMaxMath: number,
  originX: number,
  originY: number,
  unitPx: number,
  clampTop: number,
  clampBottom: number,
  strokeColor: string,
  strokeWidth: number,
  discontinuities: number[] = [],
  unitPxY?: number
) {
  const uX = unitPx;
  const uY = unitPxY ?? unitPx;

  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(2.2, strokeWidth);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const stepPx = 0.75; // high precision evaluation
  const xMinPx = originX + xMinMath * uX;
  const xMaxPx = originX + xMaxMath * uX;

  ctx.beginPath();
  let isPenDown = false;

  for (let px = xMinPx; px <= xMaxPx; px += stepPx) {
    const xMath = (px - originX) / uX;

    // Check proximity to vertical asymptotes
    let nearDiscontinuity = false;
    for (const d of discontinuities) {
      if (Math.abs(xMath - d) < 0.04) {
        nearDiscontinuity = true;
        break;
      }
    }

    if (nearDiscontinuity) {
      if (isPenDown) {
        ctx.stroke();
        ctx.beginPath();
        isPenDown = false;
      }
      continue;
    }

    const yMath = fn(xMath);
    if (isNaN(yMath) || !isFinite(yMath)) {
      if (isPenDown) {
        ctx.stroke();
        ctx.beginPath();
        isPenDown = false;
      }
      continue;
    }

    const py = originY - yMath * uY;

    // Clamp inside viewport
    if (py < clampTop - 10 || py > clampBottom + 10) {
      if (isPenDown) {
        ctx.lineTo(px, Math.max(clampTop - 10, Math.min(clampBottom + 10, py)));
        ctx.stroke();
        ctx.beginPath();
        isPenDown = false;
      }
      continue;
    }

    if (!isPenDown) {
      ctx.moveTo(px, py);
      isPenDown = true;
    } else {
      ctx.lineTo(px, py);
    }
  }

  if (isPenDown) {
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Main Function Graph Drawer with Textbook Standard Presentation & Real Math Geometry
 */
export function drawFunctionGraph(
  ctx: CanvasRenderingContext2D,
  tool: WhiteboardTool,
  points: StrokePoint[],
  color: string,
  size: number,
  scale: number = 1,
  options?: GraphRenderOptions
) {
  const effectiveScale = options?.scale ?? scale ?? 1;
  const showGrid = options?.showGrid ?? true;
  const showProjections = options?.showProjections ?? true;
  const gOffsetX = options?.graphOffsetX ?? 0;
  const gOffsetY = options?.graphOffsetY ?? 0;
  const gScale = options?.graphScale ?? 1;

  const b = getGraphBounds(points, effectiveScale);
  const { minX, maxX, minY, maxY, width, height, cx, cy } = b;

  // Viewport bounds
  const left = minX + 12;
  const right = maxX - 12;
  const top = minY + 12;
  const bottom = maxY - 12;

  // Mathematical unit scaling (1 unit = unitPx)
  // Yêu cầu người dùng: "và khi tăng kích thước khung chữ nhật thì sẽ thấy thêm được phần đồ thị hàm số"
  // Cố định baseUnitPx = 36px (chuẩn SGK) để khi mở rộng khung chữ nhật, miền giá trị x, y mở rộng ra, hiển thị thêm các phần đồ thị
  const baseUnitPx = 36;
  const unitPx = baseUnitPx * gScale;

  // Apply Panning offset to the coordinate origin
  const graphOriginX = cx + gOffsetX;
  const graphOriginY = cy + gOffsetY;

  ctx.save();
  ctx.beginPath();
  ctx.rect(minX, minY, width, height);
  ctx.clip(); // Clip everything to the bounding box so panned graphs don't bleed out

  switch (tool) {
    case 'func_linear': {
      // 1. Hàm Bậc Nhất: y = 0.5x + 1
      const originX = graphOriginX - width * 0.08;
      const originY = graphOriginY + height * 0.1;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      // Function: y = 0.5x + 1
      const fn = (x: number) => 0.5 * x + 1;
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size
      );

      if (showProjections) {
        // Intercept Oy: (0, 1)
        drawTextbookProjection(ctx, originX, originY, originX, originY - 1 * unitPx, '', '1', '#38bdf8');
        // Intercept Ox: (-2, 0)
        drawTextbookProjection(ctx, originX, originY, originX - 2 * unitPx, originY, '-2', '', '#38bdf8');
        // Extra point: (2, 2)
        drawTextbookProjection(ctx, originX, originY, originX + 2 * unitPx, originY - 2 * unitPx, '2', '2', '#38bdf8');
      }
      break;
    }

    case 'func_quadratic_up': {
      // 2. Parabol a > 0: y = x² - 2x - 1 = (x-1)² - 2
      // Đỉnh I(1, -2). Trục đối xứng x = 1
      const originX = graphOriginX - width * 0.05;
      const originY = graphOriginY - height * 0.05;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      // Trục đối xứng x = 1 (nét đứt)
      const axisX = originX + 1 * unitPx;
      drawAsymptote(ctx, axisX, top + 5, axisX, bottom - 5, 'x = 1', axisX + 4, top + 16, '#38bdf8');

      // Parabola y = (x-1)² - 2
      const fn = (x: number) => (x - 1) * (x - 1) - 2;
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size
      );

      if (showProjections) {
        // Đỉnh I(1, -2)
        const vPx = originX + 1 * unitPx;
        const vPy = originY - -2 * unitPx;
        drawTextbookProjection(ctx, originX, originY, vPx, vPy, '1', '-2', '#38bdf8', '#facc15');

        // Giao Oy: (0, -1)
        drawTextbookProjection(ctx, originX, originY, originX, originY - -1 * unitPx, '', '-1', '#38bdf8', '#38bdf8');
        // Điểm đối xứng (2, -1)
        drawTextbookProjection(ctx, originX, originY, originX + 2 * unitPx, originY - -1 * unitPx, '2', '', '#38bdf8', '#38bdf8');

        // Nhãn đỉnh I
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 12px "Cambria", "Times New Roman", serif';
        ctx.fillText('I', vPx + 6, vPy + 14);
      }
      break;
    }

    case 'func_quadratic_down': {
      // 3. Parabol a < 0: y = -(x-1)² + 2 = -x² + 2x + 1
      // Đỉnh I(1, 2). Trục đối xứng x = 1
      const originX = graphOriginX - width * 0.05;
      const originY = graphOriginY + height * 0.12;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      // Trục đối xứng x = 1 (nét đứt)
      const axisX = originX + 1 * unitPx;
      drawAsymptote(ctx, axisX, top + 5, axisX, bottom - 5, 'x = 1', axisX + 4, top + 16, '#38bdf8');

      // Parabola y = -(x-1)² + 2
      const fn = (x: number) => -(x - 1) * (x - 1) + 2;
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size
      );

      if (showProjections) {
        // Đỉnh I(1, 2)
        const vPx = originX + 1 * unitPx;
        const vPy = originY - 2 * unitPx;
        drawTextbookProjection(ctx, originX, originY, vPx, vPy, '1', '2', '#38bdf8', '#facc15');

        // Giao Oy: (0, 1)
        drawTextbookProjection(ctx, originX, originY, originX, originY - 1 * unitPx, '', '1', '#38bdf8', '#38bdf8');
        // Điểm đối xứng (2, 1)
        drawTextbookProjection(ctx, originX, originY, originX + 2 * unitPx, originY - 1 * unitPx, '2', '', '#38bdf8', '#38bdf8');

        // Nhãn đỉnh I
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 12px "Cambria", "Times New Roman", serif';
        ctx.fillText('I', vPx + 6, vPy - 8);
      }
      break;
    }

    case 'func_cubic_2extrema_pos': {
      // 4. Hàm Bậc 3 a > 0 có 2 cực trị (Đồ thị chữ N chuẩn SGK 12)
      // y = x³ - 3x.
      // Cực đại: A(-1, 2). Cực tiểu: B(1, -2). Điểm uốn: U(0, 0)
      const originX = cx;
      const originY = cy;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      // Function: y = x³ - 3x (dáng chữ N uốn lượn sắc sảo)
      const fn = (x: number) => x * x * x - 3 * x;
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size
      );

      if (showProjections) {
        // Cực đại: (-1, 2)
        const cdX = originX - 1 * unitPx;
        const cdY = originY - 2 * unitPx;
        drawTextbookProjection(ctx, originX, originY, cdX, cdY, '-1', '2', '#38bdf8', '#facc15');

        // Cực tiểu: (1, -2)
        const ctX = originX + 1 * unitPx;
        const ctY = originY - -2 * unitPx;
        drawTextbookProjection(ctx, originX, originY, ctX, ctY, '1', '-2', '#38bdf8', '#facc15');

        // Điểm uốn U(0, 0)
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 11px "Cambria", "Times New Roman", serif';
        ctx.fillText('U', originX + 5, originY - 5);
      }
      break;
    }

    case 'func_cubic_2extrema_neg': {
      // 5. Hàm Bậc 3 a < 0 có 2 cực trị (Đồ thị chữ N ngược)
      // y = -x³ + 3x
      // Cực tiểu: (-1, -2). Cực đại: (1, 2). Điểm uốn: U(0, 0)
      const originX = cx;
      const originY = cy;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      const fn = (x: number) => -x * x * x + 3 * x;
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size
      );

      if (showProjections) {
        // Cực tiểu: (-1, -2)
        const ctX = originX - 1 * unitPx;
        const ctY = originY - -2 * unitPx;
        drawTextbookProjection(ctx, originX, originY, ctX, ctY, '-1', '-2', '#38bdf8', '#facc15');

        // Cực đại: (1, 2)
        const cdX = originX + 1 * unitPx;
        const cdY = originY - 2 * unitPx;
        drawTextbookProjection(ctx, originX, originY, cdX, cdY, '1', '2', '#38bdf8', '#facc15');

        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 11px "Cambria", "Times New Roman", serif';
        ctx.fillText('U', originX - 14, originY - 5);
      }
      break;
    }

    case 'func_cubic_noextrema_pos': {
      // 6. Hàm Bậc 3 a > 0 không có cực trị (Đồng biến trên R)
      // y = 0.5x³ + x. Điểm uốn U(0, 0)
      const originX = cx;
      const originY = cy;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      const fn = (x: number) => 0.4 * x * x * x + 0.8 * x;
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size
      );

      if (showProjections) {
        // Point (1, 1.2)
        const pX = originX + 1 * unitPx;
        const pY = originY - 1.2 * unitPx;
        drawTextbookProjection(ctx, originX, originY, pX, pY, '1', '', '#38bdf8', '#facc15');
      }
      break;
    }

    case 'func_cubic_noextrema_neg': {
      // 7. Hàm Bậc 3 a < 0 không có cực trị (Nghịch biến trên R)
      // y = -0.4x³ - 0.8x
      const originX = cx;
      const originY = cy;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      const fn = (x: number) => -0.4 * x * x * x - 0.8 * x;
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size
      );
      break;
    }

    case 'func_cubic_inflection_pos': {
      // 8. Hàm Bậc 3 có tiếp tuyến ngang tại điểm uốn (y' = 0 tại x = 0)
      // y = 0.3x³
      const originX = cx;
      const originY = cy;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      // Tiếp tuyến ngang tại U(0, 0) (trùng Ox)
      drawAsymptote(ctx, originX - 2 * unitPx, originY, originX + 2 * unitPx, originY, "y' = 0", originX + 1.8 * unitPx, originY - 6, '#38bdf8');

      const fn = (x: number) => 0.35 * x * x * x;
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size
      );
      break;
    }

    case 'func_cubic_inflection_neg': {
      // 9. Hàm Bậc 3 a < 0 có tiếp tuyến ngang tại điểm uốn
      const originX = cx;
      const originY = cy;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      drawAsymptote(ctx, originX - 2 * unitPx, originY, originX + 2 * unitPx, originY, "y' = 0", originX + 1.8 * unitPx, originY - 6, '#38bdf8');

      const fn = (x: number) => -0.35 * x * x * x;
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size
      );
      break;
    }

    case 'func_biquadratic_3extrema_pos': {
      // Hàm trùng phương a > 0, b < 0: y = 0.5x^4 - 2x^2 + 1 (Hình chữ W, 3 cực trị)
      // Cực đại tại (0, 1). 2 Cực tiểu tại (-sqrt(2), -1) và (sqrt(2), -1)
      const originX = graphOriginX;
      const originY = graphOriginY;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      const fn = (x: number) => 0.5 * Math.pow(x, 4) - 2 * x * x + 1;
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size
      );

      if (showProjections) {
        // Cực đại: (0, 1)
        drawTextbookProjection(ctx, originX, originY, originX, originY - 1 * unitPx, '', '1', '#38bdf8', '#facc15');
        // Cực tiểu 1: (-1.414, -1)
        const sqrt2 = Math.SQRT2;
        drawTextbookProjection(ctx, originX, originY, originX - sqrt2 * unitPx, originY - -1 * unitPx, '-√2', '-1', '#38bdf8', '#facc15');
        // Cực tiểu 2: (1.414, -1)
        drawTextbookProjection(ctx, originX, originY, originX + sqrt2 * unitPx, originY - -1 * unitPx, '√2', '', '#38bdf8', '#facc15');

        // Nhãn công thức mẫu
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold italic 11.5px "Cambria", serif';
        ctx.fillText('y = ax⁴ + bx² + c (a>0, b<0)', right - 165, top + 18);
      }
      break;
    }

    case 'func_biquadratic_3extrema_neg': {
      // Hàm trùng phương a < 0, b > 0: y = -0.5x^4 + 2x^2 - 1 (Hình chữ M, 3 cực trị)
      // Cực tiểu tại (0, -1). 2 Cực đại tại (-sqrt(2), 1) và (sqrt(2), 1)
      const originX = graphOriginX;
      const originY = graphOriginY;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      const fn = (x: number) => -0.5 * Math.pow(x, 4) + 2 * x * x - 1;
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size
      );

      if (showProjections) {
        // Cực tiểu: (0, -1)
        drawTextbookProjection(ctx, originX, originY, originX, originY - -1 * unitPx, '', '-1', '#38bdf8', '#facc15');
        // Cực đại 1: (-1.414, 1)
        const sqrt2 = Math.SQRT2;
        drawTextbookProjection(ctx, originX, originY, originX - sqrt2 * unitPx, originY - 1 * unitPx, '-√2', '1', '#38bdf8', '#facc15');
        // Cực đại 2: (1.414, 1)
        drawTextbookProjection(ctx, originX, originY, originX + sqrt2 * unitPx, originY - 1 * unitPx, '√2', '', '#38bdf8', '#facc15');

        // Nhãn công thức mẫu
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold italic 11.5px "Cambria", serif';
        ctx.fillText('y = ax⁴ + bx² + c (a<0, b>0)', right - 165, top + 18);
      }
      break;
    }

    case 'func_biquadratic_1extremum_pos': {
      // Hàm trùng phương a > 0, b >= 0: y = 0.35x^4 + 0.7x^2 + 0.5 (1 cực tiểu duy nhất tại (0, 0.5))
      const originX = graphOriginX;
      const originY = graphOriginY + height * 0.1;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      const fn = (x: number) => 0.35 * Math.pow(x, 4) + 0.7 * x * x + 0.5;
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size
      );

      if (showProjections) {
        // Cực tiểu duy nhất: (0, 0.5)
        drawTextbookProjection(ctx, originX, originY, originX, originY - 0.5 * unitPx, '', 'c', '#38bdf8', '#facc15');
        // Điểm phụ (1, 1.55) & (-1, 1.55)
        drawTextbookProjection(ctx, originX, originY, originX + 1 * unitPx, originY - 1.55 * unitPx, '1', '', '#38bdf8', '#facc15');
        drawTextbookProjection(ctx, originX, originY, originX - 1 * unitPx, originY - 1.55 * unitPx, '-1', '', '#38bdf8', '#facc15');

        ctx.fillStyle = '#facc15';
        ctx.font = 'bold italic 11.5px "Cambria", serif';
        ctx.fillText('y = ax⁴ + bx² + c (a>0, b≥0)', right - 165, top + 18);
      }
      break;
    }

    case 'func_biquadratic_1extremum_neg': {
      // Hàm trùng phương a < 0, b <= 0: y = -0.35x^4 - 0.7x^2 - 0.5 (1 cực đại duy nhất tại (0, -0.5))
      const originX = graphOriginX;
      const originY = graphOriginY - height * 0.1;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      const fn = (x: number) => -0.35 * Math.pow(x, 4) - 0.7 * x * x - 0.5;
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size
      );

      if (showProjections) {
        // Cực đại duy nhất: (0, -0.5)
        drawTextbookProjection(ctx, originX, originY, originX, originY - -0.5 * unitPx, '', 'c', '#38bdf8', '#facc15');
        // Điểm phụ (1, -1.55) & (-1, -1.55)
        drawTextbookProjection(ctx, originX, originY, originX + 1 * unitPx, originY - -1.55 * unitPx, '1', '', '#38bdf8', '#facc15');
        drawTextbookProjection(ctx, originX, originY, originX - 1 * unitPx, originY - -1.55 * unitPx, '-1', '', '#38bdf8', '#facc15');

        ctx.fillStyle = '#facc15';
        ctx.font = 'bold italic 11.5px "Cambria", serif';
        ctx.fillText('y = ax⁴ + bx² + c (a<0, b≤0)', right - 165, top + 18);
      }
      break;
    }

    case 'func_rational_pos': {
      // 10. Hàm Phân Thức Nhất Biến: y = (x - 1)/(x + 1) = 1 - 2/(x + 1)
      // Đồng biến trên từng khoảng (ad - bc = 1 - (-1) = 2 > 0)
      // Tiệm cận đứng: x = -1. Tiệm cận ngang: y = 1. Tâm đối xứng: I(-1, 1)
      // Cân đối tâm đối xứng I(-1, 1) chính giữa khung hình để 2 nhánh đối xứng tuyệt đối
      const originX = graphOriginX + 1 * unitPx;
      const originY = graphOriginY + 1 * unitPx;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      const tcDX = originX - 1 * unitPx; // x = -1
      const tcNY = originY - 1 * unitPx; // y = 1

      // Tiệm cận đứng x = -1
      drawAsymptote(ctx, tcDX, top + 5, tcDX, bottom - 5, 'x = -1', tcDX - 32, top + 18, '#38bdf8');
      // Tiệm cận ngang y = 1
      drawAsymptote(ctx, left + 5, tcNY, right - 5, tcNY, 'y = 1', right - 32, tcNY - 6, '#38bdf8');

      // Hyperbola function
      const fn = (x: number) => (x - 1) / (x + 1);
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size,
        [-1]
      );

      if (showProjections) {
        // Tâm đối xứng I(-1, 1)
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(tcDX, tcNY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 12px "Cambria", "Times New Roman", serif';
        ctx.fillText('I', tcDX - 12, tcNY - 6);

        // Giao Oy: (0, -1)
        drawTextbookProjection(ctx, originX, originY, originX, originY - -1 * unitPx, '', '-1', '#38bdf8', '#38bdf8');
        // Giao Ox: (1, 0)
        drawTextbookProjection(ctx, originX, originY, originX + 1 * unitPx, originY, '1', '', '#38bdf8', '#38bdf8');
      }

      drawStandardMathBanner(ctx, 'y = (x - 1)/(x + 1)', { displayFormula: 'y = (x - 1)/(x + 1)' }, { tcD: { label: 'x = -1' }, tcN: { label: 'y = 1' } }, cx, bottom, width, 'x', 'y', left, right);
      break;
    }

    case 'func_rational_neg': {
      // 11. Hàm Phân Thức Nhất Biến: y = (2x - 1)/(x - 1) = 2 + 1/(x - 1)
      // Nghịch biến trên từng khoảng (ad - bc = -2 - (-1) = -1 < 0)
      // Tiệm cận đứng: x = 1. Tiệm cận ngang: y = 2. Tâm đối xứng: I(1, 2)
      // Cân đối tâm đối xứng I(1, 2) chính giữa khung hình để 2 nhánh nhìn thấy trọn vẹn đối xứng nhau
      const originX = graphOriginX - 1 * unitPx;
      const originY = graphOriginY + 2 * unitPx;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      const tcDX = originX + 1 * unitPx; // x = 1
      const tcNY = originY - 2 * unitPx; // y = 2

      // Tiệm cận đứng x = 1
      drawAsymptote(ctx, tcDX, top + 5, tcDX, bottom - 5, 'x = 1', tcDX + 5, top + 18, '#38bdf8');
      // Tiệm cận ngang y = 2
      drawAsymptote(ctx, left + 5, tcNY, right - 5, tcNY, 'y = 2', right - 32, tcNY - 6, '#38bdf8');

      const fn = (x: number) => (2 * x - 1) / (x - 1);
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size,
        [1]
      );

      if (showProjections) {
        // Tâm đối xứng I(1, 2)
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(tcDX, tcNY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 12px "Cambria", "Times New Roman", serif';
        ctx.fillText('I', tcDX + 6, tcNY - 6);

        // Giao Oy: (0, 1)
        drawTextbookProjection(ctx, originX, originY, originX, originY - 1 * unitPx, '', '1', '#38bdf8', '#38bdf8');
        // Giao Ox: (0.5, 0)
        drawTextbookProjection(ctx, originX, originY, originX + 0.5 * unitPx, originY, '0.5', '', '#38bdf8', '#38bdf8');
      }

      drawStandardMathBanner(ctx, 'y = (2x - 1)/(x - 1)', { displayFormula: 'y = (2x - 1)/(x - 1)' }, { tcD: { label: 'x = 1' }, tcN: { label: 'y = 2' } }, cx, bottom, width, 'x', 'y', left, right);
      break;
    }

    case 'func_rational_pos_right': {
      // 11b. Hàm Nhất Biến Đồng Biến (TCĐ dương x = 1, TCN dương y = 1): y = (x - 2)/(x - 1) = 1 - 1/(x - 1)
      // Tâm đối xứng I(1, 1)
      const originX = graphOriginX - 1 * unitPx;
      const originY = graphOriginY + 1 * unitPx;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      const tcDX = originX + 1 * unitPx; // x = 1
      const tcNY = originY - 1 * unitPx; // y = 1

      drawAsymptote(ctx, tcDX, top + 5, tcDX, bottom - 5, 'x = 1', tcDX + 6, top + 18, '#38bdf8');
      drawAsymptote(ctx, left + 5, tcNY, right - 5, tcNY, 'y = 1', right - 32, tcNY - 6, '#38bdf8');

      const fn = (x: number) => (x - 2) / (x - 1);
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size,
        [1]
      );

      if (showProjections) {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(tcDX, tcNY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 12px "Cambria", "Times New Roman", serif';
        ctx.fillText('I', tcDX + 6, tcNY - 6);

        // Giao Oy: (0, 2)
        drawTextbookProjection(ctx, originX, originY, originX, originY - 2 * unitPx, '', '2', '#38bdf8', '#38bdf8');
        // Giao Ox: (2, 0)
        drawTextbookProjection(ctx, originX, originY, originX + 2 * unitPx, originY, '2', '', '#38bdf8', '#38bdf8');
      }

      drawStandardMathBanner(ctx, 'y = (x - 2)/(x - 1)', { displayFormula: 'y = (x - 2)/(x - 1)' }, { tcD: { label: 'x = 1' }, tcN: { label: 'y = 1' } }, cx, bottom, width, 'x', 'y', left, right);
      break;
    }

    case 'func_rational_neg_left': {
      // 11c. Hàm Nhất Biến Nghịch Biến (TCĐ âm x = -1, TCN âm y = -1): y = (-x + 1)/(x + 1)
      // Tâm đối xứng I(-1, -1)
      const originX = graphOriginX + 1 * unitPx;
      const originY = graphOriginY - 1 * unitPx;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      const tcDX = originX - 1 * unitPx; // x = -1
      const tcNY = originY + 1 * unitPx; // y = -1

      drawAsymptote(ctx, tcDX, top + 5, tcDX, bottom - 5, 'x = -1', tcDX - 34, top + 18, '#38bdf8');
      drawAsymptote(ctx, left + 5, tcNY, right - 5, tcNY, 'y = -1', right - 36, tcNY - 6, '#38bdf8');

      const fn = (x: number) => (-x + 1) / (x + 1);
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size,
        [-1]
      );

      if (showProjections) {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(tcDX, tcNY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 12px "Cambria", "Times New Roman", serif';
        ctx.fillText('I', tcDX - 12, tcNY - 6);

        // Giao Oy: (0, 1)
        drawTextbookProjection(ctx, originX, originY, originX, originY - 1 * unitPx, '', '1', '#38bdf8', '#38bdf8');
        // Giao Ox: (1, 0)
        drawTextbookProjection(ctx, originX, originY, originX + 1 * unitPx, originY, '1', '', '#38bdf8', '#38bdf8');
      }

      drawStandardMathBanner(ctx, 'y = (-x + 1)/(x + 1)', { displayFormula: 'y = (-x + 1)/(x + 1)' }, { tcD: { label: 'x = -1' }, tcN: { label: 'y = -1' } }, cx, bottom, width, 'x', 'y', left, right);
      break;
    }

    case 'func_frac21': {
      // 12. Hàm Bậc 2 trên Bậc 1: y = (x² - x + 1)/(x - 1) = x + 1/(x - 1)
      // Tâm đối xứng I(1, 1)
      const originX = graphOriginX - 1 * unitPx;
      const originY = graphOriginY + 1 * unitPx;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      const tcDX = originX + 1 * unitPx;
      // Tiệm cận đứng x = 1
      drawAsymptote(ctx, tcDX, top + 5, tcDX, bottom - 5, 'x = 1', tcDX + 6, top + 18, '#38bdf8');

      // Tiệm cận xiên y = x
      const x1Math = (left - originX) / unitPx;
      const x2Math = (right - originX) / unitPx;
      drawAsymptote(
        ctx,
        originX + x1Math * unitPx,
        originY - x1Math * unitPx,
        originX + x2Math * unitPx,
        originY - x2Math * unitPx,
        'y = x',
        right - 35,
        originY - x2Math * unitPx + 15,
        '#38bdf8'
      );

      const fn = (x: number) => x + 1 / (x - 1);
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size,
        [1]
      );

      if (showProjections) {
        // Cực tiểu: (2, 3)
        const ctX = originX + 2 * unitPx;
        const ctY = originY - 3 * unitPx;
        drawTextbookProjection(ctx, originX, originY, ctX, ctY, '2', '3', '#38bdf8', '#facc15');

        // Cực đại: (0, -1)
        const cdX = originX;
        const cdY = originY - -1 * unitPx;
        drawTextbookProjection(ctx, originX, originY, cdX, cdY, '', '-1', '#38bdf8', '#facc15');

        // Tâm đối xứng I(1, 1)
        const iX = originX + 1 * unitPx;
        const iY = originY - 1 * unitPx;
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(iX, iY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('I', iX + 6, iY - 4);
      }

      drawStandardMathBanner(ctx, 'y = (x² - x + 1)/(x - 1)', { displayFormula: 'y = (x² - x + 1)/(x - 1)' }, { tcD: { label: 'x = 1' }, tcX: { label: 'y = x' } }, cx, bottom, width, 'x', 'y', left, right);
      break;
    }

    case 'func_frac21_neg_slope': {
      // 12b. Hàm Bậc 2 trên Bậc 1: Có 2 cực trị, Tiệm cận xiên dốc xuống (m < 0)
      // Tâm đối xứng I(1, 0)
      const originX = graphOriginX - 1 * unitPx;
      const originY = graphOriginY;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      const tcDX = originX + 1 * unitPx;
      drawAsymptote(ctx, tcDX, top + 5, tcDX, bottom - 5, 'x = 1', tcDX + 6, top + 18, '#38bdf8');

      // Tiệm cận xiên y = -x + 1
      const x1Math = (left - originX) / unitPx;
      const x2Math = (right - originX) / unitPx;
      drawAsymptote(
        ctx,
        originX + x1Math * unitPx,
        originY - (-x1Math + 1) * unitPx,
        originX + x2Math * unitPx,
        originY - (-x2Math + 1) * unitPx,
        'y = -x + 1',
        right - 55,
        originY - (-x2Math + 1) * unitPx + 15,
        '#38bdf8'
      );

      const fn = (x: number) => -x + 1 - 1 / (x - 1);
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size,
        [1]
      );

      if (showProjections) {
        // Cực tiểu (0, 2)
        const ctX = originX;
        const ctY = originY - 2 * unitPx;
        drawTextbookProjection(ctx, originX, originY, ctX, ctY, '', '2', '#38bdf8', '#facc15');

        // Cực đại (2, -2)
        const cdX = originX + 2 * unitPx;
        const cdY = originY - -2 * unitPx;
        drawTextbookProjection(ctx, originX, originY, cdX, cdY, '2', '-2', '#38bdf8', '#facc15');

        // Tâm đối xứng I(1, 0)
        const iX = originX + 1 * unitPx;
        const iY = originY;
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(iX, iY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('I', iX + 6, iY - 4);
      }

      drawStandardMathBanner(ctx, 'y = (-x² + 2x - 2)/(x - 1)', { displayFormula: 'y = (-x² + 2x - 2)/(x - 1)' }, { tcD: { label: 'x = 1' }, tcX: { label: 'y = -x + 1' } }, cx, bottom, width, 'x', 'y', left, right);
      break;
    }

    case 'func_frac21_noextrema_pos': {
      // 12c. Hàm Bậc 2 trên Bậc 1: Không có cực trị, Luôn đồng biến
      // Tâm đối xứng I(1, 1)
      const originX = graphOriginX - 1 * unitPx;
      const originY = graphOriginY + 1 * unitPx;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      const tcDX = originX + 1 * unitPx;
      drawAsymptote(ctx, tcDX, top + 5, tcDX, bottom - 5, 'x = 1', tcDX + 6, top + 18, '#38bdf8');

      const x1Math = (left - originX) / unitPx;
      const x2Math = (right - originX) / unitPx;
      drawAsymptote(
        ctx,
        originX + x1Math * unitPx,
        originY - x1Math * unitPx,
        originX + x2Math * unitPx,
        originY - x2Math * unitPx,
        'y = x',
        right - 35,
        originY - x2Math * unitPx + 15,
        '#38bdf8'
      );

      const fn = (x: number) => x - 1 / (x - 1);
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size,
        [1]
      );

      if (showProjections) {
        // Giao Oy (0, 1)
        drawTextbookProjection(ctx, originX, originY, originX, originY - 1 * unitPx, '', '1', '#38bdf8', '#38bdf8');

        // Tâm đối xứng I(1, 1)
        const iX = originX + 1 * unitPx;
        const iY = originY - 1 * unitPx;
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(iX, iY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('I', iX + 6, iY - 4);
      }

      drawStandardMathBanner(ctx, 'y = (x² - x - 1)/(x - 1)', { displayFormula: 'y = (x² - x - 1)/(x - 1)' }, { tcD: { label: 'x = 1' }, tcX: { label: 'y = x' } }, cx, bottom, width, 'x', 'y', left, right);
      break;
    }

    case 'func_frac21_noextrema_neg': {
      // 12d. Hàm Bậc 2 trên Bậc 1: Không có cực trị, Luôn nghịch biến
      // Tâm đối xứng I(-1, 1)
      const originX = graphOriginX + 1 * unitPx;
      const originY = graphOriginY + 1 * unitPx;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      const tcDX = originX - 1 * unitPx;
      drawAsymptote(ctx, tcDX, top + 5, tcDX, bottom - 5, 'x = -1', tcDX - 34, top + 18, '#38bdf8');

      const x1Math = (left - originX) / unitPx;
      const x2Math = (right - originX) / unitPx;
      drawAsymptote(
        ctx,
        originX + x1Math * unitPx,
        originY - -x1Math * unitPx,
        originX + x2Math * unitPx,
        originY - -x2Math * unitPx,
        'y = -x',
        right - 40,
        originY - -x2Math * unitPx + 15,
        '#38bdf8'
      );

      const fn = (x: number) => -x + 1 / (x + 1);
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size,
        [-1]
      );

      if (showProjections) {
        // Giao Oy (0, 1)
        drawTextbookProjection(ctx, originX, originY, originX, originY - 1 * unitPx, '', '1', '#38bdf8', '#38bdf8');

        // Tâm đối xứng I(-1, 1)
        const iX = originX - 1 * unitPx;
        const iY = originY - 1 * unitPx;
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(iX, iY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('I', iX - 12, iY - 4);
      }

      drawStandardMathBanner(ctx, 'y = (-x² - x + 1)/(x + 1)', { displayFormula: 'y = (-x² - x + 1)/(x + 1)' }, { tcD: { label: 'x = -1' }, tcX: { label: 'y = -x' } }, cx, bottom, width, 'x', 'y', left, right);
      break;
    }

    case 'func_exp_pos': {
      // 13. Hàm Số Mũ y = a^x (a > 1, ví dụ y = 2^x)
      // Tiệm cận ngang: Ox (y = 0). Điểm đặc biệt: (0, 1) và (1, 2)
      const originX = graphOriginX - width * 0.12;
      const originY = graphOriginY + height * 0.18;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      const fn = (x: number) => Math.pow(2, x);
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size
      );

      if (showProjections) {
        // Điểm (0, 1)
        drawTextbookProjection(ctx, originX, originY, originX, originY - 1 * unitPx, '', '1', '#38bdf8', '#facc15');
        // Điểm (1, 2)
        drawTextbookProjection(ctx, originX, originY, originX + 1 * unitPx, originY - 2 * unitPx, '1', '2', '#38bdf8', '#facc15');
        // Điểm (2, 4)
        if (originY - 4 * unitPx > top) {
          drawTextbookProjection(ctx, originX, originY, originX + 2 * unitPx, originY - 4 * unitPx, '2', '4', '#38bdf8', '#facc15');
        }
      }
      break;
    }

    case 'func_exp_neg': {
      // 14. Hàm Số Mũ y = a^x (0 < a < 1, ví dụ y = (1/2)^x)
      const originX = graphOriginX + width * 0.12;
      const originY = graphOriginY + height * 0.18;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      const fn = (x: number) => Math.pow(0.5, x);
      plotAnalyticalFunction(
        ctx,
        fn,
        (left - originX) / unitPx,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size
      );

      if (showProjections) {
        // Điểm (0, 1)
        drawTextbookProjection(ctx, originX, originY, originX, originY - 1 * unitPx, '', '1', '#38bdf8', '#facc15');
        // Điểm (-1, 2)
        drawTextbookProjection(ctx, originX, originY, originX - 1 * unitPx, originY - 2 * unitPx, '-1', '2', '#38bdf8', '#facc15');
      }
      break;
    }

    case 'func_log_pos': {
      // 15. Hàm Logarit y = log_a(x) (a > 1, ví dụ y = log2(x))
      // Tiệm cận đứng: Oy (x = 0). Điểm đặc biệt: (1, 0) và (2, 1)
      const originX = graphOriginX - width * 0.2;
      const originY = cy;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      const fn = (x: number) => (x > 0 ? Math.log2(x) : -Infinity);
      plotAnalyticalFunction(
        ctx,
        fn,
        0.04,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size
      );

      if (showProjections) {
        // Điểm (1, 0)
        drawTextbookProjection(ctx, originX, originY, originX + 1 * unitPx, originY, '1', '', '#38bdf8', '#facc15');
        // Điểm (2, 1)
        drawTextbookProjection(ctx, originX, originY, originX + 2 * unitPx, originY - 1 * unitPx, '2', '1', '#38bdf8', '#facc15');
        // Điểm (4, 2)
        if (originX + 4 * unitPx < right) {
          drawTextbookProjection(ctx, originX, originY, originX + 4 * unitPx, originY - 2 * unitPx, '4', '2', '#38bdf8', '#facc15');
        }
      }
      break;
    }

    case 'func_log_neg': {
      // 16. Hàm Logarit y = log_a(x) (0 < a < 1, ví dụ y = log_0.5(x) = -log2(x))
      const originX = graphOriginX - width * 0.2;
      const originY = cy;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid);

      const fn = (x: number) => (x > 0 ? -Math.log2(x) : Infinity);
      plotAnalyticalFunction(
        ctx,
        fn,
        0.04,
        (right - originX) / unitPx,
        originX,
        originY,
        unitPx,
        top,
        bottom,
        color,
        size
      );

      if (showProjections) {
        // Điểm (1, 0)
        drawTextbookProjection(ctx, originX, originY, originX + 1 * unitPx, originY, '1', '', '#38bdf8', '#facc15');
        // Điểm (2, -1)
        drawTextbookProjection(ctx, originX, originY, originX + 2 * unitPx, originY - -1 * unitPx, '2', '-1', '#38bdf8', '#facc15');
      }
      break;
    }

    case 'phys_oscillation': {
      // Dao động điều hoà: x = A cos(wt + phi) -> vẽ đồ thị x-t
      const originX = left + width * 0.1;
      const originY = cy;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid, 't', 'x');
      const fn = (t: number) => t >= 0 ? 3 * Math.cos(1.5 * t) : NaN;
      plotAnalyticalFunction(ctx, fn, 0, (right - originX) / unitPx, originX, originY, unitPx, top, bottom, color, size);
      
      if (showProjections) {
        drawTextbookProjection(ctx, originX, originY, originX, originY - 3 * unitPx, '', 'A', '#38bdf8');
        drawTextbookProjection(ctx, originX, originY, originX, originY + 3 * unitPx, '', '-A', '#38bdf8');
        // T = 2pi / 1.5 ~ 4.18
        const T = 2 * Math.PI / 1.5;
        drawTextbookProjection(ctx, originX, originY, originX + T * unitPx, originY, 'T', '', '#38bdf8');
      }
      break;
    }
    case 'phys_projectile': {
      // Ném xiên: Quỹ đạo parabol y = xtan(alpha) - g x^2 / (2v0^2 cos^2 alpha)
      const originX = left + width * 0.1;
      const originY = bottom - height * 0.1;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid, 'x', 'y');
      
      // y = x - 0.2 x^2 (tầm xa x = 5)
      const fn = (x: number) => (x >= 0 && x <= 5) ? x - 0.2 * x * x : NaN;
      plotAnalyticalFunction(ctx, fn, 0, 5, originX, originY, unitPx, top, bottom, color, size);
      
      if (showProjections) {
        drawTextbookProjection(ctx, originX, originY, originX + 2.5 * unitPx, originY - 1.25 * unitPx, 'x_max', 'y_max', '#38bdf8', '#ef4444');
        drawTextbookProjection(ctx, originX, originY, originX + 5 * unitPx, originY, 'L', '', '#38bdf8');
      }
      break;
    }
    case 'phys_wave': {
      // Sóng dừng (Standing Wave)
      const originX = left + width * 0.1;
      const originY = cy;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid, 'x', 'u');
      
      const k = Math.PI / 2; // lambda = 4
      const fn1 = (x: number) => x >= 0 ? 2 * Math.sin(k * x) : NaN;
      const fn2 = (x: number) => x >= 0 ? -2 * Math.sin(k * x) : NaN;
      const fn3 = (x: number) => x >= 0 ? 1.4 * Math.sin(k * x) : NaN;
      const fn4 = (x: number) => x >= 0 ? -1.4 * Math.sin(k * x) : NaN;
      
      plotAnalyticalFunction(ctx, fn1, 0, (right - originX) / unitPx, originX, originY, unitPx, top, bottom, color, size);
      ctx.setLineDash([5, 5]);
      plotAnalyticalFunction(ctx, fn2, 0, (right - originX) / unitPx, originX, originY, unitPx, top, bottom, color, size);
      
      ctx.globalAlpha = 0.3;
      ctx.setLineDash([]);
      plotAnalyticalFunction(ctx, fn3, 0, (right - originX) / unitPx, originX, originY, unitPx, top, bottom, color, size);
      plotAnalyticalFunction(ctx, fn4, 0, (right - originX) / unitPx, originX, originY, unitPx, top, bottom, color, size);
      ctx.globalAlpha = 1;
      
      if (showProjections) {
        drawTextbookProjection(ctx, originX, originY, originX + 2 * unitPx, originY, 'λ/2', '', '#38bdf8', '#ef4444');
      }
      break;
    }

    case 'shape_curved_trapezoid_area': {
      // Diện tích hình thang cong giới hạn bởi y = f(x), Ox, x = a, x = b
      // Có tô sọc chéo hoặc tô màu diện tích chuẩn SGK Giải tích 12
      const originX = left + width * 0.12;
      const originY = bottom - height * 0.18;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid, 'x', 'y');

      const fn = (x: number) => -0.22 * (x - 2.2) * (x - 2.2) + 2.8;
      const a = 0.8;
      const b = 3.6;
      const aPx = originX + a * unitPx;
      const bPx = originX + b * unitPx;
      const faPx = originY - fn(a) * unitPx;
      const fbPx = originY - fn(b) * unitPx;

      // 1. Shaded & Hatched Area
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(aPx, originY);
      ctx.lineTo(aPx, faPx);
      // Sample curve between a and b
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const xVal = a + (i / steps) * (b - a);
        const yVal = fn(xVal);
        ctx.lineTo(originX + xVal * unitPx, originY - yVal * unitPx);
      }
      ctx.lineTo(bPx, fbPx);
      ctx.lineTo(bPx, originY);
      ctx.closePath();

      // Translucent Color Fill
      ctx.fillStyle = options?.fillColor || 'rgba(56, 189, 248, 0.22)';
      ctx.fill();

      // Diagonal Hatch Lines (Tô sọc chéo 45 độ chuẩn SGK)
      ctx.clip();
      ctx.strokeStyle = options?.fillColor ? 'rgba(255, 255, 255, 0.4)' : 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([]);
      const hatchSpacing = 8;
      for (let hx = aPx - height; hx <= bPx + height; hx += hatchSpacing) {
        ctx.beginPath();
        ctx.moveTo(hx, originY + 10);
        ctx.lineTo(hx + height + 20, originY - height - 10);
        ctx.stroke();
      }
      ctx.restore();

      // 2. Plot Curve y = f(x) full width
      plotAnalyticalFunction(ctx, fn, 0.2, (right - originX) / unitPx, originX, originY, unitPx, top, bottom, color, size);

      // 3. Boundary vertical dashed lines x = a and x = b
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.3;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(aPx, originY);
      ctx.lineTo(aPx, faPx);
      ctx.moveTo(bPx, originY);
      ctx.lineTo(bPx, fbPx);
      ctx.stroke();
      ctx.setLineDash([]);

      // Points & Labels a, b
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold italic 13px "Cambria", serif';
      ctx.fillText('a', aPx - 4, originY + 15);
      ctx.fillText('b', bPx - 4, originY + 15);

      // Area label S
      const midXPx = (aPx + bPx) / 2;
      const midYPx = originY - fn((a + b) / 2) * 0.48 * unitPx;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px "Cambria", serif';
      ctx.fillText('S', midXPx - 5, midYPx);

      // Formula note
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold italic 12px "Cambria", serif';
      ctx.fillText('S = ∫[a→b] f(x) dx', right - 140, top + 20);
      ctx.fillText('y = f(x)', originX + 2.2 * unitPx - 15, originY - fn(2.2) * unitPx - 10);
      ctx.restore();
      break;
    }

    case 'shape_solid_revolution_volume': {
      // Thể tích vật thể tròn xoay quanh trục Ox: V = π ∫[a→b] f(x)^2 dx
      const originX = left + width * 0.12;
      const originY = cy;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid, 'x', 'y');

      const fn = (x: number) => 0.8 + 0.45 * Math.sin(0.85 * (x - 0.5));
      const a = 0.8;
      const b = 3.8;
      const aPx = originX + a * unitPx;
      const bPx = originX + b * unitPx;
      const rA = fn(a) * unitPx;
      const rB = fn(b) * unitPx;

      ctx.save();
      // 1. Shaded 3D Body of Revolution
      ctx.beginPath();
      // Top curve
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const xVal = a + (i / steps) * (b - a);
        const yVal = fn(xVal);
        const px = originX + xVal * unitPx;
        const py = originY - yVal * unitPx;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      // Right boundary ellipse arc
      ctx.ellipse(bPx, originY, rB * 0.28, rB, 0, -Math.PI / 2, Math.PI / 2, false);
      // Bottom curve
      for (let i = steps; i >= 0; i--) {
        const xVal = a + (i / steps) * (b - a);
        const yVal = -fn(xVal);
        ctx.lineTo(originX + xVal * unitPx, originY - yVal * unitPx);
      }
      // Left boundary
      ctx.ellipse(aPx, originY, rA * 0.28, rA, 0, Math.PI / 2, -Math.PI / 2, false);
      ctx.closePath();

      // 3D Metallic/Chalk gradient fill
      const grad = ctx.createLinearGradient(aPx, originY - rA, aPx, originY + rA);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
      grad.addColorStop(0.5, 'rgba(250, 204, 21, 0.2)');
      grad.addColorStop(1, 'rgba(14, 165, 233, 0.45)');
      ctx.fillStyle = grad;
      ctx.fill();

      // 2. Profile curves stroke
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.stroke();

      // 3. Representative thin slice dx at x0
      const x0 = 2.3;
      const x0Px = originX + x0 * unitPx;
      const r0 = fn(x0) * unitPx;
      const dxPx = Math.max(6, unitPx * 0.16);

      // Slice disk fill
      ctx.beginPath();
      ctx.ellipse(x0Px + dxPx, originY, r0 * 0.26, r0, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
      ctx.fill();
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Radius line on slice: from (x0, 0) to (x0, r0)
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(x0Px + dxPx, originY);
      ctx.lineTo(x0Px + dxPx, originY - r0);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#facc15';
      ctx.font = 'bold italic 11px "Cambria", serif';
      ctx.fillText('r = f(x)', x0Px + dxPx + 4, originY - r0 * 0.5);
      ctx.fillText('dx', x0Px + 2, originY + r0 + 14);

      // 4. End ellipses
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.3;
      // Ellipse a: rear dashed, front solid
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.ellipse(aPx, originY, rA * 0.28, rA, 0, Math.PI / 2, -Math.PI / 2, false);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.ellipse(aPx, originY, rA * 0.28, rA, 0, -Math.PI / 2, Math.PI / 2, false);
      ctx.stroke();

      // Ellipse b: full solid
      ctx.beginPath();
      ctx.ellipse(bPx, originY, rB * 0.28, rB, 0, 0, Math.PI * 2);
      ctx.stroke();

      // 5. 360-degree rotation arrow on Ox
      const rotXPx = right - 32;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(rotXPx, originY, 13, -Math.PI * 0.75, Math.PI * 0.85);
      ctx.stroke();
      // Arrowhead
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(rotXPx + 9, originY + 14);
      ctx.lineTo(rotXPx + 2, originY + 7);
      ctx.lineTo(rotXPx + 14, originY + 6);
      ctx.closePath();
      ctx.fill();

      // Labels
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('360°', rotXPx - 12, originY - 17);
      ctx.font = 'bold italic 12px "Cambria", serif';
      ctx.fillText('a', aPx - 4, originY + 16);
      ctx.fillText('b', bPx - 4, originY + 16);
      ctx.fillText('V = π ∫[a→b] [f(x)]² dx', right - 165, top + 18);
      ctx.restore();
      break;
    }

    case 'phys_shm_displacement': {
      // Đồ thị Li độ - Thời gian: x(t) = A cos(ωt + φ)
      const baseWidth = 380;
      const baseAvailableW = Math.max(200, baseWidth - 70);
      const A = 4; // Amplitude in cm
      const omega = 2 * Math.PI; // T = 1s
      const T = 1;
      const unitX = (baseAvailableW / (2.0 * T)) * gScale;
      const availH = (height * 0.42) * gScale;
      const unitY = Math.max(10, availH / A);

      const originX = left + Math.max(38, width * 0.09);
      const originY = cy + gOffsetY;
      const tMax = (right - originX) / unitX;

      const customTicksX: Array<{ val: number; label: string }> = [
        { val: 0.5, label: 'T/2' },
        { val: 1.0, label: 'T' },
      ];
      if (tMax >= 1.5) customTicksX.push({ val: 1.5, label: '3T/2' });
      if (tMax >= 2.0) customTicksX.push({ val: 2.0, label: '2T' });
      if (tMax >= 3.0) customTicksX.push({ val: 3.0, label: '3T' });
      if (tMax >= 4.0) customTicksX.push({ val: 4.0, label: '4T' });

      const customTicksY: Array<{ val: number; label: string }> = [
        { val: A, label: '+A' },
        { val: -A, label: '-A' },
      ];

      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitX, color, 0.35, showGrid, 't (s)', 'x (cm)', unitY, customTicksX, customTicksY);

      const fn = (t: number) => (t >= 0 ? A * Math.cos(omega * t) : NaN);
      plotAnalyticalFunction(ctx, fn, 0, tMax, originX, originY, unitX, top, bottom, color, size, [], unitY);

      if (showProjections) {
        drawAsymptote(ctx, originX, originY - A * unitY, right - 8, originY - A * unitY, '', undefined, undefined, 'rgba(56, 189, 248, 0.65)');
        drawAsymptote(ctx, originX, originY + A * unitY, right - 8, originY + A * unitY, '', undefined, undefined, 'rgba(56, 189, 248, 0.65)');
        drawTextbookProjection(ctx, originX, originY, originX + 0.5 * unitX, originY, 'T/2', '', '#38bdf8', '#facc15');
        drawTextbookProjection(ctx, originX, originY, originX + 1.0 * unitX, originY, 'T', '', '#38bdf8', '#facc15');
        if (tMax >= 2.0) {
          drawTextbookProjection(ctx, originX, originY, originX + 2.0 * unitX, originY, '2T', '', '#38bdf8', '#facc15');
        }

        ctx.fillStyle = '#facc15';
        ctx.font = 'bold italic 12px "Cambria", serif';
        ctx.fillText('x = A cos(ωt + φ)', right - 145, top + 18);
      }
      break;
    }

    case 'phys_shm_velocity': {
      // Đồ thị Vận tốc - Thời gian: v(t) = -ωA sin(ωt) = vmax cos(ωt + π/2)
      const baseWidth = 380;
      const baseAvailableW = Math.max(200, baseWidth - 70);
      const vmax = 4;
      const omega = 2 * Math.PI;
      const T = 1;
      const unitX = (baseAvailableW / (2.0 * T)) * gScale;
      const availH = (height * 0.42) * gScale;
      const unitY = Math.max(10, availH / vmax);

      const originX = left + Math.max(38, width * 0.09);
      const originY = cy + gOffsetY;
      const tMax = (right - originX) / unitX;

      const customTicksX: Array<{ val: number; label: string }> = [
        { val: 0.25, label: 'T/4' },
        { val: 0.5, label: 'T/2' },
        { val: 1.0, label: 'T' },
      ];
      if (tMax >= 1.5) customTicksX.push({ val: 1.5, label: '3T/2' });
      if (tMax >= 2.0) customTicksX.push({ val: 2.0, label: '2T' });

      const customTicksY: Array<{ val: number; label: string }> = [
        { val: vmax, label: '+v_max' },
        { val: -vmax, label: '-v_max' },
      ];

      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitX, color, 0.35, showGrid, 't (s)', 'v (cm/s)', unitY, customTicksX, customTicksY);

      const fn = (t: number) => (t >= 0 ? -vmax * Math.sin(omega * t) : NaN);
      plotAnalyticalFunction(ctx, fn, 0, tMax, originX, originY, unitX, top, bottom, color, size, [], unitY);

      if (showProjections) {
        drawAsymptote(ctx, originX, originY - vmax * unitY, right - 8, originY - vmax * unitY, '', undefined, undefined, 'rgba(56, 189, 248, 0.65)');
        drawAsymptote(ctx, originX, originY + vmax * unitY, right - 8, originY + vmax * unitY, '', undefined, undefined, 'rgba(56, 189, 248, 0.65)');
        drawTextbookProjection(ctx, originX, originY, originX + 0.25 * unitX, originY + vmax * unitY, 'T/4', '', '#38bdf8', '#facc15');
        drawTextbookProjection(ctx, originX, originY, originX + 1.0 * unitX, originY, 'T', '', '#38bdf8', '#facc15');

        ctx.fillStyle = '#facc15';
        ctx.font = 'bold italic 11px "Cambria", serif';
        ctx.fillText('v sớm pha π/2 so với li độ x', right - 170, top + 18);
        ctx.fillText('v_max = ωA', right - 170, top + 34);
      }
      break;
    }

    case 'phys_shm_acceleration': {
      // Đồ thị Gia tốc - Thời gian: a(t) = -ω²x = amax cos(ωt + π)
      const baseWidth = 380;
      const baseAvailableW = Math.max(200, baseWidth - 70);
      const amax = 4;
      const omega = 2 * Math.PI;
      const T = 1;
      const unitX = (baseAvailableW / (2.0 * T)) * gScale;
      const availH = (height * 0.42) * gScale;
      const unitY = Math.max(10, availH / amax);

      const originX = left + Math.max(38, width * 0.09);
      const originY = cy + gOffsetY;
      const tMax = (right - originX) / unitX;

      const customTicksX: Array<{ val: number; label: string }> = [
        { val: 0.5, label: 'T/2' },
        { val: 1.0, label: 'T' },
      ];
      if (tMax >= 1.5) customTicksX.push({ val: 1.5, label: '3T/2' });
      if (tMax >= 2.0) customTicksX.push({ val: 2.0, label: '2T' });

      const customTicksY: Array<{ val: number; label: string }> = [
        { val: amax, label: '+a_max' },
        { val: -amax, label: '-a_max' },
      ];

      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitX, color, 0.35, showGrid, 't (s)', 'a (cm/s²)', unitY, customTicksX, customTicksY);

      const fn = (t: number) => (t >= 0 ? -amax * Math.cos(omega * t) : NaN);
      plotAnalyticalFunction(ctx, fn, 0, tMax, originX, originY, unitX, top, bottom, color, size, [], unitY);

      if (showProjections) {
        drawAsymptote(ctx, originX, originY - amax * unitY, right - 8, originY - amax * unitY, '', undefined, undefined, 'rgba(56, 189, 248, 0.65)');
        drawAsymptote(ctx, originX, originY + amax * unitY, right - 8, originY + amax * unitY, '', undefined, undefined, 'rgba(56, 189, 248, 0.65)');
        drawTextbookProjection(ctx, originX, originY, originX + 0.5 * unitX, originY - amax * unitY, 'T/2', '', '#38bdf8', '#facc15');
        drawTextbookProjection(ctx, originX, originY, originX + 1.0 * unitX, originY + amax * unitY, 'T', '', '#38bdf8', '#facc15');

        ctx.fillStyle = '#facc15';
        ctx.font = 'bold italic 11px "Cambria", serif';
        ctx.fillText('a ngược pha với x (a = -ω²x)', right - 170, top + 18);
        ctx.fillText('a_max = ω²A', right - 170, top + 34);
      }
      break;
    }

    case 'phys_shm_energy': {
      // Đồ thị Động năng Wđ & Thế năng Wt & Cơ năng W theo thời gian
      const baseWidth = 380;
      const baseAvailableW = Math.max(200, baseWidth - 70);
      const Wmax = 3.6;
      const omega = 2 * Math.PI;
      const T = 1;
      const unitX = (baseAvailableW / (2.0 * T)) * gScale;
      const availH = (height * 0.42) * gScale;
      const unitY = Math.max(10, availH / Wmax);

      const originX = left + Math.max(38, width * 0.09);
      const originY = bottom - height * 0.16;
      const tMax = (right - originX) / unitX;

      const customTicksX: Array<{ val: number; label: string }> = [
        { val: 0.5, label: 'T/2' },
        { val: 1.0, label: 'T' },
      ];
      if (tMax >= 1.5) customTicksX.push({ val: 1.5, label: '3T/2' });
      if (tMax >= 2.0) customTicksX.push({ val: 2.0, label: '2T' });

      const customTicksY: Array<{ val: number; label: string }> = [
        { val: Wmax, label: 'W' },
      ];

      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitX, color, 0.35, showGrid, 't (s)', 'W (J)', unitY, customTicksX, customTicksY);

      // Wt = Wmax * cos^2(omega * t) (Thế năng)
      const fnWt = (t: number) => (t >= 0 ? Wmax * Math.pow(Math.cos(omega * t), 2) : NaN);
      // Wd = Wmax * sin^2(omega * t) (Động năng)
      const fnWd = (t: number) => (t >= 0 ? Wmax * Math.pow(Math.sin(omega * t), 2) : NaN);

      // Draw Wt (Thế năng - Cyan/Blue)
      plotAnalyticalFunction(ctx, fnWt, 0, tMax, originX, originY, unitX, top, bottom, '#38bdf8', size, [], unitY);

      // Draw Wd (Động năng - Orange/Amber)
      ctx.setLineDash([4, 3]);
      plotAnalyticalFunction(ctx, fnWd, 0, tMax, originX, originY, unitX, top, bottom, '#fb923c', size, [], unitY);
      ctx.setLineDash([]);

      // Draw W = const (Cơ năng - Horizontal line)
      ctx.save();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(originX, originY - Wmax * unitY);
      ctx.lineTo(right, originY - Wmax * unitY);
      ctx.stroke();

      // Projections & Labels
      drawTextbookProjection(ctx, originX, originY, originX, originY - Wmax * unitY, '', 'W', '#facc15', '#facc15');
      drawTextbookProjection(ctx, originX, originY, originX + 0.5 * unitX, originY, 'T/2', '', '#38bdf8', '#38bdf8');
      drawTextbookProjection(ctx, originX, originY, originX + 1.0 * unitX, originY, 'T', '', '#38bdf8', '#38bdf8');

      // Legend
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#facc15';
      ctx.fillText('— W (Cơ năng)', right - 130, top + 16);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('— W_t (Thế năng)', right - 130, top + 32);
      ctx.fillStyle = '#fb923c';
      ctx.fillText('- - W_đ (Động năng)', right - 130, top + 48);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'italic 10px sans-serif';
      ctx.fillText('Chu kỳ biến thiên: T/2', right - 130, top + 64);
      ctx.restore();
      break;
    }

    case 'phys_shm_damped': {
      // Đồ thị Dao động tắt dần: x(t) = A * e^(-gamma * t) * cos(omega * t)
      const baseWidth = 380;
      const baseAvailableW = Math.max(200, baseWidth - 70);
      const A = 3.5;
      const gamma = 0.28;
      const omega = 2 * Math.PI;
      const T = 1;
      const unitX = (baseAvailableW / (2.0 * T)) * gScale;
      const availH = (height * 0.42) * gScale;
      const unitY = Math.max(10, availH / A);

      const originX = left + Math.max(38, width * 0.09);
      const originY = cy + gOffsetY;
      const tMax = (right - originX) / unitX;

      const customTicksX: Array<{ val: number; label: string }> = [
        { val: 0.5, label: 'T/2' },
        { val: 1.0, label: 'T' },
      ];
      if (tMax >= 1.5) customTicksX.push({ val: 1.5, label: '3T/2' });
      if (tMax >= 2.0) customTicksX.push({ val: 2.0, label: '2T' });

      const customTicksY: Array<{ val: number; label: string }> = [
        { val: A, label: '+A' },
        { val: -A, label: '-A' },
      ];

      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitX, color, 0.35, showGrid, 't (s)', 'x (cm)', unitY, customTicksX, customTicksY);

      // Envelopes: +A e^(-gamma t) and -A e^(-gamma t)
      const envTop = (t: number) => (t >= 0 ? A * Math.exp(-gamma * t) : NaN);
      const envBot = (t: number) => (t >= 0 ? -A * Math.exp(-gamma * t) : NaN);
      ctx.save();
      ctx.setLineDash([4, 4]);
      plotAnalyticalFunction(ctx, envTop, 0, tMax, originX, originY, unitX, top, bottom, '#38bdf8', 1.1, [], unitY);
      plotAnalyticalFunction(ctx, envBot, 0, tMax, originX, originY, unitX, top, bottom, '#38bdf8', 1.1, [], unitY);
      ctx.setLineDash([]);
      ctx.restore();

      // Damped wave
      const fn = (t: number) => (t >= 0 ? A * Math.exp(-gamma * t) * Math.cos(omega * t) : NaN);
      plotAnalyticalFunction(ctx, fn, 0, tMax, originX, originY, unitX, top, bottom, color, size, [], unitY);

      if (showProjections) {
        drawTextbookProjection(ctx, originX, originY, originX, originY - A * unitY, '', '+A', '#38bdf8', '#facc15');
        drawTextbookProjection(ctx, originX, originY, originX, originY + A * unitY, '', '-A', '#38bdf8', '#facc15');
        drawTextbookProjection(ctx, originX, originY, originX + 1.0 * unitX, originY, 'T', '', '#38bdf8', '#facc15');

        ctx.fillStyle = '#facc15';
        ctx.font = 'bold italic 11.5px "Cambria", serif';
        ctx.fillText('Dao động tắt dần: x = A·e^(-γt)·cos(ωt)', right - 220, top + 18);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'italic 10.5px "Cambria", serif';
        ctx.fillText('Đường bao: ± A·e^(-γt)', right - 220, top + 34);
      }
      break;
    }

    case 'func_custom_equation': {
      // Đồ thị do giáo viên tự nhập công thức toán học hoặc vật lý
      const eqInput = options?.customEquation?.trim() || 'y = 2x^3-3x+1';
      const parsed = compileMathExpression(eqInput);

      // Phân tích xem có phải hàm tuần hoàn / dao động điều hòa (Vật lý 12 hoặc Toán 12 lượng giác)
      const periodic = analyzePeriodicHarmonicFunction(eqInput, parsed.fn, parsed.variableName);

      if (periodic && periodic.isPeriodic) {
        // === CHUẨN HÓA ĐỒ THỊ DAO ĐỘNG / TUẦN HOÀN GIỐNG HỆT ĐỒ THỊ MẪU SGK ===
        const T = Math.max(0.0001, periodic.T);
        const A = Math.max(0.0001, periodic.amplitude);

        // Kích thước chuẩn khung mặc định ban đầu trên bảng xanh (baseWidth ~ 380px)
        const baseWidth = 380;
        let originX = graphOriginX;
        let originY = cy + gOffsetY;

        // Tự động tính chu kỳ T = 2π / ω và tự động giãn tỷ lệ trục ngang (auto-scale X):
        // Ở kích thước khung mặc định ban đầu, đồ thị CHỈ VẼ ĐÚNG KHOẢNG 1.5 ĐẾN 2 CHU KỲ (chuẩn ~1.85 chu kỳ thoáng đãng, rõ nét)
        let unitX: number;
        if (periodic.isTimeVariable) {
          // Đối với hàm theo biến thời gian t (Vật lý 12):
          // Đặt trục tung ở phía bên trái giống hệt đồ thị mẫu SGK (chỉ vẽ miền t >= 0,
          // phần âm chỉ chừa một đoạn nhỏ làm gốc tọa độ O), KHÔNG vẽ đối xứng cả chục nhánh bên miền âm t < 0.
          originX = left + Math.max(38, Math.min(50, width * 0.1));
          const baseAvailableW = Math.max(200, (baseWidth - 24) - 38); // ~318px cho miền t >= 0 ở khung ban đầu
          const targetPeriodsAtBase = 1.85; // Hiển thị chuẩn ~1.85 chu kỳ (~2 nhánh sóng thoáng đãng)
          const pxPerPeriod = baseAvailableW / targetPeriodsAtBase; // ~172px mỗi chu kỳ sóng
          unitX = (pxPerPeriod / T) * gScale;
        } else {
          // Đối với hàm lượng giác theo biến x (Toán 12):
          // Trục tung đặt ở chính giữa khung, hiển thị chuẩn ~2 chu kỳ (1 chu kỳ bên âm [-T, 0], 1 chu kỳ bên dương [0, T])
          const baseHalfW = Math.max(100, (baseWidth - 24) / 2);
          const pxPerPeriod = baseHalfW / 1.0; // 1 chu kỳ mỗi nửa khung
          unitX = (pxPerPeriod / T) * gScale;
        }

        // Tự động căn chỉnh tỷ lệ trục đứng Oy (auto-scale Y): đỉnh và đáy sóng nằm ở ~75-80% chiều cao khung
        const availH = (height * 0.40) * gScale;
        const unitY = Math.max(0.001, availH / A);

        // CƠ CHẾ MỞ RỘNG NHÁNH KHI KÉO RỘNG KHUNG (DYNAMIC DOMAIN BY WIDTH):
        // Liên kết miền vẽ trục ngang (tMax hoặc xMax) với chiều rộng thực tế (width) của khung đồ thị trên bảng:
        // Ở chiều rộng mặc định (baseWidth), hiển thị chuẩn ~2 chu kỳ. Khi người dùng bấm kéo khung đồ thị rộng ra
        // trên bảng (width tăng lên), unitX được giữ nguyên theo tỷ lệ pxPerPeriod, số chu kỳ/nhánh đồ thị mới
        // tự động vẽ nối dài thêm tương ứng với độ rộng của khung, tuyệt đối không làm méo hay nén dày đặc các đường sóng!
        const xMinMath = periodic.isTimeVariable ? 0 : (left - originX) / unitX;
        const xMaxMath = (right - originX) / unitX;

        // Vạch chia và đường gióng nét đứt chuẩn SGK:
        const customTicksX: Array<{ val: number; label: string }> = [];
        const periodStep = T / 2; // Bước chia chuẩn T/2

        for (let tVal = periodStep; tVal <= xMaxMath + 0.01; tVal += periodStep) {
          const ratio = tVal / T;
          let lbl = '';
          if (Math.abs(ratio - 0.5) < 0.01) lbl = 'T/2';
          else if (Math.abs(ratio - 1) < 0.01) lbl = 'T';
          else if (Math.abs(ratio - 1.5) < 0.01) lbl = '3T/2';
          else if (Math.abs(ratio - 2) < 0.01) lbl = '2T';
          else if (Math.abs(ratio - 2.5) < 0.01) lbl = '5T/2';
          else if (Math.abs(ratio - 3) < 0.01) lbl = '3T';
          else if (Math.abs(ratio - 4) < 0.01) lbl = '4T';
          else lbl = formatPeriodNumber(tVal);

          customTicksX.push({ val: tVal, label: lbl });
        }

        if (!periodic.isTimeVariable) {
          for (let tVal = -periodStep; tVal >= xMinMath - 0.01; tVal -= periodStep) {
            const ratio = tVal / T;
            let lbl = '';
            if (Math.abs(ratio + 0.5) < 0.01) lbl = '-T/2';
            else if (Math.abs(ratio + 1) < 0.01) lbl = '-T';
            else if (Math.abs(ratio + 1.5) < 0.01) lbl = '-3T/2';
            else if (Math.abs(ratio + 2) < 0.01) lbl = '-2T';
            else lbl = formatPeriodNumber(tVal);

            customTicksX.push({ val: tVal, label: lbl });
          }
        }

        const customTicksY: Array<{ val: number; label: string }> = [
          { val: A, label: `+${periodic.displayAStr}` },
          { val: -A, label: `-${periodic.displayAStr}` },
        ];

        const labelVarX = periodic.isTimeVariable ? 't (s)' : 'x';
        const rawFormulaLower = eqInput.toLowerCase().replace(/\s+/g, '');
        const labelVarY = periodic.isTimeVariable
          ? (rawFormulaLower.startsWith('v=') || rawFormulaLower.startsWith('v(') ? 'v (cm/s)' : rawFormulaLower.startsWith('a=') || rawFormulaLower.startsWith('a(') ? 'a (m/s²)' : 'x (cm)')
          : 'y';

        drawTextbookAxes(
          ctx,
          originX,
          originY,
          left,
          right,
          top,
          bottom,
          unitX,
          color,
          0.35,
          showGrid,
          labelVarX,
          labelVarY,
          unitY,
          customTicksX,
          customTicksY
        );

        // Kèm các đường gióng nét đứt tại biên +A, -A, T/2, T:
        if (showProjections) {
          const envStartX = periodic.isTimeVariable ? originX : left + 8;
          drawAsymptote(ctx, envStartX, originY - A * unitY, right - 8, originY - A * unitY, '', undefined, undefined, 'rgba(56, 189, 248, 0.65)');
          drawAsymptote(ctx, envStartX, originY + A * unitY, right - 8, originY + A * unitY, '', undefined, undefined, 'rgba(56, 189, 248, 0.65)');

          // Đường gióng nét đứt tại T/2
          if (T / 2 <= xMaxMath) {
            const pxHalf = originX + (T / 2) * unitX;
            const yHalf = parsed.fn(T / 2);
            const pyHalf = Number.isFinite(yHalf) ? originY - yHalf * unitY : originY;
            drawTextbookProjection(ctx, originX, originY, pxHalf, pyHalf, 'T/2', '', '#38bdf8', '#facc15');
          }
          // Đường gióng nét đứt tại T
          if (T <= xMaxMath) {
            const pxT = originX + T * unitX;
            const yT = parsed.fn(T);
            const pyT = Number.isFinite(yT) ? originY - yT * unitY : originY;
            drawTextbookProjection(ctx, originX, originY, pxT, pyT, 'T', '', '#38bdf8', '#facc15');
          }
          // Đường gióng nét đứt tại 2T khi kéo rộng khung
          if (2 * T <= xMaxMath) {
            const px2T = originX + (2 * T) * unitX;
            const y2T = parsed.fn(2 * T);
            const py2T = Number.isFinite(y2T) ? originY - y2T * unitY : originY;
            drawTextbookProjection(ctx, originX, originY, px2T, py2T, '2T', '', '#38bdf8', '#facc15');
          }
          if (!periodic.isTimeVariable) {
            if (-T / 2 >= xMinMath) {
              const pxNegHalf = originX - (T / 2) * unitX;
              const yNegHalf = parsed.fn(-T / 2);
              const pyNegHalf = Number.isFinite(yNegHalf) ? originY - yNegHalf * unitY : originY;
              drawTextbookProjection(ctx, originX, originY, pxNegHalf, pyNegHalf, '-T/2', '', '#38bdf8', '#facc15');
            }
            if (-T >= xMinMath) {
              const pxNegT = originX - T * unitX;
              const yNegT = parsed.fn(-T);
              const pyNegT = Number.isFinite(yNegT) ? originY - yNegT * unitY : originY;
              drawTextbookProjection(ctx, originX, originY, pxNegT, pyNegT, '-T', '', '#38bdf8', '#facc15');
            }
          }
        }

        // Vẽ đường cong đồ thị dao động mượt mà
        if (!parsed.error) {
          const plotFn = periodic.isTimeVariable
            ? (t: number) => (t >= 0 ? parsed.fn(t) : NaN)
            : parsed.fn;

          plotAnalyticalFunction(
            ctx,
            plotFn,
            xMinMath,
            xMaxMath,
            originX,
            originY,
            unitX,
            top,
            bottom,
            color,
            size,
            [],
            unitY
          );
        }

        drawStandardMathBanner(ctx, eqInput, parsed, null, cx, bottom, width, labelVarX, labelVarY, left, right);
        break;
      }

      // Xử lý đồ thị đại số thông thường (bậc 3, trùng phương, phân thức, căn thức...)
      const asymptotes = detectCustomFunctionAsymptotes(eqInput);

      let originX = graphOriginX;
      let originY = graphOriginY;

      if (asymptotes?.I && Number.isFinite(asymptotes.I.x) && Number.isFinite(asymptotes.I.y)) {
        const targetIX = cx + gOffsetX;
        const targetIY = cy + gOffsetY;
        const maxOffset = Math.min(width, height) * 0.42;
        const offsetX = Math.max(-maxOffset, Math.min(maxOffset, asymptotes.I.x * unitPx));
        const offsetY = Math.max(-maxOffset, Math.min(maxOffset, asymptotes.I.y * unitPx));
        originX = targetIX - offsetX;
        originY = targetIY + offsetY;
      }

      const labelVarX = parsed.variableName === 't' ? 't' : 'x';
      const labelVarY = parsed.variableName === 't' ? 'x(t)' : 'y';
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid, labelVarX, labelVarY);

      if (asymptotes) {
        if (asymptotes.tcD) {
          const tcDX = originX + asymptotes.tcD.x * unitPx;
          drawAsymptote(ctx, tcDX, top + 5, tcDX, bottom - 5, asymptotes.tcD.label, tcDX + 6, top + 18, '#38bdf8');
        }
        if (asymptotes.tcN) {
          const tcNY = originY - asymptotes.tcN.y * unitPx;
          drawAsymptote(ctx, left + 5, tcNY, right - 5, tcNY, asymptotes.tcN.label, right - 46, tcNY - 6, '#38bdf8');
        }
        if (asymptotes.tcX) {
          const x1Math = (left - originX) / unitPx;
          const x2Math = (right - originX) / unitPx;
          const y1Math = asymptotes.tcX.a * x1Math + asymptotes.tcX.b;
          const y2Math = asymptotes.tcX.a * x2Math + asymptotes.tcX.b;
          const x1Px = originX + x1Math * unitPx;
          const y1Px = originY - y1Math * unitPx;
          const x2Px = originX + x2Math * unitPx;
          const y2Px = originY - y2Math * unitPx;
          drawAsymptote(ctx, x1Px, y1Px, x2Px, y2Px, asymptotes.tcX.label, right - 68, y2Px - 8, '#38bdf8');
        }
        if (asymptotes.I) {
          const iX = originX + asymptotes.I.x * unitPx;
          const iY = originY - asymptotes.I.y * unitPx;
          ctx.save();
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(iX, iY, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = 'bold 12px "Cambria", "Times New Roman", serif';
          ctx.fillText('I', iX + 6, iY - 6);
          ctx.restore();
        }
      }

      if (!parsed.error) {
        plotAnalyticalFunction(
          ctx,
          parsed.fn,
          (left - originX) / unitPx,
          (right - originX) / unitPx,
          originX,
          originY,
          unitPx,
          top,
          bottom,
          color,
          size,
          asymptotes?.discontinuities
        );
      }

      // NHÃN TÊN ĐỒ THỊ CHUẨN TOÁN HỌC: Hiển thị ở PHÍA DƯỚI ĐỒ THỊ (dưới cùng, không che khuất đồ thị)
      // với dấu phân số có gạch ngang, dấu căn, số mũ, thông tin tiệm cận
      drawStandardMathBanner(ctx, eqInput, parsed, asymptotes, cx, bottom, width, labelVarX, labelVarY, left, right);
      break;
    }
    default:
      break;
  }

  ctx.restore();
}
