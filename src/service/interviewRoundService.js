const db = require('../models');
const { Op } = db.Sequelize;

/**
 * Get all interview rounds for HR's job postings
 */
const getInterviewRounds = async (userId, filters = {}) => {
    try {
        if (!userId) {
            return {
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            };
        }

        // Get recruiters for this user
        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            attributes: ['id']
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn chưa được gán vào bất kỳ công ty nào!',
                EC: 2,
                DT: null
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        // Get job postings for these recruiters
        const jobPostings = await db.JobPosting.findAll({
            where: { recruiterId: { [Op.in]: recruiterIds } },
            attributes: ['id']
        });

        const jobPostingIds = jobPostings.map(jp => jp.id);

        if (jobPostingIds.length === 0) {
            return {
                EM: 'Lấy danh sách vòng phỏng vấn thành công!',
                EC: 0,
                DT: {
                    rounds: [],
                    jobPostings: []
                }
            };
        }

        // Build where clause
        const whereClause = {
            jobPostingId: { [Op.in]: jobPostingIds }
        };

        if (filters.jobPostingId && filters.jobPostingId !== 'all') {
            whereClause.jobPostingId = parseInt(filters.jobPostingId);
        }

        if (filters.isActive !== undefined) {
            whereClause.isActive = filters.isActive;
        }

        // Get interview rounds
        const rounds = await db.InterviewRound.findAll({
            where: whereClause,
            include: [
                {
                    model: db.JobPosting,
                    as: 'JobPosting',
                    attributes: ['id', 'Tieude'],
                    include: [{
                        model: db.Company,
                        attributes: ['id', 'Tencongty']
                    }]
                },
                {
                    model: db.Meeting,
                    as: 'Meetings',
                    attributes: ['id'],
                    required: false
                }
            ],
            order: [['jobPostingId', 'ASC'], ['roundNumber', 'ASC']]
        });

        // Get job postings for filter
        const jobPostingsForFilter = await db.JobPosting.findAll({
            where: { recruiterId: { [db.Sequelize.Op.in]: recruiterIds } },
            attributes: ['id', 'Tieude'],
            include: [{
                model: db.Company,
                attributes: ['id', 'Tencongty']
            }],
            order: [['Tieude', 'ASC']]
        });

        return {
            EM: 'Lấy danh sách vòng phỏng vấn thành công!',
            EC: 0,
            DT: {
                rounds: rounds.map(round => ({
                    ...round.toJSON(),
                    meetingCount: round.Meetings ? round.Meetings.length : 0
                })),
                jobPostings: jobPostingsForFilter.map(jp => ({
                    id: jp.id,
                    title: jp.Tieude,
                    companyName: jp.Company?.Tencongty || 'N/A'
                }))
            }
        };
    } catch (error) {
        console.error('Error in getInterviewRounds:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy danh sách vòng phỏng vấn!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Create interview round
 */
const createInterviewRound = async (userId, data) => {
    try {
        if (!userId || !data.jobPostingId || !data.title || !data.duration || !data.roundNumber) {
            return {
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            };
        }

        // Get recruiters for this user
        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            attributes: ['id']
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn chưa được gán vào bất kỳ công ty nào!',
                EC: 2,
                DT: null
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        // Check job posting ownership
        const jobPosting = await db.JobPosting.findOne({
            where: {
                id: data.jobPostingId,
                recruiterId: { [Op.in]: recruiterIds }
            }
        });

        if (!jobPosting) {
            return {
                EM: 'Không tìm thấy tin tuyển dụng hoặc bạn không có quyền!',
                EC: 3,
                DT: null
            };
        }

        // Check if round number already exists for this job posting
        const existingRound = await db.InterviewRound.findOne({
            where: {
                jobPostingId: data.jobPostingId,
                roundNumber: data.roundNumber
            }
        });

        if (existingRound) {
            return {
                EM: `Vòng phỏng vấn số ${data.roundNumber} đã tồn tại cho tin tuyển dụng này!`,
                EC: 4,
                DT: null
            };
        }

        // Create interview round
        const newRound = await db.InterviewRound.create({
            jobPostingId: data.jobPostingId,
            roundNumber: data.roundNumber,
            title: data.title,
            duration: data.duration,
            description: data.description || null,
            isActive: data.isActive !== undefined ? data.isActive : true
        });

        return {
            EM: 'Tạo vòng phỏng vấn thành công!',
            EC: 0,
            DT: newRound
        };
    } catch (error) {
        console.error('Error in createInterviewRound:', error);
        return {
            EM: 'Có lỗi xảy ra khi tạo vòng phỏng vấn!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Update interview round
 */
const updateInterviewRound = async (userId, roundId, data) => {
    try {
        if (!userId || !roundId) {
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            };
        }

        // Get recruiters for this user
        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            attributes: ['id']
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn chưa được gán vào bất kỳ công ty nào!',
                EC: 2,
                DT: null
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        // Get interview round with job posting
        const round = await db.InterviewRound.findOne({
            where: { id: roundId },
            include: [{
                model: db.JobPosting,
                as: 'JobPosting',
                attributes: ['id', 'recruiterId']
            }]
        });

        if (!round) {
            return {
                EM: 'Không tìm thấy vòng phỏng vấn!',
                EC: 3,
                DT: null
            };
        }

        // Check ownership
        if (!recruiterIds.includes(round.JobPosting.recruiterId)) {
            return {
                EM: 'Bạn không có quyền cập nhật vòng phỏng vấn này!',
                EC: 4,
                DT: null
            };
        }

        // Check if round number is being changed and conflicts
        if (data.roundNumber && data.roundNumber !== round.roundNumber) {
            const existingRound = await db.InterviewRound.findOne({
                where: {
                    jobPostingId: round.jobPostingId,
                    roundNumber: data.roundNumber,
                    id: { [Op.ne]: roundId }
                }
            });

            if (existingRound) {
                return {
                    EM: `Vòng phỏng vấn số ${data.roundNumber} đã tồn tại cho tin tuyển dụng này!`,
                    EC: 5,
                    DT: null
                };
            }
        }

        // Update
        await round.update({
            roundNumber: data.roundNumber !== undefined ? data.roundNumber : round.roundNumber,
            title: data.title !== undefined ? data.title : round.title,
            duration: data.duration !== undefined ? data.duration : round.duration,
            description: data.description !== undefined ? data.description : round.description,
            isActive: data.isActive !== undefined ? data.isActive : round.isActive
        });

        return {
            EM: 'Cập nhật vòng phỏng vấn thành công!',
            EC: 0,
            DT: round
        };
    } catch (error) {
        console.error('Error in updateInterviewRound:', error);
        return {
            EM: 'Có lỗi xảy ra khi cập nhật vòng phỏng vấn!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Delete interview round
 */
const deleteInterviewRound = async (userId, roundId) => {
    try {
        if (!userId || !roundId) {
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            };
        }

        // Get recruiters for this user
        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            attributes: ['id']
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn chưa được gán vào bất kỳ công ty nào!',
                EC: 2,
                DT: null
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        // Get interview round with job posting
        const round = await db.InterviewRound.findOne({
            where: { id: roundId },
            include: [{
                model: db.JobPosting,
                as: 'JobPosting',
                attributes: ['id', 'recruiterId']
            }]
        });

        if (!round) {
            return {
                EM: 'Không tìm thấy vòng phỏng vấn!',
                EC: 3,
                DT: null
            };
        }

        // Check ownership
        if (!recruiterIds.includes(round.JobPosting.recruiterId)) {
            return {
                EM: 'Bạn không có quyền xóa vòng phỏng vấn này!',
                EC: 4,
                DT: null
            };
        }

        // Check if there are meetings for this round
        const meetingCount = await db.Meeting.count({
            where: { interviewRoundId: roundId }
        });

        if (meetingCount > 0) {
            return {
                EM: `Không thể xóa vòng phỏng vấn này vì đã có ${meetingCount} cuộc phỏng vấn được lên lịch!`,
                EC: 5,
                DT: null
            };
        }

        // Delete
        await round.destroy();

        return {
            EM: 'Xóa vòng phỏng vấn thành công!',
            EC: 0,
            DT: null
        };
    } catch (error) {
        console.error('Error in deleteInterviewRound:', error);
        return {
            EM: 'Có lỗi xảy ra khi xóa vòng phỏng vấn!',
            EC: -1,
            DT: null
        };
    }
};

module.exports = {
    getInterviewRounds,
    createInterviewRound,
    updateInterviewRound,
    deleteInterviewRound
};

