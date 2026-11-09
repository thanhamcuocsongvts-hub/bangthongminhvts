/**
 * Saved Quizzes & Games Storage Service for SmartBoard 75 Pro
 * 
 * Cho phép giáo viên tạo sẵn bài tập trắc nghiệm và các trò chơi học tập ở nhà,
 * đặt tên và bấm LƯU. Khi đến trường chỉ cần bấm 1 chạm để mở trình chiếu
 * hoặc cho học sinh thi đấu trực tiếp siêu nhanh chóng!
 */

import { QuizQuestion } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { safeSetDoc } from './firebaseSafe';

export interface SavedEducationalItem {
  id: string;
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

const STORAGE_KEY = 'smartboard_saved_quizzes_and_games';

// Bộ bài tập mẫu chuẩn sư phạm được nạp sẵn để giáo viên có thể thử nghiệm và trình chiếu ngay lập tức
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
          { key: 'A', text: '$(0; 2)$' },
          { key: 'B', text: '$(2; -2)$' },
          { key: 'C', text: '$(1; 0)$' },
          { key: 'D', text: '$(0; -2)$' },
        ],
        correctAnswer: 'A',
        explanation: 'Ta có $y\' = 3x^2 - 6x = 3x(x - 2)$. Nghiệm $y\' = 0 \Leftrightarrow x = 0$ hoặc $x = 2$. Qua $x = 0$, $y\'$ đổi dấu từ dương sang âm nên $x = 0$ là điểm cực đại. Tọa độ điểm cực đại là $(0; 2)$.',
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
        explanation: 'Nghiệm của mẫu số $x + 1 = 0 \Leftrightarrow x = -1$, giới hạn $\\lim_{x \\to -1} y = \\infty$ nên đường tiệm cận đứng là $x = -1$.',
        timeLimit: 30,
        difficulty: 'Nhận biết',
      },
      {
        id: 'sm3',
        question: 'Hàm số $y = -x^4 + 2x^2 + 3$ đồng biến trên khoảng nào dưới đây?',
        options: [
          { key: 'A', text: '$(-\\infty; -1)$ và $(0; 1)$' },
          { key: 'B', text: '$(-1; 0)$ và $(1; +\\infty)$' },
          { key: 'C', text: '$(-\\infty; 0)$' },
          { key: 'D', text: '$(0; +\\infty)$' },
        ],
        correctAnswer: 'A',
        explanation: 'Ta có $y\' = -4x^3 + 4x = -4x(x^2 - 1) = -4x(x - 1)(x + 1)$. Dấu của $y\'$ mang giá trị dương khi $x \\in (-\\infty; -1)$ và $x \\in (0; 1)$.',
        timeLimit: 45,
        difficulty: 'Vận dụng',
      },
      {
        id: 'sm4',
        question: 'Giá trị lớn nhất của hàm số $f(x) = x^4 - 2x^2 + 1$ trên đoạn $[0; 2]$ bằng:',
        options: [
          { key: 'A', text: '$9$' },
          { key: 'B', text: '$1$' },
          { key: 'C', text: '$0$' },
          { key: 'D', text: '$4$' },
        ],
        correctAnswer: 'A',
        explanation: 'Ta có $f\'(x) = 4x^3 - 4x = 4x(x^2 - 1)$. Trên đoạn $[0; 2]$, nghiệm $x = 0$ và $x = 1$. Tính các giá trị: $f(0) = 1$, $f(1) = 0$, $f(2) = 16 - 8 + 1 = 9$. Vậy giá trị lớn nhất là 9 tại $x = 2$.',
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
          { key: 'A', text: 'Tesla (T)' },
          { key: 'B', text: 'Vê-be (Wb)' },
          { key: 'C', text: 'Ampe (A)' },
          { key: 'D', text: 'Henry (H)' },
        ],
        correctAnswer: 'A',
        explanation: 'Tesla (ký hiệu T) là đơn vị đo cảm ứng từ trong hệ SI.',
        timeLimit: 30,
      },
      {
        id: 'sg2',
        question: 'Lực Lo-ren-xơ là lực từ tác dụng lên đối tượng nào?',
        options: [
          { key: 'A', text: 'Hạt mang điện chuyển động trong từ trường' },
          { key: 'B', text: 'Dòng điện đứng yên' },
          { key: 'C', text: 'Thanh nam châm vĩnh cửu' },
          { key: 'D', text: 'Điện tích đứng yên trong điện trường' },
        ],
        correctAnswer: 'A',
        explanation: 'Lực Lo-ren-xơ tác dụng lên mọi hạt mang điện chuyển động trong từ trường.',
        timeLimit: 30,
      },
      {
        id: 'sg3',
        question: 'Từ thông qua diện tích S đặt trong từ trường đều B được tính theo công thức:',
        options: [
          { key: 'A', text: '$\\Phi = B \\cdot S \\cdot \\cos(\\alpha)$' },
          { key: 'B', text: '$\\Phi = B \\cdot S \\cdot \\sin(\\alpha)$' },
          { key: 'C', text: '$\\Phi = B / (S \\cdot \\cos(\\alpha))$' },
          { key: 'D', text: '$\\Phi = I \\cdot B \\cdot S$' },
        ],
        correctAnswer: 'A',
        explanation: 'Công thức từ thông là Phi = B * S * cos(alpha), với alpha là góc giữa vectơ B và pháp tuyến n.',
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
        explanation: 'Theo định luật Fa-ra-đây, dòng điện cảm ứng xuất hiện trong mạch kín khi từ thông qua mạch biến thiên.',
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
          { key: 'A', text: '07/05/1954' },
          { key: 'B', text: '13/03/1954' },
          { key: 'C', text: '19/08/1945' },
          { key: 'D', text: '02/09/1945' },
        ],
        correctAnswer: 'A',
        explanation: 'Chiều ngày 7/5/1954, lá cờ Quyết chiến Quyết thắng tung bay trên nóc hầm Đờ Cát, chiến dịch Điện Biên Phủ toàn thắng.',
        timeLimit: 30,
      },
      {
        id: 'sh2',
        question: 'Đại tướng Tổng tư lệnh chỉ huy Chiến dịch Điện Biên Phủ là ai?',
        options: [
          { key: 'A', text: 'Đại tướng Võ Nguyên Giáp' },
          { key: 'B', text: 'Đại tướng Nguyễn Chí Thanh' },
          { key: 'C', text: 'Đại tướng Văn Tiến Dũng' },
          { key: 'D', text: 'Đại tướng Lê Trọng Tấn' },
        ],
        correctAnswer: 'A',
        explanation: 'Đại tướng Võ Nguyên Giáp là Bí thư Đảng ủy kiêm Tổng tư lệnh chiến dịch Điện Biên Phủ.',
        timeLimit: 30,
      },
      {
        id: 'sh3',
        question: 'Phương châm tác chiến được Đại tướng Võ Nguyên Giáp quyết định thay đổi trong Chiến dịch Điện Biên Phủ là:',
        options: [
          { key: 'A', text: 'Từ "Đánh nhanh thắng nhanh" sang "Đánh chắc tiến chắc"' },
          { key: 'B', text: 'Từ "Đánh chắc tiến chắc" sang "Đánh nhanh thắng nhanh"' },
          { key: 'C', text: 'Đánh du kích trường kỳ' },
          { key: 'D', text: 'Bao vây cô lập hoàn toàn' },
        ],
        correctAnswer: 'A',
        explanation: 'Đại tướng đưa ra quyết định lịch sử chuyển từ phương châm đánh nhanh thắng nhanh sang đánh chắc tiến chắc để đảm bảo chắc thắng 100%.',
        timeLimit: 30,
      },
      {
        id: 'sh4',
        question: 'Hiệp định Giơ-ne-vơ về chấm dứt chiến tranh tại Đông Dương được ký kết vào năm nào?',
        options: [
          { key: 'A', text: '1954' },
          { key: 'B', text: '1955' },
          { key: 'C', text: '1973' },
          { key: 'D', text: '1946' },
        ],
        correctAnswer: 'A',
        explanation: 'Hiệp định Giơ-ne-vơ được ký kết ngày 21 tháng 7 năm 1954.',
        timeLimit: 30,
      },
    ],
  },
];

/**
 * Lấy danh sách toàn bộ các bài tập trắc nghiệm và trò chơi đã lưu
 */
export function getSavedEducationalItems(): SavedEducationalItem[] {
  if (typeof window === 'undefined') return INITIAL_SAVED_ITEMS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Khởi tạo danh sách mẫu lần đầu
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SAVED_ITEMS));
      return INITIAL_SAVED_ITEMS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return INITIAL_SAVED_ITEMS;
  } catch (err) {
    console.error('Error reading saved educational items:', err);
    return INITIAL_SAVED_ITEMS;
  }
}

/**
 * Đẩy toàn bộ danh sách bài tập trắc nghiệm & trò chơi lên Đám mây (Firestore & Server)
 * Đảm bảo mọi bài tạo trên máy tính (PC) đều xuất hiện ngay lập tức trên điện thoại (Mobile)
 */
export async function syncSavedEducationalItemsToCloud(
  items: SavedEducationalItem[],
  immediate: boolean = true
): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('saved-quizzes-updated', { detail: items }));
  } catch (_) {}

  const runCloudSync = async () => {
    try {
      const sanitized = JSON.parse(JSON.stringify(items));
      const payload = { items: sanitized, updatedAt: new Date().toISOString() };

      // 1. Lưu vào Firestore doc chuyên dụng 'saved_quizzes'
      try {
        await safeSetDoc(doc(db, 'global_store', 'saved_quizzes'), payload, { merge: true });
      } catch (fsErr) {
        console.warn('[Cloud Sync] Firestore saved_quizzes notice:', fsErr);
      }

      // 2. Đồng thời lưu vào smartboard_data để phòng hờ
      try {
        await safeSetDoc(doc(db, 'global_store', 'smartboard_data'), { savedQuizzes: sanitized, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (_) {}

      // 3. Sao lưu lên Express backend server qua /api/quizzes/sync
      try {
        await fetch('/api/quizzes/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: sanitized }),
        });
      } catch (_) {}
    } catch (e) {
      console.warn('[Cloud Sync] Error syncing saved items to cloud:', e);
    }
  };

  if (immediate) {
    runCloudSync();
  } else {
    if ((window as any)._savedQuizzesSyncTimer) {
      clearTimeout((window as any)._savedQuizzesSyncTimer);
    }
    (window as any)._savedQuizzesSyncTimer = setTimeout(runCloudSync, 600);
  }
}

/**
 * Tải danh sách bài tập từ Đám mây về thiết bị và hợp nhất thông minh với dữ liệu cục bộ
 */
export async function pullSavedQuizzesFromCloud(): Promise<SavedEducationalItem[]> {
  const localItems = getSavedEducationalItems();
  let cloudItems: SavedEducationalItem[] = [];

  // 1. Thử lấy từ Firestore trước
  try {
    const snap = await getDoc(doc(db, 'global_store', 'saved_quizzes'));
    if (snap.exists() && snap.data()?.items && Array.isArray(snap.data()?.items)) {
      cloudItems = snap.data()?.items as SavedEducationalItem[];
    } else {
      // Fallback: Kiểm tra smartboard_data
      const mainSnap = await getDoc(doc(db, 'global_store', 'smartboard_data'));
      if (mainSnap.exists() && mainSnap.data()?.savedQuizzes && Array.isArray(mainSnap.data()?.savedQuizzes)) {
        cloudItems = mainSnap.data()?.savedQuizzes as SavedEducationalItem[];
      }
    }
  } catch (err) {
    console.warn('[Cloud Pull] Firestore pull warning:', err);
  }

  // 2. Nếu Firestore chưa có hoặc lỗi mạng, thử lấy từ backend server
  if (cloudItems.length === 0) {
    try {
      const res = await fetch('/api/quizzes/sync');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          cloudItems = data.items;
        }
      }
    } catch (_) {}
  }

  // 3. Hợp nhất thông minh giữa Cloud và Local:
  // - Nếu Cloud có dữ liệu: hợp nhất dữ liệu từ Cloud và Local
  // - Bảo toàn tất cả các bài tập đã tạo ở cả 2 thiết bị
  if (cloudItems.length > 0) {
    const mergedMap = new Map<string, SavedEducationalItem>();
    
    // Đưa cloud items vào map trước
    cloudItems.forEach((it) => {
      if (it && it.id) mergedMap.set(it.id, it);
    });

    // Nếu local có item mới tạo chưa có trên cloud, thêm vào và đẩy ngược lên cloud
    let hasLocalOnly = false;
    localItems.forEach((it) => {
      if (!it || !it.id) return;
      if (!mergedMap.has(it.id)) {
        // Chỉ thêm nếu khác ID mẫu mặc định hoặc là bài người dùng tạo
        mergedMap.set(it.id, it);
        hasLocalOnly = true;
      }
    });

    const finalMerged = Array.from(mergedMap.values());
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(finalMerged));
      window.dispatchEvent(new CustomEvent('saved-quizzes-updated', { detail: finalMerged }));
    } catch (_) {}

    if (hasLocalOnly) {
      syncSavedEducationalItemsToCloud(finalMerged, false);
    }
    return finalMerged;
  } else if (localItems.length > 0) {
    // Nếu Cloud trống mà Local đã có bài tập do giáo viên tạo trên máy này, tự động đẩy lên Cloud
    syncSavedEducationalItemsToCloud(localItems, false);
  }

  return localItems;
}

/**
 * Lắng nghe cập nhật thời gian thực từ Firestore để khi máy tính bấm LƯU,
 * điện thoại tự động nhận bài tập mới trong tích tắc mà không cần tải lại trang!
 */
export function initSavedQuizzesRealtimeSync(
  onUpdate?: (items: SavedEducationalItem[]) => void
): () => void {
  let unsub: (() => void) | null = null;
  try {
    unsub = onSnapshot(
      doc(db, 'global_store', 'saved_quizzes'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data && Array.isArray(data.items) && data.items.length > 0) {
            const cloudItems = data.items as SavedEducationalItem[];
            const localItems = getSavedEducationalItems();
            
            // Hợp nhất map
            const mergedMap = new Map<string, SavedEducationalItem>();
            cloudItems.forEach((item) => {
              if (item && item.id) mergedMap.set(item.id, item);
            });
            localItems.forEach((item) => {
              if (item && item.id && !mergedMap.has(item.id)) {
                mergedMap.set(item.id, item);
              }
            });

            const finalItems = Array.from(mergedMap.values());
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(finalItems));
              window.dispatchEvent(new CustomEvent('saved-quizzes-updated', { detail: finalItems }));
            } catch (_) {}

            if (onUpdate) {
              onUpdate(finalItems);
            }
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

  // Kéo dữ liệu một lần ngay khi khởi tạo
  pullSavedQuizzesFromCloud().then((items) => {
    if (onUpdate && items.length > 0) {
      onUpdate(items);
    }
  });

  return () => {
    if (unsub) unsub();
  };
}

/**
 * Lưu bài tập hoặc trò chơi mới (hoặc cập nhật nếu đã có ID) và tự động đồng bộ Cloud
 */
export function saveEducationalItem(
  item: Omit<SavedEducationalItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): SavedEducationalItem {
  const all = getSavedEducationalItems();
  const now = new Date().toISOString();

  let finalItem: SavedEducationalItem;
  let next: SavedEducationalItem[];

  if (item.id && all.some((x) => x.id === item.id)) {
    // Cập nhật
    finalItem = {
      ...(item as SavedEducationalItem),
      id: item.id,
      updatedAt: now,
    };
    next = all.map((x) => (x.id === item.id ? finalItem : x));
  } else {
    // Tạo mới
    const newId = item.id || `saved_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    finalItem = {
      ...item,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };
    next = [finalItem, ...all];
  }

  // Đẩy đồng bộ lên Đám Mây ngay lập tức (Firestore + Server + LocalStorage)
  syncSavedEducationalItemsToCloud(next, true);

  return finalItem;
}

/**
 * Xóa một bài tập hoặc trò chơi đã lưu và đồng bộ lên Đám mây
 */
export function deleteEducationalItem(id: string): void {
  const all = getSavedEducationalItems();
  const next = all.filter((x) => x.id !== id);
  syncSavedEducationalItemsToCloud(next, true);
}
