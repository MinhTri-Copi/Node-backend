# 🔧 Hướng Dẫn Setup CV Upload

Khi pull code mới và gặp lỗi **500 Internal Server Error** khi upload CV, hãy làm theo các bước sau:

## ❌ Các Nguyên Nhân Thường Gặp

### 1. **Thiếu Dependencies (npm packages)**

CV upload cần 2 packages để extract text từ PDF/DOCX:
- `pdf-parse`: Extract text từ PDF
- `mammoth`: Extract text từ DOCX

**Giải pháp:**
```bash
cd backend
npm install pdf-parse mammoth
```

### 2. **Thiếu Thư Mục Upload**

Backend cần thư mục để lưu file CV:
- `backend/src/public/uploads/cv`

**Giải pháp:**
```bash
cd backend
npm run setup
# Hoặc chạy: node create-upload-folder.js
```

**Hoặc tạo thủ công:**
- Tạo thư mục: `backend/src/public/uploads/cv`
- Đảm bảo có quyền ghi (Windows: chuột phải → Properties → Security → Edit → Full control)

### 3. **Database Chưa Migrate**

Bảng `Record` cần các cột mới cho CV upload:
- `fileHash` (STRING)
- `extractionStatus` (ENUM: 'PENDING', 'PROCESSING', 'READY', 'FAILED')
- `cvText` (TEXT)
- `cvEmbedding` (TEXT)
- `modelVersion` (STRING)
- `extractedAt` (DATE)
- `errorMessage` (TEXT)

**Giải pháp:**
```bash
cd backend
npx sequelize-cli db:migrate
```

**Kiểm tra migration:**
- File: `backend/src/migrations/20251220000003-add-cv-fields-to-record.js`
- Nếu chưa có, cần tạo migration mới

### 4. **Lỗi Khi Đọc File**

Nếu file chưa được lưu kịp thời, `fs.readFileSync` sẽ fail.

**Giải pháp:**
- Đảm bảo thư mục upload tồn tại và có quyền ghi
- Kiểm tra log backend để xem lỗi cụ thể

## ✅ Checklist Setup Đầy Đủ

Khi pull code mới, chạy các lệnh sau:

```bash
# 1. Cài đặt dependencies
cd backend
npm install

# 2. Tạo thư mục upload
npm run setup
# hoặc: node create-upload-folder.js

# 3. Chạy database migrations
npx sequelize-cli db:migrate

# 4. Kiểm tra database connection
# Đảm bảo file .env có đúng thông tin DB:
# DB_HOST=localhost
# DB_USER=root
# DB_PASSWORD=your_password
# DB_NAME=your_database

# 5. Restart backend server
npm start
```

## 🔍 Debug Lỗi 500

Nếu vẫn gặp lỗi, kiểm tra:

1. **Backend console log:**
   - Xem lỗi cụ thể trong terminal chạy backend
   - Lỗi thường gặp:
     - `Cannot find module 'pdf-parse'` → Chạy `npm install pdf-parse`
     - `ENOENT: no such file or directory` → Chạy `npm run setup`
     - `SequelizeDatabaseError: Unknown column` → Chạy `npx sequelize-cli db:migrate`

2. **Database connection:**
   - Kiểm tra MySQL đang chạy
   - Kiểm tra thông tin DB trong `.env`

3. **File permissions (Windows):**
   - Chuột phải vào `backend/src/public/uploads/cv`
   - Properties → Security → Edit
   - Cho phép Full control cho user hiện tại

## 📝 Lưu Ý

- **CV upload KHÔNG gọi Python API** ngay lập tức
- Chỉ khi **tìm việc phù hợp** mới gọi Python API để embed CV và match với JD
- CV text được extract trong **background job** (không block response)

## 🆘 Vẫn Không Được?

1. Xóa `node_modules` và cài lại:
   ```bash
   cd backend
   rm -rf node_modules
   npm install
   ```

2. Kiểm tra Node.js version:
   - Cần Node.js >= 16
   - `pdf-parse` v2+ cần Node.js 20.16+ hoặc 22.3+
   - Nếu Node.js cũ, downgrade: `npm install pdf-parse@1.1.1`

3. Xem log chi tiết trong backend console khi upload CV

