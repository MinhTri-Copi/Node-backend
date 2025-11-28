import db from '../models/index';
import natural from 'natural';
import { GoogleGenerativeAI } from '@google/generative-ai';
require('dotenv').config();

// Polyfill fetch for Node.js < 18
if (typeof fetch === 'undefined') {
    try {
        const nodeFetch = require('node-fetch');
        global.fetch = nodeFetch;
        global.Headers = nodeFetch.Headers;
        global.Request = nodeFetch.Request;
        global.Response = nodeFetch.Response;
        console.log('✅ Using node-fetch polyfill for fetch API');
    } catch (error) {
        console.error('❌ Failed to load node-fetch. Please install: npm install node-fetch@2');
        console.error('   Or upgrade Node.js to version 18+ which has built-in fetch');
    }
}

/**
 * AI auto-grading service for test submissions
 * Hybrid approach: AI chấm điểm → HR xem và điều chỉnh
 * Không sử dụng NLP (chỉ AI)
 */

// Initialize Gemini AI
let genAI = null;
if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
} else {
    console.warn('⚠️ GEMINI_API_KEY not found in .env. AI grading will use NLP only.');
}

/**
 * Calculate similarity using Natural NLP library
 * Fast method (50-100ms) with 60-70% accuracy
 */
const calculateSimilarityNLP = (candidateAnswer, correctAnswer) => {
    if (!candidateAnswer || !correctAnswer) return 0;

    const normalize = (str) => str.toLowerCase().trim().replace(/\s+/g, ' ');
    const candidate = normalize(candidateAnswer);
    const correct = normalize(correctAnswer);

    // Exact match
    if (candidate === correct) return 1.0;

    // Use Natural library for better similarity calculation
    // Jaro-Winkler distance (good for short strings)
    const jaroWinkler = natural.JaroWinklerDistance(candidate, correct);

    // Cosine similarity using TF-IDF (good for longer texts)
    const TfIdf = natural.TfIdf;
    const tfidf = new TfIdf();
    tfidf.addDocument(candidate);
    tfidf.addDocument(correct);

    // Calculate cosine similarity
    let cosineSimilarity = 0;
    const candidateTerms = new Set();
    const correctTerms = new Set();

    // Get terms from both documents
    tfidf.listTerms(0).forEach(item => candidateTerms.add(item.term));
    tfidf.listTerms(1).forEach(item => correctTerms.add(item.term));

    // Calculate dot product and magnitudes
    let dotProduct = 0;
    let candidateMagnitude = 0;
    let correctMagnitude = 0;

    const allTerms = new Set([...candidateTerms, ...correctTerms]);
    allTerms.forEach(term => {
        const candidateTfidf = tfidf.tfidf(term, 0);
        const correctTfidf = tfidf.tfidf(term, 1);
        dotProduct += candidateTfidf * correctTfidf;
        candidateMagnitude += candidateTfidf * candidateTfidf;
        correctMagnitude += correctTfidf * correctTfidf;
    });

    if (candidateMagnitude > 0 && correctMagnitude > 0) {
        cosineSimilarity = dotProduct / (Math.sqrt(candidateMagnitude) * Math.sqrt(correctMagnitude));
    }

    // Combine Jaro-Winkler and Cosine similarity
    // Jaro-Winkler is better for short strings, Cosine for longer texts
    const avgLength = (candidate.length + correct.length) / 2;
    let finalSimilarity;

    if (avgLength < 50) {
        // Short strings: prefer Jaro-Winkler
        finalSimilarity = jaroWinkler * 0.6 + cosineSimilarity * 0.4;
    } else {
        // Long strings: prefer Cosine
        finalSimilarity = jaroWinkler * 0.3 + cosineSimilarity * 0.7;
    }

    return Math.max(0, Math.min(1, finalSimilarity));
};

/**
 * Round score to nearest 0.5 (e.g., 7.3 -> 7.5, 7.7 -> 8.0)
 */
const roundToHalf = (score) => {
    return Math.round(score * 2) / 2;
};

/**
 * Get similarity status based on similarity value
 */
const getSimilarityStatus = (similarity) => {
    if (similarity > 0.75) {
        return {
            level: 'good',
            label: 'Đúng phần lớn',
            emoji: '🟢',
            color: 'green'
        };
    } else if (similarity >= 0.50) {
        return {
            level: 'review',
            label: 'Cần xem lại',
            emoji: '🟡',
            color: 'yellow'
        };
    } else {
        return {
            level: 'problem',
            label: 'Có vấn đề',
            emoji: '🔴',
            color: 'red'
        };
    }
};

/**
 * Grade answer using Gemini AI
 * More accurate but slower (1-3s)
 */
const gradeWithGemini = async (candidateAnswer, correctAnswer, maxScore, questionText) => {
    if (!genAI) {
        // Fallback to NLP if Gemini not configured
        const similarity = calculateSimilarityNLP(candidateAnswer, correctAnswer);
        return {
            score: Math.round(similarity * maxScore * 10) / 10,
            similarity_ai: similarity,
            comment: 'Gemini API không được cấu hình, sử dụng NLP',
            confidence: similarity
        };
    }

    try {
        // Try different Gemini models in order of preference
        // User requested: gemini-2.5-flash
        const modelsToTry = [
            'gemini-2.5-flash',      // User's preferred model
            'gemini-1.5-flash',      // Fallback: Fast model
            'gemini-1.5-pro',        // Fallback: More capable
            'gemini-pro'              // Fallback: Stable (most widely available)
        ];

        const prompt = `
        Bạn là hệ thống chấm bài tự luận.
        ⚠ Bạn chỉ được phép so sánh mức độ tương đồng giữa đáp án tham chiếu và câu trả lời ứng viên.
        Không được sử dụng kiến thức bên ngoài hoặc tự đưa ra định nghĩa mới.
        
        Dữ liệu chấm:
        - Câu hỏi: "${questionText}"
        - Đáp án tham chiếu: "${correctAnswer}"
        - Câu trả lời ứng viên: "${candidateAnswer}"
        - Điểm tối đa: ${maxScore}
        
        Nhiệm vụ của bạn:
        1. So sánh xem câu trả lời ứng viên có bao nhiêu % nội dung đúng với đáp án tham chiếu.
        2. Không đánh giá phong cách viết, độ dài câu, hoặc từ đồng nghĩa.
        3. Không được mở rộng hoặc bổ sung kiến thức không có trong đáp án tham chiếu.
        
        Trả về JSON theo định dạng:
        {
          "score": <điểm từ 0 đến ${maxScore} (có thể thập phân)>,
          "similarity": <độ tương đồng từ 0.00 đến 1.00>,
          "isCorrect": <true nếu ý chính khớp phần lớn, false nếu sai nhiều>,
          "comment": "<nhận xét ngắn gọn dựa trên so sánh với đáp án tham chiếu (tối đa 100 ký tự)>",
          "confidence": <mức tin cậy của mô hình từ 0.00 đến 1.00>
        }
        
        ⚠ Yêu cầu bắt buộc:
        - Không giải thích thêm nội dung
        - Không đưa ý kiến riêng
        - Chỉ trả về JSON thuần, không có văn bản khác
        `;
        
        // Try each model until one works
        let lastError = null;
        for (const modelName of modelsToTry) {
            try {
                console.log(`🔄 Trying Gemini model: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });

                const result = await model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();

                console.log(`✅ Successfully used model: ${modelName}`);

                // Parse JSON response
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const gradingResult = JSON.parse(jsonMatch[0]);

                    // Validate and normalize
                    let score = Math.max(0, Math.min(maxScore, parseFloat(gradingResult.score) || 0));
                    const similarity = Math.max(0, Math.min(1, parseFloat(gradingResult.similarity) || 0));
                    const confidence = Math.max(0, Math.min(1, parseFloat(gradingResult.confidence) || 0.8));

                    // Round score to nearest 0.5 (e.g., 7.3 -> 7.5, 7.7 -> 8.0)
                    score = roundToHalf(score);
                    
                    // Get similarity status
                    const status = getSimilarityStatus(similarity);

                    return {
                        score: score,
                        similarity_ai: similarity,
                        comment: gradingResult.comment || '',
                        isCorrect: gradingResult.isCorrect || false,
                        confidence: confidence,
                        similarityStatus: status
                    };
                }

                // If we get here, JSON parsing failed but API call succeeded
                throw new Error('Invalid JSON response from Gemini');

            } catch (error) {
                console.warn(`⚠️ Model ${modelName} failed:`, error.message);
                lastError = error;

                // If it's a 404 (model not found), try next model
                if (error.status === 404 || error.message?.includes('not found') || error.message?.includes('404')) {
                    continue; // Try next model
                }

                // If it's a 429 (rate limit/quota exceeded), try next model
                // Different models may have different rate limits
                if (error.status === 429 || error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('rate limit')) {
                    console.warn(`⚠️ Model ${modelName} rate limited, trying next model...`);
                    continue; // Try next model
                }

                // If it's auth error (401, 403), don't try other models
                if (error.status === 401 || error.status === 403) {
                    throw error;
                }

                // For other errors, try next model (might be temporary issue)
                console.warn(`⚠️ Model ${modelName} error (${error.status}), trying next model...`);
                continue;
            }
        }

        // All models failed
        throw lastError || new Error('All Gemini models failed');

    } catch (error) {
        console.error('❌ Error calling Gemini API:', error.message);
        console.error('   Status:', error.status);
        console.error('   StatusText:', error.statusText);

        // Determine error message
        let errorMessage = 'Lỗi khi gọi Gemini API';
        if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('rate limit')) {
            errorMessage = 'Gemini API đã vượt quá giới hạn (rate limit), sử dụng NLP';
        } else if (error.status === 401 || error.status === 403) {
            errorMessage = 'GEMINI_API_KEY không hợp lệ hoặc không có quyền';
        } else if (error.status === 404) {
            errorMessage = 'Model Gemini không tìm thấy';
        }

        // Fallback to NLP only if AI completely fails
        // This should rarely happen as we try multiple models
        console.warn('⚠️ All AI models failed, using NLP fallback');
        const similarity = calculateSimilarityNLP(candidateAnswer, correctAnswer);
        let score = similarity * maxScore;
        score = roundToHalf(score); // Round to nearest 0.5
        const status = getSimilarityStatus(similarity);
        
        return {
            score: score,
            similarity_ai: similarity,
            comment: `${errorMessage}. Sử dụng NLP fallback (độ tương đồng: ${(similarity * 100).toFixed(0)}%). HR vui lòng xem lại và chấm thủ công.`,
            confidence: similarity * 0.6, // Lower confidence for fallback
            isCorrect: similarity >= 0.7,
            similarityStatus: status
        };
    }
};

/**
 * Grade a single answer using Hybrid approach (AI only)
 * AI chấm điểm → HR xem và điều chỉnh
 */
const gradeAnswer = async (candidateAnswer, correctAnswer, maxScore, questionType, questionText = '') => {
    if (!candidateAnswer || candidateAnswer.trim() === '') {
        return {
            score: 0,
            similarity_nlp: 0,
            similarity_ai: 0,
            isCorrect: false,
            confidence: 1.0,
            comment: 'Không có câu trả lời',
            method: 'ai'
        };
    }

    // For multiple choice - exact match required (no need for AI)
    if (questionType === 'tracnghiem') {
        const isExact = candidateAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
        const similarity = isExact ? 1.0 : 0;
        const status = getSimilarityStatus(similarity);
        
        return {
            score: isExact ? maxScore : 0,
            similarity_nlp: 0, // Không dùng NLP
            similarity_ai: similarity,
            isCorrect: isExact,
            confidence: 1.0,
            comment: isExact ? 'Đáp án chính xác' : 'Đáp án sai',
            method: 'exact', // Exact match, không cần AI
            similarityStatus: status
        };
    }

    // For essay questions - ALWAYS use AI (Hybrid = AI chấm, HR điều chỉnh)
    try {
        const aiResult = await gradeWithGemini(candidateAnswer, correctAnswer, maxScore, questionText);
        return {
            score: aiResult.score,
            similarity_nlp: 0, // Không dùng NLP
            similarity_ai: aiResult.similarity_ai,
            isCorrect: aiResult.isCorrect,
            confidence: aiResult.confidence,
            comment: aiResult.comment,
            method: 'ai',
            similarityStatus: aiResult.similarityStatus
        };
    } catch (error) {
        // Nếu AI hoàn toàn fail, fallback về NLP (nhưng đánh dấu là fallback)
        console.warn('⚠️ AI failed, using NLP fallback:', error.message);
        const nlpSimilarity = calculateSimilarityNLP(candidateAnswer, correctAnswer);
        let score = nlpSimilarity * maxScore;
        score = roundToHalf(score); // Round to nearest 0.5
        const status = getSimilarityStatus(nlpSimilarity);
        
        return {
            score: score,
            similarity_nlp: nlpSimilarity,
            similarity_ai: nlpSimilarity, // Dùng NLP value cho AI field
            isCorrect: nlpSimilarity >= 0.7,
            confidence: nlpSimilarity * 0.6, // Lower confidence vì là fallback
            comment: `AI không khả dụng, sử dụng NLP (độ tương đồng: ${(nlpSimilarity * 100).toFixed(0)}%)`,
            method: 'nlp-fallback', // Đánh dấu là fallback
            similarityStatus: status
        };
    }
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

            const gradingResult = await gradeAnswer(
                answer.Cautraloi,
                question.Dapan,
                question.Diem,
                question.Loaicauhoi,
                question.Cauhoi // Pass question text for Gemini context
            );

            // Determine method used
            // Hybrid = AI chấm, HR điều chỉnh (không dùng NLP)
            const method = gradingResult.method || 'ai';

            // Update answer with AI-suggested score
            await answer.update({
                Diemdatduoc: gradingResult.score,
                Dungkhong: gradingResult.isCorrect,
                Phuongphap: method,
                Dosattinhcua_nlp: gradingResult.similarity_nlp || 0,
                Dosattinhcua_ai: gradingResult.similarity_ai || 0,
                Nhanxet: gradingResult.comment || null
            });

            gradedAnswers.push({
                answerId: answer.id,
                questionId: question.id,
                suggestedScore: gradingResult.score,
                maxScore: question.Diem,
                similarity_nlp: gradingResult.similarity_nlp,
                similarity_ai: gradingResult.similarity_ai,
                isCorrect: gradingResult.isCorrect,
                confidence: gradingResult.confidence,
                method: method,
                comment: gradingResult.comment,
                similarityStatus: gradingResult.similarityStatus // Status indicator for HR
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

