# 🎓 Quick Start - Free Tier Setup (Sinh viên)

## ⚡ Setup trong 5 phút

### Bước 1: Lấy Gemini API Key (FREE)
1. Truy cập: https://aistudio.google.com/app/apikey
2. Đăng nhập Google
3. Click "Create API Key"
4. Copy key

### Bước 2: Cài Package
```bash
cd Node-backend
npm install @google/generative-ai
```

### Bước 3: Thêm vào .env
```env
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-1.5-flash
```

### Bước 4: Chạy Migration
```bash
npx sequelize-cli db:migrate
```

### Bước 5: Restart Server
```bash
npm start
```

## ✅ Done!

**Tổng cost: $0.00** - Hoàn toàn miễn phí!

### Tính năng FREE:
- ✅ Gemini API (15 req/min, 1M tokens/day)
- ✅ Web Speech API (browser native - free)
- ✅ SpeechSynthesis (browser native - free)

## 🚀 Sử dụng

1. Tạo interview: `/candidate/virtual-interview`
2. Chọn level, language, topics
3. Bắt đầu voice interview
4. Cho phép microphone
5. Ghi âm và trả lời!

## 📝 Lưu ý

- **Browser**: Dùng Chrome hoặc Edge (best support)
- **Microphone**: Cần permission từ browser
- **HTTPS**: Required cho microphone (nếu deploy)

## 🆘 Troubleshooting

**Lỗi API key?**
- Kiểm tra `.env` có `GEMINI_API_KEY`
- Restart server

**Không ghi âm được?**
- Cho phép microphone permission
- Dùng Chrome/Edge

**Rate limit?**
- Đợi 1 phút (15 req/min limit)
- Hoặc upgrade (nếu cần)

---

**Enjoy your FREE virtual interview system!** 🎉

