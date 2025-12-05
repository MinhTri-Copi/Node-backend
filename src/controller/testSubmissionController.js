import testSubmissionService from '../service/testSubmissionService';
import aiGradingService from '../service/aiGradingService';

const submitTest = async (req, res) => {
    try {
        const { userId, submissionId, answers } = req.body;

        if (!userId || !submissionId || !answers) {
            return res.status(400).json({
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            });
        }

        const data = await testSubmissionService.submitTest(userId, submissionId, answers);

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in submitTest controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const gradeAnswer = async (req, res) => {
    try {
        const { hrUserId } = req.body;
        const { answerId } = req.params;
        const scoreData = req.body;

        if (!hrUserId || !answerId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            });
        }

        const data = await testSubmissionService.gradeAnswer(hrUserId, answerId, scoreData);

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in gradeAnswer controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const finalizeGrading = async (req, res) => {
    try {
        const { hrUserId, submissionId } = req.body;

        if (!hrUserId || !submissionId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            });
        }

        const data = await testSubmissionService.finalizeGrading(hrUserId, submissionId);

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in finalizeGrading controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const getSubmissionForGrading = async (req, res) => {
    try {
        const { hrUserId } = req.query;
        const { submissionId } = req.params;

        if (!hrUserId || !submissionId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            });
        }

        const data = await testSubmissionService.getSubmissionForGrading(hrUserId, submissionId);

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in getSubmissionForGrading controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const getSubmissionResult = async (req, res) => {
    try {
        const { userId, isHR } = req.query;
        const { submissionId } = req.params;

        if (!userId || !submissionId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            });
        }

        const data = await testSubmissionService.getSubmissionResult(
            parseInt(userId), 
            parseInt(submissionId), 
            isHR === 'true'
        );

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in getSubmissionResult controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const autoGradeSubmission = async (req, res) => {
    try {
        const { submissionId } = req.params;

        if (!submissionId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            });
        }

        const data = await aiGradingService.autoGradeSubmission(submissionId);

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in autoGradeSubmission controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const getMyTestSubmissions = async (req, res) => {
    try {
        const { userId, status = 'all', jobPostingId = 'all', page = 1, limit = 10 } = req.query;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            });
        }

        const data = await testSubmissionService.getMyTestSubmissions(parseInt(userId), {
            status,
            jobPostingId,
            page: parseInt(page),
            limit: parseInt(limit)
        });

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in getMyTestSubmissions controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

export default {
    submitTest,
    gradeAnswer,
    finalizeGrading,
    getSubmissionForGrading,
    getSubmissionResult,
    autoGradeSubmission,
    getMyTestSubmissions
};

