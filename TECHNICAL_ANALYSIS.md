# 📋 PHÂN TÍCH KỸ THUẬT DỰ ÁN - HUTECH IT GOT TALENT

## 🛠️ TECH STACK CHÍNH

### **Backend (Node.js)**
- **Framework**: Express.js 5.1.0
- **Runtime**: Node.js (sử dụng Babel để transpile ES6+)
- **ORM**: Sequelize 6.13.0
- **Database**: MySQL (mysql2 3.15.3)
- **Authentication**: JWT (jsonwebtoken 9.0.2)
- **Password Hashing**: bcryptjs 3.0.3
- **File Upload**: Multer 2.0.2
- **Document Processing**: 
  - mammoth (1.11.0) - xử lý .docx
  - pdf-parse (2.4.5) - xử lý PDF
- **AI/ML Integration**:
  - OpenAI SDK (6.9.1) - tích hợp với LM Studio
  - @google/genai (1.30.0) - Google Generative AI
  - natural (8.1.0) - NLP processing
- **Email**: nodemailer (7.0.11)
- **Video Conference**: Jitsi (tích hợp qua @jitsi/react-sdk)
- **Build Tool**: Babel (@babel/core, @babel/node, @babel/preset-env)

### **Frontend (React)**
- **Framework**: React 17.0.2
- **Routing**: React Router DOM 6.30.2
- **UI Library**: Ant Design 4.24.0
- **HTTP Client**: Axios 1.13.2
- **Styling**: 
  - SCSS/SASS (1.94.0)
  - Bootstrap 5.3.8
- **Charts**: Chart.js (3.9.1) + react-chartjs-2 (4.3.1)
- **Utilities**: 
  - lodash (4.17.21)
  - dayjs (1.11.19) - date handling
  - react-toastify (8.1.0) - notifications
- **Video Conference**: @jitsi/react-sdk (1.4.4)

### **ML/AI Services**
- **Python FastAPI Service**: ML grading service (chạy trên port 8000)
- **LM Studio**: Local LLM service (chạy trên port 1234)
- **Model**: qwen2.5-1.5b-instruct (default)

---

## 📁 CẤU TRÚC THƯ MỤC

### **Backend Structure (`Node-backend/`)**

```
Node-backend/
├── src/
│   ├── config/              # Cấu hình hệ thống
│   │   ├── config.json      # Sequelize DB config
│   │   ├── connectDB.js     # MySQL connection pool
│   │   ├── cors.js          # CORS configuration
│   │   ├── viewEngine.js    # EJS view engine setup
│   │   └── gradingRubric.js # Rubric chấm điểm
│   │
│   ├── controller/          # Request handlers (API endpoints)
│   │   ├── loginRegisterController.js
│   │   ├── jobPostingController.js
│   │   ├── jobApplicationController.js
│   │   ├── testController.js
│   │   ├── testSubmissionController.js
│   │   ├── hrController.js
│   │   └── ... (17 controllers)
│   │
│   ├── service/             # Business logic layer
│   │   ├── loginRegisterService.js
│   │   ├── aiGradingService.js      # AI chấm điểm tự động
│   │   ├── cvMatchingService.js     # CV matching với job
│   │   ├── fastGradingClient.js     # Client gọi ML service
│   │   ├── mlTrainingService.js     # Training ML model
│   │   ├── emailService.js
│   │   └── ... (29 services)
│   │
│   ├── models/              # Sequelize ORM models (26 models)
│   │   ├── user.js
│   │   ├── role.js
│   │   ├── company.js
│   │   ├── jobPosting.js
│   │   ├── jobApplication.js
│   │   ├── test.js
│   │   ├── testSubmission.js
│   │   └── ... (26 models total)
│   │
│   ├── routes/              # Route definitions
│   │   └── web.js           # Tất cả API routes
│   │
│   ├── middleware/          # Express middleware
│   │   ├── verifyJWT.js     # JWT authentication
│   │   ├── uploadCV.js      # CV upload handler
│   │   └── uploadQuestionBank.js
│   │
│   ├── migrations/         # Database migrations (Sequelize)
│   │   └── ... (20+ migration files)
│   │
│   ├── cron/                # Scheduled tasks
│   │   ├── expireTests.js   # Tự động tắt test hết hạn
│   │   └── retrainHumanModel.js # Auto-retrain ML model
│   │
│   ├── public/              # Static files
│   │   └── uploads/         # Uploaded CVs, documents
│   │
│   └── server.js            # Entry point
│
├── ml-grader/               # Python ML service (FastAPI)
│   └── grading_data.csv
│
├── scripts/                 # Utility scripts
│   ├── generate-llm-training-data.js
│   ├── import-csv-with-scores.js
│   └── ...
│
└── package.json
```

### **Frontend Structure (`React-frontend/`)**

```
React-frontend/
├── src/
│   ├── page/                # Page components
│   │   ├── auth/            # Login, Register
│   │   ├── candidate/       # Candidate pages
│   │   │   ├── CandidateHome.js
│   │   │   ├── JobList.js
│   │   │   ├── JobDetail.js
│   │   │   ├── MyApplications.js
│   │   │   ├── TestTaking.js
│   │   │   └── ...
│   │   ├── hr/              # HR pages
│   │   │   ├── HrDashboard.js
│   │   │   ├── JobManagement.js
│   │   │   ├── TestManagement.js
│   │   │   ├── TestGrading.js
│   │   │   └── ...
│   │   └── meeting/         # Video interview
│   │
│   ├── components/          # Reusable components
│   │   ├── Navigation/
│   │   └── JitsiRoom.js
│   │
│   ├── service.js/          # API service layer
│   │   ├── loginRegister.js
│   │   ├── jobPostingService.js
│   │   ├── testService.js
│   │   └── ... (16 services)
│   │
│   ├── utils/               # Utilities
│   │   └── axiosConfig.js   # Axios instance config
│   │
│   └── App.js               # Main app component
│
└── package.json
```

---

## 🔄 LUỒNG DỮ LIỆU CHÍNH (DATA FLOW)

### **1. Authentication Flow**
```
Frontend (Login) 
  → POST /api/login
  → Controller (loginRegisterController)
  → Service (loginRegisterService)
  → Model (User) - Sequelize
  → Database (MySQL)
  → JWT Token Generation
  → Response với token
  → Frontend lưu token vào localStorage
```

### **2. Protected API Request Flow**
```
Frontend Request (với JWT token)
  → Middleware (verifyJWT) - xác thực token
  → Middleware (requireRole) - kiểm tra quyền (nếu cần)
  → Controller - xử lý request
  → Service - business logic
  → Model - database operations
  → Database (MySQL)
  → Response trả về Frontend
```

### **3. Test Submission & Auto-Grading Flow**
```
Candidate submit test
  → POST /api/test-submissions/submit
  → Controller (testSubmissionController)
  → Service (testSubmissionService)
  → Lưu vào Database
  
HR trigger auto-grade
  → POST /api/test-submissions/:id/auto-grade
  → Controller (testSubmissionController)
  → Service (aiGradingService)
  → Hybrid Grading:
     ├─ NLP Filter (natural) - lọc câu dễ
     ├─ ML Model (FastAPI service) - chấm câu khó
     └─ LLM Fallback (LM Studio) - nếu ML không khả dụng
  → Lưu điểm vào Database
  → Response với kết quả
```

### **4. CV Matching Flow**
```
Candidate upload CV
  → POST /api/upload-cv
  → Controller (recordController)
  → Service (cvExtractionService) - extract text từ PDF/DOCX
  → Service (cvMatchingService)
  → ML Service (FastAPI) - tính embedding & similarity
  → Trả về danh sách jobs phù hợp
```

### **5. Job Application Flow**
```
Candidate apply job
  → POST /api/job-applications
  → Controller (jobApplicationController)
  → Service (jobApplicationService)
  → Tạo JobApplication record
  → Tạo TestSubmission (nếu có test)
  → Email notification (emailService)
  → Response
```

### **6. HR Dashboard Flow**
```
HR access dashboard
  → GET /api/hr/dashboard (với JWT + role check)
  → Controller (hrController)
  → Service (hrService, statisticsHrService)
  → Aggregate data từ nhiều models:
     ├─ JobPosting
     ├─ JobApplication
     ├─ TestSubmission
     └─ User
  → Response với statistics
```

---

## ⚙️ CẤU HÌNH VÀ BIẾN MÔI TRƯỜNG

### **File `.env` cần tạo trong `Node-backend/`**

```env
# ============================================
# DATABASE CONFIGURATION
# ============================================
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=qltvl
DB_PORT=3306

# ============================================
# SERVER CONFIGURATION
# ============================================
PORT=8082
NODE_ENV=development

# ============================================
# JWT AUTHENTICATION
# ============================================
JWT_SECRET=your-secret-key-change-in-production-12345
JWT_EXPIRES_IN=7d

# ============================================
# CORS & FRONTEND
# ============================================
REACT_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# ============================================
# AI/ML SERVICES
# ============================================
# LM Studio (Local LLM)
LM_STUDIO_URL=http://127.0.0.1:1234
LM_STUDIO_MODEL=qwen2.5-1.5b-instruct

# FastAPI ML Grading Service
FAST_GRADING_URL=http://127.0.0.1:8000

# LLM Features (optional flags)
ENABLE_LLM_RECHECK=false
ENABLE_LLM_COMMENT=false
DEBUG_GRADING=false

# ============================================
# EMAIL CONFIGURATION (Nodemailer)
# ============================================
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-password

# ============================================
# AUTO-RETRAIN ML MODEL (Cron Jobs)
# ============================================
AUTO_RETRAIN_ENABLED=false
AUTO_RETRAIN_THRESHOLD=200
AUTO_RETRAIN_INTERVAL_MIN=60

# ============================================
# TEST EXPIRATION (Cron Job)
# ============================================
EXPIRE_TEST_INTERVAL_MIN=10

# ============================================
# ML TRAINING (Optional)
# ============================================
AUTO_TRAIN_ML_MODEL=false
PYTHON_PATH=python
```

### **File cấu hình quan trọng khác**

1. **`Node-backend/src/config/config.json`**
   - Sequelize database config
   - Có thể override bằng environment variables

2. **`Node-backend/.babelrc`**
   - Babel preset config cho ES6+ transpilation

3. **`React-frontend/package.json`**
   - Frontend dependencies
   - Scripts: `npm start` (port 3000)

---

## 🚀 HƯỚNG DẪN CHẠY ỨNG DỤNG

### **1. Backend Setup**
```bash
cd Node-backend

# Install dependencies
npm install

# Tạo file .env (copy từ template trên)

# Setup upload folder
npm run setup

# Chạy migrations (nếu chưa có DB)
npx sequelize-cli db:migrate

# Start server
npm start
# Server chạy trên http://localhost:8082
```

### **2. Frontend Setup**
```bash
cd React-frontend

# Install dependencies
npm install

# Start dev server
npm start
# Frontend chạy trên http://localhost:3000
```

### **3. ML Service (Optional - nếu dùng auto-grading)**
```bash
# Cần Python FastAPI service chạy trên port 8000
# Xem trong ml-grader/ folder
```

### **4. LM Studio (Optional - nếu dùng LLM grading)**
```bash
# Cần cài và chạy LM Studio trên port 1234
# Load model: qwen2.5-1.5b-instruct
```

---

## 📊 KIẾN TRÚC TỔNG QUAN

### **Layered Architecture**
```
┌─────────────────────────────────────┐
│         Frontend (React)           │
│    - Pages, Components, Services   │
└──────────────┬─────────────────────┘
               │ HTTP/REST API
┌──────────────▼─────────────────────┐
│      Backend (Express.js)          │
│  ┌──────────────────────────────┐  │
│  │   Routes (web.js)            │  │
│  └──────────┬───────────────────┘  │
│  ┌──────────▼───────────────────┐  │
│  │   Controllers                │  │
│  └──────────┬───────────────────┘  │
│  ┌──────────▼───────────────────┐  │
│  │   Services (Business Logic)  │  │
│  └──────────┬───────────────────┘  │
│  ┌──────────▼───────────────────┐  │
│  │   Models (Sequelize ORM)     │  │
│  └──────────┬───────────────────┘  │
└──────────────┼─────────────────────┘
               │
┌──────────────▼─────────────────────┐
│      Database (MySQL)              │
└────────────────────────────────────┘

External Services:
├─ ML Grading Service (FastAPI :8000)
├─ LM Studio (LLM :1234)
└─ Email Service (SMTP)
```

---

## 🔐 BẢO MẬT

1. **JWT Authentication**: Tất cả protected routes cần JWT token
2. **Role-Based Access Control**: Middleware `requireRole()` kiểm tra quyền
3. **Password Hashing**: bcryptjs với salt rounds = 10
4. **CORS**: Chỉ cho phép origin từ `REACT_URL`
5. **File Upload**: Multer middleware validate file types

---

## 📝 GHI CHÚ QUAN TRỌNG

1. **Database**: Cần tạo database `qltvl` trước khi chạy migrations
2. **Ports**:
   - Backend: 8082
   - Frontend: 3000
   - ML Service: 8000
   - LM Studio: 1234
3. **Cron Jobs**: Tự động chạy nếu `AUTO_RETRAIN_ENABLED=true`
4. **File Uploads**: Lưu trong `src/public/uploads/`
5. **Migrations**: Sử dụng Sequelize CLI để quản lý schema

---

## 🎯 TÓM TẮT

Đây là một **hệ thống quản lý tuyển dụng** với các tính năng:
- ✅ Authentication & Authorization (JWT + Role-based)
- ✅ Job Posting & Application Management
- ✅ AI-powered Test Grading (ML + LLM hybrid)
- ✅ CV Matching với ML
- ✅ Video Interview (Jitsi)
- ✅ HR Dashboard với Statistics
- ✅ Email Notifications
- ✅ Document Management

**Tech Stack**: Node.js + Express + React + MySQL + AI/ML Services

