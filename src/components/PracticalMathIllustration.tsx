import React from 'react';
import { MathFormulaRenderer } from './MathFormulaRenderer';
import { Box, Sparkles, Compass } from 'lucide-react';

export type PracticalScenario =
  | 'box_folding'
  | 'cylinder_can'
  | 'parabola_arch'
  | 'boat_river'
  | 'water_gutter'
  | 'fence_plot'
  | 'cone_tank'
  | 'water_pool'
  | string;

export interface PracticalMathIllustrationProps {
  scenario?: PracticalScenario;
  title?: string;
  className?: string;
  isPresentationMode?: boolean;
}

/**
 * Tự động phân tích câu hỏi bài toán thực tế để nhận diện kịch bản minh họa
 */
export function detectPracticalScenario(text: string): PracticalScenario | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // 1. Cắt 4 góc tấm tôn gập hộp
  if (
    (lower.includes('tấm tôn') || lower.includes('tấm bìa') || lower.includes('miếng tôn')) &&
    (lower.includes('cắt') || lower.includes('gập') || lower.includes('bốn góc') || lower.includes('hộp không nắp'))
  ) {
    return 'box_folding';
  }

  // 2. Lon nước ngọt / hộp sữa hình trụ
  if (
    (lower.includes('lon nước') || lower.includes('hộp sữa') || lower.includes('vỏ lon') || lower.includes('thùng hình trụ')) &&
    (lower.includes('hình trụ') || lower.includes('thể tích') || lower.includes('tiết kiệm') || lower.includes('diện tích toàn phần'))
  ) {
    return 'cylinder_can';
  }

  // 3. Cổng vòm parabol / đường hầm parabol
  if (
    lower.includes('cổng') || lower.includes('vòm') || lower.includes('cửa hầm') || lower.includes('parabol')
  ) {
    if (lower.includes('parabol') || lower.includes('vòm') || lower.includes('cổng chào')) {
      return 'parabola_arch';
    }
  }

  // 4. Người chèo thuyền qua sông
  if (
    (lower.includes('chèo thuyền') || lower.includes('bờ sông') || lower.includes('qua sông') || lower.includes('dòng sông')) &&
    (lower.includes('bờ bên kia') || lower.includes('vận tốc') || lower.includes('thời gian ngắn nhất') || lower.includes('quãng đường'))
  ) {
    return 'boat_river';
  }

  // 5. Máng nước / máng xối
  if (
    lower.includes('máng nước') || lower.includes('máng xối') || lower.includes('máng dẫn nước') || lower.includes('hình thang cân')
  ) {
    return 'water_gutter';
  }

  // 6. Rào khu đất giáp bờ sông / bờ tường
  if (
    (lower.includes('rào') || lower.includes('hàng rào') || lower.includes('lưới rào')) &&
    (lower.includes('bờ sông') || lower.includes('bờ tường') || lower.includes('mảnh đất') || lower.includes('khu đất'))
  ) {
    return 'fence_plot';
  }

  // 7. Bồn nước hình nón / phễu hình nón
  if (
    (lower.includes('bồn') || lower.includes('thùng') || lower.includes('phễu') || lower.includes('chứa nước')) &&
    (lower.includes('hình nón') || lower.includes('khối nón'))
  ) {
    return 'cone_tank';
  }

  // 8. Xây bể bơi / bể nước hình hộp
  if (
    (lower.includes('bể bơi') || lower.includes('bể nước') || lower.includes('xây bể') || lower.includes('hồ chứa')) &&
    (lower.includes('hình hộp') || lower.includes('thể tích') || lower.includes('chi phí') || lower.includes('lát gạch'))
  ) {
    return 'water_pool';
  }

  return null;
}

export const PracticalMathIllustration: React.FC<PracticalMathIllustrationProps> = ({
  scenario = 'box_folding',
  title,
  className = '',
  isPresentationMode = false,
}) => {
  const svgW = isPresentationMode ? 520 : 440;
  const svgH = isPresentationMode ? 250 : 210;

  return (
    <div className={`w-full max-w-lg mx-auto bg-white rounded-2xl border-2 border-amber-300/90 shadow-md overflow-hidden select-none font-sans ${className}`}>
      {/* Tiêu đề thanh trên */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-amber-50 via-orange-50/50 to-amber-50 border-b border-amber-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-amber-500 text-white shadow-xs">
            <Compass className="w-3.5 h-3.5" />
          </span>
          <span className="text-xs font-bold text-slate-800 tracking-wide">
            {title || 'HÌNH VẼ MINH HỌA BÀI TOÁN THỰC TẾ'}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-300/80">
          Trực quan hóa SGK
        </span>
      </div>

      {/* Nội dung vẽ SVG minh họa theo từng kịch bản */}
      <div className="p-3 bg-white flex flex-col items-center justify-center">
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="overflow-visible bg-white"
        >
          {/* ========================================================= */}
          {/* 1. BÀI TOÁN CẮT 4 GÓC TẤM TÔN ĐỂ GẬP HỘP KHÔNG NẮP      */}
          {/* ========================================================= */}
          {scenario === 'box_folding' && (
            <g transform="translate(10, 10)">
              {/* Tấm tôn phẳng ban đầu bên trái */}
              <g transform="translate(15, 20)">
                {/* Khung tôn */}
                <rect x="0" y="0" width="160" height="110" fill="#f8fafc" stroke="#475569" strokeWidth="2" rx="2" />
                
                {/* 4 góc hình vuông cạnh x bị cắt bỏ (tô màu cam gạch chéo) */}
                <rect x="0" y="0" width="30" height="30" fill="#fee2e2" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="3 2" />
                <rect x="130" y="0" width="30" height="30" fill="#fee2e2" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="3 2" />
                <rect x="0" y="80" width="30" height="30" fill="#fee2e2" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="3 2" />
                <rect x="130" y="80" width="30" height="30" fill="#fee2e2" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="3 2" />

                {/* Các đường gấp nếp nét đứt */}
                <rect x="30" y="30" width="100" height="50" fill="#e2e8f0" fillOpacity="0.4" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="4 3" />

                {/* Nhãn kích thước x */}
                <text x="12" y="20" fontSize="12" fontWeight="bold" fill="#dc2626">x</text>
                <text x="142" y="20" fontSize="12" fontWeight="bold" fill="#dc2626">x</text>
                <text x="12" y="100" fontSize="12" fontWeight="bold" fill="#dc2626">x</text>
                <text x="142" y="100" fontSize="12" fontWeight="bold" fill="#dc2626">x</text>

                {/* Kích thước chiều dài a và chiều rộng b */}
                <line x1="0" y1="125" x2="160" y2="125" stroke="#475569" strokeWidth="1.2" />
                <text x="75" y="138" fontSize="11" fontWeight="bold" fill="#334155">dài = a</text>
                <line x1="-12" y1="0" x2="-12" y2="110" stroke="#475569" strokeWidth="1.2" />
                <text x="-25" y="60" fontSize="11" fontWeight="bold" fill="#334155" textAnchor="end">rộng = b</text>

                <text x="80" y="-8" fontSize="11" fontWeight="bold" fill="#0f172a" textAnchor="middle">
                  Tấm tôn phẳng (cắt 4 góc x)
                </text>
              </g>

              {/* Mũi tên gập hộp ở giữa */}
              <g transform="translate(195, 75)">
                <path d="M 0 0 C 15 -10, 25 -10, 35 0" fill="none" stroke="#2563eb" strokeWidth="2.5" />
                <polygon points="35,0 27,-6 30,2" fill="#2563eb" />
                <text x="18" y="18" fontSize="10" fontWeight="bold" fill="#2563eb" textAnchor="middle">Gập hộp</text>
              </g>

              {/* Chiếc hộp 3D hoàn chỉnh sau khi gập bên phải */}
              <g transform="translate(260, 30)">
                {/* Đáy hộp */}
                <polygon points="15,95 105,95 135,70 45,70" fill="#cbd5e1" stroke="#334155" strokeWidth="1.8" />
                {/* Mặt trước */}
                <polygon points="15,95 105,95 105,50 15,50" fill="#94a3b8" fillOpacity="0.5" stroke="#334155" strokeWidth="1.8" />
                {/* Mặt phải */}
                <polygon points="105,95 135,70 135,25 105,50" fill="#64748b" fillOpacity="0.6" stroke="#334155" strokeWidth="1.8" />
                {/* Mặt sau */}
                <line x1="45" y1="70" x2="45" y2="25" stroke="#475569" strokeWidth="1.5" strokeDasharray="3 2" />
                <line x1="45" y1="25" x2="135" y2="25" stroke="#334155" strokeWidth="1.8" />
                <line x1="15" y1="50" x2="45" y2="25" stroke="#334155" strokeWidth="1.8" />

                {/* Nhãn kích thước hộp */}
                <text x="5" y="75" fontSize="11" fontWeight="bold" fill="#dc2626">h = x</text>
                <text x="50" y="112" fontSize="10" fontWeight="bold" fill="#1e3a8a">a - 2x</text>
                <text x="125" y="88" fontSize="10" fontWeight="bold" fill="#1e3a8a">b - 2x</text>

                <text x="75" y="-18" fontSize="11" fontWeight="bold" fill="#0f172a" textAnchor="middle">
                  Hộp không nắp có V(x) max
                </text>
              </g>
            </g>
          )}

          {/* ========================================================= */}
          {/* 2. BÀI TOÁN LON NƯỚC NGỌT / HỘP SỮA HÌNH TRỤ              */}
          {/* ========================================================= */}
          {scenario === 'cylinder_can' && (
            <g transform="translate(30, 10)">
              {/* Chiếc lon hình trụ 3D bên trái */}
              <g transform="translate(60, 20)">
                <ellipse cx="60" cy="30" rx="55" ry="18" fill="#e2e8f0" stroke="#334155" strokeWidth="2" />
                <line x1="5" y1="30" x2="5" y2="135" stroke="#334155" strokeWidth="2" />
                <line x1="115" y1="30" x2="115" y2="135" stroke="#334155" strokeWidth="2" />
                {/* Đáy dưới elip */}
                <path d="M 5 135 A 55 18 0 0 0 115 135" fill="#cbd5e1" stroke="#334155" strokeWidth="2" />
                <path d="M 5 135 A 55 18 0 0 1 115 135" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3" />

                {/* Trục tâm và bán kính R */}
                <line x1="60" y1="30" x2="60" y2="135" stroke="#ea580c" strokeWidth="1.4" strokeDasharray="3 3" />
                <line x1="60" y1="30" x2="115" y2="30" stroke="#2563eb" strokeWidth="2" />
                <circle cx="60" cy="30" r="2.5" fill="#ea580c" />
                <text x="85" y="24" fontSize="11" fontWeight="bold" fill="#2563eb">R</text>

                {/* Nhãn chiều cao h */}
                <line x1="130" y1="30" x2="130" y2="135" stroke="#dc2626" strokeWidth="1.5" />
                <polygon points="130,30 127,37 133,37" fill="#dc2626" />
                <polygon points="130,135 127,128 133,128" fill="#dc2626" />
                <text x="142" y="87" fontSize="12" fontWeight="bold" fill="#dc2626">h</text>
              </g>

              {/* Thông số kỹ thuật & công thức bên phải */}
              <g transform="translate(230, 30)">
                <rect x="0" y="0" width="160" height="130" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" rx="8" />
                <text x="15" y="24" fontSize="11" fontWeight="bold" fill="#0f172a">Mục tiêu tối ưu:</text>
                <text x="15" y="48" fontSize="11" fill="#334155">• Thể tích: V = π·R²·h</text>
                <text x="15" y="72" fontSize="11" fill="#334155">• Diện tích toàn phần:</text>
                <text x="25" y="92" fontSize="11" fontWeight="bold" fill="#2563eb">S_tp = 2πR² + 2πRh</text>
                <text x="15" y="116" fontSize="11" fontWeight="bold" fill="#16a34a">➔ Đạt min khi h = 2R</text>
              </g>
            </g>
          )}

          {/* ========================================================= */}
          {/* 3. BÀI TOÁN CỔNG CHÀO / VÒM PARABOL                       */}
          {/* ========================================================= */}
          {scenario === 'parabola_arch' && (
            <g transform="translate(20, 10)">
              {/* Mặt đất */}
              <line x1="10" y1="150" x2="390" y2="150" stroke="#334155" strokeWidth="2.5" />
              <line x1="10" y1="152" x2="390" y2="152" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" />

              {/* Đường cong parabol cổng vòm */}
              <path
                d="M 50 150 Q 200 10 350 150"
                fill="#f1f5f9"
                fillOpacity="0.7"
                stroke="#2563eb"
                strokeWidth="3"
              />

              {/* Trục đối xứng ở giữa và chiều cao H */}
              <line x1="200" y1="45" x2="200" y2="150" stroke="#dc2626" strokeWidth="1.8" strokeDasharray="4 3" />
              <circle cx="200" cy="45" r="3" fill="#dc2626" />
              <text x="208" y="95" fontSize="12" fontWeight="bold" fill="#dc2626">H (đỉnh)</text>

              {/* Chiều rộng chân cổng W */}
              <line x1="50" y1="165" x2="350" y2="165" stroke="#475569" strokeWidth="1.2" />
              <polygon points="50,165 57,162 57,168" fill="#475569" />
              <polygon points="350,165 343,162 343,168" fill="#475569" />
              <text x="200" y="178" fontSize="11" fontWeight="bold" fill="#334155" textAnchor="middle">Chiều rộng chân cổng W</text>

              {/* Xe tải hoặc vật thể đi qua */}
              <rect x="155" y="95" width="90" height="55" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" rx="2" />
              <text x="200" y="125" fontSize="10" fontWeight="bold" fill="#854d0e" textAnchor="middle">Xe tải đi qua</text>
            </g>
          )}

          {/* ========================================================= */}
          {/* 4. BÀI TOÁN NGƯỜI CHÈO THUYỀN QUA SÔNG                    */}
          {/* ========================================================= */}
          {scenario === 'boat_river' && (
            <g transform="translate(15, 10)">
              {/* Dòng sông */}
              <rect x="10" y="30" width="380" height="90" fill="#e0f2fe" fillOpacity="0.8" />
              {/* Bờ trên và bờ dưới */}
              <line x1="10" y1="30" x2="390" y2="30" stroke="#0284c7" strokeWidth="2" />
              <line x1="10" y1="120" x2="390" y2="120" stroke="#0284c7" strokeWidth="2" />

              {/* Điểm A ở bờ trên */}
              <circle cx="50" cy="30" r="4" fill="#dc2626" />
              <text x="45" y="20" fontSize="12" fontWeight="bold" fill="#dc2626">A (Bắt đầu chèo)</text>

              {/* Chân đường vuông góc H */}
              <circle cx="50" cy="120" r="3" fill="#64748b" />
              <line x1="50" y1="30" x2="50" y2="120" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3 3" />
              <text x="35" y="135" fontSize="10" fill="#64748b">H</text>

              {/* Điểm đổ bộ M ở bờ dưới */}
              <circle cx="170" cy="120" r="4" fill="#ea580c" />
              <text x="165" y="135" fontSize="11" fontWeight="bold" fill="#ea580c">M (Đổ bộ)</text>

              {/* Điểm đích B ở bờ dưới */}
              <circle cx="340" cy="120" r="4" fill="#16a34a" />
              <text x="330" y="135" fontSize="12" fontWeight="bold" fill="#16a34a">B (Đích đến)</text>

              {/* Đường chèo thuyền AM */}
              <line x1="50" y1="30" x2="170" y2="120" stroke="#dc2626" strokeWidth="2.5" />
              <text x="95" y="70" fontSize="10" fontWeight="bold" fill="#dc2626">Chèo thuyền (v₁)</text>

              {/* Đường chạy bộ MB */}
              <line x1="170" y1="120" x2="340" y2="120" stroke="#16a34a" strokeWidth="3" />
              <text x="240" y="110" fontSize="10" fontWeight="bold" fill="#16a34a">Chạy bộ (v₂)</text>

              {/* Khoảng cách HM = x */}
              <line x1="50" y1="150" x2="170" y2="150" stroke="#ea580c" strokeWidth="1.2" />
              <text x="105" y="163" fontSize="11" fontWeight="bold" fill="#ea580c">HM = x</text>
            </g>
          )}

          {/* ========================================================= */}
          {/* 5. BÀI TOÁN MÁNG NƯỚC / MÁNG XỐI HÌNH THANG               */}
          {scenario === 'water_gutter' && (
            <g transform="translate(40, 20)">
              {/* Tiết diện máng nước hình thang cân */}
              <polygon points="50,40 110,130 210,130 270,40" fill="#f0f9ff" stroke="#334155" strokeWidth="2.5" />
              {/* Mực nước */}
              <polygon points="75,70 110,130 210,130 245,70" fill="#bae6fd" fillOpacity="0.8" />
              <line x1="75" y1="70" x2="245" y2="70" stroke="#0284c7" strokeWidth="1.5" strokeDasharray="3 2" />

              {/* Cạnh bên dài a */}
              <text x="65" y="90" fontSize="11" fontWeight="bold" fill="#dc2626">a</text>
              <text x="250" y="90" fontSize="11" fontWeight="bold" fill="#dc2626">a</text>
              {/* Đáy b */}
              <text x="155" y="148" fontSize="11" fontWeight="bold" fill="#2563eb">b (đáy)</text>
              {/* Góc uốn alpha */}
              <text x="125" y="115" fontSize="10" fontWeight="bold" fill="#ea580c">α</text>
              <text x="185" y="115" fontSize="10" fontWeight="bold" fill="#ea580c">α</text>

              <text x="160" y="20" fontSize="11" fontWeight="bold" fill="#0f172a" textAnchor="middle">
                Tiết diện máng nước để lưu lượng lớn nhất
              </text>
            </g>
          )}

          {/* ========================================================= */}
          {/* 6. BÀI TOÁN RÀO KHU ĐẤT GIÁP BỜ TƯỜNG / BỜ SÔNG           */}
          {scenario === 'fence_plot' && (
            <g transform="translate(30, 15)">
              {/* Bờ sông / Bờ tường thẳng dài */}
              <line x1="20" y1="30" x2="350" y2="30" stroke="#0369a1" strokeWidth="4" />
              <text x="180" y="20" fontSize="11" fontWeight="bold" fill="#0369a1" textAnchor="middle">
                Bờ sông thẳng (không cần rào)
              </text>

              {/* Hàng rào 3 cạnh bao quanh khu đất */}
              <line x1="60" y1="30" x2="60" y2="135" stroke="#dc2626" strokeWidth="2.5" strokeDasharray="6 3" />
              <line x1="60" y1="135" x2="300" y2="135" stroke="#dc2626" strokeWidth="2.5" strokeDasharray="6 3" />
              <line x1="300" y1="135" x2="300" y2="30" stroke="#dc2626" strokeWidth="2.5" strokeDasharray="6 3" />

              {/* Khu đất cỏ bên trong */}
              <rect x="60" y="30" width="240" height="105" fill="#f0fdf4" fillOpacity="0.7" />

              {/* Nhãn kích thước: 2 cạnh x và 1 cạnh y */}
              <text x="42" y="87" fontSize="12" fontWeight="bold" fill="#dc2626">x</text>
              <text x="310" y="87" fontSize="12" fontWeight="bold" fill="#dc2626">x</text>
              <text x="175" y="152" fontSize="12" fontWeight="bold" fill="#dc2626">y (dài)</text>

              <text x="180" y="85" fontSize="11" fontWeight="bold" fill="#15803d" textAnchor="middle">
                Diện tích S = x · y (max)
              </text>
            </g>
          )}

          {/* ========================================================= */}
          {/* 7. BÀI TOÁN BỒN CHỨA NƯỚC HÌNH NÓN                        */}
          {scenario === 'cone_tank' && (
            <g transform="translate(100, 10)">
              {/* Miệng bồn elip trên */}
              <ellipse cx="100" cy="30" rx="75" ry="16" fill="#f1f5f9" stroke="#334155" strokeWidth="2" />
              {/* Hai cạnh nón chúc xuống đỉnh S */}
              <line x1="25" y1="30" x2="100" y2="160" stroke="#334155" strokeWidth="2" />
              <line x1="175" y1="30" x2="100" y2="160" stroke="#334155" strokeWidth="2" />

              {/* Mực nước bên trong */}
              <ellipse cx="100" cy="95" rx="42" ry="9" fill="#bae6fd" stroke="#0284c7" strokeWidth="1.5" />
              <polygon points="58,95 100,160 142,95" fill="#bae6fd" fillOpacity="0.7" />

              {/* Trục chiều cao H và bán kính R */}
              <line x1="100" y1="30" x2="100" y2="160" stroke="#dc2626" strokeWidth="1.2" strokeDasharray="3 3" />
              <line x1="100" y1="30" x2="175" y2="30" stroke="#2563eb" strokeWidth="1.8" />
              <text x="135" y="24" fontSize="11" fontWeight="bold" fill="#2563eb">R</text>
              <text x="92" y="175" fontSize="11" fontWeight="bold" fill="#334155">S (đỉnh)</text>

              {/* Nhãn mực nước h và r */}
              <line x1="100" y1="95" x2="142" y2="95" stroke="#0369a1" strokeWidth="1.5" />
              <text x="118" y="90" fontSize="10" fontWeight="bold" fill="#0369a1">r</text>
              <text x="82" y="130" fontSize="10" fontWeight="bold" fill="#dc2626">h</text>
            </g>
          )}

          {/* ========================================================= */}
          {/* 8. BÀI TOÁN BỂ NƯỚC / BỂ BƠI HÌNH HỘP                     */}
          {scenario === 'water_pool' && (
            <g transform="translate(60, 20)">
              {/* Đáy bể */}
              <polygon points="30,110 160,110 210,75 80,75" fill="#bae6fd" stroke="#0284c7" strokeWidth="1.8" />
              {/* Thành bể trước */}
              <polygon points="30,110 160,110 160,50 30,50" fill="#93c5fd" fillOpacity="0.4" stroke="#334155" strokeWidth="1.8" />
              {/* Thành bể phải */}
              <polygon points="160,110 210,75 210,15 160,50" fill="#60a5fa" fillOpacity="0.5" stroke="#334155" strokeWidth="1.8" />
              {/* Thành bể sau và trái */}
              <line x1="80" y1="75" x2="80" y2="15" stroke="#94a3b8" strokeWidth="1.4" strokeDasharray="3 3" />
              <line x1="80" y1="15" x2="210" y2="15" stroke="#334155" strokeWidth="1.8" />
              <line x1="30" y1="50" x2="80" y2="15" stroke="#334155" strokeWidth="1.8" />

              {/* Kích thước */}
              <text x="85" y="128" fontSize="11" fontWeight="bold" fill="#1e3a8a">chiều dài x</text>
              <text x="195" y="100" fontSize="11" fontWeight="bold" fill="#1e3a8a">chiều rộng y</text>
              <text x="12" y="85" fontSize="11" fontWeight="bold" fill="#dc2626">h (sâu)</text>

              <text x="120" y="0" fontSize="11" fontWeight="bold" fill="#0f172a" textAnchor="middle">
                Bể chứa nước không nắp có V = x · y · h
              </text>
            </g>
          )}
        </svg>

        {/* Chú thích phía dưới */}
        <div className="mt-1 text-center text-xs font-medium text-amber-800 italic">
          Hình vẽ minh họa trực quan giúp học sinh thiết lập hàm số và giải toán
        </div>
      </div>
    </div>
  );
};
