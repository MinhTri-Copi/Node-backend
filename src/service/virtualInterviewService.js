const db = require('../models');
const { Op } = db.Sequelize;

/**
 * Create a new virtual interview session
 */
const createInterview = async (userId, { level, language, topics }) => {
    try {
        if (!userId) {
            return {
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            };
        }

        // Validate input
        if (!level || !language || !topics || !Array.isArray(topics) || topics.length === 0) {
            return {
                EM: 'Vui lòng chọn level, ngôn ngữ và ít nhất một chủ đề!',
                EC: 2,
                DT: null
            };
        }

        // Validate level
        const validLevels = ['intern', 'junior', 'middle', 'senior'];
        if (!validLevels.includes(level)) {
            return {
                EM: 'Level không hợp lệ!',
                EC: 3,
                DT: null
            };
        }

        // Validate language
        const validLanguages = ['vi', 'en'];
        if (!validLanguages.includes(language)) {
            return {
                EM: 'Ngôn ngữ không hợp lệ!',
                EC: 4,
                DT: null
            };
        }

        // Create interview
        const interview = await db.VirtualInterview.create({
            userId,
            level,
            language,
            topics,
            status: 'draft'
        });

        return {
            EM: 'Tạo phiên phỏng vấn ảo thành công!',
            EC: 0,
            DT: interview
        };
    } catch (error) {
        console.error('Error in createInterview:', error);
        return {
            EM: 'Có lỗi xảy ra khi tạo phiên phỏng vấn ảo!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get interview by ID with ownership check
 */
const getInterview = async (interviewId, userId) => {
    try {
        const interview = await db.VirtualInterview.findOne({
            where: {
                id: interviewId,
                userId: userId
            },
            include: [
                {
                    model: db.VirtualInterviewQuestion,
                    as: 'Questions',
                    order: [['questionOrder', 'ASC']]
                },
                {
                    model: db.VirtualInterviewAnswer,
                    as: 'Answers',
                    include: [{
                        model: db.VirtualInterviewQuestion,
                        as: 'Question'
                    }]
                }
            ]
        });

        if (!interview) {
            return {
                EM: 'Không tìm thấy phiên phỏng vấn ảo!',
                EC: 1,
                DT: null
            };
        }

        return {
            EM: 'Lấy thông tin phiên phỏng vấn thành công!',
            EC: 0,
            DT: interview
        };
    } catch (error) {
        console.error('Error in getInterview:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy thông tin phiên phỏng vấn!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get a specific question
 */
const getQuestion = async (interviewId, questionId, userId) => {
    try {
        // Check ownership
        const interview = await db.VirtualInterview.findOne({
            where: {
                id: interviewId,
                userId: userId
            }
        });

        if (!interview) {
            return {
                EM: 'Không tìm thấy phiên phỏng vấn ảo!',
                EC: 1,
                DT: null
            };
        }

        const question = await db.VirtualInterviewQuestion.findOne({
            where: {
                id: questionId,
                virtualInterviewId: interviewId
            },
            include: [{
                model: db.VirtualInterviewAnswer,
                as: 'Answer'
            }]
        });

        if (!question) {
            return {
                EM: 'Không tìm thấy câu hỏi!',
                EC: 2,
                DT: null
            };
        }

        return {
            EM: 'Lấy câu hỏi thành công!',
            EC: 0,
            DT: {
                question,
                interview
            }
        };
    } catch (error) {
        console.error('Error in getQuestion:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy câu hỏi!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Save answer for a question
 */
const saveAnswer = async (interviewId, questionId, answerText, userId) => {
    try {
        // Check ownership
        const interview = await db.VirtualInterview.findOne({
            where: {
                id: interviewId,
                userId: userId
            }
        });

        if (!interview) {
            return {
                EM: 'Không tìm thấy phiên phỏng vấn ảo!',
                EC: 1,
                DT: null
            };
        }

        if (interview.status !== 'in_progress' && interview.status !== 'draft') {
            return {
                EM: 'Không thể chỉnh sửa câu trả lời khi đã hoàn thành!',
                EC: 2,
                DT: null
            };
        }

        // Check question exists
        const question = await db.VirtualInterviewQuestion.findOne({
            where: {
                id: questionId,
                virtualInterviewId: interviewId
            }
        });

        if (!question) {
            return {
                EM: 'Không tìm thấy câu hỏi!',
                EC: 3,
                DT: null
            };
        }

        // Find or create answer
        const [answer, created] = await db.VirtualInterviewAnswer.findOrCreate({
            where: {
                virtualInterviewId: interviewId,
                questionId: questionId
            },
            defaults: {
                answerText: answerText
            }
        });

        if (!created) {
            answer.answerText = answerText;
            await answer.save();
        }

        return {
            EM: 'Lưu câu trả lời thành công!',
            EC: 0,
            DT: answer
        };
    } catch (error) {
        console.error('Error in saveAnswer:', error);
        return {
            EM: 'Có lỗi xảy ra khi lưu câu trả lời!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Complete interview
 */
const completeInterview = async (interviewId, userId) => {
    try {
        const interview = await db.VirtualInterview.findOne({
            where: {
                id: interviewId,
                userId: userId
            }
        });

        if (!interview) {
            return {
                EM: 'Không tìm thấy phiên phỏng vấn ảo!',
                EC: 1,
                DT: null
            };
        }

        if (interview.status === 'completed') {
            return {
                EM: 'Phiên phỏng vấn đã hoàn thành!',
                EC: 2,
                DT: null
            };
        }

        // Update status
        interview.status = 'completed';
        interview.completedAt = new Date();
        await interview.save();

        return {
            EM: 'Hoàn thành phiên phỏng vấn thành công!',
            EC: 0,
            DT: interview
        };
    } catch (error) {
        console.error('Error in completeInterview:', error);
        return {
            EM: 'Có lỗi xảy ra khi hoàn thành phiên phỏng vấn!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get interview history
 */
const getHistory = async (userId, filters = {}, pagination = {}) => {
    try {
        const page = pagination.page || 1;
        const limit = pagination.limit || 10;
        const offset = (page - 1) * limit;

        const whereClause = {
            userId: userId
        };

        if (filters.status && filters.status !== 'all') {
            whereClause.status = filters.status;
        }

        const { count, rows } = await db.VirtualInterview.findAndCountAll({
            where: whereClause,
            order: [['createdAt', 'DESC']],
            limit: limit,
            offset: offset,
            include: [{
                model: db.VirtualInterviewTopicScore,
                as: 'TopicScores'
            }]
        });

        return {
            EM: 'Lấy lịch sử phỏng vấn ảo thành công!',
            EC: 0,
            DT: {
                interviews: rows,
                pagination: {
                    page: page,
                    limit: limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            }
        };
    } catch (error) {
        console.error('Error in getHistory:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy lịch sử phỏng vấn ảo!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Delete interview (only if draft or abandoned)
 */
const deleteInterview = async (interviewId, userId) => {
    try {
        const interview = await db.VirtualInterview.findOne({
            where: {
                id: interviewId,
                userId: userId
            }
        });

        if (!interview) {
            return {
                EM: 'Không tìm thấy phiên phỏng vấn ảo!',
                EC: 1,
                DT: null
            };
        }

        if (interview.status !== 'draft' && interview.status !== 'abandoned') {
            return {
                EM: 'Chỉ có thể xóa phiên phỏng vấn ở trạng thái draft hoặc abandoned!',
                EC: 2,
                DT: null
            };
        }

        await interview.destroy();

        return {
            EM: 'Xóa phiên phỏng vấn ảo thành công!',
            EC: 0,
            DT: null
        };
    } catch (error) {
        console.error('Error in deleteInterview:', error);
        return {
            EM: 'Có lỗi xảy ra khi xóa phiên phỏng vấn ảo!',
            EC: -1,
            DT: null
        };
    }
};

module.exports = {
    createInterview,
    getInterview,
    getQuestion,
    saveAnswer,
    completeInterview,
    getHistory,
    deleteInterview
};

