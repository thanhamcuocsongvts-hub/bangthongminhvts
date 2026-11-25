/**
 * Saved Quizzes & Games Storage Service for SmartBoard 75 Pro
 * Strictly isolated per teacher account (`teacherId`):
 * - Each teacher can only view, store, manage, and assign their own saved exams & games.
 * - Cross-device sync (PC <-> Phone <-> School 75" TV) syncs within the same teacher's account namespace.
 */

import { QuizQuestion } from '../types';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, getDocFromServer, onSnapshot, setDoc } from 'firebase/firestore';
import {
  isFirestoreQuotaExhausted,
  isQuotaError,
  markFirestoreQuotaExhausted,
} from './firebaseSafe';
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

export interface SyncResult {
  cloudSynced: boolean;
  serverSynced: boolean;
  error?: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: Array<{
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }>;
  };
}

function logFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): string {
  const message = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: message,
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider: any) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  return message;
}

let connectionTested = false;
async function testFirestoreConnection(): Promise<void> {
  if (connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration: the client is offline.');
    }
  }
}

const LEGACY_STORAGE_KEY = 'smartboard_saved_quizzes_and_games';
const SCOPED_STORAGE_PREFIX = 'smartboard_saved_quizzes_v2_';
const SCOPED_DELETED_PREFIX = 'smartboard_saved_quizzes_deleted_v2_';
const STARTER_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function getScopedStorageKey(teacherId?: string | null): string {
  return `${SCOPED_STORAGE_PREFIX}${normalizeTeacherOwnerId(teacherId)}`;
}

function getScopedDeletedKey(teacherId?: string | null): string {
  return `${SCOPED_DELETED_PREFIX}${normalizeTeacherOwnerId(teacherId)}`;
}

function getDeletedIds(ownerId: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getScopedDeletedKey(ownerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === 'string' && id.length > 0).slice(0, 500)
      : [];
  } catch {
    return [];
  }
}

function saveDeletedIds(ownerId: string, ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const unique = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.length > 0))).slice(-500);
    localStorage.setItem(getScopedDeletedKey(ownerId), JSON.stringify(unique));
  } catch {}
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
    createdAt: STARTER_TIMESTAMP,
    updatedAt: STARTER_TIMESTAMP,
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
    createdAt: STARTER_TIMESTAMP,
    updatedAt: STARTER_TIMESTAMP,
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
    createdAt: STARTER_TIMESTAMP,
    updatedAt: STARTER_TIMESTAMP,
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

function sanitizeForFirestore<T>(val: T): T {
  if (val === undefined) return undefined as any;
  if (val === null || typeof val !== 'object') {
    if (typeof val === 'number' && !Number.isFinite(val)) return 0 as any;
    return val;
  }
  if (Array.isArray(val)) {
    return val
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined) as any;
  }
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(val as Record<string, any>)) {
    if (v === undefined) continue;
    const cleaned = sanitizeForFirestore(v);
    if (cleaned !== undefined) {
      clean[k] = cleaned;
    }
  }
  return clean as T;
}

function getItemTimestamp(it?: SavedEducationalItem | null): number {
  if (!it) return 0;
  const t = new Date(it.updatedAt || it.createdAt || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Hợp nhất danh sách bài tập cục bộ và trên Đám mây theo ID & updatedAt, tôn trọng deletedIds.
 * Đảm bảo đề tạo offline/cũ trên máy nhà không bao giờ bị ghi đè mất khi mở app hoặc chuyển thiết bị.
 */
function mergeSavedEducationalItems(
  localItems: SavedEducationalItem[],
  cloudItems: SavedEducationalItem[],
  deletedSet: Set<string>,
  ownerId: string
): { merged: SavedEducationalItem[]; needsCloudPush: boolean } {
  const map = new Map<string, SavedEducationalItem>();
  const cloudMap = new Map<string, SavedEducationalItem>();

  for (const it of filterOwnedItems(cloudItems, ownerId)) {
    if (!deletedSet.has(it.id)) {
      map.set(it.id, it);
      cloudMap.set(it.id, it);
    }
  }

  let needsCloudPush = false;

  for (const it of filterOwnedItems(localItems, ownerId)) {
    if (deletedSet.has(it.id)) continue;

    const existing = map.get(it.id);
    if (!existing) {
      const isStarter = DEFAULT_SAMPLE_IDS.has(it.id);
      // Only treat custom local items as needing cloud push (unless cloud is completely empty)
      if (!isStarter || cloudItems.length === 0) {
        map.set(it.id, it);
        if (!isStarter) {
          needsCloudPush = true;
        }
      }
    } else {
      const localTs = getItemTimestamp(it);
      const cloudTs = getItemTimestamp(existing);
      if (localTs > cloudTs) {
        map.set(it.id, it);
        needsCloudPush = true;
      }
    }
  }

  // Ensure newer items stay near top while preserving custom order
  const merged = Array.from(map.values())
    .sort((a, b) => {
      const aStarter = DEFAULT_SAMPLE_IDS.has(a.id) ? 1 : 0;
      const bStarter = DEFAULT_SAMPLE_IDS.has(b.id) ? 1 : 0;
      if (aStarter !== bStarter) return aStarter - bStarter;
      return getItemTimestamp(b) - getItemTimestamp(a);
    })
    .slice(0, 500);

  return { merged, needsCloudPush };
}

/**
 * Giới hạn dung lượng tài liệu dưới 900KB để luôn vừa khít giới hạn 1MB của Firestore.
 */
function enforceFirestorePayloadBudget(
  items: SavedEducationalItem[],
  maxBytes: number = 900_000
): SavedEducationalItem[] {
  const clean = sanitizeForFirestore(items).slice(0, 500);
  const measure = (arr: any[]) => {
    try {
      return new Blob([JSON.stringify(arr)]).size;
    } catch {
      return JSON.stringify(arr).length * 2;
    }
  };

  if (measure(clean) <= maxBytes) return clean;

  // Step 1: Drop heavy optional imageDataUrl blobs from questions if payload is oversized
  const trimmed = clean.map((item) => ({
    ...item,
    questions: (item.questions || []).map((q: any) => {
      if (!q || typeof q !== 'object') return q;
      const copy = { ...q };
      if (typeof copy.imageUrl === 'string' && copy.imageUrl.startsWith('data:') && copy.imageUrl.length > 10000) {
        delete copy.imageUrl;
      }
      return copy;
    }),
  }));
  if (measure(trimmed) <= maxBytes) return trimmed;

  // Step 2: Retain newest items up to budget (dropping oldest sample/old items first)
  const kept: SavedEducationalItem[] = [];
  for (const item of trimmed) {
    kept.push(item);
    if (measure(kept) > maxBytes) {
      kept.pop();
      break;
    }
  }
  return kept;
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
): Promise<SyncResult> {
  const ownerId = normalizeTeacherOwnerId(teacherId);
  if (typeof window === 'undefined') {
    return { cloudSynced: false, serverSynced: false };
  }

  const scopedItems = filterOwnedItems(items, ownerId);
  const scopedKey = getScopedStorageKey(ownerId);

  try {
    localStorage.setItem(scopedKey, JSON.stringify(scopedItems));
    dispatchSavedQuizzesEvent(ownerId, scopedItems);
  } catch (_) {}

  if (ownerId === 'guest') {
    return {
      cloudSynced: false,
      serverSynced: false,
      error: 'Tài khoản Khách chỉ lưu tạm trên thiết bị này. Hãy đăng nhập tài khoản giáo viên để đồng bộ.',
    };
  }

  const runCloudSync = async (): Promise<SyncResult> => {
    let cloudSynced = false;
    let serverSynced = false;
    let lastError: string | undefined;

    try {
      await testFirestoreConnection();
      const budgetItems = enforceFirestorePayloadBudget(scopedItems);
      const deletedIds = getDeletedIds(ownerId);
      const payload = sanitizeForFirestore({
        teacherId: ownerId,
        items: budgetItems,
        deletedIds,
        updatedAt: new Date().toISOString(),
      });

      // 1. Lưu trực tiếp vào Firestore doc riêng của đúng tài khoản giáo viên này
      if (!isFirestoreQuotaExhausted()) {
        const docPath = `teacher_saved_quizzes/${ownerId}`;
        try {
          await setDoc(doc(db, 'teacher_saved_quizzes', ownerId), payload);
          cloudSynced = true;
        } catch (fsErr: any) {
          if (isQuotaError(fsErr)) {
            markFirestoreQuotaExhausted(fsErr?.message);
            lastError = 'Firestore hết hạn mức ghi trong ngày.';
          } else {
            lastError = logFirestoreError(fsErr, OperationType.WRITE, docPath);
          }
        }
      }

      // 2. Sao lưu bổ sung theo đúng teacherId lên backend server (nếu chạy Express local/node)
      try {
        const res = await fetch('/api/quizzes/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacherId: ownerId,
            items: budgetItems,
            replaceAll: true,
          }),
        });
        if (res.ok) {
          serverSynced = true;
        }
      } catch (_) {}
    } catch (e: any) {
      lastError = e?.message || String(e);
      console.warn('[Cloud Sync] Error syncing saved items to cloud:', lastError);
    }

    return { cloudSynced, serverSynced, error: lastError };
  };

  if (immediate) {
    return await runCloudSync();
  } else {
    const timerKey = `_savedQuizzesSyncTimer_${ownerId}`;
    if ((window as any)[timerKey]) {
      clearTimeout((window as any)[timerKey]);
    }
    return new Promise((resolve) => {
      (window as any)[timerKey] = setTimeout(async () => {
        resolve(await runCloudSync());
      }, 500);
    });
  }
}

/**
 * Tải và hợp nhất danh sách bài tập ĐÃ LƯU thuộc riêng tài khoản hiện tại từ Đám mây.
 * Tự động đẩy các đề cục bộ chưa đồng bộ lên Firestore để cứu dữ liệu giữa các thiết bị.
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

  await testFirestoreConnection();

  let cloudItems: SavedEducationalItem[] | null = null;
  let cloudDeletedIds: string[] = [];
  const docPath = `teacher_saved_quizzes/${ownerId}`;

  // 1. Tải từ Firestore doc riêng của tài khoản
  try {
    const snap = await getDoc(doc(db, 'teacher_saved_quizzes', ownerId));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.items)) {
        cloudItems = filterOwnedItems(data.items as SavedEducationalItem[], ownerId);
      }
      if (Array.isArray(data?.deletedIds)) {
        cloudDeletedIds = data.deletedIds.filter((id: any) => typeof id === 'string');
      }
    }
  } catch (err) {
    logFirestoreError(err, OperationType.GET, docPath);
  }

  // 2. Fallback: Lấy đúng slice của teacherId từ backend server nếu chưa có trên Firestore
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
  const localDeletedIds = getDeletedIds(ownerId);
  const mergedDeletedIds = Array.from(new Set([...localDeletedIds, ...cloudDeletedIds])).slice(-500);
  saveDeletedIds(ownerId, mergedDeletedIds);
  const deletedSet = new Set(mergedDeletedIds);

  if (cloudItems !== null) {
    const { merged, needsCloudPush } = mergeSavedEducationalItems(
      localItems,
      cloudItems,
      deletedSet,
      ownerId
    );
    try {
      localStorage.setItem(scopedKey, JSON.stringify(merged));
      dispatchSavedQuizzesEvent(ownerId, merged);
    } catch (_) {}

    if (needsCloudPush) {
      await syncSavedEducationalItemsToCloud(merged, ownerId, true);
    }
    return merged;
  }

  // Nếu tài khoản này chưa từng tạo doc trên Cloud nhưng đang có đề tự tạo cục bộ -> đồng bộ ngay lên Firestore
  const hasCustomLocal = localItems.some((it) => !DEFAULT_SAMPLE_IDS.has(it.id));
  if (hasCustomLocal) {
    await syncSavedEducationalItemsToCloud(localItems, ownerId, true);
  }

  return localItems;
}

/**
 * Lắng nghe cập nhật thời gian thực CHỈ trong tài khoản của chính giáo viên đó (PC <-> Điện thoại <-> TV 75").
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
  const docPath = `teacher_saved_quizzes/${ownerId}`;

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
            const cloudDeletedIds: string[] = Array.isArray(data.deletedIds)
              ? data.deletedIds.filter((id: any) => typeof id === 'string')
              : [];
            const localDeletedIds = getDeletedIds(ownerId);
            const mergedDeletedIds = Array.from(new Set([...localDeletedIds, ...cloudDeletedIds])).slice(-500);
            saveDeletedIds(ownerId, mergedDeletedIds);
            const deletedSet = new Set(mergedDeletedIds);

            const localItems = getSavedEducationalItems(ownerId, teacherName);
            const { merged, needsCloudPush } = mergeSavedEducationalItems(
              localItems,
              cloudItems,
              deletedSet,
              ownerId
            );

            try {
              localStorage.setItem(scopedKey, JSON.stringify(merged));
              dispatchSavedQuizzesEvent(ownerId, merged);
            } catch (_) {}

            onUpdate?.(merged);

            if (needsCloudPush) {
              syncSavedEducationalItemsToCloud(merged, ownerId, false);
            }
          }
        }
      },
      (err) => {
        logFirestoreError(err, OperationType.GET, docPath);
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

function upsertItemLocally(
  item: Omit<SavedEducationalItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  teacherId?: string | null,
  teacherName?: string | null
): { ownerId: string; finalItem: SavedEducationalItem; nextList: SavedEducationalItem[] } {
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

  // If re-saving an item ID, remove it from deletedIds tombstone list
  const deleted = getDeletedIds(ownerId).filter((did) => did !== finalItem.id);
  saveDeletedIds(ownerId, deleted);

  return { ownerId, finalItem, nextList: next };
}

/**
 * Lưu bài tập hoặc trò chơi mới gắn chặt với teacherId đang đăng nhập và đồng bộ Đám mây (bất đồng bộ trả kết quả).
 */
export async function saveEducationalItemAndSync(
  item: Omit<SavedEducationalItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  teacherId?: string | null,
  teacherName?: string | null
): Promise<{ item: SavedEducationalItem; sync: SyncResult }> {
  const { ownerId, finalItem, nextList } = upsertItemLocally(item, teacherId, teacherName);
  const sync = await syncSavedEducationalItemsToCloud(nextList, ownerId, true);
  return { item: finalItem, sync };
}

/**
 * Lưu bài tập hoặc trò chơi mới (tương thích đồng bộ, tự động đẩy lên Đám mây ở nền).
 */
export function saveEducationalItem(
  item: Omit<SavedEducationalItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  teacherId?: string | null,
  teacherName?: string | null
): SavedEducationalItem {
  const { ownerId, finalItem, nextList } = upsertItemLocally(item, teacherId, teacherName);
  void syncSavedEducationalItemsToCloud(nextList, ownerId, true);
  return finalItem;
}

/**
 * Xóa một bài tập hoặc trò chơi trong kho riêng của tài khoản hiện tại và đồng bộ xóa lên Đám mây.
 */
export async function deleteEducationalItemAndSync(
  id: string,
  teacherId?: string | null
): Promise<SyncResult> {
  const ownerId = normalizeTeacherOwnerId(teacherId);
  const all = getSavedEducationalItems(ownerId);
  const next = all.filter((x) => x.id !== id);
  const deleted = getDeletedIds(ownerId);
  if (!deleted.includes(id)) {
    saveDeletedIds(ownerId, [...deleted, id]);
  }
  return await syncSavedEducationalItemsToCloud(next, ownerId, true);
}

/**
 * Xóa một bài tập hoặc trò chơi trong kho riêng của tài khoản hiện tại.
 */
export function deleteEducationalItem(id: string, teacherId?: string | null): void {
  void deleteEducationalItemAndSync(id, teacherId);
}
