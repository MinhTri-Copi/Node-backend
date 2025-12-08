# PHA A - CHUẨN BỊ DỮ LIỆU & RUBRIC CHẤM

## ✅ ĐÃ HOÀN THÀNH

### Bước A1 - Xác định các loại câu hỏi

**Đã có sẵn trong database:**
- ✅ `TestQuestion` table với đầy đủ các trường:
  - `id` (auto-increment)
  - `Cauhoi` (questionText) - TEXT
  - `Dapan` (correctAnswer) - TEXT
  - `Diem` (maxScore) - INTEGER
  - `Loaicauhoi` (questionType) - ENUM('tuluan', 'tracnghiem')
  - `Thutu` (order) - INTEGER
  - `testId` - INTEGER (foreign key)

**Loại câu hỏi chính:**
- ✅ Tự luận ngắn / Định nghĩa (`Loaicauhoi = 'tuluan'`)
  - Ví dụ: "HTML là gì?", "CSS dùng để làm gì?"
  - Đã có trong hệ thống

### Bước A2 - Xây bảng rubric chung

**Đã tạo file:** `backend/src/config/gradingRubric.js`

**Rubric cho câu tự luận ngắn:**
- ✅ **8-10 điểm (80-100%)**: Đúng ý chính, đầy đủ
- ✅ **6-7 điểm (60-70%)**: Đúng ý nhưng thiếu 1 phần nhỏ
- ✅ **3-5 điểm (30-50%)**: Có nhắc đến đúng khái niệm nhưng mơ hồ
- ✅ **0-2 điểm (0-20%)**: Lạc đề / Nói sai

**Các hàm hỗ trợ:**
- `getRubricForQuestion()` - Lấy rubric phù hợp
- `createRubricPrompt()` - Tạo prompt cho LLM
- `similarityToScore()` - Chuyển similarity thành điểm

## 📁 CÁC FILE ĐÃ TẠO

1. **`backend/src/config/gradingRubric.js`**
   - Định nghĩa rubric chấm điểm
   - Hàm chuyển đổi similarity → score
   - Tạo prompt cho LLM

2. **`backend/src/service/trainingDataService.js`**
   - `getAllEssayQuestions()` - Lấy tất cả câu hỏi tự luận
   - `getAllGradedAnswers()` - Lấy tất cả câu trả lời đã chấm
   - `createTrainingDataset()` - Tạo dataset training
   - `exportTrainingDataset()` - Export ra file JSON

3. **`backend/src/controller/trainingDataController.js`**
   - API endpoints để quản lý dữ liệu training

4. **`backend/src/routes/web.js`** (đã cập nhật)
   - Thêm routes cho training data API

## 🔌 API ENDPOINTS

### GET `/api/hr/training-data/questions`
Lấy tất cả câu hỏi tự luận

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "questionText": "HTML là gì?",
      "correctAnswer": "HTML là ngôn ngữ đánh dấu...",
      "maxScore": 10,
      "questionType": "tuluan",
      "order": 1,
      "testId": 1,
      "testTitle": "Test Frontend"
    }
  ],
  "total": 10
}
```

### GET `/api/hr/training-data/answers`
Lấy tất cả câu trả lời đã chấm

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "questionId": 1,
      "questionText": "HTML là gì?",
      "correctAnswer": "HTML là ngôn ngữ đánh dấu...",
      "candidateAnswer": "HTML là ngôn ngữ markup...",
      "score": 9.5,
      "maxScore": 10,
      "comment": "Đúng ý hoàn toàn",
      "isCorrect": true,
      "gradingMethod": "ai",
      "similarityAI": 0.95,
      "similarityNLP": 0.92
    }
  ],
  "total": 50
}
```

### POST `/api/hr/training-data/dataset`
Tạo dataset training với các filter

**Request Body:**
```json
{
  "minAnswersPerQuestion": 1,
  "includeOnlyManualGraded": false,
  "includeOnlyAIGraded": false,
  "minSimilarity": 0,
  "maxSimilarity": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSamples": 100,
    "totalQuestions": 10,
    "questionsWithAnswers": 10,
    "dataset": [...]
  }
}
```

### POST `/api/hr/training-data/export`
Export dataset ra file JSON (download)

**Request Body:** (giống như `/dataset`)

**Response:** File JSON download

## 📊 CẤU TRÚC DATASET

Mỗi mẫu trong dataset có format:
```json
{
  "questionText": "HTML là gì?",
  "correctAnswer": "HTML là ngôn ngữ đánh dấu...",
  "candidateAnswer": "HTML là ngôn ngữ markup...",
  "maxScore": 10,
  "score": 9.5,
  "normalizedScore": 0.95,
  "similarity": 0.95,
  "isCorrect": true,
  "questionId": 1,
  "answerId": 1,
  "gradingMethod": "ai",
  "comment": "Đúng ý hoàn toàn",
  "testId": 1,
  "testTitle": "Test Frontend"
}
```

## 🎯 BƯỚC TIẾP THEO (PHA B)

1. **Thu thập dữ liệu từ LLM:**
   - Dùng LLM chấm các câu hỏi mẫu
   - Lưu kết quả vào database

2. **Thu thập dữ liệu từ thầy:**
   - Thầy chấm thủ công một số câu
   - Lưu kết quả vào database

3. **Export dataset:**
   - Dùng API `/api/hr/training-data/export`
   - Tải file JSON về

4. **Chuẩn bị cho PHA C:**
   - Dataset đã sẵn sàng cho training ML model

## 📝 GHI CHÚ

- Rubric hiện tại tập trung vào **tự luận ngắn/định nghĩa**
- Có thể mở rộng thêm rubric cho **tự luận dài** trong tương lai
- Dataset có thể filter theo nhiều tiêu chí (grading method, similarity, etc.)
- File export sẽ được lưu trong `backend/exports/`

