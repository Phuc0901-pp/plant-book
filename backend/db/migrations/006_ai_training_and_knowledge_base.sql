-- Migration: 006_ai_training_and_knowledge_base.sql
-- Description: Schema and seed data for AI Training Studio, Knowledge Articles, Q&A Pairs and Security Audit Trail

-- +migrate Up
-- 1. Knowledge Base Articles Table
CREATE TABLE IF NOT EXISTS ai_knowledge_articles (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) NOT NULL DEFAULT 'Kỹ thuật Canh tác',
  title VARCHAR(255) NOT NULL,
  topic_keywords TEXT,
  content TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Training Q&A Pairs Table (Few-Shot Fine-Tuning)
CREATE TABLE IF NOT EXISTS ai_training_qa (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) NOT NULL DEFAULT 'Hỏi Đáp Thường Gặp',
  sample_questions TEXT NOT NULL,
  expected_answer TEXT NOT NULL,
  keywords VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Security Audit Trail & Change Log for AI Training
CREATE TABLE IF NOT EXISTS ai_training_logs (
  id SERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, TEST_SIMULATE, RESTORE
  target_type VARCHAR(50) NOT NULL, -- KNOWLEDGE_ARTICLE, TRAINING_QA, SYSTEM_PROMPT
  target_id INTEGER,
  details JSONB DEFAULT '{}',
  admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ip_address VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. User Feedback & Unanswered Queries Table
CREATE TABLE IF NOT EXISTS ai_unanswered_queries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_query TEXT NOT NULL,
  bot_response TEXT,
  user_feedback VARCHAR(20) DEFAULT 'unanswered', -- like, dislike, unanswered
  status VARCHAR(50) DEFAULT 'pending', -- pending, resolved, ignored
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Indexes for fast lookup & filtering
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_active ON ai_knowledge_articles(is_active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_category ON ai_knowledge_articles(category);
CREATE INDEX IF NOT EXISTS idx_ai_training_qa_active ON ai_training_qa(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_training_logs_created ON ai_training_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_unanswered_status ON ai_unanswered_queries(status, created_at DESC);

-- 6. Seed High-Quality Knowledge Articles
INSERT INTO ai_knowledge_articles (category, title, topic_keywords, content, priority, is_active)
VALUES
(
  'An toàn Sinh học',
  'Quy Tắc Vàng: Khoảng Cách 10 ~ 15 Ngày Giữa Thuốc BVTV Hóa Học & Chế Phẩm Vi Sinh',
  'thuốc bvtv, hóa học, vi sinh, trichoderma, bacillus, men em, khoảng cách 10 ngày, 15 ngày, độc tính, sát khuẩn',
  'Khi sử dụng Thuốc Bảo Vệ Thực Vật (Hóa học) để trừ sâu bệnh, BẮT BUỘC phải cách 10 đến 15 ngày sau mới được sử dụng Chế Phẩm Vi Sinh (nấm đối kháng Trichoderma, vi khuẩn Bacillus, men EM, nấm rễ Mycorrhiza) và ngược lại.
Lý do cốt lõi:
1. Thuốc hóa học có tính sát khuẩn rất mạnh, sẽ tiêu diệt sạch bào tử nấm và vi khuẩn có lợi nếu phun chung hoặc quá gần ngày.
2. Đất và tán cây cần 10 - 15 ngày để hoạt chất hóa học tự phân giải, giảm độc tính, tạo môi trường thuận lợi cho vi sinh vật mới sinh sống.
3. Quy trình chuẩn thực địa: Bước 1 (Dập dịch cấp tính bằng thuốc hóa học) -> Bước 2 (Chờ đệm 10-15 ngày, chỉ tưới nước sạch giữ ẩm) -> Bước 3 (Phục hồi hệ sinh thái rễ bằng Chế phẩm vi sinh + Phân hữu cơ/Humic).
4. Tuyệt đối KHÔNG pha chung thuốc hóa học và men vi sinh trong cùng 1 bình/phuy.',
  10,
  true
),
(
  'Sâu bệnh hại',
  'Phác Đồ Đặc Trị Vàng Lá Thối Rễ & Nứt Thân Xì Mủ (Phytophthora / Fusarium)',
  'vàng lá thối rễ, xì mủ, nứt thân, phytophthora, fusarium, metalaxyl, fosetyl-al, dimethomorph, trichoderma, sầu riêng',
  'Phác đồ điều trị bệnh Xì mủ nứt thân và Vàng lá thối rễ trên cây ăn trái (đặc biệt là Sầu riêng):
1. Nhận diện triệu chứng: Vỏ thân chảy nhựa nâu đen, rễ cám bị thối đen tuột vỏ, lá vàng từ đọt non xuống lá già.
2. Bước 1 - Xử lý vết xì mủ thân: Cạo nhẹ lớp vỏ bị thối đến phần gỗ xanh, quét trực tiếp thuốc đặc trị nấm (hoạt chất Metalaxyl, Fosetyl-Al, hoặc Dimethomorph). Để khô ráo 3-5 ngày.
3. Bước 2 - Xử lý vùng gốc rễ: Tưới thuốc trừ nấm lưu dẫn quanh vùng rễ tán cây, giảm 50% lượng nước tưới.
4. Bước 3 - Phục hồi sinh học sau 10-15 ngày: BẮT BUỘC chờ đủ 10 - 15 ngày sau khi tưới thuốc hóa học, tiến hành tưới Nấm đối kháng Trichoderma kết hợp Acid Humic để kích thích ra rễ non và thiết lập hàng rào vi sinh vật bảo vệ rễ bền vững.',
  9,
  true
),
(
  'Kỹ thuật Canh tác',
  'Quy Trình Quản Lý Cây Sầu Riêng Ri6 4 Giai Đoạn Vụ Mùa Chuẩn Kỹ Thuật',
  'sầu riêng ri6, quy trình, đọt non, làm bông, xiết nước, đậu trái, nuôi cơm, npk, phân bón',
  'Quy trình kỹ thuật canh tác Sầu riêng Ri6 đạt năng suất cao và cơm dẻo vàng:
- Giai đoạn 1 (Nuôi đọt & Tạo tán): Bón phân NPK có hàm lượng đạm cao (30-10-10 hoặc 20-10-10) kết hợp phân hữu cơ hoai mục, phun phòng ngừa rầy xanh le mũi giáo.
- Giai đoạn 2 (Xử lý ra hoa / Làm bông): Xiết nước khô hạn 15 - 20 ngày cho đất nứt chân chim, phun phân bón lá tạo mầm MKP (0-52-34) để già lá nhanh và ức chế đọt non.
- Giai đoạn 3 (Đậu trái & Chống rụng trái non): Thụ phấn bổ sung lúc 18h-20h tối. Phun Canxi Bo chống rụng trái non, tỉa bớt trái méo, chỉ giữ lại 60-100 trái/cây tùy tuổi cây.
- Giai đoạn 4 (Nuôi trái & Lên cơm): Bón phân NPK kali cao (12-12-17 hoặc 15-5-25) trước thu hoạch 30 ngày để cơm sầu riêng vàng đậm, ngọt béo dẻo và không bị sượng cơm.',
  8,
  true
),
(
  'Cẩm nang Ứng dụng',
  'Cẩm Nang Hướng Dẫn Sử Dụng Hệ Thống Sổ Nông Tân Bảo AgTech 4 Bước',
  'hướng dẫn sử dụng, sài sao, dùng sao, tạo trang trại, gps, thêm cây, quét nfc, ghi nhật ký, kho vật tư',
  'Quy trình 4 bước bắt đầu và làm chủ Sổ Nông Tân Bảo AgTech:
- Bước 1: Khởi tạo Trang Trại Mới: Vào menu "Trang trại" -> Bấm nút xanh "+ Khởi tạo Trang trại mới (GPS)" -> Nhập tên vườn, diện tích và nhấn "Lấy vị trí GPS" để định vị vệ tinh và kích hoạt radar thời tiết 6 ngày.
- Bước 2: Thêm Cây & Gán Mã: Mở trang trại -> Bấm "+ Thêm cây" -> Nhập loại cây, giống cây, mã cây (ví dụ SR-001) và chấm tọa độ trên bản đồ GIS hoặc quét thẻ NFC NTAG213.
- Bước 3: Ghi Nhật Ký Chăm Sóc Thực Địa: Bấm vào biểu tượng Bé Mầm Ôm Nút Dấu Cộng (+) ở góc dưới màn hình -> Chọn "Ghi nhật ký chăm sóc" (Tưới nước, Bón phân, Phun thuốc, Cắt tỉa, Thu hoạch) hoặc đọc bằng giọng nói tiếng Việt.
- Bước 4: Quản Lý Vật Tư & Tính Giá Thành: Vào mục "Vật tư", nhập kho hoặc chụp ảnh hóa đơn để AI tự động khấu trừ tồn kho và hạch toán chi phí từng gốc cây.',
  9,
  true
);

-- 7. Seed Initial Few-Shot Q&A Fine-Tuning Pairs
INSERT INTO ai_training_qa (category, sample_questions, expected_answer, keywords, is_active)
VALUES
(
  'An toàn Sinh học',
  'vừa xịt thuốc nấm tưới vi sinh được không
xịt thuốc sâu xong bón trichoderma liền được không
khoảng cách giữa thuốc trừ bệnh và men vi sinh là bao lâu
tại sao không được pha chung thuốc hóa học với nấm trichoderma',
  'Dạ Bác tuyệt đối KHÔNG ĐƯỢC tưới vi sinh liền sau khi phun thuốc hóa học ạ!
Khi đã sử dụng Thuốc BVTV (hóa học), Bác BẮT BUỘC phải cách 10 đến 15 ngày sau mới được tưới Chế phẩm vi sinh (nấm Trichoderma, vi khuẩn Bacillus, men EM).
Bởi vì: Thuốc hóa học có tính sát trùng cực mạnh sẽ diệt sạch toàn bộ men vi sinh có lợi nếu đưa vào ngay. Sau 10-15 ngày, lượng thuốc hóa học phân giải hết thì mới tưới men vi sinh kèm phân hữu cơ/Humic để men sinh sôi tốt nhất ạ! 🌱',
  'thuốc hóa học, vi sinh, trichoderma, khoảng cách 10-15 ngày',
  true
),
(
  'Cẩm nang Ứng dụng',
  'app này sài sao
chưa biết dùng app
hướng dẫn sử dụng sổ nông tân bảo
làm sao để bắt đầu',
  'Dạ chào Bác! Bé Mầm xin hướng dẫn quy trình 4 bước bắt đầu cực kỳ đơn giản sau:
1. Tạo Trang Trại: Vào menu "Trang trại" ➔ Bấm "+ Khởi tạo Trang trại mới (GPS)" để lấy tọa độ vườn và kết nối thời tiết 6 ngày.
2. Thêm Cây: Vào vườn ➔ Bấm "+ Thêm cây" ➔ Gán mã cây (ví dụ: SR-001) và định vị trên bản đồ GIS hoặc quét thẻ NFC.
3. Ghi Nhật Ký: Bấm trực tiếp vào Bé Mầm Ôm Nút (+) góc dưới màn hình ➔ Chọn "Ghi nhật ký chăm sóc" (có thể bấm Micro để đọc bằng giọng nói).
4. Quản Lý Chi Phí: Vào mục "Vật tư" để theo dõi tồn kho và tự động tính tổng chi phí phân thuốc theo mùa vụ.
Bác cần hướng dẫn chi tiết bước nào cứ nhắn Bé Mầm nhé! ✨',
  'hướng dẫn, bắt đầu, tạo trang trại, ghi nhật ký',
  true
),
(
  'Sâu bệnh hại',
  'cây bị xì mủ thân sầu riêng trị sao
sầu riêng bị nứt thân chảy nhựa đọt vàng
bệnh thối rễ sầu riêng xử lý như thế nào',
  'Dạ Bác ơi, triệu chứng xì mủ nứt thân và thối rễ do nấm Phytophthora gây ra. Bác xử lý theo phác đồ 3 bước chuẩn của Tân Bảo như sau nhé:
1. Xử lý thân: Dùng dao cạo sạch phần vỏ thối đến mô gỗ xanh, quét trực tiếp thuốc trị nấm hoạt chất Metalaxyl hoặc Fosetyl-Al nguyên chất lên vết thương.
2. Xử lý rễ: Tưới thuốc trừ nấm lưu dẫn quanh vùng rễ tán cây và giảm 50% lượng nước tưới.
3. Phục hồi sinh học: BẮT BUỘC đợi 10 - 15 ngày sau khi tưới thuốc hóa học, Bác mới tưới nấm đối kháng Trichoderma + Acid Humic để phục hồi rễ tơ và bảo vệ đất lâu dài. Tuyệt đối không tưới Trichoderma ngay lúc đang trị thuốc hóa học nhé Bác! 🩺',
  'xì mủ, nứt thân, phytophthora, metalaxyl, trichoderma',
  true
);
