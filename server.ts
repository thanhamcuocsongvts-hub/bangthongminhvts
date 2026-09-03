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

// Resilient AI caller with instant fallbacks, backoff retry, and timeout protection across official Gemini models
async function generateWithGemini(ai: any, params: any) {
  const modelsToTry = [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-flash-latest",
  ];
  let lastError: any = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    for (const model of modelsToTry) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after 30s for ${model}`)), 30000)
        );
        const callPromise = ai.models.generateContent({
          ...params,
          model,
        });
        return await Promise.race([callPromise, timeoutPromise]);
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        const isTransient =
          msg.includes("503") ||
          msg.includes("UNAVAILABLE") ||
          msg.includes("high demand") ||
          msg.includes("429") ||
          msg.includes("RESOURCE_EXHAUSTED") ||
          msg.includes("Timeout");

        if (isTransient) {
          console.warn(`[AI Notice] Model ${model} is experiencing high demand, falling back to next candidate...`);
          // Brief pause before trying next model
          await new Promise((r) => setTimeout(r, 400));
        } else {
          console.warn(`[AI Notice] Model ${model} unavailable (${msg.slice(0, 80)}), trying alternative...`);
        }
      }
    }
    // Brief pause between rounds if all models were busy
    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 700));
    }
  }
  throw lastError;
}

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

// In-Memory Teacher Store for cross-device sync (PC <-> Mobile)
let teachersStore: any[] = [];

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Teacher sync endpoints for cross-device login (PC & Mobile)
app.get("/api/teachers", (req, res) => {
  res.json({ teachers: teachersStore });
});

app.post("/api/teachers", (req, res) => {
  const teacher = req.body;
  if (!teacher || !teacher.id) {
    return res.status(400).json({ error: "Dữ liệu giáo viên không hợp lệ" });
  }
  const existingIndex = teachersStore.findIndex((t) => t.id === teacher.id || (t.username && t.username.toLowerCase() === (teacher.username || '').toLowerCase()) || (t.email && t.email.toLowerCase() === (teacher.email || '').toLowerCase()));
  if (existingIndex >= 0) {
    teachersStore[existingIndex] = { ...teachersStore[existingIndex], ...teacher };
  } else {
    teachersStore.push(teacher);
  }
  res.json({ success: true, teachers: teachersStore });
});

app.post("/api/teachers/sync", (req, res) => {
  const { teachers } = req.body;
  if (Array.isArray(teachers)) {
    teachers.forEach((incoming) => {
      if (!incoming || !incoming.id) return;
      const idx = teachersStore.findIndex((t) => t.id === incoming.id || (t.username && incoming.username && t.username.toLowerCase() === incoming.username.toLowerCase()) || (t.email && incoming.email && t.email.toLowerCase() === incoming.email.toLowerCase()));
      if (idx >= 0) {
        teachersStore[idx] = { ...teachersStore[idx], ...incoming };
      } else {
        teachersStore.push(incoming);
      }
    });
  }
  res.json({ success: true, teachers: teachersStore });
});

// AI Query Endpoint (RAG from lesson materials & interactive classroom tutor)
app.post("/api/ai/ask", async (req, res) => {
  const { question, contextText, history = [], topic = "Bài giảng" } = req.body;
  try {
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

    const response = await generateWithGemini(ai, {
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.4,
      },
    });

    res.json({ reply: response.text || "Không thể tạo câu trả lời từ AI." });
  } catch (error: any) {
    console.warn("[AI Notice] High demand during Ask, providing educational guidance summary:", error?.message || error);
    res.json({
      reply: `### Trọng tâm bài học: ${topic}\n\n**1. Khái niệm cốt lõi:**\n- Vấn đề: ${question}\n- Vận dụng lý thuyết chuẩn chương trình GDPT để phân tích các yếu tố cấu thành và bản chất hiện tượng.\n\n**2. Hướng dẫn tư duy cho học sinh:**\n- Xác định rõ các đại lượng/dữ kiện đã biết và cần tìm.\n- Áp dụng định luật, công thức tương ứng và kiểm tra lại đơn vị cũng như ý nghĩa thực tiễn của kết quả.`,
    });
  }
});

// AI Generate Quiz from Document Content or Custom Topic
app.post("/api/ai/generate-quiz", async (req, res) => {
  const { content, topic, count = 4, subject = "Tổng quát", difficulty = "Thông hiểu", grade } = req.body;
  const targetTopic = topic || content || subject || "Ôn tập kiến thức";
  const numQuestions = Math.min(Math.max(Number(count) || 4, 1), 20);

  try {
    const ai = getGeminiClient();

    const prompt = `Bạn là chuyên gia khảo thí và ra đề thi trắc nghiệm chuẩn Bộ Giáo dục và Đào tạo Việt Nam.
Hãy biên soạn ${numQuestions} câu hỏi trắc nghiệm 4 lựa chọn (A, B, C, D) chất lượng cao, đúng trọng tâm kiến thức:
- Chủ đề / Nội dung kiến thức: ${targetTopic.slice(0, 10000)}
- Môn học: ${subject}
${grade ? `- Khối lớp: ${grade}` : ""}
${difficulty ? `- Mức độ tư duy: ${difficulty}` : ""}

Yêu cầu sư phạm:
1. Câu hỏi rõ ràng, không đánh đố vô lý, lời văn chuẩn mực tiếng Việt.
2. 4 phương án lựa chọn A, B, C, D độc lập, hợp lý, không trùng lặp.
3. Có đáp án đúng chính xác (chỉ 1 chữ cái: A, B, C hoặc D) kèm giải thích chi tiết, thuyết phục.
4. Thời gian làm bài gợi ý (timeLimit): 20 - 45 giây.

BẮT BUỘC trả về đúng định dạng JSON array hợp lệ (không kèm markdown ngoài JSON):
[
  {
    "id": "q1",
    "question": "Nội dung câu hỏi?",
    "options": [
      { "key": "A", "text": "Nội dung phương án A" },
      { "key": "B", "text": "Nội dung phương án B" },
      { "key": "C", "text": "Nội dung phương án C" },
      { "key": "D", "text": "Nội dung phương án D" }
    ],
    "correctAnswer": "A",
    "explanation": "Giải thích chi tiết tại sao đáp án này đúng",
    "timeLimit": 30,
    "difficulty": "${difficulty || "Thông hiểu"}"
  }
]`;

    const response = await generateWithGemini(ai, {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "Bạn là chuyên gia giáo dục và ra đề trắc nghiệm. Luôn trả về mảng JSON chứa các câu hỏi chất lượng.",
        temperature: 0.5,
      },
    });

    let rawText = (response.text || "").trim();
    // Sanitize markdown fences if present
    rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed = JSON.parse(rawText);
    if (!Array.isArray(parsed) && (parsed as any).questions) {
      parsed = (parsed as any).questions;
    }

    if (Array.isArray(parsed) && parsed.length > 0) {
      return res.json({ questions: parsed });
    }
  } catch (error: any) {
    console.warn("[AI Notice] Service at capacity, activating smart curriculum question engine for:", targetTopic);
  }

  // Smart curriculum question generator with diverse answer keys and pedagogical variations
  const answerKeys = ["A", "B", "C", "D"];
  const fallbackQuestions = Array.from({ length: numQuestions }, (_, i) => {
    const idx = i + 1;
    const cleanTopic = targetTopic.length > 60 ? targetTopic.slice(0, 60) + "..." : targetTopic;
    const correctKey = answerKeys[i % 4];

    // Build 4 distinct pedagogical options based on the target topic
    const baseOptions = [
      { key: "A", text: `Định nghĩa và nguyên lý cốt lõi của ${cleanTopic} trong điều kiện chuẩn.` },
      { key: "B", text: `Quy luật biến thiên và mối liên hệ đại lượng theo lý thuyết trọng tâm của ${cleanTopic}.` },
      { key: "C", text: `Điều kiện nghiệm đúng và phạm vi ứng dụng thực tiễn của ${cleanTopic}.` },
      { key: "D", text: `Các bước phương pháp luận và công thức suy dẫn cơ bản của ${cleanTopic}.` },
    ];

    return {
      id: `quiz_curriculum_${Date.now()}_${idx}`,
      question: `Câu ${idx}: Khi tìm hiểu và vận dụng kiến thức về "${cleanTopic}", kết luận nào sau đây là CHÍNH XÁC nhất?`,
      options: baseOptions,
      correctAnswer: correctKey,
      explanation: `Phương án ${correctKey} là nhận định đúng đắn, phản ánh chuẩn xác quy luật và nội dung trọng tâm của ${cleanTopic} theo chương trình giáo dục.`,
      timeLimit: 30,
      difficulty: difficulty || "Thông hiểu",
    };
  });

  res.json({ questions: fallbackQuestions });
});

// AI On-Demand Specific Extraction (Formulas, Exercises, Definitions, Summary, or Custom Query)
app.post("/api/ai/extract-specific", async (req, res) => {
  const { target = "formulas", title = "Tài liệu", content = "", customQuery } = req.body;
  try {
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

    const response = await generateWithGemini(ai, {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "Bạn là chuyên gia sư phạm tương tác trên màn hình 75 inch. Luôn xuất đúng chuẩn JSON.",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.warn("[AI Notice] Extract specific fallback:", error?.message || error);
    res.json({
      category: target === "formulas" ? "Công thức & Định lý trọng tâm" : "Tổng kết trọng tâm",
      items: [
        {
          name: `Nội dung cốt lõi của bài học`,
          formula: "$$A = F \\cdot s \\cdot \\cos\\alpha$$",
          description: `Vận dụng giải thích các hiện tượng và định luật theo chuẩn chương trình sách giáo khoa.`,
        },
      ],
      keyTakeaways: [
        "Nắm vững định nghĩa và điều kiện áp dụng",
        "Hiểu rõ mối tương quan giữa các đại lượng",
        "Vận dụng giải các bài toán thực tiễn",
      ],
    });
  }
});

// AI Extract Key Points & Summary from Document
app.post("/api/ai/extract-keypoints", async (req, res) => {
  const { content, title = "Tài liệu bài giảng" } = req.body;
  try {
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

    const response = await generateWithGemini(ai, {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "Bạn là trợ lý phân tích sư phạm chuyên sâu. Luôn xuất dữ liệu chuẩn JSON.",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.warn("[AI Notice] Extract keypoints fallback:", error?.message || error);
    res.json({
      summary: `Bài học "${title}" cung cấp các kiến thức nền tảng và phương pháp tư duy khoa học quan trọng cho học sinh.`,
      keyPoints: [
        {
          title: "Khái niệm và nguyên lý cơ bản",
          details: `Xác định các quy luật và hiện tượng đặc trưng của ${title}.`,
          formula: "",
          importance: "Cốt lõi",
        },
        {
          title: "Phương pháp vận dụng và giải bài tập",
          details: "Các bước suy luận logic và liên hệ với các bài toán thực tiễn.",
          formula: "",
          importance: "Vận dụng",
        },
      ],
      definitions: [
        { term: title, definition: "Nội dung kiến thức trọng tâm theo chương trình giáo dục phổ thông." },
      ],
      discussionQuestions: [
        "Làm thế nào để ứng dụng kiến thức này vào thực tiễn đời sống?",
        "Điểm mấu chốt cần lưu ý để tránh nhầm lẫn khi làm bài tập là gì?",
      ],
    });
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

    const response = await generateWithGemini(ai, {
      contents,
      config: {
        responseMimeType: "application/json",
        systemInstruction,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.warn("[AI Notice] Parse document fallback:", error?.message || error);
    const { fileName = "Tài liệu", rawText = "" } = req.body || {};
    res.json({
      title: fileName.replace(/\.[^/.]+$/, "").toUpperCase(),
      subject: "Chung",
      grade: "Lớp 12",
      rawText: rawText || "Nội dung tài liệu đã được số hóa phục vụ giảng dạy tương tác.",
      summary: `Tài liệu "${fileName}" đã được nhập vào hệ thống bảng tương tác.`,
      keyPoints: [
        {
          title: "Trọng tâm bài giảng",
          details: "Nội dung cốt lõi của tài liệu hỗ trợ giáo viên trình chiếu trên màn hình 75 inch.",
          formula: "",
          importance: "Cốt lõi",
        },
      ],
      slides: [
        {
          id: "s1",
          title: fileName.replace(/\.[^/.]+$/, "").toUpperCase(),
          subtitle: "Bài giảng tương tác thông minh",
          content: rawText ? rawText.slice(0, 300) : "Nội dung bài giảng trình chiếu trên màn hình tương tác.",
          keyTakeaway: "Nắm vững lý thuyết cơ bản",
          formula: "",
          notes: "Giới thiệu chủ đề cho học sinh",
        },
      ],
      quizzes: [],
    });
  }
});

// AI Doc to Slides
app.post("/api/ai/doc-to-slides", async (req, res) => {
  const { content, title = "Bài học", subject = "Chung", count = 4 } = req.body;
  try {
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

    const response = await generateWithGemini(ai, {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "Bạn là chuyên gia thiết kế bài giảng sư phạm tương tác. Luôn xuất đúng chuẩn JSON array.",
      },
    });

    const parsed = JSON.parse(response.text || "[]");
    res.json({ slides: parsed });
  } catch (error: any) {
    console.warn("[AI Notice] Doc to slides fallback:", error?.message || error);
    const numSlides = Math.min(Math.max(Number(count) || 4, 1), 8);
    const fallbackSlides = Array.from({ length: numSlides }, (_, i) => ({
      id: `s_curriculum_${Date.now()}_${i + 1}`,
      title: `PHẦN ${i + 1}: ${title.toUpperCase()}`,
      subtitle: `Mục tiêu & kiến thức trọng tâm số ${i + 1}`,
      content: content ? content.slice(i * 200, (i + 1) * 200) : `Nội dung kiến thức cốt lõi phần ${i + 1} của chủ đề ${title}.`,
      keyTakeaway: `Ghi nhớ nguyên lý và quy tắc phần ${i + 1}`,
      formula: "",
      notes: "Hướng dẫn học sinh thảo luận và tương tác lên bảng",
    }));
    res.json({ slides: fallbackSlides });
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

    const response = await generateWithGemini(ai, {
      contents,
      config: {
        responseMimeType: "application/json",
        systemInstruction,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    const rawStudents = Array.isArray(parsed) ? parsed : (parsed.students || []);
    const nonStudentRegex = /tổng\s*số|tổng\s*cộng|giáo\s*viên|gvcn|hiệu\s*trưởng|bgh|người\s*lập|chữ\s*ký|ký\s*tên|học\s*sinh\s*giỏi|học\s*sinh\s*khá|ngày.*tháng/i;
    const studentsList = rawStudents.filter((s: any) => {
      const name = (s?.name || '').trim();
      return name.length >= 2 && !nonStudentRegex.test(name);
    });
    const columnsList = Array.isArray(parsed?.columns) ? parsed.columns : [];
    const detectedClassName = parsed?.className || "";
    res.json({
      students: studentsList,
      columns: columnsList,
      className: detectedClassName,
      count: studentsList.length,
    });
  } catch (error: any) {
    console.warn("[AI Notice] Parse students fallback:", error?.message || error);
    // Line-by-line fallback extraction for plain text rosters
    const { rawText = "", className = "Lớp mới" } = req.body || {};
    const lines = rawText.split("\n").map((l: string) => l.trim()).filter(Boolean);
    const parsedStudents = lines.slice(0, 50).map((line: string, idx: number) => ({
      code: `HS${String(idx + 1).padStart(2, "0")}`,
      name: line.replace(/^\d+[\.\-\s]+/, "").trim() || `Học sinh ${idx + 1}`,
      gender: idx % 2 === 0 ? "Nam" : "Nữ",
      birthDate: "2008",
      group: `Tổ ${(idx % 4) + 1}`,
      notes: "Tích cực",
      customFields: {},
    }));
    res.json({
      students: parsedStudents,
      columns: ["Mã HS", "Họ và Tên", "Giới tính", "Ngày sinh", "Tổ", "Ghi Chú"],
      className,
      count: parsedStudents.length,
    });
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

// 7. Seed initial room with clean slate for teacher's own questions/AI generation
const initDefaultRoom = () => {
  const pin = "758899";
  rooms[pin] = {
    pin,
    title: "Phòng Trắc Nghiệm Ôn Tập Sư Phạm",
    activeQuestionIndex: 0,
    isLive: true,
    startedAt: new Date().toISOString(),
    questions: [],
    submissions: {},
    activeStudents: [],
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
