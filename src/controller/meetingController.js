const meetingService = require('../service/meetingService');

const getMeetingsForHr = async (req, res) => {
    try {
        const { userId } = req.query;
        const { status, jobApplicationId } = req.query;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            });
        }

        const filters = {};
        if (status && status !== 'all') {
            filters.status = status;
        }
        if (jobApplicationId) {
            filters.jobApplicationId = jobApplicationId;
        }

        const data = await meetingService.getMeetingsForHr(userId, filters);

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in getMeetingsForHr controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const getMeetingsForCandidate = async (req, res) => {
    try {
        const { userId } = req.query;
        const { status } = req.query;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            });
        }

        const filters = {};
        if (status && status !== 'all') {
            filters.status = status;
        }

        const data = await meetingService.getMeetingsForCandidate(userId, filters);

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in getMeetingsForCandidate controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const getMeetingById = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { userId, role } = req.query;

        if (!userId || !meetingId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            });
        }

        const data = await meetingService.getMeetingById(meetingId, userId, role || 'hr');

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in getMeetingById controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const createMeeting = async (req, res) => {
    try {
        const { userId } = req.query;
        const data = req.body;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            });
        }

        const result = await meetingService.createMeeting(userId, data);

        return res.status(result.EC === 0 ? 200 : 400).json({
            EM: result.EM,
            EC: result.EC,
            DT: result.DT
        });
    } catch (error) {
        console.error('Error in createMeeting controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const updateMeetingStatus = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { userId, status, role } = req.query;

        if (!userId || !meetingId || !status) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            });
        }

        const data = await meetingService.updateMeetingStatus(meetingId, userId, status, role || 'hr');

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in updateMeetingStatus controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const updateMeeting = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { userId } = req.query;
        const data = req.body;

        if (!userId || !meetingId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            });
        }

        const result = await meetingService.updateMeeting(meetingId, userId, data);

        return res.status(result.EC === 0 ? 200 : 400).json({
            EM: result.EM,
            EC: result.EC,
            DT: result.DT
        });
    } catch (error) {
        console.error('Error in updateMeeting controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const cancelMeeting = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { userId } = req.query;

        if (!userId || !meetingId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            });
        }

        const data = await meetingService.cancelMeeting(meetingId, userId);

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in cancelMeeting controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

module.exports = {
    getMeetingsForHr,
    getMeetingsForCandidate,
    getMeetingById,
    createMeeting,
    updateMeetingStatus,
    updateMeeting,
    cancelMeeting
};

