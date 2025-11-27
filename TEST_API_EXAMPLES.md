# 📝 TEST API - POSTMAN EXAMPLES

## 🔧 Setup

**Base URL:** `http://localhost:8082`

**Headers:**
```
Content-Type: application/json
```

---

## 1️⃣ TẠO BÀI TEST

### **POST** `/api/hr/tests?userId=2`

**Body:**
```json
{
  "Tieude": "Bài Test JavaScript Cơ Bản",
  "Mota": "Bài test kiểm tra kiến thức JavaScript cho vị trí Frontend Developer",
  "Thoigiantoida": 60,
  "Ngaybatdau": "2025-12-01 00:00:00",
  "Ngayhethan": "2025-12-31 23:59:59",
  "Tongdiem": 100,
  "Trangthai": 1,
  "jobPostingId": 1
}
```

**Response Success:**
```json
{
  "EM": "Tạo bài test thành công!",
  "EC": 0,
  "DT": {
    "id": 1,
    "Tieude": "Bài Test JavaScript Cơ Bản",
    "Mota": "Bài test kiểm tra kiến thức JavaScript cho vị trí Frontend Developer",
    "Thoigiantoida": 60,
    "Ngaybatdau": "2025-12-01T00:00:00.000Z",
    "Ngayhethan": "2025-12-31T23:59:59.000Z",
    "Tongdiem": 100,
    "Trangthai": 1,
    "jobPostingId": 1,
    "createdAt": "2025-11-27T07:30:00.000Z",
    "updatedAt": "2025-11-27T07:30:00.000Z"
  }
}
```

**Response Error (Đã có bài test):**
```json
{
  "EM": "Tin tuyển dụng này đã có bài test rồi!",
  "EC": 5,
  "DT": null
}
```

---

## 2️⃣ THÊM CÂU HỎI ĐƠN

### **POST** `/api/hr/tests/questions?userId=2&testId=1`

**Body:**
```json
{
  "Cauhoi": "JavaScript là gì?",
  "Dapan": "JavaScript là một ngôn ngữ lập trình kịch bản được sử dụng để tạo ra các trang web động và tương tác",
  "Loaicauhoi": "tuluan",
  "Diem": 10
}
```

**Response Success:**
```json
{
  "EM": "Thêm câu hỏi thành công!",
  "EC": 0,
  "DT": {
    "id": 1,
    "Cauhoi": "JavaScript là gì?",
    "Dapan": "JavaScript là một ngôn ngữ lập trình kịch bản được sử dụng để tạo ra các trang web động và tương tác",
    "Loaicauhoi": "tuluan",
    "Diem": 10,
    "Thutu": 1,
    "testId": 1,
    "createdAt": "2025-11-27T07:35:00.000Z",
    "updatedAt": "2025-11-27T07:35:00.000Z"
  }
}
```

---

## 3️⃣ THÊM NHIỀU CÂU HỎI

### **POST** `/api/hr/tests/questions/bulk?userId=2&testId=1`

**Body:**
```json
{
  "questions": [
    {
      "Cauhoi": "Sự khác biệt giữa let, const và var là gì?",
      "Dapan": "let và const có block scope, var có function scope. const không thể gán lại giá trị, let có thể",
      "Loaicauhoi": "tuluan",
      "Diem": 10
    },
    {
      "Cauhoi": "Promise trong JavaScript là gì?",
      "Dapan": "Promise là một object đại diện cho kết quả của một tác vụ bất đồng bộ, có thể ở trạng thái pending, fulfilled hoặc rejected",
      "Loaicauhoi": "tuluan",
      "Diem": 15
    },
    {
      "Cauhoi": "Arrow function khác function thông thường như thế nào?",
      "Dapan": "Arrow function không có this riêng, không có arguments object, không thể dùng làm constructor",
      "Loaicauhoi": "tuluan",
      "Diem": 10
    },
    {
      "Cauhoi": "Closure trong JavaScript là gì?",
      "Dapan": "Closure là một function có thể truy cập vào biến của function cha ngay cả khi function cha đã thực thi xong",
      "Loaicauhoi": "tuluan",
      "Diem": 15
    }
  ]
}
```

**Response Success:**
```json
{
  "EM": "Thêm 4 câu hỏi thành công!",
  "EC": 0,
  "DT": [
    {
      "id": 2,
      "Cauhoi": "Sự khác biệt giữa let, const và var là gì?",
      "Dapan": "let và const có block scope, var có function scope. const không thể gán lại giá trị, let có thể",
      "Loaicauhoi": "tuluan",
      "Diem": 10,
      "Thutu": 2,
      "testId": 1
    },
    // ... 3 câu còn lại
  ]
}
```

---

## 4️⃣ LẤY DANH SÁCH BÀI TEST

### **GET** `/api/hr/tests?userId=2&page=1&limit=10`

**Response Success:**
```json
{
  "EM": "Lấy danh sách bài test thành công!",
  "EC": 0,
  "DT": {
    "tests": [
      {
        "id": 1,
        "Tieude": "Bài Test JavaScript Cơ Bản",
        "Mota": "Bài test kiểm tra kiến thức JavaScript cho vị trí Frontend Developer",
        "Thoigiantoida": 60,
        "Ngaybatdau": "2025-12-01T00:00:00.000Z",
        "Ngayhethan": "2025-12-31T23:59:59.000Z",
        "Tongdiem": 60,
        "Trangthai": 1,
        "jobPostingId": 1,
        "JobPosting": {
          "id": 1,
          "Tieude": "Frontend Developer",
          "Company": {
            "id": 1,
            "Tencongty": "Gradion"
          }
        },
        "questionCount": 5,
        "submissionCount": 0,
        "createdAt": "2025-11-27T07:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalRows": 1,
      "limit": 10
    }
  }
}
```

---

## 5️⃣ LẤY CHI TIẾT BÀI TEST

### **GET** `/api/hr/tests/detail?userId=2&testId=1`

**Response Success:**
```json
{
  "EM": "Lấy chi tiết bài test thành công!",
  "EC": 0,
  "DT": {
    "id": 1,
    "Tieude": "Bài Test JavaScript Cơ Bản",
    "Mota": "Bài test kiểm tra kiến thức JavaScript cho vị trí Frontend Developer",
    "Thoigiantoida": 60,
    "Ngaybatdau": "2025-12-01T00:00:00.000Z",
    "Ngayhethan": "2025-12-31T23:59:59.000Z",
    "Tongdiem": 60,
    "Trangthai": 1,
    "jobPostingId": 1,
    "JobPosting": {
      "id": 1,
      "Tieude": "Frontend Developer",
      "Company": {
        "id": 1,
        "Tencongty": "Gradion"
      }
    },
    "Questions": [
      {
        "id": 1,
        "Cauhoi": "JavaScript là gì?",
        "Dapan": "JavaScript là một ngôn ngữ lập trình kịch bản được sử dụng để tạo ra các trang web động và tương tác",
        "Loaicauhoi": "tuluan",
        "Diem": 10,
        "Thutu": 1,
        "testId": 1
      },
      {
        "id": 2,
        "Cauhoi": "Sự khác biệt giữa let, const và var là gì?",
        "Dapan": "let và const có block scope, var có function scope. const không thể gán lại giá trị, let có thể",
        "Loaicauhoi": "tuluan",
        "Diem": 10,
        "Thutu": 2,
        "testId": 1
      }
      // ... các câu còn lại
    ],
    "statistics": {
      "submissionCount": 0,
      "completedCount": 0,
      "inProgressCount": 0
    }
  }
}
```

---

## 🔍 TEST SCENARIOS

### Scenario 1: Tạo bài test hoàn chỉnh

```bash
# Bước 1: Tạo bài test
POST /api/hr/tests?userId=2
Body: { Tieude, Mota, Thoigiantoida, Ngaybatdau, Ngayhethan, jobPostingId }

# Bước 2: Thêm nhiều câu hỏi
POST /api/hr/tests/questions/bulk?userId=2&testId=1
Body: { questions: [...] }

# Bước 3: Xem chi tiết
GET /api/hr/tests/detail?userId=2&testId=1
```

### Scenario 2: Kiểm tra quyền truy cập

```bash
# HR userId=2 (Gradion) tạo test cho jobPostingId=1 (Gradion) → ✅ OK
POST /api/hr/tests?userId=2
Body: { jobPostingId: 1 }

# HR userId=2 (Gradion) tạo test cho jobPostingId=2 (Samsung) → ❌ Không có quyền
POST /api/hr/tests?userId=2
Body: { jobPostingId: 2 }
```

### Scenario 3: Validate thời gian

```bash
# Ngayhethan <= Ngaybatdau → ❌ Lỗi
POST /api/hr/tests?userId=2
Body: {
  "Ngaybatdau": "2025-12-31",
  "Ngayhethan": "2025-12-01"  // Sai!
}
```

---

## ⚠️ LƯU Ý TRƯỚC KHI TEST:

1. **Chạy migration:**
```bash
cd backend
npx sequelize-cli db:migrate
```

2. **Restart backend server:**
```bash
npm start
```

3. **Kiểm tra userId và jobPostingId:**
- userId=2 là HR của công ty Gradion
- jobPostingId=1 là tin tuyển dụng của Gradion
- Đảm bảo userId có quyền với jobPostingId

4. **Kiểm tra database:**
```sql
-- Xem bảng Test
SELECT * FROM Test;

-- Xem bảng TestQuestion
SELECT * FROM TestQuestion WHERE testId = 1;

-- Xem tổng điểm
SELECT t.id, t.Tieude, t.Tongdiem, 
       COUNT(tq.id) as SoCauHoi,
       SUM(tq.Diem) as TongDiemCauHoi
FROM Test t
LEFT JOIN TestQuestion tq ON t.id = tq.testId
GROUP BY t.id;
```

---

## 🚀 READY TO TEST!

Hãy test các API theo thứ tự:
1. Tạo bài test
2. Thêm câu hỏi (đơn hoặc bulk)
3. Lấy danh sách bài test
4. Lấy chi tiết bài test

Nếu có lỗi, check:
- Console backend
- Database có tạo bảng chưa
- userId và jobPostingId có đúng không

