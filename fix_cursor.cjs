const fs = require('fs');
let code = fs.readFileSync('src/components/ClassroomBlackboardView.tsx', 'utf8');

const replacement = `  const getCanvasCursorStyle = () => {
    return {};
  };

  const getCanvasCursorClass = () => {
    switch (activeTool) {
      case 'select':
        return 'cursor-default';
      case 'pen':
        return 'cursor-crosshair';
      case 'text':
        return 'cursor-text';
      case 'highlighter':
        return 'cursor-crosshair';
      case 'eraser':
        return 'cursor-cell';
      case 'laser':
        return 'cursor-none';
      default:
        return 'cursor-crosshair';
    }
  };`;

code = code.replace(/  const getCanvasCursorStyle = \(\) => \{[\s\S]*?    \}  \};/, replacement);
fs.writeFileSync('src/components/ClassroomBlackboardView.tsx', code);
