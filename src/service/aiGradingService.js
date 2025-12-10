import db from '../models/index';
import natural from 'natural';
import { OpenAI } from 'openai';
import { gradeWithFastModel, checkFastGradingHealth } from './fastGradingClient';
require('dotenv').config();

// Polyfill fetch and FormData for Node.js < 18
if (typeof fetch === 'undefined' || typeof FormData === 'undefined') {
    try {
        // Try @whatwg-node/fetch first (better compatibility)
        const { fetch: whatwgFetch, FormData: WhatwgFormData, Headers: WhatwgHeaders, Request: WhatwgRequest, Response: WhatwgResponse } = require('@whatwg-node/fetch');
        global.fetch = whatwgFetch;
        global.FormData = WhatwgFormData;
        global.Headers = WhatwgHeaders;
        global.Request = WhatwgRequest;
        global.Response = WhatwgResponse;
        console.log('✅ Using @whatwg-node/fetch polyfill for fetch and FormData API');
    } catch (whatwgError) {
        // Fallback to node-fetch + form-data
        try {
            const nodeFetch = require('node-fetch');
            global.fetch = nodeFetch;
            global.Headers = nodeFetch.Headers;
            global.Request = nodeFetch.Request;
            global.Response = nodeFetch.Response;
            console.log('✅ Using node-fetch polyfill for fetch API');

            // Try to use FormData from @whatwg-node/fetch even if fetch failed
            try {
                const { FormData: WhatwgFormData } = require('@whatwg-node/fetch');
                global.FormData = WhatwgFormData;
                console.log('✅ Using @whatwg-node/fetch FormData polyfill');
            } catch (formDataError) {
                // Last resort: use form-data package
                const FormDataPolyfill = require('form-data');
                global.FormData = FormDataPolyfill;
                console.log('✅ Using form-data polyfill for FormData API');
            }
        } catch (error) {
            console.error('❌ Failed to load fetch/FormData polyfills.');
            console.error('   Please install: npm install @whatwg-node/fetch');
            console.error('   Or: npm install node-fetch@2 form-data');
            console.error('   Or upgrade Node.js to version 18+ which has built-in fetch and FormData');
        }
    }
}

/**
 * AI auto-grading service for test submissions
 * Hybrid approach: LLM chấm điểm → HR xem và điều chỉnh
 * Sử dụng LLM (LM Studio) để chấm điểm tự động
 */

// LM Studio configuration
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://127.0.0.1:1234';
// For 8GB RAM CPU: Use qwen2.5-1.5b-instruct (balanced) or qwen2.5-0.5b-instruct (fastest)
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL || 'qwen2.5-1.5b-instruct';

// Initialize OpenAI client for LM Studio
const openai = new OpenAI({
    baseURL: LM_STUDIO_URL + '/v1',
    apiKey: 'lm-studio',
    fetch: global.fetch,
});

// Optional flags
const ENABLE_LLM_RECHECK = process.env.ENABLE_LLM_RECHECK === 'true'; // chấm lại ca khó (0.4-0.6) bằng LLM
const ENABLE_LLM_COMMENT = process.env.ENABLE_LLM_COMMENT === 'true'; // sinh nhận xét bằng LLM

/**
 * Parse JSON from LLM response (handle reasoning tags, markdown, etc.)
 * Supports both JSON objects and arrays
 */
function parseJSONFromResponse(responseText) {
    if (!responseText) return null;

    let cleaned = responseText.trim();

    // Remove reasoning tags
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/redacted_reasoning>/gi, '');
    cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');

    // Remove markdown code blocks
    cleaned = cleaned.replace(/```json\n?/gi, '');
    cleaned = cleaned.replace(/```\n?/g, '');

    // Remove common prefixes
    cleaned = cleaned.replace(/^Here is the JSON[:\s]*/i, '');
    cleaned = cleaned.replace(/^JSON[:\s]*/i, '');
    cleaned = cleaned.replace(/^Response[:\s]*/i, '');

    // Try to find JSON array first (for batch responses)
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');

    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        let jsonString = cleaned.substring(firstBracket, lastBracket + 1);

        // Try to fix common JSON issues
        jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
        // Fix incomplete JSON (if response was cut off)
        jsonString = jsonString.replace(/,\s*$/, ''); // Remove trailing comma
        jsonString = jsonString.replace(/,\s*\]/, ']'); // Remove comma before closing bracket

        try {
            return JSON.parse(jsonString);
        } catch (e) {
            console.warn('⚠️ Failed to parse JSON array');
        }
    }

    // Try to find JSON object (for single responses)
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        let jsonString = cleaned.substring(firstBrace, lastBrace + 1);

        // Try to fix common JSON issues
        jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');

        try {
            return JSON.parse(jsonString);
        } catch (e) {
            // If parsing fails, try simple regex extraction for score and comment only
            const scoreMatch = jsonString.match(/"score"\s*:\s*([0-9.]+)/);
            const commentMatch = jsonString.match(/"comment"\s*:\s*"([^"]*)"/);

            if (scoreMatch) {
                return {
                    score: parseFloat(scoreMatch[1]) || 0,
                    comment: commentMatch ? commentMatch[1] : ''
                };
            }
        }
    }

    return null;
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
    // Đảm bảo similarity = 0 (score = 0) luôn hiển thị "Có vấn đề"
    if (similarity === 0) {
        return {
            level: 'problem',
            label: 'Có vấn đề',
            emoji: '🔴',
            color: 'red'
        };
    }
    
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
 * Build comment from score (PHA D - Bước D2)
 */
const buildCommentFromScore = (score, maxScore) => {
    const ratio = maxScore > 0 ? score / maxScore : 0;
    // Tạo chút đa dạng dựa trên điểm để tránh lặp lại một câu
    const pick = (arr) => arr[Math.max(0, Math.min(arr.length - 1, Math.floor((ratio * 10) % arr.length)))];

    if (ratio >= 0.9) {
        return pick([
            'Đúng ý hoàn toàn, đầy đủ và chính xác',
            'Bài làm tốt, nêu đủ ý trọng tâm',
            'Nội dung đầy đủ, diễn đạt rõ ràng'
        ]);
    } else if (ratio >= 0.7) {
        return pick([
            'Đúng ý chính, khá đầy đủ',
            'Bài làm đúng hướng, còn thiếu ít chi tiết',
            'Nội dung ổn, cần bổ sung thêm ví dụ/chi tiết'
        ]);
    } else if (ratio >= 0.5) {
        return pick([
            'Đúng ý nhưng thiếu một số chi tiết quan trọng',
            'Có hướng đúng, cần làm rõ thêm nội dung',
            'Đã nêu ý chính nhưng còn sơ sài'
        ]);
    } else if (ratio >= 0.3) {
        return pick([
            'Có nhắc đến khái niệm nhưng còn mơ hồ, chưa rõ ràng',
            'Nội dung chưa rõ, thiếu liên kết với đáp án',
            'Cần làm rõ hơn, hiện vẫn chưa đủ ý'
        ]);
    } else {
        return pick([
            'Lạc đề hoặc trả lời sai ý chính',
            'Chưa đúng nội dung, cần xem lại đáp án',
            'Bài làm chưa liên quan đến câu hỏi'
        ]);
    }
};

/**
 * Generate comment using LLM (PHA D - Bước D4 - Optional)
 */
const generateCommentWithLLM = async (questionText, correctAnswer, studentAnswer, score, maxScore) => {
    try {
        const prompt = `Đây là câu hỏi: ${questionText}
Đáp án đúng: ${correctAnswer}
Câu trả lời của học sinh: ${studentAnswer}
Điểm chấm: ${score}/${maxScore}

Hãy viết 1 nhận xét ngắn (1-2 câu) bằng tiếng Việt, vừa khen vừa góp ý.`;

        const response = await openai.chat.completions.create({
            model: LM_STUDIO_MODEL,
            messages: [
                {
                    role: 'system',
                    content: 'Bạn là giáo viên chấm bài. Viết nhận xét ngắn gọn, tích cực và có tính xây dựng.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 100
        });

        const comment = response.choices[0]?.message?.content || '';
        return comment.trim() || buildCommentFromScore(score, maxScore);

    } catch (error) {
        console.warn('⚠️ Lỗi khi LLM sinh nhận xét, dùng comment mặc định:', error.message);
        return buildCommentFromScore(score, maxScore);
    }
};

// Normalize text for prompt: remove HTML, collapse spaces, trim length
const normalizeForPrompt = (text, maxLen = 35) => {
    if (!text) return '';
    return text
        .replace(/<[^>]*>/g, ' ')   // strip HTML tags
        .replace(/\s+/g, ' ')       // collapse whitespace
        .trim()
        .substring(0, maxLen);
};

/**
 * Grade a single answer using LLM (LM Studio) - OLD METHOD (kept for backward compatibility)
 * More accurate but slower (1-3s per question)
 */
const gradeWithLLM = async (candidateAnswer, correctAnswer, maxScore, questionText) => {
    try {
        // Optimize prompt for LLM (concise, clear JSON format)
        const prompt = `Chấm bài tự luận. So sánh đáp án mẫu và câu trả lời.

Đáp án: "${normalizeForPrompt(correctAnswer, 50)}"
Trả lời: "${normalizeForPrompt(candidateAnswer, 50)}"
Max: ${maxScore}

JSON: {"score":0-${maxScore},"comment":"10-20 từ"}`;

        const response = await openai.chat.completions.create({
            model: LM_STUDIO_MODEL,
            messages: [
                {
                    role: 'system',
                    content: 'Chấm bài theo rubric: đúng nội dung, đầy đủ ý, rõ ràng. Trả về JSON: {"score":n,"comment":""}'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
                    temperature: 0,
                    top_p: 0.05, // TỐI ƯU: Giảm để model sinh token nhanh hơn
                    max_tokens: 150,
            frequency_penalty: 0,
            presence_penalty: 0
        });

        const responseText = response.choices[0]?.message?.content || '';
        const gradingResult = parseJSONFromResponse(responseText);

        if (!gradingResult) {
            throw new Error('Không thể parse JSON từ LLM response');
        }

        // Validate and normalize
        let score = Math.max(0, Math.min(maxScore, parseFloat(gradingResult.score) || 0));
        score = roundToHalf(score);
        const similarity = maxScore > 0 ? Math.max(0, Math.min(1, score / maxScore)) : 0;
        const status = getSimilarityStatus(similarity);

        return {
            score: score,
            similarity_ai: similarity,
            comment: (gradingResult.comment || '').substring(0, 200),
            isCorrect: similarity >= 0.7,
            confidence: Math.min(0.95, similarity + 0.1),
            similarityStatus: status
        };

    } catch (error) {
        console.error('❌ Error calling LLM for grading:', error.message);
        const similarity = calculateSimilarityNLP(candidateAnswer, correctAnswer);
        let score = similarity * maxScore;
        score = roundToHalf(score);
        const status = getSimilarityStatus(similarity);

        return {
            score: score,
            similarity_ai: similarity,
            comment: `LLM không khả dụng, sử dụng NLP (${(similarity * 100).toFixed(0)}%)`,
            confidence: similarity * 0.6,
            isCorrect: similarity >= 0.7,
            similarityStatus: status
        };
    }
};

/**
 * Grade multiple answers in a single batch using LLM (OPTIMIZED - 10-20x faster)
 * This is MUCH faster than grading one by one
 */
const gradeAnswersBatch = async (gradingItems) => {
    try {
        if (!gradingItems || gradingItems.length === 0) {
            return [];
        }

        // Filter out multiple choice questions (they don't need LLM)
        const essayItems = gradingItems.filter(item => item.questionType === 'tuluan');
        const multipleChoiceItems = gradingItems.filter(item => item.questionType === 'tracnghiem');

        // Handle multiple choice immediately (exact match, no LLM needed)
        const multipleChoiceResults = multipleChoiceItems.map(item => {
            const isExact = item.candidateAnswer.trim().toLowerCase() === item.correctAnswer.trim().toLowerCase();
            const similarity = isExact ? 1.0 : 0;
            return {
                index: item.index,
                score: isExact ? item.maxScore : 0,
                similarity_ai: similarity,
                isCorrect: isExact,
                confidence: 1.0,
                comment: isExact ? 'Đáp án chính xác' : 'Đáp án sai',
                similarityStatus: getSimilarityStatus(similarity)
            };
        });

        if (essayItems.length === 0) {
            return multipleChoiceResults;
        }

        // Bỏ NLP auto-chấm: đẩy toàn bộ essayItems sang ML; LLM chỉ fallback khi ML lỗi
        const essayResults = [];
        const itemsNeedingLLM = [...essayItems];
        console.log(`🧠 Đẩy ${itemsNeedingLLM.length}/${essayItems.length} câu tự luận sang ML (bỏ NLP filter)`);

        // PHA D - Bước D2: Dùng ML model thay vì LLM để chấm nhanh hơn
        if (itemsNeedingLLM.length > 0) {
            // Kiểm tra ML service có khả dụng không
            let useMLModel = await checkFastGradingHealth();
            let mlModelSuccess = false;
            
            if (useMLModel) {
                // Dùng ML model (nhanh hơn)
                console.log(`🚀 Đang chấm ${itemsNeedingLLM.length} câu bằng ML model...`);
                const mlStartTime = Date.now();
                
                // Chuẩn bị items gửi sang Python
                const items = itemsNeedingLLM.map((item) => ({
                    correctAnswer: item.correctAnswer || '',
                    studentAnswer: item.candidateAnswer || '',
                    maxScore: item.maxScore || 10,
                }));
                
                try {
                    const fastResults = await gradeWithFastModel(items);
                    const mlTime = Date.now() - mlStartTime;
                    console.log(`✅ ML model chấm ${itemsNeedingLLM.length} câu trong ${mlTime}ms (${(mlTime / 1000).toFixed(2)}s)`);
                    
                    // Validate kết quả
                    if (fastResults && fastResults.length === itemsNeedingLLM.length) {
                        // Gán lại điểm cho từng câu (có thể re-check bằng LLM cho ca khó)
                        for (let idx = 0; idx < fastResults.length; idx++) {
                            const res = fastResults[idx];
                            const item = itemsNeedingLLM[idx];
                            let score = res.score;
                            let similarity = item.maxScore > 0 ? Math.max(0, Math.min(1, score / item.maxScore)) : 0;
                            let confidence = res.ratio || similarity;
                            let comment = buildCommentFromScore(score, item.maxScore);

                            // Re-check bằng LLM cho ca lưng chừng
                            if (ENABLE_LLM_RECHECK && item.questionType === 'tuluan' && similarity >= 0.4 && similarity <= 0.6) {
                                try {
                                    const llmRes = await gradeWithLLM(item.candidateAnswer, item.correctAnswer, item.maxScore, item.questionText);
                                    score = llmRes.score;
                                    similarity = item.maxScore > 0 ? Math.max(0, Math.min(1, score / item.maxScore)) : 0;
                                    confidence = Math.max(confidence, similarity);
                                    comment = llmRes.comment || comment;
                                } catch (err) {
                                    console.warn(`⚠️ Lỗi LLM re-check câu ${idx + 1}:`, err.message);
                                }
                            }

                            // Sinh nhận xét bằng LLM (optional)
                            if (ENABLE_LLM_COMMENT && item.questionType === 'tuluan') {
                                try {
                                    const cmt = await generateCommentWithLLM(item.questionText, item.correctAnswer, item.candidateAnswer, score, item.maxScore);
                                    comment = cmt || comment;
                                } catch (err) {
                                    console.warn(`⚠️ Lỗi LLM comment câu ${idx + 1}:`, err.message);
                                }
                            }

                            const status = getSimilarityStatus(similarity);
                            const isCorrect = similarity >= 0.7;
                            
                            essayResults.push({
                                index: item.index,
                                score,
                                similarity_ai: similarity,
                                isCorrect,
                                confidence,
                                comment,
                                similarityStatus: status
                            });
                        }
                        mlModelSuccess = true;
                    } else {
                        throw new Error(`ML model trả về ${fastResults?.length || 0} kết quả, cần ${itemsNeedingLLM.length}`);
                    }
                } catch (error) {
                    console.error('❌ Lỗi khi gọi ML model, fallback về LLM:', error.message);
                    mlModelSuccess = false;
                }
            }
            
            // Fallback về LLM nếu ML model không khả dụng hoặc lỗi
            if (!mlModelSuccess) {
                console.log(`🔄 Fallback về LLM để chấm ${itemsNeedingLLM.length} câu...`);
                const optimalBatchSize = itemsNeedingLLM.length <= 30 ? itemsNeedingLLM.length : 30;
            const batches = [];
            for (let i = 0; i < itemsNeedingLLM.length; i += optimalBatchSize) {
                batches.push(itemsNeedingLLM.slice(i, i + optimalBatchSize));
            }

            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batch = batches[batchIndex];

                // TỐI ƯU: Input 28 ký tự (vừa đủ để hiểu, không quá dài)
                const prompt = `Chấm ${batch.length} câu theo Ý NGHĨA. Đúng ý: 80-100%. JSON array ĐÚNG ${batch.length} phần tử:
[{"score":0-max},...]

${batch.map((item, i) => `${i + 1}|"${normalizeForPrompt(item.correctAnswer, 28)}"|"${normalizeForPrompt(item.candidateAnswer, 28)}"|${item.maxScore}`).join('\n')}`;

                const llmStartTime = Date.now();
                const response = await openai.chat.completions.create({
                    model: LM_STUDIO_MODEL,
                    messages: [
                        {
                            role: 'system',
                            content: `Chấm theo Ý NGHĨA. Đúng ý (dù khác chữ): 80-100%. Trả JSON array ĐÚNG ${batch.length} phần tử: [{"score":0-max},...]`
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0,
                    top_p: 0.05, // TỐI ƯU: Giảm từ 0.1 → 0.05 để model bớt do dự, sinh token nhanh hơn
                    max_tokens: 80, // TỐI ƯU TỐI ĐA: Giảm từ 100 → 80 (chỉ cần score, không cần comment)
                    frequency_penalty: 0,
                    presence_penalty: 0
                });
                const llmTime = Date.now() - llmStartTime;
                console.log(`⏱️ LLM batch ${batchIndex + 1}/${batches.length}: ${batch.length} câu - ${(llmTime / 1000).toFixed(1)}s`);

                const responseText = response.choices[0]?.message?.content || '';
                if (process.env.DEBUG_GRADING) {
                    console.log(`📝 LLM response (${responseText.length} chars): ${responseText.substring(0, 200)}`);
                }

                let gradingResults = parseJSONFromResponse(responseText);
                if (!Array.isArray(gradingResults)) {
                    if (gradingResults && typeof gradingResults === 'object') {
                        gradingResults = [gradingResults];
                    } else {
                        throw new Error('LLM không trả về array hợp lệ');
                    }
                }
                if (gradingResults.length !== batch.length) {
                    while (gradingResults.length < batch.length) gradingResults.push({ score: 0 });
                    gradingResults.splice(batch.length);
                }

                gradingResults.forEach((res, idx) => {
                    const item = batch[idx];
                    let score = parseFloat(res.score);
                    
                    // 1️⃣ Nếu LLM trả về lỗi → mới fallback NLP
                    if (isNaN(score) || score < 0 || score > item.maxScore) {
                        const simNLP = calculateSimilarityNLP(item.candidateAnswer, item.correctAnswer);
                        score = simNLP * item.maxScore;
                    }
                    
                    // 2️⃣ SÀN ĐIỂM: Chỉ ép khi câu trả lời thực sự có ý nghĩa (không phải random text)
                    const semanticNLP = calculateSimilarityNLP(item.candidateAnswer, item.correctAnswer);
                    const candidateLen = (item.candidateAnswer || '').trim().length;
                    const correctLen = (item.correctAnswer || '').trim().length;
                    
                    // Chỉ ép sàn nếu:
                    // - NLP similarity >= 0.3 (giảm từ 0.4 để bắt được nhiều câu đồng nghĩa hơn)
                    // - Câu trả lời >= 10 ký tự (không phải random text ngắn)
                    // - Câu trả lời >= 20% độ dài đáp án (giảm từ 30% để linh hoạt hơn)
                    // - LLM chấm < 50%
                    // - HOẶC: Câu trả lời dài >= 20 ký tự và LLM chấm < 30% (có thể là đồng nghĩa nhưng NLP chưa bắt được)
                    if (score < item.maxScore * 0.5) {
                        if (semanticNLP >= 0.3 && 
                            candidateLen >= 10 && 
                            (correctLen === 0 || candidateLen >= correctLen * 0.2)) {
                            score = item.maxScore * 0.85; // ✅ ÉP 8.5 ĐIỂM
                        } else if (candidateLen >= 20 && score < item.maxScore * 0.3 && semanticNLP >= 0.2) {
                            // Câu dài nhưng LLM chấm rất thấp, có thể là đồng nghĩa
                            score = item.maxScore * 0.75; // ✅ ÉP 7.5 ĐIỂM
                        }
                    }
                    
                    score = roundToHalf(score);

                    const similarity = item.maxScore > 0 ? Math.max(0, Math.min(1, score / item.maxScore)) : 0;
                    const isCorrect = similarity >= 0.7;
                    const confidence = Math.min(0.95, similarity + 0.1);
                    const status = getSimilarityStatus(similarity);

                    // TỐI ƯU 1: Comment được generate bằng code (không từ LLM)
                    let comment = '';
                    if (similarity >= 0.9) comment = 'Đúng ý hoàn toàn, đầy đủ';
                    else if (similarity >= 0.7) comment = 'Đúng ý chính, còn thiếu chi tiết';
                    else if (similarity >= 0.5) comment = 'Đúng một phần ý, thiếu nội dung quan trọng';
                    else if (similarity >= 0.3) comment = 'Sai nhiều ý, chỉ đúng rất ít';
                    else comment = 'Không đúng ý hoặc không liên quan';

                    essayResults.push({
                        index: item.index,
                        score,
                        similarity_ai: similarity,
                        isCorrect,
                        confidence,
                        comment,
                        similarityStatus: status
                    });
                });
            }
            }
        }

        // Combine essay and multiple choice results, sort by original index
        const allResults = [...essayResults, ...multipleChoiceResults].sort((a, b) => a.index - b.index);

        console.log(`✅ Đã chấm ${allResults.length} câu hỏi trong batch`);

        return allResults;


    } catch (error) {
        console.error('❌ Error in gradeAnswersBatch:', error.message);
        // Fallback: grade individually using NLP
        console.warn('⚠️ Batch grading failed, using NLP fallback for all');
        return gradingItems.map((item, i) => {
            if (item.questionType === 'tracnghiem') {
                const isExact = item.candidateAnswer.trim().toLowerCase() === item.correctAnswer.trim().toLowerCase();
                return {
                    index: i,
                    score: isExact ? item.maxScore : 0,
                    similarity_ai: isExact ? 1.0 : 0,
                    isCorrect: isExact,
                    confidence: 1.0,
                    comment: isExact ? 'Đáp án chính xác' : 'Đáp án sai',
                    similarityStatus: getSimilarityStatus(isExact ? 1.0 : 0)
                };
            } else {
                const similarity = calculateSimilarityNLP(item.candidateAnswer, item.correctAnswer);
                let score = similarity * item.maxScore;
                score = roundToHalf(score);
                return {
                    index: i,
                    score: score,
                    similarity_ai: similarity,
                    isCorrect: similarity >= 0.7,
                    confidence: similarity * 0.6,
                    comment: `NLP fallback (${(similarity * 100).toFixed(0)}%)`,
                    similarityStatus: getSimilarityStatus(similarity)
                };
            }
        });
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
        const aiResult = await gradeWithLLM(candidateAnswer, correctAnswer, maxScore, questionText);
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

        // OPTIMIZATION: Prepare all answers for batch grading
        const gradingItems = submission.Answers.map((answer, index) => ({
            index: index,
            answerId: answer.id,
            questionId: answer.Question.id,
            questionText: answer.Question.Cauhoi || '',
            correctAnswer: answer.Question.Dapan || '',
            candidateAnswer: answer.Cautraloi || '',
            maxScore: answer.Question.Diem || 10,
            questionType: answer.Question.Loaicauhoi || 'tuluan'
        }));

        console.log(`⚡ Đang chấm ${gradingItems.length} câu hỏi bằng LLM (batch processing)...`);
        const startTime = Date.now();

        // Grade all answers in a single batch (MUCH faster)
        const batchResults = await gradeAnswersBatch(gradingItems);

        const gradingTime = Date.now() - startTime;
        console.log(`✅ Đã chấm ${batchResults.length} câu hỏi trong ${gradingTime}ms (${(gradingTime / 1000).toFixed(2)}s)`);

        // Map results back to answers and update database
        const gradedAnswers = [];
        for (let i = 0; i < submission.Answers.length; i++) {
            const answer = submission.Answers[i];
            const result = batchResults[i];

            if (!result) {
                console.warn(`⚠️ Không có kết quả cho câu hỏi ${i + 1}, sử dụng giá trị mặc định`);
                // Use NLP fallback for missing results
                const question = answer.Question;
                const similarity = calculateSimilarityNLP(answer.Cautraloi, question.Dapan);
                let score = similarity * question.Diem;
                score = roundToHalf(score);
                const status = getSimilarityStatus(similarity);

                await answer.update({
                    Diemdatduoc: score,
                    Dungkhong: similarity >= 0.7,
                    Phuongphap: 'nlp-fallback',
                    Dosattinhcua_nlp: similarity,
                    Dosattinhcua_ai: similarity,
                    Nhanxet: `NLP fallback (${(similarity * 100).toFixed(0)}%)`
                });

                gradedAnswers.push({
                    answerId: answer.id,
                    questionId: question.id,
                    suggestedScore: score,
                    maxScore: question.Diem,
                    similarity_nlp: similarity,
                    similarity_ai: similarity,
                    isCorrect: similarity >= 0.7,
                    confidence: similarity * 0.6,
                    method: 'nlp-fallback',
                    comment: `NLP fallback (${(similarity * 100).toFixed(0)}%)`,
                    similarityStatus: status
                });
            } else {
                // Determine method used
                const method = answer.Question.Loaicauhoi === 'tracnghiem' ? 'exact' : 'ai';

                // Update answer with AI-suggested score
                await answer.update({
                    Diemdatduoc: result.score,
                    Dungkhong: result.isCorrect,
                    Phuongphap: method,
                    Dosattinhcua_nlp: 0, // Không dùng NLP trong batch mode
                    Dosattinhcua_ai: result.similarity_ai,
                    Nhanxet: result.comment || null
                });

                gradedAnswers.push({
                    answerId: answer.id,
                    questionId: answer.Question.id,
                    suggestedScore: result.score,
                    maxScore: answer.Question.Diem,
                    similarity_nlp: 0,
                    similarity_ai: result.similarity_ai,
                    isCorrect: result.isCorrect,
                    confidence: result.confidence,
                    method: method,
                    comment: result.comment,
                    similarityStatus: result.similarityStatus
                });
            }
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

