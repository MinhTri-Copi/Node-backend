import express from 'express';
import helloController from '../controller/helloController';
import loginRegisterController from '../controller/loginRegisterController';
import companyController from '../controller/companyController';
import recordController from '../controller/recordController';
import jobPostingController from '../controller/jobPostingController';
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
    
    app.use("/", router);
};

export default initWebRoutes; 