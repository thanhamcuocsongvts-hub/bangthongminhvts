const fs = require('fs');

let code = fs.readFileSync('src/components/TouchWhiteboard.tsx', 'utf8');

// Add activePointersRef
if (!code.includes('activePointersRef')) {
  code = code.replace(
    "const currentPointsRef = useRef<StrokePoint[]>([]);",
    "const currentPointsRef = useRef<StrokePoint[]>([]);\n  const activePointersRef = useRef<Map<number, {y: number, x: number}>>(new Map());\n  const scrollTargetRef = useRef<Element | null>(null);"
  );
}

// Modify handlePointerDown
code = code.replace(
  "const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {",
  `const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
    // Find scroll target on first touch
    if (!scrollTargetRef.current) {
      // Try to find the presentation scrollable area
      scrollTargetRef.current = document.querySelector('.overflow-y-auto') || document.documentElement;
    }

    if (activePointersRef.current.size === 2) {
      // 2 fingers - stop drawing, prepare for pan
      setIsDrawing(false);
      return;
    }`
);

// Modify handlePointerMove
code = code.replace(
  "const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {",
  `const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      const prev = activePointersRef.current.get(e.pointerId)!;
      const dy = e.clientY - prev.y;
      const dx = e.clientX - prev.x;
      
      // Update pointer position
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // If 2 fingers, pan the scroll target
      if (activePointersRef.current.size === 2) {
        if (scrollTargetRef.current) {
          scrollTargetRef.current.scrollBy(-dx, -dy);
        }
        return;
      }
    }
`
);

// Modify handlePointerUp
code = code.replace(
  "const handlePointerUp = () => {",
  `const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e && e.pointerId != null) {
      activePointersRef.current.delete(e.pointerId);
    } else {
      activePointersRef.current.clear();
    }`
);

// We need to also update the JSX to pass `e` to `handlePointerUp`
code = code.replace(
  "onPointerUp={activeTool === 'select' ? undefined : handlePointerUp}",
  "onPointerUp={activeTool === 'select' ? undefined : handlePointerUp}"
);
code = code.replace(
  "onPointerLeave={activeTool === 'select' ? undefined : handlePointerUp}",
  "onPointerLeave={activeTool === 'select' ? undefined : handlePointerUp}"
);

fs.writeFileSync('src/components/TouchWhiteboard.tsx', code);
console.log("Updated TouchWhiteboard.tsx");
