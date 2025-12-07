import db from '../models/index';
import { Op } from 'sequelize';
import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
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
            
            // Try to find answer patterns (including "Đáp án mẫu:", "Đáp án:", etc.)
            // QUAN TRỌNG: Dừng trước câu hỏi tiếp theo HOẶC trước "Đáp án mẫu:" của câu tiếp theo
            const answerPatterns = [
                /Đáp án\s+mẫu[:\.]\s*(.+?)(?=\d+\.\s|Câu\s+\d+|Câu\s+hỏi\s+\d+|Question\s+\d+|Q\s*\d+|Đáp án\s+mẫu|🟩|$)/gis,
                /Đáp án[:\.]\s*(.+?)(?=\d+\.\s|Câu\s+\d+|Câu\s+hỏi\s+\d+|Question\s+\d+|Q\s*\d+|Đáp án\s+mẫu|🟩|$)/gis,
                /Answer[:\.]\s*(.+?)(?=\d+\.\s|Câu\s+\d+|Câu\s+hỏi\s+\d+|Question\s+\d+|Q\s*\d+|Answer|$)/gis,
                /Trả lời[:\.]\s*(.+?)(?=\d+\.\s|Câu\s+\d+|Câu\s+hỏi\s+\d+|Question\s+\d+|Q\s*\d+|Trả lời|$)/gis
            ];

            let questionText = text;
            let answerText = '';

            // Try to extract answer
            for (const answerPattern of answerPatterns) {
                const answerMatch = text.match(answerPattern);
                if (answerMatch) {
                    questionText = text.substring(0, answerMatch.index).trim();
                    answerText = answerMatch[1].trim();
                    break;
                }
            }

            // If no answer found, try to split by common separators
            if (!answerText) {
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
            // This handles cases where answer is separated by newlines from question
            if (!answerText) {
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
            if (!answerText && answerMap.has(match.number)) {
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
            answerText = answerText.replace(/^\s+|\s+$/g, '').replace(/\n{3,}/g, '\n\n');

            if (questionText && questionText.length > 5) { // Minimum question length (reduced for flexibility)
                questions.push({
                    question: questionText,
                    answer: answerText || 'Chưa có đáp án',
                    rawText: match.fullMatch
                });
            }
        }

        console.log(`✅ Đã extract ${questions.length} câu hỏi bằng regex`);
        
        // Debug: Log số câu hỏi có đáp án
        const questionsWithAnswer = questions.filter(q => q.answer && q.answer !== 'Chưa có đáp án').length;
        console.log(`  📊 Số câu hỏi có đáp án: ${questionsWithAnswer}/${questions.length}`);
        
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
        // QUAN TRỌNG: Giữ nguyên answer từ extractedQuestions (không bị mất khi merge)
        const classifiedQuestions = extractedQuestions.map((q, index) => {
            const classification = allClassifications[index] || {
                loaicauhoi: 'tuluan',
                chude: 'Khác',
                dodai: 'trungbinh',
                dokho: 'trungbinh',
                metadata: []
            };
            
            return {
                question: q.question || '',
                answer: q.answer || 'Chưa có đáp án', // Đảm bảo answer được giữ lại
                loaicauhoi: classification.loaicauhoi,
                chude: classification.chude,
                dodai: classification.dodai,
                dokho: classification.dokho,
                metadata: classification.metadata || []
            };
        });
        
        const classificationTime = Date.now() - classificationStartTime;
        console.log(`✅ Đã phân loại ${classifiedQuestions.length} câu hỏi trong ${classificationTime}ms (${(classificationTime / 1000).toFixed(2)}s)`);

        // B4: Create QuestionBankItems with classification
        const itemsToCreate = classifiedQuestions.map((q, index) => ({
            Cauhoi: q.question || '',
            Dapan: q.answer || 'Chưa có đáp án',
            Chude: q.chude || 'Khác',
            Loaicauhoi: q.loaicauhoi || 'tuluan',
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

        await db.QuestionBankItem.bulkCreate(itemsToCreate, { transaction });

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
                fileName: file.originalname
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

        return {
            EM: 'Lấy chi tiết bộ đề thành công!',
            EC: 0,
            DT: {
                id: questionBank.id,
                Ten: questionBank.Ten,
                Mota: questionBank.Mota,
                FileName: questionBank.FileName,
                FileType: questionBank.FileType,
                Metadata: questionBank.Metadata,
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
            attributes: ['id', 'Cauhoi', 'Dapan', 'Chude', 'Loaicauhoi', 'Diem', 'Dodai', 'Dokho'],
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

        // Delete question bank (cascade will delete items)
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

export default {
    uploadQuestionBank,
    getQuestionBanks,
    getQuestionBankDetail,
    deleteQuestionBank,
    updateQuestionBankItem,
    getQuestionBankItems
};

