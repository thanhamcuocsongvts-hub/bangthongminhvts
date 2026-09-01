import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Initialize Gemini Client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set. Gemini features may fail.");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// In-memory Classroom Rooms for live student interactions
interface StudentSubmission {
  studentId: string;
  studentName: string;
  selectedOption: string; // 'A', 'B', 'C', 'D'
  isCorrect: boolean;
  timeSpentSeconds: number;
  submittedAt: string;
}

interface RoomState {
  pin: string;
  title: string;
  activeQuestionIndex: number;
  isLive: boolean;
  startedAt: string;
  questions: Array<{
    id: string;
    question: string;
    options: { key: string; text: string }[];
    correctAnswer: string;
    explanation: string;
    timeLimit: number;
  }>;
  submissions: Record<string, StudentSubmission[]>; // questionId -> array of submissions
  activeStudents: Array<{ id: string; name: string; joinedAt: string }>;
}

const rooms: Record<string, RoomState> = {};

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// AI Query Endpoint (RAG from lesson materials & interactive classroom tutor)
app.post("/api/ai/ask", async (req, res) => {
  try {
    const { question, contextText, history = [], topic = "Bài giảng" } = req.body;

    if (!question) {
      return res.status(400).json({ error: "Thiếu câu hỏi (question)" });
    }

    const ai = getGeminiClient();
    const systemInstruction = `Bạn là Trợ Lý Giảng Dạy AI chuyên nghiệp hiển thị trên Màn Hình Tương Tác 75 inch trong lớp học tại Việt Nam.
Nhiệm vụ của bạn là:
1. Trích xuất chính xác kiến thức từ tài liệu/bài giảng được giáo viên cung cấp bên dưới.
2. Giải thích ngắn gọn, súc tích, trực quan, dùng gạch đầu dòng rõ ràng để học sinh ngồi ở bàn cuối lớp học cũng dễ đọc.
3. Dùng ngôn ngữ sư phạm chuẩn mực, khích lệ tư duy học sinh, có kèm ví dụ thực tế hoặc sơ đồ tóm tắt bằng ký tự/bảng biểu khi phù hợp.
4. Trả lời trực tiếp vào trọng tâm, tiếng Việt chuẩn mực.`;

    const prompt = `[CHỦ ĐỀ BÀI HỌC]: ${topic}

[TÀI LIỆU / DỮ LIỆU BÀI GIẢNG ĐANG TRÌNH CHIẾU]:
${contextText ? contextText.slice(0, 15000) : "Không có tài liệu đính kèm, hãy giải đáp theo kiến thức chuẩn sách giáo khoa."}

[CÂU HỎI CỦA GIÁO VIÊN / HỌC SINH]:
${question}

Hãy trả lời thật rõ ràng, cấu trúc mạch lạc để hiển thị trên màn hình lớn 75 inch.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.4,
      },
    });

    res.json({ reply: response.text || "Không thể tạo câu trả lời từ AI." });
  } catch (error: any) {
    console.error("AI Ask error:", error);
    res.status(500).json({ error: error.message || "Lỗi xử lý AI" });
  }
});

// AI Generate Quiz from Document Content
app.post("/api/ai/generate-quiz", async (req, res) => {
  try {
    const { content, count = 4, subject = "Tổng quát" } = req.body;
    const ai = getGeminiClient();

    const prompt = `Từ nội dung bài học dưới đây, hãy tạo ra ${count} câu hỏi trắc nghiệm 4 lựa chọn (A, B, C, D) chất lượng cao để kiểm tra mức độ hiểu bài của học sinh.

Nội dung bài học:
${content ? content.slice(0, 10000) : `Chủ đề ${subject}`}

Yêu cầu trả về định dạng JSON thuần túy (mảng các câu hỏi):
[
  {
    "id": "q1",
    "question": "Nội dung câu hỏi rõ ràng?",
    "options": [
      { "key": "A", "text": "Phương án A" },
      { "key": "B", "text": "Phương án B" },
      { "key": "C", "text": "Phương án C" },
      { "key": "D", "text": "Phương án D" }
    ],
    "correctAnswer": "A",
    "explanation": "Giải thích ngắn gọn tại sao phương án này đúng",
    "timeLimit": 30
  }
]`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "Bạn là chuyên gia ra đề thi trắc nghiệm sư phạm. Luôn trả về đúng chuẩn JSON array.",
      },
    });

    const parsed = JSON.parse(response.text || "[]");
    res.json({ questions: parsed });
  } catch (error: any) {
    console.error("AI Generate Quiz error:", error);
    res.status(500).json({ error: error.message || "Lỗi tạo bài tập trắc nghiệm" });
  }
});

// AI On-Demand Specific Extraction (Formulas, Exercises, Definitions, Summary, or Custom Query)
app.post("/api/ai/extract-specific", async (req, res) => {
  try {
    const { target = "formulas", title = "Tài liệu", content = "", customQuery } = req.body;
    const ai = getGeminiClient();

    let targetPrompt = "";
    if (target === "formulas") {
      targetPrompt = `Hãy trích xuất TOÀN BỘ CÁC ĐỊNH LÝ, ĐỊNH NGHĨA VÀ CÔNG THỨC QUAN TRỌNG từ tài liệu "${title}".
Viết các công thức chuẩn dạng LaTeX (ví dụ: $y = ax^2 + bx + c$, $\\int f(x)dx$, $\\vec{F} = m\\vec{a}$,...).
Định dạng JSON:
{
  "category": "Công thức & Định lý",
  "items": [
    {
      "name": "Tên định lý / công thức",
      "formula": "Công thức LaTeX",
      "description": "Ý nghĩa và điều kiện áp dụng",
      "example": "Ví dụ minh họa ngắn"
    }
  ]
}`;
    } else if (target === "exercises") {
      targetPrompt = `Hãy trích xuất hoặc tạo 3-5 BÀI TẬP VẬN DỤNG & CÂU HỎI TỰ LUẬN kèm lời giải chi tiết từ tài liệu "${title}".
Định dạng JSON:
{
  "category": "Bài tập & Ví dụ mẫu",
  "items": [
    {
      "name": "Bài 1: [Tiêu đề bài toán]",
      "problem": "Đề bài chi tiết",
      "solution": "Lời giải / hướng dẫn từng bước",
      "level": "Nhận biết / Thông hiểu / Vận dụng"
    }
  ]
}`;
    } else if (target === "summary") {
      targetPrompt = `Hãy trích xuất BẢN TÓM TẮT CỐT LÕI 2 PHÚT từ tài liệu "${title}" để giáo viên giảng bài trên bảng.
Định dạng JSON:
{
  "category": "Tóm tắt cốt lõi",
  "summary": "Đoạn văn tóm tắt 3-4 câu ngắn gọn súc tích",
  "keyTakeaways": [
    "Ý cốt lõi 1",
    "Ý cốt lõi 2",
    "Ý cốt lõi 3"
  ]
}`;
    } else {
      targetPrompt = `Dựa vào tài liệu "${title}", hãy trả lời và trích xuất thông tin theo yêu cầu cụ thể sau của giáo viên:
"${customQuery || 'Giải thích các điểm cần lưu ý'}"
Định dạng JSON:
{
  "category": "Giải đáp theo yêu cầu",
  "answer": "Nội dung giải đáp chi tiết, sư phạm, có dẫn chứng rõ ràng",
  "highlights": ["Điểm nổi bật 1", "Điểm nổi bật 2"]
}`;
    }

    const prompt = `${targetPrompt}

Nội dung tài liệu:
${content ? content.slice(0, 15000) : title}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "Bạn là chuyên gia sư phạm tương tác trên màn hình 75 inch. Luôn xuất đúng chuẩn JSON.",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("AI Extract Specific error:", error);
    res.status(500).json({ error: error.message || "Lỗi trích xuất theo yêu cầu" });
  }
});

// AI Extract Key Points & Summary from Document
app.post("/api/ai/extract-keypoints", async (req, res) => {
  try {
    const { content, title = "Tài liệu bài giảng" } = req.body;
    const ai = getGeminiClient();

    const prompt = `Bạn là Trợ lý Sư phạm Cao cấp. Hãy phân tích tài liệu sau và trích xuất các vấn đề trọng tâm để giáo viên giảng dạy trên màn hình tương tác 75 inch.
Tiêu đề: ${title}

Nội dung tài liệu:
${content ? content.slice(0, 12000) : "Chưa có nội dung"}

Hãy trả về JSON theo định dạng:
{
  "summary": "Tóm tắt bài học ngắn gọn súc tích trong 2-3 câu",
  "keyPoints": [
    {
      "title": "Vấn đề trọng tâm 1",
      "details": "Chi tiết giải thích rõ ràng, dễ hiểu",
      "formula": "Công thức / định luật (nếu có)",
      "importance": "Cốt lõi / Mở rộng / Vận dụng"
    }
  ],
  "definitions": [
    { "term": "Khái niệm 1", "definition": "Định nghĩa chính xác" }
  ],
  "discussionQuestions": [
    "Câu hỏi kích thích tư duy phản biện 1",
    "Câu hỏi liên hệ thực tế 2"
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "Bạn là trợ lý phân tích sư phạm chuyên sâu. Luôn xuất dữ liệu chuẩn JSON.",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("AI Extract Keypoints error:", error);
    res.status(500).json({ error: error.message || "Lỗi trích xuất trọng tâm" });
  }
});

// AI Parse Document Endpoint (Handles PDF, Word, Images, Text, PPTX)
app.post("/api/ai/parse-document", async (req, res) => {
  try {
    const { fileBase64, mimeType = "application/pdf", fileName = "Tài liệu", rawText } = req.body;
    const ai = getGeminiClient();

    const systemInstruction = `Bạn là chuyên gia phân tích và số hóa tài liệu giáo dục sư phạm hàng đầu tại Việt Nam, phục vụ giảng dạy trên Màn Hình Tương Tác 75 inch.
Nhiệm vụ của bạn là đọc và phân tích toàn bộ tài liệu được gửi kèm (PDF, hình ảnh chụp sách/đề thi, giáo án, tệp văn bản).
Hãy trích xuất và chuẩn hóa bài giảng thành cấu trúc JSON với đầy đủ các trường:
1. "title": Tiêu đề bài học / chủ đề bài giảng (viết hoa chuẩn mực, ví dụ: "BÀI 12: ĐỊNH LUẬT BẢO TOÀN ĐỘNG LƯỢNG").
2. "subject": Môn học ("Toán học", "Vật lý", "Hóa học", "Sinh học", "Lịch sử", "Ngữ văn", "Tiếng Anh", "Tin học", "Khác").
3. "grade": Lớp học ("Lớp 10", "Lớp 11", "Lớp 12",...).
4. "rawText": Toàn bộ nội dung bài học được làm sạch hoàn toàn (KHÔNG để lại bất kỳ ký tự rác binary nào). Trình bày mạch lạc theo chuẩn Markdown rõ ràng với các mục lớn I, II, III..., các công thức Toán/Lý/Hóa được viết chuẩn dạng LaTeX ($...$ hoặc $$...$$) hoặc ký hiệu khoa học rõ nét.
5. "summary": Tóm tắt cốt lõi bài học trong 2-3 câu súc tích.
6. "keyPoints": Mảng các vấn đề trọng tâm cần nhớ [{ "title": "...", "details": "...", "formula": "...", "importance": "Cốt lõi/Vận dụng" }].
7. "slides": Mảng 4-8 slide trình chiếu sư phạm chuẩn để chiếu lên màn hình TV 75 inch [{ "id": "s1", "title": "TIÊU ĐỀ SLIDE", "subtitle": "Phụ đề", "content": "Nội dung gạch đầu dòng ngắn gọn", "keyTakeaway": "Ý cốt lõi cần nhớ", "formula": "Công thức nếu có", "notes": "Gợi ý giảng dạy" }].
8. "quizzes": Mảng 3-5 câu hỏi trắc nghiệm 4 lựa chọn [{ "id": "q1", "question": "Nội dung câu hỏi?", "options": [{"key": "A", "text": "Phương án A"}, {"key": "B", "text": "Phương án B"}, {"key": "C", "text": "Phương án C"}, {"key": "D", "text": "Phương án D"}], "correctAnswer": "A", "explanation": "Giải thích chi tiết", "timeLimit": 30 }].

Luôn trả về đúng chuẩn JSON duy nhất.`;

    let contents: any;

    if (fileBase64) {
      const cleanData = fileBase64.replace(/^data:[^;]+;base64,/, "");
      contents = [
        {
          inlineData: {
            mimeType: mimeType || "application/pdf",
            data: cleanData,
          },
        },
        {
          text: `Hãy phân tích toàn bộ tài liệu đính kèm tên là "${fileName}". Trích xuất nội dung bài học sạch sẽ, công thức khoa học dạng LaTeX, tạo bộ slide trình chiếu và câu hỏi trắc nghiệm kiểm tra.`,
        },
      ];
    } else {
      contents = `Hãy phân tích tài liệu sau có tên "${fileName}" và trích xuất thành định dạng JSON chuẩn:
${rawText ? rawText.slice(0, 18000) : fileName}`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents,
      config: {
        responseMimeType: "application/json",
        systemInstruction,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("AI Parse Document error:", error);
    res.status(500).json({ error: error.message || "Lỗi phân tích tài liệu bằng AI" });
  }
});

// AI Doc to Slides
app.post("/api/ai/doc-to-slides", async (req, res) => {
  try {
    const { content, title = "Bài học", subject = "Chung", count = 4 } = req.body;
    const ai = getGeminiClient();

    const prompt = `Hãy chuyển hóa tài liệu bài học sau thành ${count} slide trình chiếu sinh động, chuyên nghiệp cho màn hình Tivi 75 inch.
Môn: ${subject}
Chủ đề: ${title}

Tài liệu:
${content ? content.slice(0, 10000) : title}

Yêu cầu định dạng JSON array:
[
  {
    "id": "s_ai_1",
    "title": "TIÊU ĐỀ SLIDE (VIẾT HOA)",
    "subtitle": "Phụ đề / Khái quát",
    "content": "Nội dung dạng gạch đầu dòng rõ ràng, cách nhau bằng dấu xuống dòng.",
    "keyTakeaway": "Ý cốt lõi học sinh cần ghi nhớ",
    "formula": "Công thức hoặc sơ đồ ngắn (nếu có)",
    "notes": "Lời khuyên cho giáo viên khi trình bày slide này"
  }
]`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "Bạn là chuyên gia thiết kế bài giảng sư phạm tương tác. Luôn xuất đúng chuẩn JSON array.",
      },
    });

    const parsed = JSON.parse(response.text || "[]");
    res.json({ slides: parsed });
  } catch (error: any) {
    console.error("AI Doc to Slides error:", error);
    res.status(500).json({ error: error.message || "Lỗi chuyển đổi slide" });
  }
});

// AI Parse Student Roster from Text, Document, or Photo
app.post("/api/ai/parse-students", async (req, res) => {
  try {
    const { rawText, imageBase64, mimeType = "image/jpeg", className = "Lớp mới" } = req.body;
    const ai = getGeminiClient();

    const systemInstruction = `Bạn là trợ lý giáo vụ thông minh chuyên xử lý bảng điểm và danh sách lớp học tại Việt Nam.
Nhiệm vụ của bạn là nhận diện và trích xuất TOÀN BỘ DANH SÁCH VÀ CÁC CỘT DỮ LIỆU từ hình ảnh chụp danh sách lớp, sổ điểm, bảng điểm thi, sổ gọi tên hoặc văn bản.
Hãy trích xuất chính xác:
1. "name": Họ và tên đầy đủ của từng học sinh (viết hoa chữ cái đầu theo chuẩn tiếng Việt, ví dụ: "Nguyễn Văn An").
2. "code": Mã số học sinh hoặc số thứ tự (ví dụ: "HS01", "HS02", "01", "202401"). Nếu không có thì tạo mã dạng "HS01", "HS02",...
3. "gender": Giới tính ("Nam" / "Nữ" nếu có hoặc suy đoán theo tên).
4. "birthDate": Ngày sinh / Năm sinh (nếu có trong bảng, ví dụ: "12/04/2008").
5. "group": Tổ / Nhóm (nếu có, ví dụ: "Tổ 1").
6. "oralScore": Điểm miệng / kiểm tra miệng (số thực từ 0 đến 10, nếu có).
7. "test15mScore": Điểm 15 phút (số thực từ 0 đến 10, nếu có).
8. "test1PeriodScore": Điểm 1 tiết / Điểm giữa kỳ (số thực từ 0 đến 10, nếu có).
9. "finalScore": Điểm thi học kỳ / Cuối kỳ (số thực từ 0 đến 10, nếu có).
10. "notes": Ghi chú / Nhận xét / Đánh giá (nếu có).
11. "customFields": Bất kỳ cột bổ sung nào khác có trong bảng điểm (ví dụ: số điện thoại, địa chỉ, chức vụ, xếp loại...).

Bỏ qua các dòng tiêu đề chung của trường/sở (như "BẢNG ĐIỂM HỌC KỲ", "TRƯỜNG THPT..."). Chỉ lấy các dòng học sinh thực tế.
Luôn trả về đúng chuẩn JSON object có cấu trúc:
{
  "className": "Tên lớp học nếu phát hiện được (ví dụ: 10A1, 12A8)",
  "columns": ["Mã HS", "Họ và Tên", "Giới tính", "Ngày sinh", "Tổ", "Điểm Miệng", "Điểm 15P", "Điểm 1 Tiết", "Điểm Cuối Kỳ", "Ghi Chú"],
  "students": [
    {
      "code": "HS01",
      "name": "Nguyễn Văn An",
      "gender": "Nam",
      "birthDate": "15/05/2009",
      "group": "Tổ 1",
      "oralScore": 8.5,
      "test15mScore": 9.0,
      "test1PeriodScore": 8.0,
      "finalScore": 8.5,
      "notes": "Hăng hái phát biểu",
      "customFields": {}
    }
  ]
}`;

    let contents: any;

    if (imageBase64) {
      // Clean base64 data prefix if present
      const cleanData = imageBase64.replace(/^data:[^;]+;base64,/, "");
      contents = [
        {
          inlineData: {
            mimeType: mimeType || "image/jpeg",
            data: cleanData,
          },
        },
        {
          text: "Hãy trích xuất toàn bộ danh sách họ và tên học sinh trong hình ảnh này thành định dạng JSON chuẩn.",
        },
      ];
    } else {
      contents = `Hãy trích xuất danh sách học sinh từ nội dung sau thành JSON array:
${rawText ? rawText.slice(0, 15000) : "Chưa có nội dung"}`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents,
      config: {
        responseMimeType: "application/json",
        systemInstruction,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    const studentsList = Array.isArray(parsed) ? parsed : (parsed.students || []);
    const columnsList = Array.isArray(parsed?.columns) ? parsed.columns : [];
    const detectedClassName = parsed?.className || "";
    res.json({
      students: studentsList,
      columns: columnsList,
      className: detectedClassName,
      count: studentsList.length,
    });
  } catch (error: any) {
    console.error("AI Parse Students error:", error);
    res.status(500).json({ error: error.message || "Lỗi nhận diện danh sách học sinh" });
  }
});

// Real-time Quiz Room Endpoints
// 1. Create or Update a Quiz Room
app.post("/api/rooms", (req, res) => {
  const { pin, title, questions } = req.body;
  const roomPin = pin || Math.floor(100000 + Math.random() * 900000).toString();

  rooms[roomPin] = {
    pin: roomPin,
    title: title || "Bài tập trắc nghiệm lớp học",
    activeQuestionIndex: 0,
    isLive: true,
    startedAt: new Date().toISOString(),
    questions: questions || [],
    submissions: {},
    activeStudents: rooms[roomPin]?.activeStudents || [],
  };

  res.json({ success: true, room: rooms[roomPin] });
});

// 2. Get Room State (For Teacher & Students)
app.get("/api/rooms/:pin", (req, res) => {
  const { pin } = req.params;
  const room = rooms[pin];
  if (!room) {
    return res.status(404).json({ error: "Phòng học không tồn tại hoặc đã kết thúc." });
  }
  res.json(room);
});

// 3. Student Join Room
app.post("/api/rooms/:pin/join", (req, res) => {
  const { pin } = req.params;
  const { studentName, studentId } = req.body;

  const room = rooms[pin];
  if (!room) {
    return res.status(404).json({ error: "Phòng học không tồn tại." });
  }

  const sId = studentId || "std_" + Math.random().toString(36).substring(2, 9);
  const sName = (studentName || "").trim() || `Học sinh ${room.activeStudents.length + 1}`;

  // Check if exists
  const existingIdx = room.activeStudents.findIndex((s) => s.id === sId);
  if (existingIdx === -1) {
    room.activeStudents.push({ id: sId, name: sName, joinedAt: new Date().toISOString() });
  } else {
    room.activeStudents[existingIdx].name = sName;
  }

  res.json({ success: true, studentId: sId, studentName: sName, room });
});

// 4. Student Submit Answer
app.post("/api/rooms/:pin/submit", (req, res) => {
  const { pin } = req.params;
  const { questionId, studentId, studentName, selectedOption, timeSpentSeconds } = req.body;

  const room = rooms[pin];
  if (!room) {
    return res.status(404).json({ error: "Phòng học không tồn tại." });
  }

  const q = room.questions.find((x) => x.id === questionId);
  if (!q) {
    return res.status(404).json({ error: "Câu hỏi không tồn tại." });
  }

  if (!room.submissions[questionId]) {
    room.submissions[questionId] = [];
  }

  const isCorrect = selectedOption === q.correctAnswer;
  const existingSubIdx = room.submissions[questionId].findIndex((s) => s.studentId === studentId);

  const subData: StudentSubmission = {
    studentId,
    studentName: studentName || "Học sinh",
    selectedOption,
    isCorrect,
    timeSpentSeconds: timeSpentSeconds || 5,
    submittedAt: new Date().toISOString(),
  };

  if (existingSubIdx >= 0) {
    room.submissions[questionId][existingSubIdx] = subData;
  } else {
    room.submissions[questionId].push(subData);
  }

  res.json({ success: true, isCorrect, explanation: q.explanation });
});

// 5. Change Active Question / Control Quiz from Teacher
app.post("/api/rooms/:pin/control", (req, res) => {
  const { pin } = req.params;
  const { activeQuestionIndex, isLive } = req.body;

  const room = rooms[pin];
  if (!room) {
    return res.status(404).json({ error: "Phòng học không tồn tại." });
  }

  if (typeof activeQuestionIndex === "number") {
    room.activeQuestionIndex = activeQuestionIndex;
  }
  if (typeof isLive === "boolean") {
    room.isLive = isLive;
  }

  res.json({ success: true, room });
});

// 6. Reset Room Submissions
app.post("/api/rooms/:pin/reset", (req, res) => {
  const { pin } = req.params;
  const room = rooms[pin];
  if (!room) {
    return res.status(404).json({ error: "Phòng học không tồn tại." });
  }
  room.submissions = {};
  room.activeQuestionIndex = 0;
  res.json({ success: true, room });
});

// 7. Seed initial demo room with realistic live student data
const initDefaultRoom = () => {
  const pin = "758899";
  rooms[pin] = {
    pin,
    title: "Trắc nghiệm kiểm tra bài học: Quang hợp & Hô hấp tế bào",
    activeQuestionIndex: 0,
    isLive: true,
    startedAt: new Date().toISOString(),
    questions: [
      {
        id: "q1",
        question: "Bào quan nào trong tế bào thực vật trực tiếp thực hiện quá trình quang hợp?",
        options: [
          { key: "A", text: "Ty thể (Mitochondria)" },
          { key: "B", text: "Lục lạp (Chloroplast)" },
          { key: "C", text: "Không bào (Vacuole)" },
          { key: "D", text: "Bộ máy Golgi" },
        ],
        correctAnswer: "B",
        explanation: "Lục lạp chứa sắc tố diệp lục (chlorophyll) có khả năng hấp thụ năng lượng ánh sáng mặt trời để tổng hợp chất hữu cơ.",
        timeLimit: 30,
      },
      {
        id: "q2",
        question: "Sản phẩm chính của pha sáng quang hợp cung cấp cho pha tối (chu trình Calvin) là gì?",
        options: [
          { key: "A", text: "ATP và NADPH" },
          { key: "B", text: "Glucose và Oxy" },
          { key: "C", text: "ADP và Pi" },
          { key: "D", text: "CO2 và H2O" },
        ],
        correctAnswer: "A",
        explanation: "Pha sáng chuyển hóa năng lượng ánh sáng thành hóa năng trong ATP và lực khử NADPH để khử CO2 ở pha tối.",
        timeLimit: 45,
      },
      {
        id: "q3",
        question: "Phương trình tổng quát của quá trình quang hợp là:",
        options: [
          { key: "A", text: "6CO2 + 6H2O + Ánh sáng → C6H12O6 + 6O2" },
          { key: "B", text: "C6H12O6 + 6O2 → 6CO2 + 6H2O + Năng lượng" },
          { key: "C", text: "6CO2 + 12H2O → C6H12O6 + 6H2O + 6O2" },
          { key: "D", text: "C6H12O6 + 6H2O → 6CO2 + 12H2" },
        ],
        correctAnswer: "A",
        explanation: "6 phân tử CO2 kết hợp với 6 phân tử H2O dưới tác dụng của diệp lục và ánh sáng tạo ra 1 phân tử Glucose (C6H12O6) và giải phóng 6O2.",
        timeLimit: 30,
      },
      {
        id: "q4",
        question: "Yếu tố nào sau đây KHÔNG ảnh hưởng trực tiếp đến cường độ quang hợp?",
        options: [
          { key: "A", text: "Cường độ ánh sáng" },
          { key: "B", text: "Nồng độ khí CO2" },
          { key: "C", text: "Nhiệt độ môi trường" },
          { key: "D", text: "Nồng độ khí Nitơ tự do trong không khí" },
        ],
        correctAnswer: "D",
        explanation: "Khí N2 tự do trơ không tham gia trực tiếp vào phản ứng quang hợp; thực vật chỉ hấp thụ đạm qua rễ dưới dạng ion khoáng.",
        timeLimit: 30,
      },
    ],
    submissions: {
      q1: [
        { studentId: "s1", studentName: "Nguyễn Minh Tuấn", selectedOption: "B", isCorrect: true, timeSpentSeconds: 6, submittedAt: new Date().toISOString() },
        { studentId: "s2", studentName: "Trần Mai Phương", selectedOption: "B", isCorrect: true, timeSpentSeconds: 8, submittedAt: new Date().toISOString() },
        { studentId: "s3", studentName: "Lê Hoàng Nam", selectedOption: "B", isCorrect: true, timeSpentSeconds: 11, submittedAt: new Date().toISOString() },
        { studentId: "s4", studentName: "Phạm Thu Thảo", selectedOption: "A", isCorrect: false, timeSpentSeconds: 14, submittedAt: new Date().toISOString() },
        { studentId: "s5", studentName: "Vũ Quốc Bảo", selectedOption: "B", isCorrect: true, timeSpentSeconds: 7, submittedAt: new Date().toISOString() },
        { studentId: "s6", studentName: "Đỗ Gia Hân", selectedOption: "B", isCorrect: true, timeSpentSeconds: 9, submittedAt: new Date().toISOString() },
        { studentId: "s7", studentName: "Hoàng Đức Anh", selectedOption: "C", isCorrect: false, timeSpentSeconds: 15, submittedAt: new Date().toISOString() },
        { studentId: "s8", studentName: "Bùi Ngọc Ánh", selectedOption: "B", isCorrect: true, timeSpentSeconds: 5, submittedAt: new Date().toISOString() },
      ],
    },
    activeStudents: [
      { id: "s1", name: "Nguyễn Minh Tuấn", joinedAt: new Date().toISOString() },
      { id: "s2", name: "Trần Mai Phương", joinedAt: new Date().toISOString() },
      { id: "s3", name: "Lê Hoàng Nam", joinedAt: new Date().toISOString() },
      { id: "s4", name: "Phạm Thu Thảo", joinedAt: new Date().toISOString() },
      { id: "s5", name: "Vũ Quốc Bảo", joinedAt: new Date().toISOString() },
      { id: "s6", name: "Đỗ Gia Hân", joinedAt: new Date().toISOString() },
      { id: "s7", name: "Hoàng Đức Anh", joinedAt: new Date().toISOString() },
      { id: "s8", name: "Bùi Ngọc Ánh", joinedAt: new Date().toISOString() },
      { id: "s9", name: "Đặng Khánh Linh", joinedAt: new Date().toISOString() },
      { id: "s10", name: "Trịnh Văn Hùng", joinedAt: new Date().toISOString() },
    ],
  };
};

initDefaultRoom();

// Integrate Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SmartBoard 75 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
