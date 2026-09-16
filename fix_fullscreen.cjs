const fs = require('fs');
let code = fs.readFileSync('src/components/PresentationView.tsx', 'utf8');

const replacement = `  const togglePresentationFullscreen = () => {
    // Dispatch event to app to hide header
    window.dispatchEvent(new CustomEvent('toggle-app-fullscreen'));
    
    const el = document.getElementById('presentation-viewport');
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };`;

code = code.replace(/  const togglePresentationFullscreen = \(\) => \{[\s\S]*?    \} else \{\n      document\.exitFullscreen\(\)\.catch\(\(\) => \{\}\);\n      setIsFullscreen\(false\);\n    \}\n  \};/, replacement);
fs.writeFileSync('src/components/PresentationView.tsx', code);

let appCode = fs.readFileSync('src/App.tsx', 'utf8');
const effect = `  // Fullscreen Listener for Presentation
  useEffect(() => {
    const handleToggle = () => handleToggleFullscreen();
    window.addEventListener('toggle-app-fullscreen', handleToggle);
    return () => window.removeEventListener('toggle-app-fullscreen', handleToggle);
  }, [isFullscreen]);`;

appCode = appCode.replace(/  const handleToggleFullscreen = \(\) => \{/, effect + "\n\n  const handleToggleFullscreen = () => {");
fs.writeFileSync('src/App.tsx', appCode);

