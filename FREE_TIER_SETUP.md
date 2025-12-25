# Free Tier Setup Guide - Virtual Interview Voice Module

## 🎓 Giải pháp 100% FREE cho sinh viên

Module này được tối ưu để **hoàn toàn miễn phí** sử dụng các công nghệ free tier:

### 1. **Google Gemini API** (FREE)
- **Free tier**: 15 requests/minute, 1M tokens/day
- **Model**: `gemini-1.5-flash` (nhanh và miễn phí)
- **Đăng ký**: https://aistudio.google.com/app/apikey

### 2. **Web Speech API** (FREE - Browser Native)
- **Speech-to-Text**: Hoàn toàn miễn phí, không cần API key
- **Hỗ trợ**: Chrome, Edge, Safari
- **Không có cost**: 100% free

### 3. **Browser SpeechSynthesis** (FREE - Browser Native)
- **Text-to-Speech**: Hoàn toàn miễn phí, không cần API key
- **Hỗ trợ**: Tất cả browsers hiện đại
- **Không có cost**: 100% free

## 📋 Setup Instructions

### Bước 1: Lấy Gemini API Key (FREE)

1. Truy cập: https://aistudio.google.com/app/apikey
2. Đăng nhập bằng Google account
3. Click "Create API Key"
4. Copy API key

### Bước 2: Cài đặt Dependencies

```bash
cd Node-backend
npm install @google/generative-ai
```

### Bước 3: Cấu hình Environment Variables

Thêm vào `.env`:
```env
# Gemini API (FREE)
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-1.5-flash

# Remove OpenAI keys (không cần nữa)
# OPENAI_API_KEY=...
```

### Bước 4: Chạy Migrations

```bash
npx sequelize-cli db:migrate
```

## 💰 Cost Breakdown

| Service | Cost | Notes |
|---------|------|-------|
| Gemini API | **FREE** | 15 req/min, 1M tokens/day |
| Web Speech API | **FREE** | Browser native |
| SpeechSynthesis | **FREE** | Browser native |
| **TOTAL** | **$0.00** | 100% free! |

## 🚀 Features

### ✅ Hoàn toàn miễn phí
- Không có hidden costs
- Không cần credit card
- Sử dụng free tier của Google

### ✅ Chất lượng tốt
- Gemini 1.5 Flash: Fast và accurate
- Web Speech API: Real-time transcription
- SpeechSynthesis: Natural voice

### ✅ Browser Compatibility
- Chrome/Edge: Full support
- Safari: Full support
- Firefox: Partial support (may need fallback)

## 📝 Usage

### Frontend tự động sử dụng:
1. **Web Speech API** cho speech-to-text (free)
2. **SpeechSynthesis** cho text-to-speech (free)
3. **Gemini API** cho conversation logic (free tier)

### Không cần cấu hình thêm:
- Browser tự động xử lý voice
- Chỉ cần Gemini API key

## ⚠️ Rate Limits (Free Tier)

### Gemini API:
- **15 requests per minute**
- **1 million tokens per day**
- Đủ cho ~100-200 interviews/day

### Nếu vượt limit:
- Hệ thống sẽ tự động retry
- Hoặc hiển thị message "Please try again later"

## 🔧 Troubleshooting

### Lỗi: "Gemini API key not configured"
- Kiểm tra `.env` có `GEMINI_API_KEY`
- Restart server sau khi thêm

### Lỗi: "Speech recognition not supported"
- Browser không hỗ trợ Web Speech API
- Sử dụng Chrome hoặc Edge (recommended)

### Lỗi: "Rate limit exceeded"
- Đã vượt 15 requests/minute
- Đợi 1 phút rồi thử lại
- Hoặc upgrade lên paid tier (nếu cần)

## 🎯 Best Practices

1. **Monitor usage**: Check Gemini API dashboard
2. **Cache responses**: Giảm API calls
3. **Error handling**: Graceful fallbacks
4. **User feedback**: Clear error messages

## 📚 Resources

- Gemini API Docs: https://ai.google.dev/docs
- Web Speech API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- SpeechSynthesis: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis

## 🎉 Kết luận

Module này **100% FREE** cho sinh viên với:
- ✅ Gemini API free tier
- ✅ Browser native APIs
- ✅ Không có hidden costs
- ✅ Chất lượng tốt

**Enjoy your free virtual interview system!** 🚀

