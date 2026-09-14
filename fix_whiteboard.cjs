const fs = require('fs');
let content = fs.readFileSync('src/components/TouchWhiteboard.tsx', 'utf8');

content = content.replace(
  `const now = Date.now();\n    const dt = Math.max(1, now - lastTimeRef.current);\n    const velocity = dist / dt;\n    lastTimeRef.current = now;\n    lastVelocityRef.current = velocity;\n\n    // Calculate dynamic pressure\n    const dynamicPressure = rawPoint.pressure && rawPoint.pressure > 0.1\n      ? rawPoint.pressure\n      : Math.max(0.35, Math.min(1.1, 1.0 - velocity * 0.08));\n\n    const smoothedPoint: StrokePoint = {\n      x: smoothX,\n      y: smoothY,\n      pressure: dynamicPressure,\n    };\n    lastSmoothedRef.current = smoothedPoint;\n\n    const newPoints = [...currentPointsRef.current, smoothedPoint];\n    currentPointsRef.current = newPoints;\n\n    const canvas = canvasRef.current;\n    if (!canvas) return;\n    const ctx = canvas.getContext('2d');\n    if (!ctx) return;`,
  `const now = Date.now();
    const dt = Math.max(1, now - lastTimeRef.current);
    const velocity = dist / dt;
    lastTimeRef.current = now;
    lastVelocityRef.current = velocity;

    // Calculate dynamic pressure
    const dynamicPressure = rawPoint.pressure && rawPoint.pressure > 0.1
      ? rawPoint.pressure
      : Math.max(0.35, Math.min(1.1, 1.0 - velocity * 0.08));

    const smoothedPoint: StrokePoint = {
      x: smoothX,
      y: smoothY,
      pressure: dynamicPressure,
    };
    lastSmoothedRef.current = smoothedPoint;

    currentPointsRef.current.push(smoothedPoint);
    const newPoints = currentPointsRef.current;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Use requestAnimationFrame for batching rendering
    if (!window.currentRafRef) window.currentRafRef = {};
    if (window.currentRafRef.id) cancelAnimationFrame(window.currentRafRef.id);
    
    window.currentRafRef.id = requestAnimationFrame(() => {`
);

content = content.replace(
  `    } else {\n      // Shapes & Function Graphs: Interactive live dragging preview\n      redrawCanvas(strokes);\n      renderSingleStroke(ctx, activeTool, newPoints, activeColor, strokeSize);\n    }\n  };`,
  `    } else {
      // Shapes & Function Graphs: Interactive live dragging preview
      redrawCanvas(strokes);
      renderSingleStroke(ctx, activeTool, newPoints, activeColor, strokeSize);
    }
    });
  };`
);

fs.writeFileSync('src/components/TouchWhiteboard.tsx', content);
