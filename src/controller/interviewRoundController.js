const interviewRoundService = require('../service/interviewRoundService');

const getInterviewRounds = async (req, res) => {
    try {
        const { userId } = req.query;
        const { jobPostingId, isActive } = req.query;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            });
        }

        const filters = {};
        if (jobPostingId && jobPostingId !== 'all') {
            filters.jobPostingId = jobPostingId;
        }
        if (isActive !== undefined) {
            filters.isActive = isActive === 'true';
        }

        const data = await interviewRoundService.getInterviewRounds(userId, filters);

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in getInterviewRounds controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const createInterviewRound = async (req, res) => {
    try {
        const { userId } = req.query;
        const { jobPostingId, roundNumber, title, duration, description, isActive } = req.body;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            });
        }

        const data = await interviewRoundService.createInterviewRound(userId, {
            jobPostingId,
            roundNumber,
            title,
            duration,
            description,
            isActive
        });

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in createInterviewRound controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const updateInterviewRound = async (req, res) => {
    try {
        const { userId } = req.query;
        const { roundId } = req.params;
        const { roundNumber, title, duration, description, isActive } = req.body;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            });
        }

        const data = await interviewRoundService.updateInterviewRound(userId, parseInt(roundId), {
            roundNumber,
            title,
            duration,
            description,
            isActive
        });

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in updateInterviewRound controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const deleteInterviewRound = async (req, res) => {
    try {
        const { userId } = req.query;
        const { roundId } = req.params;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            });
        }

        const data = await interviewRoundService.deleteInterviewRound(userId, parseInt(roundId));

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in deleteInterviewRound controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

module.exports = {
    getInterviewRounds,
    createInterviewRound,
    updateInterviewRound,
    deleteInterviewRound
};

