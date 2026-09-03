import { StrokePoint, StrokeVertex, WhiteboardTool } from '../types';

/**
 * Computes default geometry vertices from 2 bounding points (p1, p2)
 */
export function computeDefaultVertices(
  tool: WhiteboardTool,
  points: StrokePoint[]
): StrokeVertex[] {
  if (!points || points.length < 2) return [];
  const p1 = points[0];
  const p2 = points[points.length - 1];

  switch (tool) {
    case 'line':
    case 'dashed_line':
      return [
        { name: 'A', x: p1.x, y: p1.y, role: 'endpoint' },
        { name: 'B', x: p2.x, y: p2.y, role: 'endpoint' },
      ];

    case 'arrow':
    case 'dashed_arrow':
      return [
        { name: 'Gốc', x: p1.x, y: p1.y, role: 'endpoint' },
        { name: 'Ngọn', x: p2.x, y: p2.y, role: 'apex' },
      ];

    case 'rectangle':
    case 'rect': {
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      return [
        { name: 'A', x: minX, y: minY, role: 'top' },
        { name: 'B', x: maxX, y: minY, role: 'top' },
        { name: 'C', x: maxX, y: maxY, role: 'base' },
        { name: 'D', x: minX, y: maxY, role: 'base' },
      ];
    }

    case 'cuboid':
    case 'cube': {
      const w = Math.max(40, Math.abs(p2.x - p1.x));
      const h = Math.max(30, Math.abs(p2.y - p1.y));
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y) + h * 0.25;
      const fh = h * 0.75;
      const dx = Math.min(w * 0.35, 65);
      const dy = -Math.min(h * 0.3, 50);

      // Front face: A (bottom-left), B (bottom-right), C (top-right), D (top-left)
      // Rear face: A', B', C', D'
      return [
        { name: 'A', x: x, y: y + fh, role: 'base' },
        { name: 'B', x: x + w, y: y + fh, role: 'base' },
        { name: 'C', x: x + w, y: y, role: 'top' },
        { name: 'D', x: x, y: y, role: 'top' },
        { name: "A'", x: x + dx, y: y + fh + dy, role: 'control' },
        { name: "B'", x: x + w + dx, y: y + fh + dy, role: 'control' },
        { name: "C'", x: x + w + dx, y: y + dy, role: 'control' },
        { name: "D'", x: x + dx, y: y + dy, role: 'control' },
      ];
    }

    case 'pyramid_tri': {
      // 3D Triangular Pyramid S.ABC
      const w = Math.max(50, Math.abs(p2.x - p1.x));
      const h = Math.max(50, Math.abs(p2.y - p1.y));
      const topX = (p1.x + p2.x) / 2;
      const topY = Math.min(p1.y, p2.y);
      const bottomY = Math.max(p1.y, p2.y);

      return [
        { name: 'S', x: topX, y: topY, role: 'apex' },
        { name: 'A', x: topX - w * 0.15, y: bottomY - h * 0.28, role: 'base' },
        { name: 'B', x: topX - w * 0.46, y: bottomY, role: 'base' },
        { name: 'C', x: topX + w * 0.44, y: bottomY - h * 0.06, role: 'base' },
      ];
    }

    case 'pyramid_quad': {
      // 3D Parallelogram Pyramid S.ABCD
      const w = Math.max(60, Math.abs(p2.x - p1.x));
      const h = Math.max(50, Math.abs(p2.y - p1.y));
      const topX = (p1.x + p2.x) / 2 - w * 0.08;
      const topY = Math.min(p1.y, p2.y);
      const bottomY = Math.max(p1.y, p2.y);

      return [
        { name: 'S', x: topX, y: topY, role: 'apex' },
        { name: 'A', x: topX - w * 0.3, y: bottomY - h * 0.28, role: 'base' },
        { name: 'B', x: topX - w * 0.46, y: bottomY, role: 'base' },
        { name: 'C', x: topX + w * 0.24, y: bottomY, role: 'base' },
        { name: 'D', x: topX + w * 0.4, y: bottomY - h * 0.28, role: 'base' },
      ];
    }

    case 'cone': {
      // 3D Cone (Apex S, Base center O, Base right point R)
      const topY = Math.min(p1.y, p2.y);
      const bottomY = Math.max(p1.y, p2.y);
      const cx = (p1.x + p2.x) / 2;
      const rx = Math.max(18, Math.abs(p2.x - p1.x) / 2);
      const ry = Math.max(6, Math.min(rx * 0.35, 45));

      return [
        { name: 'S (Đỉnh)', x: cx, y: topY, role: 'apex' },
        { name: 'O (Tâm đáy)', x: cx, y: bottomY, role: 'base' },
        { name: 'R (Bán kính)', x: cx + rx, y: bottomY, role: 'radius' },
        { name: 'r_y', x: cx, y: bottomY + ry, role: 'control' },
      ];
    }

    case 'cylinder':
    case 'revolution_cylinder': {
      // 3D Cylinder (Top center O', Bottom center O, Radius R)
      const topY = Math.min(p1.y, p2.y);
      const bottomY = Math.max(p1.y, p2.y);
      const cx = (p1.x + p2.x) / 2;
      const rx = Math.max(18, Math.abs(p2.x - p1.x) / 2);
      const ry = Math.max(6, Math.min(rx * 0.32, 42));

      return [
        { name: "O' (Đáy trên)", x: cx, y: topY, role: 'top' },
        { name: 'O (Đáy dưới)', x: cx, y: bottomY, role: 'base' },
        { name: 'R (Bán kính)', x: cx + rx, y: bottomY, role: 'radius' },
        { name: 'r_y', x: cx, y: bottomY + ry, role: 'control' },
      ];
    }

    case 'sphere': {
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const r = Math.max(16, Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)) / 2);
      return [
        { name: 'O (Tâm)', x: cx, y: cy, role: 'base' },
        { name: 'R (Bán kính)', x: cx + r, y: cy, role: 'radius' },
      ];
    }

    case 'circle': {
      const radius = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      return [
        { name: 'O', x: p1.x, y: p1.y, role: 'base' },
        { name: 'R', x: p1.x + radius, y: p1.y, role: 'radius' },
      ];
    }

    case 'ellipse': {
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const rx = Math.max(4, Math.abs(p2.x - p1.x) / 2);
      const ry = Math.max(4, Math.abs(p2.y - p1.y) / 2);
      return [
        { name: 'O', x: cx, y: cy, role: 'base' },
        { name: 'Rx', x: cx + rx, y: cy, role: 'radius' },
        { name: 'Ry', x: cx, y: cy + ry, role: 'radius' },
      ];
    }

    default:
      return [];
  }
}

/**
 * Updates vertex positions while preserving parallel geometric properties & shape integrity
 */
export function updateVertexWithConstraints(
  tool: WhiteboardTool,
  currentVertices: StrokeVertex[],
  draggedIdx: number,
  newX: number,
  newY: number
): StrokeVertex[] {
  if (!currentVertices || currentVertices.length === 0) return currentVertices;
  const verts = currentVertices.map((v) => ({ ...v }));
  const target = verts[draggedIdx];
  if (!target) return currentVertices;

  const dx = newX - target.x;
  const dy = newY - target.y;

  switch (tool) {
    case 'line':
    case 'dashed_line':
    case 'arrow':
    case 'dashed_arrow':
      // Move only the dragged endpoint
      verts[draggedIdx] = { ...target, x: newX, y: newY };
      return verts;

    case 'rectangle':
    case 'rect': {
      // Vertices: A(0), B(1), C(2), D(3)
      // Moving any vertex keeps opposite sides parallel and rectangular
      if (draggedIdx === 0) {
        // A moved
        verts[0].x = newX;
        verts[0].y = newY;
        verts[1].y = newY; // B.y = A.y
        verts[3].x = newX; // D.x = A.x
      } else if (draggedIdx === 1) {
        // B moved
        verts[1].x = newX;
        verts[1].y = newY;
        verts[0].y = newY; // A.y = B.y
        verts[2].x = newX; // C.x = B.x
      } else if (draggedIdx === 2) {
        // C moved
        verts[2].x = newX;
        verts[2].y = newY;
        verts[3].y = newY; // D.y = C.y
        verts[1].x = newX; // B.x = C.x
      } else if (draggedIdx === 3) {
        // D moved
        verts[3].x = newX;
        verts[3].y = newY;
        verts[2].y = newY; // C.y = D.y
        verts[0].x = newX; // A.x = D.x
      }
      return verts;
    }

    case 'cuboid':
    case 'cube': {
      // 8 Vertices:
      // Front: A(0), B(1), C(2), D(3)
      // Rear: A'(4), B'(5), C'(6), D'(7)
      // Parallel constraint:
      // Vector AB = B - A, Vector AD = D - A, Vector AA' = A' - A
      // DC = AB => C = D + (B - A)
      // All rear vertices: X' = X + (A' - A)
      if (draggedIdx === 0) {
        // A moved: translate whole box or front face
        const shiftX = dx;
        const shiftY = dy;
        return verts.map((v) => ({ ...v, x: v.x + shiftX, y: v.y + shiftY }));
      } else if (draggedIdx === 1) {
        // B moved: changes width vector AB
        verts[1].x = newX;
        verts[1].y = newY;
        const vABx = verts[1].x - verts[0].x;
        const vABy = verts[1].y - verts[0].y;
        // C = D + vAB
        verts[2].x = verts[3].x + vABx;
        verts[2].y = verts[3].y + vABy;
        // Rear points update by depth vector AA'
        const vAApx = verts[4].x - verts[0].x;
        const vAApy = verts[4].y - verts[0].y;
        verts[5].x = verts[1].x + vAApx;
        verts[5].y = verts[1].y + vAApy;
        verts[6].x = verts[2].x + vAApx;
        verts[6].y = verts[2].y + vAApy;
      } else if (draggedIdx === 3) {
        // D moved: changes height vector AD
        verts[3].x = newX;
        verts[3].y = newY;
        const vADx = verts[3].x - verts[0].x;
        const vADy = verts[3].y - verts[0].y;
        // C = B + vAD
        verts[2].x = verts[1].x + vADx;
        verts[2].y = verts[1].y + vADy;
        // Rear points update
        const vAApx = verts[4].x - verts[0].x;
        const vAApy = verts[4].y - verts[0].y;
        verts[7].x = verts[3].x + vAApx;
        verts[7].y = verts[3].y + vAApy;
        verts[6].x = verts[2].x + vAApx;
        verts[6].y = verts[2].y + vAApy;
      } else if (draggedIdx === 2) {
        // C moved: stretches both width and height
        verts[2].x = newX;
        verts[2].y = newY;
        verts[1].x = newX; // Keep vertical alignment
        verts[3].y = newY; // Keep horizontal alignment
        const vAApx = verts[4].x - verts[0].x;
        const vAApy = verts[4].y - verts[0].y;
        verts[5].x = verts[1].x + vAApx;
        verts[5].y = verts[1].y + vAApy;
        verts[6].x = verts[2].x + vAApx;
        verts[6].y = verts[2].y + vAApy;
        verts[7].x = verts[3].x + vAApx;
        verts[7].y = verts[3].y + vAApy;
      } else if (draggedIdx >= 4) {
        // Any rear vertex moved: changes depth vector AA' while preserving parallel sides!
        const refIndex = draggedIdx - 4; // Corresponding front vertex (0,1,2,3)
        const frontRef = verts[refIndex];
        const newAApx = newX - frontRef.x;
        const newAApy = newY - frontRef.y;

        // Apply new AA' depth vector to all rear vertices (A', B', C', D')
        verts[4].x = verts[0].x + newAApx;
        verts[4].y = verts[0].y + newAApy;
        verts[5].x = verts[1].x + newAApx;
        verts[5].y = verts[1].y + newAApy;
        verts[6].x = verts[2].x + newAApx;
        verts[6].y = verts[2].y + newAApy;
        verts[7].x = verts[3].x + newAApx;
        verts[7].y = verts[3].y + newAApy;
      }
      return verts;
    }

    case 'pyramid_tri': {
      // S(0), A(1), B(2), C(3)
      if (draggedIdx === 0) {
        // Apex S moves freely (height and tilt)
        verts[0].x = newX;
        verts[0].y = newY;
      } else {
        // Base vertex moves
        verts[draggedIdx].x = newX;
        verts[draggedIdx].y = newY;
      }
      return verts;
    }

    case 'pyramid_quad': {
      // S(0), A(1), B(2), C(3), D(4)
      // Parallelogram base constraint: AB = DC, AD = BC
      // C = B + (D - A)
      if (draggedIdx === 0) {
        // Apex S moves freely
        verts[0].x = newX;
        verts[0].y = newY;
      } else if (draggedIdx === 1) {
        // A moved: shifts entire base
        const shiftX = dx;
        const shiftY = dy;
        for (let i = 1; i <= 4; i++) {
          verts[i].x += shiftX;
          verts[i].y += shiftY;
        }
      } else if (draggedIdx === 2) {
        // B moved: updates C = B + (D - A)
        verts[2].x = newX;
        verts[2].y = newY;
        verts[3].x = verts[2].x + (verts[4].x - verts[1].x);
        verts[3].y = verts[2].y + (verts[4].y - verts[1].y);
      } else if (draggedIdx === 4) {
        // D moved: updates C = D + (B - A)
        verts[4].x = newX;
        verts[4].y = newY;
        verts[3].x = verts[4].x + (verts[2].x - verts[1].x);
        verts[3].y = verts[4].y + (verts[2].y - verts[1].y);
      } else if (draggedIdx === 3) {
        // C moved: adjusts B and D symmetrically
        verts[3].x = newX;
        verts[3].y = newY;
      }
      return verts;
    }

    case 'cone': {
      // S(0), O(1), R(2), r_y(3)
      if (draggedIdx === 0) {
        // S apex moved
        verts[0].x = newX;
        verts[0].y = newY;
      } else if (draggedIdx === 1) {
        // O center moved: shifts base
        const shiftX = dx;
        const shiftY = dy;
        verts[1].x += shiftX;
        verts[1].y += shiftY;
        verts[2].x += shiftX;
        verts[2].y += shiftY;
        verts[3].x += shiftX;
        verts[3].y += shiftY;
      } else if (draggedIdx === 2) {
        // Radius R moved
        const rx = Math.max(12, Math.abs(newX - verts[1].x));
        verts[2].x = verts[1].x + rx;
        verts[2].y = verts[1].y;
      } else if (draggedIdx === 3) {
        // Ry control moved
        const ry = Math.max(4, Math.abs(newY - verts[1].y));
        verts[3].x = verts[1].x;
        verts[3].y = verts[1].y + ry;
      }
      return verts;
    }

    case 'cylinder':
    case 'revolution_cylinder': {
      // O'(0), O(1), R(2), r_y(3)
      if (draggedIdx === 0) {
        // Top center O' moved (changes height and tilt vector OO')
        verts[0].x = newX;
        verts[0].y = newY;
      } else if (draggedIdx === 1) {
        // Bottom center O moved: shifts base
        const shiftX = dx;
        const shiftY = dy;
        verts[1].x += shiftX;
        verts[1].y += shiftY;
        verts[2].x += shiftX;
        verts[2].y += shiftY;
        verts[3].x += shiftX;
        verts[3].y += shiftY;
      } else if (draggedIdx === 2) {
        // Radius R moved: scales radius symmetrically
        const rx = Math.max(12, Math.abs(newX - verts[1].x));
        verts[2].x = verts[1].x + rx;
      } else if (draggedIdx === 3) {
        // Ry control moved
        const ry = Math.max(4, Math.abs(newY - verts[1].y));
        verts[3].y = verts[1].y + ry;
      }
      return verts;
    }

    case 'sphere': {
      // O(0), R(1)
      if (draggedIdx === 0) {
        const shiftX = dx;
        const shiftY = dy;
        verts[0].x += shiftX;
        verts[0].y += shiftY;
        verts[1].x += shiftX;
        verts[1].y += shiftY;
      } else {
        const r = Math.max(12, Math.sqrt(Math.pow(newX - verts[0].x, 2) + Math.pow(newY - verts[0].y, 2)));
        verts[1].x = verts[0].x + r;
        verts[1].y = verts[0].y;
      }
      return verts;
    }

    case 'circle': {
      if (draggedIdx === 0) {
        const shiftX = dx;
        const shiftY = dy;
        verts[0].x += shiftX;
        verts[0].y += shiftY;
        verts[1].x += shiftX;
        verts[1].y += shiftY;
      } else {
        verts[1].x = newX;
        verts[1].y = newY;
      }
      return verts;
    }

    case 'ellipse': {
      if (draggedIdx === 0) {
        const shiftX = dx;
        const shiftY = dy;
        verts[0].x += shiftX;
        verts[0].y += shiftY;
        verts[1].x += shiftX;
        verts[1].y += shiftY;
        verts[2].x += shiftX;
        verts[2].y += shiftY;
      } else if (draggedIdx === 1) {
        const rx = Math.max(6, Math.abs(newX - verts[0].x));
        verts[1].x = verts[0].x + rx;
      } else if (draggedIdx === 2) {
        const ry = Math.max(6, Math.abs(newY - verts[0].y));
        verts[2].y = verts[0].y + ry;
      }
      return verts;
    }

    default:
      verts[draggedIdx] = { ...target, x: newX, y: newY };
      return verts;
  }
}

/**
 * Draws shape using dynamic custom vertices (maintaining strict geometric laws & dashed lines)
 */
export function drawShapeWithVertices(
  ctx: CanvasRenderingContext2D,
  tool: WhiteboardTool,
  vertices: StrokeVertex[],
  color: string,
  size: number
) {
  if (!vertices || vertices.length === 0) return;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 1;

  switch (tool) {
    case 'line':
      if (vertices.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(vertices[0].x, vertices[0].y);
        ctx.lineTo(vertices[1].x, vertices[1].y);
        ctx.stroke();
      }
      break;

    case 'dashed_line':
      if (vertices.length >= 2) {
        ctx.beginPath();
        ctx.setLineDash([12, 8]);
        ctx.moveTo(vertices[0].x, vertices[0].y);
        ctx.lineTo(vertices[1].x, vertices[1].y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      break;

    case 'arrow':
    case 'dashed_arrow':
      if (vertices.length >= 2) {
        const p1 = vertices[0];
        const p2 = vertices[1];
        const headLength = Math.max(14, size * 3.2);
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const angle = Math.atan2(dy, dx);

        ctx.beginPath();
        if (tool === 'dashed_arrow') ctx.setLineDash([10, 6]);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        if (tool === 'dashed_arrow') ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(p2.x - headLength * Math.cos(angle - Math.PI / 6), p2.y - headLength * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(p2.x - headLength * Math.cos(angle + Math.PI / 6), p2.y - headLength * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
      break;

    case 'rectangle':
    case 'rect':
      if (vertices.length >= 4) {
        ctx.beginPath();
        ctx.moveTo(vertices[0].x, vertices[0].y);
        ctx.lineTo(vertices[1].x, vertices[1].y);
        ctx.lineTo(vertices[2].x, vertices[2].y);
        ctx.lineTo(vertices[3].x, vertices[3].y);
        ctx.closePath();
        ctx.stroke();
      }
      break;

    case 'cuboid':
    case 'cube':
      if (vertices.length >= 8) {
        const [A, B, C, D, Ap, Bp, Cp, Dp] = vertices;

        // Front Face: A-B-C-D (solid)
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.lineTo(C.x, C.y);
        ctx.lineTo(D.x, D.y);
        ctx.closePath();
        ctx.stroke();

        // Visible Connecting Edges & Top/Right rear edges (solid)
        ctx.beginPath();
        ctx.moveTo(D.x, D.y); ctx.lineTo(Dp.x, Dp.y);
        ctx.moveTo(C.x, C.y); ctx.lineTo(Cp.x, Cp.y);
        ctx.moveTo(B.x, B.y); ctx.lineTo(Bp.x, Bp.y);
        ctx.moveTo(Dp.x, Dp.y); ctx.lineTo(Cp.x, Cp.y);
        ctx.moveTo(Cp.x, Cp.y); ctx.lineTo(Bp.x, Bp.y);
        ctx.stroke();

        // Hidden Edges: A -> A', A' -> D', A' -> B' (dashed)
        ctx.beginPath();
        ctx.setLineDash([6, 5]);
        ctx.moveTo(A.x, A.y); ctx.lineTo(Ap.x, Ap.y);
        ctx.moveTo(Ap.x, Ap.y); ctx.lineTo(Dp.x, Dp.y);
        ctx.moveTo(Ap.x, Ap.y); ctx.lineTo(Bp.x, Bp.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      break;

    case 'pyramid_tri':
      if (vertices.length >= 4) {
        const [S, A, B, C] = vertices;

        // Visible edges: SB, SC, BC
        ctx.beginPath();
        ctx.moveTo(S.x, S.y); ctx.lineTo(B.x, B.y);
        ctx.moveTo(S.x, S.y); ctx.lineTo(C.x, C.y);
        ctx.moveTo(B.x, B.y); ctx.lineTo(C.x, C.y);
        ctx.stroke();

        // Hidden edges: SA, AB, AC
        ctx.beginPath();
        ctx.setLineDash([6, 5]);
        ctx.moveTo(S.x, S.y); ctx.lineTo(A.x, A.y);
        ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
        ctx.moveTo(A.x, A.y); ctx.lineTo(C.x, C.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      break;

    case 'pyramid_quad':
      if (vertices.length >= 5) {
        const [S, A, B, C, D] = vertices;

        // Visible edges: SB, SC, SD, BC, CD
        ctx.beginPath();
        ctx.moveTo(S.x, S.y); ctx.lineTo(B.x, B.y);
        ctx.moveTo(S.x, S.y); ctx.lineTo(C.x, C.y);
        ctx.moveTo(S.x, S.y); ctx.lineTo(D.x, D.y);
        ctx.moveTo(B.x, B.y); ctx.lineTo(C.x, C.y);
        ctx.moveTo(C.x, C.y); ctx.lineTo(D.x, D.y);
        ctx.stroke();

        // Hidden edges: SA, AB, AD
        ctx.beginPath();
        ctx.setLineDash([6, 5]);
        ctx.moveTo(S.x, S.y); ctx.lineTo(A.x, A.y);
        ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
        ctx.moveTo(A.x, A.y); ctx.lineTo(D.x, D.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      break;

    case 'cone':
      if (vertices.length >= 4) {
        const [S, O, R, Ry] = vertices;
        const rx = Math.max(12, Math.abs(R.x - O.x));
        const ry = Math.max(4, Math.abs(Ry.y - O.y));

        // Side generator lines
        ctx.beginPath();
        ctx.moveTo(S.x, S.y); ctx.lineTo(O.x - rx, O.y);
        ctx.moveTo(S.x, S.y); ctx.lineTo(O.x + rx, O.y);
        ctx.stroke();

        // Front half ellipse (solid)
        ctx.beginPath();
        ctx.ellipse(O.x, O.y, rx, ry, 0, 0, Math.PI);
        ctx.stroke();

        // Back half ellipse + height axis + radius (dashed)
        ctx.beginPath();
        ctx.setLineDash([6, 5]);
        ctx.ellipse(O.x, O.y, rx, ry, 0, Math.PI, 2 * Math.PI);
        ctx.moveTo(S.x, S.y); ctx.lineTo(O.x, O.y); // Height SO
        ctx.moveTo(O.x, O.y); ctx.lineTo(O.x + rx, O.y); // Radius R
        ctx.stroke();
        ctx.setLineDash([]);
      }
      break;

    case 'cylinder':
    case 'revolution_cylinder':
      if (vertices.length >= 4) {
        const [Op, O, R, Ry] = vertices;
        const rx = Math.max(12, Math.abs(R.x - O.x));
        const ry = Math.max(4, Math.abs(Ry.y - O.y));

        // Top full ellipse (solid)
        ctx.beginPath();
        ctx.ellipse(Op.x, Op.y, rx, ry, 0, 0, 2 * Math.PI);
        ctx.stroke();

        // Lateral generator lines (solid)
        ctx.beginPath();
        ctx.moveTo(Op.x - rx, Op.y); ctx.lineTo(O.x - rx, O.y);
        ctx.moveTo(Op.x + rx, Op.y); ctx.lineTo(O.x + rx, O.y);
        ctx.stroke();

        // Bottom front arc (solid)
        ctx.beginPath();
        ctx.ellipse(O.x, O.y, rx, ry, 0, 0, Math.PI);
        ctx.stroke();

        // Bottom back arc + axis OO' + radius (dashed)
        ctx.beginPath();
        ctx.setLineDash([6, 5]);
        ctx.ellipse(O.x, O.y, rx, ry, 0, Math.PI, 2 * Math.PI);
        ctx.moveTo(Op.x, Op.y); ctx.lineTo(O.x, O.y); // Axis OO'
        ctx.moveTo(O.x, O.y); ctx.lineTo(O.x + rx, O.y); // Radius
        ctx.stroke();
        ctx.setLineDash([]);
      }
      break;

    case 'sphere':
      if (vertices.length >= 2) {
        const [O, R] = vertices;
        const r = Math.max(12, Math.abs(R.x - O.x));
        const ry = Math.max(4, r * 0.32);

        // Outer circle (solid)
        ctx.beginPath();
        ctx.arc(O.x, O.y, r, 0, 2 * Math.PI);
        ctx.stroke();

        // Front equator (solid)
        ctx.beginPath();
        ctx.ellipse(O.x, O.y, r, ry, 0, 0, Math.PI);
        ctx.stroke();

        // Back equator + vertical axis (dashed)
        ctx.beginPath();
        ctx.setLineDash([6, 5]);
        ctx.ellipse(O.x, O.y, r, ry, 0, Math.PI, 2 * Math.PI);
        ctx.moveTo(O.x, O.y - r); ctx.lineTo(O.x, O.y + r);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      break;

    case 'circle':
      if (vertices.length >= 2) {
        const [O, R] = vertices;
        if (Number.isFinite(O.x) && Number.isFinite(O.y) && Number.isFinite(R.x) && Number.isFinite(R.y)) {
          const rawDist = Math.hypot(R.x - O.x, R.y - O.y);
          const radius = Math.max(4, Number.isFinite(rawDist) ? rawDist : 20);
          ctx.beginPath();
          ctx.arc(O.x, O.y, radius, 0, 2 * Math.PI);
          ctx.stroke();
        }
      }
      break;

    case 'ellipse':
      if (vertices.length >= 3) {
        const [O, Rx, Ry] = vertices;
        if (Number.isFinite(O.x) && Number.isFinite(O.y)) {
          const diffRx = Number.isFinite(Rx.x) ? Math.abs(Rx.x - O.x) : 30;
          const diffRy = Number.isFinite(Ry.y) ? Math.abs(Ry.y - O.y) : 20;
          const rx = Math.max(4, Number.isFinite(diffRx) && diffRx > 0 ? diffRx : 30);
          const ry = Math.max(4, Number.isFinite(diffRy) && diffRy > 0 ? diffRy : 20);
          ctx.beginPath();
          ctx.ellipse(O.x, O.y, rx, ry, 0, 0, 2 * Math.PI);
          ctx.stroke();
        }
      }
      break;

    default:
      break;
  }
}
