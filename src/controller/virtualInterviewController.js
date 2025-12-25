const virtualInterviewService = require('../service/virtualInterviewService');
const virtualInterviewQuestionGenerationService = require('../service/virtualInterviewQuestionGenerationService');
const virtualInterviewGradingService = require('../service/virtualInterviewGradingService');
const db = require('../models');

/**
 * Create a new virtual interview
 */
const createVirtualInterview = async (req, res) => {
    try {
        const userId = req.user.id;
        const { level, language, topics } = req.body;

        const result = await virtualInterviewService.createInterview(userId, {
            level,
            language,
            topics
        });

        return res.status(result.EC === 0 ? 200 : 400).json(result);
    } catch (error) {
        console.error('Error in createVirtualInterview:', error);
        return res.status(500).json({
            EM: 'Có lỗi xảy ra khi tạo phiên phỏng vấn ảo!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Generate questions for interview
 */
const generateQuestions = async (req, res) => {
    try {
        const userId = req.user.id;
        const interviewId = parseInt(req.params.id);
        const { questionCount } = req.body;

        // Check ownership
        const interview = await db.VirtualInterview.findOne({
            where: {
                id: interviewId,
                userId: userId
            }
        });

        if (!interview) {
            return res.status(404).json({
                EM: 'Không tìm thấy phiên phỏng vấn ảo!',
                EC: 1,
                DT: null
            });
        }

        const result = await virtualInterviewQuestionGenerationService.generateQuestionsForInterview(
            interviewId,
            questionCount
        );

        return res.status(result.EC === 0 ? 200 : 400).json(result);
    } catch (error) {
        console.error('Error in generateQuestions:', error);
        return res.status(500).json({
            EM: 'Có lỗi xảy ra khi sinh câu hỏi!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Get interview details
 */
const getVirtualInterview = async (req, res) => {
    try {
        const userId = req.user.id;
        const interviewId = parseInt(req.params.id);

        const result = await virtualInterviewService.getInterview(interviewId, userId);

        return res.status(result.EC === 0 ? 200 : 404).json(result);
    } catch (error) {
        console.error('Error in getVirtualInterview:', error);
        return res.status(500).json({
            EM: 'Có lỗi xảy ra khi lấy thông tin phiên phỏng vấn!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Get a specific question
 */
const getQuestion = async (req, res) => {
    try {
        const userId = req.user.id;
        const interviewId = parseInt(req.params.id);
        const questionId = parseInt(req.params.questionId);

        const result = await virtualInterviewService.getQuestion(interviewId, questionId, userId);

        return res.status(result.EC === 0 ? 200 : 404).json(result);
    } catch (error) {
        console.error('Error in getQuestion:', error);
        return res.status(500).json({
            EM: 'Có lỗi xảy ra khi lấy câu hỏi!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Save answer
 */
const saveAnswer = async (req, res) => {
    try {
        const userId = req.user.id;
        const interviewId = parseInt(req.params.id);
        const { questionId, answerText } = req.body;

        if (!questionId || !answerText) {
            return res.status(400).json({
                EM: 'Thiếu thông tin câu hỏi hoặc câu trả lời!',
                EC: 1,
                DT: null
            });
        }

        const result = await virtualInterviewService.saveAnswer(interviewId, questionId, answerText, userId);

        return res.status(result.EC === 0 ? 200 : 400).json(result);
    } catch (error) {
        console.error('Error in saveAnswer:', error);
        return res.status(500).json({
            EM: 'Có lỗi xảy ra khi lưu câu trả lời!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Complete interview
 */
const completeInterview = async (req, res) => {
    try {
        const userId = req.user.id;
        const interviewId = parseInt(req.params.id);

        const result = await virtualInterviewService.completeInterview(interviewId, userId);

        if (result.EC !== 0) {
            return res.status(400).json(result);
        }

        // Trigger async grading
        virtualInterviewGradingService.gradeInterview(interviewId).catch(error => {
            console.error('Error in async grading:', error);
        });

        return res.status(200).json({
            EM: 'Hoàn thành phiên phỏng vấn thành công! Đang chấm điểm...',
            EC: 0,
            DT: result.DT
        });
    } catch (error) {
        console.error('Error in completeInterview:', error);
        return res.status(500).json({
            EM: 'Có lỗi xảy ra khi hoàn thành phiên phỏng vấn!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Grade interview (manual trigger)
 */
const gradeInterview = async (req, res) => {
    try {
        const userId = req.user.id;
        const interviewId = parseInt(req.params.id);

        // Check ownership
        const interview = await db.VirtualInterview.findOne({
            where: {
                id: interviewId,
                userId: userId
            }
        });

        if (!interview) {
            return res.status(404).json({
                EM: 'Không tìm thấy phiên phỏng vấn ảo!',
                EC: 1,
                DT: null
            });
        }

        // Trigger async grading
        virtualInterviewGradingService.gradeInterview(interviewId).catch(error => {
            console.error('Error in async grading:', error);
        });

        return res.status(200).json({
            EM: 'Đang chấm điểm...',
            EC: 0,
            DT: { status: 'grading' }
        });
    } catch (error) {
        console.error('Error in gradeInterview:', error);
        return res.status(500).json({
            EM: 'Có lỗi xảy ra khi chấm điểm!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Get interview result
 */
const getResult = async (req, res) => {
    try {
        const userId = req.user.id;
        const interviewId = parseInt(req.params.id);

        const interview = await db.VirtualInterview.findByPk(interviewId, {
            where: {
                userId: userId
            },
            include: [
                {
                    model: db.VirtualInterviewTopicScore,
                    as: 'TopicScores'
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
            return res.status(404).json({
                EM: 'Không tìm thấy phiên phỏng vấn ảo!',
                EC: 1,
                DT: null
            });
        }

        const levelAssessment = virtualInterviewGradingService.compareWithLevelStandard(
            interview.totalScore || 0,
            interview.level
        );

        return res.status(200).json({
            EM: 'Lấy kết quả thành công!',
            EC: 0,
            DT: {
                interview: {
                    id: interview.id,
                    level: interview.level,
                    language: interview.language,
                    topics: interview.topics,
                    totalScore: interview.totalScore,
                    maxScore: interview.maxScore,
                    levelScore: interview.levelScore,
                    overallFeedback: interview.overallFeedback,
                    improvementSuggestions: interview.improvementSuggestions,
                    status: interview.status
                },
                topicScores: interview.TopicScores || [],
                levelAssessment: levelAssessment
            }
        });
    } catch (error) {
        console.error('Error in getResult:', error);
        return res.status(500).json({
            EM: 'Có lỗi xảy ra khi lấy kết quả!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Get interview history
 */
const getHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status || 'all';

        const filters = { status: status !== 'all' ? status : null };
        const pagination = { page, limit };

        const result = await virtualInterviewService.getHistory(userId, filters, pagination);

        return res.status(result.EC === 0 ? 200 : 400).json(result);
    } catch (error) {
        console.error('Error in getHistory:', error);
        return res.status(500).json({
            EM: 'Có lỗi xảy ra khi lấy lịch sử phỏng vấn ảo!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Delete interview
 */
const deleteVirtualInterview = async (req, res) => {
    try {
        const userId = req.user.id;
        const interviewId = parseInt(req.params.id);

        const result = await virtualInterviewService.deleteInterview(interviewId, userId);

        return res.status(result.EC === 0 ? 200 : 400).json(result);
    } catch (error) {
        console.error('Error in deleteVirtualInterview:', error);
        return res.status(500).json({
            EM: 'Có lỗi xảy ra khi xóa phiên phỏng vấn ảo!',
            EC: -1,
            DT: null
        });
    }
};

module.exports = {
    createVirtualInterview,
    generateQuestions,
    getVirtualInterview,
    getQuestion,
    saveAnswer,
    completeInterview,
    gradeInterview,
    getResult,
    getHistory,
    deleteVirtualInterview
};

