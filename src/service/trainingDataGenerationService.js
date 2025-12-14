/**
 * TRAINING DATA GENERATION SERVICE
 * 
 * Service để tự động sinh dữ liệu training từ câu hỏi bằng LLM
 * Được gọi tự động khi HR upload bộ đề mới
 */

const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

// Polyfill fetch cho Node < 18
if (typeof fetch === 'undefined' || typeof Headers === 'undefined') {
    try {
        const { fetch: whatwgFetch, Headers: WhatwgHeaders, Request: WhatwgRequest, Response: WhatwgResponse } = require('@whatwg-node/fetch');
        global.fetch = whatwgFetch;
        global.Headers = WhatwgHeaders;
        global.Request = WhatwgRequest;
        global.Response = WhatwgResponse;
    } catch (err) {
        const nodeFetch = require('node-fetch');
        global.fetch = nodeFetch;
        global.Headers = nodeFetch.Headers;
        global.Request = nodeFetch.Request;
        global.Response = nodeFetch.Response;
    }
}

const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://127.0.0.1:1234';
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL || 'qwen2.5-1.5b-instruct';

const client = new OpenAI({
    baseURL: LM_STUDIO_URL + '/v1',
    apiKey: 'lm-studio',
});

/**
 * Parse JSON từ response của LLM (xử lý trường hợp có text thừa)
 */
const parseJSONSafe = (text) => {
    if (!text) return null;
    const cleaned = text.trim();
    try {
        return JSON.parse(cleaned);
    } catch {
        // Thử tìm JSON array trong text
        const match = cleaned.match(/\[[\s\S]*\]/);
        if (match) {
            try { return JSON.parse(match[0]); } catch { /* ignore */ }
        }
        // Thử tìm JSON object
        const objMatch = cleaned.match(/\{[\s\S]*\}/);
        if (objMatch) {
            try { return JSON.parse(objMatch[0]); } catch { /* ignore */ }
        }
    }
    return null;
};

/**
 * Chuyển label thành score ratio
 */
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

/**
 * Tự động gán điểm dựa trên label (KHÔNG cho LLM chấm)
 * LLM chỉ sinh answer + label, hệ thống tự gán score bằng RULE CỐ ĐỊNH
 * 
 * ⚠️ QUAN TRỌNG: KHÔNG dùng Math.random()
 * Lý do: Tránh cùng 1 câu có nhiều điểm khác nhau (gây nhiễu ML)
 * 
 * Rule CẢI TIẾN (đa dạng hơn để ML học tốt hơn):
 * - correct: 85-95% maxScore (câu đúng hoàn toàn, cho phép paraphrase)
 * - good: 75-85% maxScore (đúng hầu hết ý, thiếu chi tiết nhỏ không quan trọng)
 * - partial: 50-70% maxScore (đúng một phần, thiếu ý quan trọng)
 * - wrong: 15-30% maxScore (sai hoặc lệch nghĩa nhưng vẫn liên quan)
 * - garbage: 0% (lạc đề hoàn toàn)
 * 
 * Sử dụng variant để tạo 3 mức điểm khác nhau cho mỗi label
 * Giúp ML học được RANGE thay vì chỉ 1 điểm cố định
 */
const labelToScore = (label, maxScore, variant = 0) => {
    const ms = maxScore || 10;
    const lbl = (label || '').toLowerCase();
    
    // Với mỗi label, trả về 1 trong 3 mức điểm tuỳ variant
    switch (lbl) {
        case 'correct':
        case 'đúng':
        case 'correct_paraphrase_strong':
        case 'correct_paraphrase_light':
            // 85%, 90%, 95% tuỳ variant (0,1,2)
            return [0.85, 0.90, 0.95][variant % 3] * ms;
        case 'good':
        case 'tốt':
            // 75%, 80%, 85%
            return [0.75, 0.80, 0.85][variant % 3] * ms;
        case 'partial':
        case 'đúng một phần':
        case 'đúng phần':
        case 'partial_medium':
        case 'partial_low':
            // 50%, 60%, 70%
            return [0.50, 0.60, 0.70][variant % 3] * ms;
        case 'wrong':
        case 'sai':
            // 15%, 22%, 30%
            return [0.15, 0.22, 0.30][variant % 3] * ms;
        case 'garbage':
        case 'rác':
        case 'rac':
        case 'garbage_offtopic':
        case 'garbage_nonsense':
            return 0; // 0%
        default:
            return 0; // Phòng lỗi
    }
};

/**
 * Làm tròn điểm về 0.5
 */
const roundToHalf = (score) => Math.round(score * 2) / 2;

/**
 * Sinh training samples cho 1 câu hỏi bằng LLM
 * @param {Object} question - { questionText, correctAnswer, maxScore, questionId }
 * @returns {Array} Array of training samples
 */
const generateTrainingSamplesForQuestion = async (question) => {
    const maxAttempts = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            // Random seed để tạo sự đa dạng mỗi lần retry
            const randomSeed = Math.floor(Math.random() * 10000) + attempt * 1000;
            
            const prompt = `Bạn là giáo viên. Nhiệm vụ: CHỈ SINH 8 CÂU TRẢ LỜI MẪU của học viên với độ đa dạng CAO.

8 LOẠI CÂU TRẢ LỜI CẦN SINH (mỗi loại PHẢI KHÁC NHAU về từ ngữ và nội dung):

1) correct_paraphrase_strong: Trả lời đúng đầy đủ, PARAPHRASE MẠNH
   - Dùng từ đồng nghĩa hoàn toàn khác
   - Ví dụ: "bảo vệ" → "che chở", "phương pháp" → "giải pháp"

2) correct_paraphrase_light: Trả lời đúng đầy đủ, PARAPHRASE NHẸ
   - Giữ thuật ngữ chính, đổi cấu trúc câu
   - Ví dụ: "là tập hợp" → "bao gồm", "nhằm" → "với mục đích"

3) good: Trả lời đúng HẦU HẾT ý, thiếu 1 chi tiết NHỎ không quan trọng
   - Ví dụ: Đúng định nghĩa + mục tiêu, nhưng thiếu ví dụ minh họa

4) partial_medium: Trả lời đúng 50-60% ý chính
   - Thiếu vài phần QUAN TRỌNG
   
5) partial_low: Trả lời đúng chỉ 30-40% ý chính
   - Thiếu RẤT NHIỀU phần quan trọng

6) wrong: Hiểu SAI khái niệm, lệch nghĩa
   - Vẫn liên quan chủ đề nhưng nội dung SAI

7) garbage_offtopic: Lạc đề hoàn toàn
   - Nói về chủ đề HOÀN TOÀN KHÁC

8) garbage_nonsense: Vô nghĩa, không có ý nghĩa
   - Câu trả lời loạn xạ, không logic

YÊU CẦU BẮT BUỘC:
- 8 câu phải KHÁC NHAU HOÀN TOÀN về từ ngữ, cấu trúc, nội dung
- Được phép dùng thuật ngữ chuyên môn bắt buộc (như "bảo mật", "hệ thống")
- Chỉ trả về JSON thuần, KHÔNG thêm text nào khác

Format JSON (KHÔNG có field "score"):
[
  {"answer":"câu đúng paraphrase mạnh","label":"correct"},
  {"answer":"câu đúng paraphrase nhẹ","label":"correct"},
  {"answer":"câu đúng hầu hết, thiếu chi tiết nhỏ","label":"good"},
  {"answer":"câu thiếu 50% ý","label":"partial"},
  {"answer":"câu thiếu 70% ý","label":"partial"},
  {"answer":"câu sai lệch","label":"wrong"},
  {"answer":"câu lạc đề","label":"garbage"},
  {"answer":"câu vô nghĩa","label":"garbage"}
]

Câu hỏi: ${question.questionText}
Đáp án đúng (để tham khảo): ${question.correctAnswer}

Seed: ${randomSeed}`;

            // Tính max_tokens động dựa trên độ dài đáp án mẫu
            const answerLengthForTokens = (question.correctAnswer || '').length;
            let dynamicMaxTokens = 900; // Mặc định
            if (answerLengthForTokens > 500) {
                dynamicMaxTokens = 1500; // Câu dài: cần nhiều token hơn
            } else if (answerLengthForTokens > 200) {
                dynamicMaxTokens = 1200; // Câu trung bình
            }

            const res = await client.chat.completions.create({
                model: LM_STUDIO_MODEL,
                messages: [
                    { role: 'system', content: `Bạn là giáo viên. CHỈ sinh 4 câu trả lời mẫu (correct/partial/wrong/garbage), KHÔNG chấm điểm. Trả về JSON array với field "answer", "label" (không có "score").` },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7, // Giảm xuống để ổn định hơn
                max_tokens: dynamicMaxTokens
            });

            const text = res.choices[0]?.message?.content || '';
            const parsed = parseJSONSafe(text);
            
            if (!Array.isArray(parsed) || parsed.length === 0) {
                throw new Error('LLM không trả về mảng hợp lệ');
            }

            // Kiểm tra trùng lặp đơn giản (chỉ exact match cho câu ngắn)
            const seenAnswers = new Set();
            const normalized = (text) => (text || '').trim().replace(/\s+/g, ' ').toLowerCase();

            const samples = parsed.map((item, index) => {
                const studentAnswerRaw = item.answer || item.text || '';
                const studentAnswer = studentAnswerRaw.trim();
                const label = (item.label || '').toLowerCase();

                // Kiểm tra trùng lặp exact match (chỉ cho câu ngắn)
                const normKey = normalized(studentAnswer);
                const answerLength = normKey.length;
                
                // Chỉ check exact match cho câu ngắn (< 100 ký tự)
                if (answerLength < 100 && seenAnswers.has(normKey)) {
                    throw new Error(`LLM trả về câu trả lời trùng lặp cho item ${index + 1}.`);
                }
                seenAnswers.add(normKey);
                
                // Tự động tính điểm dựa trên label với variant
                // index làm variant để có 3 mức điểm khác nhau cho mỗi label
                // Ví dụ: correct có thể là 8.5, 9.0, hoặc 9.5 điểm
                const teacherScore = labelToScore(label, question.maxScore || 10, index);
                
                return {
                    questionId: question.questionId || question.id || 0,
                    questionText: question.questionText || '',
                    correctAnswer: question.correctAnswer || '',
                    studentAnswer,
                    maxScore: question.maxScore || 10,
                    teacherScore: roundToHalf(teacherScore),
                    label: label
                };
            });

            // Đảm bảo đủ 8 câu trả lời (tăng từ 4 lên 8 để ML học tốt hơn)
            if (samples.length < 8) {
                throw new Error(`LLM không sinh đủ 8 câu trả lời (được ${samples.length}).`);
            }

            return samples;
        } catch (error) {
            lastError = error;
            console.warn(`⚠️ Attempt ${attempt}/${maxAttempts} failed for question ${question.questionId || question.id}: ${error.message}`);
            if (attempt === maxAttempts) {
                console.error(`❌ Lỗi sinh training data cho câu hỏi ${question.questionId || question.id}:`, error.message);
                throw error;
            }
        }
    }

    // Should not reach here
    throw lastError || new Error('Không thể sinh training data sau nhiều lần thử');
};

/**
 * Sinh training samples cho nhiều câu hỏi (batch processing)
 * @param {Array} questions - Array of { questionText, correctAnswer, maxScore, questionId }
 * @param {Object} options - { samplesPerQuestion: 4, delayBetweenQuestions: 200 }
 * @returns {Array} Array of all training samples
 */
const generateTrainingSamplesForQuestions = async (questions, options = {}) => {
    const {
        samplesPerQuestion = 4,
        delayBetweenQuestions = 200 // ms
    } = options;

    if (!questions || questions.length === 0) {
        return [];
    }

    console.log(`🔄 Đang sinh training data cho ${questions.length} câu hỏi...`);
    
    const allSamples = [];
    
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        try {
            console.log(`  📝 Câu ${i + 1}/${questions.length}: ID=${q.questionId || q.id}`);
            const samples = await generateTrainingSamplesForQuestion(q);
            allSamples.push(...samples);
            
            // Delay nhẹ để tránh quá tải LLM
            if (i < questions.length - 1 && delayBetweenQuestions > 0) {
                await new Promise(r => setTimeout(r, delayBetweenQuestions));
            }
        } catch (err) {
            console.warn(`  ⚠️ Lỗi sinh dữ liệu cho câu ${q.questionId || q.id}:`, err.message);
            // Tiếp tục với câu tiếp theo, không dừng toàn bộ
        }
    }

    console.log(`✅ Đã sinh ${allSamples.length} training samples từ ${questions.length} câu hỏi`);
    return allSamples;
};

/**
 * Escape giá trị CSV
 */
const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

/**
 * Ghi training samples ra CSV file
 * @param {Array} samples - Array of training samples
 * @param {string} outputPath - Path to output CSV file
 */
const writeTrainingSamplesToCSV = (samples, outputPath) => {
    if (!samples || samples.length === 0) {
        console.warn('⚠️ Không có dữ liệu để ghi CSV');
        return;
    }

    const headers = ['questionId', 'questionText', 'correctAnswer', 'studentAnswer', 'maxScore', 'teacherScore', 'label'];
    const headerLine = headers.map(escapeCSV).join(',');
    const dataLines = samples.map(row =>
        headers.map(h => escapeCSV(row[h] ?? '')).join(',')
    );
    
    const csvContent = [headerLine, ...dataLines].join('\n');
    fs.writeFileSync(outputPath, csvContent, 'utf8');
    console.log(`✅ Đã ghi ${samples.length} dòng vào CSV: ${outputPath}`);
};

/**
 * Merge training samples vào file grading_data.csv chính
 * @param {Array} newSamples - Array of new training samples
 * @param {string} gradingDataPath - Path to grading_data.csv (default: ml-grader/grading_data.csv)
 * @returns {number} Total number of rows after merge
 */
const mergeTrainingSamplesToMainCSV = (newSamples, gradingDataPath = null) => {
    if (!newSamples || newSamples.length === 0) {
        console.warn('⚠️ Không có dữ liệu mới để merge');
        return 0;
    }

    // Xác định đường dẫn file chính
    const mainCSVPath = gradingDataPath || path.resolve(__dirname, '../../../ml-grader/grading_data.csv'); // Fix: lên 3 cấp để ra root
    const mainCSVDir = path.dirname(mainCSVPath);
    
    // Đảm bảo thư mục tồn tại
    if (!fs.existsSync(mainCSVDir)) {
        fs.mkdirSync(mainCSVDir, { recursive: true });
    }

    // Parse CSV hiện có (nếu có)
    let existingData = [];
    let headers = ['questionId', 'questionText', 'correctAnswer', 'studentAnswer', 'maxScore', 'teacherScore', 'label'];
    
    if (fs.existsSync(mainCSVPath)) {
        try {
            const content = fs.readFileSync(mainCSVPath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            
            if (lines.length >= 2) {
                headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                
                for (let i = 1; i < lines.length; i++) {
                    const values = parseCSVLine(lines[i]);
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = values[index] || '';
                    });
                    existingData.push(row);
                }
            }
        } catch (error) {
            console.warn(`⚠️ Lỗi đọc file CSV cũ: ${error.message}, tạo file mới`);
            existingData = [];
        }
    }

    // Loại bỏ duplicate (dựa trên questionId + studentAnswer)
    const normalize = (text) => (text || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const existingKeys = new Set(
        existingData.map(row => `${row.questionId || ''}_${normalize(row.studentAnswer)}`)
    );
    
    const uniqueNewSamples = newSamples.filter(sample => {
        const key = `${sample.questionId || ''}_${normalize(sample.studentAnswer)}`;
        return !existingKeys.has(key);
    });

    if (uniqueNewSamples.length === 0) {
        console.log('ℹ️ Tất cả dữ liệu mới đã tồn tại trong CSV, không cần merge');
        return existingData.length;
    }

    // Merge
    const mergedData = [...existingData, ...uniqueNewSamples];
    
    // Ghi lại file
    const headerLine = headers.map(escapeCSV).join(',');
    const dataLines = mergedData.map(row =>
        headers.map(h => escapeCSV(row[h] ?? '')).join(',')
    );
    const csvContent = [headerLine, ...dataLines].join('\n');
    
    fs.writeFileSync(mainCSVPath, csvContent, 'utf8');
    
    console.log(`✅ Đã merge ${uniqueNewSamples.length} dòng mới vào ${mainCSVPath}`);
    console.log(`   Tổng: ${existingData.length} → ${mergedData.length} dòng`);
    
    return mergedData.length;
};

/**
 * Parse một dòng CSV (xử lý dấu phẩy trong dấu ngoặc kép)
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

/**
 * Tự động sinh và lưu training data từ danh sách câu hỏi
 * @param {Array} questions - Array of questions (từ QuestionBankItem)
 * @param {Object} options - { autoMerge: true, outputPath: null, autoTrain: false }
 * @returns {Object} { success, samplesCount, message, trainingResult }
 */
const autoGenerateAndSaveTrainingData = async (questions, options = {}) => {
    const {
        autoMerge = true, // Tự động merge vào grading_data.csv
        outputPath = null, // Nếu không merge, ghi ra file này
        autoTrain = false // Tự động train ML model sau khi merge (background)
    } = options;

    try {
        // Lọc chỉ lấy câu tự luận
        const essayQuestions = questions.filter(q => 
            (q.Loaicauhoi === 'tuluan' || q.loaicauhoi === 'tuluan') &&
            q.Dapan && q.Dapan !== 'Chưa có đáp án' && q.Dapan.trim() !== ''
        );

        if (essayQuestions.length === 0) {
            return {
                success: true,
                samplesCount: 0,
                message: 'Không có câu hỏi tự luận nào để sinh training data'
            };
        }

        console.log(`📊 Tìm thấy ${essayQuestions.length} câu tự luận có đáp án`);

        // Format questions cho LLM
        const formattedQuestions = essayQuestions.map(q => ({
            questionId: q.id || q.questionBankItemId || 0,
            questionText: q.Cauhoi || q.question || '',
            correctAnswer: q.Dapan || q.answer || '',
            maxScore: q.Diem || q.maxScore || 10
        }));

        // Sinh training samples
        const samples = await generateTrainingSamplesForQuestions(formattedQuestions, {
            samplesPerQuestion: 4,
            delayBetweenQuestions: 200
        });

        if (samples.length === 0) {
            return {
                success: false,
                samplesCount: 0,
                message: 'Không sinh được training samples nào'
            };
        }

        // Lưu vào CSV
        let result = {
            success: true,
            samplesCount: samples.length,
            message: ''
        };

        if (autoMerge) {
            const gradingDataPath = path.resolve(__dirname, '../../../ml-grader/grading_data.csv'); // Fix: lên 3 cấp để ra root
            const totalRows = mergeTrainingSamplesToMainCSV(samples, gradingDataPath);
            result.totalRowsInCSV = totalRows;
            result.message = `Đã sinh ${samples.length} training samples và merge vào grading_data.csv`;

            // Tự động train ML model nếu được bật (chạy background, không block)
            if (autoTrain) {
                // Chạy train trong background, không await (không block response)
                setImmediate(async () => {
                    try {
                        console.log('🤖 [Background] Đang tự động train ML model...');
                        const mlTrainingService = require('./mlTrainingService');
                        
                        // Train trong background (không block)
                        await mlTrainingService.trainMLModelBackground(gradingDataPath, {
                            timeout: 300000 // 5 phút
                        });
                    } catch (trainingError) {
                        console.warn('⚠️ [Background] Lỗi khi train ML model:', trainingError.message);
                    }
                });
                
                result.trainingResult = {
                    success: true,
                    message: 'Đã bắt đầu train ML model trong background',
                    trainingInProgress: true
                };
                result.message += ` | Đã bắt đầu train ML model trong background`;
            }
        } else {
            const finalPath = outputPath || path.resolve(__dirname, `../../training-data-${Date.now()}.csv`);
            writeTrainingSamplesToCSV(samples, finalPath);
            result.outputPath = finalPath;
            result.message = `Đã sinh ${samples.length} training samples và lưu vào ${finalPath}`;
        }

        return result;
    } catch (error) {
        console.error('❌ Lỗi trong autoGenerateAndSaveTrainingData:', error);
        return {
            success: false,
            samplesCount: 0,
            message: `Lỗi: ${error.message}`
        };
    }
};

module.exports = {
    generateTrainingSamplesForQuestion,
    generateTrainingSamplesForQuestions,
    writeTrainingSamplesToCSV,
    mergeTrainingSamplesToMainCSV,
    autoGenerateAndSaveTrainingData
};

