# Tài Liệu Chi Tiết: AI Hỗ Trợ CV Review và Highlight Vấn Đề

## 1. Tổng Quan Hệ Thống

### 1.1. Mục Đích
Hệ thống AI CV Review là một công cụ tự động đánh giá và cải thiện CV của ứng viên dựa trên:
- **CV Standards**: Tiêu chuẩn định dạng và nội dung CV chuẩn
- **Scoring Rubric**: Bảng chấm điểm chi tiết theo từng tiêu chí
- **Job Descriptions (JD)**: So sánh CV với mô tả công việc để đánh giá độ phù hợp
- **Reference CVs**: CV mẫu chuẩn để AI học cách đánh giá (few-shot learning)

### 1.2. Kiến Trúc Tổng Thể

```
┌─────────────────┐
│  Frontend       │
│  (React)        │
│  - Upload CV    │
│  - View Review  │
│  - Highlight    │
└────────┬────────┘
         │
         │ HTTP Request
         │
┌────────▼────────┐
│  Backend        │
│  (Node.js)      │
│  - Extract CV   │
│  - Review CV    │
│  - Return JSON  │
└────────┬────────┘
         │
         │ API Call
         │
┌────────▼────────┐
│  LLM Studio     │
│  (Qwen 2.5 7B)  │
│  - Analyze CV   │
│  - Score CV     │
│  - Find Issues  │
└─────────────────┘
```

## 2. Quy Trình Hoạt Động Chi Tiết

### 2.1. Luồng Xử Lý CV Review

#### Bước 1: Upload và Extract CV Text
1. **Frontend**: Người dùng upload file CV (PDF/DOCX)
2. **Backend**: 
   - Lưu file vào `public/uploads/`
   - Extract text từ PDF/DOCX → lưu vào database (bảng `Record`)
   - Text được lưu trong field `cvText`

#### Bước 2: Gọi API Review CV
**Endpoint**: `POST /api/candidate/review-cv`

**Request Body**:
```json
{
  "recordId": 123,
  "jdTexts": [
    "Job Description 1...",
    "Job Description 2..."
  ]
}
```

**Validation**:
- `recordId` phải tồn tại và thuộc về user hiện tại
- `jdTexts` phải là array, tối thiểu 1 JD, tối đa 5 JD
- CV text phải tồn tại trong database

#### Bước 3: Load Dữ Liệu Chuẩn
Backend load 3 file JSON:
1. **`cv_standards.json`**: Tiêu chuẩn định dạng CV
   - Format cho từng section (summary, experience, skills, education)
   - Good examples và bad examples
   - Common issues

2. **`cv_scoring.json`**: Rubric chấm điểm
   - Trọng số (weight) cho từng tiêu chí:
     - Summary: 15 điểm
     - Skills: 20 điểm
     - Experience: 30 điểm (quan trọng nhất)
     - Education: 10 điểm
     - Format: 15 điểm
     - Job Matching: 10 điểm
   - Tổng: 100 điểm
   - Criteria cho từng mức điểm (excellent/good/fair/poor)

3. **`cv_examples.json`**: CV mẫu chuẩn (optional)
   - Dùng cho few-shot learning
   - Mỗi example có: id, name, cv_text, expected_score
   - AI sẽ chọn 1-3 examples phù hợp với role của CV (Mobile/Backend/Frontend)

#### Bước 4: Detect Language và Role
- **Language Detection**: Phát hiện CV là tiếng Việt hay tiếng Anh
  - Dựa trên ký tự có dấu (à, á, ạ, ...)
  - Dựa trên từ khóa phổ biến (và, của, cho, ...)
  - Response sẽ trả về bằng ngôn ngữ tương ứng

- **Role Detection**: Phát hiện role của ứng viên
  - Mobile: Flutter, React Native, Swift, Kotlin
  - Frontend: React, Vue, Angular
  - Backend: Node.js, Spring, Django
  - Fullstack: fullstack, full-stack

#### Bước 5: Build Prompt cho LLM

**System Prompt**:
```
You are an AI CV reviewer. Help candidates IMPROVE their CV, don't create new content.
Rules: Only suggest improvements to existing content. Don't invent experiences/skills. Return JSON only.

CRITICAL: When you find an issue, you MUST extract the exact_quote (verbatim text) from the CV. 
- exact_quote must match the original text character-by-character (no paraphrasing, no fixing typos, no rewriting)
- If the issue is general (no specific text), set exact_quote to null
- This is required for frontend to highlight the exact location in the PDF
```

**User Prompt** bao gồm:
1. CV Standards (JSON)
2. Scoring Rubric (JSON)
3. Reference CVs (nếu có, tối đa 3 examples)
4. Candidate CV (truncated nếu quá dài)
5. Job Descriptions (tối đa 5 JD, mỗi JD truncated nếu quá dài)
6. Language instruction (Vietnamese/English)
7. Tasks:
   - Evaluate CV against each rubric criterion → assign scores
   - Check format issues → suggest improvements
   - Compare CV with JD → suggest how to better present
   - For each issue: section, exact_quote, suggestion, severity
   - Determine ready status (score >= 80 and no high severity issues)

**Token Optimization**:
- Context window: 4096 tokens (Qwen 7B)
- CV text: max ~1500 tokens (~6000 chars)
- JD text: max ~300 tokens mỗi JD (~1200 chars)
- Reference CVs: tùy vào tokens còn lại (mỗi example ~250 tokens)
- Reserve ~1500 tokens cho response

#### Bước 6: Gọi LLM Studio
- **Model**: Qwen 2.5 7B Instruct
- **Temperature**: 0.3 (thấp để output nhất quán)
- **Max Tokens**: Dynamic (dựa trên prompt size)
- **Timeout**: 10 phút (600000ms)

#### Bước 7: Parse và Validate Response
LLM trả về JSON:
```json
{
  "criteria_scores": {
    "summary": 12,
    "skills": 16,
    "experience": 22,
    "education": 8,
    "format": 10,
    "job_matching": 7
  },
  "ready": false,
  "issues": [
    {
      "section": "experience",
      "exact_quote": "Worked on backend",
      "suggestion": "Chỉ rõ công nghệ (ví dụ: Node.js) và kết quả (ví dụ: cải thiện thời gian phản hồi 40%)",
      "severity": "high"
    }
  ],
  "summary": "CV được chấm 75/100 điểm. Có 3 vấn đề cần sửa."
}
```

**Validation và Processing**:
1. Parse JSON từ response (xử lý markdown code blocks, reasoning tags)
2. Tính tổng điểm từ `criteria_scores`:
   ```
   totalScore = (sum of scores) / (sum of weights) * 100
   ```
3. Auto-determine `ready` nếu chưa có:
   - `ready = true` nếu `totalScore >= 80` và không có `severity: "high"`
4. Backward compatibility: Support cả `exact_quote` và `original_text`
5. Add `matchRateInterpretation`:
   - >= 85: "Rất phù hợp / Short-list"
   - >= 70: "Phù hợp tốt"
   - >= 60: "Có thể phỏng vấn"
   - < 60: "Cần chỉnh sửa CV"

#### Bước 8: Return Response
```json
{
  "success": true,
  "data": {
    "score": 75,
    "criteria_scores_detail": { ... },
    "ready": false,
    "issues": [ ... ],
    "summary": "...",
    "matchRateInterpretation": "Phù hợp tốt"
  }
}
```

## 3. Cách AI Chấm Điểm CV

### 3.1. Scoring Rubric (Bảng Chấm Điểm)

#### 3.1.1. Summary (15 điểm)
- **Excellent (12-15)**: Ngắn gọn, rõ ràng, highlight đúng kỹ năng chính, nêu rõ vị trí IT
- **Good (9-11)**: Có nội dung nhưng hơi dài hoặc thiếu một số điểm
- **Fair (5-8)**: Có nội dung nhưng chung chung, không cụ thể
- **Poor (0-4)**: Thiếu hoặc quá chung chung, không có giá trị

#### 3.1.2. Skills (20 điểm)
- **Excellent (16-20)**: Nhóm rõ ràng, liệt kê đầy đủ công nghệ cụ thể, phù hợp với vị trí IT
- **Good (12-15)**: Có nhóm nhưng thiếu một số công nghệ quan trọng
- **Fair (6-11)**: Liệt kê chung chung, không cụ thể
- **Poor (0-5)**: Thiếu hoặc quá ít kỹ năng

#### 3.1.3. Experience (30 điểm - Quan trọng nhất)
- **Excellent (24-30)**: Có đầy đủ thời gian, công ty, công nghệ, và kết quả/metrics
- **Good (18-23)**: Có đủ thông tin cơ bản nhưng thiếu metrics
- **Fair (9-17)**: Thiếu một số thông tin quan trọng (thời gian, công nghệ, hoặc kết quả)
- **Poor (0-8)**: Thiếu nhiều thông tin, mô tả chung chung

#### 3.1.4. Education (10 điểm)
- **Excellent (8-10)**: Format chuẩn, có đầy đủ thông tin (trường, ngành, thời gian)
- **Good (6-7)**: Có thông tin nhưng format chưa chuẩn
- **Fair (3-5)**: Thiếu một số thông tin
- **Poor (0-2)**: Thiếu hoặc format không rõ ràng

#### 3.1.5. Format (15 điểm)
- **Excellent (12-15)**: Format nhất quán, không lỗi chính tả, cấu trúc rõ ràng
- **Good (9-11)**: Format tốt nhưng có một vài lỗi nhỏ
- **Fair (5-8)**: Format chưa nhất quán hoặc có lỗi chính tả
- **Poor (0-4)**: Format lộn xộn, nhiều lỗi

#### 3.1.6. Job Matching (10 điểm)
- **Excellent (8-10)**: CV có đầy đủ kỹ năng và kinh nghiệm phù hợp với JD
- **Good (6-7)**: CV có phần lớn kỹ năng phù hợp nhưng thiếu một số điểm
- **Fair (3-5)**: CV có một số kỹ năng phù hợp nhưng thiếu nhiều yêu cầu
- **Poor (0-2)**: CV không phù hợp với JD

### 3.2. Tính Tổng Điểm

```javascript
// Backend tính điểm từ criteria_scores
totalWeightedScore = 0;
totalMaxScore = 0;

Object.keys(rubric).forEach(criterion => {
    const weight = rubric[criterion]?.weight || 0;  // e.g., 30 for experience
    const score = result.criteria_scores[criterion] || 0;  // e.g., 22
    
    // Clamp score to [0, weight]
    const clampedScore = Math.max(0, Math.min(weight, score));
    
    totalWeightedScore += clampedScore;
    totalMaxScore += weight;
});

// Calculate percentage (0-100)
totalScore = (totalWeightedScore / totalMaxScore) * 100;
```

**Ví dụ**:
- Summary: 12/15
- Skills: 16/20
- Experience: 22/30
- Education: 8/10
- Format: 10/15
- Job Matching: 7/10
- **Tổng**: 75/100 = 75%

### 3.3. Ready Status
CV được coi là "ready" (sẵn sàng nộp) nếu:
- `totalScore >= 80` VÀ
- Không có issue nào có `severity: "high"`

## 4. Cách Highlight Vấn Đề

### 4.1. Backend: Trả Về exact_quote

LLM phải trả về `exact_quote` (văn bản chính xác từ CV) cho mỗi issue:
```json
{
  "section": "experience",
  "exact_quote": "Worked on backend",  // Phải match character-by-character
  "suggestion": "Chỉ rõ công nghệ (ví dụ: Node.js) và kết quả...",
  "severity": "high"
}
```

**Lưu ý**:
- `exact_quote` phải là văn bản gốc từ CV (không paraphrase, không sửa lỗi chính tả)
- Nếu issue là general (không có text cụ thể), set `exact_quote: null`
- Backend hỗ trợ backward compatibility: nếu không có `exact_quote`, dùng `original_text`

### 4.2. Frontend: Tìm Vị Trí Text trong CV

#### 4.2.1. Text Matching Algorithm

Frontend sử dụng **fuzzy matching** để tìm `exact_quote` trong CV text:

**Bước 1: Normalize Text**
```javascript
const normalizeText = (str) => {
    return str
        .replace(/[.,;:!?\-_()\[\]{}"'`]/g, ' ')  // Remove punctuation
        .replace(/\s+/g, ' ')                      // Multiple spaces to single
        .trim()
        .toLowerCase();
};
```

**Bước 2: Exact Match**
- Tìm `normalizedSearch` trong `normalizedFull`
- Nếu tìm thấy, map lại vị trí trong original text

**Bước 3: Partial Match (nếu exact match thất bại)**
- Tách thành words (length > 2)
- Tìm substring có ít nhất 60% words match
- Map lại vị trí trong original text

**Bước 4: Keyword Match (fallback)**
- Tìm các từ khóa dài nhất (top 5)
- Highlight vị trí của từ khóa đó

**Bước 5: Line Match (fallback cuối cùng)**
- Nếu vẫn không tìm thấy, highlight toàn bộ dòng chứa từ khóa

#### 4.2.2. Map Normalized Position to Original

```javascript
// Build character map: original index -> normalized index
const charMap = [];
for (let i = 0; i < originalText.length; i++) {
    const char = originalText[i].toLowerCase();
    if (/[a-z0-9àáạảã...]/.test(char)) {
        charMap.push({ original: i, normalized: normalizedIndex });
        normalizedIndex++;
    } else {
        charMap.push({ original: i, normalized: -1 });  // Skip
    }
}

// Find start/end positions in original text
```

### 4.3. Render Highlights trong CV Text View

#### 4.3.1. Build Parts với Highlights

Frontend tạo các "parts" (đoạn text) với thông tin highlight:

```javascript
const parts = [
    { text: "Normal text", isIssue: false, issues: null },
    { text: "Worked on backend", isIssue: true, issues: [issue1] },
    { text: "More text", isIssue: false, issues: null }
];
```

**Xử lý Overlapping Issues**:
- Nếu nhiều issues overlap, tất cả đều được highlight
- Mỗi issue có màu riêng (dựa trên index)
- Multiple borders để hiển thị nhiều issues

#### 4.3.2. Render HTML với CSS

```jsx
{parts.map((part, partIndex) => {
    if (part.isIssue && part.issues.length > 0) {
        const issue = part.issues[0];
        const issueColor = getIssueColor(issue.index);
        
        return (
            <span
                className="cv-highlight"
                style={{
                    backgroundColor: `${issueColor}20`,  // 20% opacity
                    borderLeft: `4px solid ${issueColor}`,
                    borderRight: `4px solid ${issueColor}`,
                    paddingLeft: '6px',
                    paddingRight: '6px',
                }}
                title={`${section}: ${suggestion}`}
            >
                {part.text}
            </span>
        );
    } else {
        return <span>{part.text}</span>;
    }
})}
```

**Màu sắc**:
- Mỗi issue có màu riêng dựa trên index (15 màu khác nhau)
- Colors: Red, Orange, Blue, Pink, Purple, Turquoise, ...

### 4.4. Highlight trong PDF Viewer

#### 4.4.1. PDF Text Search

Frontend sử dụng `usePDFTextSearch` hook để tìm text trong PDF:
- Search `exact_quote` trong PDF pages
- Trả về positions (left, top, width, height) cho mỗi match

#### 4.4.2. PDFHighlight Component

Component `PDFHighlight` render overlay boxes trên PDF:

```javascript
// Create overlay div
const overlay = document.createElement('div');
overlay.className = 'pdf-highlight-overlay';
overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 10;
`;

// Create highlight box for each match
highlights.forEach((highlight) => {
    const highlightDiv = document.createElement('div');
    highlightDiv.className = 'pdf-highlight';
    highlightDiv.style.cssText = `
        position: absolute;
        left: ${highlight.left}px;
        top: ${highlight.top}px;
        width: ${highlight.width}px;
        height: ${highlight.height}px;
        border: 3px solid ${color};
        background-color: ${hexToRgba(color, 0.2)};
        border-radius: 3px;
        cursor: pointer;
    `;
    
    // Add number badge
    const numberBadge = document.createElement('span');
    numberBadge.textContent = highlight.issueIndex + 1;
    highlightDiv.appendChild(numberBadge);
    
    overlay.appendChild(highlightDiv);
});
```

**Features**:
- Highlight boxes với border và background color
- Number badge hiển thị số thứ tự issue
- Click để scroll đến issue card tương ứng
- Active state khi issue được chọn

## 5. Cấu Trúc Dữ Liệu

### 5.1. Request/Response

**Request**:
```typescript
{
  recordId: number;
  jdTexts: string[];  // 1-5 JD texts
}
```

**Response**:
```typescript
{
  success: boolean;
  data?: {
    score: number;                    // 0-100
    criteria_scores_detail: {          // Chi tiết điểm từng tiêu chí
      summary: number;                // 0-15
      skills: number;                  // 0-20
      experience: number;              // 0-30
      education: number;               // 0-10
      format: number;                  // 0-15
      job_matching: number;            // 0-10
    };
    ready: boolean;                    // CV sẵn sàng nộp?
    issues: Array<{
      section: string;                 // "experience", "skills", ...
      exact_quote: string | null;      // Văn bản gốc từ CV
      suggestion: string;              // Gợi ý cải thiện
      severity: "low" | "medium" | "high";
    }>;
    summary: string;                   // Tóm tắt đánh giá
    matchRateInterpretation: string;   // "Rất phù hợp / Short-list", ...
  };
  error?: string;
}
```

### 5.2. CV Standards Structure

```json
{
  "profile": {
    "summary": {
      "description": "...",
      "requirements": [...],
      "good_example": "...",
      "bad_example": "..."
    }
  },
  "experience": {
    "format": {
      "description": "...",
      "requirements": [...],
      "good_example": "...",
      "bad_example": "..."
    }
  },
  "skills": { ... },
  "education": { ... },
  "common_issues": {
    "missing_info": [...],
    "vague_descriptions": [...],
    "format_issues": [...]
  }
}
```

### 5.3. Scoring Rubric Structure

```json
{
  "rubric": {
    "summary": {
      "weight": 15,
      "description": "...",
      "criteria": {
        "excellent": "...",
        "good": "...",
        "fair": "...",
        "poor": "..."
      }
    },
    ...
  },
  "total_score": 100,
  "passing_score": 70,
  "ready_threshold": 80
}
```

### 5.4. CV Examples Structure

```json
{
  "description": "...",
  "examples": [
    {
      "id": 1,
      "name": "CV 1 - LINHNGUYỄN (Mobile)",
      "cv_text": "...",
      "expected_score": 85,
      "notes": "..."
    },
    ...
  ]
}
```

## 6. Nghiệp Vụ và Logic

### 6.1. Nguyên Tắc Đánh Giá

1. **Chỉ đề xuất cải thiện, không tạo nội dung mới**
   - AI không được "bịa" kinh nghiệm, kỹ năng
   - Chỉ gợi ý cách trình bày tốt hơn nội dung hiện có

2. **Ưu tiên exact_quote**
   - Phải trích dẫn chính xác văn bản từ CV
   - Để frontend có thể highlight chính xác

3. **Severity Levels**
   - **High**: Vấn đề nghiêm trọng, ảnh hưởng lớn đến điểm số
   - **Medium**: Vấn đề trung bình, nên sửa
   - **Low**: Vấn đề nhỏ, có thể bỏ qua

4. **Section Categories**
   - `summary`: Phần tóm tắt
   - `experience`: Kinh nghiệm làm việc
   - `skills`: Kỹ năng
   - `education`: Học vấn
   - `format`: Định dạng, chính tả
   - `job_matching`: Độ phù hợp với JD
   - `projects`: Dự án
   - `certifications`: Chứng chỉ
   - `languages`: Ngôn ngữ
   - `achievements`: Thành tích

### 6.2. Few-Shot Learning

**Mục đích**: Hướng dẫn AI cách đánh giá (calibration)

**Cách hoạt động**:
1. Detect role của CV (Mobile/Backend/Frontend)
2. Chọn 1-3 CV examples phù hợp với role
3. Include vào prompt với format:
   ```
   [Reference CV 1 - Candidate_001 (Mobile) - Calibration Score: 85]
   [CV text truncated...]
   ```
4. AI học từ examples:
   - Cách chấm điểm (score calibration)
   - Mức độ nghiêm trọng của issues
   - Cách viết suggestions

**Lợi ích**:
- Đánh giá nhất quán hơn
- Phù hợp với chuẩn của công ty
- Có thể điều chỉnh bằng cách thêm/sửa examples

### 6.3. Job Matching Logic

AI so sánh CV với JD để:
1. **Identify Missing Skills**: Kỹ năng JD yêu cầu nhưng CV thiếu
2. **Identify Matching Skills**: Kỹ năng CV có và JD cần
3. **Suggest Improvements**: Cách trình bày để highlight matching skills
4. **Score Job Matching**: 0-10 điểm dựa trên độ phù hợp

**Ví dụ**:
- JD yêu cầu: React, Node.js, MongoDB
- CV có: React, Express, MySQL
- Suggestion: "Nhấn mạnh kinh nghiệm với Node.js (Express framework) và đề cập đến MongoDB nếu có"

### 6.4. Language Handling

**Auto-detect Language**:
- Vietnamese: Có ký tự có dấu (>5%) hoặc từ khóa tiếng Việt (>3 từ)
- English: Mặc định

**Response Language**:
- `suggestion` và `summary` phải bằng ngôn ngữ của CV
- System prompt có instruction rõ ràng

### 6.5. Token Management

**Constraints**:
- Context window: 4096 tokens (Qwen 7B)
- Reserve ~1500 tokens cho response
- Prompt phải fit trong ~2500 tokens

**Optimization Strategy**:
1. Truncate CV text: max 1500 tokens (~6000 chars)
2. Truncate JD texts: max 300 tokens mỗi JD (~1200 chars)
3. Select reference CVs: tùy tokens còn lại (mỗi example ~250 tokens)
4. Shorten system prompt: chỉ giữ thông tin cần thiết

**Fallback**:
- Nếu không đủ tokens cho reference CVs → bỏ qua (in-context learning disabled)
- Vẫn có thể review nhưng không có calibration từ examples

## 7. Frontend Display

### 7.1. CV Review Page Layout

```
┌─────────────────────────────────────────┐
│  Header: Score, Ready Status          │
├─────────────────────────────────────────┤
│  ┌──────────────┬────────────────────┐ │
│  │  Issues List │  CV Preview        │ │
│  │  (Left)      │  (Right)           │ │
│  │              │                     │ │
│  │  - Issue 1   │  [CV Text with     │ │
│  │  - Issue 2   │   Highlights]      │ │
│  │  - Issue 3   │                     │ │
│  └──────────────┴────────────────────┘ │
└─────────────────────────────────────────┘
```

### 7.2. Issue Card

Mỗi issue hiển thị:
- **Section**: Kinh nghiệm, Kỹ năng, ...
- **Severity Badge**: High/Medium/Low (màu sắc)
- **Suggestion**: Gợi ý cải thiện
- **Color**: Màu highlight tương ứng trong CV

### 7.3. Interactive Features

1. **Click Issue Card** → Scroll đến highlight trong CV
2. **Hover Highlight** → Show tooltip với suggestion
3. **Active Issue** → Highlight được highlight đậm hơn
4. **PDF Viewer** → Highlight boxes với number badges

### 7.4. Score Display

- **Total Score**: 0-100 (progress bar)
- **Criteria Scores**: Breakdown từng tiêu chí
- **Match Rate Interpretation**: Text mô tả (Rất phù hợp, Phù hợp tốt, ...)
- **Ready Status**: Badge "Sẵn sàng" hoặc "Cần chỉnh sửa"

## 8. Error Handling

### 8.1. Backend Errors

1. **CV text không tồn tại**:
   ```json
   {
     "EM": "Không tìm thấy CV!",
     "EC": 1
   }
   ```

2. **LLM không trả về JSON hợp lệ**:
   - Log raw response
   - Return error message
   - User có thể thử lại

3. **LLM timeout**:
   - Timeout sau 10 phút
   - Return error, suggest retry

### 8.2. Frontend Errors

1. **Highlight không tìm thấy**:
   - Log warning
   - Fallback: highlight dòng chứa keyword
   - Hoặc bỏ qua issue đó

2. **PDF không load được**:
   - Show error message
   - Fallback: Show CV text view

## 9. Performance Considerations

### 9.1. Backend

- **LLM Call**: 5-10 giây (tùy CV length)
- **Token Optimization**: Giảm prompt size để tăng tốc
- **Caching**: Có thể cache kết quả review (chưa implement)

### 9.2. Frontend

- **Text Matching**: O(n*m) với n = CV length, m = issues count
- **Optimization**: 
  - Normalize text một lần
  - Cache character map
  - Debounce search nếu cần

### 9.3. PDF Highlighting

- **Text Search**: Có thể chậm với PDF lớn
- **Optimization**:
  - Search theo từng page
  - Limit số lượng highlights
  - Lazy load highlights

## 10. Mở Rộng và Cải Thiện

### 10.1. Potential Improvements

1. **Caching**: Cache review results để tránh review lại CV giống nhau
2. **Batch Review**: Review nhiều CV cùng lúc
3. **Custom Rubric**: Cho phép HR tùy chỉnh rubric
4. **Version History**: Lưu lịch sử review để track improvements
5. **Export Report**: Export review report dạng PDF
6. **ML Model**: Train ML model để thay thế LLM (nhanh hơn, rẻ hơn)

### 10.2. Integration Points

- **CV Matching Service**: Dùng kết quả review để improve matching
- **Interview Scheduling**: Tự động schedule interview nếu score >= threshold
- **HR Dashboard**: Thống kê CV quality, common issues

## 11. Kết Luận

Hệ thống AI CV Review là một công cụ mạnh mẽ giúp:
- **Ứng viên**: Cải thiện CV để tăng cơ hội được chọn
- **HR**: Tiết kiệm thời gian review CV thủ công
- **Công ty**: Đảm bảo chất lượng CV đầu vào

**Điểm mạnh**:
- Đánh giá toàn diện theo nhiều tiêu chí
- Highlight chính xác vấn đề trong CV
- Gợi ý cụ thể để cải thiện
- Hỗ trợ đa ngôn ngữ (Việt/Anh)

**Hạn chế**:
- Phụ thuộc vào LLM (có thể chậm, tốn tài nguyên)
- Highlight có thể không chính xác 100% (fuzzy matching)
- Cần fine-tune prompt để cải thiện chất lượng

**Hướng phát triển**:
- Train ML model riêng để tăng tốc và giảm chi phí
- Cải thiện accuracy của highlight
- Thêm nhiều tính năng hỗ trợ HR

