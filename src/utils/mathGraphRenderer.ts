import { WhiteboardTool, StrokePoint } from '../types';

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
    'func_rational_pos',
    'func_rational_neg',
    'func_frac21',
    'func_exp_pos',
    'func_exp_neg',
    'func_log_pos',
    'func_log_neg',
  ].includes(tool);
}

export function getGraphBounds(points: StrokePoint[]): GraphBounds {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  if (!points || points.length === 0) {
    return { minX: 100, maxX: 380, minY: 100, maxY: 340, width: 280, height: 240, cx: 240, cy: 220 };
  }

  points.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  const width = Math.max(140, maxX - minX);
  const height = Math.max(120, maxY - minY);
  const cx = minX + width / 2;
  const cy = minY + height / 2;

  return { minX, maxX: minX + width, minY, maxY: minY + height, width, height, cx, cy };
}

/**
 * Draws coordinate axes Oxy with arrows, unit ticks, and labels
 */
function drawAxes(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  left: number,
  right: number,
  top: number,
  bottom: number,
  color: string,
  gridOpacity: number = 0.4
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.6;
  ctx.setLineDash([]);

  // Minor Grid lines
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = gridOpacity * 0.35;
  ctx.lineWidth = 0.75;
  const step = 28;
  for (let x = originX + step; x < right - 10; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, top + 5);
    ctx.lineTo(x, bottom - 5);
    ctx.stroke();
  }
  for (let x = originX - step; x > left + 10; x -= step) {
    ctx.beginPath();
    ctx.moveTo(x, top + 5);
    ctx.lineTo(x, bottom - 5);
    ctx.stroke();
  }
  for (let y = originY + step; y < bottom - 10; y += step) {
    ctx.beginPath();
    ctx.moveTo(left + 5, y);
    ctx.lineTo(right - 5, y);
    ctx.stroke();
  }
  for (let y = originY - step; y > top + 10; y -= step) {
    ctx.beginPath();
    ctx.moveTo(left + 5, y);
    ctx.lineTo(right - 5, y);
    ctx.stroke();
  }
  ctx.restore();

  // Ox Axis
  ctx.beginPath();
  ctx.moveTo(left, originY);
  ctx.lineTo(right, originY);
  ctx.stroke();

  // Ox Arrow
  const arrowSize = 7;
  ctx.beginPath();
  ctx.moveTo(right, originY);
  ctx.lineTo(right - arrowSize * 1.5, originY - arrowSize * 0.7);
  ctx.lineTo(right - arrowSize * 1.5, originY + arrowSize * 0.7);
  ctx.closePath();
  ctx.fill();

  // Oy Axis
  ctx.beginPath();
  ctx.moveTo(originX, bottom);
  ctx.lineTo(originX, top);
  ctx.stroke();

  // Oy Arrow
  ctx.beginPath();
  ctx.moveTo(originX, top);
  ctx.lineTo(originX - arrowSize * 0.7, top + arrowSize * 1.5);
  ctx.lineTo(originX + arrowSize * 0.7, top + arrowSize * 1.5);
  ctx.closePath();
  ctx.fill();

  // Labels: x, y, O
  ctx.font = 'bold 12px "Be Vietnam Pro", sans-serif';
  ctx.fillText('x', right - 12, originY + 16);
  ctx.fillText('y', originX - 16, top + 12);
  ctx.font = 'italic 11px "Be Vietnam Pro", serif';
  ctx.fillText('O', originX - 13, originY + 14);

  ctx.restore();
}

/**
 * Draws a highlighted special point with label (e.g. Peak I, Inflection U, Intercepts)
 */
function drawKeyPoint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  color: string,
  align: 'top' | 'bottom' | 'left' | 'right' = 'top'
) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 11px "Be Vietnam Pro", sans-serif';
  let tx = x + 5;
  let ty = y - 5;
  if (align === 'bottom') {
    tx = x + 4;
    ty = y + 14;
  } else if (align === 'left') {
    tx = x - 18;
    ty = y + 4;
  } else if (align === 'right') {
    tx = x + 6;
    ty = y + 4;
  }
  ctx.fillText(label, tx, ty);
  ctx.restore();
}

/**
 * Draws formula badge at the corner of graph (Disabled per user request)
 */
function drawFormulaBadge(
  _ctx: CanvasRenderingContext2D,
  _x: number,
  _y: number,
  _formula: string,
  _bgColor: string = 'rgba(15, 23, 42, 0.85)',
  _textColor: string = '#facc15'
) {
  // Title / formula badge removed per user request
}

/**
 * Main function to render all types of mathematical function graphs
 */
export function drawFunctionGraph(
  ctx: CanvasRenderingContext2D,
  tool: WhiteboardTool,
  points: StrokePoint[],
  color: string,
  size: number
) {
  const b = getGraphBounds(points);
  const { minX, maxX, minY, maxY, width, height, cx, cy } = b;

  ctx.save();

  switch (tool) {
    case 'func_linear': {
      // 1. Hàm bậc nhất y = ax + b (Đường thẳng đi qua hệ trục)
      const originX = cx - width * 0.1;
      const originY = cy + height * 0.1;
      drawAxes(ctx, originX, originY, minX + 5, maxX - 5, minY + 5, maxY - 5, color);

      // Line y = 0.6x - 12 (in screen coordinates: y decreases as x increases)
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2.5, size);
      ctx.beginPath();
      const x1 = minX + 15;
      const y1 = originY + height * 0.32;
      const x2 = maxX - 15;
      const y2 = originY - height * 0.42;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Intercepts
      const yIntY = originY - height * 0.18;
      const xIntX = originX + width * 0.22;
      drawKeyPoint(ctx, originX, yIntY, 'b (0, b)', color, 'left');
      drawKeyPoint(ctx, xIntX, originY, '-b/a', color, 'bottom');
      drawFormulaBadge(ctx, minX + 10, minY + 8, 'y = ax + b (a > 0)');
      break;
    }

    case 'func_quadratic_up': {
      // 2. Hàm bậc 2 (Parabol a > 0: Bề lõm quay lên)
      const originX = cx;
      const originY = cy + height * 0.2;
      drawAxes(ctx, originX, originY, minX + 5, maxX - 5, minY + 5, maxY - 5, color);

      const vertexX = originX;
      const vertexY = originY + height * 0.18; // Peak below Ox
      const spreadX = width * 0.4;
      const topY = minY + 15;

      // Axis of symmetry (dashed)
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(vertexX, topY);
      ctx.lineTo(vertexX, maxY - 10);
      ctx.stroke();
      ctx.restore();

      // Parabola Curve
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2.5, size);
      ctx.beginPath();
      ctx.moveTo(vertexX - spreadX, topY);
      ctx.quadraticCurveTo(vertexX, vertexY + 12, vertexX + spreadX, topY);
      ctx.stroke();

      drawKeyPoint(ctx, vertexX, vertexY, 'I (-b/2a; -Δ/4a)', color, 'bottom');
      drawFormulaBadge(ctx, minX + 10, minY + 8, 'y = ax² + bx + c (a > 0)');
      break;
    }

    case 'func_quadratic_down': {
      // 3. Hàm bậc 2 (Parabol a < 0: Bề lõm quay xuống)
      const originX = cx;
      const originY = cy - height * 0.15;
      drawAxes(ctx, originX, originY, minX + 5, maxX - 5, minY + 5, maxY - 5, color);

      const vertexX = originX;
      const vertexY = originY - height * 0.22; // Peak above Ox
      const spreadX = width * 0.4;
      const bottomY = maxY - 15;

      // Axis of symmetry (dashed)
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(vertexX, minY + 10);
      ctx.lineTo(vertexX, bottomY);
      ctx.stroke();
      ctx.restore();

      // Parabola Curve
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2.5, size);
      ctx.beginPath();
      ctx.moveTo(vertexX - spreadX, bottomY);
      ctx.quadraticCurveTo(vertexX, vertexY - 12, vertexX + spreadX, bottomY);
      ctx.stroke();

      drawKeyPoint(ctx, vertexX, vertexY, 'I (-b/2a; -Δ/4a)', color, 'top');
      drawFormulaBadge(ctx, minX + 10, minY + 8, 'y = ax² + bx + c (a < 0)');
      break;
    }

    case 'func_cubic_2extrema_pos': {
      // 4. Hàm bậc 3: a > 0 có 2 cực trị (Đồ thị chữ N)
      const originX = cx;
      const originY = cy;
      drawAxes(ctx, originX, originY, minX + 5, maxX - 5, minY + 5, maxY - 5, color);

      const cdX = originX - width * 0.22;
      const cdY = originY - height * 0.28; // Cực đại
      const ctX = originX + width * 0.22;
      const ctY = originY + height * 0.28; // Cực tiểu
      const uX = originX;
      const uY = originY; // Điểm uốn

      // Cubic curve N-shape
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2.5, size);
      ctx.beginPath();
      ctx.moveTo(minX + 15, maxY - 15);
      ctx.bezierCurveTo(cdX - width * 0.15, cdY - height * 0.05, cdX - width * 0.05, cdY, cdX, cdY);
      ctx.bezierCurveTo(cdX + width * 0.15, cdY, ctX - width * 0.15, ctY, ctX, ctY);
      ctx.bezierCurveTo(ctX + width * 0.05, ctY, ctX + width * 0.15, ctY + height * 0.05, maxX - 15, minY + 15);
      ctx.stroke();

      // Extrema & Inflection points
      drawKeyPoint(ctx, cdX, cdY, 'CĐ', color, 'top');
      drawKeyPoint(ctx, ctX, ctY, 'CT', color, 'bottom');
      drawKeyPoint(ctx, uX, uY, 'U', color, 'right');
      drawFormulaBadge(ctx, minX + 8, minY + 8, 'y = ax³+bx²+cx+d (a>0, 2 Cực Trị)');
      break;
    }

    case 'func_cubic_2extrema_neg': {
      // 5. Hàm bậc 3: a < 0 có 2 cực trị (Đồ thị chữ N ngược)
      const originX = cx;
      const originY = cy;
      drawAxes(ctx, originX, originY, minX + 5, maxX - 5, minY + 5, maxY - 5, color);

      const ctX = originX - width * 0.22;
      const ctY = originY + height * 0.28; // Cực tiểu
      const cdX = originX + width * 0.22;
      const cdY = originY - height * 0.28; // Cực đại

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2.5, size);
      ctx.beginPath();
      ctx.moveTo(minX + 15, minY + 15);
      ctx.bezierCurveTo(ctX - width * 0.15, ctY + height * 0.05, ctX - width * 0.05, ctY, ctX, ctY);
      ctx.bezierCurveTo(ctX + width * 0.15, ctY, cdX - width * 0.15, cdY, cdX, cdY);
      ctx.bezierCurveTo(cdX + width * 0.05, cdY, cdX + width * 0.15, cdY - height * 0.05, maxX - 15, maxY - 15);
      ctx.stroke();

      drawKeyPoint(ctx, ctX, ctY, 'CT', color, 'bottom');
      drawKeyPoint(ctx, cdX, cdY, 'CĐ', color, 'top');
      drawKeyPoint(ctx, originX, originY, 'U', color, 'left');
      drawFormulaBadge(ctx, minX + 8, minY + 8, 'y = ax³+bx²+cx+d (a<0, 2 Cực Trị)');
      break;
    }

    case 'func_cubic_noextrema_pos': {
      // 6. Hàm bậc 3: a > 0 không có cực trị (Đồng biến trên R)
      const originX = cx;
      const originY = cy;
      drawAxes(ctx, originX, originY, minX + 5, maxX - 5, minY + 5, maxY - 5, color);

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2.5, size);
      ctx.beginPath();
      ctx.moveTo(minX + 15, maxY - 15);
      ctx.bezierCurveTo(originX - width * 0.25, originY + height * 0.3, originX - width * 0.1, originY + height * 0.05, originX, originY);
      ctx.bezierCurveTo(originX + width * 0.1, originY - height * 0.05, originX + width * 0.25, originY - height * 0.3, maxX - 15, minY + 15);
      ctx.stroke();

      drawKeyPoint(ctx, originX, originY, 'U (Điểm Uốn)', color, 'right');
      drawFormulaBadge(ctx, minX + 8, minY + 8, 'y = ax³+... (a>0, Đồng Biến)');
      break;
    }

    case 'func_cubic_noextrema_neg': {
      // 7. Hàm bậc 3: a < 0 không có cực trị (Nghịch biến trên R)
      const originX = cx;
      const originY = cy;
      drawAxes(ctx, originX, originY, minX + 5, maxX - 5, minY + 5, maxY - 5, color);

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2.5, size);
      ctx.beginPath();
      ctx.moveTo(minX + 15, minY + 15);
      ctx.bezierCurveTo(originX - width * 0.25, originY - height * 0.3, originX - width * 0.1, originY - height * 0.05, originX, originY);
      ctx.bezierCurveTo(originX + width * 0.1, originY + height * 0.05, originX + width * 0.25, originY + height * 0.3, maxX - 15, maxY - 15);
      ctx.stroke();

      drawKeyPoint(ctx, originX, originY, 'U (Điểm Uốn)', color, 'left');
      drawFormulaBadge(ctx, minX + 8, minY + 8, 'y = ax³+... (a<0, Nghịch Biến)');
      break;
    }

    case 'func_cubic_inflection_pos': {
      // 8. Hàm bậc 3: a > 0 có tiếp tuyến ngang tại điểm uốn (y' = 0 tại 1 điểm)
      const originX = cx;
      const originY = cy;
      drawAxes(ctx, originX, originY, minX + 5, maxX - 5, minY + 5, maxY - 5, color);

      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(originX - width * 0.25, originY);
      ctx.lineTo(originX + width * 0.25, originY);
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2.5, size);
      ctx.beginPath();
      ctx.moveTo(minX + 15, maxY - 15);
      ctx.bezierCurveTo(originX - width * 0.25, originY + height * 0.25, originX - width * 0.15, originY, originX, originY);
      ctx.bezierCurveTo(originX + width * 0.15, originY, originX + width * 0.25, originY - height * 0.25, maxX - 15, minY + 15);
      ctx.stroke();

      drawKeyPoint(ctx, originX, originY, 'U (y\' = 0)', color, 'top');
      drawFormulaBadge(ctx, minX + 8, minY + 8, 'y = a(x-x₀)³+y₀ (Tiếp Tuyến Ngang)');
      break;
    }

    case 'func_cubic_inflection_neg': {
      // 9. Hàm bậc 3: a < 0 có tiếp tuyến ngang tại điểm uốn
      const originX = cx;
      const originY = cy;
      drawAxes(ctx, originX, originY, minX + 5, maxX - 5, minY + 5, maxY - 5, color);

      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(originX - width * 0.25, originY);
      ctx.lineTo(originX + width * 0.25, originY);
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2.5, size);
      ctx.beginPath();
      ctx.moveTo(minX + 15, minY + 15);
      ctx.bezierCurveTo(originX - width * 0.25, originY - height * 0.25, originX - width * 0.15, originY, originX, originY);
      ctx.bezierCurveTo(originX + width * 0.15, originY, originX + width * 0.25, originY + height * 0.25, maxX - 15, maxY - 15);
      ctx.stroke();

      drawKeyPoint(ctx, originX, originY, 'U (y\' = 0)', color, 'bottom');
      drawFormulaBadge(ctx, minX + 8, minY + 8, 'y = a(x-x₀)³+y₀ (a < 0)');
      break;
    }

    case 'func_rational_pos': {
      // 10. Hàm nhất biến: y = (ax+b)/(cx+d), ad - bc > 0 (Đồng biến trên từng khoảng)
      const originX = cx;
      const originY = cy;
      drawAxes(ctx, originX, originY, minX + 5, maxX - 5, minY + 5, maxY - 5, color);

      const asympX = originX - width * 0.08; // Tiệm cận đứng x = x0
      const asympY = originY - height * 0.08; // Tiệm cận ngang y = y0

      // Asymptotes (dashed)
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.3;
      // Vertical asymptote
      ctx.beginPath();
      ctx.moveTo(asympX, minY + 8);
      ctx.lineTo(asympX, maxY - 8);
      ctx.stroke();
      // Horizontal asymptote
      ctx.beginPath();
      ctx.moveTo(minX + 8, asympY);
      ctx.lineTo(maxX - 8, asympY);
      ctx.stroke();
      ctx.restore();

      // Branch 1 (Left branch: from bottom to asympY from below)
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2.5, size);
      ctx.beginPath();
      ctx.moveTo(minX + 15, asympY + 8);
      ctx.bezierCurveTo(asympX - width * 0.25, asympY + 12, asympX - 12, asympY + height * 0.2, asympX - 6, maxY - 15);
      ctx.stroke();

      // Branch 2 (Right branch: from asympY + height to asympY from above)
      ctx.beginPath();
      ctx.moveTo(asympX + 6, minY + 15);
      ctx.bezierCurveTo(asympX + 12, asympY - height * 0.2, asympX + width * 0.25, asympY - 12, maxX - 15, asympY - 8);
      ctx.stroke();

      drawKeyPoint(ctx, asympX, asympY, 'I (Tâm ĐX)', color, 'top');
      drawFormulaBadge(ctx, minX + 8, minY + 8, 'y = (ax+b)/(cx+d) (ad - bc > 0)');
      break;
    }

    case 'func_rational_neg': {
      // 11. Hàm nhất biến: y = (ax+b)/(cx+d), ad - bc < 0 (Nghịch biến trên từng khoảng)
      const originX = cx;
      const originY = cy;
      drawAxes(ctx, originX, originY, minX + 5, maxX - 5, minY + 5, maxY - 5, color);

      const asympX = originX + width * 0.06; // Tiệm cận đứng
      const asympY = originY + height * 0.06; // Tiệm cận ngang

      // Asymptotes (dashed)
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.3;
      // Vertical asymptote
      ctx.beginPath();
      ctx.moveTo(asympX, minY + 8);
      ctx.lineTo(asympX, maxY - 8);
      ctx.stroke();
      // Horizontal asymptote
      ctx.beginPath();
      ctx.moveTo(minX + 8, asympY);
      ctx.lineTo(maxX - 8, asympY);
      ctx.stroke();
      ctx.restore();

      // Branch 1 (Left branch: from top down to horizontal asymptote)
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2.5, size);
      ctx.beginPath();
      ctx.moveTo(minX + 15, asympY - 8);
      ctx.bezierCurveTo(asympX - width * 0.25, asympY - 12, asympX - 12, asympY - height * 0.2, asympX - 6, minY + 15);
      ctx.stroke();

      // Branch 2 (Right branch: from vertical asymptote down to horizontal asymptote)
      ctx.beginPath();
      ctx.moveTo(asympX + 6, maxY - 15);
      ctx.bezierCurveTo(asympX + 12, asympY + height * 0.2, asympX + width * 0.25, asympY + 12, maxX - 15, asympY + 8);
      ctx.stroke();

      drawKeyPoint(ctx, asympX, asympY, 'I (Tâm ĐX)', color, 'bottom');
      drawFormulaBadge(ctx, minX + 8, minY + 8, 'y = (ax+b)/(cx+d) (ad - bc < 0)');
      break;
    }

    case 'func_frac21': {
      // 12. Hàm bậc 2 trên bậc 1: y = (ax² + bx + c) / (dx + e) (Có tiệm cận xiên & đứng)
      const originX = cx;
      const originY = cy;
      drawAxes(ctx, originX, originY, minX + 5, maxX - 5, minY + 5, maxY - 5, color);

      const asympX = originX; // Tiệm cận đứng x = x0

      // Asymptotes (dashed)
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.3;
      // Tiệm cận đứng
      ctx.beginPath();
      ctx.moveTo(asympX, minY + 8);
      ctx.lineTo(asympX, maxY - 8);
      ctx.stroke();
      // Tiệm cận xiên y = x
      ctx.beginPath();
      ctx.moveTo(minX + 15, originY + height * 0.38);
      ctx.lineTo(maxX - 15, originY - height * 0.38);
      ctx.stroke();
      ctx.restore();

      // Upper Branch (Cực tiểu)
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2.5, size);
      ctx.beginPath();
      ctx.moveTo(asympX + 8, minY + 15);
      ctx.quadraticCurveTo(asympX + width * 0.18, originY - height * 0.12, maxX - 15, originY - height * 0.44);
      ctx.stroke();

      // Lower Branch (Cực đại)
      ctx.beginPath();
      ctx.moveTo(asympX - 8, maxY - 15);
      ctx.quadraticCurveTo(asympX - width * 0.18, originY + height * 0.12, minX + 15, originY + height * 0.44);
      ctx.stroke();

      drawKeyPoint(ctx, asympX + width * 0.18, originY - height * 0.12, 'CT', color, 'top');
      drawKeyPoint(ctx, asympX - width * 0.18, originY + height * 0.12, 'CĐ', color, 'bottom');
      drawKeyPoint(ctx, asympX, originY, 'I (Giao 2 TC)', color, 'right');
      drawFormulaBadge(ctx, minX + 8, minY + 8, 'y = (ax²+bx+c)/(dx+e) (Bậc 2 / Bậc 1)');
      break;
    }

    case 'func_exp_pos': {
      // 13. Hàm số mũ y = a^x (a > 1, Đồng biến)
      const originX = cx - width * 0.15;
      const originY = cy + height * 0.18;
      drawAxes(ctx, originX, originY, minX + 5, maxX - 5, minY + 5, maxY - 5, color);

      // Special point (0, 1)
      const unitY = height * 0.22;
      const pt01Y = originY - unitY;

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2.5, size);
      ctx.beginPath();
      ctx.moveTo(minX + 15, originY - 2); // Asymptotic to Ox on the left
      ctx.bezierCurveTo(originX - width * 0.2, originY - 4, originX - 10, pt01Y + 15, originX, pt01Y);
      ctx.bezierCurveTo(originX + width * 0.15, pt01Y - unitY * 0.6, originX + width * 0.32, minY + 20, maxX - 20, minY + 10);
      ctx.stroke();

      drawKeyPoint(ctx, originX, pt01Y, '(0, 1)', color, 'left');
      drawFormulaBadge(ctx, minX + 8, minY + 8, 'y = aˣ (a > 1)');
      break;
    }

    case 'func_exp_neg': {
      // 14. Hàm số mũ y = a^x (0 < a < 1, Nghịch biến)
      const originX = cx + width * 0.15;
      const originY = cy + height * 0.18;
      drawAxes(ctx, originX, originY, minX + 5, maxX - 5, minY + 5, maxY - 5, color);

      const unitY = height * 0.22;
      const pt01Y = originY - unitY;

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2.5, size);
      ctx.beginPath();
      ctx.moveTo(minX + 20, minY + 10);
      ctx.bezierCurveTo(originX - width * 0.32, minY + 20, originX - width * 0.15, pt01Y - unitY * 0.6, originX, pt01Y);
      ctx.bezierCurveTo(originX + 10, pt01Y + 15, originX + width * 0.2, originY - 4, maxX - 15, originY - 2);
      ctx.stroke();

      drawKeyPoint(ctx, originX, pt01Y, '(0, 1)', color, 'right');
      drawFormulaBadge(ctx, minX + 8, minY + 8, 'y = aˣ (0 < a < 1)');
      break;
    }

    case 'func_log_pos': {
      // 15. Hàm logarit y = log_a(x) (a > 1, Đồng biến)
      const originX = cx - width * 0.22;
      const originY = cy;
      drawAxes(ctx, originX, originY, minX + 5, maxX - 5, minY + 5, maxY - 5, color);

      // Special point (1, 0)
      const unitX = width * 0.22;
      const pt10X = originX + unitX;

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2.5, size);
      ctx.beginPath();
      ctx.moveTo(originX + 3, maxY - 15); // Asymptotic to Oy below
      ctx.bezierCurveTo(originX + 6, originY + height * 0.25, originX + unitX * 0.6, originY + 8, pt10X, originY);
      ctx.bezierCurveTo(pt10X + unitX * 0.6, originY - 12, maxX - width * 0.15, minY + 25, maxX - 15, minY + 15);
      ctx.stroke();

      drawKeyPoint(ctx, pt10X, originY, '(1, 0)', color, 'bottom');
      drawFormulaBadge(ctx, minX + 8, minY + 8, 'y = log_a(x) (a > 1)');
      break;
    }

    case 'func_log_neg': {
      // 16. Hàm logarit y = log_a(x) (0 < a < 1, Nghịch biến)
      const originX = cx - width * 0.22;
      const originY = cy;
      drawAxes(ctx, originX, originY, minX + 5, maxX - 5, minY + 5, maxY - 5, color);

      const unitX = width * 0.22;
      const pt10X = originX + unitX;

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2.5, size);
      ctx.beginPath();
      ctx.moveTo(originX + 3, minY + 15); // Asymptotic to Oy above
      ctx.bezierCurveTo(originX + 6, originY - height * 0.25, originX + unitX * 0.6, originY - 8, pt10X, originY);
      ctx.bezierCurveTo(pt10X + unitX * 0.6, originY + 12, maxX - width * 0.15, maxY - 25, maxX - 15, maxY - 15);
      ctx.stroke();

      drawKeyPoint(ctx, pt10X, originY, '(1, 0)', color, 'top');
      drawFormulaBadge(ctx, minX + 8, minY + 8, 'y = log_a(x) (0 < a < 1)');
      break;
    }

    default:
      break;
  }

  ctx.restore();
}
