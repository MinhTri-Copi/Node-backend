import db from '../models/index';

/**
 * AI/NLP auto-grading service for test submissions
 * Uses hybrid approach: AI + NLP to suggest scores
 */

/**
 * Calculate similarity between candidate answer and correct answer
 * Simple implementation - can be replaced with actual NLP/AI service
 */
const calculateSimilarity = (candidateAnswer, correctAnswer) => {
    if (!candidateAnswer || !correctAnswer) return 0;

    const normalize = (str) => str.toLowerCase().trim().replace(/\s+/g, ' ');
    const candidate = normalize(candidateAnswer);
    const correct = normalize(correctAnswer);

    // Exact match
    if (candidate === correct) return 1.0;

    // Contains correct answer
    if (candidate.includes(correct) || correct.includes(candidate)) return 0.8;

    // Calculate word overlap
    const candidateWords = new Set(candidate.split(' '));
    const correctWords = new Set(correct.split(' '));
    
    let matchCount = 0;
    correctWords.forEach(word => {
        if (candidateWords.has(word)) matchCount++;
    });

    const similarity = matchCount / correctWords.size;
    return similarity;
};

/**
 * Grade a single answer using AI/NLP
 */
const gradeAnswer = (candidateAnswer, correctAnswer, maxScore, questionType) => {
    if (!candidateAnswer || candidateAnswer.trim() === '') {
        return {
            score: 0,
            similarity_nlp: 0,
            similarity_ai: 0,
            isCorrect: false,
            confidence: 1.0
        };
    }

    // For multiple choice - exact match required
    if (questionType === 'tracnghiem') {
        const isExact = candidateAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
        return {
            score: isExact ? maxScore : 0,
            similarity_nlp: isExact ? 1.0 : 0,
            similarity_ai: isExact ? 1.0 : 0,
            isCorrect: isExact,
            confidence: 1.0
        };
    }

    // For essay questions - use similarity
    const similarity = calculateSimilarity(candidateAnswer, correctAnswer);
    const score = Math.round(similarity * maxScore * 10) / 10; // Round to 1 decimal

    return {
        score: score,
        similarity_nlp: similarity,
        similarity_ai: similarity, // In real implementation, this would be different
        isCorrect: similarity >= 0.8,
        confidence: similarity
    };
};

/**
 * Auto-grade all answers in a submission
 */
const autoGradeSubmission = async (submissionId) => {
    try {
        // Get submission with all answers and questions
        const submission = await db.TestSubmission.findOne({
            where: { id: submissionId },
            include: [
                {
                    model: db.Test,
                    as: 'Test',
                    include: [{
                        model: db.TestQuestion,
                        as: 'Questions',
                        attributes: ['id', 'Cauhoi', 'Dapan', 'Loaicauhoi', 'Diem']
                    }]
                },
                {
                    model: db.TestAnswer,
                    as: 'Answers',
                    include: [{
                        model: db.TestQuestion,
                        as: 'Question',
                        attributes: ['id', 'Cauhoi', 'Dapan', 'Loaicauhoi', 'Diem']
                    }]
                }
            ]
        });

        if (!submission) {
            return {
                EM: 'Không tìm thấy bài test!',
                EC: 1,
                DT: null
            };
        }

        if (submission.Trangthai !== 'danop' && submission.Trangthai !== 'dacham') {
            return {
                EM: 'Chỉ có thể chấm bài đã nộp!',
                EC: 2,
                DT: null
            };
        }

        const gradedAnswers = [];

        // Grade each answer
        for (const answer of submission.Answers) {
            const question = answer.Question;
            
            const gradingResult = gradeAnswer(
                answer.Cautraloi,
                question.Dapan,
                question.Diem,
                question.Loaicauhoi
            );

            // Update answer with AI-suggested score
            await answer.update({
                Diemdatduoc: gradingResult.score,
                Dungkhong: gradingResult.isCorrect,
                Phuongphap: 'hybrid',
                Dosattinhcua_nlp: gradingResult.similarity_nlp,
                Dosattinhcua_ai: gradingResult.similarity_ai
            });

            gradedAnswers.push({
                answerId: answer.id,
                questionId: question.id,
                suggestedScore: gradingResult.score,
                maxScore: question.Diem,
                similarity: gradingResult.similarity_nlp,
                isCorrect: gradingResult.isCorrect,
                confidence: gradingResult.confidence
            });
        }

        // Calculate total suggested score
        const totalScore = gradedAnswers.reduce((sum, a) => sum + a.suggestedScore, 0);

        return {
            EM: 'AI chấm điểm thành công!',
            EC: 0,
            DT: {
                submissionId: submission.id,
                gradedAnswers: gradedAnswers,
                totalSuggestedScore: totalScore,
                totalQuestions: gradedAnswers.length
            }
        };

    } catch (error) {
        console.error('Error in autoGradeSubmission:', error);
        return {
            EM: 'Có lỗi xảy ra khi AI chấm điểm!',
            EC: -1,
            DT: null
        };
    }
};

export default {
    autoGradeSubmission,
    gradeAnswer
};

