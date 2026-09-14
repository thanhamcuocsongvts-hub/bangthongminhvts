const fs = require('fs');
let content = fs.readFileSync('src/components/TouchWhiteboard.tsx', 'utf8');

// 1. Add currentPointsRef initialization right after currentPoints useState (or replace it)
content = content.replace(
  `const [currentPoints, setCurrentPoints] = useState<StrokePoint[]>([]);`,
  `const currentPointsRef = useRef<StrokePoint[]>([]);`
);

// 2. Replace uses of currentPoints with currentPointsRef.current in handlePointerMove
content = content.replace(
  `const lastSmoothed = lastSmoothedRef.current || currentPoints[currentPoints.length - 1];`,
  `const lastSmoothed = lastSmoothedRef.current || currentPointsRef.current[currentPointsRef.current.length - 1];`
);

content = content.replace(
  `const newPoints = [...currentPoints, smoothedPoint];\n    setCurrentPoints(newPoints);`,
  `const newPoints = [...currentPointsRef.current, smoothedPoint];\n    currentPointsRef.current = newPoints;`
);

// 3. Replace handlePointerDown
content = content.replace(
  `setIsDrawing(true);\n    setCurrentPoints([point]);`,
  `setIsDrawing(true);\n    currentPointsRef.current = [point];`
);

// 4. Replace handlePointerUp
content = content.replace(
  `if (!isDrawing || currentPoints.length === 0)`,
  `if (!isDrawing || currentPointsRef.current.length === 0)`
);

content = content.replace(
  `points: currentPoints,`,
  `points: currentPointsRef.current,`
);

content = content.replace(
  `setIsDrawing(false);\n    setCurrentPoints([]);`,
  `setIsDrawing(false);\n    currentPointsRef.current = [];`
);

fs.writeFileSync('src/components/TouchWhiteboard.tsx', content);
