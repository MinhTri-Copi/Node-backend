import db from '../models/index';
import { Op } from 'sequelize';
import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
const trainingDataGenerationService = require('./trainingDataGenerationService');
require('dotenv').config();

// Import mammoth (CommonJS module)
const mammoth = require('mammoth');

// Polyfill fetch and FormData for Node.js < 18
// Try @whatwg-node/fetch first (better compatibility), fallback to node-fetch + form-data
if (typeof fetch === 'undefined' || typeof FormData === 'undefined') {
    try {
        // Try @whatwg-node/fetch (provides both fetch and FormData)
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
                // Use form-data directly - OpenAI SDK should handle it
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
    
    // Try to find JSON array first (most common for classification)
    const firstBrace = cleaned.indexOf('[');
    const lastBrace = cleaned.lastIndexOf(']');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        let jsonString = cleaned.substring(firstBrace, lastBrace + 1);
        
        // Try to fix common JSON issues
        // Remove trailing commas before closing bracket
        jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
        
        try {
            const parsed = JSON.parse(jsonString);
            if (Array.isArray(parsed)) {
                // Debug: Log parsed array length
                console.log(`  🔍 Parsed array with ${parsed.length} items`);
                return parsed;
            }
        } catch (error) {
            console.warn(`  ⚠️ JSON parse error (array): ${error.message}`);
            console.warn(`  📝 Attempted to parse (${jsonString.length} chars): ${jsonString.substring(0, 300)}...`);
            // Try to extract valid JSON array using regex as fallback
            const arrayMatch = jsonString.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
                try {
                    const fixed = arrayMatch[0].replace(/,(\s*[}\]])/g, '$1');
                    const parsed = JSON.parse(fixed);
                    console.log(`  🔍 Regex fallback parsed ${parsed.length} items`);
                    return parsed;
                } catch (e) {
                    console.warn(`  ⚠️ Regex extract also failed: ${e.message}`);
                }
            }
        }
    }
    
    // Try to find JSON object
    const firstBraceObj = cleaned.indexOf('{');
    const lastBraceObj = cleaned.lastIndexOf('}');
    
    if (firstBraceObj !== -1 && lastBraceObj !== -1 && lastBraceObj > firstBraceObj) {
        const jsonString = cleaned.substring(firstBraceObj, lastBraceObj + 1);
        try {
            const parsed = JSON.parse(jsonString);
            // If single object, wrap in array
            if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                return [parsed];
            }
            return parsed;
        } catch (error) {
            console.warn(`  ⚠️ JSON parse error (object): ${error.message}`);
        }
    }
    
    // Last resort: try to extract JSON from text using regex
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.warn(`  ⚠️ JSON extract error: ${error.message}`);
        }
    }
    
    return null;
}

/**
 * Read and parse TXT file
 */
const parseTxtFile = async (filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return content;
    } catch (error) {
        console.error('Error reading TXT file:', error);
        throw new Error('Không thể đọc file TXT!');
    }
};

/**
 * Read and parse DOCX file
 */
const parseDocxFile = async (filePath) => {
    try {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    } catch (error) {
        console.error('Error reading DOCX file:', error);
        throw new Error('Không thể đọc file DOCX!');
    }
};

/**
 * Extract questions from content using regex patterns
 * Patterns: "Câu x:", "Question x", "Qx.", etc.
 */
const extractQuestionsWithRegex = (content) => {
    try {
        const questions = [];
        
        // Patterns to match question headers
        // Vietnamese: "Câu 1:", "Câu 2:", "Câu hỏi 1:", etc.
        // English: "Question 1:", "Q1.", "Q 1:", etc.
        const questionPatterns = [
            /Câu\s+(\d+)[:\.]\s*(.+?)(?=Câu\s+\d+[:\.]|Câu\s+hỏi\s+\d+[:\.]|Đáp án|Answer|$)/gis,
            /Câu\s+hỏi\s+(\d+)[:\.]\s*(.+?)(?=Câu\s+hỏi\s+\d+[:\.]|Câu\s+\d+[:\.]|Đáp án|Answer|$)/gis,
            /Question\s+(\d+)[:\.]\s*(.+?)(?=Question\s+\d+[:\.]|Answer|Đáp án|$)/gis,
            /Q\s*(\d+)[:\.]\s*(.+?)(?=Q\s*\d+[:\.]|Answer|Đáp án|$)/gis,
            /^(\d+)[\.\)]\s+(.+?)(?=^\d+[\.\)]|Đáp án|Answer|$)/gims
        ];

        let allMatches = [];
        
        // Try each pattern
        for (const pattern of questionPatterns) {
            const matches = [...content.matchAll(pattern)];
            allMatches = allMatches.concat(matches.map(match => ({
                number: parseInt(match[1]) || parseInt(match[0].match(/\d+/)?.[0]) || 0,
                text: match[2] || match[0],
                fullMatch: match[0]
            })));
        }

        // Remove duplicates and sort by question number
        const uniqueMatches = Array.from(
            new Map(allMatches.map(m => [m.number, m])).values()
        ).sort((a, b) => a.number - b.number);

        // === BƯỚC 1: Extract tất cả đáp án trắc nghiệm từ toàn bộ file trước ===
        const correctAnswerMap = new Map(); // number -> letter (e.g. 1 -> 'B')

        // Pattern tìm tất cả dòng "Đáp án: X" hoặc tương tự, kèm số câu gần nhất
        const answerLines = content.matchAll(
            /(?:Câu\s*(\d+)|Câu\s*hỏi\s*(\d+))[\s\n]*.*?Đáp\s*án\s*[:\.]?\s*([A-D])\b/gi
        );

        let lastQuestionNumber = null;
        for (const match of answerLines) {
            const qNum = parseInt(match[1] || match[2]);
            const letter = match[3].toUpperCase();
            if (qNum) {
                correctAnswerMap.set(qNum, letter);
                lastQuestionNumber = qNum;
            } else if (lastQuestionNumber && letter) {
                // Trường hợp không có số câu nhưng có Đáp án (hiếm)
                correctAnswerMap.set(lastQuestionNumber, letter);
            }
        }

        // Fallback thêm: tìm tất cả "Đáp án: X" không kèm số câu, gán tuần tự
        if (correctAnswerMap.size < uniqueMatches.length) {
            const globalAnswers = [...content.matchAll(/Đáp\s*án\s*[:\.]?\s*([A-D])\b/gi)];
            const questionNumbers = uniqueMatches.map(m => m.number);
            globalAnswers.forEach((m, index) => {
                const letter = m[1].toUpperCase();
                const qNum = questionNumbers[index];
                if (qNum && !correctAnswerMap.has(qNum)) {
                    correctAnswerMap.set(qNum, letter);
                }
            });
        }

        console.log('🔍 Global extracted correct answers:', Object.fromEntries(correctAnswerMap));

        // Try to extract all answers from a separate "Đáp án" section at the end
        // Many files have format: Questions first, then "Đáp án:" section with all answers
        const answerMap = new Map();
        
        // Find "Đáp án" section (usually at the end) - including "Đáp án mẫu:"
        const answerSectionMatch = content.match(/(?:Đáp án\s+mẫu|Đáp án|Answer|Trả lời)[:\.]?\s*\n?([\s\S]*?)(?=\n\n\n|$)/i);
        if (answerSectionMatch) {
            const answerSection = answerSectionMatch[1];
            // Extract numbered answers: "Câu 1: ...", "1. ...", etc.
            const numberedAnswerPattern = /(?:Câu\s+(\d+)|Câu\s+hỏi\s+(\d+)|^(\d+))[\.\):]?\s*(.+?)(?=Câu\s+\d+|Câu\s+hỏi\s+\d+|^\d+[\.\)]|$)/gims;
            const numberedAnswers = [...answerSection.matchAll(numberedAnswerPattern)];
            for (const numAnswer of numberedAnswers) {
                const qNum = parseInt(numAnswer[1] || numAnswer[2] || numAnswer[3]);
                const answer = numAnswer[4].trim();
                if (qNum && answer && answer.length > 3) {
                    answerMap.set(qNum, answer);
                }
            }
            
            // Also handle answers without numbers (directly after "Đáp án mẫu:")
            // Split by double newlines or question patterns to get individual answers
            if (numberedAnswers.length === 0) {
                // Try to split answers by double newlines or patterns
                const unnumberedAnswers = answerSection.split(/\n\n+/).filter(a => a.trim().length > 10);
                // Map first answer to first question, second to second, etc.
                unnumberedAnswers.forEach((answer, index) => {
                    const qNum = index + 1; // Start from 1
                    const cleanAnswer = answer.trim().replace(/^(Đáp án\s+mẫu|Đáp án|Answer|Trả lời)[:\.]\s*/i, '').trim();
                    if (cleanAnswer && cleanAnswer.length > 3) {
                        answerMap.set(qNum, cleanAnswer);
                    }
                });
            }
        }

        // Extract question and answer from each match
        for (const match of uniqueMatches) {
            const text = match.text.trim();
            
            let questionText = text;
            let answerText = '';
            let options = null;
            
            // QUAN TRỌNG: Parse options TRƯỚC KHI extract answer
            // Options có thể nằm trong questionText (A. ... B. ... C. ... D. ...)
            const lines = questionText.split('\n');
            const optionLines = [];
            let questionEndLineIndex = -1;
            
            // Find lines that look like options (A. text, B. text, etc.)
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                // Check if line starts with A. B. C. or D. (with optional spaces before)
                // Pattern: "A. text" or "A) text" or "A: text" (at start of line, case insensitive)
                const optionMatch = line.match(/^\s*([A-D])[\.\):]\s*(.+)$/i);
                if (optionMatch) {
                    optionLines.push({
                        lineIndex: i,
                        letter: optionMatch[1].toUpperCase(),
                        text: optionMatch[2].trim()
                    });
                    if (questionEndLineIndex === -1) {
                        questionEndLineIndex = i; // First option line = end of question
                    }
                } else if (optionLines.length > 0) {
                    // If we already found options
                    if (line.length === 0) {
                        // Empty line - continue (might be separator)
                        continue;
                    } else if (line.match(/^(Đáp án|Answer|Trả lời)/i)) {
                        // Found answer line - stop here
                        break;
                    } else if (line.match(/^\d+\.\s|^Câu\s+\d+/i)) {
                        // Found next question - stop here
                        break;
                    } else {
                        // Non-empty line that doesn't look like option or answer
                        // Stop here to be safe
                        break;
                    }
                }
            }
            
            // If we found at least 2 option lines, extract them
            if (optionLines.length >= 2) {
                const foundOptions = {};
                optionLines.forEach(({ letter, text }) => {
                    // Clean up: remove trailing dots, but keep the text
                    let cleanText = text.trim();
                    // Remove trailing period only if it's at the very end (not part of abbreviation)
                    cleanText = cleanText.replace(/\.$/, '').trim();
                    if (cleanText && cleanText.length > 0 && cleanText.length < 500) {
                        foundOptions[letter] = cleanText;
                    }
                });
                
                if (Object.keys(foundOptions).length >= 2) {
                    options = foundOptions;
                    // Remove option lines from question text
                    if (questionEndLineIndex >= 0) {
                        questionText = lines.slice(0, questionEndLineIndex).join('\n').trim();
                    }
                    console.log(`  ✅ Parse được ${Object.keys(options).length} options: ${Object.keys(options).join(', ')}`);
                }
            }
            
            // Try to find answer patterns (including "Đáp án mẫu:", "Đáp án:", etc.)
            // QUAN TRỌNG: Ưu tiên pattern match chữ cái đơn (A/B/C/D) SAU "Đáp án:" trước
            const answerPatterns = [
                // Pattern 1: Match chỉ chữ cái đơn sau "Đáp án:" (ưu tiên cao nhất)
                // "Đáp án: B" hoặc "Đáp án:B" hoặc "Đáp án: B "
                /Đáp án\s*[:\.]\s*([A-D])(?:\s|$|\.|\n|Câu)/gi,
                /Answer\s*[:\.]\s*([A-D])(?:\s|$|\.|\n)/gi,
                /Trả lời\s*[:\.]\s*([A-D])(?:\s|$|\.|\n)/gi,
                // Pattern 2: Match đáp án dài (cho câu tự luận)
                /Đáp án\s+mẫu[:\.]\s*(.+?)(?=\d+\.\s|Câu\s+\d+|Câu\s+hỏi\s+\d+|Question\s+\d+|Q\s*\d+|Đáp án\s+mẫu|🟩|$)/gis,
                /Đáp án[:\.]\s*(.+?)(?=\d+\.\s|Câu\s+\d+|Câu\s+hỏi\s+\d+|Question\s+\d+|Q\s*\d+|Đáp án\s+mẫu|🟩|$)/gis,
                /Answer[:\.]\s*(.+?)(?=\d+\.\s|Câu\s+\d+|Câu\s+hỏi\s+\d+|Question\s+\d+|Q\s*\d+|Answer|$)/gis,
                /Trả lời[:\.]\s*(.+?)(?=\d+\.\s|Câu\s+\d+|Câu\s+hỏi\s+\d+|Question\s+\d+|Q\s*\d+|Trả lời|$)/gis
            ];

            // === EXTRACT ĐÁP ÁN - DÙNG GLOBAL MAP ===
            // Nếu có options → là trắc nghiệm → lấy đáp án từ map global
            if (options && Object.keys(options).length >= 2) {
                const qNumber = match.number;
                if (correctAnswerMap.has(qNumber)) {
                    answerText = correctAnswerMap.get(qNumber);
                    console.log(`  ✅ Gán đáp án từ global map: "${answerText}" cho câu ${qNumber}`);
                } else {
                    console.warn(`  ⚠️ Không tìm thấy đáp án trong map cho câu ${qNumber}`);
                    answerText = '';
                }
            } else {
                // Không có options, tìm answer như bình thường
                for (const answerPattern of answerPatterns) {
                    const answerMatch = text.match(answerPattern);
                    if (answerMatch) {
                        questionText = text.substring(0, answerMatch.index).trim();
                        rawAnswer = answerMatch[1].trim();
                        answerText = rawAnswer;
                        break;
                    }
                }
            }

            // If no answer found, try to split by common separators
            // QUAN TRỌNG: KHÔNG dùng fallback này cho câu trắc nghiệm (đã có options)
            // Vì fallback này có thể lấy nhầm toàn bộ options vào answerText
            if (!answerText && (!options || Object.keys(options).length < 2)) {
                // Chỉ dùng fallback cho câu tự luận (không có options)
                const separators = [
                    '\n\nĐáp án mẫu',
                    '\nĐáp án mẫu',
                    '\n\nĐáp án',
                    '\nĐáp án',
                    '\n\nAnswer',
                    '\nAnswer',
                    '\n\nTrả lời',
                    '\nTrả lời',
                    '\n\n',
                    '\n---',
                    '\n==='
                ];
                for (const sep of separators) {
                    const parts = text.split(sep);
                    if (parts.length >= 2) {
                        questionText = parts[0].trim();
                        let rawAnswer = parts.slice(1).join(sep).trim();
                        // Remove "Đáp án mẫu:", "Đáp án:", etc. prefix if exists
                        rawAnswer = rawAnswer.replace(/^(Đáp án\s+mẫu|Đáp án|Answer|Trả lời)[:\.]\s*/i, '').trim();
                        
                        // QUAN TRỌNG: Chỉ lấy đáp án đến khi gặp câu hỏi tiếp theo
                        // Dừng trước: số + dấu chấm, "Câu X", "Đáp án mẫu:" của câu tiếp theo, section marker
                        const answerEndMatch = rawAnswer.match(/(.+?)(?=\d+\.\s|Câu\s+\d+|Câu\s+hỏi\s+\d+|Question\s+\d+|Q\s*\d+|Đáp án\s+mẫu|🟩|$)/s);
                        answerText = answerEndMatch ? answerEndMatch[1].trim() : rawAnswer.trim();
                        
                        if (answerText) break;
                    }
                }
            }
            
            // Try to find answer in next section (if answer is after question pattern)
            // QUAN TRỌNG: KHÔNG dùng phần này cho câu trắc nghiệm (đã có options)
            // Vì có thể lấy nhầm text từ câu hỏi khác
            if (!answerText && (!options || Object.keys(options).length < 2)) {
                // Chỉ tìm trong next section cho câu tự luận
                const currentMatchIndex = content.indexOf(match.fullMatch);
                if (currentMatchIndex !== -1) {
                    const searchStart = currentMatchIndex + match.fullMatch.length;
                    // Find the next question to limit search range
                    const nextQuestionMatch = content.substring(searchStart).match(/(?:^\d+\.\s|Câu\s+\d+|Câu\s+hỏi\s+\d+|Question\s+\d+|Q\s*\d+)/m);
                    const searchEnd = nextQuestionMatch 
                        ? searchStart + nextQuestionMatch.index 
                        : Math.min(searchStart + 2000, content.length);
                    const nextSection = content.substring(searchStart, searchEnd);
                    
                    // Look for answer patterns in next section (including "Đáp án mẫu:")
                    // Dừng trước câu hỏi tiếp theo hoặc "Đáp án mẫu:" của câu tiếp theo
                    const answerInNext = nextSection.match(/(?:Đáp án\s+mẫu|Đáp án|Answer|Trả lời)[:\.]\s*(.+?)(?=\d+\.\s|Câu\s+\d+|Câu\s+hỏi\s+\d+|Question\s+\d+|Q\s*\d+|Đáp án\s+mẫu|🟩|$)/is);
                    if (answerInNext) {
                        answerText = answerInNext[1].trim();
                        // Clean up: remove leading/trailing whitespace and newlines
                        answerText = answerText.replace(/^\s+|\s+$/g, '').replace(/\n{3,}/g, '\n\n');
                    }
                }
            }
            
            // Try to get answer from answer section map (if answers are in a separate section)
            // QUAN TRỌNG: KHÔNG dùng answerMap cho câu trắc nghiệm (đã có options)
            // Vì answerMap có thể chứa text dài, không phải chữ cái đơn
            if (!answerText && (!options || Object.keys(options).length < 2) && answerMap.has(match.number)) {
                answerText = answerMap.get(match.number);
            }

            // Clean up question and answer
            questionText = questionText.replace(/^Câu\s+\d+[:\.]\s*/i, '')
                                      .replace(/^Câu\s+hỏi\s+\d+[:\.]\s*/i, '')
                                      .replace(/^Question\s+\d+[:\.]\s*/i, '')
                                      .replace(/^Q\s*\d+[:\.]\s*/i, '')
                                      .replace(/^\d+[\.\)]\s+/, '')
                                      .trim();

            // Remove leading/trailing whitespace and newlines
            questionText = questionText.replace(/^\s+|\s+$/g, '').replace(/\n{3,}/g, '\n\n');
            // QUAN TRỌNG: Chỉ clean answerText nếu không phải là câu trắc nghiệm
            // Vì câu trắc nghiệm answerText chỉ là chữ cái đơn (A-D), không cần clean
            if (!options || Object.keys(options).length < 2) {
                answerText = answerText.replace(/^\s+|\s+$/g, '').replace(/\n{3,}/g, '\n\n');
            } else {
                // Câu trắc nghiệm: chỉ trim whitespace, không replace newlines
                answerText = answerText.trim();
            }
            
            // QUAN TRỌNG: Nếu có options, answerText phải là chữ cái đơn (A-D)
            // Nếu không phải, có thể đã extract sai → để trống
            if (options && Object.keys(options).length >= 2) {
                if (answerText && !/^[A-D]$/i.test(answerText)) {
                    console.log(`  ⚠️ Warning: Answer "${answerText}" is not A-D for multiple choice, setting to empty`);
                    answerText = ''; // Sẽ được set thành 'Chưa có đáp án' ở cuối
                } else if (answerText) {
                    console.log(`  ✅ Answer is valid for multiple choice: "${answerText}"`);
                }
            }

            if (questionText && questionText.length > 5) { // Minimum question length (reduced for flexibility)
                questions.push({
                    question: questionText,
                    answer: answerText || 'Chưa có đáp án',
                    options: options, // Add options if found
                    rawText: match.fullMatch
                });
            }
        }

        console.log(`✅ Đã extract ${questions.length} câu hỏi bằng regex`);
        
        // Debug: Log số câu hỏi có đáp án và có options
        const questionsWithAnswer = questions.filter(q => q.answer && q.answer !== 'Chưa có đáp án').length;
        const questionsWithOptions = questions.filter(q => q.options && Object.keys(q.options).length >= 2).length;
        console.log(`  📊 Số câu hỏi có đáp án: ${questionsWithAnswer}/${questions.length}`);
        console.log(`  📊 Số câu hỏi có options (A/B/C/D): ${questionsWithOptions}/${questions.length}`);
        console.log(`  📊 Số câu hỏi có options (A/B/C/D): ${questionsWithOptions}/${questions.length}`);
        
        return questions;
    } catch (error) {
        console.error('Error extracting questions with regex:', error);
        throw new Error('Lỗi khi parse câu hỏi bằng regex!');
    }
};

/**
 * Classify a single question using LLM (OLD METHOD - kept for backward compatibility)
 * Returns: { loaicauhoi, chude, dodai, dokho, metadata }
 */
const classifyQuestionWithLLM = async (questionText, answerText) => {
    try {
        const prompt = `Hãy phân loại câu hỏi sau và trả kết quả JSON:

Câu hỏi: "${questionText}"
Đáp án: "${answerText}"

JSON format:
{
  "loaicauhoi": "tuluan | tracnghiem",
  "chude": "tên chủ đề (ví dụ: OOP, Collections, Exception, Networking, etc.)",
  "dodai": "ngan | trungbinh | dai",
  "dokho": "de | trungbinh | kho",
  "metadata": ["keyword1", "keyword2", "keyword3"]
}

QUAN TRỌNG: Chỉ trả về JSON object, không có text nào khác!`;

        const response = await openai.chat.completions.create({
            model: LM_STUDIO_MODEL,
            messages: [
                {
                    role: 'system',
                    content: 'Bạn là hệ thống phân loại câu hỏi. Bạn chỉ trả về JSON object, không có text nào khác.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 500
        });

        const responseText = response.choices[0]?.message?.content || '';
        const classification = parseJSONFromResponse(responseText);

        if (!classification) {
            // Default values if LLM fails
            return {
                loaicauhoi: 'tuluan',
                chude: 'Khác',
                dodai: 'trungbinh',
                dokho: 'trungbinh',
                metadata: []
            };
        }

        return {
            loaicauhoi: classification.loaicauhoi === 'tracnghiem' ? 'tracnghiem' : 'tuluan',
            chude: classification.chude || 'Khác',
            dodai: classification.dodai || 'trungbinh',
            dokho: classification.dokho || 'trungbinh',
            metadata: classification.metadata || []
        };
    } catch (error) {
        console.error('Error classifying question with LLM:', error);
        // Return default values on error
        return {
            loaicauhoi: 'tuluan',
            chude: 'Khác',
            dodai: 'trungbinh',
            dokho: 'trungbinh',
            metadata: []
        };
    }
};

/**
 * Classify multiple questions in a single batch using LLM (OPTIMIZED FOR SPEED)
 * This is MUCH faster than classifying one by one (10-40x faster)
 * Returns: Array of { loaicauhoi, chude, dodai, dokho, metadata }
 */
const classifyQuestionsBatch = async (questions) => {
    try {
        if (!questions || questions.length === 0) {
            return [];
        }

        // OPTIMIZATION: Template prompt với yêu cầu rõ ràng về format
        const prompt = `Phân loại ${questions.length} câu hỏi. Chỉ trả về JSON array với ĐÚNG ${questions.length} phần tử:

Ví dụ format:
[{"type":"tl","topic":"OOP","len":"tb","diff":"m"},{"type":"tn","topic":"Backend","len":"n","diff":"e"}]

QUAN TRỌNG:
- type: CHỌN 1 giá trị: "tl" HOẶC "tn" (không dùng "|")
- len: CHỌN 1 giá trị: "n" HOẶC "tb" HOẶC "d" (không dùng "|")
- diff: CHỌN 1 giá trị: "e" HOẶC "m" HOẶC "h" (không dùng "|")
- topic: tên chủ đề ngắn gọn

Danh sách ${questions.length} câu hỏi:
${questions.map((q, i) => `${i + 1}. "${q.question.substring(0, 35)}"`).join('\n')}

Trả về ĐÚNG ${questions.length} phần tử JSON array. Mỗi field chỉ 1 giá trị. Không thêm text.`;

        const response = await openai.chat.completions.create({
            model: LM_STUDIO_MODEL,
            messages: [
                {
                    role: 'system',
                    content: `Phân loại câu hỏi. Trả về JSON array với ĐÚNG số lượng phần tử như yêu cầu. Format: [{"type":"tl|tn","topic":"tên","len":"n|tb|d","diff":"e|m|h"}]`
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0,
            top_p: 0.1,
            max_tokens: Math.max(800, questions.length * 30 + 200) // Tăng đáng kể để đủ cho batch lớn
        });

        const responseText = response.choices[0]?.message?.content || '';
        
        // Debug: Log LLM response để xem vấn đề
        if (responseText.length > 0) {
            console.log(`  📝 LLM response (${responseText.length} chars): ${responseText.substring(0, 300)}`);
        }
        
        const classifications = parseJSONFromResponse(responseText);
        
        // Debug: Log parsed result
        if (classifications && Array.isArray(classifications)) {
            console.log(`  ✅ Parsed ${classifications.length} items from LLM response`);
        } else {
            console.warn(`  ⚠️ Failed to parse JSON from response`);
        }

        if (!classifications || !Array.isArray(classifications)) {
            console.warn('⚠️ LLM không trả về array hợp lệ, sử dụng giá trị mặc định');
            // Return default values for all questions
            return questions.map(() => ({
                loaicauhoi: 'tuluan',
                chude: 'Khác',
                dodai: 'trungbinh',
                dokho: 'trungbinh',
                metadata: []
            }));
        }

        // Ensure we have the same number of classifications as questions
        if (classifications.length !== questions.length) {
            console.warn(`⚠️ Số lượng phân loại (${classifications.length}) khác số lượng câu hỏi (${questions.length})`);
            // Pad with default values if needed
            while (classifications.length < questions.length) {
                classifications.push({
                    type: 'tl',
                    topic: 'Khác',
                    len: 'tb',
                    diff: 'm',
                    kw: []
                });
            }
            // Trim if too many
            classifications.splice(questions.length);
        }

        // OPTIMIZATION: Convert shorthand to full format (fast lookup)
        const typeMap = { 'tl': 'tuluan', 'tn': 'tracnghiem' };
        const lenMap = { 'n': 'ngan', 'tb': 'trungbinh', 'd': 'dai' };
        const diffMap = { 'e': 'de', 'm': 'trungbinh', 'h': 'kho' };

        // Normalize and return classifications
        // Fix: LLM có thể trả về "n|tb|d" - cần lấy giá trị đầu tiên
        return classifications.map((c) => {
            // Fix format errors: nếu có "|", lấy giá trị đầu tiên
            const type = (c.type || '').split('|')[0].trim();
            const len = (c.len || '').split('|')[0].trim();
            const diff = (c.diff || '').split('|')[0].trim();
            
            return {
                loaicauhoi: typeMap[type] || 'tuluan',
                chude: (c.topic || 'Khác').split('|')[0].trim() || 'Khác',
                dodai: lenMap[len] || 'trungbinh',
                dokho: diffMap[diff] || 'trungbinh',
                metadata: []
            };
        });
    } catch (error) {
        console.error('Error classifying questions batch with LLM:', error);
        // Return default values for all questions on error
        return questions.map(() => ({
            loaicauhoi: 'tuluan',
            chude: 'Khác',
            dodai: 'trungbinh',
            dokho: 'trungbinh',
            metadata: []
        }));
    }
};

/**
 * Extract questions from content using LLM (OLD METHOD - kept for backward compatibility)
 */
const extractQuestionsWithLLM = async (content, fileName) => {
    try {
        const prompt = `
Bạn là hệ thống trích xuất câu hỏi từ tài liệu.
Đọc nội dung sau và trích xuất TẤT CẢ câu hỏi cùng đáp án.

Nội dung tài liệu:
${content.substring(0, 8000)} ${content.length > 8000 ? '... (nội dung bị cắt)' : ''}

Yêu cầu:
1. Trích xuất tất cả câu hỏi và đáp án từ tài liệu
2. Phân loại chủ đề cho mỗi câu hỏi (ví dụ: OOP, Collections, Exception, etc.)
3. Xác định loại câu hỏi: "tuluan" (tự luận) hoặc "tracnghiem" (trắc nghiệm)
4. Đánh giá độ khó: "de", "trungbinh", hoặc "kho"
5. Đánh giá độ dài: "ngan", "trungbinh", hoặc "dai"

Trả về JSON array với format:
[
  {
    "question": "Nội dung câu hỏi?",
    "answer": "Đáp án chuẩn",
    "topic": "OOP",
    "type": "tuluan",
    "difficulty": "trungbinh",
    "length": "trungbinh",
    "score": 10
  },
  ...
]

QUAN TRỌNG: Chỉ trả về JSON array, không có text nào khác!
`;

        const response = await openai.chat.completions.create({
            model: LM_STUDIO_MODEL,
            messages: [
                {
                    role: 'system',
                    content: 'Bạn là hệ thống trích xuất câu hỏi từ tài liệu. Bạn chỉ trả về JSON array, không có text nào khác.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 4000
        });

        const responseText = response.choices[0]?.message?.content || '';
        const questions = parseJSONFromResponse(responseText);

        if (!questions || !Array.isArray(questions)) {
            throw new Error('LLM không trả về danh sách câu hỏi hợp lệ!');
        }

        return questions;
    } catch (error) {
        console.error('Error extracting questions with LLM:', error);
        throw new Error('Lỗi khi trích xuất câu hỏi từ LLM: ' + error.message);
    }
};

/**
 * Upload and parse question bank file
 */
const uploadQuestionBank = async (userId, file, data) => {
    const transaction = await db.sequelize.transaction();
    
    try {
        if (!file) {
            await transaction.rollback();
            return {
                EM: 'Vui lòng chọn file!',
                EC: 1,
                DT: null
            };
        }

        if (!data.Ten) {
            await transaction.rollback();
            return {
                EM: 'Vui lòng nhập tên bộ đề!',
                EC: 2,
                DT: null
            };
        }

        // Determine file type
        const ext = path.extname(file.originalname).toLowerCase();
        let fileType = 'txt';
        if (ext === '.pdf') fileType = 'pdf';
        else if (ext === '.docx') fileType = 'docx';
        else if (ext === '.doc') fileType = 'docx';
        else if (ext === '.txt') fileType = 'txt';

        // Parse file content
        let content = '';
        if (fileType === 'txt') {
            content = await parseTxtFile(file.path);
        } else if (fileType === 'docx') {
            content = await parseDocxFile(file.path);
        } else {
            await transaction.rollback();
            return {
                EM: 'Hiện tại chỉ hỗ trợ file TXT và DOCX. PDF sẽ được hỗ trợ trong tương lai!',
                EC: 3,
                DT: null
            };
        }

        // B1: Create QuestionBank first
        const questionBank = await db.QuestionBank.create({
            Ten: data.Ten,
            Mota: data.Mota || null,
            FilePath: `/uploads/question-banks/${file.filename}`,
            FileType: fileType,
            FileName: file.originalname,
            Content: content,
            Metadata: {
                fileSize: file.size,
                parsedAt: new Date().toISOString(),
                parseMethod: 'regex'
            },
            userId: userId
        }, { transaction });

        // B2: Extract questions using regex (FAST - 0.005-0.02s)
        console.log('⚡ Đang extract câu hỏi bằng regex...');
        const startTime = Date.now();
        const extractedQuestions = extractQuestionsWithRegex(content);
        const extractTime = Date.now() - startTime;
        console.log(`✅ Đã extract ${extractedQuestions.length} câu hỏi trong ${extractTime}ms`);
        
        // Debug: Log số câu hỏi có đáp án
        const questionsWithAnswer = extractedQuestions.filter(q => q.answer && q.answer !== 'Chưa có đáp án').length;
        console.log(`  📊 Số câu hỏi có đáp án: ${questionsWithAnswer}/${extractedQuestions.length}`);

        if (!extractedQuestions || extractedQuestions.length === 0) {
            await transaction.rollback();
            return {
                EM: 'Không tìm thấy câu hỏi nào trong file! Vui lòng kiểm tra định dạng file.',
                EC: 4,
                DT: null
            };
        }

        // B3: Classify questions - use simple ONE batch approach (fastest)
        console.log(`🤖 Đang phân loại ${extractedQuestions.length} câu hỏi bằng LLM...`);
        const classificationStartTime = Date.now();
        
        let allClassifications = [];
        
        // STRATEGY: Gộp 1 batch lớn = nhanh nhất (giảm overhead, model reasoning 1 lần)
        // Batch lớn = ít request = nhanh hơn tổng thể đáng kể
        const optimalBatchSize = extractedQuestions.length <= 30 ? extractedQuestions.length : 30; // 1 batch nếu ≤30, tối đa 30
        const batches = [];
        for (let i = 0; i < extractedQuestions.length; i += optimalBatchSize) {
            batches.push(extractedQuestions.slice(i, i + optimalBatchSize));
        }
        
        console.log(`  📦 Processing ${batches.length} batch(es) (${optimalBatchSize} câu/batch)`);
        
        // Process batches sequentially
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            const startTime = Date.now();
            try {
                const classifications = await classifyQuestionsBatch(batch);
                const duration = Date.now() - startTime;
                console.log(`  ✓ Batch ${batchIndex + 1}/${batches.length}: ${batch.length} câu - ${(duration / 1000).toFixed(1)}s`);
                allClassifications.push(...classifications);
            } catch (error) {
                console.error(`  ✗ Batch ${batchIndex + 1} error:`, error.message);
                allClassifications.push(...batch.map(() => ({
                    loaicauhoi: 'tuluan',
                    chude: 'Khác',
                    dodai: 'trungbinh',
                    dokho: 'trungbinh',
                    metadata: []
                })));
            }
        }
        
        // Merge questions with their classifications
        // QUAN TRỌNG: Giữ nguyên answer và options từ extractedQuestions (không bị mất khi merge)
        const classifiedQuestions = extractedQuestions.map((q, index) => {
            const classification = allClassifications[index] || {
                loaicauhoi: 'tuluan',
                chude: 'Khác',
                dodai: 'trungbinh',
                dokho: 'trungbinh',
                metadata: []
            };
            
            // Determine final type: OVERRIDE LLM nếu detect được format trắc nghiệm
            // Priority: Format detection > LLM classification
            let finalType = classification.loaicauhoi || 'tuluan';
            const hasOptions = q.options && Object.keys(q.options).length >= 2;
            
            // Debug: Log để kiểm tra
            console.log(`  🔍 Câu ${index + 1}: LLM phân loại = "${classification.loaicauhoi}", hasOptions = ${hasOptions}, options = ${q.options ? JSON.stringify(q.options) : 'null'}, answer = "${q.answer ? q.answer.substring(0, 50) : 'null'}"`);
            
            // Detect trắc nghiệm dựa trên format đáp án
            let isMultipleChoiceByFormat = false;
            if (q.answer) {
                // Pattern 1: Đáp án chỉ là A/B/C/D (đã clean rồi, không cần trim)
                if (/^[A-D]$/i.test(q.answer)) {
                    isMultipleChoiceByFormat = true;
                    console.log(`  ✅ Câu ${index + 1}: Detect trắc nghiệm (Pattern 1: đáp án chỉ là A/B/C/D)`);
                }
            }
            
            // Override LLM classification nếu detect được format trắc nghiệm
            if (hasOptions || isMultipleChoiceByFormat) {
                const oldType = finalType;
                finalType = 'tracnghiem';
                console.log(`  🔄 Câu ${index + 1}: OVERRIDE từ "${oldType}" → "tracnghiem" (hasOptions=${hasOptions}, isMultipleChoiceByFormat=${isMultipleChoiceByFormat})`);
            } else {
                console.log(`  ℹ️ Câu ${index + 1}: Giữ nguyên phân loại LLM = "${finalType}"`);
            }
            
            return {
                question: q.question || '',
                answer: q.answer || 'Chưa có đáp án', // Đảm bảo answer được giữ lại
                options: q.options || null, // Giữ lại options nếu có
                loaicauhoi: finalType,
                chude: classification.chude,
                dodai: classification.dodai,
                dokho: classification.dokho,
                metadata: classification.metadata || []
            };
        });
        
        const classificationTime = Date.now() - classificationStartTime;
        console.log(`✅ Đã phân loại ${classifiedQuestions.length} câu hỏi trong ${classificationTime}ms (${(classificationTime / 1000).toFixed(2)}s)`);
        
        // Debug: Log số câu trắc nghiệm sau khi merge
        const tracnghiemCount = classifiedQuestions.filter(q => q.loaicauhoi === 'tracnghiem').length;
        const tracnghiemWithOptions = classifiedQuestions.filter(q => q.loaicauhoi === 'tracnghiem' && q.options && Object.keys(q.options).length >= 2).length;
        console.log(`  📊 Số câu trắc nghiệm: ${tracnghiemCount} (${tracnghiemWithOptions} có options)`);

        // B4: Create QuestionBankItems with classification
        const itemsToCreate = classifiedQuestions.map((q, index) => ({
            Cauhoi: q.question || '',
            Dapan: q.answer || 'Chưa có đáp án',
            Chude: q.chude || 'Khác',
            Loaicauhoi: q.loaicauhoi || 'tuluan',
            Options: q.options || null, // Lưu các lựa chọn A/B/C/D nếu có
            Diem: 10, // Default score
            Dodai: q.dodai || 'trungbinh',
            Dokho: q.dokho || 'trungbinh',
            Metadata: {
                extractedAt: new Date().toISOString(),
                originalIndex: index,
                keywords: q.metadata || [],
                extractTime: extractTime,
                classificationTime: classificationTime
            },
            questionBankId: questionBank.id
        }));

        const createdItems = await db.QuestionBankItem.bulkCreate(itemsToCreate, { transaction });

        // Update QuestionBank metadata with final stats
        const topics = [...new Set(classifiedQuestions.map(q => q.chude).filter(Boolean))];
        await questionBank.update({
            Metadata: {
                totalQuestions: classifiedQuestions.length,
                topics: topics,
                fileSize: file.size,
                parsedAt: new Date().toISOString(),
                parseMethod: 'regex',
                extractTime: extractTime,
                classificationTime: classificationTime,
                totalTime: extractTime + classificationTime
            }
        }, { transaction });

        await transaction.commit();

        return {
            EM: 'Upload và trích xuất bộ đề thành công!',
            EC: 0,
            DT: {
                questionBankId: questionBank.id,
                totalQuestions: extractedQuestions.length,
                fileName: file.originalname,
                trainingDataGenerated: {
                    success: false,
                    pendingConfirmation: true,
                    message: 'Vui lòng xem lại phân loại và xác nhận để sinh dữ liệu/train AI.'
                }
            }
        };

    } catch (error) {
        await transaction.rollback();
        console.error('Error in uploadQuestionBank:', error);
        return {
            EM: 'Có lỗi xảy ra khi upload bộ đề: ' + error.message,
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get all question banks for HR
 */
const getQuestionBanks = async (userId) => {
    try {
        const questionBanks = await db.QuestionBank.findAll({
            where: { userId },
            include: [{
                model: db.QuestionBankItem,
                as: 'Items',
                attributes: ['id']
            }],
            order: [['createdAt', 'DESC']]
        });

        const result = questionBanks.map(bank => ({
            id: bank.id,
            Ten: bank.Ten,
            Mota: bank.Mota,
            FileName: bank.FileName,
            FileType: bank.FileType,
            totalQuestions: bank.Items?.length || 0,
            topics: bank.Metadata?.topics || [],
            createdAt: bank.createdAt
        }));

        return {
            EM: 'Lấy danh sách bộ đề thành công!',
            EC: 0,
            DT: result
        };
    } catch (error) {
        console.error('Error in getQuestionBanks:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy danh sách bộ đề!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get question bank detail with items
 */
const getQuestionBankDetail = async (userId, bankId) => {
    try {
        const questionBank = await db.QuestionBank.findOne({
            where: {
                id: bankId,
                userId: userId
            },
            include: [{
                model: db.QuestionBankItem,
                as: 'Items',
                attributes: ['id', 'Cauhoi', 'Dapan', 'Chude', 'Loaicauhoi', 'Diem', 'Dodai', 'Dokho']
            }]
        });

        if (!questionBank) {
            return {
                EM: 'Không tìm thấy bộ đề!',
                EC: 1,
                DT: null
            };
        }

        // Parse Metadata to object for front-end
        let metadataObj = {};
        try {
            metadataObj = questionBank.Metadata
                ? (typeof questionBank.Metadata === 'string'
                    ? JSON.parse(questionBank.Metadata)
                    : questionBank.Metadata)
                : {};
        } catch (metaErr) {
            console.warn('⚠️ [QUESTION BANK DETAIL] Không parse được Metadata:', metaErr.message);
            metadataObj = {};
        }

        return {
            EM: 'Lấy chi tiết bộ đề thành công!',
            EC: 0,
            DT: {
                id: questionBank.id,
                Ten: questionBank.Ten,
                Mota: questionBank.Mota,
                FileName: questionBank.FileName,
                FileType: questionBank.FileType,
                Metadata: metadataObj,
                items: questionBank.Items,
                createdAt: questionBank.createdAt
            }
        };
    } catch (error) {
        console.error('Error in getQuestionBankDetail:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy chi tiết bộ đề!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get question bank items with filters (for selecting questions to add to test)
 */
const getQuestionBankItems = async (userId, filters = {}) => {
    try {
        const {
            bankId,
            chude,
            loaicauhoi,
            dodai,
            dokho,
            search,
            limit = 100,
            offset = 0
        } = filters;

        // Build where clause for QuestionBank
        const bankWhere = { userId };
        if (bankId) {
            bankWhere.id = bankId;
        }

        // Build where clause for QuestionBankItem
        const itemWhere = {};
        if (chude) {
            itemWhere.Chude = chude;
        }
        if (loaicauhoi) {
            itemWhere.Loaicauhoi = loaicauhoi;
        }
        if (dodai) {
            itemWhere.Dodai = dodai;
        }
        if (dokho) {
            itemWhere.Dokho = dokho;
        }
        if (search) {
            itemWhere[Op.or] = [
                { Cauhoi: { [Op.like]: `%${search}%` } },
                { Dapan: { [Op.like]: `%${search}%` } },
                { Chude: { [Op.like]: `%${search}%` } }
            ];
        }

        // Get question bank items
        const items = await db.QuestionBankItem.findAll({
            where: itemWhere,
            include: [{
                model: db.QuestionBank,
                as: 'QuestionBank',
                where: bankWhere,
                attributes: ['id', 'Ten', 'FileName']
            }],
            attributes: ['id', 'Cauhoi', 'Dapan', 'Chude', 'Loaicauhoi', 'Diem', 'Dodai', 'Dokho', 'Options'],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['id', 'ASC']]
        });

        // Get total count for pagination
        const totalCount = await db.QuestionBankItem.count({
            where: itemWhere,
            include: [{
                model: db.QuestionBank,
                as: 'QuestionBank',
                where: bankWhere,
                attributes: []
            }]
        });

        // Get unique topics for filter options
        const allItems = await db.QuestionBankItem.findAll({
            where: {},
            include: [{
                model: db.QuestionBank,
                as: 'QuestionBank',
                where: { userId },
                attributes: []
            }],
            attributes: ['Chude', 'Loaicauhoi', 'Dodai', 'Dokho'],
            raw: true
        });

        const topics = [...new Set(allItems.map(i => i.Chude).filter(Boolean))].sort();
        const questionTypes = [...new Set(allItems.map(i => i.Loaicauhoi).filter(Boolean))].sort();
        const lengths = [...new Set(allItems.map(i => i.Dodai).filter(Boolean))].sort();
        const difficulties = [...new Set(allItems.map(i => i.Dokho).filter(Boolean))].sort();

        return {
            EM: 'Lấy danh sách câu hỏi thành công!',
            EC: 0,
            DT: {
                items: items,
                totalCount: totalCount,
                filters: {
                    topics,
                    questionTypes,
                    lengths,
                    difficulties
                }
            }
        };
    } catch (error) {
        console.error('Error in getQuestionBankItems:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy danh sách câu hỏi!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Delete question bank
 */
const deleteQuestionBank = async (userId, bankId) => {
    const transaction = await db.sequelize.transaction();
    
    try {
        const questionBank = await db.QuestionBank.findOne({
            where: {
                id: bankId,
                userId: userId
            },
            transaction
        });

        if (!questionBank) {
            await transaction.rollback();
            return {
                EM: 'Không tìm thấy bộ đề!',
                EC: 1,
                DT: null
            };
        }

        // Delete file if exists
        if (questionBank.FilePath) {
            const filePath = path.resolve(__dirname, '..', 'public', questionBank.FilePath);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (error) {
                    console.warn('Warning: Could not delete file:', error);
                }
            }
        }

        // Delete all question bank items first
        const deletedItemsCount = await db.QuestionBankItem.destroy({
            where: {
                questionBankId: bankId
            },
            transaction
        });
        console.log(`🗑️ Đã xóa ${deletedItemsCount} câu hỏi thuộc bộ đề ${bankId}`);

        // Delete question bank
        await questionBank.destroy({ transaction });

        await transaction.commit();

        return {
            EM: 'Xóa bộ đề thành công!',
            EC: 0,
            DT: null
        };
    } catch (error) {
        await transaction.rollback();
        console.error('Error in deleteQuestionBank:', error);
        return {
            EM: 'Có lỗi xảy ra khi xóa bộ đề!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Update question bank item (for HR to edit questions)
 */
const updateQuestionBankItem = async (userId, itemId, updateData) => {
    try {
        // First, verify the item belongs to a question bank owned by the user
        const item = await db.QuestionBankItem.findByPk(itemId, {
            include: [{
                model: db.QuestionBank,
                as: 'QuestionBank',
                attributes: ['id', 'userId']
            }]
        });

        if (!item) {
            return {
                EM: 'Không tìm thấy câu hỏi!',
                EC: 1,
                DT: null
            };
        }

        if (!item.QuestionBank || item.QuestionBank.userId !== userId) {
            return {
                EM: 'Bạn không có quyền chỉnh sửa câu hỏi này!',
                EC: 2,
                DT: null
            };
        }

        // Update the item
        await item.update({
            Cauhoi: updateData.Cauhoi || item.Cauhoi,
            Dapan: updateData.Dapan !== undefined ? updateData.Dapan : item.Dapan,
            Chude: updateData.Chude || item.Chude,
            Loaicauhoi: updateData.Loaicauhoi || item.Loaicauhoi,
            Diem: updateData.Diem !== undefined ? updateData.Diem : item.Diem,
            Dodai: updateData.Dodai || item.Dodai,
            Dokho: updateData.Dokho || item.Dokho,
            Metadata: {
                ...(item.Metadata || {}),
                editedAt: new Date().toISOString(),
                editedBy: userId
            }
        });

        return {
            EM: 'Cập nhật câu hỏi thành công!',
            EC: 0,
            DT: {
                id: item.id,
                Cauhoi: item.Cauhoi,
                Dapan: item.Dapan,
                Chude: item.Chude,
                Loaicauhoi: item.Loaicauhoi,
                Diem: item.Diem,
                Dodai: item.Dodai,
                Dokho: item.Dokho
            }
        };
    } catch (error) {
        console.error('Error in updateQuestionBankItem:', error);
        return {
            EM: 'Có lỗi xảy ra khi cập nhật câu hỏi!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * HR xác nhận sau khi rà soát -> sinh training data và (tùy chọn) train ML
 */
const confirmAndGenerateTrainingData = async (userId, bankId, options = {}) => {
    try {
        if (!userId || !bankId) {
            return {
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            };
        }

        // Kiểm tra quyền sở hữu bộ đề
        const questionBank = await db.QuestionBank.findOne({
            where: { id: bankId, userId },
            include: [{
                model: db.QuestionBankItem,
                as: 'Items',
                attributes: ['id', 'Cauhoi', 'Dapan', 'Loaicauhoi', 'Diem']
            }]
        });

        if (!questionBank) {
            return {
                EM: 'Không tìm thấy bộ đề!',
                EC: 2,
                DT: null
            };
        }

        // Lọc câu tự luận có đáp án
        // Debug: log all items for review
        const debugItems = (questionBank.Items || []).map(item => {
            const typeRaw = (item.Loaicauhoi || '').toString().trim().toLowerCase();
            const hasAnswer = !!(item.Dapan && item.Dapan.trim() !== '');
            return {
                id: item.id,
                typeRaw,
                hasAnswer,
                dapanLength: item.Dapan ? item.Dapan.length : 0
            };
        });
        console.log('🔍 [CONFIRM TRAINING] Tổng câu hỏi trong bank:', debugItems.length, debugItems);

        const questionsForTraining = (questionBank.Items || []).filter(item => {
            const typeRaw = (item.Loaicauhoi || '').toString().trim().toLowerCase();
            const mcqTypes = ['tracnghiem', 'multiple_choice', 'mcq', 'true_false', 'dungsai', 'boolean', 'true/false', 'tf'];
            // Essay nếu: để trống, một trong các alias tự luận, hoặc không thuộc các loại trắc nghiệm phổ biến
            const isEssay = !typeRaw
                || ['tuluan', 'essay', 'tự luận', 'tu_luan', 'tu-luan', 'tu luan'].includes(typeRaw)
                || !mcqTypes.includes(typeRaw);
            const hasAnswer = item.Dapan && item.Dapan.trim() !== '';
            if (!(isEssay && hasAnswer)) {
                console.log('ℹ️ [SKIP] item', item.id, 'typeRaw=', typeRaw, 'hasAnswer=', hasAnswer);
            }
            return isEssay && hasAnswer;
        }).map(item => ({
            id: item.id,
            questionBankItemId: item.id,
            questionText: item.Cauhoi,
            correctAnswer: item.Dapan,
            maxScore: item.Diem || 10,
            questionType: item.Loaicauhoi || 'tuluan',
            Loaicauhoi: item.Loaicauhoi || 'tuluan', // align key used by trainingDataGenerationService
            Cauhoi: item.Cauhoi,
            Dapan: item.Dapan,
            Diem: item.Diem || 10
        }));

        if (questionsForTraining.length === 0) {
            console.warn('⚠️ [CONFIRM TRAINING] Không tìm thấy câu tự luận hợp lệ sau lọc!', debugItems);
            return {
                EM: 'Không có câu tự luận hợp lệ để sinh training data!',
                EC: 3,
                DT: null
            };
        }

        console.log(`✅ [CONFIRM TRAINING] Tìm thấy ${questionsForTraining.length} câu tự luận hợp lệ. Bắt đầu sinh data...`);

        const autoTrainML = options.autoTrain ??
            (process.env.AUTO_TRAIN_ML_MODEL === 'true');

        // Mark bank as confirmed (so UI can hide confirm button)
        let metadata = {};
        try {
            metadata =
                questionBank.Metadata && typeof questionBank.Metadata === 'string'
                    ? JSON.parse(questionBank.Metadata)
                    : (questionBank.Metadata || {});
            metadata.confirmedTraining = true;
            await questionBank.update({ Metadata: metadata });
        } catch (metaErr) {
            console.warn('⚠️ [CONFIRM TRAINING] Không thể cập nhật confirmedTraining:', metaErr.message);
        }

        // Fire-and-forget training to avoid blocking response
        setImmediate(async () => {
            try {
                console.log(`🤖 [Background] Bắt đầu sinh training data cho bank ${bankId} với ${questionsForTraining.length} câu...`);
                const result = await trainingDataGenerationService.autoGenerateAndSaveTrainingData(
                    questionsForTraining,
                    {
                        autoMerge: true,
                        autoTrain: autoTrainML
                    }
                );
                if (result.success) {
                    console.log(`✅ [Background] ${result.message}`);
                } else {
                    console.warn(`⚠️ [Background] ${result.message}`);
                }
            } catch (bgErr) {
                console.error('❌ [Background] Lỗi khi sinh training data:', bgErr.message);
            }
        });

        // Return immediately; training runs in background
        return {
            EM: 'Đã xác nhận. Đang sinh training data ở chế độ nền.',
            EC: 0,
            DT: {
                samplesCount: questionsForTraining.length,
                trainingInProgress: true,
                autoTrain: autoTrainML,
                confirmedTraining: true
            }
        };
    } catch (error) {
        console.error('Error in confirmAndGenerateTrainingData:', error);
        return {
            EM: 'Có lỗi xảy ra khi sinh training data!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Lấy training status của bộ đề để hiển thị timeline
 */
const getTrainingStatus = async (userId, bankId) => {
    try {
        if (!userId || !bankId) {
            return {
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            };
        }

        const questionBank = await db.QuestionBank.findOne({
            where: { id: bankId, userId },
            include: [{
                model: db.QuestionBankItem,
                as: 'Items',
                attributes: ['id']
            }]
        });

        if (!questionBank) {
            return {
                EM: 'Không tìm thấy bộ đề!',
                EC: 2,
                DT: null
            };
        }

        const mlTrainingService = require('./mlTrainingService');

        // Parse metadata
        let metadata = {};
        try {
            metadata = questionBank.Metadata && typeof questionBank.Metadata === 'string'
                ? JSON.parse(questionBank.Metadata)
                : (questionBank.Metadata || {});
        } catch (e) {
            metadata = {};
        }

        // Kiểm tra các mốc timeline
        const timeline = [];
        const now = new Date();

        // 1. Upload bộ đề thành công
        timeline.push({
            step: 1,
            title: 'Upload bộ đề thành công',
            description: `Bộ đề "${questionBank.Ten}" đã được upload`,
            status: 'finish',
            icon: 'upload',
            timestamp: questionBank.createdAt
        });

        // 2. Phân loại câu hỏi (LLM classification)
        const hasItems = questionBank.Items && questionBank.Items.length > 0;
        const classificationTime = metadata.classifiedAt || (hasItems ? questionBank.updatedAt : null);
        timeline.push({
            step: 2,
            title: 'Phân loại câu hỏi',
            description: hasItems 
                ? `Đã phân loại ${questionBank.Items.length} câu hỏi bằng LLM`
                : 'Đang phân loại câu hỏi...',
            status: hasItems ? 'finish' : 'process',
            icon: 'tags',
            timestamp: classificationTime
        });

        // 3. Sinh training data
        const confirmedTraining = metadata.confirmedTraining === true;
        const csvPath = path.resolve(__dirname, '../../../ml-grader/grading_data.csv');
        let hasTrainingData = false;
        let trainingDataCount = 0;

        if (fs.existsSync(csvPath)) {
            try {
                const csvContent = fs.readFileSync(csvPath, 'utf8');
                const lines = csvContent.split('\n').filter(line => line.trim());
                // Kiểm tra xem có questionId nào thuộc bank này không
                // (giả sử questionId trong CSV là questionBankItemId)
                if (hasItems) {
                    const itemIds = questionBank.Items.map(item => item.id.toString());
                    for (let i = 1; i < lines.length; i++) { // Skip header
                        const cols = lines[i].split(',');
                        if (cols.length > 0 && itemIds.includes(cols[0])) {
                            hasTrainingData = true;
                            trainingDataCount++;
                        }
                    }
                }
            } catch (e) {
                console.warn('Error reading CSV:', e.message);
            }
        }

        const trainingDataTime = metadata.trainingDataGeneratedAt || (hasTrainingData ? questionBank.updatedAt : null);
        timeline.push({
            step: 3,
            title: 'Sinh training data',
            description: confirmedTraining
                ? (hasTrainingData 
                    ? `Đã sinh ${trainingDataCount} mẫu training data bằng LLM`
                    : 'Đang sinh training data...')
                : 'Chưa xác nhận sinh training data',
            status: hasTrainingData ? 'finish' : (confirmedTraining ? 'process' : 'wait'),
            icon: 'database',
            timestamp: trainingDataTime
        });

        // 4. Train ML model
        // Logic: Step 4 chỉ finish nếu:
        // - Step 3 đã finish (có training data)
        // - Model đã được train
        // - Model được train SAU KHI training data được sinh (kiểm tra thời gian file model)
        const mlModelStatus = mlTrainingService.checkMLModelStatus();
        const autoTrainEnabled = process.env.AUTO_TRAIN_ML_MODEL === 'true';
        const trainingInProgress = metadata.trainingInProgress === true;
        
        // Step 4 chỉ có thể finish nếu step 3 đã finish (có training data)
        const step3Finished = hasTrainingData;
        
        // Kiểm tra thời gian file model được tạo/modified
        let modelTrainedAfterData = false;
        if (step3Finished && mlModelStatus.isTrained && mlModelStatus.modelPath) {
            try {
                const modelStats = fs.statSync(mlModelStatus.modelPath);
                const modelModifiedTime = new Date(modelStats.mtime);
                const trainingDataDate = trainingDataTime ? new Date(trainingDataTime) : null;
                
                // Model được train SAU KHI training data được sinh
                if (trainingDataDate && modelModifiedTime > trainingDataDate) {
                    modelTrainedAfterData = true;
                }
            } catch (e) {
                console.warn('⚠️ Không thể kiểm tra thời gian file model:', e.message);
            }
        }
        
        // Step 4 chỉ finish nếu: step 3 finish + model đã train + model được train SAU KHI có training data
        const step4CanFinish = step3Finished && mlModelStatus.isTrained && modelTrainedAfterData;
        
        // Step 4 là process nếu: step 3 finish + (đang train hoặc model chưa train hoặc model train TRƯỚC training data)
        const step4IsProcess = step3Finished && !step4CanFinish && (trainingInProgress || autoTrainEnabled || mlModelStatus.isTrained);

        timeline.push({
            step: 4,
            title: 'Train ML model',
            description: step4CanFinish
                ? 'ML model đã được train thành công'
                : (step4IsProcess
                    ? 'Đang train ML model...'
                    : step3Finished
                        ? 'Chờ train ML model...'
                        : 'Chưa có training data để train model'),
            status: step4CanFinish ? 'finish' : (step4IsProcess ? 'process' : 'wait'),
            icon: 'robot',
            timestamp: step4CanFinish ? (metadata.modelTrainedAt || questionBank.updatedAt) : null
        });

        return {
            EM: 'Lấy training status thành công!',
            EC: 0,
            DT: {
                bankId: questionBank.id,
                bankName: questionBank.Ten,
                timeline,
                summary: {
                    totalSteps: timeline.length,
                    completedSteps: timeline.filter(t => t.status === 'finish').length,
                    currentStep: timeline.findIndex(t => t.status === 'process') + 1 || timeline.length,
                    isComplete: timeline.every(t => t.status === 'finish')
                }
            }
        };
    } catch (error) {
        console.error('Error in getTrainingStatus:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy training status!',
            EC: -1,
            DT: null
        };
    }
};

export default {
    uploadQuestionBank,
    getQuestionBanks,
    getQuestionBankDetail,
    deleteQuestionBank,
    updateQuestionBankItem,
    getQuestionBankItems,
    confirmAndGenerateTrainingData,
    getTrainingStatus
};

