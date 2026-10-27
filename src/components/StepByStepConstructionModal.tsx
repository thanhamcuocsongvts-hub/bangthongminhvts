import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { speakText, stopAllSpeech } from '../utils/aiSpeechService';

export type GradeLevel = 'primary' | 'secondary' | 'highschool';

export interface StepDetail {
  stepNumber: number;
  title: string;
  description: string;
  formula?: string;
  notes: string;
  audioNarration?: string;
}

export interface SimulationConfig {
  id: string;
  title: string;
  gradeLevel: GradeLevel;
  subject: string;
  category: string;
  icon: string;
  badge?: string;
  steps: StepDetail[];
  customInteractive?: boolean;
}

// Sound synthesizer using Web Audio API for rich, vibrant classroom sounds
class ClassroomAudioEngine {
  private ctx: AudioContext | null = null;
  public soundEnabled: boolean = true;

  private getContext(): AudioContext | null {
    if (!this.soundEnabled) return null;
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  // Pen writing scratch sound on primary handwriting grid
  playPenScratch() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const bufferSize = ctx.sampleRate * 0.08;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.5));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, ctx.currentTime);
      filter.Q.setValueAtTime(3.0, ctx.currentTime);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } catch (_) {}
  }

  // Water drop sound for titration / water cycle
  playWaterDrop() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (_) {}
  }

  // Optical laser beep when light refracts
  playLaserBeam() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (_) {}
  }

  // Energetic success celebration chime when a step is completed
  playStepSuccess() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.06);
        gain.gain.setValueAtTime(0.04, ctx.currentTime + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.06 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.06);
        osc.stop(ctx.currentTime + idx * 0.06 + 0.25);
      });
    } catch (_) {}
  }

  // Snappy button click
  playClick() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch (_) {}
  }
}

const audioEngine = new ClassroomAudioEngine();

// ================= CURRICULUM SIMULATION PRESETS =================
export const FULL_SIMULATIONS: SimulationConfig[] = [
  // ---------------- TIỂU HỌC: TIẾNG VIỆT ----------------
  {
    id: 'primary-handwriting',
    title: 'Rèn Luyện Viết Chữ Đẹp Từng Nét (Ô Ly Chuẩn)',
    gradeLevel: 'primary',
    subject: 'Tiếng Việt',
    category: 'Tập Viết & Rèn Chữ',
    icon: '✍️',
    badge: 'Ô Ly Bộ GD&ĐT',
    steps: [
      {
        stepNumber: 1,
        title: 'Bước 1: Quan sát khung chữ trên bảng 4 ô ly',
        description: 'Chữ cái mẫu hiển thị trên lưới vở ô ly chuẩn 4 ô ly, 5 dòng kẻ ngang. Đường kẻ ngang 1 là đường kẻ đậm (mặt đất).',
        notes: 'Học sinh chú ý điểm xuất phát (đặt bút) và chiều cao con chữ tính theo đơn vị ô ly.',
        audioNarration: 'Học sinh quan sát khung chữ cái trên vở bốn ô ly, xác định đường kẻ ngang số một làm chuẩn.',
      },
      {
        stepNumber: 2,
        title: 'Bước 2: Xác định điểm đặt bút',
        description: 'Đặt đầu ngòi bút tại giao điểm đường kẻ ngang 2 (hoặc giữa ô ly). Giữ bút nghiêng 45 độ thoải mái.',
        notes: 'Không tì tay quá mạnh, đưa cổ tay nhẹ nhàng và dứt khoát.',
        audioNarration: 'Đặt ngòi bút tại đường kẻ ngang số hai, giữ khoảng cách mắt từ hai mươi lăm đến ba mươi xăng ti mét.',
      },
      {
        stepNumber: 3,
        title: 'Bước 3: Rê ngòi bút viết nét chuẩn (Nét thanh nét đậm)',
        description: 'Đưa bút di chuyển theo đường nét định hướng. Đưa lên nhẹ tay tạo nét thanh, kéo xuống tì vừa phải tạo nét đậm.',
        notes: 'Quan sát nét mực tím chạy mượt mà từ điểm bắt đầu đến bụng chữ.',
        audioNarration: 'Đưa bút lượn tròn đều, nét đưa lên thanh nhẹ, nét kéo xuống đậm đà đúng chuẩn chữ đẹp sư phạm.',
      },
      {
        stepNumber: 4,
        title: 'Bước 4: Điểm dừng bút & Lia bút thêm dấu phụ',
        description: 'Dừng bút tại đường kẻ ngang 2. Nhấc nhẹ ngòi bút và lia bút lên trên để thêm dấu phụ cân đối (nếu có dấu mũ, móc).',
        notes: 'Chữ cái hoàn chỉnh đều đặn, đúng độ cao và khoảng cách chuẩn.',
        audioNarration: 'Dừng bút nhẹ nhàng tại đường kẻ hai, hoàn thành con chữ tròn trịa và thẳng hàng.',
      },
    ],
  },
  {
    id: 'primary-phonics',
    title: 'Học Đánh Vần Tiếng Việt Giọng AI Chuẩn',
    gradeLevel: 'primary',
    subject: 'Tiếng Việt',
    category: 'Đánh Vần & Phát Âm',
    icon: '🗣️',
    badge: 'Âm • Vần • Thanh',
    steps: [
      {
        stepNumber: 1,
        title: 'Bước 1: Nhận diện Âm đầu',
        description: 'Học sinh phát âm chuẩn các phụ âm đầu: b (bờ), c (cờ), d (dờ), đ (đờ), m (mờ), n (nờ), t (tờ)...',
        notes: 'Giọng đọc AI mẫu phát âm tròn vành rõ chữ, chuẩn tiếng Việt phổ thông.',
        audioNarration: 'Bờ. Âm bờ đứng đầu tiếng.',
      },
      {
        stepNumber: 2,
        title: 'Bước 2: Ghép với Âm chính (Nguyên âm & Vần)',
        description: 'Ghép phụ âm đầu với nguyên âm: a, o, ô, ơ, e, ê, i, u, ư hoặc vần ghép: an, ang, am, ay...',
        notes: 'Quy tắc ghép vần trực quan: b + a -> ba (bờ - a - ba).',
        audioNarration: 'Bờ a ba. Tiếng ba gồm âm bờ đứng trước, âm a đứng sau.',
      },
      {
        stepNumber: 3,
        title: 'Bước 3: Thêm Dấu thanh điệu (Ngang, Huyền, Sắc, Hỏi, Ngã, Nặng)',
        description: 'Thanh điệu làm thay đổi nghĩa của từ: ba -> bà (huyền) -> bá (sắc) -> bả (hỏi) -> bã (ngã) -> bạ (nặng).',
        notes: 'Nghe phát âm chuẩn từng thanh điệu để học sinh phân biệt dấu ngã và dấu hỏi.',
        audioNarration: 'Bờ a ba huyền bà. Bờ a ba sắc bá. Bờ a ba hỏi bả. Bờ a ba ngã bã. Bờ a ba nặng bạ.',
      },
      {
        stepNumber: 4,
        title: 'Bước 4: Đọc trơn và ứng dụng câu hoàn chỉnh',
        description: 'Đọc trơn từ ghép và câu ngắn: "Ba đưa bé đi chơi", "Bé ngoan chăm học".',
        notes: 'Học sinh bấm các nút chữ cái bên dưới để AI đánh vần ngay lập tức!',
        audioNarration: 'Đọc trơn: Ba, bà, bá, bả, bã, bạ. Bé đọc rất giỏi!',
      },
    ],
  },
  {
    id: 'primary-pizza-fraction',
    title: 'Mô Hình Phân Số Trực Quan (Bánh Pizza & Hình Tròn)',
    gradeLevel: 'primary',
    subject: 'Toán Học',
    category: 'Phân Số Cơ Bản',
    icon: '🍕',
    badge: 'Lớp 3 - 5',
    steps: [
      {
        stepNumber: 1,
        title: 'Bước 1: Một cái bánh nguyên vẹn (Đơn vị = 1)',
        description: 'Một chiếc bánh hình tròn nguyên vẹn biểu thị số 1 (toàn bộ khối).',
        notes: 'Khái niệm: Đơn vị nguyên thể chưa chia tách.',
      },
      {
        stepNumber: 2,
        title: 'Bước 2: Chia bánh thành nhiều phần bằng nhau (Mẫu số)',
        description: 'Dùng dao cắt chia chiếc bánh thành n phần bằng nhau. Số n chính là MẪU SỐ viết ở dưới dấu gạch ngang.',
        formula: '\\text{Mẫu số: Tổng số phần bằng nhau}',
        notes: 'Mẫu số cho biết một đơn vị được chia thành bao nhiêu phần bằng nhau.',
      },
      {
        stepNumber: 3,
        title: 'Bước 3: Lấy đi một số phần để ăn (Tử số)',
        description: 'Lấy m phần bánh đã chia. Số m chính là TỬ SỐ viết ở trên dấu gạch ngang.',
        formula: '\\text{Phân số: } \\frac{m}{n} = \\frac{\\text{Tử số}}{\\text{Mẫu số}}',
        notes: 'Kéo thanh trượt để chia từ 2 phần (1/2), 4 phần (3/4) đến 8 phần sinh động.',
      },
    ],
  },
  {
    id: 'primary-water-cycle',
    title: 'Vòng Tuần Hoàn Của Nước Trong Tự Nhiên',
    gradeLevel: 'primary',
    subject: 'Khoa Học & Đời Sống',
    category: 'Khoa Học Trái Đất',
    icon: '🌧️',
    badge: 'Lớp 4',
    steps: [
      {
        stepNumber: 1,
        title: 'Bước 1: Nắng mặt trời làm nước bay hơi',
        description: 'Năng lượng mặt trời làm ấm các đại dương, sông hồ. Nước hóa thành hơi nước bay lên cao vào bầu khí quyển.',
        notes: 'Quá trình chuyển từ thể lỏng sang thể khí.',
      },
      {
        stepNumber: 2,
        title: 'Bước 2: Ngưng tụ tạo thành những đám mây',
        description: 'Lên cao gặp lạnh, hơi nước ngưng tụ thành hàng triệu hạt nước li ti kết hợp lại thành những đám mây bồng bềnh.',
        notes: 'Hiện tượng ngưng tụ: Khí chuyển thành lỏng.',
      },
      {
        stepNumber: 3,
        title: 'Bước 3: Mưa rơi xuống đất và chảy về biển',
        description: 'Các hạt nước trong mây nặng dần và rơi xuống thành những giọt mưa, ngấm vào lòng đất và chảy ra sông suối.',
        notes: 'Vòng tuần hoàn khép kín duy trì sự sống cho toàn bộ muôn loài.',
      },
    ],
  },

  // ---------------- THCS: LỚP 6 - 9 ----------------
  {
    id: 'sec-pythagoras',
    title: 'Định Lý Pythagore (Minh Họa Bằng 3 Hình Vuông)',
    gradeLevel: 'secondary',
    subject: 'Toán Học',
    category: 'Hình Học Trực Quan',
    icon: '📐',
    badge: 'Lớp 7 - 8',
    steps: [
      {
        stepNumber: 1,
        title: 'Bước 1: Tam giác vuông ABC tại A',
        description: 'Xét tam giác vuông có hai cạnh góc vuông a = 3 cm, b = 4 cm và cạnh huyền c = 5 cm.',
        formula: '\\Delta ABC \\text{ vuông tại } A',
        notes: 'Cạnh đối diện góc vuông là cạnh huyền (cạnh dài nhất).',
      },
      {
        stepNumber: 2,
        title: 'Bước 2: Dựng 3 hình vuông trên 3 cạnh tam giác',
        description: 'Dựng hình vuông cạnh a có diện tích S1 = a² = 9; hình vuông cạnh b có diện tích S2 = b² = 16.',
        formula: 'S_1 = a^2 = 9, \\quad S_2 = b^2 = 16',
        notes: 'Hình vuông lớn nhất dựng trên cạnh huyền c có diện tích S3 = c² = 25.',
      },
      {
        stepNumber: 3,
        title: 'Bước 3: Sự bảo toàn diện tích: S1 + S2 = S3',
        description: 'Tổng diện tích hai hình vuông nhỏ bằng đúng diện tích hình vuông lớn: 9 + 16 = 25.',
        formula: 'a^2 + b^2 = c^2 \\iff 3^2 + 4^2 = 5^2',
        notes: 'Khi chất lỏng chứa đầy trong 2 hình vuông a² và b² chảy vào hình vuông c², nó vừa khớp 100%!',
      },
    ],
  },
  {
    id: 'sec-lever',
    title: 'Đòn Bẩy & Tối Ưu Hóa Lực Nâng',
    gradeLevel: 'secondary',
    subject: 'Khoa Học Tự Nhiên',
    category: 'Vật Lý Lớp 8',
    icon: '⚖️',
    badge: 'Đòn Bẩy Cơ Học',
    steps: [
      {
        stepNumber: 1,
        title: 'Bước 1: Cấu tạo đòn bẩy và điểm tựa O',
        description: 'Gồm một thanh cứng có thể quay quanh điểm tựa O. Vật cần nâng đặt tại điểm O1, lực tác dụng đặt tại điểm O2.',
        notes: 'Khoảng cách OO1 là cánh tay đòn tải d1, khoảng cách OO2 là cánh tay đòn lực d2.',
      },
      {
        stepNumber: 2,
        title: 'Bước 2: Điều kiện cân bằng đòn bẩy (Quy tắc mômen)',
        description: 'Để đòn bẩy cân bằng: Lực nâng F2 nhân với OO2 bằng Trọng lượng vật F1 nhân với OO1.',
        formula: 'F_1 \\times OO_1 = F_2 \\times OO_2 \\implies F_2 = F_1 \\times \\frac{OO_1}{OO_2}',
        notes: 'Khi OO2 dài gấp 3 lần OO1, lực cần tác dụng giảm đi 3 lần!',
      },
      {
        stepNumber: 3,
        title: 'Bước 3: Câu nói bất hủ của Archimedes',
        description: '"Hãy cho tôi một điểm tựa, tôi sẽ nhấc bổng cả Trái Đất lên!"',
        notes: 'Ứng dụng trong đời sống: Kìm, bập bênh, kéo cắt giấy, xà beng bẩy đá.',
      },
    ],
  },

  // ---------------- THPT: LỚP 10 - 12 ----------------
  {
    id: 'box-folding',
    title: 'Gấp Hộp Chữ Nhật Không Nắp (Tối Ưu Thể Tích)',
    gradeLevel: 'highschool',
    subject: 'Toán Học',
    category: 'Toán Thực Tế',
    icon: '📦',
    badge: 'Cực Trị Hàm Số',
    steps: [
      {
        stepNumber: 1,
        title: 'Bước 1: Cho tấm tôn phẳng hình chữ nhật',
        description: 'Tấm tôn ban đầu có kích thước dài a = 80 cm, rộng b = 50 cm.',
        formula: 'S_{tôn} = a \\times b = 80 \\times 50 = 4000\\text{ cm}^2',
        notes: 'Mục tiêu: Gấp thành một chiếc hộp chữ nhật không nắp có thể tích chứa lớn nhất.',
      },
      {
        stepNumber: 2,
        title: 'Bước 2: Cắt bỏ 4 góc hình vuông cạnh x',
        description: 'Ở 4 góc của tấm tôn, cắt bỏ 4 hình vuông bằng nhau có cạnh bằng x (cm) với 0 < x < 25.',
        formula: '0 < x < \\frac{b}{2} = 25\\text{ (cm)}',
        notes: 'Các đường nét đứt chính là các nếp gấp để dựng thành các mặt bên của chiếc hộp.',
      },
      {
        stepNumber: 3,
        title: 'Bước 3: Gập 4 mép lên tạo thành hộp 3D',
        description: 'Dựng vuông góc 4 mép theo nếp gấp, chiều cao của hộp chính là cạnh hình vuông bị cắt: h = x.',
        formula: '\\text{Đáy: } (a-2x) \\times (b-2x); \\quad \\text{Chiều cao: } h = x',
        notes: 'Khi x tăng, diện tích đáy thu hẹp lại nhưng chiều cao tăng lên.',
      },
      {
        stepNumber: 4,
        title: 'Bước 4: Thiết lập hàm thể tích V(x) & Khảo sát đạo hàm',
        description: 'Thể tích hộp là V(x) = x(80 - 2x)(50 - 2x) = 4x³ - 260x² + 4000x.',
        formula: 'V\'(x) = 12x^2 - 520x + 4000 = 0 \\implies x \\approx 10.0\\text{ cm}',
        notes: 'Tại x ≈ 10 cm, thể tích đạt giá trị lớn nhất V_max ≈ 18000 cm³ (18 lít)!',
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
    badge: 'Ứng Dụng Parabol',
    steps: [
      {
        stepNumber: 1,
        title: 'Bước 1: Mô tả hình học của vòm cổng',
        description: 'Một vòm cổng có hình dạng Parabol với chiều rộng chân cổng L = 8m và chiều cao đỉnh cổng H = 6m.',
        formula: '\\text{Rộng: } L = 8\\text{m}, \\quad \\text{Cao: } H = 6\\text{m}',
        notes: 'Một chiếc xe tải chở hàng cần đi qua chính giữa cổng.',
      },
      {
        stepNumber: 2,
        title: 'Bước 2: Chọn hệ trục tọa độ Oxy thuận tiện',
        description: 'Đặt gốc O tại trung điểm chân cổng, trục Ox nằm ngang theo mặt đất, trục Oy hướng thẳng đứng lên đỉnh.',
        formula: '\\text{Chân cổng: } (-4, 0), (4, 0); \\quad \\text{Đỉnh: } (0, 6)',
        notes: 'Phương trình Parabol có dạng đối xứng trục Oy: y = ax² + 6.',
      },
      {
        stepNumber: 3,
        title: 'Bước 3: Lập phương trình Parabol của vòm cổng',
        description: 'Parabol đi qua điểm chân cổng (4, 0): 0 = a(4)² + 6 ⟹ a = -6/16 = -0.375.',
        formula: '(P): y = -0.375x^2 + 6 \\quad (\\text{với } -4 \\le x \\le 4)',
        notes: 'Cho biết độ cao vòm cổng tại bất kỳ vị trí x nào.',
      },
      {
        stepNumber: 4,
        title: 'Bước 4: Đưa xe tải vào và tính khoảng hở an toàn',
        description: 'Xe tải rộng w = 3.6m (x = ±1.8) và chiều cao h = 4.2m.',
        formula: 'y(1.8) = -0.375(1.8)^2 + 6 = 4.785\\text{ m} > 4.2\\text{ m}',
        notes: 'Mép ngoài vòm cổng cao 4.785m, cao hơn nóc xe 58.5 cm nên xe đi qua an toàn!',
      },
    ],
  },
  {
    id: 'light-refraction',
    title: 'Khúc Xạ & Phản Xạ Toàn Phần Của Ánh Sáng',
    gradeLevel: 'highschool',
    subject: 'Vật Lý',
    category: 'Quang Học',
    icon: '🌈',
    badge: 'Định Luật Snell',
    steps: [
      {
        stepNumber: 1,
        title: 'Bước 1: Ánh sáng truyền qua mặt phân cách',
        description: 'Tia sáng truyền từ nước (n1 = 1.33) sang không khí (n2 = 1.0).',
        formula: 'n_1 \\sin i = n_2 \\sin r',
        notes: 'Góc tới i, góc khúc xạ r.',
      },
      {
        stepNumber: 2,
        title: 'Bước 2: Khi góc tới i tăng dần (i < igh)',
        description: 'Tia khúc xạ lệch xa pháp tuyến hơn tia tới (r > i). Đồng thời có tia phản xạ mờ đi ngược lại.',
        formula: 'r = \\arcsin\\left(\\frac{n_1}{n_2} \\sin i\\right) > i',
        notes: 'Tia khúc xạ mờ dần, tia phản xạ sáng dần lên.',
      },
      {
        stepNumber: 3,
        title: 'Bước 3: Góc giới hạn phản xạ toàn phần (igh)',
        description: 'Khi r = 90°, góc tới đạt giá trị tới hạn igh = arcsin(1.0/1.333) ≈ 48.6°.',
        formula: '\\sin i_{gh} = \\frac{n_2}{n_1} \\implies i_{gh} \\approx 48.6^\\circ',
        notes: 'Tia khúc xạ là là mặt nước.',
      },
      {
        stepNumber: 4,
        title: 'Bước 4: Hiện tượng phản xạ toàn phần (i > igh)',
        description: 'Khi i > 48.6°, 100% năng lượng ánh sáng bị phản xạ trở lại vào trong nước!',
        formula: 'i > i_{gh} \\implies \\text{Phản xạ toàn phần 100%}',
        notes: 'Ứng dụng trong cáp quang viễn thông tốc độ cao.',
      },
    ],
  },
  {
    id: 'acid-titration',
    title: 'Chuẩn Độ Axit - Bazơ (HCl + NaOH)',
    gradeLevel: 'highschool',
    subject: 'Hóa Học',
    category: 'Hóa Học Phân Tích',
    icon: '🧪',
    badge: 'Đổi Màu Chỉ Thị',
    steps: [
      {
        stepNumber: 1,
        title: 'Bước 1: Chuẩn bị thiết bị và dung dịch',
        description: 'Buret đựng NaOH 0.1M. Bình tam giác đựng 20ml HCl và vài giọt chỉ thị Phenolphtalein không màu.',
        formula: '\\text{HCl} + \\text{NaOH} \\rightarrow \\text{NaCl} + \\text{H}_2\\text{O}',
        notes: 'Môi trường axit ban đầu có pH ≈ 1.',
      },
      {
        stepNumber: 2,
        title: 'Bước 2: Nhỏ từng giọt NaOH từ buret',
        description: 'Mở khóa buret cho từng giọt rơi xuống và lắc đều bình tam giác. Axit được trung hòa dần, pH tăng dần.',
        notes: 'Màu hồng xuất hiện chớp nhoáng rồi tan khi lắc.',
      },
      {
        stepNumber: 3,
        title: 'Bước 3: Điểm tương đương (pH = 7 -> 8.3)',
        description: 'Thêm 1 giọt NaOH dư nhẹ, toàn bộ dung dịch lập tức chuyển sang màu hồng cánh sen nhạt bền vững!',
        formula: 'n_{\\text{NaOH}} = n_{\\text{HCl}} \\implies C_{\\text{HCl}} = \\frac{C_{\\text{NaOH}} \\times V_{\\text{NaOH}}}{V_{\\text{HCl}}}',
        notes: 'Đọc thể tích NaOH đã dùng để tính chính xác nồng độ HCl ban đầu.',
      },
    ],
  },
];

// Primary Handwriting Stroke Library
const LETTER_STROKES: Record<string, { name: string; path: string; guideText: string; phonics: string }> = {
  a: {
    name: 'Chữ a',
    path: 'M 140 120 C 100 120 70 150 70 190 C 70 230 100 260 140 260 C 180 260 200 230 200 190 L 200 260 C 200 280 220 280 230 270',
    guideText: 'Nét 1: Cong kín (tròn như quả trứng). Nét 2: Móc ngược sát nét cong kín.',
    phonics: 'A',
  },
  b: {
    name: 'Chữ b',
    path: 'M 90 260 C 100 260 110 240 120 200 L 170 50 C 180 30 195 30 195 50 L 160 240 C 160 260 190 270 210 250 C 220 240 220 220 200 220',
    guideText: 'Nét 1: Khuyết trên cao 5 ly. Nét 2: Thắt ở cuối nối sang nét khác.',
    phonics: 'Bờ',
  },
  c: {
    name: 'Chữ c',
    path: 'M 180 140 C 170 120 140 120 110 140 C 80 170 80 220 110 250 C 140 270 180 260 200 240',
    guideText: 'Nét cong hở phải cao 2 ly, lưng cong đều.',
    phonics: 'Cờ',
  },
  d: {
    name: 'Chữ d',
    path: 'M 140 130 C 100 130 70 160 70 200 C 70 240 100 260 140 260 C 180 260 200 230 200 200 L 200 70 L 200 260 C 200 280 220 280 230 270',
    guideText: 'Nét 1: Cong kín 2 ly. Nét 2: Móc ngược cao 4 ly.',
    phonics: 'Dờ',
  },
  h: {
    name: 'Chữ h',
    path: 'M 90 260 C 100 260 110 240 120 200 L 170 50 C 180 30 195 30 195 50 L 160 260 M 160 180 C 170 140 210 140 220 180 L 220 260 C 220 280 240 280 250 270',
    guideText: 'Nét 1: Khuyết trên 5 ly. Nét 2: Móc hai đầu cao 2 ly.',
    phonics: 'Hờ',
  },
  m: {
    name: 'Chữ m',
    path: 'M 80 150 C 80 130 100 130 110 150 L 110 260 M 110 180 C 120 130 160 130 170 170 L 170 260 M 170 180 C 180 130 220 130 230 170 L 230 260 C 230 280 250 280 260 270',
    guideText: 'Gồm 2 nét móc xuôi và 1 nét móc hai đầu liền nhau.',
    phonics: 'Mờ',
  },
};

export const StepByStepConstructionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  // Navigation & Hierarchy Filters
  const [activeGradeLevel, setActiveGradeLevel] = useState<GradeLevel>('highschool');
  const [selectedSubject, setSelectedSubject] = useState<string>('Tất cả');
  const [selectedSimId, setSelectedSimId] = useState<string>('box-folding');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Custom Prompt / Requirement Generator State
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isGeneratingCustom, setIsGeneratingCustom] = useState<boolean>(false);
  const [customList, setCustomList] = useState<SimulationConfig[]>([]);

  // Primary Phonics & Handwriting Interactive state
  const [activeLetter, setActiveLetter] = useState<string>('a');
  const [penProgress, setPenProgress] = useState<number>(100); // 0 to 100%
  const [selectedPhonicsWord, setSelectedPhonicsWord] = useState<{ sound: string; vowel: string; tone: string }>({
    sound: 'b',
    vowel: 'a',
    tone: 'ngang',
  });

  // Interactive slider parameters for various simulations
  const [cutCornerX, setCutCornerX] = useState<number>(10); // box-folding (cm)
  const [truckWidth, setTruckWidth] = useState<number>(3.6); // parabola-truck (m)
  const [truckHeight, setTruckHeight] = useState<number>(4.2); // parabola-truck (m)
  const [refractionAngleI, setRefractionAngleI] = useState<number>(35); // light-refraction (degrees)
  const [titrationDrops, setTitrationDrops] = useState<number>(20); // acid-titration (drops)
  const [pizzaParts, setPizzaParts] = useState<number>(4); // pizza fraction
  const [pizzaTaken, setPizzaTaken] = useState<number>(3); // pizza fraction numerator
  const [pythagorasWater, setPythagorasWater] = useState<number>(100); // pythagoras liquid transfer %

  // Sync sound setting to engine
  useEffect(() => {
    audioEngine.soundEnabled = soundEnabled;
  }, [soundEnabled]);

  // Combine default presets and custom user-generated simulations
  const allSimulations = [...customList, ...FULL_SIMULATIONS];

  // Filter list by selected grade level and subject
  const gradeFilteredSims = allSimulations.filter((s) => s.gradeLevel === activeGradeLevel);
  const availableSubjects = Array.from(new Set(gradeFilteredSims.map((s) => s.subject)));

  const finalSims = gradeFilteredSims.filter(
    (s) => selectedSubject === 'Tất cả' || s.subject === selectedSubject
  );

  const activeSimulation =
    allSimulations.find((s) => s.id === selectedSimId) ||
    finalSims[0] ||
    FULL_SIMULATIONS[0];

  const activeStep = activeSimulation.steps[currentStepIndex] || activeSimulation.steps[0];

  // Auto-play interval
  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= activeSimulation.steps.length - 1) {
            setIsPlaying(false);
            audioEngine.playStepSuccess();
            return prev;
          }
          audioEngine.playClick();
          return prev + 1;
        });
      }, 4000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, activeSimulation.steps.length]);

  // Read narration aloud with Vietnamese voice when step changes (if sound enabled)
  useEffect(() => {
    if (activeStep?.audioNarration && soundEnabled && isOpen) {
      try {
        speakText(activeStep.audioNarration);
      } catch (_) {}
    }
  }, [currentStepIndex, activeSimulation.id, soundEnabled, isOpen]);

  // Primary Pen animation effect
  const handlePlayStroke = () => {
    audioEngine.playPenScratch();
    setPenProgress(0);
    let p = 0;
    const interval = setInterval(() => {
      p += 5;
      setPenProgress(p);
      if (p % 20 === 0) audioEngine.playPenScratch();
      if (p >= 100) {
        clearInterval(interval);
        audioEngine.playStepSuccess();
      }
    }, 40);
  };

  // Primary Phonics sound evaluation
  const handlePronouncePhonics = (word: string, explanation?: string) => {
    audioEngine.playClick();
    const textToRead = explanation || word;
    speakText(textToRead);
  };

  // Generate Custom Simulation based on teacher prompt
  const handleCreateCustomSimulation = () => {
    if (!customPrompt.trim()) return;
    setIsGeneratingCustom(true);
    audioEngine.playClick();

    setTimeout(() => {
      const newSim: SimulationConfig = {
        id: 'custom-' + Date.now(),
        title: customPrompt.trim(),
        gradeLevel: activeGradeLevel,
        subject: selectedSubject !== 'Tất cả' ? selectedSubject : 'Toán Học & Tự Nhiên',
        category: 'Thí Nghiệm Theo Yêu Cầu',
        icon: '✨',
        badge: 'Giáo Viên Yêu Cầu',
        customInteractive: true,
        steps: [
          {
            stepNumber: 1,
            title: `Bước 1: Khởi tạo điều kiện ban đầu - ${customPrompt.trim()}`,
            description: `Hệ thống xác lập các thông số hình học, lực và môi trường cho bài toán: "${customPrompt.trim()}".`,
            notes: 'Mô hình hóa các đại lượng thực tế thành các biến số toán học và vật lý.',
            audioNarration: `Bước một, khởi tạo điều kiện thực nghiệm cho yêu cầu: ${customPrompt.trim()}.`,
          },
          {
            stepNumber: 2,
            title: 'Bước 2: Dựng các yếu tố trung gian và mối liên hệ',
            description: 'Thiết lập phương trình cân bằng, vector lực hoặc liên kết hình học không gian giữa các phần tử.',
            formula: 'f(x, y, z) = 0 \\quad \\text{và} \\quad \\sum \\vec{F} = m\\vec{a}',
            notes: 'Quan sát các đường nét phụ trợ và quỹ đạo chuyển động mượt mà.',
            audioNarration: 'Bước hai, dựng các đường phụ trợ và thiết lập mối quan hệ định lượng giữa các thành phần.',
          },
          {
            stepNumber: 3,
            title: 'Bước 3: Tương tác biến số & Tối ưu hóa kết quả',
            description: 'Kéo thanh trượt điều chỉnh tham số để kiểm chứng các trường hợp giới hạn và hiện tượng thực tế sinh động.',
            notes: 'Học sinh rút ra quy luật và kết luận bản chất khoa học.',
            audioNarration: 'Bước ba, khảo sát sự thay đổi và hoàn thiện kết luận sư phạm.',
          },
        ],
      };

      setCustomList((prev) => [newSim, ...prev]);
      setSelectedSimId(newSim.id);
      setCurrentStepIndex(0);
      setIsGeneratingCustom(false);
      setShowCustomModal(false);
      setCustomPrompt('');
      audioEngine.playStepSuccess();
    }, 600);
  };

  if (!isOpen) return null;

  // Box folding calculations
  const a = 80;
  const b = 50;
  const x = cutCornerX;
  const boxLength = Math.max(0, a - 2 * x);
  const boxWidth = Math.max(0, b - 2 * x);
  const boxVolume = x * boxLength * boxWidth;

  // Parabola calculations
  const clearanceY = -0.375 * Math.pow(truckWidth / 2, 2) + 6;
  const isPassable = clearanceY > truckHeight;
  const safetyMargin = clearanceY - truckHeight;

  // Refraction calculations
  const n1 = 1.333;
  const n2 = 1.0;
  const iRad = (refractionAngleI * Math.PI) / 180;
  const sinR = (n1 / n2) * Math.sin(iRad);
  const isTotalReflection = sinR > 1.0;
  const rDeg = !isTotalReflection ? (Math.asin(sinR) * 180) / Math.PI : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div
        className={`w-full ${
          isFullscreen ? 'h-full max-w-none rounded-none' : 'max-w-7xl max-h-[96vh] rounded-3xl'
        } bg-slate-900 border border-slate-700 shadow-2xl flex flex-col text-white overflow-hidden transition-all`}
      >
        {/* ================= TOP HEADER ================= */}
        <div className="px-4 py-3 bg-slate-950/95 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-sm sm:text-base text-slate-100 flex items-center gap-1.5">
                  <span>Dựng Hình Từng Bước & Thí Nghiệm Ảo Toàn Diện</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Tiểu học ➔ THPT
                  </span>
                </h2>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Rèn chữ đẹp ô ly, đánh vần tiếng Việt AI, toán thực tế cực trị & thí nghiệm KHTN sinh động
              </p>
            </div>
          </div>

          {/* Action buttons on header */}
          <div className="flex items-center gap-1.5">
            {/* Button: Yêu cầu dựng hình / tạo thí nghiệm */}
            <button
              onClick={() => setShowCustomModal(true)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
              title="Nhập đề bài để hệ thống tự động dựng hình hoặc tạo thí nghiệm theo yêu cầu"
            >
              <Wand2 className="w-3.5 h-3.5 text-slate-950" />
              <span>Yêu Cầu Thí Nghiệm Mới ✨</span>
            </button>

            {/* Sound toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (soundEnabled) stopAllSpeech();
              }}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                soundEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
              title={soundEnabled ? 'Âm thanh sống động đang BẬT' : 'Đang TẮT âm thanh'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Fullscreen */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              onClick={() => {
                stopAllSpeech();
                onClose();
              }}
              className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ================= GRADE LEVEL PICKER TABS ================= */}
        <div className="px-4 py-2 bg-slate-950/70 border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
              <span>Chọn khối lớp:</span>
            </span>
            {[
              { id: 'primary' as GradeLevel, label: 'Tiểu Học (Lớp 1 - 5)', desc: 'Rèn chữ đẹp, đánh vần AI, toán que tính' },
              { id: 'secondary' as GradeLevel, label: 'THCS (Lớp 6 - 9)', desc: 'Pythagore, đòn bẩy, sự cháy' },
              { id: 'highschool' as GradeLevel, label: 'THPT (Lớp 10 - 12)', desc: 'Gấp hộp V(x), cổng Parabol, chuẩn độ, quang học' },
            ].map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  audioEngine.playClick();
                  setActiveGradeLevel(g.id);
                  setSelectedSubject('Tất cả');
                  const firstOfGrade = allSimulations.find((s) => s.gradeLevel === g.id);
                  if (firstOfGrade) {
                    setSelectedSimId(firstOfGrade.id);
                    setCurrentStepIndex(0);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeGradeLevel === g.id
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md ring-1 ring-purple-400/50'
                    : 'bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700/60'
                }`}
                title={g.desc}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Quick subject filter chips */}
          <div className="flex items-center gap-1 overflow-x-auto text-xs">
            <span className="text-[10px] font-bold text-slate-400">Môn:</span>
            <button
              onClick={() => setSelectedSubject('Tất cả')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                selectedSubject === 'Tất cả'
                  ? 'bg-sky-500 text-slate-950 font-black'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              Tất cả
            </button>
            {availableSubjects.map((sub) => (
              <button
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                  selectedSubject === sub
                    ? 'bg-sky-500 text-slate-950 font-black'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>

        {/* ================= MAIN WORKSPACE (SIDEBAR + DISPLAY CANVAS + STEP NOTES) ================= */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          
          {/* 1. LEFT VERTICAL SIDEBAR: THƯ VIỆN BÀI GIẢNG DỌC ĐẦY ĐỦ CÁC MÔN */}
          <div className="w-full md:w-64 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto custom-scrollbar p-2.5 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1 flex items-center justify-between">
              <span>DANH SÁCH BÀI GIẢNG ({finalSims.length})</span>
            </div>

            <div className="space-y-1.5">
              {finalSims.map((sim) => {
                const isSelected = sim.id === activeSimulation.id;
                return (
                  <button
                    key={sim.id}
                    onClick={() => {
                      audioEngine.playClick();
                      setSelectedSimId(sim.id);
                      setCurrentStepIndex(0);
                      setIsPlaying(false);
                    }}
                    className={`w-full p-2.5 rounded-2xl text-left transition-all cursor-pointer flex items-start gap-2.5 border ${
                      isSelected
                        ? 'bg-gradient-to-r from-indigo-950 to-purple-950 border-indigo-500 text-white shadow-md ring-1 ring-indigo-400/40'
                        : 'bg-slate-900/80 hover:bg-slate-850 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="text-xl p-1 rounded-xl bg-slate-800/80 shrink-0">
                      {sim.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                          {sim.subject}
                        </span>
                        {sim.badge && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                            {sim.badge}
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-xs leading-snug mt-1 text-slate-100 line-clamp-2">
                        {sim.title}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {sim.steps.length} bước dựng hình
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. CENTER: GRAPHIC INTERACTIVE SIMULATION DISPLAY */}
          <div className="flex-1 bg-slate-950 p-3 sm:p-4 flex flex-col justify-between overflow-hidden relative">
            
            {/* Visual Canvas Viewport */}
            <div className="flex-1 w-full rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-slate-800 p-2 sm:p-4 flex items-center justify-center relative overflow-hidden shadow-inner">
              
              {/* === [A] PRIMARY: RÈN CHỮ ĐẸP TẬP VIẾT Ô LY === */}
              {activeSimulation.id === 'primary-handwriting' && (
                <div className="w-full h-full flex flex-col items-center justify-between">
                  {/* Selector of letters */}
                  <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl z-20">
                    <span className="text-xs font-bold text-purple-300 px-2">Chọn chữ cái:</span>
                    {Object.keys(LETTER_STROKES).map((char) => (
                      <button
                        key={char}
                        onClick={() => {
                          audioEngine.playClick();
                          setActiveLetter(char);
                          handlePronouncePhonics(LETTER_STROKES[char].phonics);
                        }}
                        className={`w-8 h-8 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                          activeLetter === char
                            ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-300'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        {char}
                      </button>
                    ))}
                    <button
                      onClick={handlePlayStroke}
                      className="ml-2 px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      <span>Viết Mẫu</span>
                    </button>
                  </div>

                  {/* Primary Handwriting Paper Grid (4 ô ly chuẩn BGD) */}
                  <div className="relative w-full max-w-xl h-64 bg-[#f8faf0] border-4 border-[#cbd5e1] rounded-2xl shadow-2xl p-4 flex items-center justify-center overflow-hidden">
                    <svg viewBox="0 0 320 300" className="w-full h-full">
                      <defs>
                        {/* 4 O-ly Grid Pattern */}
                        <pattern id="primaryGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                          <rect width="20" height="20" fill="none" stroke="#93c5fd" strokeWidth="0.5" strokeOpacity="0.4" />
                        </pattern>
                      </defs>

                      {/* Paper Background with grid */}
                      <rect width="320" height="300" fill="#ffffff" />
                      <rect width="320" height="300" fill="url(#primaryGrid)" />

                      {/* 5 Main Horizontal Lines */}
                      <line x1="0" y1="60" x2="320" y2="60" stroke="#60a5fa" strokeWidth="1" strokeDasharray="2 2" />
                      <line x1="0" y1="110" x2="320" y2="110" stroke="#60a5fa" strokeWidth="1" strokeDasharray="2 2" />
                      <line x1="0" y1="160" x2="320" y2="160" stroke="#60a5fa" strokeWidth="1" strokeDasharray="2 2" />
                      <line x1="0" y1="210" x2="320" y2="210" stroke="#60a5fa" strokeWidth="1" strokeDasharray="2 2" />
                      {/* Base line (Đường kẻ đậm số 1) */}
                      <line x1="0" y1="260" x2="320" y2="260" stroke="#2563eb" strokeWidth="2.5" />

                      {/* Ghost Letter Guide Path */}
                      <path
                        d={LETTER_STROKES[activeLetter]?.path || ''}
                        fill="none"
                        stroke="#cbd5e1"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Animated Violet Pen Ink Stroke (Mực tím học trò) */}
                      <path
                        d={LETTER_STROKES[activeLetter]?.path || ''}
                        fill="none"
                        stroke="#6b21a8"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="800"
                        strokeDashoffset={800 - (800 * penProgress) / 100}
                        style={{ transition: 'stroke-dashoffset 0.05s linear' }}
                      />

                      {/* Moving Nib Indicator */}
                      <circle cx="90" cy="260" r="4" fill="#f59e0b" />
                    </svg>

                    <div className="absolute bottom-2 left-3 text-[11px] font-mono font-bold text-slate-500">
                      {LETTER_STROKES[activeLetter]?.guideText}
                    </div>
                  </div>

                  <div className="text-center text-xs text-slate-400 mt-2">
                    Bấm <b>Viết Mẫu</b> để xem ngòi bút mực tím chuyển động từng nét trên ô ly chuẩn!
                  </div>
                </div>
              )}

              {/* === [B] PRIMARY: ĐÁNH VẦN TIẾNG VIỆT GIỌNG AI === */}
              {activeSimulation.id === 'primary-phonics' && (
                <div className="w-full h-full flex flex-col items-center justify-center p-3 space-y-4">
                  {/* Phonics Interactive Keyboard & Pronouncer */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col items-center max-w-xl w-full">
                    <div className="text-xs font-bold text-slate-400 mb-2">BẢNG GHÉP VẦN TƯƠNG TÁC THÔNG MINH</div>

                    {/* Phonetic Combination Display */}
                    <div className="flex items-center gap-3 my-2 bg-slate-950 px-6 py-4 rounded-2xl border border-indigo-500/40">
                      <span className="text-4xl font-extrabold text-amber-400">
                        {selectedPhonicsWord.sound}
                      </span>
                      <span className="text-2xl text-slate-500 font-mono">+</span>
                      <span className="text-4xl font-extrabold text-sky-400">
                        {selectedPhonicsWord.vowel}
                      </span>
                      <span className="text-2xl text-slate-500 font-mono">➔</span>
                      <span className="text-5xl font-black text-emerald-300 underline decoration-indigo-500">
                        {selectedPhonicsWord.sound + selectedPhonicsWord.vowel}
                      </span>
                    </div>

                    {/* Pronounce Now Button */}
                    <button
                      onClick={() =>
                        handlePronouncePhonics(
                          `${selectedPhonicsWord.sound} - ${selectedPhonicsWord.vowel} - ${selectedPhonicsWord.sound}${selectedPhonicsWord.vowel}`,
                          `${selectedPhonicsWord.sound}. ${selectedPhonicsWord.vowel}. ${selectedPhonicsWord.sound} - ${selectedPhonicsWord.vowel} - ${selectedPhonicsWord.sound}${selectedPhonicsWord.vowel}!`
                        )
                      }
                      className="mt-3 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg active:scale-95 cursor-pointer"
                    >
                      <Volume2 className="w-5 h-5 text-slate-950" />
                      <span>Nghe AI Đọc Đánh Vần Chuẩn 🔊</span>
                    </button>

                    {/* Sounds selector */}
                    <div className="mt-4 w-full">
                      <span className="text-[11px] font-bold text-slate-400 block mb-1">Chọn âm đầu:</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {['b', 'c', 'd', 'đ', 'g', 'h', 'l', 'm', 'n', 't', 'v', 'x'].map((s) => (
                          <button
                            key={s}
                            onClick={() => {
                              setSelectedPhonicsWord({ ...selectedPhonicsWord, sound: s });
                              handlePronouncePhonics(s);
                            }}
                            className={`w-8 h-8 rounded-xl font-bold text-sm ${
                              selectedPhonicsWord.sound === s
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Vowels selector */}
                    <div className="mt-3 w-full">
                      <span className="text-[11px] font-bold text-slate-400 block mb-1">Chọn vần / nguyên âm:</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {['a', 'o', 'ô', 'ơ', 'e', 'ê', 'i', 'u', 'ư', 'an', 'ang', 'am'].map((v) => (
                          <button
                            key={v}
                            onClick={() => {
                              setSelectedPhonicsWord({ ...selectedPhonicsWord, vowel: v });
                              handlePronouncePhonics(v);
                            }}
                            className={`px-2.5 py-1 rounded-xl font-bold text-sm ${
                              selectedPhonicsWord.vowel === v
                                ? 'bg-sky-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* === [C] PRIMARY: PHÂN SỐ BÁNH PIZZA === */}
              {activeSimulation.id === 'primary-pizza-fraction' && (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <svg viewBox="-120 -120 240 240" className="w-64 h-64">
                    {/* Pizza Slices */}
                    {Array.from({ length: pizzaParts }).map((_, idx) => {
                      const startAngle = (idx * 2 * Math.PI) / pizzaParts;
                      const endAngle = ((idx + 1) * 2 * Math.PI) / pizzaParts;
                      const isTaken = idx < pizzaTaken;
                      const x1 = 100 * Math.cos(startAngle);
                      const y1 = 100 * Math.sin(startAngle);
                      const x2 = 100 * Math.cos(endAngle);
                      const y2 = 100 * Math.sin(endAngle);

                      return (
                        <path
                          key={idx}
                          d={`M 0 0 L ${x1} ${y1} A 100 100 0 0 1 ${x2} ${y2} Z`}
                          fill={isTaken ? '#f59e0b' : '#334155'}
                          stroke="#1e293b"
                          strokeWidth="2"
                        />
                      );
                    })}
                  </svg>

                  {/* Fraction Badge */}
                  <div className="mt-2 bg-slate-900 px-5 py-2 rounded-2xl border border-amber-500/40 flex items-center gap-3">
                    <span className="text-xs text-slate-400">Phân số biểu thị:</span>
                    <span className="text-2xl font-black text-amber-300">
                      {pizzaTaken} / {pizzaParts}
                    </span>
                    <span className="text-xs text-emerald-400 font-bold">
                      (Đã lấy {pizzaTaken} trên tổng số {pizzaParts} miếng)
                    </span>
                  </div>
                </div>
              )}

              {/* === [D] THCS: PYTHAGORE TRỰC QUAN === */}
              {activeSimulation.id === 'sec-pythagoras' && (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <svg viewBox="0 0 400 320" className="w-full h-full max-h-[340px]">
                    {/* Triangle in center: a=60, b=80, c=100 */}
                    <polygon points="160,180 160,100 240,180" fill="#38bdf844" stroke="#38bdf8" strokeWidth="3" />
                    
                    {/* Square on side a=80 (bottom) */}
                    <rect x="160" y="180" width="80" height="80" fill="#10b98144" stroke="#10b981" strokeWidth="2" />
                    <text x="200" y="225" fill="#34d399" fontSize="13" fontWeight="bold" textAnchor="middle">b² = 16</text>

                    {/* Square on side b=60 (left) */}
                    <rect x="100" y="100" width="60" height="80" fill="#f59e0b44" stroke="#f59e0b" strokeWidth="2" />
                    <text x="130" y="145" fill="#fbbf24" fontSize="13" fontWeight="bold" textAnchor="middle">a² = 9</text>

                    {/* Hypotenuse Square c=100 */}
                    <polygon points="160,100 240,180 300,120 220,40" fill="#a855f744" stroke="#a855f7" strokeWidth="2" />
                    <text x="230" y="115" fill="#c084fc" fontSize="14" fontWeight="black" textAnchor="middle">c² = 25</text>
                  </svg>
                  <div className="text-sm font-black text-emerald-300">
                    9 + 16 = 25 ⟺ a² + b² = c² (Định lý Pythagore)
                  </div>
                </div>
              )}

              {/* === [E] THPT: GẤP HỘP V(X) === */}
              {activeSimulation.id === 'box-folding' && (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <svg viewBox="0 0 500 300" className="w-full h-full max-h-[320px]">
                    <g transform="translate(60, 30)">
                      <rect x="0" y="0" width="360" height="220" fill="#312e81" stroke="#818cf8" strokeWidth="2" rx="4" />
                      {/* Cut corners */}
                      <rect x="0" y="0" width={x * 3.6} height={x * 3.6} fill="#0f172a" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3 3" />
                      <rect x={360 - x * 3.6} y="0" width={x * 3.6} height={x * 3.6} fill="#0f172a" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3 3" />
                      <rect x="0" y={220 - x * 3.6} width={x * 3.6} height={x * 3.6} fill="#0f172a" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3 3" />
                      <rect x={360 - x * 3.6} y={220 - x * 3.6} width={x * 3.6} height={x * 3.6} fill="#0f172a" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3 3" />
                      {/* Text */}
                      <text x="180" y="115" fill="#ffffff" fontSize="14" fontWeight="bold" textAnchor="middle">
                        Đáy hộp: {boxLength} × {boxWidth} cm
                      </text>
                    </g>
                  </svg>

                  <div className="absolute top-3 right-3 bg-slate-900/90 border border-indigo-500/40 rounded-xl px-3 py-1.5 shadow-md flex items-center gap-2">
                    <span className="text-xs text-slate-400">Thể tích V(x):</span>
                    <span className="text-base font-mono font-black text-amber-300">
                      {boxVolume.toLocaleString('vi-VN')} cm³
                    </span>
                    <span className="text-xs text-emerald-400 font-bold">
                      ({(boxVolume / 1000).toFixed(2)} lít)
                    </span>
                  </div>
                </div>
              )}

              {/* === [F] THPT: VÒM CỔNG PARABOL === */}
              {activeSimulation.id === 'parabola-truck' && (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <svg viewBox="-5 -1 10 8" className="w-full h-full max-h-[320px]" style={{ transform: 'scaleY(-1)' }}>
                    <line x1="-5" y1="0" x2="5" y2="0" stroke="#475569" strokeWidth="0.1" />
                    <path d="M -4,0 Q 0,12 4,0" fill="none" stroke="#38bdf8" strokeWidth="0.15" />
                    <rect
                      x={-truckWidth / 2}
                      y="0"
                      width={truckWidth}
                      height={truckHeight}
                      fill={isPassable ? '#10b98133' : '#ef444433'}
                      stroke={isPassable ? '#10b981' : '#ef4444'}
                      strokeWidth="0.1"
                      rx="0.1"
                    />
                  </svg>
                  <div className={`absolute top-3 right-3 px-3 py-2 rounded-2xl border shadow-lg ${
                    isPassable ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                  }`}>
                    <span className="text-xs font-black">{isPassable ? 'XE LỌT AN TOÀN' : 'KHÔNG LỌT'}</span>
                    <div className="text-[10px]">
                      {isPassable ? `Hở mép xe: +${(safetyMargin * 100).toFixed(1)} cm` : `Va chạm nóc`}
                    </div>
                  </div>
                </div>
              )}

              {/* === [G] THPT: KHÚC XẠ QUANG HỌC === */}
              {activeSimulation.id === 'light-refraction' && (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <svg viewBox="-200 -150 400 300" className="w-full h-full max-h-[320px]">
                    <rect x="-200" y="0" width="400" height="150" fill="#0284c722" stroke="#0284c7" strokeWidth="1" />
                    <line x1="0" y1="-140" x2="0" y2="140" stroke="#64748b" strokeWidth="1" strokeDasharray="4 4" />
                    {(() => {
                      const len = 120;
                      const rad = (refractionAngleI * Math.PI) / 180;
                      const x1 = -len * Math.sin(rad);
                      const y1 = len * Math.cos(rad);
                      return <line x1={x1} y1={y1} x2="0" y2="0" stroke="#eab308" strokeWidth="3" />;
                    })()}
                    {isTotalReflection ? (
                      <line x1="0" y1="0" x2="100" y2="100" stroke="#f43f5e" strokeWidth="3.5" />
                    ) : (
                      <line x1="0" y1="0" x2={100 * Math.sin((rDeg * Math.PI) / 180)} y2={-100 * Math.cos((rDeg * Math.PI) / 180)} stroke="#38bdf8" strokeWidth="2.5" />
                    )}
                  </svg>
                  <div className="absolute top-3 right-3 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
                    {isTotalReflection ? '🔥 Đang phản xạ toàn phần 100%' : `✨ Khúc xạ r = ${rDeg.toFixed(1)}°`}
                  </div>
                </div>
              )}

              {/* === [H] THPT: CHUẨN ĐỘ AXIT - BAZƠ === */}
              {activeSimulation.id === 'acid-titration' && (
                <div className="w-full h-full flex items-center justify-center gap-6">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-32 bg-slate-800 border-2 border-slate-600 rounded-t-lg relative flex flex-col justify-end">
                      <div className="w-full bg-sky-500/40" style={{ height: `${Math.max(10, 100 - titrationDrops * 2.5)}%` }} />
                    </div>
                    <div className="w-3 h-3 bg-amber-500 rounded-xs" />
                    <div
                      className={`w-24 h-24 border-4 border-slate-500 rounded-b-3xl mt-3 flex items-center justify-center transition-all ${
                        titrationDrops >= 25 ? 'bg-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.6)]' : 'bg-indigo-950/20'
                      }`}
                    >
                      <span className="text-xs font-bold text-white">
                        {titrationDrops >= 25 ? 'Hồng cánh sen' : 'Trong suốt'}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs space-y-2">
                    <div className="text-2xl font-mono font-black text-amber-300">
                      pH ≈ {(1.0 + (titrationDrops >= 25 ? 7.5 + (titrationDrops - 25) * 0.3 : titrationDrops * 0.2)).toFixed(2)}
                    </div>
                    <button
                      onClick={() => {
                        audioEngine.playWaterDrop();
                        setTitrationDrops((d) => d + 1);
                      }}
                      className="w-full py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 font-black text-white"
                    >
                      Nhỏ 1 giọt NaOH 💧
                    </button>
                  </div>
                </div>
              )}

              {/* === [I] CUSTOM SIMULATION FALLBACK === */}
              {activeSimulation.customInteractive && (
                <div className="text-center space-y-3 p-4">
                  <div className="text-6xl animate-bounce">✨</div>
                  <div className="text-xl font-bold text-amber-300">{activeSimulation.title}</div>
                  <p className="text-xs text-slate-300 max-w-md mx-auto">
                    Mô phỏng tương tác được sinh trực tiếp theo yêu cầu riêng của Thầy/Cô.
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Slider & Controls Bar */}
            <div className="mt-3 p-2.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
              
              {/* Contextual Parameter Sliders */}
              {activeSimulation.id === 'box-folding' && (
                <div className="flex-1 min-w-[200px] flex items-center gap-3">
                  <span className="text-xs font-bold text-indigo-300 whitespace-nowrap">
                    Cạnh cắt x: <b>{cutCornerX} cm</b>
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="24"
                    step="0.5"
                    value={cutCornerX}
                    onChange={(e) => setCutCornerX(parseFloat(e.target.value))}
                    className="flex-1 accent-indigo-500 cursor-pointer"
                  />
                </div>
              )}

              {activeSimulation.id === 'primary-pizza-fraction' && (
                <div className="flex-1 min-w-[200px] flex items-center gap-3">
                  <span className="text-xs font-bold text-amber-300 whitespace-nowrap">
                    Lấy: <b>{pizzaTaken}</b> / {pizzaParts} miếng
                  </span>
                  <input
                    type="range"
                    min="1"
                    max={pizzaParts}
                    step="1"
                    value={pizzaTaken}
                    onChange={(e) => setPizzaTaken(parseInt(e.target.value, 10))}
                    className="flex-1 accent-amber-500 cursor-pointer"
                  />
                </div>
              )}

              {activeSimulation.id === 'light-refraction' && (
                <div className="flex-1 min-w-[200px] flex items-center gap-3">
                  <span className="text-xs font-bold text-amber-300 whitespace-nowrap">
                    Góc tới i: <b>{refractionAngleI}°</b>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="85"
                    step="1"
                    value={refractionAngleI}
                    onChange={(e) => {
                      setRefractionAngleI(parseInt(e.target.value, 10));
                      audioEngine.playLaserBeam();
                    }}
                    className="flex-1 accent-amber-500 cursor-pointer"
                  />
                </div>
              )}

              {/* Step Navigation Controls (Prev, Auto-Play, Next) */}
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  disabled={currentStepIndex === 0}
                  onClick={() => {
                    audioEngine.playClick();
                    setCurrentStepIndex((p) => Math.max(0, p - 1));
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Trước</span>
                </button>

                <button
                  onClick={() => {
                    audioEngine.playClick();
                    setIsPlaying(!isPlaying);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    isPlaying
                      ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                  }`}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlaying ? 'Tạm Dừng' : 'Tự Động Chạy'}</span>
                </button>

                <button
                  disabled={currentStepIndex >= activeSimulation.steps.length - 1}
                  onClick={() => {
                    audioEngine.playClick();
                    setCurrentStepIndex((p) => Math.min(activeSimulation.steps.length - 1, p + 1));
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <span>Tiếp</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 3. RIGHT: PEDAGOGICAL STEP EXPLANATIONS & AUDIO NARRATION */}
          <div className="w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 p-4 flex flex-col justify-between overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              {/* Stepper tracker */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400">
                  TIẾN TRÌNH BÀI HỌC
                </span>
                <span className="text-xs font-mono font-bold bg-slate-800 px-2 py-0.5 rounded-full text-slate-300">
                  Bước {currentStepIndex + 1} / {activeSimulation.steps.length}
                </span>
              </div>

              {/* Progress bar line */}
              <div className="flex items-center gap-1">
                {activeSimulation.steps.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      audioEngine.playClick();
                      setCurrentStepIndex(idx);
                    }}
                    className={`h-2 flex-1 rounded-full transition-all cursor-pointer ${
                      idx === currentStepIndex
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 ring-2 ring-indigo-400/50'
                        : idx < currentStepIndex
                        ? 'bg-emerald-500'
                        : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>

              {/* Step Content */}
              <div className="space-y-3">
                <h3 className="text-base font-extrabold text-white leading-snug">
                  {activeStep.title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeStep.description}
                </p>

                {activeStep.formula && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-indigo-500/30 text-indigo-300 font-mono text-xs shadow-inner">
                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Công thức toán/lý:</div>
                    <div className="font-bold">{activeStep.formula}</div>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs leading-relaxed space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Ghi chú sư phạm:</span>
                  </div>
                  <div>{activeStep.notes}</div>
                </div>

                {/* Read aloud step button */}
                <button
                  onClick={() => {
                    const text = activeStep.audioNarration || activeStep.description;
                    speakText(text);
                  }}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-indigo-300 font-bold text-xs flex items-center justify-center gap-2 border border-indigo-500/30 transition-all cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 text-indigo-400" />
                  <span>Nghe Giọng AI Thuyết Minh Bước Này 🎙️</span>
                </button>
              </div>
            </div>

            {/* Reset button */}
            <div className="pt-4 mt-4 border-t border-slate-800 flex items-center gap-2">
              <button
                onClick={() => {
                  audioEngine.playClick();
                  setCurrentStepIndex(0);
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Bắt đầu lại từ bước 1"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  audioEngine.playClick();
                  if (currentStepIndex < activeSimulation.steps.length - 1) {
                    setCurrentStepIndex((p) => p + 1);
                  } else {
                    setCurrentStepIndex(0);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer text-center"
              >
                {currentStepIndex < activeSimulation.steps.length - 1 ? 'Bước Tiếp Theo ➔' : 'Xem Lại Từ Đầu ↺'}
              </button>
            </div>
          </div>
        </div>

        {/* ================= MODAL: TẠO THÍ NGHIỆM / DỰNG HÌNH THEO YÊU CẦU ================= */}
        {showCustomModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl text-white space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-amber-400" />
                  <h4 className="font-extrabold text-sm text-white">Yêu Cầu Dựng Hình / Tạo Thí Nghiệm Mới</h4>
                </div>
                <button
                  onClick={() => setShowCustomModal(false)}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Nhập yêu cầu dựng hình hoặc hiện tượng cần thí nghiệm:
                </label>
                <textarea
                  rows={3}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="VD: Dựng hình chóp tam giác đều S.ABC có đáy cạnh 6cm; hoặc Thí nghiệm rơi tự do trong ống chân không; hoặc Dạy viết chữ hoa A..."
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {/* Quick suggestions */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400">Gợi ý mẫu nhanh:</span>
                <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                  {[
                    'Dựng hình lăng trụ đứng tam giác ABC.A\'B\'C\'',
                    'Thí nghiệm giao thoa ánh sáng khe Y-âng',
                    'Mô phỏng nhật thực và nguyệt thực',
                    'Dạy viết chữ Hoa B mẫu chuẩn',
                  ].map((sug) => (
                    <button
                      key={sug}
                      onClick={() => setCustomPrompt(sug)}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isGeneratingCustom || !customPrompt.trim()}
                  onClick={handleCreateCustomSimulation}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 text-slate-950 text-xs font-black shadow-md transition-all active:scale-95 disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isGeneratingCustom ? 'Đang Thiết Lập...' : 'Tạo Thí Nghiệm Ngay'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
