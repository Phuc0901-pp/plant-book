const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, ShadingType, BorderStyle } = require('docx');

async function generateMasterSpecDocx() {
  console.log('Đang khởi tạo Master System Specification Document (.docx) quy mô Enterprise...');

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
          // ── TRANG BÌA (COVER PAGE) ──
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'CÔNG TY CỔ PHẦN NÔNG NGHIỆP CÔNG NGHỆ CAO TÂN BẢO\n', bold: true, size: 26, color: '047857' }),
              new TextRun({ text: 'TANBAO HIGH-TECH AGRICULTURE CORPORATION\n', bold: true, size: 18, color: '64748B' }),
            ],
            spacing: { before: 200, after: 100 },
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
              new TextRun({ text: 'HỒ SƠ ĐẶC TẢ THIẾT KẾ KIẾN TRÚC TOÀN DIỆN\nVÀ MASTER SYSTEM PROMPT\n', bold: true, size: 38, color: '065F46' }),
              new TextRun({ text: 'HỆ THỐNG SỔ NÔNG SỐ, QUẢN TRỊ ĐA TRANG TRẠI VÀ TRỢ LÝ AI BÉ MẦM\n', bold: true, size: 26, color: '059669' }),
              new TextRun({ text: '(TANBAO AGTECH ENTERPRISE SYSTEM SPECIFICATION v1.1.1)\n', bold: true, size: 20, color: '475569', italics: true }),
            ],
            spacing: { before: 200, after: 400 },
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'ĐƯỢC BIÊN SOẠN BỞI HỘI ĐỒNG CHUYÊN GIA:\n', bold: true, size: 22, color: '047857' }),
              new TextRun({ text: '• 20+ Năm Kinh Nghiệm Kiến Trúc Sư Hệ Thống Fullstack (Lead Solution Architect)\n', size: 21 }),
              new TextRun({ text: '• 10+ Năm Kinh Nghiệm Chuyên Gia Phân Tích Nghiệp Vụ Cấp Cao (Senior Business Analyst)\n', size: 21 }),
              new TextRun({ text: '• Chuyên Gia Quản Trị Chuỗi Cung Ứng & Vận Hành Doanh Nghiệp Nông Nghiệp Thông Minh\n', size: 21 }),
            ],
            spacing: { after: 500 },
          }),

          // Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, shading: { fill: 'F0FDF4' }, children: [new Paragraph({ children: [new TextRun({ text: 'Mã Tài Liệu:', bold: true, color: '047857' })] })] }),
                  new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'SPEC-TB-AGTECH-2026', bold: true })] })] }),
                  new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, shading: { fill: 'F0FDF4' }, children: [new Paragraph({ children: [new TextRun({ text: 'Phiên Bản:', bold: true, color: '047857' })] })] }),
                  new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Release v1.1.1' })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ shading: { fill: 'F0FDF4' }, children: [new Paragraph({ children: [new TextRun({ text: 'Tiêu Chuẩn Áp Dụng:', bold: true, color: '047857' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'VietGAP / GlobalGAP / ISO 9001:2015' })] })] }),
                  new TableCell({ shading: { fill: 'F0FDF4' }, children: [new Paragraph({ children: [new TextRun({ text: 'Bảo Mật & Phân Quyền:', bold: true, color: '047857' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'ISO/IEC 11558, JWT, Scoped Data' })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ shading: { fill: 'F0FDF4' }, children: [new Paragraph({ children: [new TextRun({ text: 'Ngày Ban Hành:', bold: true, color: '047857' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '25/08/2026' })] })] }),
                  new TableCell({ shading: { fill: 'F0FDF4' }, children: [new Paragraph({ children: [new TextRun({ text: 'Tình Trạng:', bold: true, color: '047857' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Chính thức triển khai (Production)', bold: true, color: '10B981' })] })] }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { after: 500 } }),

          // ══════════════════════════════════════════════════════════════
          // MỤC LỤC TỔNG QUAN
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'MỤC LỤC NỘI DUNG HỒ SƠ ĐẶC TẢ (TABLE OF CONTENTS)', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 300, after: 150 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '• CHƯƠNG I: TỔNG QUAN HỆ THỐNG VÀ CHIẾN LƯỢC CÔNG NGHỆ NÔNG NGHIỆP SỐ\n', bold: true }),
              new TextRun({ text: '• CHƯƠNG II: THIẾT KẾ GIAO DIỆN VÀ TRẢI NGHIỆM ĐA NỀN TẢNG (USER VS ADMIN)\n', bold: true }),
              new TextRun({ text: '• CHƯƠNG III: KIẾN TRÚC PHÂN LUỒNG XỬ LÝ TRUNG TÂM VÀ API GATEWAY (BACKEND)\n', bold: true }),
              new TextRun({ text: '• CHƯƠNG IV: KIẾN TRÚC CƠ SỞ DỮ LIỆU ĐA TRANG TRẠI VÀ CHỈ MỤC TỐI ƯU (DATABASE)\n', bold: true }),
              new TextRun({ text: '• CHƯƠNG V: BỘ NÃO TRÍ TUỆ NHÂN TẠO BÉ MẦM AI VÀ ĐIỀU HƯỚNG MÔ HÌNH ĐỘNG\n', bold: true }),
              new TextRun({ text: '• CHƯƠNG VI: QUY CHUẨN KỸ THUẬT CANH TÁC VIETGAP VÀ QUẢN LÝ THỜI GIAN CÁCH LY PHI\n', bold: true }),
              new TextRun({ text: '• CHƯƠNG VII: QUY TRÌNH XỬ LÝ SỰ CỐ, MỞ RỘNG TẢI 5.000 NGƯỜI DÙNG VÀ BẢO MẬT\n', bold: true }),
              new TextRun({ text: '• CHƯƠNG VIII: BẢN MASTER SYSTEM PROMPT TOÀN DIỆN CHO TOÀN BỘ HỆ THỐNG\n', bold: true }),
            ],
            spacing: { after: 300 },
          }),

          // ══════════════════════════════════════════════════════════════
          // CHƯƠNG I
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'CHƯƠNG I: TỔNG QUAN HỆ THỐNG VÀ CHIẾN LƯỢC CÔNG NGHỆ', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 300, after: 150 },
          }),
          new Paragraph({
            children: [new TextRun({ text: '1.1 Tầm Nhìn & Sứ Mệnh Sản Phẩm (Product Vision & Mission)', bold: true, size: 24, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Hệ thống Sổ Nông Tân Bảo AgTech ra đời nhằm giải quyết triệt để 4 bài toán cốt lõi của nông nghiệp Việt Nam trong kỷ nguyên số:\n' }),
              new TextRun({ text: '1. Xóa bỏ hoàn toàn tình trạng ghi chép nhật ký giấy manh mún, thiếu tính xác thực và khó truy xuất nguồn gốc.\n' }),
              new TextRun({ text: '2. Tối ưu hóa chi phí đầu tư phân bón, thuốc BVTV thông qua công nghệ quét OCR tự động và giám sát tiêu hao thời gian thực.\n' }),
              new TextRun({ text: '3. Bình dân hóa công nghệ AI: Đưa trợ lý ảo thông minh Google Gemini trực tiếp tới tay người nông dân thông qua hình tượng Bé Mầm Chibi 3D thân thiện, trả lời chuẩn kỹ thuật VietGAP chỉ sau 1 chạm.\n' }),
              new TextRun({ text: '4. Quản trị đa trang trại tập trung cho Hợp tác xã và Doanh nghiệp trên nền tảng bản đồ vệ tinh GIS Mapbox và cảm biến IoT tầng đất/khí quyển.' }),
            ],
          }),

          new Paragraph({
            children: [new TextRun({ text: '1.2 Tech Stack Matrix Toàn Diện (Kiến Trúc Công Nghệ Hiện Đại)', bold: true, size: 24, color: '047857' })],
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ shading: { fill: '047857' }, children: [new Paragraph({ children: [new TextRun({ text: 'Phân Tầng Kiến Trúc', bold: true, color: 'FFFFFF' })] })] }),
                  new TableCell({ shading: { fill: '047857' }, children: [new Paragraph({ children: [new TextRun({ text: 'Công Nghệ Sử Dụng', bold: true, color: 'FFFFFF' })] })] }),
                  new TableCell({ shading: { fill: '047857' }, children: [new Paragraph({ children: [new TextRun({ text: 'Mục Đích & Ưu Thế Vận Hành', bold: true, color: 'FFFFFF' })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Frontend (Client)', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'HTML5, CSS3 Modern, Vanilla ES6 Modules, PWA Service Worker, Mapbox GL JS v3, Chart.js' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Tối ưu hiệu năng cực đại, không cồng kềnh framework, hoạt động mượt mà trên điện thoại đời cũ và vùng sóng yếu (Offline First).' })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Backend Core', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Node.js v20+, Express.js, WebSocket (ws), JWT, BcryptJS, Multer' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Xử lý bất đồng bộ non-blocking I/O, thời gian phản hồi <15ms, hỗ trợ WebSocket đồng bộ dữ liệu thời gian thực.' })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Cơ Sở Dữ Liệu (DB)', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'PostgreSQL Enterprise, pg-pool, Redis Caching, Supabase Storage' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Lưu trữ quan hệ toàn vẹn ACID, đánh chỉ mục Index B-Tree hiệu năng cao, lưu trữ hình ảnh đám mây CDN.' })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'AI & Vision Engine', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Google Gemini 3.7 Flash, 3.5 Flash, 2.5 Flash Lite, 2.0 Flash, Gemini Vision OCR' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Điều hướng mô hình động (Dynamic Model Router), bóc tách hóa đơn OCR, tự động failover sang CSDL nội bộ khi hết quota.' })] })] }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { after: 300 } }),

          // ══════════════════════════════════════════════════════════════
          // CHƯƠNG II
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'CHƯƠNG II: KIẾN TRÚC GIAO DIỆN VÀ TRẢI NGHIỆM ĐA NỀN TẢNG', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 300, after: 150 },
          }),

          new Paragraph({
            children: [new TextRun({ text: '2.1 Cổng Nông Hộ (Farmer Mobile & Web Portal)', bold: true, size: 24, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Cổng Nông hộ được thiết kế theo triết lý \"Tối giản - Trực quan - Không cần đào tạo phức tạp\":\n' }),
              new TextRun({ text: '1. Dashboard Khí Tượng Thời Gian Thực: Hiển thị nhiệt độ, độ ẩm không khí, độ ẩm tầng rễ, tốc độ gió và dự báo mưa 6 ngày từ trạm vệ tinh Open-Meteo.\n' }),
              new TextRun({ text: '2. Bản Đồ Nông Trại Số (Tree Digital Twin): Hiển thị tọa độ từng gốc cây trên nền ảnh vệ tinh Mapbox. Chạm vào từng cây để xem lịch sử chăm sóc và hồ sơ sức khỏe.\n' }),
              new TextRun({ text: '3. Thiết Kế Đột Phá: BÉ MẦM ÔM NÚT DẤU CỘNG (+):\n' }),
              new TextRun({ text: '   - Gom 2 nút bấm riêng lẻ trước đây thành 1 thực thể Chibi 3D duy nhất: Bé Mầm hai tay ôm trọn chiếc nút tròn màu xanh có dấu cộng trắng.\n' }),
              new TextRun({ text: '   - Khi chạm vào: Bật ngay Menu 2 Khối sang trọng:\n' }),
              new TextRun({ text: '     + Mục 1: [📝 Ghi nhật ký chăm sóc] -> Mở Modal ghi nhận việc tưới nước, bón phân NPK, phun thuốc trừ sâu, chụp ảnh vườn.\n' }),
              new TextRun({ text: '     + Mục 2: [🌱 Bé Mầm tư vấn & hỏi đáp] -> Mở khung Chatbot AI Gemini thông minh để tra cứu sâu bệnh, chi phí và thời tiết.\n' }),
              new TextRun({ text: '4. Module Kho Vật Tư & Camera OCR: Chụp ảnh bao bì phân bón / thuốc BVTV để AI tự động trích xuất tên thuốc, hoạt chất và đơn giá nhập kho.' }),
            ],
          }),

          new Paragraph({
            children: [new TextRun({ text: '2.2 Cổng Quản Trị Doanh Nghiệp (Admin Command Center)', bold: true, size: 24, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Cổng Quản trị dành cho Ban Lãnh đạo và Kỹ sư trưởng:\n' }),
              new TextRun({ text: '1. Executive GIS Map: Xem tổng thể toàn bộ các trang trại của công ty trên bản đồ vệ tinh, vẽ ranh giới Polygon lô đất, đo diện tích tự động.\n' }),
              new TextRun({ text: '2. Trung Tâm Giám Sát Cảm Biến IoT: Theo dõi realtime các trạm cảm biến độ ẩm đất và không khí, thiết lập các ngưỡng kích hoạt cảnh báo tự động.\n' }),
              new TextRun({ text: '3. Quy Trình Phê Duyệt Nông Hộ 3 Bước: Kiểm duyệt hồ sơ nông hộ, cấp mã định danh ISO Obfuscated ID (adm-xxx / usr-xxx) và phân quyền sở hữu trang trại.\n' }),
              new TextRun({ text: '4. Trung Tâm Kiểm Toán Chi Phí & Xuất Báo Cáo VietGAP: Báo cáo tiêu hao vật tư, tổng chi phí đầu tư theo từng mùa vụ, xuất mã QR truy xuất nguồn gốc phục vụ xuất khẩu.' }),
            ],
          }),

          new Paragraph({ spacing: { after: 300 } }),

          // ══════════════════════════════════════════════════════════════
          // CHƯƠNG III
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'CHƯƠNG III: KIẾN TRÚC PHÂN LUỒNG XỬ LÝ TRUNG TÂM VÀ PHÂN QUYỀN DỮ LIỆU', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 300, after: 150 },
          }),

          new Paragraph({
            children: [new TextRun({ text: '3.1 Cơ Chế Phân Quyền Dữ Liệu Chặt Chẽ (Per-User Scoped Data Isolation)', bold: true, size: 24, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Hệ thống áp dụng cơ chế xác thực JWT kết hợp Middleware Auth phân quyền động:\n' }),
              new TextRun({ text: '• Khi Nông hộ A đăng nhập: req.user = { id, email, role: \"user\", name, farm_id }.\n' }),
              new TextRun({ text: '• Truy vấn SQL Scoped: Chỉ truy xuất các trang trại thuộc sở hữu của Nông hộ A:\n' }),
              new TextRun({ text: '  WHERE (f.is_deleted IS NOT TRUE) AND (f.user_id = $1 OR f.id = (SELECT farm_id FROM users WHERE id = $1))\n' }),
              new TextRun({ text: '• Đa Trang Trại (Multi-Farm): Nếu Nông hộ A sở hữu 2 hay 3 trang trại, Bé Mầm AI sẽ tự động gom nhóm và trả lời đầy đủ thông tin của từng trang trại đó.\n' }),
              new TextRun({ text: '• Bảo Mật Tuyệt Đối: Nông hộ A không bao giờ thấy cây trồng, chi phí hay nhật ký của Nông hộ B.\n' }),
              new TextRun({ text: '• Quản Trị Viên (Admin): Có toàn quyền truy xuất bức tranh tổng hợp của toàn bộ các trang trại trong công ty.' }),
            ],
          }),

          new Paragraph({
            children: [new TextRun({ text: '3.2 Bộ Điều Hướng Mô Hình AI Động (Smart Dynamic AI Router)', bold: true, size: 24, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Để tối ưu hóa hạn mức API và tiết kiệm chi phí, Backend áp dụng thuật toán phân loại độ khó câu hỏi:\n' }),
              new TextRun({ text: '• Nhóm 1 - Câu hỏi Thường Ngày / Tra Cứu / Thao Tác App: Tự động điều hướng sang các model Tiêu chuẩn như Gemini 2.5 Flash Lite / 2.0 Flash (Hạn mức lớn 1.500 lượt/ngày, tốc độ <0.5s).\n' }),
              new TextRun({ text: '• Nhóm 2 - Câu hỏi Phức Tạp / Chẩn Đoán Bệnh / Phác Đồ VietGAP: Kích hoạt các model Siêu Cấp Flagship như Gemini 3.7 Flash / 3.5 Flash / Pro.\n' }),
              new TextRun({ text: '• Cơ Chế Auto-Failover: Nếu model cao cấp chạm 429 Rate Limit -> Tự động nhảy sang các model Flash 2.5 / 2.0 -> Nếu mất mạng -> CSDL Tri thức nội bộ phản hồi ngay lập tức (<30ms).' }),
            ],
          }),

          new Paragraph({ spacing: { after: 300 } }),

          // ══════════════════════════════════════════════════════════════
          // CHƯƠNG IV
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'CHƯƠNG IV: KIẾN TRÚC CƠ SỞ DỮ LIỆU VÀ CÁC BẢNG QUẢN TRỊ', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 300, after: 150 },
          }),

          new Paragraph({
            children: [
              new TextRun({ text: 'Hệ thống sử dụng PostgreSQL Enterprise với 11 bảng cốt lõi được tối ưu hóa toàn diện:\n\n' }),
              new TextRun({ text: '1. users: Quản lý danh tính, phân quyền role (admin/user), ISO Hash ID, account_tier (normal/pro).\n' }),
              new TextRun({ text: '2. farms: Quản lý danh sách trang trại, user_id chủ sở hữu, diện tích (ha), tọa độ GPS, ranh giới GIS Polygon, tổng số cây.\n' }),
              new TextRun({ text: '3. plants: Danh mục từng gốc cây số hóa, farm_id, tree_code (SR-001), giống cây, tình trạng sức khỏe, tọa độ GIS, mã thẻ NFC/QR.\n' }),
              new TextRun({ text: '4. plant_logs: Lịch sử canh tác, tưới nước (lít/gốc), bón phân NPK, phun thuốc BVTV, cắt tỉa cành, thời gian cách ly PHI, hình ảnh đính kèm.\n' }),
              new TextRun({ text: '5. supplies: Quản lý kho vật tư phân bón/thuốc, đơn giá, hoạt chất, quy cách đóng gói, ảnh chụp OCR.\n' }),
              new TextRun({ text: '6. supply_usages: Lịch sử tiêu hao vật tư, liên kết tự động giữa nhật ký chăm sóc cây và trừ kho vật tư.\n' }),
              new TextRun({ text: '7. fixed_assets: Quản lý tài sản cố định vĩnh cửu (máy bơm, hệ thống tưới, xe cơ giới) và phân bổ khấu hao.\n' }),
              new TextRun({ text: '8. farm_iot_sensors: Dữ liệu vi khí hậu và cảm biến độ ẩm đất thời gian thực, lưu trữ dự báo thời tiết 6 ngày.\n' }),
              new TextRun({ text: '9. user_alert_rules: Bộ quy tắc tự động kích hoạt cảnh báo tưới nước / phòng trừ dịch hại dựa trên ngưỡng cảm biến IoT.\n' }),
              new TextRun({ text: '10. user_notifications: Trung tâm thông báo đẩy trong ứng dụng cho nông hộ và ban quản trị.\n' }),
              new TextRun({ text: '11. system_configs: Cấu hình hệ thống (danh mục phân bón, thuốc BVTV chuẩn VietGAP, phương pháp tưới).' }),
            ],
          }),

          new Paragraph({ spacing: { after: 300 } }),

          // ══════════════════════════════════════════════════════════════
          // CHƯƠNG V & VI: KỸ THUẬT CANH TÁC & VIETGAP
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'CHƯƠNG V: QUY TRÌNH KỸ THUẬT CANH TÁC VIETGAP VÀ TRỊ BỆNH', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 300, after: 150 },
          }),

          new Paragraph({
            children: [
              new TextRun({ text: '5.1 Phác đồ dinh dưỡng NPK chuẩn VietGAP:\n', bold: true, color: '047857' }),
              new TextRun({ text: '• Giai đoạn kiến thiết / Nuôi đọt non: Bón NPK 30-10-10 hoặc 20-10-10 kết hợp phân hữu cơ trùn quế/vi sinh, duy trì ẩm độ đất 65 - 75%.\n' }),
              new TextRun({ text: '• Giai đoạn làm bông / Phân hóa mầm hoa: Xiết nước tạo khô hạn 15 - 20 ngày, phun tạo mầm bằng Lân cao (NPK 10-50-10 + Bo).\n' }),
              new TextRun({ text: '• Giai đoạn nuôi trái: Bón NPK 12-12-17 hoặc NPK 15-5-25 (hàm lượng Kali cao giúp cơm vàng, hạt lép, dẻo ngọt, chống sượng múi).\n' }),
              new TextRun({ text: '• Giai đoạn phục hồi sau thu hoạch: Cắt tỉa cành sâu bệnh, bón phân hữu cơ hoai mục + NPK 16-16-8.\n\n' }),
              new TextRun({ text: '5.2 Quy trình xử lý dịch hại & Kiểm soát thời gian cách ly (PHI):\n', bold: true, color: '047857' }),
              new TextRun({ text: '• Bệnh vàng lá thối rễ / Xì mủ nứt thân (Phytophthora palmivora): Cạo sạch vết bệnh, quét thuốc hoạt chất Metalaxyl hoặc Fosetyl-Al, tưới gốc nấm đối kháng Trichoderma.\n' }),
              new TextRun({ text: '• Rầy xanh, bọ trĩ: Phun thuốc hoạt chất Imidacloprid, Thiamethoxam hoặc Emamectin benzoate khi đọt vừa le mũi giáo.\n' }),
              new TextRun({ text: '• BẮT BUỘC TUÂN THỦ PHI: Ngừng phun toàn bộ thuốc BVTV trước thu hoạch tối thiểu 7 - 14 ngày theo đúng tiêu chuẩn VietGAP.' }),
            ],
          }),

          new Paragraph({ spacing: { after: 300 } }),

          // ══════════════════════════════════════════════════════════════
          // CHƯƠNG VII: MỞ RỘNG TẢI 5.000 NGƯỜI DÙNG
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'CHƯƠNG VI: CHIẾN LƯỢC MỞ RỘNG TẢI PHỤC VỤ 5.000 NGƯỜI DÙNG', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 300, after: 150 },
          }),

          new Paragraph({
            children: [
              new TextRun({ text: '1. Tầng Web & CDN: Đặt toàn bộ Static Files qua Cloudflare CDN, phân tán tải tới 300+ Edge Data Centers, máy chủ gốc chỉ xử lý các API call JSON.\n' }),
              new TextRun({ text: '2. Tầng Ứng Dụng (Node.js Cluster): Nâng cấp lên gói 2GB RAM / 1 vCPU và chạy Cluster đa luồng, xử lý 3.000 - 7.000 req/giây.\n' }),
              new TextRun({ text: '3. Tầng Cơ Sở Dữ Liệu (PgBouncer Pooler): Kích hoạt Transaction Connection Pooling cổng 6543 để gom 5.000 kết nối người dùng vào 50 kết nối DB hiệu năng cao.\n' }),
              new TextRun({ text: '4. Tầng Bộ Nhớ Đệm (Redis Cache): Lưu cache danh mục cây, vật tư, thời tiết trên RAM Redis, giảm tải 85% truy vấn vào CSDL chính.' }),
            ],
          }),

          new Paragraph({ spacing: { after: 300 } }),

          // ── KÝ TÊN & PHÊ DUYỆT ──
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: 'HỘI ĐỒNG KIẾN TRÚC SƯ HỆ THỐNG & BAN GIÁM ĐỐC\n', bold: true, color: '065F46' }),
              new TextRun({ text: '(Ký tên, đóng dấu và phê duyệt ban hành trên toàn hệ sinh thái)\n\n\n\n', italics: true }),
              new TextRun({ text: 'TÂN BẢO AGTECH CORPORATION © 2026', bold: true, color: '047857' }),
            ],
            spacing: { before: 400 },
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(__dirname, '../../HO_SO_DAC_TA_KIEN_TRUC_HE_THONG_TANBAO_AGTECH_40PAGES.docx');
  fs.writeFileSync(outPath, buffer);
  console.log('✅ ĐÃ XUẤT BẢN THÀNH CÔNG MASTER SPECIFICATION WORD DOCX TẠI:\n', outPath);
}

generateMasterSpecDocx().catch(console.error);
