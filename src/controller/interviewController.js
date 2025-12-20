const db = require('../models');
const { Op } = db.Sequelize;
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production-12345';

/**
 * Verify interview token and return meeting information
 * Public endpoint - no auth required
 */
const verifyInterviewToken = async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({
                EM: 'Thiếu token!',
                EC: 1,
                DT: null
            });
        }

        // Verify JWT token
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    EM: 'Token đã hết hạn!',
                    EC: 2,
                    DT: null
                });
            } else {
                return res.status(401).json({
                    EM: 'Token không hợp lệ!',
                    EC: 3,
                    DT: null
                });
            }
        }

        // Check token type
        if (decoded.type !== 'interview_invitation' || !decoded.meetingId) {
            return res.status(400).json({
                EM: 'Token không đúng định dạng!',
                EC: 4,
                DT: null
            });
        }

        // Find meeting by token (verify token matches stored token)
        const meeting = await db.Meeting.findOne({
            where: {
                id: decoded.meetingId,
                interview_token: token
            },
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
            return res.status(404).json({
                EM: 'Không tìm thấy buổi phỏng vấn!',
                EC: 5,
                DT: null
            });
        }

        // Only allow for online meetings (with meetingUrl)
        if (!meeting.meetingUrl) {
            return res.status(400).json({
                EM: 'Buổi phỏng vấn này không phải là phỏng vấn trực tuyến!',
                EC: 6,
                DT: null
            });
        }

        // Validate required associations exist
        if (!meeting.JobApplication || !meeting.JobApplication.JobPosting) {
            return res.status(404).json({
                EM: 'Không tìm thấy thông tin đơn ứng tuyển!',
                EC: 7,
                DT: null
            });
        }

        // Return meeting information
        return res.status(200).json({
            EM: 'Xác thực token thành công!',
            EC: 0,
            DT: {
                meeting: {
                    id: meeting.id,
                    scheduledAt: meeting.scheduledAt,
                    meetingUrl: meeting.meetingUrl,
                    roomName: meeting.roomName,
                    invitation_status: meeting.invitation_status,
                    rejection_count: meeting.rejection_count,
                    interviewRound: meeting.InterviewRound,
                    jobPosting: meeting.JobApplication.JobPosting,
                    hr: meeting.HR,
                    candidate: meeting.Candidate
                }
            }
        });
    } catch (error) {
        console.error('Error in verifyInterviewToken:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Handle interview response (CONFIRM or REJECT)
 * Public endpoint - no auth required
 * Implements 3-strikes logic
 */
const handleInterviewResponse = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    let transactionCommitted = false;
    
    try {
        const { token, action, reason } = req.body;

        if (!token || !action) {
            await transaction.rollback();
            return res.status(400).json({
                EM: 'Thiếu thông tin bắt buộc (token, action)!',
                EC: 1,
                DT: null
            });
        }

        if (!['CONFIRM', 'REJECT'].includes(action)) {
            await transaction.rollback();
            return res.status(400).json({
                EM: 'Action không hợp lệ! Chỉ chấp nhận CONFIRM hoặc REJECT.',
                EC: 2,
                DT: null
            });
        }

        // Verify JWT token
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            await transaction.rollback();
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    EM: 'Token đã hết hạn!',
                    EC: 3,
                    DT: null
                });
            } else {
                return res.status(401).json({
                    EM: 'Token không hợp lệ!',
                    EC: 4,
                    DT: null
                });
            }
        }

        // Check token type
        if (decoded.type !== 'interview_invitation' || !decoded.meetingId) {
            await transaction.rollback();
            return res.status(400).json({
                EM: 'Token không đúng định dạng!',
                EC: 5,
                DT: null
            });
        }

        // Find meeting with related data
        const meeting = await db.Meeting.findOne({
            where: {
                id: decoded.meetingId,
                interview_token: token
            },
            include: [
                {
                    model: db.JobApplication,
                    as: 'JobApplication',
                    attributes: ['id', 'applicationStatusId'],
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
                    as: 'HR',
                    attributes: ['id', 'Hoten', 'email']
                },
                {
                    model: db.User,
                    as: 'Candidate',
                    attributes: ['id', 'Hoten', 'email']
                },
                {
                    model: db.InterviewRound,
                    as: 'InterviewRound',
                    attributes: ['id', 'roundNumber', 'title', 'duration', 'description']
                }
            ],
            transaction: transaction
        });

        if (!meeting) {
            await transaction.rollback();
            return res.status(404).json({
                EM: 'Không tìm thấy buổi phỏng vấn!',
                EC: 6,
                DT: null
            });
        }

        // Only allow for online meetings
        if (!meeting.meetingUrl) {
            await transaction.rollback();
            return res.status(400).json({
                EM: 'Buổi phỏng vấn này không phải là phỏng vấn trực tuyến!',
                EC: 7,
                DT: null
            });
        }

        // Validate required associations exist
        if (!meeting.JobApplication || !meeting.JobApplication.JobPosting || !meeting.HR || !meeting.Candidate) {
            await transaction.rollback();
            return res.status(404).json({
                EM: 'Không tìm thấy đầy đủ thông tin buổi phỏng vấn!',
                EC: 8,
                DT: null
            });
        }

        // Check if invitation has already been responded to
        // Only allow response when invitation_status is 'SENT'
        if (meeting.invitation_status !== 'SENT') {
            await transaction.rollback();
            let message = 'Bạn đã phản hồi lời mời này rồi!';
            if (meeting.invitation_status === 'CONFIRMED') {
                message = 'Bạn đã xác nhận tham gia phỏng vấn rồi!';
            } else if (meeting.invitation_status === 'RESCHEDULE_REQUESTED') {
                message = 'Bạn đã gửi yêu cầu đổi lịch. Vui lòng chờ HR phản hồi!';
            } else if (meeting.invitation_status === 'CANCELLED') {
                message = 'Lời mời này đã bị hủy!';
            } else if (meeting.invitation_status === 'COMPLETED') {
                message = 'Buổi phỏng vấn này đã hoàn thành!';
            }
            return res.status(400).json({
                EM: message,
                EC: 9,
                DT: {
                    invitation_status: meeting.invitation_status,
                    rejection_count: meeting.rejection_count
                }
            });
        }

        // Handle CONFIRM action
        if (action === 'CONFIRM') {
            await meeting.update({
                invitation_status: 'CONFIRMED'
            }, { transaction });

            // Send email with meeting link after confirmation
            try {
                const emailServiceModule = await import('../service/emailService.js');
                const emailService = emailServiceModule.default;

                if (meeting.Candidate && meeting.JobApplication?.JobPosting && meeting.meetingUrl) {
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
                    const meetingInfo = {
                        roomName: meeting.roomName,
                        scheduledAt: meeting.scheduledAt,
                        meetingUrl: meeting.meetingUrl,
                        interviewRound: meeting.InterviewRound ? {
                            roundNumber: meeting.InterviewRound.roundNumber,
                            title: meeting.InterviewRound.title,
                            duration: meeting.InterviewRound.duration,
                            description: meeting.InterviewRound.description
                        } : null
                    };

                    await emailService.sendMeetingLinkEmail(
                        candidateInfo,
                        jobInfo,
                        companyInfo,
                        meetingInfo
                    );
                    console.log('✅ Đã gửi email với link meet đến ứng viên:', candidateInfo.email);
                } else {
                    console.warn('⚠️ Thiếu thông tin để gửi email với link meet');
                }
            } catch (emailError) {
                console.error('⚠️ Không thể gửi email với link meet:', emailError);
                // Don't fail the transaction if email fails
            }

            await transaction.commit();
            transactionCommitted = true;
            return res.status(200).json({
                EM: 'Đã xác nhận tham gia phỏng vấn thành công! Link tham gia phỏng vấn đã được gửi đến email của bạn.',
                EC: 0,
                DT: {
                    meetingId: meeting.id,
                    invitation_status: 'CONFIRMED'
                }
            });
        }

        // Handle REJECT action (3-strikes logic)
        if (action === 'REJECT') {
            const currentRejectionCount = meeting.rejection_count || 0;
            
            // Check if already exceeded limit (>= 3 rejections)
            if (currentRejectionCount >= 3) {
                await transaction.rollback();
                return res.status(400).json({
                    EM: 'Bạn đã vượt quá số lần cho phép đổi lịch (3 lần). Đơn ứng tuyển đã bị hủy!',
                    EC: 10,
                    DT: {
                        invitation_status: meeting.invitation_status,
                        rejection_count: currentRejectionCount
                    }
                });
            }
            
            // Case 1: Not exceeded limit (Count < 3, meaning this is 1st, 2nd, or 3rd rejection)
            // Increment count when setting RESCHEDULE_REQUESTED
            const newRejectionCount = currentRejectionCount + 1;
            
            // Case 1a: Not exceeded limit yet (Count < 3 after increment)
            if (newRejectionCount < 3) {
                
                // Cancel meeting when candidate rejects
                await meeting.update({
                    invitation_status: 'CANCELLED',
                    status: 'cancel',
                    rejection_count: newRejectionCount,
                    candidate_reschedule_reason: reason || null
                }, { transaction });

                // Send email to HR about reschedule request
                try {
                    const emailServiceModule = await import('../service/emailService.js');
                    const emailService = emailServiceModule.default;

                    // Validate nested properties exist before accessing
                    if (meeting.HR && meeting.Candidate && meeting.JobApplication?.JobPosting) {
                        const hrInfo = {
                            email: meeting.HR.email,
                            Hoten: meeting.HR.Hoten || 'HR'
                        };
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
                        const meetingInfo = {
                            scheduledAt: meeting.scheduledAt,
                            interviewRound: meeting.InterviewRound ? {
                                roundNumber: meeting.InterviewRound.roundNumber,
                                title: meeting.InterviewRound.title
                            } : null
                        };

                        await emailService.sendRescheduleRequestEmail(
                            hrInfo,
                            candidateInfo,
                            jobInfo,
                            companyInfo,
                            meetingInfo,
                            reason || 'Không có lý do cụ thể'
                        );
                        console.log('✅ Đã gửi email yêu cầu đổi lịch đến HR:', hrInfo.email);
                    } else {
                        console.warn('⚠️ Thiếu thông tin để gửi email yêu cầu đổi lịch');
                    }
                } catch (emailError) {
                    console.error('⚠️ Không thể gửi email yêu cầu đổi lịch:', emailError);
                    // Don't fail the transaction if email fails
                }

                await transaction.commit();
                transactionCommitted = true;
                return res.status(200).json({
                    EM: `Đã từ chối tham gia phỏng vấn. Meeting đã bị hủy. Bạn có thể yêu cầu đổi lịch (Lần ${newRejectionCount}/3)`,
                    EC: 0,
                    DT: {
                        meetingId: meeting.id,
                        invitation_status: 'CANCELLED',
                        status: 'cancel',
                        rejection_count: newRejectionCount,
                        remaining_chances: 3 - newRejectionCount
                    }
                });
            } else {
                // Case 1b: This is the 3rd rejection (newRejectionCount === 3)
                // Set rejection_count to 3 and cancel the application
                
                // Find INTERVIEW_FAILED or Reject status
                let failedStatus = await db.ApplicationStatus.findOne({
                    where: {
                        TenTrangThai: {
                            [Op.in]: [
                                'Rớt phỏng vấn',
                                'Từ chối',
                                'Hủy',
                                'INTERVIEW_FAILED',
                                'Rejected'
                            ]
                        }
                    },
                    transaction
                });

                // If not found, try to find by common status IDs (usually status 3 or 4 is reject)
                if (!failedStatus) {
                    // Try common reject status IDs sequentially
                    failedStatus = await db.ApplicationStatus.findByPk(3, { transaction });
                    if (!failedStatus) {
                        failedStatus = await db.ApplicationStatus.findByPk(4, { transaction });
                    }
                }

                // Update meeting
                await meeting.update({
                    invitation_status: 'CANCELLED',
                    rejection_count: newRejectionCount, // This will be 3
                    candidate_reschedule_reason: reason || null
                }, { transaction });

                // Update JobApplication status if failed status found
                if (failedStatus) {
                    await meeting.JobApplication.update({
                        applicationStatusId: failedStatus.id
                    }, { transaction });
                }

                // Send termination email to candidate
                try {
                    const emailServiceModule = await import('../service/emailService.js');
                    const emailService = emailServiceModule.default;

                    // Validate nested properties exist before accessing
                    if (meeting.Candidate && meeting.JobApplication?.JobPosting) {
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

                        await emailService.sendTerminationEmail(
                            candidateInfo,
                            jobInfo,
                            companyInfo
                        );
                        console.log('✅ Đã gửi email hủy quy trình đến ứng viên:', candidateInfo.email);
                    } else {
                        console.warn('⚠️ Thiếu thông tin để gửi email hủy quy trình');
                    }
                } catch (emailError) {
                    console.error('⚠️ Không thể gửi email hủy quy trình:', emailError);
                    // Don't fail the transaction if email fails
                }

                await transaction.commit();
                transactionCommitted = true;
                return res.status(200).json({
                    EM: 'Đã vượt quá số lần cho phép đổi lịch. Quy trình phỏng vấn đã bị hủy.',
                    EC: 0,
                    DT: {
                        meetingId: meeting.id,
                        invitation_status: 'CANCELLED',
                        rejection_count: newRejectionCount, // This will be 3
                        application_status_updated: !!failedStatus
                    }
                });
            }
        }
    } catch (error) {
        // Only rollback if transaction hasn't been committed
        if (!transactionCommitted) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Error rolling back transaction:', rollbackError);
            }
        }
        console.error('Error in handleInterviewResponse:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

module.exports = {
    verifyInterviewToken,
    handleInterviewResponse
};
