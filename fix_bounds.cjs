const fs = require('fs');

let code = fs.readFileSync('src/components/TouchWhiteboard.tsx', 'utf8');

// Add getGraphBounds import
if (!code.includes('getGraphBounds')) {
  code = code.replace(
    "import { isFunctionGraphTool, drawFunctionGraph } from '../utils/mathGraphRenderer';",
    "import { isFunctionGraphTool, drawFunctionGraph, getGraphBounds } from '../utils/mathGraphRenderer';"
  );
}

// Modify getStrokeBounds
const oldBoundsStr = `if (!stroke.points || stroke.points.length === 0) return null;`;
const newBoundsStr = `if (isFunctionGraphTool(stroke.tool)) {
      let renderPts = stroke.points;
      if (!stroke.points || stroke.points.length === 1) {
        const p = stroke.points && stroke.points[0] ? stroke.points[0] : { x: 150, y: 150 };
        renderPts = [p, { x: p.x + 300, y: p.y + 240 }];
      }
      const b = getGraphBounds(renderPts, stroke.scale || 1);
      return {
        minX: b.minX,
        maxX: b.maxX,
        minY: b.minY,
        maxY: b.maxY,
        centerX: b.cx,
        centerY: b.cy,
        width: b.width,
        height: b.height,
      };
    }
    
    if (!stroke.points || stroke.points.length === 0) return null;`;

code = code.replace(oldBoundsStr, newBoundsStr);

fs.writeFileSync('src/components/TouchWhiteboard.tsx', code);
console.log("Updated getStrokeBounds");
