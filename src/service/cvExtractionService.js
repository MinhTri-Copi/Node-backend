/**
 * CV Text Extraction Service
 * Extract text từ CV file (PDF/DOCX) và lưu vào database
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import db from '../models/index.js';

// Dependencies sẽ được install sau
let pdfParse = null;
let mammoth = null;

// Lazy load dependencies
const loadDependencies = async () => {
    try {
        if (!pdfParse) {
            pdfParse = (await import('pdf-parse')).default;
        }
        if (!mammoth) {
            mammoth = (await import('mammoth')).default;
        }
    } catch (error) {
        console.warn('⚠️ CV extraction dependencies chưa được install:', error.message);
        console.warn('   Chạy: npm install pdf-parse mammoth');
    }
};

/**
 * Tính file hash (MD5) để detect duplicate
 */
const calculateFileHash = (fileBuffer) => {
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
};

/**
 * Extract text từ PDF (text-based)
 */
const extractPdfText = async (filePath) => {
    await loadDependencies();
    
    if (!pdfParse) {
        throw new Error('pdf-parse chưa được install. Chạy: npm install pdf-parse');
    }

    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        // Clean text: remove multiple spaces/newlines
        const text = (data.text || '').replace(/\s+\n/g, '\n').trim();
        return text;
    } catch (error) {
        console.error('Error extracting PDF text:', error);
        throw new Error(`Không thể extract text từ PDF: ${error.message}`);
    }
};

/**
 * Extract text từ DOCX
 */
const extractDocxText = async (filePath) => {
    await loadDependencies();
    
    if (!mammoth) {
        throw new Error('mammoth chưa được install. Chạy: npm install mammoth');
    }

    try {
        const result = await mammoth.extractRawText({ path: filePath });
        return (result.value || '').trim();
    } catch (error) {
        console.error('Error extracting DOCX text:', error);
        throw new Error(`Không thể extract text từ DOCX: ${error.message}`);
    }
};

/**
 * Detect nếu PDF là scan (image-based)
 * Nếu text quá ngắn (< 200 chars) → có thể là scan
 */
const detectScannedPdf = async (filePath) => {
    try {
        const text = await extractPdfText(filePath);
        const textLength = text.replace(/\s/g, '').length;
        return textLength < 200; // Ngưỡng tùy chỉnh
    } catch (error) {
        // Nếu không extract được → có thể là scan
        return true;
    }
};

/**
 * Extract text từ file CV
 * Tự động detect loại file và extract
 */
const extractCVText = async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.pdf') {
        // Check nếu là scan
        const isScanned = await detectScannedPdf(filePath);
        if (isScanned) {
            throw new Error('PDF này là scan/ảnh. Vui lòng upload PDF text-based hoặc DOCX.');
        }
        return await extractPdfText(filePath);
    } else if (ext === '.docx' || ext === '.doc') {
        return await extractDocxText(filePath);
    } else {
        throw new Error(`Định dạng file không được hỗ trợ: ${ext}. Chỉ hỗ trợ PDF và DOCX.`);
    }
};

/**
 * Tạo hoặc cập nhật CandidateCV record
 */
const createOrUpdateCandidateCV = async (userId, filePath, fileBuffer) => {
    try {
        const fileHash = calculateFileHash(fileBuffer);
        
        // Check nếu đã có CV với cùng fileHash
        let candidateCV = await db.CandidateCV.findOne({
            where: { fileHash }
        });

        if (candidateCV) {
            // Nếu đã có và đã extract xong → return luôn
            if (candidateCV.extractionStatus === 'READY' && candidateCV.cvText) {
                return {
                    EM: 'CV đã được xử lý trước đó',
                    EC: 0,
                    DT: candidateCV
                };
            }
            
            // Nếu đang processing hoặc failed → update lại
            candidateCV.cvFilePath = filePath;
            candidateCV.extractionStatus = 'PENDING';
            candidateCV.errorMessage = null;
            await candidateCV.save();
        } else {
            // Tạo mới
            candidateCV = await db.CandidateCV.create({
                userId,
                cvFilePath: filePath,
                fileHash,
                extractionStatus: 'PENDING'
            });
        }

        return {
            EM: 'CV đã được lưu, đang chờ xử lý',
            EC: 0,
            DT: candidateCV
        };
    } catch (error) {
        console.error('Error creating CandidateCV:', error);
        return {
            EM: `Lỗi khi lưu CV: ${error.message}`,
            EC: -1,
            DT: null
        };
    }
};

/**
 * Process CV extraction (async - được gọi bởi background job)
 */
const processCVExtraction = async (candidateCVId) => {
    try {
        const candidateCV = await db.CandidateCV.findByPk(candidateCVId);
        
        if (!candidateCV) {
            throw new Error('Không tìm thấy CandidateCV');
        }

        // Update status = PROCESSING
        candidateCV.extractionStatus = 'PROCESSING';
        candidateCV.errorMessage = null;
        await candidateCV.save();

        // Extract text
        const cvText = await extractCVText(candidateCV.cvFilePath);
        
        if (!cvText || cvText.trim().length === 0) {
            throw new Error('Không thể extract text từ CV (file có thể là scan/ảnh)');
        }

        // Update CV với text đã extract
        candidateCV.cvText = cvText;
        candidateCV.extractionStatus = 'READY';
        candidateCV.extractedAt = new Date();
        await candidateCV.save();

        console.log(`✅ Đã extract CV text cho user ${candidateCV.userId}, length: ${cvText.length}`);

        return {
            EM: 'Extract CV text thành công',
            EC: 0,
            DT: candidateCV
        };
    } catch (error) {
        console.error('Error processing CV extraction:', error);
        
        // Update status = FAILED
        if (candidateCV) {
            candidateCV.extractionStatus = 'FAILED';
            candidateCV.errorMessage = error.message;
            await candidateCV.save();
        }

        return {
            EM: `Lỗi khi extract CV: ${error.message}`,
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get CV extraction status của user
 */
const getCVExtractionStatus = async (userId) => {
    try {
        const candidateCV = await db.CandidateCV.findOne({
            where: { userId },
            order: [['createdAt', 'DESC']] // Lấy CV mới nhất
        });

        if (!candidateCV) {
            return {
                EM: 'Chưa có CV được upload',
                EC: 1,
                DT: {
                    status: 'NO_CV',
                    hasCV: false
                }
            };
        }

        return {
            EM: 'OK',
            EC: 0,
            DT: {
                status: candidateCV.extractionStatus || 'PENDING',
                hasCV: true,
                extractedAt: candidateCV.extractedAt,
                errorMessage: candidateCV.errorMessage,
                fileHash: candidateCV.fileHash
            }
        };
    } catch (error) {
        console.error('Error getting CV extraction status:', error);
        return {
            EM: `Lỗi: ${error.message}`,
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get CV text của user (nếu đã extract)
 */
const getCVTextByUserId = async (userId) => {
    try {
        const candidateCV = await db.CandidateCV.findOne({
            where: {
                userId,
                extractionStatus: 'READY'
            },
            order: [['extractedAt', 'DESC']] // Lấy CV mới nhất
        });

        if (!candidateCV || !candidateCV.cvText) {
            return {
                EM: 'Chưa có CV text cho user này',
                EC: 1,
                DT: null
            };
        }

        return {
            EM: 'OK',
            EC: 0,
            DT: {
                cvText: candidateCV.cvText,
                extractedAt: candidateCV.extractedAt,
                fileHash: candidateCV.fileHash
            }
        };
    } catch (error) {
        console.error('Error getting CV text:', error);
        return {
            EM: `Lỗi: ${error.message}`,
            EC: -1,
            DT: null
        };
    }
};

export {
    extractCVText,
    extractPdfText,
    extractDocxText,
    detectScannedPdf,
    createOrUpdateCandidateCV,
    processCVExtraction,
    getCVTextByUserId,
    getCVExtractionStatus,
    calculateFileHash
};

