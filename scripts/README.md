# Scripts cho PHA B

## 📋 Danh sách scripts

### 1. `fetch-and-convert.js`
Tự động fetch từ API và convert sang CSV

**Cách dùng:**
```bash
node scripts/fetch-and-convert.js [output.csv] [apiUrl]
```

**Ví dụ:**
```bash
# Mặc định: training-data.csv, http://localhost:3000/api/debug/export-answers
node scripts/fetch-and-convert.js

# Tùy chỉnh
node scripts/fetch-and-convert.js my-data.csv http://localhost:3000/api/debug/export-answers
```

### 2. `convert-to-csv.js`
Chuyển JSON sang CSV

**Cách dùng:**
```bash
node scripts/convert-to-csv.js <input.json> <output.csv>
```

**Ví dụ:**
```bash
# 1. Gọi API và lưu vào file
curl http://localhost:3000/api/debug/export-answers > data.json

# 2. Convert sang CSV
node scripts/convert-to-csv.js data.json data.csv
```

### 3. `import-csv-with-scores.js`
Import CSV đã có teacherScore và validate

**Cách dùng:**
```bash
node scripts/import-csv-with-scores.js <input.csv>
```

**Ví dụ:**
```bash
node scripts/import-csv-with-scores.js training-data-with-scores.csv
```

**Output:**
- File JSON: `training-data-with-scores.json`
- Thống kê: số dòng, điểm trung bình, min/max

## 🔄 Workflow hoàn chỉnh

### Bước 1: Export dữ liệu
```bash
node scripts/fetch-and-convert.js training-data.csv
```

### Bước 2: Gắn điểm teacherScore
- **Cách 1:** Dùng LLM qua API `/api/debug/grade-with-llm`
- **Cách 2:** Mở CSV, điền thủ công cột `teacherScore`
- **Cách 3:** Kết hợp (thầy chấm 50-100 câu, LLM chấm phần còn lại)

### Bước 3: Validate và import
```bash
node scripts/import-csv-with-scores.js training-data-with-scores.csv
```

## 📝 Format CSV

CSV phải có header:
```
questionId,questionText,correctAnswer,studentAnswer,maxScore,teacherScore
```

Ví dụ:
```
1,"HTML là gì?","HTML là ngôn ngữ đánh dấu...","ngôn ngữ tạo cấu trúc web",10,9
2,"CSS dùng để làm gì?","CSS dùng để tạo kiểu...","giúp web hiển thị đẹp",10,8
```

## ⚠️ Lưu ý

- Đảm bảo backend đang chạy trước khi dùng `fetch-and-convert.js`
- CSV phải có đầy đủ 6 cột
- `teacherScore` phải >= 0 và <= `maxScore`
- Nên backup dữ liệu trước khi chỉnh sửa

