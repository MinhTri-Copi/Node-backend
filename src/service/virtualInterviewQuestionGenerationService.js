const db = require('../models');
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
    console.warn('⚠️ GEMINI_API_KEY not set. Virtual interview features will not work.');
    console.warn('   Get free API key at: https://aistudio.google.com/app/apikey');
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

/**
 * Parse JSON from LLM response
 */
const parseJSONFromResponse = (responseText) => {
    if (!responseText) return null;
    let cleaned = responseText.trim();
    
    // Remove markdown code blocks
    cleaned = cleaned.replace(/```json\n?/gi, '');
    cleaned = cleaned.replace(/```\n?/g, '');
    
    // Try to find JSON object
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
            return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
        } catch (e) {
            // Try parsing the whole text
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
 * Map level to difficulty
 */
const mapLevelToDifficulty = (level) => {
    const mapping = {
        'intern': 'easy',
        'junior': 'medium',
        'middle': 'medium',
        'senior': 'hard'
    };
    return mapping[level] || 'medium';
};

/**
 * Map level to question type
 */
const mapLevelToQuestionType = (level) => {
    const mapping = {
        'intern': 'concept',
        'junior': 'application',
        'middle': 'optimization',
        'senior': 'design'
    };
    return mapping[level] || 'application';
};

/**
 * Build prompt for question generation based on level and language
 */
const buildPromptForLanguage = (level, topic, language) => {
    const prompts = {
        'vi': {
            'intern': `Hãy tạo một câu hỏi phỏng vấn cơ bản cho trình độ INTERN về chủ đề ${topic}. Tập trung vào: khái niệm cơ bản, cú pháp, định nghĩa. Độ khó: dễ đến trung bình. Câu hỏi nên kiểm tra kiến thức nền tảng. Tạo một câu hỏi phỏng vấn CÓ CẤU TRÚC, KHÔNG PHẢI hội thoại. Trả lời BẰNG TIẾNG VIỆT. Chỉ trả về JSON: {"question": "câu hỏi", "expectedAnswer": "đáp án mẫu ngắn gọn"}`,
            'junior': `Hãy tạo một câu hỏi phỏng vấn thực tế cho trình độ JUNIOR về chủ đề ${topic}. Tập trung vào: ứng dụng thực tế, use case đơn giản, triển khai cơ bản. Độ khó: trung bình. Câu hỏi nên kiểm tra kỹ năng thực hành. Tạo một câu hỏi phỏng vấn CÓ CẤU TRÚC, KHÔNG PHẢI hội thoại. Trả lời BẰNG TIẾNG VIỆT. Chỉ trả về JSON: {"question": "câu hỏi", "expectedAnswer": "đáp án mẫu ngắn gọn"}`,
            'middle': `Hãy tạo một câu hỏi phỏng vấn nâng cao cho trình độ MIDDLE về chủ đề ${topic}. Tập trung vào: tối ưu hóa, xử lý edge case, best practice, hiệu suất. Độ khó: trung bình đến khó. Câu hỏi nên kiểm tra kỹ năng giải quyết vấn đề và tối ưu hóa. Tạo một câu hỏi phỏng vấn CÓ CẤU TRÚC, KHÔNG PHẢI hội thoại. Trả lời BẰNG TIẾNG VIỆT. Chỉ trả về JSON: {"question": "câu hỏi", "expectedAnswer": "đáp án mẫu ngắn gọn"}`,
            'senior': `Hãy tạo một câu hỏi phỏng vấn về thiết kế hệ thống/kiến trúc cho trình độ SENIOR về chủ đề ${topic}. Tập trung vào: thiết kế hệ thống, trade-off, ra quyết định, khả năng mở rộng. Độ khó: khó. Câu hỏi nên kiểm tra tư duy kiến trúc và khả năng ra quyết định. Tạo một câu hỏi phỏng vấn CÓ CẤU TRÚC, KHÔNG PHẢI hội thoại. Trả lời BẰNG TIẾNG VIỆT. Chỉ trả về JSON: {"question": "câu hỏi", "expectedAnswer": "đáp án mẫu ngắn gọn"}`
        },
        'en': {
            'intern': `Generate a basic interview question for INTERN level about ${topic}. Focus on: basic concepts, syntax, definitions. Difficulty: easy to medium. The question should test fundamental knowledge. Generate a STRUCTURED interview question, NOT a conversation. Respond in ENGLISH. Return only JSON: {"question": "question text", "expectedAnswer": "sample answer"}`,
            'junior': `Generate a practical interview question for JUNIOR level about ${topic}. Focus on: real-world application, simple use cases, basic implementation. Difficulty: medium. The question should test practical skills. Generate a STRUCTURED interview question, NOT a conversation. Respond in ENGLISH. Return only JSON: {"question": "question text", "expectedAnswer": "sample answer"}`,
            'middle': `Generate an advanced interview question for MIDDLE level about ${topic}. Focus on: optimization, edge cases, best practices, performance. Difficulty: medium to hard. The question should test problem-solving and optimization skills. Generate a STRUCTURED interview question, NOT a conversation. Respond in ENGLISH. Return only JSON: {"question": "question text", "expectedAnswer": "sample answer"}`,
            'senior': `Generate a system design/architecture interview question for SENIOR level about ${topic}. Focus on: system design, trade-offs, decision making, scalability. Difficulty: hard. The question should test architectural thinking and decision-making. Generate a STRUCTURED interview question, NOT a conversation. Respond in ENGLISH. Return only JSON: {"question": "question text", "expectedAnswer": "sample answer"}`
        }
    };

    return prompts[language]?.[level] || prompts['vi'][level];
};

/**
 * Extract retry delay from Gemini API error (429 Too Many Requests)
 */
const extractRetryDelay = (error) => {
    try {
        // Gemini API error có structure: errorDetails[].retryDelay
        if (error.errorDetails && Array.isArray(error.errorDetails)) {
            for (const detail of error.errorDetails) {
                if (detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' && detail.retryDelay) {
                    // retryDelay có thể là string "54s" hoặc object với seconds
                    const delayStr = typeof detail.retryDelay === 'string' 
                        ? detail.retryDelay 
                        : detail.retryDelay.seconds || detail.retryDelay;
                    const seconds = parseInt(delayStr.replace(/[^\d]/g, '')) || 60;
                    return seconds * 1000; // Convert to milliseconds
                }
            }
        }
        // Fallback: parse từ error message
        const match = error.message?.match(/retry.*?(\d+)\s*s/i);
        if (match) {
            return parseInt(match[1]) * 1000;
        }
    } catch (e) {
        // Ignore parsing errors
    }
    return 60000; // Default: 60 seconds
};

/**
 * Check if error is quota exceeded (429)
 */
const isQuotaExceeded = (error) => {
    return error.status === 429 || 
           error.message?.includes('quota') || 
           error.message?.includes('429') ||
           error.message?.includes('Too Many Requests');
};

/**
 * Generate a single question for a topic with retry logic
 */
const generateQuestionForTopic = async (level, language, topic, retryCount = 0) => {
    const maxRetries = 2; // Chỉ retry 2 lần để tránh spam
    const maxRetryDelay = 300000; // Max 5 phút

    try {
        const prompt = buildPromptForLanguage(level, topic, language);

        if (!GEMINI_API_KEY || !genAI) {
            throw new Error('Gemini API key not configured');
        }

        const model = genAI.getGenerativeModel({ 
            model: GEMINI_MODEL,
            generationConfig: {
                maxOutputTokens: 200, // Limit output to save tokens
                temperature: 0.7
            }
        });
        const result_gemini = await model.generateContent(prompt);
        const response = await result_gemini.response;
        const responseText = response.text();
        const result = parseJSONFromResponse(responseText);

        if (!result || !result.question) {
            throw new Error('Invalid response from AI');
        }

        return {
            questionText: result.question,
            expectedAnswer: result.expectedAnswer || '',
            success: true
        };
    } catch (error) {
        // Check if quota exceeded - KHÔNG retry vì đây là daily limit, không phải rate limit tạm thời
        if (isQuotaExceeded(error)) {
            console.error('❌ Gemini API quota exceeded. Limit: 20 requests/day (free tier)');
            console.error('   💡 Solutions:');
            console.error('   1. Wait until tomorrow (quota resets daily)');
            console.error('   2. Upgrade to paid tier for higher quota');
            console.error('   3. Use LM Studio instead (configure LM_STUDIO_URL in .env)');
            // KHÔNG retry vì quota là daily limit, retry sẽ vẫn fail
        } else {
            // Chỉ retry cho các lỗi khác (network, timeout, etc.)
            if (retryCount < maxRetries) {
                const retryDelay = 2000 * Math.pow(2, retryCount); // 2s, 4s
                console.warn(`⚠️ Error generating question. Retrying in ${retryDelay / 1000}s... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return generateQuestionForTopic(level, language, topic, retryCount + 1);
            }
            console.error('Error generating question:', error.message || error);
        }

        return {
            questionText: null,
            expectedAnswer: null,
            success: false,
            error: isQuotaExceeded(error) 
                ? 'Gemini API quota exceeded (20 requests/day limit). Please try again tomorrow or upgrade to paid tier.'
                : error.message || 'Unknown error'
        };
    }
};

/**
 * Validate question
 */
const validateQuestion = (question, level, language) => {
    if (!question || !question.questionText) {
        return { valid: false, error: 'Câu hỏi không được để trống' };
    }

    // Check for chatbot-like patterns
    const chatbotPatterns = [
        /hãy hỏi lại/i,
        /bạn có muốn/i,
        /bạn muốn/i,
        /có thể hỏi/i,
        /would you like/i,
        /do you want/i,
        /can I ask/i
    ];

    for (const pattern of chatbotPatterns) {
        if (pattern.test(question.questionText)) {
            return { valid: false, error: 'Câu hỏi có dấu hiệu hội thoại, không phù hợp' };
        }
    }

    return { valid: true };
};

/**
 * Generate questions for interview
 */
const generateQuestionsForInterview = async (interviewId, questionCount = null) => {
    try {
        const interview = await db.VirtualInterview.findByPk(interviewId);
        
        if (!interview) {
            return {
                EM: 'Không tìm thấy phiên phỏng vấn ảo!',
                EC: 1,
                DT: null
            };
        }

        const { level, language, topics } = interview;
        const questionsPerTopic = questionCount || 5; // Default 5 questions per topic
        const difficulty = mapLevelToDifficulty(level);
        const questionType = mapLevelToQuestionType(level);

        const allQuestions = [];
        let questionOrder = 1;
        let quotaExceededCount = 0;
        let failedCount = 0;

        // Generate questions for each topic
        for (const topic of topics) {
            for (let i = 0; i < questionsPerTopic; i++) {
                const result = await generateQuestionForTopic(level, language, topic);
                
                if (result.success) {
                    const validation = validateQuestion(result, level, language);
                    
                    if (validation.valid) {
                        allQuestions.push({
                            virtualInterviewId: interviewId,
                            questionText: result.questionText,
                            topic: topic,
                            level: level,
                            language: language,
                            questionOrder: questionOrder++,
                            maxScore: 10,
                            difficulty: difficulty,
                            questionType: questionType,
                            metadata: {
                                expectedAnswer: result.expectedAnswer,
                                model: GEMINI_MODEL,
                                generatedAt: new Date().toISOString()
                            }
                        });
                    }
                } else {
                    failedCount++;
                    // Check if error is quota exceeded
                    if (result.error && result.error.includes('quota exceeded')) {
                        quotaExceededCount++;
                        // Nếu quota exceeded, dừng lại để tránh spam requests
                        if (quotaExceededCount >= 2) {
                            console.warn(`⚠️ Quota exceeded detected ${quotaExceededCount} times. Stopping generation to avoid further quota issues.`);
                            break;
                        }
                    }
                }
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000)); // Increased delay for free tier
            }
            
            // Nếu đã quota exceeded nhiều lần, dừng generate cho các topic còn lại
            if (quotaExceededCount >= 2) {
                break;
            }
        }

        // Thông báo kết quả
        if (quotaExceededCount > 0) {
            console.warn(`⚠️ ${quotaExceededCount} câu hỏi bị lỗi do quota exceeded (Gemini API free tier: 20 requests/day)`);
        }
        if (failedCount > 0 && quotaExceededCount === 0) {
            console.warn(`⚠️ ${failedCount} câu hỏi không thể generate`);
        }

        if (allQuestions.length === 0) {
            const errorMessage = quotaExceededCount > 0
                ? `Không thể sinh câu hỏi! Gemini API quota exceeded (20 requests/day limit). Vui lòng thử lại sau hoặc nâng cấp lên paid tier.`
                : 'Không thể sinh câu hỏi!';
            return {
                EM: errorMessage,
                EC: 2,
                DT: null
            };
        }

        // Bulk create questions
        const createdQuestions = await db.VirtualInterviewQuestion.bulkCreate(allQuestions);

        // Update interview
        interview.totalQuestions = createdQuestions.length;
        interview.status = 'in_progress';
        interview.startedAt = new Date();
        await interview.save();

        // Build success message với warning nếu có
        let successMessage = `Sinh ${createdQuestions.length} câu hỏi thành công!`;
        if (quotaExceededCount > 0) {
            successMessage += ` (${quotaExceededCount} câu bị lỗi do quota exceeded - Gemini API free tier: 20 requests/day)`;
        } else if (failedCount > 0) {
            successMessage += ` (${failedCount} câu không thể generate)`;
        }

        return {
            EM: successMessage,
            EC: 0,
            DT: createdQuestions
        };
    } catch (error) {
        console.error('Error in generateQuestionsForInterview:', error);
        return {
            EM: 'Có lỗi xảy ra khi sinh câu hỏi!',
            EC: -1,
            DT: null
        };
    }
};

module.exports = {
    generateQuestionsForInterview,
    generateQuestionForTopic,
    validateQuestion,
    mapLevelToDifficulty,
    mapLevelToQuestionType,
    buildPromptForLanguage
};

