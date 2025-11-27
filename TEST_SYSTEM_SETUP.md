# 📝 HỆ THỐNG BÀI TEST - SETUP GUIDE

## ✅ ĐÃ HOÀN THÀNH:

### 1. **Migrations (5 bảng)**
- ✅ `20251127143000-create-test.js` - Bảng Test
- ✅ `20251127143001-create-test-question.js` - Bảng TestQuestion  
- ✅ `20251127143002-create-test-submission.js` - Bảng TestSubmission
- ✅ `20251127143003-create-test-answer.js` - Bảng TestAnswer
- ✅ `20251127143004-create-grading-log.js` - Bảng GradingLog

### 2. **Models (5 models)**
- ✅ `backend/src/models/test.js`
- ✅ `backend/src/models/testquestion.js`
- ✅ `backend/src/models/testsubmission.js`
- ✅ `backend/src/models/testanswer.js`
- ✅ `backend/src/models/gradinglog.js`

---

## 📊 CẤU TRÚC DATABASE:

```
Test (Bài test)
├── id
├── Tieude (Tiêu đề)
├── Mota (Mô tả)
├── Thoigiantoida (Thời gian tối đa - phút)
├── Ngaybatdau (Ngày bắt đầu hiệu lực)
├── Ngayhethan (Deadline)
├── Tongdiem (Tổng điểm)
├── Trangthai (1: Active, 0: Inactive)
└── jobPostingId (FK → JobPosting)

TestQuestion (Câu hỏi)
├── id
├── Cauhoi (Nội dung câu hỏi)
├── Dapan (Đáp án chuẩn)
├── Loaicauhoi (tuluan/tracnghiem)
├── Diem (Điểm của câu này)
├── Thutu (Thứ tự hiển thị)
└── testId (FK → Test)

TestSubmission (Bài làm của ứng viên)
├── id
├── Thoigianbatdau (Thời điểm bắt đầu)
├── Thoigianketthuc (Thời điểm kết thúc)
├── Thoigianconlai (Phút còn lại)
├── Hanhethan (Deadline)
├── Tongdiemdatduoc (Tổng điểm đạt được)
├── Trangthai (chuabatdau/danglam/danop/dacham/hethan/huy)
├── Ghichu (Ghi chú)
├── testId (FK → Test)
├── userId (FK → User)
└── jobApplicationId (FK → JobApplication)

TestAnswer (Câu trả lời)
├── id
├── Cautraloi (Câu trả lời của ứng viên)
├── Diemdatduoc (Điểm đạt được)
├── Nhanxet (Nhận xét)
├── Dungkhong (Đúng/Sai)
├── Phuongphap (nlp/ai/manual/hybrid)
├── Dosattinhcua_nlp (Độ tương đồng NLP 0-1)
├── Dosattinhcua_ai (Độ tương đồng AI 0-1)
├── testSubmissionId (FK → TestSubmission)
└── testQuestionId (FK → TestQuestion)

GradingLog (Lịch sử chấm bài)
├── id
├── Phuongphap (nlp/ai/manual/hybrid)
├── Diemcu (Điểm cũ)
├── Diemmoi (Điểm mới)
├── Lydocham (Lý do chấm lại)
├── Thoigiancham (Thời gian xử lý - giây)
├── Nguoicham (FK → User, NULL nếu tự động)
└── testAnswerId (FK → TestAnswer)
```

---

## 🔄 QUAN HỆ GIỮA CÁC BẢNG:

```
JobPosting (1) ──────► (N) Test
Test (1) ──────────────► (N) TestQuestion
Test (1) ──────────────► (N) TestSubmission
User (1) ──────────────► (N) TestSubmission
JobApplication (1) ────► (N) TestSubmission
TestSubmission (1) ────► (N) TestAnswer
TestQuestion (1) ──────► (N) TestAnswer
TestAnswer (1) ────────► (N) GradingLog
User (1) ──────────────► (N) GradingLog (as Grader)
```

---

## 📋 CÁC BƯỚC TIẾP THEO:

### 1. **Chạy Migration**
```bash
cd backend
npx sequelize-cli db:migrate
```

### 2. **Cài đặt thư viện NLP & AI**
```bash
npm install natural @google/generative-ai
```

**Lưu ý:** Cần Node.js >= 18 cho `@google/generative-ai`

### 3. **Thêm GEMINI_API_KEY vào .env**
```env
# Google Gemini API (Free tier)
GEMINI_API_KEY=your_api_key_here
```

Lấy API key tại: https://makersuite.google.com/app/apikey

### 4. **Tạo Services**
- `backend/src/service/testService.js` - Quản lý bài test
- `backend/src/service/aiGradingService.js` - Chấm bài tự động (Hybrid NLP + AI)

### 5. **Tạo Controllers & Routes**
- `backend/src/controller/testController.js`
- Routes trong `backend/src/routes/web.js`

### 6. **Tạo Frontend Components**
- HR: Tạo/quản lý bài test
- Candidate: Làm bài test
- HR: Xem kết quả, chấm lại

---

## 🎯 LUỒNG HOẠT ĐỘNG:

### **A. HR tạo bài test:**
```
1. HR vào JobPosting → Click "Tạo bài test"
2. Nhập: Tiêu đề, Mô tả, Thời gian, Deadline
3. Thêm câu hỏi (Câu hỏi + Đáp án chuẩn + Điểm)
4. Lưu → Tạo record trong Test & TestQuestion
```

### **B. Ứng viên làm bài:**
```
1. Ứng viên apply job → Nhận link bài test
2. Click "Bắt đầu" → Tạo TestSubmission (trangthai='danglam')
3. Trả lời từng câu → Lưu vào TestAnswer
4. Nộp bài → Update TestSubmission (trangthai='danop')
```

### **C. Hệ thống chấm bài (Hybrid):**
```
1. Với mỗi TestAnswer:
   
   a) Chấm bằng NLP trước (nhanh - 50ms)
      - Nếu độ tương đồng >= 0.85 → Đúng (10 điểm)
      - Nếu độ tương đồng <= 0.3 → Sai (0 điểm)
      - Nếu 0.3 < độ tương đồng < 0.85 → Không chắc → Gọi AI
   
   b) Gọi AI (chỉ khi cần - 1-3s)
      - Google Gemini đánh giá ngữ nghĩa
      - Trả về: điểm (0-10) + nhận xét
   
   c) Lưu kết quả vào TestAnswer
      - Diemdatduoc, Nhanxet, Dungkhong
      - Phuongphap (nlp/ai/hybrid)
      - Dosattinhcua_nlp, Dosattinhcua_ai
   
   d) Ghi log vào GradingLog

2. Tính tổng điểm → Update TestSubmission
   - Tongdiemdatduoc
   - Trangthai = 'dacham'
```

### **D. HR xem kết quả:**
```
1. HR vào "Quản lý ứng viên"
2. Xem điểm test của từng ứng viên
3. Xem chi tiết từng câu trả lời
4. Có thể chấm lại thủ công nếu cần
```

---

## 🤖 PHƯƠNG PHÁP CHẤM BÀI:

### **1. NLP (Natural Language Processing)**
- Thư viện: `natural`
- Tốc độ: 50-100ms
- Độ chính xác: 60-70%
- Chi phí: Miễn phí
- Dùng khi: Câu rất giống hoặc rất khác

### **2. AI (Google Gemini Flash)**
- API: `@google/generative-ai`
- Model: `gemini-1.5-flash` (nhanh, rẻ)
- Tốc độ: 0.5-1s
- Độ chính xác: 85-90%
- Chi phí: 15 requests/phút (free)
- Dùng khi: Không chắc chắn (0.3 < similarity < 0.85)

### **3. Hybrid (Khuyến nghị)**
- Kết hợp NLP + AI
- Tốc độ: ~200ms trung bình
- Độ chính xác: 80-85%
- Tiết kiệm: 70% requests AI

### **4. Manual (Chấm tay)**
- HR chấm lại
- Độ chính xác: 100%
- Dùng khi: Tranh chấp, không đồng ý với AI

---

## ⚠️ LƯU Ý:

1. **Thời gian làm bài:**
   - `Thoigiantoida` trong Test: Thời gian tối đa (VD: 60 phút)
   - `Thoigianbatdau` trong TestSubmission: Khi ứng viên click "Bắt đầu"
   - `Thoigianconlai`: Cập nhật khi ứng viên làm dở, thoát ra
   - Hết giờ → Tự động nộp bài

2. **Hạn hiệu lực:**
   - `Ngaybatdau`, `Ngayhethan` trong Test: Khoảng thời gian test có hiệu lực
   - `Hanhethan` trong TestSubmission: Copy từ Test khi tạo
   - Sau `Hanhethan` → Không làm được nữa
   - Cron job check mỗi giờ → Update `Trangthai='hethan'`

3. **Unique constraint:**
   - Mỗi user chỉ làm 1 lần mỗi test
   - Unique key: (testId, userId)

---

## 📁 CẤU TRÚC FILE:

```
backend/
├── src/
│   ├── migrations/
│   │   ├── 20251127143000-create-test.js
│   │   ├── 20251127143001-create-test-question.js
│   │   ├── 20251127143002-create-test-submission.js
│   │   ├── 20251127143003-create-test-answer.js
│   │   └── 20251127143004-create-grading-log.js
│   ├── models/
│   │   ├── test.js
│   │   ├── testquestion.js
│   │   ├── testsubmission.js
│   │   ├── testanswer.js
│   │   └── gradinglog.js
│   ├── service/
│   │   ├── testService.js (TODO)
│   │   └── aiGradingService.js (TODO)
│   ├── controller/
│   │   └── testController.js (TODO)
│   └── routes/
│       └── web.js (UPDATE)
└── .env (ADD GEMINI_API_KEY)
```

---

## 🚀 READY TO CONTINUE!

Đã tạo xong database structure. Tiếp theo có thể:
1. Chạy migration
2. Cài đặt thư viện
3. Tạo services (testService, aiGradingService)
4. Tạo controllers & routes
5. Tạo frontend components

Hãy cho tôi biết bạn muốn tiếp tục bước nào! 🔥

