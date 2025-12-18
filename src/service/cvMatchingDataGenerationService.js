/**
 * CV MATCHING DATA GENERATION SERVICE
 * 
 * Service để tự động sinh dữ liệu training CV-JD matching bằng LLM
 * Sinh CV_text, JD_text, và score_ratio (0-1) trực tiếp
 */

const OpenAI = require('openai');
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

// For OpenAI v6 compatibility
const client = new OpenAI({
    baseURL: LM_STUDIO_URL + '/v1',
    apiKey: 'lm-studio',
});

// Add FormData polyfill for OpenAI v6
if (typeof FormData === 'undefined') {
    global.FormData = require('form-data');
}

/**
 * Parse JSON từ response của LLM (xử lý trường hợp có text thừa)
 */
const parseJSONSafe = (text) => {
    if (!text) return null;
    let cleaned = text.trim();
    
    // Loại bỏ markdown code block (```json ... ```)
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    
    try {
        return JSON.parse(cleaned);
    } catch {
        // Thử fix dấu phẩy thừa (trailing comma)
        cleaned = cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        try {
            return JSON.parse(cleaned);
        } catch {
            // Thử tìm JSON array trong text
            const arrayMatch = cleaned.match(/\[[\s\S]*/);
            if (arrayMatch) {
                let jsonStr = arrayMatch[0];
                
                // Nếu JSON bị cắt, thử extract các object hoàn chỉnh
                if (!jsonStr.endsWith(']')) {
                    // Tìm các object hoàn chỉnh trong array
                    const objects = [];
                    let depth = 0;
                    let inString = false;
                    let escapeNext = false;
                    let currentObj = '';
                    
                    for (let i = 1; i < jsonStr.length; i++) { // Bỏ qua '['
                        const char = jsonStr[i];
                        
                        if (escapeNext) {
                            currentObj += char;
                            escapeNext = false;
                            continue;
                        }
                        
                        if (char === '\\') {
                            escapeNext = true;
                            currentObj += char;
                            continue;
                        }
                        
                        if (char === '"') {
                            inString = !inString;
                            currentObj += char;
                            continue;
                        }
                        
                        if (inString) {
                            currentObj += char;
                            continue;
                        }
                        
                        if (char === '{') {
                            depth++;
                            currentObj += char;
                        } else if (char === '}') {
                            depth--;
                            currentObj += char;
                            if (depth === 0) {
                                // Object hoàn chỉnh
                                try {
                                    const fixed = currentObj.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
                                    const obj = JSON.parse(fixed);
                                    objects.push(obj);
                                } catch { /* ignore invalid object */ }
                                currentObj = '';
                                // Bỏ qua dấu phẩy và khoảng trắng sau object
                                while (i + 1 < jsonStr.length && (jsonStr[i + 1] === ',' || jsonStr[i + 1] === ' ' || jsonStr[i + 1] === '\n')) {
                                    i++;
                                }
                            } else {
                                currentObj += char;
                            }
                        } else {
                            currentObj += char;
                        }
                    }
                    
                    if (objects.length > 0) {
                        return objects;
                    }
                }
                
                // Thử parse array đã fix
                try {
                    jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
                    if (!jsonStr.endsWith(']')) jsonStr += ']';
                    return JSON.parse(jsonStr);
                } catch { /* ignore */ }
            }
            
            // Thử tìm JSON object
            const objMatch = cleaned.match(/\{[\s\S]*\}/);
            if (objMatch) {
                try {
                    const jsonStr = objMatch[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
                    return JSON.parse(jsonStr);
                } catch { /* ignore */ }
            }
        }
    }
    return null;
};

const countWords = (text) => (text || '').split(/\s+/).filter(Boolean).length;

/**
 * Kiểm tra text có bị lặp quá nhiều không (synthetic repetition)
 * @param {string} text - CV hoặc JD text
 * @returns {boolean} true nếu có repetition > 70%
 */
const hasExcessiveRepetition = (text) => {
    if (!text || text.length < 100) return false;
    
    // Tách thành các câu/đoạn
    const sentences = text.split(/[.!?。！？]\s*/).filter(s => s.trim().length > 20);
    if (sentences.length < 2) return false;

    // Chỉ so sánh các câu kề nhau (adjacent) để giảm O(n²) → O(n)
    for (let i = 0; i < sentences.length - 1; i++) {
        const s1 = sentences[i].toLowerCase().trim();
        const s2 = sentences[i + 1].toLowerCase().trim();
        
        // Tính similarity đơn giản (Jaccard similarity)
        const words1 = new Set(s1.split(/\s+/));
        const words2 = new Set(s2.split(/\s+/));
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        const similarity = intersection.size / union.size;
        
        if (similarity > 0.7) {
            return true; // Có 2 câu kề nhau giống >70%
        }
    }
    
    return false;
};

/**
 * Kiểm tra text có chứa language noise (Chinese, Japanese, etc.) không mong muốn
 * @param {string} text - CV hoặc JD text
 * @returns {boolean} true nếu có noise
 */
const hasLanguageNoise = (text) => {
    if (!text) return false;
    
    // Check Chinese/Japanese characters (trừ khi bạn cố tình bilingual)
    const chinesePattern = /[\u4e00-\u9fff\u3400-\u4dbf]/;
    if (chinesePattern.test(text)) {
        return true;
    }
    
    return false;
};

/**
 * Loại bỏ các sample bị "nhiễm prompt" / meta-instruction thay vì CV/JD thật
 */
const hasPromptLeak = (text) => {
    if (!text) return false;
    const t = text.toLowerCase();
    // Chỉ bắt các pattern RẤT ĐẶC TRƯNG prompt leak, tránh keyword generic
    const badPatterns = [
        'mở rộng cv',
        'mở rộng jd',
        'mở rộng cv của bạn',
        'mở rộng jd tuyển dụng',
        'tôi đã mở rộng cv',
        'tôi đã mở rộng jd',
        'dựa trên cv gốc', // Pattern từ CSV cũ
        'dựa trên jd gốc',
        'tôi sẽ tạo một summary', // Pattern từ CSV cũ
        'không trả về json',
        'trả về json',
        'format json',
        'bạn là trợ lý viết cv',
        'bạn là trợ lý viết jd',
        'bạn là trợ lý viết cv/jd',
    ];
    return badPatterns.some(pattern => t.includes(pattern));
};

/**
 * Nếu cvText/jdText quá ngắn, gọi LLM thêm 1 lần để mở rộng thành đoạn dài giống CV/JD thật.
 * Giúp đảm bảo text nhiều & đa dạng mà không làm fail cả batch.
 */
const expandTextIfShort = async (type, originalText, minWords) => {
    const currentWords = countWords(originalText);
    if (currentWords >= minWords) return originalText;

    const roleLabel = type === 'cv'
        ? 'CV của ứng viên (cvText)'
        : 'JD tuyển dụng (jdText)';

    const prompt = `Mở rộng ${roleLabel} sau đây thành văn bản dài, chi tiết, giống dữ liệu thật, tối thiểu ${minWords} từ.

Viết thành 2-4 đoạn rõ ràng, có câu đầy đủ. Giữ nguyên role/stack/level chính trong nội dung gốc.
${type === 'cv' 
    ? 'Với CV: thêm Summary, Work experience (2-3 job với bullet), Projects (2-3 dự án), Skills (8-15 kỹ năng), Education.'
    : 'Với JD: thêm Responsibilities (5-10 bullet), Requirements (years, tech stack, level), Preferred/Nice-to-have (3-5 bullet).'
}

Chỉ trả lại văn bản đã mở rộng, không thêm chú thích hay format JSON.

${roleLabel} gốc:
${originalText}

${roleLabel} đã mở rộng:`;

    try {
        const res = await client.chat.completions.create({
            model: LM_STUDIO_MODEL,
            messages: [
                {
                    role: 'system',
                    content: 'Bạn là trợ lý viết CV/JD, chuyên mở rộng nội dung ngắn thành văn bản dài, tự nhiên và chi tiết.'
                },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000
        });

        const expanded = (res.choices[0]?.message?.content || '').trim();
        if (!expanded) return originalText;

        const expandedWords = countWords(expanded);
        // Nếu LLM vẫn không đạt minWords, nhưng dài hơn bản gốc thì vẫn dùng để đỡ phí call
        if (expandedWords > currentWords) {
            return expanded;
        }
        return originalText;
    } catch (e) {
        console.warn(`⚠️ expandTextIfShort(${type}) failed, dùng lại text gốc:`, e.message);
        return originalText;
    }
};

/**
 * Heuristic helpers để phạt scoreRatio cho các case mismatch rõ
 */
const inferRole = (text) => {
    const t = (text || '').toLowerCase();
    // Ưu tiên fullstack trước để không bị dính frontend/backend sai
    if (t.includes('fullstack') || t.includes('full-stack') || t.includes('full stack')) return 'fullstack';
    if (t.includes('frontend')) return 'frontend';
    if (t.includes('back-end') || t.includes('backend')) return 'backend';
    if (t.includes('qa') || t.includes('tester') || t.includes('quality assurance')) return 'qa';
    if (t.includes('business analyst') || t.includes('ba ')) return 'ba';
    if (t.includes('marketing')) return 'marketing';
    return null;
};

const inferLevel = (text) => {
    const t = (text || '').toLowerCase();

    // Ưu tiên parse theo range "X-Y years" / "X–Y năm" (lấy min years)
    const rangeMatch = t.match(/(\d+)\s*[-–]\s*(\d+)\s*(years|year|năm)/);
    if (rangeMatch) {
        const minYears = parseInt(rangeMatch[1], 10);
        if (Number.isFinite(minYears)) {
            // Lấy min years để đại diện "require tối thiểu"
            if (minYears <= 1) return 1;      // Junior / Intern-ish
            if (minYears <= 3) return 2;      // Mid
            if (minYears <= 6) return 3;      // Senior
            return 4;                        // Lead+
        }
    }

    // Parse theo "X years" / "X năm" (single number)
    const yearsMatch = t.match(/(\d+)\s*(\+)?\s*(years|year|năm)/);
    if (yearsMatch) {
        const years = parseInt(yearsMatch[1], 10);
        if (Number.isFinite(years)) {
            if (years <= 1) return 1;      // Junior / Intern-ish
            if (years <= 3) return 2;      // Mid
            if (years <= 6) return 3;      // Senior
            return 4;                      // Lead+
        }
    }

    // Fallback theo keyword
    if (t.includes('intern') || t.includes('thực tập')) return 0;
    if (t.includes('junior')) return 1;
    if (t.includes('middle') || t.includes('mid-level') || t.includes('intermediate')) return 2;
    if (t.includes('senior')) return 3;
    if (t.includes('lead') || t.includes('principal') || t.includes('architect')) return 4;

    return 2; // mặc định mid nếu không rõ
};

const hasCommonStack = (a, b) => {
    const techKeywords = [
        'react', 'angular', 'vue', 'javascript', 'typescript',
        'node', 'node.js', 'express',
        'java', 'spring',
        'python', 'django', 'flask',
        'php', 'laravel',
        'dotnet', '.net',
        'kotlin', 'swift',
        'mysql', 'postgres', 'mongodb', 'redis'
    ];

    const tokenize = (text) =>
        (text || '')
            .toLowerCase()
            .split(/[^a-z0-9\.\+#]+/)
            .filter(Boolean);

    const tokensA = new Set(tokenize(a));
    const tokensB = new Set(tokenize(b));

    // Chuẩn hoá từ khoá để match theo token (tránh 'java' ăn vào 'javascript')
    const normalizeKeyword = (k) => {
        if (k === 'node.js') return 'node.js';
        if (k === '.net') return '.net';
        return k;
    };

    return techKeywords.some((k) => {
        const kw = normalizeKeyword(k);
        return tokensA.has(kw) && tokensB.has(kw);
    });
};

const clampScoreByHeuristics = (cvText, jdText, rawScore) => {
    let score = Math.max(0, Math.min(1, rawScore));

    const roleCv = inferRole(cvText);
    const roleJd = inferRole(jdText);
    const devRoles = ['frontend', 'backend', 'fullstack'];

    const isDevCv = roleCv && devRoles.includes(roleCv);
    const isDevJd = roleJd && devRoles.includes(roleJd);

    // A) CLAMP THEO ROLE (phạt mạnh hơn)
    if (roleCv && roleJd && roleCv !== roleJd) {
        if (isDevCv && isDevJd) {
            // Frontend ↔ Backend: mismatch nặng → max 0.25
            if (
                (roleCv === 'frontend' && roleJd === 'backend') ||
                (roleCv === 'backend' && roleJd === 'frontend')
            ) {
                score = Math.min(score, 0.25);
            } else {
                // Frontend/Backend ↔ Fullstack: partial → cho phép 0.35–0.70 (clamp max ~0.7)
                score = Math.min(score, 0.7);
            }
        } else {
            // Dev ↔ Non-dev (QA/BA/Marketing) → hard mismatch → max 0.20 (giảm từ 0.25)
            score = Math.min(score, 0.20);
        }
    }

    // B) PHẠT THEO CORE STACK (phạt mạnh hơn)
    // Nếu không có tech chung thì xem là lệch stack mạnh → max 0.40 (giảm từ 0.45)
    if (!hasCommonStack(cvText, jdText)) {
        score = Math.min(score, 0.40);
    }

    // C) PHẠT THEO LEVEL (phạt mạnh hơn)
    const levelCv = inferLevel(cvText);
    const levelJd = inferLevel(jdText);
    const diff = Math.abs(levelCv - levelJd);

    // Junior (<=1 năm) apply mid/senior → phạt mạnh
    if (levelCv <= 1 && levelJd >= 2) {
        // Junior vs Mid → trừ ~0.25 (tăng từ 0.2)
        if (diff === 1) {
            score = Math.max(0, score - 0.25);
        } else if (diff >= 2) {
            // Junior vs Senior/Lead → trừ mạnh hơn
            score = Math.max(0, score - 0.35); // tăng từ 0.3
        }
    } else if (diff === 1) {
        // Mid vs Senior → trừ nhẹ hơn
        score = Math.max(0, score - 0.15);
    } else if (diff >= 2) {
        // Level chênh >= 2 bậc → trừ mạnh
        score = Math.max(0, score - 0.3);
    }

    // D) PHẠT KẾT HỢP: Nếu vừa mismatch stack VÀ mismatch level → phạt gấp đôi
    if (!hasCommonStack(cvText, jdText) && diff >= 1) {
        score = Math.max(0, score - 0.15); // Phạt thêm
    }

    return score;
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
        // Delay giữa các attempt để tránh model crash
        if (attempt > 1) {
            await new Promise(r => setTimeout(r, 2000)); // 2 giây delay
        }
        try {
            const prompt = `Sinh 3 cặp CV-JD. MỖI CV là 1 ĐOẠN VĂN LIỀN MẠCH có đầy đủ sections: Summary, Work Experience, Projects, Skills, Education.

VÍ DỤ 1 CV HOÀN CHỈNH (200-400 ký tự):
"Frontend Developer - Full Stack

Summary:
Highly skilled frontend developer with 3 years experience. Skilled in JavaScript, HTML5, CSS3, React.js, Redux, Git, Node.js, Express.js, MongoDB, MySQL, responsive design.

Work Experience:
Frontend Developer at XYZ Inc., 2018 - Present
- Developed interactive web applications using React.js and Redux.
- Collaborated with backend developers to ensure seamless API integration.
- Improved performance and scalability of existing projects.

Projects:
- Implemented responsive e-commerce website, reduced load times by 40%.
- Developed interactive dashboard using React.js for real-time analytics.

Skills:
JavaScript, HTML5/CSS3, React.js/Redux, Git, Node.js/Express.js, MongoDB/MySQL, Responsive design

Education:
Bachelor of Science in Computer Science, University of California, 2014 - 2018"

VÍ DỤ 1 JD HOÀN CHỈNH (200-400 ký tự):
"Fullstack Developer - Junior

Responsibilities:
- Develop and maintain full-stack web applications using Node.js, React, Express.
- Collaborate with team to design, build, and deploy scalable solutions.
- Work on backend services, integrating APIs from third-party platforms.
- Implement security measures to protect data integrity.

Requirements:
- Bachelor's degree in Computer Science or related field.
- 2-3 years experience as Fullstack Developer.
- Proficiency with JavaScript, React.js, Node.js, Express.js.
- Familiarity with RESTful APIs, database management (MySQL, MongoDB).

Preferred:
- Experience in cloud environments (AWS or Azure).
- Knowledge of DevOps practices.
- Familiarity with microservices architecture."

QUAN TRỌNG:
1. Mỗi cvText LÀ 1 STRING DÀI (200-400 ký tự), CÓ ĐẦY ĐỦ Summary + Work Experience + Projects + Skills + Education
2. Mỗi jdText LÀ 1 STRING DÀI (200-400 ký tự), CÓ ĐẦY ĐỦ Responsibilities + Requirements + Preferred
3. KHÔNG ĐƯỢC TÁCH CV THÀNH NHIỀU ĐOẠN NHỎ - MỖI CV PHẢI LÀ 1 ĐOẠN VĂN LIỀN MẠCH
4. KHÔNG ĐƯỢC BẮT ĐẦU BẰNG "Dựa trên CV gốc" hoặc "Tôi sẽ tạo" - PHẢI LÀ CV/JD THẬT

Scoring: Match role+stack+level → 0.85-0.95. Lệch role/stack rõ → 0.05-0.25. Junior vs mid/senior → 0.25-0.40.

Trả JSON array 3 cặp:
[
  {"cvText": "Summary:... Work Experience:... Projects:... Skills:... Education:...", "jdText": "Role... Responsibilities:... Requirements:... Preferred:...", "scoreRatio": 0.85}
]

Category: ${category}`;

            const res = await client.chat.completions.create({
                model: LM_STUDIO_MODEL,
                messages: [
                    { 
                        role: 'system', 
                        content: `Sinh 3 cặp CV-JD. Mỗi cvText là 1 STRING DÀI 200-400 ký tự có đầy đủ Summary, Work Experience, Projects, Skills, Education. Mỗi jdText là 1 STRING DÀI 200-400 ký tự có đầy đủ Responsibilities, Requirements, Preferred. KHÔNG bắt đầu bằng "Dựa trên CV gốc" hoặc "Tôi sẽ tạo". Trả JSON array.` 
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 5000 // Tăng lên để đủ chỗ cho 3 cặp dài
            });

            const text = res.choices[0]?.message?.content || '';
            console.log(`🔍 LLM Response (attempt ${attempt}):`, text.substring(0, 1000) + '...');

            const parsed = parseJSONSafe(text);

            if (!Array.isArray(parsed) || parsed.length === 0) {
                console.log('❌ Parse failed, trying to extract JSON from response...');
                throw new Error('LLM không trả về mảng hợp lệ');
            }

            console.log(`📊 Parsed ${parsed.length} items from LLM response`);

            // Bước 1: Validate và normalize data (TẮT EXPAND - reject ngắn + regen)
            const expandedPairs = [];
            parsed.forEach((item) => {
                // Handle cả format string và array
                let cvText = item.cvText || item.cv || '';
                let jdText = item.jdText || item.jd || '';
                
                // Nếu cv/jd là array of objects → flatten thành string
                if (Array.isArray(cvText)) {
                    cvText = cvText.map(obj => {
                        if (typeof obj === 'object' && obj !== null) {
                            return Object.values(obj).join('\n');
                        }
                        return String(obj);
                    }).join('\n\n');
                }
                if (Array.isArray(jdText)) {
                    jdText = jdText.map(obj => {
                        if (typeof obj === 'object' && obj !== null) {
                            return Object.values(obj).join('\n');
                        }
                        return String(obj);
                    }).join('\n\n');
                }
                
                cvText = String(cvText).trim();
                jdText = String(jdText).trim();
                const rawScore = parseFloat(item.scoreRatio || item.score || 0);
                expandedPairs.push({ cvText, jdText, rawScore });
            });

            // Bước 2: Validate và normalize data với logging chi tiết
            const validPairs = expandedPairs
                .filter((item, index) => {
                    const { cvText, jdText, rawScore } = item;
                    const reasons = [];

                    // Quality Gate Phase 1: Basic validation
                    if (!cvText) reasons.push('cvText empty');
                    if (!jdText) reasons.push('jdText empty');
                    if (hasPromptLeak(cvText)) reasons.push('cvText has prompt leak');
                    if (hasPromptLeak(jdText)) reasons.push('jdText has prompt leak');
                    if (hasLanguageNoise(cvText)) reasons.push('cvText has language noise');
                    if (hasLanguageNoise(jdText)) reasons.push('jdText has language noise');
                    if (hasExcessiveRepetition(cvText)) reasons.push('cvText has excessive repetition');
                    if (hasExcessiveRepetition(jdText)) reasons.push('jdText has excessive repetition');
                    if (Number.isNaN(rawScore)) reasons.push('score is NaN');
                    if (rawScore < 0 || rawScore > 1) reasons.push(`score out of range: ${rawScore}`);
                    // Giảm yêu cầu độ dài xuống 50 ký tự (linh hoạt hơn cho model nhỏ, phù hợp với dữ liệu cũ)
                    if (cvText.length < 50) reasons.push(`cvText too short: ${cvText.length} < 50`);
                    if (jdText.length < 50) reasons.push(`jdText too short: ${jdText.length} < 50`);

                    // Quality Gate Phase 1.5: Section check (linh hoạt - yêu cầu ít nhất 3/5 sections cho CV, 2/3 cho JD - phù hợp với dữ liệu cũ)
                    const cvLower = cvText.toLowerCase();
                    const jdLower = jdText.toLowerCase();
                    
                    // Check CV sections - cần ít nhất 3/5 sections (linh hoạt hơn)
                    const cvSections = [
                        cvLower.includes('summary') || cvLower.includes('tóm tắt'),
                        cvLower.includes('work experience') || cvLower.includes('kinh nghiệm') || cvLower.includes('experience'),
                        cvLower.includes('projects') || cvLower.includes('dự án') || cvLower.includes('project'),
                        cvLower.includes('skills') || cvLower.includes('kỹ năng') || cvLower.includes('skill'),
                        cvLower.includes('education') || cvLower.includes('học vấn') || cvLower.includes('edu')
                    ];
                    const cvSectionsCount = cvSections.filter(Boolean).length;
                    
                    // Yêu cầu ít nhất 3/5 sections (linh hoạt hơn, phù hợp với dữ liệu cũ)
                    if (cvSectionsCount < 3) {
                        const missing = [];
                        if (!cvSections[0]) missing.push('Summary');
                        if (!cvSections[1]) missing.push('Work Experience');
                        if (!cvSections[2]) missing.push('Projects');
                        if (!cvSections[3]) missing.push('Skills');
                        if (!cvSections[4]) missing.push('Education');
                        reasons.push(`CV thiếu quá nhiều sections (có ${cvSectionsCount}/5): ${missing.join(', ')}`);
                    }

                    // Check JD sections - cần ít nhất 2/3 sections
                    const jdSections = [
                        jdLower.includes('responsibilities') || jdLower.includes('mô tả công việc') || jdLower.includes('responsibility'),
                        jdLower.includes('requirements') || jdLower.includes('yêu cầu') || jdLower.includes('requirement'),
                        jdLower.includes('preferred') || jdLower.includes('ưu tiên') || jdLower.includes('nice-to-have')
                    ];
                    const jdSectionsCount = jdSections.filter(Boolean).length;
                    
                    if (jdSectionsCount < 2) {
                        const missing = [];
                        if (!jdSections[0]) missing.push('Responsibilities');
                        if (!jdSections[1]) missing.push('Requirements');
                        if (!jdSections[2]) missing.push('Preferred');
                        reasons.push(`JD thiếu quá nhiều sections (có ${jdSectionsCount}/3): ${missing.join(', ')}`);
                    }

                    // Quality Gate Phase 2: Score validation sau khi clamp
                    const clampedScore = clampScoreByHeuristics(cvText, jdText, rawScore);
                    const roleCv = inferRole(cvText);
                    const roleJd = inferRole(jdText);
                    const levelCv = inferLevel(cvText);
                    const levelJd = inferLevel(jdText);
                    const hasCommon = hasCommonStack(cvText, jdText);

                    // Rule: role mismatch mà score > 0.25 → reject
                    if (roleCv && roleJd && roleCv !== roleJd) {
                        const devRoles = ['frontend', 'backend', 'fullstack'];
                        const isDevCv = devRoles.includes(roleCv);
                        const isDevJd = devRoles.includes(roleJd);
                        
                        if (!isDevCv || !isDevJd) {
                            // Dev vs Non-dev → max 0.20
                            if (clampedScore > 0.20) {
                                reasons.push(`role mismatch (${roleCv} vs ${roleJd}) but score too high: ${clampedScore.toFixed(2)}`);
                            }
                        } else if (
                            (roleCv === 'frontend' && roleJd === 'backend') ||
                            (roleCv === 'backend' && roleJd === 'frontend')
                        ) {
                            // FE vs BE → max 0.25
                            if (clampedScore > 0.25) {
                                reasons.push(`role mismatch (${roleCv} vs ${roleJd}) but score too high: ${clampedScore.toFixed(2)}`);
                            }
                        }
                    }

                    // Rule: no common stack mà score > 0.40 → reject
                    if (!hasCommon && clampedScore > 0.40) {
                        reasons.push(`no common stack but score too high: ${clampedScore.toFixed(2)}`);
                    }

                    // Rule: junior (<=1 năm) apply mid/senior mà score > 0.40 → reject
                    if (levelCv <= 1 && levelJd >= 2 && clampedScore > 0.40) {
                        reasons.push(`junior (${levelCv}) apply mid/senior (${levelJd}) but score too high: ${clampedScore.toFixed(2)}`);
                    }

                    if (reasons.length > 0) {
                        console.log(`  ❌ Reject sample ${index + 1}: ${reasons.join(', ')}`);
                        console.log(`     CV preview: ${cvText.substring(0, 80)}...`);
                        console.log(`     JD preview: ${jdText.substring(0, 80)}...`);
                        return false;
                    }

                    return true;
                })
                .map(item => {
                    const { cvText, jdText, rawScore } = item;
                    const scoreRatio = clampScoreByHeuristics(cvText, jdText, rawScore);

                    return { cvText, jdText, scoreRatio };
                });

            console.log(`✅ Got ${validPairs.length} valid pairs after quality gate & scoring`);

            // Với model nhỏ (1.5B), đôi khi không sinh đủ 3 cặp hợp lệ
            if (validPairs.length === 0) {
                throw new Error('LLM không sinh được cặp hợp lệ nào.');
            }
            if (validPairs.length < 2) {
                console.warn(`⚠️ LLM chỉ sinh được ${validPairs.length} cặp hợp lệ (kỳ vọng 3). Vẫn dùng những cặp này.`);
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
 * Sinh nhiều batches CV-JD pairs
 * (Mặc định để test rất nhanh: targetCount ~ 5)
 * @param {Object} options - { targetCount: 5, batchesPerCategory: 1 }
 * @returns {Array} Array of all CV-JD pairs
 */
const generateTrainingData = async (options = {}) => {
    const {
        targetCount = 5,
        delayBetweenBatches = 200 // Giảm delay xuống 200ms (từ 500ms) để tăng tốc
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

    // Ước lượng mỗi batch sinh được khoảng 2 pairs hợp lệ (vì giờ sinh 3 cặp/batch, sau filter còn ~2)
    const expectedPerBatch = 2;
    const neededBatches = Math.ceil(targetCount / expectedPerBatch);
    const maxBatches = neededBatches * 3; // dư ra nhiều để tránh thiếu do filter

    while (allPairs.length < targetCount && batchCount < maxBatches) {
        const category = categories[batchCount % categories.length];
        batchCount += 1;

        try {
            console.log(`  📝 Batch ${batchCount}/${maxBatches}: Category=${category}`);
            const pairs = await generateCVJDPairs({
                category,
                seed: batchCount * 1000
            });

            allPairs.push(...pairs);
            console.log(`    ✅ Sinh được ${pairs.length} pairs (Tổng: ${allPairs.length}/${targetCount})`);

            if (allPairs.length >= targetCount) {
                console.log(`🎯 Đã đạt target ${targetCount} pairs!`);
                break;
            }

            // Chỉ delay nếu chưa đủ target (tránh delay không cần thiết ở batch cuối)
            if (allPairs.length < targetCount && batchCount < maxBatches) {
                await new Promise(r => setTimeout(r, delayBetweenBatches));
            }
        } catch (err) {
            console.warn(`  ⚠️ Lỗi sinh batch ${batchCount}:`, err.message);
            // Delay ngắn khi có lỗi để tránh spam
            await new Promise(r => setTimeout(r, 100));
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

            // CSV parser đơn giản, hỗ trợ quote + dấu phẩy + xuống dòng
            const rows = [];
            let row = [];
            let field = '';
            let inQuotes = false;

            for (let i = 0; i < content.length; i++) {
                const c = content[i];

                if (inQuotes) {
                    if (c === '"') {
                        if (content[i + 1] === '"') {
                            field += '"';
                            i++;
                        } else {
                            inQuotes = false;
                        }
                    } else {
                        field += c;
                    }
                } else {
                    if (c === '"') {
                        inQuotes = true;
                    } else if (c === ',') {
                        row.push(field);
                        field = '';
                    } else if (c === '\r') {
                        // bỏ qua
                    } else if (c === '\n') {
                        row.push(field);
                        rows.push(row);
                        row = [];
                        field = '';
                    } else {
                        field += c;
                    }
                }
            }
            if (field.length > 0 || row.length > 0) {
                row.push(field);
                rows.push(row);
            }

            if (rows.length > 1) {
                const existingHeaders = rows[0].map(h => h.trim().replace(/^"|"$/g, ''));
                for (let i = 1; i < rows.length; i++) {
                    const values = rows[i].map(v => (v ?? '').trim());
                    const rowObj = {};
                    existingHeaders.forEach((header, index) => {
                        rowObj[header] = values[index] || '';
                    });
                    existingData.push(rowObj);
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

        // Determine output path (ml-grader nằm cùng cấp với backend)
        const defaultPath = path.join(__dirname, '../../../ml-grader/cv_matching_data.csv');
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

