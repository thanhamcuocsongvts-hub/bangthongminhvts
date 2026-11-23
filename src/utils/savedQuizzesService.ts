/**
 * Saved Quizzes & Games Storage Service for SmartBoard 75 Pro
 * Strictly isolated per teacher account (`teacherId`):
 * - Each teacher can only view, store, manage, and assign their own saved exams & games.
 * - Cross-device sync (PC <-> Phone) syncs only within the same teacher's account namespace.
 */

import { QuizQuestion } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { safeSetDoc } from './firebaseSafe';
import { normalizeTeacherOwnerId } from './teacherPrivacy';

export interface SavedEducationalItem {
  id: string;
  teacherId?: string;
  title: string;
  type: 'quiz' | 'game';
  gameType?: 'race' | 'wheel' | 'puzzle' | 'millionaire';
  subject: string;
  grade: string;
  questionCount: number;
  questions: QuizQuestion[];
  timeLimit?: number;
  author?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

const LEGACY_STORAGE_KEY = 'smartboard_saved_quizzes_and_games';
const SCOPED_STORAGE_PREFIX = 'smartboard_saved_quizzes_v2_';

function getScopedStorageKey(teacherId?: string | null): string {
  return `${SCOPED_STORAGE_PREFIX}${normalizeTeacherOwnerId(teacherId)}`;
}

// Bộ bài tập mẫu chuẩn sư phạm mặc định cho tài khoản mới (phân bố đều A, B, C, D)
export const INITIAL_SAVED_ITEMS: SavedEducationalItem[] = [
  {
    id: 'saved_math_12_khao_sat',
    title: 'Toán 12: Khảo sát hàm số & Tính đơn điệu cực trị',
    type: 'quiz',
    subject: 'Toán học',
    grade: 'Lớp 12',
    questionCount: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: 'Bộ câu hỏi chuẩn bị cho tiết học ôn tập chuyên đề Khảo sát hàm số.',
    questions: [
      {
        id: 'sm1',
        question: 'Cho hàm số $y = x^3 - 3x^2 + 2$. Điểm cực đại của đồ thị hàm số có tọa độ là:',
        options: [
          { key: 'A', text: '$(2; -2)$' },
          { key: 'B', text: '$(0; 2)$' },
          { key: 'C', text: '$(1; 0)$' },
          { key: 'D', text: '$(0; -2)$' },
        ],
        correctAnswer: 'B',
        explanation:
          "Ta có $y' = 3x^2 - 6x = 3x(x - 2)$. Nghiệm $y' = 0 \\Leftrightarrow x = 0$ hoặc $x = 2$. Qua $x = 0$, $y'$ đổi dấu từ dương sang âm nên $x = 0$ là điểm cực đại. Tọa độ điểm cực đại là $(0; 2)$.",
        timeLimit: 45,
        difficulty: 'Thông hiểu',
      },
      {
        id: 'sm2',
        question: 'Đường tiệm cận đứng của đồ thị hàm số $y = \\frac{2x - 1}{x + 1}$ là đường thẳng:',
        options: [
          { key: 'A', text: '$x = -1$' },
          { key: 'B', text: '$x = 1$' },
          { key: 'C', text: '$y = 2$' },
          { key: 'D', text: '$y = -1$' },
        ],
        correctAnswer: 'A',
        explanation:
          'Nghiệm của mẫu số $x + 1 = 0 \\Leftrightarrow x = -1$, giới hạn $\\lim_{x \\to -1} y = \\infty$ nên đường tiệm cận đứng là $x = -1$.',
        timeLimit: 30,
        difficulty: 'Nhận biết',
      },
      {
        id: 'sm3',
        question: 'Hàm số $y = -x^4 + 2x^2 + 3$ đồng biến trên khoảng nào dưới đây?',
        options: [
          { key: 'A', text: '$(-1; 0)$ và $(1; +\\infty)$' },
          { key: 'B', text: '$(-\\infty; 0)$' },
          { key: 'C', text: '$(0; +\\infty)$' },
          { key: 'D', text: '$(-\\infty; -1)$ và $(0; 1)$' },
        ],
        correctAnswer: 'D',
        explanation:
          "Ta có $y' = -4x^3 + 4x = -4x(x^2 - 1) = -4x(x - 1)(x + 1)$. Dấu của $y'$ mang giá trị dương khi $x \\in (-\\infty; -1)$ và $x \\in (0; 1)$.",
        timeLimit: 45,
        difficulty: 'Vận dụng',
      },
      {
        id: 'sm4',
        question: 'Giá trị lớn nhất của hàm số $f(x) = x^4 - 2x^2 + 1$ trên đoạn $[0; 2]$ bằng:',
        options: [
          { key: 'A', text: '$1$' },
          { key: 'B', text: '$0$' },
          { key: 'C', text: '$9$' },
          { key: 'D', text: '$4$' },
        ],
        correctAnswer: 'C',
        explanation:
          "Ta có $f'(x) = 4x^3 - 4x = 4x(x^2 - 1)$. Trên đoạn $[0; 2]$, nghiệm $x = 0$ và $x = 1$. Tính các giá trị: $f(0) = 1$, $f(1) = 0$, $f(2) = 16 - 8 + 1 = 9$. Vậy giá trị lớn nhất là 9 tại $x = 2$.",
        timeLimit: 40,
        difficulty: 'Thông hiểu',
      },
    ],
  },
  {
    id: 'saved_game_wheel_physics',
    title: 'Game Vòng Quay May Mắn: Khám Phá Vật Lý 11 - Dòng Điện & Từ Trường',
    type: 'game',
    gameType: 'wheel',
    subject: 'Vật lý',
    grade: 'Lớp 11',
    questionCount: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: 'Trò chơi đầu giờ khởi động lớp học bằng Vòng Quay May Mắn trên màn hình tương tác.',
    questions: [
      {
        id: 'sg1',
        question: 'Đơn vị đo cảm ứng từ trong hệ SI là gì?',
        options: [
          { key: 'A', text: 'Vê-be (Wb)' },
          { key: 'B', text: 'Ampe (A)' },
          { key: 'C', text: 'Tesla (T)' },
          { key: 'D', text: 'Henry (H)' },
        ],
        correctAnswer: 'C',
        explanation: 'Tesla (ký hiệu T) là đơn vị đo cảm ứng từ trong hệ SI.',
        timeLimit: 30,
      },
      {
        id: 'sg2',
        question: 'Lực Lo-ren-xơ là lực từ tác dụng lên đối tượng nào?',
        options: [
          { key: 'A', text: 'Dòng điện đứng yên' },
          { key: 'B', text: 'Hạt mang điện chuyển động trong từ trường' },
          { key: 'C', text: 'Thanh nam châm vĩnh cửu' },
          { key: 'D', text: 'Điện tích đứng yên trong điện trường' },
        ],
        correctAnswer: 'B',
        explanation: 'Lực Lo-ren-xơ tác dụng lên mọi hạt mang điện chuyển động trong từ trường.',
        timeLimit: 30,
      },
      {
        id: 'sg3',
        question: 'Từ thông qua diện tích S đặt trong từ trường đều B được tính theo công thức:',
        options: [
          { key: 'A', text: '$\\Phi = B \\cdot S \\cdot \\sin(\\alpha)$' },
          { key: 'B', text: '$\\Phi = B / (S \\cdot \\cos(\\alpha))$' },
          { key: 'C', text: '$\\Phi = I \\cdot B \\cdot S$' },
          { key: 'D', text: '$\\Phi = B \\cdot S \\cdot \\cos(\\alpha)$' },
        ],
        correctAnswer: 'D',
        explanation:
          'Công thức từ thông là Phi = B * S * cos(alpha), với alpha là góc giữa vectơ B và pháp tuyến n.',
        timeLimit: 30,
      },
      {
        id: 'sg4',
        question: 'Hiện tượng cảm ứng điện từ xuất hiện khi nào?',
        options: [
          { key: 'A', text: 'Từ thông qua mạch kín biến thiên theo thời gian' },
          { key: 'B', text: 'Từ trường có cường độ không đổi' },
          { key: 'C', text: 'Mạch điện được nối vào nguồn điện một chiều' },
          { key: 'D', text: 'Thanh kim loại được nung nóng' },
        ],
        correctAnswer: 'A',
        explanation:
          'Theo định luật Fa-ra-đây, dòng điện cảm ứng xuất hiện trong mạch kín khi từ thông qua mạch biến thiên.',
        timeLimit: 30,
      },
    ],
  },
  {
    id: 'saved_game_race_history',
    title: 'Game Đường Đua Tri Thức: Lịch Sử Việt Nam Thời Kỳ Kháng Chiến',
    type: 'game',
    gameType: 'race',
    subject: 'Lịch sử',
    grade: 'Lớp 12',
    questionCount: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: 'Trò chơi đua xe chia đội tranh tài giữa các tổ trong lớp.',
    questions: [
      {
        id: 'sh1',
        question: 'Chiến dịch lịch sử Điện Biên Phủ toàn thắng vào ngày tháng năm nào?',
        options: [
          { key: 'A', text: '13/03/1954' },
          { key: 'B', text: '07/05/1954' },
          { key: 'C', text: '19/08/1945' },
          { key: 'D', text: '02/09/1945' },
        ],
        correctAnswer: 'B',
        explanation:
          'Chiều ngày 7/5/1954, lá cờ Quyết chiến Quyết thắng tung bay trên nóc hầm Đờ Cát, chiến dịch Điện Biên Phủ toàn thắng.',
        timeLimit: 30,
      },
      {
        id: 'sh2',
        question: 'Đại tướng Tổng tư lệnh chỉ huy Chiến dịch Điện Biên Phủ là ai?',
        options: [
          { key: 'A', text: 'Đại tướng Nguyễn Chí Thanh' },
          { key: 'B', text: 'Đại tướng Văn Tiến Dũng' },
          { key: 'C', text: 'Đại tướng Lê Trọng Tấn' },
          { key: 'D', text: 'Đại tướng Võ Nguyên Giáp' },
        ],
        correctAnswer: 'D',
        explanation:
          'Đại tướng Võ Nguyên Giáp là Bí thư Đảng ủy kiêm Tổng tư lệnh chiến dịch Điện Biên Phủ.',
        timeLimit: 30,
      },
      {
        id: 'sh3',
        question:
          'Phương châm tác chiến được Đại tướng Võ Nguyên Giáp quyết định thay đổi trong Chiến dịch Điện Biên Phủ là:',
        options: [
          { key: 'A', text: 'Từ "Đánh nhanh thắng nhanh" sang "Đánh chắc tiến chắc"' },
          { key: 'B', text: 'Từ "Đánh chắc tiến chắc" sang "Đánh nhanh thắng nhanh"' },
          { key: 'C', text: 'Đánh du kích trường kỳ' },
          { key: 'D', text: 'Bao vây cô lập hoàn toàn' },
        ],
        correctAnswer: 'A',
        explanation:
          'Đại tướng đưa ra quyết định lịch sử chuyển từ phương châm đánh nhanh thắng nhanh sang đánh chắc tiến chắc để đảm bảo chắc thắng 100%.',
        timeLimit: 30,
      },
      {
        id: 'sh4',
        question: 'Hiệp định Giơ-ne-vơ về chấm dứt chiến tranh tại Đông Dương được ký kết vào năm nào?',
        options: [
          { key: 'A', text: '1955' },
          { key: 'B', text: '1973' },
          { key: 'C', text: '1954' },
          { key: 'D', text: '1946' },
        ],
        correctAnswer: 'C',
        explanation: 'Hiệp định Giơ-ne-vơ được ký kết ngày 21 tháng 7 năm 1954.',
        timeLimit: 30,
      },
    ],
  },
];

const DEFAULT_SAMPLE_IDS = new Set(INITIAL_SAVED_ITEMS.map((it) => it.id));

function seedStarterItems(ownerId: string): SavedEducationalItem[] {
  return INITIAL_SAVED_ITEMS.map((item) => ({
    ...item,
    teacherId: ownerId,
  }));
}

function filterOwnedItems(
  items: SavedEducationalItem[],
  ownerId: string
): SavedEducationalItem[] {
  return (items || [])
    .filter((it) => it && it.id && (!it.teacherId || it.teacherId === ownerId))
    .map((it) => ({
      ...it,
      teacherId: ownerId,
    }));
}

function dispatchSavedQuizzesEvent(ownerId: string, items: SavedEducationalItem[]) {
  try {
    window.dispatchEvent(
      new CustomEvent('saved-quizzes-updated', {
        detail: { teacherId: ownerId, items },
      })
    );
  } catch {}
}

/**
 * Lấy danh sách bài tập trắc nghiệm & trò chơi ĐÃ LƯU thuộc riêng tài khoản hiện tại.
 */
export function getSavedEducationalItems(
  teacherId?: string | null,
  teacherName?: string | null
): SavedEducationalItem[] {
  const ownerId = normalizeTeacherOwnerId(teacherId);
  if (typeof window === 'undefined') return seedStarterItems(ownerId);

  const scopedKey = getScopedStorageKey(ownerId);
  try {
    const raw = localStorage.getItem(scopedKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return filterOwnedItems(parsed, ownerId);
      }
    }

    // Migrate strictly ONLY items from legacy cache that explicitly match this teacherId or author
    const legacyOwned: SavedEducationalItem[] = [];
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      try {
        const legacyParsed = JSON.parse(legacyRaw);
        if (Array.isArray(legacyParsed)) {
          legacyParsed.forEach((it: SavedEducationalItem) => {
            if (!it || !it.id) return;
            const matchesId = it.teacherId === ownerId;
            const matchesAuthor =
              !it.teacherId &&
              !DEFAULT_SAMPLE_IDS.has(it.id) &&
              Boolean(teacherName) &&
              it.author?.trim() === teacherName?.trim();
            if (matchesId || matchesAuthor) {
              legacyOwned.push({ ...it, teacherId: ownerId });
            }
          });
        }
      } catch {}
    }

    const seeded = [
      ...legacyOwned,
      ...seedStarterItems(ownerId).filter(
        (s) => !legacyOwned.some((owned) => owned.id === s.id)
      ),
    ];
    localStorage.setItem(scopedKey, JSON.stringify(seeded));
    return seeded;
  } catch (err) {
    console.error('Error reading saved educational items:', err);
    return seedStarterItems(ownerId);
  }
}

/**
 * Đẩy danh sách bài tập của riêng tài khoản hiện tại lên Đám mây (Firestore & Express Server).
 * Tuyệt đối KHÔNG ghi vào global_store chung để tránh lộ/đồng bộ nhầm sang tài khoản khác.
 */
export async function syncSavedEducationalItemsToCloud(
  items: SavedEducationalItem[],
  teacherId?: string | null,
  immediate: boolean = true
): Promise<void> {
  const ownerId = normalizeTeacherOwnerId(teacherId);
  if (typeof window === 'undefined') return;

  const scopedItems = filterOwnedItems(items, ownerId);
  const scopedKey = getScopedStorageKey(ownerId);

  try {
    localStorage.setItem(scopedKey, JSON.stringify(scopedItems));
    dispatchSavedQuizzesEvent(ownerId, scopedItems);
  } catch (_) {}

  if (ownerId === 'guest') {
    // Tài khoản Khách dùng thử không đồng bộ lên Cloud
    return;
  }

  const runCloudSync = async () => {
    try {
      const sanitized = JSON.parse(JSON.stringify(scopedItems));
      const payload = {
        teacherId: ownerId,
        items: sanitized,
        updatedAt: new Date().toISOString(),
      };

      // 1. Lưu vào Firestore doc riêng của đúng tài khoản giáo viên này
      try {
        await safeSetDoc(doc(db, 'teacher_saved_quizzes', ownerId), payload);
      } catch (fsErr) {
        console.warn('[Cloud Sync] Firestore teacher_saved_quizzes notice:', fsErr);
      }

      // 2. Sao lưu theo đúng teacherId lên Express backend server
      try {
        await fetch('/api/quizzes/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacherId: ownerId,
            items: sanitized,
            replaceAll: true,
          }),
        });
      } catch (_) {}
    } catch (e) {
      console.warn('[Cloud Sync] Error syncing saved items to cloud:', e);
    }
  };

  if (immediate) {
    await runCloudSync();
  } else {
    const timerKey = `_savedQuizzesSyncTimer_${ownerId}`;
    if ((window as any)[timerKey]) {
      clearTimeout((window as any)[timerKey]);
    }
    (window as any)[timerKey] = setTimeout(runCloudSync, 500);
  }
}

/**
 * Tải danh sách bài tập ĐÃ LƯU thuộc riêng tài khoản hiện tại từ Đám mây.
 */
export async function pullSavedQuizzesFromCloud(
  teacherId?: string | null,
  teacherName?: string | null
): Promise<SavedEducationalItem[]> {
  const ownerId = normalizeTeacherOwnerId(teacherId);
  const localItems = getSavedEducationalItems(ownerId, teacherName);

  if (ownerId === 'guest') {
    return localItems;
  }

  let cloudItems: SavedEducationalItem[] | null = null;

  // 1. Tải từ Firestore doc riêng của tài khoản
  try {
    const snap = await getDoc(doc(db, 'teacher_saved_quizzes', ownerId));
    if (snap.exists() && Array.isArray(snap.data()?.items)) {
      cloudItems = filterOwnedItems(snap.data()?.items as SavedEducationalItem[], ownerId);
    }
  } catch (err) {
    console.warn('[Cloud Pull] Firestore pull warning:', err);
  }

  // 2. Fallback: Lấy đúng slice của teacherId từ backend server
  if (cloudItems === null) {
    try {
      const res = await fetch(
        `/api/quizzes/sync?teacherId=${encodeURIComponent(ownerId)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          cloudItems = filterOwnedItems(data.items as SavedEducationalItem[], ownerId);
        }
      }
    } catch (_) {}
  }

  const scopedKey = getScopedStorageKey(ownerId);

  if (cloudItems !== null) {
    try {
      localStorage.setItem(scopedKey, JSON.stringify(cloudItems));
      dispatchSavedQuizzesEvent(ownerId, cloudItems);
    } catch (_) {}
    return cloudItems;
  }

  // Nếu tài khoản này chưa từng đồng bộ doc riêng lên Cloud, nhưng đang có đề tự tạo cục bộ -> đồng bộ lên doc riêng
  const hasCustomLocal = localItems.some((it) => !DEFAULT_SAMPLE_IDS.has(it.id));
  if (hasCustomLocal) {
    syncSavedEducationalItemsToCloud(localItems, ownerId, false);
  }

  return localItems;
}

/**
 * Lắng nghe cập nhật thời gian thực CHỈ trong tài khoản của chính giáo viên đó (PC <-> Điện thoại của cùng 1 tài khoản).
 */
export function initSavedQuizzesRealtimeSync(
  teacherId?: string | null,
  teacherName?: string | null,
  onUpdate?: (items: SavedEducationalItem[]) => void
): () => void {
  const ownerId = normalizeTeacherOwnerId(teacherId);
  if (ownerId === 'guest') {
    const guestItems = getSavedEducationalItems(ownerId, teacherName);
    onUpdate?.(guestItems);
    return () => {};
  }

  let unsub: (() => void) | null = null;
  let active = true;
  const scopedKey = getScopedStorageKey(ownerId);

  try {
    unsub = onSnapshot(
      doc(db, 'teacher_saved_quizzes', ownerId),
      (snapshot) => {
        if (!active) return;
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data && Array.isArray(data.items)) {
            const cloudItems = filterOwnedItems(
              data.items as SavedEducationalItem[],
              ownerId
            );
            try {
              localStorage.setItem(scopedKey, JSON.stringify(cloudItems));
              dispatchSavedQuizzesEvent(ownerId, cloudItems);
            } catch (_) {}

            onUpdate?.(cloudItems);
          }
        }
      },
      (err) => {
        console.warn('[Realtime Sync] Saved quizzes listener warning:', err);
      }
    );
  } catch (e) {
    console.warn('[Realtime Sync] Could not attach listener:', e);
  }

  pullSavedQuizzesFromCloud(ownerId, teacherName).then((items) => {
    if (active && onUpdate) {
      onUpdate(items);
    }
  });

  return () => {
    active = false;
    if (unsub) unsub();
  };
}

/**
 * Lưu bài tập hoặc trò chơi mới gắn chặt với teacherId đang đăng nhập.
 */
export function saveEducationalItem(
  item: Omit<SavedEducationalItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  teacherId?: string | null,
  teacherName?: string | null
): SavedEducationalItem {
  const ownerId = normalizeTeacherOwnerId(teacherId || item.teacherId);
  const all = getSavedEducationalItems(ownerId, teacherName);
  const now = new Date().toISOString();

  let finalItem: SavedEducationalItem;
  let next: SavedEducationalItem[];

  if (item.id && all.some((x) => x.id === item.id)) {
    finalItem = {
      ...(item as SavedEducationalItem),
      id: item.id,
      teacherId: ownerId,
      author: item.author || teacherName || undefined,
      updatedAt: now,
    };
    next = all.map((x) => (x.id === item.id ? finalItem : x));
  } else {
    const newId = item.id || `saved_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    finalItem = {
      ...item,
      id: newId,
      teacherId: ownerId,
      author: item.author || teacherName || undefined,
      createdAt: now,
      updatedAt: now,
    };
    next = [finalItem, ...all];
  }

  syncSavedEducationalItemsToCloud(next, ownerId, true);
  return finalItem;
}

/**
 * Xóa một bài tập hoặc trò chơi trong kho riêng của tài khoản hiện tại.
 */
export function deleteEducationalItem(id: string, teacherId?: string | null): void {
  const ownerId = normalizeTeacherOwnerId(teacherId);
  const all = getSavedEducationalItems(ownerId);
  const next = all.filter((x) => x.id !== id);
  syncSavedEducationalItemsToCloud(next, ownerId, true);
}
