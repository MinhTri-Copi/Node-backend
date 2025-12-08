# Hướng dẫn cập nhật dữ liệu training

## Khi nào cần cập nhật?

- Sau khi có thêm nhiều bài test mới
- Sau khi có thêm nhiều câu trả lời mới
- Sau khi thầy chấm thêm nhiều câu
- Khi muốn cải thiện độ chính xác của ML model

## Workflow cập nhật

### Bước 1: Export dữ liệu mới từ backend

```bash
cd backend
# Tự động tạo tên file với timestamp (ví dụ: training-data-2025-01-15T10-30-00.csv)
node scripts/fetch-and-convert.js

# Hoặc chỉ định tên file cụ thể
node scripts/fetch-and-convert.js training-data-2025-01-15.csv
```

### Bước 2: Điền teacherScore cho dữ liệu mới

- Mở file vừa export (ví dụ: `training-data-2025-01-15T10-30-00.csv`)
- Điền cột `teacherScore` cho các dòng mới
- Hoặc dùng LLM chấm:
  ```bash
  # Gọi API để LLM chấm
  curl http://localhost:8082/api/debug/answers-needing-grading > answers.json
  curl -X POST http://localhost:8082/api/debug/grade-with-llm \
    -H "Content-Type: application/json" \
    -d @answers.json
  ```

### Bước 3: Merge dữ liệu mới vào file cũ

```bash
cd backend
# Merge file vừa export (thay tên file cho đúng)
node scripts/merge-training-data.js training-data-2025-01-15T10-30-00.csv
```

Script sẽ:
- Đọc dữ liệu cũ từ `ml-grader/grading_data.csv`
- Đọc dữ liệu mới từ `training-data-new.csv`
- Merge lại (bỏ duplicate)
- Ghi vào `ml-grader/grading_data.csv`

### Bước 4: Train lại model với dữ liệu mới

```bash
cd ml-grader
venv\Scripts\activate
python train_grader.py grading_data.csv
```

### Bước 5: Restart ML service

```bash
# Dừng service cũ (Ctrl+C)
# Chạy lại
python app.py
```

## Lưu ý

- **Backup trước khi merge**: Copy `ml-grader/grading_data.csv` ra file backup
- **Kiểm tra dữ liệu**: Đảm bảo dữ liệu mới có `teacherScore` hợp lệ
- **Train lại model**: Sau khi merge, phải train lại model để model học dữ liệu mới
- **Càng nhiều dữ liệu càng tốt**: Nên có ít nhất 100-200 dòng để model tốt hơn

## Tần suất cập nhật

- **Lần đầu**: Train với dữ liệu hiện có (42 dòng)
- **Sau 1-2 tuần**: Export thêm dữ liệu mới, merge và train lại
- **Sau 1 tháng**: Có thể có 100-200+ dòng, model sẽ tốt hơn nhiều

## Kiểm tra chất lượng model

Sau khi train, kiểm tra:
- **R² score**: > 0.7 là tốt (hiện tại 0.39 do ít dữ liệu)
- **MAE**: < 0.15 là tốt (hiện tại 0.15-0.19)
- **Test thực tế**: Chấm một số câu và so sánh với điểm thầy chấm

