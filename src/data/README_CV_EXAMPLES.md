# Hướng dẫn thêm CV chuẩn vào hệ thống

## 📋 Mục đích

File `cv_examples.json` chứa CV mẫu chuẩn để dùng làm **few-shot examples** trong prompt LLM. Điều này giúp LLM hiểu rõ hơn về format CV chuẩn và cách chấm điểm.

## 📁 Vị trí file

```
backend/src/data/cv_examples.json
```

## 🔧 Cách thêm CV chuẩn

### Bước 1: Extract text từ CV file

Nếu bạn có CV file (PDF/DOCX), cần extract text trước:

**Cách 1: Dùng service có sẵn (khuyến nghị)**

1. Upload CV lên hệ thống qua API `/api/upload-cv`
2. Lấy `cvText` từ database (Record table, field `cvText`)
3. Copy text đó vào `cv_examples.json`

**Cách 2: Extract thủ công**

- **PDF**: Dùng tool online hoặc Python script
- **DOCX**: Mở bằng Word, copy text ra

### Bước 2: Thêm vào cv_examples.json

Mở file `backend/src/data/cv_examples.json` và thêm vào mảng `examples`:

```json
{
  "examples": [
    {
      "id": 1,
      "name": "CV mẫu chuẩn - Full-stack Developer",
      "cv_text": "NGUYỄN VĂN A\nFull-stack Developer\n\n---\n\nPROFILE\n...",
      "expected_score": 85,
      "notes": "CV chuẩn với đầy đủ thông tin"
    },
    {
      "id": 2,
      "name": "CV mẫu của bạn",
      "cv_text": "PASTE CV TEXT Ở ĐÂY",
      "expected_score": 80,
      "notes": "Ghi chú về CV này"
    }
  ]
}
```

### Bước 3: Format CV text

- **Xóa** các ký tự đặc biệt không cần thiết
- **Giữ** cấu trúc: Profile, Education, Experience, Skills, Projects
- **Đảm bảo** text rõ ràng, dễ đọc

### Bước 4: Set expected_score

- `expected_score`: Điểm mong đợi (0-100) cho CV này
- Dùng để LLM tham khảo khi chấm CV khác

## 📝 Ví dụ CV text format

```
NGUYỄN VĂN A
Full-stack Developer
Email: example@email.com
Phone: 0123456789

---

PROFILE
Full-stack Developer với 3 năm kinh nghiệm...

---

EDUCATION
Đại học CNTT – Kỹ thuật phần mềm (2021–2025)
GPA: 3.6/4.0

---

EXPERIENCE
Software Engineer | ABC Company (01/2023 – Hiện tại)
- Developed RESTful APIs using Node.js...
- Built responsive frontend with React...

---

SKILLS
Frontend: React, Vue.js, TypeScript...
Backend: Node.js, Express, Python...
```

## ⚠️ Lưu ý

1. **Không thêm quá nhiều examples**: Chỉ cần 1-3 CV mẫu tốt nhất
2. **Chọn CV đa dạng**: Nên có CV của các vị trí khác nhau (Frontend, Backend, Full-stack)
3. **CV text không quá dài**: Nếu CV dài, có thể truncate phần không quan trọng
4. **Restart backend** sau khi sửa file để load examples mới

## 🔄 Sau khi thêm CV

1. Restart backend server
2. Test API `/api/candidate/review-cv` với CV mới
3. Kiểm tra xem LLM có chấm chính xác hơn không

## 📊 Cấu trúc JSON

```typescript
{
  "description": "Mô tả file",
  "examples": [
    {
      "id": number,              // ID duy nhất
      "name": string,            // Tên CV mẫu
      "cv_text": string,         // Text đã extract từ CV
      "expected_score": number,  // Điểm mong đợi (0-100)
      "notes": string           // Ghi chú (optional)
    }
  ]
}
```

