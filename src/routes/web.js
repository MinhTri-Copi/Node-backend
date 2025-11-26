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
import upload from '../middleware/uploadCV';

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
    
    // API Record
    app.get("/api/records", recordController.getMyRecords);
    app.get("/api/records/:id", recordController.getRecordById);
    app.post("/api/records", recordController.createRecord);
    app.put("/api/records/:id", recordController.updateRecord);
    app.delete("/api/records/:id", recordController.deleteRecord);
    
    // API Upload CV
    app.post("/api/upload-cv", upload.single('cv'), recordController.uploadCV);
    
    // API Job Posting
    app.get("/api/jobs", jobPostingController.getListJobPosting);
    app.get("/api/jobs/:id", jobPostingController.getJobPostingById);
    app.post("/api/jobs", jobPostingController.createJobPosting);
    app.put("/api/jobs/:id", jobPostingController.updateJobPosting);
    app.delete("/api/jobs/:id", jobPostingController.deleteJobPosting);

    // API Job Application
    app.post("/api/job-applications", jobApplicationController.applyJob);
    app.get("/api/job-applications/check", jobApplicationController.checkApplied);
    app.get("/api/job-applications", jobApplicationController.getMyApplications);

    // API HR Dashboard
    app.get("/api/hr/dashboard", hrController.getDashboard);
    app.get("/api/hr/job-postings", hrController.getMyJobPostings);
    app.get("/api/hr/job-postings/detail", hrController.getJobPostingDetail);
    app.post("/api/hr/job-postings", hrController.createJobPosting);
    app.put("/api/hr/job-postings/:jobId", hrController.updateJobPosting);
    app.delete("/api/hr/job-postings/:jobId", hrController.deleteJobPosting);
    app.get("/api/hr/my-companies", hrController.getMyCompanies);

    // API HR Candidate Management
    app.get("/api/hr/active-jobs", hrController.getActiveJobPostings); // Get job postings with applications
    app.get("/api/hr/applications", hrController.getJobApplications);
    app.get("/api/hr/applications/statistics", hrController.getApplicationStatistics);
    app.get("/api/hr/applications/detail", hrController.getApplicationDetail);
    app.put("/api/hr/applications/:applicationId", hrController.updateApplicationStatus);

    // API HR Company Profile
    app.get("/api/hr/company-profile", hrController.getCompanyProfile);
    app.put("/api/hr/company-profile", hrController.updateCompanyProfile);

    // API HR Statistics
    app.get("/api/hr/statistics/dashboard", statisticsHrController.getDashboardStatistics);
    app.get("/api/hr/statistics/trends", statisticsHrController.getApplicationTrends);

    // API Utilities
    app.get("/api/majors", utilityController.getAllMajors);
    app.get("/api/formats", utilityController.getAllFormats);
    app.get("/api/job-posting-statuses", utilityController.getAllJobPostingStatuses);
    
    app.use("/", router);
};

export default initWebRoutes; 