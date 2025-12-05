const db = require('../models');
const { Op } = db.Sequelize;
const crypto = require('crypto');

/**
 * Generate unique room name for Jitsi meeting
 */
const generateRoomName = () => {
    const prefix = 'phongpv';
    const randomString = crypto.randomBytes(8).toString('hex');
    return `${prefix}-${randomString}`;
};

/**
 * Get meetings for HR
 */
const getMeetingsForHr = async (userId, filters = {}) => {
    try {
        if (!userId) {
            return {
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            };
        }

        // Build where clause
        const whereClause = {
            hrUserId: userId
        };

        if (filters.status && filters.status !== 'all') {
            whereClause.status = filters.status;
        }

        if (filters.jobApplicationId) {
            whereClause.jobApplicationId = filters.jobApplicationId;
        }

        // Get meetings
        const meetings = await db.Meeting.findAll({
            where: whereClause,
            include: [
                {
                    model: db.InterviewRound,
                    as: 'InterviewRound',
                    attributes: ['id', 'roundNumber', 'title', 'duration']
                },
                {
                    model: db.JobApplication,
                    as: 'JobApplication',
                    attributes: ['id'],
                    include: [
                        {
                            model: db.JobPosting,
                            attributes: ['id', 'Tieude'],
                            include: [
                                {
                                    model: db.Company,
                                    attributes: ['id', 'Tencongty']
                                }
                            ]
                        },
                        {
                            model: db.Record,
                            include: [
                                {
                                    model: db.User,
                                    attributes: ['id', 'Hoten', 'email', 'SDT']
                                }
                            ]
                        }
                    ]
                },
                {
                    model: db.User,
                    as: 'Candidate',
                    attributes: ['id', 'Hoten', 'email', 'SDT']
                }
            ],
            order: [['scheduledAt', 'DESC']]
        });

        return {
            EM: 'Lấy danh sách meeting thành công!',
            EC: 0,
            DT: meetings.map(m => m.toJSON())
        };
    } catch (error) {
        console.error('Error in getMeetingsForHr:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy danh sách meeting!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get meetings for candidate
 */
const getMeetingsForCandidate = async (userId, filters = {}) => {
    try {
        if (!userId) {
            return {
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            };
        }

        // Build where clause
        const whereClause = {
            candidateUserId: userId
        };

        if (filters.status && filters.status !== 'all') {
            whereClause.status = filters.status;
        }

        // Get meetings
        const meetings = await db.Meeting.findAll({
            where: whereClause,
            include: [
                {
                    model: db.InterviewRound,
                    as: 'InterviewRound',
                    attributes: ['id', 'roundNumber', 'title', 'duration', 'description']
                },
                {
                    model: db.JobApplication,
                    as: 'JobApplication',
                    attributes: ['id'],
                    include: [
                        {
                            model: db.JobPosting,
                            attributes: ['id', 'Tieude'],
                            include: [
                                {
                                    model: db.Company,
                                    attributes: ['id', 'Tencongty']
                                }
                            ]
                        }
                    ]
                },
                {
                    model: db.User,
                    as: 'HR',
                    attributes: ['id', 'Hoten', 'email', 'SDT']
                }
            ],
            order: [['scheduledAt', 'DESC']]
        });

        return {
            EM: 'Lấy danh sách meeting thành công!',
            EC: 0,
            DT: meetings.map(m => m.toJSON())
        };
    } catch (error) {
        console.error('Error in getMeetingsForCandidate:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy danh sách meeting!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get meeting by roomName
 */
const getMeetingByRoomName = async (roomName, userId) => {
    try {
        if (!roomName || !userId) {
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            };
        }

        const meeting = await db.Meeting.findOne({
            where: { roomName },
            include: [
                {
                    model: db.InterviewRound,
                    as: 'InterviewRound',
                    attributes: ['id', 'roundNumber', 'title', 'duration', 'description']
                },
                {
                    model: db.JobApplication,
                    as: 'JobApplication',
                    attributes: ['id'],
                    include: [
                        {
                            model: db.JobPosting,
                            attributes: ['id', 'Tieude'],
                            include: [
                                {
                                    model: db.Company,
                                    attributes: ['id', 'Tencongty']
                                }
                            ]
                        }
                    ]
                },
                {
                    model: db.User,
                    as: 'HR',
                    attributes: ['id', 'Hoten', 'email', 'SDT']
                },
                {
                    model: db.User,
                    as: 'Candidate',
                    attributes: ['id', 'Hoten', 'email', 'SDT']
                }
            ]
        });

        if (!meeting) {
            return {
                EM: 'Không tìm thấy phòng phỏng vấn!',
                EC: 2,
                DT: null
            };
        }

        // Check if user has permission (HR or Candidate)
        // Convert to numbers for comparison (userId from query is string)
        const hrUserId = parseInt(meeting.hrUserId);
        const candidateUserId = parseInt(meeting.candidateUserId);
        const requestUserId = parseInt(userId);
        
        console.log('Permission check:', {
            roomName,
            requestUserId,
            hrUserId,
            candidateUserId,
            isHR: hrUserId === requestUserId,
            isCandidate: candidateUserId === requestUserId
        });
        
        if (hrUserId !== requestUserId && candidateUserId !== requestUserId) {
            console.log('❌ Access denied - User ID mismatch');
            return {
                EM: 'Bạn không có quyền truy cập phòng này!',
                EC: 3,
                DT: null
            };
        }
        
        console.log('✅ Access granted');

        return {
            EM: 'Lấy thông tin meeting thành công!',
            EC: 0,
            DT: meeting.toJSON()
        };
    } catch (error) {
        console.error('Error in getMeetingByRoomName:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy thông tin meeting!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get meeting by ID
 */
const getMeetingById = async (meetingId, userId, userRole = 'hr') => {
    try {
        if (!meetingId || !userId) {
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            };
        }

        const whereClause = { id: meetingId };
        if (userRole === 'hr') {
            whereClause.hrUserId = userId;
        } else {
            whereClause.candidateUserId = userId;
        }

        const meeting = await db.Meeting.findOne({
            where: whereClause,
            include: [
                {
                    model: db.InterviewRound,
                    as: 'InterviewRound',
                    attributes: ['id', 'roundNumber', 'title', 'duration', 'description']
                },
                {
                    model: db.JobApplication,
                    as: 'JobApplication',
                    attributes: ['id'],
                    include: [
                        {
                            model: db.JobPosting,
                            attributes: ['id', 'Tieude'],
                            include: [
                                {
                                    model: db.Company,
                                    attributes: ['id', 'Tencongty']
                                }
                            ]
                        },
                        {
                            model: db.Record,
                            include: [
                                {
                                    model: db.User,
                                    attributes: ['id', 'Hoten', 'email', 'SDT']
                                }
                            ]
                        }
                    ]
                },
                {
                    model: db.User,
                    as: 'HR',
                    attributes: ['id', 'Hoten', 'email', 'SDT']
                },
                {
                    model: db.User,
                    as: 'Candidate',
                    attributes: ['id', 'Hoten', 'email', 'SDT']
                }
            ]
        });

        if (!meeting) {
            return {
                EM: 'Không tìm thấy meeting hoặc bạn không có quyền truy cập!',
                EC: 2,
                DT: null
            };
        }

        return {
            EM: 'Lấy thông tin meeting thành công!',
            EC: 0,
            DT: meeting.toJSON()
        };
    } catch (error) {
        console.error('Error in getMeetingById:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy thông tin meeting!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Create meeting
 */
const createMeeting = async (userId, data) => {
    try {
        if (!userId) {
            return {
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            };
        }

        const { interviewRoundId, jobApplicationId, candidateUserId, scheduledAt, notes } = data;

        if (!interviewRoundId || !jobApplicationId || !candidateUserId || !scheduledAt) {
            return {
                EM: 'Vui lòng điền đầy đủ thông tin bắt buộc!',
                EC: 2,
                DT: null
            };
        }

        // Verify HR owns the interview round
        const interviewRound = await db.InterviewRound.findOne({
            where: { id: interviewRoundId },
            include: [
                {
                    model: db.JobPosting,
                    as: 'JobPosting',
                    attributes: ['id', 'recruiterId'],
                    include: [
                        {
                            model: db.Recruiter,
                            attributes: ['id', 'userId']
                        }
                    ]
                }
            ]
        });

        if (!interviewRound) {
            return {
                EM: 'Không tìm thấy vòng phỏng vấn!',
                EC: 3,
                DT: null
            };
        }

        // Check if HR owns this job posting
        const recruiter = await db.Recruiter.findOne({
            where: {
                userId: userId,
                id: interviewRound.JobPosting.recruiterId
            }
        });

        if (!recruiter) {
            return {
                EM: 'Bạn không có quyền tạo meeting cho vòng phỏng vấn này!',
                EC: 4,
                DT: null
            };
        }

        // Verify job application exists and belongs to candidate
        const jobApplication = await db.JobApplication.findOne({
            where: { id: jobApplicationId },
            include: [
                {
                    model: db.Record,
                    include: [
                        {
                            model: db.User,
                            where: { id: candidateUserId },
                            attributes: ['id']
                        }
                    ]
                }
            ]
        });

        if (!jobApplication) {
            return {
                EM: 'Không tìm thấy đơn ứng tuyển hoặc ứng viên không hợp lệ!',
                EC: 5,
                DT: null
            };
        }

        // Generate unique room name
        let roomName = generateRoomName();
        let attempts = 0;
        while (attempts < 10) {
            const existing = await db.Meeting.findOne({ where: { roomName } });
            if (!existing) break;
            roomName = generateRoomName();
            attempts++;
        }

        if (attempts >= 10) {
            return {
                EM: 'Không thể tạo tên phòng duy nhất. Vui lòng thử lại!',
                EC: 6,
                DT: null
            };
        }

        // Create meeting
        const meeting = await db.Meeting.create({
            interviewRoundId,
            jobApplicationId,
            hrUserId: userId,
            candidateUserId,
            scheduledAt: new Date(scheduledAt),
            roomName,
            meetingUrl: `https://meet.jit.si/${roomName}`,
            status: 'pending',
            notes: notes || null
        });

        // Get full details for email
        const fullMeeting = await db.Meeting.findOne({
            where: { id: meeting.id },
            include: [
                {
                    model: db.InterviewRound,
                    as: 'InterviewRound',
                    attributes: ['id', 'roundNumber', 'title', 'duration', 'description']
                },
                {
                    model: db.JobApplication,
                    as: 'JobApplication',
                    attributes: ['id'],
                    include: [
                        {
                            model: db.JobPosting,
                            attributes: ['id', 'Tieude'],
                            include: [
                                {
                                    model: db.Company,
                                    attributes: ['id', 'Tencongty']
                                }
                            ]
                        },
                        {
                            model: db.Record,
                            include: [
                                {
                                    model: db.User,
                                    attributes: ['id', 'Hoten', 'email', 'SDT']
                                }
                            ]
                        }
                    ]
                },
                {
                    model: db.User,
                    as: 'Candidate',
                    attributes: ['id', 'Hoten', 'email', 'SDT']
                }
            ]
        });

        // Send email notification
        try {
            // Dynamic import for ES6 module
            const emailServiceModule = await import('./emailService.js');
            const emailService = emailServiceModule.default;

            const candidateInfo = {
                id: fullMeeting.Candidate.id,
                email: fullMeeting.Candidate.email,
                Hoten: fullMeeting.Candidate.Hoten
            };
            const jobInfo = {
                id: fullMeeting.JobApplication.JobPosting.id,
                Tieude: fullMeeting.JobApplication.JobPosting.Tieude
            };
            const companyInfo = {
                Tencongty: fullMeeting.JobApplication.JobPosting.Company.Tencongty
            };
            const meetingInfo = {
                roomName: roomName,
                scheduledAt: scheduledAt,
                interviewRound: fullMeeting.InterviewRound ? {
                    roundNumber: fullMeeting.InterviewRound.roundNumber,
                    title: fullMeeting.InterviewRound.title,
                    duration: fullMeeting.InterviewRound.duration,
                    description: fullMeeting.InterviewRound.description
                } : null
            };
            
            // Generate meeting link (use environment variable or default)
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const meetingLink = `${baseUrl}/meeting/${roomName}`;

            if (emailService && emailService.sendMeetingInvitationEmail) {
                await emailService.sendMeetingInvitationEmail(
                    candidateInfo,
                    jobInfo,
                    companyInfo,
                    meetingInfo,
                    meetingLink
                );
                console.log('✅ Đã gửi email thông báo meeting đến:', candidateInfo.email);
            } else {
                console.warn('⚠️ EmailService không khả dụng, bỏ qua gửi email');
            }
        } catch (emailError) {
            // Log error but don't fail the meeting creation
            console.error('⚠️ Không thể gửi email thông báo meeting:', emailError);
        }

        return {
            EM: 'Tạo meeting thành công!',
            EC: 0,
            DT: meeting.toJSON()
        };
    } catch (error) {
        console.error('Error in createMeeting:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return {
                EM: 'Tên phòng đã tồn tại. Vui lòng thử lại!',
                EC: 7,
                DT: null
            };
        }
        return {
            EM: 'Có lỗi xảy ra khi tạo meeting!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Update meeting status
 */
const updateMeetingStatus = async (meetingId, userId, status, userRole = 'hr') => {
    try {
        if (!meetingId || !userId || !status) {
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            };
        }

        const whereClause = { id: meetingId };
        if (userRole === 'hr') {
            whereClause.hrUserId = userId;
        } else {
            whereClause.candidateUserId = userId;
        }

        const meeting = await db.Meeting.findOne({ where: whereClause });

        if (!meeting) {
            return {
                EM: 'Không tìm thấy meeting hoặc bạn không có quyền!',
                EC: 2,
                DT: null
            };
        }

        const updateData = { status };

        if (status === 'running' && !meeting.finishedAt) {
            // Meeting started
        } else if (status === 'done' && !meeting.finishedAt) {
            updateData.finishedAt = new Date();
        }

        await meeting.update(updateData);

        return {
            EM: 'Cập nhật trạng thái meeting thành công!',
            EC: 0,
            DT: meeting.toJSON()
        };
    } catch (error) {
        console.error('Error in updateMeetingStatus:', error);
        return {
            EM: 'Có lỗi xảy ra khi cập nhật trạng thái!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Update meeting (reschedule, add feedback, etc.)
 */
const updateMeeting = async (meetingId, userId, data) => {
    try {
        if (!meetingId || !userId) {
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            };
        }

        const meeting = await db.Meeting.findOne({
            where: {
                id: meetingId,
                hrUserId: userId
            }
        });

        if (!meeting) {
            return {
                EM: 'Không tìm thấy meeting hoặc bạn không có quyền!',
                EC: 2,
                DT: null
            };
        }

        const updateData = {};

        if (data.scheduledAt) {
            updateData.scheduledAt = new Date(data.scheduledAt);
            if (meeting.status === 'cancel' || meeting.status === 'done') {
                updateData.status = 'rescheduled';
            }
        }

        if (data.score !== undefined) {
            updateData.score = data.score;
        }

        if (data.feedback !== undefined) {
            updateData.feedback = data.feedback;
        }

        if (data.notes !== undefined) {
            updateData.notes = data.notes;
        }

        await meeting.update(updateData);

        return {
            EM: 'Cập nhật meeting thành công!',
            EC: 0,
            DT: meeting.toJSON()
        };
    } catch (error) {
        console.error('Error in updateMeeting:', error);
        return {
            EM: 'Có lỗi xảy ra khi cập nhật meeting!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Cancel meeting
 */
const cancelMeeting = async (meetingId, userId) => {
    try {
        if (!meetingId || !userId) {
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            };
        }

        const meeting = await db.Meeting.findOne({
            where: {
                id: meetingId,
                hrUserId: userId
            }
        });

        if (!meeting) {
            return {
                EM: 'Không tìm thấy meeting hoặc bạn không có quyền!',
                EC: 2,
                DT: null
            };
        }

        if (meeting.status === 'done') {
            return {
                EM: 'Không thể hủy meeting đã hoàn thành!',
                EC: 3,
                DT: null
            };
        }

        await meeting.update({
            status: 'cancel'
        });

        return {
            EM: 'Hủy meeting thành công!',
            EC: 0,
            DT: meeting.toJSON()
        };
    } catch (error) {
        console.error('Error in cancelMeeting:', error);
        return {
            EM: 'Có lỗi xảy ra khi hủy meeting!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get candidates (applications) for a specific job posting
 * @param {number} userId - HR user ID
 * @param {number} jobPostingId - Job posting ID
 * @param {number} interviewRoundId - (Optional) Interview round ID to filter out candidates who already have meeting for this round
 */
const getCandidatesByJobPosting = async (userId, jobPostingId, interviewRoundId = null) => {
    try {
        if (!userId || !jobPostingId) {
            return {
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            };
        }

        // Verify HR owns this job posting
        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            attributes: ['id']
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn không có quyền truy cập!',
                EC: 2,
                DT: null
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        const jobPosting = await db.JobPosting.findOne({
            where: {
                id: jobPostingId,
                recruiterId: recruiterIds
            }
        });

        if (!jobPosting) {
            return {
                EM: 'Không tìm thấy tin tuyển dụng hoặc bạn không có quyền truy cập!',
                EC: 3,
                DT: null
            };
        }

        // Get applications for this job posting with status = 7 (Chuẩn bị phỏng vấn)
        const applications = await db.JobApplication.findAll({
            where: {
                jobPostingId: jobPostingId,
                applicationStatusId: 7 // Chuẩn bị phỏng vấn
            },
            include: [
                {
                    model: db.Record,
                    include: [
                        {
                            model: db.User,
                            attributes: ['id', 'Hoten', 'email', 'SDT']
                        }
                    ]
                }
            ],
            order: [['Ngaynop', 'DESC']]
        });

        // If interviewRoundId is provided, filter out candidates who already have meeting for this round
        let candidateIdsToExclude = [];
        if (interviewRoundId) {
            const existingMeetings = await db.Meeting.findAll({
                where: {
                    interviewRoundId: interviewRoundId,
                    hrUserId: userId,
                    status: {
                        [Op.ne]: 'cancel' // Exclude cancelled meetings
                    }
                },
                attributes: ['candidateUserId']
            });
            candidateIdsToExclude = existingMeetings.map(m => m.candidateUserId);
        }

        // Filter applications to exclude candidates who already have meeting for this round
        const filteredApplications = applications.filter(app => {
            const candidateId = app.Record?.User?.id;
            return !candidateIdsToExclude.includes(candidateId);
        });

        return {
            EM: 'Lấy danh sách ứng viên thành công!',
            EC: 0,
            DT: filteredApplications.map(app => ({
                applicationId: app.id,
                candidateId: app.Record?.User?.id,
                candidateName: app.Record?.User?.Hoten,
                candidateEmail: app.Record?.User?.email,
                candidatePhone: app.Record?.User?.SDT,
                recordId: app.recordId
            }))
        };
    } catch (error) {
        console.error('Error in getCandidatesByJobPosting:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy danh sách ứng viên!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get latest meeting for a job posting to suggest next meeting time
 */
const getLatestMeetingByJobPosting = async (userId, jobPostingId) => {
    try {
        if (!userId || !jobPostingId) {
            return {
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            };
        }

        // Verify HR owns this job posting
        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            attributes: ['id']
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn không có quyền truy cập!',
                EC: 2,
                DT: null
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        const jobPosting = await db.JobPosting.findOne({
            where: {
                id: jobPostingId,
                recruiterId: recruiterIds
            }
        });

        if (!jobPosting) {
            return {
                EM: 'Không tìm thấy tin tuyển dụng!',
                EC: 3,
                DT: null
            };
        }

        // Get latest meeting for this job posting
        const latestMeeting = await db.Meeting.findOne({
            where: {
                hrUserId: userId
            },
            include: [
                {
                    model: db.JobApplication,
                    where: { jobPostingId: jobPostingId },
                    attributes: ['id']
                },
                {
                    model: db.InterviewRound,
                    attributes: ['id', 'duration']
                }
            ],
            order: [['scheduledAt', 'DESC']]
        });

        if (!latestMeeting) {
            return {
                EM: 'Chưa có meeting nào cho tin tuyển dụng này!',
                EC: 0,
                DT: null
            };
        }

        return {
            EM: 'Lấy meeting gần nhất thành công!',
            EC: 0,
            DT: {
                scheduledAt: latestMeeting.scheduledAt,
                duration: latestMeeting.InterviewRound?.duration || 0
            }
        };
    } catch (error) {
        console.error('Error in getLatestMeetingByJobPosting:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy meeting gần nhất!',
            EC: -1,
            DT: null
        };
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

