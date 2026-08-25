const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, ShadingType } = require('docx');

async function generateDrawbacksAndRoadmapDocx() {
  console.log('Đang tạo tài liệu Bóc Tách Nhược Điểm & Hướng Phát Triển Tân Bảo AgTech (.docx)...');

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
          // ── BÌA TÀI LIỆU ──
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'TỔNG CÔNG TY NÔNG NGHIỆP CÔNG NGHỆ CAO TÂN BẢO\n', bold: true, size: 26, color: '047857' }),
              new TextRun({ text: 'VIỆN NGHIÊN CỨU & PHÁT TRIỂN CÔNG NGHỆ NÔNG NGHIỆP SỐ TÂN BẢO\n', bold: true, size: 18, color: '64748B' }),
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
              new TextRun({ text: 'BÁO CÁO PHÂN TÍCH CHUYÊN SÂU:\n', bold: true, size: 22, color: '059669', italics: true }),
              new TextRun({ text: 'BÓC TÁCH TOÀN BỘ NHƯỢC ĐIỂM, ĐIỂM NGHẼN HỆ THỐNG\nVÀ LỘ TRÌNH PHÁT TRIỂN ĐỘT PHÁ TƯƠNG LAI (2026 - 2030)\n', bold: true, size: 34, color: '065F46' }),
              new TextRun({ text: '(COMPREHENSIVE BOTTLENECKS, RISK ANALYSIS & STRATEGIC R&D ROADMAP)\n', bold: true, size: 19, color: '475569', italics: true }),
            ],
            spacing: { before: 200, after: 400 },
          }),

          // Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, shading: { fill: 'F0FDF4' }, children: [new Paragraph({ children: [new TextRun({ text: 'Mã Báo Cáo:', bold: true, color: '047857' })] })] }),
                  new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'R&D-BOTTLENECK-2026', bold: true })] })] }),
                  new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, shading: { fill: 'F0FDF4' }, children: [new Paragraph({ children: [new TextRun({ text: 'Cấp Phê Duyệt:', bold: true, color: '047857' })] })] }),
                  new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Hội Đồng Quản Trị & Ban Giám Đốc' })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ shading: { fill: 'F0FDF4' }, children: [new Paragraph({ children: [new TextRun({ text: 'Phạm Vi Đánh Giá:', bold: true, color: '047857' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Hạ Tầng Kỹ Thuật, UX/UI, Vận Hành, Kinh Tế' })] })] }),
                  new TableCell({ shading: { fill: 'F0FDF4' }, children: [new Paragraph({ children: [new TextRun({ text: 'Tầm Nhìn:', bold: true, color: '047857' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Chiến lược 5 năm (2026 - 2030)' })] })] }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { after: 500 } }),

          // ══════════════════════════════════════════════════════════════
          // PHẦN I: BÓC TÁCH TOÀN BỘ NHƯỢC ĐIỂM & ĐIỂM NGHẼN HIỆN TẠI
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'PHẦN I: BÓC TÁCH TOÀN BỘ NHƯỢC ĐIỂM & RỦI RO CỦA HỆ THỐNG', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 300, after: 150 },
          }),

          new Paragraph({
            children: [new TextRun({ text: '1. Nhược Điểm Về Mặt Kỹ Thuật & Công Nghệ (Technical Bottlenecks):', bold: true, size: 24, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '• Phụ Thuộc API Thương Mại Bên Thứ 3: Việc sử dụng Google Gemini và Mapbox Tiles khiến hệ thống phải chịu chi phí biến đổi lớn khi số lượng nông hộ tăng từ 1.000 lên 500.000 người.\n' }),
              new TextRun({ text: '• Sai Số Định Vị GPS Dưới Tán Cây Dày (Canopy Attenuation): Dưới tán lá sầu riêng cổ thụ hoặc vườn bưởi rậm rạp, sóng GPS vệ tinh dân dụng của smartphone bị trôi sai số từ 5m - 15m, gây nhầm lẫn vị trí cây nếu không có chip NFC.\n' }),
              new TextRun({ text: '• Độ Bền Vật Lý Của Thẻ NFC / Tem QR Thực Địa: Nắng nóng 40°C, mưa axit và hóa chất thuốc BVTV làm giảm tuổi thọ tem nhãn nếu không dùng vật liệu composite chuyên dụng.\n' }),
              new TextRun({ text: '• Giới Hạn Bộ Nhớ Trình Duyệt Mobile (Storage Eviction): Một số dòng điện thoại Android giá rẻ có thể tự động dọn dẹp bộ nhớ đệm IndexedDB khi máy bị đầy bộ nhớ, gây rủi ro mất dữ liệu chưa kịp đồng bộ.\n' }),
              new TextRun({ text: '• Độ Trễ Mạng (Network Latency) Khi Quét OCR Ảnh Lớn: Nông dân chụp ảnh 4K độ phân giải cao gửi lên mạng 3G yếu gây thời gian chờ lâu (5-10 giây).' }),
            ],
          }),

          new Paragraph({
            children: [new TextRun({ text: '2. Nhược Điểm Về Mặt Trải Nghiệm & Hành Vi Nông Dân (Adoption Bottlenecks):', bold: true, size: 24, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '• Rào Cản Tuổi Tác & Gõ Bàn Phím Ảo: Phần lớn chủ vườn từ 50 - 65 tuổi gặp khó khăn khi gõ bàn phím ảo nhỏ trên màn hình cảm ứng, nhất là khi tay đang dính bùn đất ngoài vườn.\n' }),
              new TextRun({ text: '• Tâm Lý E Ngại Chia Sẻ Số Liệu Tài Chính: Một số nông dân còn e dè khi nhập giá mua vật tư hoặc sản lượng bán vì sợ lộ bí quyết kinh doanh hoặc rủi ro về thuế.\n' }),
              new TextRun({ text: '• Thói Quen Quên Ghi Chép Hàng Ngày: Nông dân có xu hướng dồn việc ghi chép vào cuối tuần, làm giảm tính tươi mới và độ tin cậy của dữ liệu VietGAP.\n' }),
              new TextRun({ text: '• Chưa Có Động Lực Trực Tiếp (Incentives): Nông dân chưa thấy được lợi ích tài chính tức thì nếu chỉ ghi chép mà chưa có cam kết bao tiêu đầu ra giá cao.' }),
            ],
          }),

          new Paragraph({
            children: [new TextRun({ text: '3. Nhược Điểm Về Mặt Vận Hành & Chuỗi Cung Ứng (Operational Bottlenecks):', bold: true, size: 24, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '• Nguy Cơ Gian Lận Dữ Liệu Bằng Ảnh Cũ: Nông dân có thể chụp lại ảnh trên màn hình hoặc dùng ảnh cũ nếu không có cơ chế khóa thời gian thực Geo-camera chặt chẽ.\n' }),
              new TextRun({ text: '• Tiêu Chuẩn Xuất Khẩu Thay Đổi Nhanh: Quy định mã số vùng trồng GACC của Trung Quốc và CSDDD của Châu Âu liên tục cập nhật danh mục hoạt chất cấm, đòi hỏi hệ thống phải cập nhật CSDL liên tục.' }),
            ],
          }),

          new Paragraph({ spacing: { after: 300 } }),

          // ══════════════════════════════════════════════════════════════
          // PHẦN II: HƯỚNG PHÁT TRIỂN & GIẢI PHÁP ĐỘT PHÁ (2026 - 2030)
          // ══════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'PHẦN II: CHIẾN LƯỢC KHẮC PHỤC & HƯỚNG PHÁT TRIỂN ĐỘT PHÁ', bold: true, size: 28, color: '065F46' })],
            spacing: { before: 300, after: 150 },
          }),

          new Paragraph({
            children: [
              new TextRun({ text: '🚀 Giải Pháp 1: Trợ Lý Giọng Nói Tiếng Việt 1-Chạm (Voice AI Input Engine):\n', bold: true, color: '047857' }),
              new TextRun({ text: 'Khắc phục hoàn toàn rào cản gõ phím: Nông dân chỉ cần giữ nút Bé Mầm và nói: \"Hôm nay tưới 30 lít phân NPK 16-16-8 cho cây sầu riêng 01\" -> AI tự động bóc tách số liệu và lưu nhật ký ngay lập tức mà không cần chạm bàn phím!\n\n' }),
              new TextRun({ text: '🚀 Giải Pháp 2: Tự Chủ Hạ Tầng AI Bằng Agri-LLM Riêng (On-Premises AI):\n', bold: true, color: '047857' }),
              new TextRun({ text: 'Huấn luyện riêng mô hình ngôn ngữ chuyên sâu về nông học Việt Nam (Agri-LLM trên nền Llama 3/Gemma) chạy trực tiếp trên cụm máy chủ GPU nội bộ của Tân Bảo, giúp giảm 95% chi phí API thương mại khi phục vụ hàng trăm ngàn nông hộ.\n\n' }),
              new TextRun({ text: '🚀 Giải Pháp 3: Định Vị Vi Sai Độ Chính Xác Cao (RTK-GPS <20cm) & Edge Computer Vision:\n', bold: true, color: '047857' }),
              new TextRun({ text: 'Khắc phục sai số dưới tán cây: Tích hợp trạm phát vi sai RTK mini di động giúp đưa độ chính xác GPS từ sai số 10m xuống dưới 20cm; Mô hình Computer Vision On-device nhận diện trực tiếp sâu bệnh qua camera với độ trễ <0.1 giây mà không cần internet.\n\n' }),
              new TextRun({ text: '🚀 Giải Pháp 4: Cơ Chế Gamification & Tín Nhiệm Nông Nghiệp (Agri-Credit Score):\n', bold: true, color: '047857' }),
              new TextRun({ text: 'Thiết lập chương trình \"Nông hộ kim cương\": Nông dân ghi chép nhật ký đúng giờ hàng ngày được cộng điểm thưởng đổi lấy voucher phân bón miễn phí hoặc được bảo lãnh lãi suất vay vốn ngân hàng ưu đãi từ các ngân hàng đối tác.\n\n' }),
              new TextRun({ text: '🚀 Giải Pháp 5: Ảnh Vệ Tinh Viễn Thám Đo Chỉ Số Sức Khỏe Cây (NDVI Index):\n', bold: true, color: '047857' }),
              new TextRun({ text: 'Tích hợp dữ liệu viễn thám từ vệ tinh Sentinel-2 để phân tích sức khỏe tán lá, độ ẩm tầng đất trên diện rộng hàng ngàn hecta, phát hiện sớm các vùng cây bị stress nước hoặc thiếu hụt diệp lục tố.\n\n' }),
              new TextRun({ text: '🚀 Giải Pháp 6: Tự Động Hóa Nông Trại Bằng Drone Tự Hành & Van Tưới LoRaWAN:\n', bold: true, color: '047857' }),
              new TextRun({ text: 'Lập trình lộ trình bay tự động cho Drone dựa trên bản đồ GIS cây bệnh; Kết nối Van tưới tự động LoRaWAN tự đóng/mở theo ngưỡng độ ẩm đất thời gian thực.\n\n' }),
              new TextRun({ text: '🚀 Giải Pháp 7: Sàn Giao Dịch Nông Sản B2B & Tín Chỉ Carbon Nông Nghiệp (Agri-Carbon):\n', bold: true, color: '047857' }),
              new TextRun({ text: 'Kết nối trực tiếp nông hộ có chứng nhận số hóa VietGAP với các doanh nghiệp thu mua xuất khẩu uy tín, cắt bỏ tầng lớp thương lái trung gian, đảm bảo bao tiêu đầu ra với giá cao hơn 15-20%; Đo lường lượng giảm phát thải khí nhà kính để cấp Chứng chỉ Carbon Nông nghiệp quốc tế.' }),
            ],
          }),

          new Paragraph({ spacing: { after: 400 } }),

          // ── KÝ TÊN DUYỆT ──
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: 'VIỆN NGHIÊN CỨU & PHÁT TRIỂN CÔNG NGHỆ NÔNG NGHIỆP SỐ TÂN BẢO\n', bold: true, color: '065F46' }),
              new TextRun({ text: '(Ký tên, phê duyệt đề án R&D giai đoạn 2026 - 2030)\n\n\n\n', italics: true }),
              new TextRun({ text: 'TÂN BẢO AGTECH CORPORATION © 2026', bold: true, color: '047857' }),
            ],
            spacing: { before: 400 },
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(__dirname, '../../PHAN_TICH_NHUOC_DIEM_VA_HUONG_PHAT_TRIEN_TANBAO_AGTECH.docx');
  fs.writeFileSync(outPath, buffer);
  console.log('✅ ĐÃ XUẤT BẢN THÀNH CÔNG BÁO CÁO NHƯỢC ĐIỂM & R&D (.docx) TẠI:\n', outPath);
}

generateDrawbacksAndRoadmapDocx().catch(console.error);
