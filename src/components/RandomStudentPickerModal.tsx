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
  Crown,
  Crosshair,
  Flag,
  Target,
  Gamepad2,
  Bomb,
  Compass,
  Plus,
  Minus,
  AlertCircle,
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
  | 'laser_battle'
  | 'time_bomb'
  | 'olympia_climb'
  | 'penalty_kick'
  | 'claw_machine'
  | 'super_darts'
  | 'cosmic_warp'
  | 'magic_cards'
  | 'golden_egg'
  | 'treasure_chest'
  | 'sprint_race'
  | 'ocean_fishing'
  | 'archery_target'
  | 'swimming_race';

interface MysteryBoxItem {
  id: number;
  color: string;
  borderColor: string;
  icon: string;
  title: string;
  assignedStudent: ClassStudent;
  isOpen: boolean;
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
  { id: 'sample_14', code: 'HS14', name: 'Mai Anh Tuấn', bonusPoints: 0, isCalled: false },
  { id: 'sample_15', code: 'HS15', name: 'Đoàn Yến Vy', bonusPoints: 0, isCalled: false },
  { id: 'sample_16', code: 'HS16', name: 'Phan Tấn Khang', bonusPoints: 0, isCalled: false },
  { id: 'sample_17', code: 'HS17', name: 'Lâm Mỹ Duyên', bonusPoints: 0, isCalled: false },
  { id: 'sample_18', code: 'HS18', name: 'Võ Minh Quân', bonusPoints: 0, isCalled: false },
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
  const [mode, setMode] = useState<'single' | 'group'>('single');
  const [groupSize, setGroupSize] = useState<number>(3);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [excludeCalled, setExcludeCalled] = useState<boolean>(false);

  // Results State
  const [selectedStudent, setSelectedStudent] = useState<ClassStudent | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ClassStudent[]>([]);
  const [scoreNotification, setScoreNotification] = useState<{
    type: 'plus' | 'minus' | 'ten' | 'zero';
    message: string;
  } | null>(null);

  // Sync selectedStudent when classroom updates
  useEffect(() => {
    if (selectedStudent && classroom?.students) {
      const updated = classroom.students.find((s) => s.id === selectedStudent.id);
      if (updated) {
        setSelectedStudent(updated);
      }
    }
  }, [classroom]);

  // Auto clear score notification
  useEffect(() => {
    if (scoreNotification) {
      const timer = setTimeout(() => {
        setScoreNotification(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [scoreNotification]);

  // Wheel State
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [currentRotation, setCurrentRotation] = useState<number>(0);

  // Mystery Box State
  const [boxes, setBoxes] = useState<MysteryBoxItem[]>([]);
  const [isShufflingBoxes, setIsShufflingBoxes] = useState<boolean>(false);

  // Space Rocket State
  const [rocketStage, setRocketStage] = useState<'idle' | 'countdown' | 'launching' | 'winner'>('idle');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [shufflingName, setShufflingName] = useState<string>('');

  // Game 4: Laser Battle Royale State
  const [battleStage, setBattleStage] = useState<'idle' | 'scanning' | 'eliminating' | 'winner'>('idle');
  const [battleSurvivors, setBattleSurvivors] = useState<string[]>([]);
  const [activeLaserTarget, setActiveLaserTarget] = useState<string | null>(null);

  // Game 5: Ticking Time Bomb State
  const [bombStage, setBombStage] = useState<'idle' | 'ticking' | 'detonated'>('idle');
  const [bombHolderId, setBombHolderId] = useState<string | null>(null);
  const [bombTicks, setBombTicks] = useState<number>(10);

  // Game 6: 🎰 SỔ XỐ JACKPOT (6s HỒI HỘP CHỌN HỌC SINH)
  const [jackpotStage, setJackpotStage] = useState<'idle' | 'rolling' | 'winner'>('idle');
  const [jackpotCountdown, setJackpotCountdown] = useState<number>(6.0);
  const [jackpotReels, setJackpotReels] = useState<string[]>(['777', 'JACKPOT', '777']);
  const jackpotIntervalRef = useRef<any>(null);

  // Game 7: Penalty Kick State
  const [penaltyStage, setPenaltyStage] = useState<'idle' | 'aiming' | 'shooting' | 'goal'>('idle');
  const [goalCorner, setGoalCorner] = useState<'top_left' | 'top_right' | 'bottom_left' | 'bottom_right'>('top_right');
  const [goalKeeperDived, setGoalKeeperDived] = useState<string>('center');

  // Game 8: Claw Machine State
  const [clawStage, setClawStage] = useState<'idle' | 'moving' | 'dropping' | 'grabbing' | 'retrieving' | 'winner'>('idle');
  const [clawPositionX, setClawPositionX] = useState<number>(50);

  // Game 9: Dart Master State
  const [dartStage, setDartStage] = useState<'idle' | 'aiming' | 'thrown' | 'bullseye'>('idle');
  const [dartCoords, setDartCoords] = useState<{ x: number; y: number }>({ x: 50, y: 50 });

  // Game 10: Cosmic Warp State
  const [warpStage, setWarpStage] = useState<'idle' | 'charging' | 'warping' | 'teleported'>('idle');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Valid student pool
  const rawRoster = classroom?.students && classroom.students.length > 0 ? classroom.students : SAMPLE_STUDENTS;
  const studentsPool = excludeCalled ? rawRoster.filter((s) => !s.isCalled) : rawRoster;
  const validStudents = studentsPool.length > 0 ? studentsPool : rawRoster;

  // Synthesized Sound Effects
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
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx * 0.1);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + idx * 0.1 + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + idx * 0.1);
        osc.stop(audioCtx.currentTime + idx * 0.1 + 0.35);
      });
    } catch (e) {}
  };

  const playExplosionSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.6);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(now + 0.6);
    } catch (e) {}
  };

  // 1. Initialize Mystery Boxes
  const initializeBoxes = () => {
    const icons = ['⭐', '💎', '🚀', '🔥', '👑', '🍀'];
    const colors = [
      'from-rose-500 to-pink-600',
      'from-indigo-500 to-blue-600',
      'from-emerald-500 to-teal-600',
      'from-amber-500 to-orange-600',
      'from-purple-500 to-violet-600',
      'from-cyan-500 to-blue-600',
    ];
    const borderColors = [
      'border-rose-400',
      'border-indigo-400',
      'border-emerald-400',
      'border-amber-400',
      'border-purple-400',
      'border-cyan-400',
    ];

    const shuffled = [...validStudents].sort(() => Math.random() - 0.5);
    const newBoxes: MysteryBoxItem[] = [];
    for (let i = 0; i < 6; i++) {
      newBoxes.push({
        id: i + 1,
        color: colors[i % colors.length],
        borderColor: borderColors[i % borderColors.length],
        icon: icons[i % icons.length],
        title: `Hộp Quà ${i + 1}`,
        assignedStudent: shuffled[i % shuffled.length],
        isOpen: false,
      });
    }
    setBoxes(newBoxes);
  };

  useEffect(() => {
    if (isOpen) {
      initializeBoxes();
      setSelectedStudent(null);
      setSelectedGroup([]);
      setIsSpinning(false);
      setBattleStage('idle');
      setBombStage('idle');
      setJackpotStage('idle');
      setPenaltyStage('idle');
      setClawStage('idle');
      setDartStage('idle');
      setWarpStage('idle');
    }
  }, [isOpen, classroom]);

  // ==========================================
  // GAME 1: WHEEL OF NAMES - 100% PRECISE POINTER
  // ==========================================
  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const wheelRadius = Math.min(centerX, centerY) - 25;

    ctx.clearRect(0, 0, width, height);

    const displayStudents = validStudents.length > 0 ? validStudents : SAMPLE_STUDENTS;
    const count = Math.max(Math.min(displayStudents.length, 24), 6);
    const sliceAngle = (2 * Math.PI) / count;

    const sliceColors = [
      '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4',
      '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6',
      '#e11d48', '#84cc16'
    ];

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(currentRotation);

    // Draw Slices
    for (let i = 0; i < count; i++) {
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, wheelRadius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = sliceColors[i % sliceColors.length];
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Text label inside slice
      ctx.save();
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      const stName = displayStudents[i % displayStudents.length]?.name || `HS ${i + 1}`;
      const truncated = stName.length > 14 ? stName.substring(0, 13) + '..' : stName;
      ctx.fillText(truncated, wheelRadius - 20, 5);
      ctx.restore();
    }

    // Outer rim & Center cap
    ctx.beginPath();
    ctx.arc(0, 0, wheelRadius, 0, 2 * Math.PI);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#fbbf24';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();

    ctx.restore();

    // Top Pointer Triangle - exactly at angle 1.5 * PI (Pointing Down)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(centerX - 14, centerY - wheelRadius - 12);
    ctx.lineTo(centerX + 14, centerY - wheelRadius - 12);
    ctx.lineTo(centerX, centerY - wheelRadius + 14);
    ctx.closePath();
    ctx.fillStyle = '#dc2626';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
  };

  useEffect(() => {
    if (activeGame === 'wheel') {
      drawWheel();
    }
  }, [activeGame, currentRotation, validStudents]);

  const handleSpinWheel = () => {
    if (isSpinning || validStudents.length === 0) return;
    setIsSpinning(true);
    setSelectedStudent(null);
    setSelectedGroup([]);

    if (mode === 'group') {
      let step = 0;
      const interval = setInterval(() => {
        playSound(400 + Math.random() * 400, 0.04, 'sine');
        setCurrentRotation((prev) => prev + 0.3);
        step++;
        if (step > 25) {
          clearInterval(interval);
          setIsSpinning(false);
          const shuffled = [...validStudents].sort(() => Math.random() - 0.5);
          const group = shuffled.slice(0, Math.min(groupSize, shuffled.length));
          setSelectedGroup(group);
          playVictorySound();
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        }
      }, 80);
      return;
    }

    const count = Math.max(Math.min(validStudents.length, 24), 6);
    const sliceAngle = (2 * Math.PI) / count;
    const winnerIndex = Math.floor(Math.random() * Math.min(validStudents.length, count));

    // Pointer is at TOP center (angle 1.5 * PI).
    // Local angle of slice i center is: i * sliceAngle + sliceAngle / 2.
    // When wheel rotates by R, angle at pointer in wheel coords is (1.5*PI - R) mod 2*PI.
    // We want (1.5*PI - R) = winnerIndex * sliceAngle + sliceAngle / 2 (mod 2*PI).
    // Therefore desired R mod 2*PI is:
    const targetSliceCenter = winnerIndex * sliceAngle + sliceAngle / 2;
    let desiredTargetMod = (1.5 * Math.PI - targetSliceCenter) % (2 * Math.PI);
    if (desiredTargetMod < 0) desiredTargetMod += 2 * Math.PI;

    let currentMod = currentRotation % (2 * Math.PI);
    if (currentMod < 0) currentMod += 2 * Math.PI;

    let delta = desiredTargetMod - currentMod;
    if (delta <= 0) delta += 2 * Math.PI;

    const fullSpins = (6 + Math.floor(Math.random() * 3)) * (2 * Math.PI);
    const totalRotation = currentRotation + fullSpins + delta;

    const startTime = performance.now();
    const duration = 4000;
    const startRot = currentRotation;
    let lastTickAngle = startRot;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = startRot + (totalRotation - startRot) * ease;
      setCurrentRotation(current);

      if (Math.abs(current - lastTickAngle) >= sliceAngle) {
        playSound(850, 0.03, 'sine');
        lastTickAngle = current;
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        // Guaranteed exact match: calculate the slice directly under the pointer
        const finalNormalizedAngle = ((1.5 * Math.PI - (totalRotation % (2 * Math.PI))) + 4 * Math.PI) % (2 * Math.PI);
        const actualIndex = Math.floor(finalNormalizedAngle / sliceAngle) % count;
        const winner = validStudents[actualIndex] || validStudents[winnerIndex] || validStudents[0];
        setSelectedStudent(winner);
        playVictorySound();
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
        });
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  // ==========================================
  // GAME 2: MYSTERY BOXES
  // ==========================================
  const handleOpenBox = (boxId: number) => {
    if (isShufflingBoxes) return;
    const box = boxes.find((b) => b.id === boxId);
    if (!box || box.isOpen) return;

    playSound(600, 0.1, 'sine');
    setBoxes((prev) => prev.map((b) => (b.id === boxId ? { ...b, isOpen: true } : b)));

    if (box.assignedStudent) {
      setSelectedStudent(box.assignedStudent);
      playVictorySound();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  };

  const handleShuffleBoxes = () => {
    setIsShufflingBoxes(true);
    setSelectedStudent(null);
    setSelectedGroup([]);
    playSound(400, 0.1, 'sawtooth');
    let counter = 0;
    const interval = setInterval(() => {
      playSound(300 + Math.random() * 400, 0.04, 'square');
      counter++;
      if (counter > 8) {
        clearInterval(interval);
        initializeBoxes();
        setIsShufflingBoxes(false);
        playSound(800, 0.1, 'sine');
      }
    }, 100);
  };

  // ==========================================
  // GAME 3: SPACE ROCKET LAUNCH
  // ==========================================
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
          playSound(200, 1.8, 'sawtooth');

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

  // ==========================================
  // GAME 4: ⚡ ĐẤU TRƯỜNG SINH TỒN (BATTLE ROYALE LASER)
  // ==========================================
  const handleStartBattleRoyale = () => {
    if (battleStage === 'scanning' || battleStage === 'eliminating' || validStudents.length === 0) return;
    setSelectedStudent(null);
    setBattleStage('scanning');

    // Pick 12 contestants
    const shuffled = [...validStudents].sort(() => Math.random() - 0.5);
    const contestants = shuffled.slice(0, Math.min(12, shuffled.length));
    setBattleSurvivors(contestants.map((s) => s.id));

    let scanCount = 0;
    const scanInterval = setInterval(() => {
      const randomC = contestants[Math.floor(Math.random() * contestants.length)];
      setActiveLaserTarget(randomC.id);
      playSound(700 + Math.random() * 300, 0.05, 'sawtooth');
      scanCount++;
      if (scanCount > 10) {
        clearInterval(scanInterval);
        setBattleStage('eliminating');

        // Eliminate one by one until 1 survivor
        let currentSurvivors = [...contestants.map((s) => s.id)];
        const elimInterval = setInterval(() => {
          if (currentSurvivors.length > 1) {
            const victimIdx = Math.floor(Math.random() * currentSurvivors.length);
            const victimId = currentSurvivors[victimIdx];
            currentSurvivors = currentSurvivors.filter((id) => id !== victimId);
            setBattleSurvivors([...currentSurvivors]);
            playSound(180, 0.15, 'sawtooth'); // Shield break sound
          } else {
            clearInterval(elimInterval);
            const winnerId = currentSurvivors[0];
            const winner = contestants.find((s) => s.id === winnerId) || contestants[0];
            setSelectedStudent(winner);
            setBattleStage('winner');
            playVictorySound();
            confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } });
          }
        }, 320);
      }
    }, 120);
  };

  // ==========================================
  // GAME 5: 💣 TRUYỀN BOM HẸN GIỜ (TICKING TIME BOMB)
  // ==========================================
  const handleStartBomb = () => {
    if (bombStage === 'ticking' || validStudents.length === 0) return;
    setSelectedStudent(null);
    setBombStage('ticking');
    setBombTicks(12);

    let ticksLeft = 12;
    let speed = 250;

    const tick = () => {
      const randomHolder = validStudents[Math.floor(Math.random() * validStudents.length)];
      setBombHolderId(randomHolder.id);
      playSound(500 + (12 - ticksLeft) * 50, 0.06, 'triangle');
      ticksLeft--;
      setBombTicks(ticksLeft);

      if (ticksLeft > 0) {
        speed = Math.max(70, speed * 0.88);
        setTimeout(tick, speed);
      } else {
        // BOOOM!
        playExplosionSound();
        setBombStage('detonated');
        setSelectedStudent(randomHolder);
        confetti({ particleCount: 160, spread: 100, origin: { y: 0.55 } });
      }
    };

    setTimeout(tick, speed);
  };

  // ==========================================
  // GAME 6: 🎰 SỔ XỐ JACKPOT (6s HỒI HỘP CHỌN HỌC SINH)
  // ==========================================
  const handleRollJackpot = () => {
    if (jackpotStage === 'rolling' || validStudents.length === 0) return;
    setSelectedStudent(null);
    setSelectedGroup([]);
    setJackpotStage('rolling');
    setJackpotCountdown(6.0);

    const startTime = performance.now();
    const duration = 6000; // Exact 6 seconds
    let lastTickTime = 0;

    const interval = setInterval(() => {
      const now = performance.now();
      const elapsed = now - startTime;
      const remaining = Math.max(0, duration - elapsed);
      const remainingSec = Math.round((remaining / 1000) * 10) / 10;
      setJackpotCountdown(remainingSec);

      // Fast rolling student names across 3 jackpot reels
      const s1 = validStudents[Math.floor(Math.random() * validStudents.length)].name;
      const s2 = validStudents[Math.floor(Math.random() * validStudents.length)].name;
      const s3 = validStudents[Math.floor(Math.random() * validStudents.length)].name;
      setJackpotReels([s1, s2, s3]);

      // Sound ticker: rapid casino slot clicks that pitch up and slow down during final 1.5s
      const tickInterval = remaining < 1500 ? 140 : remaining < 3000 ? 80 : 45;
      if (now - lastTickTime > tickInterval) {
        const pitchClimb = 400 + Math.floor(((6000 - remaining) / 6000) * 500);
        playSound(pitchClimb + Math.random() * 80, 0.035, 'square');
        lastTickTime = now;
      }

      if (remaining <= 0) {
        clearInterval(interval);
        // Jackpot Stop!
        if (mode === 'single') {
          const winner = validStudents[Math.floor(Math.random() * validStudents.length)];
          setSelectedStudent(winner);
          setSelectedGroup([winner]);
          setJackpotReels([winner.name, '🏆 JACKPOT 🏆', winner.name]);
        } else {
          const shuffled = [...validStudents].sort(() => Math.random() - 0.5);
          const targetCount = groupSize >= validStudents.length ? validStudents.length : Math.max(1, groupSize);
          const groupWinners = shuffled.slice(0, targetCount);
          setSelectedGroup(groupWinners);
          if (groupWinners.length > 0) {
            setSelectedStudent(groupWinners[0]);
          }
          setJackpotReels([
            groupWinners[0]?.name || 'TRÚNG SỐ',
            `🎉 ${groupWinners.length} HỌC SINH 🎉`,
            groupWinners[1]?.name || groupWinners[0]?.name || 'JACKPOT'
          ]);
        }

        setJackpotStage('winner');
        playVictorySound();
        confetti({
          particleCount: 220,
          spread: 110,
          origin: { y: 0.5 },
        });
      }
    }, 45);

    jackpotIntervalRef.current = interval;
  };

  // ==========================================
  // GAME 7: ⚽ SÚT PENALTY WORLD CUP
  // ==========================================
  const handleShootPenalty = (corner: 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right') => {
    if (penaltyStage === 'shooting' || validStudents.length === 0) return;
    setSelectedStudent(null);
    setGoalCorner(corner);
    setPenaltyStage('shooting');
    playSound(400, 0.1, 'sawtooth'); // Kick whoosh!

    // Goalkeeper dives opposite corner for guaranteed epic GOAL!
    const oppositeCorners: Record<string, string> = {
      top_left: 'bottom_right',
      top_right: 'bottom_left',
      bottom_left: 'top_right',
      bottom_right: 'top_left',
    };
    setGoalKeeperDived(oppositeCorners[corner]);

    setTimeout(() => {
      // VÀOOO!
      playSound(800, 0.4, 'triangle');
      setPenaltyStage('goal');
      const striker = validStudents[Math.floor(Math.random() * validStudents.length)];
      setSelectedStudent(striker);
      playVictorySound();
      confetti({ particleCount: 180, spread: 100, origin: { y: 0.6 } });
    }, 700);
  };

  // ==========================================
  // GAME 8: 🕹️ MÁY GẮP THÚ BÔNG ARCADE (CLAW MACHINE)
  // ==========================================
  const handleDropClaw = () => {
    if (clawStage !== 'idle' || validStudents.length === 0) return;
    setSelectedStudent(null);
    setClawStage('moving');
    playSound(420, 0.2, 'sine');

    setTimeout(() => {
      setClawStage('dropping');
      playSound(300, 0.3, 'sawtooth');

      setTimeout(() => {
        setClawStage('grabbing');
        playSound(700, 0.15, 'triangle');

        setTimeout(() => {
          setClawStage('retrieving');
          playSound(550, 0.3, 'sine');

          setTimeout(() => {
            setClawStage('winner');
            const winner = validStudents[Math.floor(Math.random() * validStudents.length)];
            setSelectedStudent(winner);
            playVictorySound();
            confetti({ particleCount: 140, spread: 80, origin: { y: 0.55 } });
          }, 800);
        }, 600);
      }, 700);
    }, 500);
  };

  // ==========================================
  // GAME 9: 🎯 PHI TIÊU CAO THỦ HỒNG TÂM (DART MASTER)
  // ==========================================
  const handleThrowDart = () => {
    if (dartStage !== 'idle' || validStudents.length === 0) return;
    setSelectedStudent(null);
    setDartStage('thrown');
    playSound(880, 0.08, 'sawtooth'); // Whoosh!

    setTimeout(() => {
      setDartCoords({ x: 50, y: 50 }); // Bulls-Eye dead center!
      setDartStage('bullseye');
      playSound(600, 0.18, 'triangle'); // Thud into dartboard!
      const winner = validStudents[Math.floor(Math.random() * validStudents.length)];
      setSelectedStudent(winner);
      playVictorySound();
      confetti({ particleCount: 150, spread: 85, origin: { y: 0.55 } });
    }, 600);
  };

  // ==========================================
  // GAME 10: 🌌 CHIẾN HẠM KHÔNG GIAN HYPERSPACE
  // ==========================================
  const handleTriggerWarp = () => {
    if (warpStage !== 'idle' || validStudents.length === 0) return;
    setSelectedStudent(null);
    setWarpStage('charging');
    playSound(260, 0.4, 'sawtooth');

    setTimeout(() => {
      setWarpStage('warping');
      playSound(500, 1.2, 'sawtooth');

      setTimeout(() => {
        setWarpStage('teleported');
        const captain = validStudents[Math.floor(Math.random() * validStudents.length)];
        setSelectedStudent(captain);
        playVictorySound();
        confetti({ particleCount: 180, spread: 95, origin: { y: 0.5 } });
      }, 1300);
    }, 600);
  };

  // Handler for awarding/deducting bonus points
  const handleAwardBonus = (pts: number) => {
    if (!selectedStudent) return;
    onAddBonusPoint(selectedStudent.id, pts);
    setSelectedStudent((prev) =>
      prev
        ? {
            ...prev,
            bonusPoints: (prev.bonusPoints || 0) + pts,
            isCalled: true,
          }
        : null
    );
    if (pts > 0) {
      playSound(880, 0.15, 'triangle');
      setScoreNotification({
        type: 'plus',
        message: `🎉 Đã khen thưởng +${pts} điểm cho em ${selectedStudent.name}!`,
      });
    } else {
      playSound(240, 0.25, 'sawtooth');
      setScoreNotification({
        type: 'minus',
        message: `⚠️ Đã trừ ${pts} điểm của em ${selectedStudent.name}!`,
      });
    }
  };

  // Handler for setting oral score (e.g. 0đ or 10đ)
  const handleAwardOral = (score: number) => {
    if (!selectedStudent) return;
    onSetOralScore(selectedStudent.id, score);
    setSelectedStudent((prev) =>
      prev
        ? {
            ...prev,
            oralScore: score,
            isCalled: true,
          }
        : null
    );
    if (score === 10) {
      playVictorySound();
      try {
        confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 } });
      } catch (e) {}
      setScoreNotification({
        type: 'ten',
        message: `👑 Xuất sắc! Đã chấm 10 điểm cho em ${selectedStudent.name}!`,
      });
    } else if (score === 0) {
      playSound(180, 0.35, 'sawtooth');
      setScoreNotification({
        type: 'zero',
        message: `❌ Đã chấm 0 điểm cho em ${selectedStudent.name}!`,
      });
    } else {
      playSound(600, 0.15, 'triangle');
      setScoreNotification({
        type: 'plus',
        message: `Đã chấm ${score} điểm cho em ${selectedStudent.name}!`,
      });
    }
  };

  // Handler for group mode bonus
  const handleGroupBonus = (pts: number) => {
    if (selectedGroup.length === 0) return;
    selectedGroup.forEach((st) => onAddBonusPoint(st.id, pts));
    setSelectedGroup((prev) =>
      prev.map((st) => ({
        ...st,
        bonusPoints: (st.bonusPoints || 0) + pts,
        isCalled: true,
      }))
    );
    if (pts > 0) {
      playSound(880, 0.15, 'triangle');
      setScoreNotification({
        type: 'plus',
        message: `🎉 Đã khen thưởng +${pts} điểm cho cả nhóm (${selectedGroup.length} học sinh)!`,
      });
    } else {
      playSound(240, 0.25, 'sawtooth');
      setScoreNotification({
        type: 'minus',
        message: `⚠️ Đã trừ ${pts} điểm của cả nhóm (${selectedGroup.length} học sinh)!`,
      });
    }
  };

  if (!isOpen) return null;

  // Render Result Card
  const renderResultCard = () => {
    if (!selectedStudent && selectedGroup.length === 0) return null;

    return (
      <div className="mt-6 p-5 md:p-6 rounded-3xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-white/20">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5">
          {/* Student Info Card */}
          <div className="flex items-center gap-4 text-left">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl md:text-4xl shadow-inner shrink-0 border border-white/30">
              {mode === 'single' ? '👑' : '👥'}
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-amber-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{mode === 'single' ? 'HỌC SINH ĐƯỢC CHỌN TRẢ LỜI' : 'NHÓM HỌC SINH ĐƯỢC CHỌN'}</span>
              </div>
              {mode === 'single' && selectedStudent ? (
                <>
                  <div className="text-2xl md:text-3xl font-black text-white drop-shadow-sm flex items-center gap-2.5 flex-wrap">
                    <span>{selectedStudent.name}</span>
                    {selectedStudent.code && (
                      <span className="text-xs px-2 py-0.5 rounded-lg bg-black/25 font-mono text-amber-100 font-bold border border-white/10">
                        {selectedStudent.code}
                      </span>
                    )}
                  </div>
                  {/* Current points status */}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-white/20 backdrop-blur-md text-amber-100 flex items-center gap-1">
                      <span>Thi đua:</span>
                      <strong className="text-white font-black">
                        {(selectedStudent.bonusPoints || 0) > 0 ? `+${selectedStudent.bonusPoints}` : (selectedStudent.bonusPoints || 0)} đ
                      </strong>
                    </span>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-white/20 backdrop-blur-md text-amber-100 flex items-center gap-1">
                      <span>Điểm miệng:</span>
                      <strong className="text-white font-black">
                        {selectedStudent.oralScore !== undefined && selectedStudent.oralScore !== null
                          ? `${selectedStudent.oralScore} đ`
                          : 'Chưa chấm'}
                      </strong>
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-base md:text-lg font-bold text-white flex flex-wrap gap-2 mt-1">
                  {selectedGroup.map((s, idx) => (
                    <span key={s.id} className="px-3 py-1 rounded-xl bg-white/20 backdrop-blur-md text-xs md:text-sm font-black border border-white/20">
                      {idx + 1}. {s.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Scoring Controls: Trừ Điểm & Khen Thưởng */}
          {mode === 'single' && selectedStudent && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-black/25 p-3 rounded-2xl border border-white/20 backdrop-blur-md">
              {/* PHẦN TRỪ ĐIỂM (-1, -2, 0 đ) */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-rose-200 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-300" />
                  <span>Trừ điểm:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleAwardBonus(-1)}
                    className="px-3 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 active:scale-95 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1 border border-rose-400/40"
                    title="Trừ 1 điểm thi đua (-1 đ)"
                  >
                    <span>-1 đ</span>
                  </button>
                  <button
                    onClick={() => handleAwardBonus(-2)}
                    className="px-3 py-2 rounded-xl bg-rose-700/90 hover:bg-rose-600 active:scale-95 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1 border border-rose-400/40"
                    title="Trừ 2 điểm thi đua (-2 đ)"
                  >
                    <span>-2 đ</span>
                  </button>
                  <button
                    onClick={() => handleAwardOral(0)}
                    className="px-3 py-2 rounded-xl bg-slate-900/95 hover:bg-black active:scale-95 text-rose-300 font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1 border border-rose-500/60"
                    title="Chấm 0 điểm kiểm tra miệng / không trả lời được (0 đ)"
                  >
                    <span>0 đ</span>
                  </button>
                </div>
              </div>

              {/* Vertical Divider */}
              <div className="hidden sm:block w-px h-11 bg-white/20 self-center" />

              {/* PHẦN KHEN THƯỞNG (+1, +2, 10 đ) */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-200 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
                  <span>Khen thưởng:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleAwardBonus(1)}
                    className="px-3 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1 border border-emerald-400/40"
                    title="Khen thưởng +1 điểm thi đua (+1 đ)"
                  >
                    <span>+1 đ</span>
                  </button>
                  <button
                    onClick={() => handleAwardBonus(2)}
                    className="px-3 py-2 rounded-xl bg-emerald-700/90 hover:bg-emerald-600 active:scale-95 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1 border border-emerald-400/40"
                    title="Khen thưởng +2 điểm thi đua (+2 đ)"
                  >
                    <span>+2 đ</span>
                  </button>
                  <button
                    onClick={() => handleAwardOral(10)}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950 font-black text-xs shadow-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-amber-200"
                    title="Chấm 10 điểm kiểm tra miệng / bài cũ xuất sắc (10 đ)"
                  >
                    <Crown className="w-3.5 h-3.5 text-slate-950" />
                    <span>10 đ</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Group Mode Scoring Controls */}
          {mode === 'group' && selectedGroup.length > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-black/25 p-3 rounded-2xl border border-white/20 backdrop-blur-md">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-200">Trừ cả nhóm:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleGroupBonus(-1)}
                    className="px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer active:scale-95 transition-all"
                  >
                    -1 đ
                  </button>
                  <button
                    onClick={() => handleGroupBonus(-2)}
                    className="px-3 py-1.5 rounded-xl bg-rose-700/90 hover:bg-rose-600 text-white font-bold text-xs cursor-pointer active:scale-95 transition-all"
                  >
                    -2 đ
                  </button>
                </div>
              </div>
              <div className="hidden sm:block w-px h-8 bg-white/20" />
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200">Thưởng cả nhóm:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleGroupBonus(1)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer active:scale-95 transition-all"
                  >
                    +1 đ
                  </button>
                  <button
                    onClick={() => handleGroupBonus(2)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-700/90 hover:bg-emerald-600 text-white font-bold text-xs cursor-pointer active:scale-95 transition-all"
                  >
                    +2 đ
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Score notification banner */}
        {scoreNotification && (
          <div className="mt-3.5 px-4 py-2.5 rounded-2xl bg-white/95 text-slate-900 font-bold text-xs shadow-xl flex items-center justify-between border border-white animate-in slide-in-from-top-2">
            <span className="flex items-center gap-2">
              {scoreNotification.type === 'ten' && '👑'}
              {scoreNotification.type === 'plus' && '🎉'}
              {scoreNotification.type === 'minus' && '⚠️'}
              {scoreNotification.type === 'zero' && '❌'}
              <span className="text-slate-800">{scoreNotification.message}</span>
            </span>
            <button
              onClick={() => setScoreNotification(null)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer ml-3 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <Dices className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">VÒNG QUAY MAY MẮN & GỌI HỌC SINH</h2>
              <p className="text-xs text-slate-500 font-medium">
                10 trò chơi ngẫu nhiên sinh động cho lớp học & màn hình Tivi 75 inch
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled((prev) => !prev)}
              className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-200/60 transition-all cursor-pointer"
              title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5 text-indigo-600" /> : <VolumeX className="w-5 h-5 text-slate-400" />}
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 10 Games Selection Tabs Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-2 bg-slate-100 border-b border-slate-200 smooth-touch-scroll shrink-0">
          {[
            { id: 'wheel' as GameType, icon: '🎡', label: '1. Vòng Quay' },
            { id: 'mystery_box' as GameType, icon: '🎁', label: '2. Hộp Quà' },
            { id: 'space_rocket' as GameType, icon: '🚀', label: '3. Tên Lửa' },
            { id: 'laser_battle' as GameType, icon: '⚡', label: '4. Đấu Trường' },
            { id: 'time_bomb' as GameType, icon: '💣', label: '5. Truyền Bom' },
            { id: 'olympia_climb' as GameType, icon: '🎰', label: '6. Xổ Số Jackpot (6s)' },
            { id: 'penalty_kick' as GameType, icon: '⚽', label: '7. Sút Penalty' },
            { id: 'claw_machine' as GameType, icon: '🕹️', label: '8. Gắp Thú' },
            { id: 'super_darts' as GameType, icon: '🎯', label: '9. Phi Tiêu' },
            { id: 'cosmic_warp' as GameType, icon: '🌌', label: '10. Chiến Hạm' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveGame(tab.id);
                setSelectedStudent(null);
                setSelectedGroup([]);
              }}
              className={`px-3 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                activeGame === tab.id
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200 scale-[1.03]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Sub-controls bar: Calling Options 1, 2, 3, 4, 5... Tất Cả Các Em */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 md:px-6 py-2 bg-slate-50 border-b border-slate-200 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Lớp: {classroom?.name || 'Mặc định'}</span>
            <span className="text-slate-300">|</span>
            <span className="font-medium text-slate-500">{validStudents.length} học sinh</span>
          </div>

          {/* Caller Options: 1, 2, 3, 4, 5, Custom (+/-), Tất Cả Các Em */}
          <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-black uppercase text-indigo-700 px-1.5">Gọi:</span>
            {[1, 2, 3, 4, 5].map((count) => {
              const isActive = (count === 1 && mode === 'single') || (mode === 'group' && groupSize === count);
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => {
                    if (count === 1) {
                      setMode('single');
                      setGroupSize(1);
                    } else {
                      setMode('group');
                      setGroupSize(count);
                    }
                    setSelectedStudent(null);
                    setSelectedGroup([]);
                  }}
                  className={`px-2.5 py-1 rounded-xl font-black text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {count} Em
                </button>
              );
            })}

            {/* Custom counter (+ / -) */}
            <div className="flex items-center gap-1 border-l border-slate-200 pl-1.5 ml-1">
              <button
                type="button"
                onClick={() => {
                  setMode('group');
                  setGroupSize((prev) => Math.max(1, prev - 1));
                  setSelectedStudent(null);
                  setSelectedGroup([]);
                }}
                className="w-5 h-5 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 text-xs font-black cursor-pointer"
                title="Giảm số học sinh gọi"
              >
                -
              </button>
              <span className="font-mono text-xs font-bold text-indigo-700 min-w-5 text-center">
                {mode === 'single' ? 1 : groupSize}
              </span>
              <button
                type="button"
                onClick={() => {
                  setMode('group');
                  setGroupSize((prev) => Math.min(validStudents.length, prev + 1));
                  setSelectedStudent(null);
                  setSelectedGroup([]);
                }}
                className="w-5 h-5 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 text-xs font-black cursor-pointer"
                title="Tăng số học sinh gọi"
              >
                +
              </button>
            </div>

            {/* Tất Cả Các Em Button */}
            <button
              type="button"
              onClick={() => {
                setMode('group');
                setGroupSize(validStudents.length);
                setSelectedStudent(null);
                setSelectedGroup([]);
              }}
              className={`px-2.5 py-1 rounded-xl font-black text-xs transition-all cursor-pointer ml-1 ${
                mode === 'group' && groupSize >= validStudents.length
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs'
                  : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
              }`}
              title="Gọi ngẫu nhiên tất cả học sinh cả lớp"
            >
              Tất Cả ({validStudents.length} Em)
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
          {/* 1. WHEEL OF NAMES */}
          {activeGame === 'wheel' && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={380}
                  height={380}
                  className="rounded-full shadow-2xl bg-white border-4 border-amber-300"
                />
              </div>
              <button
                onClick={handleSpinWheel}
                disabled={isSpinning}
                className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-black text-base shadow-lg shadow-orange-500/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <RotateCw className={`w-5 h-5 ${isSpinning ? 'animate-spin' : ''}`} />
                <span>{isSpinning ? 'ĐANG QUAY VÒNG...' : 'QUAY THƯỞNG NGAY'}</span>
              </button>
            </div>
          )}

          {/* 2. MYSTERY BOXES */}
          {activeGame === 'mystery_box' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={handleShuffleBoxes}
                  disabled={isShufflingBoxes}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center gap-1.5 hover:bg-indigo-100 transition-all cursor-pointer"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Xáo lại 6 hộp quà</span>
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {boxes.map((box) => (
                  <button
                    key={box.id}
                    onClick={() => handleOpenBox(box.id)}
                    className={`h-36 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 p-3 transition-all cursor-pointer ${
                      box.isOpen
                        ? 'bg-white border-amber-400 shadow-md'
                        : `bg-gradient-to-br ${box.color} border-white/40 shadow-lg hover:scale-105 active:scale-95 text-white`
                    }`}
                  >
                    {box.isOpen ? (
                      <div className="text-center">
                        <div className="text-2xl mb-1">🎁✨</div>
                        <div className="font-black text-xs text-slate-900 leading-tight">
                          {box.assignedStudent?.name}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="text-4xl mb-1">{box.icon}</div>
                        <div className="font-black text-xs uppercase tracking-wider">
                          {box.title}
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. SPACE ROCKET */}
          {activeGame === 'space_rocket' && (
            <div className="flex flex-col items-center justify-center p-6 space-y-6 text-center">
              <div className="w-32 h-32 rounded-3xl bg-indigo-950 border-2 border-indigo-500/30 flex items-center justify-center shadow-xl relative overflow-hidden">
                {rocketStage === 'launching' ? (
                  <Rocket className="w-16 h-16 text-amber-400 animate-bounce" />
                ) : (
                  <Rocket className="w-16 h-16 text-indigo-400" />
                )}
              </div>

              {rocketStage === 'countdown' && countdown !== null && (
                <div className="text-6xl font-black text-orange-500 animate-ping">{countdown}</div>
              )}

              {rocketStage === 'launching' && (
                <div className="text-xl font-black text-indigo-700 animate-pulse">{shufflingName}</div>
              )}

              {rocketStage === 'idle' && (
                <button
                  onClick={handleLaunchRocket}
                  className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base shadow-lg shadow-indigo-600/25 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Rocket className="w-5 h-5" />
                  <span>PHÓNG TÀU VŨ TRỤ GỌI HỌC SINH</span>
                </button>
              )}
            </div>
          )}

          {/* 4. ⚡ ĐẤU TRƯỜNG SINH TỒN (BATTLE ROYALE LASER) */}
          {(activeGame === 'laser_battle' || activeGame === 'magic_cards') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-600 uppercase">
                  ⚡ Quét laser & hạ gục khiên năng lượng - Người sống sót cuối cùng chiến thắng:
                </div>
                <button
                  onClick={handleStartBattleRoyale}
                  disabled={battleStage === 'scanning' || battleStage === 'eliminating'}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-black text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Zap className="w-4 h-4 text-yellow-300" />
                  <span>KÍCH HOẠT ĐẤU TRƯỜNG ⚡</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {validStudents.slice(0, 12).map((st) => {
                  const isAlive = battleSurvivors.includes(st.id);
                  const isTargeted = activeLaserTarget === st.id;
                  return (
                    <div
                      key={st.id}
                      className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center min-h-[105px] ${
                        !isAlive && battleStage !== 'idle'
                          ? 'bg-slate-100 border-slate-200 opacity-30 grayscale scale-95'
                          : isTargeted
                          ? 'bg-red-50 border-red-500 shadow-lg shadow-red-500/20 scale-105 ring-2 ring-red-400'
                          : 'bg-white border-slate-200 shadow-xs'
                      }`}
                    >
                      <div className="text-2xl mb-1">
                        {!isAlive && battleStage !== 'idle' ? '💥' : '🛡️'}
                      </div>
                      <div className="font-bold text-xs text-slate-800 leading-tight truncate w-full">
                        {st.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {!isAlive && battleStage !== 'idle' ? 'ĐÃ BỊ HẠ' : '100% KHIÊN'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. 💣 TRUYỀN BOM HẸN GIỜ */}
          {(activeGame === 'time_bomb' || activeGame === 'golden_egg') && (
            <div className="flex flex-col items-center justify-center p-6 space-y-6 text-center">
              <div className="relative">
                <div className={`w-36 h-36 rounded-full bg-slate-900 border-4 flex items-center justify-center text-6xl shadow-2xl transition-all ${
                  bombStage === 'ticking'
                    ? 'border-orange-500 animate-bounce scale-110'
                    : bombStage === 'detonated'
                    ? 'border-red-600 scale-125'
                    : 'border-slate-700'
                }`}>
                  {bombStage === 'detonated' ? '💥' : '💣'}
                </div>
                {bombStage === 'ticking' && (
                  <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-red-600 text-white font-black text-sm flex items-center justify-center animate-ping">
                    {bombTicks}
                  </div>
                )}
              </div>

              {bombStage === 'ticking' && bombHolderId && (
                <div className="text-xl font-black text-rose-600 animate-pulse">
                  Bom đang ở tay: {validStudents.find((s) => s.id === bombHolderId)?.name || '...'}
                </div>
              )}

              {bombStage === 'idle' && (
                <button
                  onClick={handleStartBomb}
                  className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-black text-base shadow-lg shadow-rose-600/25 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Bomb className="w-5 h-5 text-yellow-300" />
                  <span>CHÂM NGÒI NỔ TRUYỀN BOM</span>
                </button>
              )}
            </div>
          )}

          {/* 6. 🎰 SỔ XỐ JACKPOT 777 (6s HỒI HỘP CHỌN HỌC SINH) */}
          {(activeGame === 'olympia_climb' || activeGame === 'treasure_chest') && (
            <div className="flex flex-col items-center justify-center p-4 md:p-6 space-y-6 text-center max-w-2xl mx-auto animate-fade-in">
              {/* Jackpot Header & Prize Banner */}
              <div className="w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 p-3 rounded-2xl shadow-lg border-2 border-amber-300 flex items-center justify-between text-slate-950">
                <div className="flex items-center gap-2">
                  <span className="text-2xl animate-bounce">🎰</span>
                  <div className="text-left">
                    <span className="font-black text-sm uppercase tracking-wider block">
                      MÁY QUAY SỔ XỐ JACKPOT 777
                    </span>
                    <span className="text-[11px] font-bold opacity-80">
                      Tên học sinh chạy liên tục • Chốt hạ người may mắn sau đúng 6 giây
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950/90 text-amber-300 px-3 py-1.5 rounded-xl font-mono font-black text-sm border border-amber-400/50 shadow-inner">
                  <span>⏱️</span>
                  <span>{jackpotStage === 'rolling' ? `${jackpotCountdown.toFixed(1)}s` : '6.0s'}</span>
                </div>
              </div>

              {/* 3-Reel Jackpot Slot Machine Container */}
              <div className="w-full bg-slate-900 border-4 border-amber-500/80 rounded-3xl p-5 shadow-[0_0_45px_rgba(245,158,11,0.35)] relative overflow-hidden space-y-4">
                {/* Flashing LED bulbs along the top */}
                <div className="flex justify-between items-center px-2">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full transition-all duration-200 ${
                        jackpotStage === 'rolling'
                          ? i % 2 === 0
                            ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                            : 'bg-yellow-200 shadow-[0_0_8px_#fef08a]'
                          : 'bg-amber-600/40'
                      }`}
                    />
                  ))}
                </div>

                {/* 3 Slot Reels Display Window */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950 p-4 rounded-2xl border-2 border-amber-500/40 shadow-inner">
                  {jackpotReels.map((reelText, idx) => (
                    <div
                      key={idx}
                      className={`h-24 sm:h-28 rounded-xl bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-2 flex flex-col items-center justify-center p-2.5 transition-all shadow-md select-none ${
                        jackpotStage === 'rolling'
                          ? 'border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)] scale-102'
                          : jackpotStage === 'winner'
                          ? 'border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                          : 'border-slate-700'
                      }`}
                    >
                      <div className="text-[10px] font-mono font-bold text-amber-400 mb-1">
                        CỘT #{idx + 1}
                      </div>
                      <div
                        className={`font-black text-base sm:text-lg text-center truncate max-w-full px-1 ${
                          jackpotStage === 'rolling'
                            ? 'text-yellow-300 blur-[0.5px] animate-pulse'
                            : jackpotStage === 'winner'
                            ? 'text-emerald-300'
                            : 'text-white'
                        }`}
                      >
                        {reelText}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom LED Bulbs */}
                <div className="flex justify-between items-center px-2">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full transition-all duration-200 ${
                        jackpotStage === 'rolling'
                          ? i % 2 === 1
                            ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                            : 'bg-yellow-200 shadow-[0_0_8px_#fef08a]'
                          : 'bg-amber-600/40'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Start Rolling Button */}
              {jackpotStage === 'rolling' ? (
                <div className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-amber-500/20 border-2 border-amber-400 text-amber-300 font-black text-base animate-pulse">
                  <RotateCw className="w-5 h-5 animate-spin" />
                  <span>ĐANG QUAY SỔ XỐ... {jackpotCountdown.toFixed(1)}s</span>
                </div>
              ) : (
                <button
                  onClick={handleRollJackpot}
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-base shadow-xl shadow-amber-500/30 active:scale-95 transition-all cursor-pointer flex items-center gap-2.5"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>
                    {jackpotStage === 'winner' ? 'QUAY LẠI LẦN NỮA (6s)' : 'BẮT ĐẦU QUAY SỔ XỐ JACKPOT (6s)'}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* 7. ⚽ SÚT PENALTY WORLD CUP */}
          {(activeGame === 'penalty_kick' || activeGame === 'sprint_race') && (
            <div className="space-y-4 text-center">
              <div className="text-xs font-bold text-slate-600 uppercase">
                Chạm vào 1 trong 4 góc cầu môn để sút phạt đền tung lưới thủ môn:
              </div>

              <div className="relative mx-auto max-w-xl h-52 bg-gradient-to-b from-sky-400 via-emerald-600 to-emerald-800 rounded-3xl border-4 border-white shadow-xl overflow-hidden p-4 flex flex-col justify-between">
                {/* Goal Post Frame */}
                <div className="relative w-full h-full border-4 border-white rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center">
                  {/* Goalkeeper */}
                  <div className={`text-5xl transition-all duration-500 ${
                    goalKeeperDived === 'bottom_left'
                      ? 'translate-x-[-120px] translate-y-[40px] rotate-45'
                      : goalKeeperDived === 'bottom_right'
                      ? 'translate-x-[120px] translate-y-[40px] -rotate-45'
                      : ''
                  }`}>
                    🧤🧑‍🦱
                  </div>

                  {/* 4 Shooting Corner Target Buttons */}
                  <button
                    onClick={() => handleShootPenalty('top_left')}
                    className="absolute top-2 left-2 px-3 py-1.5 rounded-xl bg-amber-400/90 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md active:scale-95 cursor-pointer"
                  >
                    Góc Cao Trái 🎯
                  </button>
                  <button
                    onClick={() => handleShootPenalty('top_right')}
                    className="absolute top-2 right-2 px-3 py-1.5 rounded-xl bg-amber-400/90 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md active:scale-95 cursor-pointer"
                  >
                    🎯 Góc Cao Phải
                  </button>
                  <button
                    onClick={() => handleShootPenalty('bottom_left')}
                    className="absolute bottom-2 left-2 px-3 py-1.5 rounded-xl bg-amber-400/90 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md active:scale-95 cursor-pointer"
                  >
                    Góc Sệt Trái ⚽
                  </button>
                  <button
                    onClick={() => handleShootPenalty('bottom_right')}
                    className="absolute bottom-2 right-2 px-3 py-1.5 rounded-xl bg-amber-400/90 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md active:scale-95 cursor-pointer"
                  >
                    ⚽ Góc Sệt Phải
                  </button>
                </div>
              </div>

              {penaltyStage === 'goal' && (
                <div className="text-2xl font-black text-emerald-600 animate-bounce">
                  ⚽ VÀOOO! BÀN THẮNG TUYỆT ĐẸP!
                </div>
              )}
            </div>
          )}

          {/* 8. 🕹️ MÁY GẮP THÚ BÔNG ARCADE */}
          {(activeGame === 'claw_machine' || activeGame === 'ocean_fishing') && (
            <div className="space-y-4 text-center">
              <div className="text-xs font-bold text-slate-600 uppercase">
                🕹️ Thả tay gắp may mắn để gắp quả cầu phần thưởng chứa tên học sinh:
              </div>

              <div className="relative mx-auto max-w-lg h-56 bg-slate-900 rounded-3xl border-4 border-indigo-400 shadow-2xl p-4 flex flex-col justify-between overflow-hidden">
                {/* Mechanical Crane Rail & Claw */}
                <div className="relative w-full h-8 border-b-2 border-indigo-500/50 flex items-center">
                  <div
                    className={`absolute text-3xl transition-all duration-700 ${
                      clawStage === 'dropping' || clawStage === 'grabbing'
                        ? 'top-24'
                        : 'top-1'
                    }`}
                    style={{ left: `${clawPositionX}%` }}
                  >
                    🏗️
                  </div>
                </div>

                {/* Prizes at bottom */}
                <div className="flex justify-around text-3xl pt-10">
                  <span>🧸</span>
                  <span>🎁</span>
                  <span>⭐</span>
                  <span>🏆</span>
                  <span>💎</span>
                </div>
              </div>

              {clawStage === 'idle' && (
                <button
                  onClick={handleDropClaw}
                  className="px-8 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  THẢ TAY GẮP MAY MẮN 🕹️
                </button>
              )}
            </div>
          )}

          {/* 9. 🎯 PHI TIÊU CAO THỦ HỒNG TÂM */}
          {(activeGame === 'super_darts' || activeGame === 'archery_target') && (
            <div className="space-y-4 text-center">
              <div className="text-xs font-bold text-slate-600 uppercase">
                🎯 Phóng phi tiêu thẳng vào hồng tâm 100 điểm:
              </div>

              <div className="relative mx-auto w-48 h-48 rounded-full border-8 border-amber-400 bg-slate-900 shadow-2xl flex items-center justify-center">
                <div className="w-36 h-36 rounded-full border-4 border-red-500 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full border-4 border-emerald-500 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center text-white font-black text-xs shadow-md">
                      100
                    </div>
                  </div>
                </div>

                {dartStage === 'bullseye' && (
                  <div className="absolute text-4xl animate-ping">🎯</div>
                )}
              </div>

              {dartStage === 'idle' && (
                <button
                  onClick={handleThrowDart}
                  className="px-8 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  PHÓNG PHI TIÊU HỒNG TÂM 🎯
                </button>
              )}
            </div>
          )}

          {/* 10. 🌌 CHIẾN HẠM KHÔNG GIAN HYPERSPACE */}
          {(activeGame === 'cosmic_warp' || activeGame === 'swimming_race') && (
            <div className="space-y-4 text-center">
              <div className="text-xs font-bold text-slate-600 uppercase">
                🌌 Nhảy vào không gian tốc độ ánh sáng để xác định thuyền trưởng:
              </div>

              <div className="relative mx-auto max-w-lg h-52 bg-black rounded-3xl border-2 border-cyan-500/40 shadow-2xl flex items-center justify-center overflow-hidden">
                {warpStage === 'warping' ? (
                  <div className="text-5xl animate-pulse">🛸 💫 ⚡</div>
                ) : (
                  <div className="text-4xl text-cyan-400">🌌 🛰️ 🚀</div>
                )}
              </div>

              {warpStage === 'idle' && (
                <button
                  onClick={handleTriggerWarp}
                  className="px-8 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white font-black text-sm shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  NHẢY KHÔNG GIAN WARP-SPEED 🌌
                </button>
              )}
            </div>
          )}

          {/* Result announcement */}
          {renderResultCard()}
        </div>
      </div>
    </div>
  );
};
