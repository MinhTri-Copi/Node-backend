const db = require('../models');
const { gradeAnswersBatch } = require('./aiGradingService');
require('dotenv').config();

// Polyfill fetch for Node < 18
if (typeof fetch === 'undefined' || typeof FormData === 'undefined') {
    try {
        const { fetch: whatwgFetch, FormData: WhatwgFormData, Headers: WhatwgHeaders } = require('@whatwg-node/fetch');
        global.fetch = whatwgFetch;
        global.FormData = WhatwgFormData;
        global.Headers = WhatwgHeaders;
    } catch (err) {
        try {
            const nodeFetch = require('node-fetch');
            global.fetch = nodeFetch;
            global.Headers = nodeFetch.Headers;
        } catch (error) {
            console.error('Failed to load fetch polyfill');
        }
    }
}

// Google Gemini configuration (FREE TIER)
const { GoogleGenerativeAI } = require('@google/generative-ai');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

if (!GEMINI_API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY not set. Virtual interview grading will not work.');
    console.warn('   Get free API key at: https://aistudio.google.com/app/apikey');
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

/**
 * Parse JSON from LLM response
 */
const parseJSONFromResponse = (responseText) => {
    if (!responseText) return null;
    let cleaned = responseText.trim();
    cleaned = cleaned.replace(/```json\n?/gi, '');
    cleaned = cleaned.replace(/```\n?/g, '');
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
            return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
        } catch (e) {
            try {
                return JSON.parse(cleaned);
            } catch (e2) {
                return null;
            }
        }
    }
    return null;
};

/**
 * Build grading prompt based on language
 */
const buildGradingPrompt = (level, topic, language, questionText, candidateAnswer) => {
    const prompts = {
        'vi': {
            'intern': `Hãy chấm điểm câu trả lời này cho ứng viên trình độ INTERN về chủ đề ${topic}.\n\nCâu hỏi: ${questionText}\n\nCâu trả lời: ${candidateAnswer}\n\nChấm điểm từ 0-10 dựa trên: kiến thức cơ bản, độ chính xác, đầy đủ. Trả lời BẰNG TIẾNG VIỆT. Chỉ trả về JSON: {"score": số điểm, "feedback": "nhận xét ngắn gọn"}`,
            'junior': `Hãy chấm điểm câu trả lời này cho ứng viên trình độ JUNIOR về chủ đề ${topic}.\n\nCâu hỏi: ${questionText}\n\nCâu trả lời: ${candidateAnswer}\n\nChấm điểm từ 0-10 dựa trên: kỹ năng thực hành, ứng dụng thực tế, giải quyết vấn đề. Trả lời BẰNG TIẾNG VIỆT. Chỉ trả về JSON: {"score": số điểm, "feedback": "nhận xét ngắn gọn"}`,
            'middle': `Hãy chấm điểm câu trả lời này cho ứng viên trình độ MIDDLE về chủ đề ${topic}.\n\nCâu hỏi: ${questionText}\n\nCâu trả lời: ${candidateAnswer}\n\nChấm điểm từ 0-10 dựa trên: tối ưu hóa, best practice, xử lý edge case. Trả lời BẰNG TIẾNG VIỆT. Chỉ trả về JSON: {"score": số điểm, "feedback": "nhận xét ngắn gọn"}`,
            'senior': `Hãy chấm điểm câu trả lời này cho ứng viên trình độ SENIOR về chủ đề ${topic}.\n\nCâu hỏi: ${questionText}\n\nCâu trả lời: ${candidateAnswer}\n\nChấm điểm từ 0-10 dựa trên: thiết kế hệ thống, trade-off, tư duy kiến trúc. Trả lời BẰNG TIẾNG VIỆT. Chỉ trả về JSON: {"score": số điểm, "feedback": "nhận xét ngắn gọn"}`
        },
        'en': {
            'intern': `Grade this answer for an INTERN level candidate about ${topic}.\n\nQuestion: ${questionText}\n\nAnswer: ${candidateAnswer}\n\nScore from 0-10 based on: basic knowledge, accuracy, completeness. Respond in ENGLISH. Return only JSON: {"score": score number, "feedback": "brief feedback"}`,
            'junior': `Grade this answer for a JUNIOR level candidate about ${topic}.\n\nQuestion: ${questionText}\n\nAnswer: ${candidateAnswer}\n\nScore from 0-10 based on: practical skills, real-world application, problem-solving. Respond in ENGLISH. Return only JSON: {"score": score number, "feedback": "brief feedback"}`,
            'middle': `Grade this answer for a MIDDLE level candidate about ${topic}.\n\nQuestion: ${questionText}\n\nAnswer: ${candidateAnswer}\n\nScore from 0-10 based on: optimization, best practices, edge case handling. Respond in ENGLISH. Return only JSON: {"score": score number, "feedback": "brief feedback"}`,
            'senior': `Grade this answer for a SENIOR level candidate about ${topic}.\n\nQuestion: ${questionText}\n\nAnswer: ${candidateAnswer}\n\nScore from 0-10 based on: system design, trade-offs, architectural thinking. Respond in ENGLISH. Return only JSON: {"score": score number, "feedback": "brief feedback"}`
        }
    };

    return prompts[language]?.[level] || prompts['vi'][level];
};

/**
 * Compare score with level standard
 */
const compareWithLevelStandard = (totalScore, level) => {
    const standards = {
        'intern': 60,
        'junior': 70,
        'middle': 75,
        'senior': 80
    };

    const standard = standards[level] || 70;
    const percentage = (totalScore / 100) * 100;

    if (percentage >= standard + 10) {
        return { status: 'exceed', message: `Vượt chuẩn ${level}`, standardScore: standard };
    } else if (percentage >= standard) {
        return { status: 'pass', message: `Đạt chuẩn ${level}`, standardScore: standard };
    } else {
        return { status: 'fail', message: `Dưới chuẩn ${level}`, standardScore: standard };
    }
};

/**
 * Grade all answers in an interview
 */
const gradeInterview = async (interviewId) => {
    try {
        const interview = await db.VirtualInterview.findByPk(interviewId, {
            include: [{
                model: db.VirtualInterviewQuestion,
                as: 'Questions',
                order: [['questionOrder', 'ASC']]
            }]
        });

        if (!interview) {
            return {
                EM: 'Không tìm thấy phiên phỏng vấn ảo!',
                EC: 1,
                DT: null
            };
        }

        // Get all answers
        const answers = await db.VirtualInterviewAnswer.findAll({
            where: { virtualInterviewId: interviewId },
            include: [{
                model: db.VirtualInterviewQuestion,
                as: 'Question'
            }]
        });

        if (answers.length === 0) {
            return {
                EM: 'Không có câu trả lời để chấm!',
                EC: 2,
                DT: null
            };
        }

        // Prepare grading items for batch grading
        const gradingItems = answers.map((answer, index) => {
            // Get expected answer from metadata or use question text as fallback
            let expectedAnswer = '';
            if (answer.Question.metadata && answer.Question.metadata.expectedAnswer) {
                expectedAnswer = answer.Question.metadata.expectedAnswer;
            } else if (answer.Question.questionText) {
                // Fallback: use a generic expected answer format
                expectedAnswer = `Expected answer for: ${answer.Question.questionText.substring(0, 100)}...`;
            }

            return {
                index: index,
                answerId: answer.id,
                questionId: answer.Question.id,
                questionText: answer.Question.questionText || '',
                correctAnswer: expectedAnswer,
                candidateAnswer: answer.answerText || '',
                maxScore: answer.Question.maxScore || 10,
                questionType: 'tuluan' // All virtual interview questions are essay type
            };
        });

        // Grade using batch grading
        const batchResults = await gradeAnswersBatch(gradingItems);

        // Update answers with scores
        for (let i = 0; i < answers.length; i++) {
            const answer = answers[i];
            const result = batchResults[i];

            if (result) {
                // Build custom feedback with language
                const customPrompt = buildGradingPrompt(
                    interview.level,
                    answer.Question.topic,
                    interview.language,
                    answer.Question.questionText,
                    answer.answerText
                );

                // Get custom feedback from AI using Gemini
                try {
                    if (!genAI) {
                        throw new Error('Gemini API key not configured');
                    }

                    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
                    const fullPrompt = interview.language === 'vi'
                        ? 'Bạn là chuyên gia chấm điểm phỏng vấn IT. Chỉ trả về JSON, không có text nào khác.\n\n' + customPrompt
                        : 'You are an expert IT interview grader. Return only JSON, no other text.\n\n' + customPrompt;
                    
                    const feedbackResponse = await model.generateContent(fullPrompt);
                    const feedbackResponseObj = await feedbackResponse.response;
                    const feedbackText = feedbackResponseObj.text();
                    const feedbackResult = parseJSONFromResponse(feedbackText);

                    answer.score = result.score;
                    answer.feedback = feedbackResult?.feedback || result.comment || '';
                    answer.similarityScore = result.similarity_ai || 0;
                    answer.gradedAt = new Date();
                    answer.gradingMethod = 'ai';
                } catch (error) {
                    // Fallback to batch result
                    answer.score = result.score;
                    answer.feedback = result.comment || '';
                    answer.similarityScore = result.similarity_ai || 0;
                    answer.gradedAt = new Date();
                    answer.gradingMethod = 'ai';
                }

                await answer.save();
            }
        }

        // Calculate topic scores
        await calculateTopicScores(interviewId);

        // Calculate level score
        await calculateLevelScore(interviewId);

        // Generate overall feedback
        await generateOverallFeedback(interviewId);

        return {
            EM: 'Chấm điểm thành công!',
            EC: 0,
            DT: { gradedCount: answers.length }
        };
    } catch (error) {
        console.error('Error in gradeInterview:', error);
        return {
            EM: 'Có lỗi xảy ra khi chấm điểm!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Calculate scores by topic
 */
const calculateTopicScores = async (interviewId) => {
    try {
        const interview = await db.VirtualInterview.findByPk(interviewId);
        const topics = interview.topics || [];

        // Delete existing topic scores
        await db.VirtualInterviewTopicScore.destroy({
            where: { virtualInterviewId: interviewId }
        });

        // Calculate for each topic
        for (const topic of topics) {
            const questions = await db.VirtualInterviewQuestion.findAll({
                where: {
                    virtualInterviewId: interviewId,
                    topic: topic
                },
                include: [{
                    model: db.VirtualInterviewAnswer,
                    as: 'Answer'
                }]
            });

            if (questions.length === 0) continue;

            let totalScore = 0;
            let maxScore = 0;
            let totalQuestions = 0;

            for (const question of questions) {
                maxScore += question.maxScore;
                totalQuestions++;
                if (question.Answer && question.Answer.score !== null) {
                    totalScore += question.Answer.score;
                }
            }

            const averageScore = totalQuestions > 0 ? totalScore / totalQuestions : 0;
            const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

            // Generate topic feedback
            const topicFeedback = await generateTopicFeedback(topic, {
                totalScore,
                maxScore,
                averageScore,
                percentage
            }, interview.level, interview.language);

            await db.VirtualInterviewTopicScore.create({
                virtualInterviewId: interviewId,
                topic: topic,
                totalQuestions: totalQuestions,
                totalScore: totalScore,
                maxScore: maxScore,
                averageScore: averageScore,
                percentage: percentage,
                feedback: topicFeedback
            });
        }

        return { success: true };
    } catch (error) {
        console.error('Error in calculateTopicScores:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Calculate level score
 */
const calculateLevelScore = async (interviewId) => {
    try {
        const interview = await db.VirtualInterview.findByPk(interviewId);
        
        const topicScores = await db.VirtualInterviewTopicScore.findAll({
            where: { virtualInterviewId: interviewId }
        });

        if (topicScores.length === 0) {
            return { success: false };
        }

        // Calculate weighted average
        let totalWeightedScore = 0;
        let totalWeight = 0;

        for (const topicScore of topicScores) {
            const weight = topicScore.totalQuestions;
            totalWeightedScore += topicScore.percentage * weight;
            totalWeight += weight;
        }

        const levelScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
        interview.levelScore = levelScore;
        await interview.save();

        return { success: true, levelScore };
    } catch (error) {
        console.error('Error in calculateLevelScore:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Generate topic feedback
 */
const generateTopicFeedback = async (topic, scores, level, language) => {
    try {
        const prompt = language === 'vi'
            ? `Đánh giá kết quả phỏng vấn về chủ đề ${topic} cho trình độ ${level}. Điểm trung bình: ${scores.averageScore.toFixed(1)}/${scores.maxScore.toFixed(1)} (${scores.percentage.toFixed(1)}%). Đưa ra nhận xét ngắn gọn về điểm mạnh và điểm cần cải thiện. Trả lời BẰNG TIẾNG VIỆT.`
            : `Evaluate interview results for topic ${topic} at ${level} level. Average score: ${scores.averageScore.toFixed(1)}/${scores.maxScore.toFixed(1)} (${scores.percentage.toFixed(1)}%). Provide brief feedback on strengths and areas for improvement. Respond in ENGLISH.`;

        if (!genAI) {
            throw new Error('Gemini API key not configured');
        }

        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error('Error generating topic feedback:', error);
        return '';
    }
};

/**
 * Generate overall feedback
 */
const generateOverallFeedback = async (interviewId) => {
    try {
        const interview = await db.VirtualInterview.findByPk(interviewId, {
            include: [{
                model: db.VirtualInterviewTopicScore,
                as: 'TopicScores'
            }]
        });

        if (!interview || !interview.totalScore) {
            return { success: false };
        }

        const levelAssessment = compareWithLevelStandard(interview.totalScore, interview.level);
        const topicScoresText = interview.TopicScores.map(ts => 
            `${ts.topic}: ${ts.percentage.toFixed(1)}%`
        ).join(', ');

        const prompt = interview.language === 'vi'
            ? `Tổng hợp kết quả phỏng vấn ảo cho trình độ ${interview.level}. Tổng điểm: ${interview.totalScore.toFixed(1)}/${interview.maxScore.toFixed(1)}. ${levelAssessment.message}. Điểm theo chủ đề: ${topicScoresText}. Đưa ra nhận xét tổng quan và gợi ý cải thiện. Trả lời BẰNG TIẾNG VIỆT. Chỉ trả về JSON: {"overallFeedback": "nhận xét tổng quan", "improvementSuggestions": "gợi ý cải thiện"}`
            : `Summarize virtual interview results for ${interview.level} level. Total score: ${interview.totalScore.toFixed(1)}/${interview.maxScore.toFixed(1)}. ${levelAssessment.message}. Topic scores: ${topicScoresText}. Provide overall feedback and improvement suggestions. Respond in ENGLISH. Return only JSON: {"overallFeedback": "overall feedback", "improvementSuggestions": "improvement suggestions"}`;

        if (!genAI) {
            throw new Error('Gemini API key not configured');
        }

        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const fullPrompt = interview.language === 'vi'
            ? 'Bạn là chuyên gia đánh giá phỏng vấn IT. Chỉ trả về JSON, không có text nào khác.\n\n' + prompt
            : 'You are an IT interview evaluation expert. Return only JSON, no other text.\n\n' + prompt;
        
        const result_gemini = await model.generateContent(fullPrompt);
        const response = await result_gemini.response;
        const responseText = response.text();
        const result = parseJSONFromResponse(responseText);

        if (result) {
            interview.overallFeedback = result.overallFeedback || '';
            interview.improvementSuggestions = result.improvementSuggestions || '';
            await interview.save();
        }

        // Calculate total score
        const topicScores = interview.TopicScores || [];
        let totalScore = 0;
        let maxScore = 0;

        for (const ts of topicScores) {
            totalScore += ts.totalScore;
            maxScore += ts.maxScore;
        }

        interview.totalScore = totalScore;
        interview.maxScore = maxScore;
        await interview.save();

        return { success: true };
    } catch (error) {
        console.error('Error in generateOverallFeedback:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    gradeInterview,
    calculateTopicScores,
    calculateLevelScore,
    generateOverallFeedback,
    generateTopicFeedback,
    compareWithLevelStandard,
    buildGradingPrompt
};

