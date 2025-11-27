import jobApplicationService from '../service/jobApplicationService';

const applyJob = async (req, res) => {
    try {
        let data = await jobApplicationService.applyJob(req.body);
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

const checkApplied = async (req, res) => {
    try {
        const { userId, jobPostingId } = req.query;

        if (!userId || !jobPostingId) {
            return res.status(400).json({
                EM: 'Thiếu userId hoặc jobPostingId!',
                EC: 1,
                DT: ''
            });
        }

        let data = await jobApplicationService.checkApplied(userId, jobPostingId);

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

const getMyApplications = async (req, res) => {
    try {
        const userId = req.query.userId;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: ''
            });
        }

        let data = await jobApplicationService.getApplicationsByUser(userId);

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

const startTest = async (req, res) => {
    try {
        const { userId } = req.body;
        const { applicationId } = req.body;

        if (!userId || !applicationId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            });
        }

        const data = await jobApplicationService.startTestForApplication(userId, applicationId);

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

const getTestSubmissionDetail = async (req, res) => {
    try {
        const { userId } = req.query;
        const { submissionId } = req.params;

        if (!userId || !submissionId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            });
        }

        const data = await jobApplicationService.getTestSubmissionDetail(userId, submissionId);

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
    applyJob,
    checkApplied,
    getMyApplications,
    startTest,
    getTestSubmissionDetail
};


