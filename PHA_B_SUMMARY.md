# PHA B – LẤY DỮ LIỆU THỰC & TẠO BỘ TRAIN

## ✅ ĐÃ HOÀN THÀNH

### Bước B1 – Export dữ liệu từ hệ thống hiện tại

**API Endpoint:**
- `GET /api/debug/export-answers` - Export dữ liệu ra JSON

**Format CSV:**
```
questionId,questionText,correctAnswer,studentAnswer,maxScore,teacherScore
1,"HTML là gì?","HTML là ngôn ngữ đánh dấu...","ngôn ngữ tạo cấu trúc web",1,1
2,"CSS dùng để làm gì?","CSS dùng để tạo kiểu...","giúp web hiển thị đẹp hơn",10,9
```

**Scripts:**
1. `scripts/convert-to-csv.js` - Chuyển JSON sang CSV
2. `scripts/fetch-and-convert.js` - Tự động fetch từ API và convert sang CSV

### Bước B2 – Dùng thầy/bạn/LLM để gắn điểm teacherScore

**API Endpoints:**
- `GET /api/debug/answers-needing-grading` - Lấy danh sách câu cần chấm
- `POST /api/debug/grade-with-llm` - Dùng LLM chấm các câu trả lời

**Scripts:**
- `scripts/import-csv-with-scores.js` - Import CSV đã có teacherScore

## 📁 CÁC FILE ĐÃ TẠO

1. **`backend/src/service/trainingDataService.js`** (đã cập nhật)
   - `exportAnswersForCSV()` - Export dữ liệu theo format CSV

2. **`backend/src/service/trainingDataGradingService.js`** (mới)
   - `gradeAnswerWithLLM()` - Chấm 1 câu bằng LLM
   - `gradeAnswersBatchWithLLM()` - Chấm nhiều câu bằng LLM (batch)
   - `getAnswersNeedingGrading()` - Lấy danh sách câu cần chấm

3. **`backend/src/controller/trainingDataController.js`** (đã cập nhật)
   - `exportAnswersForTraining()` - API export
   - `getAnswersNeedingGrading()` - API lấy danh sách cần chấm
   - `gradeWithLLM()` - API chấm bằng LLM

4. **`backend/scripts/convert-to-csv.js`** (mới)
   - Chuyển JSON sang CSV

5. **`backend/scripts/fetch-and-convert.js`** (mới)
   - Tự động fetch từ API và convert sang CSV

6. **`backend/scripts/import-csv-with-scores.js`** (mới)
   - Import CSV đã có teacherScore

## 🔌 API ENDPOINTS

### GET `/api/debug/export-answers`
Export dữ liệu ra JSON để chuyển sang CSV

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "questionId": 1,
      "questionText": "HTML là gì?",
      "correctAnswer": "HTML là ngôn ngữ đánh dấu...",
      "studentAnswer": "ngôn ngữ tạo cấu trúc web",
      "maxScore": 10,
      "teacherScore": 9
    }
  ],
  "total": 100
}
```

### GET `/api/debug/answers-needing-grading`
Lấy danh sách câu trả lời cần chấm

**Query params:**
- `includeAlreadyGraded` (boolean) - Có lấy cả câu đã chấm không
- `minAnswers` (number) - Số câu trả lời tối thiểu

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "answerId": 1,
      "questionId": 1,
      "questionText": "HTML là gì?",
      "correctAnswer": "HTML là ngôn ngữ đánh dấu...",
      "candidateAnswer": "ngôn ngữ tạo cấu trúc web",
      "maxScore": 10,
      "currentScore": 0,
      "currentComment": ""
    }
  ],
  "total": 50
}
```

### POST `/api/debug/grade-with-llm`
Dùng LLM chấm các câu trả lời

**Request Body:**
```json
{
  "items": [
    {
      "questionId": 1,
      "questionText": "HTML là gì?",
      "correctAnswer": "HTML là ngôn ngữ đánh dấu...",
      "candidateAnswer": "ngôn ngữ tạo cấu trúc web",
      "maxScore": 10
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "questionId": 1,
      "questionText": "HTML là gì?",
      "correctAnswer": "HTML là ngôn ngữ đánh dấu...",
      "candidateAnswer": "ngôn ngữ tạo cấu trúc web",
      "maxScore": 10,
      "teacherScore": 9,
      "teacherComment": "Đúng ý chính, đầy đủ",
      "gradingMethod": "llm"
    }
  ],
  "total": 1
}
```

## 📝 HƯỚNG DẪN SỬ DỤNG

### Bước 1: Export dữ liệu từ DB

**Cách 1: Dùng script tự động**
```bash
cd backend
node scripts/fetch-and-convert.js training-data.csv
```

**Cách 2: Thủ công**
```bash
# 1. Gọi API
curl http://localhost:3000/api/debug/export-answers > training-data.json

# 2. Convert sang CSV
node scripts/convert-to-csv.js training-data.json training-data.csv
```

### Bước 2: Gắn điểm teacherScore

**Cách 1: Dùng LLM chấm**
```bash
# 1. Lấy danh sách cần chấm
curl http://localhost:3000/api/debug/answers-needing-grading > answers.json

# 2. Dùng LLM chấm (POST với body chứa items)
curl -X POST http://localhost:3000/api/debug/grade-with-llm \
  -H "Content-Type: application/json" \
  -d @answers.json
```

**Cách 2: Thầy chấm thủ công**
- Mở file CSV
- Điền cột `teacherScore` thủ công
- Lưu lại

**Cách 3: Kết hợp**
- Thầy chấm 50-100 câu "chuẩn"
- LLM chấm phần còn lại theo rubric

### Bước 3: Import CSV đã có teacherScore

```bash
node scripts/import-csv-with-scores.js training-data-with-scores.csv
```

Script sẽ:
- Validate dữ liệu
- Tạo file JSON: `training-data-with-scores.json`
- Hiển thị thống kê

## 🎯 KẾT QUẢ

Sau khi hoàn thành PHA B, bạn sẽ có:
- ✅ File CSV với đầy đủ: `questionId`, `questionText`, `correctAnswer`, `studentAnswer`, `maxScore`, `teacherScore`
- ✅ Ít nhất vài trăm dòng dữ liệu (càng nhiều càng tốt)
- ✅ `teacherScore` đã được gán (từ LLM hoặc thầy)
- ✅ Dữ liệu sẵn sàng cho PHA C (train ML model)

## 📊 YÊU CẦU DỮ LIỆU

- **Tối thiểu:** 200-300 dòng
- **Lý tưởng:** 500-1000+ dòng
- **Phân bố điểm:** Nên có đủ các mức điểm (0-2, 3-5, 6-7, 8-10)
- **Độ đa dạng:** Nhiều câu hỏi khác nhau, nhiều cách trả lời khác nhau

## 🔄 BƯỚC TIẾP THEO (PHA C)

1. Dùng file CSV/JSON đã có `teacherScore`
2. Train ML model (Python)
3. Đánh giá model
4. Tích hợp vào hệ thống

## 💡 LƯU Ý

- **Chất lượng > Số lượng:** 100 câu được chấm chuẩn tốt hơn 1000 câu chấm sai
- **Kiểm tra lại:** Nên rà soát lại một số câu LLM chấm để đảm bảo chất lượng
- **Backup:** Luôn backup dữ liệu trước khi chỉnh sửa
- **Version control:** Đánh số version cho các file CSV (v1, v2, ...)

