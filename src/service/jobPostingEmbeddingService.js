/**
 * Job Posting Embedding Service
 * Pre-embed JD text khi HR tạo/sửa job posting và lưu vào database
 */

import db from '../models/index.js';

const ML_SERVICE_URL = process.env.FAST_GRADING_URL || 'http://127.0.0.1:8000';
const DEFAULT_MODEL_VERSION = 'all-MiniLM-L6-v2';

/**
 * Gọi ML service để embed text
 * Tạm thời dùng endpoint /embed (sẽ tạo sau) hoặc có thể gọi Python script trực tiếp
 */
const embedText = async (text) => {
    try {
        // TODO: Tạo endpoint /embed trong ML service
        // Tạm thời, có thể gọi Python script hoặc tạo endpoint mới
        
        // Option 1: Gọi endpoint /embed (sẽ tạo trong ML service)
        const response = await fetch(`${ML_SERVICE_URL}/embed`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text }),
            signal: AbortSignal.timeout(30000) // 30s timeout
        });

        if (!response.ok) {
            throw new Error(`ML service error: ${response.status}`);
        }

        const data = await response.json();
        return data.embedding; // Array of numbers
    } catch (error) {
        console.error('Error calling ML service for embedding:', error);
        // Fallback: có thể dùng Python script trực tiếp
        throw error;
    }
};

/**
 * Tạo hoặc cập nhật JobPostingEmbedding
 */
const createOrUpdateJobPostingEmbedding = async (jobPostingId, jdText, modelVersion = DEFAULT_MODEL_VERSION) => {
    try {
        if (!jdText || jdText.trim().length === 0) {
            return {
                EM: 'JD text không được để trống',
                EC: 1,
                DT: null
            };
        }

        // Tìm embedding hiện tại
        let embedding = await db.JobPostingEmbedding.findOne({
            where: { jobPostingId }
        });

        // Embed text
        console.log(`🔄 Đang embed JD cho job posting ${jobPostingId}...`);
        const embeddingVector = await embedText(jdText);
        const embeddingJson = JSON.stringify(embeddingVector);

        if (embedding) {
            // Update nếu đã có
            embedding.embedding = embeddingJson;
            embedding.modelVersion = modelVersion;
            embedding.jdEmbeddingUpdatedAt = new Date();
            await embedding.save();
        } else {
            // Tạo mới
            embedding = await db.JobPostingEmbedding.create({
                jobPostingId,
                embedding: embeddingJson,
                modelVersion,
                jdEmbeddingUpdatedAt: new Date()
            });
        }

        console.log(`✅ Đã embed JD cho job posting ${jobPostingId}`);

        return {
            EM: 'Embed JD thành công',
            EC: 0,
            DT: embedding
        };
    } catch (error) {
        console.error('Error creating/updating JobPostingEmbedding:', error);
        return {
            EM: `Lỗi khi embed JD: ${error.message}`,
            EC: -1,
            DT: null
        };
    }
};

/**
 * Lấy JD embedding từ database
 */
const getJobPostingEmbedding = async (jobPostingId) => {
    try {
        const embedding = await db.JobPostingEmbedding.findOne({
            where: { jobPostingId }
        });

        if (!embedding || !embedding.embedding) {
            return {
                EM: 'Chưa có embedding cho job posting này',
                EC: 1,
                DT: null
            };
        }

        // Parse JSON string thành array
        const embeddingVector = JSON.parse(embedding.embedding);

        return {
            EM: 'OK',
            EC: 0,
            DT: {
                embedding: embeddingVector,
                modelVersion: embedding.modelVersion,
                updatedAt: embedding.jdEmbeddingUpdatedAt
            }
        };
    } catch (error) {
        console.error('Error getting JobPostingEmbedding:', error);
        return {
            EM: `Lỗi: ${error.message}`,
            EC: -1,
            DT: null
        };
    }
};

/**
 * Lấy JD embeddings cho nhiều job postings (batch)
 */
const getJobPostingEmbeddingsBatch = async (jobPostingIds) => {
    try {
        const embeddings = await db.JobPostingEmbedding.findAll({
            where: {
                jobPostingId: jobPostingIds
            }
        });

        const result = {};
        for (const emb of embeddings) {
            if (emb.embedding) {
                result[emb.jobPostingId] = {
                    embedding: JSON.parse(emb.embedding),
                    modelVersion: emb.modelVersion,
                    updatedAt: emb.jdEmbeddingUpdatedAt
                };
            }
        }

        return {
            EM: 'OK',
            EC: 0,
            DT: result
        };
    } catch (error) {
        console.error('Error getting JobPostingEmbeddings batch:', error);
        return {
            EM: `Lỗi: ${error.message}`,
            EC: -1,
            DT: {}
        };
    }
};

/**
 * Xóa embedding khi job posting bị xóa (hook sẽ gọi)
 */
const deleteJobPostingEmbedding = async (jobPostingId) => {
    try {
        await db.JobPostingEmbedding.destroy({
            where: { jobPostingId }
        });
        return {
            EM: 'Đã xóa embedding',
            EC: 0,
            DT: null
        };
    } catch (error) {
        console.error('Error deleting JobPostingEmbedding:', error);
        return {
            EM: `Lỗi: ${error.message}`,
            EC: -1,
            DT: null
        };
    }
};

export {
    createOrUpdateJobPostingEmbedding,
    getJobPostingEmbedding,
    getJobPostingEmbeddingsBatch,
    deleteJobPostingEmbedding,
    embedText
};

