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

        // Parse userId as integer
        const parsedUserId = parseInt(userId, 10);
        if (isNaN(parsedUserId)) {
            return res.status(400).json({
                EM: 'userId không hợp lệ!',
                EC: 2,
                DT: null
            });
        }

        const filters = {};
        if (status && status !== 'all') {
            filters.status = status;
        }
        if (jobApplicationId) {
            filters.jobApplicationId = parseInt(jobApplicationId, 10);
        }
        if (jobPostingId) {
            filters.jobPostingId = parseInt(jobPostingId, 10);
        }

        const data = await meetingService.getMeetingsForHr(parsedUserId, filters);

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

const updateInvitationStatus = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { userId } = req.query;
        const { action, scheduledAt, updateApplicationStatus } = req.body;

        if (!userId || !meetingId || !action) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            });
        }

        const data = {
            scheduledAt,
            updateApplicationStatus
        };

        const result = await meetingService.updateInvitationStatus(meetingId, userId, action, data);

        return res.status(result.EC === 0 ? 200 : 400).json({
            EM: result.EM,
            EC: result.EC,
            DT: result.DT
        });
    } catch (error) {
        console.error('Error in updateInvitationStatus controller:', error);
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

const startRecording = async (req, res) => {
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

        const data = await meetingService.startRecording(userId, parseInt(meetingId));

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in startRecording controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const stopRecording = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { userId } = req.query;
        const { recordingUrl } = req.body;

        if (!userId || !meetingId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            });
        }

        const data = await meetingService.stopRecording(userId, parseInt(meetingId), recordingUrl);

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in stopRecording controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const updateRecordingUrl = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { recordingUrl } = req.body;

        if (!meetingId || !recordingUrl) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            });
        }

        const data = await meetingService.updateRecordingUrl(parseInt(meetingId), recordingUrl);

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in updateRecordingUrl controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const getRecording = async (req, res) => {
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

        const data = await meetingService.getRecording(userId, parseInt(meetingId));

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in getRecording controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const uploadRecording = async (req, res) => {
    const startTime = Date.now();
    try {
        console.log('📤 ========== UPLOAD RECORDING REQUEST ==========');
        console.log('   - Meeting ID:', req.body.meetingId);
        console.log('   - File exists:', !!req.file);
        
        if (!req.file) {
            console.error('❌ No file in request');
            return res.status(400).json({
                EM: 'Vui lòng chọn file recording!',
                EC: 1,
                DT: null
            });
        }

        const { meetingId } = req.body;
        console.log('   - Meeting ID from body:', meetingId);
        
        if (!meetingId) {
            console.error('❌ Missing meetingId');
            return res.status(400).json({
                EM: 'Thiếu thông tin meeting!',
                EC: 1,
                DT: null
            });
        }

        // Import path and fs
        const path = require('path');
        const fs = require('fs');

        console.log('   - File info:');
        console.log('     * Original name:', req.file.originalname);
        console.log('     * Saved filename:', req.file.filename);
        console.log('     * Size:', req.file.size, 'bytes (', (req.file.size / 1024 / 1024).toFixed(2), 'MB)');
        console.log('     * MIME type:', req.file.mimetype);

        // Get file path
        const filePath = `/uploads/recordings/${req.file.filename}`;
        const baseUrl = process.env.BASE_URL || 'http://localhost:8082';
        const recordingUrl = `${baseUrl}${filePath}`;
        
        console.log('   - File path:', filePath);
        console.log('   - Base URL:', baseUrl);
        console.log('   - Recording URL:', recordingUrl);

        // Update meeting with recording URL
        console.log('   - Updating meeting recording URL...');
        const updateStartTime = Date.now();
        const data = await meetingService.updateRecordingUrl(parseInt(meetingId), recordingUrl);
        const updateTime = Date.now() - updateStartTime;
        console.log('   - Update time:', updateTime, 'ms');
        console.log('   - Update result:', data);

        if (data.EC !== 0) {
            console.error('❌ Failed to update recording URL');
            console.error('   - Error code:', data.EC);
            console.error('   - Error message:', data.EM);
            
            // If update fails, delete uploaded file
            const filePathToDelete = path.resolve(__dirname, '..', 'public', 'uploads', 'recordings', req.file.filename);
            console.log('   - Deleting uploaded file:', filePathToDelete);
            if (fs.existsSync(filePathToDelete)) {
                fs.unlinkSync(filePathToDelete);
                console.log('   - File deleted');
            }
            
            return res.status(400).json({
                EM: data.EM || 'Không thể lưu recording URL!',
                EC: data.EC,
                DT: null
            });
        }

        const totalTime = Date.now() - startTime;
        console.log('✅ ========== UPLOAD RECORDING SUCCESS ==========');
        console.log('   - Total time:', totalTime, 'ms');
        console.log('   - Recording URL saved:', recordingUrl);

        return res.status(200).json({
            EM: 'Upload recording thành công!',
            EC: 0,
            DT: {
                fileName: req.file.filename,
                filePath: filePath,
                recordingUrl: recordingUrl,
                meetingId: parseInt(meetingId)
            }
        });
    } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error('❌ ========== UPLOAD RECORDING ERROR ==========');
        console.error('   - Error:', error);
        console.error('   - Error message:', error.message);
        console.error('   - Error stack:', error.stack);
        console.error('   - Total time before error:', totalTime, 'ms');
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
    updateInvitationStatus,
    cancelMeeting,
    getCandidatesByJobPosting,
    getLatestMeetingByJobPosting,
    startRecording,
    stopRecording,
    updateRecordingUrl,
    getRecording,
    uploadRecording
};

