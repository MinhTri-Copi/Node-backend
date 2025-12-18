/**
 * CV MATCHING DATA GENERATION SERVICE
 * 
 * Service để tự động sinh dữ liệu training CV-JD matching bằng LLM
 * Sinh CV_text, JD_text, và score_ratio (0-1) trực tiếp
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
 * Sinh một batch CV-JD pairs với độ phù hợp đa dạng
 * @param {Object} options - { category, seed }
 * @returns {Array} Array of { cvText, jdText, scoreRatio }
 */
const generateCVJDPairs = async (options = {}) => {
    const { category = 'mixed', seed = Math.floor(Math.random() * 10000) } = options;
    const maxAttempts = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const prompt = `Bạn là chuyên gia tuyển dụng. Nhiệm vụ: SINH 10 CẶP CV-JD với độ phù hợp ĐA DẠNG.

10 LOẠI CẶP CẦN SINH (mỗi cặp PHẢI KHÁC NHAU về nội dung, ngành nghề, level):

1) scoreRatio: 0.90-1.00 - CV RẤT PHÙ HỢP với JD
   - CV có đầy đủ skills, kinh nghiệm, education match 100%
   - Ví dụ: CV Backend Developer 3 năm → JD Backend Developer 2-5 năm

2) scoreRatio: 0.80-0.90 - CV PHÙ HỢP TỐT với JD
   - CV có 80-90% skills match, thiếu 1-2 skills phụ
   - Ví dụ: CV Fullstack → JD Frontend (có React nhưng thiếu Vue)

3) scoreRatio: 0.70-0.80 - CV PHÙ HỢP KHÁ với JD
   - CV có 70-80% skills match, thiếu vài skills quan trọng
   - Ví dụ: CV Junior 1 năm → JD Mid-level 2-3 năm

4) scoreRatio: 0.60-0.70 - CV PHÙ HỢP MỘT PHẦN với JD
   - CV có 60-70% skills match, thiếu nhiều skills
   - Ví dụ: CV Frontend → JD Fullstack (thiếu Backend skills)

5) scoreRatio: 0.50-0.60 - CV PHÙ HỢP TRUNG BÌNH với JD
   - CV có 50-60% skills match, thiếu nhiều skills quan trọng
   - Ví dụ: CV Tester → JD Developer (có testing nhưng thiếu coding)

6) scoreRatio: 0.40-0.50 - CV PHÙ HỢP THẤP với JD
   - CV có 40-50% skills match, lệch ngành một phần
   - Ví dụ: CV Business Analyst → JD Developer (có phân tích nhưng thiếu technical)

7) scoreRatio: 0.30-0.40 - CV KHÔNG PHÙ HỢP với JD
   - CV có 30-40% skills match, lệch ngành rõ ràng
   - Ví dụ: CV Marketing → JD Developer (có digital nhưng không có coding)

8) scoreRatio: 0.20-0.30 - CV RẤT KHÔNG PHÙ HỢP với JD
   - CV có 20-30% skills match, lệch ngành nhiều
   - Ví dụ: CV Sales → JD Developer (có communication nhưng không có technical)

9) scoreRatio: 0.10-0.20 - CV LỆCH NGÀNH với JD (HARD NEGATIVE)
   - CV có 10-20% skills match, lệch ngành hoàn toàn
   - Ví dụ: CV Accountant → JD Developer (có Excel nhưng không có programming)

10) scoreRatio: 0.00-0.10 - CV HOÀN TOÀN LỆCH NGÀNH với JD (HARD NEGATIVE)
    - CV có 0-10% skills match, không liên quan
    - Ví dụ: CV Chef → JD Developer (không có skills liên quan)

YÊU CẦU BẮT BUỘC:
- CV và JD phải GIỐNG THỰC TẾ (ngôn ngữ đời thực, format đời thực)
- Đa dạng về:
  * Level: Sinh viên mới ra trường, 1-2 năm, 3-5 năm, 5+ năm
  * Ngành: Backend, Frontend, Fullstack, DevOps, QA, BA, Data, Mobile, etc.
  * Công ty: Startup, công ty vừa, công ty lớn
- CV phải có: Họ tên, Kinh nghiệm, Kỹ năng, Học vấn, Dự án (nếu có)
- JD phải có: Vị trí, Mô tả công việc, Yêu cầu (skills, kinh nghiệm, education)
- 10 cặp phải KHÁC NHAU HOÀN TOÀN về nội dung, ngành nghề, level
- scoreRatio phải CHÍNH XÁC theo mức độ phù hợp (0.00-1.00)

Format JSON (KHÔNG có field khác):
[
  {"cvText":"CV đầy đủ của Backend Developer 3 năm...","jdText":"JD Backend Developer 2-5 năm...","scoreRatio":0.95},
  {"cvText":"CV Fullstack Developer...","jdText":"JD Frontend Developer...","scoreRatio":0.85},
  {"cvText":"CV Junior Developer 1 năm...","jdText":"JD Mid-level Developer 2-3 năm...","scoreRatio":0.75},
  {"cvText":"CV Frontend Developer...","jdText":"JD Fullstack Developer...","scoreRatio":0.65},
  {"cvText":"CV Tester...","jdText":"JD Developer...","scoreRatio":0.55},
  {"cvText":"CV Business Analyst...","jdText":"JD Developer...","scoreRatio":0.45},
  {"cvText":"CV Marketing...","jdText":"JD Developer...","scoreRatio":0.35},
  {"cvText":"CV Sales...","jdText":"JD Developer...","scoreRatio":0.25},
  {"cvText":"CV Accountant...","jdText":"JD Developer...","scoreRatio":0.15},
  {"cvText":"CV Chef...","jdText":"JD Developer...","scoreRatio":0.05}
]

Category: ${category}
Seed: ${seed}`;

            const res = await client.chat.completions.create({
                model: LM_STUDIO_MODEL,
                messages: [
                    { 
                        role: 'system', 
                        content: `Bạn là chuyên gia tuyển dụng. SINH 10 CẶP CV-JD với scoreRatio (0-1) chính xác. Trả về JSON array với field "cvText", "jdText", "scoreRatio". KHÔNG thêm text nào khác.` 
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.8, // Cao hơn để đa dạng hơn
                max_tokens: 4000 // CV và JD dài hơn câu trả lời
            });

            const text = res.choices[0]?.message?.content || '';
            const parsed = parseJSONSafe(text);
            
            if (!Array.isArray(parsed) || parsed.length === 0) {
                throw new Error('LLM không trả về mảng hợp lệ');
            }

            // Validate và normalize data
            const validPairs = parsed
                .filter(item => {
                    const cvText = (item.cvText || item.cv || '').trim();
                    const jdText = (item.jdText || item.jd || '').trim();
                    const scoreRatio = parseFloat(item.scoreRatio || item.score || 0);
                    
                    return cvText.length > 50 && 
                           jdText.length > 50 && 
                           scoreRatio >= 0 && 
                           scoreRatio <= 1;
                })
                .map(item => ({
                    cvText: (item.cvText || item.cv || '').trim(),
                    jdText: (item.jdText || item.jd || '').trim(),
                    scoreRatio: Math.max(0, Math.min(1, parseFloat(item.scoreRatio || item.score || 0)))
                }));

            if (validPairs.length < 8) {
                throw new Error(`LLM không sinh đủ 8 cặp hợp lệ (được ${validPairs.length}).`);
            }

            return validPairs;
        } catch (error) {
            lastError = error;
            console.warn(`⚠️ Attempt ${attempt}/${maxAttempts} failed: ${error.message}`);
            if (attempt === maxAttempts) {
                console.error(`❌ Lỗi sinh CV-JD pairs:`, error.message);
                throw error;
            }
        }
    }

    throw lastError || new Error('Không thể sinh CV-JD pairs sau nhiều lần thử');
};

/**
 * Sinh nhiều batches CV-JD pairs để đạt 2000-3000 samples
 * @param {Object} options - { targetCount: 2500, batchesPerCategory: 25 }
 * @returns {Array} Array of all CV-JD pairs
 */
const generateTrainingData = async (options = {}) => {
    const {
        targetCount = 2500,
        batchesPerCategory = 25,
        delayBetweenBatches = 500 // ms
    } = options;

    console.log(`🔄 Đang sinh ${targetCount} CV-JD pairs...`);

    const categories = [
        'backend',
        'frontend',
        'fullstack',
        'devops',
        'qa',
        'data',
        'mobile',
        'mixed'
    ];

    const allPairs = [];
    let batchCount = 0;
    const totalBatches = categories.length * batchesPerCategory;

    for (const category of categories) {
        for (let i = 0; i < batchesPerCategory; i++) {
            batchCount++;
            try {
                console.log(`  📝 Batch ${batchCount}/${totalBatches}: Category=${category}, Batch=${i + 1}`);
                const pairs = await generateCVJDPairs({ 
                    category, 
                    seed: batchCount * 1000 + i 
                });
                allPairs.push(...pairs);
                
                console.log(`    ✅ Sinh được ${pairs.length} pairs (Tổng: ${allPairs.length})`);

                // Nếu đã đủ target → dừng
                if (allPairs.length >= targetCount) {
                    console.log(`🎯 Đã đạt target ${targetCount} pairs!`);
                    break;
                }

                // Delay để tránh quá tải LLM
                if (batchCount < totalBatches && allPairs.length < targetCount) {
                    await new Promise(r => setTimeout(r, delayBetweenBatches));
                }
            } catch (err) {
                console.warn(`  ⚠️ Lỗi sinh batch ${batchCount}:`, err.message);
                // Tiếp tục với batch tiếp theo
            }

            // Nếu đã đủ target → break cả 2 vòng lặp
            if (allPairs.length >= targetCount) {
                break;
            }
        }
        if (allPairs.length >= targetCount) {
            break;
        }
    }

    console.log(`✅ Đã sinh ${allPairs.length} CV-JD pairs`);
    return allPairs.slice(0, targetCount); // Đảm bảo không vượt quá target
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
 * Ghi training data ra CSV file
 * @param {Array} pairs - Array of { cvText, jdText, scoreRatio }
 * @param {string} outputPath - Path to output CSV file
 */
const saveTrainingDataToCSV = (pairs, outputPath) => {
    if (!pairs || pairs.length === 0) {
        console.warn('⚠️ Không có dữ liệu để ghi');
        return 0;
    }

    const headers = ['cvText', 'jdText', 'scoreRatio'];
    const headerLine = headers.map(escapeCSV).join(',');
    const dataLines = pairs.map(pair =>
        headers.map(h => escapeCSV(pair[h] ?? '')).join(',')
    );
    const csvContent = [headerLine, ...dataLines].join('\n');

    fs.writeFileSync(outputPath, csvContent, 'utf8');
    console.log(`✅ Đã ghi ${pairs.length} dòng vào ${outputPath}`);
    return pairs.length;
};

/**
 * Merge training data vào CSV file hiện có (tránh duplicate)
 * @param {Array} newPairs - Array of new CV-JD pairs
 * @param {string} csvPath - Path to existing CSV file
 * @returns {number} Total rows after merge
 */
const mergeTrainingDataToCSV = (newPairs, csvPath) => {
    const headers = ['cvText', 'jdText', 'scoreRatio'];
    let existingData = [];

    // Đọc file cũ nếu có
    if (fs.existsSync(csvPath)) {
        try {
            const content = fs.readFileSync(csvPath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            if (lines.length > 1) {
                const existingHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                    const row = {};
                    existingHeaders.forEach((header, index) => {
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

    // Loại bỏ duplicate (dựa trên cvText + jdText)
    const normalize = (text) => (text || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const existingKeys = new Set(
        existingData.map(row => `${normalize(row.cvText)}_${normalize(row.jdText)}`)
    );
    
    const uniqueNewPairs = newPairs.filter(pair => {
        const key = `${normalize(pair.cvText)}_${normalize(pair.jdText)}`;
        return !existingKeys.has(key);
    });

    if (uniqueNewPairs.length === 0) {
        console.log('ℹ️ Tất cả dữ liệu mới đã tồn tại trong CSV, không cần merge');
        return existingData.length;
    }

    // Merge
    const mergedData = [...existingData, ...uniqueNewPairs];
    
    // Ghi lại file
    const headerLine = headers.map(escapeCSV).join(',');
    const dataLines = mergedData.map(row =>
        headers.map(h => escapeCSV(row[h] ?? '')).join(',')
    );
    const csvContent = [headerLine, ...dataLines].join('\n');
    
    fs.writeFileSync(csvPath, csvContent, 'utf8');
    
    console.log(`✅ Đã merge ${uniqueNewPairs.length} dòng mới vào ${csvPath}`);
    console.log(`   Tổng: ${existingData.length} → ${mergedData.length} dòng`);
    
    return mergedData.length;
};

/**
 * Tự động sinh và lưu training data
 * @param {Object} options - { targetCount: 2500, outputPath: null, autoMerge: true }
 * @returns {Object} { success, pairsCount, message }
 */
const autoGenerateAndSaveTrainingData = async (options = {}) => {
    const {
        targetCount = 2500,
        outputPath = null,
        autoMerge = true
    } = options;

    try {
        const pairs = await generateTrainingData({ targetCount });

        if (pairs.length === 0) {
            return {
                success: false,
                pairsCount: 0,
                message: 'Không thể sinh dữ liệu training'
            };
        }

        // Determine output path
        const defaultPath = path.join(__dirname, '../../ml-grader/cv_matching_data.csv');
        const finalPath = outputPath || defaultPath;

        let totalRows;
        if (autoMerge && fs.existsSync(finalPath)) {
            totalRows = mergeTrainingDataToCSV(pairs, finalPath);
        } else {
            totalRows = saveTrainingDataToCSV(pairs, finalPath);
        }

        return {
            success: true,
            pairsCount: pairs.length,
            totalRows,
            message: `Đã sinh ${pairs.length} CV-JD pairs và lưu vào ${finalPath}`,
            outputPath: finalPath
        };
    } catch (error) {
        console.error('❌ Lỗi khi sinh training data:', error);
        return {
            success: false,
            pairsCount: 0,
            message: `Lỗi: ${error.message}`
        };
    }
};

module.exports = {
    generateCVJDPairs,
    generateTrainingData,
    saveTrainingDataToCSV,
    mergeTrainingDataToCSV,
    autoGenerateAndSaveTrainingData
};

