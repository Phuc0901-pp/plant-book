const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, ShadingType } = require('docx');

async function generateAgTechBookDocx() {
  console.log('Đang tái tạo Sách Kỹ Thuật & R&D Tân Bảo AgTech bổ sung Phân Tích Nhược Điểm & Hướng Phát Triển (.docx)...');

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Arial',
            size: 23, // 11.5pt
            color: '1E293B',
          },
          paragraph: {
            spacing: { line: 280, before: 100, after: 100 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          // ── BÌA SÁCH (BOOK COVER) ──
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'TỔNG CÔNG TY NÔNG NGHIỆP CÔNG NGHỆ CAO TÂN BẢO\n', bold: true, size: 26, color: '047857' }),
              new TextRun({ text: 'VIỆN NGHIÊN CỨU VÀ PHÁT TRIỂN CÔNG NGHỆ NÔNG NGHIỆP SỐ (TANBAO R&D INSTITUTE)\n', bold: true, size: 18, color: '64748B' }),
            ],
            spacing: { before: 200, after: 150 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', color: '10B981' }),
            ],
            spacing: { after: 400 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'SÁCH KỸ THUẬT & NGHIÊN CỨU PHÁT TRIỂN SẢN PHẨM (R&D WHITEPAPER)\n', bold: true, size: 22, color: '059669', italics: true }),
              new TextRun({ text: 'KỶ NGUYÊN SỐ HÓA NÔNG NGHIỆP:\nHỆ THỐNG SỔ NÔNG ĐIỆN TỬ, BẢN ĐỒ GIS VÀ TRỢ LÝ AI AGTECH\n', bold: true, size: 34, color: '065F46' }),
              new TextRun({ text: '(THE DIGITAL AGTECH COMPENDIUM: ARCHITECTURE, OPERATION, LIMITATIONS & FUTURE R&D ROADMAP)\n', bold: true, size: 19, color: '475569', italics: true }),
            ],
            spacing: { before: 200, after: 400 },
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'TÁC GIẢ & HỘI ĐỒNG BIÊN SOẠN:\n', bold: true, size: 22, color: '047857' }),
              new TextRun({ text: 'Hội đồng Kiến trúc sư Hệ thống, Chuyên gia Phân tích Nghiệp vụ Nông nghiệp\nvà Ban Quản trị Vận hành Tân Bảo AgTech Corporation\n', size: 21 }),
            ],
            spacing: { after: 400 },
          }),

          // Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, shading: { fill: 'F0FDF4' }, children: [new Paragraph({ children: [new TextRun({ text: 'Mã Xuất Bản:', bold: true, color: '047857' })] })] }),
                  new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'ISBN-AGTECH-2026-TB', bold: true })] })] }),
                  new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, shading: { fill: 'F0FDF4' }, children: [new Paragraph({ children: [new TextRun({ text: 'Phiên Bản:', bold: true, color: '047857' })] })] }),
                  new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Tập 1 - Extended v1.1.2' })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ shading: { fill: 'F0FDF4' }, children: [new Paragraph({ children: [new TextRun({ text: 'Chủ Đề:', bold: true, color: '047857' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Chuyển Đổi Số Nông Nghiệp, AI, IoT, GIS' })] })] }),
                  new TableCell({ shading: { fill: 'F0FDF4' }, children: [new Paragraph({ children: [new TextRun({ text: 'Năm Xuất Bản:', bold: true, color: '047857' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Năm 2026' })] })] }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { after: 500 } }),

          // ══════════════════════════════════════════════════════════════
          // LỜI TỰA (PREFACE)
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'LỜI TỰA: CHUYỂN ĐỔI SỐ NÔNG NGHIỆP - TỪ KHÁT VỌNG ĐẾN THỰC THI', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 300, after: 150 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Nông nghiệp Việt Nam đang đứng trước bước ngoặt lịch sử: Chuyển đổi từ nền nông nghiệp kinh nghiệm truyền thống, dựa trên cảm tính sang nền nông nghiệp chính xác (Precision Agriculture), dựa trên dữ liệu và trí tuệ nhân tạo. Cuốn sách này là kết tinh của hàng ngàn giờ nghiên cứu thực địa tại các vùng chuyên canh sầu riêng, bưởi da xanh và cây ăn trái giá trị cao tại Đồng bằng sông Cửu Long và Tây Nguyên, kết hợp cùng các công nghệ phần mềm tiên tiến nhất của kỷ nguyên Web3 và Generative AI.\n' }),
            ],
          }),

          // ══════════════════════════════════════════════════════════════
          // CHƯƠNG 1
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'CHƯƠNG 1: Ý NGHĨA KINH TẾ - XÃ HỘI VÀ TẦM NHÌN SẢN PHẨM', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 300, after: 150 },
          }),
          new Paragraph({
            children: [new TextRun({ text: '1.1 Giải Quyết 4 Nỗi Đau Lớn Của Nông Nghiệp Truyền Thống', bold: true, size: 24, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '1. Đứt Gãy Dữ Liệu Thực Địa: Việc ghi sổ tay giấy dẫn đến 85% số liệu bị thất lạc, ghi bù sai lệch, không đáp ứng được yêu cầu thanh tra của các thị trường khó tính như EU, Mỹ, Nhật Bản.\n' }),
              new TextRun({ text: '2. Lãng Phí Chi Phí Phân Bón & Thuốc BVTV: Nông dân thường bón phân theo thói quen dư thừa từ 20-35%, vừa gây thoái hóa đất, vừa làm đội chi phí sản xuất.\n' }),
              new TextRun({ text: '3. Thiếu Hụt Chuyên Gia Kỹ Thuật Trực Tiếp: Tỷ lệ kỹ sư nông nghiệp trên số lượng nông hộ quá thấp khiến việc chẩn đoán dịch bệnh bị chậm trễ từ 3-5 ngày, dẫn đến thiệt hại kinh tế lớn.\n' }),
              new TextRun({ text: '4. Khó Khăn Trong Quản Trị Hợp Tác Xã: Ban quản trị không thể nắm bắt được tiến độ canh tác và chi phí của từng xã viên theo thời gian thực.' }),
            ],
          }),

          new Paragraph({
            children: [new TextRun({ text: '1.2 Giá Trị Kinh Tế Đo Lường Được (Measurable ROI)', bold: true, size: 24, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '• Tiết kiệm 20% - 30% chi phí phân bón và thuốc BVTV nhờ hệ thống hạch toán OCR và khuyến cáo liều lượng VietGAP.\n' }),
              new TextRun({ text: '• Tăng 15% - 25% giá trị nông sản xuất khẩu khi có mã QR truy xuất nguồn gốc số học gắn kèm lý lịch từng cây.\n' }),
              new TextRun({ text: '• Giảm 90% thời gian tổng hợp báo cáo mùa vụ cho Ban Giám đốc và cán bộ kiểm toán chất lượng.' }),
            ],
          }),

          new Paragraph({ spacing: { after: 300 } }),

          // ══════════════════════════════════════════════════════════════
          // CHƯƠNG 2
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'CHƯƠNG 2: KIẾN TRÚC KỸ THUẬT VÀ NỀN TẢNG CÔNG NGHỆ ĐỘT PHÁ', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 300, after: 150 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '2.1 Bản Đồ Số Không Gian GIS Mapbox (Spatial Digital Twin):\n', bold: true, color: '047857' }),
              new TextRun({ text: 'Số hóa từng thửa đất bằng ranh giới Polygon, gắn tọa độ GPS của từng gốc cây lên ảnh vệ tinh độ phân giải cao.\n\n' }),
              new TextRun({ text: '2.2 Định Danh Vật Lý - Số Hóa (Phygital NFC & QR Codes):\n', bold: true, color: '047857' }),
              new TextRun({ text: 'Gắn chip NFC và tem mã QR chống nước ngoài trời lên thân cây, biến mỗi gốc cây thành một thực thể số có lý lịch sinh trưởng riêng biệt.\n\n' }),
              new TextRun({ text: '2.3 Trợ Lý Trí Tuệ Nhân Tạo Bé Mầm & Bộ Điều Hướng Mô Hình Động:\n', bold: true, color: '047857' }),
              new TextRun({ text: 'Sử dụng Google Gemini AI kết hợp thuật toán phân luồng độ khó câu hỏi (Smart Dynamic Model Routing) và cô lập dữ liệu (Per-User Scoped Data Isolation), đảm bảo nông dân chỉ truy cập đúng trang trại của mình với tốc độ phản hồi <30ms.' }),
            ],
          }),

          new Paragraph({ spacing: { after: 300 } }),

          // ══════════════════════════════════════════════════════════════
          // CHƯƠNG 3
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'CHƯƠNG 3: CẨM NANG VẬN HÀNH VÀ HƯỚNG DẪN SỬ DỤNG TOÀN DIỆN', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 300, after: 150 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '3.1 Quy trình 4 bước bắt đầu cho Nông hộ:\n', bold: true, color: '047857' }),
              new TextRun({ text: '1. Khởi tạo Trang Trại Mới: Nhấn \"+ Khởi tạo Trang trại mới (GPS)\" để tự động lấy tọa độ vệ tinh và dự báo thời tiết 6 ngày.\n' }),
              new TextRun({ text: '2. Thêm Cây Trồng & Gán Mã: Nhập mã cây (VD: SR-001), chọn giống và định vị trên bản đồ GIS.\n' }),
              new TextRun({ text: '3. Ghi Nhật Ký 1-Chạm: Chạm vào Bé Mầm Ôm Nút Dấu Cộng (+) -> Chọn \"Ghi nhật ký chăm sóc\" để lưu việc tưới nước, bón phân, phun thuốc.\n' }),
              new TextRun({ text: '4. Quản Lý Kho & Chi Phí: Chụp ảnh quét OCR bao bì phân thuốc để AI tự động tính chi phí mùa vụ.\n\n' }),
              new TextRun({ text: '3.2 Quy trình dành cho Quản trị viên (Admin):\n', bold: true, color: '047857' }),
              new TextRun({ text: 'Quản trị viên sử dụng bản đồ vệ tinh toàn công ty để vẽ ranh giới lô đất, theo dõi cảm biến IoT đất thời gian thực, phê duyệt nông hộ 3 bước và xuất báo cáo VietGAP.' }),
            ],
          }),

          new Paragraph({ spacing: { after: 300 } }),

          // ══════════════════════════════════════════════════════════════
          // CHƯƠNG 4 (MỚI): PHÂN TÍCH NHƯỢC ĐIỂM & ĐIỂM NGHẼN HỆ THỐNG
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'CHƯƠNG 4: PHÂN TÍCH NHƯỢC ĐIỂM, RỦI RO & ĐIỂM NGHẼN KHI MỞ RỘNG (SYSTEM LIMITATIONS & BOTTLENECKS)', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 300, after: 150 },
          }),
          new Paragraph({
            children: [new TextRun({ text: '4.1 Nhược Điểm Về Mặt Kỹ Thuật & Hạ Tầng (Technical Constraints):', bold: true, size: 24, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '• Phụ Thuộc API Bên Thứ Ba & Chi Phí Token: Việc sử dụng Google Gemini và Mapbox Tiles khiến hệ thống phải chịu chi phí biến đổi khi số lượng nông hộ tăng vọt lên hàng trăm ngàn người.\n' }),
              new TextRun({ text: '• Sai Số GPS Dưới Tán Cây Dày: Tại các vườn sầu riêng cổ thụ hoặc vườn bưởi tán rậm, tín hiệu GPS dân dụng của smartphone có thể bị trôi sai số từ 5m - 15m, gây nhầm lẫn vị trí cây nếu không có chip NFC hỗ trợ.\n' }),
              new TextRun({ text: '• Độ Bền Vật Lý Của Thẻ NFC / Tem QR Thực Địa: Môi trường ngoài trời với nắng gắt, mưa axit và hóa chất BVTV có thể làm giảm tuổi thọ tem nhãn nếu không sử dụng vật liệu Composite cao cấp.\n' }),
              new TextRun({ text: '• Giới Hạn Bộ Nhớ Trình Duyệt Mobile: Bộ nhớ đệm IndexedDB trên một số dòng điện thoại Android giá rẻ có thể bị hệ điều hành tự động dọn dẹp (Storage Eviction) nếu điện thoại đầy bộ nhớ.' }),
            ],
          }),

          new Paragraph({
            children: [new TextRun({ text: '4.2 Nhược Điểm Về Mặt Hành Vi Nông Dân & Vận Hành (Adoption & Operational Constraints):', bold: true, size: 24, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '• Rào Cản Thói Quen & Tuổi Tác: Đại bộ phận chủ vườn lớn tuổi (50 - 65 tuổi) ngại gõ phím cảm ứng trên điện thoại khi tay đang dính bùn đất ngoài vườn.\n' }),
              new TextRun({ text: '• Tâm Lý E Ngại Chia Sẻ Dữ Liệu Tài Chính: Một số nông hộ còn e dè khi nhập giá mua vật tư hoặc năng suất thu hoạch vì sợ lộ bí quyết kinh doanh hoặc rủi ro thuế.\n' }),
              new TextRun({ text: '• Nguy Cơ Gian Lận Dữ Liệu Bù: Nông dân có thể quên ghi chép hàng ngày và ghi bù một lúc vào cuối tuần, làm giảm tính thời gian thực của dữ liệu VietGAP.' }),
            ],
          }),

          new Paragraph({ spacing: { after: 300 } }),

          // ══════════════════════════════════════════════════════════════
          // CHƯƠNG 5 (MỚI): CHIẾN LƯỢC KHẮC PHỤC & HƯỚNG PHÁT TRIỂN ĐỘT PHÁ
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'CHƯƠNG 5: CHIẾN LƯỢC KHẮC PHỤC VÀ HƯỚNG PHÁT TRIỂN ĐỘT PHÁ (STRATEGIC SOLUTIONS & FUTURE ROADMAP)', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 300, after: 150 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '🚀 1. Công Nghệ Trợ Lý Giọng Nói Tiếng Việt 1-Chạm (Voice AI Input Engine):\n', bold: true, color: '047857' }),
              new TextRun({ text: 'Giải quyết triệt để rào cản gõ phím của nông dân: Tích hợp mô hình nhận diện giọng nói tiếng Việt đa vùng miền (Miền Tây, Miền Trung, Tây Nguyên). Nông dân chỉ cần nhấn giữ nút Bé Mầm và nói: \"Hôm nay tưới 30 lít phân NPK 16-16-8 cho cây sầu riêng 01\" -> AI tự động bóc tách số liệu và lưu nhật ký ngay lập tức mà không cần chạm tay vào bàn phím!\n\n' }),
              new TextRun({ text: '🚀 2. Tự Chủ Hạ Tầng AI Bằng Mô Hình Ngôn Ngữ Riêng (Private Fine-Tuned LLM):\n', bold: true, color: '047857' }),
              new TextRun({ text: 'Để giảm 95% chi phí API thương mại khi quy mô đạt 500.000 nông hộ: Tân Bảo AgTech sẽ huấn luyện riêng một mô hình ngôn ngữ chuyên sâu về nông học Việt Nam (Agri-LLM) chạy trực tiếp trên cụm máy chủ nội bộ (On-Premises GPU Server).\n\n' }),
              new TextRun({ text: '🚀 3. Định Vị Vi Sai Độ Chính Xác Cao (RTK-GPS) & Thị Giác Máy Tính On-Device:\n', bold: true, color: '047857' }),
              new TextRun({ text: 'Khắc phục sai số dưới tán cây rậm rạp: Tích hợp trạm phát vi sai RTK thu nhỏ giúp hạ độ sai số GPS xuống dưới 20cm; Mô hình Computer Vision (TensorFlow Lite) nhận diện trực tiếp sâu bệnh qua camera với độ trễ <0.1 giây mà không cần internet.\n\n' }),
              new TextRun({ text: '🚀 4. Cơ Chế Gamification & Tích Điểm Thưởng Nông Hộ Chuẩn VietGAP:\n', bold: true, color: '047857' }),
              new TextRun({ text: 'Khắc phục việc quên ghi nhật ký: Hệ thống tích hợp cơ chế \"Nông hộ kim cương\": Ghi nhật ký đúng giờ được tặng điểm thưởng đổi lấy phân bón miễn phí hoặc được ưu đãi lãi suất vay vốn ngân hàng liên kết.\n\n' }),
              new TextRun({ text: '🚀 5. Sàn Giao Dịch Nông Sản B2B & Chuỗi Cung Ứng Khép Kín (From Farm To Fork):\n', bold: true, color: '047857' }),
              new TextRun({ text: 'Kết nối trực tiếp nông hộ có chứng nhận số hóa với các doanh nghiệp thu mua xuất khẩu uy tín, cắt bỏ tầng lớp thương lái trung gian, đảm bảo bao tiêu đầu ra với giá cao hơn 15-20% thị trường.' }),
            ],
          }),

          new Paragraph({ spacing: { after: 300 } }),

          // ══════════════════════════════════════════════════════════════
          // CHƯƠNG 6: MÔ HÌNH KINH DOANH & THƯƠNG MẠI HÓA
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'CHƯƠNG 6: MÔ HÌNH KINH DOANH VÀ CHIẾN LƯỢC THƯƠNG MẠI HÓA', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 300, after: 150 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '• Gói Miễn Phí (Freemium): Dành cho nông hộ nhỏ lẻ (< 100 cây) sử dụng miễn phí các tính năng ghi chép cơ bản và trợ lý AI Bé Mầm.\n' }),
              new TextRun({ text: '• Gói Chuyên Nghiệp (Nông Hộ PRO): Dành cho các chủ trang trại lớn (500 - 5.000 cây) với các tính năng: Quét OCR không giới hạn, bản đồ GIS chuyên sâu, dự báo thời tiết vi khí hậu chuyên dụng.\n' }),
              new TextRun({ text: '• Gói Doanh Nghiệp (Enterprise SaaS): Dành cho các Tập đoàn nông nghiệp, Hợp tác xã và Nhà máy chế biến quản lý hàng ngàn hộ liên kết, kiểm toán chi phí và cấp chứng chỉ VietGAP/GlobalGAP số hóa.' }),
            ],
          }),

          new Paragraph({ spacing: { after: 400 } }),

          // ── KÝ TÊN DUYỆT ──
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: 'BAN BIÊN TẬP VÀ HỘI ĐỒNG KỸ THUẬT AGTECH\n', bold: true, color: '065F46' }),
              new TextRun({ text: '(Ký tên, phê duyệt xuất bản và lưu hành nội bộ/thương mại)\n\n\n\n', italics: true }),
              new TextRun({ text: 'TÂN BẢO AGTECH CORPORATION © 2026', bold: true, color: '047857' }),
            ],
            spacing: { before: 400 },
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(__dirname, '../../SACH_KY_THUAT_NGHIEN_CUU_VA_PHAT_TRIEN_TANBAO_AGTECH.docx');
  fs.writeFileSync(outPath, buffer);
  console.log('✅ ĐÃ XUẤT BẢN THÀNH CÔNG SÁCH KỸ THUẬT WORD BỔ SUNG NHƯỢC ĐIỂM & HƯỚNG PHÁT TRIỂN TẠI:\n', outPath);
}

generateAgTechBookDocx().catch(console.error);
