-- +migrate Up
DO $$
BEGIN
  INSERT INTO ai_knowledge_articles (category, title, topic_keywords, content, priority, is_active)
  SELECT 'Kỹ thuật Canh tác',
         'Quy Trình Làm Bông, Rước Mắt Cua, Sổ Nhụy & Chống Rụng Trái Non Sầu Riêng',
         'làm bông, xiết nước, mắt cua, sổ nhụy, đậu trái, rụng trái non, canxi bo, mkp, 10-60-10, chặn đọt, đi đọt',
         '1. Tạo mầm & Xiết nước: Khi cơi đọt thứ 2-3 chuyển lụa hoàn toàn, bón Lân cao (Super Lân / NPK 10-50-10), xiết nước 14-20 ngày và phun MKP (0-52-34) + KNO3 tạo mầm hoa.
2. Rước mắt cua: Khi mắt cua sáng 2-3cm mới nhấp nước trở lại (20-30% lượng nước bình thường) tránh sốc nước gây nghẹn bông hoặc biến bông thành đọt.
3. Quản lý cơi đọt trước sổ nhụy: Kéo đọt đồng loạt lúc bông 20-25 ngày tuổi hoặc chặn/dìu đọt bằng MKP + Kali cao nếu đọt phóng đúng lúc sắp sổ nhụy.
4. Sổ nhụy & Chống rụng: Phun Canxi-Bo + Kẽm trước sổ nhụy 5 ngày và sau đậu trái 7-10 ngày; thụ phấn bổ sung lúc 18h30-21h00.',
         9, true
  WHERE NOT EXISTS (
    SELECT 1 FROM ai_knowledge_articles WHERE title = 'Quy Trình Làm Bông, Rước Mắt Cua, Sổ Nhụy & Chống Rụng Trái Non Sầu Riêng'
  );

  INSERT INTO ai_knowledge_articles (category, title, topic_keywords, content, priority, is_active)
  SELECT 'Kỹ thuật Canh tác',
         'Phác Đồ Khắc Phục Sượng Cơm, Cháy Múi & Nuôi Trái Sầu Riêng Cơm Vàng Dẻo',
         'sượng cơm, cháy múi, nhão cơm, nuôi trái, lên cơm, kali trắng, k2so4, canxi, magie, thu hoạch',
         '1. Nguyên nhân sượng cơm & cháy múi: Cây đi đọt non cạnh tranh dinh dưỡng lúc trái 60-90 ngày, dư nước/mưa lớn, thiếu Canxi-Magie-Bo, hoặc bón phân chứa gốc Clo (KCl).
2. Biện pháp khắc phục:
- Tuyệt đối dùng NPK Kali Sunfat (K2SO4 - Kali trắng như 12-11-18 hoặc 15-5-20 TE), KHÔNG dùng Kali đỏ (KCl).
- Phun bổ sung Canxi-Bo-Magie định kỳ 10-15 ngày/lần ở giai đoạn trái 40-80 ngày.
- Giữ ẩm độ đất ổn định 60-65%, thoát nước rãnh tốt khi mưa lớn, rút nước trước thu hoạch 10-15 ngày.',
         9, true
  WHERE NOT EXISTS (
    SELECT 1 FROM ai_knowledge_articles WHERE title = 'Phác Đồ Khắc Phục Sượng Cơm, Cháy Múi & Nuôi Trái Sầu Riêng Cơm Vàng Dẻo'
  );

  INSERT INTO ai_knowledge_articles (category, title, topic_keywords, content, priority, is_active)
  SELECT 'Sâu bệnh hại',
         'Phác Đồ Quản Lý Rầy Xanh, Nhện Đỏ, Thán Thư Cháy Lá & Sâu Đục Trái',
         'rầy xanh, rầy nhảy, nhện đỏ, thán thư, cháy lá, sâu đục trái, abamectin, emamectin, imidacloprid, pymetrozine, hexaconazole',
         '1. Rầy xanh / Rầy nhảy (hại đọt non): Phun định kỳ khi đọt vừa nhú mũi giáo bằng Pymetrozine, Thiamethoxam hoặc Imidacloprid, luân phiên hoạt chất tránh kháng thuốc.
2. Nhện đỏ (mùa nắng): Phun Abamectin, Pyridaben hoặc Spirodiclofen mặt dưới lá.
3. Thán thư / Cháy lá (Rhizoctonia / Colletotrichum): Cắt tỉa cành thông thoáng, phun Azoxystrobin + Difenoconazole hoặc Hexaconazole.
4. Sâu đục trái: Tỉa thưa trái chùm, phun Emamectin benzoate hoặc Chlorantraniliprole và tuân thủ nghiêm ngặt thời gian cách ly PHI.',
         9, true
  WHERE NOT EXISTS (
    SELECT 1 FROM ai_knowledge_articles WHERE title = 'Phác Đồ Quản Lý Rầy Xanh, Nhện Đỏ, Thán Thư Cháy Lá & Sâu Đục Trái'
  );

  INSERT INTO ai_knowledge_articles (category, title, topic_keywords, content, priority, is_active)
  SELECT 'Cẩm nang Ứng dụng',
         'Cẩm Nang Định Danh NFC (/sub), Ghi Nhật Ký Thuê Nhân Công & Truy Xuất VietGAP',
         'định danh nfc, ntag213, cổng /sub, thuê nhân công, mướn công, xuất báo cáo vietgap, mã lô',
         '1. Định danh thẻ NFC tại cổng /sub: Đăng nhập SĐT -> Chọn Vườn -> Tạo Cây -> Chạm thẻ NTAG213 để khóa URL định danh duy nhất.
2. Ghi nhận Thuê nhân công: Trên hồ sơ cây công khai hoặc ứng dụng Mobile, nhấn nút "Thuê nhân công" (biểu tượng Chibi ISO), chọn công việc (Cắt tỉa cành/lá, Tỉa hoa/trái, Làm cỏ, Đào rãnh...), nhập số công và chi phí để hệ thống tự động hạch toán.
3. Truy xuất nguồn gốc VietGAP: Mọi nhật ký đều được niêm phong bằng chuỗi băm SHA-256 bất biến và kiểm tra bán kính Geofence <= 8.0m.',
         9, true
  WHERE NOT EXISTS (
    SELECT 1 FROM ai_knowledge_articles WHERE title = 'Cẩm Nang Định Danh NFC (/sub), Ghi Nhật Ký Thuê Nhân Công & Truy Xuất VietGAP'
  );

  INSERT INTO ai_training_qa (category, sample_questions, expected_answer, keywords, is_active)
  SELECT 'Kỹ thuật Canh tác',
         'sầu riêng bị sượng cơm cháy múi làm sao khắc phục
tại sao sầu riêng bị cứng cơm nhão cơm
bón phân gì để sầu riêng cơm vàng dẻo không bị sượng',
         'Dạ Bác ơi, hiện tượng sượng cơm và cháy múi sầu riêng chủ yếu do 3 nguyên nhân: (1) Cây phóng đọt non lúc đang nuôi trái 60-90 ngày gây tranh chấp dinh dưỡng, (2) Dư nước hoặc mưa lớn ngập rãnh, (3) Bón phân chứa Clo (Kali đỏ KCl) hoặc thiếu Canxi-Bo-Magie.
Cách khắc phục chuẩn Tân Bảo:
1. Chỉ bón NPK Kali trắng (K2SO4 như 12-11-18 hoặc 15-5-20), tuyệt đối ngưng Kali đỏ (KCl).
2. Phun Canxi-Bo + Magie định kỳ 15 ngày/lần từ khi trái bằng quả trứng gà.
3. Chặn/dìu đọt non bằng MKP nếu cây nhú đọt lúc nuôi trái và rút ráo nước rãnh trước thu hoạch 10-15 ngày ạ! 🍈',
         'sượng cơm, cháy múi, kali trắng, canxi bo',
         true
  WHERE NOT EXISTS (
    SELECT 1 FROM ai_training_qa WHERE keywords = 'sượng cơm, cháy múi, kali trắng, canxi bo'
  );

  INSERT INTO ai_training_qa (category, sample_questions, expected_answer, keywords, is_active)
  SELECT 'Cẩm nang Ứng dụng',
         'làm sao để ghi nhật ký thuê nhân công cắt tỉa
mướn công làm cỏ tỉa cành nhập ở đâu
nút cắt cành tỉa hoa đổi thành gì rồi',
         'Dạ Bác ơi, hạng mục Cắt cành/lá và Tỉa hoa/quả hiện đã được chuẩn hóa gộp chung vào nút **"Thuê nhân công"** (có biểu tượng Chibi ISO công nhân nông trại) để Bác dễ dàng hạch toán tiền công!
Cách thao tác:
1. Mở hồ sơ cây trồng (quét thẻ NFC hoặc vào trang cây).
2. Tại mục **IV. Thao tác canh tác nhanh**, bấm nút **"Thuê nhân công"**.
3. Chọn nội dung công việc (Cắt tỉa cành/lá, Tỉa hoa/trái non, Phát cỏ, Bồi bùn...), nhập số lượng nhân công và chi phí (VNĐ) rồi bấm **Lưu nhật ký** là xong ạ! 👷‍♂️🌱',
         'thuê nhân công, mướn công, cắt tỉa',
         true
  WHERE NOT EXISTS (
    SELECT 1 FROM ai_training_qa WHERE keywords = 'thuê nhân công, mướn công, cắt tỉa'
  );
END $$;
