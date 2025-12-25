const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../models');
require('dotenv').config();

// Google Gemini configuration (FREE TIER)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash'; // Free tier model

if (!GEMINI_API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY not set. Voice interview features will not work.');
    console.warn('   Get free API key at: https://aistudio.google.com/app/apikey');
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

/**
 * Build system prompt for HR interviewer role
 */
const buildSystemPrompt = (level, topics, language) => {
    const levelDescriptions = {
        'vi': {
            'intern': 'Thực tập sinh - kiến thức cơ bản, khái niệm',
            'junior': 'Nhân viên - ứng dụng thực tế, use case đơn giản',
            'middle': 'Chuyên viên - tối ưu, xử lý edge case, best practice',
            'senior': 'Chuyên gia - thiết kế hệ thống, trade-off, decision making'
        },
        'en': {
            'intern': 'Intern - basic knowledge, concepts',
            'junior': 'Junior - practical application, simple use cases',
            'middle': 'Middle - optimization, edge cases, best practices',
            'senior': 'Senior - system design, trade-offs, decision making'
        }
    };

    const levelDesc = levelDescriptions[language]?.[level] || levelDescriptions['vi'][level];
    const topicsList = Array.isArray(topics) ? topics.join(', ') : topics;

    if (language === 'vi') {
        return `Bạn là một HR chuyên nghiệp đang phỏng vấn ứng viên IT. 
Ứng viên này ở trình độ: ${levelDesc}
Chủ đề phỏng vấn: ${topicsList}

Nhiệm vụ của bạn:
1. Hỏi câu hỏi phù hợp với trình độ và chủ đề
2. Lắng nghe câu trả lời và đánh giá
3. Có thể hỏi follow-up questions để làm rõ
4. Giữ thái độ chuyên nghiệp, thân thiện
5. Kết thúc phỏng vấn sau khi đã đủ thông tin

Quy tắc:
- Mỗi lần chỉ hỏi 1 câu hỏi
- Đợi ứng viên trả lời xong mới hỏi tiếp
- Không tự trả lời thay ứng viên
- Trả lời bằng TIẾNG VIỆT`;
    } else {
        return `You are a professional HR interviewer conducting an IT interview.
The candidate is at level: ${levelDesc}
Interview topics: ${topicsList}

Your tasks:
1. Ask appropriate questions for the level and topics
2. Listen to answers and evaluate
3. Can ask follow-up questions for clarification
4. Maintain professional, friendly attitude
5. End interview after gathering sufficient information

Rules:
- Ask only 1 question at a time
- Wait for candidate's answer before asking next
- Don't answer for the candidate
- Respond in ENGLISH`;
    }
};

/**
 * Start a voice conversation session
 */
const startConversation = async (interviewId, userId) => {
    try {
        const interview = await db.VirtualInterview.findByPk(interviewId, {
            where: { userId }
        });

        if (!interview) {
            return {
                EM: 'Interview not found',
                EC: 1,
                DT: null
            };
        }

        // Initialize conversation with system prompt
        const systemPrompt = buildSystemPrompt(
            interview.level,
            interview.topics,
            interview.language
        );

        // Generate first question
        const firstQuestion = await generateFirstQuestion(interview.level, interview.topics, interview.language);

        // Save conversation start
        await db.VirtualInterviewConversation.create({
            virtualInterviewId: interviewId,
            role: 'assistant',
            content: firstQuestion,
            messageOrder: 1
        });

        return {
            EM: 'Conversation started',
            EC: 0,
            DT: {
                interviewId,
                firstQuestion,
                systemPrompt
            }
        };
    } catch (error) {
        console.error('Error starting conversation:', error);
        return {
            EM: 'Error starting conversation',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Generate first question using Gemini
 */
const generateFirstQuestion = async (level, topics, language) => {
    try {
        if (!genAI) {
            throw new Error('Gemini API key not configured');
        }

        const topicsList = Array.isArray(topics) ? topics.join(', ') : topics;
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        
        const prompt = language === 'vi'
            ? `Bạn là HR chuyên nghiệp đang phỏng vấn ứng viên IT trình độ ${level} về chủ đề ${topicsList}. Hãy đưa ra câu hỏi đầu tiên phù hợp, thân thiện và chuyên nghiệp. Chỉ trả về câu hỏi, không có text khác.`
            : `You are a professional HR interviewing an IT candidate at ${level} level about ${topicsList}. Provide the first appropriate, friendly and professional question. Return only the question, no other text.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return text.trim();
    } catch (error) {
        console.error('Error generating first question:', error);
        return language === 'vi' 
            ? 'Xin chào! Hãy giới thiệu về bản thân và kinh nghiệm của bạn.'
            : 'Hello! Please introduce yourself and your experience.';
    }
};

/**
 * Process candidate's voice response and get AI response using Gemini
 */
const processVoiceResponse = async (interviewId, candidateText, conversationHistory = []) => {
    try {
        if (!genAI) {
            throw new Error('Gemini API key not configured');
        }

        const interview = await db.VirtualInterview.findByPk(interviewId);
        if (!interview) {
            throw new Error('Interview not found');
        }

        // Save candidate's response
        const candidateMessage = await db.VirtualInterviewConversation.create({
            virtualInterviewId: interviewId,
            role: 'user',
            content: candidateText,
            messageOrder: conversationHistory.length + 1
        });

        // Build conversation context for Gemini
        const systemPrompt = buildSystemPrompt(interview.level, interview.topics, interview.language);
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

        // Build conversation history string
        let conversationText = systemPrompt + '\n\n';
        conversationText += 'Conversation history:\n';
        conversationHistory.forEach(msg => {
            const role = msg.role === 'user' ? 'Candidate' : 'HR';
            conversationText += `${role}: ${msg.content}\n`;
        });
        conversationText += `\nCandidate: ${candidateText}\nHR:`;

        // Get AI response
        const result = await model.generateContent(conversationText);
        const response = await result.response;
        const aiResponse = response.text().trim();

        // Save AI response
        const aiMessage = await db.VirtualInterviewConversation.create({
            virtualInterviewId: interviewId,
            role: 'assistant',
            content: aiResponse,
            messageOrder: conversationHistory.length + 2
        });

        return {
            EM: 'Response processed',
            EC: 0,
            DT: {
                candidateMessage: candidateMessage.content,
                aiResponse: aiResponse,
                conversationId: aiMessage.id
            }
        };
    } catch (error) {
        console.error('Error processing voice response:', error);
        return {
            EM: 'Error processing response',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Convert text to speech
 * NOTE: For free tier, we use browser SpeechSynthesis API on frontend
 * This function is kept for backward compatibility but returns null
 * Frontend should use browser SpeechSynthesis instead
 */
const textToSpeech = async (text, language = 'vi') => {
    // For free tier, use browser SpeechSynthesis on frontend
    // This function is kept for compatibility but doesn't call any paid API
    return null;
};

/**
 * Convert speech to text
 * NOTE: For free tier, we use Web Speech API on frontend
 * This function is kept for backward compatibility but should not be used
 * Frontend should use Web Speech API directly
 */
const speechToText = async (audioBuffer, language = 'vi') => {
    // For free tier, use Web Speech API on frontend
    // This function is kept for compatibility but doesn't call any paid API
    throw new Error('Speech-to-text should be handled on frontend using Web Speech API (free)');
};

/**
 * Get conversation history
 */
const getConversationHistory = async (interviewId) => {
    try {
        const messages = await db.VirtualInterviewConversation.findAll({
            where: { virtualInterviewId: interviewId },
            order: [['messageOrder', 'ASC']],
            attributes: ['id', 'role', 'content', 'messageOrder', 'createdAt']
        });

        return {
            EM: 'History retrieved',
            EC: 0,
            DT: messages
        };
    } catch (error) {
        console.error('Error getting conversation history:', error);
        return {
            EM: 'Error getting history',
            EC: -1,
            DT: null
        };
    }
};

module.exports = {
    startConversation,
    processVoiceResponse,
    textToSpeech,
    speechToText,
    getConversationHistory,
    buildSystemPrompt
};

