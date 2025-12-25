# Cài đặt Google Gemini API (FREE)

## Bước 1: Cài đặt Package

```bash
cd Node-backend
npm install @google/generative-ai
```

## Bước 2: Lấy API Key (FREE)

1. Truy cập: https://aistudio.google.com/app/apikey
2. Đăng nhập bằng Google account
3. Click "Create API Key"
4. Copy API key

## Bước 3: Thêm vào .env

```env
# Gemini API (FREE TIER)
GEMINI_API_KEY=your-api-key-here
GEMINI_MODEL=gemini-1.5-flash

# Có thể xóa OpenAI keys (không cần nữa)
# OPENAI_API_KEY=...
```

## Bước 4: Restart Server

```bash
npm start
```

## ✅ Done!

Bây giờ hệ thống sẽ sử dụng:
- ✅ Gemini API (FREE) cho conversation
- ✅ Web Speech API (FREE) cho speech-to-text
- ✅ SpeechSynthesis (FREE) cho text-to-speech

**Tổng cost: $0.00** 🎉

