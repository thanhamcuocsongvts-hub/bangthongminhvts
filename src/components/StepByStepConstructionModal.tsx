import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Cuboid,
  Sparkles,
  Layers,
  Sliders,
  CheckCircle2,
  Atom,
  FlaskConical,
  Dna,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  PenTool,
  Search,
  PlusCircle,
  GraduationCap,
  Wand2,
  FileQuestion,
  HelpCircle,
  ChevronDown,
  Compass,
  Lightbulb,
  Check,
  Send,
  Eye,
  Info,
  RefreshCw,
} from 'lucide-react';
import { speakText, stopAllSpeech } from '../utils/aiSpeechService';
import { createDirectGeminiClient, getGeminiApiKey } from '../utils/geminiClient';

export type GradeLevel = 'primary' | 'secondary' | 'highschool';

export type SimType =
  | '3D_GEOMETRY'
  | 'REAL_MATH'
  | 'PHYSICS'
  | 'CHEMISTRY'
  | 'PRIMARY_HANDWRITING'
  | 'PRIMARY_FRACTION'
  | 'PRIMARY_SCIENCE'
  | 'CUSTOM_CODE';

export interface StepDetail {
  stepNumber: number;
  title: string;
  description: string;
  formula?: string;
  notes: string;
  audioNarration?: string;
}

export interface SimSliderParam {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: string;
  format?: (v: number) => string;
}

export interface SimulationConfig {
  id: string;
  title: string;
  gradeLevel: GradeLevel;
  subject: string;
  category: string;
  icon: string;
  badge?: string;
  simType: SimType;
  steps: StepDetail[];
  parameters: SimSliderParam[];
  customInteractive?: boolean;
  customCode?: string;
  telemetryFormula?: string;
}

// ==========================================
// PURE WEB AUDIO SYNTHESIZER ENGINE
// ==========================================
class ClassroomAudioEngine {
  private ctx: AudioContext | null = null;
  public soundEnabled: boolean = true;

  private getContext(): AudioContext | null {
    if (!this.soundEnabled) return null;
    try {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  // Whoosh sound when drawing a line or switching steps
  playWhooshDraw() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const bufferSize = ctx.sampleRate * 0.12;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.12);
      filter.Q.setValueAtTime(2.5, ctx.currentTime);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } catch (_) {}
  }

  // Crisp chime when a vertex or step completes
  playTingStep() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (_) {}
  }

  // Fanfare victory chime when reaching optimal value or titration equivalence
  playVictoryChime() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5, E5, G5, C6, E6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.35);
      });
    } catch (_) {}
  }

  // Water drop sound
  playWaterDrop() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (_) {}
  }

  // Optical laser sound
  playLaserBeam() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(960, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (_) {}
  }

  // Button click
  playClick() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.03);
    } catch (_) {}
  }
}

const audioEngine = new ClassroomAudioEngine();

// ==========================================
// PRESET CURRICULUM SIMULATIONS
// ==========================================
export const FULL_SIMULATIONS: SimulationConfig[] = [
  // ---------------- THPT: LỚP 10 - 12 ----------------
  {
    id: 'pyr-cross-section',
    title: 'Hình Chóp S.ABCD & Thiết Diện Cắt (α)',
    gradeLevel: 'highschool',
    subject: 'Toán Học',
    category: 'Hình Học Không Gian',
    icon: '📐',
    badge: 'Hình Học 3D 360°',
    simType: '3D_GEOMETRY',
    telemetryFormula: '(α) \\parallel (ABCD) \\implies \\frac{S_{MNPQ}}{S_{ABCD}} = \\left(\\frac{SH\'}{SH}\\right)^2',
    parameters: [
      {
        id: 'cutHeight',
        label: 'Vị trí mặt cắt (h/H)',
        min: 0.15,
        max: 0.85,
        step: 0.01,
        defaultValue: 0.5,
        unit: '',
        format: (v) => `${Math.round(v * 100)}%`,
      },
      {
        id: 'pyrHeight',
        label: 'Độ cao chóp H',
        min: 160,
        max: 300,
        step: 10,
        defaultValue: 230,
        unit: 'px',
      },
      {
        id: 'baseScale',
        label: 'Kích thước đáy a',
        min: 140,
        max: 260,
        step: 10,
        defaultValue: 200,
        unit: 'px',
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Bước 1: Dựng đáy ABCD trong không gian',
        description: 'Vẽ hình bình hành biểu diễn đáy hình vuông ABCD. Cạnh sau AD khuất vẽ nét đứt [6, 6], ba cạnh AB, BC, CD nhìn thấy vẽ nét liền phát sáng.',
        formula: 'ABCD \\text{ là hình bình hành biểu diễn}',
        notes: 'Dùng chuột kéo xoay 360° để quan sát mọi góc độ.',
        audioNarration: 'Bước một: Dựng đáy A B C D trong không gian. Cạnh sau khuất vẽ nét đứt, các cạnh nhìn thấy vẽ nét liền.',
      },
      {
        stepNumber: 2,
        title: 'Bước 2: Xác định tâm đáy H & Dựng đường cao SH',
        description: 'Giao điểm hai đường chéo AC và BD là tâm H của đáy. Từ H dựng thẳng đứng trục cao SH vuông góc mặt phẳng đáy.',
        formula: 'H = AC \\cap BD, \\quad SH \\perp (ABCD)',
        notes: 'Đường cao SH và các đường chéo nằm phía trong nên vẽ nét đứt.',
        audioNarration: 'Bước hai: Xác định tâm H của đáy và dựng đường cao S H vuông góc với mặt phẳng đáy.',
      },
      {
        stepNumber: 3,
        title: 'Bước 3: Nối đỉnh S với 4 đỉnh đáy tạo các cạnh bên',
        description: 'Nối SA, SB, SC, SD. Cạnh SA nằm phía sau là nét khuất (nét đứt). Ba cạnh bên SB, SC, SD là nét nhìn thấy.',
        formula: 'S.ABCD \\text{ chóp tứ giác đều}',
        notes: 'Các mặt bên (SAB), (SBC), (SCD), (SDA) là các tam giác cân bằng nhau.',
        audioNarration: 'Bước ba: Nối đỉnh S với bốn đỉnh đáy để hoàn thiện khung hình chóp tứ giác đều.',
      },
      {
        stepNumber: 4,
        title: 'Bước 4: Dựng mặt phẳng thiết diện (α) song song đáy',
        description: 'Mặt phẳng (α) cắt SH tại H\' và cắt 4 cạnh bên tại M, N, P, Q. Thiết diện MNPQ là hình vuông đồng dạng với đáy, phát sáng xuyên thấu tuyệt đẹp.',
        formula: 'MNPQ \\parallel ABCD \\implies \\frac{S_{MNPQ}}{S_{ABCD}} = k^2',
        notes: 'Kéo thanh trượt vị trí mặt cắt để thấy thiết diện mở rộng hay thu nhỏ linh hoạt.',
        audioNarration: 'Bước bốn: Dựng mặt phẳng thiết diện cắt chóp tứ giác, tạo thành đa giác thiết diện phát sáng neon xuyên thấu.',
      },
    ],
  },
  {
    id: 'box-folding',
    title: 'Gấp Hộp Chữ Nhật Không Nắp (Cực Trị Thể Tích)',
    gradeLevel: 'highschool',
    subject: 'Toán Học',
    category: 'Toán Thực Tế',
    icon: '📦',
    badge: 'Dual-View Cực Trị',
    simType: 'REAL_MATH',
    telemetryFormula: 'V(x) = x(80 - 2x)(50 - 2x) \\implies V\'(x) = 0 \\iff x \\approx 10\\text{ cm}',
    parameters: [
      {
        id: 'cutX',
        label: 'Cạnh cắt x',
        min: 1.0,
        max: 24.0,
        step: 0.1,
        defaultValue: 10.0,
        unit: 'cm',
        format: (v) => `${v.toFixed(1)} cm`,
      },
      {
        id: 'sheetL',
        label: 'Chiều dài tôn L',
        min: 60,
        max: 100,
        step: 5,
        defaultValue: 80,
        unit: 'cm',
      },
      {
        id: 'sheetW',
        label: 'Chiều rộng tôn W',
        min: 40,
        max: 60,
        step: 5,
        defaultValue: 50,
        unit: 'cm',
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Bước 1: Tấm tôn phẳng ban đầu kích thước 80 x 50 cm',
        description: 'Bên trái là tấm tôn hình chữ nhật phẳng. Bên phải là hệ trục tọa độ chuẩn bị vẽ đồ thị hàm số thể tích V(x).',
        formula: 'S_{\\text{tôn}} = 80 \\times 50 = 4000\\text{ cm}^2',
        notes: 'Bài toán tối ưu sản xuất công nghiệp thực tế.',
        audioNarration: 'Bước một: Cho một tấm tôn hình chữ nhật kích thước 80 nhân 50 cm.',
      },
      {
        stepNumber: 2,
        title: 'Bước 2: Cắt bỏ 4 góc hình vuông cạnh x cm',
        description: 'Tại 4 góc cắt bỏ 4 hình vuông bằng nhau có cạnh x (0 < x < 25 cm). Các đường nét gấp đứt đoạn xuất hiện.',
        formula: '0 < x < 25\\text{ cm}',
        notes: 'Khi x tăng, diện tích đáy hộp sẽ bị thu hẹp lại.',
        audioNarration: 'Bước hai: Cắt bỏ bốn góc hình vuông cạnh x và gấp bốn mép bên lên.',
      },
      {
        stepNumber: 3,
        title: 'Bước 3: Dựng thành hộp 3D & khảo sát hàm V(x)',
        description: 'Chiều cao hộp là h = x, các cạnh đáy là (80 - 2x) và (50 - 2x). Thể tích V(x) = x(80 - 2x)(50 - 2x).',
        formula: 'V(x) = 4x^3 - 260x^2 + 4000x',
        notes: 'Điểm màu vàng cam trên đồ thị bên phải di chuyển tương ứng theo thanh trượt.',
        audioNarration: 'Bước ba: Thiết lập hàm thể tích V theo x và khảo sát sự biến thiên của đồ thị.',
      },
      {
        stepNumber: 4,
        title: 'Bước 4: Khảo sát đạo hàm & Tìm giá trị cực đại tối ưu',
        description: 'Giải phương trình V\'(x) = 12x² - 520x + 4000 = 0 thu được nghiệm x ≈ 10.0 cm cho thể tích cực đại V_max ≈ 18,000 cm³ (18 lít).',
        formula: 'V\'(x) = 0 \\implies x = \\frac{130 - 10\\sqrt{37}}{6} \\approx 10.0\\text{ cm}',
        notes: 'Khi kéo slider về x = 10 cm, hệ thống sẽ kích hoạt hào quang hoàng kim!',
        audioNarration: 'Bước bốn: Đạo hàm triệt tiêu tại x bằng 10 cm, mang lại thể tích hộp lớn nhất là 18 nghìn centimet khối.',
      },
    ],
  },
  {
    id: 'parabola-truck',
    title: 'Vòm Cổng Parabol & Xe Tải Đi Qua',
    gradeLevel: 'highschool',
    subject: 'Toán Học',
    category: 'Toán Thực Tế',
    icon: '🚛',
    badge: 'Parabol Thực Tế',
    simType: 'REAL_MATH',
    telemetryFormula: 'y = -0.375x^2 + 6 \\implies y(1.8) = 4.785\\text{ m} > 4.2\\text{ m}',
    parameters: [
      {
        id: 'truckW',
        label: 'Chiều rộng xe W',
        min: 2.0,
        max: 5.0,
        step: 0.1,
        defaultValue: 3.6,
        unit: 'm',
        format: (v) => `${v.toFixed(1)} m`,
      },
      {
        id: 'truckH',
        label: 'Chiều cao xe H',
        min: 3.0,
        max: 5.5,
        step: 0.1,
        defaultValue: 4.2,
        unit: 'm',
        format: (v) => `${v.toFixed(1)} m`,
      },
      {
        id: 'gateH',
        label: 'Chiều cao vòm',
        min: 4.0,
        max: 8.0,
        step: 0.2,
        defaultValue: 6.0,
        unit: 'm',
        format: (v) => `${v.toFixed(1)} m`,
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Bước 1: Mô tả hình học của vòm cổng giao thông',
        description: 'Vòm cổng dạng Parabol rộng L = 8m ở chân cổng, chiều cao đỉnh cổng H = 6m.',
        formula: '\\text{Chân cổng: } (-4, 0), (4, 0); \\quad \\text{Đỉnh: } (0, 6)',
        notes: 'Mô hình hóa thực tế vào chương trình Toán 10 và 12.',
        audioNarration: 'Bước một: Khảo sát vòm cổng parabol có chiều rộng 8 mét và chiều cao đỉnh 6 mét.',
      },
      {
        stepNumber: 2,
        title: 'Bước 2: Thiết lập hệ trục Oxy & Phương trình Parabol',
        description: 'Chọn gốc O tại trung điểm chân cổng. Trục Oy thẳng đứng qua đỉnh cổng. Parabol có phương trình đối xứng y = ax² + 6.',
        formula: '(P): y = -0.375x^2 + 6',
        notes: 'Thay x = 4 vào: 0 = a(4)² + 6 ⟹ a = -0.375.',
        audioNarration: 'Bước hai: Đặt hệ trục tọa độ và tìm được phương trình parabol y bằng trừ 0.375 x bình cộng 6.',
      },
      {
        stepNumber: 3,
        title: 'Bước 3: Đưa xe tải vào và tính khoảng hở an toàn',
        description: 'Xe tải rộng 3.6m nên chiếm từ x = -1.8m đến x = 1.8m. Chiều cao xe là h = 4.2m.',
        formula: 'y(1.8) = -0.375(1.8)^2 + 6 = 4.785\\text{ m}',
        notes: 'Khoảng hở an toàn phía trên nóc xe là 4.785 - 4.2 = 0.585m (58.5 cm)!',
        audioNarration: 'Bước ba: Tính độ cao mép cổng tại vị trí xe tải đi qua, xác nhận xe lưu thông an toàn.',
      },
    ],
  },
  {
    id: 'young-interference',
    title: 'Thí Nghiệm Giao Thoa Ánh Sáng Khe Y-âng',
    gradeLevel: 'highschool',
    subject: 'Vật Lý',
    category: 'Quang Sóng',
    icon: '⚡',
    badge: 'Vật Lý 12 60FPS',
    simType: 'PHYSICS',
    telemetryFormula: 'i = \\frac{\\lambda D}{a}, \\quad x_k = k \\cdot i, \\quad I(x) = I_0 \\cos^2\\left(\\frac{\\pi a x}{\\lambda D}\\right)',
    parameters: [
      {
        id: 'lambda',
        label: 'Bước sóng λ',
        min: 400,
        max: 750,
        step: 10,
        defaultValue: 650,
        unit: 'nm',
        format: (v) => `${v} nm`,
      },
      {
        id: 'slitA',
        label: 'Khoảng cách 2 khe a',
        min: 0.5,
        max: 2.0,
        step: 0.1,
        defaultValue: 1.0,
        unit: 'mm',
        format: (v) => `${v.toFixed(1)} mm`,
      },
      {
        id: 'screenD',
        label: 'Khoảng cách tới màn D',
        min: 1.0,
        max: 3.0,
        step: 0.1,
        defaultValue: 2.0,
        unit: 'm',
        format: (v) => `${v.toFixed(1)} m`,
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Bước 1: Nguồn laser đơn sắc chiếu tới hai khe hẹp',
        description: 'Chùm sáng đơn sắc có bước sóng λ chiếu vào hai khe hẹp S1, S2 cách nhau khoảng a. Hai khe trở thành hai nguồn sáng kết hợp đồng pha.',
        formula: 'S_1, S_2 \\text{ là hai nguồn kết hợp đồng pha}',
        notes: 'Bước sóng thay đổi màu sắc chùm tia từ tím (400nm) đến đỏ (750nm).',
        audioNarration: 'Bước một: Nguồn sáng laser chiếu qua hai khe hẹp S một và S hai, tạo ra hai nguồn sóng kết hợp.',
      },
      {
        stepNumber: 2,
        title: 'Bước 2: Sự lan truyền và giao thoa của hai sóng ánh sáng',
        description: 'Hai sóng ánh sáng lan truyền trong không gian gặp nhau. Nơi hai sóng tăng cường lẫn nhau tạo thành vân sáng; nơi hai sóng triệt tiêu nhau tạo thành vân tối.',
        formula: 'd_2 - d_1 = k\\lambda \\implies \\text{Vân sáng}; \\quad d_2 - d_1 = (k + 0.5)\\lambda \\implies \\text{Vân tối}',
        notes: 'Vòng sóng trên canvas lan tỏa 60 khung hình/giây chân thực.',
        audioNarration: 'Bước hai: Sóng ánh sáng từ hai khe giao thoa với nhau trong vùng không gian truyền sóng.',
      },
      {
        stepNumber: 3,
        title: 'Bước 3: Màn hứng vân giao thoa & Đồ thị cường độ I(x)',
        description: 'Trên màn quan sát (cách 2 khe khoảng D), xuất hiện các dải sáng tối xen kẽ đều đặn. Bên cạnh màn là đồ thị phân bố cường độ sáng I(x).',
        formula: 'i = \\frac{\\lambda D}{a} \\implies \\text{Khoảng vân}',
        notes: 'Kéo đổi bước sóng λ hoặc khoảng cách a để thấy khoảng vân i dãn ra hay co lại ngay lập tức.',
        audioNarration: 'Bước ba: Trên màn xuất hiện hệ vân giao thoa xen kẽ đều đặn với khoảng vân i bằng lam-đa nhân D chia a.',
      },
    ],
  },
  {
    id: 'light-refraction',
    title: 'Khúc Xạ & Phản Xạ Toàn Phần Của Ánh Sáng',
    gradeLevel: 'highschool',
    subject: 'Vật Lý',
    category: 'Quang Hình Học',
    icon: '🌈',
    badge: 'Định Luật Snell',
    simType: 'PHYSICS',
    telemetryFormula: 'n_1 \\sin i = n_2 \\sin r, \\quad \\sin i_{gh} = \\frac{n_2}{n_1} \\approx 48.6^\\circ',
    parameters: [
      {
        id: 'angleI',
        label: 'Góc tới i',
        min: 0,
        max: 85,
        step: 1,
        defaultValue: 35,
        unit: '°',
        format: (v) => `${v}°`,
      },
      {
        id: 'n1',
        label: 'Chiết suất môi trường 1 (Nước)',
        min: 1.2,
        max: 1.8,
        step: 0.01,
        defaultValue: 1.33,
        unit: '',
        format: (v) => v.toFixed(2),
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Bước 1: Tia laser truyền từ nước ra không khí',
        description: 'Tia sáng truyền từ môi trường chiết quang hơn (nước n1 = 1.33) sang môi trường kém chiết quang (không khí n2 = 1.0).',
        formula: 'n_1 \\sin i = n_2 \\sin r',
        notes: 'Pháp tuyến vuông góc với mặt phân cách tại điểm tới I.',
        audioNarration: 'Bước một: Tia sáng truyền từ nước sang không khí, bị bẻ gãy khúc xạ tại mặt phân cách.',
      },
      {
        stepNumber: 2,
        title: 'Bước 2: Khi góc tới i nhỏ hơn góc giới hạn (i < igh)',
        description: 'Tia khúc xạ đi vào không khí lệch xa pháp tuyến hơn (r > i). Đồng thời có một phần tia phản xạ mờ quay trở lại nước.',
        formula: 'r = \\arcsin\\left(\\frac{n_1}{n_2} \\sin i\\right) > i',
        notes: 'Góc khúc xạ r luôn lớn hơn góc tới i.',
        audioNarration: 'Bước hai: Khi góc tới tăng, góc khúc xạ tăng nhanh hơn và tia phản xạ sáng dần lên.',
      },
      {
        stepNumber: 3,
        title: 'Bước 3: Hiện tượng phản xạ toàn phần (i > igh ≈ 48.6°)',
        description: 'Khi góc tới vượt quá góc giới hạn igh, tia khúc xạ biến mất hoàn toàn! 100% năng lượng ánh sáng bị phản xạ trở lại vào nước.',
        formula: 'i > i_{gh} \\implies \\text{Phản xạ toàn phần 100%}',
        notes: 'Nguyên lý truyền dẫn tín hiệu internet quang học tốc độ cao trong sợi cáp quang.',
        audioNarration: 'Bước ba: Khi góc tới vượt quá góc giới hạn, xảy ra phản xạ toàn phần 100 phần trăm.',
      },
    ],
  },
  {
    id: 'acid-titration',
    title: 'Chuẩn Độ Axit - Bazơ (HCl + NaOH)',
    gradeLevel: 'highschool',
    subject: 'Hóa Học',
    category: 'Hóa Phân Tích',
    icon: '🧪',
    badge: 'Chỉ Thị Màu Ph',
    simType: 'CHEMISTRY',
    telemetryFormula: '\\text{HCl} + \\text{NaOH} \\rightarrow \\text{NaCl} + \\text{H}_2\\text{O}, \\quad C_{\\text{HCl}} = \\frac{C_{\\text{NaOH}} \\cdot V_{\\text{NaOH}}}{V_{\\text{HCl}}}',
    parameters: [
      {
        id: 'drops',
        label: 'Thể tích NaOH đã nhỏ',
        min: 0,
        max: 40,
        step: 0.5,
        defaultValue: 15,
        unit: 'ml',
        format: (v) => `${v.toFixed(1)} ml`,
      },
      {
        id: 'cNaOH',
        label: 'Nồng độ dung dịch NaOH',
        min: 0.05,
        max: 0.2,
        step: 0.01,
        defaultValue: 0.1,
        unit: 'M',
        format: (v) => `${v.toFixed(2)} M`,
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Bước 1: Thiết bị buret và bình tam giác Erlenmeyer',
        description: 'Buret chứa dung dịch chuẩn NaOH 0.1M. Bình tam giác bên dưới đựng 20ml HCl và vài giọt chỉ thị Phenolphtalein không màu (pH ban đầu ≈ 1.0).',
        formula: '\\text{Môi trường axit mạnh: } \\text{pH} \\approx 1.0',
        notes: 'Dung dịch trong bình tam giác hoàn toàn trong suốt.',
        audioNarration: 'Bước một: Chuẩn bị buret chứa natri hi-đrô-xít và bình tam giác chứa a-xít clo-hi-đríc với chỉ thị phenol-phtalein.',
      },
      {
        stepNumber: 2,
        title: 'Bước 2: Mở khóa buret, nhỏ từng giọt NaOH vào bình',
        description: 'Khi nhỏ NaOH xuống, phản ứng trung hòa diễn ra làm giảm lượng H+ và tăng pH. Màu hồng chỉ thoảng xuất hiện ở tâm rồi tan biến khi lắc.',
        formula: '\\text{H}^+ + \\text{OH}^- \\rightarrow \\text{H}_2\\text{O}',
        notes: 'Bọt khí lăn tăn chuyển động sống động trong bình.',
        audioNarration: 'Bước hai: Nhỏ từng giọt dung dịch chuẩn từ buret, trung hòa dần a-xít trong bình.',
      },
      {
        stepNumber: 3,
        title: 'Bước 3: Điểm tương đương - Đổi sang màu hồng cánh sen',
        description: 'Tại V = 20ml, toàn bộ axit được trung hòa hoàn toàn. Chỉ cần thêm 1 giọt NaOH dư nhẹ, dung dịch lập tức chuyển sang màu hồng cánh sen nhạt bền vững!',
        formula: 'V_{\\text{tương đương}} = 20.0\\text{ ml} \\implies \\text{pH} = 7.0 \\rightarrow 8.3',
        notes: 'Khi kéo thanh trượt tới 20ml, bình sẽ rực hồng và kích hoạt chuông thành công!',
        audioNarration: 'Bước ba: Đạt điểm tương đương, dung dịch đổi sang màu hồng cánh sen đặc trưng của phenol-phtalein.',
      },
    ],
  },

  // ---------------- THCS: LỚP 6 - 9 ----------------
  {
    id: 'sec-pythagoras',
    title: 'Định Lý Pythagoras Trực Quan (Chất Lỏng Bảo Toàn)',
    gradeLevel: 'secondary',
    subject: 'Toán Học',
    category: 'Hình Học Phẳng',
    icon: '📐',
    badge: 'Pythagoras Nước',
    simType: 'REAL_MATH',
    telemetryFormula: 'a^2 + b^2 = c^2 \\iff 3^2 + 4^2 = 5^2 \\iff 9 + 16 = 25',
    parameters: [
      {
        id: 'liquidFlow',
        label: 'Độ xoay & Chảy nước',
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 60,
        unit: '%',
        format: (v) => `${v}%`,
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Bước 1: Tam giác vuông với 3 hình vuông trên 3 cạnh',
        description: 'Tam giác vuông có hai cạnh góc vuông a = 3, b = 4 và cạnh huyền c = 5. Dựng ba hình vuông tương ứng S1 = a², S2 = b², S3 = c².',
        formula: 'S_1 = 9, \\quad S_2 = 16, \\quad S_3 = 25',
        notes: 'Hai hình vuông nhỏ chứa đầy chất lỏng màu xanh lam neon.',
        audioNarration: 'Bước một: Cho tam giác vuông có hai cạnh góc vuông ba và bốn, cạnh huyền là năm.',
      },
      {
        stepNumber: 2,
        title: 'Bước 2: Xoay vòng chứa để chất lỏng đổ vào hình vuông lớn',
        description: 'Chất lỏng từ hai hình vuông nhỏ a² và b² chảy qua các ống dẫn vào hình vuông đáy c².',
        formula: 'S_1 + S_2 = 9 + 16 = 25 = S_3',
        notes: 'Chất lỏng chảy khớp 100% dung tích hình vuông lớn!',
        audioNarration: 'Bước hai: Tổng lượng chất lỏng của hai hình vuông nhỏ vừa khít lấp đầy hình vuông cạnh huyền.',
      },
    ],
  },
  {
    id: 'sec-lever',
    title: 'Đòn Bẩy & Quy Tắc Mômen Lực Archimedes',
    gradeLevel: 'secondary',
    subject: 'Khoa Học Tự Nhiên',
    category: 'Vật Lý 8',
    icon: '⚖️',
    badge: 'Đòn Bẩy Cơ Học',
    simType: 'PHYSICS',
    telemetryFormula: 'F_1 \\cdot d_1 = F_2 \\cdot d_2 \\implies F_2 = F_1 \\cdot \\frac{d_1}{d_2}',
    parameters: [
      {
        id: 'arm2',
        label: 'Cánh tay đòn lực d2',
        min: 1,
        max: 5,
        step: 0.1,
        defaultValue: 3,
        unit: 'm',
        format: (v) => `${v.toFixed(1)} m`,
      },
      {
        id: 'loadWeight',
        label: 'Trọng lượng vật F1',
        min: 50,
        max: 200,
        step: 10,
        defaultValue: 120,
        unit: 'N',
        format: (v) => `${v} N`,
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Bước 1: Cấu tạo đòn bẩy và điểm tựa O',
        description: 'Thanh cứng có thể quay quanh điểm tựa O. Vật đặt tại O1 cách O đoạn d1 = 1m. Lực kéo tác dụng tại O2 cách O đoạn d2.',
        formula: 'O \\text{ là điểm tựa; } d_1 = 1.0\\text{ m}',
        notes: '"Hãy cho tôi một điểm tựa, tôi sẽ nhấc bổng cả Trái Đất lên!"',
        audioNarration: 'Bước một: Xác định điểm tựa O và hai cánh tay đòn của đòn bẩy.',
      },
      {
        stepNumber: 2,
        title: 'Bước 2: Cân bằng lực và lợi thế cơ học',
        description: 'Khi d2 dài gấp 3 lần d1, lực F2 cần tác dụng chỉ bằng 1/3 trọng lượng của vật F1!',
        formula: 'F_2 = \\frac{120 \\times 1.0}{3.0} = 40\\text{ N}',
        notes: 'Được lợi bao nhiêu lần về lực thì thiệt bấy nhiêu lần về đường đi.',
        audioNarration: 'Bước hai: Cánh tay đòn càng dài, lực tác dụng cần thiết càng nhỏ, mang lại lợi ích cơ học lớn.',
      },
    ],
  },

  // ---------------- TIỂU HỌC: LỚP 1 - 5 ----------------
  {
    id: 'pri-letter-writing',
    title: 'Rèn Luyện Từng Bước Viết Chữ Đẹp & Đánh Vần',
    gradeLevel: 'primary',
    subject: 'Tiếng Việt',
    category: 'Tập Viết & Đánh Vần',
    icon: '✍️',
    badge: '4 Ô Ly Chuẩn SGK',
    simType: 'PRIMARY_HANDWRITING',
    telemetryFormula: '\\text{Đường kẻ 4 ô ly chuẩn BGD: Nét thanh, nét đậm, điểm đặt bút}',
    parameters: [
      {
        id: 'speed',
        label: 'Tốc độ ngòi bút',
        min: 1,
        max: 4,
        step: 0.5,
        defaultValue: 2,
        unit: 'x',
        format: (v) => `${v}x`,
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Bước 1: Xác định tọa độ ô ly & Điểm đặt bút',
        description: 'Khung lưới 4 ô ly tiểu học chuẩn mực với đường kẻ đậm ngang số 1, đường kẻ phụ và tọa độ các nét.',
        notes: 'Học sinh quan sát điểm xuất phát của nét bút (chấm đỏ nhấp nháy).',
        audioNarration: 'Bước một: Xác định dòng kẻ bốn ô ly và điểm đặt bút chuẩn xác.',
      },
      {
        stepNumber: 2,
        title: 'Bước 2: Bút máy mực tím di chuyển vẽ nét chính',
        description: 'Ngòi bút kim loại lướt mượt mà tạo nét cong kín hoặc nét khuyết, mực tím chuyển động 60FPS.',
        notes: 'Chữ viết theo quy chuẩn mẫu chữ viết giáo dục tiểu học Việt Nam.',
        audioNarration: 'Bước hai: Đưa ngòi bút lướt nhẹ nhàng, tạo độ cong đều và tròn trịa.',
      },
      {
        stepNumber: 3,
        title: 'Bước 3: Dừng bút & Đánh vần âm vị theo giọng AI',
        description: 'Điểm dừng bút nằm trên đường kẻ 2. Giọng AI phát âm chuẩn xác chữ cái và từ ghép mẫu.',
        notes: 'Bấm nghe đánh vần để luyện phát âm chuẩn.',
        audioNarration: 'Bước ba: Dừng bút trên dòng kẻ hai. Học sinh cùng đọc to chữ cái theo hướng dẫn.',
      },
    ],
  },
  {
    id: 'primary-pizza-fraction',
    title: 'Phân Số Trực Quan (Chia Bánh Pizza)',
    gradeLevel: 'primary',
    subject: 'Toán Học',
    category: 'Số Học & Phân Số',
    icon: '🍕',
    badge: 'Toán Tiểu Học',
    simType: 'PRIMARY_FRACTION',
    telemetryFormula: '\\text{Phân số: } \\frac{\\text{Số miếng lấy}}{\\text{Tổng số phần}} = \\frac{a}{b}',
    parameters: [
      {
        id: 'parts',
        label: 'Tổng số phần (Mẫu số)',
        min: 2,
        max: 8,
        step: 1,
        defaultValue: 6,
        unit: 'phần',
      },
      {
        id: 'taken',
        label: 'Số phần lấy (Tử số)',
        min: 1,
        max: 6,
        step: 1,
        defaultValue: 4,
        unit: 'phần',
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Bước 1: Một chiếc bánh nguyên vẹn (Đơn vị 1)',
        description: 'Một chiếc bánh pizza tròn thơm ngon biểu diễn cho một đơn vị toàn vẹn ban đầu.',
        formula: '1 = \\frac{n}{n}',
        notes: 'Khái niệm về một đơn vị nguyên vẹn trong toán học.',
        audioNarration: 'Bước một: Chiếc bánh pizza nguyên vẹn tượng trưng cho một đơn vị.',
      },
      {
        stepNumber: 2,
        title: 'Bước 2: Chia đều chiếc bánh thành các phần bằng nhau',
        description: 'Cắt bánh thành các phần bằng nhau. Số phần bằng nhau chính là Mẫu Số.',
        formula: '\\text{Mẫu số: } b',
        notes: 'Tất cả các phần chia phải hoàn toàn bằng nhau.',
        audioNarration: 'Bước hai: Chia chiếc bánh thành các phần bằng nhau, số phần này là mẫu số.',
      },
      {
        stepNumber: 3,
        title: 'Bước 3: Lấy đi một số phần bánh (Tử Số)',
        description: 'Lấy ra một số miếng bánh đưa vào đĩa. Số miếng lấy ra chính là Tử Số.',
        formula: '\\text{Phân số: } \\frac{a}{b}',
        notes: 'Các miếng bánh lấy ra phát sáng vàng kim hấp dẫn.',
        audioNarration: 'Bước ba: Số miếng bánh được lấy ra biểu thị cho tử số của phân số.',
      },
    ],
  },
];

// Stroke definitions for Primary Letter writing
const PRIMARY_LETTERS: Record<
  string,
  {
    name: string;
    phonics: string;
    points: [number, number][];
    guideText: string;
  }
> = {
  a: {
    name: 'Chữ a',
    phonics: 'A',
    guideText: 'Nét 1: Cong kín (tròn như quả trứng). Nét 2: Móc ngược sát nét cong kín.',
    points: [
      [220, 150], [190, 140], [160, 160], [140, 190], [140, 220],
      [160, 250], [190, 260], [220, 250], [240, 220], [240, 190],
      [220, 150], [240, 150], [240, 240], [255, 260], [275, 250]
    ],
  },
  b: {
    name: 'Chữ b',
    phonics: 'Bờ',
    guideText: 'Nét 1: Khuyết trên cao 5 ly. Nét 2: Thắt ở cuối nối sang nét khác.',
    points: [
      [160, 260], [175, 220], [195, 150], [220, 80], [235, 60],
      [245, 75], [235, 130], [220, 200], [220, 250], [240, 260],
      [260, 240], [250, 220], [230, 225]
    ],
  },
  c: {
    name: 'Chữ c',
    phonics: 'Cờ',
    guideText: 'Nét cong hở phải cao 2 ly, lưng cong đều chạm đường kẻ.',
    points: [
      [235, 165], [215, 145], [180, 145], [150, 175], [140, 205],
      [150, 235], [180, 260], [220, 260], [245, 240]
    ],
  },
  d: {
    name: 'Chữ d',
    phonics: 'Dờ',
    guideText: 'Nét 1: Cong kín 2 ly. Nét 2: Móc ngược cao 4 ly kéo dài từ trên xuống.',
    points: [
      [215, 150], [185, 140], [155, 160], [140, 190], [140, 220],
      [155, 250], [185, 260], [215, 250], [235, 220], [235, 190],
      [215, 150], [235, 90], [235, 240], [250, 260], [270, 250]
    ],
  },
  h: {
    name: 'Chữ h',
    phonics: 'Hờ',
    guideText: 'Nét 1: Khuyết trên cao 5 ly. Nét 2: Móc hai đầu cao 2 ly.',
    points: [
      [160, 260], [180, 210], [205, 140], [225, 75], [235, 60],
      [245, 75], [235, 140], [225, 260], [225, 190], [245, 160],
      [265, 160], [275, 190], [275, 240], [290, 260], [305, 250]
    ],
  },
  m: {
    name: 'Chữ m',
    phonics: 'Mờ',
    guideText: 'Gồm 2 nét móc xuôi và 1 nét móc hai đầu liền mạch nhau.',
    points: [
      [150, 175], [165, 155], [180, 175], [180, 260],
      [180, 190], [200, 155], [220, 175], [220, 260],
      [220, 190], [240, 155], [260, 175], [260, 240], [275, 260], [295, 250]
    ],
  },
};

// ==========================================
// MAIN COMPONENT
// ==========================================
export const StepByStepConstructionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  // Navigation & Filter States
  const [activeGradeLevel, setActiveGradeLevel] = useState<GradeLevel>('highschool');
  const [selectedSubject, setSelectedSubject] = useState<string>('Tất cả');
  const [selectedSimId, setSelectedSimId] = useState<string>('pyr-cross-section');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Parameter State Map (id -> number)
  const [paramValues, setParamValues] = useState<Record<string, number>>({});

  // 3D Canvas Interaction (yaw, pitch, zoom)
  const [rotation3D, setRotation3D] = useState<{ yaw: number; pitch: number; zoom: number }>({
    yaw: 0.65,
    pitch: 0.42,
    zoom: 1.0,
  });
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Custom Simulation Generator State
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isGeneratingCustom, setIsGeneratingCustom] = useState<boolean>(false);
  const [customList, setCustomList] = useState<SimulationConfig[]>([]);

  // Primary Interactive Letters
  const [activeLetter, setActiveLetter] = useState<string>('a');

  // Canvas Refs & Loop
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);
  const stepProgressRef = useRef<number>(1.0);
  const lastStepTimeRef = useRef<number>(Date.now());
  const hasTriggeredVictorySoundRef = useRef<boolean>(false);

  // Sync sound preference
  useEffect(() => {
    audioEngine.soundEnabled = soundEnabled;
  }, [soundEnabled]);

  // Load persisted custom simulations from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('smartboard_custom_simulations_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCustomList(parsed);
        }
      }
    } catch (_) {}
  }, []);

  // Combine default simulations and teacher custom-generated items
  const allSimulations = useMemo(() => {
    return [...customList, ...FULL_SIMULATIONS];
  }, [customList]);

  // Filter list by selected grade level and subject
  const gradeFilteredSims = useMemo(() => {
    return allSimulations.filter((s) => s.gradeLevel === activeGradeLevel);
  }, [allSimulations, activeGradeLevel]);

  const availableSubjects = useMemo(() => {
    return Array.from(new Set(gradeFilteredSims.map((s) => s.subject)));
  }, [gradeFilteredSims]);

  const finalSims = useMemo(() => {
    return gradeFilteredSims.filter(
      (s) => selectedSubject === 'Tất cả' || s.subject === selectedSubject
    );
  }, [gradeFilteredSims, selectedSubject]);

  const activeSimulation = useMemo(() => {
    return (
      allSimulations.find((s) => s.id === selectedSimId) ||
      finalSims[0] ||
      FULL_SIMULATIONS[0]
    );
  }, [allSimulations, selectedSimId, finalSims]);

  const activeStep = activeSimulation.steps[currentStepIndex] || activeSimulation.steps[0];

  // Initialize parameter values when active simulation changes
  useEffect(() => {
    if (activeSimulation.parameters) {
      const initVals: Record<string, number> = {};
      activeSimulation.parameters.forEach((p) => {
        initVals[p.id] = p.defaultValue;
      });
      setParamValues(initVals);
    }
    setCurrentStepIndex(0);
    stepProgressRef.current = 1.0;
    hasTriggeredVictorySoundRef.current = false;
  }, [activeSimulation.id]);

  // Reset step progress animation when switching steps
  useEffect(() => {
    stepProgressRef.current = 0.05;
    lastStepTimeRef.current = Date.now();
    audioEngine.playWhooshDraw();

    if (activeStep?.audioNarration && soundEnabled && isOpen) {
      try {
        speakText(activeStep.audioNarration);
      } catch (_) {}
    }
  }, [currentStepIndex, activeSimulation.id, soundEnabled, isOpen]);

  // Auto-play timer
  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= activeSimulation.steps.length - 1) {
            setIsPlaying(false);
            audioEngine.playVictoryChime();
            return prev;
          }
          return prev + 1;
        });
      }, 5000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, activeSimulation.steps.length]);

  // Handle slider changes
  const handleParamChange = (paramId: string, val: number) => {
    setParamValues((prev) => ({
      ...prev,
      [paramId]: val,
    }));
    audioEngine.playClick();
  };

  // Determine if current simulation reaches optimal extremum
  const isOptimal = useMemo(() => {
    if (activeSimulation.id === 'box-folding') {
      const cutX = paramValues['cutX'] ?? 10;
      return Math.abs(cutX - 10.0) <= 0.4;
    }
    if (activeSimulation.id === 'acid-titration') {
      const drops = paramValues['drops'] ?? 15;
      return Math.abs(drops - 20.0) <= 0.8;
    }
    if (activeSimulation.id === 'light-refraction') {
      const angle = paramValues['angleI'] ?? 35;
      return angle >= 48.6;
    }
    return false;
  }, [activeSimulation.id, paramValues]);

  // Play fanfare when user first reaches the optimal point
  useEffect(() => {
    if (isOptimal && !hasTriggeredVictorySoundRef.current) {
      hasTriggeredVictorySoundRef.current = true;
      audioEngine.playVictoryChime();
    } else if (!isOptimal) {
      hasTriggeredVictorySoundRef.current = false;
    }
  }, [isOptimal]);

  // Mouse / Touch handlers for 3D rotation & zoom
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    setRotation3D((prev) => ({
      ...prev,
      yaw: prev.yaw + dx * 0.012,
      pitch: Math.max(-1.4, Math.min(1.4, prev.pitch + dy * 0.012)),
    }));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY * -0.0015;
    setRotation3D((prev) => ({
      ...prev,
      zoom: Math.max(0.4, Math.min(2.5, prev.zoom + delta)),
    }));
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - lastMousePosRef.current.x;
    const dy = e.touches[0].clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

    setRotation3D((prev) => ({
      ...prev,
      yaw: prev.yaw + dx * 0.015,
      pitch: Math.max(-1.4, Math.min(1.4, prev.pitch + dy * 0.015)),
    }));
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

  const reset3DView = () => {
    setRotation3D({ yaw: 0.65, pitch: 0.42, zoom: 1.0 });
    audioEngine.playClick();
  };

  // ==========================================
  // DYNAMIC 60FPS CANVAS RENDERING ENGINE
  // ==========================================
  useEffect(() => {
    if (!isOpen) return;

    let isSubscribed = true;

    const renderLoop = () => {
      if (!isSubscribed) return;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Resize canvas to match display size with DPR
          const rect = canvas.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          const displayWidth = Math.max(300, Math.floor(rect.width));
          const displayHeight = Math.max(200, Math.floor(rect.height));

          if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
            canvas.width = displayWidth * dpr;
            canvas.height = displayHeight * dpr;
          }

          ctx.save();
          ctx.scale(dpr, dpr);

          // Animate step progress from 0 -> 1 smoothly
          if (stepProgressRef.current < 1.0) {
            stepProgressRef.current = Math.min(1.0, stepProgressRef.current + 0.04);
            if (stepProgressRef.current >= 1.0) {
              audioEngine.playTingStep();
            }
          }

          timeRef.current += 0.03;
          const time = timeRef.current;
          const stepProgress = stepProgressRef.current;
          const currentStep = currentStepIndex + 1;

          // Clear with dark cyber-chalkboard theme
          ctx.fillStyle = '#0a0e17';
          ctx.fillRect(0, 0, displayWidth, displayHeight);

          // Subtle background grid
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
          ctx.lineWidth = 1;
          const gridSize = 32;
          for (let x = 0; x < displayWidth; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, displayHeight);
            ctx.stroke();
          }
          for (let y = 0; y < displayHeight; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(displayWidth, y);
            ctx.stroke();
          }

          // RENDER BY SIMULATION TYPE
          try {
            if (activeSimulation.customCode) {
              // Custom code generated by Gemini API
              try {
                const customFn = new Function(
                  'ctx',
                  'width',
                  'height',
                  'currentStep',
                  'stepProgress',
                  'params',
                  'time',
                  'rotation3D',
                  'isOptimal',
                  activeSimulation.customCode
                );
                customFn(
                  ctx,
                  displayWidth,
                  displayHeight,
                  currentStep,
                  stepProgress,
                  paramValues,
                  time,
                  rotation3D,
                  isOptimal
                );
              } catch (renderErr) {
                renderFallbackCustom(ctx, displayWidth, displayHeight, currentStep, time, activeSimulation.title);
              }
            } else if (activeSimulation.simType === '3D_GEOMETRY') {
              render3DGeometry(
                ctx,
                displayWidth,
                displayHeight,
                currentStep,
                stepProgress,
                paramValues,
                rotation3D
              );
            } else if (activeSimulation.simType === 'REAL_MATH') {
              renderRealMathDual(
                ctx,
                displayWidth,
                displayHeight,
                currentStep,
                stepProgress,
                paramValues,
                time,
                isOptimal,
                activeSimulation.id
              );
            } else if (activeSimulation.simType === 'PHYSICS') {
              renderPhysics(
                ctx,
                displayWidth,
                displayHeight,
                currentStep,
                stepProgress,
                paramValues,
                time,
                activeSimulation.id
              );
            } else if (activeSimulation.simType === 'CHEMISTRY') {
              renderChemistry(
                ctx,
                displayWidth,
                displayHeight,
                currentStep,
                stepProgress,
                paramValues,
                time,
                isOptimal
              );
            } else if (activeSimulation.simType === 'PRIMARY_HANDWRITING') {
              renderPrimaryHandwriting(
                ctx,
                displayWidth,
                displayHeight,
                currentStep,
                stepProgress,
                activeLetter,
                time
              );
            } else if (activeSimulation.simType === 'PRIMARY_FRACTION') {
              renderPrimaryPizza(
                ctx,
                displayWidth,
                displayHeight,
                currentStep,
                stepProgress,
                paramValues,
                time
              );
            } else {
              renderFallbackCustom(ctx, displayWidth, displayHeight, currentStep, time, activeSimulation.title);
            }
          } catch (e) {
            console.error('Canvas render error:', e);
          }

          ctx.restore();
        }
      }

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animationFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      isSubscribed = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isOpen, activeSimulation, currentStepIndex, paramValues, rotation3D, isOptimal, activeLetter]);

  // ==========================================
  // PROCEDURAL RENDERERS FOR THE 4 DOMAINS
  // ==========================================

  // [1] 3D GEOMETRY: Pyramid S.ABCD with cutting plane
  const render3DGeometry = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    step: number,
    stepProgress: number,
    params: Record<string, number>,
    rot: { yaw: number; pitch: number; zoom: number }
  ) => {
    const H = (params['pyrHeight'] ?? 230) * rot.zoom;
    const a = (params['baseScale'] ?? 200) * rot.zoom;
    const cutRatio = params['cutHeight'] ?? 0.5;

    const cx = width / 2;
    const cy = height / 2 + 50;

    // 3D Perspective Projection Function
    const project = (x: number, y: number, z: number): [number, number, number] => {
      // Rotation around Y (yaw)
      const cosY = Math.cos(rot.yaw);
      const sinY = Math.sin(rot.yaw);
      const x1 = x * cosY - z * sinY;
      const z1 = x * sinY + z * cosY;

      // Rotation around X (pitch)
      const cosP = Math.cos(rot.pitch);
      const sinP = Math.sin(rot.pitch);
      const y2 = y * cosP - z1 * sinP;
      const z2 = y * sinP + z1 * cosP;

      // Perspective projection
      const dist = 600;
      const fov = dist / (dist + z2);
      return [cx + x1 * fov, cy - y2 * fov, z2];
    };

    // Base vertices (Square ABCD centered at origin on y = 0)
    const half = a / 2;
    const pA = project(-half, 0, -half); // A (back left)
    const pB = project(half, 0, -half);  // B (back right)
    const pC = project(half, 0, half);   // C (front right)
    const pD = project(-half, 0, half);  // D (front left)
    const pH = project(0, 0, 0);         // Center H
    const pS = project(0, H, 0);         // Apex S

    // Cutting plane points M, N, P, Q at height cutRatio * H
    const cutH = H * cutRatio;
    const cutHalf = half * (1 - cutRatio);
    const pM = project(-cutHalf, cutH, -cutHalf);
    const pN = project(cutHalf, cutH, -cutHalf);
    const pP = project(cutHalf, cutH, cutHalf);
    const pQ = project(-cutHalf, cutH, cutHalf);
    const pHPrime = project(0, cutH, 0);

    const drawLine = (
      p1: [number, number, number],
      p2: [number, number, number],
      dashed: boolean,
      color: string,
      glow: boolean,
      progress: number = 1.0
    ) => {
      ctx.save();
      ctx.beginPath();
      if (dashed) {
        ctx.setLineDash([6, 6]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = glow ? 2.5 : 1.8;
      if (glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
      }
      ctx.moveTo(p1[0], p1[1]);
      const targetX = p1[0] + (p2[0] - p1[0]) * Math.min(1.0, progress);
      const targetY = p1[1] + (p2[1] - p1[1]) * Math.min(1.0, progress);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      ctx.restore();
    };

    const drawVertex = (p: [number, number, number], label: string, color: string) => {
      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(label, p[0] + 8, p[1] - 8);
      ctx.restore();
    };

    // STEP 1: Base ABCD
    const prog1 = step >= 1 ? (step === 1 ? stepProgress : 1) : 0;
    if (prog1 > 0) {
      drawLine(pA, pB, true, '#00f2fe88', false, prog1);
      drawLine(pA, pD, true, '#00f2fe88', false, prog1);
      drawLine(pB, pC, false, '#00f2fe', true, prog1);
      drawLine(pC, pD, false, '#00f2fe', true, prog1);

      drawVertex(pA, 'A', '#00f2fe');
      drawVertex(pB, 'B', '#00f2fe');
      drawVertex(pC, 'C', '#00f2fe');
      drawVertex(pD, 'D', '#00f2fe');
    }

    // STEP 2: Height SH
    const prog2 = step >= 2 ? (step === 2 ? stepProgress : 1) : 0;
    if (prog2 > 0) {
      drawLine(pA, pC, true, 'rgba(255,255,255,0.25)', false, prog2);
      drawLine(pB, pD, true, 'rgba(255,255,255,0.25)', false, prog2);
      drawLine(pH, pS, true, '#fbbf24', true, prog2);
      drawVertex(pH, 'H', '#fbbf24');
      drawVertex(pS, 'S', '#fbbf24');
    }

    // STEP 3: Lateral Edges SA, SB, SC, SD
    const prog3 = step >= 3 ? (step === 3 ? stepProgress : 1) : 0;
    if (prog3 > 0) {
      drawLine(pS, pA, true, '#00f2fe88', false, prog3);
      drawLine(pS, pB, false, '#00f2fe', true, prog3);
      drawLine(pS, pC, false, '#00f2fe', true, prog3);
      drawLine(pS, pD, false, '#00f2fe', true, prog3);
    }

    // STEP 4: Cutting Plane (alpha)
    const prog4 = step >= 4 ? (step === 4 ? stepProgress : 1) : 0;
    if (prog4 > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pM[0], pM[1]);
      ctx.lineTo(pN[0], pN[1]);
      ctx.lineTo(pP[0], pP[1]);
      ctx.lineTo(pQ[0], pQ[1]);
      ctx.closePath();
      ctx.fillStyle = `rgba(244, 63, 94, ${0.28 * prog4})`;
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.restore();

      drawLine(pM, pN, false, '#f43f5e', true, prog4);
      drawLine(pN, pP, false, '#f43f5e', true, prog4);
      drawLine(pP, pQ, false, '#f43f5e', true, prog4);
      drawLine(pQ, pM, false, '#f43f5e', true, prog4);

      drawVertex(pM, 'M', '#f43f5e');
      drawVertex(pN, 'N', '#f43f5e');
      drawVertex(pP, 'P', '#f43f5e');
      drawVertex(pQ, 'Q', '#f43f5e');
      drawVertex(pHPrime, "H'", '#f43f5e');
    }

    // Interactive Instruction Badge
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(16, height - 42, 230, 28, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('🖱️ Kéo chuột xoay 360° | Cuộn Zoom', 24, height - 24);
    ctx.restore();
  };

  // [2] REAL_MATH: Dual View (Physical reactive model + Function curve V(x) / Parabola)
  const renderRealMathDual = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    step: number,
    stepProgress: number,
    params: Record<string, number>,
    time: number,
    optimal: boolean,
    simId: string
  ) => {
    const splitX = width * 0.48;

    // Divider line
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(splitX, 20);
    ctx.lineTo(splitX, height - 20);
    ctx.stroke();
    ctx.restore();

    if (simId === 'box-folding') {
      const cutX = params['cutX'] ?? 10.0;
      const sheetL = params['sheetL'] ?? 80;
      const sheetW = params['sheetW'] ?? 50;

      // ---------------- LEFT: PHYSICAL REACTIVE MODEL ----------------
      ctx.save();
      ctx.translate(splitX / 2, height / 2);

      const scale = Math.min((splitX * 0.75) / sheetL, (height * 0.7) / sheetW);
      const wPx = sheetL * scale;
      const hPx = sheetW * scale;
      const xPx = cutX * scale;

      // Sheet boundary
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 2;
      ctx.fillStyle = optimal ? 'rgba(251, 191, 36, 0.15)' : 'rgba(0, 242, 254, 0.08)';
      ctx.shadowColor = optimal ? '#fbbf24' : '#00f2fe';
      ctx.shadowBlur = optimal ? 20 : 8;

      ctx.beginPath();
      // Outer sheet with 4 cut corners
      ctx.moveTo(-wPx / 2 + xPx, -hPx / 2);
      ctx.lineTo(wPx / 2 - xPx, -hPx / 2);
      ctx.lineTo(wPx / 2 - xPx, -hPx / 2 + xPx);
      ctx.lineTo(wPx / 2, -hPx / 2 + xPx);
      ctx.lineTo(wPx / 2, hPx / 2 - xPx);
      ctx.lineTo(wPx / 2 - xPx, hPx / 2 - xPx);
      ctx.lineTo(wPx / 2 - xPx, hPx / 2);
      ctx.lineTo(-wPx / 2 + xPx, hPx / 2);
      ctx.lineTo(-wPx / 2 + xPx, hPx / 2 - xPx);
      ctx.lineTo(-wPx / 2, hPx / 2 - xPx);
      ctx.lineTo(-wPx / 2, -hPx / 2 + xPx);
      ctx.lineTo(-wPx / 2 + xPx, -hPx / 2 + xPx);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Fold lines (dashed)
      ctx.strokeStyle = '#fbbf24';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-wPx / 2 + xPx, -hPx / 2 + xPx, wPx - 2 * xPx, hPx - 2 * xPx);

      // Label dimensions
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`Đáy: ${(sheetL - 2 * cutX).toFixed(1)} x ${(sheetW - 2 * cutX).toFixed(1)} cm`, 0, 5);
      ctx.fillText(`Cắt: x = ${cutX.toFixed(1)} cm`, -wPx / 2 + xPx / 2, -hPx / 2 + xPx / 2 + 4);
      ctx.restore();

      // ---------------- RIGHT: COORDINATE PLANE & V(x) CURVE ----------------
      ctx.save();
      const originX = splitX + 45;
      const originY = height - 55;
      const plotW = width - originX - 35;
      const plotH = height - 100;

      // Axes
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // Ox
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX + plotW, originY);
      // Oy
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX, originY - plotH);
      ctx.stroke();

      // Axis Labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px system-ui';
      ctx.fillText('x (cm)', originX + plotW - 10, originY + 22);
      ctx.fillText('V(x) cm³', originX - 25, originY - plotH - 10);

      // Plot V(x) curve: V(x) = x*(80 - 2x)*(50 - 2x) for x in [0, 25]
      // Max V is approx 18000 at x = 10
      const maxVal = 20000;
      const maxX = 25;

      ctx.beginPath();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      for (let px = 0; px <= plotW; px += 2) {
        const xVal = (px / plotW) * maxX;
        const vVal = xVal * (sheetL - 2 * xVal) * (sheetW - 2 * xVal);
        const py = originY - (Math.max(0, vVal) / maxVal) * plotH;
        if (px === 0) ctx.moveTo(originX + px, py);
        else ctx.lineTo(originX + px, py);
      }
      ctx.stroke();

      // Active Point on curve
      const currentV = cutX * (sheetL - 2 * cutX) * (sheetW - 2 * cutX);
      const activePx = originX + (cutX / maxX) * plotW;
      const activePy = originY - (Math.max(0, currentV) / maxVal) * plotH;

      // Drop lines to axes
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(activePx, originY);
      ctx.lineTo(activePx, activePy);
      ctx.lineTo(originX, activePy);
      ctx.stroke();

      // Glowing Point
      ctx.fillStyle = optimal ? '#fbbf24' : '#f43f5e';
      ctx.shadowColor = optimal ? '#fbbf24' : '#f43f5e';
      ctx.shadowBlur = optimal ? 18 : 10;
      ctx.beginPath();
      ctx.arc(activePx, activePy, optimal ? 7 : 5.5, 0, Math.PI * 2);
      ctx.fill();

      // Coordinates text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px system-ui';
      ctx.fillText(
        `(${cutX.toFixed(1)} cm, ${Math.round(currentV).toLocaleString()} cm³)`,
        activePx + 10,
        activePy - 10
      );
      ctx.restore();

      // ---------------- CELEBRATION AURA & OPTIMAL BADGE ----------------
      if (optimal) {
        ctx.save();
        ctx.fillStyle = 'rgba(251, 191, 36, 0.95)';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 25;
        const badgeW = 390;
        const badgeH = 34;
        const bx = (width - badgeW) / 2;
        const by = 20;

        ctx.beginPath();
        ctx.roundRect(bx, by, badgeW, badgeH, 12);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'black 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★ ĐẠT GIÁ TRỊ TỐI ƯU CỰC ĐẠI: V_max ≈ 18.000 cm³ (tại x = 10 cm) ★', width / 2, by + 22);
        ctx.restore();
      }
    } else if (simId === 'parabola-truck') {
      const truckW = params['truckW'] ?? 3.6;
      const truckH = params['truckH'] ?? 4.2;
      const gateH = params['gateH'] ?? 6.0;

      // Parabola y = a*x^2 + gateH, goes through (4, 0) => a = -gateH/16
      const a = -gateH / 16;
      const halfW = truckW / 2;
      const yAtEdge = a * halfW * halfW + gateH;
      const isSafe = yAtEdge > truckH;

      ctx.save();
      const ox = width / 2;
      const oy = height - 60;
      const scaleX = 40;
      const scaleY = 35;

      // Ground
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ox - 240, oy);
      ctx.lineTo(ox + 240, oy);
      ctx.stroke();

      // Parabola Arch
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let x = -4.5; x <= 4.5; x += 0.1) {
        const y = Math.max(0, a * x * x + gateH);
        const px = ox + x * scaleX;
        const py = oy - y * scaleY;
        if (x === -4.5) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Truck in center
      const truckPxW = truckW * scaleX;
      const truckPxH = truckH * scaleY;
      ctx.fillStyle = isSafe ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.5)';
      ctx.strokeStyle = isSafe ? '#10b981' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.shadowColor = isSafe ? '#10b981' : '#ef4444';
      ctx.shadowBlur = 10;
      ctx.fillRect(ox - truckPxW / 2, oy - truckPxH, truckPxW, truckPxH);
      ctx.strokeRect(ox - truckPxW / 2, oy - truckPxH, truckPxW, truckPxH);

      // Wheels
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(ox - truckPxW / 3, oy - 6, 8, 0, Math.PI * 2);
      ctx.arc(ox + truckPxW / 3, oy - 6, 8, 0, Math.PI * 2);
      ctx.fill();

      // Edge Clearance Check Line
      const clearanceY = oy - yAtEdge * scaleY;
      ctx.strokeStyle = '#fbbf24';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(ox + truckPxW / 2, oy);
      ctx.lineTo(ox + truckPxW / 2, clearanceY);
      ctx.stroke();

      // Status Badge
      ctx.fillStyle = isSafe ? '#10b981' : '#ef4444';
      ctx.font = 'bold 13px system-ui';
      ctx.textAlign = 'center';
      const clearanceCm = Math.round((yAtEdge - truckH) * 100);
      ctx.fillText(
        isSafe
          ? `✓ XE ĐI QUA AN TOÀN (Khoảng hở mép vòm: +${clearanceCm} cm)`
          : `⚠️ NGUY HIỂM: XE VA CHẠM VÒM CỔNG (Thiếu hụt: ${clearanceCm} cm)`,
        ox,
        50
      );
      ctx.restore();
    } else {
      // General Fallback Dual
      ctx.save();
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '14px system-ui';
      ctx.fillText('Mô phỏng toán học thực tế & đồ thị tương tác.', splitX / 2, height / 2);
      ctx.restore();
    }
  };

  // [3] PHYSICS: Young's Double-Slit Wave Interference & Snell Refraction
  const renderPhysics = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    step: number,
    stepProgress: number,
    params: Record<string, number>,
    time: number,
    simId: string
  ) => {
    if (simId === 'young-interference') {
      const lambdaNm = params['lambda'] ?? 650; // nm
      const slitA = params['slitA'] ?? 1.0;     // mm
      const screenD = params['screenD'] ?? 2.0; // m

      // Wavelength to RGB color
      const wavelengthToRGB = (wl: number): string => {
        if (wl < 440) return '#8b5cf6'; // Violet
        if (wl < 490) return '#06b6d4'; // Cyan
        if (wl < 560) return '#10b981'; // Green
        if (wl < 600) return '#eab308'; // Yellow
        if (wl < 640) return '#f97316'; // Orange
        return '#ef4444'; // Red
      };

      const waveColor = wavelengthToRGB(lambdaNm);
      const slitX = 140;
      const screenX = width - 110;
      const cy = height / 2;
      const slitDistPx = slitA * 28;
      const s1Y = cy - slitDistPx / 2;
      const s2Y = cy + slitDistPx / 2;

      // 1. Laser source on left
      ctx.save();
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(20, cy - 30, 60, 60);
      ctx.strokeStyle = '#475569';
      ctx.strokeRect(20, cy - 30, 60, 60);
      ctx.fillStyle = waveColor;
      ctx.shadowColor = waveColor;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(80, cy, 6, 0, Math.PI * 2);
      ctx.fill();

      // Laser beam to slit barrier
      ctx.strokeStyle = waveColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(80, cy);
      ctx.lineTo(slitX, cy);
      ctx.stroke();

      // Slit Barrier
      ctx.fillStyle = '#334155';
      ctx.fillRect(slitX - 4, 30, 8, s1Y - 35);
      ctx.fillRect(slitX - 4, s1Y + 5, 8, s2Y - s1Y - 10);
      ctx.fillRect(slitX - 4, s2Y + 5, 8, height - s2Y - 35);

      // Slit labels S1, S2
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px system-ui';
      ctx.fillText('S1', slitX - 22, s1Y + 4);
      ctx.fillText('S2', slitX - 22, s2Y + 4);

      // 2. Continuous Wavefronts propagating from S1 & S2 (60FPS animation)
      ctx.lineWidth = 1.2;
      const numWaves = 14;
      const waveSpeed = 25;
      const waveSpacing = 16;

      for (let i = 0; i < numWaves; i++) {
        const radius = ((time * waveSpeed + i * waveSpacing) % (screenX - slitX));
        const alpha = Math.max(0, 1 - radius / (screenX - slitX)) * 0.45;
        ctx.strokeStyle = waveColor;
        ctx.globalAlpha = alpha;

        // Wave from S1
        ctx.beginPath();
        ctx.arc(slitX, s1Y, radius, -Math.PI / 2.2, Math.PI / 2.2);
        ctx.stroke();

        // Wave from S2
        ctx.beginPath();
        ctx.arc(slitX, s2Y, radius, -Math.PI / 2.2, Math.PI / 2.2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

      // 3. Observation Screen on Right
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(screenX, 30, 24, height - 60);
      ctx.strokeStyle = '#475569';
      ctx.strokeRect(screenX, 30, 24, height - 60);

      // Calculate fringe spacing i = lambda * D / a
      // Map to screen pixel spacing
      const fringeSpacingPx = ((lambdaNm * 1e-6 * screenD) / slitA) * 70;

      for (let y = 35; y < height - 35; y += 1.5) {
        const distFromCenter = y - cy;
        const phase = (distFromCenter / Math.max(4, fringeSpacingPx)) * Math.PI;
        const intensity = Math.pow(Math.cos(phase), 2);

        ctx.fillStyle = waveColor;
        ctx.globalAlpha = intensity * 0.95;
        ctx.fillRect(screenX + 2, y, 20, 2);
      }
      ctx.globalAlpha = 1.0;

      // Intensity curve I(x) graph to the right of the screen
      ctx.beginPath();
      ctx.strokeStyle = waveColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = waveColor;
      ctx.shadowBlur = 8;
      for (let y = 35; y < height - 35; y += 2) {
        const distFromCenter = y - cy;
        const phase = (distFromCenter / Math.max(4, fringeSpacingPx)) * Math.PI;
        const intensity = Math.pow(Math.cos(phase), 2);
        const px = screenX + 32 + intensity * 40;
        if (y === 35) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();

      // Screen Label
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 11px system-ui';
      ctx.fillText('Màn E', screenX - 6, 22);
      ctx.fillText('I(x)', screenX + 45, 22);
      ctx.restore();
    } else if (simId === 'light-refraction') {
      const angleI = params['angleI'] ?? 35;
      const n1 = params['n1'] ?? 1.33;
      const n2 = 1.0; // Air

      const cx = width / 2;
      const cy = height / 2;
      const ighDeg = Math.asin(n2 / n1) * (180 / Math.PI);
      const isTotalInternal = angleI > ighDeg;

      ctx.save();
      // Bottom Water Medium (n1)
      ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
      ctx.fillRect(0, cy, width, height - cy);

      // Boundary line
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
      ctx.stroke();

      // Normal Line (dashed)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, 30);
      ctx.lineTo(cx, height - 30);
      ctx.stroke();

      // Labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px system-ui';
      ctx.fillText('Không khí (n2 = 1.0)', 30, cy - 20);
      ctx.fillText(`Nước (n1 = ${n1.toFixed(2)})`, 30, cy + 30);

      // Incident ray (from water bottom-left to center)
      const radI = (angleI * Math.PI) / 180;
      const rayLen = Math.min(width, height) * 0.4;
      const inX = cx - rayLen * Math.sin(radI);
      const inY = cy + rayLen * Math.cos(radI);

      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(inX, inY);
      ctx.lineTo(cx, cy);
      ctx.stroke();

      // Reflected ray
      const refX = cx + rayLen * Math.sin(radI);
      const refY = cy + rayLen * Math.cos(radI);
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = isTotalInternal ? 3.5 : 1.8;
      ctx.globalAlpha = isTotalInternal ? 1.0 : 0.45;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(refX, refY);
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      // Refracted ray (if not total internal reflection)
      if (!isTotalInternal) {
        const sinR = (n1 / n2) * Math.sin(radI);
        const radR = Math.asin(Math.min(1.0, sinR));
        const outX = cx + rayLen * Math.sin(radR);
        const outY = cy - rayLen * Math.cos(radR);

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(outX, outY);
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 12px system-ui';
        ctx.fillText(`r = ${((radR * 180) / Math.PI).toFixed(1)}°`, cx + 35, cy - 45);
      } else {
        // Total internal reflection warning banner
        ctx.fillStyle = '#ef4444';
        ctx.font = 'black 14px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('🔥 PHẢN XẠ TOÀN PHẦN 100% (ỨNG DỤNG CÁP QUANG)', cx, 60);
      }

      ctx.restore();
    }
  };

  // [4] CHEMISTRY: Acid-Base Titration with falling drops, bubbles & smooth color change
  const renderChemistry = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    step: number,
    stepProgress: number,
    params: Record<string, number>,
    time: number,
    optimal: boolean
  ) => {
    const drops = params['drops'] ?? 15; // ml NaOH
    const eqMl = 20.0;
    const isPastEq = drops >= eqMl;

    const cx = width / 2 - 80;
    const buretTop = 40;
    const buretBottom = 170;
    const flaskBottom = height - 50;

    ctx.save();

    // 1. Glass Buret
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.fillRect(cx - 12, buretTop, 24, buretBottom - buretTop);
    ctx.strokeRect(cx - 12, buretTop, 24, buretBottom - buretTop);

    // Buret Meniscus Level
    const buretLiquidHeight = Math.max(10, (buretBottom - buretTop) * (1 - drops / 40));
    ctx.fillStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.fillRect(cx - 11, buretBottom - buretLiquidHeight, 22, buretLiquidHeight);

    // Valve
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(cx - 16, buretBottom, 32, 8);

    // 2. Falling Droplet Animation (gravity)
    const dropCycle = (time * 3) % 1.0;
    const dropY = buretBottom + 12 + dropCycle * (flaskBottom - 110 - buretBottom);
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx, dropY, 4, 0, Math.PI * 2);
    ctx.fill();

    // 3. Erlenmeyer Flask
    const flaskTopY = buretBottom + 45;
    const neckW = 26;
    const baseW = 140;

    ctx.beginPath();
    ctx.moveTo(cx - neckW / 2, flaskTopY);
    ctx.lineTo(cx - neckW / 2, flaskTopY + 30);
    ctx.lineTo(cx - baseW / 2, flaskBottom);
    ctx.lineTo(cx + baseW / 2, flaskBottom);
    ctx.lineTo(cx + neckW / 2, flaskTopY + 30);
    ctx.lineTo(cx + neckW / 2, flaskTopY);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 4. Indicator Color Transition
    // Clear transparent -> faint pink around 19.5 -> vibrant persistent magenta/pink at 20.0+
    let r = 56, g = 189, b = 248, a = 0.2; // default clear sky
    if (drops >= 19.0 && drops < 20.0) {
      const t = (drops - 19.0) / 1.0;
      r = 56 + t * (244 - 56);
      g = 189 + t * (63 - 189);
      b = 248 + t * (94 - 248);
      a = 0.2 + t * 0.4;
    } else if (drops >= 20.0) {
      r = 244;
      g = 63;
      b = 94; // Vibrant Magenta #f43f5e
      a = 0.65;
    }

    // Liquid in Flask
    const liquidTopY = flaskBottom - 65;
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
    if (isPastEq) {
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 20;
    }
    ctx.beginPath();
    ctx.moveTo(cx - baseW / 2 + 15, liquidTopY);
    ctx.lineTo(cx + baseW / 2 - 15, liquidTopY);
    ctx.lineTo(cx + baseW / 2 - 3, flaskBottom - 3);
    ctx.lineTo(cx - baseW / 2 + 3, flaskBottom - 3);
    ctx.closePath();
    ctx.fill();

    // Bubbles
    for (let i = 0; i < 4; i++) {
      const bx = cx - 25 + i * 18 + Math.sin(time * 3 + i) * 6;
      const by = flaskBottom - 15 - ((time * 35 + i * 20) % 45);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. pH Titration Curve Plot on Right Side
    const plotX = width / 2 + 60;
    const plotY = height - 60;
    const plotW = width - plotX - 40;
    const plotH = 160;

    // Chart Box
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(plotX, plotY - plotH, plotW, plotH);

    // Chart Axes
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px system-ui';
    ctx.fillText('pH', plotX - 22, plotY - plotH + 12);
    ctx.fillText('V (ml)', plotX + plotW - 25, plotY + 18);
    ctx.fillText('14', plotX - 18, plotY - plotH + 18);
    ctx.fillText('7', plotX - 14, plotY - plotH / 2 + 4);
    ctx.fillText('0', plotX - 14, plotY);

    // Sigmoid Titration Curve
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let px = 0; px <= plotW; px += 2) {
      const v = (px / plotW) * 40;
      // Sigmoidal pH formula
      const ph = 7.0 + 5.5 * Math.tanh((v - 20) * 0.4);
      const py = plotY - (ph / 14) * plotH;
      if (px === 0) ctx.moveTo(plotX + px, py);
      else ctx.lineTo(plotX + px, py);
    }
    ctx.stroke();

    // Current point
    const curPh = 7.0 + 5.5 * Math.tanh((drops - 20) * 0.4);
    const ptX = plotX + (drops / 40) * plotW;
    const ptY = plotY - (curPh / 14) * plotH;

    ctx.fillStyle = isPastEq ? '#f43f5e' : '#38bdf8';
    ctx.shadowColor = isPastEq ? '#f43f5e' : '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(ptX, ptY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui';
    ctx.fillText(`pH ≈ ${curPh.toFixed(2)}`, ptX + 10, ptY - 8);

    ctx.restore();
  };

  // [5] PRIMARY: Handwriting on 4 o-ly grid
  const renderPrimaryHandwriting = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    step: number,
    stepProgress: number,
    letterKey: string,
    time: number
  ) => {
    const letter = PRIMARY_LETTERS[letterKey] || PRIMARY_LETTERS['a'];
    const cx = width / 2;
    const cy = height / 2;

    ctx.save();
    // 4 O-ly Grid
    const lineSpacing = 38;
    const topY = cy - lineSpacing * 2.5;

    for (let i = 0; i <= 5; i++) {
      const y = topY + i * lineSpacing;
      ctx.beginPath();
      ctx.moveTo(60, y);
      ctx.lineTo(width - 60, y);
      if (i === 3) {
        // Base line 1 (thicker)
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
      } else {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.lineWidth = 1;
      }
      ctx.stroke();
    }

    // Vertical dashed lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
    ctx.setLineDash([3, 3]);
    for (let x = 60; x <= width - 60; x += lineSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, topY + 5 * lineSpacing);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Stroke Drawing
    const points = letter.points;
    const totalSegments = points.length - 1;
    const currentSegmentIndex = Math.min(totalSegments, Math.floor(stepProgress * totalSegments));
    const segmentSubT = (stepProgress * totalSegments) - currentSegmentIndex;

    ctx.strokeStyle = '#c084fc'; // Violet ink
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.moveTo(points[0][0] + (cx - 200), points[0][1] + (cy - 200));

    for (let i = 1; i <= currentSegmentIndex; i++) {
      ctx.lineTo(points[i][0] + (cx - 200), points[i][1] + (cy - 200));
    }

    if (currentSegmentIndex < totalSegments) {
      const p1 = points[currentSegmentIndex];
      const p2 = points[currentSegmentIndex + 1];
      const curX = p1[0] + (p2[0] - p1[0]) * segmentSubT + (cx - 200);
      const curY = p1[1] + (p2[1] - p1[1]) * segmentSubT + (cy - 200);
      ctx.lineTo(curX, curY);

      // Metallic Pen Nib
      ctx.save();
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(curX, curY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.stroke();

    // Guidance Note
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${letter.name}: ${letter.guideText}`, width / 2, height - 30);

    ctx.restore();
  };

  // [6] PRIMARY: Pizza Fraction
  const renderPrimaryPizza = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    step: number,
    stepProgress: number,
    params: Record<string, number>,
    time: number
  ) => {
    const parts = params['parts'] ?? 6;
    const taken = Math.min(parts, params['taken'] ?? 4);

    const cx = width / 2;
    const cy = height / 2;
    const radius = 130;

    ctx.save();
    const sliceAngle = (Math.PI * 2) / parts;

    for (let i = 0; i < parts; i++) {
      const startA = i * sliceAngle - Math.PI / 2;
      const endA = (i + 1) * sliceAngle - Math.PI / 2;
      const isTaken = i < taken;

      ctx.save();
      if (isTaken) {
        // Shift taken slice slightly outwards
        const midA = (startA + endA) / 2;
        ctx.translate(Math.cos(midA) * 18, Math.sin(midA) * 18);
        ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 15;
      } else {
        ctx.fillStyle = '#334155';
      }

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startA, endA);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Pepperoni / toppings
      if (isTaken) {
        const topMidA = (startA + endA) / 2;
        const topX = cx + Math.cos(topMidA) * (radius * 0.6);
        const topY = cy + Math.sin(topMidA) * (radius * 0.6);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(topX, topY, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // Fraction Display in Center or Bottom
    ctx.fillStyle = '#ffffff';
    ctx.font = 'black 22px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${taken} / ${parts}`, cx, height - 35);
    ctx.restore();
  };

  // Fallback for custom code when rendering dynamically
  const renderFallbackCustom = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    step: number,
    time: number,
    title: string
  ) => {
    ctx.save();
    const cx = width / 2;
    const cy = height / 2;

    // Glowing orbiting spheres representing dynamic simulation
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 90, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 3; i++) {
      const angle = time * 1.5 + (i * Math.PI * 2) / 3;
      const sx = cx + Math.cos(angle) * 90;
      const sy = cy + Math.sin(angle) * 90;

      ctx.fillStyle = i === 0 ? '#00f2fe' : i === 1 ? '#fbbf24' : '#f43f5e';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(title, cx, cy - 10);
    ctx.font = '12px system-ui';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Mô phỏng 60FPS đang chạy (Bước ${step})`, cx, cy + 18);
    ctx.restore();
  };

  // ==========================================
  // GEMINI API INTEGRATION FOR NEW EXPERIMENT
  // ==========================================
  const handleCreateCustomSimulation = async () => {
    if (!customPrompt.trim()) return;
    setIsGeneratingCustom(true);
    audioEngine.playClick();

    const promptText = customPrompt.trim();

    try {
      const client = createDirectGeminiClient();

      if (client) {
        const systemInstruction = `Bạn là chuyên gia mô phỏng thí nghiệm khoa học và toán học cho phần mềm bảng thông minh giáo dục SmartBoard.
Khi giáo viên yêu cầu tạo một bài dựng hình hoặc thí nghiệm ảo, bạn hãy phân tích và trả về DUY NHẤT một chuỗi JSON hợp lệ (không kèm markdown) theo cấu trúc:
{
  "title": "Tên bài ngắn gọn chuẩn SGK",
  "subject": "Toán Học | Vật Lý | Hóa Học | Sinh Học | Khoa Học Tự Nhiên | Tiếng Việt",
  "category": "Chuyên đề",
  "simType": "3D_GEOMETRY | REAL_MATH | PHYSICS | CHEMISTRY",
  "telemetryFormula": "Công thức toán học chính bằng LaTeX",
  "parameters": [
    { "id": "param1", "label": "Tên tham số", "min": 1, "max": 100, "step": 1, "defaultValue": 50, "unit": "đơn vị" }
  ],
  "steps": [
    {
      "stepNumber": 1,
      "title": "Bước 1: ...",
      "description": "Mô tả chi tiết sư phạm",
      "formula": "Công thức liên quan",
      "notes": "Lưu ý thực tế",
      "audioNarration": "Lời giảng thuyết minh truyền cảm"
    }
  ],
  "canvasRenderFunctionBody": "/* Mã JavaScript vẽ trực tiếp lên canvas qua (ctx, width, height, currentStep, stepProgress, params, time, rotation3D, isOptimal) */"
}`;

        const response = await client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Hãy tạo bài mô phỏng tương tác 60FPS cho yêu cầu sau của giáo viên: "${promptText}". Cấp học: ${activeGradeLevel}.`,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
          },
        });

        const rawText = response.text ? response.text.trim() : '';
        const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(cleaned);

        const newSim: SimulationConfig = {
          id: 'custom-' + Date.now(),
          title: parsed.title || promptText,
          gradeLevel: activeGradeLevel,
          subject: parsed.subject || (selectedSubject !== 'Tất cả' ? selectedSubject : 'Toán Học'),
          category: parsed.category || 'Thí Nghiệm Theo Yêu Cầu',
          icon: '✨',
          badge: 'Giáo Viên Yêu Cầu',
          simType: parsed.simType || 'CUSTOM_CODE',
          telemetryFormula: parsed.telemetryFormula || '',
          parameters: Array.isArray(parsed.parameters) && parsed.parameters.length > 0 ? parsed.parameters : [
            { id: 'intensity', label: 'Cường độ tương tác', min: 1, max: 100, step: 1, defaultValue: 50, unit: '%' }
          ],
          steps: Array.isArray(parsed.steps) && parsed.steps.length > 0 ? parsed.steps : [
            {
              stepNumber: 1,
              title: `Bước 1: Khởi tạo điều kiện bài toán - ${promptText}`,
              description: `Hệ thống mô phỏng xác lập các thông số cơ bản cho ${promptText}.`,
              notes: 'Quan sát các thành phần trên màn hình.',
              audioNarration: `Bước một, khởi tạo điều kiện thực nghiệm cho yêu cầu: ${promptText}.`,
            },
          ],
          customCode: parsed.canvasRenderFunctionBody || '',
        };

        const updated = [newSim, ...customList];
        setCustomList(updated);
        localStorage.setItem('smartboard_custom_simulations_v2', JSON.stringify(updated));
        setSelectedSimId(newSim.id);
        setCurrentStepIndex(0);
        setIsGeneratingCustom(false);
        setShowCustomModal(false);
        setCustomPrompt('');
        audioEngine.playVictoryChime();
        return;
      }
    } catch (apiErr) {
      console.warn('Gemini custom sim generation fallback to heuristic engine:', apiErr);
    }

    // OFFLINE HEURISTIC GENERATOR (Guarantees immediate 60fps dynamic experience even without API key)
    setTimeout(() => {
      const isGeometry = /hình|chóp|lăng trụ|tam giác|tứ diện|cắt|góc/i.test(promptText);
      const isWaveOrOptic = /sóng|giao thoa|quang|ánh sáng|khúc xạ|phản xạ/i.test(promptText);
      const isChemistry = /hóa|phản ứng|axit|bazơ|dung dịch|kết tủa|chất/i.test(promptText);

      const generatedType: SimType = isGeometry
        ? '3D_GEOMETRY'
        : isWaveOrOptic
        ? 'PHYSICS'
        : isChemistry
        ? 'CHEMISTRY'
        : 'REAL_MATH';

      const newSim: SimulationConfig = {
        id: 'custom-' + Date.now(),
        title: promptText,
        gradeLevel: activeGradeLevel,
        subject: selectedSubject !== 'Tất cả' ? selectedSubject : isGeometry ? 'Toán Học' : 'Khoa Học Tự Nhiên',
        category: 'Thí Nghiệm Theo Yêu Cầu',
        icon: '✨',
        badge: 'Giáo Viên Yêu Cầu',
        simType: generatedType,
        telemetryFormula: isGeometry ? 'V = \\frac{1}{3} S_{\\text{đáy}} \\cdot h' : 'f(x, t) = A \\cos(\\omega t - kx)',
        parameters: [
          {
            id: 'dynParam1',
            label: 'Biến số điều khiển chính',
            min: 10,
            max: 100,
            step: 1,
            defaultValue: 50,
            unit: '%',
            format: (v) => `${v}%`,
          },
          {
            id: 'dynParam2',
            label: 'Tần số dao động',
            min: 1,
            max: 5,
            step: 0.5,
            defaultValue: 2,
            unit: 'Hz',
            format: (v) => `${v} Hz`,
          },
        ],
        steps: [
          {
            stepNumber: 1,
            title: `Bước 1: Khởi tạo điều kiện ban đầu - ${promptText}`,
            description: `Hệ thống xác lập các thông số hình học, lực và môi trường cho: "${promptText}".`,
            formula: 'f(x, y, z) = 0 \\quad \\text{và} \\quad \\sum \\vec{F} = m\\vec{a}',
            notes: 'Mô hình hóa các đại lượng thực tế thành các biến số đồ họa 60FPS.',
            audioNarration: `Bước một, khởi tạo điều kiện thực nghiệm cho yêu cầu: ${promptText}.`,
          },
          {
            stepNumber: 2,
            title: 'Bước 2: Dựng các yếu tố trung gian và mối liên hệ',
            description: 'Thiết lập phương trình cân bằng, vector lực hoặc liên kết hình học không gian.',
            notes: 'Quan sát các đường nét phụ trợ và quỹ đạo chuyển động mượt mà.',
            audioNarration: 'Bước hai, dựng các đường phụ trợ và khảo sát sự tương tác giữa các phần tử.',
          },
          {
            stepNumber: 3,
            title: 'Bước 3: Tương tác biến số & Tối ưu hóa kết quả',
            description: 'Kéo thanh trượt điều chỉnh tham số để kiểm chứng các trường hợp giới hạn.',
            notes: 'Học sinh rút ra quy luật và kết luận bản chất khoa học.',
            audioNarration: 'Bước ba, kiểm chứng hiện tượng với các thông số trượt và hoàn thiện kết luận sư phạm.',
          },
        ],
        customCode: `
          const cx = width / 2;
          const cy = height / 2;
          const p1 = params['dynParam1'] ?? 50;
          const p2 = params['dynParam2'] ?? 2;
          
          ctx.strokeStyle = '#00f2fe';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#00f2fe';
          ctx.shadowBlur = 12;
          
          ctx.beginPath();
          for (let x = 60; x <= width - 60; x += 4) {
            const waveY = cy + Math.sin(x * 0.02 * p2 + time * 3) * (p1 * 0.8);
            if (x === 60) ctx.moveTo(x, waveY);
            else ctx.lineTo(x, waveY);
          }
          ctx.stroke();
          
          ctx.fillStyle = '#fbbf24';
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 15;
          const orbX = cx + Math.sin(time * 2) * 120;
          const orbY = cy + Math.cos(time * 2) * 50;
          ctx.beginPath();
          ctx.arc(orbX, orbY, 10, 0, Math.PI * 2);
          ctx.fill();
        `,
      };

      const updated = [newSim, ...customList];
      setCustomList(updated);
      try {
        localStorage.setItem('smartboard_custom_simulations_v2', JSON.stringify(updated));
      } catch (_) {}
      setSelectedSimId(newSim.id);
      setCurrentStepIndex(0);
      setIsGeneratingCustom(false);
      setShowCustomModal(false);
      setCustomPrompt('');
      audioEngine.playVictoryChime();
    }, 400);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none">
      <div
        className={`bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-6xl h-[92vh]'
        }`}
      >
        {/* ================= HEADER BAR ================= */}
        <div className="px-5 py-3.5 bg-slate-850 border-b border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Compass className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-white text-base tracking-wide flex items-center gap-2">
                  DỰNG HÌNH TỪNG BƯỚC & THÍ NGHIỆM ẢO TOÀN DIỆN
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
                  60FPS ENGINE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Mô phỏng đồ họa chuyển động theo chuẩn chương trình GDPT từ Tiểu học đến THPT
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick 3D Reset View Button */}
            {activeSimulation.simType === '3D_GEOMETRY' && (
              <button
                onClick={reset3DView}
                title="Đặt lại góc nhìn 3D ban đầu"
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Góc 3D</span>
              </button>
            )}

            {/* Sound Toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                audioEngine.playClick();
              }}
              title={soundEnabled ? 'Tắt âm thanh hiệu ứng & AI' : 'Bật âm thanh hiệu ứng & AI'}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                soundEnabled
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Create Custom Simulation Button */}
            <button
              onClick={() => {
                setShowCustomModal(true);
                audioEngine.playClick();
              }}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Wand2 className="w-4 h-4" />
              <span>Yêu Cầu Thí Nghiệm Mới ✨</span>
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Modal */}
            <button
              onClick={() => {
                stopAllSpeech();
                onClose();
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ================= SECONDARY FILTER BAR (GRADES & SUBJECTS) ================= */}
        <div className="px-5 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Grade Level Selector */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-2xl border border-slate-800">
            {(
              [
                { id: 'primary', label: 'Tiểu Học (Lớp 1 - 5)', icon: '🎒' },
                { id: 'secondary', label: 'THCS (Lớp 6 - 9)', icon: '🔬' },
                { id: 'highschool', label: 'THPT (Lớp 10 - 12)', icon: '🎓' },
              ] as const
            ).map((grade) => (
              <button
                key={grade.id}
                onClick={() => {
                  setActiveGradeLevel(grade.id);
                  setSelectedSubject('Tất cả');
                  audioEngine.playClick();
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeGradeLevel === grade.id
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span>{grade.icon}</span>
                <span>{grade.label}</span>
              </button>
            ))}
          </div>

          {/* Subject Filter Dropdown / Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <span className="text-[11px] font-bold text-slate-500">Môn học:</span>
            {['Tất cả', ...availableSubjects].map((sub) => (
              <button
                key={sub}
                onClick={() => {
                  setSelectedSubject(sub);
                  audioEngine.playClick();
                }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  selectedSubject === sub
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>

        {/* ================= MAIN CONTENT SPLIT (SIDEBAR & VIEWPORT) ================= */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT SIDEBAR: TOPICS LIST */}
          <div className="w-72 bg-slate-900/90 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                Danh mục bài học ({finalSims.length})
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
              {finalSims.map((sim) => {
                const isSelected = sim.id === activeSimulation.id;
                return (
                  <button
                    key={sim.id}
                    onClick={() => {
                      setSelectedSimId(sim.id);
                      audioEngine.playClick();
                    }}
                    className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                        : 'bg-slate-850/60 hover:bg-slate-800 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{sim.icon}</span>
                        <span
                          className={`text-xs font-black line-clamp-1 ${
                            isSelected ? 'text-indigo-200' : 'text-slate-200'
                          }`}
                        >
                          {sim.title}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{sim.subject}</span>
                      {sim.badge && (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-cyan-300 font-bold border border-slate-700">
                          {sim.badge}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CENTER & RIGHT VIEWPORT: 60FPS CANVAS & PEDAGOGICAL NARRATION */}
          <div className="flex-1 flex flex-col bg-slate-950 p-3 sm:p-4 overflow-hidden relative">
            {/* Simulation Canvas Viewport Container */}
            <div className="flex-1 bg-[#0a0e17] rounded-3xl border border-slate-800 overflow-hidden relative shadow-inner flex flex-col">
              {/* Telemetry HUD Panel in Upper Right */}
              <div className="absolute top-3 right-3 z-10 bg-slate-900/85 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-700/60 shadow-lg pointer-events-none max-w-sm">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  Bảng Thông Số Live (Telemetry HUD)
                </div>
                {activeSimulation.telemetryFormula && (
                  <div className="text-xs font-mono text-cyan-300 font-bold">
                    ${activeSimulation.telemetryFormula}$
                  </div>
                )}
                {activeSimulation.parameters?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-300">
                    {activeSimulation.parameters.map((p) => {
                      const curVal = paramValues[p.id] ?? p.defaultValue;
                      const formatted = p.format ? p.format(curVal) : `${curVal} ${p.unit}`;
                      return (
                        <span key={p.id} className="bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                          {p.label}: <b className="text-amber-300">{formatted}</b>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Special Primary Letter Selector Overlay (if primary letter simulation) */}
              {activeSimulation.simType === 'PRIMARY_HANDWRITING' && (
                <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700">
                  <span className="text-[11px] font-bold text-slate-400 ml-1">Chọn chữ:</span>
                  {Object.keys(PRIMARY_LETTERS).map((k) => (
                    <button
                      key={k}
                      onClick={() => {
                        setActiveLetter(k);
                        stepProgressRef.current = 0.05;
                        audioEngine.playWhooshDraw();
                        speakText(PRIMARY_LETTERS[k].phonics);
                      }}
                      className={`w-7 h-7 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                        activeLetter === k
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      const phonics = PRIMARY_LETTERS[activeLetter]?.phonics || 'A';
                      speakText(phonics);
                      audioEngine.playClick();
                    }}
                    title="Đọc đánh vần chuẩn AI"
                    className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1 ml-1 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Đánh Vần</span>
                  </button>
                </div>
              )}

              {/* 60FPS Interactive HTML5 Canvas */}
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onWheel={handleWheel}
                className="w-full h-full block cursor-grab active:cursor-grabbing select-none"
              />
            </div>

            {/* Bottom Real-time Parameter Sliders Strip */}
            {activeSimulation.parameters?.length > 0 && (
              <div className="mt-3 p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center gap-4 shrink-0 shadow-md">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-400 shrink-0">
                  <Sliders className="w-4 h-4" />
                  <span>Tham số tương tác:</span>
                </div>
                {activeSimulation.parameters.map((param) => {
                  const val = paramValues[param.id] ?? param.defaultValue;
                  const displayStr = param.format ? param.format(val) : `${val} ${param.unit}`;
                  return (
                    <div key={param.id} className="flex-1 min-w-[200px] flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-300 whitespace-nowrap">
                        {param.label}: <b className="text-cyan-300">{displayStr}</b>
                      </span>
                      <input
                        type="range"
                        min={param.min}
                        max={param.max}
                        step={param.step}
                        value={val}
                        onChange={(e) => handleParamChange(param.id, parseFloat(e.target.value))}
                        className="flex-1 accent-indigo-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pedagogical Step Narration & Playback Bar */}
            <div className="mt-3 p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-2 shrink-0 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-500 text-white font-black text-xs flex items-center justify-center">
                    {currentStepIndex + 1}
                  </span>
                  <h4 className="text-sm font-extrabold text-white">{activeStep.title}</h4>
                </div>

                {/* Step Controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentStepIndex === 0}
                    onClick={() => {
                      setCurrentStepIndex((prev) => Math.max(0, prev - 1));
                      audioEngine.playClick();
                    }}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      setIsPlaying(!isPlaying);
                      audioEngine.playClick();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlaying ? 'Tạm Dừng' : 'Tự Động'}</span>
                  </button>

                  <button
                    disabled={currentStepIndex >= activeSimulation.steps.length - 1}
                    onClick={() => {
                      setCurrentStepIndex((prev) => Math.min(activeSimulation.steps.length - 1, prev + 1));
                      audioEngine.playClick();
                    }}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition-all cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{activeStep.description}</p>

              {activeStep.formula && (
                <div className="bg-slate-950/70 px-3 py-1.5 rounded-xl border border-slate-800/80 font-mono text-xs text-cyan-300">
                  ${activeStep.formula}$
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= MODAL: CREATE CUSTOM EXPERIMENT ================= */}
        {showCustomModal && (
          <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-lg w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white">Yêu Cầu Dựng Hình / Tạo Thí Nghiệm Mới ✨</h4>
                    <p className="text-[11px] text-slate-400">Tích hợp trí tuệ nhân tạo Gemini 2.5 Flash sinh mô phỏng 60FPS</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCustomModal(false)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Nhập nội dung bài toán, hình học hoặc hiện tượng cần mô phỏng:
                </label>
                <textarea
                  rows={3}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="VD: Dựng hình lăng trụ tam giác đều ABC.A'B'C' có thiết diện cắt; hoặc Thí nghiệm con lắc đơn dao động điều hòa; hoặc Dạy viết chữ Hoa B..."
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Quick suggestions */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400">Gợi ý mẫu nhanh:</span>
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  {[
                    "Dựng hình lăng trụ đứng tam giác ABC.A'B'C'",
                    'Thí nghiệm giao thoa ánh sáng khe Y-âng',
                    'Mô phỏng nhật thực và nguyệt thực',
                    'Dạy viết chữ Hoa B mẫu chuẩn',
                  ].map((sug) => (
                    <button
                      key={sug}
                      onClick={() => setCustomPrompt(sug)}
                      className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 hover:border-indigo-500/50 transition-all cursor-pointer"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition-all"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isGeneratingCustom || !customPrompt.trim()}
                  onClick={handleCreateCustomSimulation}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isGeneratingCustom ? 'Gemini Đang Dựng Mô Phỏng...' : 'Tạo Thí Nghiệm Ngay'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
