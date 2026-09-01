export type SubjectType = 'Toán học' | 'Vật lý' | 'Hóa học' | 'Sinh học' | 'Lịch sử' | 'Địa lý' | 'Ngữ văn' | 'Tiếng Anh' | 'Tin học' | 'Khác';

export interface SlideItem {
  id: string;
  title: string;
  subtitle?: string;
  content: string; // Markdown or structured bullet points
  keyTakeaway?: string;
  formula?: string;
  imageUrl?: string;
  imageCaption?: string;
  notes?: string;
}

export interface QuizOption {
  key: string; // 'A' | 'B' | 'C' | 'D'
  text: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
  correctAnswer: string;
  explanation: string;
  timeLimit: number; // in seconds
  subject?: SubjectType;
  difficulty?: 'Dễ' | 'Trung bình' | 'Vận dụng cao';
}

export interface StudentSubmission {
  studentId: string;
  studentName: string;
  selectedOption: string;
  isCorrect: boolean;
  timeSpentSeconds: number;
  submittedAt: string;
}

export interface ActiveStudent {
  id: string;
  name: string;
  joinedAt: string;
  avatarColor?: string;
}

export interface RoomState {
  pin: string;
  title: string;
  activeQuestionIndex: number;
  isLive: boolean;
  startedAt: string;
  questions: QuizQuestion[];
  submissions: Record<string, StudentSubmission[]>; // questionId -> submissions
  activeStudents: ActiveStudent[];
}

export interface LessonDoc {
  id: string;
  title: string;
  subject: SubjectType;
  grade: string; // e.g. "Lớp 10", "Lớp 11", "Lớp 12"
  lastModified: string;
  syncedToCloud: boolean;
  author: string;
  rawText: string;
  slides: SlideItem[];
  quizzes: QuizQuestion[];
  fileUrl?: string; // Blob or Data URL to view original PDF / Doc / Image / Media
  fileType?: 'pdf' | 'docx' | 'image' | 'xlsx' | 'pptx' | 'text' | 'other';
  fileName?: string;
  fileSize?: string;
  extractedSummary?: ExtractedDocSummary;
  htmlContent?: string; // Rich HTML for Word .docx documents
  sheetData?: {
    sheetNames: string[];
    sheets: Record<string, any[][]>;
  };
  attachments?: Array<{
    name: string;
    size: string;
    type: string;
    url?: string;
  }>;
}

export type WhiteboardTool =
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'laser'
  | 'line'
  | 'dashed_line'
  | 'arrow'
  | 'dashed_arrow'
  | 'rect'
  | 'rectangle'
  | 'circle'
  | 'ellipse'
  | 'cube'
  | 'cuboid'
  | 'pyramid_tri'
  | 'pyramid_quad'
  | 'cone'
  | 'cylinder'
  | 'revolution_cylinder'
  | 'sphere'
  | 'func_linear'
  | 'func_quadratic_up'
  | 'func_quadratic_down'
  | 'func_cubic_2extrema_pos'
  | 'func_cubic_2extrema_neg'
  | 'func_cubic_noextrema_pos'
  | 'func_cubic_noextrema_neg'
  | 'func_cubic_inflection_pos'
  | 'func_cubic_inflection_neg'
  | 'func_rational_pos'
  | 'func_rational_neg'
  | 'func_frac21'
  | 'func_exp_pos'
  | 'func_exp_neg'
  | 'func_log_pos'
  | 'func_log_neg'
  | 'text';

export interface StrokePoint {
  x: number;
  y: number;
  pressure?: number;
}

export interface StrokeVertex {
  id?: string;
  name: string;
  x: number;
  y: number;
  role?: 'apex' | 'base' | 'top' | 'control' | 'radius' | 'endpoint';
}

export interface WhiteboardStroke {
  id: string;
  tool: WhiteboardTool;
  points: StrokePoint[];
  color: string;
  size: number;
  opacity?: number;
  rotation?: number; // 0 - 360 degrees
  centerX?: number;
  centerY?: number;
  scale?: number;
  text?: string;
  timestamp?: number;
  customVertices?: StrokeVertex[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  extractedFromDoc?: boolean;
  quickAction?: {
    type: 'create_quiz' | 'show_slide' | 'insert_note';
    payload: any;
    label: string;
  };
}

export type TextScale = 'normal' | 'large' | 'huge'; // 100%, 125%, 150% font scale for 75" TV

export interface ConductRecord {
  id: string;
  type: 'violation' | 'reward';
  category: string;
  points: number; // e.g. -2 or +2
  week: string; // "Tuần 1", "Tuần 2"...
  date: string; // YYYY-MM-DD
  period: string; // "15 phút đầu giờ", "Tiết 1"...
  note?: string;
  recordedBy?: string;
  createdAt: string;
}

export interface SemesterScoreDetail {
  tx1?: number | null; // ĐĐGtx 1
  tx2?: number | null; // ĐĐGtx 2
  tx3?: number | null; // ĐĐGtx 3
  tx4?: number | null; // ĐĐGtx 4
  tx5?: number | null; // ĐĐGtx 5
  gk?: number | null;  // ĐĐGgk (Hệ số 2)
  ck?: number | null;  // ĐĐGck (Hệ số 3)
  dtb?: number | null; // Điểm trung bình môn học kỳ (DTBmhk)
  evaluation?: string; // Nhận xét: "Xuất Sắc", "Giỏi", "Khá", "Đạt", "Chưa Đạt"
}

export interface ClassStudent {
  id: string;
  code: string; // Mã học sinh, e.g. "HS1001"
  name: string;
  gender?: string; // "Nam" | "Nữ"
  birthDate?: string; // "15/08/2009"
  group?: string; // e.g. "Tổ 1", "Tổ 2"
  avatarColor?: string;

  // Chi tiết 2 phiếu điểm Học Kỳ 1 & Học Kỳ 2 chuẩn Bộ GD&ĐT
  hk1?: SemesterScoreDetail;
  hk2?: SemesterScoreDetail;
  finalYearAvg?: number | null; // Điểm TB Cả Năm (CN) = (HK1 + 2*HK2)/3
  yearEvaluation?: string; // Xếp loại Cả Năm

  // Các trường điểm phẳng tương thích và đồng bộ
  oralScore?: number | null; // Điểm kiểm tra miệng (0 - 10)
  test15mScore?: number | null; // Điểm 15 phút
  test1PeriodScore?: number | null; // Điểm 1 tiết / Giữa kỳ
  finalScore?: number | null; // Điểm cuối kỳ / Điểm thi
  quizScore?: number | null; // Điểm trắc nghiệm trực tiếp
  bonusPoints: number; // Tổng Điểm cộng/trừ thi đua
  conductRecords?: ConductRecord[]; // Lịch sử các lần cộng/trừ điểm thi đua
  notes?: string;
  isCalled?: boolean; // Đã được gọi phát biểu trong buổi học hôm nay chưa
  customFields?: Record<string, string | number | null | undefined>; // Lưu trữ tất cả các cột mở rộng từ file Excel đã nhập
}

export interface ClassRoom {
  id: string;
  name: string; // "10A1", "10A2", "11B1", "12A3"
  grade: string; // "Lớp 10", "Lớp 11", "Lớp 12"
  academicYear: string; // "2026 - 2027"
  subject: SubjectType;
  students: ClassStudent[];
  customColumns?: string[]; // Danh sách các cột mở rộng được nhập từ file Excel hoặc tạo thêm
}

export interface TeacherProfile {
  id: string;
  name: string;
  username?: string;
  password?: string;
  email: string;
  phone?: string;
  avatar?: string;
  subject: SubjectType;
  school: string;
  classes: ClassRoom[];
  savedLessonIds?: string[];
  isGoogleAccount?: boolean;
  createdAt?: string;
}

export interface ExtractedKeyPoint {
  title: string;
  details: string;
  formula?: string;
  importance?: string;
}

export interface ExtractedDefinition {
  term: string;
  definition: string;
}

export type BlackboardBackground =
  | 'blackboard'
  | 'oli'
  | 'lined'
  | 'graph'
  | 'white'
  | 'slate'
  | 'navy'
  | 'wood';

export interface ExtractedDocSummary {
  summary: string;
  keyPoints: ExtractedKeyPoint[];
  definitions: ExtractedDefinition[];
  discussionQuestions: string[];
}

