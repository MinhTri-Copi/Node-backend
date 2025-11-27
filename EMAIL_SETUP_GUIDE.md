# 📧 Hướng dẫn cấu hình Email cho hệ thống

## 🔐 Bước 1: Tạo App Password từ Gmail

### Yêu cầu:
- Tài khoản Gmail đã bật **Xác minh 2 bước** (2-Step Verification)

### Các bước:
1. Truy cập: https://myaccount.google.com/security
2. Tìm mục **"Xác minh 2 bước"** → Bật nếu chưa bật
3. Sau khi bật, quay lại trang Security
4. Tìm mục **"Mật khẩu ứng dụng"** (App passwords)
5. Chọn:
   - **App**: Mail
   - **Device**: Other (Custom name) → Nhập "Job Application System"
6. Click **Generate**
7. Google sẽ hiển thị mật khẩu 16 ký tự (dạng: `abcd efgh ijkl mnop`)

## ⚙️ Bước 2: Cấu hình file .env

Mở file `backend/.env` và cập nhật:

```env
# Email Configuration
MAIL_USER=your-email@gmail.com
MAIL_PASS=abcdefghijklmnop
```

**⚠️ LƯU Ý QUAN TRỌNG:**
- `MAIL_PASS` phải **KHÔNG có khoảng trắng**
- Nếu Google cho mật khẩu dạng `abcd efgh ijkl mnop`
- Bạn phải gõ thành: `abcdefghijklmnop` (bỏ hết khoảng trắng)

### Ví dụ:
```env
# ❌ SAI - Có khoảng trắng
MAIL_PASS=abcd efgh ijkl mnop

# ✅ ĐÚNG - Không có khoảng trắng
MAIL_PASS=abcdefghijklmnop
```

## 🧪 Bước 3: Test gửi email

1. Restart backend server
2. Đăng nhập với tài khoản HR
3. Vào **Quản lý ứng viên**
4. Chọn một đơn ứng tuyển có trạng thái **"Đang chờ"** (id=2)
5. Click **"Duyệt"** để chuyển sang **"Đã xét duyệt"** (id=4)
6. Kiểm tra:
   - Console backend sẽ hiển thị: `✅ Đã gửi email thông báo duyệt đến: [email]`
   - Ứng viên sẽ nhận email chúc mừng

## 📋 Các trạng thái ứng tuyển

| ID | Tên trạng thái | Gửi email? |
|----|----------------|------------|
| 1  | Đã nộp         | ❌ Không   |
| 2  | Đang chờ       | ❌ Không   |
| 3  | Từ chối        | ✅ Có (email từ chối) |
| 4  | Đã xét duyệt   | ✅ Có (email chúc mừng) |
| 5  | Đã hủy         | ❌ Không   |
| 6  | Đã phỏng vấn   | ❌ Không   |

## 🎨 Template Email

### Email duyệt (id=4):
- **Subject**: 🎉 Chúc mừng! Hồ sơ của bạn đã được duyệt - [Tên vị trí]
- **Nội dung**: Template HTML đẹp với gradient, icon, thông tin chi tiết

### Email từ chối (id=3):
- **Subject**: Thông báo kết quả ứng tuyển - [Tên vị trí]
- **Nội dung**: Template lịch sự, động viên ứng viên

## 🔧 Troubleshooting

### Lỗi: "Invalid login"
- ✅ Kiểm tra `MAIL_USER` có đúng email không
- ✅ Kiểm tra `MAIL_PASS` đã bỏ hết khoảng trắng chưa
- ✅ Kiểm tra đã bật 2-Step Verification chưa
- ✅ Tạo lại App Password mới

### Lỗi: "Connection timeout"
- ✅ Kiểm tra kết nối internet
- ✅ Kiểm tra firewall có chặn port 587 không

### Email không gửi được nhưng không báo lỗi
- ✅ Kiểm tra console backend có log `✅ Đã gửi email...` không
- ✅ Kiểm tra email ứng viên có đúng không
- ✅ Kiểm tra thư mục Spam của ứng viên

## 📞 Liên hệ hỗ trợ

Nếu gặp vấn đề, hãy kiểm tra:
1. Console backend có log lỗi không
2. File `.env` có đúng format không
3. Gmail có bật 2-Step Verification không
4. App Password có còn hiệu lực không

