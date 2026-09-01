import React, { useState, useEffect, useRef } from 'react';
import {
  Dices,
  RotateCw,
  Sparkles,
  Award,
  Users,
  CheckCircle2,
  X,
  Volume2,
  VolumeX,
  Shuffle,
  Star,
  Flame,
  Gift,
  Rocket,
  Zap,
  Trophy,
  Play,
  RotateCcw,
  UserPlus,
  Layers,
  HelpCircle,
  Crown,
  Wand2,
  Compass,
  Gamepad2,
  Smile,
  Target,
  Flag,
  Fish,
  Crosshair,
  Activity,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ClassRoom, ClassStudent } from '../types';

interface RandomStudentPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  classroom: ClassRoom;
  allClasses?: ClassRoom[];
  onSelectClassroom?: (cls: ClassRoom) => void;
  onAddBonusPoint: (studentId: string, amount: number) => void;
  onSetOralScore: (studentId: string, score: number) => void;
}

export type GameType =
  | 'wheel'
  | 'mystery_box'
  | 'space_rocket'
  | 'magic_cards'
  | 'golden_egg'
  | 'treasure_chest'
  | 'sprint_race'
  | 'ocean_fishing'
  | 'archery_target'
  | 'magic_hat';

interface MysteryBoxItem {
  id: number;
  color: string;
  borderColor: string;
  icon: string;
  title: string;
  assignedStudent: ClassStudent;
  isOpen: boolean;
}

interface MagicCardItem {
  id: number;
  icon: string;
  color: string;
  assignedStudent: ClassStudent;
  isFlipped: boolean;
}

interface GoldenEggItem {
  id: number;
  isCracked: boolean;
  assignedStudent: ClassStudent;
  color: string;
}

interface TreasureChestItem {
  id: number;
  isOpen: boolean;
  assignedStudent: ClassStudent;
  gem: string;
}

interface RaceRunner {
  id: number;
  lane: number;
  name: string;
  emoji: string;
  color: string;
  laneBg: string;
  progress: number; // 0 - 100
  assignedStudent: ClassStudent;
}

interface SwimmingFish {
  id: number;
  name: string;
  icon: string;
  color: string;
  bgGrad: string;
  size: number;
  isCaught: boolean;
  assignedStudent: ClassStudent;
}

// 30 Sample Vietnamese student names for fast-start if class roster is empty
const SAMPLE_STUDENTS: ClassStudent[] = [
  { id: 'sample_1', code: 'HS01', name: 'Nguyễn Văn An', bonusPoints: 0, isCalled: false },
  { id: 'sample_2', code: 'HS02', name: 'Trần Thị Bình', bonusPoints: 0, isCalled: false },
  { id: 'sample_3', code: 'HS03', name: 'Lê Hoàng Cường', bonusPoints: 0, isCalled: false },
  { id: 'sample_4', code: 'HS04', name: 'Phạm Minh Đức', bonusPoints: 0, isCalled: false },
  { id: 'sample_5', code: 'HS05', name: 'Vũ Thu Hà', bonusPoints: 0, isCalled: false },
  { id: 'sample_6', code: 'HS06', name: 'Hoàng Gia Huy', bonusPoints: 0, isCalled: false },
  { id: 'sample_7', code: 'HS07', name: 'Đỗ Thùy Linh', bonusPoints: 0, isCalled: false },
  { id: 'sample_8', code: 'HS08', name: 'Bùi Quang Nam', bonusPoints: 0, isCalled: false },
  { id: 'sample_9', code: 'HS09', name: 'Ngô Bảo Ngọc', bonusPoints: 0, isCalled: false },
  { id: 'sample_10', code: 'HS10', name: 'Đặng Quốc Phong', bonusPoints: 0, isCalled: false },
  { id: 'sample_11', code: 'HS11', name: 'Trịnh Hương Quỳnh', bonusPoints: 0, isCalled: false },
  { id: 'sample_12', code: 'HS12', name: 'Dương Tuấn Sang', bonusPoints: 0, isCalled: false },
  { id: 'sample_13', code: 'HS13', name: 'Lý Phương Thảo', bonusPoints: 0, isCalled: false },
  { id: 'sample_14', code: 'HS14', name: 'Phan Anh Tuấn', bonusPoints: 0, isCalled: false },
  { id: 'sample_15', code: 'HS15', name: 'Mai Khánh Vy', bonusPoints: 0, isCalled: false },
  { id: 'sample_16', code: 'HS16', name: 'Hồ Công Vinh', bonusPoints: 0, isCalled: false },
  { id: 'sample_17', code: 'HS17', name: 'Đinh Nhật Ánh', bonusPoints: 0, isCalled: false },
  { id: 'sample_18', code: 'HS18', name: 'Võ Minh Châu', bonusPoints: 0, isCalled: false },
  { id: 'sample_19', code: 'HS19', name: 'Tạ Tiến Đạt', bonusPoints: 0, isCalled: false },
  { id: 'sample_20', code: 'HS20', name: 'Cao Ngọc Diệp', bonusPoints: 0, isCalled: false },
];

export const RandomStudentPickerModal: React.FC<RandomStudentPickerModalProps> = ({
  isOpen,
  onClose,
  classroom,
  allClasses = [],
  onSelectClassroom,
  onAddBonusPoint,
  onSetOralScore,
}) => {
  const [activeGame, setActiveGame] = useState<GameType>('wheel');
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [selectedStudent, setSelectedStudent] = useState<ClassStudent | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ClassStudent[]>([]);
  const [excludeCalled, setExcludeCalled] = useState<boolean>(false);
  const [mode, setMode] = useState<'single' | 'group'>('single');
  const [groupSize, setGroupSize] = useState<number>(2);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [currentRotation, setCurrentRotation] = useState<number>(0);
  const [shufflingName, setShufflingName] = useState<string>('');

  // Game 2: Mystery Box State
  const [boxes, setBoxes] = useState<MysteryBoxItem[]>([]);
  const [isShufflingBoxes, setIsShufflingBoxes] = useState<boolean>(false);

  // Game 3: Space Rocket State
  const [countdown, setCountdown] = useState<number | null>(null);
  const [rocketStage, setRocketStage] = useState<'idle' | 'countdown' | 'launching' | 'winner'>('idle');

  // Game 4: Magic Cards State
  const [cards, setCards] = useState<MagicCardItem[]>([]);
  const [isShufflingCards, setIsShufflingCards] = useState<boolean>(false);

  // Game 5: Golden Eggs State
  const [eggs, setEggs] = useState<GoldenEggItem[]>([]);
  const [isShufflingEggs, setIsShufflingEggs] = useState<boolean>(false);

  // Game 6: Ocean Treasure Chests State
  const [chests, setChests] = useState<TreasureChestItem[]>([]);
  const [isShufflingChests, setIsShufflingChests] = useState<boolean>(false);

  // Game 7: Sprint Track Race State (Chạy đua)
  const [runners, setRunners] = useState<RaceRunner[]>([]);
  const [raceStage, setRaceStage] = useState<'idle' | 'countdown' | 'running' | 'finish'>('idle');
  const [raceCountdown, setRaceCountdown] = useState<number | null>(null);

  // Game 8: Deep Sea Fishing State (Câu cá)
  const [fishes, setFishes] = useState<SwimmingFish[]>([]);
  const [fishingStage, setFishingStage] = useState<'idle' | 'casting' | 'hooked' | 'caught'>('idle');
  const [caughtFish, setCaughtFish] = useState<SwimmingFish | null>(null);

  // Game 9: Archery Target Bullseye State (Bắn cung)
  const [archeryStage, setArcheryStage] = useState<'idle' | 'aiming' | 'shooting' | 'hit'>('idle');
  const [arrowScore, setArrowScore] = useState<number>(10);
  const [arrowPos, setArrowPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });

  // Game 10: Magician Magic Hat State
  const [hatStage, setHatStage] = useState<'idle' | 'casting' | 'revealed'>('idle');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Fallback if classroom has 0 students so games never break
  const rawRoster = classroom?.students && classroom.students.length > 0 ? classroom.students : SAMPLE_STUDENTS;
  const isUsingSampleRoster = !classroom?.students || classroom.students.length === 0;

  const studentsPool = excludeCalled
    ? rawRoster.filter((s) => !s.isCalled)
    : rawRoster;

  const validStudents = studentsPool.length > 0 ? studentsPool : rawRoster;

  // Web Audio Synthesizer for Touch Interaction
  const playSound = (freq = 600, duration = 0.05, type: OscillatorType = 'sine') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  };

  const playVictorySound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx * 0.09);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + idx * 0.09 + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + idx * 0.09);
        osc.stop(audioCtx.currentTime + idx * 0.09 + 0.35);
      });
    } catch (e) {}
  };

  // Helper shuffle array
  function shuffleArray<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  // Initialize Games whenever students change or game switches
  useEffect(() => {
    if (!isOpen) return;
    initializeBoxes();
    initializeCards();
    initializeEggs();
    initializeChests();
    initializeRunners();
    initializeFishes();
  }, [isOpen, classroom, excludeCalled]);

  const initializeBoxes = () => {
    const shuffled: ClassStudent[] = shuffleArray<ClassStudent>(validStudents);
    const boxColors = [
      { color: 'from-amber-400 to-orange-500', border: 'border-amber-300', icon: '🎁', title: 'Hộp Quà Vàng' },
      { color: 'from-rose-400 to-red-500', border: 'border-rose-300', icon: '🎀', title: 'Hộp Quà Hồng' },
      { color: 'from-indigo-400 to-blue-600', border: 'border-blue-300', icon: '📦', title: 'Hộp Quà Lam' },
      { color: 'from-emerald-400 to-teal-600', border: 'border-emerald-300', icon: '💎', title: 'Hộp Ngọc Lục' },
      { color: 'from-purple-400 to-violet-600', border: 'border-purple-300', icon: '🔮', title: 'Hộp Pha Lê' },
      { color: 'from-pink-400 to-rose-600', border: 'border-pink-300', icon: '✨', title: 'Hộp May Mắn' },
      { color: 'from-amber-500 to-yellow-600', border: 'border-yellow-300', icon: '👑', title: 'Hộp Vương Miện' },
      { color: 'from-teal-400 to-cyan-600', border: 'border-cyan-300', icon: '🌟', title: 'Hộp Ngôi Sao' },
    ];

    const newBoxes: MysteryBoxItem[] = boxColors.map((bc, idx) => ({
      id: idx + 1,
      color: bc.color,
      borderColor: bc.border,
      icon: bc.icon,
      title: bc.title,
      assignedStudent: shuffled[idx % shuffled.length],
      isOpen: false,
    }));
    setBoxes(newBoxes);
  };

  const initializeCards = () => {
    const shuffled: ClassStudent[] = shuffleArray<ClassStudent>(validStudents);
    const cardIcons = ['🃏', '🎴', '🔮', '✨', '⚡', '🌟'];
    const cardColors = [
      'from-purple-600 to-indigo-800',
      'from-rose-600 to-red-800',
      'from-emerald-600 to-teal-800',
      'from-amber-600 to-orange-800',
      'from-blue-600 to-cyan-800',
      'from-fuchsia-600 to-pink-800',
    ];

    const newCards: MagicCardItem[] = Array.from({ length: 6 }).map((_, idx) => ({
      id: idx + 1,
      icon: cardIcons[idx % cardIcons.length],
      color: cardColors[idx % cardColors.length],
      assignedStudent: shuffled[idx % shuffled.length],
      isFlipped: false,
    }));
    setCards(newCards);
  };

  const initializeEggs = () => {
    const shuffled: ClassStudent[] = shuffleArray<ClassStudent>(validStudents);
    const eggColors = [
      'from-amber-300 via-yellow-400 to-amber-500',
      'from-yellow-200 via-amber-300 to-yellow-500',
      'from-amber-400 via-yellow-500 to-orange-400',
      'from-yellow-300 via-amber-400 to-yellow-600',
      'from-amber-200 via-yellow-300 to-amber-500',
      'from-yellow-400 via-amber-500 to-yellow-500',
    ];
    setEggs(
      Array.from({ length: 6 }).map((_, idx) => ({
        id: idx + 1,
        isCracked: false,
        assignedStudent: shuffled[idx % shuffled.length],
        color: eggColors[idx % eggColors.length],
      }))
    );
  };

  const initializeChests = () => {
    const shuffled: ClassStudent[] = shuffleArray<ClassStudent>(validStudents);
    const gems = ['💎 Kim Cương', '👑 Vương Miện', '🌟 Ngọc Bích', '🪙 Tiền Vàng', '🔮 Ngọc Trai', '🏆 Cúp Vàng'];
    setChests(
      Array.from({ length: 6 }).map((_, idx) => ({
        id: idx + 1,
        isOpen: false,
        assignedStudent: shuffled[idx % shuffled.length],
        gem: gems[idx % gems.length],
      }))
    );
  };

  const initializeRunners = () => {
    const shuffled: ClassStudent[] = shuffleArray<ClassStudent>(validStudents);
    const runnerPresets = [
      { name: 'Sư Tử Vàng', emoji: '🦁', color: 'from-amber-500 to-yellow-400', laneBg: 'bg-amber-500/20' },
      { name: 'Báo Gấm Tốc Độ', emoji: '🐆', color: 'from-rose-500 to-orange-500', laneBg: 'bg-rose-500/20' },
      { name: 'Tia Chớp Thần', emoji: '⚡', color: 'from-cyan-500 to-blue-600', laneBg: 'bg-cyan-500/20' },
      { name: 'Đại Bàng Tung Cánh', emoji: '🦅', color: 'from-purple-500 to-indigo-600', laneBg: 'bg-purple-500/20' },
    ];
    setRunners(
      runnerPresets.map((rp, idx) => ({
        id: idx + 1,
        lane: idx + 1,
        name: rp.name,
        emoji: rp.emoji,
        color: rp.color,
        laneBg: rp.laneBg,
        progress: 0,
        assignedStudent: shuffled[idx % shuffled.length],
      }))
    );
    setRaceStage('idle');
    setRaceCountdown(null);
  };

  const initializeFishes = () => {
    const shuffled: ClassStudent[] = shuffleArray<ClassStudent>(validStudents);
    const fishPresets = [
      { name: 'Cá Mập Thần Tài', icon: '🦈', color: 'text-cyan-400', bgGrad: 'from-cyan-600/30 to-blue-900/50', size: 1 },
      { name: 'Cá Heo Vui Vẻ', icon: '🐬', color: 'text-sky-300', bgGrad: 'from-sky-500/30 to-indigo-900/50', size: 1 },
      { name: 'Cá Hề Hoàng Kim', icon: '🐠', color: 'text-amber-400', bgGrad: 'from-amber-500/30 to-orange-900/50', size: 0.9 },
      { name: 'Bạch Tuộc May Mắn', icon: '🐙', color: 'text-pink-400', bgGrad: 'from-pink-500/30 to-purple-900/50', size: 1.1 },
      { name: 'Rùa Biển Phú Quý', icon: '🐢', color: 'text-emerald-400', bgGrad: 'from-emerald-500/30 to-teal-900/50', size: 0.95 },
      { name: 'Cá Nóc Trúng Lớn', icon: '🐡', color: 'text-yellow-300', bgGrad: 'from-yellow-500/30 to-amber-900/50', size: 1 },
    ];
    setFishes(
      fishPresets.map((fp, idx) => ({
        id: idx + 1,
        name: fp.name,
        icon: fp.icon,
        color: fp.color,
        bgGrad: fp.bgGrad,
        size: fp.size,
        isCaught: false,
        assignedStudent: shuffled[idx % shuffled.length],
      }))
    );
    setFishingStage('idle');
    setCaughtFish(null);
  };

  // Canvas Drawing for Game 1: Lucky Wheel
  useEffect(() => {
    if (activeGame !== 'wheel' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 15;

    ctx.clearRect(0, 0, width, height);

    const count = Math.min(validStudents.length, 24);
    const sliceAngle = (2 * Math.PI) / count;

    const colors = [
      '#4F46E5', '#059669', '#D97706', '#DC2626', '#7C3AED',
      '#0284C7', '#DB2777', '#EA580C', '#16A34A', '#2563EB',
      '#9333EA', '#CA8A04',
    ];

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(currentRotation);

    for (let i = 0; i < count; i++) {
      const student = validStudents[i];
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Text label
      ctx.save();
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Plus Jakarta Sans, sans-serif';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 3;

      const displayName = student.name.length > 15 ? student.name.substring(0, 14) + '…' : student.name;
      ctx.fillText(displayName, radius - 18, 4);
      ctx.restore();
    }

    // Wheel Center Cap
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#312E81';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, 2 * Math.PI);
    ctx.fillStyle = '#4F46E5';
    ctx.fill();

    ctx.restore();
  }, [activeGame, currentRotation, validStudents]);

  // Spin Wheel Handler
  const handleSpinWheel = () => {
    if (isSpinning || validStudents.length === 0) return;
    setIsSpinning(true);
    setSelectedStudent(null);
    setSelectedGroup([]);

    if (mode === 'group') {
      const shuffled: ClassStudent[] = shuffleArray<ClassStudent>(validStudents);
      const group: ClassStudent[] = shuffled.slice(0, Math.min(groupSize, validStudents.length));
      let counter = 0;
      const interval = setInterval(() => {
        playSound(400 + Math.random() * 400, 0.04, 'square');
        setShufflingName(group[counter % group.length]?.name || '...');
        counter++;
        if (counter > 15) {
          clearInterval(interval);
          setIsSpinning(false);
          setSelectedGroup(group);
          playVictorySound();
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        }
      }, 90);
      return;
    }

    const winnerIndex = Math.floor(Math.random() * Math.min(validStudents.length, 24));
    const targetStudent = validStudents[winnerIndex];
    const count = Math.min(validStudents.length, 24);
    const sliceAngle = (2 * Math.PI) / count;

    // Calculate target angle to point at top (3*PI/2)
    const targetOffset = 1.5 * Math.PI - (winnerIndex * sliceAngle + sliceAngle / 2);
    const fullSpins = (5 + Math.floor(Math.random() * 4)) * (2 * Math.PI);
    const totalRotation = currentRotation + fullSpins + targetOffset;

    const startTime = performance.now();
    const duration = 4000;
    const startRot = currentRotation;

    let lastTickAngle = startRot;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = startRot + (totalRotation - startRot) * ease;
      setCurrentRotation(current);

      // Sound ticks
      if (Math.abs(current - lastTickAngle) >= sliceAngle) {
        playSound(800, 0.03, 'sine');
        lastTickAngle = current;
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        setSelectedStudent(targetStudent);
        playVictorySound();
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  // Game 2: Mystery Box
  const handleOpenBox = (boxId: number) => {
    if (isShufflingBoxes) return;
    const box = boxes.find((b) => b.id === boxId);
    if (!box || box.isOpen) return;

    playSound(600, 0.1, 'sine');
    setBoxes((prev) => prev.map((b) => (b.id === boxId ? { ...b, isOpen: true } : b)));

    if (box.assignedStudent) {
      setSelectedStudent(box.assignedStudent);
      playVictorySound();
      confetti({ particleCount: 100, spread: 75, origin: { y: 0.6 } });
    }
  };

  const handleShuffleBoxes = () => {
    setIsShufflingBoxes(true);
    setSelectedStudent(null);
    playSound(400, 0.1, 'sawtooth');
    let counter = 0;
    const interval = setInterval(() => {
      playSound(300 + Math.random() * 300, 0.04, 'square');
      counter++;
      if (counter > 8) {
        clearInterval(interval);
        initializeBoxes();
        setIsShufflingBoxes(false);
        playSound(600, 0.1, 'sine');
      }
    }, 100);
  };

  // Game 3: Space Rocket Launch (Clean 1-student display, no repeated names)
  const handleLaunchRocket = () => {
    if (rocketStage === 'countdown' || rocketStage === 'launching' || validStudents.length === 0) return;
    setSelectedStudent(null);
    setRocketStage('countdown');
    setCountdown(3);
    playSound(520, 0.1, 'triangle');

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setRocketStage('launching');
          playSound(250, 0.5, 'sawtooth');

          // Spin names in cosmic cockpit
          let count = 0;
          const slotInterval = setInterval(() => {
            const randomSt = validStudents[Math.floor(Math.random() * validStudents.length)];
            setShufflingName(randomSt?.name || '...');
            playSound(300 + Math.random() * 400, 0.04, 'sine');
            count++;
          }, 80);

          setTimeout(() => {
            clearInterval(slotInterval);
            const winner = validStudents[Math.floor(Math.random() * validStudents.length)];
            setSelectedStudent(winner);
            setRocketStage('winner');
            playVictorySound();
            confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } });
          }, 2400);

          return 0;
        }
        playSound(440 + (4 - prev) * 100, 0.1, 'triangle');
        return prev - 1;
      });
    }, 700);
  };

  // Game 4: Magic Card Flip
  const handleFlipCard = (cardId: number) => {
    if (isShufflingCards) return;
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.isFlipped) return;

    playSound(750, 0.12, 'sine');
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, isFlipped: true } : c)));

    if (card.assignedStudent) {
      setSelectedStudent(card.assignedStudent);
      playVictorySound();
      confetti({ particleCount: 100, spread: 75, origin: { y: 0.6 } });
    }
  };

  const handleShuffleCards = () => {
    setIsShufflingCards(true);
    setSelectedStudent(null);
    playSound(400, 0.1, 'sawtooth');
    let counter = 0;
    const interval = setInterval(() => {
      playSound(350 + Math.random() * 350, 0.04, 'square');
      counter++;
      if (counter > 8) {
        clearInterval(interval);
        initializeCards();
        setIsShufflingCards(false);
        playSound(700, 0.1, 'sine');
      }
    }, 100);
  };

  // Game 5: Golden Egg Cracking
  const handleCrackEgg = (eggId: number) => {
    if (isShufflingEggs) return;
    const egg = eggs.find((e) => e.id === eggId);
    if (!egg || egg.isCracked) return;

    playSound(900, 0.15, 'triangle');
    setEggs((prev) => prev.map((e) => (e.id === eggId ? { ...e, isCracked: true } : e)));

    if (egg.assignedStudent) {
      setSelectedStudent(egg.assignedStudent);
      playVictorySound();
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    }
  };

  // Game 6: Ocean Treasure Chest
  const handleOpenChest = (chestId: number) => {
    if (isShufflingChests) return;
    const chest = chests.find((c) => c.id === chestId);
    if (!chest || chest.isOpen) return;

    playSound(650, 0.2, 'sine');
    setChests((prev) => prev.map((c) => (c.id === chestId ? { ...c, isOpen: true } : c)));

    if (chest.assignedStudent) {
      setSelectedStudent(chest.assignedStudent);
      playVictorySound();
      confetti({ particleCount: 110, spread: 70, origin: { y: 0.6 } });
    }
  };

  // Game 7: Sprint Track Race (Chạy đua)
  const handleStartRace = () => {
    if (raceStage === 'countdown' || raceStage === 'running' || validStudents.length === 0) return;
    setSelectedStudent(null);
    setRaceStage('countdown');
    setRaceCountdown(3);
    playSound(600, 0.1, 'triangle');

    // Reset progress
    setRunners((prev) => prev.map((r) => ({ ...r, progress: 0 })));

    const countInterval = setInterval(() => {
      setRaceCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countInterval);
          setRaceStage('running');
          playSound(900, 0.3, 'sawtooth'); // Start whistle!

          // Pick winner
          const winnerIndex = Math.floor(Math.random() * 4);
          let currentProgress = [0, 0, 0, 0];

          const raceStepInterval = setInterval(() => {
            let reachedEnd = false;
            currentProgress = currentProgress.map((p, idx) => {
              const boost = idx === winnerIndex ? Math.random() * 12 + 6 : Math.random() * 9 + 4;
              const next = Math.min(p + boost, 100);
              if (next >= 100 && idx === winnerIndex) reachedEnd = true;
              return next;
            });

            playSound(300 + Math.random() * 200, 0.03, 'sine');
            setRunners((prev) =>
              prev.map((r, i) => ({
                ...r,
                progress: currentProgress[i] || 0,
              }))
            );

            if (reachedEnd) {
              clearInterval(raceStepInterval);
              setTimeout(() => {
                setRunners((prev) => {
                  const winnerRunner = prev[winnerIndex];
                  if (winnerRunner) {
                    setSelectedStudent(winnerRunner.assignedStudent);
                  }
                  return prev;
                });
                setRaceStage('finish');
                playVictorySound();
                confetti({ particleCount: 160, spread: 90, origin: { y: 0.55 } });
              }, 400);
            }
          }, 120);

          return 0;
        }
        playSound(550 + (3 - prev) * 120, 0.1, 'triangle');
        return prev - 1;
      });
    }, 700);
  };

  // Game 8: Deep Sea Fishing (Câu cá)
  const handleCastFishing = (fishId?: number) => {
    if (fishingStage === 'casting' || fishingStage === 'hooked' || validStudents.length === 0) return;
    setSelectedStudent(null);
    setFishingStage('casting');
    playSound(450, 0.2, 'sawtooth'); // Line cast sound

    const targetFish = fishId
      ? fishes.find((f) => f.id === fishId) || fishes[0]
      : fishes[Math.floor(Math.random() * fishes.length)];

    setTimeout(() => {
      setFishingStage('hooked');
      playSound(700, 0.15, 'sine'); // Nibble / bite

      setTimeout(() => {
        setCaughtFish(targetFish);
        setFishes((prev) => prev.map((f) => (f.id === targetFish.id ? { ...f, isCaught: true } : f)));
        setSelectedStudent(targetFish.assignedStudent);
        setFishingStage('caught');
        playVictorySound();
        confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
      }, 900);
    }, 1200);
  };

  // Game 9: Archery Target Bullseye (Bắn cung)
  const handleShootArchery = (customScore = 10) => {
    if (archeryStage === 'aiming' || archeryStage === 'shooting' || validStudents.length === 0) return;
    setSelectedStudent(null);
    setArcheryStage('aiming');
    playSound(500, 0.15, 'sine');

    setTimeout(() => {
      setArcheryStage('shooting');
      playSound(850, 0.1, 'sawtooth'); // Whoosh of arrow!

      setTimeout(() => {
        // Bullseye hit!
        const hitScore = customScore || 10;
        setArrowScore(hitScore);
        const winner = validStudents[Math.floor(Math.random() * validStudents.length)];
        setSelectedStudent(winner);
        setArcheryStage('hit');
        playVictorySound();
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.55 } });
      }, 600);
    }, 800);
  };

  // Game 10: Magician Magic Hat
  const handleCastMagic = () => {
    if (hatStage === 'casting' || validStudents.length === 0) return;
    setSelectedStudent(null);
    setHatStage('casting');
    playSound(700, 0.2, 'sine');

    let count = 0;
    const castInterval = setInterval(() => {
      playSound(600 + Math.random() * 400, 0.05, 'triangle');
      count++;
    }, 100);

    setTimeout(() => {
      clearInterval(castInterval);
      const winner = validStudents[Math.floor(Math.random() * validStudents.length)];
      setSelectedStudent(winner);
      setHatStage('revealed');
      playVictorySound();
      confetti({ particleCount: 140, spread: 85, origin: { y: 0.55 } });
    }, 1800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 select-none">
      <div className="w-full max-w-5xl p-5 md:p-7 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-5 max-h-[94vh] overflow-y-auto smooth-touch-scroll">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-200 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs shrink-0">
              <Gamepad2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl md:text-2xl font-black text-slate-900">
                  10 Trò Chơi Gọi Học Sinh Tương Tác
                </h2>
                {allClasses.length > 1 && onSelectClassroom ? (
                  <select
                    value={classroom?.id}
                    onChange={(e) => {
                      const selected = allClasses.find((c) => c.id === e.target.value);
                      if (selected) onSelectClassroom(selected);
                    }}
                    className="px-3 py-1 rounded-xl bg-indigo-50 border-2 border-indigo-300 text-indigo-900 text-xs font-black cursor-pointer shadow-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {allClasses.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        Lớp {cls.name} ({cls.students?.length || 0} HS)
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="px-3 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-black">
                    Lớp {classroom?.name || '10A1'} ({validStudents.length} em)
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-xs font-medium mt-0.5">
                Âm thanh sôi động, đồ họa sắc nét tối ưu cho màn hình cảm ứng SmartBoard 75 Pro
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            {allClasses.length > 0 && (
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 hidden sm:flex">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Đã nạp {validStudents.length} học sinh</span>
              </span>
            )}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-rose-500" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notice if sample roster is used */}
        {isUsingSampleRoster ? (
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Chưa có học sinh trong lớp này. Đang sử dụng 20 tên học sinh mẫu để Thầy/Cô trải nghiệm trò chơi ngay lập tức.</span>
            </div>
          </div>
        ) : (
          <div className="p-2 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Đang áp dụng danh sách học sinh thực tế của Lớp {classroom?.name} ({validStudents.length} học sinh)</span>
            </div>
          </div>
        )}

        {/* 10 FUN GAMES SELECTOR TABS */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 bg-slate-100 rounded-2xl border border-slate-200 smooth-touch-scroll">
          {[
            { id: 'wheel' as GameType, icon: '🎡', label: '1. Vòng Quay' },
            { id: 'mystery_box' as GameType, icon: '🎁', label: '2. Hộp Quà' },
            { id: 'space_rocket' as GameType, icon: '🚀', label: '3. Tên Lửa' },
            { id: 'magic_cards' as GameType, icon: '🃏', label: '4. Thẻ Bài' },
            { id: 'golden_egg' as GameType, icon: '🥚', label: '5. Đập Trứng' },
            { id: 'treasure_chest' as GameType, icon: '🏴‍☠️', label: '6. Rương Báu' },
            { id: 'sprint_race' as GameType, icon: '🏃‍♂️', label: '7. Chạy Đua' },
            { id: 'ocean_fishing' as GameType, icon: '🎣', label: '8. Câu Cá' },
            { id: 'archery_target' as GameType, icon: '🎯', label: '9. Bắn Cung' },
            { id: 'magic_hat' as GameType, icon: '🎩', label: '10. Nón Ảo Thuật' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveGame(tab.id);
                setSelectedStudent(null);
              }}
              className={`px-3 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                activeGame === tab.id
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80 scale-[1.03]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Global Options Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('single')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                mode === 'single'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              🎯 Gọi 1 Học Sinh
            </button>
            <button
              onClick={() => setMode('group')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                mode === 'group'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              👥 Gọi Nhóm ({groupSize} em)
            </button>
          </div>

          {mode === 'group' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600 uppercase">SỐ LƯỢNG NHÓM:</span>
              {[2, 3, 4, 5].map((sz) => (
                <button
                  key={sz}
                  onClick={() => setGroupSize(sz)}
                  className={`w-7 h-7 rounded-lg text-xs font-black cursor-pointer ${
                    groupSize === sz
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-700">
            <input
              type="checkbox"
              checked={excludeCalled}
              onChange={(e) => setExcludeCalled(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
            />
            <span>Ưu tiên học sinh chưa phát biểu ({validStudents.length} em)</span>
          </label>
        </div>

        {/* 1. GAME 1: LUCKY WHEEL */}
        {activeGame === 'wheel' && (
          <div className="flex flex-col items-center justify-center space-y-5">
            <div className="relative">
              {/* Pointer Indicator */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20 pointer-events-none">
                <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[26px] border-t-rose-600 drop-shadow-md" />
              </div>

              <canvas
                ref={canvasRef}
                width={360}
                height={360}
                className="rounded-full shadow-2xl border-4 border-slate-800 bg-slate-900"
              />
            </div>

            <button
              onClick={handleSpinWheel}
              disabled={isSpinning}
              className={`px-8 py-3.5 rounded-2xl font-black text-base md:text-lg flex items-center gap-2.5 transition-all cursor-pointer shadow-lg active:scale-95 ${
                isSpinning
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-indigo-600/30'
              }`}
            >
              <RotateCw className={`w-5 h-5 ${isSpinning ? 'animate-spin' : ''}`} />
              <span>{isSpinning ? 'Đang quay...' : 'QUAY NGAY 🎯'}</span>
            </button>

            {renderResultCard()}
          </div>
        )}

        {/* 2. GAME 2: MYSTERY BOX (Displays only Full Name, no score numbers) */}
        {activeGame === 'mystery_box' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-600 uppercase">
                Chạm vào một hộp quà để mở tên học sinh may mắn:
              </div>
              <button
                onClick={handleShuffleBoxes}
                disabled={isShufflingBoxes}
                className="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Shuffle className={`w-3.5 h-3.5 text-amber-600 ${isShufflingBoxes ? 'animate-spin' : ''}`} />
                <span>Xáo Trộn Hộp Quà</span>
              </button>
            </div>

            {/* Boxes Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {boxes.map((box) => (
                <div
                  key={box.id}
                  onClick={() => handleOpenBox(box.id)}
                  className={`relative p-4 rounded-3xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[135px] text-center select-none active:scale-95 shadow-md ${
                    box.isOpen
                      ? 'bg-white border-emerald-400 ring-2 ring-emerald-400/20'
                      : `bg-gradient-to-br ${box.color} ${box.borderColor} hover:scale-105 text-white`
                  } ${isShufflingBoxes ? 'animate-bounce' : ''}`}
                >
                  {box.isOpen ? (
                    <div className="space-y-1 animate-fade-in">
                      <div className="text-3xl">🎉</div>
                      {/* ONLY FULL NAME */}
                      <div className="font-black text-slate-900 text-base leading-tight">
                        {box.assignedStudent?.name}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="text-4xl drop-shadow-md">{box.icon}</div>
                      <div className="font-black text-xs uppercase tracking-wider drop-shadow-sm">
                        {box.title}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {renderResultCard()}
          </div>
        )}

        {/* 3. GAME 3: SPACE ROCKET (Displays 1 single unique student name in Cockpit) */}
        {activeGame === 'space_rocket' && (
          <div className="space-y-5">
            <div className="p-7 rounded-3xl bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 border border-indigo-900/50 shadow-2xl text-center space-y-5 relative overflow-hidden">
              {/* Rocket State Banner */}
              {rocketStage === 'countdown' && (
                <div className="space-y-1 animate-bounce">
                  <div className="text-6xl md:text-7xl font-black text-amber-400 font-mono">
                    {countdown}
                  </div>
                  <div className="text-xs font-bold text-amber-200 uppercase tracking-widest">
                    ĐANG ĐẾM NGƯỢC PHÓNG TÊN LỬA...
                  </div>
                </div>
              )}

              {rocketStage === 'launching' && (
                <div className="space-y-2">
                  <div className="text-5xl animate-pulse">🚀 🔥 ⚡</div>
                  <div className="text-xs font-black text-indigo-300 uppercase tracking-wider">
                    TÊN LỬA ĐANG TĂNG TỐC VƯỢT DẢI NGÂN HÀ...
                  </div>
                </div>
              )}

              {/* Single Sleek Cosmic Cockpit Display */}
              <div className="max-w-md mx-auto p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white font-mono font-black text-xl md:text-2xl text-center min-h-[75px] flex items-center justify-center shadow-inner">
                {rocketStage === 'launching' ? (
                  <span className="text-amber-300 animate-pulse">{shufflingName || '🚀 ĐANG TĂNG TỐC...'}</span>
                ) : selectedStudent ? (
                  <span className="text-emerald-300 text-2xl font-black">{selectedStudent.name}</span>
                ) : (
                  <span className="text-slate-400 text-sm font-sans">Sẵn sàng kích hoạt tên lửa vũ trụ...</span>
                )}
              </div>

              {/* Launch Button */}
              <div>
                <button
                  onClick={handleLaunchRocket}
                  disabled={rocketStage === 'countdown' || rocketStage === 'launching'}
                  className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 via-orange-500 to-amber-500 hover:from-rose-700 hover:to-amber-600 text-white font-black text-base md:text-lg shadow-xl shadow-rose-600/30 active:scale-95 transition-all inline-flex items-center gap-2.5 cursor-pointer"
                >
                  <Rocket className="w-5 h-5" />
                  <span>{rocketStage === 'winner' ? 'Phóng Lượt Mới 🚀' : 'KÍCH HOẠT PHÓNG TÊN LỬA 🚀'}</span>
                </button>
              </div>
            </div>

            {renderResultCard()}
          </div>
        )}

        {/* 4. GAME 4: MAGIC CARDS */}
        {activeGame === 'magic_cards' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-600 uppercase">
                Chọn 1 lá bài ma thuật để lật mở:
              </div>
              <button
                onClick={handleShuffleCards}
                disabled={isShufflingCards}
                className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Shuffle className={`w-3.5 h-3.5 text-purple-600 ${isShufflingCards ? 'animate-spin' : ''}`} />
                <span>Xáo Bài Ma Thuật</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
              {cards.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleFlipCard(c.id)}
                  className={`relative p-4 rounded-3xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[150px] text-center select-none active:scale-95 shadow-md ${
                    c.isFlipped
                      ? 'bg-white border-purple-400 ring-2 ring-purple-400/20'
                      : `bg-gradient-to-br ${c.color} border-white/40 hover:scale-105 text-white`
                  } ${isShufflingCards ? 'animate-pulse' : ''}`}
                >
                  {c.isFlipped ? (
                    <div className="space-y-1 animate-fade-in">
                      <div className="text-3xl">✨</div>
                      <div className="font-black text-slate-900 text-sm leading-tight">
                        {c.assignedStudent?.name}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-4xl drop-shadow-md">{c.icon}</div>
                      <div className="font-black text-[11px] uppercase tracking-wider">
                        Thẻ {c.id}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {renderResultCard()}
          </div>
        )}

        {/* 5. GAME 5: GOLDEN EGGS (ĐẬP TRỨNG VÀNG) */}
        {activeGame === 'golden_egg' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-600 uppercase">
                Chạm vào quả trứng vàng để đập vỏ và nhận tên học sinh:
              </div>
              <button
                onClick={() => {
                  initializeEggs();
                  setSelectedStudent(null);
                  playSound(600, 0.1, 'sine');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                <span>Đặt Lại Trứng Mới</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
              {eggs.map((egg) => (
                <div
                  key={egg.id}
                  onClick={() => handleCrackEgg(egg.id)}
                  className={`relative p-4 rounded-3xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[155px] text-center select-none active:scale-95 shadow-lg ${
                    egg.isCracked
                      ? 'bg-white border-amber-400 ring-2 ring-amber-400/20'
                      : `bg-gradient-to-b ${egg.color} border-amber-200 hover:scale-105 text-amber-950`
                  }`}
                >
                  {egg.isCracked ? (
                    <div className="space-y-1 animate-fade-in">
                      <div className="text-3xl">🐣 🌟</div>
                      <div className="font-black text-slate-900 text-sm leading-tight">
                        {egg.assignedStudent?.name}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-5xl drop-shadow-md animate-pulse">🥚</div>
                      <div className="font-black text-xs text-amber-900 uppercase">
                        Trứng {egg.id}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {renderResultCard()}
          </div>
        )}

        {/* 6. GAME 6: OCEAN TREASURE CHEST (RƯƠNG BÁU ĐẠI DƯƠNG) */}
        {activeGame === 'treasure_chest' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-600 uppercase">
                Chạm vào rương báu để mở khóa châu báu & học sinh may mắn:
              </div>
              <button
                onClick={() => {
                  initializeChests();
                  setSelectedStudent(null);
                  playSound(600, 0.1, 'sine');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-teal-600" />
                <span>Khóa Lại Các Rương</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
              {chests.map((chest) => (
                <div
                  key={chest.id}
                  onClick={() => handleOpenChest(chest.id)}
                  className={`relative p-4 rounded-3xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[155px] text-center select-none active:scale-95 shadow-lg ${
                    chest.isOpen
                      ? 'bg-white border-teal-400 ring-2 ring-teal-400/20'
                      : 'bg-gradient-to-b from-amber-700 via-amber-800 to-amber-950 border-amber-600 hover:scale-105 text-amber-100'
                  }`}
                >
                  {chest.isOpen ? (
                    <div className="space-y-1 animate-fade-in">
                      <div className="text-3xl">💎 ✨</div>
                      <div className="font-black text-slate-900 text-sm leading-tight">
                        {chest.assignedStudent?.name}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-4xl drop-shadow-md">🏴‍☠️ 📦</div>
                      <div className="font-black text-[11px] text-amber-200 uppercase">
                        Rương {chest.id}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {renderResultCard()}
          </div>
        )}

        {/* 7. GAME 7: SPRINT TRACK RACE (CUỘC ĐUA ĐIỀN KINH TỐC ĐỘ) */}
        {activeGame === 'sprint_race' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                <Flag className="w-4 h-4 text-rose-500" />
                <span>Cuộc đua 4 vận động viên thần tốc - Vận động viên về đích đầu tiên sẽ gọi tên học sinh:</span>
              </div>
              <button
                onClick={() => {
                  initializeRunners();
                  setSelectedStudent(null);
                  playSound(600, 0.1, 'sine');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                <span>Xếp Lại Đội Hình</span>
              </button>
            </div>

            {/* Stadium Track Container */}
            <div className="p-5 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-slate-700 shadow-2xl space-y-3 relative overflow-hidden">
              {/* Countdown Overlay */}
              {raceStage === 'countdown' && raceCountdown !== null && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-xs z-20 flex flex-col items-center justify-center animate-fade-in">
                  <div className="text-7xl font-black text-amber-400 animate-ping">
                    {raceCountdown > 0 ? raceCountdown : 'GO!'}
                  </div>
                  <span className="text-white font-bold text-sm mt-3 tracking-wider uppercase">Chuẩn bị xuất phát...</span>
                </div>
              )}

              {/* 4 Race Lanes */}
              <div className="space-y-2.5 relative">
                {runners.map((runner) => (
                  <div
                    key={runner.id}
                    className={`relative p-2.5 rounded-2xl border border-white/10 ${runner.laneBg} flex items-center gap-3 overflow-hidden`}
                  >
                    {/* Lane Badge */}
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-black text-white text-xs shrink-0 shadow-xs">
                      #{runner.lane}
                    </div>

                    {/* Track Rail */}
                    <div className="flex-1 relative h-10 bg-slate-950/60 rounded-xl border border-white/10 overflow-hidden flex items-center px-2">
                      {/* Finish Line Tape */}
                      <div className="absolute right-3 top-0 bottom-0 w-3 bg-repeating-linear-gradient-black-white border-l-2 border-r-2 border-white/50 z-0 flex items-center justify-center">
                        <span className="text-[8px] font-black text-white rotate-90 tracking-tighter">FINISH</span>
                      </div>

                      {/* Animated Runner on Track */}
                      <div
                        className="absolute flex items-center gap-2 transition-all duration-100 ease-linear z-10"
                        style={{
                          left: `calc(${runner.progress}% * 0.85)`,
                        }}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${runner.color} flex items-center justify-center text-xl shadow-lg border border-white/30 ${
                            raceStage === 'running' ? 'animate-bounce' : ''
                          }`}
                        >
                          {runner.emoji}
                        </div>
                        <span className="text-[11px] font-black text-white bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-xs whitespace-nowrap shadow-xs">
                          {runner.name}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Controls */}
              <div className="pt-2 flex items-center justify-center">
                <button
                  onClick={handleStartRace}
                  disabled={raceStage === 'countdown' || raceStage === 'running'}
                  className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 via-amber-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-black text-sm shadow-xl shadow-orange-500/25 active:scale-95 transition-all inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Flame className="w-5 h-5 text-yellow-200 animate-pulse" />
                  <span>{raceStage === 'finish' ? 'ĐUA LẠI CHẶNG MỚI 🏁' : 'BẮT ĐẦU CUỘC ĐUA 🏁'}</span>
                </button>
              </div>
            </div>

            {renderResultCard()}
          </div>
        )}

        {/* 8. GAME 8: OCEAN FISHING (CÂU CÁ BIỂN SÂU ĐẠI DƯƠNG) */}
        {activeGame === 'ocean_fishing' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                <Fish className="w-4 h-4 text-cyan-600" />
                <span>Chạm vào chú cá đang bơi hoặc bấm thả cần câu để bắt cá may mắn:</span>
              </div>
              <button
                onClick={() => {
                  initializeFishes();
                  setSelectedStudent(null);
                  playSound(600, 0.1, 'sine');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-900 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-cyan-600" />
                <span>Thả Cá Lại Biển</span>
              </button>
            </div>

            {/* Ocean Tank */}
            <div className="p-6 rounded-3xl bg-gradient-to-b from-sky-900 via-blue-950 to-indigo-950 border-2 border-cyan-500/30 shadow-2xl relative min-h-[290px] overflow-hidden space-y-4">
              {/* Animated Floating Bubbles */}
              <div className="absolute top-2 left-6 text-xl opacity-40 animate-bounce">🫧</div>
              <div className="absolute top-8 right-12 text-2xl opacity-40 animate-pulse">🫧</div>
              <div className="absolute bottom-4 left-1/3 text-lg opacity-30 animate-bounce">🫧</div>

              {/* Status Header */}
              <div className="flex items-center justify-between text-cyan-200 text-xs font-bold border-b border-cyan-500/20 pb-2">
                <div className="flex items-center gap-1.5">
                  <span>🌊 Vịnh Biển Hoàng Gia</span>
                </div>
                <span>
                  {fishingStage === 'casting' && '🎣 Đang thả dây câu xuống biển...'}
                  {fishingStage === 'hooked' && '🐟 Cá đã cắn câu! Đang kéo lên...'}
                  {fishingStage === 'caught' && '🎉 Đã kéo được cá may mắn!'}
                  {fishingStage === 'idle' && 'Bấm chọn một chú cá bất kỳ'}
                </span>
              </div>

              {/* Swimming Fish Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 relative z-10">
                {fishes.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => handleCastFishing(f.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 select-none active:scale-95 ${
                      f.isCaught
                        ? 'bg-amber-400/20 border-amber-400 text-amber-200 shadow-lg scale-105'
                        : `bg-gradient-to-r ${f.bgGrad} border-white/10 hover:border-cyan-400 hover:scale-102 hover:shadow-lg text-white`
                    }`}
                  >
                    <div className="text-3xl animate-bounce" style={{ animationDuration: `${2 + (f.id % 3) * 0.4}s` }}>
                      {f.icon}
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs font-black tracking-wide">{f.name}</div>
                      <div className="text-[10px] text-cyan-300/80 font-bold">
                        {f.isCaught ? '✅ Đã bắt được' : 'Bơi tung tăng'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Fishing Rod Cast Button */}
              <div className="pt-2 flex items-center justify-center">
                <button
                  onClick={() => handleCastFishing()}
                  disabled={fishingStage === 'casting' || fishingStage === 'hooked'}
                  className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-black text-sm shadow-xl shadow-cyan-500/30 active:scale-95 transition-all inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Fish className="w-5 h-5 text-cyan-100" />
                  <span>THẢ CẦN CÂU BIỂN SÂU 🎣</span>
                </button>
              </div>
            </div>

            {renderResultCard()}
          </div>
        )}

        {/* 9. GAME 9: ARCHERY TARGET BULLSEYE (BẮN CUNG BÁCH PHÁT BÁCH TRÚNG) */}
        {activeGame === 'archery_target' && (
          <div className="space-y-5 text-center">
            <div className="max-w-lg mx-auto p-6 rounded-3xl bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 border-2 border-amber-500/40 shadow-2xl space-y-4">
              <div className="flex items-center justify-center gap-2 text-amber-400 font-black tracking-wider text-xs uppercase">
                <Crosshair className="w-4 h-4 text-amber-400" />
                <span>Trường Bắn Cung Thi Đấu Olympic</span>
                <Crosshair className="w-4 h-4 text-amber-400" />
              </div>

              {/* Target Board */}
              <div
                onClick={() => handleShootArchery(10)}
                className="relative w-56 h-56 mx-auto rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 select-none"
                style={{
                  background: 'radial-gradient(circle, #f59e0b 0%, #ef4444 35%, #3b82f6 60%, #1e293b 80%, #f8fafc 100%)',
                }}
              >
                {/* Target Rings */}
                <div className="w-44 h-44 rounded-full border-4 border-white/20 flex items-center justify-center">
                  <div className="w-32 h-32 rounded-full border-4 border-white/30 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full border-4 border-white/40 flex items-center justify-center bg-amber-400/90 text-slate-950 font-black text-xl shadow-inner">
                      🎯 10
                    </div>
                  </div>
                </div>

                {/* Arrow Stuck in Bullseye Animation */}
                {archeryStage === 'hit' && (
                  <div className="absolute inset-0 flex items-center justify-center animate-ping pointer-events-none">
                    <div className="w-8 h-8 rounded-full bg-yellow-300/60" />
                  </div>
                )}
              </div>

              {/* Status Display */}
              <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 min-h-[50px] flex items-center justify-center">
                {archeryStage === 'aiming' && (
                  <div className="text-amber-300 font-bold text-sm flex items-center gap-1.5 animate-pulse">
                    <Crosshair className="w-4 h-4 animate-spin" />
                    <span>Đang ngắm chuẩn hồng tâm 10 điểm...</span>
                  </div>
                )}
                {archeryStage === 'shooting' && (
                  <div className="text-cyan-300 font-black text-base animate-bounce">
                    🏹 Mũi tên xé gió lao đi... VÚT!
                  </div>
                )}
                {archeryStage === 'hit' && selectedStudent && (
                  <div className="space-y-0.5 animate-fade-in">
                    <div className="text-xs text-amber-300 font-black tracking-wide">🎯 TRÚNG HỒNG TÂM 10 ĐIỂM!</div>
                    <div className="text-2xl font-black text-emerald-300">🎉 {selectedStudent.name}</div>
                  </div>
                )}
                {archeryStage === 'idle' && (
                  <span className="text-slate-300 text-xs font-bold">Chạm vào bia bắn hoặc bấm nút bên dưới để giương cung</span>
                )}
              </div>

              <button
                onClick={() => handleShootArchery(10)}
                disabled={archeryStage === 'aiming' || archeryStage === 'shooting'}
                className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 hover:from-amber-600 hover:to-red-700 text-white font-black text-sm shadow-xl shadow-amber-500/30 active:scale-95 transition-all inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Target className="w-5 h-5 text-yellow-200" />
                <span>GIƯƠNG CUNG BẮN TÊN 🏹</span>
              </button>
            </div>

            {renderResultCard()}
          </div>
        )}

        {/* 10. GAME 10: MAGIC HAT (NÓN ẢO THUẬT THỎ TRẮNG) */}
        {activeGame === 'magic_hat' && (
          <div className="space-y-5 text-center">
            <div className="max-w-md mx-auto p-6 rounded-3xl bg-gradient-to-b from-purple-950 via-slate-900 to-slate-950 border border-purple-700 shadow-2xl space-y-4">
              <div className="text-5xl">🎩 ✨ 🐰</div>
              <h3 className="text-lg font-black text-white">NÓN ẢO THUẬT BÍ ẨN</h3>

              <div className="p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 min-h-[90px] flex items-center justify-center">
                {hatStage === 'casting' && (
                  <div className="text-purple-300 font-bold animate-pulse text-base">
                    ✨ Đang vung đũa phép niệm chú...
                  </div>
                )}
                {hatStage === 'revealed' && selectedStudent && (
                  <div className="space-y-1 animate-fade-in">
                    <div className="text-3xl">🐰 🌟</div>
                    <div className="text-2xl font-black text-purple-300">{selectedStudent.name}</div>
                  </div>
                )}
                {hatStage === 'idle' && (
                  <span className="text-slate-300 text-xs font-bold">Chạm nút để vung đũa phép gọi chú thỏ xuất hiện</span>
                )}
              </div>

              <button
                onClick={handleCastMagic}
                disabled={hatStage === 'casting'}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-sm shadow-lg shadow-purple-600/30 active:scale-95 transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <Wand2 className={`w-4 h-4 ${hatStage === 'casting' ? 'animate-spin' : ''}`} />
                <span>VUNG ĐŨA PHÉP THUẬT 🪄</span>
              </button>
            </div>

            {renderResultCard()}
          </div>
        )}
      </div>
    </div>
  );

  // Helper render winner card & quick score/points buttons
  function renderResultCard() {
    if (selectedStudent) {
      return (
        <div className="p-5 md:p-6 rounded-3xl bg-gradient-to-br from-indigo-50 to-amber-50/50 border-2 border-indigo-200 shadow-md space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 rounded-full bg-indigo-600 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
              <Trophy className="w-3.5 h-3.5 text-amber-300" />
              <span>HỌC SINH ĐƯỢC CHỌN</span>
            </span>
            <span className="text-xs font-mono font-bold text-slate-500">
              {selectedStudent.code}
            </span>
          </div>

          <div className="text-center py-1.5">
            <h3 className="text-3xl md:text-4xl font-black text-slate-900">
              {selectedStudent.name}
            </h3>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Mời em đứng lên phát biểu hoặc lên bảng thực hiện bài tập
            </p>
          </div>

          {/* Quick Grading Action Buttons */}
          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => onAddBonusPoint(selectedStudent.id, 1)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Star className="w-3.5 h-3.5" />
              <span>+1 Điểm Thưởng</span>
            </button>

            <button
              onClick={() => onAddBonusPoint(selectedStudent.id, 2)}
              className="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>+2 Điểm Thưởng</span>
            </button>

            <button
              onClick={() => onSetOralScore(selectedStudent.id, 10)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Cho 10đ Miệng</span>
            </button>
          </div>
        </div>
      );
    }

    if (selectedGroup.length > 0) {
      return (
        <div className="p-5 md:p-6 rounded-3xl bg-indigo-50 border-2 border-indigo-200 shadow-md space-y-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h4 className="font-black text-slate-900 text-base">
              DANH SÁCH NHÓM ({selectedGroup.length} HỌC SINH)
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {selectedGroup.map((st) => (
              <div
                key={st.id}
                className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-xs"
              >
                <div>
                  <span className="font-bold text-sm text-slate-900">{st.name}</span>
                  <div className="text-[10px] text-slate-500 font-mono">{st.code}</div>
                </div>
                <button
                  onClick={() => onAddBonusPoint(st.id, 1)}
                  className="px-2 py-1 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-bold cursor-pointer"
                >
                  +1đ
                </button>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  }
};
