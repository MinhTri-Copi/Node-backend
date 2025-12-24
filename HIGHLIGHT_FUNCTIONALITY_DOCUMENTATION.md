# TÀI LIỆU TỔNG QUAN: CHỨC NĂNG HIGHLIGHT TRONG CV REVIEW

## MỤC LỤC
1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Kiến trúc và luồng dữ liệu](#2-kiến-trúc-và-luồng-dữ-liệu)
3. [Backend: Yêu cầu exact_quote](#3-backend-yêu-cầu-exact_quote)
4. [Frontend: Text Matching Algorithm](#4-frontend-text-matching-algorithm)
5. [Frontend: CVHighlighter Component](#5-frontend-cvhighlighter-component)
6. [Frontend: PDF Highlight System](#6-frontend-pdf-highlight-system)
7. [Color Management System](#7-color-management-system)
8. [Tương tác người dùng](#8-tương-tác-người-dùng)
9. [Chi tiết kỹ thuật](#9-chi-tiết-kỹ-thuật)
10. [Các file liên quan](#10-các-file-liên-quan)

---

## 1. TỔNG QUAN HỆ THỐNG

### 1.1. Mục đích
Chức năng highlight cho phép hệ thống CV Review:
- **Hiển thị trực quan** các vấn đề (issues) được AI phát hiện trong CV
- **Định vị chính xác** vị trí của từng vấn đề trong cả PDF viewer và text view
- **Tương tác hai chiều**: Click vào issue card → scroll đến highlight, click vào highlight → scroll đến issue card
- **Hỗ trợ đa ngôn ngữ**: Tiếng Việt và Tiếng Anh với xử lý dấu câu đặc biệt

### 1.2. Hai chế độ hiển thị
1. **PDF View**: Highlight dưới dạng boxes overlay trên PDF (sử dụng react-pdf)
2. **Text View**: Highlight dưới dạng inline spans trong CV text

### 1.3. Dữ liệu đầu vào
Mỗi issue từ AI review có cấu trúc:
```json
{
  "section": "experience",
  "exact_quote": "Worked on backend",
  "suggestion": "Specify technologies (e.g., Node.js) and measurable results",
  "severity": "high"
}
```

**Quan trọng**: `exact_quote` phải là text **chính xác** từ CV (character-for-character match).

---

## 2. KIẾN TRÚC VÀ LUỒNG DỮ LIỆU

### 2.1. Luồng xử lý

```
Backend (AI Review)
    ↓
    Tạo issues với exact_quote
    ↓
Frontend (CVReview.js)
    ↓
    ├─→ CVHighlighter Component (Text View)
    │       ↓
    │       Sử dụng findFuzzyLocation() để tìm exact_quote trong cvText
    │       ↓
    │       Render segments với highlight styles
    │
    └─→ usePDFTextSearch Hook (PDF View)
            ↓
            Tìm exact_quote trong PDF text layer
            ↓
            Tính toán bounding boxes (left, top, width, height)
            ↓
            PDFHighlight Component render overlay boxes
```

### 2.2. Các thành phần chính

| Component/Hook | Vai trò | File |
|---------------|---------|------|
| `cvReviewService.js` | Backend: Tạo prompt yêu cầu AI trả về exact_quote | `Node-backend/src/service/cvReviewService.js` |
| `CVHighlighter` | Frontend: Render highlights trong text view | `React-frontend/src/components/CVHighlighter/CVHighlighter.jsx` |
| `PDFHighlight` | Frontend: Render highlight boxes trên PDF | `React-frontend/src/components/PDFHighlight/PDFHighlight.js` |
| `usePDFTextSearch` | Hook: Tìm text trong PDF và tính toán positions | `React-frontend/src/hooks/usePDFTextSearch.js` |
| `stringUtils.js` | Utilities: Fuzzy matching algorithms | `React-frontend/src/utils/stringUtils.js` |
| `colorUtils.js` | Utilities: Color palette management | `React-frontend/src/utils/colorUtils.js` |

---

## 3. BACKEND: YÊU CẦU EXACT_QUOTE

### 3.1. Prompt Engineering

Backend yêu cầu AI phải trả về `exact_quote` cho mỗi issue. Prompt được định nghĩa trong `cvReviewService.js`:

```javascript
const systemPrompt = `...
CRITICAL: You MUST identify a specific text anchor (exact_quote) for every issue so the UI can highlight it. Do not return null unless the CV is empty.
Follow these priority rules to select the exact_quote:
1. **Direct Error:** If fixing a specific sentence/phrase, quote that exact text verbatim.
2. **Missing Information:** If suggesting to ADD something (e.g., 'Add Node.js skill'), quote the **Section Header** (e.g., 'SKILLS', 'TECHNICAL STACK') or the last item in that list where the new info should go.
3. **Vague Section:** If a whole section needs rewriting (e.g., 'Summary is too weak'), quote the **first sentence** of that section.
4. **Format/General:** If the issue is about overall formatting, quote the **Candidate's Name** or the **CV Title** at the top.

**Constraint:** exact_quote must exist in the input text character-for-character (no paraphrasing, no fixing typos, no rewriting). This is required for frontend to highlight the exact location in the PDF.
...`;
```

### 3.2. Validation và Fallback

Backend hỗ trợ backward compatibility:
```javascript
// Priority: exact_quote > original_text
result.issues = result.issues.map(issue => {
    if (!issue.exact_quote && issue.original_text) {
        issue.exact_quote = issue.original_text;
    }
    return issue;
});
```

### 3.3. Response Format

AI phải trả về JSON với format:
```json
{
  "issues": [
    {
      "section": "experience",
      "exact_quote": "Worked on backend",
      "suggestion": "Specify technologies (e.g., Node.js) and measurable results",
      "severity": "high"
    }
  ]
}
```

---

## 4. FRONTEND: TEXT MATCHING ALGORITHM

### 4.1. File: `stringUtils.js`

Hệ thống sử dụng **fuzzy matching** để tìm `exact_quote` trong CV text, xử lý các trường hợp:
- Text có dấu câu khác nhau
- Khoảng trắng khác nhau
- Chữ hoa/thường khác nhau
- Tiếng Việt có/không có dấu

### 4.2. Hàm `normalizeText()`

Chuẩn hóa text để so sánh:

```javascript
export const normalizeText = (str) => {
    if (!str || typeof str !== 'string') return '';
    
    return str
        .toLowerCase()
        // Remove Vietnamese diacritics
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
        // Remove all special characters and punctuation
        .replace(/[.,;:!?\-_()\[\]{}"'`~@#$%^&*+=|\\/<>]/g, ' ')
        // Collapse multiple spaces/newlines/tabs to single space
        .replace(/\s+/g, ' ')
        .trim();
};
```

**Ví dụ**:
- Input: `"Worked on backend."`
- Output: `"worked on backend"`

### 4.3. Hàm `findFuzzyLocation()`

Tìm vị trí của `searchQuote` trong `fullText`:

**Bước 1: Exact Match (Normalized)**
```javascript
const normalizedFull = normalizeText(fullText);
const normalizedSearch = normalizeText(searchQuote);
const exactIndex = normalizedFull.indexOf(normalizedSearch);
if (exactIndex !== -1) {
    return mapNormalizedToOriginal(fullText, normalizedFull, exactIndex, normalizedSearch.length);
}
```

**Bước 2: Fuzzy Match (Sliding Window)**
Nếu exact match thất bại, sử dụng sliding window với similarity threshold ≥ 70%:

```javascript
const minSimilarity = 0.7;
const searchLength = normalizedSearch.length;
const minWindowLength = Math.max(10, Math.floor(searchLength * 0.5));
const maxWindowLength = Math.min(searchLength * 2, normalizedFull.length);

let bestMatch = null;
let bestSimilarity = 0;

for (let start = 0; start <= normalizedFull.length - minWindowLength; start++) {
    for (let windowLength = minWindowLength; windowLength <= Math.min(maxWindowLength, normalizedFull.length - start); windowLength++) {
        const window = normalizedFull.substring(start, start + windowLength);
        const similarity = calculateSimilarity(normalizedSearch, window);
        
        if (similarity > bestSimilarity && similarity >= minSimilarity) {
            bestSimilarity = similarity;
            bestMatch = { start, length: windowLength };
        }
    }
}
```

**Bước 3: Map Normalized Position to Original**

Hàm `mapNormalizedToOriginal()` xây dựng character map để map vị trí từ normalized text về original text:

```javascript
const mapNormalizedToOriginal = (originalText, normalizedText, normalizedStart, normalizedLength) => {
    // Build character map
    let normalizedIndex = 0;
    const charMap = [];
    
    for (let i = 0; i < originalText.length; i++) {
        const char = originalText[i];
        const charLower = char.toLowerCase();
        const normalizedChar = charLower
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[.,;:!?\-_()\[\]{}"'`~@#$%^&*+=|\\/<>]/g, '')
            .trim();
        
        if (normalizedChar.length > 0 && /[a-z0-9]/.test(normalizedChar)) {
            charMap.push({ original: i, normalized: normalizedIndex });
            normalizedIndex++;
        } else {
            charMap.push({ original: i, normalized: -1 });
        }
    }
    
    // Find start and end positions in original text
    // ... (implementation details)
    
    return { start, end };
};
```

### 4.4. Hàm `calculateSimilarity()`

Tính similarity giữa hai string (0-1):

```javascript
const calculateSimilarity = (str1, str2) => {
    // Character-based similarity (60% weight)
    const charSimilarity = matches / longer.length;
    
    // Word-based similarity (40% weight)
    const wordSimilarity = wordMatches / Math.max(words1.length, words2.length);
    
    // Combined similarity
    return charSimilarity * 0.6 + wordSimilarity * 0.4;
};
```

---

## 5. FRONTEND: CVHIGHLIGHTER COMPONENT

### 5.1. File: `CVHighlighter.jsx`

Component render CV text với highlights dưới dạng inline spans.

### 5.2. Xử lý Issues

**Bước 1: Tìm vị trí của mỗi issue**
```javascript
const segments = useMemo(() => {
    const issuePositions = [];
    
    issues.forEach((issue, issueIndex) => {
        const quote = issue.exact_quote || issue.original_text;
        if (!quote || typeof quote !== 'string' || quote.trim().length === 0) {
            return; // Skip issues without quote
        }

        // Try to find the exact quote in CV text
        let position = findFuzzyLocation(cvText, quote);
        
        if (position) {
            // Validate and refine position
            position.start = Math.max(0, Math.min(position.start, cvText.length));
            position.end = Math.max(position.start, Math.min(position.end, cvText.length));
            
            issuePositions.push({
                start: position.start,
                end: position.end,
                issue: { ...issue, index: issueIndex }
            });
        }
    });
    
    // ... (build segments)
}, [cvText, issues]);
```

**Bước 2: Build Segments**

Tạo các segments (đoạn text) với thông tin highlight:

```javascript
// Create breakpoints from all issue positions
const breakpoints = new Set([0, cvText.length]);
issuePositions.forEach(pos => {
    breakpoints.add(pos.start);
    breakpoints.add(pos.end);
});

const sortedBreakpoints = Array.from(breakpoints).sort((a, b) => a - b);

// Build segments between breakpoints
for (let i = 0; i < sortedBreakpoints.length - 1; i++) {
    const segmentStart = sortedBreakpoints[i];
    const segmentEnd = sortedBreakpoints[i + 1];
    
    // Find all issues that contain this segment
    const containingIssues = issuePositions.filter(pos => {
        return segmentStart >= pos.start && segmentEnd <= pos.end;
    });
    
    const segmentText = cvText.substring(segmentStart, segmentEnd);
    
    if (containingIssues.length > 0) {
        segments.push({
            text: segmentText,
            isIssue: true,
            issues: containingIssues
        });
    } else {
        segments.push({
            text: segmentText,
            isIssue: false,
            issues: null
        });
    }
}
```

**Bước 3: Render với Highlight Styles**

```jsx
{segments.map((segment, segmentIndex) => {
    if (segment.isIssue && segment.issues && segment.issues.length > 0) {
        const primaryIssue = segment.issues[0];
        const issueIndex = primaryIssue.issue.index;
        const style = getIssueStyle(issueIndex);
        
        // Build tooltip with all suggestions
        const tooltip = segment.issues.map((pos, idx) => {
            const section = getSectionLabel(pos.issue.section);
            const severityLabel = pos.issue.severity ? ` [${pos.issue.severity}]` : '';
            return `Vấn đề ${pos.issue.index + 1} - ${section}${severityLabel}: ${pos.issue.suggestion}`;
        }).join('\n\n');

        return (
            <span
                key={`issue-${segmentIndex}`}
                className="cv-highlight"
                style={style}
                title={tooltip}
                data-issue-index={issueIndex}
            >
                {segment.text}
            </span>
        );
    } else {
        // Regular text - preserve line breaks
        const lines = segment.text.split('\n');
        return (
            <React.Fragment key={`text-${segmentIndex}`}>
                {lines.map((line, lineIdx) => (
                    <React.Fragment key={`line-${segmentIndex}-${lineIdx}`}>
                        {line}
                        {lineIdx < lines.length - 1 && <br />}
                    </React.Fragment>
                ))}
            </React.Fragment>
        );
    }
})}
```

### 5.3. Highlight Style

```javascript
const getIssueStyle = (issueIndex) => {
    const color = getIssueColor(issueIndex);
    return {
        backgroundColor: hexToRgba(color, 0.2), // 20% opacity for background
        borderBottom: `3px solid ${color}`, // Solid border with full opacity
        color: '#1f2937', // Dark text color for readability
    };
};
```

### 5.4. CSS Styling

File: `CVHighlighter.scss`

```scss
.cv-highlighter {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #333;
    white-space: pre-wrap;
    word-wrap: break-word;
    padding: 1rem;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

    .cv-highlight {
        display: inline;
        padding: 2px 4px;
        border-radius: 3px;
        border-bottom: 3px solid;
        cursor: help;
        transition: all 0.2s ease;
        position: relative;

        &:hover {
            opacity: 0.9;
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
        }
    }
}
```

---

## 6. FRONTEND: PDF HIGHLIGHT SYSTEM

### 6.1. Hook: `usePDFTextSearch`

Hook này tìm text trong PDF text layer và tính toán positions.

**Input**: 
- `issues`: Array of issues từ review result
- `textLayerReady`: Boolean cho biết PDF text layer đã sẵn sàng

**Output**: 
- `highlights`: Array of highlight positions với format:
```javascript
{
    left: 100,      // px
    top: 200,       // px
    width: 150,     // px
    height: 20,     // px
    pageNumber: 1,  // Page number (1-indexed)
    issueIndex: 0,  // Index của issue trong issues array
    issue: {...}    // Issue object
}
```

### 6.2. Hàm `findTextInPDF()`

Tìm text trong PDF text layer của một page:

```javascript
const findTextInPDF = useCallback((searchText, pageIndex) => {
    // 1. Find page wrapper
    const pageWrapper = document.querySelector(`.pdf-page-wrapper[data-page-number="${pageIndex + 1}"]`);
    const textLayer = pageWrapper.querySelector('.react-pdf__Page__textContent');
    
    // 2. Get all text spans
    const textSpans = textLayer.querySelectorAll('span');
    
    // 3. Build full text from spans (preserve spaces)
    let fullText = '';
    const spanMap = [];
    textSpans.forEach((span, idx) => {
        const text = span.textContent || '';
        if (fullText.length > 0 && !fullText.endsWith(' ') && !text.startsWith(' ')) {
            fullText += ' ';
        }
        const start = fullText.length;
        fullText += text;
        const end = fullText.length;
        spanMap.push({ span, start, end, text, index: idx });
    });
    
    // 4. Use fuzzy matching to find text position
    const position = findFuzzyLocation(fullText, searchText);
    if (!position) return null;
    
    // 5. Map position back to original spans
    let startSpan = null;
    let endSpan = null;
    // ... (find spans containing start and end positions)
    
    // 6. Calculate bounding box from spans
    const allSpans = []; // All spans between start and end
    // ... (collect spans)
    
    // 7. Calculate bounding box relative to page wrapper
    const pageRect = pageWrapper.getBoundingClientRect();
    let minLeft = Infinity;
    let minTop = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;
    
    allSpans.forEach(span => {
        const rect = span.getBoundingClientRect();
        const relativeLeft = rect.left - pageRect.left;
        const relativeTop = rect.top - pageRect.top;
        // ... (update min/max)
    });
    
    return {
        left: minLeft,
        top: minTop,
        width: Math.max(maxRight - minLeft, 20),
        height: Math.max(maxBottom - minTop, 15),
        pageNumber: pageIndex + 1
    };
}, []);
```

### 6.3. Search Strategy với Retry

Hook sử dụng multiple strategies và retry logic:

```javascript
useEffect(() => {
    const searchWithRetry = (retryCount = 0) => {
        const maxRetries = 3;
        const foundHighlights = [];
        
        currentIssues.forEach((issue, issueIndex) => {
            let searchText = issue.exact_quote || issue.original_text;
            if (!searchText || !searchText.trim()) return;
            
            searchText = searchText.trim();
            let found = false;
            
            // Strategy 1: Try exact match on all pages
            for (let pageIndex = 0; pageIndex < pageWrappers.length; pageIndex++) {
                const position = findTextInPDF(searchText, pageIndex);
                if (position) {
                    foundHighlights.push({ ...position, issueIndex, issue });
                    found = true;
                    break;
                }
            }
            
            // Strategy 2: Try with shorter text (first sentence)
            if (!found && searchText.length > 30) {
                const shorterText = searchText.split(/[.!?。！？]/)[0] || searchText.substring(0, 50);
                // ... (try shorter text)
            }
            
            // Strategy 3: Try with key phrases (first 3-5 words)
            if (!found && searchText.split(' ').length > 3) {
                const words = searchText.split(' ').filter(w => w.trim().length > 2);
                const keyPhrase = words.slice(0, Math.min(5, words.length)).join(' ');
                // ... (try key phrase)
            }
            
            // Strategy 4: Try with longest word (technical term)
            if (!found) {
                const words = searchText.split(/\s+/).filter(w => w.length > 4);
                words.sort((a, b) => b.length - a.length);
                // ... (try longest words)
            }
        });
        
        // Retry if no highlights found
        if (foundHighlights.length === 0 && retryCount < maxRetries) {
            setTimeout(() => searchWithRetry(retryCount + 1), 500);
            return;
        }
        
        setHighlights(foundHighlights);
    };
    
    // Start search with initial delay
    const timeoutId = setTimeout(() => {
        searchWithRetry(0);
    }, 500);
    
    return () => clearTimeout(timeoutId);
}, [issuesKey, textLayerReady]);
```

### 6.4. Component: `PDFHighlight`

Component render highlight boxes trên PDF sử dụng DOM manipulation (vì cần inject vào page wrappers).

**Render Process**:

```javascript
useEffect(() => {
    // Clear existing highlights
    document.querySelectorAll('.pdf-highlight-overlay').forEach(el => el.remove());
    
    if (!highlights || highlights.length === 0) return;
    
    // Group highlights by page
    const highlightsByPage = {};
    highlights.forEach(highlight => {
        const pageNum = highlight.pageNumber;
        if (!highlightsByPage[pageNum]) {
            highlightsByPage[pageNum] = [];
        }
        highlightsByPage[pageNum].push(highlight);
    });
    
    // Render highlights for each page
    Object.keys(highlightsByPage).forEach(pageNum => {
        const pageHighlights = highlightsByPage[pageNum];
        const pageWrapper = document.querySelector(`.pdf-page-wrapper[data-page-number="${pageNum}"]`);
        
        if (!pageWrapper) return;
        
        // Check if page wrapper has dimensions
        const pageRect = pageWrapper.getBoundingClientRect();
        if (pageRect.width === 0 || pageRect.height === 0) return;
        
        // Ensure page wrapper has position relative
        const computedStyle = window.getComputedStyle(pageWrapper);
        if (computedStyle.position === 'static') {
            pageWrapper.style.position = 'relative';
        }
        
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
        
        // Create highlight box for each highlight
        pageHighlights.forEach((highlight, idx) => {
            const isActive = highlight.issueIndex === activeIssueIndex;
            const color = getIssueColor(highlight.issueIndex);
            
            const highlightDiv = document.createElement('div');
            highlightDiv.className = `pdf-highlight ${isActive ? 'active' : ''}`;
            highlightDiv.setAttribute('data-issue-index', highlight.issueIndex);
            
            highlightDiv.style.cssText = `
                position: absolute;
                left: ${highlight.left}px;
                top: ${highlight.top}px;
                width: ${highlight.width}px;
                height: ${highlight.height}px;
                border: 3px solid ${color};
                background-color: ${hexToRgba(color, 0.2)};
                border-radius: 3px;
                pointer-events: auto;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: ${isActive ? `0 0 12px ${hexToRgba(color, 0.5)}` : `0 2px 4px ${hexToRgba(color, 0.3)}`};
                z-index: ${isActive ? 11 : 10};
            `;
            
            highlightDiv.title = `Vấn đề ${highlight.issueIndex + 1}: ${highlight.issue.suggestion || 'Vấn đề'}`;
            highlightDiv.onclick = (e) => {
                e.stopPropagation();
                if (onHighlightClick) {
                    onHighlightClick(highlight.issueIndex);
                }
            };
            
            // Add number badge
            const numberBadge = document.createElement('span');
            numberBadge.className = 'pdf-highlight-number';
            numberBadge.textContent = highlight.issueIndex + 1;
            numberBadge.style.cssText = `
                position: absolute;
                top: -8px;
                left: -8px;
                background-color: ${color};
                color: #fff;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: bold;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                pointer-events: none;
                z-index: 12;
            `;
            
            highlightDiv.appendChild(numberBadge);
            overlay.appendChild(highlightDiv);
        });
        
        if (overlay.children.length > 0) {
            pageWrapper.appendChild(overlay);
        }
    });
    
    // Cleanup
    return () => {
        document.querySelectorAll('.pdf-highlight-overlay').forEach(el => el.remove());
    };
}, [highlights, activeIssueIndex, onHighlightClick]);
```

### 6.5. CSS Styling

File: `PDFHighlight.scss`

```scss
.pdf-highlight-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 10;
}

.pdf-highlight {
    position: absolute;
    border-radius: 2px;
    pointer-events: auto;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
        opacity: 0.9;
        transform: scale(1.02);
    }

    &.active {
        animation: pulse 2s infinite;
        box-shadow: 0 0 15px rgba(0, 0, 0, 0.3);
    }

    .pdf-highlight-number {
        position: absolute;
        top: -8px;
        left: -8px;
        color: #fff;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        pointer-events: none;
        z-index: 12;
    }
}

@keyframes pulse {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.7;
    }
}
```

---

## 7. COLOR MANAGEMENT SYSTEM

### 7.1. File: `colorUtils.js`

Hệ thống sử dụng **index-based color** (không phải severity-based) để đảm bảo mỗi issue có màu riêng biệt.

### 7.2. Color Palette

```javascript
export const getIssueColor = (index) => {
    const colors = [
        '#FF6B6B', // Red - Coral
        '#4ECDC4', // Teal - Turquoise
        '#45B7D1', // Blue - Sky Blue
        '#FFA07A', // Orange - Light Salmon
        '#98D8C8', // Green - Mint
        '#F7DC6F', // Yellow - Light Yellow
        '#BB8FCE', // Purple - Lavender
        '#85C1E2', // Light Blue
        '#F1948A', // Pink - Salmon Pink
        '#52BE80', // Green - Emerald
        '#F8B739', // Orange - Amber
        '#5DADE2', // Blue - Cornflower
        '#EC7063', // Red - Light Red
        '#A569BD', // Purple - Medium Purple
        '#48C9B0', // Teal - Medium Turquoise
    ];
    
    // Rotate colors if index exceeds palette length
    return colors[index % colors.length];
};
```

### 7.3. Color Usage

- **Background**: 20% opacity (`hexToRgba(color, 0.2)`)
- **Border**: 100% opacity (solid color)
- **Text**: Dark color (`#1f2937`) để đảm bảo readability

### 7.4. Helper Functions

```javascript
// Convert HEX to RGBA
export const hexToRgba = (hex, alpha = 1) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Get highlight style
export const getIssueHighlightStyle = (index) => {
    const color = getIssueColor(index);
    return {
        backgroundColor: hexToRgba(color, 0.2),
        borderColor: color,
        borderBottomColor: color,
    };
};
```

---

## 8. TƯƠNG TÁC NGƯỜI DÙNG

### 8.1. Click Issue Card → Scroll to Highlight

Trong `CVReview.js`:

```javascript
const handleIssueClick = (issueIndex) => {
    setActiveIssueIndex(issueIndex);
    
    // Find highlight for this issue
    const highlight = highlights.find(h => h.issueIndex === issueIndex);
    if (highlight) {
        // Find page wrapper and scroll to it
        const pageWrapper = document.querySelector(`.pdf-page-wrapper[data-page-number="${highlight.pageNumber}"]`);
        if (pageWrapper) {
            pageWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Also scroll the highlight into view after a short delay
            setTimeout(() => {
                const highlightElement = pageWrapper.querySelector(`.pdf-highlight[data-issue-index="${issueIndex}"]`);
                if (highlightElement) {
                    highlightElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
        }
    }
};
```

### 8.2. Click Highlight → Scroll to Issue Card

```javascript
const handleHighlightClick = (issueIndex) => {
    setActiveIssueIndex(issueIndex);
    
    // Find issue card and scroll to it
    const issueCard = document.querySelector(`.issue-item[data-issue-index="${issueIndex}"]`);
    if (issueCard) {
        issueCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add active class temporarily
        issueCard.classList.add('active');
        setTimeout(() => {
            issueCard.classList.remove('active');
        }, 2000);
    }
};
```

### 8.3. Active State

Khi một issue được active:
- Highlight box có class `active` → animation pulse
- Issue card có class `active` → highlight background
- Scroll tự động đến vị trí tương ứng

---

## 9. CHI TIẾT KỸ THUẬT

### 9.1. Performance Optimizations

1. **Memoization**: `CVHighlighter` sử dụng `useMemo` để tính toán segments chỉ khi `cvText` hoặc `issues` thay đổi
2. **Debouncing**: `usePDFTextSearch` sử dụng retry logic với delay để tránh search quá nhiều lần
3. **DOM Manipulation**: `PDFHighlight` sử dụng DOM manipulation thay vì React rendering để tránh re-render không cần thiết

### 9.2. Error Handling

1. **Missing exact_quote**: Skip issue và log warning
2. **Text not found**: Sử dụng fallback strategies (shorter text, keywords, longest word)
3. **PDF not ready**: Retry với delay
4. **Invalid positions**: Validate và clamp positions về bounds

### 9.3. Browser Compatibility

- Sử dụng `normalize('NFD')` để xử lý Vietnamese diacritics (IE không support, nhưng modern browsers đều support)
- Sử dụng `getBoundingClientRect()` để tính toán positions (widely supported)
- CSS transitions và animations (widely supported)

### 9.4. Accessibility

- Tooltips với `title` attribute
- Keyboard navigation (có thể thêm sau)
- Color contrast: Dark text trên light background với 20% opacity highlight

---

## 10. CÁC FILE LIÊN QUAN

### 10.1. Backend Files

| File | Mô tả |
|------|-------|
| `Node-backend/src/service/cvReviewService.js` | Service tạo prompt yêu cầu AI trả về exact_quote, xử lý response |

### 10.2. Frontend Components

| File | Mô tả |
|------|-------|
| `React-frontend/src/components/CVHighlighter/CVHighlighter.jsx` | Component render highlights trong text view |
| `React-frontend/src/components/CVHighlighter/CVHighlighter.scss` | Styles cho CVHighlighter |
| `React-frontend/src/components/PDFHighlight/PDFHighlight.js` | Component render highlight boxes trên PDF |
| `React-frontend/src/components/PDFHighlight/PDFHighlight.scss` | Styles cho PDFHighlight |

### 10.3. Frontend Hooks

| File | Mô tả |
|------|-------|
| `React-frontend/src/hooks/usePDFTextSearch.js` | Hook tìm text trong PDF và tính toán positions |

### 10.4. Frontend Utils

| File | Mô tả |
|------|-------|
| `React-frontend/src/utils/stringUtils.js` | Utilities: normalizeText, findFuzzyLocation, calculateSimilarity |
| `React-frontend/src/utils/colorUtils.js` | Utilities: getIssueColor, hexToRgba, getIssueHighlightStyle |

### 10.5. Main Page

| File | Mô tả |
|------|-------|
| `React-frontend/src/page/candidate/CVReview.js` | Main page tích hợp tất cả components, xử lý tương tác |

---

## KẾT LUẬN

Hệ thống highlight trong CV Review là một hệ thống phức tạp với nhiều thành phần:

1. **Backend**: Yêu cầu AI trả về exact_quote chính xác
2. **Text Matching**: Fuzzy matching algorithm xử lý các trường hợp edge cases
3. **Two Views**: PDF view và Text view với implementations khác nhau
4. **Color System**: Index-based color palette đảm bảo mỗi issue có màu riêng
5. **User Interaction**: Two-way navigation giữa issue cards và highlights

Hệ thống được thiết kế để:
- **Robust**: Xử lý nhiều edge cases (missing text, PDF not ready, etc.)
- **Performant**: Sử dụng memoization và debouncing
- **User-friendly**: Smooth scrolling, tooltips, active states
- **Maintainable**: Code được tổ chức rõ ràng, tách biệt concerns

---

**Tài liệu này được tạo để hỗ trợ AI khác đọc và phân tích hệ thống highlight. Nếu cần thêm chi tiết, vui lòng tham khảo source code trong các file đã liệt kê.**

