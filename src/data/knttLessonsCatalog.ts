export interface KnttChapterGroup {
  chapter: string;
  lessons: string[];
}

export type KnttCurriculumMap = Record<string, Record<string, KnttChapterGroup[]>>;

export const KNTT_CURRICULUM_2018: KnttCurriculumMap = {
  'Toán học': {
    'Lớp 12': [
      {
        chapter: 'Chương I. Ứng dụng đạo hàm để khảo sát và vẽ đồ thị hàm số',
        lessons: [
          'Bài 1: Tính đơn điệu và cực trị của hàm số',
          'Bài 2: Giá trị lớn nhất và giá trị nhỏ nhất của hàm số',
          'Bài 3: Đường tiệm cận của đồ thị hàm số',
          'Bài 4: Khảo sát sự biến thiên và vẽ đồ thị của hàm số',
          'Bài 5: Ứng dụng đạo hàm để giải quyết một số vấn đề liên quan đến thực tiễn',
        ],
      },
      {
        chapter: 'Chương II. Vectơ và hệ trục tọa độ trong không gian',
        lessons: [
          'Bài 6: Vectơ trong không gian',
          'Bài 7: Hệ trục tọa độ trong không gian',
          'Bài 8: Biểu thức tọa độ của các phép toán vectơ',
        ],
      },
      {
        chapter: 'Chương III. Các số đặc trưng đo mức độ phân tán của mẫu số liệu ghép nhóm',
        lessons: [
          'Bài 9: Khoảng biến thiên và khoảng tứ phân vị',
          'Bài 10: Phương sai và độ lệch chuẩn',
        ],
      },
      {
        chapter: 'Chương IV. Nguyên hàm và tích phân',
        lessons: [
          'Bài 11: Nguyên hàm',
          'Bài 12: Tích phân',
          'Bài 13: Ứng dụng hình học của tích phân',
        ],
      },
      {
        chapter: 'Chương V. Phương pháp tọa độ trong không gian',
        lessons: [
          'Bài 14: Phương trình mặt phẳng',
          'Bài 15: Phương trình đường thẳng trong không gian',
          'Bài 16: Công thức tính góc trong không gian',
          'Bài 17: Phương trình mặt cầu',
        ],
      },
      {
        chapter: 'Chương VI. Xác suất có điều kiện',
        lessons: [
          'Bài 18: Xác suất có điều kiện',
          'Bài 19: Công thức xác suất toàn phần và công thức Bayes',
        ],
      },
    ],
    'Lớp 11': [
      {
        chapter: 'Chương I. Hàm số lượng giác và phương trình lượng giác',
        lessons: [
          'Bài 1: Giá trị lượng giác của góc lượng giác',
          'Bài 2: Công thức lượng giác',
          'Bài 3: Hàm số lượng giác',
          'Bài 4: Phương trình lượng giác cơ bản',
        ],
      },
      {
        chapter: 'Chương II. Dãy số. Cấp số cộng và cấp số nhân',
        lessons: [
          'Bài 5: Dãy số',
          'Bài 6: Cấp số cộng',
          'Bài 7: Cấp số nhân',
        ],
      },
      {
        chapter: 'Chương III & IV. Mẫu số liệu ghép nhóm & Quan hệ song song trong không gian',
        lessons: [
          'Bài 8: Mẫu số liệu ghép nhóm',
          'Bài 9: Các số đặc trưng đo xu thế trung tâm',
          'Bài 10: Đường thẳng và mặt phẳng trong không gian',
          'Bài 11: Hai đường thẳng song song',
          'Bài 12: Đường thẳng và mặt phẳng song song',
          'Bài 13: Hai mặt phẳng song song',
        ],
      },
      {
        chapter: 'Chương V & VI. Giới hạn. Hàm số mũ và hàm số lôgarit',
        lessons: [
          'Bài 15: Giới hạn của dãy số',
          'Bài 16: Giới hạn của hàm số',
          'Bài 17: Hàm số liên tục',
          'Bài 18: Lũy thừa với số mũ thực',
          'Bài 19: Lôgarit',
          'Bài 20: Hàm số mũ và hàm số lôgarit',
          'Bài 21: Phương trình, bất phương trình mũ và lôgarit',
        ],
      },
      {
        chapter: 'Chương VII, VIII & IX. Quan hệ vuông góc, Xác suất & Đạo hàm',
        lessons: [
          'Bài 22: Hai đường thẳng vuông góc',
          'Bài 23: Đường thẳng vuông góc với mặt phẳng',
          'Bài 25: Hai mặt phẳng vuông góc',
          'Bài 26: Khoảng cách',
          'Bài 27: Thể tích',
          'Bài 29 & 30: Công thức cộng xác suất & Công thức nhân xác suất cho hai biến cố độc lập',
          'Bài 31 & 32: Định nghĩa, ý nghĩa đạo hàm & Các quy tắc tính đạo hàm',
        ],
      },
    ],
    'Lớp 10': [
      {
        chapter: 'Chương I & II. Mệnh đề, Tập hợp & Bất phương trình bậc nhất hai ẩn',
        lessons: [
          'Bài 1: Mệnh đề',
          'Bài 2: Tập hợp và các phép toán trên tập hợp',
          'Bài 3: Bất phương trình bậc nhất hai ẩn',
          'Bài 4: Hệ bất phương trình bậc nhất hai ẩn',
        ],
      },
      {
        chapter: 'Chương III & IV. Hệ thức lượng & Vectơ',
        lessons: [
          'Bài 5: Giá trị lượng giác của một góc từ 0° đến 180°',
          'Bài 6: Hệ thức lượng trong tam giác',
          'Bài 8: Tổng và hiệu của hai vectơ',
          'Bài 9: Tích của một vectơ với một số',
          'Bài 10: Vectơ trong mặt phẳng tọa độ',
          'Bài 11: Tích vô hướng của hai vectơ',
        ],
      },
      {
        chapter: 'Chương VI & VII. Hàm số bậc hai & Phương pháp tọa độ trong mặt phẳng',
        lessons: [
          'Bài 15: Hàm số',
          'Bài 16: Hàm số bậc hai',
          'Bài 17: Dấu của tam thức bậc hai',
          'Bài 18: Phương trình quy về phương trình bậc hai',
          'Bài 19: Phương trình đường thẳng',
          'Bài 20: Vị trí tương đối giữa hai đường thẳng. Góc và khoảng cách',
          'Bài 21: Đường tròn trong mặt phẳng tọa độ',
          'Bài 22: Ba đường conic',
        ],
      },
      {
        chapter: 'Chương VIII & IX. Đại số tổ hợp & Xác suất',
        lessons: [
          'Bài 23: Quy tắc đếm',
          'Bài 24: Hoán vị, chỉnh hợp và tổ hợp',
          'Bài 25: Nhị thức Newton',
          'Bài 26 & 27: Biến cố và định nghĩa cổ điển của xác suất',
        ],
      },
    ],
    'Lớp 9': [
      {
        chapter: 'Đại số 9 (Kết nối tri thức)',
        lessons: [
          'Bài 1 & 2: Phương trình bậc nhất hai ẩn & Giải hệ hai phương trình bậc nhất hai ẩn',
          'Bài 3: Giải bài toán bằng cách lập hệ phương trình',
          'Bài 7: Căn bậc hai và căn thức bậc hai',
          'Bài 18 & 19: Hàm số y = ax² (a ≠ 0) & Phương trình bậc hai một ẩn',
          'Bài 20: Định lí Viète và ứng dụng',
          'Bài 21: Giải bài toán bằng cách lập phương trình',
        ],
      },
      {
        chapter: 'Hình học 9 (Kết nối tri thức)',
        lessons: [
          'Bài 11: Tỉ số lượng giác của góc nhọn',
          'Bài 12: Một số hệ thức giữa cạnh, góc trong tam giác vuông và ứng dụng',
          'Bài 16: Vị trí tương đối của đường thẳng và đường tròn',
          'Bài 28 & 29: Đường tròn ngoại tiếp và đường tròn nội tiếp; Tứ giác nội tiếp',
          'Bài 31 & 32: Hình trụ, Hình nón và Hình cầu',
        ],
      },
    ],
    'Lớp 8': [
      {
        chapter: 'Toán 8 (Kết nối tri thức)',
        lessons: [
          'Bài 6, 7, 8: Hiệu hai bình phương, bình phương một tổng/hiệu & Lập phương',
          'Bài 9: Phân tích đa thức thành nhân tử',
          'Bài 21 & 22: Phân thức đại số & Tính chất cơ bản của phân thức đại số',
          'Bài 25 & 26: Phương trình bậc nhất một ẩn & Giải bài toán bằng cách lập phương trình',
          'Bài 28 & 29: Hàm số bậc nhất và đồ thị của hàm số bậc nhất',
          'Bài 15 & 33: Định lí Thalès và Hai tam giác đồng dạng',
        ],
      },
    ],
    'Lớp 7': [
      {
        chapter: 'Toán 7 (Kết nối tri thức)',
        lessons: [
          'Bài 2 & 3: Cộng, trừ, nhân, chia & Lũy thừa với số mũ tự nhiên của số hữu tỉ',
          'Bài 20 & 21: Tỉ lệ thức & Tính chất của dãy tỉ số bằng nhau',
          'Bài 22 & 23: Đại lượng tỉ lệ thuận & Đại lượng tỉ lệ nghịch',
          'Bài 13, 14, 15: Hai tam giác bằng nhau & Trường hợp bằng nhau của tam giác',
        ],
      },
    ],
    'Lớp 6': [
      {
        chapter: 'Toán 6 (Kết nối tri thức)',
        lessons: [
          'Bài 11 & 12: Ước chung, Ước chung lớn nhất & Bội chung, Bội chung nhỏ nhất',
          'Bài 14, 15, 16: Phép cộng, trừ, nhân số nguyên & Quy tắc dấu ngoặc',
          'Bài 25 & 26: Phép cộng, trừ, nhân, chia phân số',
          'Bài 20: Chu vi và diện tích của một số tứ giác đã học',
        ],
      },
    ],
  },
  'Vật lý': {
    'Lớp 12': [
      {
        chapter: 'Vật lý 12 (Kết nối tri thức)',
        lessons: [
          'Bài 1 & 2: Cấu trúc của chất. Sự chuyển thể & Nội năng. Định luật I nhiệt động lực học',
          'Bài 6: Nhiệt hóa hơi riêng & Nhiệt nóng chảy riêng',
          'Bài 9 & 10: Định luật Boyle & Định luật Charles (Khí lí tưởng)',
          'Bài 11: Phương trình trạng thái của khí lí tưởng',
          'Bài 15 & 16: Lực từ tác dụng lên dây dẫn mang dòng điện & Từ thông. Cảm ứng điện từ',
          'Bài 17: Máy phát điện xoay chiều',
          'Bài 22 & 23: Phản ứng hạt nhân, năng lượng liên kết & Hiện tượng phóng xạ',
        ],
      },
    ],
    'Lớp 11': [
      {
        chapter: 'Vật lý 11 (Kết nối tri thức)',
        lessons: [
          'Bài 1 & 2: Dao động điều hòa & Mô tả dao động điều hòa',
          'Bài 3: Vận tốc, gia tốc trong dao động điều hòa',
          'Bài 5: Động năng. Thế năng. Sự chuyển hóa năng lượng trong dao động điều hòa',
          'Bài 8 & 9: Mô tả sóng & Sóng ngang. Sóng dọc. Sự truyền năng lượng của sóng cơ',
          'Bài 11 & 12: Sóng điện từ & Giao thoa sóng',
          'Bài 16 & 17: Lực tương tác giữa hai điện tích & Khái niệm điện trường',
          'Bài 22 & 24: Cường độ dòng điện & Nguồn điện. Suất điện động và định luật Ôm toàn mạch',
        ],
      },
    ],
    'Lớp 10': [
      {
        chapter: 'Vật lý 10 (Kết nối tri thức)',
        lessons: [
          'Bài 7: Đồ thị độ dịch chuyển - thời gian',
          'Bài 9 & 10: Chuyển động thẳng biến đổi đều & Sự rơi tự do',
          'Bài 12: Chuyển động ném',
          'Bài 14, 15, 16: Ba định luật Newton về chuyển động',
          'Bài 23 & 25: Năng lượng. Công cơ học & Động năng, thế năng. Định luật bảo toàn cơ năng',
          'Bài 28 & 29: Động lượng & Định luật bảo toàn động lượng',
        ],
      },
    ],
  },
  'Hóa học': {
    'Lớp 12': [
      {
        chapter: 'Hóa học 12 (Kết nối tri thức)',
        lessons: [
          'Bài 1: Ester - Lipid',
          'Bài 2: Xà phòng và chất giặt rửa',
          'Bài 4 & 5: Glucose và Fructose; Saccharose và Maltose; Tinh bột và Cellulose',
          'Bài 8 & 9: Amine; Amino acid và Peptide',
          'Bài 12 & 13: Đại cương về polymer & Vật liệu polymer',
          'Bài 15 & 16: Thế điện cực và nguồn điện hóa học & Điện phân',
          'Bài 18 & 19: Tính chất chung của kim loại & Phương pháp tách kim loại',
        ],
      },
    ],
    'Lớp 11': [
      {
        chapter: 'Hóa học 11 (Kết nối tri thức)',
        lessons: [
          'Bài 1: Khái niệm về cân bằng hóa học',
          'Bài 2: Cân bằng trong dung dịch nước (Thuyết Brønsted-Lowry, pH, chuẩn độ acid-base)',
          'Bài 4 & 5: Nitrogen & Ammonia. Muối ammonium',
          'Bài 7 & 8: Sulfur và sulfur dioxide & Sulfuric acid và muối sulfate',
          'Bài 15 & 16: Alkane & Hydrocarbon không no (Alkene, Alkyne)',
          'Bài 20 & 21: Alcohol & Phenol',
          'Bài 23 & 24: Hợp chất carbonyl & Carboxylic acid',
        ],
      },
    ],
    'Lớp 10': [
      {
        chapter: 'Hóa học 10 (Kết nối tri thức)',
        lessons: [
          'Bài 2 & 3: Thành phần của nguyên tử; Nguyên tố hóa học & Cấu trúc lớp vỏ electron',
          'Bài 5 & 6: Cấu tạo bảng tuần hoàn & Xu hướng biến đổi một số tính chất',
          'Bài 9 & 10: Liên kết ion & Liên kết cộng hóa trị',
          'Bài 15: Phản ứng oxi hóa - khử',
          'Bài 17: Biến thiên enthalpy trong các phản ứng hóa học',
          'Bài 19: Tốc độ phản ứng hóa học',
        ],
      },
    ],
  },
  'Sinh học': {
    'Lớp 12': [
      {
        chapter: 'Sinh học 12 (Kết nối tri thức)',
        lessons: [
          'Bài 1 & 2: DNA và cơ chế tái bản DNA; Gene, quá trình truyền đạt thông tin di truyền',
          'Bài 4: Hệ gene, đột biến gene và công nghệ gene',
          'Bài 7 & 8: Cấu trúc và chức năng của nhiễm sắc thể; Quy luật di truyền của Mendel',
          'Bài 9 & 10: Mở rộng học thuyết Mendel; Di truyền giới tính và liên kết gene',
          'Bài 14 & 15: Di truyền học quần thể',
        ],
      },
    ],
    'Lớp 11': [
      {
        chapter: 'Sinh học 11 (Kết nối tri thức)',
        lessons: [
          'Bài 2 & 3: Trao đổi nước và khoáng ở thực vật',
          'Bài 4: Quang hợp ở thực vật',
          'Bài 6: Hô hấp ở thực vật',
          'Bài 8 & 10: Dinh dưỡng, tiêu hóa và tuần hoàn ở động vật',
          'Bài 17 & 18: Cảm ứng ở động vật & Tập tính ở động vật',
        ],
      },
    ],
    'Lớp 10': [
      {
        chapter: 'Sinh học 10 (Kết nối tri thức)',
        lessons: [
          'Bài 5 & 6: Các phân tử sinh học trong tế bào',
          'Bài 8 & 9: Tế bào nhân sơ & Tế bào nhân thực',
          'Bài 11: Vận chuyển các chất qua màng sinh chất',
          'Bài 16 & 17: Chu kì tế bào, nguyên phân & Giảm phân',
        ],
      },
    ],
  },
  'Khoa học tự nhiên': {
    'Lớp 9': [
      {
        chapter: 'Khoa học tự nhiên 9 (Kết nối tri thức)',
        lessons: [
          'Bài 2 & 3: Động năng. Thế năng; Cơ năng; Công và công suất',
          'Bài 5 & 6: Khúc xạ ánh sáng & Phản xạ toàn phần',
          'Bài 11 & 12: Điện trở. Định luật Ohm & Đoạn mạch nối tiếp, song song',
          'Bài 20 & 22: Tính chất chung của kim loại & Alkane, Alkene',
          'Bài 36 & 37: Khái quát về di truyền học & Nucleic acid và ứng dụng',
        ],
      },
    ],
    'Lớp 8': [
      {
        chapter: 'Khoa học tự nhiên 8 (Kết nối tri thức)',
        lessons: [
          'Bài 2 & 3: Phản ứng hóa học & Mol và tỉ khối chất khí',
          'Bài 4: Dung dịch và nồng độ',
          'Bài 6: Tính theo phương trình hóa học',
          'Bài 13 & 15: Khối lượng riêng & Áp suất trên một bề mặt',
          'Bài 16 & 17: Áp suất chất lỏng. Áp suất khí quyển & Lực đẩy Archimedes',
        ],
      },
    ],
    'Lớp 7': [
      {
        chapter: 'Khoa học tự nhiên 7 (Kết nối tri thức)',
        lessons: [
          'Bài 8: Tốc độ chuyển động',
          'Bài 9 & 10: Đồ thị quãng đường - thời gian',
          'Bài 12 & 13: Sóng âm & Độ to và độ cao của âm',
          'Bài 15: Ánh sáng, tia sáng',
        ],
      },
    ],
    'Lớp 6': [
      {
        chapter: 'Khoa học tự nhiên 6 (Kết nối tri thức)',
        lessons: [
          'Bài 4, 5, 6: Đo chiều dài, đo khối lượng, đo thời gian',
          'Bài 15 & 16: Chất tinh khiết - Hỗn hợp & Một số phương pháp tách chất ra khỏi hỗn hợp',
          'Bài 40 & 41: Lực là gì? Biểu diễn lực',
        ],
      },
    ],
  },
};

export function getKnttLessonsForSubjectGrade(subject: string, grade: string): KnttChapterGroup[] {
  return KNTT_CURRICULUM_2018[subject]?.[grade] || [];
}
