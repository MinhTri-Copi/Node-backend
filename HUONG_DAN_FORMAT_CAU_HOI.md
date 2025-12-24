# HƯỚNG DẪN FORMAT CÂU HỎI CHO FILE WORD

## 📝 FORMAT CHUẨN CHO CÂU TRẮC NGHIỆM

### Cách 1: Options trong phần đáp án (Khuyến nghị)

```
Câu 1: Trong hệ thống, thuật toán nào được sử dụng để chuyển đổi nội dung CV và JD thành dạng vector?
Đáp án: A. Linear Regression B. Sentence-BERT C. MD5 Hash D. Regex
```

**Lưu ý:**
- Các lựa chọn A, B, C, D nằm trong phần "Đáp án:"
- Format: `A. text B. text C. text D. text`
- Đáp án đúng có thể là: `A`, `B`, `C`, hoặc `D` (nếu có chỉ định riêng)

### Cách 2: Options trong phần câu hỏi

```
Câu 2: Tại sao hệ thống sử dụng MD5 Hash khi ứng viên upload CV?
A. Để bảo mật nội dung CV bằng cách mã hóa
B. Để kiểm tra file trùng lặp, tránh việc AI phải extract dữ liệu lại
C. Để chuyển đổi file PDF sang văn bản thuần túy
D. Để nén dung lượng file giúp tiết kiệm bộ nhớ
Đáp án: B
```

**Lưu ý:**
- Các lựa chọn A, B, C, D nằm trong phần câu hỏi
- Mỗi lựa chọn trên một dòng riêng
- Đáp án chỉ là chữ cái: `A`, `B`, `C`, hoặc `D`

### Cách 3: Options với dấu ngoặc

```
Câu 3: Vai trò chính của mô hình Linear Regression là gì?
A) Dự đoán điểm số dựa trên cosine similarity
B) Phân loại câu hỏi tự động
C) Extract thông tin từ CV
D) Mã hóa dữ liệu
Đáp án: A
```

## 📝 FORMAT CHO CÂU TỰ LUẬN

```
Câu 4: Giải thích cách hoạt động của thuật toán Sentence-BERT trong hệ thống.
Đáp án: Sentence-BERT là mô hình được sử dụng để chuyển đổi văn bản thành vector embeddings. Nó nhận input là câu văn bản và output là một vector số có chiều dài cố định (thường là 384 hoặc 768 dimensions). Vector này capture semantic meaning của câu, cho phép tính toán cosine similarity giữa các câu để đánh giá độ tương đồng về mặt ngữ nghĩa.
```

## 📋 FILE MẪU HOÀN CHỈNH

Copy nội dung sau vào file Word:

---

Câu 1: Trong hệ thống, thuật toán nào được sử dụng để chuyển đổi nội dung CV và JD thành dạng vector nhằm tính toán độ tương đồng (Matching Score)?
Đáp án: A. Linear Regression B. Sentence-BERT C. MD5 Hash D. Regex (Regular Expression)

Câu 2: Tại sao hệ thống sử dụng MD5 Hash khi ứng viên upload CV?
A. Để bảo mật nội dung CV bằng cách mã hóa
B. Để kiểm tra file trùng lặp (duplicate), tránh việc AI phải extract dữ liệu lại cho cùng một file
C. Để chuyển đổi file PDF sang văn bản thuần túy
D. Để nén dung lượng file giúp tiết kiệm bộ nhớ
Đáp án: B

Câu 3: Vai trò chính của mô hình Linear Regression trong quy trình chấm điểm bài test tự luận là gì?
Đáp án: Mô hình Linear Regression được sử dụng để dự đoán điểm số dựa trên cosine similarity giữa đáp án đúng và đáp án của ứng viên. Nó nhận input là cosine similarity (một giá trị từ 0-1) và output là tỷ lệ điểm (ratio) từ 0-1, sau đó nhân với điểm tối đa để ra điểm cuối cùng.

Câu 4: Khi HR tham gia phỏng vấn trực tuyến và muốn ghi hình (Recording), tại sao việc chọn "Share tab audio" lại là bắt buộc?
Đáp án: A. Để có video chất lượng cao hơn B. Để ghi lại âm thanh của cuộc phỏng vấn, nếu không bật "Share tab audio" thì recording sẽ không có tiếng C. Để tăng tốc độ upload file D. Để giảm dung lượng file recording

Câu 5: Trong giai đoạn phân loại câu hỏi bằng LLM, tiêu chí nào sau đây KHÔNG nằm trong 4 tiêu chí phân loại tự động?
A. Loại câu hỏi (Tự luận/Trắc nghiệm)
B. Chủ đề (OOP, Backend, Frontend...)
C. Độ dài (Ngắn/Trung bình/Dài)
D. Độ khó (Dễ/Trung bình/Khó)
E. Thời gian làm bài
Đáp án: E

---

## ✅ KẾT QUẢ MONG ĐỢI SAU KHI UPLOAD

- **Câu 1:** Trắc nghiệm, có 4 options: A. Linear Regression, B. Sentence-BERT, C. MD5 Hash, D. Regex
- **Câu 2:** Trắc nghiệm, có 4 options (từ câu hỏi), đáp án: B
- **Câu 3:** Tự luận (đáp án dài, không có A/B/C/D)
- **Câu 4:** Trắc nghiệm, có 4 options từ đáp án
- **Câu 5:** Trắc nghiệm, có 5 options (A-E), đáp án: E

## 🔍 LƯU Ý KHI TẠO FILE

1. **Mỗi câu hỏi bắt đầu bằng:** "Câu X:" hoặc "Câu hỏi X:" hoặc "X."
2. **Đáp án bắt đầu bằng:** "Đáp án:" hoặc "Answer:"
3. **Options có thể:**
   - Nằm trong phần đáp án: `Đáp án: A. text B. text C. text D. text`
   - Nằm trong phần câu hỏi: Mỗi dòng một option `A. text\nB. text\nC. text\nD. text`
4. **Đáp án đúng:** Có thể là chữ cái đơn (A, B, C, D) hoặc nằm trong chuỗi options

## 🚀 CÁCH TEST

1. Copy nội dung trên vào file Word (.docx)
2. Upload file qua giao diện HR
3. Kiểm tra log backend để xem:
   - Số câu hỏi có options
   - Số câu trắc nghiệm được detect
4. Kiểm tra trong bộ đề:
   - Câu trắc nghiệm có hiển thị options không
   - Loại câu hỏi đúng không
5. Thêm vào bài test và kiểm tra:
   - Ứng viên làm bài có thấy radio buttons không

