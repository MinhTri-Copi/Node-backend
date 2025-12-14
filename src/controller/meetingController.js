const meetingService = require('../service/meetingService');

const getMeetingsForHr = async (req, res) => {
    try {
        const { userId } = req.query;
        const { status, jobApplicationId, jobPostingId } = req.query;

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
        if (jobPostingId) {
            filters.jobPostingId = parseInt(jobPostingId);
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

const getMeetingByRoomName = async (req, res) => {
    try {
        const { roomName } = req.params;
        
        // Use userId from JWT token (more secure than query param)
        const userId = req.user?.id;
        
        console.log('getMeetingByRoomName controller - roomName:', roomName, 'userId from JWT:', userId);

        if (!roomName || !userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            });
        }

        const data = await meetingService.getMeetingByRoomName(roomName, userId);

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in getMeetingByRoomName controller:', error);
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

const getCandidatesByJobPosting = async (req, res) => {
    try {
        const { userId, jobPostingId, interviewRoundId } = req.query;

        if (!userId || !jobPostingId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            });
        }

        const data = await meetingService.getCandidatesByJobPosting(
            userId, 
            jobPostingId, 
            interviewRoundId ? parseInt(interviewRoundId) : null
        );

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in getCandidatesByJobPosting controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const getLatestMeetingByJobPosting = async (req, res) => {
    try {
        const { userId, jobPostingId } = req.query;

        if (!userId || !jobPostingId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            });
        }

        const data = await meetingService.getLatestMeetingByJobPosting(userId, jobPostingId);

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in getLatestMeetingByJobPosting controller:', error);
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
    getMeetingByRoomName,
    getMeetingById,
    createMeeting,
    updateMeetingStatus,
    updateMeeting,
    cancelMeeting,
    getCandidatesByJobPosting,
    getLatestMeetingByJobPosting
};

