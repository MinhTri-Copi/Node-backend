# Virtual Interview Voice Module - Setup Guide

## Tổng quan

Module "Phỏng vấn ảo" đã được cập nhật để hỗ trợ:
- **Voice conversation** với HR ảo (AI) thay vì form-based
- **OpenAI API** thay vì LM Studio
- **Real-time voice interaction** sử dụng Web Speech API và OpenAI Whisper/TTS

## Yêu cầu

### 1. OpenAI API Key
- Đăng ký tài khoản tại https://platform.openai.com
- Tạo API key
- Thêm vào `.env`:
```env
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4o-mini  # Hoặc gpt-4o cho chất lượng cao hơn
OPENAI_TTS_MODEL=tts-1    # Text-to-speech model
OPENAI_STT_MODEL=whisper-1 # Speech-to-text model
```

### 2. Dependencies
Đảm bảo các package sau đã được cài:
```bash
npm install openai multer
```

### 3. Database Migration
Chạy migration mới:
```bash
npx sequelize-cli db:migrate
```

Migration sẽ tạo bảng `VirtualInterviewConversation` để lưu lịch sử hội thoại.

## Tính năng

### Voice Interview Flow

1. **Candidate tạo interview** → Chọn level, language, topics
2. **Bắt đầu voice conversation** → AI HR hỏi câu đầu tiên
3. **Candidate ghi âm** → Sử dụng microphone
4. **Speech-to-Text** → Chuyển audio thành text (Web Speech API hoặc OpenAI Whisper)
5. **AI xử lý** → OpenAI GPT phân tích và trả lời
6. **Text-to-Speech** → Chuyển AI response thành audio
7. **Playback** → Phát audio cho candidate
8. **Lặp lại** → Tiếp tục conversation cho đến khi kết thúc

### API Endpoints

#### Voice Conversation
- `POST /api/virtual-interview/:id/voice/start` - Bắt đầu conversation
- `POST /api/virtual-interview/:id/voice/response` - Gửi text response
- `POST /api/virtual-interview/voice/text-to-speech` - Convert text → audio
- `POST /api/virtual-interview/voice/speech-to-text` - Convert audio → text
- `GET /api/virtual-interview/:id/voice/history` - Lấy lịch sử conversation

## Frontend Components

### VirtualInterviewVoice.js
Component chính cho voice interview với:
- Voice recording (Web Speech API hoặc MediaRecorder)
- Audio playback (OpenAI TTS hoặc browser TTS)
- Conversation transcript
- Real-time conversation flow

## Best Practices

### 1. Error Handling
- Luôn có fallback cho Web Speech API (sử dụng OpenAI Whisper)
- Có fallback cho TTS (sử dụng browser SpeechSynthesis)

### 2. Performance
- Sử dụng `gpt-4o-mini` cho cost-effective
- Cache conversation history để giảm API calls
- Debounce voice input để tránh spam

### 3. Security
- Validate audio file size (max 25MB cho Whisper)
- Rate limiting cho API calls
- JWT authentication cho tất cả endpoints

### 4. UX
- Visual feedback khi recording/processing
- Clear instructions cho candidate
- Auto-scroll conversation transcript

## Troubleshooting

### Lỗi: "Speech recognition not supported"
- Browser không hỗ trợ Web Speech API
- Fallback: Sử dụng MediaRecorder + OpenAI Whisper

### Lỗi: "OpenAI API key not configured"
- Kiểm tra `.env` file có `OPENAI_API_KEY`
- Restart server sau khi thêm env variable

### Lỗi: "Error accessing microphone"
- Kiểm tra browser permissions
- Đảm bảo HTTPS (required cho microphone access)

## Cost Estimation

- **GPT-4o-mini**: ~$0.15/1M input tokens, ~$0.60/1M output tokens
- **Whisper**: ~$0.006/minute audio
- **TTS**: ~$15/1M characters

Ước tính: ~$0.10-0.50 per interview (tùy độ dài)

## Next Steps

1. Test voice interview flow end-to-end
2. Add conversation analytics
3. Implement conversation summarization
4. Add multi-language support improvements
5. Optimize audio quality và latency

