import hrService from '../service/hrService';

const getDashboard = async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: ''
            });
        }

        const data = await hrService.getDashboardData(userId);

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

const getMyJobPostings = async (req, res) => {
    try {
        const { userId, page = 1, limit = 10 } = req.query;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: ''
            });
        }

        const data = await hrService.getMyJobPostings(userId, parseInt(page), parseInt(limit));

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

const getJobPostingDetail = async (req, res) => {
    try {
        const { userId, jobId } = req.query;

        if (!userId || !jobId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: ''
            });
        }

        const data = await hrService.getJobPostingDetailForHr(userId, jobId);

        return res.status(data.EC === 0 ? 200 : 400).json({
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

const deleteJobPosting = async (req, res) => {
    try {
        const { userId } = req.query;
        const { jobId } = req.params;

        if (!userId || !jobId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: ''
            });
        }

        const data = await hrService.deleteJobPostingForHr(userId, jobId);

        return res.status(data.EC === 0 ? 200 : 400).json({
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

const createJobPosting = async (req, res) => {
    try {
        const { userId } = req.query;
        const data = req.body;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: ''
            });
        }

        const result = await hrService.createJobPostingForHr(userId, data);

        return res.status(result.EC === 0 ? 200 : 400).json({
            EM: result.EM,
            EC: result.EC,
            DT: result.DT
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

const updateJobPosting = async (req, res) => {
    try {
        const { userId } = req.query;
        const { jobId } = req.params;
        const data = req.body;

        if (!userId || !jobId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: ''
            });
        }

        const result = await hrService.updateJobPostingForHr(userId, jobId, data);

        return res.status(result.EC === 0 ? 200 : 400).json({
            EM: result.EM,
            EC: result.EC,
            DT: result.DT
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

const getJobApplications = async (req, res) => {
    try {
        const { userId, statusId = 'all', page = 1, limit = 10, search = '' } = req.query;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: ''
            });
        }

        const filters = {
            statusId,
            page: parseInt(page),
            limit: parseInt(limit),
            search: search.trim()
        };

        const data = await hrService.getJobApplicationsForHr(userId, filters);

        return res.status(data.EC === 0 ? 200 : 400).json({
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

const getApplicationStatistics = async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: ''
            });
        }

        const data = await hrService.getApplicationStatistics(userId);

        return res.status(data.EC === 0 ? 200 : 400).json({
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

const getApplicationDetail = async (req, res) => {
    try {
        const { userId, applicationId } = req.query;

        if (!userId || !applicationId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: ''
            });
        }

        const data = await hrService.getApplicationDetail(userId, applicationId);

        return res.status(data.EC === 0 ? 200 : 400).json({
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

const updateApplicationStatus = async (req, res) => {
    try {
        const { userId } = req.query;
        const { applicationId } = req.params;
        const { statusId } = req.body;

        if (!userId || !applicationId || !statusId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: ''
            });
        }

        const data = await hrService.updateApplicationStatus(userId, applicationId, statusId);

        return res.status(data.EC === 0 ? 200 : 400).json({
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
    getDashboard,
    getMyJobPostings,
    getJobPostingDetail,
    deleteJobPosting,
    createJobPosting,
    updateJobPosting,
    getJobApplications,
    getApplicationStatistics,
    getApplicationDetail,
    updateApplicationStatus
};


