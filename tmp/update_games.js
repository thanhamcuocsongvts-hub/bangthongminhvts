const fs = require('fs');

const filePath = '/src/components/EducationalGamesHub.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Plus, Minus to imports if not present
if (!content.includes('Plus,')) {
  content = content.replace("import {\n  Trophy,", "import {\n  Plus,\n  Minus,\n  Trophy,");
}

// 2. Add QuickPointAdjuster component before GrandPrixRacingGame
const quickPointComp = `
interface QuickPointAdjusterProps {
  onAdjust: (delta: number) => void;
  title?: string;
  targetName?: string | null;
}

const QuickPointAdjuster: React.FC<QuickPointAdjusterProps> = ({ onAdjust, title = 'Chấm Điểm Thi Đua', targetName }) => {
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);

  const handleClick = (pts: number) => {
    onAdjust(pts);
    const label = pts > 0 ? \`+\${pts} điểm\` : \`\${pts} điểm\`;
    setLastFeedback(\`Đã \${pts > 0 ? 'cộng' : 'trừ'} \${label} \${targetName ? \`cho \${targetName}\` : ''}\`);
    if (pts > 0) {
      confetti({
        particleCount: pts >= 10 ? 80 : 35,
        spread: 60,
        origin: { y: 0.7 },
      });
    }
    setTimeout(() => setLastFeedback(null), 2500);
  };

  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-inner">
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
        <span className="flex items-center gap-1.5 text-amber-300">
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          <span>{title}</span>
          {targetName && <span className="text-white bg-indigo-950 border border-indigo-500/40 px-2 py-0.5 rounded-md font-extrabold">{targetName}</span>}
        </span>
        {lastFeedback && (
          <span className="text-emerald-400 font-extrabold animate-pulse text-[11px]">{lastFeedback}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => handleClick(-2)}
          className="px-2.5 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-600/60 text-rose-300 hover:text-white font-mono font-black text-xs transition-all active:scale-95 shadow-xs cursor-pointer"
          title="Trừ 2 điểm"
        >
          -2 điểm
        </button>
        <button
          type="button"
          onClick={() => handleClick(-1)}
          className="px-2.5 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 hover:text-white font-mono font-black text-xs transition-all active:scale-95 shadow-xs cursor-pointer"
          title="Trừ 1 điểm"
        >
          -1 điểm
        </button>
        <button
          type="button"
          onClick={() => handleClick(1)}
          className="px-2.5 py-1.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-700 border border-indigo-500/50 text-indigo-300 hover:text-white font-mono font-black text-xs transition-all active:scale-95 shadow-xs cursor-pointer"
          title="Cộng 1 điểm"
        >
          +1 điểm
        </button>
        <button
          type="button"
          onClick={() => handleClick(2)}
          className="px-2.5 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-300 hover:text-white font-mono font-black text-xs transition-all active:scale-95 shadow-xs cursor-pointer"
          title="Cộng 2 điểm"
        >
          +2 điểm
        </button>
        <button
          type="button"
          onClick={() => handleClick(10)}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:opacity-95 text-slate-950 font-mono font-black text-xs transition-all active:scale-95 shadow-md shadow-amber-500/20 flex items-center gap-1 cursor-pointer"
          title="Thưởng xuất sắc 10 điểm!"
        >
          <span>⭐</span>
          <span>10 điểm</span>
        </button>
      </div>
    </div>
  );
};
`;

if (!content.includes('QuickPointAdjuster')) {
  content = content.replace(
    '/* GAME 1: ĐUA XE GRAND PRIX KIẾN THỨC',
    quickPointComp + '\n/* GAME 1: ĐUA XE GRAND PRIX KIẾN THỨC'
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added QuickPointAdjuster to EducationalGamesHub.tsx');
