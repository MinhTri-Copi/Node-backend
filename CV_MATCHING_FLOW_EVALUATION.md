# Đánh giá Flow "Lọc CV tìm công việc phù hợp"

## ✅ ĐIỂM MẠNH

### 1. **Tận dụng lại hạ tầng ML hiện có**
- Đã có `SentenceTransformer` (all-MiniLM-L6-v2) trong `train_grader.py`
- Đã có logic cosine similarity và LinearRegression
- Chỉ cần tạo model mới cho CV-JD matching

### 2. **Giải pháp tối ưu performance**
- **Pre-embedding JD**: Khi HR thêm job posting → embed ngay → lưu vào DB/file
- **Two-stage filtering**: 
  - Stage 1: Cosine similarity (nhanh) → top 50
  - Stage 2: ML model (chính xác hơn) → top 2-3
- Giảm từ O(n) embedding operations xuống O(1) khi user search

### 3. **Thực tế và khả thi**
- Nhận diện được hạn chế: phụ thuộc LLM-generated data
- Có ý tưởng cải tiến: merge CV thật vào training set

---

## ⚠️ ĐIỂM CẦN CẢI THIỆN

### 1. **Training Data Quality**

**Vấn đề hiện tại:**
- 1000 samples từ LLM có thể không đủ đa dạng
- LLM có thể sinh CV/JD không realistic

**Gợi ý:**
```
✅ Tăng số lượng: 2000-3000 samples (nếu có thể)
✅ Đa dạng hóa prompts:
   - CV của sinh viên mới ra trường
   - CV có 2-5 năm kinh nghiệm
   - CV senior (5+ năm)
   - JD của startup vs công ty lớn
   - JD technical vs non-technical
✅ Validation: HR review một số samples để đảm bảo chất lượng
```

### 2. **Label Strategy**

**Vấn đề:**
- 3 labels (thấp/trung bình/cao) có thể quá đơn giản

**Gợi ý:**
```
Thay vì: thấp / trung bình / cao

Nên dùng: score_ratio (0.0 - 1.0) giống phần chấm điểm
- 0.0 - 0.3: Không phù hợp
- 0.3 - 0.6: Phù hợp một phần
- 0.6 - 0.8: Phù hợp tốt
- 0.8 - 1.0: Rất phù hợp

→ ML model sẽ học được gradient tốt hơn
```

### 3. **Incremental Learning - Dữ liệu thật từ Logs & Workflow** ⭐ (CẢI TIẾN)

**Quan trọng:** Dữ liệu thật KHÔNG phải từ HR chấm thủ công, mà tự sinh ra từ vận hành hệ thống!

#### **3.1. Nguồn dữ liệu thật (3 nhóm chính):**

**A) Implicit Feedback - Hành vi ứng viên (dễ lấy nhất)**
```
Tín hiệu từ logs:
- Apply / Không apply sau khi xem job
- Click job từ danh sách gợi ý
- Thời gian đọc JD (dwell time)
- Save job / Bookmark
- Bounce nhanh (vào rồi thoát ngay)

Map thành label mềm:
- View → Apply = "phù hợp" (score: 0.6-0.7)
- View nhiều nhưng không apply = "chưa phù hợp" (score: 0.3-0.4)
- Apply ngay sau khi thấy gợi ý = "match tốt" (score: 0.7-0.8)
- Dwell time > 60s + Apply = "rất phù hợp" (score: 0.8-0.9)
```

**B) Downstream Outcome - Kết quả từ HR/ATS (label mạnh nhất)** ⭐
```
Từ ApplicationStatus và workflow:
- Hired / Offer → score: 0.95-1.00
- Pass interview → score: 0.80-0.90
- Interview scheduled → score: 0.70-0.80
- Shortlisted (Đã xét duyệt) → score: 0.60-0.70
- Applied only (Đang chờ) → score: 0.45-0.60
- Rejected CV (Không đạt) → score: 0.05-0.30

Mapping cụ thể với ApplicationStatus hiện tại:
- id=4 (Đã xét duyệt) → 0.60-0.70
- id=6 (Đã phỏng vấn) → 0.70-0.80
- id=3 (Không đạt) → 0.05-0.30
- id=1 (Đang chờ) → 0.45-0.60
```

**C) Real Text Distribution - CV/JD thật của users**
```
- CV_text đã extract từ PDF/DOC (ngôn ngữ đời thực)
- JD_text do HR viết (đúng ngành, đúng văn phong)
- Metadata: location, level, salary, tech stack

→ Chỉ riêng việc model "nhìn" dữ liệu này đã giúp nó bớt lệch so với LLM dataset
```

#### **3.2. Implementation Flow:**

```
1. Background Job chạy định kỳ (mỗi ngày/tuần):
   - Query JobApplication với các status
   - Extract CV_text từ Record (đã có recordId)
   - Extract JD_text từ JobPosting
   - Map applicationStatusId → score_ratio
   - Thêm vào training set: (CV_text, JD_text, score_ratio)

2. Log User Behavior:
   - Track: job view, click, apply, dwell time
   - Lưu vào bảng JobViewLog hoặc UserActivityLog
   - Map behavior → score_ratio (weak label)

3. Retrain model định kỳ:
   - Mỗi 100-200 samples mới
   - Hoặc mỗi tuần/tháng
   - Combine: LLM data (initial) + Real data (incremental)
```

#### **3.3. Database Schema cần thêm:**

```javascript
// Bảng JobViewLog (track implicit feedback)
- userId (FK)
- jobPostingId (FK)
- viewTime (DATE)
- dwellTime (INTEGER) // seconds
- clicked (BOOLEAN)
- applied (BOOLEAN)
- saved (BOOLEAN)
- createdAt

// Bảng CVMatchingTrainingData (lưu training samples)
- cvText (TEXT)
- jdText (TEXT)
- scoreRatio (DECIMAL 3,2) // 0.00 - 1.00
- source (ENUM: 'llm', 'workflow', 'implicit', 'manual')
- jobApplicationId (FK, nullable) // Link với application nếu có
- createdAt
```

#### **3.4. Ưu điểm so với HR chấm thủ công:**

✅ **Scale tự động**: Không cần HR can thiệp  
✅ **Dữ liệu thật**: Phản ánh quyết định tuyển dụng thực tế  
✅ **Liên tục**: Tích lũy theo thời gian khi hệ thống vận hành  
✅ **Đa dạng**: Nhiều nguồn (workflow + behavior + text)  

#### **3.5. Lưu ý:**

⚠️ **Hệ thống mới**: 1-2 tháng đầu có thể chưa đủ data  
⚠️ **Noise**: Implicit feedback có nhiễu (apply bừa) → cần filter  
⚠️ **Bias**: Model có thể học bias từ HR decisions → cần monitor

### 4. **Database Schema cho JD Embeddings**

**Cần thêm vào JobPosting model:**
```javascript
// Migration mới
JobPosting.addColumn('jdEmbedding', DataTypes.TEXT) // JSON array của vector
JobPosting.addColumn('jdEmbeddingUpdatedAt', DataTypes.DATE)
```

**Hoặc tách ra bảng riêng (tốt hơn):**
```javascript
// Bảng JobPostingEmbedding
- jobPostingId (FK)
- embedding (TEXT) // JSON array
- modelVersion (STRING) // "all-MiniLM-L6-v2"
- createdAt
- updatedAt
```

### 5. **CV Text Extraction & Storage** ⭐ (QUAN TRỌNG)

#### **5.1. Phương pháp Extract Text (KHÔNG dùng LLM)**

**Nguyên tắc:** Dùng parser truyền thống (nhanh hơn LLM rất nhiều, < 1-3 giây)

**A) PDF Text-based (đa số CV export từ Word):**
```javascript
// npm i pdf-parse
import fs from "fs";
import pdf from "pdf-parse";

export async function extractPdfText(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  return (data.text || "").replace(/\s+\n/g, "\n").trim();
}
```
✅ **Ưu điểm:** Rất nhanh (< 1-3 giây), không cần LLM  
⚠️ **Hạn chế:** Không hoạt động với PDF scan (ảnh)

**B) DOCX (CV Word):**
```javascript
// npm i mammoth
import mammoth from "mammoth";

export async function extractDocxText(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return (result.value || "").trim();
}
```
✅ **Ưu điểm:** Nhanh, sạch, giữ được format cơ bản

**C) PDF Scan (Image-based) - Cần OCR:**
```javascript
// npm i tesseract.js
import Tesseract from 'tesseract.js';

export async function extractPdfScanText(filePath) {
  // Convert PDF pages to images first (dùng pdf-poppler hoặc pdf2pic)
  // Rồi OCR từng ảnh
  const { data: { text } } = await Tesseract.recognize(imagePath, 'vie+eng');
  return text.trim();
}
```
⚠️ **Lưu ý:** OCR chậm hơn (vài giây đến vài chục giây), chỉ dùng khi cần

**D) Detect PDF có text hay scan:**
```javascript
const text = await extractPdfText(path);
const isScannedLikely = text.replace(/\s/g, "").length < 200; // ngưỡng tùy bạn

if (isScannedLikely) {
  // Fallback to OCR
  text = await extractPdfScanText(path);
}
```

#### **5.2. Async Processing Flow (Không block user)**

**Vấn đề:** Extract text có thể lâu (đặc biệt OCR) → không nên block request

**Giải pháp:**
```
1. User upload CV → Server lưu file + tạo record CandidateCV(status="PROCESSING")
2. Trả response ngay ("Đang xử lý CV...")
3. Worker (background job) chạy:
   - Extract text từ file
   - (Optional) Embed CV text → vector
   - Update status = "READY"
4. Frontend polling / WebSocket để cập nhật status
```

**Database Schema:**
```javascript
// Bảng CandidateCV
- candidateId (FK)
- cvFilePath (STRING) // Đường dẫn file
- cvText (TEXT) // Text đã extract
- cvEmbedding (TEXT) // JSON array (optional)
- fileHash (STRING) // MD5/SHA256 để detect duplicate
- extractionStatus (ENUM: 'PENDING', 'PROCESSING', 'READY', 'FAILED')
- extractedAt (DATE)
- createdAt
- updatedAt
```

#### **5.3. Performance Optimization**

**A) Cache - Tránh extract lại:**
```javascript
// Check fileHash trước khi extract
const existingCV = await CandidateCV.findOne({ 
  where: { fileHash: calculateFileHash(fileBuffer) }
});

if (existingCV && existingCV.cvText) {
  return existingCV.cvText; // Dùng lại, không extract lại
}
```

**B) Không embed lại nếu CV không đổi:**
```javascript
// Chỉ embed khi:
// - cvText mới được extract
// - Hoặc model version thay đổi
if (!cvEmbedding || modelVersionChanged) {
  cvEmbedding = await embedCV(cvText);
}
```

**C) Giới hạn dung lượng:**
```javascript
// Multer config
limits: {
  fileSize: 5 * 1024 * 1024 // 5MB max
}
// → Tránh file scan nặng, extract nhanh hơn
```

**D) Chunking (nếu CV rất dài):**
```javascript
// CV thường không dài, nhưng nếu cần:
// Embed theo sections (Education, Experience, Skills)
// Rồi gộp lại hoặc dùng multi-vector search
```

#### **5.4. Kết luận**

✅ **Extract text = Parser/OCR, KHÔNG dùng LLM**  
   - Parser nhanh hơn LLM rất nhiều (< 1-3 giây vs vài chục giây)
   - Chi phí thấp hơn (không cần API call)
   - Độ chính xác cao cho text-based PDF/DOCX

✅ **LLM chỉ dùng ở bước "hiểu nội dung"** (sau khi đã có text sạch):
   - Chuẩn hóa skill list
   - Phân loại ngành nghề
   - Tóm tắt CV thành bullet points
   - Extract structured data (years of experience, education level, etc.)

✅ **Async processing** để không block user:
   - Upload → lưu file → trả response ngay
   - Background worker extract text
   - Frontend polling/WebSocket để update status

✅ **Cache** để tránh extract lại file đã xử lý:
   - Dùng fileHash để detect duplicate
   - Chỉ extract khi file mới hoặc chưa có text
   - Chỉ embed khi CV text mới hoặc model version thay đổi

⚠️ **Lưu ý:** PDF scan (image-based) cần OCR, chậm hơn nhưng vẫn nhanh hơn LLM nhiều

### 6. **Performance Optimization**

**Vấn đề:** Với 10,000 JD, cosine similarity vẫn chậm

**Giải pháp:**
```
Option 1: Vector Database (FAISS, Pinecone, Qdrant)
- Lưu JD embeddings vào vector DB
- Search nhanh hơn 100x so với tính toán thủ công
- Có thể scale lên hàng triệu JD

Option 2: Approximate Nearest Neighbor (ANN)
- Dùng FAISS index
- Trade-off: độ chính xác giảm 1-2% nhưng nhanh hơn 50-100x

Option 3: Caching
- Cache CV embedding của user (không cần embed lại mỗi lần search)
- Cache top 50 results trong 1 giờ
```

### 7. **Model Architecture**

**So sánh với phần chấm điểm:**
```
Chấm điểm: correctAnswer vs studentAnswer (1-1 comparison)
CV Matching: CV vs JD (1-n comparison, n có thể rất lớn)

→ Cần model khác một chút:
- Input: (CV_embedding, JD_embedding)
- Output: match_score (0-1)
- Có thể dùng siamese network hoặc cross-encoder (chính xác hơn nhưng chậm hơn)
```

---

## 📋 IMPLEMENTATION CHECKLIST

### ⚠️ LƯU Ý QUAN TRỌNG VỀ THỨ TỰ VÀ PHƯƠNG PHÁP

**1. Thứ tự phases:**
- ✅ **Phase 1: DB + CV extraction + pre-embedding JD** (ƯU TIÊN)
- ✅ **Phase 2: MVP Matching (cosine)** - Có thể chạy ngay, không cần model
- ⏭️ **Phase 3: Training Data Generation (LLM)** - Để cải thiện model sau
- ⏭️ **Phase 4: Model Training** - Sau khi có training data

**Lý do:**
- Không có CV_text/JD_text thật thì model khó "ăn khớp" hệ thống
- MVP matching (cosine) có thể chạy được trước, sau đó mới thêm model rerank
- LLM-generated training data là "đẩy nhanh model", không phải điều kiện để feature chạy

**2. Validate samples:**
- ❌ Không: "Validate samples với HR" (không thực tế)
- ✅ Nên: Review nội bộ (dev/nhóm) theo checklist (realism, diversity, noise)
- ✅ Optional: HR review rất ít (chỉ khi có đối tác thật, không bắt buộc)

**3. Metrics evaluation:**
- ✅ Regression: R², MAE, RMSE
- ✅ **Ranking metrics (QUAN TRỌNG):** Spearman correlation, NDCG@10, Recall@50
- ❌ **KHÔNG dùng "accuracy"** (chỉ hợp khi discretize thành lớp)

### Phase 1: Database & Storage (ƯU TIÊN) ⭐
- [ ] **JD Embedding:**
  - [ ] Migration: Tạo bảng `JobPostingEmbedding` (tách riêng, tốt hơn thêm vào JobPosting)
    - `jobPostingId` (FK)
    - `embedding` (TEXT) // JSON array
    - `modelVersion` (STRING) // "all-MiniLM-L6-v2" - BẮT BUỘC
    - `jdEmbeddingUpdatedAt` (DATE) - BẮT BUỘC
    - `createdAt`, `updatedAt`
  - [ ] Service: `jobPostingEmbeddingService.js` để embed JD khi HR tạo/sửa
  - [ ] Pre-embedding: Khi HR tạo/sửa job posting → embed ngay → lưu vào DB
  
- [ ] **CV Text Extraction & Storage:**
  - [ ] Migration: Tạo bảng `CandidateCV` với các trường:
    - `candidateId` (FK) hoặc `userId` (FK)
    - `cvFilePath` (STRING)
    - `cvText` (TEXT)
    - `cvEmbedding` (TEXT) // JSON array (optional)
    - `fileHash` (STRING) // MD5/SHA256 để detect duplicate - BẮT BUỘC
    - `extractionStatus` (ENUM: 'PENDING', 'PROCESSING', 'READY', 'FAILED')
    - `extractedAt` (DATE)
    - `modelVersion` (STRING) // Để biết embedding thuộc model nào
    - `createdAt`, `updatedAt`
  - [ ] Install dependencies: `pdf-parse`, `mammoth` (optional: `tesseract.js` cho OCR)
  - [ ] Service: `cvExtractionService.js`:
    - [ ] `extractPdfText()` - dùng pdf-parse
    - [ ] `extractDocxText()` - dùng mammoth
    - [ ] `detectScannedPdf()` - check nếu text quá ngắn (< 200 chars) - BẮT BUỘC
    - [ ] `extractPdfScanText()` - OCR fallback (optional, nhưng phải có detect scan)
  - [ ] Async processing:
    - [ ] Background job/worker để extract text (không block upload)
    - [ ] Update `extractionStatus` khi hoàn thành
    - [ ] Frontend polling/WebSocket để show status
  - [ ] Cache optimization:
    - [ ] Check `fileHash` trước khi extract (tránh extract lại)
    - [ ] Chỉ embed khi CV text mới hoặc model version thay đổi

### Phase 2: MVP Matching (Cosine Similarity) - Có thể chạy ngay
- [ ] API: `/api/candidate/find-matching-jobs` (POST CV → return top jobs)
- [ ] Service: `cvMatchingService.js`:
  - [ ] Extract CV text (nếu chưa có) hoặc lấy từ `CandidateCV`
  - [ ] Embed CV text → vector
  - [ ] Cosine similarity với tất cả JD embeddings (hoặc filter trước)
  - [ ] Return top 50 jobs
- [ ] Frontend: Button "Tìm việc phù hợp" + hiển thị kết quả
- [ ] **Stage 0 - Rule Filter (QUAN TRỌNG):**
  - [ ] Filter theo location, level, salary, major TRƯỚC khi tính cosine
  - [ ] Giảm tải cực mạnh (ví dụ: từ 10,000 JD → 500 JD)
  - [ ] Sau đó mới cosine similarity

### Phase 3: Training Data Generation (LLM) - Để cải thiện model
- [ ] Tạo service `cvMatchingDataGenerationService.js` (tương tự `trainingDataGenerationService.js`)
- [ ] LLM prompt để sinh (CV_text, JD_text, score_ratio) - **Dùng score_ratio (0-1) ngay từ đầu, không dùng 3 mức**
- [ ] Generate 2000-3000 samples với:
  - [ ] Diversity: sinh viên mới ra trường, 2-5 năm, senior, startup vs công ty lớn
  - [ ] **Hard negatives**: CV lệch ngành để model học phân biệt
  - [ ] Realism: CV/JD giống thực tế
- [ ] **Validate samples:**
  - [ ] Review nội bộ (dev/nhóm) theo checklist:
    - [ ] Realism: CV/JD có giống thực tế không?
    - [ ] Diversity: Đủ đa dạng về level, ngành, format?
    - [ ] Noise: Có samples quá tệ không?
  - [ ] HR review rất ít (chỉ khi có đối tác thật, không bắt buộc)

### Phase 4: Model Training (Sau khi có training data)
- [ ] Tạo `train_cv_matcher.py` (tương tự `train_grader.py`)
- [ ] Train model với CV-JD pairs (score_ratio 0-1)
- [ ] **Evaluate metrics (đúng bài matching):**
  - [ ] Regression metrics: R², MAE, RMSE
  - [ ] **Ranking metrics (QUAN TRỌNG):**
    - [ ] Spearman correlation (đúng thứ tự)
    - [ ] NDCG@10 (Normalized Discounted Cumulative Gain)
    - [ ] Recall@50 (tỷ lệ tìm đúng trong top 50)
  - [ ] **KHÔNG dùng "accuracy"** (chỉ hợp khi discretize thành lớp)
- [ ] Save model:
  - [ ] `cv_matcher_reg.joblib` + `cv_matcher_embedder/`
  - [ ] **Lưu metadata:**
    - [ ] `modelVersion` (string, ví dụ: "v1.0.0")
    - [ ] `trainingDataVersion` (để rollback nếu cần)
    - [ ] `trainingDate`, `metrics` (R², MAE, Spearman, NDCG@10)

### Phase 5: API & ML Service (Two-stage với Model Rerank)
- [ ] **ML service endpoint:** `/match-cv` (tương tự `/grade`)
  - [ ] Input: CV_text hoặc CV_embedding
  - [ ] Output: List jobs với match_score
- [ ] **Two-stage filtering:**
  - [ ] Stage 0: Rule filter (location, level, salary, major) → giảm tải
  - [ ] Stage 1: Cosine similarity với JD embeddings → top 50
  - [ ] Stage 2: ML model rerank → top 2-3 (hoặc top 10)
- [ ] **Caching (QUAN TRỌNG):**
  - [ ] Cache kết quả theo: `cvHash` + `filters` + `modelVersion`
  - [ ] Cache top 50 results trong 1 giờ
  - [ ] Invalidate cache khi model version thay đổi
- [ ] Backend API: `/api/candidate/find-matching-jobs` (POST CV → return top jobs)
  - [ ] Gọi ML service `/match-cv`
  - [ ] Return jobs với match_score, reasons (giải thích)

### Phase 6: Frontend
- [ ] Button "Tìm việc phù hợp" trên trang Job Listings
- [ ] **UI Status Handling:**
  - [ ] Show "CV đang xử lý" khi `extractionStatus = PROCESSING`
  - [ ] Progress indicator (đỡ user tưởng lỗi)
  - [ ] Polling/WebSocket để update status
- [ ] Modal/Page hiển thị kết quả matching:
  - [ ] Show match score (0-100% hoặc 0-1)
  - [ ] **Reasons (giải thích) - QUAN TRỌNG để tăng trust:**
    - [ ] "CV của bạn có 3 năm kinh nghiệm React, JD yêu cầu 2-5 năm"
    - [ ] "Kỹ năng: JavaScript, Node.js khớp 85% với JD"
    - [ ] "Location: Hà Nội khớp với JD"
  - [ ] JD details, apply button

### Phase 7: Incremental Learning - Dữ liệu thật từ Logs & Workflow ⭐
- [ ] **Database Schema:**
  - [ ] Tạo bảng `JobViewLog` (track user behavior):
    - `userId`, `jobPostingId`, `viewTime`, `dwellTime` (seconds)
    - `clicked`, `applied`, `saved`
    - `createdAt`
  - [ ] Tạo bảng `CVMatchingTrainingData` (lưu training samples từ nhiều nguồn):
    - `cvText` (TEXT), `jdText` (TEXT)
    - `scoreRatio` (DECIMAL 3,2) // 0.00 - 1.00
    - `source` (ENUM: 'llm', 'workflow', 'implicit', 'manual')
    - `jobApplicationId` (FK, nullable)
    - `createdAt`
  
- [ ] **Track User Behavior (Implicit Feedback):**
  - [ ] Log job views, clicks, apply actions
  - [ ] Track dwell time trên job detail page
  - [ ] Map behavior → score_ratio:
    - [ ] View → Apply (dwell > 30s) → 0.6-0.7
    - [ ] View nhiều nhưng không apply → 0.3-0.4
    - [ ] Apply ngay sau khi thấy gợi ý → 0.7-0.8
  - [ ] **Filter noise (QUAN TRỌNG):**
    - [ ] Bounce < X giây (ví dụ: < 5s) → bỏ qua
    - [ ] Apply hàng loạt trong 1 phút → coi là spam, bỏ qua
    - [ ] User apply > 10 jobs/ngày → giảm weight
  
- [ ] **Extract Data từ Workflow (Downstream Outcome):**
  - [ ] Background job: Query JobApplication với ApplicationStatus
  - [ ] Extract CV_text từ Record (qua recordId) hoặc CandidateCV
  - [ ] Extract JD_text từ JobPosting
  - [ ] Map applicationStatusId → score_ratio:
    - [ ] Hired/Offer → 0.95-1.00 (nếu có status này)
    - [ ] Pass interview → 0.80-0.90 (check InterviewRound/Meeting)
    - [ ] id=6 (Đã phỏng vấn) → 0.70-0.80
    - [ ] id=4 (Đã xét duyệt) → 0.60-0.70
    - [ ] id=2 (Đã được nhận) → 0.60-0.70
    - [ ] **id=1 (Đang chờ) → 0.45-0.60 - Coi là WEAK LABEL (trung tính), không "cao"**
    - [ ] id=3 (Không đạt) → 0.05-0.30
    - [ ] id=5 (Đã hủy) → 0.0-0.20
  
- [ ] **Training Data Collection:**
  - [ ] Service: `cvMatchingDataCollectionService.js`
  - [ ] Combine: LLM data + Workflow data + Implicit feedback
  - [ ] **Weighted training:**
    - [ ] Workflow data: weight = 1.0 (mạnh nhất)
    - [ ] Implicit feedback: weight = 0.5 (yếu hơn, dễ nhiễu)
    - [ ] LLM data: weight = 0.3 (bootstrap ban đầu)
  
- [ ] **Retrain Model:**
  - [ ] Retrain định kỳ (mỗi 100-200 samples mới hoặc mỗi tuần)
  - [ ] Evaluate với metrics: R², MAE, Spearman, NDCG@10
  - [ ] Compare với model cũ → chỉ deploy nếu tốt hơn
  - [ ] Monitor model performance theo thời gian
  - [ ] Version control: Lưu `modelVersion` + `trainingDataVersion` để rollback

---

## 🎯 KẾT LUẬN

**Flow của bạn RẤT HỢP LÝ và KHẢ THI!**

**Điểm mạnh nhất:**
- Nhận diện được vấn đề performance (pre-embedding)
- Two-stage filtering thông minh
- Tận dụng lại codebase hiện có

**Cần cải thiện:**
- Tăng số lượng training data ban đầu (LLM-generated)
- Dùng score_ratio thay vì 3 labels
- Cân nhắc vector database cho scale lớn
- **Implement incremental learning từ logs & workflow** (đã có giải pháp chi tiết)

**So sánh với phần chấm điểm:**
- Phần chấm điểm: Có HR adjustment thủ công → model tốt hơn theo thời gian
- Phần CV matching: **Dữ liệu thật tự động từ logs & workflow** → scale tốt hơn, không cần HR can thiệp

**Đánh giá tổng thể: 8.5/10** ⭐⭐⭐⭐⭐

---

## 📊 MAPPING APPLICATION STATUS → SCORE_RATIO

Dựa trên ApplicationStatus hiện tại trong hệ thống:

```javascript
// ApplicationStatus mapping (từ ApplicationDetailModal.js)
const STATUS_TO_SCORE = {
  1: { name: 'Đang chờ', scoreRange: [0.45, 0.60] },      // Applied only
  2: { name: 'Đã được nhận', scoreRange: [0.60, 0.70] }, // Shortlisted
  3: { name: 'Không đạt', scoreRange: [0.05, 0.30] },    // Rejected CV
  4: { name: 'Đã xét duyệt', scoreRange: [0.60, 0.70] }, // Shortlisted/Approved
  5: { name: 'Đã hủy', scoreRange: [0.0, 0.20] },        // Cancelled (có thể là user cancel)
  6: { name: 'Đã phỏng vấn', scoreRange: [0.70, 0.80] }  // Interview scheduled
};

// Cần thêm status cho các giai đoạn sau:
// - Interview passed → [0.80, 0.90]
// - Offer sent → [0.90, 0.95]
// - Hired → [0.95, 1.00]
```

**Implementation trong service:**

```javascript
// backend/src/service/cvMatchingDataCollectionService.js

const mapApplicationStatusToScore = (applicationStatusId, hasInterview = false, isHired = false) => {
  if (isHired) return 0.95 + Math.random() * 0.05; // 0.95-1.00
  if (hasInterview) {
    // Có thể check InterviewRound hoặc Meeting để biết đã pass chưa
    return 0.80 + Math.random() * 0.10; // 0.80-0.90
  }
  
  switch(applicationStatusId) {
    case 4: // Đã xét duyệt
    case 2: // Đã được nhận
      return 0.60 + Math.random() * 0.10; // 0.60-0.70
    case 6: // Đã phỏng vấn
      return 0.70 + Math.random() * 0.10; // 0.70-0.80
    case 1: // Đang chờ
      return 0.45 + Math.random() * 0.15; // 0.45-0.60
    case 3: // Không đạt
      return 0.05 + Math.random() * 0.25; // 0.05-0.30
    case 5: // Đã hủy
      return 0.0 + Math.random() * 0.20; // 0.0-0.20
    default:
      return 0.50; // Default neutral
  }
};
```

---

## 📝 GỢI Ý THÊM

### 1. **Hybrid Approach**
Kết hợp rule-based + ML:
- Rule-based: Lọc theo location, salary, experience (nhanh)
- ML: Tính match score cho các JD đã lọc (chính xác)

### 2. **Explainability**
Cho user biết tại sao JD này phù hợp:
- "CV của bạn có 3 năm kinh nghiệm React, JD yêu cầu 2-5 năm"
- "Kỹ năng: JavaScript, Node.js khớp 85% với JD"

### 3. **A/B Testing**
Test xem model có thực sự giúp ứng viên tìm việc tốt hơn không:
- Group A: Dùng ML matching
- Group B: Dùng traditional search
- So sánh: số lượng apply, tỷ lệ được mời phỏng vấn

