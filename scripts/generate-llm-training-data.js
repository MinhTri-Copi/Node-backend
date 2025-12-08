/**
 * Script: generate-llm-training-data.js
 * Mục tiêu: Dùng LLM sinh dữ liệu train đa dạng (đúng/đúng phần/sai/rác)
 * Đầu ra: CSV với các cột:
 *   questionId,questionText,correctAnswer,studentAnswer,maxScore,teacherScore,label
 *
 * Cách dùng:
 *   node scripts/generate-llm-training-data.js [output.csv]
 *
 * Yêu cầu:
 *   - LM Studio / OpenAI-compatible endpoint (LM_STUDIO_URL, LM_STUDIO_MODEL)
 *   - Đã cài dependencies backend (openai, dotenv)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const trainingDataService = require('../src/service/trainingDataService');

// Polyfill fetch/Headers/FormData cho Node < 18 (giống aiGradingService)
if (typeof fetch === 'undefined' || typeof FormData === 'undefined' || typeof Headers === 'undefined') {
    try {
        const { fetch: whatwgFetch, FormData: WhatwgFormData, Headers: WhatwgHeaders, Request: WhatwgRequest, Response: WhatwgResponse } = require('@whatwg-node/fetch');
        global.fetch = whatwgFetch;
        global.FormData = WhatwgFormData;
        global.Headers = WhatwgHeaders;
        global.Request = WhatwgRequest;
        global.Response = WhatwgResponse;
        console.log('✅ Using @whatwg-node/fetch polyfill for fetch/Headers/FormData');
    } catch (err) {
        const nodeFetch = require('node-fetch');
        global.fetch = nodeFetch;
        global.Headers = nodeFetch.Headers;
        global.Request = nodeFetch.Request;
        global.Response = nodeFetch.Response;
        console.log('✅ Using node-fetch polyfill for fetch/Headers');
        try {
            const { FormData: WhatwgFormData } = require('@whatwg-node/fetch');
            global.FormData = WhatwgFormData;
            console.log('✅ Using @whatwg-node/fetch FormData polyfill');
        } catch (formErr) {
            const FormDataPolyfill = require('form-data');
            global.FormData = FormDataPolyfill;
            console.log('✅ Using form-data polyfill for FormData');
        }
    }
}

const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://127.0.0.1:1234';
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL || 'qwen2.5-1.5b-instruct';

const client = new OpenAI({
    baseURL: LM_STUDIO_URL + '/v1',
    apiKey: 'lm-studio',
});

const roundToHalf = (score) => Math.round(score * 2) / 2;

const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

const writeCSV = (headers, rows, outPath) => {
    const headerLine = headers.map(escapeCSV).join(',');
    const dataLines = rows.map(row =>
        headers.map(h => escapeCSV(row[h] ?? '')).join(',')
    );
    fs.writeFileSync(outPath, [headerLine, ...dataLines].join('\n'), 'utf8');
};

const parseJSONSafe = (text) => {
    if (!text) return null;
    const cleaned = text.trim();
    try {
        return JSON.parse(cleaned);
    } catch {
        const match = cleaned.match(/\[[\s\S]*\]/);
        if (match) {
            try { return JSON.parse(match[0]); } catch { /* ignore */ }
        }
        const objMatch = cleaned.match(/\{[\s\S]*\}/);
        if (objMatch) {
            try { return JSON.parse(objMatch[0]); } catch { /* ignore */ }
        }
    }
    return null;
};

const labelToRatio = (label) => {
    switch ((label || '').toLowerCase()) {
        case 'correct':
        case 'đúng':
            return 0.9 + Math.random() * 0.1; // 0.9-1.0
        case 'partial':
        case 'đúng phần':
            return 0.5 + Math.random() * 0.2; // 0.5-0.7
        case 'wrong':
        case 'sai':
            return Math.random() * 0.2; // 0-0.2
        case 'garbage':
        case 'rác':
        case 'rac':
            return 0; // rác
        default:
            return Math.random() * 0.2;
    }
};

const generateForQuestion = async (question) => {
    const prompt = `Bạn là giáo viên chấm bài. Nhiệm vụ: sinh 4 câu trả lời mẫu của học viên VÀ chấm điểm dựa trên SO SÁNH với đáp án mẫu.

QUY TRÌNH CHẤM ĐIỂM:
1. So sánh câu trả lời của học viên với đáp án mẫu (correctAnswer)
2. Dựa trên mức độ giống/khác biệt để cho điểm
3. Điểm số phải phản ánh chính xác mức độ đúng/sai so với đáp án mẫu

4 LOẠI CÂU TRẢ LỜI CẦN SINH:
1) Đúng hoàn toàn: So sánh với đáp án mẫu → giống hoàn toàn → cho điểm 80-100% maxScore
2) Đúng một phần: So sánh với đáp án mẫu → giống một phần → cho điểm 40-70% maxScore  
3) Sai: So sánh với đáp án mẫu → khác biệt nhiều → cho điểm 0-30% maxScore
4) Rác: Không liên quan đến câu hỏi → cho điểm 0

QUAN TRỌNG:
- Điểm số (score) PHẢI dựa trên so sánh câu trả lời với đáp án mẫu (correctAnswer)
- KHÔNG được cho điểm dựa trên label, mà phải so sánh thực tế
- Mỗi câu trả lời phải có điểm số cụ thể (0 đến maxScore)

Format JSON trả về:
[
  {"answer":"câu trả lời 1","label":"correct","score":9.5},
  {"answer":"câu trả lời 2","label":"partial","score":6.0},
  {"answer":"câu trả lời 3","label":"wrong","score":2.0},
  {"answer":"câu trả lời 4","label":"garbage","score":0}
]

Câu hỏi: ${question.questionText}
Đáp án mẫu (correctAnswer): ${question.correctAnswer}
Điểm tối đa (maxScore): ${question.maxScore}

BẮT BUỘC: Mỗi object phải có field "score" là số điểm (0 đến ${question.maxScore}) dựa trên so sánh với đáp án mẫu.`;

    const res = await client.chat.completions.create({
        model: LM_STUDIO_MODEL,
        messages: [
            { role: 'system', content: 'Bạn là giáo viên chấm bài. Sinh câu trả lời mẫu và chấm điểm dựa trên SO SÁNH với đáp án mẫu. BẮT BUỘC trả về field "score" trong mỗi object.' },
            { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 800 // Tăng để đủ cho cả answer và score chi tiết
    });

    const text = res.choices[0]?.message?.content || '';
    const parsed = parseJSONSafe(text);
    if (!Array.isArray(parsed)) throw new Error('LLM không trả về mảng hợp lệ');

    // Chuẩn hóa kết quả
    return parsed.map((item, index) => {
        const studentAnswer = item.answer || item.text || '';
        const label = (item.label || '').toLowerCase();
        
        // BẮT BUỘC phải có score từ LLM (chấm dựa trên đáp án mẫu)
        let teacherScore;
        if (item.score !== undefined && item.score !== null) {
            // LLM đã chấm điểm dựa trên so sánh với đáp án mẫu
            teacherScore = parseFloat(item.score);
            // Đảm bảo trong khoảng hợp lệ
            teacherScore = Math.max(0, Math.min(teacherScore, question.maxScore || 10));
        } else {
            // Nếu LLM không trả về score, báo lỗi và skip (không dùng fallback)
            console.error(`❌ LLM không trả về score cho item ${index + 1} (label: "${label}"). Bỏ qua item này.`);
            throw new Error(`LLM không trả về score cho item ${index + 1}. Điểm số phải được chấm dựa trên so sánh với đáp án mẫu.`);
        }
        
        // Làm tròn về 0.5
        teacherScore = roundToHalf(teacherScore);
        
        return {
            questionId: question.id,
            questionText: question.questionText,
            correctAnswer: question.correctAnswer,
            studentAnswer,
            maxScore: question.maxScore || 10,
            teacherScore, // Điểm này đã được LLM chấm dựa trên so sánh với đáp án mẫu
            label: label
        };
    });
};

(async () => {
    try {
        const outArg = process.argv[2];
        let outputFile = outArg;
        if (!outputFile) {
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            outputFile = path.resolve(`training-data-llm-${ts}.csv`);
        } else {
            outputFile = path.resolve(outputFile);
        }

        console.log('📥 Đang lấy danh sách câu hỏi tự luận...');
        const questions = await trainingDataService.getAllEssayQuestions();
        if (!questions || questions.length === 0) {
            console.error('❌ Không tìm thấy câu hỏi tự luận nào!');
            process.exit(1);
        }
        console.log(`✅ Có ${questions.length} câu hỏi. Mỗi câu sinh 4 đáp án => ~${questions.length * 4} dòng.`);

        const allRows = [];
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            console.log(`🔄 Câu ${i + 1}/${questions.length}: ID=${q.id}`);
            try {
                const rows = await generateForQuestion(q);
                allRows.push(...rows);
                // nhẹ nhàng 200ms tránh nghẽn
                await new Promise(r => setTimeout(r, 200));
            } catch (err) {
                console.warn(`⚠️ Lỗi sinh dữ liệu cho câu ${q.id}:`, err.message);
            }
        }

        if (allRows.length === 0) {
            console.error('❌ Không sinh được dữ liệu nào');
            process.exit(1);
        }

        // Ghi CSV
        const headers = ['questionId', 'questionText', 'correctAnswer', 'studentAnswer', 'maxScore', 'teacherScore', 'label'];
        writeCSV(headers, allRows, outputFile);

        console.log('✅ Hoàn thành!');
        console.log(`📁 File: ${outputFile}`);
        console.log(`📊 Tổng dòng: ${allRows.length}`);
        console.log('💡 Tiếp theo: merge vào grading_data.csv rồi train lại.');
        console.log('   node scripts/merge-training-data.js <file-vua-sinh>.csv');
        console.log('   cd ml-grader && python train_grader.py grading_data.csv');

    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        process.exit(1);
    }
})();

