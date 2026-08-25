const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, ShadingType } = require('docx');

async function createSopDocx() {
  console.log('Đang tạo tài liệu SOP Microsoft Word (.docx)...');

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
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // 1 inch = 1440 twips
          },
        },
        children: [
          // ── HEADER / BANNER ──
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'CÔNG TY CỔ PHẦN NÔNG NGHIỆP CÔNG NGHỆ CAO TÂN BẢO', bold: true, size: 24, color: '047857' }),
            ],
            spacing: { after: 60 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'HỆ THỐNG QUẢN LÝ NHẬT KÝ CANH TÁC VÀ TRỢ LÝ AI AGTECH v1.1.1', bold: true, size: 20, color: '475569' }),
            ],
            spacing: { after: 140 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', color: '10B981' }),
            ],
            spacing: { after: 200 },
          }),

          // ── TITLE ──
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'QUY TRÌNH VẬN HÀNH TIÊU CHUẨN (SOP)', bold: true, size: 36, color: '065F46' }),
            ],
            spacing: { before: 100, after: 80 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'STANDARD OPERATING PROCEDURE: HỆ THỐNG SỔ NÔNG SỐ VÀ TRỢ LÝ AI BÉ MẦM', bold: true, size: 22, color: '059669', italics: true }),
            ],
            spacing: { after: 260 },
          }),

          // ── METADATA TABLE ──
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    shading: { fill: 'F0FDF4', type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Mã Tài Liệu:', bold: true, color: '047857' })] })],
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: 'SOP-TB-AGTECH-01', bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    shading: { fill: 'F0FDF4', type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Phiên Bản:', bold: true, color: '047857' })] })],
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: 'v1.1.1 (Tháng 08/2026)' })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: 'F0FDF4', type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Người Soạn Thảo:', bold: true, color: '047857' })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Chuyên Viên Cấp Cao AgTech (10+ Năm Kinh Nghiệm)' })] })],
                  }),
                  new TableCell({
                    shading: { fill: 'F0FDF4', type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Cấp Phê Duyệt:', bold: true, color: '047857' })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Ban Giám Đốc / Hội đồng Kỹ thuật' })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: 'F0FDF4', type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Phạm Vi Áp Dụng:', bold: true, color: '047857' })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Toàn bộ Nông hộ, Kỹ thuật viên và Quản trị viên' })] })],
                  }),
                  new TableCell({
                    shading: { fill: 'F0FDF4', type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Tiêu Chuẩn:', bold: true, color: '047857' })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'VietGAP / GlobalGAP / ISO 9001:2015' })] })],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { after: 240 } }),

          // ══════════════════════════════════════════════════════════════
          // PHẦN I: THÔNG TIN TỔNG QUAN & NGUYÊN TẮC VẬN HÀNH
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'PHẦN I: THÔNG TIN TỔNG QUAN VÀ NGUYÊN TẮC VẬN HÀNH', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 240, after: 120 },
          }),

          new Paragraph({
            children: [new TextRun({ text: '1.1 Mục Đích Ban Hành SOP (Purpose & Objectives)', bold: true, size: 24, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '• Chuẩn hóa 100% quy trình ghi chép số hóa nhật ký canh tác nông nghiệp, thay thế hoàn toàn sổ ghi chép giấy truyền thống dễ thất lạc và sai lệch số liệu.\n' }),
              new TextRun({ text: '• Đảm bảo tính minh bạch, truy xuất nguồn gốc nông sản theo tiêu chuẩn VietGAP/GlobalGAP phục vụ xuất khẩu và chuỗi cung ứng nông sản cao cấp.\n' }),
              new TextRun({ text: '• Tối ưu hóa chi phí vật tư nông nghiệp (phân bón, thuốc BVTV, công lao động) thông qua hệ thống phân tích chi phí và công nghệ OCR bóc tách giá tự động.\n' }),
              new TextRun({ text: '• Ứng dụng Trợ lý AI Bé Mầm (Google Gemini) làm chuyên gia tư vấn kỹ thuật trực chiến 24/7 cho từng nông hộ theo đúng phạm vi dữ liệu sở hữu (Per-User Scoped Data).' }),
            ],
          }),

          new Paragraph({
            children: [new TextRun({ text: '1.2 Phạm Vi Áp Dụng (Scope of Application)', bold: true, size: 24, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Quy trình này áp dụng cho toàn bộ các bên tham gia chuỗi giá trị nông nghiệp của Tân Bảo AgTech bao gồm:\n' }),
              new TextRun({ text: '1. Nông hộ trực tiếp canh tác (Chủ trang trại, công nhân phụ trách lô cây).\n' }),
              new TextRun({ text: '2. Kỹ sư nông nghiệp / Cán bộ kỹ thuật hiện trường (Agronomists / Field Officers).\n' }),
              new TextRun({ text: '3. Ban Quản trị Hợp tác xã / Doanh nghiệp nông nghiệp (Admin & Managers).' }),
            ],
          }),

          new Paragraph({
            children: [new TextRun({ text: '1.3 Ma Trận Phân Công Trách Nhiệm RACI Matrix', bold: true, size: 24, color: '047857' })],
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ shading: { fill: '047857' }, children: [new Paragraph({ children: [new TextRun({ text: 'Hạng Mục Công Việc', bold: true, color: 'FFFFFF' })] })] }),
                  new TableCell({ shading: { fill: '047857' }, children: [new Paragraph({ children: [new TextRun({ text: 'Nông Hộ (User)', bold: true, color: 'FFFFFF' })] })] }),
                  new TableCell({ shading: { fill: '047857' }, children: [new Paragraph({ children: [new TextRun({ text: 'Kỹ Sư Hiện Trường', bold: true, color: 'FFFFFF' })] })] }),
                  new TableCell({ shading: { fill: '047857' }, children: [new Paragraph({ children: [new TextRun({ text: 'Quản Trị Viên (Admin)', bold: true, color: 'FFFFFF' })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Khởi tạo và Vẽ ranh giới trang trại GPS' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'R (Thực hiện)' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'C (Hỗ trợ)' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'A (Phê duyệt)' })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Số hóa danh mục cây và Gắn thẻ NFC/QR' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'R (Thực hiện)' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'A (Kiểm tra)' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'I (Theo dõi)' })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Ghi nhật ký tưới, bón phân, phun thuốc hàng ngày' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'R (Bắt buộc)' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'A (Giám sát)' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'I (Tổng hợp)' })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Quét OCR hóa đơn vật tư và Hạch toán chi phí' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'R (Thực hiện)' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'C (Tham vấn)' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'A (Kiểm toán)' })] })] }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { after: 240 } }),

          // ══════════════════════════════════════════════════════════════
          // PHẦN II: QUY TRÌNH THIẾT LẬP & QUẢN TRỊ TÀI SẢN NÔNG NGHIỆP
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'PHẦN II: QUY TRÌNH THIẾT LẬP VÀ QUẢN TRỊ TÀI SẢN NÔNG NGHIỆP', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 240, after: 120 },
          }),

          new Paragraph({
            children: [new TextRun({ text: '2.1 Quy trình Khởi tạo Trang trại Mới bằng Định vị Vệ tinh GPS', bold: true, size: 24, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '• Bước 1: Mở menu \"Trang trại\" ở thanh điều hướng bên trái.\n' }),
              new TextRun({ text: '• Bước 2: Nhấn nút \"+ Khởi tạo Trang trại mới (GPS)\".\n' }),
              new TextRun({ text: '• Bước 3: Đứng tại trung tâm vườn, nhấn \"Lấy vị trí GPS hiện tại\" để hệ thống tự động ghim tọa độ kinh độ/vĩ độ chính xác qua vệ tinh.\n' }),
              new TextRun({ text: '• Bước 4: Nhập Tên trang trại, diện tích (ha), địa chỉ hành chính và bấm \"Lưu Trang Trại\".\n' }),
              new TextRun({ text: '• Bước 5: Hệ thống tự động kết nối trạm thời tiết Open-Meteo để cung cấp dự báo 6 ngày và nhiệt ẩm thời gian thực.' }),
            ],
          }),

          new Paragraph({
            children: [new TextRun({ text: '2.2 Quy trình Số hóa Danh mục Cây Trồng và Gán Thẻ NFC/QR', bold: true, size: 24, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '• Bước 1: Truy cập trang trại cần cập nhật, nhấn nút \"+ Thêm cây trồng\".\n' }),
              new TextRun({ text: '• Bước 2: Nhập Mã cây chuẩn hóa (Quy tắc đặt mã: [Ký tự viết tắt giống cây]-[Số thứ tự], ví dụ: SR-001 cho Sầu riêng 001, BD-015 cho Bưởi da xanh 015).\n' }),
              new TextRun({ text: '• Bước 3: Chọn Giống cây (Sầu riêng Ri6, Monthong, Bơ Booth, Mít ruột đỏ...), Ngày xuống giống, Giai đoạn sinh trưởng (Kiến thiết, Làm bông, Nuôi trái, Thu hoạch).\n' }),
              new TextRun({ text: '• Bước 4: Chạm vị trí cây trên bản đồ GIS vệ tinh để lưu tọa độ số học.\n' }),
              new TextRun({ text: '• Bước 5: Quét chip NFC hoặc dán tem mã QR chống nước lên thân cây để hỗ trợ kỹ thuật viên quét nhanh tại vườn.' }),
            ],
          }),

          new Paragraph({ spacing: { after: 240 } }),

          // ══════════════════════════════════════════════════════════════
          // PHẦN III: QUY TRÌNH CANH TÁC HÀNG NGÀY & GHI NHẬT KÝ SỐ
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'PHẦN III: QUY TRÌNH CANH TÁC HÀNG NGÀY VÀ GHI NHẬT KÝ SỐ', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 240, after: 120 },
          }),

          new Paragraph({
            children: [new TextRun({ text: '3.1 Quy trình Thao Tác Nhanh Qua Bé Mầm Ôm Nút Dấu Cộng (+)', bold: true, size: 24, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '• Tại bất kỳ màn hình nào trên Cổng Nông Hộ, nhấn vào biểu tượng Bé Mầm Ôm Dấu Cộng (+) ở góc dưới bên phải.\n' }),
              new TextRun({ text: '• Menu 2 lựa chọn xuất hiện: Chọn \"📝 Ghi nhật ký chăm sóc\".\n' }),
              new TextRun({ text: '• Chọn Cây trồng / Lô cây cần ghi nhận nhật ký.' }),
            ],
          }),

          new Paragraph({
            children: [new TextRun({ text: '3.2 Tiêu Chuẩn Ghi Nhận Cho Từng Hoạt Động Canh Tác', bold: true, size: 24, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '💧 A. Tưới nước: Chọn phương pháp (Tưới nhỏ giọt, Phun mưa, Tưới tay), ghi rõ Lượng nước (Lít/gốc). Kiểm tra độ ẩm đất duy trì 65 - 75%.\n' }),
              new TextRun({ text: '🌱 B. Bón phân: Chọn loại phân (NPK 16-16-8, Hữu cơ vi sinh, Phân trùn quế), ghi rõ liều lượng (kg hoặc gram/gốc). Ghi chú cách bón (bón rãnh quanh tán, hòa nước tưới).\n' }),
              new TextRun({ text: '🩺 C. Phun thuốc BVTV và Kiểm soát PHI: Chọn tên thuốc, nồng độ pha chế (ml/bình 20L), đối tượng phòng trừ (Rầy xanh, Thán thư, Vàng lá). BẮT BUỘC ghi chú thời gian cách ly (PHI 7 - 14 ngày).\n' }),
              new TextRun({ text: '✂️ D. Cắt tỉa cành và Kiểm tra sức khỏe: Ghi nhận tình trạng (Lá khỏe, Vàng lá, Xì mủ), chụp ảnh thực tế đính kèm từ camera điện thoại.' }),
            ],
          }),

          new Paragraph({ spacing: { after: 240 } }),

          // ══════════════════════════════════════════════════════════════
          // PHẦN IV: QUY TRÌNH QUẢN LÝ VẬT TƯ & HẠCH TOÁN CHI PHÍ
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'PHẦN IV: QUY TRÌNH QUẢN LÝ VẬT TƯ VÀ HẠCH TOÁN CHI PHÍ', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 240, after: 120 },
          }),

          new Paragraph({
            children: [
              new TextRun({ text: '4.1 Quy trình Quét OCR Hóa Đơn và Bao Bì Vật Tư:\n', bold: true, color: '047857' }),
              new TextRun({ text: '1. Vào mục \"Vật tư\" -> Nhấn \"+ Thêm vật tư mới\".\n' }),
              new TextRun({ text: '2. Bấm \"Chụp ảnh quét hóa đơn/bao bì (AI OCR)\".\n' }),
              new TextRun({ text: '3. Hệ thống AI tự động trích xuất Tên sản phẩm, Hoạt chất, Đơn vị tính và Đơn giá mua.\n' }),
              new TextRun({ text: '4. Nông hộ kiểm tra lại thông tin và bấm \"Lưu vào Kho\".\n\n' }),
              new TextRun({ text: '4.2 Quy trình Xuất Dùng và Tính Chi Phí Tự Động:\n', bold: true, color: '047857' }),
              new TextRun({ text: 'Mỗi khi nông hộ ghi nhật ký Bón phân / Phun thuốc, hệ thống tự động trừ kho vật tư và cộng dồn chi phí vào Báo cáo mùa vụ của trang trại đó.' }),
            ],
          }),

          new Paragraph({ spacing: { after: 240 } }),

          // ══════════════════════════════════════════════════════════════
          // PHẦN V: QUY TRÌNH KHAI THÁC TRỢ LÝ AI BÉ MẦM
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'PHẦN V: QUY TRÌNH KHAI THÁC TRỢ LÝ AI BÉ MẦM', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 240, after: 120 },
          }),

          new Paragraph({
            children: [
              new TextRun({ text: '5.1 Quy trình Mở Khung Chat và Tra Cứu:\n', bold: true, color: '047857' }),
              new TextRun({ text: '• Bấm vào Bé Mầm Ôm Nút Dấu Cộng (+) -> Chọn \"🌱 Bé Mầm tư vấn và hỏi đáp\".\n' }),
              new TextRun({ text: '• Sử dụng các Prompt gợi ý nhanh: \"🏡 Trang trại của tôi\", \"💰 Chi phí vật tư\", \"📝 Nhật ký gần đây\", \"🩺 Trị vàng lá\".\n\n' }),
              new TextRun({ text: '5.2 Quy tắc Phân Quyền Dữ Liệu (Per-User Scoped Data):\n', bold: true, color: '047857' }),
              new TextRun({ text: '• Nông hộ chỉ truy cập được dữ liệu của các trang trại do mình sở hữu hoặc quản lý (ví dụ: sở hữu 2 trang trại thì AI sẽ trả lời chi tiết cả 2 trang trại của nông hộ đó).\n' }),
              new TextRun({ text: '• Tuyệt đối bảo mật, không hiển thị dữ liệu của nông hộ khác.\n' }),
              new TextRun({ text: '• Tài khoản Admin có quyền tra cứu bức tranh tổng quan toàn công ty.' }),
            ],
          }),

          new Paragraph({ spacing: { after: 240 } }),

          // ══════════════════════════════════════════════════════════════
          // PHẦN VI: QUY TRÌNH XỬ LÝ SỰ CỐ & BẢO TRÌ HỆ THỐNG
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'PHẦN VI: QUY TRÌNH XỬ LÝ SỰ CỐ VÀ BẢO TRÌ HỆ THỐNG', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 240, after: 120 },
          }),

          new Paragraph({
            children: [
              new TextRun({ text: '6.1 Sự cố Mất Kết Nối Mạng Ngoài Thực Địa:\n', bold: true, color: '047857' }),
              new TextRun({ text: '• Ứng dụng hỗ trợ PWA (Offline Service Worker), cho phép lưu tạm dữ liệu ghi chép vào bộ nhớ máy và tự động đồng bộ lên máy chủ ngay khi có kết nối internet trở lại.\n\n' }),
              new TextRun({ text: '6.2 Xử lý Giới Hạn Quota AI (Rate Limit Failover):\n', bold: true, color: '047857' }),
              new TextRun({ text: '• Hệ thống tích hợp chuỗi Fallback tự động qua các model Google Gemini (3.7 -> 3.5 -> 2.5 Flash -> 2.0 Flash) và Bộ não CSDL nội bộ, đảm bảo chatbot luôn phản hồi 100% không bao giờ gián đoạn.' }),
            ],
          }),

          new Paragraph({ spacing: { after: 300 } }),

          // ── KÝ TÊN DUYỆT ──
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: 'Đại diện Ban Điều Hành và Chuyên Viên Kỹ Thuật AgTech\n', bold: true, color: '065F46' }),
              new TextRun({ text: '(Đã ký và phê duyệt áp dụng trên toàn hệ thống)\n\n\n\n', italics: true }),
              new TextRun({ text: 'TÂN BẢO AGTECH CORPORATION © 2026', bold: true, color: '047857' }),
            ],
            spacing: { before: 400 },
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(__dirname, '../../QUY_TRINH_VAN_HANH_TIEU_CHUAN_SOP_TANBAO_AGTECH.docx');
  fs.writeFileSync(outPath, buffer);
  console.log('✅ Đã xuất thành công file Word tại:', outPath);
}

createSopDocx().catch(console.error);
