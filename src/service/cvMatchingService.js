/**
 * CV Matching Service
 * Tìm công việc phù hợp với CV của ứng viên bằng two-stage filtering
 * 
 * Flow:
 * 1. Stage 0: Rule filter (location, level, salary, major) → giảm tải
 * 2. Stage 1: Cosine similarity với JD embeddings → top 50
 * 3. Stage 2: ML model rerank → top 10 (nếu có model)
 */

import db from '../models/index.js';
import { getCVTextByUserId } from './cvExtractionService.js';
import { getJobPostingEmbeddingsBatch, embedText } from './jobPostingEmbeddingService.js';
import { matchCVWithML, checkCVMatchingHealth } from './cvMatchingClient.js';
import crypto from 'crypto';

const ML_SERVICE_URL = process.env.FAST_GRADING_URL || 'http://127.0.0.1:8000';
const DEFAULT_MODEL_VERSION = 'all-MiniLM-L6-v2';
const TOP_N_COSINE = 50; // Top 50 jobs sau cosine similarity
const TOP_N_FINAL = 10; // Top 10 jobs sau ML rerank

// Simple in-memory cache (có thể nâng cấp thành Redis sau)
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 giờ

/**
 * Tính cosine similarity giữa 2 vectors
 */
const cosineSimilarity = (vec1, vec2) => {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) {
        return 0;
    }

    // Dot product
    let dotProduct = 0;
    for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
    }

    // Norms
    const norm1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const norm2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));

    // Cosine similarity
    if (norm1 === 0 || norm2 === 0) {
        return 0;
    }

    return dotProduct / (norm1 * norm2 + 1e-9);
};

/**
 * Stage 0: Rule filter - Filter job postings theo location, level, salary, major
 * Giảm tải từ 10,000 JD → ~500 JD
 */
const ruleFilterJobPostings = async (filters = {}) => {
    try {
        const { location, minSalary, maxSalary, majorId, experience } = filters;

        // Build where clause
        const where = {
            TrangthaiId: 1 // Chỉ lấy job đang active
        };

        // Filter by location
        if (location) {
            where.Diadiem = {
                [db.Sequelize.Op.like]: `%${location}%`
            };
        }

        // Filter by salary range
        if (minSalary !== undefined) {
            where.Luongtoithieu = {
                [db.Sequelize.Op.gte]: minSalary
            };
        }
        if (maxSalary !== undefined) {
            where.Luongtoida = {
                [db.Sequelize.Op.lte]: maxSalary
            };
        }

        // Filter by experience
        if (experience) {
            where.Kinhnghiem = {
                [db.Sequelize.Op.like]: `%${experience}%`
            };
        }

        // Query job postings với đầy đủ thông tin để làm JD text đầy đủ hơn
        let jobPostings = await db.JobPosting.findAll({
            where,
            include: [
                {
                    model: db.Company,
                    as: 'Company',
                    attributes: ['id', 'Tencongty'] // Chỉ lấy tên công ty
                },
                {
                    model: db.Major,
                    attributes: ['id', 'TenNghanhNghe'],
                    through: { attributes: [] } // Không lấy thông tin từ bảng trung gian
                }
            ],
            attributes: ['id', 'Tieude', 'Mota', 'Diadiem', 'Luongtoithieu', 'Luongtoida', 'Kinhnghiem', 'formatId']
        });

        // Filter by major (nếu có)
        if (majorId) {
            const majorJobPostings = await db.MajorJobPosting.findAll({
                where: { majorId },
                attributes: ['jobPostingId']
            });
            const jobPostingIds = majorJobPostings.map(mjp => mjp.jobPostingId);
            jobPostings = jobPostings.filter(jp => jobPostingIds.includes(jp.id));
        }

        console.log(`📊 [RULE FILTER] Từ tất cả jobs → ${jobPostings.length} jobs sau filter`);

        return {
            EM: 'OK',
            EC: 0,
            DT: jobPostings
        };
    } catch (error) {
        console.error('Error in ruleFilterJobPostings:', error);
        return {
            EM: `Lỗi khi filter jobs: ${error.message}`,
            EC: -1,
            DT: []
        };
    }
};

/**
 * Get hoặc embed CV text
 */
const getOrEmbedCV = async (userId) => {
    try {
        // Thử lấy CV text đã extract
        const cvTextResult = await getCVTextByUserId(userId);

        if (cvTextResult.EC === 0 && cvTextResult.DT?.cvText) {
            // Đã có CV text → embed nó
            console.log(`🔄 Đang embed CV text cho user ${userId}...`);
            const cvEmbedding = await embedText(cvTextResult.DT.cvText);
            return {
                EM: 'OK',
                EC: 0,
                DT: {
                    cvText: cvTextResult.DT.cvText,
                    cvEmbedding,
                    source: 'extracted'
                }
            };
        }

        // Nếu chưa có CV text → return error
        return {
            EM: 'Chưa có CV text. Vui lòng upload CV trước.',
            EC: 1,
            DT: null
        };
    } catch (error) {
        console.error('Error in getOrEmbedCV:', error);
        return {
            EM: `Lỗi: ${error.message}`,
            EC: -1,
            DT: null
        };
    }
};

/**
 * Generate cache key từ cvHash, filters, và modelVersion
 */
const generateCacheKey = (cvHash, filters, modelVersion = 'default') => {
    const filterStr = JSON.stringify(filters);
    return `cv_match_${cvHash}_${modelVersion}_${crypto.createHash('md5').update(filterStr).digest('hex')}`;
};

/**
 * Generate reasons/explanation cho match score
 */
const generateMatchReasons = (job, matchScore, cvText = '') => {
    const reasons = [];
    
    // Location match
    if (job.Diadiem) {
        reasons.push(`📍 Địa điểm: ${job.Diadiem}`);
    }
    
    // Salary range
    if (job.Luongtoithieu && job.Luongtoida) {
        reasons.push(`💰 Mức lương: ${formatSalary(job.Luongtoithieu, job.Luongtoida)}`);
    }
    
    // Experience level
    if (job.Kinhnghiem) {
        reasons.push(`💼 Kinh nghiệm: ${job.Kinhnghiem}`);
    }
    
    // Match score explanation
    if (matchScore >= 80) {
        reasons.push('✅ CV của bạn rất phù hợp với yêu cầu công việc');
    } else if (matchScore >= 60) {
        reasons.push('👍 CV của bạn phù hợp tốt với yêu cầu công việc');
    } else if (matchScore >= 40) {
        reasons.push('⚠️ CV của bạn phù hợp một phần với yêu cầu công việc');
    }
    
    return reasons;
};

/**
 * Format salary
 */
const formatSalary = (min, max) => {
    if (!min && !max) return 'Thỏa thuận';
    if (min && max) {
        return `${(min / 1000000).toFixed(1)} - ${(max / 1000000).toFixed(1)} triệu`;
    }
    if (min) return `Từ ${(min / 1000000).toFixed(1)} triệu`;
    if (max) return `Đến ${(max / 1000000).toFixed(1)} triệu`;
    return 'Thỏa thuận';
};

/**
 * Tìm công việc phù hợp với CV (Two-stage với ML rerank)
 * 
 * @param {number} userId - ID của user
 * @param {object} filters - Filters: { location, minSalary, maxSalary, majorId, experience }
 * @returns {object} { EM, EC, DT: [{ jobPosting, matchScore, scoreRatio, reasons }] }
 */
const findMatchingJobs = async (userId, filters = {}) => {
    try {
        console.log(`🔍 [CV MATCHING] Bắt đầu tìm jobs phù hợp cho user ${userId}`);

        // Step 1: Get hoặc embed CV
        const cvResult = await getOrEmbedCV(userId);
        if (cvResult.EC !== 0) {
            return cvResult;
        }

        const { cvText, cvEmbedding, fileHash } = cvResult.DT;
        const modelVersion = DEFAULT_MODEL_VERSION; // Có thể lấy từ metadata sau

        // Step 2: Check cache
        const cacheKey = generateCacheKey(fileHash || 'no_hash', filters, modelVersion);
        const cached = cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
            console.log(`💾 [CV MATCHING] Sử dụng cache cho user ${userId}`);
            return {
                EM: cached.data.EM,
                EC: 0,
                DT: cached.data.DT
            };
        }

        // Step 3: Stage 0 - Rule filter
        const filterResult = await ruleFilterJobPostings(filters);
        if (filterResult.EC !== 0 || filterResult.DT.length === 0) {
            return {
                EM: 'Không tìm thấy công việc phù hợp với bộ lọc của bạn.',
                EC: 0,
                DT: []
            };
        }

        const filteredJobs = filterResult.DT;
        const jobPostingIds = filteredJobs.map(job => job.id);

        // Step 4: Get JD embeddings
        console.log(`🔄 [STAGE 1] Đang lấy JD embeddings cho ${jobPostingIds.length} jobs...`);
        const embeddingsResult = await getJobPostingEmbeddingsBatch(jobPostingIds);

        if (embeddingsResult.EC !== 0) {
            return {
                EM: 'Lỗi khi lấy JD embeddings',
                EC: -1,
                DT: []
            };
        }

        const jdEmbeddings = embeddingsResult.DT;

        // Step 5: Stage 1 - Cosine similarity
        console.log(`🔄 [STAGE 1] Đang tính cosine similarity...`);
        const cosineMatches = [];
        let missingEmbeddings = 0;
        const MIN_JD_LENGTH = 100; // Tối thiểu 100 ký tự để match chính xác
        const MIN_COMPREHENSIVE_JD_LENGTH = 400; // JD đủ dài từ các field khác (dùng chung cho Stage 1 và Stage 2)

        // Helper function để check Mota có phải placeholder không (dùng chung cho Stage 1 và Stage 2)
        const isValidMota = (mota) => {
            if (!mota || mota.trim().length === 0) return false;
            const motaLower = mota.toLowerCase().trim();
            // Filter out các placeholder text - match exact word hoặc standalone phrase
            const placeholders = [
                'không có mô tả',
                'không có',
                'n/a',
                ' chưa có',
                'đang cập nhật',
                'sẽ cập nhật',
                'null',
                'undefined'
            ];
            // Check exact phrases first
            for (const p of placeholders) {
                if (motaLower === p || motaLower.startsWith(p + ' ') || motaLower.endsWith(' ' + p) || motaLower.includes(' ' + p + ' ')) {
                    return false;
                }
            }
            // Special case: "na" chỉ match nếu là standalone word (không phải part của "java", "python", etc.)
            // "n/a" đã được check ở trên
            const naRegex = /\bna\b/;
            if (naRegex.test(motaLower)) {
                return false;
            }
            return true;
        };

        for (const job of filteredJobs) {
            let jdEmbedding = jdEmbeddings[job.id]?.embedding;

            // Helper function để tạo JD text đầy đủ từ nhiều fields (theo chuẩn DB)
            const buildJDText = (job) => {
                const parts = [];
                
                // 1. Tieude (JobPosting) - Title
                if (job.Tieude) parts.push(job.Tieude);
                
                // 2. Mota (JobPosting) - Description (chỉ thêm nếu không phải placeholder)
                if (job.Mota && isValidMota(job.Mota)) {
                    parts.push(job.Mota);
                }
                
                // 3. Diadiem (JobPosting) - Location
                if (job.Diadiem) {
                    parts.push(`Địa điểm: ${job.Diadiem}`);
                }
                
                // 4. Kinhnghiem (JobPosting) - Experience
                if (job.Kinhnghiem) {
                    parts.push(`Kinh nghiệm yêu cầu: ${job.Kinhnghiem}`);
                }
                
                // 5. Luongtoithieu, Luongtoida (JobPosting) - Salary
                if (job.Luongtoithieu || job.Luongtoida) {
                    const salaryParts = [];
                    if (job.Luongtoithieu) salaryParts.push(`${(job.Luongtoithieu / 1000000).toFixed(1)} triệu`);
                    if (job.Luongtoida) salaryParts.push(`${(job.Luongtoida / 1000000).toFixed(1)} triệu`);
                    parts.push(`Mức lương: ${salaryParts.join(' - ')} VNĐ`);
                }
                
                // 6. Majors (Ngành nghề) - Domain/Stack
                const majors = job.Majors || job.majors || [];
                if (majors.length > 0) {
                    const majorNames = majors.map(m => m.TenNghanhNghe).join(', ');
                    parts.push(`Ngành nghề: ${majorNames}`);
                }
                
                // 7. Company name only (Company) - Chỉ lấy tên công ty
                if (job.Company && job.Company.Tencongty) {
                    parts.push(`Công ty: ${job.Company.Tencongty}`);
                }
                
                return parts.filter(Boolean).join('. ');
            };

            // Build JD text đầy đủ
            const jdText = buildJDText(job);
            
            // Validation: JD text phải đủ dài để match chính xác
            if (jdText.trim().length < MIN_JD_LENGTH) {
                console.warn(`⚠️ Job ${job.id} có JD text quá ngắn (${jdText.length} < ${MIN_JD_LENGTH}): "${jdText.substring(0, 100)}..."`);
                // Vẫn tiếp tục nhưng log warning để debug
            }

            // Fallback: Nếu chưa có embedding, embed on-the-fly
            if (!jdEmbedding) {
                if (jdText.trim().length > 0) {
                    console.log(`⚠️ Job ${job.id} chưa có embedding, đang embed on-the-fly (JD length: ${jdText.length})...`);
                    try {
                        jdEmbedding = await embedText(jdText);
                        missingEmbeddings++;
                    } catch (embedError) {
                        console.warn(`⚠️ Không thể embed JD cho job ${job.id}: ${embedError.message}`);
                        continue;
                    }
                } else {
                    console.warn(`⚠️ Job ${job.id} không có đủ thông tin, bỏ qua`);
                    continue;
                }
            }

            const similarity = cosineSimilarity(cvEmbedding, jdEmbedding);
            
            // Penalty nếu JD text quá ngắn hoặc không có Mota thật sự
            let adjustedSimilarity = similarity;
            const hasValidMota = job.Mota && isValidMota(job.Mota);
            
            if (!hasValidMota && jdText.trim().length < MIN_COMPREHENSIVE_JD_LENGTH) {
                // Chỉ penalty nếu KHÔNG có Mota VÀ JD text ngắn (< 400 chars)
                // Nếu JD text đã dài (từ Company, Majors, etc.) thì không cần Mota cũng OK
                adjustedSimilarity = similarity * 0.25;
                console.warn(`⚠️ Job ${job.id} không có Mota hợp lệ VÀ JD ngắn → penalty: ${similarity.toFixed(3)} → ${adjustedSimilarity.toFixed(3)} (giảm 75%)`);
            } else if (jdText.trim().length < MIN_JD_LENGTH) {
                // Nếu JD text quá ngắn → penalty nhẹ (giảm 20%)
                adjustedSimilarity = similarity * 0.8;
                console.warn(`⚠️ Job ${job.id} có JD text quá ngắn (${jdText.length} < ${MIN_JD_LENGTH}) → penalty: ${similarity.toFixed(3)} → ${adjustedSimilarity.toFixed(3)}`);
            }
            
            // Log nếu JD không có Mota nhưng đủ dài (không bị penalty)
            if (!hasValidMota && jdText.trim().length >= MIN_COMPREHENSIVE_JD_LENGTH) {
                console.log(`✅ Job ${job.id}: Không có Mota nhưng JD đủ dài (${jdText.length} chars) → không penalty`);
            }
            
            // Log JD text length và similarity để debug
            if (jdText.trim().length < MIN_JD_LENGTH || !hasValidMota) {
                console.log(`📊 Job ${job.id}: JD length=${jdText.length}, hasValidMota=${hasValidMota}, similarity=${similarity.toFixed(3)} → adjusted=${adjustedSimilarity.toFixed(3)}`);
            }

            cosineMatches.push({
                jobPosting: job,
                cosineSimilarity: adjustedSimilarity, // Dùng adjusted similarity
                jdText: jdText
            });
        }

        if (missingEmbeddings > 0) {
            console.log(`⚠️ [STAGE 1] Đã embed on-the-fly cho ${missingEmbeddings} jobs chưa có embedding`);
        }

        // Sort và lấy top 50
        cosineMatches.sort((a, b) => b.cosineSimilarity - a.cosineSimilarity);
        const top50Matches = cosineMatches.slice(0, TOP_N_COSINE);

        console.log(`✅ [STAGE 1] Tìm thấy ${top50Matches.length} jobs sau cosine similarity`);

        // Step 6: Stage 2 - ML model rerank (nếu có model)
        let finalMatches = top50Matches;
        const useMLRerank = await checkCVMatchingHealth();

        if (useMLRerank && top50Matches.length > 0) {
            try {
                console.log(`🔄 [STAGE 2] Đang rerank bằng ML model...`);
                const jdTexts = top50Matches.map(m => m.jdText);
                
                // Log JD text lengths để debug
                const shortJDs = top50Matches.filter(m => m.jdText.length < MIN_JD_LENGTH);
                if (shortJDs.length > 0) {
                    console.warn(`⚠️ [STAGE 2] Có ${shortJDs.length} JD text quá ngắn (< ${MIN_JD_LENGTH}):`);
                    shortJDs.forEach(m => {
                        console.warn(`   Job ${m.jobPosting.id}: length=${m.jdText.length}, text="${m.jdText.substring(0, 80)}..."`);
                    });
                }
                
                const mlResults = await matchCVWithML(cvText, jdTexts);

                // Map ML results back to jobs
                const mlMatches = mlResults.map((mlResult, idx) => {
                    const originalMatch = top50Matches[mlResult.jdIndex];
                    const jdText = originalMatch.jdText;
                    const job = originalMatch.jobPosting;
                    const hasValidMota = job.Mota && isValidMota(job.Mota);
                    
                    // Apply penalty cho ML results nếu không có Mota hoặc JD quá ngắn
                    let adjustedMatchScore = mlResult.matchScore;
                    let adjustedScoreRatio = mlResult.scoreRatio;
                    
                    if (!hasValidMota && jdText.length < MIN_COMPREHENSIVE_JD_LENGTH) {
                        // Chỉ penalty nếu KHÔNG có Mota VÀ JD text ngắn (< 400 chars)
                        adjustedMatchScore = Math.round(mlResult.matchScore * 0.25);
                        adjustedScoreRatio = mlResult.scoreRatio * 0.25;
                        console.warn(`⚠️ [ML] Job ${job.id} không có Mota hợp lệ VÀ JD ngắn → penalty: ${mlResult.matchScore}% → ${adjustedMatchScore}% (giảm 75%)`);
                    } else if (jdText.length < MIN_JD_LENGTH) {
                        // Nếu JD text quá ngắn → penalty nhẹ (giảm 20%)
                        adjustedMatchScore = Math.round(mlResult.matchScore * 0.8);
                        adjustedScoreRatio = mlResult.scoreRatio * 0.8;
                        console.warn(`⚠️ [ML] Job ${job.id} có JD text quá ngắn (${jdText.length} < ${MIN_JD_LENGTH}) → penalty: ${mlResult.matchScore}% → ${adjustedMatchScore}%`);
                    }
                    
                    // Log nếu JD không có Mota nhưng đủ dài (không bị penalty)
                    if (!hasValidMota && jdText.length >= MIN_COMPREHENSIVE_JD_LENGTH) {
                        console.log(`✅ [ML] Job ${job.id}: Không có Mota nhưng JD đủ dài (${jdText.length} chars) → không penalty, score = ${adjustedMatchScore}%`);
                    }
                    
                    // Log nếu JD text ngắn và match score thấp
                    if (jdText.length < MIN_JD_LENGTH || !hasValidMota) {
                        console.log(`📊 [ML] Job ${job.id}: JD length=${jdText.length}, hasValidMota=${hasValidMota}, matchScore=${mlResult.matchScore}% → adjusted=${adjustedMatchScore}%`);
                    }
                    
                    return {
                        jobPosting: job,
                        matchScore: adjustedMatchScore, // Adjusted từ ML model
                        scoreRatio: adjustedScoreRatio, // Adjusted từ ML model
                        cosineSimilarity: originalMatch.cosineSimilarity,
                        reasons: generateMatchReasons(job, adjustedMatchScore, cvText)
                    };
                });

                // Sort theo scoreRatio (cao → thấp) và lấy top 10
                mlMatches.sort((a, b) => b.scoreRatio - a.scoreRatio);
                finalMatches = mlMatches.slice(0, TOP_N_FINAL);

                console.log(`✅ [STAGE 2] ML rerank hoàn thành - Top match: ${finalMatches[0]?.matchScore || 0}%`);
            } catch (mlError) {
                console.warn(`⚠️ ML rerank failed, dùng cosine similarity: ${mlError.message}`);
                // Fallback: dùng cosine similarity
                finalMatches = top50Matches.slice(0, TOP_N_FINAL).map(m => ({
                    jobPosting: m.jobPosting,
                    matchScore: Math.round(m.cosineSimilarity * 100),
                    scoreRatio: m.cosineSimilarity,
                    cosineSimilarity: m.cosineSimilarity,
                    reasons: generateMatchReasons(m.jobPosting, Math.round(m.cosineSimilarity * 100), cvText)
                }));
            }
        } else {
            // Không có ML model → dùng cosine similarity
            finalMatches = top50Matches.slice(0, TOP_N_FINAL).map(m => ({
                jobPosting: m.jobPosting,
                matchScore: Math.round(m.cosineSimilarity * 100),
                scoreRatio: m.cosineSimilarity,
                cosineSimilarity: m.cosineSimilarity,
                reasons: generateMatchReasons(m.jobPosting, Math.round(m.cosineSimilarity * 100), cvText)
            }));
        }

        // Step 7: Filter chỉ giữ lại jobs có match score > 50%
        const MIN_MATCH_SCORE = 50;
        const filteredMatches = finalMatches.filter(m => m.matchScore > MIN_MATCH_SCORE);
        
        if (filteredMatches.length === 0 && finalMatches.length > 0) {
            console.warn(`⚠️ [CV MATCHING] Không có job nào có match score > ${MIN_MATCH_SCORE}% (top score: ${finalMatches[0]?.matchScore || 0}%)`);
        } else if (filteredMatches.length < finalMatches.length) {
            console.log(`📊 [CV MATCHING] Lọc bỏ ${finalMatches.length - filteredMatches.length} jobs có match score ≤ ${MIN_MATCH_SCORE}%`);
        }

        // Step 8: Cache results
        cache.set(cacheKey, {
            timestamp: Date.now(),
            data: {
                EM: `Tìm thấy ${filteredMatches.length} công việc phù hợp`,
                DT: filteredMatches
            }
        });

        // Clean old cache entries (simple cleanup)
        if (cache.size > 100) {
            const now = Date.now();
            for (const [key, value] of cache.entries()) {
                if (now - value.timestamp > CACHE_TTL) {
                    cache.delete(key);
                }
            }
        }

        console.log(`✅ [CV MATCHING] Hoàn thành - ${filteredMatches.length} jobs phù hợp nhất (match score > ${MIN_MATCH_SCORE}%)`);

        return {
            EM: filteredMatches.length > 0 
                ? `Tìm thấy ${filteredMatches.length} công việc phù hợp (match score > ${MIN_MATCH_SCORE}%)`
                : `Không tìm thấy công việc nào có độ phù hợp > ${MIN_MATCH_SCORE}%`,
            EC: 0,
            DT: filteredMatches
        };
    } catch (error) {
        console.error('Error in findMatchingJobs:', error);
        return {
            EM: `Lỗi khi tìm jobs: ${error.message}`,
            EC: -1,
            DT: []
        };
    }
};

/**
 * Get job posting details với match score (cho frontend)
 */
const getJobPostingWithMatchScore = async (jobPostingId, userId) => {
    try {
        const job = await db.JobPosting.findOne({
            where: { id: jobPostingId },
            include: [
                {
                    model: db.Company,
                    as: 'Company',
                    attributes: ['id', 'Tencongty']
                }
            ]
        });

        if (!job) {
            return {
                EM: 'Không tìm thấy công việc',
                EC: 1,
                DT: null
            };
        }

        // Tính match score nếu có CV
        const cvResult = await getOrEmbedCV(userId);
        let matchScore = null;
        let cosineSimilarity = null;

        if (cvResult.EC === 0 && cvResult.DT?.cvEmbedding) {
            const jdEmbeddingResult = await getJobPostingEmbeddingsBatch([jobPostingId]);
            const jdEmbedding = jdEmbeddingResult.DT[jobPostingId]?.embedding;

            if (jdEmbedding) {
                const similarity = cosineSimilarity(cvResult.DT.cvEmbedding, jdEmbedding);
                matchScore = Math.round(similarity * 100);
                cosineSimilarity = similarity;
            }
        }

        return {
            EM: 'OK',
            EC: 0,
            DT: {
                jobPosting: job,
                matchScore,
                cosineSimilarity
            }
        };
    } catch (error) {
        console.error('Error in getJobPostingWithMatchScore:', error);
        return {
            EM: `Lỗi: ${error.message}`,
            EC: -1,
            DT: null
        };
    }
};

export {
    findMatchingJobs,
    getJobPostingWithMatchScore,
    cosineSimilarity,
    ruleFilterJobPostings
};

