/**
 * CV Review Service
 * Service để AI review CV dựa trên CV standards và scoring rubric
 * Sử dụng LLM Studio (Qwen 2.5 7B Instruct) để phân tích CV
 */

import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

// Helper to get data directory path
// Use process.cwd() to get project root, then resolve relative to backend/src/service
function getDataPath(filename) {
    // Try to use __dirname if available (Babel might inject it)
    try {
        // eslint-disable-next-line no-undef
        if (typeof __dirname !== 'undefined') {
            // eslint-disable-next-line no-undef
            return path.join(__dirname, '..', 'data', filename);
        }
    } catch (e) {
        // __dirname not available, use process.cwd()
    }
    // Fallback: resolve from process.cwd() (project root)
    return path.resolve(process.cwd(), 'backend/src/data', filename);
}

// Polyfill fetch cho Node < 18
// Use lazy loading with require() since Babel transpiles to CommonJS
let fetchPolyfillLoaded = false;
function loadFetchPolyfill() {
    if (fetchPolyfillLoaded || typeof fetch !== 'undefined') {
        return;
    }
    
    try {
        // Try @whatwg-node/fetch first
        const { fetch: whatwgFetch, Headers: WhatwgHeaders, Request: WhatwgRequest, Response: WhatwgResponse } = require('@whatwg-node/fetch');
        global.fetch = whatwgFetch;
        global.Headers = WhatwgHeaders;
        global.Request = WhatwgRequest;
        global.Response = WhatwgResponse;
        console.log('✅ Using @whatwg-node/fetch polyfill');
        fetchPolyfillLoaded = true;
    } catch (whatwgError) {
        // Fallback to node-fetch
        try {
            const nodeFetch = require('node-fetch');
            global.fetch = nodeFetch.default || nodeFetch;
            global.Headers = nodeFetch.Headers;
            global.Request = nodeFetch.Request;
            global.Response = nodeFetch.Response;
            console.log('✅ Using node-fetch polyfill for fetch API');
            fetchPolyfillLoaded = true;
            
            // Try to use FormData from @whatwg-node/fetch even if fetch failed
            try {
                const { FormData: WhatwgFormData } = require('@whatwg-node/fetch');
                global.FormData = WhatwgFormData;
                console.log('✅ Using @whatwg-node/fetch FormData polyfill');
            } catch (formDataError) {
                // Last resort: use form-data package
                try {
                    const FormDataPolyfill = require('form-data');
                    global.FormData = FormDataPolyfill;
                    console.log('✅ Using form-data polyfill for FormData API');
                } catch (e) {
                    console.warn('⚠️  Could not load FormData polyfill');
                }
            }
        } catch (error) {
            console.error('❌ Failed to load fetch/FormData polyfills.');
            console.error('   Please install: npm install @whatwg-node/fetch');
            console.error('   Or: npm install node-fetch@2 form-data');
            console.error('   Or upgrade Node.js to version 18+ which has built-in fetch and FormData');
        }
    }
}

// Load polyfill immediately if fetch is not available
if (typeof fetch === 'undefined' || typeof Headers === 'undefined') {
    loadFetchPolyfill();
}

// LM Studio configuration
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://127.0.0.1:1234';
// For 16GB RAM CPU: Use qwen2.5-7b-instruct (recommended) or qwen2.5-1.5b-instruct (faster)
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL || 'qwen2.5-7b-instruct';

// Initialize OpenAI client for LM Studio
// Set timeout to 10 minutes (600000ms) for CV review (can take 5-10 minutes)
const openai = new OpenAI({
    baseURL: LM_STUDIO_URL + '/v1',
    apiKey: 'lm-studio',
    fetch: global.fetch,
    timeout: 600000, // 10 minutes timeout
});

/**
 * Parse JSON from LLM response (handle reasoning tags, markdown, etc.)
 */
function parseJSONFromResponse(responseText) {
    if (!responseText) return null;
    
    let cleaned = responseText.trim();
    
    // Remove reasoning tags
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/redacted_reasoning>/gi, '');
    cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    
    // Remove markdown code blocks
    cleaned = cleaned.replace(/```json\n?/gi, '');
    cleaned = cleaned.replace(/```\n?/g, '');
    
    // Remove common prefixes
    cleaned = cleaned.replace(/^Here is the JSON[:\s]*/i, '');
    cleaned = cleaned.replace(/^JSON[:\s]*/i, '');
    cleaned = cleaned.replace(/^Response[:\s]*/i, '');
    
    // Try to find JSON object
    const firstBraceObj = cleaned.indexOf('{');
    const lastBraceObj = cleaned.lastIndexOf('}');
    
    if (firstBraceObj !== -1 && lastBraceObj !== -1 && lastBraceObj > firstBraceObj) {
        let jsonString = cleaned.substring(firstBraceObj, lastBraceObj + 1);
        
        // Try to fix common JSON issues
        // Remove trailing commas before closing bracket
        jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
        
        try {
            const parsed = JSON.parse(jsonString);
            return parsed;
        } catch (error) {
            console.warn(`  ⚠️ JSON parse error (object): ${error.message}`);
            console.warn(`  📝 Attempted to parse (${jsonString.length} chars): ${jsonString.substring(0, 300)}...`);
            // Try to extract valid JSON using regex as fallback
            const objMatch = jsonString.match(/\{[\s\S]*\}/);
            if (objMatch) {
                try {
                    const fixed = objMatch[0].replace(/,(\s*[}\]])/g, '$1');
                    return JSON.parse(fixed);
                } catch (e) {
                    console.warn(`  ⚠️ Regex extract also failed: ${e.message}`);
                }
            }
        }
    }
    
    return null;
}

/**
 * Load CV standards from JSON file
 */
function loadCVStandards() {
    try {
        const standardsPath = getDataPath('cv_standards.json');
        const standardsContent = fs.readFileSync(standardsPath, 'utf-8');
        return JSON.parse(standardsContent);
    } catch (error) {
        console.error('❌ Error loading CV standards:', error);
        throw new Error('Không thể load CV standards!');
    }
}

/**
 * Load CV scoring rubric from JSON file
 */
function loadCVScoring() {
    try {
        const scoringPath = getDataPath('cv_scoring.json');
        const scoringContent = fs.readFileSync(scoringPath, 'utf-8');
        return JSON.parse(scoringContent);
    } catch (error) {
        console.error('❌ Error loading CV scoring:', error);
        throw new Error('Không thể load CV scoring rubric!');
    }
}

/**
 * Load CV examples from JSON file (for few-shot learning)
 */
function loadCVExamples() {
    try {
        const examplesPath = getDataPath('cv_examples.json');
        if (!fs.existsSync(examplesPath)) {
            console.warn('⚠️  CV examples file not found, skipping few-shot examples');
            return null;
        }
        const examplesContent = fs.readFileSync(examplesPath, 'utf-8');
        const parsed = JSON.parse(examplesContent);
        return parsed.examples || [];
    } catch (error) {
        console.warn('⚠️  Error loading CV examples:', error.message);
        return null;
    }
}

/**
 * Detect language of CV text (Vietnamese or English)
 * Returns 'vi' for Vietnamese, 'en' for English
 */
function detectLanguage(text) {
    if (!text || text.trim().length === 0) {
        return 'en'; // Default to English
    }

    // Vietnamese characters (with diacritics)
    const vietnameseChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi;
    const vietnameseWords = ['và', 'của', 'cho', 'với', 'được', 'trong', 'từ', 'này', 'đã', 'một', 'các', 'là', 'có', 'để', 'sẽ', 'khi', 'nếu', 'hoặc', 'nhưng', 'vì', 'nên', 'thì', 'mà', 'đến', 'về', 'theo', 'sau', 'trước', 'trên', 'dưới', 'ngoài', 'trong', 'giữa', 'bên', 'phải', 'trái', 'trên', 'dưới'];
    
    // Count Vietnamese characters
    const vietnameseCharMatches = (text.match(vietnameseChars) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    const vietnameseCharRatio = totalChars > 0 ? vietnameseCharMatches / totalChars : 0;
    
    // Count Vietnamese words
    const lowerText = text.toLowerCase();
    let vietnameseWordCount = 0;
    vietnameseWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = lowerText.match(regex);
        if (matches) vietnameseWordCount += matches.length;
    });
    
    // Heuristic: If > 5% Vietnamese characters OR > 3 Vietnamese words, consider it Vietnamese
    const isVietnamese = vietnameseCharRatio > 0.05 || vietnameseWordCount > 3;
    
    return isVietnamese ? 'vi' : 'en';
}

/**
 * Detect role from CV text (Mobile, Backend, Frontend, etc.)
 * Returns role string or null
 */
function detectCVRole(text) {
    if (!text) return null;
    const t = text.toLowerCase();
    
    // Ưu tiên fullstack trước để không bị dính frontend/backend sai
    if (t.includes('fullstack') || t.includes('full-stack') || t.includes('full stack')) return 'fullstack';
    if (t.includes('mobile') || t.includes('flutter') || t.includes('react native') || t.includes('swift') || t.includes('kotlin')) return 'mobile';
    if (t.includes('frontend') || t.includes('front-end') || t.includes('react') || t.includes('vue') || t.includes('angular')) return 'frontend';
    if (t.includes('back-end') || t.includes('backend') || t.includes('node.js') || t.includes('spring') || t.includes('django')) return 'backend';
    
    return null;
}

/**
 * Anonymize CV name for academic reporting
 * Converts "CV 1 - LINHNGUYỄN (Mobile)" to "Candidate_001 (Mobile)"
 */
function anonymizeCVName(cvExample) {
    const id = cvExample.id || 0;
    const role = detectCVRole(cvExample.cv_text || cvExample.name || '') || 'Unknown';
    return `Candidate_${String(id).padStart(3, '0')} (${role.charAt(0).toUpperCase() + role.slice(1)})`;
}

/**
 * Select relevant CV examples based on role and available tokens
 * Returns array of selected examples
 */
function selectCVExamples(cvExamples, cvRole, availableTokens) {
    if (!cvExamples || cvExamples.length === 0) return [];
    
    // Calculate how many examples we can include
    // Each example needs ~200-300 tokens, reserve some buffer
    const tokensPerExample = 250; // Average tokens per example
    const maxExamples = Math.min(
        Math.floor(availableTokens / tokensPerExample), // Based on available tokens
        3, // Max 3 examples to avoid prompt too long
        cvExamples.length // Don't exceed available examples
    );
    
    if (maxExamples <= 0) return [];
    
    // Strategy: Select examples that match the CV's role first, then diversify
    let selected = [];
    const usedIds = new Set();
    
    // Step 1: Try to find examples matching the CV's role
    if (cvRole) {
        const roleMatches = cvExamples.filter(ex => {
            const exRole = detectCVRole(ex.cv_text || ex.name || '');
            return exRole === cvRole && !usedIds.has(ex.id);
        });
        
        // Take 1-2 examples matching role
        const roleCount = Math.min(roleMatches.length, Math.max(1, Math.floor(maxExamples / 2)));
        selected.push(...roleMatches.slice(0, roleCount));
        roleMatches.slice(0, roleCount).forEach(ex => usedIds.add(ex.id));
    }
    
    // Step 2: Add diverse examples (different roles) if we have space
    if (selected.length < maxExamples) {
        const diverseExamples = cvExamples.filter(ex => !usedIds.has(ex.id));
        const remaining = maxExamples - selected.length;
        selected.push(...diverseExamples.slice(0, remaining));
    }
    
    // Step 3: If still not enough, fill with any remaining examples
    if (selected.length < maxExamples) {
        const remaining = cvExamples.filter(ex => !usedIds.has(ex.id));
        selected.push(...remaining.slice(0, maxExamples - selected.length));
    }
    
    return selected.slice(0, maxExamples);
}

/**
 * Estimate token count (rough: 1 token ≈ 4 characters)
 */
function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}

/**
 * Truncate text to max tokens
 */
function truncateToTokens(text, maxTokens) {
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) return text;
    return text.substring(0, maxChars) + '...';
}

/**
 * Build prompt for LLM
 * Optimized to fit within context window (4096 tokens)
 */
function buildPrompt(cvText, jdTexts, cvStandards, cvScoring, cvExamples = null, language = 'en') {
    // Detect language if not provided
    const cvLanguage = language || detectLanguage(cvText);
    
    // Language-specific instructions
    const languageInstruction = cvLanguage === 'vi' 
        ? 'IMPORTANT: CV is in Vietnamese. All responses (suggestion, summary) must be in Vietnamese (Tiếng Việt).'
        : 'IMPORTANT: CV is in English. All responses (suggestion, summary) must be in English.';
    
    // Shortened system prompt to save tokens
    const systemPrompt = `You are an AI CV reviewer. Help candidates IMPROVE their CV, don't create new content.
Rules: Only suggest improvements to existing content. Don't invent experiences/skills. Return JSON only.

CRITICAL: When you find an issue, you MUST extract the exact_quote (verbatim text) from the CV. 
- exact_quote must match the original text character-by-character (no paraphrasing, no fixing typos, no rewriting)
- If the issue is general (no specific text), set exact_quote to null
- This is required for frontend to highlight the exact location in the PDF
${languageInstruction}`;

    // Truncate CV text (max ~1500 tokens = 6000 chars)
    const MAX_CV_TOKENS = 1500;
    const truncatedCV = truncateToTokens(cvText, MAX_CV_TOKENS);
    if (cvText.length > truncatedCV.length) {
        console.warn(`⚠️  CV text truncated from ${cvText.length} to ${truncatedCV.length} chars to fit context window`);
    }

    // Truncate JD texts (max ~300 tokens each = 1200 chars each)
    const MAX_JD_TOKENS = 300;
    let jdSection = '';
    if (jdTexts && jdTexts.length > 0) {
        jdSection = '\n\n=== JOB DESCRIPTIONS ===\n';
        jdTexts.forEach((jd, index) => {
            const truncatedJD = truncateToTokens(jd, MAX_JD_TOKENS);
            jdSection += `\n[JD ${index + 1}]\n${truncatedJD}\n`;
            if (jd.length > truncatedJD.length) {
                console.warn(`⚠️  JD ${index + 1} truncated from ${jd.length} to ${truncatedJD.length} chars`);
            }
        });
    } else {
        jdSection = '\n\n=== JOB DESCRIPTIONS ===\nNo job descriptions provided.';
    }

    // Include reference CVs for few-shot learning (in-context learning)
    // Purpose: Guide AI evaluation style (score calibration, issue severity, wording style)
    let examplesSection = '';
    // Estimate current prompt size first
    const currentPromptSize = estimateTokens(systemPrompt + truncatedCV + jdSection + JSON.stringify(cvStandards) + JSON.stringify(cvScoring));
    const availableTokens = 4096 - currentPromptSize - 1500; // Reserve 1500 for response
    
    if (cvExamples && cvExamples.length > 0) {
        // Detect CV role to select relevant examples
        const cvRole = detectCVRole(cvText);
        if (cvRole) {
            console.log(`🎯 Detected candidate CV role: ${cvRole.charAt(0).toUpperCase() + cvRole.slice(1)}`);
        }
        
        // Select multiple relevant reference CVs (up to 3, based on available tokens)
        const selectedExamples = selectCVExamples(cvExamples, cvRole, availableTokens);
        
        if (selectedExamples.length > 0) {
            examplesSection = '\n\n=== REFERENCE CVs (For Evaluation Style Guidance) ===\n';
            const tokensPerExample = Math.floor(availableTokens * 0.25 / selectedExamples.length); // Distribute tokens evenly
            
            selectedExamples.forEach((example, index) => {
                const exampleText = truncateToTokens(example.cv_text, tokensPerExample);
                const exRole = detectCVRole(example.cv_text || example.name || '') || 'Unknown';
                const anonymizedName = anonymizeCVName(example);
                // Note: Score is for calibration reference, not for direct learning
                examplesSection += `\n[Reference CV ${index + 1} - ${anonymizedName} - Calibration Score: ${example.expected_score || 'N/A'}]\n${exampleText}...\n`;
            });
            
            const anonymizedNames = selectedExamples.map(ex => anonymizeCVName(ex)).join(', ');
            const roles = [...new Set(selectedExamples.map(ex => detectCVRole(ex.cv_text || ex.name || '') || 'Unknown'))].join('/');
            console.log(`✅ Selected ${selectedExamples.length} reference CV(s) for in-context learning: ${anonymizedNames}`);
            console.log(`   Purpose: Guide evaluation style (score calibration, issue severity, wording patterns)`);
            console.log(`   Role distribution: ${roles}`);
        } else {
            console.warn(`⚠️  Reference CVs NOT included - insufficient tokens (available: ${availableTokens}, needed: >250)`);
        }
    } else {
        console.warn(`⚠️  No reference CV dataset available - in-context learning disabled`);
    }

    // Language-specific example
    const exampleSuggestion = cvLanguage === 'vi'
        ? '"Chỉ rõ công nghệ (ví dụ: Node.js) và kết quả (ví dụ: cải thiện thời gian phản hồi 40%)"'
        : '"Specify technologies (e.g., Node.js) and measurable results (e.g., improved API response time by 40%)"';
    
    const exampleSummary = cvLanguage === 'vi'
        ? '"Tóm tắt ngắn gọn bằng tiếng Việt"'
        : '"Brief summary in English"';

    // Shortened user prompt to save tokens
    const userPrompt = `CV Standards:
${JSON.stringify(cvStandards, null, 1)}

Scoring Rubric:
${JSON.stringify(cvScoring, null, 1)}
${examplesSection}
Candidate CV:
${truncatedCV}
${jdSection}

${languageInstruction}

Tasks:
1. Evaluate CV against each rubric criterion and assign scores (0 to max weight for each criterion)
2. Check format issues → suggest improvements to existing content
3. Compare CV with JD → suggest how to better present existing content
4. For each issue: section, exact_quote (verbatim text from CV - must match character-by-character, or null if general issue), suggestion (how to improve in ${cvLanguage === 'vi' ? 'Vietnamese' : 'English'}), severity (low/medium/high)
5. ready = true if total score >= 80 and no high severity issues

IMPORTANT: Return criteria_scores for each rubric criterion (summary, skills, experience, education, format, job_matching).
Each score should be 0 to the max weight of that criterion (see rubric weights).
Backend will calculate total percentage from these scores.

Return JSON only (suggestion and summary must be in ${cvLanguage === 'vi' ? 'Vietnamese' : 'English'}):
{
  "criteria_scores": {
    "summary": 12,
    "skills": 16,
    "experience": 22,
    "education": 8,
    "format": 10,
    "job_matching": 7
  },
  "ready": false,
  "issues": [{"section": "experience", "exact_quote": "Worked on backend", "suggestion": ${exampleSuggestion}, "severity": "high"}],
  "summary": ${exampleSummary}
}`;

    return { systemPrompt, userPrompt };
}

/**
 * Review CV using LLM
 */
export async function reviewCV(cvText, jdTexts = []) {
    const startTime = Date.now();
    let stepStartTime = startTime;
    
    try {
        console.log('📋 Starting CV review...');
        console.log(`   CV length: ${cvText.length} characters`);
        console.log(`   JD count: ${jdTexts.length}`);

        // Validate inputs
        if (!cvText || cvText.trim().length === 0) {
            throw new Error('CV text không được để trống!');
        }

        // Limit JD texts to 5
        const jdTextsLimited = jdTexts.slice(0, 5);
        if (jdTexts.length > 5) {
            console.warn(`⚠️  Chỉ sử dụng 5 JD đầu tiên (tổng ${jdTexts.length} JD)`);
        }

        // Load CV standards, scoring, and examples
        stepStartTime = Date.now();
        const cvStandards = loadCVStandards();
        const cvScoring = loadCVScoring();
        const cvExamples = loadCVExamples();
        const loadTime = Date.now() - stepStartTime;
        console.log(`⏱️  Load standards/scoring/examples: ${loadTime}ms`);
        
        // Log reference CV dataset info (for academic reporting)
        if (cvExamples && cvExamples.length > 0) {
            // Count by role for reporting
            const roleCounts = {};
            cvExamples.forEach(ex => {
                const role = detectCVRole(ex.cv_text || ex.name || '') || 'Unknown';
                roleCounts[role] = (roleCounts[role] || 0) + 1;
            });
            const roleSummary = Object.entries(roleCounts)
                .map(([role, count]) => `${role.charAt(0).toUpperCase() + role.slice(1)}: ${count}`)
                .join(', ');
            
            console.log(`📚 Loaded ${cvExamples.length} reference CVs from curated dataset`);
            console.log(`   Role distribution: ${roleSummary}`);
            console.log(`   Note: All candidate names anonymized for research purposes`);
        } else {
            console.warn(`⚠️  No reference CV dataset found! In-context learning disabled.`);
        }

        // Detect CV language
        const cvLanguage = detectLanguage(cvText);
        console.log(`🌐 Detected CV language: ${cvLanguage === 'vi' ? 'Vietnamese' : 'English'}`);

        // Build prompt (include reference CVs for in-context learning)
        stepStartTime = Date.now();
        const { systemPrompt, userPrompt } = buildPrompt(cvText, jdTextsLimited, cvStandards, cvScoring, cvExamples, cvLanguage);
        const buildPromptTime = Date.now() - stepStartTime;
        console.log(`⏱️  Build prompt: ${buildPromptTime}ms`);

        console.log('🤖 Calling LLM Studio...');
        console.log(`   Model: ${LM_STUDIO_MODEL}`);
        console.log(`   URL: ${LM_STUDIO_URL}`);

        // Estimate prompt size
        const promptSize = estimateTokens(systemPrompt + userPrompt);
        console.log(`   Estimated prompt size: ~${promptSize} tokens`);
        console.log(`   Prompt optimized for local LLM (Qwen 7B, 16GB RAM, context window: 4096 tokens)`);
        
        // Adjust max_tokens based on available context
        // Context window: 4096, reserve ~500 for overhead, prompt uses ~promptSize
        const availableForResponse = 4096 - promptSize - 500;
        const maxTokens = Math.min(1500, Math.max(500, availableForResponse));
        console.log(`   Max tokens for response: ${maxTokens}`);

        // Call LLM with increased timeout (10 minutes = 600000ms)
        stepStartTime = Date.now();
        const completion = await openai.chat.completions.create({
            model: LM_STUDIO_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.3, // Lower temperature for more consistent output
            max_tokens: maxTokens, // Dynamic based on prompt size
            timeout: 600000, // 10 minutes timeout for LLM response
        });
        const llmTime = Date.now() - stepStartTime;
        console.log(`⏱️  LLM processing: ${llmTime}ms (${(llmTime / 1000).toFixed(2)}s)`);

        const responseText = completion.choices[0]?.message?.content || '';
        console.log(`   Response length: ${responseText.length} characters`);

        // Parse JSON response
        stepStartTime = Date.now();
        const result = parseJSONFromResponse(responseText);
        const parseTime = Date.now() - stepStartTime;
        console.log(`⏱️  Parse JSON: ${parseTime}ms`);

        if (!result) {
            console.error('❌ Failed to parse LLM response as JSON');
            console.error('   Raw response:', responseText.substring(0, 500));
            throw new Error('LLM không trả về JSON hợp lệ!');
        }

        // Calculate total score from criteria_scores if available (preferred method)
        let totalScore = 0;
        if (result.criteria_scores && typeof result.criteria_scores === 'object') {
            // Load scoring rubric to get weights
            const cvScoring = loadCVScoring();
            const rubric = cvScoring.rubric || {};
            
            // Calculate total score from criteria_scores * weights
            let totalWeightedScore = 0;
            let totalMaxScore = 0;
            
            Object.keys(rubric).forEach(criterion => {
                const weight = rubric[criterion]?.weight || 0;
                const score = result.criteria_scores[criterion] || 0;
                
                // Ensure score doesn't exceed weight
                const clampedScore = Math.max(0, Math.min(weight, score));
                totalWeightedScore += clampedScore;
                totalMaxScore += weight;
            });
            
            // Calculate percentage (0-100)
            totalScore = totalMaxScore > 0 ? Math.round((totalWeightedScore / totalMaxScore) * 100) : 0;
            result.score = totalScore; // Set score for backward compatibility
            result.criteria_scores_detail = result.criteria_scores; // Keep detailed scores
            
            console.log(`📊 Calculated score from criteria: ${totalWeightedScore}/${totalMaxScore} = ${totalScore}%`);
        } else if (typeof result.score === 'number' && result.score >= 0 && result.score <= 100) {
            // Fallback: use score directly if criteria_scores not available
            totalScore = Math.round(result.score);
            console.log(`📊 Using direct score: ${totalScore}%`);
        } else {
            console.warn('⚠️  Invalid score and no criteria_scores, defaulting to 0');
            totalScore = 0;
            result.score = 0;
        }

        if (typeof result.ready !== 'boolean') {
            // Auto-determine ready based on score and issues
            const hasHighSeverity = result.issues?.some(issue => issue.severity === 'high') || false;
            result.ready = totalScore >= 80 && !hasHighSeverity;
        }

        if (!Array.isArray(result.issues)) {
            result.issues = [];
        }

        // Backward compatibility: Support both exact_quote and original_text
        // Priority: exact_quote > original_text
        result.issues = result.issues.map(issue => {
            if (!issue.exact_quote && issue.original_text) {
                // Fallback: use original_text if exact_quote not provided
                issue.exact_quote = issue.original_text;
            }
            return issue;
        });

        // Validation temporarily disabled - show all issues from LLM
        // TODO: Re-enable validation after fixing matching logic
        console.log(`📊 LLM returned ${result.issues.length} issues (validation disabled)`);

        // Ensure summary exists
        if (!result.summary) {
            result.summary = `CV được chấm ${totalScore}/100 điểm. ${result.issues.length > 0 ? `Có ${result.issues.length} vấn đề cần sửa.` : 'CV khá tốt.'}`;
        }

        // Add match rate interpretation (for UI display)
        let matchRateInterpretation = '';
        if (totalScore >= 85) {
            matchRateInterpretation = 'Rất phù hợp / Short-list';
        } else if (totalScore >= 70) {
            matchRateInterpretation = 'Phù hợp tốt';
        } else if (totalScore >= 60) {
            matchRateInterpretation = 'Có thể phỏng vấn';
        } else {
            matchRateInterpretation = 'Cần chỉnh sửa CV';
        }
        result.matchRateInterpretation = matchRateInterpretation;

        const totalTime = Date.now() - startTime;
        console.log(`✅ CV review completed: Score ${totalScore}/100 (${matchRateInterpretation}), Ready: ${result.ready}, Issues: ${result.issues.length}`);
        console.log(`⏱️  Total time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
        console.log(`   Breakdown: Load ${loadTime}ms + Build ${buildPromptTime}ms + LLM ${llmTime}ms + Parse ${parseTime}ms`);

        return {
            success: true,
            data: result
        };

    } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error('❌ Error in CV review:', error);
        console.error(`⏱️  Failed after: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
        return {
            success: false,
            error: error.message || 'Lỗi không xác định khi review CV!'
        };
    }
}

