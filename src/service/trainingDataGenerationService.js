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
 * Làm tròn điểm về 0.5
 */
const roundToHalf = (score) => Math.round(score * 2) / 2;

/**
 * Sinh training samples cho 1 câu hỏi bằng LLM
 * @param {Object} question - { questionText, correctAnswer, maxScore, questionId }
 * @returns {Array} Array of training samples
 */
const generateTrainingSamplesForQuestion = async (question) => {
    try {
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
        
        if (!Array.isArray(parsed) || parsed.length === 0) {
            throw new Error('LLM không trả về mảng hợp lệ');
        }

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
                questionId: question.questionId || question.id || 0,
                questionText: question.questionText || '',
                correctAnswer: question.correctAnswer || '',
                studentAnswer,
                maxScore: question.maxScore || 10,
                teacherScore, // Điểm này đã được LLM chấm dựa trên so sánh với đáp án mẫu
                label: label
            };
        });
    } catch (error) {
        console.error(`❌ Lỗi sinh training data cho câu hỏi ${question.questionId || question.id}:`, error.message);
        throw error;
    }
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
    const existingKeys = new Set(
        existingData.map(row => `${row.questionId || ''}_${row.studentAnswer || ''}`)
    );
    
    const uniqueNewSamples = newSamples.filter(sample => {
        const key = `${sample.questionId || ''}_${sample.studentAnswer || ''}`;
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

