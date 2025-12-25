const virtualInterviewVoiceService = require('../service/virtualInterviewVoiceService');
const db = require('../models');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Start voice conversation
 */
const startVoiceConversation = async (req, res) => {
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
                EM: 'Interview not found',
                EC: 1,
                DT: null
            });
        }

        const result = await virtualInterviewVoiceService.startConversation(interviewId, userId);

        return res.status(result.EC === 0 ? 200 : 400).json(result);
    } catch (error) {
        console.error('Error in startVoiceConversation:', error);
        return res.status(500).json({
            EM: 'Error starting conversation',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Process voice response (text input)
 */
const processVoiceResponse = async (req, res) => {
    try {
        const userId = req.user.id;
        const interviewId = parseInt(req.params.id);
        const { candidateText, conversationHistory } = req.body;

        if (!candidateText) {
            return res.status(400).json({
                EM: 'Candidate text is required',
                EC: 1,
                DT: null
            });
        }

        // Check ownership
        const interview = await db.VirtualInterview.findOne({
            where: {
                id: interviewId,
                userId: userId
            }
        });

        if (!interview) {
            return res.status(404).json({
                EM: 'Interview not found',
                EC: 2,
                DT: null
            });
        }

        const result = await virtualInterviewVoiceService.processVoiceResponse(
            interviewId,
            candidateText,
            conversationHistory || []
        );

        return res.status(result.EC === 0 ? 200 : 400).json(result);
    } catch (error) {
        console.error('Error in processVoiceResponse:', error);
        return res.status(500).json({
            EM: 'Error processing response',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Convert text to speech
 * NOTE: For free tier, frontend should use browser SpeechSynthesis API
 * This endpoint is kept for compatibility but returns instruction to use browser API
 */
const textToSpeech = async (req, res) => {
    try {
        const { text, language } = req.body;

        if (!text) {
            return res.status(400).json({
                EM: 'Text is required',
                EC: 1,
                DT: null
            });
        }

        // For free tier, return instruction to use browser SpeechSynthesis
        return res.status(200).json({
            EM: 'Use browser SpeechSynthesis API for free TTS',
            EC: 0,
            DT: {
                useBrowserTTS: true,
                text: text,
                language: language || 'vi'
            }
        });
    } catch (error) {
        console.error('Error in textToSpeech:', error);
        return res.status(500).json({
            EM: 'Error converting text to speech',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Convert speech to text (audio file upload)
 * NOTE: For free tier, frontend should use Web Speech API
 * This endpoint is kept for compatibility but returns instruction
 */
const speechToText = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                EM: 'Audio file is required',
                EC: 1,
                DT: null
            });
        }

        // For free tier, return instruction to use Web Speech API
        return res.status(200).json({
            EM: 'Use Web Speech API on frontend for free STT',
            EC: 0,
            DT: {
                useBrowserSTT: true,
                message: 'Please use Web Speech API (SpeechRecognition) on frontend for free speech-to-text'
            }
        });
    } catch (error) {
        console.error('Error in speechToText:', error);
        return res.status(500).json({
            EM: 'Error converting speech to text',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Get conversation history
 */
const getConversationHistory = async (req, res) => {
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
                EM: 'Interview not found',
                EC: 1,
                DT: null
            });
        }

        const result = await virtualInterviewVoiceService.getConversationHistory(interviewId);

        return res.status(result.EC === 0 ? 200 : 400).json(result);
    } catch (error) {
        console.error('Error in getConversationHistory:', error);
        return res.status(500).json({
            EM: 'Error getting history',
            EC: -1,
            DT: null
        });
    }
};

module.exports = {
    startVoiceConversation,
    processVoiceResponse,
    textToSpeech,
    speechToText: [upload.single('audio'), speechToText],
    getConversationHistory
};

