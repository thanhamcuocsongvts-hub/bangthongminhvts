import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Sigma,
  BookmarkCheck,
  Layers,
  CheckSquare,
  Compass,
  FileText,
  Tag,
  ArrowRight,
} from 'lucide-react';

export type ScopeActionType = 'formulas' | 'summary' | 'slides' | 'quiz';

interface ScopeConstraintModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: ScopeActionType;
  documentTitle: string;
  subject?: string;
  onConfirm: (scopeConstraint: string, count?: number) => void;
  isProcessing?: boolean;
}

export const ScopeConstraintModal: React.FC<ScopeConstraintModalProps> = ({
  isOpen,
  onClose,
  actionType,
  documentTitle,
  subject = 'Toán học',
  onConfirm,
  isProcessing = false,
}) => {
  const [scopeText, setScopeText] = useState<string>('');
  const [itemCount, setItemCount] = useState<number>(actionType === 'slides' ? 5 : 5);

  if (!isOpen) return null;

  const actionMeta = {
    formulas: {
      title: 'Trích Xuất Công Thức & Định Lý',
      subtitle: 'Xác định giới hạn kiến thức cần trích xuất',
      icon: Sigma,
      color: 'indigo',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      btnClass: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30',
      placeholder:
        'Ví dụ: Chỉ trích xuất công thức tính đạo hàm và bảng biến thiên; hoặc từ trang 5 đến trang 20; hoặc chỉ các công thức cực trị hàm bậc ba...',
      suggestedPresets: [
        '📌 Toàn bộ công thức & định lý trong tài liệu',
        '📐 Chỉ các công thức giải nhanh & tính chất đặc biệt',
        '🎯 Lý thuyết định nghĩa & điều kiện đủ cực trị',
        '⚡ Phần công thức bài tập trắc nghiệm',
      ],
    },
    summary: {
      title: 'Tóm Tắt Cốt Lõi 2 Phút',
      subtitle: 'Xác định phạm vi bài học cần tóm tắt',
      icon: BookmarkCheck,
      color: 'emerald',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      btnClass: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30',
      placeholder:
        'Ví dụ: Tóm tắt trọng tâm Phần 1: Khảo sát sự biến thiên; hoặc tóm tắt các bước giải bài toán đồ thị; hoặc từ trang 1 đến trang 10...',
      suggestedPresets: [
        '📌 Tóm tắt toàn bộ tài liệu',
        '🎯 Tóm tắt kiến thức lý thuyết trọng tâm nhất',
        '💡 Tóm tắt phương pháp và các bước giải bài mẫu',
        '📝 Tóm tắt sơ đồ tư duy ôn tập trước kỳ thi',
      ],
    },
    slides: {
      title: 'Tạo Slide Giảng Dạy Tự Động',
      subtitle: 'Xác định phạm vi bài giảng để biên soạn Slide',
      icon: Layers,
      color: 'purple',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      btnClass: 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/30',
      placeholder:
        'Ví dụ: Soạn slide cho Phần 2: Cực trị của hàm số bậc ba; hoặc chỉ tập trung vào các ví dụ minh họa và bài tập áp dụng; hoặc từ trang 12 đến trang 25...',
      suggestedPresets: [
        '📌 Soạn toàn diện từ đầu đến cuối tài liệu',
        '🎯 Tập trung chuyên sâu vào phần lý thuyết & định nghĩa',
        '📊 Tập trung vào các dạng bài tập mẫu và phương pháp giải',
        '⚡ Biên soạn slide tổng kết & câu hỏi tương tác lên bảng',
      ],
    },
    quiz: {
      title: 'Tạo Bộ Câu Hỏi Trắc Nghiệm',
      subtitle: 'Xác định phạm vi kiến thức để ra đề trắc nghiệm',
      icon: CheckSquare,
      color: 'amber',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      btnClass: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30',
      placeholder:
        'Ví dụ: Ra đề trắc nghiệm về tìm khoảng đơn điệu của hàm số phân thức hữu tỉ; hoặc mức độ Vận dụng cao; hoặc giới hạn trong bài 1...',
      suggestedPresets: [
        '📌 Toàn bộ nội dung của bài học',
        '🎯 Mức độ Nhận biết & Thông hiểu lý thuyết',
        '🔥 Mức độ Vận dụng & Vận dụng cao',
        '⚡ Các bẫy sai lầm học sinh hay mắc phải',
      ],
    },
  }[actionType];

  const Icon = actionMeta.icon;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(scopeText.trim(), itemCount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div
        id="scope-constraint-modal-box"
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-scale-up"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border ${actionMeta.badgeClass}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  GIỚI HẠN PHẠM VI KIẾN THỨC
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${actionMeta.badgeClass}`}>
                  {subject}
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900">{actionMeta.title}</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Target Document Context */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
            <FileText className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
            <div className="overflow-hidden">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Tài liệu đang xử lý:</div>
              <div className="text-xs font-bold text-slate-800 truncate">{documentTitle}</div>
            </div>
          </div>

          {/* Scope Input Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-indigo-600" />
                <span>Yêu Cầu Phạm Vi Kiến Thức Cần Thực Hiện:</span>
              </label>
              <span className="text-[11px] text-slate-400 italic">Có thể chọn gợi ý bên dưới</span>
            </div>

            <textarea
              value={scopeText}
              onChange={(e) => setScopeText(e.target.value)}
              placeholder={actionMeta.placeholder}
              rows={3}
              className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all resize-none shadow-xs"
              autoFocus
            />
          </div>

          {/* Suggested Scope Chips */}
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500 mb-2 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <span>Gợi ý phạm vi nhanh (Bấm để điền):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {actionMeta.suggestedPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setScopeText(preset.replace(/^[^\w\s\u00C0-\u1EF9]+/, '').trim())}
                  className="px-3 py-2 rounded-xl text-left text-xs font-semibold bg-slate-50 hover:bg-indigo-50/70 border border-slate-200/80 hover:border-indigo-300 text-slate-700 hover:text-indigo-900 transition-all active:scale-98 flex items-center gap-1.5"
                >
                  <span className="truncate">{preset}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Quantity Controls for Slides / Quiz */}
          {(actionType === 'slides' || actionType === 'quiz') && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-900">
                  {actionType === 'slides' ? 'Số lượng Slide cần tạo:' : 'Số lượng câu trắc nghiệm:'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {actionType === 'slides'
                    ? 'Đề xuất từ 3 đến 8 slide cho bài giảng'
                    : 'Đề xuất từ 3 đến 10 câu cho bài kiểm tra nhanh'}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {[3, 5, 8, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setItemCount(num)}
                    className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${
                      itemCount === num
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all"
            >
              Hủy bỏ
            </button>

            <button
              type="submit"
              disabled={isProcessing}
              className={`px-5 py-2.5 rounded-xl text-white text-xs font-black flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer ${actionMeta.btnClass}`}
            >
              <Sparkles className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{isProcessing ? 'Đang thực hiện...' : 'Bắt Đầu Thực Hiện'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
