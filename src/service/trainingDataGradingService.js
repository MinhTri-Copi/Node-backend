/**
 * TRAINING DATA GRADING SERVICE
 * 
 * PHA B - Bước B2: Dùng LLM để chấm và tạo teacherScore
 * 
 * Service để:
 * 1. LLM chấm các câu trả lời theo rubric
 * 2. Lưu teacherScore vào database hoặc file
 */

const db = require('../models/index');
const { TestAnswer, TestQuestion } = db;
const { OpenAI } = require('openai');
require('dotenv').config();

// LM Studio configuration
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://127.0.0.1:1234';
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL || 'qwen2.5-1.5b-instruct';

// Initialize OpenAI client for LM Studio
const openai = new OpenAI({
    baseURL: LM_STUDIO_URL + '/v1',
    apiKey: 'lm-studio',
});

const { getRubricForQuestion, createRubricPrompt } = require('../config/gradingRubric');

/**
 * Normalize text for prompt
 */
const normalizeForPrompt = (text, maxLen = 50) => {
    if (!text) return '';
    return text
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/\s+/g, ' ') // Collapse whitespace
        .trim()
        .substring(0, maxLen);
};

/**
 * Chấm một câu trả lời bằng LLM theo rubric
 */
const gradeAnswerWithLLM = async (questionText, correctAnswer, candidateAnswer, maxScore) => {
    try {
        const rubric = getRubricForQuestion('tuluan');
        const rubricPrompt = createRubricPrompt(rubric);

        const prompt = `Chấm bài tự luận theo rubric.

Câu hỏi: "${normalizeForPrompt(questionText, 50)}"
Đáp án đúng: "${normalizeForPrompt(correctAnswer, 50)}"
Câu trả lời của học sinh: "${normalizeForPrompt(candidateAnswer, 50)}"
Điểm tối đa: ${maxScore}

${rubricPrompt}

Trả về JSON: {"score": 0-${maxScore}, "comment": "10-20 từ"}`;

        const response = await openai.chat.completions.create({
            model: LM_STUDIO_MODEL,
            messages: [
                {
                    role: 'system',
                    content: 'Bạn là giáo viên chấm bài tự luận. Chấm theo rubric, chính xác và công bằng.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0,
            top_p: 0.1,
            max_tokens: 150
        });

        const responseText = response.choices[0]?.message?.content || '';
        
        // Parse JSON
        let result;
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Không tìm thấy JSON trong response');
            }
        } catch (parseError) {
            console.error('Lỗi parse JSON:', responseText);
            throw new Error('LLM không trả về JSON hợp lệ');
        }

        // Validate score
        let score = Math.max(0, Math.min(maxScore, parseFloat(result.score) || 0));
        score = Math.round(score * 2) / 2; // Round to 0.5

        return {
            score: score,
            comment: result.comment || 'Đã chấm bằng LLM',
            method: 'llm'
        };
    } catch (error) {
        console.error('❌ Lỗi khi LLM chấm:', error);
        throw error;
    }
};

/**
 * Chấm nhiều câu trả lời bằng LLM (batch)
 */
const gradeAnswersBatchWithLLM = async (items) => {
    try {
        const results = [];
        
        for (const item of items) {
            try {
                const result = await gradeAnswerWithLLM(
                    item.questionText,
                    item.correctAnswer,
                    item.candidateAnswer,
                    item.maxScore
                );
                
                results.push({
                    ...item,
                    teacherScore: result.score,
                    teacherComment: result.comment,
                    gradingMethod: result.method
                });
                
                // Delay nhỏ để tránh quá tải LLM
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`Lỗi chấm câu ${item.questionId}:`, error.message);
                results.push({
                    ...item,
                    teacherScore: 0,
                    teacherComment: 'Lỗi khi chấm',
                    gradingMethod: 'error'
                });
            }
        }
        
        return results;
    } catch (error) {
        console.error('❌ Lỗi khi chấm batch:', error);
        throw error;
    }
};

/**
 * Lấy danh sách câu trả lời chưa có teacherScore (hoặc cần chấm lại)
 */
const getAnswersNeedingGrading = async (options = {}) => {
    const {
        includeAlreadyGraded = false, // Có lấy cả câu đã chấm không
        minAnswers = 0 // Số câu trả lời tối thiểu
    } = options;

    try {
        // Lấy tất cả câu trả lời tự luận
        const answers = await TestAnswer.findAll({
            include: [{
                model: TestQuestion,
                as: 'Question',
                where: {
                    Loaicauhoi: 'tuluan'
                },
                attributes: ['id', 'Cauhoi', 'Dapan', 'Diem', 'Loaicauhoi']
            }],
            attributes: [
                'id',
                'Cautraloi',
                'Diemdatduoc',
                'Nhanxet',
                'testQuestionId'
            ],
            order: [['id', 'ASC']]
        });

        const formatted = answers.map(a => ({
            answerId: a.id,
            questionId: a.testQuestionId,
            questionText: a.Question?.Cauhoi || '',
            correctAnswer: a.Question?.Dapan || '',
            candidateAnswer: a.Cautraloi || '',
            maxScore: a.Question?.Diem || 10,
            currentScore: a.Diemdatduoc || 0, // Điểm hiện tại (có thể là AI)
            currentComment: a.Nhanxet || '',
            // teacherScore sẽ được LLM hoặc thầy gán sau
        }));

        return formatted;
    } catch (error) {
        console.error('❌ Lỗi khi lấy danh sách câu cần chấm:', error);
        throw error;
    }
};

module.exports = {
    gradeAnswerWithLLM,
    gradeAnswersBatchWithLLM,
    getAnswersNeedingGrading
};

