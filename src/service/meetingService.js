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

        // Parse userId to integer if it's a string
        const parsedUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
        if (isNaN(parsedUserId)) {
            return {
                EM: 'userId không hợp lệ!',
                EC: 2,
                DT: null
            };
        }

        // Build where clause - always include hrUserId
        const whereClause = {
            hrUserId: parsedUserId
        };

        // Handle status filter with combined logic (status + invitation_status)
        if (filters.status && filters.status !== 'all') {
            const statusFilter = filters.status;
            
            switch (statusFilter) {
                case 'WAITING_RESPONSE':
                    // status IN ['pending', 'rescheduled'] AND invitation_status = 'SENT'
                    whereClause.status = { [Op.in]: ['pending', 'rescheduled'] };
                    whereClause.invitation_status = 'SENT';
                    break;
                
                case 'CONFIRMED':
                    // status IN ['pending', 'rescheduled'] AND invitation_status = 'CONFIRMED'
                    whereClause.status = { [Op.in]: ['pending', 'rescheduled'] };
                    whereClause.invitation_status = 'CONFIRMED';
                    break;
                
                case 'RESCHEDULE':
                    // invitation_status = 'RESCHEDULE_REQUESTED' (ignore status)
                    whereClause.invitation_status = 'RESCHEDULE_REQUESTED';
                    break;
                
                case 'COMPLETED':
                    // status = 'done' OR invitation_status = 'COMPLETED'
                    // Store original whereClause conditions
                    const completedConditions = [
                        { hrUserId: parsedUserId },
                        {
                            [Op.or]: [
                                { status: 'done' },
                                { invitation_status: 'COMPLETED' }
                            ]
                        }
                    ];
                    // Add jobApplicationId if exists
                    if (filters.jobApplicationId) {
                        completedConditions.push({ jobApplicationId: filters.jobApplicationId });
                    }
                    whereClause[Op.and] = completedConditions;
                    break;
                
                case 'CANCELLED':
                    // status = 'cancel' OR invitation_status = 'CANCELLED'
                    // Store original whereClause conditions
                    const cancelledConditions = [
                        { hrUserId: parsedUserId },
                        {
                            [Op.or]: [
                                { status: 'cancel' },
                                { invitation_status: 'CANCELLED' }
                            ]
                        }
                    ];
                    // Add jobApplicationId if exists
                    if (filters.jobApplicationId) {
                        cancelledConditions.push({ jobApplicationId: filters.jobApplicationId });
                    }
                    whereClause[Op.and] = cancelledConditions;
                    break;
                
                default:
                    // For other status values (e.g., 'running', 'pending', etc.), filter by status only
                    whereClause.status = statusFilter;
                    break;
            }
        }

        // Add jobApplicationId filter (only if not already included in Op.and)
        if (filters.jobApplicationId && !whereClause[Op.and]) {
            whereClause.jobApplicationId = filters.jobApplicationId;
        }

        // Build include clause with job posting filter
        const jobApplicationInclude = {
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
        };

        // Add where clause and required flag if filtering by job posting
        if (filters.jobPostingId) {
            jobApplicationInclude.where = { jobPostingId: filters.jobPostingId };
            jobApplicationInclude.required = true; // INNER JOIN when filtering
        }

        const includeClause = [
            {
                model: db.InterviewRound,
                as: 'InterviewRound',
                attributes: ['id', 'roundNumber', 'title', 'duration']
            },
            jobApplicationInclude,
            {
                model: db.User,
                as: 'Candidate',
                attributes: ['id', 'Hoten', 'email', 'SDT']
            }
        ];

        // Get meetings
        const meetings = await db.Meeting.findAll({
            where: whereClause,
            include: includeClause,
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

        // Generate interview token and send email notification
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
                meetingId: meeting.id,
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
                // Generate token and send email
                const emailResult = await emailService.sendMeetingInvitationEmail(
                    candidateInfo,
                    jobInfo,
                    companyInfo,
                    meetingInfo,
                    meetingLink
                );
                
                // Save the generated token to the meeting
                if (emailResult && emailResult.token) {
                    await meeting.update({
                        interview_token: emailResult.token,
                        invitation_status: 'SENT'
                    });
                    console.log('✅ Đã lưu interview_token cho meeting:', meeting.id);
                }
                
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
    const transaction = await db.sequelize.transaction();
    let transactionCommitted = false;
    
    try {
        if (!meetingId || !userId) {
            await transaction.rollback();
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
            },
            include: [
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
                    as: 'Candidate',
                    attributes: ['id', 'Hoten', 'email']
                },
                {
                    model: db.InterviewRound,
                    as: 'InterviewRound',
                    attributes: ['id', 'roundNumber', 'title', 'duration', 'description', 'jobPostingId']
                }
            ],
            transaction
        });

        if (!meeting) {
            await transaction.rollback();
            return {
                EM: 'Không tìm thấy meeting hoặc bạn không có quyền!',
                EC: 2,
                DT: null
            };
        }

        // Check if evaluation is locked (already evaluated or approved)
        // If trying to update score/feedback/notes and evaluation is locked, reject
        if (meeting.evaluation_locked && (data.score !== undefined || data.feedback !== undefined || data.notes !== undefined)) {
            await transaction.rollback();
            return {
                EM: 'Đánh giá đã bị khóa! Không thể chỉnh sửa đánh giá sau khi đã đánh giá hoặc đã duyệt ứng viên.',
                EC: 3,
                DT: null
            };
        }

        // Check if already evaluated (has score and feedback) and trying to update evaluation
        if (meeting.score !== null && meeting.feedback !== null && 
            (data.score !== undefined || data.feedback !== undefined || data.notes !== undefined) &&
            !data.approveCandidate) {
            // If already evaluated but not locked, set lock when updating
            // This prevents re-evaluation
        }

        const updateData = {};

        if (data.scheduledAt) {
            updateData.scheduledAt = new Date(data.scheduledAt);
            if (meeting.status === 'cancel' || meeting.status === 'done') {
                updateData.status = 'rescheduled';
            }
        }

        // If updating evaluation fields (score, feedback, notes), set evaluation_locked
        if (data.score !== undefined || data.feedback !== undefined || data.notes !== undefined) {
            if (data.score !== undefined) {
                updateData.score = data.score;
            }
            if (data.feedback !== undefined) {
                updateData.feedback = data.feedback;
            }
            if (data.notes !== undefined) {
                updateData.notes = data.notes;
            }
            // Lock evaluation when first evaluation is done (has both score and feedback)
            if (!meeting.evaluation_locked && 
                data.score !== undefined && 
                data.feedback !== undefined && 
                data.feedback.trim() !== '') {
                updateData.evaluation_locked = true;
            }
        }

        // If approveCandidate is true, always lock evaluation
        if (data.approveCandidate === true) {
            updateData.evaluation_locked = true;
        }

        await meeting.update(updateData, { transaction });

        // If approveCandidate is true, send email
        if (data.approveCandidate === true) {

            // Send email to candidate about passing the interview round
            try {
                const emailServiceModule = await import('./emailService.js');
                const emailService = emailServiceModule.default;

                if (meeting.Candidate && meeting.JobApplication?.JobPosting && meeting.InterviewRound) {
                    const candidateInfo = {
                        email: meeting.Candidate.email,
                        Hoten: meeting.Candidate.Hoten || 'Ứng viên'
                    };
                    const jobInfo = {
                        Tieude: meeting.JobApplication.JobPosting.Tieude || 'Vị trí tuyển dụng'
                    };
                    const companyInfo = {
                        Tencongty: meeting.JobApplication.JobPosting.Company?.Tencongty || 'Công ty'
                    };
                    const currentRoundInfo = {
                        roundNumber: meeting.InterviewRound.roundNumber,
                        title: meeting.InterviewRound.title
                    };

                    // Find next interview round
                    const nextInterviewRound = await db.InterviewRound.findOne({
                        where: {
                            jobPostingId: meeting.InterviewRound.jobPostingId,
                            roundNumber: meeting.InterviewRound.roundNumber + 1,
                            isActive: true
                        },
                        transaction
                    });

                    if (nextInterviewRound) {
                        const nextRoundInfo = {
                            roundNumber: nextInterviewRound.roundNumber,
                            title: nextInterviewRound.title,
                            duration: nextInterviewRound.duration,
                            description: nextInterviewRound.description
                        };
                        
                        await emailService.sendInterviewPassEmail(
                            candidateInfo,
                            jobInfo,
                            companyInfo,
                            currentRoundInfo,
                            nextRoundInfo
                        );
                        console.log(`✅ Đã gửi email thông báo đã đậu vòng ${currentRoundInfo.roundNumber}, chuẩn bị vòng ${nextRoundInfo.roundNumber} đến:`, candidateInfo.email);
                    } else {
                        // No next round - candidate passed all rounds
                        // You might want to send a different email here
                        console.log(`ℹ️ Ứng viên đã vượt qua tất cả các vòng phỏng vấn. Không có vòng tiếp theo.`);
                    }
                } else {
                    console.warn('⚠️ Thiếu thông tin để gửi email thông báo đậu phỏng vấn');
                }
            } catch (emailError) {
                console.error('⚠️ Không thể gửi email thông báo đậu phỏng vấn:', emailError);
                // Don't fail the transaction if email fails
            }
        }

        await transaction.commit();
        transactionCommitted = true;

        // Reload meeting to get latest data (after commit, no transaction needed)
        await meeting.reload();

        return {
            EM: 'Cập nhật meeting thành công!',
            EC: 0,
            DT: meeting.toJSON()
        };
    } catch (error) {
        if (!transactionCommitted) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Error rolling back transaction:', rollbackError);
            }
        }
        console.error('Error in updateMeeting:', error);
        return {
            EM: 'Có lỗi xảy ra khi cập nhật meeting!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Update invitation status (for HR to handle candidate responses)
 * Actions: 'APPROVE_RESCHEDULE', 'REJECT_RESCHEDULE', 'RESCHEDULE'
 */
const updateInvitationStatus = async (meetingId, userId, action, data = {}) => {
    try {
        if (!meetingId || !userId || !action) {
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
            },
            include: [
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
                                    attributes: ['id', 'Hoten', 'email']
                                }
                            ]
                        }
                    ]
                },
                {
                    model: db.User,
                    as: 'Candidate',
                    attributes: ['id', 'Hoten', 'email']
                },
                {
                    model: db.InterviewRound,
                    as: 'InterviewRound',
                    attributes: ['id', 'roundNumber', 'title', 'duration']
                }
            ]
        });

        if (!meeting) {
            return {
                EM: 'Không tìm thấy meeting hoặc bạn không có quyền!',
                EC: 2,
                DT: null
            };
        }

        const updateData = {};

        // Handle different actions
        switch (action) {
            case 'APPROVE_RESCHEDULE':
                // HR approves reschedule request - update time and reset status
                if (!data.scheduledAt) {
                    return {
                        EM: 'Vui lòng cung cấp thời gian mới cho buổi phỏng vấn!',
                        EC: 3,
                        DT: null
                    };
                }
                if (meeting.invitation_status !== 'RESCHEDULE_REQUESTED') {
                    return {
                        EM: 'Meeting này không có yêu cầu đổi lịch!',
                        EC: 4,
                        DT: null
                    };
                }
                updateData.scheduledAt = new Date(data.scheduledAt);
                updateData.invitation_status = 'SENT';
                // Keep rejection_count unchanged - don't reset it
                // This ensures we track total rejections across all reschedules
                updateData.candidate_reschedule_reason = null;
                updateData.status = meeting.status === 'cancel' ? 'rescheduled' : meeting.status;
                
                // Send email notification to candidate about new schedule
                try {
                    const emailServiceModule = await import('./emailService.js');
                    const emailService = emailServiceModule.default;

                    if (meeting.Candidate && meeting.JobApplication?.JobPosting) {
                        const candidateInfo = {
                            id: meeting.Candidate.id,
                            email: meeting.Candidate.email,
                            Hoten: meeting.Candidate.Hoten || 'Ứng viên'
                        };
                        const jobInfo = {
                            id: meeting.JobApplication.JobPosting.id,
                            Tieude: meeting.JobApplication.JobPosting.Tieude
                        };
                        const companyInfo = {
                            Tencongty: meeting.JobApplication.JobPosting.Company?.Tencongty || 'Công ty'
                        };
                        const meetingInfo = {
                            roomName: meeting.roomName,
                            scheduledAt: data.scheduledAt,
                            meetingId: meeting.id,
                            interviewRound: meeting.InterviewRound ? {
                                roundNumber: meeting.InterviewRound.roundNumber,
                                title: meeting.InterviewRound.title,
                                duration: meeting.InterviewRound.duration
                            } : null
                        };
                        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
                        const meetingLink = `${baseUrl}/meeting/${meeting.roomName}`;

                        // Generate new token for rescheduled meeting
                        if (emailService && emailService.sendMeetingInvitationEmail) {
                            const emailResult = await emailService.sendMeetingInvitationEmail(
                                candidateInfo,
                                jobInfo,
                                companyInfo,
                                meetingInfo,
                                meetingLink
                            );
                            
                            if (emailResult && emailResult.token) {
                                updateData.interview_token = emailResult.token;
                            }
                        }
                    }
                } catch (emailError) {
                    console.error('⚠️ Không thể gửi email thông báo đổi lịch:', emailError);
                    // Don't fail the update if email fails
                }
                break;

            case 'REJECT_RESCHEDULE':
                // HR rejects reschedule request - cancel the meeting
                if (meeting.invitation_status !== 'RESCHEDULE_REQUESTED') {
                    return {
                        EM: 'Meeting này không có yêu cầu đổi lịch!',
                        EC: 4,
                        DT: null
                    };
                }
                updateData.invitation_status = 'CANCELLED';
                updateData.status = 'cancel';
                
                // Optionally update job application status
                if (data.updateApplicationStatus) {
                    // Find reject status
                    const failedStatus = await db.ApplicationStatus.findOne({
                        where: {
                            TenTrangThai: {
                                [Op.in]: ['Rớt phỏng vấn', 'Từ chối', 'Hủy', 'INTERVIEW_FAILED', 'Rejected']
                            }
                        }
                    });
                    if (failedStatus && meeting.JobApplication) {
                        await meeting.JobApplication.update({
                            applicationStatusId: failedStatus.id
                        });
                    }
                }
                break;

            case 'RESCHEDULE':
                // HR manually reschedules (not in response to candidate request)
                if (!data.scheduledAt) {
                    return {
                        EM: 'Vui lòng cung cấp thời gian mới cho buổi phỏng vấn!',
                        EC: 3,
                        DT: null
                    };
                }
                updateData.scheduledAt = new Date(data.scheduledAt);
                updateData.invitation_status = 'SENT';
                updateData.status = meeting.status === 'cancel' ? 'rescheduled' : meeting.status;
                
                // Send email notification
                try {
                    const emailServiceModule = await import('./emailService.js');
                    const emailService = emailServiceModule.default;

                    if (meeting.Candidate && meeting.JobApplication?.JobPosting) {
                        const candidateInfo = {
                            id: meeting.Candidate.id,
                            email: meeting.Candidate.email,
                            Hoten: meeting.Candidate.Hoten || 'Ứng viên'
                        };
                        const jobInfo = {
                            id: meeting.JobApplication.JobPosting.id,
                            Tieude: meeting.JobApplication.JobPosting.Tieude
                        };
                        const companyInfo = {
                            Tencongty: meeting.JobApplication.JobPosting.Company?.Tencongty || 'Công ty'
                        };
                        const meetingInfo = {
                            roomName: meeting.roomName,
                            scheduledAt: data.scheduledAt,
                            meetingId: meeting.id,
                            interviewRound: meeting.InterviewRound ? {
                                roundNumber: meeting.InterviewRound.roundNumber,
                                title: meeting.InterviewRound.title,
                                duration: meeting.InterviewRound.duration
                            } : null
                        };
                        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
                        const meetingLink = `${baseUrl}/meeting/${meeting.roomName}`;

                        if (emailService && emailService.sendMeetingInvitationEmail) {
                            const emailResult = await emailService.sendMeetingInvitationEmail(
                                candidateInfo,
                                jobInfo,
                                companyInfo,
                                meetingInfo,
                                meetingLink
                            );
                            
                            if (emailResult && emailResult.token) {
                                updateData.interview_token = emailResult.token;
                            }
                        }
                    }
                } catch (emailError) {
                    console.error('⚠️ Không thể gửi email thông báo đổi lịch:', emailError);
                }
                break;

            default:
                return {
                    EM: 'Action không hợp lệ!',
                    EC: 5,
                    DT: null
                };
        }

        await meeting.update(updateData);

        // Get updated meeting with all relations
        const updatedMeeting = await db.Meeting.findOne({
            where: { id: meetingId },
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

        return {
            EM: 'Cập nhật trạng thái lời mời thành công!',
            EC: 0,
            DT: updatedMeeting.toJSON()
        };
    } catch (error) {
        console.error('Error in updateInvitationStatus:', error);
        return {
            EM: 'Có lỗi xảy ra khi cập nhật trạng thái lời mời!',
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

/**
 * Start recording for a meeting (chỉ HR mới được phép)
 */
const startRecording = async (userId, meetingId) => {
    try {
        if (!userId || !meetingId) {
            return {
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            };
        }

        // Get meeting and verify HR owns it
        const meeting = await db.Meeting.findOne({
            where: { id: meetingId },
            include: [{
                model: db.JobPosting,
                as: 'JobPosting',
                attributes: ['id', 'recruiterId'],
                include: [{
                    model: db.Recruiter,
                    attributes: ['id', 'userId']
                }]
            }]
        });

        if (!meeting) {
            return {
                EM: 'Không tìm thấy meeting!',
                EC: 2,
                DT: null
            };
        }

        // Verify HR owns this meeting
        if (meeting.hrUserId !== userId && meeting.JobPosting?.Recruiter?.userId !== userId) {
            return {
                EM: 'Bạn không có quyền bắt đầu recording cho meeting này!',
                EC: 3,
                DT: null
            };
        }

        // Check if meeting is running
        if (meeting.status !== 'running') {
            return {
                EM: 'Chỉ có thể bắt đầu recording khi meeting đang diễn ra!',
                EC: 4,
                DT: null
            };
        }

        // Update recording status
        await meeting.update({
            recordingStatus: 'recording',
            recordingStartedAt: new Date()
        });

        return {
            EM: 'Bắt đầu recording thành công!',
            EC: 0,
            DT: {
                meetingId: meeting.id,
                recordingStatus: 'recording',
                recordingStartedAt: meeting.recordingStartedAt
            }
        };
    } catch (error) {
        console.error('Error in startRecording:', error);
        return {
            EM: 'Có lỗi xảy ra khi bắt đầu recording!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Stop recording and save recording URL
 */
const stopRecording = async (userId, meetingId, recordingUrl = null) => {
    try {
        if (!userId || !meetingId) {
            return {
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            };
        }

        // Get meeting and verify HR owns it
        const meeting = await db.Meeting.findOne({
            where: { id: meetingId },
            include: [{
                model: db.JobPosting,
                as: 'JobPosting',
                attributes: ['id', 'recruiterId'],
                include: [{
                    model: db.Recruiter,
                    attributes: ['id', 'userId']
                }]
            }]
        });

        if (!meeting) {
            return {
                EM: 'Không tìm thấy meeting!',
                EC: 2,
                DT: null
            };
        }

        // Verify HR owns this meeting
        if (meeting.hrUserId !== userId && meeting.JobPosting?.Recruiter?.userId !== userId) {
            return {
                EM: 'Bạn không có quyền dừng recording cho meeting này!',
                EC: 3,
                DT: null
            };
        }

        // Update recording status
        const updateData = {
            recordingStatus: recordingUrl ? 'ready' : 'processing',
            recordingFinishedAt: new Date()
        };

        if (recordingUrl) {
            updateData.recordingUrl = recordingUrl;
        }

        await meeting.update(updateData);

        return {
            EM: 'Dừng recording thành công!',
            EC: 0,
            DT: {
                meetingId: meeting.id,
                recordingStatus: updateData.recordingStatus,
                recordingUrl: recordingUrl || meeting.recordingUrl,
                recordingFinishedAt: meeting.recordingFinishedAt
            }
        };
    } catch (error) {
        console.error('Error in stopRecording:', error);
        return {
            EM: 'Có lỗi xảy ra khi dừng recording!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Update recording URL (được gọi từ Jitsi webhook hoặc frontend sau khi recording ready)
 */
const updateRecordingUrl = async (meetingId, recordingUrl) => {
    const startTime = Date.now();
    try {
        console.log('💾 ========== UPDATE RECORDING URL ==========');
        console.log('   - Meeting ID:', meetingId);
        console.log('   - Recording URL:', recordingUrl);
        
        if (!meetingId || !recordingUrl) {
            console.error('❌ Missing required info');
            console.error('   - Meeting ID:', meetingId);
            console.error('   - Recording URL:', recordingUrl);
            return {
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            };
        }

        console.log('   - Finding meeting...');
        const meeting = await db.Meeting.findByPk(meetingId);

        if (!meeting) {
            console.error('❌ Meeting not found:', meetingId);
            return {
                EM: 'Không tìm thấy meeting!',
                EC: 2,
                DT: null
            };
        }

        console.log('   - Meeting found:', meeting.id);
        console.log('   - Current recordingUrl:', meeting.recordingUrl);
        console.log('   - Current recordingStatus:', meeting.recordingStatus);
        console.log('   - Updating meeting...');

        await meeting.update({
            recordingUrl: recordingUrl,
            recordingStatus: 'ready',
            recordingFinishedAt: new Date()
        });

        console.log('   - Meeting updated successfully');
        console.log('   - New recordingUrl:', meeting.recordingUrl);
        console.log('   - New recordingStatus:', meeting.recordingStatus);

        const totalTime = Date.now() - startTime;
        console.log('✅ ========== UPDATE RECORDING URL SUCCESS ==========');
        console.log('   - Total time:', totalTime, 'ms');

        return {
            EM: 'Cập nhật recording URL thành công!',
            EC: 0,
            DT: {
                meetingId: meeting.id,
                recordingUrl: recordingUrl,
                recordingStatus: 'ready'
            }
        };
    } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error('❌ ========== UPDATE RECORDING URL ERROR ==========');
        console.error('   - Error:', error);
        console.error('   - Error message:', error.message);
        console.error('   - Error stack:', error.stack);
        console.error('   - Total time before error:', totalTime, 'ms');
        return {
            EM: 'Có lỗi xảy ra khi cập nhật recording URL!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get recording info for a meeting
 */
const getRecording = async (userId, meetingId) => {
    try {
        if (!userId || !meetingId) {
            return {
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            };
        }

        const meeting = await db.Meeting.findOne({
            where: { id: meetingId },
            attributes: ['id', 'recordingUrl', 'recordingStatus', 'recordingStartedAt', 'recordingFinishedAt', 'hrUserId'],
            include: [{
                model: db.JobPosting,
                as: 'JobPosting',
                attributes: ['id', 'recruiterId'],
                include: [{
                    model: db.Recruiter,
                    attributes: ['id', 'userId']
                }]
            }]
        });

        if (!meeting) {
            return {
                EM: 'Không tìm thấy meeting!',
                EC: 2,
                DT: null
            };
        }

        // Verify HR owns this meeting
        if (meeting.hrUserId !== userId && meeting.JobPosting?.Recruiter?.userId !== userId) {
            return {
                EM: 'Bạn không có quyền xem recording của meeting này!',
                EC: 3,
                DT: null
            };
        }

        return {
            EM: 'Lấy thông tin recording thành công!',
            EC: 0,
            DT: {
                meetingId: meeting.id,
                recordingUrl: meeting.recordingUrl,
                recordingStatus: meeting.recordingStatus,
                recordingStartedAt: meeting.recordingStartedAt,
                recordingFinishedAt: meeting.recordingFinishedAt,
                hasRecording: !!meeting.recordingUrl && meeting.recordingStatus === 'ready'
            }
        };
    } catch (error) {
        console.error('Error in getRecording:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy thông tin recording!',
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
    updateInvitationStatus,
    cancelMeeting,
    getCandidatesByJobPosting,
    getLatestMeetingByJobPosting,
    startRecording,
    stopRecording,
    updateRecordingUrl,
    getRecording
};

