# Tự Động Sinh Training Data Khi Upload Đề

## 📋 Tổng Quan

Hệ thống đã được tích hợp tính năng **tự động sinh training data** khi HR upload bộ đề mới. Tính năng này:

- ✅ Tự động gọi LLM để sinh training samples (4 mẫu/câu: đúng/đúng phần/sai/rác)
- ✅ Tự động lưu vào `ml-grader/grading_data.csv`
- ✅ Không làm hỏng flow upload nếu có lỗi (có try-catch)
- ✅ Chỉ xử lý câu hỏi tự luận có đáp án

## 🔧 Cấu Hình

Thêm vào file `.env`:

```env
# Tự động sinh training data khi upload đề (true/false)
AUTO_GENERATE_TRAINING_DATA=true

# Tự động train ML model sau khi có data mới (true/false)
AUTO_TRAIN_ML_MODEL=true

# (Optional) Đường dẫn Python nếu không dùng "python" mặc định
# PYTHON_PATH=python3
```

**Mặc định:** 
- `AUTO_GENERATE_TRAINING_DATA=false` (tắt)
- `AUTO_TRAIN_ML_MODEL=false` (tắt)

**Lưu ý:** `AUTO_TRAIN_ML_MODEL` chỉ hoạt động khi `AUTO_GENERATE_TRAINING_DATA=true`

## 📁 Files Đã Tạo/Chỉnh Sửa

### 1. `backend/src/service/trainingDataGenerationService.js` (MỚI)
Service chính để sinh training data:
- `generateTrainingSamplesForQuestion()` - Sinh samples cho 1 câu hỏi
- `generateTrainingSamplesForQuestions()` - Sinh samples cho nhiều câu hỏi (batch)
- `autoGenerateAndSaveTrainingData()` - Tự động sinh và lưu (được gọi từ upload flow)
- `mergeTrainingSamplesToMainCSV()` - Merge vào `grading_data.csv`

### 2. `backend/src/service/mlTrainingService.js` (MỚI)
Service để train ML model từ Node.js:
- `trainMLModel()` - Train ML model (đồng bộ, đợi kết quả)
- `trainMLModelBackground()` - Train ML model (bất đồng bộ, không block)
- `checkMLModelStatus()` - Kiểm tra trạng thái model

### 3. `backend/src/service/questionBankService.js` (CHỈNH SỬA)
Đã tích hợp vào `uploadQuestionBank()`:
- Sau khi lưu questions vào DB, tự động gọi `autoGenerateAndSaveTrainingData()` nếu `AUTO_GENERATE_TRAINING_DATA=true`
- Tự động train ML model nếu `AUTO_TRAIN_ML_MODEL=true` (chạy background)
- Kết quả được trả về trong response (không bắt buộc)

## 🔄 Luồng Hoạt Động

```
HR Upload Đề
    ↓
Parse File → Extract Questions
    ↓
Phân Loại Câu Hỏi (LLM) → Lưu vào DB
    ↓
[AUTO_GENERATE_TRAINING_DATA=true?]
    ↓ YES
Lọc Câu Tự Luận Có Đáp Án
    ↓
Gọi LLM Sinh Training Samples (4 mẫu/câu)
    ↓
Merge vào ml-grader/grading_data.csv
    ↓
[AUTO_TRAIN_ML_MODEL=true?]
    ↓ YES
Train ML Model (Background - không block)
    ↓
Trả Response (bao gồm thông tin training data + training status)
```

## 📊 Format Training Data

Mỗi training sample có format:
```csv
questionId,questionText,correctAnswer,studentAnswer,maxScore,teacherScore,label
```

Ví dụ:
```csv
1,"Câu hỏi về OOP","Đáp án đúng","Câu trả lời của học viên",10,8.5,"correct"
```

## 🎯 Sử Dụng

### 1. Bật Tính Năng

Thêm vào `.env`:
```env
AUTO_GENERATE_TRAINING_DATA=true
```

### 2. Upload Đề

Khi HR upload bộ đề qua `/api/hr/question-banks/upload`, hệ thống sẽ:
- Parse và lưu questions vào DB (như bình thường)
- **Tự động** sinh training data cho câu tự luận
- Merge vào `ml-grader/grading_data.csv`

### 3. Response

Response sẽ bao gồm thông tin training data và training status:
```json
{
  "EM": "Upload và trích xuất bộ đề thành công!",
  "EC": 0,
  "DT": {
    "questionBankId": 1,
    "totalQuestions": 10,
    "fileName": "de-thi.txt",
    "trainingDataGenerated": {
      "success": true,
      "samplesCount": 16,
      "totalRowsInCSV": 206,
      "message": "Đã sinh 16 training samples và merge vào grading_data.csv | Đã bắt đầu train ML model trong background",
      "trainingResult": {
        "success": true,
        "message": "Đã bắt đầu train ML model trong background",
        "trainingInProgress": true
      }
    }
  }
}
```

### 4. Train ML Model

**Cách 1: Tự động (Khuyến nghị)**
- Set `AUTO_TRAIN_ML_MODEL=true` trong `.env`
- Hệ thống sẽ tự động train ML model trong background sau khi merge CSV
- Không cần chạy lệnh thủ công

**Cách 2: Thủ công**
Nếu tắt tự động train, sau khi có training data mới, chạy:
```bash
cd ml-grader
python train_grader.py grading_data.csv
```

## ⚠️ Lưu Ý

1. **Performance:** 
   - Sinh training data có thể mất thời gian (200ms delay giữa các câu hỏi để tránh quá tải LLM)
   - Train ML model chạy trong background, không block flow upload (có thể mất 1-5 phút tùy data)

2. **Error Handling:** 
   - Nếu LLM lỗi, flow upload vẫn thành công (chỉ log warning)
   - Nếu train ML lỗi, flow upload vẫn thành công (chỉ log warning)

3. **Duplicate Prevention:** Hệ thống tự động loại bỏ duplicate dựa trên `questionId + studentAnswer`

4. **Chỉ Câu Tự Luận:** Chỉ sinh training data cho câu hỏi có `Loaicauhoi='tuluan'` và có đáp án

5. **Python Requirements:**
   - Cần cài Python và các thư viện: `pandas`, `numpy`, `sentence-transformers`, `scikit-learn`, `joblib`
   - Nếu Python không ở PATH, set `PYTHON_PATH=python3` trong `.env`
   - Train ML model có timeout 5 phút (có thể điều chỉnh)

## 🔍 So Sánh Với Script Thủ Công

| Tính năng | Script Thủ Công | Tự Động Khi Upload |
|----------|----------------|-------------------|
| Chạy khi nào | Admin chạy script | Tự động khi upload |
| Input | Tất cả câu hỏi trong DB | Chỉ câu hỏi vừa upload |
| Output | File CSV riêng | Merge vào `grading_data.csv` |
| Cần merge thủ công | ✅ Có | ❌ Không |
| Train ML model | ❌ Phải chạy thủ công | ✅ Tự động (nếu bật) |

## 📝 Ví Dụ

### Upload đề có 5 câu tự luận:

1. HR upload file → Parse → 5 câu tự luận được lưu vào DB
2. Hệ thống tự động:
   - Gọi LLM sinh 4 mẫu/câu = 20 training samples
   - Merge vào `grading_data.csv`
   - (Nếu `AUTO_TRAIN_ML_MODEL=true`) Train ML model trong background
3. Response trả về: 
   - `"samplesCount": 20`
   - `"trainingInProgress": true` (nếu đang train)
4. ML model sẽ được cập nhật tự động sau khi train xong (không cần can thiệp)

## 🚀 Tối Ưu Hóa

- **Batch Processing:** Xử lý tuần tự từng câu (tránh quá tải LLM)
- **Delay:** 200ms giữa các câu hỏi
- **Error Recovery:** Tiếp tục với câu tiếp theo nếu 1 câu lỗi
- **Duplicate Check:** Tự động loại bỏ duplicate khi merge

