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
 * Build system prompt for HR interviewer role (OPTIMIZED - MINIMAL TOKENS)
 */
const buildSystemPrompt = (level, topics, language) => {
    const levelMap = {
        'vi': { 'intern': 'Intern', 'junior': 'Junior', 'middle': 'Middle', 'senior': 'Senior' },
        'en': { 'intern': 'Intern', 'junior': 'Junior', 'middle': 'Middle', 'senior': 'Senior' }
    };
    const topicsList = Array.isArray(topics) ? topics.slice(0, 3).join(',') : topics; // Limit topics
    
    // Ultra-minimal prompt to save tokens
    if (language === 'vi') {
        return `HR phỏng vấn IT ${levelMap['vi'][level]}. Chủ đề: ${topicsList}. Hỏi 1 câu ngắn. Trả lời bằng TIẾNG VIỆT.`;
    } else {
        return `HR interviewing IT ${levelMap['en'][level]}. Topics: ${topicsList}. Ask 1 short question. Respond in ENGLISH.`;
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
 * Generate first question using Gemini (OPTIMIZED - MINIMAL TOKENS)
 */
const generateFirstQuestion = async (level, topics, language) => {
    try {
        if (!genAI) {
            throw new Error('Gemini API key not configured');
        }

        const topicsList = Array.isArray(topics) ? topics.slice(0, 2).join(',') : topics; // Limit to 2 topics
        const model = genAI.getGenerativeModel({ 
            model: GEMINI_MODEL,
            generationConfig: {
                maxOutputTokens: 50, // Limit output to save tokens
                temperature: 0.7
            }
        });
        
        // Ultra-minimal prompt
        const prompt = language === 'vi'
            ? `HR hỏi IT ${level} về ${topicsList}. Câu hỏi đầu tiên ngắn gọn. Chỉ trả câu hỏi.`
            : `HR asks IT ${level} about ${topicsList}. First short question. Return only question.`;

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
 * OPTIMIZED: Only send last 2-3 messages to save tokens
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

        // OPTIMIZATION: Only use last 2-3 messages to save tokens
        const recentHistory = conversationHistory.slice(-3); // Only last 3 messages
        
        // Build minimal prompt
        const systemPrompt = buildSystemPrompt(interview.level, interview.topics, interview.language);
        const model = genAI.getGenerativeModel({ 
            model: GEMINI_MODEL,
            generationConfig: {
                maxOutputTokens: 100, // Limit output tokens
                temperature: 0.7
            }
        });

        // Build minimal conversation context (only recent history)
        let prompt = systemPrompt;
        if (recentHistory.length > 0) {
            prompt += '\n\nRecent:\n';
            recentHistory.forEach(msg => {
                const role = msg.role === 'user' ? 'C' : 'HR';
                // Truncate long messages to save tokens
                const content = msg.content.length > 200 ? msg.content.substring(0, 200) + '...' : msg.content;
                prompt += `${role}: ${content}\n`;
            });
        }
        prompt += `\nC: ${candidateText.substring(0, 300)}\nHR:`; // Truncate candidate text if too long

        // Get AI response
        const result = await model.generateContent(prompt);
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

