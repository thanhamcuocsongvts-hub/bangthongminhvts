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
  labelYStr: string = 'y'
) {
  ctx.save();

  // 1. Subtle Notebook Grid (Lưới ô ly chuẩn SGK)
  if (showGrid && unitPx >= 16) {
    ctx.save();
    ctx.strokeStyle = axisColor;
    ctx.globalAlpha = Math.min(0.25, gridOpacity * 0.4);
    ctx.lineWidth = 0.6;
    ctx.setLineDash([]);

    // Vertical grid lines
    for (let x = originX + unitPx; x <= right - 4; x += unitPx) {
      ctx.beginPath();
      ctx.moveTo(x, top + 4);
      ctx.lineTo(x, bottom - 4);
      ctx.stroke();
    }
    for (let x = originX - unitPx; x >= left + 4; x -= unitPx) {
      ctx.beginPath();
      ctx.moveTo(x, top + 4);
      ctx.lineTo(x, bottom - 4);
      ctx.stroke();
    }
    // Horizontal grid lines
    for (let y = originY + unitPx; y <= bottom - 4; y += unitPx) {
      ctx.beginPath();
      ctx.moveTo(left + 4, y);
      ctx.lineTo(right - 4, y);
      ctx.stroke();
    }
    for (let y = originY - unitPx; y >= top + 4; y -= unitPx) {
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
  const tickHalf = 3;
  ctx.font = '10.5px "Cambria", "Times New Roman", serif';

  // Ox Ticks
  let countX = 0;
  for (let x = originX + unitPx; x <= right - 16; x += unitPx) {
    countX++;
    ctx.beginPath();
    ctx.moveTo(x, originY - tickHalf);
    ctx.lineTo(x, originY + tickHalf);
    ctx.stroke();
    // Only label selected numbers to avoid clutter
    if (unitPx > 26 || countX % 2 === 0 || countX === 1) {
      ctx.fillText(String(countX), x - 3, originY + 14);
    }
  }
  let countNegX = 0;
  for (let x = originX - unitPx; x >= left + 14; x -= unitPx) {
    countNegX++;
    ctx.beginPath();
    ctx.moveTo(x, originY - tickHalf);
    ctx.lineTo(x, originY + tickHalf);
    ctx.stroke();
    if (unitPx > 26 || countNegX % 2 === 0 || countNegX === 1) {
      ctx.fillText(`-${countNegX}`, x - 7, originY + 14);
    }
  }

  // Oy Ticks
  let countY = 0;
  for (let y = originY - unitPx; y >= top + 16; y -= unitPx) {
    countY++;
    ctx.beginPath();
    ctx.moveTo(originX - tickHalf, y);
    ctx.lineTo(originX + tickHalf, y);
    ctx.stroke();
    if (unitPx > 26 || countY % 2 === 0 || countY === 1) {
      ctx.fillText(String(countY), originX - 14, y + 4);
    }
  }
  let countNegY = 0;
  for (let y = originY + unitPx; y <= bottom - 14; y += unitPx) {
    countNegY++;
    ctx.beginPath();
    ctx.moveTo(originX - tickHalf, y);
    ctx.lineTo(originX + tickHalf, y);
    ctx.stroke();
    if (unitPx > 26 || countNegY % 2 === 0 || countNegY === 1) {
      ctx.fillText(`-${countNegY}`, originX - 17, y + 4);
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
 */
function drawAsymptote(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label?: string,
  labelX?: number,
  labelY?: number,
  color: string = '#38bdf8'
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.25;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  if (label && labelX !== undefined && labelY !== undefined) {
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.font = 'italic 11px "Cambria", "Times New Roman", serif';
    ctx.fillText(label, labelX, labelY);
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
  discontinuities: number[] = []
) {
  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(2.2, strokeWidth);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const stepPx = 0.75; // high precision evaluation
  const xMinPx = originX + xMinMath * unitPx;
  const xMaxPx = originX + xMaxMath * unitPx;

  ctx.beginPath();
  let isPenDown = false;

  for (let px = xMinPx; px <= xMaxPx; px += stepPx) {
    const xMath = (px - originX) / unitPx;

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

    const py = originY - yMath * unitPx;

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
  // Adaptive unit size so graphs look clean across any box size
  const baseUnitPx = Math.max(24, Math.min(65, width / 8.5));
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
      const originX = graphOriginX + width * 0.08;
      const originY = graphOriginY + height * 0.08;
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
      break;
    }

    case 'func_rational_neg': {
      // 11. Hàm Phân Thức Nhất Biến: y = (2x - 1)/(x - 1) = 2 + 1/(x - 1)
      // Nghịch biến trên từng khoảng (ad - bc = -2 - (-1) = -1 < 0)
      // Tiệm cận đứng: x = 1. Tiệm cận ngang: y = 2. Tâm đối xứng: I(1, 2)
      const originX = graphOriginX - width * 0.08;
      const originY = graphOriginY + height * 0.12;
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
      break;
    }

    case 'func_rational_pos_right': {
      // 11b. Hàm Nhất Biến Đồng Biến (TCĐ dương x = 1, TCN dương y = 1): y = (x - 2)/(x - 1) = 1 - 1/(x - 1)
      // ad - bc = -1 - (-2) = 1 > 0 => Đồng biến trên từng khoảng
      // Tiệm cận đứng: x = 1. Tiệm cận ngang: y = 1. Tâm đối xứng I(1, 1)
      const originX = graphOriginX - width * 0.08;
      const originY = graphOriginY + height * 0.08;
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
      break;
    }

    case 'func_rational_neg_left': {
      // 11c. Hàm Nhất Biến Nghịch Biến (TCĐ âm x = -1, TCN âm y = -1): y = (-x - 2)/(x + 1) = -1 - 1/(x + 1)
      // ad - bc = -1 - (-2) = 1 > 0 nhưng c>0, a<0 => y' = 1/(x+1)^2 > 0 hay y = (-x)/(x+1) - 2/(x+1)
      // Dạng nghịch biến: y = (-x + 1)/(x + 1) có ad - bc = -1 - 1 = -2 < 0 => Nghịch biến
      // Tiệm cận đứng: x = -1. Tiệm cận ngang: y = -1. Tâm đối xứng I(-1, -1)
      const originX = graphOriginX + width * 0.12;
      const originY = graphOriginY - height * 0.08;
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
      break;
    }

    case 'func_frac21': {
      // 12. Hàm Bậc 2 trên Bậc 1: y = (x² - x + 1)/(x - 1) = x + 1/(x - 1)
      // Tiệm cận đứng: x = 1
      // Tiệm cận xiên: y = x
      // Cực tiểu: (2, 3). Cực đại: (0, -1). Tâm đối xứng I(1, 1)
      const originX = graphOriginX - width * 0.08;
      const originY = graphOriginY + height * 0.05;
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
      break;
    }

    case 'func_frac21_neg_slope': {
      // 12b. Hàm Bậc 2 trên Bậc 1: Có 2 cực trị, Tiệm cận xiên dốc xuống (m < 0)
      // y = -x + 1 - 1/(x - 1) = (-x² + 2x - 2)/(x - 1)
      // Tiệm cận đứng: x = 1. Tiệm cận xiên: y = -x + 1 (m = -1 < 0)
      // Cực tiểu (nhánh trái): (0, 2). Cực đại (nhánh phải): (2, -2). Tâm đối xứng I(1, 0)
      const originX = graphOriginX - width * 0.08;
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
        originY - (-x2Math + 1) * unitPx - 10,
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
      break;
    }

    case 'func_frac21_noextrema_pos': {
      // 12c. Hàm Bậc 2 trên Bậc 1: Không có cực trị, Luôn đồng biến (m > 0, k < 0)
      // y = x - 1/(x - 1) => y' = 1 + 1/(x-1)² > 0
      // Tiệm cận đứng: x = 1. Tiệm cận xiên: y = x. Tâm đối xứng I(1, 1)
      const originX = graphOriginX - width * 0.08;
      const originY = graphOriginY + height * 0.05;
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
      break;
    }

    case 'func_frac21_noextrema_neg': {
      // 12d. Hàm Bậc 2 trên Bậc 1: Không có cực trị, Luôn nghịch biến (m < 0, k > 0)
      // y = -x + 1/(x + 1) => y' = -1 - 1/(x+1)² < 0
      // Tiệm cận đứng: x = -1. Tiệm cận xiên: y = -x. Tâm đối xứng I(-1, 1)
      const originX = graphOriginX + width * 0.08;
      const originY = graphOriginY + height * 0.05;
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
      const originX = left + width * 0.1;
      const originY = cy;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid, 't (s)', 'x (cm)');

      const A = 2.8; // Amplitude in units
      const omega = 1.4; // rad/s
      const T = (2 * Math.PI) / omega; // Chu kỳ T ~ 4.49
      const fn = (t: number) => (t >= 0 ? A * Math.cos(omega * t) : NaN);

      plotAnalyticalFunction(ctx, fn, 0, (right - originX) / unitPx, originX, originY, unitPx, top, bottom, color, size);

      if (showProjections) {
        // Amplitude +A, -A
        drawTextbookProjection(ctx, originX, originY, originX, originY - A * unitPx, '', '+A', '#38bdf8', '#facc15');
        drawTextbookProjection(ctx, originX, originY, originX, originY + A * unitPx, '', '-A', '#38bdf8', '#facc15');

        // Period points: T/4, T/2, 3T/4, T
        const tHalf = T / 2;
        const tFull = T;
        drawTextbookProjection(ctx, originX, originY, originX + tHalf * unitPx, originY + A * unitPx, 'T/2', '', '#38bdf8', '#facc15');
        drawTextbookProjection(ctx, originX, originY, originX + tFull * unitPx, originY - A * unitPx, 'T', '', '#38bdf8', '#facc15');

        // Formula label
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold italic 12px "Cambria", serif';
        ctx.fillText('x = A cos(ωt + φ)', right - 145, top + 18);
      }
      break;
    }

    case 'phys_shm_velocity': {
      // Đồ thị Vận tốc - Thời gian: v(t) = -ωA sin(ωt) = vmax cos(ωt + π/2)
      const originX = left + width * 0.1;
      const originY = cy;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid, 't (s)', 'v (cm/s)');

      const maxAvailY = Math.max(16, (bottom - originY) * 0.72);
      const vmax = Math.min(2.8, Math.max(1.2, maxAvailY / unitPx));
      const omega = 1.4;
      const T = (2 * Math.PI) / omega;
      const fn = (t: number) => (t >= 0 ? -vmax * Math.sin(omega * t) : NaN);

      plotAnalyticalFunction(ctx, fn, 0, (right - originX) / unitPx, originX, originY, unitPx, top, bottom, color, size);

      if (showProjections) {
        // +vmax, -vmax
        drawTextbookProjection(ctx, originX, originY, originX, originY - vmax * unitPx, '', '+v_max', '#38bdf8', '#facc15');
        drawTextbookProjection(ctx, originX, originY, originX, originY + vmax * unitPx, '', '-v_max', '#38bdf8', '#facc15');

        // T/4, T/2, T
        drawTextbookProjection(ctx, originX, originY, originX + (T / 4) * unitPx, originY + vmax * unitPx, 'T/4', '', '#38bdf8', '#facc15');
        drawTextbookProjection(ctx, originX, originY, originX + T * unitPx, originY, 'T', '', '#38bdf8', '#facc15');

        ctx.fillStyle = '#facc15';
        ctx.font = 'bold italic 11px "Cambria", serif';
        ctx.fillText('v sớm pha π/2 so với li độ x', right - 170, top + 18);
        ctx.fillText('v_max = ωA', right - 170, top + 34);
      }
      break;
    }

    case 'phys_shm_acceleration': {
      // Đồ thị Gia tốc - Thời gian: a(t) = -ω²x = amax cos(ωt + π)
      const originX = left + width * 0.1;
      const originY = cy;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid, 't (s)', 'a (cm/s²)');

      const maxAvailY = Math.max(16, (bottom - originY) * 0.72);
      const amax = Math.min(2.8, Math.max(1.2, maxAvailY / unitPx));
      const omega = 1.4;
      const T = (2 * Math.PI) / omega;
      const fn = (t: number) => (t >= 0 ? -amax * Math.cos(omega * t) : NaN);

      plotAnalyticalFunction(ctx, fn, 0, (right - originX) / unitPx, originX, originY, unitPx, top, bottom, color, size);

      if (showProjections) {
        // +amax, -amax
        drawTextbookProjection(ctx, originX, originY, originX, originY - amax * unitPx, '', '+a_max', '#38bdf8', '#facc15');
        drawTextbookProjection(ctx, originX, originY, originX, originY + amax * unitPx, '', '-a_max', '#38bdf8', '#facc15');

        // T/2, T
        drawTextbookProjection(ctx, originX, originY, originX + (T / 2) * unitPx, originY - amax * unitPx, 'T/2', '', '#38bdf8', '#facc15');
        drawTextbookProjection(ctx, originX, originY, originX + T * unitPx, originY + amax * unitPx, 'T', '', '#38bdf8', '#facc15');

        ctx.fillStyle = '#facc15';
        ctx.font = 'bold italic 11px "Cambria", serif';
        ctx.fillText('a ngược pha với x (a = -ω²x)', right - 170, top + 18);
        ctx.fillText('a_max = ω²A', right - 170, top + 34);
      }
      break;
    }

    case 'phys_shm_energy': {
      // Đồ thị Động năng Wđ & Thế năng Wt & Cơ năng W theo thời gian
      const originX = left + width * 0.1;
      const originY = bottom - height * 0.16;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid, 't (s)', 'W (J)');

      const Wmax = 2.8;
      const omega = 1.4;
      const T = (2 * Math.PI) / omega;

      // Wt = Wmax * cos^2(omega * t) (Thế năng)
      const fnWt = (t: number) => (t >= 0 ? Wmax * Math.pow(Math.cos(omega * t), 2) : NaN);
      // Wd = Wmax * sin^2(omega * t) (Động năng)
      const fnWd = (t: number) => (t >= 0 ? Wmax * Math.pow(Math.sin(omega * t), 2) : NaN);

      // Draw Wt (Thế năng - Cyan/Blue)
      plotAnalyticalFunction(ctx, fnWt, 0, (right - originX) / unitPx, originX, originY, unitPx, top, bottom, '#38bdf8', size);

      // Draw Wd (Động năng - Orange/Amber)
      ctx.setLineDash([4, 3]);
      plotAnalyticalFunction(ctx, fnWd, 0, (right - originX) / unitPx, originX, originY, unitPx, top, bottom, '#fb923c', size);
      ctx.setLineDash([]);

      // Draw W = const (Cơ năng - Horizontal line)
      ctx.save();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(originX, originY - Wmax * unitPx);
      ctx.lineTo(right, originY - Wmax * unitPx);
      ctx.stroke();

      // Projections & Labels
      drawTextbookProjection(ctx, originX, originY, originX, originY - Wmax * unitPx, '', 'W', '#facc15', '#facc15');
      drawTextbookProjection(ctx, originX, originY, originX + (T / 2) * unitPx, originY, 'T/2', '', '#38bdf8', '#38bdf8');
      drawTextbookProjection(ctx, originX, originY, originX + T * unitPx, originY, 'T', '', '#38bdf8', '#38bdf8');

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
      const originX = left + width * 0.1;
      const originY = cy;
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid, 't (s)', 'x (cm)');

      const A = 2.8;
      const gamma = 0.28;
      const omega = 2.2;

      // Envelopes: +A e^(-gamma t) and -A e^(-gamma t)
      const envTop = (t: number) => (t >= 0 ? A * Math.exp(-gamma * t) : NaN);
      const envBot = (t: number) => (t >= 0 ? -A * Math.exp(-gamma * t) : NaN);
      ctx.save();
      ctx.setLineDash([4, 4]);
      plotAnalyticalFunction(ctx, envTop, 0, (right - originX) / unitPx, originX, originY, unitPx, top, bottom, '#38bdf8', 1.1);
      plotAnalyticalFunction(ctx, envBot, 0, (right - originX) / unitPx, originX, originY, unitPx, top, bottom, '#38bdf8', 1.1);
      ctx.setLineDash([]);
      ctx.restore();

      // Damped wave
      const fn = (t: number) => (t >= 0 ? A * Math.exp(-gamma * t) * Math.cos(omega * t) : NaN);
      plotAnalyticalFunction(ctx, fn, 0, (right - originX) / unitPx, originX, originY, unitPx, top, bottom, color, size);

      if (showProjections) {
        drawTextbookProjection(ctx, originX, originY, originX, originY - A * unitPx, '', '+A', '#38bdf8', '#facc15');
        drawTextbookProjection(ctx, originX, originY, originX, originY + A * unitPx, '', '-A', '#38bdf8', '#facc15');

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
      const originX = graphOriginX;
      const originY = graphOriginY;
      const eqInput = options?.customEquation?.trim() || 'y = 2*x^3 - 3*x + 1';
      const parsed = compileMathExpression(eqInput);

      const labelVarX = parsed.variableName === 't' ? 't' : 'x';
      const labelVarY = parsed.variableName === 't' ? 'x(t)' : 'y';
      drawTextbookAxes(ctx, originX, originY, left, right, top, bottom, unitPx, color, 0.4, showGrid, labelVarX, labelVarY);

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
          size
        );
      }

      // Equation banner at top
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = parsed.error ? '#f43f5e' : '#38bdf8';
      ctx.lineWidth = 1.2;
      const bannerW = Math.min(320, width - 24);
      ctx.beginPath();
      ctx.roundRect(left + 8, top + 8, bannerW, 30, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = parsed.error ? '#f87171' : '#facc15';
      ctx.font = 'bold 12.5px "Cambria", "Times New Roman", serif';
      const displayTxt = parsed.error
        ? `⚠️ ${parsed.error}`
        : (parsed.displayFormula || `f(${labelVarX}) = ${eqInput}`);
      ctx.fillText(displayTxt.length > 40 ? displayTxt.substring(0, 38) + '...' : displayTxt, left + 16, top + 27);
      ctx.restore();
      break;
    }
    default:
      break;
  }

  ctx.restore();
}
