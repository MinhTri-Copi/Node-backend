/**
 * TRAINING DATA SERVICE
 * 
 * Service để thu thập và export dữ liệu training cho ML model
 * 
 * PHA A: Chuẩn bị dữ liệu
 * PHA B: Dùng LLM + thầy để tạo dữ liệu train
 */

const db = require('../models/index');
const { TestQuestion, TestAnswer, TestSubmission, Test } = db;
const { Op } = require('sequelize');
const { getRubricForQuestion } = require('../config/gradingRubric');

/**
 * Lấy tất cả câu hỏi tự luận từ database
 * Format: { id, questionText, correctAnswer, maxScore, questionType }
 */
const getAllEssayQuestions = async () => {
    try {
        const questions = await TestQuestion.findAll({
            where: {
                Loaicauhoi: 'tuluan'
            },
            attributes: ['id', 'Cauhoi', 'Dapan', 'Diem', 'Loaicauhoi', 'Thutu', 'testId'],
            order: [['id', 'ASC']],
            include: [{
                model: Test,
                as: 'Test',
                attributes: ['id', 'Tieude']
            }]
        });

        return questions.map(q => ({
            id: q.id,
            questionText: q.Cauhoi,
            correctAnswer: q.Dapan,
            maxScore: q.Diem,
            questionType: q.Loaicauhoi,
            order: q.Thutu,
            testId: q.testId,
            testTitle: q.Test?.Tieude || 'N/A'
        }));
    } catch (error) {
        console.error('❌ Error getting essay questions:', error);
        throw error;
    }
};

/**
 * Lấy tất cả câu trả lời của ứng viên kèm điểm đã chấm
 * Format: { questionId, candidateAnswer, score, comment, similarity }
 */
const getAllGradedAnswers = async () => {
    try {
        const answers = await TestAnswer.findAll({
            where: {
                Phuongphap: { [Op.in]: ['ai', 'hybrid', 'manual'] }
            },
            attributes: [
                'id',
                'Cautraloi',
                'Diemdatduoc',
                'Nhanxet',
                'Dungkhong',
                'Phuongphap',
                'Dosattinhcua_ai',
                'Dosattinhcua_nlp',
                'testQuestionId',
                'testSubmissionId'
            ],
            include: [{
                model: TestQuestion,
                as: 'Question',
                attributes: ['id', 'Cauhoi', 'Dapan', 'Diem', 'Loaicauhoi']
            }, {
                model: TestSubmission,
                as: 'Submission',
                attributes: ['id', 'userId']
            }],
            order: [['id', 'ASC']]
        });

        return answers.map(a => ({
            id: a.id,
            questionId: a.testQuestionId,
            questionText: a.Question?.Cauhoi || '',
            correctAnswer: a.Question?.Dapan || '',
            candidateAnswer: a.Cautraloi || '',
            score: a.Diemdatduoc || 0,
            maxScore: a.Question?.Diem || 10,
            comment: a.Nhanxet || '',
            isCorrect: a.Dungkhong || false,
            gradingMethod: a.Phuongphap,
            similarityAI: a.Dosattinhcua_ai || 0,
            similarityNLP: a.Dosattinhcua_nlp || 0,
            questionType: a.Question?.Loaicauhoi || 'tuluan',
            submissionId: a.testSubmissionId,
            candidateId: a.Submission?.userId || null
        }));
    } catch (error) {
        console.error('❌ Error getting graded answers:', error);
        throw error;
    }
};

/**
 * Tạo dataset training từ câu hỏi và câu trả lời đã chấm
 * Format phù hợp cho ML training
 */
const createTrainingDataset = async (options = {}) => {
    const {
        minAnswersPerQuestion = 1, // Số câu trả lời tối thiểu mỗi câu hỏi
        includeOnlyManualGraded = false, // Chỉ lấy câu đã chấm thủ công
        includeOnlyAIGraded = false, // Chỉ lấy câu đã chấm bằng AI
        minSimilarity = 0, // Similarity tối thiểu
        maxSimilarity = 1 // Similarity tối đa
    } = options;

    try {
        // Lấy tất cả câu hỏi tự luận
        const questions = await getAllEssayQuestions();
        console.log(`📊 Tìm thấy ${questions.length} câu hỏi tự luận`);

        // Lấy tất cả câu trả lời đã chấm
        let answers = await getAllGradedAnswers();
        console.log(`📊 Tìm thấy ${answers.length} câu trả lời đã chấm`);

        // Lọc theo yêu cầu
        if (includeOnlyManualGraded) {
            answers = answers.filter(a => a.gradingMethod === 'manual');
            console.log(`📊 Sau khi lọc manual: ${answers.length} câu trả lời`);
        }
        if (includeOnlyAIGraded) {
            answers = answers.filter(a => a.gradingMethod === 'ai' || a.gradingMethod === 'hybrid');
            console.log(`📊 Sau khi lọc AI: ${answers.length} câu trả lời`);
        }

        // Lọc theo similarity
        answers = answers.filter(a => {
            const similarity = a.similarityAI || a.similarityNLP || 0;
            return similarity >= minSimilarity && similarity <= maxSimilarity;
        });
        console.log(`📊 Sau khi lọc similarity [${minSimilarity}, ${maxSimilarity}]: ${answers.length} câu trả lời`);

        // Nhóm câu trả lời theo questionId
        const answersByQuestion = {};
        answers.forEach(answer => {
            if (!answersByQuestion[answer.questionId]) {
                answersByQuestion[answer.questionId] = [];
            }
            answersByQuestion[answer.questionId].push(answer);
        });

        // Tạo dataset
        const dataset = [];
        questions.forEach(question => {
            const questionAnswers = answersByQuestion[question.id] || [];
            
            if (questionAnswers.length >= minAnswersPerQuestion) {
                questionAnswers.forEach(answer => {
                    // Tính similarity nếu chưa có
                    const similarity = answer.similarityAI || answer.similarityNLP || 0;
                    const normalizedScore = question.maxScore > 0 
                        ? answer.score / question.maxScore 
                        : 0;

                    dataset.push({
                        // Input features
                        questionText: question.questionText,
                        correctAnswer: question.correctAnswer,
                        candidateAnswer: answer.candidateAnswer,
                        maxScore: question.maxScore,
                        
                        // Target (label)
                        score: answer.score,
                        normalizedScore: normalizedScore, // 0-1
                        similarity: similarity, // 0-1
                        isCorrect: answer.isCorrect,
                        
                        // Metadata
                        questionId: question.id,
                        answerId: answer.id,
                        gradingMethod: answer.gradingMethod,
                        comment: answer.comment,
                        testId: question.testId,
                        testTitle: question.testTitle
                    });
                });
            }
        });

        console.log(`✅ Tạo dataset: ${dataset.length} mẫu từ ${Object.keys(answersByQuestion).length} câu hỏi`);
        
        return {
            totalSamples: dataset.length,
            totalQuestions: Object.keys(answersByQuestion).length,
            questionsWithAnswers: Object.keys(answersByQuestion).filter(qId => 
                (answersByQuestion[qId] || []).length >= minAnswersPerQuestion
            ).length,
            dataset: dataset
        };
    } catch (error) {
        console.error('❌ Error creating training dataset:', error);
        throw error;
    }
};

/**
 * Export dataset ra file JSON (để dùng cho training)
 */
const exportTrainingDataset = async (outputPath, options = {}) => {
    const fs = require('fs').promises;
    const path = require('path');

    try {
        const dataset = await createTrainingDataset(options);
        
        const outputData = {
            metadata: {
                createdAt: new Date().toISOString(),
                totalSamples: dataset.totalSamples,
                totalQuestions: dataset.totalQuestions,
                questionsWithAnswers: dataset.questionsWithAnswers,
                options: options
            },
            data: dataset.dataset
        };

        const fullPath = path.resolve(outputPath);
        await fs.writeFile(fullPath, JSON.stringify(outputData, null, 2), 'utf8');
        
        console.log(`✅ Đã export dataset ra: ${fullPath}`);
        console.log(`   - Tổng mẫu: ${dataset.totalSamples}`);
        console.log(`   - Tổng câu hỏi: ${dataset.totalQuestions}`);
        console.log(`   - Câu hỏi có đáp án: ${dataset.questionsWithAnswers}`);
        
        return fullPath;
    } catch (error) {
        console.error('❌ Error exporting training dataset:', error);
        throw error;
    }
};

/**
 * PHA B - Bước B1: Export dữ liệu để chuyển sang CSV
 * Format: questionId, questionText, correctAnswer, studentAnswer, maxScore, teacherScore
 * teacherScore = điểm hiện tại (từ AI hoặc manual), có thể cập nhật sau
 */
const exportAnswersForCSV = async () => {
    try {
        console.log('🔄 Đang lấy dữ liệu từ database...');
        
        // Lấy tất cả câu trả lời đã chấm (chỉ tự luận)
        const answers = await getAllGradedAnswers();
        console.log(`📊 Tìm thấy ${answers.length} câu trả lời đã chấm`);
        
        // Lọc chỉ lấy câu tự luận
        const essayAnswers = answers.filter(a => a.questionType === 'tuluan');
        console.log(`📊 Trong đó có ${essayAnswers.length} câu tự luận`);
        
        if (essayAnswers.length === 0) {
            console.warn('⚠️ Không có dữ liệu tự luận để export');
            return []; // Trả về array rỗng thay vì throw error
        }
        
        // Format theo yêu cầu CSV
        const csvData = essayAnswers.map(a => ({
            questionId: a.questionId,
            questionText: a.questionText || '',
            correctAnswer: a.correctAnswer || '',
            studentAnswer: a.candidateAnswer || '',
            maxScore: a.maxScore || 10,
            teacherScore: a.score || 0  // Điểm hiện tại (có thể là AI hoặc manual)
        }));

        console.log(`✅ Đã export ${csvData.length} dòng dữ liệu cho CSV`);
        
        return csvData;
    } catch (error) {
        console.error('❌ Error exporting answers for CSV:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
};

module.exports = {
    getAllEssayQuestions,
    getAllGradedAnswers,
    createTrainingDataset,
    exportTrainingDataset,
    exportAnswersForCSV
};

