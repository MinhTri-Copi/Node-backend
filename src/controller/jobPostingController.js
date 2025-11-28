import jobPostingService from '../service/jobPostingService';

// Get list of job postings with filters
const getListJobPosting = async (req, res) => {
    try {
        let page = req.query.page || 1;
        let limit = req.query.limit || 10;
        
        // Get filters from query params
        let filters = {
            keyword: req.query.keyword,
            location: req.query.location,
            experience: req.query.experience,
            minSalary: req.query.minSalary,
            maxSalary: req.query.maxSalary,
            companyId: req.query.companyId,
            formatId: req.query.formatId,
            majorId: req.query.majorId
        };

        let data = await jobPostingService.getListJobPosting(+page, +limit, filters);

        return res.status(200).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: ''
        });
    }
};

// Get job posting by ID
const getJobPostingById = async (req, res) => {
    try {
        let id = req.params.id;

        let data = await jobPostingService.getJobPostingById(id);

        return res.status(200).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: ''
        });
    }
};

// Create job posting
const createJobPosting = async (req, res) => {
    try {
        let data = await jobPostingService.createJobPosting(req.body);

        return res.status(200).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: ''
        });
    }
};

// Update job posting
const updateJobPosting = async (req, res) => {
    try {
        let id = req.params.id;

        let data = await jobPostingService.updateJobPosting(id, req.body);

        return res.status(200).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: ''
        });
    }
};

// Delete job posting
const deleteJobPosting = async (req, res) => {
    try {
        let id = req.params.id;

        let data = await jobPostingService.deleteJobPosting(id);

        return res.status(200).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: ''
        });
    }
};

// Get filter options
const getFilterOptions = async (req, res) => {
    try {
        let data = await jobPostingService.getFilterOptions();

        return res.status(200).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: ''
        });
    }
};

export default {
    getListJobPosting,
    getJobPostingById,
    createJobPosting,
    updateJobPosting,
    deleteJobPosting,
    getFilterOptions
};

