import express from 'express';
import helloController from '../controller/helloController';
import loginRegisterController from '../controller/loginRegisterController';
import companyController from '../controller/companyController';
import recordController from '../controller/recordController';
import jobPostingController from '../controller/jobPostingController';
import jobApplicationController from '../controller/jobApplicationController';
import hrController from '../controller/hrController';
import statisticsHrController from '../controller/statisticsHrController';
import utilityController from '../controller/utilityController';
import testController from '../controller/testController';
import testSubmissionController from '../controller/testSubmissionController';
import violationController from '../controller/violationController';
import interviewRoundController from '../controller/interviewRoundController';
import meetingController from '../controller/meetingController';
import interviewController from '../controller/interviewController';
import questionBankController from '../controller/questionBankController';
import trainingDataController from '../controller/trainingDataController';
import cvMatchingController from '../controller/cvMatchingController.js';
import cvReviewController from '../controller/cvReviewController.js';
import upload from '../middleware/uploadCV';
import uploadQuestionBank from '../middleware/uploadQuestionBank';
import verifyJWT from '../middleware/verifyJWT';

const router = express.Router();



const initWebRoutes = (app) => {
    app.get("/", helloController.printHello);
    app.get("/hello", helloController.getHelloPage);
    
    // API Login & Register
    app.post("/api/login", loginRegisterController.handleLogin);
    app.post("/api/register", loginRegisterController.handleRegister);
    
    // API Company
    app.get("/api/companies", companyController.getListCompany);
    app.get("/api/companies/search", companyController.searchCompany);
    app.get("/api/companies/:id", companyController.getCompanyById);
    
    // API Record (Require JWT)
    app.get("/api/records", verifyJWT.verifyJWT, recordController.getMyRecords);
    app.get("/api/records/:id", verifyJWT.verifyJWT, recordController.getRecordById);
    app.get("/api/candidate/cv-status", verifyJWT.verifyJWT, recordController.getCVStatus);
    app.post("/api/records", verifyJWT.verifyJWT, recordController.createRecord);
    app.put("/api/records/:id", verifyJWT.verifyJWT, recordController.updateRecord);
    app.delete("/api/records/:id", verifyJWT.verifyJWT, recordController.deleteRecord);

    // API Upload CV (Require JWT)
    app.post("/api/upload-cv", verifyJWT.verifyJWT, upload.single('cv'), recordController.uploadCV);
    
    // API Job Posting
    app.get("/api/jobs", jobPostingController.getListJobPosting);
    app.get("/api/jobs/filters/options", jobPostingController.getFilterOptions);
    app.get("/api/jobs/:id", jobPostingController.getJobPostingById);
    app.post("/api/jobs", jobPostingController.createJobPosting);
    app.put("/api/jobs/:id", jobPostingController.updateJobPosting);
    app.delete("/api/jobs/:id", jobPostingController.deleteJobPosting);

    // API Job Application (Require JWT)
    app.post("/api/job-applications", verifyJWT.verifyJWT, jobApplicationController.applyJob);
    app.get("/api/job-applications/check", verifyJWT.verifyJWT, jobApplicationController.checkApplied);
    app.get("/api/job-applications", verifyJWT.verifyJWT, jobApplicationController.getMyApplications);
    app.post("/api/job-applications/tests/start", verifyJWT.verifyJWT, jobApplicationController.startTest);
    app.get("/api/job-applications/tests/submissions/:submissionId", verifyJWT.verifyJWT, jobApplicationController.getTestSubmissionDetail);

    // API CV Matching (Require JWT)
    app.post("/api/candidate/find-matching-jobs", verifyJWT.verifyJWT, cvMatchingController.findMatchingJobsForCandidate);
    app.get("/api/candidate/job/:id/match-score", verifyJWT.verifyJWT, cvMatchingController.getJobMatchScore);
    
    // API CV Review (Require JWT)
    app.post("/api/candidate/review-cv", verifyJWT.verifyJWT, cvReviewController.reviewCV);

    // API HR Dashboard (Require JWT + HR Role)
    app.get("/api/hr/dashboard", verifyJWT.verifyJWT, verifyJWT.requireRole(2), hrController.getDashboard);
    app.get("/api/hr/job-postings", verifyJWT.verifyJWT, verifyJWT.requireRole(2), hrController.getMyJobPostings);
    app.get("/api/hr/job-postings/detail", verifyJWT.verifyJWT, verifyJWT.requireRole(2), hrController.getJobPostingDetail);
    app.post("/api/hr/job-postings", verifyJWT.verifyJWT, verifyJWT.requireRole(2), hrController.createJobPosting);
    app.put("/api/hr/job-postings/:jobId", verifyJWT.verifyJWT, verifyJWT.requireRole(2), hrController.updateJobPosting);
    app.delete("/api/hr/job-postings/:jobId", verifyJWT.verifyJWT, verifyJWT.requireRole(2), hrController.deleteJobPosting);
    app.get("/api/hr/my-companies", verifyJWT.verifyJWT, verifyJWT.requireRole(2), hrController.getMyCompanies);

    // API HR Candidate Management (Require JWT + HR Role)
    app.get("/api/hr/active-jobs", verifyJWT.verifyJWT, verifyJWT.requireRole(2), hrController.getActiveJobPostings);
    app.get("/api/hr/applications", verifyJWT.verifyJWT, verifyJWT.requireRole(2), hrController.getJobApplications);
    app.get("/api/hr/applications/statistics", verifyJWT.verifyJWT, verifyJWT.requireRole(2), hrController.getApplicationStatistics);
    app.get("/api/hr/applications/detail", verifyJWT.verifyJWT, verifyJWT.requireRole(2), hrController.getApplicationDetail);
    app.put("/api/hr/applications/:applicationId", verifyJWT.verifyJWT, verifyJWT.requireRole(2), hrController.updateApplicationStatus);
    app.get("/api/hr/test-submissions", verifyJWT.verifyJWT, verifyJWT.requireRole(2), hrController.getTestSubmissions);

    // API HR Company Profile (Require JWT + HR Role)
    app.get("/api/hr/company-profile", verifyJWT.verifyJWT, verifyJWT.requireRole(2), hrController.getCompanyProfile);
    app.put("/api/hr/company-profile", verifyJWT.verifyJWT, verifyJWT.requireRole(2), hrController.updateCompanyProfile);

    // API HR Statistics (Require JWT + HR Role)
    app.get("/api/hr/statistics/dashboard", verifyJWT.verifyJWT, verifyJWT.requireRole(2), statisticsHrController.getDashboardStatistics);
    app.get("/api/hr/statistics/trends", verifyJWT.verifyJWT, verifyJWT.requireRole(2), statisticsHrController.getApplicationTrends);

    // API HR Test Management (Require JWT + HR Role)
    app.post("/api/hr/tests", verifyJWT.verifyJWT, verifyJWT.requireRole(2), testController.createTest);
    app.get("/api/hr/tests", verifyJWT.verifyJWT, verifyJWT.requireRole(2), testController.getMyTests);
    app.get("/api/hr/tests/detail", verifyJWT.verifyJWT, verifyJWT.requireRole(2), testController.getTestDetail);
    app.put("/api/hr/tests/:testId", verifyJWT.verifyJWT, verifyJWT.requireRole(2), testController.updateTest);
    app.delete("/api/hr/tests/:testId", verifyJWT.verifyJWT, verifyJWT.requireRole(2), testController.deleteTest);
    app.post("/api/hr/tests/questions", verifyJWT.verifyJWT, verifyJWT.requireRole(2), testController.addQuestion);
    app.post("/api/hr/tests/questions/bulk", verifyJWT.verifyJWT, verifyJWT.requireRole(2), testController.addMultipleQuestions);
    app.put("/api/hr/tests/questions/:questionId", verifyJWT.verifyJWT, verifyJWT.requireRole(2), testController.updateQuestion);
    app.delete("/api/hr/tests/questions/:questionId", verifyJWT.verifyJWT, verifyJWT.requireRole(2), testController.deleteQuestion);

    // API HR Question Bank Management (Require JWT + HR Role)
    app.post("/api/hr/question-banks/upload", verifyJWT.verifyJWT, verifyJWT.requireRole(2), uploadQuestionBank.single('file'), questionBankController.uploadQuestionBank);
    app.post("/api/hr/question-banks/:bankId/confirm-training", verifyJWT.verifyJWT, verifyJWT.requireRole(2), questionBankController.confirmAndGenerateTrainingData);
    app.get("/api/hr/question-banks/:bankId/training-status", verifyJWT.verifyJWT, verifyJWT.requireRole(2), questionBankController.getTrainingStatus);
    app.get("/api/hr/question-banks", verifyJWT.verifyJWT, verifyJWT.requireRole(2), questionBankController.getQuestionBanks);
    app.get("/api/hr/question-banks/:bankId", verifyJWT.verifyJWT, verifyJWT.requireRole(2), questionBankController.getQuestionBankDetail);
    app.get("/api/hr/question-banks/items/search", verifyJWT.verifyJWT, verifyJWT.requireRole(2), questionBankController.getQuestionBankItems);
    app.delete("/api/hr/question-banks/:bankId", verifyJWT.verifyJWT, verifyJWT.requireRole(2), questionBankController.deleteQuestionBank);
    app.put("/api/hr/question-banks/items/:itemId", verifyJWT.verifyJWT, verifyJWT.requireRole(2), questionBankController.updateQuestionBankItem);

    // API Training Data (PHA A - Chuẩn bị dữ liệu cho ML model) (Require JWT + HR Role)
    app.get("/api/hr/training-data/questions", verifyJWT.verifyJWT, verifyJWT.requireRole(2), trainingDataController.getEssayQuestions);
    app.get("/api/hr/training-data/answers", verifyJWT.verifyJWT, verifyJWT.requireRole(2), trainingDataController.getGradedAnswers);
    app.post("/api/hr/training-data/dataset", verifyJWT.verifyJWT, verifyJWT.requireRole(2), trainingDataController.createDataset);
    app.post("/api/hr/training-data/export", verifyJWT.verifyJWT, verifyJWT.requireRole(2), trainingDataController.exportDataset);
    
    // API CV Matching Training Data Generation (Require JWT + HR Role)
    app.post("/api/hr/cv-matching/generate-training-data", verifyJWT.verifyJWT, verifyJWT.requireRole(2), trainingDataController.generateCVMatchingTrainingData);
    app.get("/api/hr/cv-matching/training-data/status", verifyJWT.verifyJWT, verifyJWT.requireRole(2), trainingDataController.getCVMatchingTrainingDataStatus);
    
    // API Debug - PHA B: Export dữ liệu để train (không cần JWT cho dev, có thể thêm sau)
    app.get("/api/debug/export-answers", trainingDataController.exportAnswersForTraining);
    app.get("/api/debug/answers-needing-grading", trainingDataController.getAnswersNeedingGrading);
    app.post("/api/debug/grade-with-llm", trainingDataController.gradeWithLLM);

    // API Test Submission & Grading (Require JWT)
    app.post("/api/test-submissions/submit", verifyJWT.verifyJWT, testSubmissionController.submitTest);
    app.get("/api/test-submissions/:submissionId/grading", verifyJWT.verifyJWT, verifyJWT.requireRole(2), testSubmissionController.getSubmissionForGrading);
    app.post("/api/test-submissions/answers/:answerId/grade", verifyJWT.verifyJWT, verifyJWT.requireRole(2), testSubmissionController.gradeAnswer);
    app.post("/api/test-submissions/:submissionId/finalize", verifyJWT.verifyJWT, verifyJWT.requireRole(2), testSubmissionController.finalizeGrading);
    app.get("/api/test-submissions/:submissionId/result", verifyJWT.verifyJWT, testSubmissionController.getSubmissionResult);
    app.post("/api/test-submissions/:submissionId/auto-grade", verifyJWT.verifyJWT, verifyJWT.requireRole(2), testSubmissionController.autoGradeSubmission);
    app.get("/api/candidate/test-submissions", verifyJWT.verifyJWT, testSubmissionController.getMyTestSubmissions);

    // API Violation Logging (Anti-cheat) (Require JWT)
    app.post("/api/violations/log", verifyJWT.verifyJWT, violationController.logViolation);
    app.get("/api/violations/:submissionId/count", verifyJWT.verifyJWT, violationController.getViolationCount);
    app.get("/api/violations/:submissionId", verifyJWT.verifyJWT, violationController.getViolationsForSubmission);

    // API Interview Round Management (Require JWT + HR Role)
    app.get("/api/hr/interview-rounds", verifyJWT.verifyJWT, verifyJWT.requireRole(2), interviewRoundController.getInterviewRounds);
    app.post("/api/hr/interview-rounds", verifyJWT.verifyJWT, verifyJWT.requireRole(2), interviewRoundController.createInterviewRound);
    app.put("/api/hr/interview-rounds/:roundId", verifyJWT.verifyJWT, verifyJWT.requireRole(2), interviewRoundController.updateInterviewRound);
    app.delete("/api/hr/interview-rounds/:roundId", verifyJWT.verifyJWT, verifyJWT.requireRole(2), interviewRoundController.deleteInterviewRound);

    // API Meeting Management (Require JWT)
    // API tạo lịch phỏng vấn, tạo phòng - Cần JWT
    app.get("/api/hr/meetings", verifyJWT.verifyJWT, verifyJWT.requireRole(2), meetingController.getMeetingsForHr);
    app.get("/api/candidate/meetings", verifyJWT.verifyJWT, meetingController.getMeetingsForCandidate);
    // API lấy meeting by roomName hoặc meetingId - Cần JWT
    app.get("/api/meetings/room/:roomName", verifyJWT.verifyJWT, meetingController.getMeetingByRoomName);
    app.get("/api/meetings/:meetingId", verifyJWT.verifyJWT, meetingController.getMeetingById);
    app.post("/api/hr/meetings", verifyJWT.verifyJWT, verifyJWT.requireRole(2), meetingController.createMeeting);
    app.put("/api/meetings/:meetingId/status", verifyJWT.verifyJWT, meetingController.updateMeetingStatus);
    app.put("/api/hr/meetings/:meetingId", verifyJWT.verifyJWT, verifyJWT.requireRole(2), meetingController.updateMeeting);
    app.put("/api/hr/meetings/:meetingId/invitation-status", verifyJWT.verifyJWT, verifyJWT.requireRole(2), meetingController.updateInvitationStatus);
    app.delete("/api/hr/meetings/:meetingId", verifyJWT.verifyJWT, verifyJWT.requireRole(2), meetingController.cancelMeeting);
    // API lấy danh sách ứng viên và meeting gần nhất theo JobPosting
    app.get("/api/hr/meetings/candidates", verifyJWT.verifyJWT, verifyJWT.requireRole(2), meetingController.getCandidatesByJobPosting);
    app.get("/api/hr/meetings/latest", verifyJWT.verifyJWT, verifyJWT.requireRole(2), meetingController.getLatestMeetingByJobPosting);

    // API Interview Response (Public - No JWT required, uses interview_token)
    app.get("/api/interview/verify/:token", interviewController.verifyInterviewToken);
    app.post("/api/interview/response", interviewController.handleInterviewResponse);

    // API Application Documents (Require JWT)
    const applicationDocumentController = require('../controller/applicationDocumentController');
    app.get("/api/applications/:applicationId/documents", verifyJWT.verifyJWT, applicationDocumentController.getDocumentsByApplication);
    app.get("/api/applications/:applicationId/documents/check", verifyJWT.verifyJWT, applicationDocumentController.checkCanSubmitDocuments);
    app.post("/api/applications/:applicationId/documents", verifyJWT.verifyJWT, applicationDocumentController.createOrUpdateDocument);
    app.put("/api/documents/:documentId/status", verifyJWT.verifyJWT, verifyJWT.requireRole(2), applicationDocumentController.updateDocumentStatus);
    app.delete("/api/documents/:documentId", verifyJWT.verifyJWT, applicationDocumentController.deleteDocument);
    
    // API HR Documents Management (Require JWT + HR Role)
    app.get("/api/hr/documents", verifyJWT.verifyJWT, verifyJWT.requireRole(2), applicationDocumentController.getAllDocumentsForHr);

    // API Utilities
    app.get("/api/majors", utilityController.getAllMajors);
    app.get("/api/formats", utilityController.getAllFormats);
    app.get("/api/job-posting-statuses", utilityController.getAllJobPostingStatuses);
    
    app.use("/", router);
};

export default initWebRoutes; 